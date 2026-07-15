import sys
import time
import cv2
import numpy as np
import mediapipe as mp
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision as mp_vision
from OneEuroFilter import OneEuroFilter
from hand_landmark_drawer import HAND_CONNECTIONS

VIDEO_PATH = sys.argv[1] if len(sys.argv) > 1 else 'IMG_3192.MOV'

MAX_W = 1280
DT = 1.0 / 30.0
LEFT, RIGHT = -1, 1

OPEN_KERNEL = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))


# ---------- Glasses detection & eye rectification ----------
# Two blue dots on the glasses rim act as the anchor points for the warp

VIEW_W, VIEW_H = 640, 252
EYE_X = 0.18
EYE_Y = 0.43
EYE_SEP_PX = (1 - 2 * EYE_X) * VIEW_W

DOT_HUE_LO = 90  # cyan-blue markers
DOT_HUE_HI = 140
DOT_SAT_MIN = 80
DOT_VAL_MIN = 60
DOT_SEARCH_FRAC = 0.6
DOT_MIN_AREA = 15
DOT_BAND_FRAC = 0.5  # only search a horizontal band
DOT_HOLD_FRAMES = 6  # keep the last dot position to avoid short occlusions causing flicker

_last_dot = [None, None]
_dot_miss_streak = [0, 0]
_last_eye_dist = None

# One euro filter to smooth the dot positions
_eye_filters = [OneEuroFilter(freq=1.0 / DT, mincutoff=0.8, beta=0.02, dcutoff=1.0)
                for _ in range(4)]  # eye_lx, eye_ly, eye_rx, eye_ry


def dot_color_mask(hsv_region):
    if DOT_HUE_LO <= DOT_HUE_HI:
        mask = cv2.inRange(hsv_region, (DOT_HUE_LO, DOT_SAT_MIN, DOT_VAL_MIN), (DOT_HUE_HI, 255, 255))
    else:
        m1 = cv2.inRange(hsv_region, (DOT_HUE_LO, DOT_SAT_MIN, DOT_VAL_MIN), (179, 255, 255))
        m2 = cv2.inRange(hsv_region, (0, DOT_SAT_MIN, DOT_VAL_MIN), (DOT_HUE_HI, 255, 255))
        mask = cv2.bitwise_or(m1, m2)   # LO > HI means the hue range wraps past 179
    return cv2.morphologyEx(mask, cv2.MORPH_OPEN, OPEN_KERNEL)


def largest_blobs(mask, n, min_area):
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    blobs = []
    for c in contours:
        area = cv2.contourArea(c)
        if area < min_area:
            continue
        m = cv2.moments(c)
        if m['m00'] > 0:
            blobs.append((area, m['m10'] / m['m00'], m['m01'] / m['m00'], (area / np.pi) ** 0.5))
    blobs.sort(key=lambda t: -t[0])
    return [(x, y, r) for _, x, y, r in blobs[:n]]


def dot_band(h):
    margin = int(h * (1 - DOT_BAND_FRAC) / 2)
    return margin, h - margin


def find_dot(hsv, expected_x, expected_y, search_r):
    h, w = hsv.shape[:2]
    band_y0, band_y1 = dot_band(h)
    x0 = int(np.clip(np.floor(expected_x - search_r), 0, w - 1))
    y0 = int(np.clip(np.floor(expected_y - search_r), band_y0, band_y1 - 1))
    x1 = int(np.clip(np.ceil(expected_x + search_r), x0 + 1, w))
    y1 = int(np.clip(np.ceil(expected_y + search_r), y0 + 1, band_y1))
    blobs = largest_blobs(dot_color_mask(hsv[y0:y1, x0:x1]), 1, DOT_MIN_AREA)
    if not blobs:
        return None
    x, y, r = blobs[0]
    return x + x0, y + y0, r


#  Find the dots initially or after losing them for a while
def find_dots_full_frame(hsv):
    y0, y1 = dot_band(hsv.shape[0])
    blobs = largest_blobs(dot_color_mask(hsv[y0:y1]), 2, DOT_MIN_AREA)
    if len(blobs) < 2:
        return None, None
    left, right = sorted(blobs, key=lambda t: t[0])
    return (left[0], left[1] + y0, left[2]), (right[0], right[1] + y0, right[2])


def draw_dots(img, dots):
    for d in dots:
        if d is not None:
            x, y, r = d
            cv2.circle(img, (int(x), int(y)), max(3, int(round(r))), (255, 255, 0), 2)


