import { useState, useRef, useEffect } from 'react'
import sq1 from './assets/sq1.png'
import sq2 from './assets/sq2.png'
import sq3 from './assets/sq3.png'
import circle from './assets/circle.png'
import zoom from './assets/zoom.png'
// svgs from https://phosphoricons.com/?q=arrow&color=a59d84&size=48
import side_arrows from './assets/arrows-horizontal.svg'
import swipe_arrows from './assets/arrows-vertical.svg'
import rotate_arrows from './assets/arrows-counter-clockwise.svg'
import zoom_arrows from './assets/arrows-out-simple.svg'
import './App.css'

function App() {
  const [selectedImg, setSelectedImg] = useState(0)
  const [cameraGranted, setCameraGranted] = useState(false)
  const [cameraError, setCameraError] = useState(null)
  const [showDebug, setShowDebug] = useState(false)
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
    if (showDebug && videoRef.current && streamRef.current){
      videoRef.current.srcObject = streamRef.current
    }
  }, [showDebug])

  function switchImage(motion){
        // if finger is swiped to thr right, left image is selected
        if (motion === "right"){
            setSelectedImg(prev => (prev === 0 ? 2 : prev - 1));
        }
        // if finger is swiped to the left, right image is selected
        if (motion === "left"){
            setSelectedImg(prev => (prev === 2 ? 0 : prev + 1));
        }
    }

    function getImage(){
        if (selectedImg === 0){return <img className='swipeImg' src={sq1}></img>}
        if (selectedImg === 1){return <img className='swipeImg' src={sq2}></img>}
        if (selectedImg === 2){return <img className='swipeImg' src={sq3}></img>}
    }


  if (!cameraGranted){
    return (
      <div className='main'>
        <h1 className='header'>GlassHands</h1>
        <div className='permission'>
          <p>GlassHands needs access to your front camera to track hand gestures.</p>
          {cameraError && <p className='permissionError'>{cameraError}</p>}
          <button onClick={requestCamera}>Enable camera access</button>
        </div>
      </div>
    )
  }

  return (
    <div className='main'>
      <h1 className='header'>GlassHands
        <button className='debugToggle' onClick={() => setShowDebug(prev => !prev)}>
          {showDebug ? 'Hide debug' : 'Debug'}
        </button>
      </h1>
      {showDebug && (
        <div className='debugView'>
          <video ref={videoRef} autoPlay playsInline muted></video>
        </div>
      )}
      <div className='intro'>
        <img className='icon' src= {swipe_arrows}></img>
        <p>Swipe up on the area next to the phone to see the demo.</p>
      </div>
      <div className='swipe'>
        <div>{getImage()}</div>
        <div className='instruction'>
          <img className='icon' src= {side_arrows}></img>
          <p>Swipe to either side to change the image.</p>
        </div>
      </div>
      <div className='rotate'>
        <img className='rotImg' src={circle}></img>
        <div className='instruction'>
          <img className='rotateIcon' src= {rotate_arrows}></img>
          <p>Place fingers on either side of the phone and do a rotating motion.</p>
        </div>
      </div>
      <div className='zoom'>
        <div className='zoomImgBorder'><img className='zoomImg' src={zoom}></img></div>
        <div className='instruction'>
          <img className='zoomIcon' src= {zoom_arrows}></img>
          <p>Place fingers on either side of the phone and do a zoom motion.</p>
        </div>
      </div>
    </div>
  )
}

export default App