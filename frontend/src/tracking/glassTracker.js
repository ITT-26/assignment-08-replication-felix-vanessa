// Port of the prototype's dot-tracking pipeline (app.js) as a class: align the
// glasses reflection into a stabilized "pano" from two blue dot markers, then
// run MediaPipe Hand Landmarker on each lens crop. No phone detection.

import { loadOpenCV, loadHandLandmarker } from './loaders';

// ---- Config ----
const PREVIEW_W = 480;
const WARP_MAX_W = 1280;        // cap on the warp source resolution
const PANO_W = 640, PANO_H = 360;
const EYE_X = 0.18, EYE_Y = 0.60;   // eye anchor in the pano; smaller EYE_X zooms in
const EYE_SEP_PX = (1 - 2 * EYE_X) * PANO_W;
const LEFT = -1, RIGHT = 1;

// Blue dot markers. OpenCV hue is 0-179; ~120 is a saturated blue.
const DOT_HUE_LO = 90, DOT_HUE_HI = 140;
const DOT_SAT_MIN = 80, DOT_VAL_MIN = 60;
const DOT_SEARCH_FRAC = 0.6;    // search-box half-size x last inter-dot distance
const DOT_MIN_AREA = 15;
const DOT_BAND_FRAC = 0.5;      // vertical band the full-frame scan is limited to
const DOT_HOLD_FRAMES = 6;      // coast through blur dropouts before reacquiring

// One-Euro filter (Casiez 2012): smooths when still, relaxes on motion.
const STAB_MINCUTOFF = 0.8, STAB_BETA = 0.02, STAB_DCUTOFF = 1.0;
function euroAlpha(cutoff, dt) {
  const tau = 1.0 / (2.0 * Math.PI * cutoff);
  return 1.0 / (1.0 + tau / dt);
}
class OneEuro {
  constructor() { this.reset(); }
  reset() { this.xPrev = null; this.dxPrev = 0.0; }
  filter(x, dt) {
    if (this.xPrev === null) { this.xPrev = x; return x; }
    const dx = (x - this.xPrev) / dt;
    const aD = euroAlpha(STAB_DCUTOFF, dt);
    this.dxPrev = aD * dx + (1.0 - aD) * this.dxPrev;
    const a = euroAlpha(STAB_MINCUTOFF + STAB_BETA * Math.abs(this.dxPrev), dt);
    this.xPrev = a * x + (1.0 - a) * this.xPrev;
    return this.xPrev;
  }
}

// Per-lens ROI ellipse.
const LENS_DX = -0.22, LENS_DY = -0.10, LENS_RADIUS = 0.18, LENS_ASPECT = 0.90;
const LENS_BOUNDS_PAD = 16;

// Enhancement.
const GAMMA = 0.4, CLAHE_CLIP = 4.0, BILATERAL_D = 3, SAT_BOOST = 2.2;

