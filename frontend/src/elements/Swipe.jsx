import { useEffect, useRef, useState } from 'react'
import photo from '../assets/axolotl.png'
import { useTracking } from '../tracking/TrackingContext'
import '../App.css'

const APPS = [
    { name: 'Docs',   type: 'docs',   color: '#2b579a', letter: 'W' },
    { name: 'Sheets', type: 'sheets', color: '#217346', letter: 'X' },
    { name: 'Mail',   type: 'mail',   color: '#0a7ea4', letter: '@' },
    { name: 'Notes',  type: 'notes',  color: '#7719aa', letter: 'N' },
]
const N = APPS.length
const mod = (n) => ((n % N) + N) % N

const SWIPE_THRESHOLD = 60
const HAND_DRAG_GAIN = 5      // screen px per pano px of fingertip motion
const HAND_DRAG_SIGN = 1      // flip to -1 if swipe direction feels reversed

function Swipe(){
    const { gestureRef } = useTracking()
    const [focused, setFocused] = useState(0)
    const [offset, setOffset] = useState(-100)
    const [held, setHeld] = useState(false)
    const [dragPx, setDragPx] = useState(0)
    const [dragging, setDragging] = useState(false)
    const [instant, setInstant] = useState(false) // suppress transition on the seamless reset
    const startXRef = useRef(0)
    const pendingDirRef = useRef(0)

    const dragPxRef = useRef(dragPx); dragPxRef.current = dragPx
    const draggingRef = useRef(dragging); draggingRef.current = dragging

    function commitPending(){
        const dir = pendingDirRef.current
        if (!dir) return
        pendingDirRef.current = 0
        setInstant(true)
        setFocused(f => f + dir)
        setOffset(-100)
        requestAnimationFrame(() => requestAnimationFrame(() => setInstant(false)))
    }
    function settle(px){
        let dir = 0
        if (px <= -SWIPE_THRESHOLD) dir = 1
        else if (px >= SWIPE_THRESHOLD) dir = -1
        setDragPx(0)
        pendingDirRef.current = dir
        setOffset(-100 + dir * -100)
    }

    function onDown(e){
        commitPending()
        e.currentTarget.setPointerCapture(e.pointerId)
        startXRef.current = e.clientX
        setDragging(true)
        setDragPx(0)
    }
    function onMove(e){
        if (!draggingRef.current) return
        setDragPx(e.clientX - startXRef.current)
    }
    function onUp(){
        if (!draggingRef.current) return
        setDragging(false)
        settle(dragPxRef.current)
    }

    useEffect(() => {
        if (!gestureRef) return undefined
        let raf = 0
        let active = false
        let startX = null
        let src = null

        const loop = () => {
            const g = gestureRef.current
            const tip = g?.tipRight ?? g?.tipLeft ?? null
            const tipSrc = g?.tipRight ? 'R' : (g?.tipLeft ? 'L' : null)
            const present = tip !== null

            if (draggingRef.current) {      // touch wins
                raf = requestAnimationFrame(loop)
                return
            }
            if (present && !active) {
                active = true
                startX = tip[0]
                src = tipSrc
                commitPending()
                setHeld(true)
            } else if (present && active) {
                if (tipSrc !== src) {       // crossed lenses: re-baseline, keep drag continuous
                    startX = tip[0] + dragPxRef.current / (HAND_DRAG_SIGN * HAND_DRAG_GAIN)
                    src = tipSrc
                }
                setDragPx((startX - tip[0]) * HAND_DRAG_SIGN * HAND_DRAG_GAIN)
            } else if (!present && active) {
                active = false
                startX = null
                src = null
                setHeld(false)
                settle(dragPxRef.current)
            }
            raf = requestAnimationFrame(loop)
        }
        raf = requestAnimationFrame(loop)
        return () => cancelAnimationFrame(raf)
    }, [gestureRef])

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
                    onTransitionEnd={commitPending}
                    style={{
                        transform: `translateX(calc(${offset}% + ${dragPx}px))`,
                        transition: dragging || held || instant ? 'none' : 'transform 300ms ease',
                    }}
                >
                    {[focused - 1, focused, focused + 1].map((idx) => {
                        const app = APPS[mod(idx)]
                        return (
                            <div key={idx} className='appScreen' style={{ '--app-color': app.color }}>
                                <div className='appBar'>
                                    <span className='appIcon'>{app.letter}</span>
                                    <span className='appName'>{app.name}</span>
                                </div>
                                <div className={`appCanvas ${app.type}`}></div>
                            </div>
                        )
                    })}
                </div>
            </div>

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
        </div>
    )
}

export default Swipe