def draw_dot_band(img):
    h, w = img.shape[:2]
    y0, y1 = dot_band(h)
    cv2.line(img, (0, y0), (w, y0), (255, 255, 0), 3)
    cv2.line(img, (0, y1), (w, y1), (255, 255, 0), 3)


def rectify_glasses(frame):
    global _last_eye_dist
    annotated = frame.copy()
    draw_dot_band(annotated)
    hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
    h, w = frame.shape[:2]

    search_r = DOT_SEARCH_FRAC * (_last_eye_dist if _last_eye_dist else min(w, h) * 0.15)
    fresh = [None, None]
    for i in range(2):
        if _last_dot[i] is not None:
            fresh[i] = find_dot(hsv, *_last_dot[i][:2], search_r)

    dots = [None, None]
    for i in range(2):
        if fresh[i] is not None:
            _last_dot[i] = fresh[i]
            _dot_miss_streak[i] = 0
            dots[i] = fresh[i]
        elif _last_dot[i] is not None:
            _dot_miss_streak[i] += 1
            if _dot_miss_streak[i] <= DOT_HOLD_FRAMES:
                dots[i] = _last_dot[i]
            else:
                _last_dot[i] = None

    # If we don't have both dots, try to find them in the full frame
    if dots[0] is None or dots[1] is None:
        left, right = find_dots_full_frame(hsv)
        if left is not None and right is not None:
            fresh[0] = dots[0] = _last_dot[0] = left
            fresh[1] = dots[1] = _last_dot[1] = right
            _dot_miss_streak[0] = _dot_miss_streak[1] = 0

    dots_used = sum(1 for d in fresh if d is not None)
    draw_dots(annotated, dots)

    if dots[0] is None or dots[1] is None:
        for f in _eye_filters:
            f.reset()
        _last_eye_dist = None
        return None, annotated, dots_used

    raw = (*dots[0][:2], *dots[1][:2])
    eye_lx, eye_ly, eye_rx, eye_ry = (_eye_filters[i](raw[i]) for i in range(4))

    eye_dist = np.hypot(eye_rx - eye_lx, eye_ry - eye_ly)
    if eye_dist < 1:
        return None, annotated, dots_used
    _last_eye_dist = eye_dist

    dst_left = (EYE_X * VIEW_W, EYE_Y * VIEW_H)
    dst_right = ((1 - EYE_X) * VIEW_W, EYE_Y * VIEW_H)
    # Similarity transform for mapping the two eyes onto the fixed target points
    transform, _ = cv2.estimateAffinePartial2D(np.float32([[eye_lx, eye_ly], [eye_rx, eye_ry]]),
                                                np.float32([dst_left, dst_right]))
    view = cv2.warpAffine(frame, transform, (VIEW_W, VIEW_H))

    cx0, cy0, cx1, cy1 = combined_lens_bounds()   # only the part we actually crop to later
    quad = np.float32([[[cx0, cy0]], [[cx1, cy0]], [[cx1, cy1]], [[cx0, cy1]]])
    srcq = cv2.transform(quad, cv2.invertAffineTransform(transform)).reshape(-1, 2)
    cv2.polylines(annotated, [srcq.astype(np.int32)], True, (255, 255, 0), 2)
    return view, annotated, dots_used


# Each lens is an ellipse positioned relative to the dots
LENS_DX = -0.22
LENS_DY = -0.10
LENS_RADIUS = 0.18
LENS_ASPECT = 0.90
LENS_BOUNDS_PAD = 16


# (cx, cy, rx, ry) of the lens ellipse for one side
def lens_geometry(side):
    ex = (1 - EYE_X) * VIEW_W if side == RIGHT else EYE_X * VIEW_W
    cx = ex + side * LENS_DX * EYE_SEP_PX
    cy = EYE_Y * VIEW_H - LENS_DY * EYE_SEP_PX
    rx = LENS_RADIUS * EYE_SEP_PX
    return cx, cy, rx, rx * LENS_ASPECT


def lens_roi(side):
    cx, cy, rx, ry = lens_geometry(side)
    m = np.zeros((VIEW_H, VIEW_W), np.uint8)
    cv2.ellipse(m, ((cx, cy), (2 * rx, 2 * ry), 0), 255, -1)
    return m


