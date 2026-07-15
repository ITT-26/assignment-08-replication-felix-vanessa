
import { Route, Routes} from 'react-router-dom';
import circle from './assets/circle.png'
import zoom from './assets/zoom.png'

import Header from './elements/Header';
import Debug from './elements/Debug';
import Swipe from './elements/Swipe';
import Rotate from './elements/Rotate';
import MapView from './elements/MapView';
import './App.css'

function App() {
  
  return (
    <div className='main'>
      <Header/>
      <Routes>
          <Route path="/" element={<Debug/>} />
          <Route path="/swipe" element={<Swipe/>} />
          <Route path="/rotate" element={<Rotate />} />
          <Route path="/map" element={<MapView/>} />
        </Routes>      
    </div>
  )
}

export default App