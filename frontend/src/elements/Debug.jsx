import { useTracking } from '../tracking/TrackingContext'
import '../App.css'

// Debug tab: full-frame camera preview + detection readout (the pano lives in
// the shared PanoBar). The preview canvas attaches to the shared tracker.
function Debug(){
    const { cameraGranted, status, tracked, dotsUsed, previewCanvasRef } = useTracking()

    if (!cameraGranted){
        return <p className='trackerHint'>Enable the camera above to see the debug feed.</p>
    }

    return(
        <div className='debugContent'>
            {status === 'ready' && (
                <p className='trackerStatus'>
                    <span className={tracked ? 'dot on' : 'dot'} />
                    {tracked ? 'Glasses tracked' : 'No glasses'} · dots {dotsUsed}/2
                </p>
            )}
            <canvas ref={previewCanvasRef} className='previewCanvas'></canvas>
            <p className='trackerHint'>
                Live camera. The pano fills once two blue dot markers sit inside the cyan band.
            </p>
        </div>
    )
}

export default Debug
