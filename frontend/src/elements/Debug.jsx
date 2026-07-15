import { useTracking } from '../tracking/TrackingContext'
import '../App.css'

// Debug tab: full-frame camera preview + detection readout (the pano lives in
// the shared PanoBar). The preview canvas attaches to the shared tracker.
function Debug(){
    const { cameraGranted, status, fps, gestureHand, setGestureHand, previewCanvasRef } = useTracking()

    if (!cameraGranted){
        return <p className='trackerHint'>Enable the camera above to see the debug feed.</p>
    }

    return(
        <div className='debugContent'>
            <div className='debugBar'>
                {status === 'ready' && <p className='fpsCounter'>{fps} fps</p>}
                <div className='handToggle'>
                    <span>Hand</span>
                    <div className='segmented'>
                        <button className={gestureHand === 'left' ? 'on' : ''} onClick={() => setGestureHand('left')}>Left</button>
                        <button className={gestureHand === 'right' ? 'on' : ''} onClick={() => setGestureHand('right')}>Right</button>
                    </div>
                </div>
            </div>
            <canvas ref={previewCanvasRef} className='previewCanvas'></canvas>
            <p className='trackerHint'>
                Live camera. The pano fills once two blue dot markers sit inside the cyan band.
            </p>
        </div>
    )
}

export default Debug
