import { useEffect, useState } from 'react'

const presets = [60, 90, 120]

export function RestTimer() {
  const [duration, setDuration] = useState(90)
  const [remaining, setRemaining] = useState(90)
  const [deadline, setDeadline] = useState<number | null>(null)

  useEffect(() => {
    if (deadline === null) return
    const tick = () => {
      const seconds = Math.max(0, Math.ceil((deadline - Date.now()) / 1000))
      setRemaining(seconds)
      if (seconds === 0) setDeadline(null)
    }
    const interval = window.setInterval(tick, 200)
    return () => window.clearInterval(interval)
  }, [deadline])

  const reset = (seconds: number) => {
    setDeadline(null)
    setDuration(seconds)
    setRemaining(seconds)
  }

  const toggle = () => {
    if (deadline !== null) {
      setRemaining(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)))
      setDeadline(null)
    } else {
      const seconds = remaining || duration
      setRemaining(seconds)
      setDeadline(Date.now() + seconds * 1000)
    }
  }

  return (
    <section className="exercise-editor" aria-label="Rest timer">
      <div className="form-section-head"><h3>Rest timer</h3></div>
      <p>Take a break between sets.</p>
      <p role="timer" aria-label="Time remaining" style={{ fontSize: '2rem', fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>
        {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {presets.map(seconds => (
          <button key={seconds} type="button" className={duration === seconds ? 'btn btn-primary' : 'btn btn-outline'}
            aria-pressed={duration === seconds} onClick={() => reset(seconds)}>{seconds}s</button>
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
        <button type="button" className="btn btn-primary" onClick={toggle}>
          {deadline !== null ? 'Pause' : remaining === 0 ? 'Restart' : remaining === duration ? 'Start' : 'Resume'}
        </button>
        <button type="button" className="btn btn-outline" onClick={() => reset(duration)}>Reset</button>
      </div>
      <p role="status">{remaining === 0 ? 'Rest complete! Ready for your next set.' : ''}</p>
    </section>
  )
}
