
import { Route, Routes } from 'react-router-dom';

import { TrackingProvider } from './tracking/TrackingContext';
import PanoBar from './elements/PanoBar';
import BottomNav from './elements/BottomNav';
import Debug from './elements/Debug';
import Swipe from './elements/Swipe';
import Rotate from './elements/Rotate';
import MapView from './elements/MapView';
import './App.css'

function App() {

  return (
    <TrackingProvider>
      <div className='appShell'>
        <PanoBar/>
        <div className='content'>
          <Routes>
            <Route path="/" element={<Debug/>} />
            <Route path="/swipe" element={<Swipe/>} />
            <Route path="/rotate" element={<Rotate />} />
            <Route path="/map" element={<MapView/>} />
          </Routes>
        </div>
        <BottomNav/>
      </div>
    </TrackingProvider>
  )
}

export default App
