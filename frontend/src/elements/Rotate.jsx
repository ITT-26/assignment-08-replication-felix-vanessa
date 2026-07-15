import { useState, useRef, useEffect } from 'react'
import circle from '../assets/circle.png'
// svgs from https://phosphoricons.com/?q=arrow&color=a59d84&size=48
import rotate_arrows from '../assets/arrows-counter-clockwise.svg'
import '../App.css'

function Rotate(){
  const [recording, setRecording] = useState(false);
    return(
        <div className='main'>
            <div className='rotate'>
                <img className='rotImg' src={circle}></img>
                <div className='instruction'>
                    <img className='rotateIcon' src= {rotate_arrows}></img>
                    <p>Do a rotating motion with right hand next to the phone.</p>
                    <button className={recording ? "button recording" : "button"} onClick={() => setRecording(!recording)}>
                        Press to record gesture
                    </button>
                </div>
            </div>
        </div>
    )
}

export default Rotate