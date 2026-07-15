import { useState, useRef, useEffect } from 'react'
import '../App.css'

function Debug(){
    const [cameraGranted, setCameraGranted] = useState(false)
    const [cameraError, setCameraError] = useState(null)
    const videoRef = useRef(null)
    const streamRef = useRef(null)

    async function requestCamera(){
    try {
        streamRef.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
        setCameraGranted(true)
    } catch (err) {
        setCameraError('Camera access was denied. Please allow camera access and try again.')
    }
    }

    useEffect(() => {
    if (videoRef.current && streamRef.current){
        videoRef.current.srcObject = streamRef.current
    }
    })

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
                <video ref={videoRef} autoPlay playsInline muted></video>
            </div>
        </div>
    )
}

export default Debug