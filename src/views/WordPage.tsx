import { useEffect, useState } from 'react'
import { loadConcord, loadGloss, loadStrongShard, type Gloss } from '../lib/bible'
import { go, type Route } from '../lib/router'
import { useAppState } from '../lib/storage'
import { WordLesson } from '../teach'
import { HitList } from '../ui'

export function WordPage({ route }: { route: Extract<Route, { name: 'word' | 'strong' }> }) {
  const state = useAppState()
  const [ids, setIds] = useState<string[]>([])
  const [total, setTotal] = useState(0)
  const [gloss, setGloss] = useState<Gloss | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let live = true
    setReady(false)
    if (route.name === 'word') {
      const word = route.word.toLowerCase()
      const letter = /[a-z]/.test(word[0] ?? '') ? word[0] : 'a'
      loadConcord(letter).then((file) => {
        if (!live) return
        const entry = file[word]
        setIds(entry?.v ?? [])
        setTotal(entry?.n ?? 0)
        setGloss(null)
        setReady(true)
      })
    } else {
      Promise.all([loadStrongShard(route.id), loadGloss()]).then(([file, all]) => {
        if (!live) return
        const list = file[route.id] ?? []
        setIds(list)
        setTotal(list.length)
        setGloss(all[route.id] ?? null)
        setReady(true)
      })
    }
    return () => {
      live = false
    }
  }, [route])

  const title = route.name === 'word' ? route.word : route.id
  return (
    <div>
      <button type="button" className="text-btn" onClick={() => go('/canon')}>Back</button>
      <p className="kicker">{route.name === 'word' ? 'English word' : 'Strong’s number'}</p>
      <h1>{title}</h1>
      {route.name === 'strong' && gloss ? (
        <>
          <WordLesson
            word={{ w: gloss.l || route.id, m: '', s: route.id }}
            gloss={gloss}
            language={route.id.startsWith('G') ? 'Greek' : 'Hebrew'}
          />
          <p className="lede">{gloss.g}</p>
        </>
      ) : null}
      {ready ? (
        <p className="quiet">
          {total} {total === 1 ? 'place' : 'places'}
          {ids.length < total ? ` · showing ${ids.length}` : ''}
        </p>
      ) : (
        <p className="quiet">Gathering the verses…</p>
      )}
      <HitList
        ids={ids}
        translation={state.translation}
        readKey={route.name === 'word' ? `word:${route.word}:${state.translation}` : `strong:${route.id}:${state.translation}`}
        readTitle={title}
      />
    </div>
  )
}
