import { useState } from 'react'
import { Target } from 'lucide-react'
import { formatDate, todayISO } from './data'
import type { Workout } from './data'
import { personalRecords, workoutsOnDate } from './trainingInsights'

export function WorkoutCalendar({ workouts }: { workouts: Workout[] }) {
 const [month,setMonth]=useState(()=>todayISO().slice(0,7))
 const [selected,setSelected]=useState<string|null>(null)
 const [year,monthNumber]=month.split('-').map(Number)
 const first=new Date(year,monthNumber-1,1).getDay(), days=new Date(year,monthNumber,0).getDate()
 const shift=(offset:number)=>{const d=new Date(year,monthNumber-1+offset,1);setMonth(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);setSelected(null)}
 return <section className="panel"><div className="panel-heading"><div><h3>Workout calendar</h3><p>Green dates have logged sessions</p></div><div className="calendar-controls"><button type="button" aria-label="Previous month" onClick={()=>shift(-1)}>‹</button><strong>{new Date(year,monthNumber-1,1).toLocaleDateString('en-US',{month:'long',year:'numeric'})}</strong><button type="button" aria-label="Next month" onClick={()=>shift(1)}>›</button></div></div>
 <div className="calendar-grid">{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=><span className="calendar-weekday" key={d}>{d}</span>)}{Array.from({length:first},(_,i)=><span key={`blank-${i}`}/>)}{Array.from({length:days},(_,i)=>{const date=`${month}-${String(i+1).padStart(2,'0')}`,count=workoutsOnDate(workouts,date).length;return <button type="button" key={date} aria-label={`${date}: ${count} workouts`} aria-pressed={selected===date} className={`calendar-day ${count?'trained':''} ${selected===date?'selected':''}`} onClick={()=>setSelected(date)}>{i+1}{count>0&&<span className="calendar-dot"/>}</button>})}</div>
 {selected&&<div className="calendar-detail"><strong>{formatDate(selected)}</strong>{workoutsOnDate(workouts,selected).length ? workoutsOnDate(workouts,selected).map(w=><p key={w.id}>{w.name} · {w.exercises.length} exercises</p>):<p>No workouts logged on this day.</p>}</div>}</section>
}
export function PersonalRecords({workouts}:{workouts:Workout[]}) {
 const records=personalRecords(workouts)
 return <section className="panel"><div className="panel-heading"><div><h3>Personal records</h3><p>Heaviest set per exercise (ties favor more reps)</p></div><Target size={19}/></div>{records.length?<div className="records-list">{records.map(r=><div className="record-row" key={r.name.toLowerCase()}><div><strong>{r.name}</strong><span>{r.reps} reps · {formatDate(r.date)}</span></div><strong>{r.weight} lb</strong></div>)}</div>:<div className="empty-state">Log a workout to see personal records.</div>}</section>
}
