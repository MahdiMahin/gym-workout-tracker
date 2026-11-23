import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { AuthScreen } from './AuthScreen'

function fakeClient({ available = true, session = { access_token: 't' } as unknown, loginError = null as null | { message: string } } = {}) {
  const client = {
    rpc: vi.fn().mockResolvedValue({ data: available, error: null }),
    auth: {
      signUp: vi.fn().mockResolvedValue({ data: { session, user: { id: 'u1' } }, error: null }),
      signInWithPassword: vi.fn().mockResolvedValue({ data: {}, error: loginError }),
    },
  }
  return { client, asSupabase: client as unknown as SupabaseClient }
}

const type = (label: RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } })

function fillSignUp(username: string) {
  fireEvent.click(screen.getByRole('tab', { name: 'Sign up' }))
  type(/^Username/, username)
  type(/^Display name/, 'Dom')
  type(/^Email/, 'dom@test.com')
  type(/^Password/, 'password123')
}

describe('AuthScreen', () => {
  afterEach(() => cleanup())

  it('signs up with a lowercase username and display name in the metadata', async () => {
    const { client, asSupabase } = fakeClient()
    render(<AuthScreen client={asSupabase}/>)
    fillSignUp('Dom_Lifts')
    fireEvent.click(screen.getByRole('button', { name: /Create account/ }))

    await waitFor(() => expect(client.auth.signUp).toHaveBeenCalledOnce())
    expect(client.rpc).toHaveBeenCalledWith('is_username_available', { p_username: 'dom_lifts' })
    expect(client.auth.signUp).toHaveBeenCalledWith({
      email: 'dom@test.com',
      password: 'password123',
      options: { data: { username: 'dom_lifts', display_name: 'Dom' }, emailRedirectTo: window.location.origin },
    })
  })

  it('rejects an invalid username without calling Supabase', async () => {
    const { client, asSupabase } = fakeClient()
    render(<AuthScreen client={asSupabase}/>)
    fillSignUp('a!')
    fireEvent.click(screen.getByRole('button', { name: /Create account/ }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Username must be 3–20 characters.')
    expect(client.rpc).not.toHaveBeenCalled()
    expect(client.auth.signUp).not.toHaveBeenCalled()
  })

  it('stops when the username is taken', async () => {
    const { client, asSupabase } = fakeClient({ available: false })
    render(<AuthScreen client={asSupabase}/>)
    fillSignUp('taken_name')
    fireEvent.click(screen.getByRole('button', { name: /Create account/ }))

    expect(await screen.findByRole('alert')).toHaveTextContent('That username is taken')
    expect(client.auth.signUp).not.toHaveBeenCalled()
  })

  it('asks the user to confirm their email when sign-up returns no session', async () => {
    const { asSupabase } = fakeClient({ session: null })
    render(<AuthScreen client={asSupabase}/>)
    fillSignUp('dom_lifts')
    fireEvent.click(screen.getByRole('button', { name: /Create account/ }))

    expect(await screen.findByRole('status')).toHaveTextContent('Check your email')
    expect(screen.getByRole('tab', { name: 'Log in' })).toHaveAttribute('aria-selected', 'true')
  })

  it('logs in with email and password', async () => {
    const { client, asSupabase } = fakeClient()
    render(<AuthScreen client={asSupabase}/>)
    type(/^Email/, ' dom@test.com ')
    type(/^Password/, 'password123')
    fireEvent.click(screen.getByRole('button', { name: /Log in/ }))

    await waitFor(() => expect(client.auth.signInWithPassword).toHaveBeenCalledWith({ email: 'dom@test.com', password: 'password123' }))
  })

  it('shows a friendly message for a wrong password', async () => {
    const { asSupabase } = fakeClient({ loginError: { message: 'Invalid login credentials' } })
    render(<AuthScreen client={asSupabase}/>)
    type(/^Email/, 'dom@test.com')
    type(/^Password/, 'wrong-pass')
    fireEvent.click(screen.getByRole('button', { name: /Log in/ }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Wrong email or password.')
  })
})
