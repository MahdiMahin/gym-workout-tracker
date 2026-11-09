import { describe, expect, it } from 'vitest'
import { formatDate, seedWorkouts, workoutSetCount, workoutVolume } from './data'

describe('workout metrics', () => {
  it('calculates volume as weight times reps across sets', () => {
    expect(workoutVolume({ id: 'test', name: 'Test', date: '2026-11-08', duration: 30, exercises: [
      { id: 'e', name: 'Bench', sets: [{ id: '1', reps: 10, weight: 100 }, { id: '2', reps: 8, weight: 120 }] },
    ] })).toBe(1960)
  })
  it('counts sets across exercises', () => {
    expect(workoutSetCount(seedWorkouts[0])).toBe(7)
  })
  it('formats dates consistently', () => {
    expect(formatDate('2026-11-08')).toBe('Nov 8, 2026')
  })
})
