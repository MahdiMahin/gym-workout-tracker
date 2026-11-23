import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { WorkoutCalendar } from './TrainingPanels'
import type { Workout } from './data'

afterEach(() => cleanup())
const workouts: Workout[] = [{ id: 'w1', name: 'Push Day', date: '2026-11-05', duration: 45, exercises: [{ id: 'e1', name: 'Bench Press', sets: [{ id: 's1', reps: 8, weight: 135 }] }] }]

describe('WorkoutCalendar', () => {
  it('highlights a logged workout and shows details when selected', () => {
    render(<WorkoutCalendar workouts={workouts} />)
    fireEvent.click(screen.getByRole('button', { name: 'Previous month' }))
    expect(screen.getByText('October 2026')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }))
    expect(screen.getByText('November 2026')).toBeInTheDocument()
    const day = screen.getByRole('button', { name: '2026-11-05: 1 workouts' })
    expect(day).toHaveClass('trained')
    fireEvent.click(day)
    expect(day).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText(/Push Day · 1 exercises/)).toBeInTheDocument()
  })
})
