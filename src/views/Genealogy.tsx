import { useEffect, useMemo, useRef, useState } from 'react'
import { formatRef, parseRef } from '../lib/canon'
import {
  bandOf,
  book,
  childWord,
  familyChildren,
  generations,
  kinName,
  layoutTree,
  lifespans,
  linesFor,
  pathToAdam,
  pathToJesus,
  person,
  registerOf,
  searchKin,
  spousesOf,
  tagline,
  groupsOf,
  type Book,
  type Kin,
  type Line,
  type Placed,
} from '../lib/genealogy'
import { go, type Route } from '../lib/router'
import { useAppState } from '../lib/storage'
import { VerseQuote } from '../ui'

type GenealogyRoute = Extract<Route, { name: 'genealogy' | 'genealogy-line' | 'genealogy-person' }>

function openRef(id: string) {
  const parsed = parseRef(id)
  if (parsed) go(`/read/${parsed.book}/${parsed.chapter}/${parsed.verse}`)
}

function yearsOf(kin: Kin): string {
  const bits: string[] = []
  if (kin.age) bits.push(`Lived ${kin.age} years`)
  if (kin.begat) bits.push(`A son at ${kin.begat}`)
  if (kin.reigned) bits.push(`Reigned ${kin.reigned} ${kin.reigned === 1 ? 'year' : 'years'}`)
  if (kin.reignNote) bits.push(kin.reignNote)
  return bits.join(' · ')
}

function Back({ to = '/genealogy', label = 'All the lines' }: { to?: string; label?: string }) {
  return (
    <button type="button" className="text-btn gen-back" onClick={() => go(to)}>
      {label}
    </button>
  )
}

function Passage({ ids }: { ids: string[] }) {
  if (!ids.length) return null
  return (
    <div className="chips">
      {ids.map((id) => (
        <button key={id} type="button" className="chip" onClick={() => openRef(id)}>
          {formatRef(id)}
        </button>
      ))}
    </div>
  )
}

function Landing({ book }: { book: Book }) {
  const [query, setQuery] = useState('')
  const hits = query.trim() ? searchKin(book, query) : []
  const shown = hits.slice(0, 24)
  const spine = book.lines.find((line) => line.id === 'to-the-king')?.members ?? []
  const beads = ['adam', 'noah', 'abraham', 'david', 'jesus']
  const women = book.people.filter((kin) => kin.sex === 'f').length
  const groups = groupsOf(book.lines)

  return (
    <>
      <p className="kicker">The families</p>
      <h1>Genealogy</h1>
      <p className="lede">From Adam to the King, the names Scripture keeps.</p>
      <dl className="gen-stats">
        <div><dt>Names</dt><dd>{book.people.length.toLocaleString()}</dd></div>
        <div><dt>To the King</dt><dd>{generations(book)}</dd></div>
        <div><dt>Women</dt><dd>{women}</dd></div>
        <div><dt>Lines</dt><dd>{book.lines.length}</dd></div>
      </dl>
      <form className="gen-find" role="search" onSubmit={(event) => event.preventDefault()}>
        <label htmlFor="gen-find">Find a name</label>
        <input
          id="gen-find"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Ruth, Hezekiah, Zerubbabel"
          autoComplete="off"
        />
      </form>
      {query.trim() ? (
        shown.length ? (
          <ul className="gen-hits">
            {shown.map((kin) => (
              <li key={kin.id}>
                <button type="button" onClick={() => go(`/genealogy/person/${kin.id}`)}>
                  <strong>{kin.name}</strong>
                  <small>{tagline(book, kin)}</small>
                </button>
              </li>
            ))}
          </ul>
        ) : <p className="quiet">No one by that name is in the register.</p>
      ) : null}
      {hits.length > shown.length ? <p className="quiet">{hits.length - shown.length} more. Keep typing.</p> : null}
      <div className="gen-spine">
        <ol>
          {beads.map((id, index) => {
            const kin = person(book, id)
            const at = spine.indexOf(id) + 1
            return (
              <li key={id}>
                {index > 0 ? <span className="gen-spine-rule" aria-hidden="true" /> : null}
                <button type="button" onClick={() => go(`/genealogy/person/${id}`)}>
                  <small>{at ? `Generation ${at}` : ''}</small>
                  <strong>{kin?.name}</strong>
                </button>
              </li>
            )
          })}
        </ol>
        <button type="button" className="choice gold" onClick={() => go('/genealogy/line/to-the-king')}>Walk the line</button>
      </div>
      {groups.map((group) => (
        <section key={group.label} className="gen-group">
          <h2>{group.label}</h2>
          <div className="chips">
            {group.lines.map((line) => (
              <button key={line.id} type="button" className="chip" onClick={() => go(`/genealogy/line/${line.id}`)}>
                {line.nav}
              </button>
            ))}
          </div>
        </section>
      ))}
    </>
  )
}

