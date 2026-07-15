// Lazy, cached loaders for the two heavy dependencies the tracking pipeline
// needs: OpenCV.js (vendored as a global script) and the MediaPipe Hand
// Landmarker (vendored ESM bundle + wasm + model). Both are module-level
// singletons so React StrictMode's double-mount and repeat visits to the Debug
// tab share a single load. Assets live under frontend/public/ (served at web
// root), mirroring the standalone prototype.

let cvPromise = null;

// The @techstark/opencv-js build assigns window.cv a thenable that resolves to
// the ready module -- matching how the prototype does `await window.cv`. We
// inject the script once, then await that.
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

// Native dynamic import of the vendored .mjs (marked @vite-ignore so Vite leaves
// the public-asset URL alone). Returns both the ready landmarker and the
// HandLandmarker class -- the class carries HAND_CONNECTIONS, used when drawing
// the skeleton overlay.
export function loadHandLandmarker() {
  if (handPromise) return handPromise;
  handPromise = (async () => {
    // The JS bundle lives in src/ so Vite bundles it as a lazy chunk (a /public
    // file cannot be imported as a module). The wasm loader + model stay in
    // /public -- those are fetched by URL below, not imported.
    const { FilesetResolver, HandLandmarker } = await import('./vendor/tasks-vision/vision_bundle.mjs');
    const fileset = await FilesetResolver.forVisionTasks('/vendor/tasks-vision/wasm');
    const handLandmarker = await HandLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: '/models/hand_landmarker.task' },
      runningMode: 'VIDEO',
      numHands: 2,
      minHandDetectionConfidence: 0.5,
      minHandPresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
    return { HandLandmarker, handLandmarker };
  })();
  return handPromise;
}
