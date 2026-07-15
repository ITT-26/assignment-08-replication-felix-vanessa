import { useEffect, useState } from 'react';
import { GlassTracker } from './glassTracker';

// Runs a GlassTracker frame loop over the <video>, painting the pano + preview
// canvases. Returns { status, tracked, dotsUsed, handLeft, handRight } (stats
// throttled to a few updates/sec). StrictMode-safe via the `cancelled` flag.
export function useGlassTracker(videoRef, zoomCanvasRef, previewCanvasRef, active) {
  const [status, setStatus] = useState('idle');
  const [stats, setStats] = useState({ tracked: false, dotsUsed: 0, handLeft: false, handRight: false });

  useEffect(() => {
    if (!active) return undefined;

    let cancelled = false;
    let tracker = null;
    let rafId = null;
    let usingVfc = false;
    let vfcVideo = null;   // video a pending VFC was scheduled on (for cancel)
    let lastStats = 0;     // stats-throttle timestamp

    const tick = () => {
      if (cancelled) return;
      const video = videoRef.current;
      if (tracker && video && video.videoWidth) {
        const res = tracker.step(video, zoomCanvasRef.current, previewCanvasRef.current);
        const now = performance.now();
        if (res && now - lastStats > 250) {
          lastStats = now;
          setStats({
            tracked: res.tracked,
            dotsUsed: res.dotsUsed,
            handLeft: !!res.handLeft,
            handRight: !!res.handRight,
          });
        }
      }
      schedule();
    };

    function schedule() {
      if (cancelled) return;
      const video = videoRef.current;
      if (video && video.requestVideoFrameCallback) {
        usingVfc = true;
        vfcVideo = video;
        rafId = video.requestVideoFrameCallback(tick);
      } else {
        usingVfc = false;
        vfcVideo = null;
        rafId = requestAnimationFrame(tick);
      }
    }

    setStatus('loading');
    (async () => {
      try {
        const t = new GlassTracker();
        await t.init();
        if (cancelled) { t.dispose(); return; }
        tracker = t;
        setStatus('ready');
        schedule();
      } catch (err) {
        console.error(err);
        if (!cancelled) setStatus('error');
      }
    })();

    return () => {
      cancelled = true;
      if (rafId !== null) {
        if (usingVfc && vfcVideo?.cancelVideoFrameCallback) vfcVideo.cancelVideoFrameCallback(rafId);
        else if (!usingVfc) cancelAnimationFrame(rafId);
      }
      tracker?.dispose();
    };
  }, [active, videoRef, zoomCanvasRef, previewCanvasRef]);

  return {
    status,
    tracked: stats.tracked,
    dotsUsed: stats.dotsUsed,
    handLeft: stats.handLeft,
    handRight: stats.handRight,
  };
}
