export type ReturnViewId = 'amill' | 'postmill' | 'premill'

export type ReturnSign = 'millennium' | 'direction' | 'satan' | 'antichrist'

export type ReturnStation = {
  id: string
  nav: string
  title: string
  claim: string
  line?: string
  note?: string
  verses: string[]
  now?: boolean
  sign?: ReturnSign
  strong?: string
}

export type ReturnTrack = {
  id: ReturnViewId
  nav: string
  title: string
  lede: string
  held?: boolean
  stations: ReturnStation[]
}

export type ReturnStep = {
  scope: 'shared' | ReturnViewId
  station: ReturnStation
}

export const RETURN_HERO = {
  kicker: 'The return',
  title: 'When he comes again',
  lede: 'He came, he died, he rose, and he said he would come again to judge. Seven signs stand on the way. The last four are read three ways.',
}

export const RETURN_TRUNK: ReturnStation[] = [
  {
    id: 'cross',
    nav: 'The promise',
    title: 'He will come again',
    claim: 'About two thousand years ago he came, died, and rose. He promised to return. That return is to judge the earth.',
    verses: ['JHN.14.3', 'ACT.1.11', 'MAT.25.31'],
  },
  {
    id: 'birth',
    nav: 'Birth pains',
    title: 'Birth pains',
    claim: 'Nation rises against nation, and kingdom against kingdom, with famine, pestilence, and earthquakes. He called these the beginning of sorrows. The word is the pain of birth: a long waiting, then the contractions, and the birth is near. We read “nation against nation” as the whole world at war, and set the first world war here.',
    verses: ['MAT.24.7-8'],
  },
  {
    id: 'hate',
    nav: 'Persecution',
    title: 'Hated by all nations',
    claim: 'He said his followers would be arrested, hated, and killed. We set the present age here. About 365 million Christians, one in seven, live under that hatred. In places such as Iran and North Korea, a house church is treated as a threat.',
    verses: ['MAT.24.9'],
  },
  {
    id: 'prophets',
    nav: 'False prophets',
    title: 'False prophets',
    claim: 'After the hatred come voices that lead many away from him. A great following is easy to gather. The test is whether people hang on that voice, or on his word. Here the readings divide. The next four signs are not agreed.',
    verses: ['MAT.24.11'],
  },
]

