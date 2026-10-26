import { LINES, PEOPLE } from './genealogyData'

export type Role =
  | 'patriarch'
  | 'matriarch'
  | 'king-judah'
  | 'king-israel'
  | 'king-edom'
  | 'priest'
  | 'christ'
  | 'clan'
  | 'chief'
  | 'prophet'
  | 'judge'
  | 'queen'

export type Kin = {
  id: string
  name: string
  sex?: 'm' | 'f'
  father?: string
  mother?: string
  alsoFather?: string
  spouses?: string[]
  begat?: number
  age?: number
  reigned?: number
  reignNote?: string
  tribe?: string
  roles?: Role[]
  refs: string[]
  note?: string
  place?: string
  writer?: string
  aka?: string
}

export type LineLayout = 'thread' | 'tree' | 'lives' | 'gospels'

export type Line = {
  id: string
  nav: string
  title: string
  lede: string
  layout: LineLayout
  group: string
  root?: string
  members?: string[]
  passage: string[]
  tribe?: string
  depth?: number
}

export type Book = {
  people: Kin[]
  lines: Line[]
  byId: Map<string, Kin>
  children: Map<string, string[]>
  spouses: Map<string, string[]>
}

export type Placed = { id: string; x: number; y: number; parent?: string }

export type LifeRow = { id: string; birth: number; end: number; heir?: number }

const BANDS: { label: string; ids: string[] }[] = [
  { label: 'Before the flood', ids: ['adam', 'seth', 'enosh', 'kenan', 'mahalalel', 'jared', 'enoch', 'methuselah', 'lamech', 'noah'] },
  { label: 'After the flood', ids: ['shem', 'arphaxad', 'shelah', 'eber', 'peleg', 'reu', 'serug', 'nahor', 'terah'] },
  { label: 'The fathers', ids: ['abraham', 'isaac', 'jacob'] },
  { label: 'Egypt and the land', ids: ['judah', 'perez', 'hezron', 'ram', 'amminadab', 'nahshon', 'salmon', 'boaz', 'obed', 'jesse'] },
  {
    label: 'The kings',
    ids: ['david', 'solomon', 'rehoboam', 'abijah', 'asa', 'jehoshaphat', 'jehoram', 'ahaziah', 'joash', 'amaziah', 'uzziah', 'jotham', 'ahaz', 'hezekiah', 'manasseh-king', 'amon', 'josiah', 'jehoiakim', 'jeconiah'],
  },
  { label: 'After the exile', ids: ['shealtiel', 'zerubbabel', 'abiud', 'eliakim-matt', 'azor', 'zadok-matt', 'achim', 'eliud', 'eleazar-matt', 'matthan', 'jacob-joseph', 'joseph-husband'] },
  { label: 'The King', ids: ['jesus'] },
]

const BAND_OF = new Map(BANDS.flatMap((band) => band.ids.map((id) => [id, band.label])))

function addTo(map: Map<string, string[]>, key: string, value: string) {
  const list = map.get(key)
  if (list) {
    if (!list.includes(value)) list.push(value)
  } else {
    map.set(key, [value])
  }
}

export function openBook(people: Kin[], lines: Line[]): Book {
  const byId = new Map<string, Kin>()
  for (const person of people) {
    if (byId.has(person.id)) throw new Error(`Duplicate kin: ${person.id}`)
    byId.set(person.id, person)
  }
  const children = new Map<string, string[]>()
  const spouses = new Map<string, string[]>()
  for (const person of people) {
    if (person.father) addTo(children, person.father, person.id)
    if (person.alsoFather) addTo(children, person.alsoFather, person.id)
    if (person.mother) addTo(children, person.mother, person.id)
    for (const spouse of person.spouses ?? []) {
      addTo(spouses, person.id, spouse)
      addTo(spouses, spouse, person.id)
    }
  }
  return { people, lines, byId, children, spouses }
}

export function check(book: Book): void {
  const problems: string[] = []
  const known = (id: string | undefined, label: string) => {
    if (id && !book.byId.has(id)) problems.push(`${label} missing: ${id}`)
  }
  for (const person of book.people) {
    if (!person.refs.length) problems.push(`No verse: ${person.id}`)
    known(person.father, `${person.id} father`)
    known(person.mother, `${person.id} mother`)
    known(person.alsoFather, `${person.id} alsoFather`)
    for (const spouse of person.spouses ?? []) known(spouse, `${person.id} spouse`)
    const seen = new Set<string>()
    let cursor: string | undefined = person.id
    while (cursor) {
      if (seen.has(cursor)) {
        problems.push(`Cycle at ${person.id} through ${cursor}`)
        break
      }
      seen.add(cursor)
      cursor = book.byId.get(cursor)?.father
    }
  }
  for (const line of book.lines) {
    if (line.root) known(line.root, `${line.id} root`)
    for (const id of line.members ?? []) known(id, `${line.id} member`)
  }
  const spine = fatherLine(book, 'jesus')
  const listed = book.lines.find((line) => line.id === 'to-the-king')?.members ?? []
  if (spine.join() !== listed.join()) problems.push('The line to the King does not match the father chain')
  const lives = lifespans(book)
  const methuselah = lives.rows.find((row) => row.id === 'methuselah')
  if (!methuselah || methuselah.birth + (book.byId.get('methuselah')?.age ?? 0) !== lives.flood) {
    problems.push('Methuselah’s last year is not the flood year')
  }
  if (problems.length) throw new Error(problems.slice(0, 12).join('\n'))
}

