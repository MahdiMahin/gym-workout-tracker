import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session, SupabaseClient } from '@supabase/supabase-js'
import { AuthContext } from './auth-context'
import type { AuthState, Profile } from './auth-context'

// Keeps track of the signed-in user and their profiles row.
export function AuthProvider({ client, children }: { client: SupabaseClient; children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<Profile | null>(null)

  useEffect(() => {
    let active = true
    client.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      setLoading(false)
    })
    // Only set state here: Supabase warns against calling other Supabase
    // methods inside this callback. The profile is loaded by the effect below.
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      setLoading(false)
    })
    return () => { active = false; subscription.unsubscribe() }
  }, [client])

  const userId = session?.user.id
  useEffect(() => {
    if (!userId) { setProfile(null); return }
    let active = true
    client.from('profiles')
      .select('id, display_name, username, bio, experience_level')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data }) => { if (active) setProfile((data as Profile | null) ?? null) })
    return () => { active = false }
  }, [client, userId])

  const value = useMemo<AuthState>(() => ({
    client, session, profile, loading,
    signOut: async () => { await client.auth.signOut() },
  }), [client, session, profile, loading])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
