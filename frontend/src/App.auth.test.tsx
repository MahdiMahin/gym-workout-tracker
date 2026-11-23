import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// App with Supabase configured: a fake client stands in for the real one.
const fake = vi.hoisted(() => {
  const state = { session: null as null | { user: { id: string; email: string } } }
  const profile = { id: 'u1', display_name: 'Dom', username: 'dom_lifts', bio: 'PPL', experience_level: 'intermediate' }
  const client = {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: state.session } })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      signOut: vi.fn(async () => ({ error: null })),
    },
    from: vi.fn(() => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: profile, error: null }) }) }) })),
    rpc: vi.fn(),
  }
  return { state, client }
})
vi.mock('./lib/supabase', () => ({ supabase: fake.client, isSupabaseConfigured: true }))

import App from './App'

describe('app with Supabase auth', () => {
  beforeEach(() => { localStorage.clear(); fake.state.session = null })
  afterEach(() => cleanup())

  it('shows the log in screen when nobody is signed in', async () => {
    render(<App/>)
    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument()
    expect(screen.queryByText('Your fitness at a glance')).not.toBeInTheDocument()
  })

  it('shows the tracker and the real profile when signed in', async () => {
    fake.state.session = { user: { id: 'u1', email: 'dom@test.com' } }
    render(<App/>)
    expect(await screen.findByText('Your fitness at a glance')).toBeInTheDocument()
    expect(await screen.findByText('@dom_lifts')).toBeInTheDocument()

    const navigation = screen.getByRole('navigation', { name: 'Main navigation' })
    fireEvent.click(within(navigation).getByRole('button', { name: 'Profile' }))
    expect(screen.getByRole('heading', { name: 'Dom' })).toBeInTheDocument()
    expect(screen.getByText('@dom_lifts · dom@test.com')).toBeInTheDocument()

    fireEvent.click(screen.getAllByRole('button', { name: /Log out/ })[0])
    expect(fake.client.auth.signOut).toHaveBeenCalled()
  })
})
