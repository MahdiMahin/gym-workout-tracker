import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  Activity, ArrowDownRight, ArrowRight, ArrowUpRight, BarChart3, CalendarDays,
  Check, ChevronDown, ChevronRight, Dumbbell, Flame,
  Home, ListChecks, Menu, Moon, Plus, Search, Settings2, Target, Trash2,
  TrendingUp, UserRound, Weight, X,
} from 'lucide-react'
import { formatDate, seedWorkouts, todayISO, workoutSetCount, workoutVolume } from './data'
import type { Exercise, Workout } from './data'
import { isSupabaseConfigured } from './lib/supabase'

type Page = 'dashboard' | 'workouts' | 'history' | 'progress' | 'profile'
type NavItem = { id: Page; label: string; icon: typeof Home }
const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: Home },
  { id: 'workouts', label: 'My Workouts', icon: Dumbbell },
  { id: 'history', label: 'History', icon: CalendarDays },
  { id: 'progress', label: 'Progress', icon: BarChart3 },
  { id: 'profile', label: 'Profile', icon: UserRound },
]
const STORAGE_KEY = 'gwt_demo_workouts_v1'
const EXERCISES = ['Bench Press', 'Incline Dumbbell Press', 'Squat', 'Deadlift', 'Lat Pulldown', 'Seated Row', 'Lateral Raises', 'Bicep Curl', 'Tricep Pushdown', 'Leg Press', 'Overhead Press', 'Cable Fly']
const uid = () => typeof crypto !== 'undefined' && 'randomUUID' in crypto 
  ? crypto.randomUUID()
  : `id-${Date.now()}-${Math.random().toString(36).slice(2)}`
const n = (value: string) => Math.max(0, Number(value) || 0)

