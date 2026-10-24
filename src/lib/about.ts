export type AboutStat = {
  value: number
  label: string
  soft?: boolean
}

export type AboutDoor = {
  id: string
  kicker: string
  title: string
  line: string
}

export type AboutWriter = {
  id: string
  nav: string
  name: string
  era: string
  place: string
  books: string
  line: string
  verse: string
}

export type AboutStation = {
  title: string
  line: string
  verses: string[]
}

export type AboutPair = {
  id: string
  title: string
  line: string
  older: string
  later: string
}

export type AboutCopy = {
  title: string
  figure: string
  line: string
}

export type AboutClose = {
  href: string
  kicker: string
  title: string
  line: string
}

export const ABOUT_HERO = {
  kicker: 'About the Bible',
  title: 'Forty writers. One story.',
  lede: 'About fifteen centuries, three continents, and three languages. They were not in the room together. The subject does not change.',
  verse: 'JHN.5.39',
}

export const ABOUT_STATS: AboutStat[] = [
  { value: 40, label: 'Writers', soft: true },
  { value: 1500, label: 'Years', soft: true },
  { value: 3, label: 'Continents' },
  { value: 66, label: 'Books' },
]

export const ABOUT_DOORS: AboutDoor[] = [
  {
    id: 'writers',
    kicker: 'The voices',
    title: 'They were not in the room',
    line: 'From Egypt to an island. None of them saw the whole.',
  },
  {
    id: 'plot',
    kicker: 'The story',
    title: 'One plot',
    line: 'A promise, a king, a cross, a throne.',
  },
  {
    id: 'spoken',
    kicker: 'The words',
    title: 'Spoken, then it happened',
    line: 'A city, a donkey, a piercing, a resurrection.',
  },
]

export const ABOUT_WRITERS_NOTE =
  'Scripture names about forty writers. Hebrews is unsigned, and some psalms never name a hand. These are the voices that carry the story from the first promise to the last.'

export const ABOUT_WRITERS: AboutWriter[] = [
  {
    id: 'moses',
    nav: 'Moses',
    name: 'Moses',
    era: 'The beginning',
    place: 'Egypt and the wilderness',
    books: 'Genesis through Deuteronomy',
    line: 'He writes the first promise. An offspring will crush the serpent.',
    verse: 'GEN.3.15',
  },
  {
    id: 'david',
    nav: 'David',
    name: 'David',
    era: 'The king',
    place: 'Jerusalem',
    books: 'The psalms',
    line: 'He sings of a lord who is also his son.',
    verse: 'PSA.110.1',
  },
  {
    id: 'isaiah',
    nav: 'Isaiah',
    name: 'Isaiah',
    era: 'Before the exile',
    place: 'Jerusalem',
    books: 'Isaiah',
    line: 'He writes of a servant, pierced for others.',
    verse: 'ISA.53.5',
  },
  {
    id: 'micah',
    nav: 'Micah',
    name: 'Micah',
    era: 'Before the exile',
    place: 'Judah',
    books: 'Micah',
    line: 'He names the town before the child is born.',
    verse: 'MIC.5.2',
  },
  {
    id: 'jeremiah',
    nav: 'Jeremiah',
    name: 'Jeremiah',
    era: 'The fall',
    place: 'Jerusalem, then Egypt',
    books: 'Jeremiah and Lamentations',
    line: 'He writes a new covenant, from Jerusalem and later from Egypt.',
    verse: 'JER.31.31',
  },
  {
    id: 'daniel',
    nav: 'Daniel',
    name: 'Daniel',
    era: 'Babylon',
    place: 'Babylon',
    books: 'Daniel',
    line: 'In exile he sees a son of man given a kingdom.',
    verse: 'DAN.7.13-14',
  },
  {
    id: 'zechariah',
    nav: 'Zechariah',
    name: 'Zechariah',
    era: 'After the exile',
    place: 'Jerusalem',
    books: 'Zechariah',
    line: 'He sees a king, lowly, riding on a donkey.',
    verse: 'ZEC.9.9',
  },
  {
    id: 'matthew',
    nav: 'Matthew',
    name: 'Matthew',
    era: 'The Gospel',
    place: 'Galilee and Judea',
    books: 'Matthew',
    line: 'He opens with the son of David, the son of Abraham.',
    verse: 'MAT.1.1',
  },
  {
    id: 'mark',
    nav: 'Mark',
    name: 'Mark',
    era: 'The Gospel',
    place: 'Jerusalem, then Rome',
    books: 'Mark',
    line: 'He calls it the beginning of the gospel of Jesus Christ.',
    verse: 'MRK.1.1',
  },
  {
    id: 'luke',
    nav: 'Luke',
    name: 'Luke',
    era: 'The Gospel',
    place: 'The Greek world',
    books: 'Luke and Acts',
    line: 'A physician sets down what the eyewitnesses delivered.',
    verse: 'LUK.1.3-4',
  },
  {
    id: 'john',
    nav: 'John',
    name: 'John',
    era: 'The Gospel',
    place: 'Ephesus',
    books: 'John',
    line: 'He writes that the Word became flesh.',
    verse: 'JHN.1.14',
  },
  {
    id: 'peter',
    nav: 'Peter',
    name: 'Peter',
    era: 'The witness',
    place: 'Galilee, then Rome',
    books: '1 and 2 Peter',
    line: 'He says the prophets searched their own words, and the subject was the sufferings of Christ.',
    verse: '1PE.1.10-12',
  },
  {
    id: 'paul',
    nav: 'Paul',
    name: 'Paul',
    era: 'The roads',
    place: 'The empire’s roads, a Roman prison',
    books: 'The letters',
    line: 'From the roads, and from prison, he passes on what he received.',
    verse: '1CO.15.3-4',
  },
  {
    id: 'patmos',
    nav: 'Patmos',
    name: 'John, on Patmos',
    era: 'The island',
    place: 'Patmos',
    books: 'Revelation',
    line: 'Years later, the same John is still waiting for him.',
    verse: 'REV.22.20',
  },
]

