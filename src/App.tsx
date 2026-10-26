import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { formatRef, verseId } from './lib/canon'
import { parseHash, go, type Route } from './lib/router'
import { followLive, setLiveWatch, useFollow } from './lib/follow'
import { bootSession, useSession } from './lib/session'
import { getVoice, stopVoice, toggleVoice } from './lib/speech'
import { dueCards } from './lib/srs'
import { THEME_COLOR, useAppState, setScale, setTheme, setTranslation, type Theme } from './lib/storage'
import type { Translation } from './lib/bible'
import { EsvKeyBar, VoiceDock, WordSheet, type WordAsk } from './ui'
import { Library } from './views/Library'
import { Reader } from './views/Reader'
import { Study } from './views/Study'
import { StudyDesk } from './views/StudyDesk'
import { References } from './views/References'
import { ProphecyPage } from './views/Prophecy'
import { Memorize } from './views/Memorize'
import { CanonPage } from './views/CanonPage'
import { TrailPage } from './views/TrailPage'
import { WordPage } from './views/WordPage'
import { SearchPage } from './views/SearchPage'
import { PlacesPage } from './views/PlacesPage'
import { BookPage } from './views/BookPage'
import { PersonPage } from './views/PersonPage'
import { Church } from './views/Church'
import { FollowBar } from './views/FollowBar'
import { King } from './views/King'
import { About } from './views/About'
import { Return } from './views/Return'

const Genealogy = lazy(() => import('./views/Genealogy').then((mod) => ({ default: mod.Genealogy })))

const NEXT: Record<Theme, Theme> = { day: 'dusk', dusk: 'night', night: 'day' }

type Dest = {
  id: string
  label: string
  href: string
  icon: string
  hint: string
}

const GROUPS: { label: string; ids: string[] }[] = [
  { label: 'Read', ids: ['library'] },
  { label: 'Understand', ids: ['study', 'refs'] },
  { label: 'The story', ids: ['king', 'prophecy', 'genealogy', 'return', 'about'] },
  { label: 'Keep', ids: ['memorize'] },
  { label: 'Explore', ids: ['canon'] },
]

const PRIMARY = ['library', 'study', 'king', 'prophecy', 'memorize']

function tabOn(route: Route, tab: string): boolean {
  if (tab === 'library') return route.name === 'library' || route.name === 'read' || route.name === 'search' || route.name === 'book' || route.name === 'person'
  if (tab === 'study') return route.name === 'study' || route.name === 'desk' || route.name === 'word' || route.name === 'strong'
  if (tab === 'refs') return route.name === 'refs'
  if (tab === 'prophecy') return route.name === 'prophecy' || route.name === 'thread' || route.name === 'prophecy-verse'
  if (tab === 'memorize') return route.name === 'memorize'
  if (tab === 'king') return route.name === 'king'
  if (tab === 'about') return route.name === 'about'
  if (tab === 'return') return route.name === 'return'
  if (tab === 'church') return route.name === 'church' || route.name === 'join'
  if (tab === 'canon') return route.name === 'canon' || route.name === 'trail' || route.name === 'places' || route.name === 'place' || route.name === 'journey'
  if (tab === 'genealogy') return route.name === 'genealogy' || route.name === 'genealogy-line' || route.name === 'genealogy-person'
  return false
}

function ThemeMark({ theme }: { theme: Theme }) {
  if (theme === 'night') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M16 14.5A6.5 6.5 0 0 1 9.5 6 6.5 6.5 0 1 0 16 14.5z" />
      </svg>
    )
  }
  if (theme === 'dusk') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="4.5" />
        <path d="M12 3v2.2M12 18.8V21M4.8 6.2l1.6 1.6M17.6 16.2l1.6 1.6M3 12h2.2M18.8 12H21" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2.2M12 19.3V21.5M2.5 12h2.2M19.3 12h2.2M5.1 5.1l1.6 1.6M17.3 17.3l1.6 1.6M18.9 5.1l-1.6 1.6M6.7 17.3l-1.6 1.6" />
    </svg>
  )
}

function Mark({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d={d} />
    </svg>
  )
}

