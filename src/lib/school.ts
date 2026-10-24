export type RankName = 'novice' | 'reader' | 'exegete' | 'theologian'

export const RANKS: { id: RankName; label: string; line: string }[] = [
  { id: 'novice', label: 'Words', line: 'I can name the original word.' },
  { id: 'reader', label: 'Grammar', line: 'I can read its form.' },
  { id: 'exegete', label: 'Compare', line: 'I have read the translations and the sentences beside it.' },
  { id: 'theologian', label: 'Placed', line: 'I can say how the rest of Scripture speaks.' },
]

export function rankIndex(rank: RankName | undefined): number {
  if (!rank) return -1
  return RANKS.findIndex((item) => item.id === rank)
}

export type Lesson = { id: string; title: string; body: string }

const STEM: Lesson[] = [
  { id: 'stem-q', title: 'Qal', body: 'Qal is the simple stem. The verb does what its root says, with no extra force, cause, or passive built in. When you meet a new verb, learn the qal first. The other stems are that simple act, reshaped.' },
  { id: 'stem-N', title: 'Niphal', body: 'Niphal takes the simple act and turns it. Often the subject receives the action, or the action happens to the subject. Read it as passive or reflexive before you reach for a rarer sense.' },
  { id: 'stem-p', title: 'Piel', body: 'Piel puts force on the root, or makes the subject the one who does the act to someone else. It is not a different verb. It is the same root, spoken with weight.' },
  { id: 'stem-P', title: 'Pual', body: 'Pual is the passive partner of piel. The forceful act is received. If you know the piel of a root, the pual is that same act done to the subject.' },
  { id: 'stem-h', title: 'Hiphil', body: 'Hiphil causes the action. The subject brings it about that someone else does the root, or that the root happens. “He caused to know” is the shape of a hiphil, even when English says “he taught.”' },
  { id: 'stem-H', title: 'Hophal', body: 'Hophal is the passive of hiphil. The subject is caused to be in the state, or the causing is done to the subject. Pair it with the hiphil of the same root.' },
  { id: 'stem-t', title: 'Hithpael', body: 'Hithpael turns the action back on the subject, or sets the subject in motion about the act. It often reads as oneself, or as a showing of the act.' },
]

const CONJ: Lesson[] = [
  { id: 'conj-p', title: 'Perfect', body: 'The perfect presents the act as finished. In story it is often past. In a speech it can be a decision already made, or a state that simply is. Let the sentence tell you which.' },
  { id: 'conj-i', title: 'Imperfect', body: 'The imperfect presents the act as unfinished. It may be future, habitual, or possible. It does not by itself mean “will.” The clause around it decides.' },
  { id: 'conj-w', title: 'Wayyiqtol', body: 'Wayyiqtol is the story form. It usually takes the narrative one step forward: and then this happened. When you see it at the head of a clause in a narrative book, read it as the next event.' },
  { id: 'conj-v', title: 'Imperative', body: 'The imperative is a command, a request, or an urging, spoken to someone present. Person and gender tell you who is addressed.' },
  { id: 'conj-r', title: 'Participle', body: 'A participle names the doer, or the act as still going on. It can work as a verb (“was dwelling”) or as a noun (“the one who dwells”). The sentence shows which job it has.' },
  { id: 'conj-c', title: 'Infinitive construct', body: 'The infinitive construct names the act and ties it to another word: to do, by doing, when he did. It is not a finite verb with its own subject unless a noun or a suffix supplies one.' },
]

const STATE: Lesson = {
  id: 'state-c',
  title: 'Construct',
  body: 'A word in construct does not stand alone. It leans on the next word, the way “word of the Lord” is one phrase. Read the two words together before you translate either one.',
}

const TENSE: Lesson[] = [
  { id: 'tense-P', title: 'Present', body: 'The Greek present presents the action as going on, or simply states it. It is not always “is doing right now.” In a letter it often states what is true.' },
  { id: 'tense-I', title: 'Imperfect', body: 'The imperfect is a past action that was going on, was attempted, or was repeated. It leaves the act open, rather than presenting it as a single whole.' },
  { id: 'tense-F', title: 'Future', body: 'The future presents the action as still ahead. In promises and warnings, that is the point of the form. Context still decides how certain the speaker is.' },
  { id: 'tense-A', title: 'Aorist', body: 'The aorist presents the action as a whole. Often it is a past event, but the form itself does not mean “once only,” and it does not by itself prove a punctiliar act. Ask what whole the writer is looking at.' },
  { id: 'tense-X', title: 'Perfect', body: 'The Greek perfect presents a finished act with its result still in view. The emphasis is often on the state that remains, not only on the moment it happened.' },
  { id: 'tense-Y', title: 'Pluperfect', body: 'The pluperfect is a result that already stood at some moment in the past. Something had been done, and that state was in place before the next event.' },
]

