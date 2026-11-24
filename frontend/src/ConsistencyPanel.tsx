import { useEffect, useState } from 'react'
import { Flame, Minus, Plus } from 'lucide-react'
import { MAX_WEEKLY_GOAL, MIN_WEEKLY_GOAL, clampWeeklyGoal, consistencyStats } from './consistency'
import { todayISO } from './data'
import type { Workout } from './data'

const GOAL_KEY = 'gwt_weekly_goal_v1'

function loadGoal(): number {
  try {
    const saved = localStorage.getItem(GOAL_KEY)
    return saved === null ? 3 : clampWeeklyGoal(Number(saved))
  } catch {
    return 3
  }
}

function lastWorkoutText(daysSinceLast: number | null): string {
  if (daysSinceLast === null) return 'No workouts logged yet'
  if (daysSinceLast === 0) return 'Last workout: today'
  if (daysSinceLast === 1) return 'Last workout: yesterday'
  return `Last workout: ${daysSinceLast} days ago`
}

const shortDate = (date: string) =>
  new Date(date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

export function ConsistencyPanel({ workouts, today = todayISO() }: { workouts: Workout[]; today?: string }) {
  const [goal, setGoal] = useState(loadGoal)
  useEffect(() => {
    try { localStorage.setItem(GOAL_KEY, String(goal)) } catch { /* storage unavailable: keep it in memory */ }
  }, [goal])

  const stats = consistencyStats(workouts, today, goal)
  const scale = Math.max(goal, ...stats.weeks.map(week => week.days), 1)

  return (
    <section className="panel consistency-panel">
      <div className="panel-heading">
        <div>
          <h3>Workout consistency</h3>
          <p>Training days per week against your weekly goal</p>
        </div>
        <div className="goal-stepper" role="group" aria-label="Weekly goal">
          <button type="button" aria-label="Lower weekly goal" disabled={goal <= MIN_WEEKLY_GOAL} onClick={() => setGoal(g => clampWeeklyGoal(g - 1))}><Minus size={14}/></button>
          <span><strong>{goal}</strong> days / week</span>
          <button type="button" aria-label="Raise weekly goal" disabled={goal >= MAX_WEEKLY_GOAL} onClick={() => setGoal(g => clampWeeklyGoal(g + 1))}><Plus size={14}/></button>
        </div>
      </div>

      <div className="consistency-stats">
        <div><span>This week</span><strong>{stats.thisWeek} / {goal}</strong></div>
        <div><span>Week streak</span><strong><Flame size={17} className={stats.currentStreak ? 'streak-on' : 'muted'}/> {stats.currentStreak}</strong></div>
        <div><span>Best streak</span><strong>{stats.bestStreak}</strong></div>
        <div><span>Avg days / week</span><strong>{stats.averagePerWeek}</strong></div>
      </div>

      <div className="week-strip" role="list" aria-label="Training days per week, last 8 weeks">
        <div className="week-bars">
          <div className="week-goal-line" style={{ bottom: `${(goal / scale) * 100}%` }} aria-hidden="true"/>
          {stats.weeks.map((week, i) => (
            <div
              key={week.start}
              role="listitem"
              aria-label={`Week of ${shortDate(week.start)}: ${week.days} training days${week.goalMet ? ', goal met' : ''}`}
              title={`Week of ${shortDate(week.start)}: ${week.days} training days`}
              className={`week-bar ${week.goalMet ? 'met' : ''} ${i === stats.weeks.length - 1 ? 'current' : ''}`}
              style={{ height: `${Math.max(4, (week.days / scale) * 100)}%` }}
            />
          ))}
        </div>
        <div className="week-labels" aria-hidden="true">
          {stats.weeks.map((week, i) => <span key={week.start}>{i === stats.weeks.length - 1 ? 'This wk' : shortDate(week.start)}</span>)}
        </div>
      </div>
      <div className="summary-foot"><span className="status-dot"/> {lastWorkoutText(stats.daysSinceLast)}</div>
    </section>
  )
}
