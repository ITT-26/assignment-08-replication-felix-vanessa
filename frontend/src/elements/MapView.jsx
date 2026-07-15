import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useTracking } from '../tracking/TrackingContext';
import '../App.css'

const PAN_GAIN = 3
const INDEX_TIP = 8;

// Pinch the selected hand to pan (tracking the index fingertip), open hand to idle
function HandControl(){
    const map = useMap();
    const { gestureRef, gestureHandRef } = useTracking();

    useEffect(() => {
        if (!gestureRef) return undefined;
        let raf = 0, mode = null, last = null;

        const loop = () => {
            const g = gestureRef.current;
            const left = gestureHandRef.current === 'left';
            const hand = (left ? g?.handLeft : g?.handRight) ?? null;
            const pinch = left ? g?.pinchLeft : g?.pinchRight;
            const m = hand && pinch ? 'pan' : 'idle';
            if (m !== mode) { mode = m; last = null; }

            if (m === 'pan') {
                const tip = hand[INDEX_TIP];
                if (last) map.panBy([(last[0] - tip[0]) * PAN_GAIN, (last[1] - tip[1]) * PAN_GAIN], { animate: false });
                last = tip;
            }
            raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(raf);
    }, [map, gestureRef, gestureHandRef]);

    return null;
}

// Scatter red POI markers around the initial centre to circle/trace over.
function POILayer(){
    const map = useMap();

    useEffect(() => {
        const group = L.layerGroup().addTo(map);
        const c = map.getCenter();
        for (let i = 0; i < 24; i++) {
            const lat = c.lat + (Math.random() - 0.5) * 0.036;
            const lng = c.lng + (Math.random() - 0.5) * 0.06;
            L.circleMarker([lat, lng], {
                radius: 8, color: '#b00', weight: 2, fillColor: '#e11', fillOpacity: 0.85,
            }).addTo(group);
        }
        return () => group.remove();
    }, [map]);

    return null;
}

// On-screen touch draws a geo-anchored trace that moves with the map.
function TraceLayer({ clearRef }){
    const map = useMap();

    useEffect(() => {
        const el = map.getContainer();
        const group = L.layerGroup().addTo(map);
        let line = null;

        const down = (e) => {
            if (e.target.closest?.('.leaflet-control')) return;
            line = L.polyline([map.mouseEventToLatLng(e)], { color: '#12b021', weight: 7 }).addTo(group);
            el.setPointerCapture?.(e.pointerId);
        };
        const move = (e) => { if (line) line.addLatLng(map.mouseEventToLatLng(e)); };
        const up = () => { line = null; };

        el.addEventListener('pointerdown', down);
        el.addEventListener('pointermove', move);
        el.addEventListener('pointerup', up);
        el.addEventListener('pointercancel', up);
        if (clearRef) clearRef.current = () => group.clearLayers();

        return () => {
            el.removeEventListener('pointerdown', down);
            el.removeEventListener('pointermove', move);
            el.removeEventListener('pointerup', up);
            el.removeEventListener('pointercancel', up);
            group.remove();
        };
    }, [map, clearRef]);

    return null;
}

function Map(){
    const position = [49.000000, 12.098552];
    const clearRef = useRef(null);

    return(
        <div className='main mapView'>
            <MapContainer
                className="Map"
                center={position}
                zoom={15}
                dragging={false}  /* touch draws a trace; the air hand pans */
                touchZoom={false}  /* no pinch/double-tap/scroll zoom */
                doubleClickZoom={false}
                scrollWheelZoom={false}
                boxZoom={false}
                keyboard={false}
            >
                <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>'
                />
                <HandControl/>
                <POILayer/>
                <TraceLayer clearRef={clearRef}/>
            </MapContainer>
            <button className='clearBtn' onClick={() => clearRef.current?.()}>Clear</button>
        </div>
    )
}

export default Map
