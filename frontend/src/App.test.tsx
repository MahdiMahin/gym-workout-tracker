// Frontend workout validation tests

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import App from './App'

describe('frontend demo', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => cleanup())

  it('shows the dashboard and workout stats', () => {
    render(<App />)
    expect(screen.getByText('Your fitness at a glance')).toBeInTheDocument()
    expect(screen.getByText('Total Workouts')).toBeInTheDocument()
    expect(screen.getByText('Recent workouts')).toBeInTheDocument()
  })

  it('can navigate to workout history', () => {
    render(<App />)
    const navigation = screen.getByRole('navigation', { name: 'Main navigation' })
    fireEvent.click(within(navigation).getByRole('button', { name: 'History' }))
    expect(screen.getByText('Workout history')).toBeInTheDocument()
  })

  it('opens the workout logging dialog', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /Log workout/i }))
    expect(screen.getByRole('dialog', { name: 'Log a workout' })).toBeInTheDocument()
  })

  it('rejects zero reps and displays a helpful error', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /Log workout/i }))
    const dialog = screen.getByRole('dialog', { name: 'Log a workout' })
    fireEvent.change(within(dialog).getByRole('spinbutton', { name: 'Reps' }), { target: { value: '0' } })
    fireEvent.click(within(dialog).getByRole('button', { name: /Save workout/i }))
    expect(within(dialog).getByRole('alert')).toHaveTextContent('positive whole-number reps')
    expect(screen.getByRole('dialog', { name: 'Log a workout' })).toBeInTheDocument()
  })

  it('rejects negative weights', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /Log workout/i }))
    const dialog = screen.getByRole('dialog', { name: 'Log a workout' })
    fireEvent.change(within(dialog).getByRole('spinbutton', { name: 'Weight' }), { target: { value: '-20' } })
    fireEvent.click(within(dialog).getByRole('button', { name: /Save workout/i }))
    expect(within(dialog).getByRole('alert')).toHaveTextContent('weight of 0 lb or more')
  })

  it('allows zero weight for a bodyweight exercise', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /Log workout/i }))
    const dialog = screen.getByRole('dialog', { name: 'Log a workout' })
    fireEvent.change(within(dialog).getByRole('spinbutton', { name: 'Weight' }), { target: { value: '0' } })
    fireEvent.click(within(dialog).getByRole('button', { name: /Save workout/i }))
    expect(screen.queryByRole('dialog', { name: 'Log a workout' })).not.toBeInTheDocument()
  })

})
