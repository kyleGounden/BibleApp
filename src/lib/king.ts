export type KingPiece = { kind: 'prose'; text: string } | { kind: 'verse'; id: string }

export type KingChamber = {
  id: string
  nav: string
  title: string
  lede: string
  line: string
  verse: string
  pieces: KingPiece[]
}

export type KingName = {
  title: string
  line: string
  verses: string[]
}

export type KingStation = {
  title: string
  line: string
  verses: string[]
  book: string
  chapter: number
}

export type KingRead = {
  title: string
  line: string
  book: string
  chapter: number
}

export const KING_HERO = {
  kicker: 'The King',
  title: 'Get to know the King of kings',
  lede: 'The name Christian came after. This is a person. He said he is the way, the truth, and the life.',
  verses: ['JHN.14.6', 'REV.19.16'],
}

export const KING_DOORS = [
  {
    section: 'meet',
    kicker: 'Start here',
    title: 'I have never heard of him',
    line: 'Meet the person. The name came later.',
  },
  {
    section: 'scriptures',
    kicker: 'Go further',
    title: 'I want to go further',
    line: 'He said Moses and the prophets speak of him.',
  },
]

export const KING_CHAMBERS: KingChamber[] = [
  {
    id: 'meet',
    nav: 'Meet',
    title: 'Meet him',
    lede: 'A person, before any name was given to his followers.',
    line: 'Who he is, before the name.',
    verse: 'JHN.1.1',
    pieces: [
      { kind: 'prose', text: 'Before anyone was called a Christian, there was a man. John begins with who he is.' },
      { kind: 'verse', id: 'JHN.1.1' },
      { kind: 'verse', id: 'JHN.1.14' },
      { kind: 'prose', text: 'He was born in David’s city. The announcement was Savior, Christ the Lord.' },
      { kind: 'verse', id: 'LUK.2.11' },
      { kind: 'prose', text: 'He said why he came: not to be served, but to give his life.' },
      { kind: 'verse', id: 'MRK.10.45' },
      { kind: 'prose', text: 'In Antioch the disciples were first called Christians. The name followed people who already belonged to him.' },
      { kind: 'verse', id: 'ACT.11.26' },
    ],
  },
  {
    id: 'way',
    nav: 'The way',
    title: 'The only way',
    lede: 'He did not offer one path among many. He said he is the way.',
    line: 'The way, the truth, and the life.',
    verse: 'JHN.14.6',
    pieces: [
      { kind: 'prose', text: 'These are his words, and the words of those who walked with him. Eternal life, as he named it, is knowing the Father and the one he sent.' },
      { kind: 'verse', id: 'JHN.14.6' },
      { kind: 'verse', id: 'JHN.3.16' },
      { kind: 'verse', id: 'ACT.4.12' },
      { kind: 'verse', id: '1TI.2.5' },
      { kind: 'verse', id: 'JHN.10.9' },
      { kind: 'verse', id: 'JHN.17.3' },
    ],
  },
  {
    id: 'names',
    nav: 'Names',
    title: 'His names',
    lede: 'Scripture gives him names. Each one is a door.',
    line: 'What the Scriptures call him.',
    verse: 'REV.19.16',
    pieces: [
      { kind: 'prose', text: 'Open a name. The verse is the meaning.' },
    ],
  },
  {
    id: 'story',
    nav: 'Story',
    title: 'His story',
    lede: 'Promised, born, crucified, raised, and coming.',
    line: 'From the promise to the day he comes.',
    verse: 'GEN.3.15',
    pieces: [
      { kind: 'prose', text: 'The story is one thread. Each station opens the chapter where it is told.' },
    ],
  },
  {
    id: 'words',
    nav: 'Words',
    title: 'His words',
    lede: 'He said who he is, and he invited people to come.',
    line: 'What he said about himself.',
    verse: 'JHN.6.35',
    pieces: [
      { kind: 'prose', text: 'In the Gospel of John he says “I am,” and then he names what he is for the one who comes to him.' },
      { kind: 'verse', id: 'JHN.6.35' },
      { kind: 'verse', id: 'JHN.8.12' },
      { kind: 'verse', id: 'JHN.10.9' },
      { kind: 'verse', id: 'JHN.10.11' },
      { kind: 'verse', id: 'JHN.11.25' },
      { kind: 'verse', id: 'JHN.14.6' },
      { kind: 'verse', id: 'JHN.15.5' },
      { kind: 'prose', text: 'He also takes the name God gave to Moses.' },
      { kind: 'verse', id: 'JHN.8.58' },
      { kind: 'prose', text: 'The call is to come to him, and to rest.' },
      { kind: 'verse', id: 'MAT.11.28-30' },
      { kind: 'prose', text: 'He gave his own a new commandment.' },
      { kind: 'verse', id: 'JHN.13.34-35' },
    ],
  },
  {
    id: 'cross',
    nav: 'The cross',
    title: 'Why he came',
    lede: 'The cross is how he saves. The resurrection is how we know it held.',
    line: 'Why the cross, and why the empty tomb.',
    verse: 'ROM.3.23',
    pieces: [
      { kind: 'prose', text: 'Scripture names the need without softening it.' },
      { kind: 'verse', id: 'ROM.3.23' },
      { kind: 'prose', text: 'The servant carries what was not his. The one who knew no sin is made sin, so that others might receive his righteousness. He stands in their place.' },
      { kind: 'verse', id: 'ISA.53.5-6' },
      { kind: 'verse', id: '2CO.5.21' },
      { kind: 'verse', id: '1PE.2.24' },
      { kind: 'prose', text: 'He was delivered for offences and raised again. The cross and the resurrection belong together.' },
      { kind: 'verse', id: 'ROM.4.25' },
      { kind: 'prose', text: 'What he gives is not a wage. Faith receives him.' },
      { kind: 'verse', id: 'EPH.2.8-9' },
      { kind: 'verse', id: 'JHN.1.12' },
      { kind: 'verse', id: 'ROM.10.9' },
    ],
  },
  {
    id: 'with',
    nav: 'With him',
    title: 'With him',
    lede: 'Belonging to him is older than the name Christian.',
    line: 'A relationship, not a label.',
    verse: 'JHN.15.5',
    pieces: [
      { kind: 'prose', text: 'He does not ask to be admired from far off. He tells his own to remain in him.' },
      { kind: 'verse', id: 'JHN.15.4-5' },
      { kind: 'prose', text: 'He calls them friends, and he lets them in on what he is doing.' },
      { kind: 'verse', id: 'JHN.15.15' },
      { kind: 'prose', text: 'The shepherd knows his own by name.' },
      { kind: 'verse', id: 'JHN.10.14' },
      { kind: 'prose', text: 'They ask in his name, and he asks the Father for the Spirit to stay with them.' },
      { kind: 'verse', id: 'JHN.14.13-17' },
      { kind: 'prose', text: 'Those who belong to him are his body. The name Christian, given at Antioch, came after this belonging.' },
      { kind: 'verse', id: 'EPH.1.22-23' },
      { kind: 'verse', id: 'ACT.11.26' },
    ],
  },
  {
    id: 'witness',
    nav: 'Witnesses',
    title: 'Witnesses',
    lede: 'The Gospels were written so that we might believe.',
    line: 'Those who saw him, and wrote it down.',
    verse: 'JHN.20.31',
    pieces: [
      { kind: 'prose', text: 'Luke says he traced the account carefully. John says he wrote so that you might believe, and have life in his name.' },
      { kind: 'verse', id: 'LUK.1.1-4' },
      { kind: 'verse', id: 'JHN.20.30-31' },
      { kind: 'prose', text: 'John writes as one who heard, saw, and touched.' },
      { kind: 'verse', id: '1JN.1.1-3' },
      { kind: 'prose', text: 'Paul passes on what he received, and he names the witnesses. Any line here can be opened in Study.' },
      { kind: 'verse', id: '1CO.15.3-8' },
    ],
  },
  {
    id: 'scriptures',
    nav: 'Beginning',
    title: 'From the beginning',
    lede: 'He said the Scriptures speak of him.',
    line: 'The older Scriptures, read toward him.',
    verse: 'LUK.24.27',
    pieces: [
      { kind: 'prose', text: 'On the Emmaus road he began with Moses and all the prophets. He told the leaders that the Scriptures testify about him.' },
      { kind: 'verse', id: 'LUK.24.27' },
      { kind: 'verse', id: 'JHN.5.39' },
      { kind: 'prose', text: 'The promise starts in the garden: a seed who will bruise the serpent.' },
      { kind: 'verse', id: 'GEN.3.15' },
      { kind: 'prose', text: 'Abraham is told that in his offspring all nations will be blessed. Paul says that offspring is Christ.' },
      { kind: 'verse', id: 'GEN.22.18' },
      { kind: 'verse', id: 'GAL.3.16' },
      { kind: 'prose', text: 'The Passover house is spared by the blood. Paul says Christ is our Passover.' },
      { kind: 'verse', id: 'EXO.12.13' },
      { kind: 'verse', id: '1CO.5.7' },
      { kind: 'prose', text: 'Moses lifted a serpent so the dying would look and live. Jesus says the Son of Man must be lifted up in the same way.' },
      { kind: 'verse', id: 'NUM.21.9' },
      { kind: 'verse', id: 'JHN.3.14-15' },
      { kind: 'prose', text: 'Isaiah’s servant is pierced for others.' },
      { kind: 'verse', id: 'ISA.53.4-6' },
      { kind: 'prose', text: 'He cried the first line of this psalm from the cross, and the psalm goes on to the piercing. He also asked how David could call him Lord, and he quoted the next psalm.' },
      { kind: 'verse', id: 'PSA.22.1' },
      { kind: 'verse', id: 'PSA.22.16-18' },
      { kind: 'verse', id: 'PSA.110.1' },
      { kind: 'verse', id: 'MAT.22.44' },
    ],
  },
  {
    id: 'reign',
    nav: 'Reign',
    title: 'King forever',
    lede: 'The name above every name, and a reign that does not end.',
    line: 'King of kings, and Lord of lords.',
    verse: 'PHP.2.9',
    pieces: [
      { kind: 'prose', text: 'God exalted him and gave him the name above every name.' },
      { kind: 'verse', id: 'PHP.2.9-11' },
      { kind: 'prose', text: 'The kingdom of the world becomes his, and his name is written where every eye can read it.' },
      { kind: 'verse', id: 'REV.11.15' },
      { kind: 'verse', id: 'REV.19.16' },
      { kind: 'prose', text: 'The story ends with God dwelling with his people, and making all things new.' },
      { kind: 'verse', id: 'REV.21.3-5' },
    ],
  },
  {
    id: 'begin',
    nav: 'Begin',
    title: 'Begin',
    lede: 'A first path through John, and two verses to keep.',
    line: 'Read John, and keep two verses.',
    verse: 'JHN.1.1',
    pieces: [
      { kind: 'prose', text: 'If you have never read him, start in John. These chapters are enough to meet him. Each one opens in the reader.' },
      { kind: 'prose', text: 'Then keep two sentences where you will see them again, in the translation you are reading.' },
    ],
  },
]

