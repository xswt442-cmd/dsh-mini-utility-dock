// Host-side HTTP glue, for a plugin's host half that answers its own API.
//
// This fragment has ONE source of truth: dsh-mini-utility-dock/dist/host-http.js.
// A host half is plain Node ESM that its package ships standalone, so the
// fragment is embedded into `lib/shared.js` at build time by
//   npm run http:sync    (write it)
//   npm run http:check   (fail on drift)
// instead of being imported: a bare `import 'dsh-mini-utility-dock/...'` would
// put a runtime dependency on this package into the file that embeds it, and an
// embedding plugin ships standalone, with nothing else required.
//
// There is deliberately no `import` here. The block sits BELOW `dsh-host-guard`
// in the consumer's `lib/shared.js` and declares nothing the blocks above it
// already declared, so the three host-side blocks coexist in one file and a
// plugin that needs only this one can embed only this one.
//
// These lines are the response policy, so they are stated once here: every JSON
// reply carries `cache-control: no-store`, because a body naming instance ports,
// pids or session ids must never be servable from an intermediary cache — that
// header is a security posture, not cosmetics. The "browser authorization is
// unavailable" reply and the POST gate each have one definition, so a change to
// one reaches every file that embeds this block at the same time.
//
// What legitimately differs between plugins — a machine-readable `code`, the
// human wording, whether the rejected `action` is echoed — is supplied as data
// (`policy`), exactly the way `dist/guard.js` separates enforcement from
// vocabulary.

/**
 * Send a JSON reply and end the response.
 *
 * `cache-control: no-store` is part of this function rather than of each call
 * site: a route that reports live host facts (ports, pids, session data) must
 * not be servable from an intermediary cache, and a two-line helper that each
 * call site restates is where such a header goes missing.
 */
export function sendJson(res, status, body) {
  const text = JSON.stringify(body)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store'
  })
  res.end(text)
}

/**
 * The one reply for "browser authorization is unavailable right now". Exported
 * as data so a call site that cannot go through `connectionUnavailable()` — a
 * test, or a route that composes its own body — still states it once.
 */
export const CONNECTION_UNAVAILABLE = Object.freeze({
  ok: false,
  code: 'connection_unavailable',
  error: 'browser authentication unavailable'
})

/**
 * Answer `res` with 503 and the shared `connection_unavailable` payload, and
 * return false so a caller can hand its own verdict back in one statement.
 * `respond` has the same injectable sink shape as the guard block's `bindGuard`
 * — `(res, status, body)` — and it defaults to this block's `sendJson`, so the
 * no-store policy is not something a call site can drop.
 */
export const connectionUnavailable = (res, respond = sendJson) => {
  respond(res, 503, { ...CONNECTION_UNAVAILABLE })
  return false
}

/**
 * The reasons the POST gate can reject. One today; the table exists so the
 * wording is overridable by key and a typo in that key is an error rather than a
 * silent no-op — the same contract the guard block's `GUARD_REASONS` offers.
 */
export const REQUIRE_POST_REASONS = Object.freeze(['method_not_allowed'])

/** Default code and wording. `{action}` in `error` is substituted per call. */
export const DEFAULT_REQUIRE_POST_POLICY = Object.freeze({
  method_not_allowed: { code: 'method', error: 'action "{action}" requires POST' }
})

/**
 * Build the POST-only gate for a mutating action.
 *
 * Behavior is fixed: the method is read case-insensitively (an absent method
 * reads as `GET`, which is not POST), POST passes, anything else is answered
 * 405 and returns false. What a plugin publishes — the `code`, the language of
 * `error`, and whether the rejected `action` is echoed in the body — is policy:
 *
 *   createRequirePost()                                          // `{ code: 'method' }`
 *   createRequirePost({ policy: { method_not_allowed: {          // an established API keeps its shape
 *     code: 'need_post', error: '{action} 需要 POST 请求', includeAction: true
 *   } } })
 *
 * @param respond - rejection sink, defaults to this block's `sendJson`, so the
 *   `no-store` header is not a thing a caller can forget to pass.
 * @param policy - optional per-reason `{ code, error, includeAction }` overrides
 *   keyed by `REQUIRE_POST_REASONS`; a partial override merges with the default,
 *   and an unknown key throws.
 */
