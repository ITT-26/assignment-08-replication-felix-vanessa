import { useState, useRef, useEffect } from 'react'
import { useGlassTracker } from '../tracking/useGlassTracker'
import '../App.css'

function Debug(){
    const [cameraGranted, setCameraGranted] = useState(false)
    const [cameraError, setCameraError] = useState(null)
    const videoRef = useRef(null)
    const streamRef = useRef(null)
    const zoomCanvasRef = useRef(null)
    const previewCanvasRef = useRef(null)

    async function requestCamera(){
    try {
        // Match the prototype's constraints: front camera, as much resolution
        // as the device will give, so the eye-region warp has real detail.
        streamRef.current = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: 'user' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
            audio: false,
        })
        setCameraGranted(true)
    } catch {
        setCameraError('Camera access was denied. Please allow camera access and try again.')
    }
    }

    // Attach the stream to the <video> once granted. No teardown here -- this
    // effect re-runs when cameraGranted flips, and stopping tracks in its
    // cleanup would kill the freshly-acquired stream before it ever plays.
    useEffect(() => {
        if (cameraGranted && videoRef.current && streamRef.current){
            videoRef.current.srcObject = streamRef.current
        }
    }, [cameraGranted])

    // Stop the camera only when the Debug view actually unmounts.
    useEffect(() => () => {
        if (streamRef.current){
            streamRef.current.getTracks().forEach((t) => t.stop())
            streamRef.current = null
        }
    }, [])

    const { status, tracked, dotsUsed } = useGlassTracker(videoRef, zoomCanvasRef, previewCanvasRef, cameraGranted)

    if (!cameraGranted){
        return (
        <div className='main'>
            <div className='permission'>
                <p>GlassHands needs access to your front camera to track hand gestures.</p>
                {cameraError && <p className='permissionError'>{cameraError}</p>}
                <button onClick={requestCamera}>Enable camera access</button>
            </div>
        </div>
        )
    }

    return(
        <div className='main'>
            <div className='debugView'>
                {status === 'loading' && (
                    <p className='trackerStatus'>Loading OpenCV & hand model…</p>
                )}
                {status === 'error' && (
                    <p className='permissionError'>Failed to load the tracking pipeline. Check the console.</p>
                )}
                {status === 'ready' && (
                    <p className='trackerStatus'>
                        <span className={tracked ? 'dot on' : 'dot'} />
                        {tracked ? 'Glasses tracked' : 'No glasses'} · dots {dotsUsed}/2
                    </p>
                )}

                {/* Rectified/enhanced glasses pano (black until both blue dots
                    are locked inside the cyan band on the preview below). */}
                <div className='zoomWrap'>
                    <canvas ref={zoomCanvasRef} className='zoomCanvas'></canvas>
                </div>

                {/* Live camera feed with the search-band + dot-marker overlays. */}
                <canvas ref={previewCanvasRef} className='previewCanvas'></canvas>
                <p className='trackerHint'>
                    Live camera. The pano fills once two blue dot markers sit inside the cyan band.
                </p>

                {/* Hidden source feed -- the tracker mirrors it into its own
                    offscreen warp canvas; the preview canvas is what's shown. */}
                <video ref={videoRef} autoPlay playsInline muted style={{ display: 'none' }}></video>
            </div>
        </div>
    )
}

export default Debug
