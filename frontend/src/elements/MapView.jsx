import { MapContainer, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import '../App.css'

function Map(){
    const position = [49.000000, 12.098552];

    return(
        <div className='main mapView'>
            <MapContainer className="Map" center={position} zoom={15}>
                <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>'
                />
            </MapContainer>
        </div>
    )
}

export default Map
