import { useNavigate, useLocation } from 'react-router-dom';
import '../App.css'

function Header(){
    const navigate = useNavigate();
    const { pathname } = useLocation();

    const tabs = [
        { path: '/', label: 'Debug' },
        { path: '/swipe', label: 'Swipe' },
        { path: '/rotate', label: 'Rotate' },
        { path: '/map', label: 'Map' },
    ];

    return(
        <div className='header'>
            <h1>GlassHands</h1>
            <div className='nav'>
                {tabs.map(({ path, label }) => (
                    <p
                        key={path}
                        className={pathname === path ? 'active' : ''}
                        onClick={() => navigate(path)}
                    >
                        {label}
                    </p>
                ))}
            </div>
        </div>
    )
}

export default Header