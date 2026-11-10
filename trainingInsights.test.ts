import {describe,it,expect} from 'vitest'
import {personalRecords,workoutsOnDate} from './trainingInsights'
import type {Workout} from './data'
const data:Workout[]=[{id:'1',name:'Push',date:'2026-11-05',duration:45,exercises:[{id:'a',name:'Bench Press',sets:[{id:'s1',weight:135,reps:8},{id:'s2',weight:155,reps:3}]}]},{id:'2',name:'Push',date:'2026-11-07',duration:45,exercises:[{id:'b',name:'bench press',sets:[{id:'s3',weight:155,reps:5},{id:'s4',weight:-10,reps:10}]}]}]
describe('personal records',()=>{
 it('finds the heaviest set and breaks ties with reps',()=>expect(personalRecords(data)).toEqual([{name:'bench press',weight:155,reps:5,date:'2026-11-07'}]))
 it('handles empty workout history',()=>expect(personalRecords([])).toEqual([]))
 it('ignores invalid sets',()=>expect(personalRecords([{...data[0],exercises:[{id:'e',name:'Squat',sets:[{id:'x',weight:-1,reps:0}]}]}])).toEqual([]))
})
describe('calendar',()=>it('finds workouts on a given date',()=>{expect(workoutsOnDate(data,'2026-11-07').map(w=>w.id)).toEqual(['2']);expect(workoutsOnDate(data,'2026-11-06')).toEqual([])}))