function loadWorkouts(): Workout[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return seedWorkouts
    const parsed: unknown = JSON.parse(saved)
    return Array.isArray(parsed) ? parsed as Workout[] : seedWorkouts
  } catch {
    return seedWorkouts
  }
}
function IconButton({ children, onClick, title }: { children: ReactNode; onClick: () => void; title: string }) {
  return <button className="icon-btn" type="button" title={title} aria-label={title} onClick={onClick}>{children}</button>
}
function WorkoutForm({ onSave, onCancel }: { onSave: (workout: Workout) => void; onCancel: () => void }) {
  const [name, setName] = useState('New Workout')
  const [date, setDate] = useState(todayISO())
  const [duration, setDuration] = useState('45')
  const [notes, setNotes] = useState('')
  const [exercises, setExercises] = useState<Exercise[]>([
    { id: uid(), name: 'Bench Press', sets: [{ id: uid(), reps: 8, weight: 135 }] },
  ])
  const patchSet = (exerciseId: string, setId: string, field: 'reps' | 'weight', value: string) =>
    setExercises(previous => previous.map(ex => ex.id === exerciseId ? {
      ...ex, sets: ex.sets.map(set => set.id === setId ? { ...set, [field]: n(value) } : set),
    } : ex))
  const addSet = (exerciseId: string) => setExercises(previous => previous.map(ex => ex.id === exerciseId ? {
    ...ex, sets: [...ex.sets, { id: uid(), reps: 8, weight: 0 }],
  } : ex))
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onCancel() }}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className="modal-heading"><div><span className="eyebrow">WORKOUT BUILDER</span><h2 id="modal-title">Log a workout</h2></div><IconButton title="Close" onClick={onCancel}><X size={19}/></IconButton></div>
        <form onSubmit={event => {
          event.preventDefault()
          if (!name.trim() || !date || exercises.some(ex => !ex.name.trim() || ex.sets.length === 0)) return
          onSave({ id: uid(), name: name.trim(), date, duration: n(duration), notes, exercises })
        }}>
          <div className="form-grid">
            <label className="field">Workout name<input required value={name} maxLength={80} onChange={e => setName(e.target.value)}/></label>
            <label className="field">Date<input required type="date" value={date} onChange={e => setDate(e.target.value)}/></label>
            <label className="field">Duration (minutes)<input type="number" min="0" max="1000" value={duration} onChange={e => setDuration(e.target.value)}/></label>
          </div>
          <div className="form-section-head"><h3>Exercises</h3><button className="text-action" type="button" onClick={() => setExercises(prev => [...prev, { id: uid(), name: 'Lat Pulldown', sets: [{ id: uid(), reps: 10, weight: 0 }] }])}><Plus size={16}/> Add exercise</button></div>
          {exercises.map((exercise, index) => (
            <div className="exercise-editor" key={exercise.id}>
              <div className="editor-top"><span className="exercise-index">{String(index + 1).padStart(2, '0')}</span>
                <select aria-label={`Exercise ${index + 1}`} value={exercise.name} onChange={e => setExercises(prev => prev.map(ex => ex.id === exercise.id ? { ...ex, name: e.target.value } : ex))}>
                  {EXERCISES.map(option => <option key={option}>{option}</option>)}
                </select>
                <IconButton title="Remove exercise" onClick={() => setExercises(prev => prev.filter(ex => ex.id !== exercise.id))}><Trash2 size={16}/></IconButton>
              </div>
              <div className="set-head"><span>SET</span><span>REPS</span><span>WEIGHT (LB)</span><span></span></div>
              {exercise.sets.map((set, setIndex) => <div className="set-row" key={set.id}>
                <span className="set-number">{setIndex + 1}</span>
                <input aria-label="Reps" type="number" min="0" max="10000" value={set.reps} onChange={e => patchSet(exercise.id, set.id, 'reps', e.target.value)}/>
                <input aria-label="Weight" type="number" min="0" max="100000" value={set.weight} onChange={e => patchSet(exercise.id, set.id, 'weight', e.target.value)}/>
                <IconButton title="Remove set" onClick={() => setExercises(prev => prev.map(ex => ex.id === exercise.id ? { ...ex, sets: ex.sets.filter(item => item.id !== set.id) } : ex))}><X size={16}/></IconButton>
              </div>)}
              <button className="add-set" type="button" onClick={() => addSet(exercise.id)}><Plus size={15}/> Add set</button>
            </div>
          ))}
          <label className="field">Notes (optional)<textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="How did the session feel?"/></label>
          <div className="modal-footer"><button className="btn btn-ghost" type="button" onClick={onCancel}>Cancel</button><button className="btn btn-primary" type="submit" disabled={exercises.length === 0}><Check size={17}/> Save workout</button></div>
        </form>
      </div>
    </div>
  )
}
function VolumeChart({ workouts }: { workouts: Workout[] }) {
  const sorted = [...workouts].sort((a, b) => a.date.localeCompare(b.date)).slice(-7)
  const values = sorted.map(workoutVolume)
  const max = Math.max(...values, 1)
  return <div className="chart"><div className="chart-grid"><span>{Math.round(max).toLocaleString()}</span><span>{Math.round(max/2).toLocaleString()}</span><span>0</span></div><div className="bars">
    {sorted.length === 0 ? <div className="empty-chart">Log a workout to see your volume trend.</div> : sorted.map((workout, i) =>
      <div className="bar-column" key={workout.id} title={`${workout.name}: ${workoutVolume(workout).toLocaleString()} lb`}>
        <div className={i === sorted.length - 1 ? 'bar active' : 'bar'} style={{height: `${Math.max(5, (workoutVolume(workout) / max) * 100)}%`}}/>
        <span>{new Date(workout.date + 'T12:00:00').toLocaleDateString('en-US', {month:'short',day:'numeric'})}</span>
      </div>)}
  </div></div>
}
function WorkoutRow({ workout, onDelete, showDelete = false }: { workout: Workout; onDelete?: (id: string) => void; showDelete?: boolean }) {
  return <div className="workout-row">
    <div className="workout-symbol"><Dumbbell size={20}/></div>
    <div className="workout-main"><strong>{workout.name}</strong><span>{formatDate(workout.date)} · {workout.exercises.length} exercises</span></div>
    <div className="workout-volume"><strong>{workoutVolume(workout).toLocaleString()} lb</strong><span>{workout.duration} min · {workoutSetCount(workout)} sets</span></div>
    {showDelete ? <IconButton title={`Delete ${workout.name}`} onClick={() => onDelete?.(workout.id)}><Trash2 size={17}/></IconButton> : <ChevronRight size={18} className="muted"/>}
  </div>
}
function App() {
  const [page, setPage] = useState<Page>('dashboard')
  const [workouts, setWorkouts] = useState<Workout[]>(loadWorkouts)
  const [showForm, setShowForm] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [dark, setDark] = useState(true)
  const [toast, setToast] = useState('')
  useEffect(() => localStorage.setItem(STORAGE_KEY, JSON.stringify(workouts)), [workouts])
  useEffect(() => document.documentElement.classList.toggle('light', !dark), [dark])
  const sorted = useMemo(() => [...workouts].sort((a,b) => b.date.localeCompare(a.date)), [workouts])
  const totalVolume = workouts.reduce((sum, workout) => sum + workoutVolume(workout), 0)
  const allExercises = workouts.flatMap(w => w.exercises)
  const totalSets = allExercises.reduce((sum, ex) => sum + ex.sets.length, 0)
  const bestWeight = Math.max(0, ...allExercises.flatMap(ex => ex.sets.map(set => set.weight)))
  const filtered = sorted.filter(w => w.name.toLowerCase().includes(query.toLowerCase()) || w.exercises.some(ex => ex.name.toLowerCase().includes(query.toLowerCase())))
  const record = (workout: Workout) => { setWorkouts(prev => [workout, ...prev]); setShowForm(false); setPage('history'); setToast('Workout saved to this browser') }
  const remove = (id: string) => { if (!window.confirm('Delete this demo workout?')) return; setWorkouts(prev => prev.filter(w => w.id !== id)); setToast('Workout deleted') }
  const go = (next: Page) => { setPage(next); setMobileOpen(false); setQuery('') }
  const titles: Record<Page, { title: string; eyebrow: string; description: string }> = {
    dashboard: { title: 'Your fitness at a glance', eyebrow: 'OVERVIEW', description: 'Every rep counts. Keep the momentum going.' },
    workouts: { title: 'My workouts', eyebrow: 'TRAINING', description: 'Build a session and track every set.' },
    history: { title: 'Workout history', eyebrow: 'ACTIVITY LOG', description: 'A record of the work you have put in.' },
    progress: { title: 'Track your progress', eyebrow: 'ANALYTICS', description: 'Your effort, translated into numbers.' },
    profile: { title: 'Your profile', eyebrow: 'ACCOUNT', description: 'Preferences and project information.' },
  }
  return <div className="app-shell">
    <aside className={mobileOpen ? 'sidebar open' : 'sidebar'}>
      <div className="brand"><div className="brand-mark"><Dumbbell size={21} strokeWidth={2.8}/></div><div><strong>REP<span>LOG</span></strong><small>GYM WORKOUT TRACKER</small></div><button className="mobile-close" aria-label="Close menu" onClick={() => setMobileOpen(false)}><X size={20}/></button></div>
      <div className="sidebar-caption">WORKSPACE</div>
      <nav className="side-nav" aria-label="Main navigation">{navItems.map(item => <button key={item.id} className={page === item.id ? 'nav-link selected' : 'nav-link'} onClick={() => go(item.id)}><item.icon size={19}/><span>{item.label}</span>{page === item.id && <span className="nav-active-dot"/>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="sidebar-tip"><div className="tip-icon"><Flame size={18}/></div><strong>Stay consistent</strong><p>Small progress every session adds up to big results.</p><button onClick={() => setShowForm(true)}>Log a session <ArrowRight size={15}/></button></div><div className="sidebar-account"><div className="avatar">GT</div><div><strong>Demo Athlete</strong><span>Local demo account</span></div><ChevronDown size={16}/></div></div>
    </aside>
    {mobileOpen && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMobileOpen(false)}/>}
    <div className="main-area">
      <header className="topbar"><div className="topbar-left"><button className="menu-button" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu size={21}/></button><span className="breadcrumb">Workspace</span><ChevronRight size={15}/><strong>{navItems.find(item => item.id === page)?.label}</strong></div><div className="top-actions"><span className="demo-pill"><span/> DEMO MODE</span><IconButton title="Toggle light/dark mode" onClick={() => setDark(p => !p)}><Moon size={19}/></IconButton><div className="avatar small">GT</div></div></header>
      <main className="content">
        <div className="page-header"><div><span className="eyebrow">{titles[page].eyebrow}</span><h1>{titles[page].title}</h1><p>{titles[page].description}</p></div>{page !== 'profile' && <button className="btn btn-primary" onClick={() => setShowForm(true)}><Plus size={18}/> Log workout</button>}</div>
        {page === 'dashboard' && <>
          <div className="welcome-banner"><div><span className="eyebrow">YOUR TRAINING JOURNEY</span><h2>Stronger every session.</h2><p>Show up, put in the work, and keep building a better you.</p><button className="btn btn-banner" onClick={() => setShowForm(true)}>Start a workout <ArrowUpRight size={17}/></button></div><div className="banner-art" aria-hidden="true"><div className="banner-ring ring-a"/><div className="banner-ring ring-b"/><Dumbbell size={112} strokeWidth={1.15}/></div></div>
          <div className="stats-grid"><div className="stat-card"><div className="stat-icon green"><Dumbbell size={20}/></div><span>Total Workouts</span><strong>{workouts.length}</strong><small><TrendingUp size={13}/> Sessions logged</small></div><div className="stat-card"><div className="stat-icon blue"><Activity size={20}/></div><span>Total Volume</span><strong>{totalVolume.toLocaleString()} <em>lb</em></strong><small><ArrowUpRight size={13}/> Weight × reps</small></div><div className="stat-card"><div className="stat-icon orange"><ListChecks size={20}/></div><span>Total Sets</span><strong>{totalSets}</strong><small><Check size={13}/> Across all sessions</small></div><div className="stat-card"><div className="stat-icon purple"><Weight size={20}/></div><span>Heaviest Set</span><strong>{bestWeight} <em>lb</em></strong><small><ArrowDownRight size={13}/> Highest logged weight</small></div></div>
          <div className="dashboard-grid"><section className="panel"><div className="panel-heading"><div><h3>Training volume</h3><p>Volume lifted per workout</p></div><span className="period-tag">Last 7 sessions</span></div><VolumeChart workouts={workouts}/></section><section className="panel summary-panel"><div className="panel-heading"><div><h3>Quick overview</h3><p>Your training totals</p></div><Target size={19} className="muted"/></div><div className="summary-stat"><span>Exercises logged</span><strong>{allExercises.length}</strong></div><div className="summary-stat"><span>Average duration</span><strong>{workouts.length ? Math.round(workouts.reduce((sum,w) => sum + w.duration,0) / workouts.length) : 0} min</strong></div><div className="summary-stat"><span>Training sessions</span><strong>{workouts.length}</strong></div><div className="summary-foot"><span className="status-dot"/> Demo data stored locally</div></section></div>
          <section className="panel recent-panel"><div className="panel-heading"><div><h3>Recent workouts</h3><p>Your latest training sessions</p></div><button className="text-action" onClick={() => go('history')}>View all <ArrowRight size={16}/></button></div>{sorted.length ? sorted.slice(0,3).map(workout => <WorkoutRow key={workout.id} workout={workout}/>) : <div className="empty-state">No workouts yet. Log your first session.</div>}</section>
        </>}
        {page === 'workouts' && <><div className="page-feature"><div className="feature-icon"><Plus size={24}/></div><div><h3>Ready for your next session?</h3><p>Build a workout, add exercises, and record each set in one place.</p></div><button className="btn btn-primary" onClick={() => setShowForm(true)}>New workout <ArrowRight size={17}/></button></div><section className="panel"><div className="panel-heading"><div><h3>Recent training sessions</h3><p>Pick up where you left off</p></div></div>{sorted.map(workout => <WorkoutRow key={workout.id} workout={workout}/>)}{!sorted.length && <div className="empty-state">Your sessions will appear here.</div>}</section><div className="helper-note"><Settings2 size={17}/> Workout templates and exercise-library search are planned for future sprints.</div></>}
        {page === 'history' && <section className="panel"><div className="panel-heading"><div><h3>All sessions</h3><p>{filtered.length} matching workouts</p></div><label className="search"><Search size={17}/><input placeholder="Search workouts..." value={query} onChange={e => setQuery(e.target.value)}/></label></div>{filtered.map(workout => <WorkoutRow key={workout.id} workout={workout} onDelete={remove} showDelete/>)}{!filtered.length && <div className="empty-state">No matching workouts found.</div>}</section>}
        {page === 'progress' && <><div className="stats-grid compact"><div className="stat-card"><div className="stat-icon green"><TrendingUp size={20}/></div><span>Lifetime Volume</span><strong>{totalVolume.toLocaleString()} <em>lb</em></strong></div><div className="stat-card"><div className="stat-icon blue"><ListChecks size={20}/></div><span>Sets Completed</span><strong>{totalSets}</strong></div><div className="stat-card"><div className="stat-icon orange"><Dumbbell size={20}/></div><span>Workouts Logged</span><strong>{workouts.length}</strong></div></div><section className="panel"><div className="panel-heading"><div><h3>Volume by workout</h3><p>See how your training adds up</p></div><span className="period-tag">Recent sessions</span></div><VolumeChart workouts={workouts}/></section><div className="helper-note"><Activity size={17}/> Charts use demo data until Supabase integration is enabled.</div></>}
        {page === 'profile' && <><section className="panel profile-card"><div className="profile-avatar">GT</div><div><span className="eyebrow">ATHLETE PROFILE</span><h2>Demo Athlete</h2><p>Sign-in and account profiles will be enabled when Supabase authentication is configured.</p></div></section><section className="panel settings-panel"><div className="panel-heading"><div><h3>Application settings</h3><p>Customize your experience</p></div></div><div className="setting-line"><div><strong>Dark mode</strong><span>Switch the website appearance</span></div><button className={dark ? 'toggle on' : 'toggle'} aria-label="Toggle dark mode" aria-pressed={dark} onClick={() => setDark(v => !v)}><span/></button></div><div className="setting-line"><div><strong>Demo workouts</strong><span>Restore example workouts on this browser</span></div><button className="btn btn-outline" onClick={() => {setWorkouts(seedWorkouts);setToast('Demo workouts restored')}}>Reset demo</button></div><div className="setting-line"><div><strong>Supabase configuration</strong><span>{isSupabaseConfigured ? 'Environment variables detected; data operations are still demo-only' : 'Not configured — running in demo mode'}</span></div><span className="period-tag">{isSupabaseConfigured ? 'Client ready' : 'Pending'}</span></div></section></>}
        <footer className="footer"><span>REPLOG · Gym Workout Tracker</span><span>CSC456 team project · Demo frontend</span></footer>
      </main>
    </div>
    {toast && <div className="toast" role="status">{toast}<button aria-label="Dismiss notification" onClick={() => setToast('')}><X size={16}/></button></div>}
    {showForm && <WorkoutForm onSave={record} onCancel={() => setShowForm(false)}/>}
  </div>
}
export default App
