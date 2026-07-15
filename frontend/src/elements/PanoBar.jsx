import { useTracking } from '../tracking/TrackingContext'
import '../App.css'

// Top bar shown on every tab: the pano, with a per-hand green dot on each side.
function PanoBar() {
    const { cameraGranted, cameraError, requestCamera, status, handLeft, handRight, zoomCanvasRef } = useTracking()

    if (!cameraGranted) {
        return (
            <div className='panoBar'>
                <div className='permission'>
                    <p>GlassHands needs access to your front camera to track hand gestures.</p>
                    {cameraError && <p className='permissionError'>{cameraError}</p>}
                    <button onClick={requestCamera}>Enable camera access</button>
                </div>
            </div>
        )
    }

    return (
        <div className='panoBar'>
            <div className='zoomWrap'>
                <canvas ref={zoomCanvasRef} className='zoomCanvas'></canvas>
                <span className={handLeft ? 'handDot left on' : 'handDot left'}></span>
                <span className={handRight ? 'handDot right on' : 'handDot right'}></span>
                {status === 'loading' && (
                    <div className='panoOverlay'>Loading OpenCV & hand model…</div>
                )}
                {status === 'error' && (
                    <div className='panoOverlay error'>Failed to load the tracking pipeline. Check the console.</div>
                )}
            </div>
        </div>
    )
}

export default PanoBar
