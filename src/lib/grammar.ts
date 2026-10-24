import { lessonById } from './school'

export type GrammarNote = { line: string; lessonIds: string[] }

const HEBREW_STEM: Record<string, string> = {
  q: 'qal', N: 'niphal', p: 'piel', P: 'pual', h: 'hiphil', H: 'hophal', t: 'hithpael',
  o: 'polel', O: 'polal', r: 'hithpolel', m: 'poel', M: 'poal', k: 'palel', K: 'pulal',
  Q: 'qal passive', l: 'pilpel', L: 'polpal', f: 'hithpalpel', D: 'nithpael', j: 'pealal',
  i: 'pilel', u: 'hothpaal', c: 'tiphil', v: 'hishtaphel', w: 'nithpalel', y: 'nithpoel', z: 'hithpoel',
}

const ARAMAIC_STEM: Record<string, string> = {
  q: 'peal', Q: 'peil', u: 'hithpeel', p: 'pael', P: 'ithpaal', M: 'hithpaal', a: 'aphel',
  h: 'haphel', s: 'saphel', e: 'shaphel', H: 'hophal', i: 'ithpeel', t: 'hishtaphel',
  v: 'ishtaphel', w: 'hithaphel', o: 'polel', z: 'ithpoel', r: 'hithpolel', f: 'hithpalpel',
  b: 'hephal', c: 'tiphel', m: 'poel', l: 'palpel', L: 'ithpalpel', O: 'ithpolel', G: 'ittaphal',
}

const CONJ: Record<string, string> = {
  p: 'perfect', q: 'sequential perfect', i: 'imperfect', w: 'sequential imperfect',
  h: 'cohortative', j: 'jussive', v: 'imperative', r: 'participle', s: 'passive participle',
  a: 'infinitive absolute', c: 'infinitive construct',
}

const GENDER: Record<string, string> = { m: 'masculine', f: 'feminine', c: 'common', b: 'both' }
const NUMBER: Record<string, string> = { s: 'singular', p: 'plural', d: 'dual' }
const STATE: Record<string, string> = { a: 'absolute', c: 'construct', d: 'determined' }
const PERSON: Record<string, string> = { '1': 'first person', '2': 'second person', '3': 'third person' }

const NOUN_TYPE: Record<string, string> = { c: 'common', g: 'gentilic', p: 'proper name' }
const ADJ_TYPE: Record<string, string> = { a: 'adjective', c: 'cardinal number', g: 'gentilic', o: 'ordinal number' }
const PRON_TYPE: Record<string, string> = {
  d: 'demonstrative', f: 'indefinite', i: 'interrogative', p: 'personal', r: 'relative',
}
const PARTICLE: Record<string, string> = {
  a: 'affirmation', d: 'definite article', e: 'exhortation', i: 'interrogative',
  j: 'interjection', m: 'demonstrative', n: 'negative', o: 'direct object marker', r: 'relative',
}

const STEM_HINT: Record<string, string> = {
  q: 'The simple stem',
  N: 'The simple stem turned passive or reflexive',
  p: 'A stem with force, or a doing of the action',
  P: 'The passive of that forceful stem',
  h: 'A stem that causes the action',
  H: 'The passive of the causing stem',
  t: 'A stem in which the subject acts on itself',
}

const CONJ_HINT: Record<string, string> = {
  p: 'a finished act',
  q: 'a finished act in a chain, often still ahead',
  i: 'an unfinished act',
  w: 'the next step in a story',
  h: 'a resolve or a wish',
  j: 'a short wish or command',
  v: 'a command',
  r: 'someone doing it, or the act still going on',
  s: 'someone the act is done to',
  a: 'the act named by itself',
  c: 'the act tied to another word',
}

const ACTOR: Record<string, string> = {
  '3ms': 'he did it', '3fs': 'she did it', '3mp': 'they did it', '3fp': 'they did it',
  '2ms': 'you did it', '2fs': 'you did it', '2mp': 'you did it', '2fp': 'you did it',
  '1cs': 'I did it', '1cp': 'we did it',
}

function piece(code: string | undefined, table: Record<string, string>): string {
  if (!code || code === 'x') return ''
  return table[code] ?? ''
}

function bodyOf(morph: string): { aramaic: boolean; body: string } {
  if ((morph.startsWith('H') || morph.startsWith('A')) && morph.length > 1 && 'ACDNPRSTV'.includes(morph[1])) {
    return { aramaic: morph.startsWith('A'), body: morph.slice(1) }
  }
  return { aramaic: morph.startsWith('A'), body: morph }
}

