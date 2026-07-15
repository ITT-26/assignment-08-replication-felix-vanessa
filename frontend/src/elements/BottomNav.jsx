import { useNavigate, useLocation } from 'react-router-dom';
import '../App.css'

// Bottom tab bar.
function BottomNav(){
    const navigate = useNavigate();
    const { pathname } = useLocation();

    const tabs = [
        { path: '/', label: 'Debug' },
        { path: '/swipe', label: 'Cut-Paste' },
        { path: '/rotate', label: 'Rotate' },
        { path: '/map', label: 'Map' },
    ];

    return(
        <div className='bottomNav'>
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

export default BottomNav