const CASES: Lesson[] = [
  { id: 'case-N', title: 'Nominative', body: 'The nominative is the subject form, the one doing or being. When a noun and its article and adjectives share the nominative, they belong together as that subject.' },
  { id: 'case-G', title: 'Genitive', body: 'The genitive connects. Often it is “of,” “from,” or belonging. It also completes many verbs and prepositions. Read it with the word it depends on, not as a free noun.' },
  { id: 'case-D', title: 'Dative', body: 'The dative is the form of personal interest: to, for, in, or by. It is the indirect object, and the case many prepositions take. The preposition, when there is one, decides the English.' },
  { id: 'case-A', title: 'Accusative', body: 'The accusative is the direct object, the person or thing the action reaches. It is also the case of extent and of many prepositions. Match it to the verb before you add words the text does not have.' },
]

const VOICE: Lesson = {
  id: 'voice-M',
  title: 'Middle',
  body: 'The middle voice involves the subject in the action. Sometimes the subject acts on itself. Often in this Greek it simply means the action happens, with no active doing to someone else. Do not force “himself” into every middle.',
}

export const SHELVES: Record<string, { read: string; guard: string }> = {
  Law: {
    read: 'The Law tells how God formed a people and gave them his commands. Read a story as a story, and a command as a command to the people named in it.',
    guard: 'A statute binds the people it addresses. It does not, by itself, settle a question the text never asks.',
  },
  History: {
    read: 'The history books tell what happened in Israel’s life with God. The point is in the events and in the judgments the narrator makes, not in a hidden code under the names.',
    guard: 'A report of what someone did is not yet a command to imitate it. Watch whether the narrator praises the act.',
  },
  Writings: {
    read: 'The Writings include songs, wisdom, and reflection. Poetry says one thing and then says it again in a second line. A proverb describes how life generally goes. It is not a contract.',
    guard: 'A psalm is a prayer or a song in a real trouble or joy. Do not turn a line of poetry into a promise the poem never made.',
  },
  Prophets: {
    read: 'The prophets speak to their own hour, and often past it. Watch who is addressed, what sin or hope is named, and which later text in Scripture takes the words up.',
    guard: 'A prophecy is not a bin of free details. Read the oracle as a whole, then ask where the rest of Scripture carries it.',
  },
  Gospels: {
    read: 'Each Gospel tells the story of Jesus with its own shape. Read the scene in order: what he said, who heard, and what the narrator says it fulfilled.',
    guard: 'A word spoken to a crowd, a disciple, or an opponent belongs first to that moment. Ask how the Gospel itself uses it before you carry it elsewhere.',
  },
  Acts: {
    read: 'Acts tells the early life of the church as the word goes out from Jerusalem. Speeches and events interpret one another. A pattern in the story is not automatically a rule for every church.',
    guard: 'What the church once did in a particular hour is history. Draw a practice from it only where the book itself presents it as the ongoing way.',
  },
  Letters: {
    read: 'A letter is written to real people, about a real trouble or teaching. Read the whole argument. A sentence in the middle leans on the sentences before it.',
    guard: 'The recipients, the problem, and the gospel the letter already stated all limit what a verse can carry. Do not lift a clause out of the case the apostle is making.',
  },
  Revelation: {
    read: 'Revelation writes in images drawn from the prophets, to churches under pressure. Read an image with the Old Testament texts it echoes, and with the letters to the churches at the start.',
    guard: 'A symbol is not a puzzle with a private key. Let Scripture’s own use of the image govern it, and do not build a timetable the book does not count out.',
  },
}

const LESSONS = new Map<string, Lesson>(
  [...STEM, ...CONJ, STATE, ...TENSE, ...CASES, VOICE].map((lesson) => [lesson.id, lesson]),
)

export function lessonById(id: string): Lesson | undefined {
  return LESSONS.get(id)
}
