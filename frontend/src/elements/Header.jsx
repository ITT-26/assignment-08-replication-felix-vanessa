import { useNavigate } from 'react-router-dom';
import '../App.css'

function Header(){
    const navigate = useNavigate();
    return(
        <div className='header'>
            <h1>GlassHands</h1>
            <div className='nav'>
                <p onClick={() => navigate(`/`)}>Debug</p>
                <p onClick={() => navigate(`/swipe`)}>Swipe</p>
                <p onClick={() => navigate(`/rotate`)}>Rotate</p>
            </div>
        </div>
    )
}

export default Header