function ReadingTools({ translation, scale, theme }: { translation: Translation; scale: number; theme: Theme }) {
  return (
    <>
      <div className="tool" aria-label="Text">
        <span className="tool-label">Text</span>
        <div className="seg" role="group" aria-label="Translation">
          <button type="button" className={translation === 'kjv' ? 'on' : ''} onClick={() => setTranslation('kjv')}>KJV</button>
          <button type="button" className={translation === 'web' ? 'on' : ''} onClick={() => setTranslation('web')}>WEB</button>
          <button type="button" className={translation === 'esv' ? 'on' : ''} onClick={() => setTranslation('esv')}>ESV</button>
          <button type="button" className={translation === 'niv' ? 'on' : ''} onClick={() => setTranslation('niv')}>NIV</button>
        </div>
      </div>
      <div className="tool" aria-label="Type">
        <span className="tool-label">Type</span>
        <button type="button" className="icon-btn" onClick={() => setScale(scale - 0.1)} aria-label="Smaller type">A−</button>
        <button type="button" className="icon-btn" onClick={() => setScale(scale + 0.1)} aria-label="Larger type">A+</button>
        <button type="button" className="icon-btn theme-btn" onClick={() => setTheme(NEXT[theme])} aria-label={`Theme is ${theme}. Switch theme.`}>
          <ThemeMark theme={theme} />
        </button>
      </div>
    </>
  )
}

function initialOf(name: string): string {
  const letter = name.trim().charAt(0)
  return letter ? letter.toUpperCase() : '?'
}

