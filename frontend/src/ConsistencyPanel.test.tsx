import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ConsistencyPanel } from './ConsistencyPanel'
import type { Workout } from './data'

const workout = (date: string): Workout => ({ id: date, name: 'Session', date, duration: 45, exercises: [] })
const TODAY = '2026-11-26'   // Thursday; the week started Monday 2026-11-23
const workouts = [workout('2026-11-16'), workout('2026-11-18'), workout('2026-11-20'), workout('2026-11-24')]

const statValue = (label: string) => screen.getByText(label).nextElementSibling

describe('ConsistencyPanel', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => cleanup())

  it('shows this week, the streak and the last workout', () => {
    render(<ConsistencyPanel workouts={workouts} today={TODAY}/>)
    expect(statValue('This week')).toHaveTextContent('1 / 3')
    expect(statValue('Week streak')).toHaveTextContent('1')
    expect(screen.getByText(/Last workout: 2 days ago/)).toBeInTheDocument()
  })

  it('draws one bar per week for the last 8 weeks', () => {
    render(<ConsistencyPanel workouts={workouts} today={TODAY}/>)
    const strip = screen.getByRole('list', { name: /last 8 weeks/ })
    expect(within(strip).getAllByRole('listitem')).toHaveLength(8)
    expect(within(strip).getByRole('listitem', { name: 'Week of Nov 16: 3 training days, goal met' })).toBeInTheDocument()
  })

  it('changes the weekly goal and remembers it', () => {
    render(<ConsistencyPanel workouts={workouts} today={TODAY}/>)
    fireEvent.click(screen.getByRole('button', { name: 'Lower weekly goal' }))
    fireEvent.click(screen.getByRole('button', { name: 'Lower weekly goal' }))
    expect(statValue('This week')).toHaveTextContent('1 / 1')
    expect(statValue('Week streak')).toHaveTextContent('2')
    expect(screen.getByRole('button', { name: 'Lower weekly goal' })).toBeDisabled()

    cleanup()
    render(<ConsistencyPanel workouts={workouts} today={TODAY}/>)
    expect(statValue('This week')).toHaveTextContent('1 / 1')
  })

  it('handles an empty history', () => {
    render(<ConsistencyPanel workouts={[]} today={TODAY}/>)
    expect(statValue('Week streak')).toHaveTextContent('0')
    expect(screen.getByText('No workouts logged yet')).toBeInTheDocument()
  })
})
