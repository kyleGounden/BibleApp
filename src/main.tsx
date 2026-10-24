import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/newsreader/400.css'
import '@fontsource/newsreader/600.css'
import '@fontsource/source-sans-3/400.css'
import '@fontsource/source-sans-3/600.css'
import './styles.css'
import { App } from './App'

const root = document.getElementById('root')
if (root) createRoot(root).render(<StrictMode><App /></StrictMode>)

const native = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
if (native?.isNativePlatform?.()) {
  void import('@capacitor/status-bar')
    .then(({ StatusBar, Style }) => {
      const theme = document.documentElement.dataset.theme
      const dark = theme === 'dusk' || theme === 'night'
      void StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light })
    })
    .catch(() => undefined)
}

if (import.meta.env.PROD && !native?.isNativePlatform?.() && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch(() => undefined)
  })
}
