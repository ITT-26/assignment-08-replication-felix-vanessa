import { createContext, useContext, useRef, useState, useEffect, useCallback } from 'react'
import { useGlassTracker } from './useGlassTracker'

// One shared camera + GlassTracker for every tab. The pano canvas lives in the
// always-mounted PanoBar; the Debug tab attaches its preview canvas via the
// shared previewCanvasRef.
const TrackingContext = createContext(null)

export const useTracking = () => useContext(TrackingContext)

const CAM_FLAG = 'glasshands.cameraGranted'   // remembers a prior grant across reloads

export function TrackingProvider({ children }) {
  const [cameraGranted, setCameraGranted] = useState(false)
  const [cameraError, setCameraError] = useState(null)
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const zoomCanvasRef = useRef(null)
  const previewCanvasRef = useRef(null)

  // Auto-start has no user gesture, so autoplay can stall on the first frame --
  // attach and explicitly play().
  const attachAndPlay = (stream) => {
    const v = videoRef.current
    if (!v) return
    if (v.srcObject !== stream) v.srcObject = stream
    v.play?.().catch(() => { /* retried on next visibility/gesture */ })
  }

  const requestCamera = useCallback(async () => {
    // Reuse a still-live stream (guards against duplicate starts).
    if (streamRef.current?.getVideoTracks?.().some((t) => t.readyState === 'live')) {
      attachAndPlay(streamRef.current)
      setCameraGranted(true)
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'user' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      })
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = stream
      attachAndPlay(stream)
      setCameraGranted(true)
      setCameraError(null)
      try { localStorage.setItem(CAM_FLAG, '1') } catch { /* storage unavailable */ }
    } catch {
      setCameraError('Camera access was denied. Please allow camera access and try again.')
    }
  }, [])

  // Auto-start if permission was already granted (so a reload/relock needs no tap).
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      let allowed = false
      try {
        const p = await navigator.permissions?.query?.({ name: 'camera' })
        allowed = p?.state === 'granted'
      } catch { /* Safari has no camera permission query */ }
      if (!allowed) { try { allowed = localStorage.getItem(CAM_FLAG) === '1' } catch { /* ignore */ } }
      if (allowed && !cancelled) requestCamera()
    })()
    return () => { cancelled = true }
  }, [requestCamera])

  // Re-acquire when returning to the page if the stream died while backgrounded.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible' || !cameraGranted) return
      const track = streamRef.current?.getVideoTracks?.()[0]
      if (!track || track.readyState === 'ended') requestCamera()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [cameraGranted, requestCamera])

  // Stop the camera only on app unmount.
  useEffect(() => () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [])

  const tracker = useGlassTracker(videoRef, zoomCanvasRef, previewCanvasRef, cameraGranted)

  const value = {
    cameraGranted,
    cameraError,
    requestCamera,
    zoomCanvasRef,
    previewCanvasRef,
    ...tracker, // status, tracked, dotsUsed, handLeft, handRight
  }

  return (
    <TrackingContext.Provider value={value}>
      {children}
      {/* Off-screen (not display:none, which would freeze requestVideoFrameCallback). */}
      <video ref={videoRef} autoPlay playsInline muted className='offscreenVideo'></video>
    </TrackingContext.Provider>
  )
}
