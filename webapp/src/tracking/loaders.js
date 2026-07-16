// Cached, lazy loaders for OpenCV.js and the MediaPipe Hand Landmarker.

let cvPromise = null;

// This opencv build assigns window.cv a thenable resolving to the ready module.
export function loadOpenCV() {
  if (cvPromise) return cvPromise;
  cvPromise = new Promise((resolve, reject) => {
    if (window.cv) { resolve(window.cv); return; }
    const script = document.createElement('script');
    script.src = '/vendor/opencv/opencv.js';
    script.async = true;
    script.onload = () => resolve(window.cv);
    script.onerror = () => reject(new Error('Failed to load OpenCV.js'));
    document.head.appendChild(script);
  }).then((cv) => (cv && typeof cv.then === 'function' ? cv : Promise.resolve(cv)));
  return cvPromise;
}

let handPromise = null;

// Returns the ready landmarker plus the HandLandmarker class (for HAND_CONNECTIONS).
export function loadHandLandmarker() {
  if (handPromise) return handPromise;
  handPromise = (async () => {
    // Bundle lives in src/ (Vite can't import a /public file); wasm + model stay
    // in /public and are fetched by URL, not imported.
    const { FilesetResolver, HandLandmarker } = await import('./vendor/tasks-vision/vision_bundle.mjs');
    const fileset = await FilesetResolver.forVisionTasks('/vendor/tasks-vision/wasm');
    const opts = (delegate) => ({
      baseOptions: { modelAssetPath: '/models/hand_landmarker.task', delegate },
      runningMode: 'VIDEO',
      numHands: 2,
      minHandDetectionConfidence: 0.4,
      minHandPresenceConfidence: 0.4,
      minTrackingConfidence: 0.5,
    });
    let handLandmarker;
    try {
      handLandmarker = await HandLandmarker.createFromOptions(fileset, opts('GPU'));
    } catch (err) {
      console.warn('Hand landmarker GPU delegate failed, falling back to CPU', err);
      handLandmarker = await HandLandmarker.createFromOptions(fileset, opts('CPU'));
    }
    return { HandLandmarker, handLandmarker };
  })();
  return handPromise;
}
