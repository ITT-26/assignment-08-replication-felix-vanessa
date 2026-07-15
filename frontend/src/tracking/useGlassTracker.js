import { useEffect, useState } from 'react';
import { GlassTracker } from './glassTracker';

// Drives a GlassTracker frame loop over the given <video>, painting into the
// zoom (pano) and preview canvases. Returns { status, tracked, dotsUsed }:
// status is 'idle' | 'loading' | 'ready' | 'error'; tracked/dotsUsed reflect
// the latest frame (throttled to a few updates/sec so the loop doesn't trigger
// a React re-render every frame). StrictMode-safe: the async init is guarded by
// a `cancelled` flag and the loop + tracker are torn down on cleanup.
export function useGlassTracker(videoRef, zoomCanvasRef, previewCanvasRef, active) {
  const [status, setStatus] = useState('idle');
  const [stats, setStats] = useState({ tracked: false, dotsUsed: 0 });

  useEffect(() => {
    if (!active) return undefined;

    let cancelled = false;
    let tracker = null;
    let rafId = null;
    let usingVfc = false;
    let vfcVideo = null;   // the <video> a pending VFC was scheduled on (for cancel)
    let lastStats = 0;     // throttle timestamp for the stats state update

    const tick = () => {
      if (cancelled) return;
      const video = videoRef.current;
      if (tracker && video && video.videoWidth) {
        const res = tracker.step(video, zoomCanvasRef.current, previewCanvasRef.current);
        const now = performance.now();
        if (res && now - lastStats > 250) {
          lastStats = now;
          setStats({ tracked: res.tracked, dotsUsed: res.dotsUsed });
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

  return { status, tracked: stats.tracked, dotsUsed: stats.dotsUsed };
}