export const KING_NAMES: KingName[] = [
  { title: 'King of kings', line: 'The title written on him when he comes.', verses: ['REV.19.16', '1TI.6.15'] },
  { title: 'Lord', line: 'The name above every name.', verses: ['PHP.2.9-11'] },
  { title: 'Christ', line: 'The Messiah, the Son of the living God.', verses: ['MAT.16.16', 'JHN.1.41'] },
  { title: 'Son of God', line: 'Written so that we might believe.', verses: ['JHN.20.31'] },
  { title: 'Son of Man', line: 'The one Daniel saw, coming with the clouds.', verses: ['DAN.7.13-14', 'MAT.26.64'] },
  { title: 'Immanuel', line: 'God with us.', verses: ['ISA.7.14', 'MAT.1.23'] },
  { title: 'Lamb', line: 'The one who takes away the sin of the world.', verses: ['JHN.1.29'] },
  { title: 'Shepherd', line: 'The good shepherd lays down his life.', verses: ['JHN.10.11'] },
  { title: 'I am', line: 'Before Abraham was, I am.', verses: ['JHN.8.58'] },
  { title: 'Light', line: 'Whoever follows him will not walk in darkness.', verses: ['JHN.8.12'] },
  { title: 'Bread', line: 'Whoever comes to him will not hunger.', verses: ['JHN.6.35'] },
  { title: 'Resurrection', line: 'Whoever believes in him will live.', verses: ['JHN.11.25'] },
  { title: 'Vine', line: 'Apart from him, his own can do nothing.', verses: ['JHN.15.1', 'JHN.15.5'] },
  { title: 'Lion', line: 'The Lion of Judah has prevailed.', verses: ['REV.5.5'] },
  { title: 'Alpha and Omega', line: 'The beginning and the end.', verses: ['REV.22.13'] },
  { title: 'Savior', line: 'Born in the city of David.', verses: ['LUK.2.11'] },
  { title: 'The Word', line: 'In the beginning, with God, and God.', verses: ['JHN.1.1'] },
]

