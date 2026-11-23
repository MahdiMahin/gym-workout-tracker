// Same rule as the profiles.username check in the database
// (supabase/migrations/20261109200517_user_auth_profile.sql).
export const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/

export const normalizeUsername = (value: string) => value.trim().toLowerCase()

export function usernameProblem(value: string): string | null {
  const username = normalizeUsername(value)
  if (username.length < 3 || username.length > 20) return 'Username must be 3–20 characters.'
  if (!USERNAME_PATTERN.test(username)) return 'Use only letters, numbers and _.'
  return null
}

export function initials(name: string): string {
  const parts = name.trim().split(/[\s_]+/).filter(Boolean)
  if (parts.length === 0) return '?'
  return (parts.length === 1 ? parts[0].slice(0, 2) : parts[0][0] + parts[1][0]).toUpperCase()
}
