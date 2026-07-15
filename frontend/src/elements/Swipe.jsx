import { useRef, useState } from 'react'
import photo from '../assets/axolotl.png'
import '../App.css'

// Mockup: one office app fills the whole background; the image stays fixed in
// the middle and can be held (orange outline) while the apps slide behind it.
// Dragging the background slides smoothly between apps -- standing in for the
// glasses gesture that will drop the image into whichever app is focused.
const APPS = [
    { name: 'Docs',   type: 'docs',   color: '#2b579a', letter: 'W' },
    { name: 'Sheets', type: 'sheets', color: '#217346', letter: 'X' },
    { name: 'Mail',   type: 'mail',   color: '#0a7ea4', letter: '@' },
    { name: 'Notes',  type: 'notes',  color: '#7719aa', letter: 'N' },
]

const SWIPE_THRESHOLD = 60

function Swipe(){
    const [focused, setFocused] = useState(0)
    const [held, setHeld] = useState(false)
    const [dragPx, setDragPx] = useState(0)
    const [dragging, setDragging] = useState(false)
    const startXRef = useRef(0)

    function onDown(e){
        e.currentTarget.setPointerCapture(e.pointerId)
        startXRef.current = e.clientX
        setDragging(true)
        setDragPx(0)
    }
    function onMove(e){
        if (!dragging) return
        let dx = e.clientX - startXRef.current
        // Rubber-band resistance past the first/last app.
        if (focused === 0 && dx > 0) dx *= 0.4
        if (focused === APPS.length - 1 && dx < 0) dx *= 0.4
        setDragPx(dx)
    }
    function onUp(){
        if (!dragging) return
        const dx = dragPx
        setDragging(false)
        setDragPx(0)
        if (dx <= -SWIPE_THRESHOLD) setFocused(i => Math.min(APPS.length - 1, i + 1))
        else if (dx >= SWIPE_THRESHOLD) setFocused(i => Math.max(0, i - 1))
    }

    return (
        <div className='main appsView'>
            <div
                className='carouselViewport'
                onPointerDown={onDown}
                onPointerMove={onMove}
                onPointerUp={onUp}
                onPointerCancel={onUp}
            >
                <div
                    className='carouselTrack'
                    style={{
                        transform: `translateX(calc(${-focused * 100}% + ${dragPx}px))`,
                        transition: dragging ? 'none' : 'transform 300ms ease',
                    }}
                >
                    {APPS.map((app) => (
                        <div key={app.name} className='appScreen' style={{ '--app-color': app.color }}>
                            <div className='appBar'>
                                <span className='appIcon'>{app.letter}</span>
                                <span className='appName'>{app.name}</span>
                            </div>
                            <div className={`appCanvas ${app.type}`}></div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Fixed overlay: the image stays put on screen regardless of which
                app is focused/dragging underneath it. */}
            <div className='holdOverlay'>
                <img
                    src={photo}
                    alt=''
                    draggable={false}
                    className={held ? 'holdImg held' : 'holdImg'}
                    onPointerDown={(e) => { e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId); setHeld(true) }}
                    onPointerUp={() => setHeld(false)}
                    onPointerCancel={() => setHeld(false)}
                    onContextMenu={(e) => e.preventDefault()}
                />
            </div>

            <div className='carouselDots'>
                {APPS.map((a, i) => <span key={a.name} className={i === focused ? 'cdot on' : 'cdot'} />)}
            </div>
        </div>
    )
}

export default Swipe
