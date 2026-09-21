// Host-side request guard shared by the DSH plugins.
//
// This fragment has ONE source of truth: dsh-mini-utility-dock/dist/guard.js.
// DSH plugin host halves are plain Node ESM that each package ships standalone,
// so the fragment is embedded into `lib/shared.js` at build time by
//   npm run guard:sync    (write it)
//   npm run guard:check   (fail on drift)
// instead of being imported: a bare `import 'dsh-mini-utility-dock/...'` would
// put a runtime dependency on the dock into every plugin, and the whole point of
// the dock is that a plugin ships standalone, with nothing else required.
//
// This file is the POLICY half. What counts as loopback is a separate fragment
// (`dist/loopback.js`, embedded under the `dsh-loopback-helpers` marker), and
// this module uses the predicates that block exports in the same file rather than
// restating them: `hostHostname`, `isLoopbackName` and `isLoopbackAddress` are
// module-scope names here, declared by the block above. That keeps one copy of
// them in a consumer, and makes the dependency one-way and visible — `guard:sync`
// needs `loopback:sync` to have produced a `lib/shared.js` that declares them.
//
// There is deliberately no `import` here. A consumer embeds both blocks into one
// file, so an import of another module would both break the standalone promise
// and collide with the exports the block above already declares.
//
// Why the guard is shared rather than reimplemented per plugin: each consumer
// carried its own `createGuard`, and the copies diverged repeatedly. The
// parts that differed were never the *decisions* — they were the error codes and
// message strings welded into the same function, which forced every repo to keep
// its own copy and made drift possible. Here the enforcement order and every
// decision are fixed, and the wording is supplied as data by the caller
// (`policy`), so a plugin customizes its vocabulary without forking the logic.

// Default ports each scheme normalises away, so an Origin carrying no explicit
// port (for example `http://127.0.0.1`) compares equal to a server on 80/443.
// `new URL('http://127.0.0.1:80').port` is '', which compared unequal to "80"
// and turned a legitimate same-origin request into a rejection.
const DEFAULT_PORTS = { 'http:': '80', 'https:': '443' }
export const portOf = (url) => url.port || DEFAULT_PORTS[url.protocol] || ''

// The reasons this guard can reject. Each is a stable, guard-owned name for one
// decision; the *reason* is fixed here, while the machine-readable `code` a
// plugin's API exposes and the human wording are policy.
//
// An unidentifiable peer and an off-loopback peer are deliberately distinct
// decisions. Two plugins answer `non_loopback_peer` for both; one distinguishes
// them. Both distinctions are correct for their own API, and a plugin that
// collapses them names the same `code` for each — nothing widens either way,
// because every reason rejects.
export const GUARD_REASONS = Object.freeze([
  'non_loopback_peer',
  'cross_site',
  'unknown_peer',
  'foreign_origin',
  'non_loopback_host'
])

/** Default machine-readable codes and wording, in English, per reason. */
export const DEFAULT_GUARD_POLICY = Object.freeze({
  non_loopback_peer: { code: 'non_loopback_peer', error: 'non-loopback peer rejected' },
  cross_site: { code: 'cross_site', error: 'cross-site request rejected' },
  unknown_peer: { code: 'unknown_peer', error: 'peer address is not identifiable' },
  foreign_origin: { code: 'foreign_origin', error: 'foreign origin rejected' },
  non_loopback_host: { code: 'non_loopback_host', error: 'non-loopback host rejected' }
})