function fatherLine(book: Book, id: string): string[] {
  const line: string[] = []
  const seen = new Set<string>()
  let cursor: string | undefined = id
  while (cursor && !seen.has(cursor)) {
    seen.add(cursor)
    line.push(cursor)
    cursor = book.byId.get(cursor)?.father
  }
  return line.reverse()
}

export const book: Book = openBook(PEOPLE, LINES)

if (import.meta.env?.DEV) check(book)

export function person(book: Book, id: string): Kin | undefined {
  return book.byId.get(id)
}

export function kinName(book: Book, id: string | undefined): string {
  if (!id) return ''
  return book.byId.get(id)?.name ?? id
}

export function childWord(sex: Kin['sex']): string {
  if (sex === 'f') return 'daughter'
  if (sex === 'm') return 'son'
  return 'child'
}

export function tagline(book: Book, kin: Kin): string {
  if (kin.roles?.includes('clan')) return 'A family in the register'
  if (kin.roles?.includes('christ')) return 'The King'
  if (kin.id === 'david' || kin.id === 'solomon' || kin.id === 'saul') return 'King over Israel'
  if (kin.roles?.includes('king-judah')) return 'King of Judah'
  if (kin.roles?.includes('king-israel')) return 'King of Israel'
  if (kin.roles?.includes('king-edom')) return 'King of Edom'
  if (kin.roles?.includes('queen')) return 'Queen of Judah'
  if (kin.father) {
    const of = `${childWord(kin.sex)} of ${kinName(book, kin.father)}`
    const also = kin.alsoFather ? `, and of ${kinName(book, kin.alsoFather)}` : ''
    const line = `${of}${also}`
    if (kin.roles?.includes('priest')) return `Priest, ${line}`
    return line
  }
  if (kin.roles?.includes('matriarch')) return 'A mother in the line'
  if (kin.roles?.includes('patriarch')) return 'A father in the line'
  if (kin.aka) return kin.aka
  if (kin.tribe) return kin.tribe
  return ''
}

export function searchKin(book: Book, query: string): Kin[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const scored = book.people
    .map((kin) => {
      const name = kin.name.toLowerCase()
      const aka = kin.aka?.toLowerCase() ?? ''
      const id = kin.id.toLowerCase()
      let score = 0
      if (name === q || aka === q) score = 400
      else if (name.startsWith(q) || aka.startsWith(q)) score = 300
      else if (name.includes(q) || aka.includes(q) || id === q || id.startsWith(`${q}-`)) score = 200
      return { kin, score }
    })
    .filter((row) => row.score > 0)
  scored.sort((a, b) => b.score - a.score || a.kin.name.localeCompare(b.kin.name) || a.kin.id.localeCompare(b.kin.id))
  return scored.map((row) => row.kin)
}

export function familyChildren(book: Book, id: string): Kin[] {
  return (book.children.get(id) ?? []).flatMap((child) => {
    const kin = book.byId.get(child)
    return kin ? [kin] : []
  })
}

export function treeChildren(book: Book, id: string): string[] {
  return (book.children.get(id) ?? []).filter((child) => {
    const kin = book.byId.get(child)
    if (!kin) return false
    if (kin.father) return kin.father === id
    return kin.mother === id
  })
}

export function spousesOf(book: Book, id: string): Kin[] {
  return (book.spouses.get(id) ?? []).flatMap((spouse) => {
    const kin = book.byId.get(spouse)
    return kin ? [kin] : []
  })
}

export function pathToAdam(book: Book, id: string): string[] | null {
  const line = fatherLine(book, id)
  return line[0] === 'adam' ? line : null
}

export function pathToJesus(book: Book, id: string): string[] | null {
  const spine = fatherLine(book, 'jesus')
  const at = spine.indexOf(id)
  if (at >= 0) return spine.slice(at)
  const motherAt = spine.findIndex((step) => book.byId.get(step)?.mother === id)
  if (motherAt >= 0) return [id, ...spine.slice(motherAt)]
  const luke = book.lines.find((line) => line.id === 'luke')?.members ?? []
  const lukeAt = luke.indexOf(id)
  if (lukeAt >= 0) return luke.slice(lukeAt)
  const lukeMother = luke.findIndex((step) => book.byId.get(step)?.mother === id)
  if (lukeMother >= 0) return [id, ...luke.slice(lukeMother)]
  return null
}

