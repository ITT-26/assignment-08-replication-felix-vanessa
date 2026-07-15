import circle from '../assets/circle.png'
import '../App.css'

function Rotate(){
    return(
        <div className='main rotateView'>
            <div className='rotate'>
                <img className='rotImg' src={circle}></img>
            </div>
        </div>
    )
}

export default Rotate
