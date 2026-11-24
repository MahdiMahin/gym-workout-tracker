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

describe('workout metric edge cases', () => {
  const emptyWorkout = { id: 'edge', name: 'Edge cases', date: '2026-11-23', duration: 30, exercises: [] }

  it('returns zero volume and sets for an empty workout', () => {
    expect(workoutVolume(emptyWorkout)).toBe(0)
    expect(workoutSetCount(emptyWorkout)).toBe(0)
  })

  it('calculates total volume across multiple exercises', () => {
    const workout = { ...emptyWorkout, exercises: [
      { id: 'e1', name: 'Bench Press', sets: [{ id: 's1', reps: 8, weight: 100 }] },
      { id: 'e2', name: 'Row', sets: [{ id: 's2', reps: 10, weight: 80 }] },
    ] }
    expect(workoutVolume(workout)).toBe(1600)
    expect(workoutSetCount(workout)).toBe(2)
  })

  it('counts bodyweight sets even when added weight is zero', () => {
    const workout = { ...emptyWorkout, exercises: [
      { id: 'e1', name: 'Push Up', sets: [{ id: 's1', reps: 12, weight: 0 }] },
    ] }
    expect(workoutVolume(workout)).toBe(0)
    expect(workoutSetCount(workout)).toBe(1)
  })

  it('handles exercises without sets', () => {
    const workout = { ...emptyWorkout, exercises: [
      { id: 'e1', name: 'Bench Press', sets: [] },
      { id: 'e2', name: 'Row', sets: [{ id: 's1', reps: 5, weight: 40 }] },
    ] }
    expect(workoutVolume(workout)).toBe(200)
    expect(workoutSetCount(workout)).toBe(1)
  })

  it('preserves fractional weights in volume calculations', () => {
    const workout = { ...emptyWorkout, exercises: [
      { id: 'e1', name: 'Curl', sets: [{ id: 's1', reps: 3, weight: 12.5 }] },
    ] }
    expect(workoutVolume(workout)).toBe(37.5)
  })
})
