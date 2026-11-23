import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { WorkoutCalendar } from './TrainingPanels'
import { todayISO } from './data'
import type { Workout } from './data'

afterEach(() => cleanup())
const today = todayISO()
const workouts: Workout[] = [{ id: 'w1', name: 'Push Day', date: today, duration: 45, exercises: [{ id: 'e1', name: 'Bench Press', sets: [{ id: 's1', reps: 8, weight: 135 }] }] }]

describe('WorkoutCalendar', () => {
  it('navigates months and highlights and displays a logged workout', () => {
    render(<WorkoutCalendar workouts={workouts} />)
    const current = new Date(today + 'T12:00:00')
    const monthLabel = current.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    fireEvent.click(screen.getByRole('button', { name: 'Previous month' }))
    expect(screen.queryByText(monthLabel)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }))
    expect(screen.getByText(monthLabel)).toBeInTheDocument()
    const day = screen.getByRole('button', { name: today + ': 1 workouts' })
    expect(day).toHaveClass('trained')
    fireEvent.click(day)
    expect(day).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText(/Push Day · 1 exercises/)).toBeInTheDocument()
  })
})