// Both lens crops are upscaled to HAND_TILE and placed side by side for one
// inference call (a raw lens crop is too small to track on its own).
const HAND_TILE = 320;
const INDEX_FINGERTIP = 8;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export class GlassTracker {
  constructor() {
    this.cv = null;
    this.handLandmarker = null;
    this.HandLandmarker = null;

    this.closeKernel = null;
    this.openKernel = null;
    this.gammaLut = null;
    this.claheInstance = null;

    // Dot / stabilisation state.
    this.lastDot = [null, null];
    this.dotMissStreak = [0, 0];
    this.lastEyeDist = null;
    this.eyeFilters = [new OneEuro(), new OneEuro(), new OneEuro(), new OneEuro()]; // eLx,eLy,eRx,eRy
    this.lastAlignTime = null;

    this.lensBoundsCache = new Map();

    // Hand-detection scratch canvas (two lens crops side by side).
    this.handFrameIdx = 0;
    this.handTileCanvas = document.createElement('canvas');
    this.handTileCanvas.width = HAND_TILE * 2;
    this.handTileCanvas.height = HAND_TILE;
    this.handTileCtx = this.handTileCanvas.getContext('2d');

    // Offscreen mirrored warp source.
    this.warpCanvas = document.createElement('canvas');
    this.warpCtx = this.warpCanvas.getContext('2d', { willReadFrequently: true });

    // Per-frame Mat arena, freed in step()'s finally (avoids WASM heap leaks).
    this.FA = [];
  }

  keep(m) { this.FA.push(m); return m; }

  async init() {
    const [cv, hand] = await Promise.all([loadOpenCV(), loadHandLandmarker()]);
    this.cv = cv;
    this.handLandmarker = hand.handLandmarker;
    this.HandLandmarker = hand.HandLandmarker;

    this.closeKernel = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(11, 11));
    this.openKernel = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(5, 5));
    this.gammaLut = this._buildGammaLut();
  }

  dispose() {
    for (const m of [this.closeKernel, this.openKernel, this.gammaLut, this.claheInstance]) {
      try { m?.delete(); } catch { /* already freed */ }
    }
    this.closeKernel = this.openKernel = this.gammaLut = this.claheInstance = null;
  }

  _buildGammaLut() {
    const cv = this.cv;
    const lut = new cv.Mat(1, 256, cv.CV_8UC1);
    for (let i = 0; i < 256; i++) lut.data[i] = Math.min(255, Math.round(((i / 255) ** GAMMA) * 255));
    return lut;
  }

  nextDt() {
    const now = performance.now();
    const dt = this.lastAlignTime === null ? 1 / 30 : Math.max(0.001, (now - this.lastAlignTime) / 1000);
    this.lastAlignTime = now;
    return dt;
  }

  // ---- 1. Locate the glasses and align the eye region ----
  dotColorMask(hsv) {
    const cv = this.cv;
    let mask;
    if (DOT_HUE_LO <= DOT_HUE_HI) {
      const lo = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [DOT_HUE_LO, DOT_SAT_MIN, DOT_VAL_MIN, 0]);
      const hi = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [DOT_HUE_HI, 255, 255, 255]);
      mask = new cv.Mat();
      cv.inRange(hsv, lo, hi, mask);
      lo.delete(); hi.delete();
    } else {
      const lo1 = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [DOT_HUE_LO, DOT_SAT_MIN, DOT_VAL_MIN, 0]);
      const hi1 = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [179, 255, 255, 255]);
      const mask1 = new cv.Mat();
      cv.inRange(hsv, lo1, hi1, mask1);
      lo1.delete(); hi1.delete();

      const lo2 = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [0, DOT_SAT_MIN, DOT_VAL_MIN, 0]);
      const hi2 = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [DOT_HUE_HI, 255, 255, 255]);
      const mask2 = new cv.Mat();
      cv.inRange(hsv, lo2, hi2, mask2);
      lo2.delete(); hi2.delete();

      mask = new cv.Mat();
      cv.bitwise_or(mask1, mask2, mask);
      mask1.delete(); mask2.delete();
    }
    cv.morphologyEx(mask, mask, cv.MORPH_OPEN, this.openKernel);
    return mask;
  }

  dotBand(h) {
    const margin = Math.floor(h * (1 - DOT_BAND_FRAC) / 2);
    return [margin, h - margin];
  }

  findDot(hsv, expectedX, expectedY, searchR) {
    const cv = this.cv;
    const w = hsv.cols, h = hsv.rows;
    const [bandY0, bandY1] = this.dotBand(h);
    const x0 = clamp(Math.floor(expectedX - searchR), 0, w - 1);
    const y0 = clamp(Math.floor(expectedY - searchR), bandY0, bandY1 - 1);
    const x1 = clamp(Math.ceil(expectedX + searchR), x0 + 1, w);
    const y1 = clamp(Math.ceil(expectedY + searchR), y0 + 1, bandY1);
    const rect = new cv.Rect(x0, y0, x1 - x0, y1 - y0);
    const crop = hsv.roi(rect);
    const mask = this.dotColorMask(crop);
    crop.delete();

    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();
    cv.findContours(mask, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
    let bestArea = DOT_MIN_AREA, best = null;
    for (let i = 0; i < contours.size(); i++) {
      const c = contours.get(i);
      const a = cv.contourArea(c);
      if (a > bestArea) {
        const m = cv.moments(c, false);
        if (m.m00 > 0) { best = [m.m10 / m.m00 + x0, m.m01 / m.m00 + y0]; bestArea = a; }
      }
      c.delete();
    }
    mask.delete(); contours.delete(); hierarchy.delete();
    return best;
  }

  findDotsFullFrame(hsv) {
    const cv = this.cv;
    const [y0, y1] = this.dotBand(hsv.rows);
    const band = hsv.roi(new cv.Rect(0, y0, hsv.cols, y1 - y0));
    const mask = this.dotColorMask(band);
    band.delete();
    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();
    cv.findContours(mask, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
    const candidates = [];
    for (let i = 0; i < contours.size(); i++) {
      const c = contours.get(i);
      const a = cv.contourArea(c);
      if (a >= DOT_MIN_AREA) {
        const m = cv.moments(c, false);
        if (m.m00 > 0) candidates.push({ area: a, x: m.m10 / m.m00, y: m.m01 / m.m00 + y0 });
      }
      c.delete();
    }
    mask.delete(); contours.delete(); hierarchy.delete();
    if (candidates.length < 2) return [null, null];
    candidates.sort((a, b) => b.area - a.area);
    const [p, q] = candidates.slice(0, 2).sort((a, b) => a.x - b.x);   // smaller x = left
    return [[p.x, p.y], [q.x, q.y]];
  }

  alignPano(bgr, hsv, w, h) {
    const cv = this.cv;
    const searchR = DOT_SEARCH_FRAC * (this.lastEyeDist || Math.min(w, h) * 0.15);
    const fresh = [null, null];
    for (let i = 0; i < 2; i++) {
      if (this.lastDot[i]) fresh[i] = this.findDot(hsv, this.lastDot[i][0], this.lastDot[i][1], searchR);
    }

    const dots = [null, null];
    for (let i = 0; i < 2; i++) {
      if (fresh[i]) {
        this.lastDot[i] = fresh[i]; this.dotMissStreak[i] = 0;
        dots[i] = fresh[i];
      } else if (this.lastDot[i] && ++this.dotMissStreak[i] <= DOT_HOLD_FRAMES) {
        dots[i] = this.lastDot[i];             // coast through a transient (motion blur) dropout
      } else {
        this.lastDot[i] = null;                // prolonged loss -- needs reacquisition
      }
    }

    if (!dots[0] || !dots[1]) {
      const [dotLeft, dotRight] = this.findDotsFullFrame(hsv);
      if (dotLeft && dotRight) {
        fresh[0] = dots[0] = this.lastDot[0] = dotLeft;
        fresh[1] = dots[1] = this.lastDot[1] = dotRight;
        this.dotMissStreak = [0, 0];
      }
    }

    const dotsUsed = (fresh[0] ? 1 : 0) + (fresh[1] ? 1 : 0);   // freshly found vs. coasted

    if (!dots[0] || !dots[1]) {
      for (const f of this.eyeFilters) f.reset();      // forget stale anchors
      this.lastEyeDist = null;
      return { pano: null, M: null, dotsUsed, dotLeft: dots[0], dotRight: dots[1] };
    }

    const [rawLx, rawLy] = dots[0];
    const [rawRx, rawRy] = dots[1];
    const dt = this.nextDt();
    const [eLx, eLy, eRx, eRy] = [rawLx, rawLy, rawRx, rawRy].map((v, i) => this.eyeFilters[i].filter(v, dt));

    const ax = eRx - eLx, ay = eRy - eLy;
    const eyeDist = Math.hypot(ax, ay);
    if (eyeDist < 1) return { pano: null, M: null, dotsUsed, dotLeft: dots[0], dotRight: dots[1] };
    this.lastEyeDist = eyeDist;
    let ux = ax / eyeDist, uy = ay / eyeDist;
    let px = uy, py = -ux;
    if (py > 0) { px = -px; py = -py; }

    const dstLeft = [EYE_X * PANO_W, EYE_Y * PANO_H];
    const dstRight = [(1 - EYE_X) * PANO_W, EYE_Y * PANO_H];
    const ppu = (dstRight[0] - dstLeft[0]) / eyeDist;

    const srcTri = this.keep(cv.matFromArray(3, 1, cv.CV_32FC2,
      [eLx, eLy, eRx, eRy, eLx + px * eyeDist, eLy + py * eyeDist]));
    const dstTri = this.keep(cv.matFromArray(3, 1, cv.CV_32FC2,
      [dstLeft[0], dstLeft[1], dstRight[0], dstRight[1], dstLeft[0], dstLeft[1] - eyeDist * ppu]));
    const M = this.keep(cv.getAffineTransform(srcTri, dstTri));
    const pano = new cv.Mat();
    cv.warpAffine(bgr, pano, M, new cv.Size(PANO_W, PANO_H));
    return { pano, M, dotsUsed, dotLeft: dots[0], dotRight: dots[1] };
  }

  // ---- 2. Enhancement ----
  grayWorldWB(bgr) {
    const cv = this.cv;
    const mean = cv.mean(bgr);
    const mb = mean[0] + 1e-6, mg = mean[1] + 1e-6, mr = mean[2] + 1e-6;
    const k = (mb + mg + mr) / 3;
    const ch = this.keep(new cv.MatVector());
    cv.split(bgr, ch);
    const b = this.keep(ch.get(0)), g = this.keep(ch.get(1)), r = this.keep(ch.get(2));
    b.convertTo(b, -1, k / mb, 0);
    g.convertTo(g, -1, k / mg, 0);
    r.convertTo(r, -1, k / mr, 0);
    const out = new cv.Mat();
    cv.merge(ch, out);
    return out;
  }

  boostSaturation(bgr, f) {
    const cv = this.cv;
    const hsv = this.keep(new cv.Mat());
    cv.cvtColor(bgr, hsv, cv.COLOR_BGR2HSV);
    const ch = this.keep(new cv.MatVector());
    cv.split(hsv, ch);
    const h = this.keep(ch.get(0)), s = this.keep(ch.get(1)), v = this.keep(ch.get(2));
    s.convertTo(s, -1, f, 0);
    const merged = this.keep(new cv.MatVector());
    merged.push_back(h); merged.push_back(s); merged.push_back(v);
    const out = new cv.Mat();
    cv.merge(merged, out);
    cv.cvtColor(out, out, cv.COLOR_HSV2BGR);
    return out;
  }

  clahe() {
    const cv = this.cv;
    if (!this.claheInstance) this.claheInstance = new cv.CLAHE(CLAHE_CLIP, new cv.Size(8, 8));
    return this.claheInstance;
  }

  enhance(pano) {
    const cv = this.cv;
    const bf = this.keep(new cv.Mat());
    cv.bilateralFilter(pano, bf, BILATERAL_D, 50, 50, cv.BORDER_DEFAULT);
    const img = this.keep(this.grayWorldWB(bf));

    const gammaApplied = this.keep(new cv.Mat());
    cv.LUT(img, this.gammaLut, gammaApplied);

    const lab = this.keep(new cv.Mat());
    cv.cvtColor(gammaApplied, lab, cv.COLOR_BGR2Lab);
    const labCh = this.keep(new cv.MatVector());
    cv.split(lab, labCh);
    const L = this.keep(labCh.get(0)), a = this.keep(labCh.get(1)), b = this.keep(labCh.get(2));
    const Ln = this.keep(new cv.Mat());
    cv.normalize(L, Ln, 0, 255, cv.NORM_MINMAX);
    const Lc = this.keep(new cv.Mat());
    this.clahe().apply(Ln, Lc);
    const mergedLab = this.keep(new cv.MatVector());
    mergedLab.push_back(Lc); mergedLab.push_back(a); mergedLab.push_back(b);
    const labOut = this.keep(new cv.Mat());
    cv.merge(mergedLab, labOut);
    const bgrOut = this.keep(new cv.Mat());
    cv.cvtColor(labOut, bgrOut, cv.COLOR_Lab2BGR);

    return this.keep(this.boostSaturation(bgrOut, SAT_BOOST));
  }

  // ---- 3. Lens geometry ----
  lensCenter(side) {
    const ex = side === RIGHT ? (1 - EYE_X) * PANO_W : EYE_X * PANO_W;
    return [ex + side * LENS_DX * EYE_SEP_PX, EYE_Y * PANO_H - LENS_DY * EYE_SEP_PX];
  }
  lensAxes() {
    const rx = LENS_RADIUS * EYE_SEP_PX;
    return [rx, rx * LENS_ASPECT];
  }

  getLensBounds(side) {
    let bounds = this.lensBoundsCache.get(side);
    if (!bounds) {
      const [cx, cy] = this.lensCenter(side);
      const [rx, ry] = this.lensAxes();
      const x0 = clamp(Math.floor(cx - rx - LENS_BOUNDS_PAD), 0, PANO_W - 1);
      const y0 = clamp(Math.floor(cy - ry - LENS_BOUNDS_PAD), 0, PANO_H - 1);
      const x1 = clamp(Math.ceil(cx + rx + LENS_BOUNDS_PAD), x0 + 1, PANO_W);
      const y1 = clamp(Math.ceil(cy + ry + LENS_BOUNDS_PAD), y0 + 1, PANO_H);
      bounds = { x0, y0, x1, y1 };
      this.lensBoundsCache.set(side, bounds);
    }
    return bounds;
  }

  getLensRect(side) {
    const b = this.getLensBounds(side);
    return new this.cv.Rect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
  }

  combinedLensRect() {
    const l = this.getLensBounds(LEFT), r = this.getLensBounds(RIGHT);
    const x0 = Math.min(l.x0, r.x0), y0 = Math.min(l.y0, r.y0);
    const x1 = Math.max(l.x1, r.x1), y1 = Math.max(l.y1, r.y1);
    return new this.cv.Rect(x0, y0, x1 - x0, y1 - y0);
  }

  cropClone(mat, rect) {
    const view = mat.roi(rect);
    const clone = view.clone();
    view.delete();
    return clone;
  }

  // ---- 4. Hand detection ----
  detectHands(display) {
    const cv = this.cv;
    const crops = {};
    for (const side of [LEFT, RIGHT]) {
      const rect = this.getLensRect(side);
      const cropped = this.keep(this.cropClone(display, rect));
      const resized = this.keep(new cv.Mat());
      cv.resize(cropped, resized, new cv.Size(HAND_TILE, HAND_TILE), 0, 0, cv.INTER_LINEAR);
      crops[side] = { mat: resized, rect };
    }
    this.putPanel(this.handTileCtx, crops[LEFT].mat, 0, 0, false);
    this.putPanel(this.handTileCtx, crops[RIGHT].mat, HAND_TILE, 0, false);

    this.handFrameIdx += 1;
    const result = this.handLandmarker.detectForVideo(this.handTileCanvas, this.handFrameIdx);

    const hands = { [LEFT]: null, [RIGHT]: null };
    for (let i = 0; i < result.landmarks.length; i++) {
      const landmarks = result.landmarks[i];
      const xs = landmarks.map((lm) => lm.x * 2 * HAND_TILE);
      const side = (xs.reduce((a, b) => a + b, 0) / xs.length) < HAND_TILE ? LEFT : RIGHT;
      if (hands[side]) continue;                    // keep the first hand per side
      const { rect } = crops[side];
      const tileX0 = side === LEFT ? 0 : HAND_TILE;
      const pts = landmarks.map((lm, j) => [
        rect.x + (xs[j] - tileX0) * rect.width / HAND_TILE,
        rect.y + lm.y * HAND_TILE * rect.height / HAND_TILE,
      ]);
      const handedness = result.handedness[i]?.[0]?.categoryName ?? null;
      hands[side] = { pts, handedness };
    }
    return hands;
  }

  handTip(pts) {
    return pts ? pts[INDEX_FINGERTIP] : null;
  }

  // ---- Debug rendering ----
  drawHandSkeleton(ctx, pts) {
    ctx.strokeStyle = '#00c800';
    ctx.lineWidth = 1;
    for (const { start, end } of this.HandLandmarker.HAND_CONNECTIONS) {
      ctx.beginPath();
      ctx.moveTo(pts[start][0], pts[start][1]);
      ctx.lineTo(pts[end][0], pts[end][1]);
      ctx.stroke();
    }
    ctx.fillStyle = '#00ff00';
    for (const [x, y] of pts) {
      ctx.beginPath();
      ctx.arc(x, y, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Mirror at capture (getUserMedia delivers unmirrored sensor frames).
  drawMirrored(ctx, source, w, h) {
    ctx.save();
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(source, 0, 0, w, h);
    ctx.restore();
  }

  putPanel(ctx, mat, ox, oy, isGray) {
    const cv = this.cv;
    const rgba = new cv.Mat();
    cv.cvtColor(mat, rgba, isGray ? cv.COLOR_GRAY2RGBA : cv.COLOR_BGR2RGBA);
    ctx.putImageData(new ImageData(new Uint8ClampedArray(rgba.data), mat.cols, mat.rows), ox, oy);
    rgba.delete();
  }

  // Raw feed + search-band lines + crop-quad + dot markers.
  renderPreview(previewCanvas, video, M, workW, workH, dotLeft, dotRight) {
    const cv = this.cv;
    const vw = video.videoWidth, vh = video.videoHeight;
    const pw = PREVIEW_W, ph = Math.round(PREVIEW_W * vh / vw);
    if (previewCanvas.width !== pw || previewCanvas.height !== ph) {
      previewCanvas.width = pw; previewCanvas.height = ph;
    }
    const ctx = previewCanvas.getContext('2d');
    this.drawMirrored(ctx, video, pw, ph);

    const sx = pw / workW, sy = ph / workH;

    const [bandY0, bandY1] = this.dotBand(workH);
    ctx.strokeStyle = 'cyan';
    ctx.lineWidth = 3;
    for (const y of [bandY0, bandY1]) {
      ctx.beginPath(); ctx.moveTo(0, y * sy); ctx.lineTo(pw, y * sy); ctx.stroke();
    }

    if (M) {
      const inv = new cv.Mat();
      cv.invertAffineTransform(M, inv);
      const rect = this.combinedLensRect();
      const corners = cv.matFromArray(4, 1, cv.CV_32FC2,
        [rect.x, rect.y, rect.x + rect.width, rect.y,
         rect.x + rect.width, rect.y + rect.height, rect.x, rect.y + rect.height]);
      const out = new cv.Mat();
      cv.transform(corners, out, inv);
      ctx.strokeStyle = 'cyan';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        const x = out.data32F[i * 2] * sx, y = out.data32F[i * 2 + 1] * sy;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath(); ctx.stroke();
      inv.delete(); corners.delete(); out.delete();
    }

    ctx.strokeStyle = 'cyan';
    ctx.lineWidth = 2;
    for (const dot of [dotLeft, dotRight]) {
      if (!dot) continue;
      ctx.beginPath(); ctx.arc(dot[0] * sx, dot[1] * sy, 7, 0, Math.PI * 2); ctx.stroke();
    }
  }

  // Enhanced pano cropped to the lens box, with ellipses + hand skeletons + tips.
  renderZoom(zoomCanvas, display, handLeft, tipLeft, handRight, tipRight) {
    const rect = this.combinedLensRect();
    if (zoomCanvas.width !== rect.width || zoomCanvas.height !== rect.height) {
      zoomCanvas.width = rect.width;
      zoomCanvas.height = rect.height;
    }
    const ctx = zoomCanvas.getContext('2d');

    this.putPanel(ctx, display, -rect.x, -rect.y, false);

    ctx.save();
    ctx.translate(-rect.x, -rect.y);

    ctx.lineWidth = 2; ctx.strokeStyle = 'white';
    for (const side of [LEFT, RIGHT]) {
      const [cx, cy] = this.lensCenter(side), [rx, ry] = this.lensAxes();
      ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
    }
    for (const pts of [handLeft, handRight]) {
      if (pts) this.drawHandSkeleton(ctx, pts);
    }
    ctx.strokeStyle = '#00ff00';
    for (const tip of [tipLeft, tipRight]) {
      if (!tip) continue;
      ctx.beginPath(); ctx.arc(tip[0], tip[1], 9, 0, Math.PI * 2); ctx.stroke();
    }
    if (tipLeft && tipRight) {
      ctx.strokeStyle = 'yellow';
      ctx.beginPath(); ctx.moveTo(tipLeft[0], tipLeft[1]); ctx.lineTo(tipRight[0], tipRight[1]); ctx.stroke();
    }
    ctx.restore();
  }

  // ---- Per-frame pipeline ----
  step(video, zoomCanvas, previewCanvas) {
    const cv = this.cv;
    if (!cv) return null;
    this.FA = [];
    try {
      const vw = video.videoWidth, vh = video.videoHeight;
      if (!vw || !vh) return null;

      const warpW = Math.min(vw, WARP_MAX_W);
      const warpH = Math.round(warpW * vh / vw);
      if (this.warpCanvas.width !== warpW || this.warpCanvas.height !== warpH) {
        this.warpCanvas.width = warpW; this.warpCanvas.height = warpH;
      }
      this.drawMirrored(this.warpCtx, video, warpW, warpH);

      const imageData = this.warpCtx.getImageData(0, 0, warpW, warpH);
      const rgba = this.keep(cv.matFromImageData(imageData));
      const bgr = this.keep(new cv.Mat());
      cv.cvtColor(rgba, bgr, cv.COLOR_RGBA2BGR);
      const hsv = this.keep(new cv.Mat());
      cv.cvtColor(bgr, hsv, cv.COLOR_BGR2HSV);

      let { pano, M, dotsUsed, dotLeft, dotRight } = this.alignPano(bgr, hsv, warpW, warpH);
      const tracked = !!pano;
      if (!pano) pano = cv.Mat.zeros(PANO_H, PANO_W, cv.CV_8UC3);
      this.keep(pano);

      const display = this.enhance(pano);

      const hands = tracked ? this.detectHands(display) : { [LEFT]: null, [RIGHT]: null };
      const handLeft = hands[LEFT]?.pts ?? null, handRight = hands[RIGHT]?.pts ?? null;
      const tipLeft = this.handTip(handLeft), tipRight = this.handTip(handRight);

      if (previewCanvas) this.renderPreview(previewCanvas, video, M, warpW, warpH, dotLeft, dotRight);
      if (zoomCanvas) this.renderZoom(zoomCanvas, display, handLeft, tipLeft, handRight, tipRight);

      return { tracked, dotsUsed, handLeft, handRight, tipLeft, tipRight };
    } catch (err) {
      console.error(err);
      return null;
    } finally {
      for (const m of this.FA) { try { m.delete(); } catch { /* already freed */ } }
      this.FA = [];
    }
  }
}
