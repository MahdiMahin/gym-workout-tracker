import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RestTimer } from './RestTimer'

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('RestTimer', () => {
  const time = () => screen.getByRole('timer')
  const click = (name: string) => fireEvent.click(screen.getByRole('button', { name, exact: true }))
  const advance = (ms: number) => { act(() => { vi.advanceTimersByTime(ms) }) }

  it('selects a rest duration', () => {
    render(<RestTimer />)
    expect(time()).toHaveTextContent('1:30')
    click('120s')
    expect(time()).toHaveTextContent('2:00')
  })

  it('counts down, pauses and resumes', () => {
    render(<RestTimer />)
    click('Start')
    advance(1000)
    expect(time()).toHaveTextContent('1:29')
    click('Pause')
    advance(2000)
    expect(time()).toHaveTextContent('1:29')
    click('Resume')
    advance(1000)
    expect(time()).toHaveTextContent('1:28')
  })

  it('resets and stops the countdown', () => {
    render(<RestTimer />)
    click('60s')
    click('Start')
    advance(3000)
    click('Reset')
    advance(2000)
    expect(time()).toHaveTextContent('1:00')
  })

  it('announces completion and never counts below zero', () => {
    render(<RestTimer />)
    click('60s')
    click('Start')
    advance(60000)
    expect(time()).toHaveTextContent('0:00')
    expect(screen.getByRole('status')).toHaveTextContent('Rest complete!')
    advance(2000)
    expect(time()).toHaveTextContent('0:00')
    click('Restart')
    expect(time()).toHaveTextContent('1:00')
  })
})