export const ABOUT_STATIONS: AboutStation[] = [
  {
    title: 'A seed',
    line: 'The first promise. An offspring who will crush the serpent.',
    verses: ['GEN.3.15'],
  },
  {
    title: 'The nations',
    line: 'Through Abraham, every family of the earth.',
    verses: ['GEN.12.3'],
  },
  {
    title: 'A king from Judah',
    line: 'The scepter stays until he comes.',
    verses: ['GEN.49.10'],
  },
  {
    title: 'A son of David',
    line: 'A throne that is not taken down.',
    verses: ['2SA.7.12-13'],
  },
  {
    title: 'A servant pierced',
    line: 'Wounded for our transgressions.',
    verses: ['ISA.53.5'],
  },
  {
    title: 'Bethlehem',
    line: 'Named centuries before. Then a child is born there.',
    verses: ['MIC.5.2', 'MAT.2.1'],
  },
  {
    title: 'The throne',
    line: 'The Lamb, and the kingdom.',
    verses: ['REV.5.12'],
  },
]

export const ABOUT_PAIRS: AboutPair[] = [
  {
    id: 'bethlehem',
    title: 'Bethlehem Ephratah',
    line: 'A ruler out of Bethlehem, written down long before the birth.',
    older: 'MIC.5.2',
    later: 'MAT.2.5-6',
  },
  {
    id: 'thy-king',
    title: 'Behold, thy King cometh',
    line: 'A king comes, lowly, riding on a donkey.',
    older: 'ZEC.9.9',
    later: 'MAT.21.4-5',
  },
  {
    id: 'pierced',
    title: 'They shall look upon me whom they pierced',
    line: 'They look on the one they pierced.',
    older: 'ZEC.12.10',
    later: 'JHN.19.37',
  },
  {
    id: 'not-leave',
    title: 'Thou wilt not leave my soul in hell',
    line: 'The Holy One is not left to decay. Peter says this is the resurrection.',
    older: 'PSA.16.8-11',
    later: 'ACT.2.25-31',
  },
]

export const ABOUT_LINKS = {
  lede: 'Later books quote earlier ones. The Gospels take up the Law and the prophets. On the road to Emmaus, Jesus says Moses and the prophets wrote of him.',
  verse: 'LUK.24.27',
  note: 'Isaiah 53 is one of the places the rest of the book keeps returning.',
  href: '/refs/ISA.53.5',
  action: 'Open its links',
}

export const ABOUT_COPIES_LEDE =
  'What can be checked is the copies. The New Testament is the best attested book to come out of the ancient world.'

export const ABOUT_COPIES: AboutCopy[] = [
  {
    title: 'The New Testament',
    figure: '5,800+',
    line: 'Greek manuscripts, and more in Latin, Coptic, and Syriac. A fragment of John is from the second century. Sinaiticus and Vaticanus are from the 300s.',
  },
  {
    title: 'The Great Isaiah Scroll',
    figure: '1,000 years',
    line: 'Copied about a century before Jesus. Set beside the Isaiah read a thousand years later, the words hold.',
  },
]

export const ABOUT_SCALE: AboutCopy[] = [
  {
    title: 'Homer’s Iliad',
    figure: '1,800',
    line: 'Manuscripts. The next book of the ancient world. Still a long step behind.',
  },
  {
    title: 'Caesar’s Gallic War',
    figure: '10',
    line: 'About ten good manuscripts. The earliest comes centuries after Caesar.',
  },
]

export const ABOUT_FATHERS =
  'Clement, Ignatius, Polycarp, Justin, and Irenaeus quote the Gospels and Paul while the generation after the apostles is still in living memory.'

export const ABOUT_CLOSE: AboutClose[] = [
  {
    href: '/read/JHN/1',
    kicker: 'Read',
    title: 'Open John 1',
    line: 'In the beginning was the Word.',
  },
  {
    href: '/prophecy',
    kicker: 'Prophecy',
    title: 'Walk the prophecies',
    line: 'Spoken, then taken up.',
  },
  {
    href: '/king',
    kicker: 'The King',
    title: 'Get to know the King',
    line: 'The subject of the book.',
  },
]