export const KING_STATIONS: KingStation[] = [
  {
    title: 'Promised',
    line: 'The seed, the child, the servant.',
    verses: ['GEN.3.15', 'ISA.9.6', 'MIC.5.2', 'ISA.53.5-6'],
    book: 'GEN',
    chapter: 3,
  },
  {
    title: 'Born',
    line: 'Savior, Christ the Lord, God with us.',
    verses: ['LUK.2.11', 'MAT.1.23'],
    book: 'LUK',
    chapter: 2,
  },
  {
    title: 'Baptized and tested',
    line: 'The Father names him. The wilderness does not move him.',
    verses: ['MAT.3.16-17', 'MAT.4.1-4'],
    book: 'MAT',
    chapter: 3,
  },
  {
    title: 'Teaching and healing',
    line: 'The kingdom is at hand, and he opens his mouth on the mountain.',
    verses: ['MRK.1.14-15', 'MAT.5.1-6', 'MAT.5.7-12'],
    book: 'MAT',
    chapter: 5,
  },
  {
    title: 'The cross',
    line: 'It is finished.',
    verses: ['JHN.19.30', 'MRK.15.37-39'],
    book: 'JHN',
    chapter: 19,
  },
  {
    title: 'The resurrection',
    line: 'He is not here. He is risen.',
    verses: ['LUK.24.6-7', 'JHN.20.19-20', '1CO.15.3-4'],
    book: 'LUK',
    chapter: 24,
  },
  {
    title: 'Ascended',
    line: 'A cloud received him, and the promise of his return was spoken in the same breath.',
    verses: ['ACT.1.9-11'],
    book: 'ACT',
    chapter: 1,
  },
  {
    title: 'Coming again',
    line: 'This same Jesus, and the name King of kings.',
    verses: ['ACT.1.11', 'REV.19.11-16'],
    book: 'REV',
    chapter: 19,
  },
]

export const KING_READS: KingRead[] = [
  { title: 'John 1', line: 'The Word became flesh.', book: 'JHN', chapter: 1 },
  { title: 'John 3', line: 'God so loved the world.', book: 'JHN', chapter: 3 },
  { title: 'John 10', line: 'The good shepherd.', book: 'JHN', chapter: 10 },
  { title: 'John 14', line: 'The way, the truth, and the life.', book: 'JHN', chapter: 14 },
  { title: 'John 19', line: 'It is finished.', book: 'JHN', chapter: 19 },
  { title: 'John 20', line: 'He showed them his hands.', book: 'JHN', chapter: 20 },
]

export const KING_KEEP = ['JHN.14.6', 'JHN.3.16']

export function kingChamber(id: string | undefined): KingChamber | undefined {
  if (!id) return undefined
  return KING_CHAMBERS.find((chamber) => chamber.id === id)
}

export function kingNext(id: string): KingChamber | undefined {
  const index = KING_CHAMBERS.findIndex((chamber) => chamber.id === id)
  if (index < 0) return undefined
  return KING_CHAMBERS[index + 1]
}
