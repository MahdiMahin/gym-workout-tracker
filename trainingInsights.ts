import type { Workout } from './data'
export function personalRecords(workouts: Workout[]) {
 const records = new Map<string, {name:string; weight:number; reps:number; date:string}>()
 for(const workout of workouts) for(const exercise of workout.exercises) for(const set of exercise.sets) {
  if(!exercise.name.trim() || !Number.isFinite(set.weight) || set.weight<0 || !Number.isFinite(set.reps) || set.reps<=0) continue
  const key=exercise.name.trim().toLowerCase(), old=records.get(key)
  if(!old || set.weight>old.weight || (set.weight===old.weight && set.reps>old.reps)) records.set(key,{name:exercise.name.trim(),weight:set.weight,reps:set.reps,date:workout.date})
 }
 return [...records.values()].sort((a,b)=>a.name.localeCompare(b.name))
}
export const workoutsOnDate = (workouts: Workout[], date:string) => workouts.filter(w=>w.date===date)
