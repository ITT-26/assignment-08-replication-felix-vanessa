import { useState, useRef, useEffect } from 'react'
import sq1 from '../assets/sq1.png'
import sq2 from '../assets/sq2.png'
import sq3 from '../assets/sq3.png'
import star from '../assets/star.png'
// svgs from https://phosphoricons.com/?q=arrow&color=a59d84&size=48
import side_arrows from '../assets/arrows-horizontal.svg'
import '../App.css'

function Swipe(){
    const [selectedImg, setSelectedImg] = useState(0)
    const [recording, setRecording] = useState(false);
    const images = [sq1, sq2, sq3];
      
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

    return(
        <div className='main'>
            <div className='swipe'>
                <div className="imageContainer">
                    <div
                        className="sliderTrack"
                        style={{
                            transform: `translateX(-${selectedImg * 100}%)`,
                        }}
                    >
                        {images.map((img, index) => (
                            <img
                                key={index}
                                src={img}
                                alt={`Background ${index + 1}`}
                                className="swipeImg"
                            />
                        ))}
                    </div>

                    <img src={star} className='star'></img>
                </div>
                <div className='instruction'>
                    <img className='icon' src= {side_arrows}></img>
                    <p>Touch image and swipe to either side to change the background.</p>
                    <button className={recording ? "button recording" : "button"} onClick={() => setRecording(!recording)}>
                        Press to record gesture
                    </button>
                </div>
            </div>
        </div>
    )
}

export default Swipe