export function bandOf(id: string): string | null {
  return BAND_OF.get(id) ?? null
}

export function generations(book: Book): number {
  const line = book.lines.find((entry) => entry.id === 'to-the-king')
  return line?.members?.length ?? 0
}

function birthOf(book: Book, order: string[], from: number): Map<string, number> {
  const births = new Map<string, number>()
  let year = from
  for (let i = 0; i < order.length; i += 1) {
    births.set(order[i], year)
    const begat = book.byId.get(order[i])?.begat
    if (begat == null) break
    year += begat
  }
  return births
}

export function lifespans(book: Book): { rows: LifeRow[]; flood: number; span: number } {
  const ante = ['adam', 'seth', 'enosh', 'kenan', 'mahalalel', 'jared', 'enoch', 'methuselah', 'lamech', 'noah']
  const post = ['arphaxad', 'shelah', 'eber', 'peleg', 'reu', 'serug', 'nahor', 'terah', 'abraham']
  const births = birthOf(book, ante, 0)
  const noah = births.get('noah') ?? 0
  const flood = noah + 600
  births.set('shem', noah + (book.byId.get('noah')?.begat ?? 500))
  const after = birthOf(book, post, flood + 2)
  for (const [id, year] of after) births.set(id, year)
  const order = [...ante, 'shem', ...post, 'sarah']
  const abraham = births.get('abraham')
  if (abraham != null) births.set('sarah', abraham - 10)
  const rows: LifeRow[] = []
  for (const id of order) {
    const kin = book.byId.get(id)
    const birth = births.get(id)
    if (!kin || birth == null || kin.age == null) continue
    rows.push({ id, birth, end: birth + kin.age, heir: kin.begat == null ? undefined : birth + kin.begat })
  }
  const span = Math.max(...rows.map((row) => row.end))
  return { rows, flood, span }
}

export function layoutTree(book: Book, root: string, depth?: number): Placed[] {
  type Node = { id: string; children: Node[]; x: number; y: number; parent?: string }
  const seen = new Set<string>()
  const build = (id: string, d: number, parent?: string): Node | null => {
    if (seen.has(id)) return null
    seen.add(id)
    const node: Node = { id, children: [], x: 0, y: d, parent }
    if (depth != null && d >= depth) return node
    for (const child of treeChildren(book, id)) {
      const next = build(child, d + 1, id)
      if (next) node.children.push(next)
    }
    return node
  }
  const tree = build(root, 0)
  if (!tree) return []
  let leaf = 0
  const place = (node: Node) => {
    if (!node.children.length) node.x = leaf++
    else {
      node.children.forEach(place)
      node.x = (node.children[0].x + node.children[node.children.length - 1].x) / 2
    }
  }
  place(tree)
  const flat: Placed[] = []
  const walk = (node: Node) => {
    flat.push({ id: node.id, x: node.x, y: node.y, parent: node.parent })
    node.children.forEach(walk)
  }
  walk(tree)
  return flat
}

export function inTree(book: Book, root: string, id: string, depth?: number): boolean {
  let cursor: string | undefined = id
  let steps = 0
  const seen = new Set<string>()
  while (cursor && !seen.has(cursor)) {
    if (cursor === root) return depth == null || steps <= depth
    seen.add(cursor)
    const kin: Kin | undefined = book.byId.get(cursor)
    cursor = kin?.father || kin?.mother
    steps += 1
  }
  return false
}

export function linesFor(book: Book, id: string): Line[] {
  const matthew = book.lines.find((line) => line.id === 'matthew')?.members ?? []
  const luke = book.lines.find((line) => line.id === 'luke')?.members ?? []
  const named = (members: string[]) => members.includes(id) || members.some((step) => book.byId.get(step)?.mother === id)
  return book.lines.filter((line) => {
    if (line.layout === 'gospels') return named(matthew) || named(luke)
    if (line.members && named(line.members)) return true
    if (line.layout === 'tree' && line.root && inTree(book, line.root, id, line.depth)) return true
    if (line.tribe && book.byId.get(id)?.tribe === line.tribe && line.layout === 'tree') return true
    return false
  })
}

export function registerOf(book: Book, line: Line, placed: Placed[]): Kin[] {
  if (!line.tribe) return []
  const shown = new Set(placed.map((node) => node.id))
  return book.people.filter((kin) => kin.tribe === line.tribe && !shown.has(kin.id))
}

export function groupsOf(lines: Line[]): { label: string; lines: Line[] }[] {
  const order = ['The line', 'The Gospels', 'The houses', 'The kings', 'The priests', 'The tribes']
  return order
    .map((label) => ({ label, lines: lines.filter((line) => line.group === label) }))
    .filter((group) => group.lines.length)
}