/**
 * Build the same-origin request guard for a loopback-bound API route.
 *
 * Not exported under a plugin-facing name: each plugin publishes its own guard
 * bound to its own error vocabulary, so the name it exports — usually
 * `createGuard`, matching its previous API — is its own to declare. This is the
 * one factory every plugin calls.
 *
 * Enforces, in order: Fetch Metadata, an unparseable Host, the TCP peer address,
 * then the Host allowlist, then the Origin. Rejects by calling
 * `respond(res, 403, { ok: false, code, error })` and returning false; returns
 * true when the request may proceed.
 *
 * @param currentPort - the port this server listens on. A function is called per
 *   request so an Origin check follows a server whose port changes; a plain
 *   value is accepted for a fixed server.
 * @param respond - rejection sink, normally the plugin's `sendJson`. Kept
 *   injectable so tests can capture the rejection code instead of standing up a
 *   real ServerResponse.
 * @param allowRemoteHost - optional predicate. When it returns true, an
 *   off-loopback peer AND an off-loopback Host are admitted, because the caller
 *   has opted into verifying its own credential per request; the guard
 *   deliberately knows nothing about tokens. The Origin check still applies, so
 *   the exemption never widens the browser-facing boundary. A plugin that omits
 *   the predicate keeps absolute peer and Host criteria.
 * @param policy - optional per-reason `{ code, error }` overrides, keyed by
 *   `GUARD_REASONS`. A partial override merges with the default, so a plugin
 *   names only the reasons whose vocabulary differs. An unknown key throws: a
 *   typo would otherwise silently leave the default in place, and the plugin
 *   would expose a code no test expects.
 */
const bindGuard = ({ currentPort, respond, allowRemoteHost, policy } = {}) => {
  const port = typeof currentPort === 'function' ? currentPort : () => currentPort
  const overrides = policy || {}
  for (const key of Object.keys(overrides)) {
    if (!GUARD_REASONS.includes(key)) {
      throw new Error(`bindGuard: unknown policy key ${JSON.stringify(key)}; expected one of ${GUARD_REASONS.join(', ')}`)
    }
  }
  const say = Object.fromEntries(GUARD_REASONS.map((reason) => [
    reason,
    { ...DEFAULT_GUARD_POLICY[reason], ...(overrides[reason] || {}) }
  ]))
  const deny = (res, reason) => {
    respond(res, 403, { ok: false, code: say[reason].code, error: say[reason].error })
    return false
  }
  const fleetAllowed = () => typeof allowRemoteHost === 'function' && allowRemoteHost()

  return function guard(req, res) {
    const headers = (req && req.headers) || {}

    const site = headers['sec-fetch-site']
    if (site !== undefined && site !== 'same-origin' && site !== 'none') {
      return deny(res, 'cross_site')
    }

    const host = headers.host || ''
    const parsedHost = host ? hostHostname(host) : ''
    // An empty parse is not permission. A Host header that carries no usable
    // hostname — an unbracketed IPv6 literal such as `::1:3080`, which RFC 7230
    // forbids but a client can still send — parses to '', and reading that as a
    // pass would skip the allowlist. It is a Host problem, so it is reported as
    // one. An ABSENT Host stays loopback so host-side callers keep working.
    if (host && parsedHost === '') {
      return deny(res, 'non_loopback_host')
    }
    const peerAddress = req.socket ? req.socket.remoteAddress : undefined
    if (peerAddress == null || String(peerAddress).trim() === '') {
      return deny(res, 'unknown_peer')
    }
    // `allowRemoteHost` buys exactly one thing: an off-loopback peer AND an
    // off-loopback Host stop being *rejected* by this guard — both checks below
    // are skipped — because the caller has opted into verifying its own
    // credential per request. Everything else still applies: the Origin check
    // below rejects cross-site traffic in both modes, so the exemption never
    // widens the browser-facing boundary. A plugin that does not pass the
    // predicate never enters this mode, so for it the peer and Host criteria
    // are absolute.
    const remote = fleetAllowed()
    if (!remote && !isLoopbackAddress(peerAddress)) {
      return deny(res, 'non_loopback_peer')
    }
    const hostLoopback = host ? (parsedHost !== '' && isLoopbackName(parsedHost)) : true
    if (!remote && !hostLoopback) {
      return deny(res, 'non_loopback_host')
    }

    const origin = headers.origin
    if (origin) {
      let same = false
      try {
        const parsed = new URL(origin)
        same = isLoopbackName(hostHostname(parsed.hostname)) &&
          portOf(parsed) === String(port() || '')
      } catch {
        same = false
      }
      if (!same) return deny(res, 'foreign_origin')
    }

    return true
  }
}