export const RETURN_TRACKS: ReturnTrack[] = [
  {
    id: 'amill',
    nav: 'Amillennial',
    title: 'Amillennial',
    lede: 'The thousand years are this age, a figure for life in Christ, from the cross until he returns.',
    stations: [
      {
        id: 'age',
        nav: 'A figure',
        title: 'The thousand years are now',
        sign: 'millennium',
        line: 'A figure for life in Christ, from the cross until he returns.',
        claim: 'The thousand years are a figure for the life his people have in him. They began when he died and rose, and they run until he returns. The peace in the prophecy is the prosperity of that life.',
        verses: ['REV.20.4-6'],
      },
      {
        id: 'worse',
        nav: 'Growing worse',
        title: 'The world grows worse',
        sign: 'direction',
        line: 'The age grows darker as his coming nears.',
        claim: 'Evil thickens as the coming draws near. What has improved in two thousand years is covered by a greater dark. Evil men and impostors grow worse and worse. The first three signs are read as the evidence.',
        verses: ['2TI.3.13', 'MAT.24.12'],
      },
      {
        id: 'restrained',
        nav: 'Restrained',
        title: 'Satan restrained at the cross',
        sign: 'satan',
        line: 'His power was held back at the cross.',
        claim: 'The binding is placed at the cross. Satan’s power is held back through this age. The abyss is read as that restraint.',
        verses: ['REV.20.1-3'],
      },
      {
        id: 'spirit',
        nav: 'A spirit',
        title: 'A deceiving spirit',
        sign: 'antichrist',
        line: 'A spirit that deceives the nations.',
        claim: 'The man of sin is read as a spirit that deceives the nations, already at work, and due to be ended when Christ appears.',
        verses: ['2TH.2.3-8', '1JN.4.3'],
      },
      {
        id: 'return',
        nav: 'He returns',
        title: 'He returns after this age',
        claim: 'This age closes when he comes. The thousand years, read as the present life of his people, stand behind that coming.',
        verses: ['MAT.24.30', 'REV.22.20'],
      },
    ],
  },
  {
    id: 'postmill',
    nav: 'Postmillennial',
    title: 'Postmillennial',
    lede: 'The gospel christianizes the nations, a literal peace follows, and he returns after it.',
    stations: [
      {
        id: 'gospel',
        nav: 'The gospel',
        title: 'The earth is christianized',
        claim: 'The thousand years begin as the church carries the gospel through the nations. When the world has been christianized, the peace follows, and only then does he return.',
        verses: ['MAT.28.19', 'ISA.2.2-4'],
      },
      {
        id: 'recedes',
        nav: 'Evil recedes',
        title: 'Evil grows thin',
        sign: 'direction',
        line: 'Evil thins as the nations are christianized.',
        claim: 'This reading expects the world to grow kinder as the gospel takes hold. It points to mercy that was missing centuries ago, and to Christian care in almost every land. How near he is, is read from how far the gospel has gone.',
        verses: ['ISA.11.9'],
      },
      {
        id: 'church',
        nav: 'Bound by the church',
        title: 'The church binds Satan',
        sign: 'satan',
        line: 'The church binds him as the peace begins.',
        claim: 'Satan is bound by the church as it ushers in the thousand years. The binding belongs to the spread of the gospel, ahead of Christ’s return.',
        verses: ['REV.20.1-3'],
      },
      {
        id: 'peace',
        nav: 'A thousand years',
        title: 'A literal peace',
        sign: 'millennium',
        line: 'A real peace on earth, after the gospel has filled the nations, and before he returns.',
        claim: 'The thousand years are a real stretch of peace, prosperity, and righteousness on the earth. The animals that once fed on each other are quiet. Christ returns when those years are finished.',
        verses: ['ISA.11.6-9', 'REV.20.4-6'],
      },
      {
        id: 'spirit',
        nav: 'A spirit',
        title: 'A spirit among the nations',
        sign: 'antichrist',
        line: 'A deceiving spirit, already in the world.',
        claim: 'Most who hold this reading take the antichrist as a deceiving spirit among the nations, the mystery of lawlessness already at work.',
        verses: ['1JN.2.18', '2TH.2.7'],
      },
      {
        id: 'return',
        nav: 'He returns',
        title: 'He returns after the peace',
        claim: 'The order is the peace, and then his coming. The thousand years finish before he appears to judge.',
        verses: ['REV.20.7-10', 'MAT.24.30'],
      },
    ],
  },
  {
    id: 'premill',
    nav: 'Premillennial',
    title: 'Premillennial',
    lede: 'His people are caught up to meet him. Then the seven years. Then he returns, reigns a thousand years, judges the dead, and makes all things new.',
    held: true,
    stations: [
      {
        id: 'worse',
        nav: 'Now',
        title: 'The world grows worse',
        sign: 'direction',
        now: true,
        line: 'The age grows darker. We stand here.',
        claim: 'The birth pains, the hatred, and the false prophets are treated as present. This reading expects the age to darken toward his coming. Evil men and impostors grow worse and worse. The improvements of two thousand years are real, and a greater dark covers them.',
        verses: ['2TI.3.13', 'MAT.24.12'],
      },
      {
        id: 'caught',
        nav: 'Caught up',
        title: 'Caught up',
        line: 'The church is snatched up to meet him, before the seven years.',
        claim: 'The Lord himself descends from heaven with a shout, with the voice of the archangel, and with the trumpet of God. The dead in Christ rise first. Then we who are alive are caught up together with them in the clouds, to meet the Lord in the air, and so we are always with him. The living are changed in a moment. That meeting is in the air, before the man of sin and the seven years. His coming in glory to the earth is the later stop on this line. The English “caught up” is the Greek verb in this verse. The English word rapture is the Latin of that same verb.',
        strong: 'G726',
        verses: ['1TH.4.16-17', '1CO.15.51-52'],
      },
      {
        id: 'man',
        nav: 'A man',
        title: 'A man of sin',
        sign: 'antichrist',
        line: 'A literal man, a false peace, then seven years of trouble.',
        claim: 'A literal man claims to be God and draws the world to worship him. He brings a false peace, then seven years of trouble. This follows the catching up. Christ returns and destroys him.',
        note: 'We hold this reading because we take the passages literally: a man, seven years, and a kingdom you could walk in.',
        verses: ['2TH.2.3-8', 'DAN.9.27'],
      },
      {
        id: 'coming',
        nav: 'He returns',
        title: 'He returns in glory',
        claim: 'He comes in glory, ends the trouble, and destroys the man of sin with the breath of his mouth.',
        verses: ['REV.19.11-16', '2TH.2.8'],
      },
      {
        id: 'abyss',
        nav: 'The abyss',
        title: 'Satan is shut away',
        sign: 'satan',
        line: 'He is locked in the abyss after Christ returns.',
        claim: 'After Christ returns, Satan is seized, thrown into the abyss, and locked there for the thousand years, so he cannot deceive the nations while Christ reigns.',
        verses: ['REV.20.1-3'],
      },
      {
        id: 'reign',
        nav: 'A thousand years',
        title: 'He reigns a thousand years',
        sign: 'millennium',
        line: 'A real thousand years, and only after he has returned to reign.',
        claim: 'The peace is physical. It begins when he has come back to the earth. He reigns for a thousand years. The wolf lives with the lamb, and the animals that once fed on each other are quiet.',
        verses: ['REV.20.4-6', 'ISA.11.6-9'],
      },
      {
        id: 'judgment',
        nav: 'The judgment',
        title: 'The last judgment',
        claim: 'When the thousand years end, Satan is released for a little while. Then the dead are judged, each according to what is written. After that, this earth is finished.',
        verses: ['REV.20.7-10', 'REV.20.11-15'],
      },
      {
        id: 'new',
        nav: 'All things new',
        title: 'A new heaven and a new earth',
        claim: 'He makes a new heaven and a new earth. Death is gone. That age does not end.',
        verses: ['REV.21.1-5'],
      },
    ],
  },
]