# Bounding box of the lens ellipse, used to crop before the mask work
def lens_bounds(side):
    cx, cy, rx, ry = lens_geometry(side)
    x0 = int(np.clip(np.floor(cx - rx - LENS_BOUNDS_PAD), 0, VIEW_W - 1))
    y0 = int(np.clip(np.floor(cy - ry - LENS_BOUNDS_PAD), 0, VIEW_H - 1))
    x1 = int(np.clip(np.ceil(cx + rx + LENS_BOUNDS_PAD), x0 + 1, VIEW_W))
    y1 = int(np.clip(np.ceil(cy + ry + LENS_BOUNDS_PAD), y0 + 1, VIEW_H))
    return x0, y0, x1, y1


def combined_lens_bounds():
    lx0, ly0, lx1, ly1 = lens_bounds(LEFT)
    rx0, ry0, rx1, ry1 = lens_bounds(RIGHT)
    return min(lx0, rx0), min(ly0, ry0), max(lx1, rx1), max(ly1, ry1)


# ---------- Hand & fingertip tracking ----------
# Run MediaPipe hand landmarker on each lens crop

HAND_MODEL_PATH = './hand_landmarker.task'
HAND_TILE = 320
HAND_MIN_DETECTION_CONF = 0.5
HAND_MIN_PRESENCE_CONF = 0.5
HAND_MIN_TRACKING_CONF = 0.5

_hand_landmarker = mp_vision.HandLandmarker.create_from_options(
    mp_vision.HandLandmarkerOptions(
        base_options=mp_python.BaseOptions(model_asset_path=HAND_MODEL_PATH),
        num_hands=2,
        running_mode=mp_vision.RunningMode.VIDEO,
        min_hand_detection_confidence=HAND_MIN_DETECTION_CONF,
        min_hand_presence_confidence=HAND_MIN_PRESENCE_CONF,
        min_tracking_confidence=HAND_MIN_TRACKING_CONF))
_hand_frame_idx = 0


# Run both lens crops through one inference call, then map each hand back to its lens
def detect_hands(view):
    global _hand_frame_idx
    crops = {}
    for side in (LEFT, RIGHT):
        x0, y0, x1, y1 = lens_bounds(side)
        crops[side] = (cv2.resize(view[y0:y1, x0:x1], (HAND_TILE, HAND_TILE)),
                       (x0, y0, x1 - x0, y1 - y0))

    combined = np.hstack([crops[LEFT][0], crops[RIGHT][0]])
    mp_image = mp.Image(image_format=mp.ImageFormat.SRGB,
                         data=cv2.cvtColor(combined, cv2.COLOR_BGR2RGB))
    _hand_frame_idx += 1
    result = _hand_landmarker.detect_for_video(mp_image, _hand_frame_idx)

    hands = {LEFT: None, RIGHT: None}
    for landmarks in result.hand_landmarks:
        xs = [lm.x * 2 * HAND_TILE for lm in landmarks]
        side = LEFT if (sum(xs) / len(xs)) < HAND_TILE else RIGHT
        if hands[side] is not None:  # keep only the first hand per side
            continue
        ox, oy, ow, oh = crops[side][1]
        tile_x0 = 0 if side == LEFT else HAND_TILE
        hands[side] = np.array(
            [(ox + (x - tile_x0) * ow / HAND_TILE, oy + lm.y * HAND_TILE * oh / HAND_TILE)
             for x, lm in zip(xs, landmarks)], dtype=np.float32)
    return hands


def hand_tip(pts):
    return None if pts is None else tuple(pts[8].astype(int))


def draw_hand_skeleton(img, pts):
    ipts = pts.astype(np.int32)
    for a, b in HAND_CONNECTIONS:
        cv2.line(img, tuple(ipts[a]), tuple(ipts[b]), (0, 200, 0), 1)
    for p in ipts:
        cv2.circle(img, tuple(p), 2, (0, 255, 0), -1)


# ---------- Video harness ----------
# Loop a video file through the CV pipeline with a debug view

def fit(img, max_h=600):
    h, w = img.shape[:2]
    if h <= max_h:
        return img
    return cv2.resize(img, (int(w * max_h / h), max_h))


def read_looping(cap):
    ret, frame = cap.read()
    if ret:
        return True, frame, cap
    cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
    ret, frame = cap.read()
    if ret:
        return True, frame, cap
    cap.release()
    cap = cv2.VideoCapture(VIDEO_PATH)
    ret, frame = cap.read()
    return ret, frame, cap


def prep_frame(frame):
    h, w = frame.shape[:2]
    if w > MAX_W:
        frame = cv2.resize(frame, (MAX_W, int(h * MAX_W / w)))
    return frame