export function explainMorph(morph: string): GrammarNote {
  if (!morph) return { line: 'Dictionary form. The parsing of this occurrence is not recorded here.', lessonIds: [] }
  if (/^[A-Z]{1,2}-/.test(morph) || /^[A-Z]{2}/.test(morph) && morph.length >= 10 && !morph.startsWith('H') && !morph.startsWith('A')) {
    return explainGreek(morph)
  }
  if (morph.startsWith('H') || morph.startsWith('A') || 'ACDNPRSTV'.includes(morph[0] ?? '')) return explainHebrew(morph)
  if (morph.length >= 10) return explainGreek(morph)
  return { line: 'A word of the original text.', lessonIds: [] }
}

function explainHebrew(morph: string): GrammarNote {
  const { aramaic, body } = bodyOf(morph)
  const pos = body[0] ?? ''
  const lessonIds: string[] = []
  if (pos === 'V') {
    const stemCode = body[1] ?? ''
    const conjCode = body[2] ?? ''
    const stem = (aramaic ? ARAMAIC_STEM[stemCode] : HEBREW_STEM[stemCode]) || 'verb'
    const conj = piece(conjCode, CONJ) || 'verb'
    const finite = 'pqihjv'.includes(conjCode)
    let rest = ''
    if (finite) {
      const person = piece(body[3], PERSON)
      const gender = piece(body[4], GENDER)
      const number = piece(body[5], NUMBER)
      rest = [person, gender, number].filter(Boolean).join(' ')
    } else {
      const gender = piece(body[3], GENDER)
      const number = piece(body[4], NUMBER)
      const state = piece(body[5], STATE)
      rest = [gender, number, state].filter(Boolean).join(' ')
      if (body[5] === 'c') lessonIds.push('state-c')
    }
    if (STEM_HINT[stemCode] && !aramaic) lessonIds.push(`stem-${stemCode}`)
    if ('piwvrc'.includes(conjCode)) lessonIds.push(`conj-${conjCode}`)
    const actor = ACTOR[`${body[3] ?? ''}${body[4] ?? ''}${body[5] ?? ''}`] ?? ''
    const hint = [STEM_HINT[stemCode] && !aramaic ? STEM_HINT[stemCode] : '', CONJ_HINT[conjCode] ?? '', finite ? actor : '']
      .filter(Boolean)
      .join(', ')
    const line = [`Verb. ${cap(stem)}, ${conj}${rest ? `, ${rest}` : ''}.`, hint ? `${cap(hint)}.` : '']
      .filter(Boolean)
      .join(' ')
    return { line, lessonIds }
  }
  if (pos === 'N' || pos === 'A') {
    const type = pos === 'N' ? piece(body[1], NOUN_TYPE) : piece(body[1], ADJ_TYPE)
    const gender = piece(body[2], GENDER)
    const number = piece(body[3], NUMBER)
    const state = piece(body[4], STATE)
    if (body[4] === 'c') lessonIds.push('state-c')
    const kind = pos === 'N' ? 'Noun' : 'Adjective'
    const bits = [type, gender, number, state].filter(Boolean).join(', ')
    const hint = body[4] === 'c' ? 'It leans on the word that follows.' : body[4] === 'a' ? 'It stands on its own.' : ''
    const line = bits ? `${kind}. ${cap(bits)}.${hint ? ` ${hint}` : ''}` : `${kind}.${hint ? ` ${hint}` : ''}`
    return { line, lessonIds }
  }
  if (pos === 'P') {
    const type = piece(body[1], PRON_TYPE)
    const person = piece(body[2], PERSON)
    const gender = piece(body[3], GENDER)
    const number = piece(body[4], NUMBER)
    const bits = [type, person, gender, number].filter(Boolean).join(', ')
    return { line: `Pronoun. ${cap(bits) || 'It stands in for a person or a thing.'}`, lessonIds }
  }
  if (pos === 'R') {
    const article = body[1] === 'd' ? ' The vowel shows the article is hiding in it.' : ''
    return { line: `Preposition. It ties this word to what follows.${article}`, lessonIds: [] }
  }
  if (pos === 'C') return { line: 'Conjunction. It joins what follows to what came before. Here it is “and.”', lessonIds: [] }
  if (pos === 'D') return { line: 'Adverb. It colors the word it belongs to.', lessonIds: [] }
  if (pos === 'T') {
    const type = piece(body[1], PARTICLE)
    if (body[1] === 'd') return { line: 'Article. The.', lessonIds: [] }
    if (body[1] === 'o') return { line: 'Particle. It marks the object of the verb, and English often leaves it untranslated.', lessonIds: [] }
    if (body[1] === 'n') return { line: 'Particle. It negates the word it governs.', lessonIds: [] }
    if (body[1] === 'i') return { line: 'Particle. It turns the clause into a question.', lessonIds: [] }
    if (body[1] === 'r') return { line: 'Particle. Who, which, or that.', lessonIds: [] }
    return { line: `Particle. ${cap(type) || 'A small word that shapes the phrase.'}`, lessonIds: [] }
  }
  if (pos === 'S') {
    const person = piece(body[2], PERSON)
    const gender = piece(body[3], GENDER)
    const number = piece(body[4], NUMBER)
    const who = [person, gender, number].filter(Boolean).join(' ')
    return { line: `Suffix. A pronoun attached to the word${who ? `: ${who}` : ''}.`, lessonIds: [] }
  }
  return { line: aramaic ? 'An Aramaic word.' : 'A Hebrew word.', lessonIds }
}

