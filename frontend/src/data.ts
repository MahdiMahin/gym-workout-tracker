export type ExerciseSet = { id: string; reps: number; weight: number }
export type Exercise = { id: string; name: string; sets: ExerciseSet[] }
export type Workout = { id: string; name: string; date: string; duration: number; exercises: Exercise[]; notes?: string }

export const seedWorkouts: Workout[] = [
  { id: 'demo-1', name: 'Push Day', date: '2026-11-07', duration: 62, exercises: [
    { id: 'd1', name: 'Bench Press', sets: [{ id: 'a', reps: 8, weight: 135 }, { id: 'b', reps: 8, weight: 135 }, { id: 'c', reps: 6, weight: 145 }] },
    { id: 'd2', name: 'Incline Dumbbell Press', sets: [{ id: 'd', reps: 10, weight: 50 }, { id: 'e', reps: 9, weight: 50 }] },
    { id: 'd3', name: 'Lateral Raises', sets: [{ id: 'f', reps: 12, weight: 20 }, { id: 'g', reps: 12, weight: 20 }] },
  ] },
  { id: 'demo-2', name: 'Pull Day', date: '2026-11-05', duration: 55, exercises: [
    { id: 'd4', name: 'Lat Pulldown', sets: [{ id: 'h', reps: 10, weight: 120 }, { id: 'i', reps: 9, weight: 120 }] },
    { id: 'd5', name: 'Seated Row', sets: [{ id: 'j', reps: 10, weight: 100 }, { id: 'k', reps: 10, weight: 100 }] },
  ] },
  { id: 'demo-3', name: 'Upper Body', date: '2026-11-03', duration: 58, exercises: [
    { id: 'd6', name: 'Bench Press', sets: [{ id: 'l', reps: 8, weight: 130 }, { id: 'm', reps: 8, weight: 130 }] },
    { id: 'd7', name: 'Bicep Curl', sets: [{ id: 'n', reps: 10, weight: 30 }, { id: 'o', reps: 10, weight: 30 }] },
  ] },
]

export function workoutVolume(workout: Workout): number {
  return workout.exercises.reduce((total, exercise) =>
    total + exercise.sets.reduce((sum, set) => sum + set.reps * set.weight, 0), 0)
}
export function workoutSetCount(workout: Workout): number {
  return workout.exercises.reduce((count, exercise) => count + exercise.sets.length, 0)
}
export function formatDate(date: string): string {
  return new Date(date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
export function todayISO(): string {
  const now = new Date()
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
}
