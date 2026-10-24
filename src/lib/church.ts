import { api, loadMe, type Role } from './session'

export type SermonStatus = 'draft' | 'live' | 'ended'

export type SermonStep = {
  id: string
  position: number
  heading: string
  passage: string
  note: string
}

export type Sermon = {
  id: string
  title: string
  status: SermonStatus
  currentStep: number
  sermonDate: string
  authorName: string
  passage: string
  message: string
  steps: SermonStep[]
}

export type SharedNote = {
  id: string
  verseId: string
  body: string
  authorId: string
  authorName: string
}

export type StepDraft = {
  heading: string
  passage: string
  note: string
}

export type SermonDraft = {
  id: string
  title: string
  steps: StepDraft[]
}

export async function registerChurch(input: { name: string; city: string; timezone: string }): Promise<void> {
  await api('/api/church', { method: 'POST', body: JSON.stringify(input) })
  await loadMe()
}

export async function joinChurch(code: string): Promise<void> {
  await api('/api/church/join', { method: 'POST', body: JSON.stringify({ code }) })
  await loadMe()
}

export async function regenerateInvite(): Promise<void> {
  await api('/api/church/invite', { method: 'POST', body: '{}' })
  await loadMe()
}

export async function setMemberRole(userId: string, role: Role): Promise<void> {
  await api(`/api/church/members/${encodeURIComponent(userId)}/role`, {
    method: 'POST',
    body: JSON.stringify({ role }),
  })
  await loadMe()
}

export async function leaveChurch(): Promise<void> {
  await api('/api/church/membership', { method: 'DELETE' })
  await loadMe()
}

export async function loadSermons(): Promise<{ today: string; sermons: Sermon[] }> {
  return api('/api/sermons')
}

export async function loadLive(): Promise<Sermon | null> {
  const data = await api<{ sermon: Sermon | null }>('/api/sermons/live')
  return data.sermon
}

export async function saveSermon(draft: SermonDraft): Promise<void> {
  const body = JSON.stringify({ title: draft.title, steps: draft.steps })
  if (draft.id) {
    await api(`/api/sermons/${encodeURIComponent(draft.id)}`, { method: 'PATCH', body })
    return
  }
  await api('/api/sermons', { method: 'POST', body })
}

export async function removeSermon(id: string): Promise<void> {
  await api(`/api/sermons/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export async function controlSermon(id: string, body: { action: 'start' | 'end' } | { action: 'step'; step: number }): Promise<void> {
  await api(`/api/sermons/${encodeURIComponent(id)}/live`, { method: 'POST', body: JSON.stringify(body) })
}

export async function loadSharedNotes(verseId?: string): Promise<SharedNote[]> {
  const path = verseId ? `/api/notes?verse=${encodeURIComponent(verseId)}` : '/api/notes'
  const data = await api<{ notes: SharedNote[] }>(path)
  return data.notes
}

export async function shareNote(verseId: string, body: string): Promise<void> {
  await api('/api/notes', { method: 'PUT', body: JSON.stringify({ verseId, body }) })
}

export async function unshareNote(verseId: string): Promise<void> {
  await api(`/api/notes?verse=${encodeURIComponent(verseId)}`, { method: 'DELETE' })
}