def open_capture():
    global DT
    cap = cv2.VideoCapture(VIDEO_PATH)
    if not cap.isOpened():
        sys.exit(f"Could not open video: {VIDEO_PATH}")
    try:  # auto-apply rotation metadata
        cap.set(cv2.CAP_PROP_ORIENTATION_AUTO, 1)
    except AttributeError:
        pass
    fps = cap.get(cv2.CAP_PROP_FPS)
    if fps and fps > 1:
        DT = 1.0 / fps  # update the DT for the OneEuroFilter
        for f in _eye_filters:
            f.setFrequency(1.0 / DT)
    return cap


def caption(panel, title, rows, color=(0, 255, 255)):
    row_h = 16
    strip = np.zeros((row_h * (len(rows) + 1) + 6, panel.shape[1], 3), np.uint8)
    cv2.putText(strip, title, (8, row_h - 2), cv2.FONT_HERSHEY_DUPLEX, 0.42, color, 1, cv2.LINE_AA)
    for i, t in enumerate(rows):
        cv2.putText(strip, t, (8, row_h * (i + 2) - 2), cv2.FONT_HERSHEY_SIMPLEX,
                    0.33, color, 1, cv2.LINE_AA)
    return np.vstack([panel, strip])


def draw_captions(disp, dots_used, paused):
    return caption(disp, "PAUSED" if paused else "RUNNING", [f"dots {dots_used}/2"])


def process_frame(frame):
    view, preview, dots_used = rectify_glasses(frame)
    tracked = view is not None
    if view is None:
        view = np.zeros((VIEW_H, VIEW_W, 3), np.uint8)

    hands = detect_hands(view) if tracked else {LEFT: None, RIGHT: None}
    hand_left, hand_right = hands[LEFT], hands[RIGHT]
    tip_left, tip_right = hand_tip(hand_left), hand_tip(hand_right)
    return view, preview, dots_used, hand_left, tip_left, hand_right, tip_right


# Overlay: lens outline cyan, hand skeleton + fingertip green
def draw_overlay(view, hand_left, tip_left, hand_right, tip_right):
    disp = view.copy()
    for side in (LEFT, RIGHT):
        contours, _ = cv2.findContours(lens_roi(side), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        cv2.drawContours(disp, contours, -1, (255, 255, 0), 2)
    for pts, tip in ((hand_left, tip_left), (hand_right, tip_right)):
        if pts is not None:
            draw_hand_skeleton(disp, pts)
            cv2.circle(disp, tip, 9, (0, 255, 0), 2)
    x0, y0, x1, y1 = combined_lens_bounds()
    return disp[y0:y1, x0:x1]


_fps_last_t = None
_fps_smoothed = 0.0


def tick_fps():
    global _fps_last_t, _fps_smoothed
    now = time.perf_counter()
    if _fps_last_t is not None:
        dt = now - _fps_last_t
        if dt > 0:
            _fps_smoothed += 0.15 * (1.0 / dt - _fps_smoothed)
    _fps_last_t = now
    return _fps_smoothed


def draw_fps(img, fps):
    text = f"{fps:4.1f} FPS"
    (tw, th), _ = cv2.getTextSize(text, cv2.FONT_HERSHEY_DUPLEX, 0.5, 1)
    x, y = img.shape[1] - tw - 8, th + 8
    cv2.putText(img, text, (x, y), cv2.FONT_HERSHEY_DUPLEX, 0.5, (0, 0, 0), 3, cv2.LINE_AA)
    cv2.putText(img, text, (x, y), cv2.FONT_HERSHEY_DUPLEX, 0.5, (0, 255, 255), 1, cv2.LINE_AA)
    return img


def main():
    cap = open_capture()
    cv2.namedWindow("lens + hands")

    paused = False
    frame = None
    while True:
        fps = tick_fps()
        if not paused or frame is None:
            ok, raw, cap = read_looping(cap)
            if not ok:
                break
            frame = prep_frame(raw)

        view, preview, dots_used, hand_left, tip_left, hand_right, tip_right = process_frame(frame)

        disp = draw_overlay(view, hand_left, tip_left, hand_right, tip_right)
        disp = draw_captions(disp, dots_used, paused)

        cv2.imshow("preview", draw_fps(fit(preview), fps))
        cv2.imshow("lens + hands", draw_fps(disp, fps))

        key = cv2.waitKey(30) & 0xFF
        c = chr(key)
        if c == 'q':
            break
        elif c == ' ':
            paused = not paused

    cap.release()
    cv2.destroyAllWindows()


if __name__ == '__main__':
    main()
