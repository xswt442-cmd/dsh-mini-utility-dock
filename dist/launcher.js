// Family utility launcher shared by the browser halves of the DSH plugins.
//
// This fragment has ONE source of truth: dsh-mini-utility-dock/dist/launcher.js.
// DSH client artifacts are self-contained classic scripts, so the fragment is
// embedded into lib/client.js at build time by
//   npm run launcher:sync    (write it)
//   npm run launcher:check   (fail on drift)
// instead of being imported: a bare import would put a runtime dependency on the
// dock into every plugin, and the whole point of the dock is that a plugin ships
// standalone, with nothing else required.
//
// The launcher is one icon that opens a menu of family panels. It is contributed
// through slots, not through a page-local protocol: exactly one copy of this
// assembly runs per page (the first plugin to load wins the window mutex and
// declares the menu seat), and every plugin adds one row to that seat.
const UTILITY_ITEM_SLOT = 'createhelper.utility.item'
const UTILITY_MUTEX_KEY = '__CREATEHELPER_DSH_UTILITY_LAUNCHER_V1__'
const UTILITY_CSS_ID = 'createhelper-utility-launcher'
const UTILITY_FALLBACK_LEFT_PX = 80
const UTILITY_MEASURE_TRIES = 120
const UTILITY_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="2"></rect><rect x="14" y="3" width="7" height="7" rx="2"></rect><rect x="3" y="14" width="7" height="7" rx="2"></rect><rect x="14" y="14" width="7" height="7" rx="2"></rect></svg>'

// The launcher's own chrome, injected once by whichever copy wins the mutex.
// The rows belong to other plugins, so the menu styles its own buttons by
// position instead of asking every contributor for a class name.
function ensureUtilityStyles() {
  if (typeof document === 'undefined') return
  if (document.querySelector('style[data-plugin-css="' + UTILITY_CSS_ID + '"]') !== null) return
  const styleEl = document.createElement('style')
  styleEl.setAttribute('data-plugin-css', UTILITY_CSS_ID)
  styleEl.textContent =
    '.createhelper-utility-anchor{position:fixed;bottom:16px;z-index:9997;pointer-events:auto}' +
    '.createhelper-utility-launcher{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;padding:0;border:1px solid var(--dsw-alias-border-l1);border-radius:9px;background:var(--dsw-alias-bg-overlay);color:var(--dsw-alias-label-secondary);cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.22)}' +
    '.createhelper-utility-launcher:hover,.createhelper-utility-launcher[aria-expanded="true"]{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}' +
    '.createhelper-utility-launcher svg{display:block}' +
    '.createhelper-utility-menu{display:flex;flex-direction:column;gap:2px;min-width:172px;margin-bottom:6px;padding:4px;border:1px solid var(--dsw-alias-border-l1);border-radius:12px;background:var(--dsw-alias-bg-overlay);box-shadow:0 10px 30px rgba(0,0,0,.28)}' +
    '.createhelper-utility-menu[hidden]{display:none}' +
    '.createhelper-utility-menu button{display:flex;align-items:center;gap:8px;width:100%;height:30px;padding:0 8px;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;font:inherit;font-size:12px;text-align:left;white-space:nowrap}' +
    '.createhelper-utility-menu button:hover,.createhelper-utility-menu button[aria-pressed="true"]{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}' +
    '.createhelper-utility-menu button svg{display:block;flex:none}'
  document.head.appendChild(styleEl)
}

