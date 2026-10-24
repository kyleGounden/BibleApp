import { useSyncExternalStore } from 'react'

export type Role = 'pastor' | 'member'

export type SessionUser = {
  id: string
  email: string
  name: string
  picture: string | null
  hasPassword: boolean
}

export type SessionChurch = {
  id: string
  name: string
  city: string
  timezone: string
  inviteCode: string | null
}

export type ChurchMember = {
  id: string
  name: string
  email: string
  role: Role
}

type SessionState = {
  status: 'loading' | 'signed-out' | 'ready'
  user: SessionUser | null
  church: SessionChurch | null
  role: Role | null
  members: ChurchMember[]
  googleClientId: string
  notice: string
}

type Profile = {
  user: SessionUser
  church: SessionChurch | null
  role: Role | null
  members?: ChurchMember[]
  accessToken?: string
  refreshToken?: string
}

const REFRESH_KEY = 'scripture.refresh'

const initial: SessionState = {
  status: 'loading',
  user: null,
  church: null,
  role: null,
  members: [],
  googleClientId: '',
  notice: '',
}

let state: SessionState = initial
let accessToken = ''
const listeners = new Set<() => void>()

function emit(): void {
  listeners.forEach((listener) => listener())
}

function patch(next: Partial<SessionState>): void {
  state = { ...state, ...next }
  emit()
}

export function getSession(): SessionState {
  return state
}

export function subscribeSession(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useSession(): SessionState {
  return useSyncExternalStore(subscribeSession, getSession, getSession)
}

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return error.message
  if (error instanceof TypeError) return 'The church service is offline.'
  return fallback
}

function applyProfile(profile: Profile): void {
  patch({
    status: 'ready',
    user: profile.user ? { ...profile.user, hasPassword: Boolean(profile.user.hasPassword) } : null,
    church: profile.church,
    role: profile.role,
    members: profile.members ?? [],
    notice: '',
  })
}

async function readError(response: Response): Promise<string> {
  const data = await response.json().catch(() => null) as { error?: unknown } | null
  return typeof data?.error === 'string' && data.error ? data.error : 'The church service could not complete that.'
}

async function refresh(token: string): Promise<'ok' | 'invalid' | 'offline'> {
  try {
    const response = await fetch('/api/auth/refresh', {
      method: 'POST',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: token }),
    })
    if (response.status === 401 || response.status === 400) return 'invalid'
    if (!response.ok) return 'offline'
    const data = await response.json() as Profile
    if (!data.accessToken || !data.refreshToken || !data.user) return 'invalid'
    accessToken = data.accessToken
    localStorage.setItem(REFRESH_KEY, data.refreshToken)
    applyProfile(data)
    return 'ok'
  } catch {
    return 'offline'
  }
}

export async function api<T>(path: string, init?: RequestInit, retry = true): Promise<T> {
  const headers = new Headers(init?.headers)
  if (init?.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`)
  const response = await fetch(path, { ...init, headers, cache: 'no-store' })
  if (response.status === 401 && retry) {
    const stored = localStorage.getItem(REFRESH_KEY) ?? ''
    if (stored) {
      const renewed = await refresh(stored)
      if (renewed === 'ok') return api<T>(path, init, false)
      if (renewed === 'invalid') {
        accessToken = ''
        localStorage.removeItem(REFRESH_KEY)
        patch({ status: 'signed-out', user: null, church: null, role: null, members: [] })
      }
    }
  }
  if (!response.ok) throw new ApiError(response.status, await readError(response))
  return response.json() as Promise<T>
}

export async function loadMe(): Promise<void> {
  applyProfile(await api<Profile>('/api/me'))
}

async function acceptSession(response: Response): Promise<void> {
  if (!response.ok) throw new ApiError(response.status, await readError(response))
  const data = await response.json() as Profile
  if (!data.accessToken || !data.refreshToken || !data.user) throw new ApiError(500, 'Sign-in did not finish.')
  accessToken = data.accessToken
  localStorage.setItem(REFRESH_KEY, data.refreshToken)
  applyProfile(data)
}

export async function signInWithGoogle(credential: string): Promise<void> {
  const response = await fetch('/api/auth/google', {
    method: 'POST',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ credential }),
  })
  await acceptSession(response)
}

export async function createAccount(name: string, email: string, password: string): Promise<void> {
  const response = await fetch('/api/auth/register', {
    method: 'POST',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password }),
  })
  await acceptSession(response)
}

export async function signInWithEmail(email: string, password: string): Promise<void> {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  await acceptSession(response)
}

export async function changePassword(current: string, next: string): Promise<void> {
  await api('/api/auth/password', {
    method: 'POST',
    body: JSON.stringify({ current, next }),
  })
}

export async function signOut(): Promise<void> {
  const token = localStorage.getItem(REFRESH_KEY) ?? ''
  accessToken = ''
  localStorage.removeItem(REFRESH_KEY)
  patch({ status: 'signed-out', user: null, church: null, role: null, members: [] })
  if (!token) return
  await fetch('/api/auth/logout', {
    method: 'POST',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: token }),
  }).catch(() => undefined)
}

let booted: Promise<void> | null = null

async function loadConfig(): Promise<{ clientId: string; offline: boolean }> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      const response = await fetch('/api/config', { cache: 'no-store' })
      if (response.ok) {
        const data = await response.json() as { googleClientId?: unknown }
        return { clientId: typeof data.googleClientId === 'string' ? data.googleClientId : '', offline: false }
      }
    } catch {
      // The API process may still be opening.
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  return { clientId: '', offline: true }
}

async function runBoot(): Promise<void> {
  const config = await loadConfig()
  patch({
    googleClientId: config.clientId,
    notice: config.offline ? 'Church sign-in is offline. Scripture on this device still opens.' : '',
  })
  const stored = localStorage.getItem(REFRESH_KEY) ?? ''
  if (!stored) {
    patch({ status: 'signed-out' })
    return
  }
  const renewed = await refresh(stored)
  if (renewed === 'invalid') {
    localStorage.removeItem(REFRESH_KEY)
    accessToken = ''
    patch({ status: 'signed-out' })
    return
  }
  if (renewed === 'offline') {
    patch({ status: 'signed-out', notice: 'Church sign-in is offline. Scripture on this device still opens.' })
  }
}

export function bootSession(): Promise<void> {
  if (!booted) booted = runBoot()
  return booted
}
