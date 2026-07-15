import { MapContainer, TileLayer, Marker, Popup, ZoomControl } from 'react-leaflet';
import { useState } from "react";
import 'leaflet/dist/leaflet.css';
import '../App.css'

import arrows from '../assets/arrows-out-cardinal.svg'

function Map(){
    const position = [49.000000, 12.098552];
    const [recording, setRecording] = useState(false);
    
    return(
        <div className='main'>
            <MapContainer className="Map" center={position} zoom={15}>
                <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>'
                />
            </MapContainer>
            <div className='instruction'>
                <img className='rotateIcon' src= {arrows}></img>
                <p>Move your fingers next to the phone to move through the map.</p>
                <button className={recording ? "button recording" : "button"} onClick={() => setRecording(!recording)}>
                    Press to record gesture
                </button>
            </div>
        </div>
    )

}

export default Map