export function isReturnView(value: string | undefined): value is ReturnViewId {
  return value === 'amill' || value === 'postmill' || value === 'premill'
}

export function returnTrack(id: ReturnViewId): ReturnTrack {
  const track = RETURN_TRACKS.find((item) => item.id === id)
  if (!track) throw new Error(`Unknown return view: ${id}`)
  return track
}

export function returnSequence(view: ReturnViewId | null): ReturnStep[] {
  const trunk = RETURN_TRUNK.map((station) => ({ scope: 'shared' as const, station }))
  if (!view) return trunk
  return [...trunk, ...returnTrack(view).stations.map((station) => ({ scope: view, station }))]
}

export function returnHref(view: ReturnViewId | null, stationId: string): string {
  if (!view) return `/return/shared/${stationId}`
  return `/return/${view}/${stationId}`
}

export function resolveReturn(view: string | undefined, station: string | undefined): { view: ReturnViewId | null; step: ReturnStep } {
  const chosen = isReturnView(view) ? view : null
  const sequence = returnSequence(chosen)
  if (chosen && !station) {
    const track = returnTrack(chosen)
    const landing = track.stations.find((item) => item.now) ?? track.stations[0]
    return { view: chosen, step: { scope: chosen, station: landing } }
  }
  const found = sequence.find((step) => step.station.id === station)
  if (found) return { view: chosen, step: found }
  if (chosen) {
    const onTrack = returnTrack(chosen).stations.find((item) => item.id === station)
    if (onTrack) return { view: chosen, step: { scope: chosen, station: onTrack } }
  }
  return { view: chosen, step: sequence[0] }
}

export function readingsOf(sign: ReturnSign): { view: ReturnViewId; station: ReturnStation }[] {
  return RETURN_TRACKS.flatMap((track) => {
    const station = track.stations.find((item) => item.sign === sign)
    return station ? [{ view: track.id, station }] : []
  })
}

export function nowStep(): ReturnStep {
  const track = returnTrack('premill')
  const station = track.stations.find((item) => item.now) ?? track.stations[0]
  return { scope: 'premill', station }
}
