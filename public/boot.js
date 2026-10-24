try {
  var saved = JSON.parse(localStorage.getItem('scripture.v1') || '{}')
  var theme = saved.theme
  if (theme !== 'day' && theme !== 'dusk' && theme !== 'night') {
    theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'night' : 'day'
  }
  var colors = { day: '#f3efe6', dusk: '#2a241c', night: '#0e100e' }
  document.documentElement.dataset.theme = theme
  var meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', colors[theme] || colors.day)
} catch (e) {
  document.documentElement.dataset.theme = 'day'
}
