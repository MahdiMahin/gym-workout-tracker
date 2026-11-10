import { useState } from 'react'
import type { FormEvent } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { Dumbbell, LogIn, UserPlus } from 'lucide-react'
import { normalizeUsername, usernameProblem } from './lib/username'

type Mode = 'login' | 'signup'
type UsernameStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid'

const friendly = (message: string) => {
  if (/invalid login credentials/i.test(message)) return 'Wrong email or password.'
  if (/already registered/i.test(message)) return 'An account with this email already exists. Log in instead.'
  if (/email not confirmed/i.test(message)) return 'Confirm your email first, then log in.'
  return message
}

export function AuthScreen({ client }: { client: SupabaseClient }) {
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>('idle')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  const switchMode = (next: Mode) => { setMode(next); setError(''); setNotice('') }

  // Returns true when the username is valid and nobody has it yet.
  const checkUsername = async (): Promise<boolean> => {
    if (usernameProblem(username)) { setUsernameStatus('invalid'); return false }
    setUsernameStatus('checking')
    const { data, error: rpcError } = await client.rpc('is_username_available', { p_username: normalizeUsername(username) })
    if (rpcError) { setUsernameStatus('idle'); throw rpcError }
    setUsernameStatus(data ? 'available' : 'taken')
    return Boolean(data)
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError(''); setNotice('')
    setBusy(true)
    try {
      if (mode === 'login') {
        const { error: loginError } = await client.auth.signInWithPassword({ email: email.trim(), password })
        if (loginError) setError(friendly(loginError.message))
        return
      }

      const problem = usernameProblem(username)
      if (problem) { setUsernameStatus('invalid'); setError(problem); return }
      if (password.length < 6) { setError('Password must be at least 6 characters.'); return }
      if (!(await checkUsername())) { setError('That username is taken. Pick another one.'); return }

      const name = normalizeUsername(username)
      const { data, error: signUpError } = await client.auth.signUp({
        email: email.trim(),
        password,
        options: {
          // Read by the handle_new_user trigger to fill in the profiles row
          data: { username: name, display_name: displayName.trim() || name },
          emailRedirectTo: window.location.origin,
        },
      })
      if (signUpError) { setError(friendly(signUpError.message)); return }
      // With "Confirm email" off, Supabase signs the user in right away and
      // AuthProvider picks up the session. Otherwise they confirm first.
      if (!data.session) {
        setNotice('Account created. Check your email for the confirmation link, then log in.')
        setMode('login')
        setPassword('')
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Something went wrong. Try again.')
    } finally {
      setBusy(false)
    }
  }

  const usernameHint: Record<UsernameStatus, string> = {
    idle: '3–20 characters: letters, numbers and _',
    checking: 'Checking…',
    available: 'Username is available',
    taken: 'Username is taken',
    invalid: usernameProblem(username) ?? '',
  }

  return <div className="auth-shell">
    <div className="auth-card">
      <div className="brand auth-brand"><div className="brand-mark"><Dumbbell size={21} strokeWidth={2.8}/></div><div><strong>REP<span>LOG</span></strong><small>GYM WORKOUT TRACKER</small></div></div>
      <div className="auth-tabs" role="tablist" aria-label="Account">
        <button type="button" role="tab" aria-selected={mode === 'login'} className={mode === 'login' ? 'auth-tab selected' : 'auth-tab'} onClick={() => switchMode('login')}>Log in</button>
        <button type="button" role="tab" aria-selected={mode === 'signup'} className={mode === 'signup' ? 'auth-tab selected' : 'auth-tab'} onClick={() => switchMode('signup')}>Sign up</button>
      </div>
      <h1 className="auth-title">{mode === 'login' ? 'Welcome back' : 'Create your account'}</h1>
      <form onSubmit={submit} noValidate>
        {mode === 'signup' && <>
          <label className="field">Username
            <input name="username" autoComplete="username" required value={username} maxLength={20}
              onChange={e => { setUsername(e.target.value); setUsernameStatus('idle') }}
              onBlur={() => { if (username) checkUsername().catch(() => undefined) }}
              aria-describedby="username-hint"/>
            <span id="username-hint" className={`auth-hint ${usernameStatus}`}>{usernameHint[usernameStatus]}</span>
          </label>
          <label className="field">Display name (optional)
            <input name="display_name" autoComplete="name" value={displayName} maxLength={60} onChange={e => setDisplayName(e.target.value)}/>
          </label>
        </>}
        <label className="field">Email
          <input name="email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)}/>
        </label>
        <label className="field">Password
          <input name="password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required minLength={6} value={password} onChange={e => setPassword(e.target.value)}/>
        </label>
        {error && <p className="auth-message error" role="alert">{error}</p>}
        {notice && <p className="auth-message notice" role="status">{notice}</p>}
        <button className="btn btn-primary auth-submit" type="submit" disabled={busy}>
          {mode === 'login' ? <><LogIn size={17}/> Log in</> : <><UserPlus size={17}/> Create account</>}
        </button>
      </form>
    </div>
  </div>
}
