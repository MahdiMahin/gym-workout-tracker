import type { Workout } from './data'

// Weeks run Monday to Sunday. Dates are 'YYYY-MM-DD' strings, handled as UTC
// days so the math never shifts with the browser's time zone.
const DAY_MS = 86_400_000

function toDay(date: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (!match) return null
  const day = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / DAY_MS
  return Number.isFinite(day) ? day : null
}

function toISO(day: number): string {
  return new Date(day * DAY_MS).toISOString().slice(0, 10)
}

// Monday of the week the day falls in (day 0 = Thu 1970-01-01).
function mondayOf(day: number): number {
  return day - ((day + 3) % 7)
}

export function weekStart(date: string): string {
  const day = toDay(date)
  if (day === null) throw new Error(`invalid date: ${date}`)
  return toISO(mondayOf(day))
}

export type WeekSummary = { start: string; days: number; goalMet: boolean }

export type ConsistencyStats = {
  weeklyGoal: number
  thisWeek: number                // training days so far this week
  currentStreak: number           // weeks in a row that hit the goal
  bestStreak: number
  averagePerWeek: number          // training days per week over `weeks`
  daysSinceLast: number | null    // null when nothing has been logged
  weeks: WeekSummary[]            // oldest first, the last entry is this week
}

export const MIN_WEEKLY_GOAL = 1
export const MAX_WEEKLY_GOAL = 7

export function clampWeeklyGoal(goal: number): number {
  if (!Number.isFinite(goal)) return 3
  return Math.min(MAX_WEEKLY_GOAL, Math.max(MIN_WEEKLY_GOAL, Math.round(goal)))
}

// Consistency counts training days, not workouts: two sessions on the same
// day are one day. Workouts dated after `today` are ignored.
export function consistencyStats(workouts: Workout[], today: string, weeklyGoal: number, weeks = 8): ConsistencyStats {
  const goal = clampWeeklyGoal(weeklyGoal)
  const todayDay = toDay(today)
  if (todayDay === null) throw new Error(`invalid date: ${today}`)
  const thisMonday = mondayOf(todayDay)

  const trainingDays = new Set<number>()
  for (const workout of workouts) {
    const day = toDay(workout.date)
    if (day !== null && day <= todayDay) trainingDays.add(day)
  }

  const daysPerWeek = new Map<number, number>()
  for (const day of trainingDays) {
    const monday = mondayOf(day)
    daysPerWeek.set(monday, (daysPerWeek.get(monday) ?? 0) + 1)
  }
  const daysIn = (monday: number) => daysPerWeek.get(monday) ?? 0

  // This week is still in progress, so it only adds to the streak once the
  // goal is hit; falling short so far doesn't break it.
  let currentStreak = daysIn(thisMonday) >= goal ? 1 : 0
  for (let monday = thisMonday - 7; daysIn(monday) >= goal; monday -= 7) currentStreak++

  let bestStreak = 0
  let run = 0
  const mondays = [...daysPerWeek.keys()].sort((a, b) => a - b)
  for (let i = 0; i < mondays.length; i++) {
    const met = daysIn(mondays[i]) >= goal
    const followsLast = i > 0 && mondays[i] - mondays[i - 1] === 7 && daysIn(mondays[i - 1]) >= goal
    run = met ? (followsLast ? run + 1 : 1) : 0
    bestStreak = Math.max(bestStreak, run)
  }

  const summaries: WeekSummary[] = []
  for (let i = weeks - 1; i >= 0; i--) {
    const monday = thisMonday - i * 7
    summaries.push({ start: toISO(monday), days: daysIn(monday), goalMet: daysIn(monday) >= goal })
  }
  const totalDays = summaries.reduce((sum, week) => sum + week.days, 0)

  const lastDay = trainingDays.size ? Math.max(...trainingDays) : null
  return {
    weeklyGoal: goal,
    thisWeek: daysIn(thisMonday),
    currentStreak,
    bestStreak,
    averagePerWeek: Math.round((totalDays / weeks) * 10) / 10,
    daysSinceLast: lastDay === null ? null : todayDay - lastDay,
    weeks: summaries,
  }
}