const GREEK_POS: Record<string, string> = {
  'A-': 'Adjective', 'C-': 'Conjunction', 'D-': 'Adverb', 'I-': 'Interjection', 'N-': 'Noun',
  'P-': 'Preposition', RA: 'Article', RD: 'Pronoun', RI: 'Pronoun', RP: 'Pronoun', RR: 'Pronoun',
  'V-': 'Verb', 'X-': 'Particle',
}

const TENSE: Record<string, string> = {
  P: 'present', I: 'imperfect', F: 'future', A: 'aorist', X: 'perfect', Y: 'pluperfect',
}
const VOICE: Record<string, string> = { A: 'active', M: 'middle', P: 'passive' }
const MOOD: Record<string, string> = {
  I: 'indicative', D: 'imperative', S: 'subjunctive', O: 'optative', N: 'infinitive', P: 'participle',
}
const CASE: Record<string, string> = { N: 'nominative', G: 'genitive', D: 'dative', A: 'accusative', V: 'vocative' }
const GNUM: Record<string, string> = { S: 'singular', P: 'plural' }
const GGENDER: Record<string, string> = { M: 'masculine', F: 'feminine', N: 'neuter' }

const TENSE_HINT: Record<string, string> = {
  P: 'The action is presented as going on, or simply as a fact.',
  I: 'The action was going on in the past.',
  F: 'The action is still ahead.',
  A: 'The action is presented as a whole.',
  X: 'A finished act whose result is still in view.',
  Y: 'A result that already stood in the past.',
}

function explainGreek(morph: string): GrammarNote {
  const pos = morph.slice(0, 2)
  const code = morph.slice(2).padEnd(8, '-')
  const kind = GREEK_POS[pos] ?? 'Word'
  const lessonIds: string[] = []
  if (pos === 'V-') {
    const tense = piece(code[1], TENSE)
    const voice = piece(code[2], VOICE)
    const mood = piece(code[3], MOOD)
    const person = code[0] !== '-' ? PERSON[code[0]] ?? '' : ''
    const number = piece(code[5], GNUM)
    const gender = piece(code[6], GGENDER)
    const caseName = piece(code[4], CASE)
    if (code[1] && code[1] !== '-') lessonIds.push(`tense-${code[1]}`)
    if (code[2] === 'M') lessonIds.push('voice-M')
    if (code[4] && 'NGDA'.includes(code[4])) lessonIds.push(`case-${code[4]}`)
    const bits = [tense, voice, mood, person, number, caseName, gender].filter(Boolean)
    const hint = TENSE_HINT[code[1]] ?? ''
    return { line: `${kind}. ${cap(bits.join(', '))}.${hint ? ` ${hint}` : ''}`, lessonIds }
  }
  const caseName = piece(code[4], CASE)
  const number = piece(code[5], GNUM)
  const gender = piece(code[6], GGENDER)
  if (caseName && 'NGDA'.includes(code[4])) lessonIds.push(`case-${code[4]}`)
  const bits = [caseName, number, gender].filter(Boolean)
  let job = ''
  if (pos === 'RA') job = ' It means “the.”'
  if (pos === 'P-') job = ' It links the word that follows.'
  if (pos === 'C-') job = ' It joins this clause to what came before.'
  if (pos === 'RP') job = ' It stands in for a person.'
  if (pos === 'RR') job = ' Who, which, or that.'
  return { line: `${kind}.${bits.length ? ` ${cap(bits.join(', '))}.` : ''}${job}`, lessonIds }
}

function cap(text: string): string {
  if (!text) return text
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export function lessonsFor(ids: string[]) {
  return ids.map((id) => lessonById(id)).filter((lesson): lesson is NonNullable<typeof lesson> => Boolean(lesson))
}

export function functionWord(word: string, morph: string): string {
  const { body } = bodyOf(morph)
  if (body.startsWith('C')) return 'and'
  if (body.startsWith('Td')) return 'the'
  if (body.startsWith('Ti')) return 'a question'
  if (body.startsWith('Tr')) return 'who, which, that'
  if (body.startsWith('To')) return 'marks the object'
  if (body.startsWith('R') || body === 'R') {
    const letter = [...word].find((char) => /[\u05D0-\u05EA]/.test(char))
    if (letter === 'ב') return 'in, with, by'
    if (letter === 'כ') return 'as, like'
    if (letter === 'ל') return 'to, for'
    if (letter === 'מ') return 'from'
    return 'a preposition'
  }
  if (morph.startsWith('RA')) return 'the'
  if (morph.startsWith('C-')) return 'and'
  return ''
}