function Thread({ book, line }: { book: Book; line: Line }) {
  const members = line.members ?? []
  let band = ''
  return (
    <ol className="gen-thread">
      {members.map((id, index) => {
        const kin = person(book, id)
        if (!kin) return null
        const nextBand = line.id === 'to-the-king' ? bandOf(id) : null
        const showBand = Boolean(nextBand && nextBand !== band)
        if (nextBand) band = nextBand
        const prev = members[index - 1]
        const mother = kin.mother ? kinName(book, kin.mother) : ''
        const fatherAside = kin.father && kin.father !== prev
          ? `${childWord(kin.sex).replace(/^./, (letter) => letter.toUpperCase())} of ${kinName(book, kin.father)}`
          : ''
        const mark = line.id === 'matthew' && id === 'david'
          ? 'Fourteen, from Abraham'
          : line.id === 'matthew' && id === 'josiah'
            ? 'Fourteen, unto the carrying away'
            : line.id === 'matthew' && id === 'jesus'
              ? 'Fourteen, unto the King'
              : ''
        const detail = [mother ? `of ${mother}` : '', fatherAside, yearsOf(kin), mark].filter(Boolean).join(' · ')
        return (
          <li key={`${id}-${index}`}>
            {showBand ? <p className="gen-band">{nextBand}</p> : null}
            <button type="button" className={kin.roles?.includes('christ') ? 'is-king' : ''} onClick={() => go(`/genealogy/person/${id}`)}>
              <span className="gen-index">{index + 1}</span>
              <span>
                <strong>{kin.name}</strong>
                {kin.aka ? <em>{kin.aka}</em> : null}
                {detail ? <small>{detail}</small> : null}
              </span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}

function columnOf(book: Book, ids: string[], shared: Set<string>) {
  return ids.map((id) => {
    const kin = person(book, id)
    if (!kin) return null
    return (
      <li key={id}>
        <button type="button" className={shared.has(id) ? 'is-shared' : ''} onClick={() => go(`/genealogy/person/${id}`)}>
          <strong>{kin.name}</strong>
          {kin.note && id === 'cainan-arphaxad' ? <small>Named in Luke, not in Genesis 11</small> : null}
        </button>
      </li>
    )
  })
}

function Gospels({ book }: { book: Book }) {
  const matthew = book.lines.find((line) => line.id === 'matthew')?.members ?? []
  const luke = book.lines.find((line) => line.id === 'luke')?.members ?? []
  const shared = new Set(matthew.filter((id) => luke.includes(id)))
  const lukeEarly = luke.slice(0, luke.indexOf('abraham'))
  const together = matthew.slice(0, matthew.indexOf('david') + 1)
  const mattAfter = matthew.slice(matthew.indexOf('david') + 1).filter((id) => id !== 'jesus')
  const lukeAfter = luke.slice(luke.indexOf('david') + 1).filter((id) => id !== 'jesus')

  return (
    <div className="gen-gospels">
      <section>
        <h2>Adam to Terah</h2>
        <p className="quiet">Luke carries the line up to Adam. Matthew begins at Abraham.</p>
        <ol>{columnOf(book, lukeEarly, shared)}</ol>
      </section>
      <section>
        <h2>Abraham to David</h2>
        <p className="quiet">The same names, in both lists.</p>
        <ol className="is-gold">{columnOf(book, together, shared)}</ol>
      </section>
      <section className="gen-split">
        <div>
          <h2>Matthew, after David</h2>
          <p className="quiet">Through Solomon.</p>
          <ol>{columnOf(book, mattAfter, shared)}</ol>
        </div>
        <div>
          <h2>Luke, after David</h2>
          <p className="quiet">Through Nathan.</p>
          <ol>{columnOf(book, lukeAfter, shared)}</ol>
        </div>
      </section>
      <button type="button" className="gen-christ" onClick={() => go('/genealogy/person/jesus')}>
        <small>Both lists end here</small>
        <strong>Jesus</strong>
      </button>
      <div className="panel gen-notes">
        <p>Matthew counts three fourteens, and omits kings that the books of the Kings include.</p>
        <p>Luke names Cainan between Arphaxad and Shelah. Genesis 11 does not.</p>
        <p>Some copies of Luke name Admin and Arni between Amminadab and Hezron. The King James text reads Aram, that is Ram.</p>
        <p>Luke calls Shealtiel the son of Neri. Chronicles calls him the son of Jeconiah.</p>
        <p>A long reading takes Luke’s list as Mary’s family. The verse itself says Joseph.</p>
      </div>
    </div>
  )
}

function Lives({ book }: { book: Book }) {
  const { rows, flood, span } = lifespans(book)
  const ticks = [0, 400, 800, 1200, 1600, 2000].filter((year) => year <= span)
  return (
    <div className="gen-lives">
      <p className="quiet">Shem begat Arphaxad two years after the flood. The flood is Noah’s six hundredth year. By these numbers, Methuselah’s last year is that year.</p>
      <div className="life-scroll">
        <div className="life-chart" style={{ ['--span' as string]: String(span) }}>
          <div className="life-row life-axis" aria-hidden="true">
            <span />
            <span className="life-track">
              {ticks.map((year) => (
                <i key={year} style={{ left: `${(year / span) * 100}%` }}>{year}</i>
              ))}
              <b className="life-flood" style={{ left: `${(flood / span) * 100}%` }} />
            </span>
          </div>
          {rows.map((row) => {
            const kin = person(book, row.id)
            if (!kin) return null
            const onFlood = row.end === flood
            return (
              <div className="life-row" key={row.id}>
                <button type="button" onClick={() => go(`/genealogy/person/${row.id}`)}>
                  <strong>{kin.name}</strong>
                  <small>{kin.age}</small>
                </button>
                <span className="life-track">
                  <i
                    className={onFlood ? 'life-bar is-flood' : 'life-bar'}
                    style={{ left: `${(row.birth / span) * 100}%`, width: `${((row.end - row.birth) / span) * 100}%` }}
                    title={`${kin.name}, ${row.birth} to ${row.end}`}
                  />
                  <b className="life-flood" style={{ left: `${(flood / span) * 100}%` }} />
                </span>
              </div>
            )
          })}
        </div>
      </div>
      <p className="quiet">The gold line is the flood. Methuselah’s bar ends on it.</p>
    </div>
  )
}

function TreeView({ book, line }: { book: Book; line: Line }) {
  const placed = useMemo(() => (line.root ? layoutTree(book, line.root, line.depth) : []), [book, line])
  const register = useMemo(() => registerOf(book, line, placed), [book, line, placed])
  const [filter, setFilter] = useState('')
  const frameRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; y: number; cx: number; cy: number; moved: boolean } | null>(null)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const pinch = useRef<{ d: number; s: number } | null>(null)
  const [cam, setCam] = useState({ x: 24, y: 24, s: 1 })
  const skip = useRef(false)

  const gapX = 148
  const gapY = 92
  const minX = placed.reduce((min, node) => Math.min(min, node.x), 0)
  const maxX = placed.reduce((max, node) => Math.max(max, node.x), 0)
  const maxY = placed.reduce((max, node) => Math.max(max, node.y), 0)
  const width = Math.max(1, (maxX - minX) * gapX + 220)
  const height = maxY * gapY + 96
  const at = (node: Placed) => ({ x: (node.x - minX) * gapX + 110, y: node.y * gapY + 36 })

  const frameRoot = () => {
    const frame = frameRef.current
    const root = placed.find((node) => node.id === line.root)
    if (!frame || !root || frame.clientWidth < 40) return
    const point = at(root)
    setCam({ x: frame.clientWidth / 2 - point.x, y: 36, s: 1 })
  }

  useEffect(() => {
    const id = requestAnimationFrame(frameRoot)
    setFilter('')
    return () => cancelAnimationFrame(id)
  }, [line.id, line.root, placed])

  useEffect(() => {
    const node = frameRef.current
    if (!node) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const rect = node.getBoundingClientRect()
      const px = event.clientX - rect.left
      const py = event.clientY - rect.top
      setCam((current) => {
        const next = Math.min(2.2, Math.max(0.05, current.s * (event.deltaY > 0 ? 0.9 : 1.1)))
        const scale = next / current.s
        return { s: next, x: px - (px - current.x) * scale, y: py - (py - current.y) * scale }
      })
    }
    node.addEventListener('wheel', onWheel, { passive: false })
    return () => node.removeEventListener('wheel', onWheel)
  }, [])

  const fit = () => {
    const frame = frameRef.current
    if (!frame || frame.clientWidth < 40) return
    const pad = 28
    const sx = (frame.clientWidth - pad * 2) / width
    const sy = (frame.clientHeight - pad * 2) / height
    const s = Math.max(0.04, Math.min(1.2, sx, sy))
    setCam({
      s,
      x: (frame.clientWidth - width * s) / 2,
      y: Math.max(20, (frame.clientHeight - height * s) / 2),
    })
  }

  const near = () => frameRoot()

  const q = filter.trim().toLowerCase()
  const listed = register.filter((kin) => !q || kin.name.toLowerCase().includes(q) || kin.aka?.toLowerCase().includes(q))

  return (
    <div className="gen-tree-wrap">
      <div className="gen-tree-tools">
        <button type="button" className="choice" onClick={near}>Near</button>
        <button type="button" className="choice" onClick={fit}>Fit</button>
        <p className="quiet">{placed.length} on the tree{register.length ? ` · ${register.length} more in the register` : ''}. Drag to move. Scroll to zoom.</p>
      </div>
      <div
        className="gen-tree"
        ref={frameRef}
        onPointerDown={(event) => {
          pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
          if (pointers.current.size === 1) {
            drag.current = { x: event.clientX, y: event.clientY, cx: cam.x, cy: cam.y, moved: false }
          }
          if (pointers.current.size === 2) {
            const [a, b] = [...pointers.current.values()]
            pinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y), s: cam.s }
          }
        }}
        onPointerMove={(event) => {
          if (!pointers.current.has(event.pointerId)) return
          pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
          if (pointers.current.size === 2 && pinch.current) {
            const [a, b] = [...pointers.current.values()]
            const dist = Math.hypot(a.x - b.x, a.y - b.y)
            const next = Math.min(2.2, Math.max(0.05, pinch.current.s * (dist / pinch.current.d)))
            setCam((current) => ({ ...current, s: next }))
            skip.current = true
            return
          }
          const current = drag.current
          if (!current) return
          const dx = event.clientX - current.x
          const dy = event.clientY - current.y
          if (Math.hypot(dx, dy) > 4) current.moved = true
          setCam((camNow) => ({ ...camNow, x: current.cx + dx, y: current.cy + dy }))
        }}
        onPointerUp={(event) => {
          if (drag.current?.moved) skip.current = true
          drag.current = null
          pointers.current.delete(event.pointerId)
          pinch.current = null
        }}
        onPointerCancel={() => {
          drag.current = null
          pointers.current.clear()
          pinch.current = null
        }}
      >
        <svg width={width} height={height} role="img" aria-label={line.title} style={{ transform: `translate(${cam.x}px, ${cam.y}px) scale(${cam.s})` }}>
          {placed.map((node) => {
            if (!node.parent) return null
            const parent = placed.find((item) => item.id === node.parent)
            if (!parent) return null
            const a = at(parent)
            const b = at(node)
            return <line key={`${node.parent}-${node.id}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
          })}
          {placed.map((node) => {
            const kin = person(book, node.id)
            if (!kin) return null
            const point = at(node)
            const king = kin.roles?.includes('christ')
            return (
              <g
                key={node.id}
                className={king ? 'gen-node is-king' : 'gen-node'}
                role="button"
                tabIndex={0}
                aria-label={kin.name}
                transform={`translate(${point.x} ${point.y})`}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter' && event.key !== ' ') return
                  event.preventDefault()
                  go(`/genealogy/person/${node.id}`)
                }}
                onClick={() => {
                  if (skip.current) {
                    skip.current = false
                    return
                  }
                  go(`/genealogy/person/${node.id}`)
                }}
              >
                <rect x="-64" y="-16" width="128" height="48" fill="transparent" />
                <circle r={king ? 7 : 5} />
                <text y="22">{kin.name}</text>
              </g>
            )
          })}
        </svg>
      </div>
      {register.length ? (
        <section className="gen-register">
          <h2>Also in the register</h2>
          <form className="gen-find" role="search" onSubmit={(event) => event.preventDefault()}>
            <label htmlFor="gen-register">Find in this register</label>
            <input id="gen-register" value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="A name" />
          </form>
          <ul className="gen-hits">
            {listed.slice(0, 80).map((kin) => (
              <li key={kin.id}>
                <button type="button" onClick={() => go(`/genealogy/person/${kin.id}`)}>
                  <strong>{kin.name}</strong>
                  <small>{tagline(book, kin)}</small>
                </button>
              </li>
            ))}
          </ul>
          {listed.length > 80 ? <p className="quiet">{listed.length - 80} more. Keep typing.</p> : null}
          {!listed.length ? <p className="quiet">No one by that name in this register.</p> : null}
        </section>
      ) : null}
    </div>
  )
}

function LineView({ book, line }: { book: Book; line: Line }) {
  return (
    <>
      <Back />
      <p className="kicker">{line.group}</p>
      <h1>{line.title}</h1>
      <p className="lede">{line.lede}</p>
      <Passage ids={line.passage} />
      {line.layout === 'thread' ? <Thread book={book} line={line} /> : null}
      {line.layout === 'tree' ? <TreeView book={book} line={line} /> : null}
      {line.layout === 'lives' ? <Lives book={book} /> : null}
      {line.layout === 'gospels' ? <Gospels book={book} /> : null}
    </>
  )
}

function KinLinks({ book, ids, label }: { book: Book; ids: string[]; label: string }) {
  if (!ids.length) return null
  return (
    <section className="gen-kin">
      <h2>{label}</h2>
      <div className="chips">
        {ids.map((id) => {
          const kin = person(book, id)
          if (!kin) return null
          return (
            <button key={id} type="button" className="chip" onClick={() => go(`/genealogy/person/${id}`)}>
              {kin.name}
            </button>
          )
        })}
      </div>
    </section>
  )
}

function Path({ book, ids, title }: { book: Book; ids: string[]; title: string }) {
  return (
    <section className="gen-path">
      <h2>{title}</h2>
      <ol>
        {ids.map((id, index) => {
          const kin = person(book, id)
          if (!kin) return null
          return (
            <li key={`${id}-${index}`}>
              <button type="button" className={kin.roles?.includes('christ') ? 'is-king' : ''} onClick={() => go(`/genealogy/person/${id}`)}>
                {kin.name}
              </button>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

function PersonView({ book, id }: { book: Book; id: string }) {
  const state = useAppState()
  const kin = person(book, id)
  const [which, setWhich] = useState<'adam' | 'jesus' | null>(null)
  useEffect(() => setWhich(null), [id])
  if (!kin) {
    return (
      <>
        <Back />
        <p className="miss">This name is not in the register.</p>
      </>
    )
  }
  const toAdam = pathToAdam(book, id)
  const toJesus = pathToJesus(book, id)
  const children = familyChildren(book, id)
  const spouses = spousesOf(book, id)
  const lines = linesFor(book, id).slice(0, 8)
  const quotes = kin.refs.slice(0, 3)
  const rest = kin.refs.slice(3)
  const path = which === 'adam' ? toAdam : which === 'jesus' ? toJesus : null

  return (
    <>
      <Back />
      <p className="kicker">{tagline(book, kin) || 'In the register'}</p>
      <h1>{kin.name}</h1>
      {kin.aka ? <p className="lede">{kin.aka}</p> : null}
      {yearsOf(kin) ? <p className="quiet">{yearsOf(kin)}</p> : null}
      {kin.note ? <p className="gen-note">{kin.note}</p> : null}
      <div className="gen-actions">
        {toJesus ? (
          <button type="button" className="choice gold" onClick={() => setWhich(which === 'jesus' ? null : 'jesus')}>
            To the King · {toJesus.length - 1}
          </button>
        ) : null}
        {toAdam && id !== 'adam' ? (
          <button type="button" className="choice" onClick={() => setWhich(which === 'adam' ? null : 'adam')}>
            Back to Adam · {toAdam.length - 1}
          </button>
        ) : null}
        {kin.roles?.includes('christ') ? (
          <button type="button" className="choice gold" onClick={() => go('/king')}>Open the King</button>
        ) : null}
        {kin.writer ? (
          <button type="button" className="choice" onClick={() => go(`/person/${kin.writer}`)}>The writer</button>
        ) : null}
        {kin.place ? (
          <button type="button" className="choice" onClick={() => go(`/places/${kin.place}`)}>The place</button>
        ) : null}
      </div>
      {path ? <Path book={book} ids={path} title={which === 'jesus' ? 'To the King' : 'Back to Adam'} /> : null}
      <KinLinks book={book} label="Father" ids={kin.father ? [kin.father] : []} />
      <KinLinks book={book} label="Also named as father" ids={kin.alsoFather ? [kin.alsoFather] : []} />
      <KinLinks book={book} label="Mother" ids={kin.mother ? [kin.mother] : []} />
      <KinLinks book={book} label={spouses.length > 1 ? 'Spouses' : 'Spouse'} ids={spouses.map((item) => item.id)} />
      <KinLinks book={book} label="Children" ids={children.map((item) => item.id)} />
      {lines.length ? (
        <section className="gen-kin">
          <h2>On these lines</h2>
          <div className="chips">
            {lines.map((line) => (
              <button key={line.id} type="button" className="chip" onClick={() => go(`/genealogy/line/${line.id}`)}>
                {line.nav}
              </button>
            ))}
          </div>
        </section>
      ) : null}
      <div className="gen-scripture">
        {quotes.map((ref) => <VerseQuote key={ref} id={ref} translation={state.translation} />)}
        <Passage ids={rest} />
      </div>
    </>
  )
}

export function Genealogy({ route }: { route: GenealogyRoute }) {
  const place = route.name === 'genealogy' ? 'home' : route.id
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [place])
  if (route.name === 'genealogy-person') return <PersonView book={book} id={route.id} />
  if (route.name === 'genealogy-line') {
    const line = book.lines.find((item) => item.id === route.id)
    if (!line) {
      return (
        <>
          <Back />
          <p className="miss">This line is not in the register.</p>
        </>
      )
    }
    return <LineView book={book} line={line} />
  }
  return <Landing book={book} />
}