// The position rule the retired page dock used: right of the sidebar, 16px
// in, and 80px when the shell has not laid the column out yet.
const measureUtilityLeft = () => {
  if (typeof document === 'undefined') return UTILITY_FALLBACK_LEFT_PX
  const overlay = document.querySelector('[data-shell-overlay]')
  const frame = overlay && overlay.parentElement
  const sidebar = frame && frame.firstElementChild
  const rect = sidebar && typeof sidebar.getBoundingClientRect === 'function'
    ? sidebar.getBoundingClientRect()
    : null
  if (!rect || !rect.right) return UTILITY_FALLBACK_LEFT_PX
  return Math.max(16, Math.round(rect.right + 16))
}
// The overlay layer commits before the frame's columns are laid out, so the
// first read answers the fallback; keep re-reading for ~2s and then stop.
const useUtilityLeft = () => {
  const [left, setLeft] = React.useState(UTILITY_FALLBACK_LEFT_PX)
  React.useEffect(() => {
    let stopped = false
    let tries = 0
    let frameId = 0
    const raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : null
    const sync = () => {
      if (stopped) return
      const next = measureUtilityLeft()
      setLeft(next)
      if (next === UTILITY_FALLBACK_LEFT_PX && raf !== null && tries < UTILITY_MEASURE_TRIES) {
        tries += 1
        frameId = raf(sync)
      }
    }
    sync()
    window.addEventListener('resize', sync)
    return () => {
      stopped = true
      if (raf !== null && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(frameId)
      window.removeEventListener('resize', sync)
    }
  }, [])
  return left
}
// The block owns no dictionary, so its own title follows the browser
// language; each row's label comes from the plugin that contributes it.
const utilityTitle = () => {
  const nav = (typeof navigator !== 'undefined' && navigator.language) || ''
  return /^zh/i.test(nav) ? '工具面板' : 'Utility panels'
}
const utilityMenu = { open: false, listeners: new Set() }
const setUtilityMenu = (value) => {
  utilityMenu.open = !!value
  utilityMenu.listeners.forEach((listener) => listener())
}
const useUtilityMenu = () => {
  const [, setTick] = React.useState(0)
  React.useEffect(() => {
    const listener = () => setTick((value) => value + 1)
    utilityMenu.listeners.add(listener)
    return () => utilityMenu.listeners.delete(listener)
  }, [])
  return utilityMenu.open
}
// The launcher and its menu. The menu is always rendered - a declared child
// slot is not conditionally declared - and hidden when closed. Choosing a row
// closes the menu through the click that bubbles out of it, because the rows
// are other plugins' components.
function UtilityLauncher (props) {
  const left = useUtilityLeft()
  const open = useUtilityMenu()
  ensureUtilityStyles()
  React.useEffect(() => {
    if (!open) return undefined
    const onDown = (event) => {
      const target = event && event.target
      if (target && typeof target.closest === 'function' && target.closest('[data-utility-anchor]') !== null) return
      setUtilityMenu(false)
    }
    const onKey = (event) => { if (event && event.key === 'Escape') setUtilityMenu(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])
  return h('div', {
    'data-utility-anchor': '',
    className: 'createhelper-utility-anchor',
    style: { left: left + 'px' }
  }, [
    h('div', {
      key: 'menu',
      className: 'createhelper-utility-menu',
      hidden: !open,
      onClick: () => setUtilityMenu(false)
    }, props && typeof props.renderSlot === 'function' ? props.renderSlot(UTILITY_ITEM_SLOT, {}) : null),
    h('button', {
      key: 'icon',
      type: 'button',
      className: 'createhelper-utility-launcher',
      title: utilityTitle(),
      'aria-label': utilityTitle(),
      'aria-expanded': open ? 'true' : 'false',
      onClick: () => setUtilityMenu(!open),
      dangerouslySetInnerHTML: { __html: UTILITY_ICON }
    })
  ])
}
// Whoever loads first owns the assembly; everyone else only contributes rows.
// The child slot is declared here, so a plugin that joins later still finds it
// through slots.inject, and an install with one plugin still gets a launcher.
//
// The seat belongs to the shell, so it is reached through inject: registering
// into it directly throws while that declaration is still pending, and a
// launcher must never cost the caller the surfaces it registers afterwards.
//
// The claim lives on the page and is released with its owner. Every family
// client half carries this assembly, so without the release a hot reload of the
// owner would dispose its registration while the claim stayed taken, and the
// launcher would stay missing until the page was reloaded. A released claim
// wakes the other copies, which re-register immediately.
const utilityClaim = () => {
  if (typeof window === 'undefined') return null
  const existing = window[UTILITY_MUTEX_KEY]
  if (existing !== null && typeof existing === 'object') return existing
  const claim = { owner: null, waiters: new Set() }
  window[UTILITY_MUTEX_KEY] = claim
  return claim
}
const registerUtilityLauncher = (scope) => {
  const claim = utilityClaim()
  if (claim === null) return
  if (claim.owner !== null) {
    claim.waiters.add(() => registerUtilityLauncher(scope))
    return
  }
  claim.owner = scope
  let released = false
  const release = () => {
    if (released) return
    released = true
    if (claim.owner === scope) claim.owner = null
    if (window[UTILITY_MUTEX_KEY] !== claim) return
    const waiters = [...claim.waiters]
    claim.waiters.clear()
    for (const wake of waiters) wake()
  }
  scope.on('dispose', release)
  scope.slots.inject('shell.overlay', () => {
    try {
      scope.slots.register({
        name: 'shell.overlay',
        id: 'utility-launcher',
        order: 98,
        children: { [UTILITY_ITEM_SLOT]: { kind: 'list', scope: 'root' } }
      }, UtilityLauncher)
    } catch (error) {
      release()
      if (typeof console !== 'undefined' && typeof console.error === 'function') {
        console.error('[utility-launcher] could not register the family launcher', error)
      }
    }
  })
}
