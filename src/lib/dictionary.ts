export type DictSense = { part: string; definition: string }

export type DictEntry = {
  word: string
  phonetic: string
  senses: DictSense[]
}

type FreeRow = {
  word?: string
  phonetic?: string
  phonetics?: { text?: string }[]
  meanings?: {
    partOfSpeech?: string
    definitions?: { definition?: string }[]
  }[]
}

type WikiSense = { definition?: string }
type WikiBlock = { partOfSpeech?: string; definitions?: WikiSense[] }
type WikiPage = { en?: WikiBlock[] }

function shorten(text: string): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length <= 220) return clean
  const cut = clean.slice(0, 220)
  const stop = cut.lastIndexOf(' ')
  return `${(stop > 80 ? cut.slice(0, stop) : cut).trim()}…`
}

function plainHtml(html: string): string {
  return shorten(
    html
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;|&apos;/g, "'")
      .replace(/\s+([.,;:!?])/g, '$1'),
  )
}

function fromFree(data: FreeRow[], fallback: string): DictEntry | null {
  const row = data[0]
  if (!row) return null
  const senses: DictSense[] = []
  for (const meaning of row.meanings ?? []) {
    const definition = meaning.definitions?.find((item) => item.definition)?.definition
    if (!definition) continue
    senses.push({ part: (meaning.partOfSpeech || 'word').toLowerCase(), definition: shorten(definition) })
    if (senses.length >= 3) break
  }
  if (!senses.length) return null
  const phonetic = row.phonetic || row.phonetics?.find((item) => item.text)?.text || ''
  return { word: row.word || fallback, phonetic, senses }
}

async function lookupFree(word: string): Promise<DictEntry | null> {
  const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`)
  if (response.status === 404) return null
  if (!response.ok) throw new Error('offline')
  return fromFree((await response.json()) as FreeRow[], word)
}

function fromWiki(page: WikiPage, fallback: string): DictEntry | null {
  const senses: DictSense[] = []
  for (const block of page.en ?? []) {
    for (const sense of block.definitions ?? []) {
      if (!sense.definition) continue
      const definition = plainHtml(sense.definition)
      if (!definition) continue
      senses.push({ part: (block.partOfSpeech || 'word').toLowerCase(), definition })
      if (senses.length >= 3) break
    }
    if (senses.length >= 3) break
  }
  if (!senses.length) return null
  return { word: fallback, phonetic: '', senses }
}

async function lookupWiktionary(word: string): Promise<DictEntry | null> {
  const response = await fetch(`https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(word)}`)
  if (response.status === 404) return null
  if (!response.ok) throw new Error('offline')
  return fromWiki((await response.json()) as WikiPage, word)
}

export async function lookupEnglish(word: string): Promise<DictEntry | null> {
  const clean = word.replace(/^[^A-Za-z]+|[^A-Za-z']+$/g, '').toLowerCase()
  if (clean.length < 2) return null
  let primaryDown = false
  try {
    const entry = await lookupFree(clean)
    if (entry) return entry
  } catch {
    primaryDown = true
  }
  try {
    return await lookupWiktionary(clean)
  } catch (err) {
    if (primaryDown) throw err
    throw new Error('offline')
  }
}
