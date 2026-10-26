export type Route =
  | { name: 'library' }
  | { name: 'read'; book: string; chapter: number; verse?: number }
  | { name: 'desk' }
  | { name: 'study'; book: string; chapter: number; verse: number }
  | { name: 'refs'; id: string }
  | { name: 'prophecy'; span?: string }
  | { name: 'thread'; id: string }
  | { name: 'prophecy-verse'; id: string }
  | { name: 'memorize' }
  | { name: 'canon' }
  | { name: 'trail'; id: string }
  | { name: 'places' }
  | { name: 'place'; id: string }
  | { name: 'book'; id: string }
  | { name: 'person'; id: string }
  | { name: 'journey'; id: string }
  | { name: 'word'; word: string }
  | { name: 'strong'; id: string }
  | { name: 'search'; q: string }
  | { name: 'church' }
  | { name: 'join'; code: string }
  | { name: 'king'; section?: string }
  | { name: 'about' }
  | { name: 'return'; view?: 'amill' | 'postmill' | 'premill'; station?: string }
  | { name: 'genealogy' }
  | { name: 'genealogy-line'; id: string }
  | { name: 'genealogy-person'; id: string }

function num(value: string | undefined, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export function parseHash(hash = window.location.hash): Route {
  const parts = hash.replace(/^#/, '').split('/').filter(Boolean).map((part) => decodeURIComponent(part))
  const head = parts[0]
  if (head === 'read' && parts[1]) {
    return { name: 'read', book: parts[1].toUpperCase(), chapter: num(parts[2], 1), verse: parts[3] ? num(parts[3], 1) : undefined }
  }
  if (head === 'study' && parts[1]) {
    return { name: 'study', book: parts[1].toUpperCase(), chapter: num(parts[2], 1), verse: num(parts[3], 1) }
  }
  if (head === 'study') return { name: 'desk' }
  if (head === 'refs' && parts[1]) return { name: 'refs', id: parts[1].toUpperCase() }
  if (head === 'prophecy' && parts[1] === 'thread' && parts[2]) return { name: 'thread', id: parts[2] }
  if (head === 'prophecy' && parts[1] === 'verse' && parts[2]) return { name: 'prophecy-verse', id: parts[2].toUpperCase() }
  if (head === 'prophecy' && parts[1] === 'span' && parts[2]) return { name: 'prophecy', span: parts[2].toLowerCase() }
  if (head === 'prophecy') return { name: 'prophecy' }
  if (head === 'memorize') return { name: 'memorize' }
  if (head === 'canon') return { name: 'canon' }
  if (head === 'places' && parts[1]) return { name: 'place', id: parts[1].toLowerCase() }
  if (head === 'places') return { name: 'places' }
  if (head === 'book' && parts[1]) return { name: 'book', id: parts[1].toUpperCase() }
  if (head === 'person' && parts[1]) return { name: 'person', id: parts[1].toLowerCase() }
  if (head === 'journey' && parts[1]) return { name: 'journey', id: parts[1].toLowerCase() }
  if (head === 'trail' && parts[1]) return { name: 'trail', id: parts[1] }
  if (head === 'word' && parts[1]) return { name: 'word', word: parts[1].toLowerCase() }
  if (head === 'strong' && parts[1]) return { name: 'strong', id: parts[1].toUpperCase() }
  if (head === 'search') return { name: 'search', q: parts.slice(1).join('/') }
  if (head === 'king') return parts[1] ? { name: 'king', section: parts[1].toLowerCase() } : { name: 'king' }
  if (head === 'genealogy' && parts[1] === 'line' && parts[2]) return { name: 'genealogy-line', id: parts[2].toLowerCase() }
  if (head === 'genealogy' && parts[1] === 'person' && parts[2]) return { name: 'genealogy-person', id: parts[2].toLowerCase() }
  if (head === 'genealogy') return { name: 'genealogy' }
  if (head === 'about') return { name: 'about' }
  if (head === 'return') {
    const view = parts[1]
    if (view === 'amill' || view === 'postmill' || view === 'premill') {
      return { name: 'return', view, station: parts[2] }
    }
    if (view === 'shared') return { name: 'return', station: parts[2] }
    return parts[1] ? { name: 'return', station: parts[1] } : { name: 'return' }
  }
  if (head === 'church') return { name: 'church' }
  if (head === 'join' && parts[1]) {
    const code = parts[1].toUpperCase().replace(/[^A-Z0-9]/g, '')
    if (code) return { name: 'join', code }
  }
  return { name: 'library' }
}

export function go(path: string, mode: 'push' | 'replace' = 'push'): void {
  const next = path.startsWith('#') ? path : `#${path.startsWith('/') ? path : `/${path}`}`
  if (window.location.hash === next) {
    window.dispatchEvent(new HashChangeEvent('hashchange'))
    return
  }
  if (mode === 'replace') {
    history.replaceState(null, '', next)
    window.dispatchEvent(new HashChangeEvent('hashchange'))
    return
  }
  window.location.hash = next
}
