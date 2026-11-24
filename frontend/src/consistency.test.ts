import { describe, expect, it } from 'vitest'
import { clampWeeklyGoal, consistencyStats, weekStart } from './consistency'
import type { Workout } from './data'

const workout = (date: string, id = date): Workout => ({ id, name: 'Session', date, duration: 45, exercises: [] })

// 2026-11-23 is a Monday; "today" in these tests is Thursday 2026-11-26.
const TODAY = '2026-11-26'

describe('weekStart', () => {
  it('returns the Monday of the week', () => {
    expect(weekStart('2026-11-23')).toBe('2026-11-23')
    expect(weekStart('2026-11-26')).toBe('2026-11-23')
    expect(weekStart('2026-11-29')).toBe('2026-11-23')
    expect(weekStart('2026-11-30')).toBe('2026-11-30')
  })
  it('handles weeks that cross a month or year', () => {
    expect(weekStart('2026-11-01')).toBe('2026-10-26')
    expect(weekStart('2027-01-01')).toBe('2026-12-28')
  })
})

describe('consistencyStats', () => {
  it('is all zeros with no workouts', () => {
    const stats = consistencyStats([], TODAY, 3)
    expect(stats).toMatchObject({ thisWeek: 0, currentStreak: 0, bestStreak: 0, averagePerWeek: 0, daysSinceLast: null })
    expect(stats.weeks).toHaveLength(8)
    expect(stats.weeks[7]).toEqual({ start: '2026-11-23', days: 0, goalMet: false })
  })

  it('counts training days, not workouts', () => {
    const stats = consistencyStats([workout('2026-11-24', 'a'), workout('2026-11-24', 'b'), workout('2026-11-25')], TODAY, 3)
    expect(stats.thisWeek).toBe(2)
  })

  it('ignores workouts dated in the future and invalid dates', () => {
    const stats = consistencyStats([workout('2026-11-27'), workout('not-a-date'), workout('2026-11-24')], TODAY, 3)
    expect(stats.thisWeek).toBe(1)
    expect(stats.daysSinceLast).toBe(2)
  })

  it('counts consecutive weeks that hit the goal', () => {
    const stats = consistencyStats([
      workout('2026-11-09'), workout('2026-11-11'),   // 2 weeks ago: met
      workout('2026-11-16'), workout('2026-11-18'),   // last week: met
      workout('2026-11-24'),                          // this week: 1 so far
    ], TODAY, 2)
    expect(stats.currentStreak).toBe(2)
  })

  it('adds this week to the streak once the goal is hit', () => {
    const stats = consistencyStats([
      workout('2026-11-16'), workout('2026-11-18'),
      workout('2026-11-23'), workout('2026-11-25'),
    ], TODAY, 2)
    expect(stats.currentStreak).toBe(2)
  })

  it('breaks the streak on a missed week and keeps the best one', () => {
    const stats = consistencyStats([
      workout('2026-10-19'), workout('2026-10-26'), workout('2026-11-02'),  // 3 weeks in a row
      workout('2026-11-16'),                                                // after a missed week
    ], TODAY, 1)
    expect(stats.currentStreak).toBe(1)
    expect(stats.bestStreak).toBe(3)
  })

  it('averages training days per week over the window', () => {
    const stats = consistencyStats([workout('2026-11-16'), workout('2026-11-18'), workout('2026-11-24')], TODAY, 3, 4)
    expect(stats.weeks.map(week => week.start)).toEqual(['2026-11-02', '2026-11-09', '2026-11-16', '2026-11-23'])
    expect(stats.averagePerWeek).toBe(0.8)
  })

  it('reports days since the last workout', () => {
    expect(consistencyStats([workout(TODAY)], TODAY, 3).daysSinceLast).toBe(0)
    expect(consistencyStats([workout('2026-11-20')], TODAY, 3).daysSinceLast).toBe(6)
  })
})

describe('clampWeeklyGoal', () => {
  it('keeps the goal between 1 and 7 days', () => {
    expect(clampWeeklyGoal(0)).toBe(1)
    expect(clampWeeklyGoal(9)).toBe(7)
    expect(clampWeeklyGoal(4.4)).toBe(4)
    expect(clampWeeklyGoal(Number.NaN)).toBe(3)
  })
})