export const createRequirePost = ({ respond = sendJson, policy } = {}) => {
  const overrides = policy || {}
  for (const key of Object.keys(overrides)) {
    if (!REQUIRE_POST_REASONS.includes(key)) {
      throw new Error(`createRequirePost: unknown policy key ${JSON.stringify(key)}; expected one of ${REQUIRE_POST_REASONS.join(', ')}`)
    }
  }
  const say = Object.fromEntries(REQUIRE_POST_REASONS.map((reason) => [
    reason,
    { ...DEFAULT_REQUIRE_POST_POLICY[reason], ...(overrides[reason] || {}) }
  ]))
  const render = (template, action) => String(template).replace(/\{action\}/g, action == null ? '' : String(action))

  return function requirePost(req, res, action) {
    if (String((req && req.method) || 'GET').toUpperCase() === 'POST') return true
    const words = say.method_not_allowed
    respond(res, 405, {
      ok: false,
      code: words.code,
      error: render(words.error, action),
      ...(words.includeAction ? { action } : {})
    })
    return false
  }
}

/**
 * Build the browser authorizer for a route that is guarded by RC1's Connection
 * when the host provides one, and by the plugin's own same-origin guard when it
 * does not.
 *
 * @param getConnection - `() => connection`, an ACCESSOR, never the value. A host
 *   half keeps its Connection in a closure variable that service unload/reload
 *   reassigns to `null` and later back to a new instance; a captured value would
 *   keep authorizing against a disposed Connection forever.
 * @param getConnectionSeen - `() => connectionSeen`, an accessor for the latch
 *   that records "this host has had an RC1 Connection at least once". Same
 *   reason, same consequence: read it per request.
 * @param guard - the plugin's bound request guard, used only on a host that has
 *   never had a Connection (older hosts, where the guard IS the boundary).
 * @param respond - rejection sink, defaults to this block's `sendJson`.
 * @returns `(req, res) => boolean`, true when the request may proceed.
 *
 * The decision order is the security property, so it is fixed here:
 *
 *   1. A Connection that throws is not a Connection that permits. The request is
 *      rejected 503 and must never fall through to the route handler.
 *   2. A rejection code from the Connection is final: the status is that code,
 *      401 reads as `unauthorized`, anything else as `forbidden`.
 *   3. No Connection but a seen one: 503, and deliberately NOT the guard. Once
 *      the host has had an RC1 Connection, an unload gap must not reopen the
 *      route through the weaker loopback fence — a local socket peer is not the
 *      same statement as an authorized browser.
 *   4. No Connection and none ever seen: this is a pre-RC1 host, and the
 *      plugin's own guard is the whole boundary, so it decides.
 *
 * These two codes and their wording state the decision itself rather than a
 * plugin's published vocabulary, so they are not policy and are not injectable;
 * only wording that legitimately differs between plugins belongs in a table.
 */
export const createBrowserAuthorizer = ({ getConnection, getConnectionSeen, guard, respond = sendJson }) => {
  if (typeof getConnection !== 'function') {
    throw new Error('createBrowserAuthorizer: getConnection must be an accessor (`() => connection`); a Connection captured here is stale the first time the service reloads')
  }
  if (typeof getConnectionSeen !== 'function') {
    throw new Error('createBrowserAuthorizer: getConnectionSeen must be an accessor (`() => connectionSeen`); the latch is set once an RC1 Connection exists and must never be read from a captured copy')
  }
  if (typeof guard !== 'function') {
    throw new Error('createBrowserAuthorizer: guard is required; a host without an RC1 Connection falls back to the plugin request guard')
  }

  return function authorizeBrowser(req, res) {
    const connection = getConnection()
    if (connection) {
      let rejection
      try {
        rejection = connection.requestRejection(req)
      } catch {
        return connectionUnavailable(res, respond)
      }
      if (rejection !== undefined) {
        respond(res, rejection, {
          ok: false,
          code: rejection === 401 ? 'unauthorized' : 'forbidden',
          error: rejection === 401 ? 'browser authentication required' : 'request rejected'
        })
        return false
      }
      return true
    }
    // Once an RC1 Connection has existed, a reload gap answers 503 — it does not
    // downgrade to the guard fence.
    if (getConnectionSeen()) return connectionUnavailable(res, respond)
    return guard(req, res)
  }
}

/**
 * Accept only a bounded, plausible session id from query or body input.
 * Returns the trimmed value or null; `null` is the caller's "missing/invalid"
 * signal, so an empty string never reaches a lookup.
 */
export function optionalSessionId(value) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed || trimmed.length > 512) return null
  return trimmed
}