export function App() {
  const state = useAppState()
  const session = useSession()
  const follow = useFollow()
  const [route, setRoute] = useState<Route>(() => parseHash())
  const [sheet, setSheet] = useState<WordAsk | null>(null)
  const [query, setQuery] = useState('')
  const [scrolled, setScrolled] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [readingOpen, setReadingOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const topRef = useRef<HTMLElement>(null)
  const bottomRef = useRef<HTMLElement>(null)
  const searchRef = useRef<HTMLFormElement>(null)
  const readingRef = useRef<HTMLDivElement>(null)
  const moreRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const onHash = () => setRoute(parseHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  useEffect(() => {
    void bootSession()
  }, [])

  useEffect(() => {
    const fast = route.name === 'read' && follow.following?.mode === 'live'
    setLiveWatch(session.status === 'ready' && Boolean(session.church), fast)
  }, [session.status, session.church, route.name, follow.following?.mode])

  useEffect(() => {
    document.documentElement.style.setProperty('--scale', String(state.scale))
  }, [state.scale])

  useEffect(() => {
    const native = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
    if (!native?.isNativePlatform?.()) return
    const dark = state.theme !== 'day'
    void import('@capacitor/status-bar')
      .then(({ StatusBar, Style }) => {
        void StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light })
        void StatusBar.setBackgroundColor({ color: THEME_COLOR[state.theme] }).catch(() => undefined)
      })
      .catch(() => undefined)
  }, [state.theme])

  useEffect(() => {
    const snap = getVoice()
    if (snap.status !== 'idle' && snap.translation && snap.translation !== state.translation) stopVoice()
  }, [state.translation])

  useEffect(() => {
    const header = topRef.current
    if (!header) return
    const apply = () => {
      document.documentElement.style.setProperty('--top-h', `${Math.ceil(header.getBoundingClientRect().height)}px`)
    }
    apply()
    const observer = new ResizeObserver(apply)
    observer.observe(header)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const node = bottomRef.current
    if (!node) return
    const apply = () => {
      const box = node.getBoundingClientRect()
      document.documentElement.style.setProperty('--nav-h', box.height > 0 ? `${Math.ceil(box.height)}px` : '0px')
    }
    apply()
    const observer = new ResizeObserver(apply)
    observer.observe(node)
    const media = window.matchMedia('(min-width: 960px)')
    media.addEventListener('change', apply)
    return () => {
      observer.disconnect()
      media.removeEventListener('change', apply)
    }
  }, [])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    setMoreOpen(false)
    setReadingOpen(false)
    setSearchOpen(false)
  }, [route])

  useEffect(() => {
    if (!moreOpen) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    moreRef.current?.querySelector<HTMLButtonElement>('.more-row')?.focus()
    return () => {
      document.body.style.overflow = previous
    }
  }, [moreOpen])

  useEffect(() => {
    if (!readingOpen && !searchOpen) return
    const onPointer = (event: PointerEvent) => {
      const node = event.target
      if (!(node instanceof Node)) return
      if (readingOpen && readingRef.current && !readingRef.current.contains(node)) setReadingOpen(false)
      if (searchOpen && searchRef.current && !searchRef.current.contains(node)) setSearchOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    return () => document.removeEventListener('pointerdown', onPointer)
  }, [readingOpen, searchOpen])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const typing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)
      if (event.key === 'Escape') {
        setSearchOpen(false)
        setReadingOpen(false)
        setMoreOpen(false)
        return
      }
      if (event.key === '/' && !typing) {
        event.preventDefault()
        setReadingOpen(false)
        setMoreOpen(false)
        setSearchOpen(true)
        requestAnimationFrame(() => document.getElementById('find')?.focus())
        return
      }
      if (event.key !== ' ' || event.repeat || typing) return
      if (target && (target.tagName === 'BUTTON' || target.tagName === 'A')) return
      const snap = getVoice()
      if (snap.status === 'idle') return
      event.preventDefault()
      toggleVoice()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const due = dueCards(state.deck).length
  const place = formatRef(verseId(state.book, state.chapter, state.verse))
  const studyHref = `/study/${state.book}/${state.chapter}/${state.verse}`
  const pageKey = route.name === 'study' ? 'studio' : route.name === 'desk' ? 'desk' : route.name === 'places' || route.name === 'place' || route.name === 'journey' ? 'atlas' : route.name === 'prophecy' || route.name === 'thread' || route.name === 'prophecy-verse' ? 'prophecy' : route.name === 'return' ? 'return' : route.name === 'genealogy' || route.name === 'genealogy-line' || route.name === 'genealogy-person' ? 'genealogy' : (window.location.hash || 'library')
  const dests: Dest[] = [
    { id: 'library', label: 'Scripture', href: '/', icon: 'M5 4h5.5A3.5 3.5 0 0 1 14 7.5V20a3 3 0 0 0-3-2H5zM19 4h-5.5A3.5 3.5 0 0 0 10 7.5V20a3 3 0 0 1 3-2H19z', hint: 'The books' },
    { id: 'study', label: 'Study', href: '/study', icon: 'M5 4h14v16H5zM8 8h8M8 12h8M8 16h5', hint: 'Words and meaning' },
    { id: 'king', label: 'King', href: '/king', icon: 'M3 18 6.5 8 9.5 13 12 5 14.5 13 17.5 8 21 18Z', hint: 'The story of the King' },
    { id: 'refs', label: 'Links', href: `/refs/${state.book}.${state.chapter}.${state.verse}`, icon: 'M7 7h4v4H7zM13 13h4v4h-4zM11 9h2M13 11v2', hint: place },
    { id: 'prophecy', label: 'Prophecy', href: '/prophecy', icon: 'M12 3l2.2 4.6L19 8.2l-3.5 3.3.9 4.8L12 14.8 7.6 16.3l.9-4.8L5 8.2l4.8-.6z', hint: 'Spoken, then taken up' },
    { id: 'memorize', label: 'Memory', href: '/memorize', icon: 'M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM12 9.5V12l2 1.5', hint: 'Keep the words' },
    { id: 'canon', label: 'Canon', href: '/canon', icon: 'M4 6h16M4 12h16M4 18h10', hint: 'Books, trails, and places' },
    { id: 'about', label: 'About', href: '/about', icon: 'M4 18V6l8-2.5L20 6v12l-8 2.5L4 18zM12 3.5v17', hint: 'Why the book holds' },
    { id: 'return', label: 'Return', href: '/return', icon: 'M4 17h16M8 17a4 4 0 0 1 8 0M12 9.5V6.5M10.2 8.2 12 6.5l1.8 1.7', hint: 'When he comes again' },
    { id: 'genealogy', label: 'Genealogy', href: '/genealogy', icon: 'M12 20V10M12 10H7M12 10h5M7 10V7.2M17 10V7.2M12 7.2V5M12 5a1.4 1.4 0 1 0 0-2.8A1.4 1.4 0 0 0 12 5zM7 7.2a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6zM17 7.2a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6z', hint: 'The families' },
  ]
  const byId = Object.fromEntries(dests.map((item) => [item.id, item]))
  const moreOn = tabOn(route, 'refs') || tabOn(route, 'canon') || tabOn(route, 'church') || tabOn(route, 'about') || tabOn(route, 'return') || tabOn(route, 'genealogy')
  const churchOn = tabOn(route, 'church')
  const accountLabel = session.user ? session.user.name.split(' ')[0] : 'Sign in'
  const churchHint = session.user ? (session.church?.name || 'Your congregation') : 'Your congregation'

  const openSearch = () => {
    setReadingOpen(false)
    setMoreOpen(false)
    setSearchOpen(true)
    requestAnimationFrame(() => document.getElementById('find')?.focus())
  }

  const goTo = (href: string) => {
    setMoreOpen(false)
    setReadingOpen(false)
    setSearchOpen(false)
    go(href)
  }

  const navButton = (item: Dest) => (
    <button
      key={item.id}
      type="button"
      className={tabOn(route, item.id) ? 'nav-item on' : 'nav-item'}
      aria-current={tabOn(route, item.id) ? 'page' : undefined}
      onClick={() => goTo(item.href)}
    >
      <span className="nav-ico">
        <Mark d={item.icon} />
        {item.id === 'memorize' && due ? <span className="badge">{due > 99 ? '99' : due}</span> : null}
      </span>
      <span className="nav-label">{item.label}</span>
    </button>
  )

  return (
    <div className="app">
      <a className="skip" href="#content">Skip to the text</a>
      <nav className="side-nav" aria-label="Primary">
        <div className="side-brand">
          <button type="button" className="brand" onClick={() => goTo('/')}>
            <span className="brand-mark" aria-hidden="true">S</span>
            <span className="brand-word">Scripture</span>
          </button>
          <span className="side-rule" aria-hidden="true" />
        </div>
        <div className="side-groups">
          {GROUPS.map((group) => (
            <div className="side-group" key={group.label}>
              <p className="side-label">{group.label}</p>
              {group.ids.map((id) => navButton(byId[id]))}
            </div>
          ))}
        </div>
        <div className="side-foot">
          <button type="button" className="side-place" onClick={() => goTo(studyHref)}>
            <span className="kicker">You are reading</span>
            <strong>{place}</strong>
          </button>
          <button type="button" className={churchOn ? 'side-account on' : 'side-account'} onClick={() => goTo('/church')}>
            {session.user ? <span className="avatar">{initialOf(session.user.name)}</span> : (
              <span className="avatar" aria-hidden="true">
                <Mark d="M12 12a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4zM5 19.2a7 7 0 0 1 14 0" />
              </span>
            )}
            <span className="account-name">{session.user ? session.user.name : 'Sign in'}</span>
          </button>
        </div>
      </nav>
      <header ref={topRef} className={`top${scrolled ? ' is-scrolled' : ''}${searchOpen ? ' is-searching' : ''}`}>
        <div className="top-row">
        <button type="button" className="brand" onClick={() => goTo('/')}>
          <span className="brand-mark" aria-hidden="true">S</span>
          <span className="brand-word">Scripture</span>
        </button>
        <button type="button" className="place" onClick={() => goTo(studyHref)} aria-label={`You are reading ${place}. Open study.`}>
          {place}
        </button>
        <div className="top-actions">
          <form
            ref={searchRef}
            className={searchOpen ? 'search open' : 'search'}
            aria-label="Find"
            onSubmit={(event) => {
              event.preventDefault()
              const q = query.trim()
              if (!q) return
              setSearchOpen(false)
              go(`/search/${encodeURIComponent(q)}`)
            }}
          >
            <button type="button" className="icon-btn search-launch" aria-label="Search the Scriptures" onClick={openSearch}>
              <Mark d="M11 5a6 6 0 1 0 0 12 6 6 0 0 0 0-12zM20 20l-3.5-3.5" />
            </button>
            <span className="tool-label">Find</span>
            <input id="find" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search" aria-label="Search the Scriptures" />
            <button type="submit" className="search-go">Find</button>
            <button type="button" className="search-close" aria-label="Close search" onClick={() => setSearchOpen(false)}>
              <Mark d="M7 7l10 10M17 7 7 17" />
            </button>
          </form>
          <div className="reading-inline" aria-label="Reading">
            <ReadingTools translation={state.translation} scale={state.scale} theme={state.theme} />
          </div>
          <div className="reading-pop" ref={readingRef}>
            <button
              type="button"
              className="icon-btn reading-toggle"
              aria-expanded={readingOpen}
              aria-controls="reading-menu"
              aria-label="Reading settings"
              onClick={() => {
                setSearchOpen(false)
                setMoreOpen(false)
                setReadingOpen((open) => !open)
              }}
            >
              Aa
            </button>
            {readingOpen ? (
              <div id="reading-menu" className="reading-menu" role="dialog" aria-label="Reading">
                <p className="kicker">Reading</p>
                <ReadingTools translation={state.translation} scale={state.scale} theme={state.theme} />
              </div>
            ) : null}
          </div>
          <button type="button" className={churchOn ? 'icon-btn account-btn on' : 'icon-btn account-btn'} onClick={() => goTo('/church')} aria-label={session.user ? accountLabel : 'Sign in'}>
            {session.user ? <span className="avatar">{initialOf(session.user.name)}</span> : (
              <span className="avatar" aria-hidden="true">
                <Mark d="M12 12a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4zM5 19.2a7 7 0 0 1 14 0" />
              </span>
            )}
            <span className="account-name">{accountLabel}</span>
          </button>
        </div>
        </div>
        {state.translation === 'esv' ? <EsvKeyBar /> : null}
      </header>
      <main id="content" className="main">
        {follow.live && route.name !== 'church' && route.name !== 'join' && follow.following?.sermonId !== follow.live.id ? (
          <div className="live-banner">
            <p><strong>{follow.live.title}</strong> is live.</p>
            <button type="button" className="choice gold" onClick={() => followLive()}>Follow along</button>
          </div>
        ) : null}
        {route.name === 'read' ? null : <FollowBar />}
        <div className="page" key={pageKey}>
          {route.name === 'library' ? <Library /> : null}
          {route.name === 'read' ? <Reader route={route} onWord={setSheet} /> : null}
          {route.name === 'desk' ? <StudyDesk /> : null}
          {route.name === 'study' ? <Study route={route} onWord={setSheet} /> : null}
          {route.name === 'refs' ? <References route={route} /> : null}
          {route.name === 'prophecy' || route.name === 'thread' || route.name === 'prophecy-verse' ? <ProphecyPage route={route} /> : null}
          {route.name === 'memorize' ? <Memorize /> : null}
          {route.name === 'canon' ? <CanonPage /> : null}
          {route.name === 'trail' ? <TrailPage route={route} /> : null}
          {route.name === 'places' || route.name === 'place' || route.name === 'journey' ? <PlacesPage route={route} /> : null}
          {route.name === 'book' ? <BookPage route={route} /> : null}
          {route.name === 'person' ? <PersonPage route={route} /> : null}
          {route.name === 'word' || route.name === 'strong' ? <WordPage route={route} /> : null}
          {route.name === 'search' ? <SearchPage route={route} /> : null}
          {route.name === 'church' || route.name === 'join' ? <Church route={route} /> : null}
          {route.name === 'king' ? <King route={route} /> : null}
          {route.name === 'about' ? <About /> : null}
          {route.name === 'return' ? <Return route={route} /> : null}
          {route.name === 'genealogy' || route.name === 'genealogy-line' || route.name === 'genealogy-person' ? (
            <Suspense fallback={<p className="quiet">Opening the register…</p>}>
              <Genealogy route={route} />
            </Suspense>
          ) : null}
        </div>
      </main>
      <nav ref={bottomRef} className="bottom-nav" aria-label="Primary">
        {PRIMARY.map((id) => navButton(byId[id]))}
        <button type="button" className={moreOn ? 'nav-item on' : 'nav-item'} aria-expanded={moreOpen} aria-haspopup="dialog" onClick={() => { setSearchOpen(false); setReadingOpen(false); setMoreOpen(true) }}>
          <span className="nav-ico">
            <Mark d="M5 5h5v5H5zM14 5h5v5h-5zM5 14h5v5H5zM14 14h5v5h-5z" />
          </span>
          <span className="nav-label">More</span>
        </button>
      </nav>
      {moreOpen ? (
        <>
          <button type="button" className="sheet-back" aria-label="Close" onClick={() => setMoreOpen(false)} />
          <aside ref={moreRef} className="sheet more-sheet" role="dialog" aria-label="More">
            <p className="kicker">Elsewhere</p>
            <h2>More</h2>
            {[byId.genealogy, byId.return, byId.about, byId.refs, byId.canon].map((item) => (
              <button key={item.id} type="button" className={tabOn(route, item.id) ? 'more-row on' : 'more-row'} onClick={() => goTo(item.href)}>
                <span className="nav-ico"><Mark d={item.icon} /></span>
                <span>
                  <strong>{item.label}</strong>
                  <small>{item.hint}</small>
                </span>
              </button>
            ))}
            <button type="button" className={churchOn ? 'more-row on' : 'more-row'} onClick={() => goTo('/church')}>
              <span className="nav-ico"><Mark d="M4 10.5 12 4l8 6.5V20H4zM10 20v-6h4v6" /></span>
              <span>
                <strong>{session.user ? 'Church' : 'Sign in'}</strong>
                <small>{churchHint}</small>
              </span>
            </button>
          </aside>
        </>
      ) : null}
      <VoiceDock />
      {sheet ? <WordSheet ask={sheet} onClose={() => setSheet(null)} /> : null}
    </div>
  )
}
