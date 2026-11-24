
import {
  cleanup,
  fireEvent,
  render,
  screen
} from '@testing-library/react'

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest'

import { WorkoutCalendar } from './TrainingPanels'
import { todayISO } from './data'
import type { Workout } from './data'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2028-02-15T12:00:00'))
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const makeWorkout = (
  id: string,
  name: string,
  date: string
): Workout => ({
  id,
  name,
  date,
  duration: 45,
  exercises: [
    {
      id: `${id}-exercise`,
      name: 'Bench Press',
      sets: [
        {
          id: `${id}-set`,
          reps: 8,
          weight: 135
        }
      ]
    }
  ]
})

describe('WorkoutCalendar', () => {
  it('navigates months and displays a logged workout', () => {
    const today = todayISO()
    const workouts = [makeWorkout('w1', 'Push Day', today)]

    render(<WorkoutCalendar workouts={workouts} />)

    fireEvent.click(
      screen.getByRole('button', { name: 'Previous month' })
    )

    expect(screen.getByText('January 2028')).toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', { name: 'Next month' })
    )

    expect(screen.getByText('February 2028')).toBeInTheDocument()

    const day = screen.getByRole('button', {
      name: `${today}: 1 workouts`
    })

    expect(day).toHaveClass('trained')

    fireEvent.click(day)

    expect(day).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText(/Push Day · 1 exercises/))
      .toBeInTheDocument()
  })

  it('displays an empty message for dates without workouts', () => {
    render(<WorkoutCalendar workouts={[]} />)

    const day = screen.getByRole('button', {
      name: '2028-02-15: 0 workouts'
    })

    expect(day).not.toHaveClass('trained')

    fireEvent.click(day)

    expect(screen.getByText('No workouts logged on this day.'))
      .toBeInTheDocument()
  })

  it('displays multiple workouts on the same date', () => {
    const workouts = [
      makeWorkout('w1', 'Push Day', '2028-02-15'),
      makeWorkout('w2', 'Pull Day', '2028-02-15')
    ]

    render(<WorkoutCalendar workouts={workouts} />)

    fireEvent.click(
      screen.getByRole('button', {
        name: '2028-02-15: 2 workouts'
      })
    )

    expect(screen.getByText(/Push Day/)).toBeInTheDocument()
    expect(screen.getByText(/Pull Day/)).toBeInTheDocument()
  })

  it('includes February 29 during a leap year', () => {
    render(<WorkoutCalendar workouts={[]} />)

    expect(
      screen.getByRole('button', {
        name: '2028-02-29: 0 workouts'
      })
    ).toBeInTheDocument()
  })

  it('excludes February 29 during a non-leap year', () => {
    vi.setSystemTime(new Date('2027-02-15T12:00:00'))

    render(<WorkoutCalendar workouts={[]} />)

    expect(
      screen.getByRole('button', {
        name: '2027-02-28: 0 workouts'
      })
    ).toBeInTheDocument()

    expect(
      screen.queryByRole('button', {
        name: '2027-02-29: 0 workouts'
      })
    ).not.toBeInTheDocument()
  })

  it('navigates correctly across year boundaries', () => {
    vi.setSystemTime(new Date('2027-12-15T12:00:00'))

    render(<WorkoutCalendar workouts={[]} />)

    fireEvent.click(
      screen.getByRole('button', { name: 'Next month' })
    )

    expect(screen.getByText('January 2028')).toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', { name: 'Previous month' })
    )

    expect(screen.getByText('December 2027')).toBeInTheDocument()
  })

  it('clears the selected date when changing months', () => {
    render(<WorkoutCalendar workouts={[]} />)

    fireEvent.click(
      screen.getByRole('button', {
        name: '2028-02-15: 0 workouts'
      })
    )

    expect(screen.getByText('No workouts logged on this day.'))
      .toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', { name: 'Next month' })
    )

    expect(screen.queryByText('No workouts logged on this day.'))
      .not.toBeInTheDocument()
  })
})
