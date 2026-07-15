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

const SWIPE_THRESHOLD = 45
const HAND_DRAG = 8

function Swipe(){
    const { gestureRef, gestureHandRef } = useTracking()
    const [focused, setFocused] = useState(0)
    const [held, setHeld] = useState(false)
    const [dragPx, setDragPx] = useState(0)
    const [dragging, setDragging] = useState(false)
    const [instant, setInstant] = useState(false) // suppress transition on the seamless reset
    const [imgPos, setImgPos] = useState({ x: 0, y: 0 })
    const viewportRef = useRef(null)
    const lastXRef = useRef(0)
    const pendingStepRef = useRef(0)
    const overlayRef = useRef(null)
    const imgStartRef = useRef({ x: 0, y: 0 })

    const dragPxRef = useRef(dragPx); dragPxRef.current = dragPx
    const draggingRef = useRef(dragging); draggingRef.current = dragging
    const heldRef = useRef(held); heldRef.current = held

    // Add a drag delta, shifting `focused` whenever dragPx crosses a slide boundary so
    // the offset stays within one slide -- lets a single gesture scroll through many
    // apps with just a 3-slide window, and wraps endlessly.
    function addDrag(delta){
        const slideW = viewportRef.current?.clientWidth || 1
        let px = dragPxRef.current + delta
        let steps = 0
        while (px <= -slideW) { steps += 1; px += slideW }
        while (px >= slideW) { steps -= 1; px -= slideW }
        if (steps) setFocused(f => f + steps)
        dragPxRef.current = px
        setDragPx(px)
    }
    // Snap the residual offset to the nearest app on release.
    function settle(){
        const slideW = viewportRef.current?.clientWidth || 1
        const px = dragPxRef.current
        let step = 0
        if (px <= -SWIPE_THRESHOLD) step = 1
        else if (px >= SWIPE_THRESHOLD) step = -1
        pendingStepRef.current = step
        setDragPx(-step * slideW)
    }
    function commitPending(){
        const step = pendingStepRef.current
        if (!step) return
        pendingStepRef.current = 0
        setInstant(true)
        setFocused(f => f + step)
        dragPxRef.current = 0
        setDragPx(0)
        requestAnimationFrame(() => requestAnimationFrame(() => setInstant(false)))
    }

    function onDown(e){
        commitPending()
        e.currentTarget.setPointerCapture(e.pointerId)
        lastXRef.current = e.clientX
        setDragging(true)
    }
    function onMove(e){
        if (!draggingRef.current) return
        addDrag(e.clientX - lastXRef.current)
        lastXRef.current = e.clientX
    }
    function onUp(){
        if (!draggingRef.current) return
        setDragging(false)
        settle()
    }

    // Hand swipe is armed only while the image is held down by touch; then a
    // pinched reaching hand's horizontal motion drives the carousel (open hand = no
    // motion). Pinch state is shared from the tracker.
    useEffect(() => {
        if (!gestureRef) return undefined
        let raf = 0
        let wasHeld = false
        let lastTipX = null  // null re-baselines on next pinch (keeps drag continuous)

        const loop = () => {
            const g = gestureRef.current
            const left = gestureHandRef.current === 'left'
            const tip = left ? g?.tipLeft : g?.tipRight
            const pinch = left ? !!g?.pinchLeft : !!g?.pinchRight
            const armed = heldRef.current && !draggingRef.current

            if (armed) {
                if (!wasHeld) { wasHeld = true; commitPending(); lastTipX = null }
                if (tip && pinch) {
                    if (lastTipX === null) lastTipX = tip[0]
                    addDrag((lastTipX - tip[0]) * HAND_DRAG)
                    lastTipX = tip[0]
                } else {
                    lastTipX = null
                }
            } else if (wasHeld) {
                wasHeld = false
                lastTipX = null
                settle()
            }
            raf = requestAnimationFrame(loop)
        }
        raf = requestAnimationFrame(loop)
        return () => cancelAnimationFrame(raf)
    }, [gestureRef, gestureHandRef])

    return (
        <div className='main appsView'>
            <div
                className='carouselViewport'
                ref={viewportRef}
                onPointerDown={onDown}
                onPointerMove={onMove}
                onPointerUp={onUp}
                onPointerCancel={onUp}
            >
                <div
                    className='carouselTrack'
                    onTransitionEnd={commitPending}
                    style={{
                        transform: `translateX(calc(-100% + ${dragPx}px))`,
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

            <div className='holdOverlay' ref={overlayRef}>
                <div
                    className={held ? 'holdImgBox held' : 'holdImgBox'}
                    style={{ transform: `translate(${imgPos.x}px, ${imgPos.y}px)` }}
                    onPointerDown={(e) => {
                        e.stopPropagation()
                        e.currentTarget.setPointerCapture(e.pointerId)
                        imgStartRef.current = { x: e.clientX - imgPos.x, y: e.clientY - imgPos.y }
                        setHeld(true)
                    }}
                    onPointerMove={(e) => {
                        if (!heldRef.current) return
                        let x = e.clientX - imgStartRef.current.x
                        let y = e.clientY - imgStartRef.current.y
                        const r = overlayRef.current?.getBoundingClientRect()
                        if (r) {
                            const mx = r.width / 2 - 50, my = r.height / 2 - 50
                            x = Math.max(-mx, Math.min(mx, x))
                            y = Math.max(-my, Math.min(my, y))
                        }
                        setImgPos({ x, y })
                    }}
                    onPointerUp={() => setHeld(false)}
                    onPointerCancel={() => setHeld(false)}
                    onContextMenu={(e) => e.preventDefault()}
                >
                    <img src={photo} alt='' draggable={false} className='holdImg' />
                </div>
            </div>
        </div>
    )
}

export default Swipe
