import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))

// `dist/guard.js` declares no `import` on purpose: in a consumer it sits in the
// same file as the loopback block and reads those names directly. Loading it as
// its own module therefore needs the two blocks concatenated — exactly what
// `guard:sync` produces in `lib/shared.js`. `bindGuard` itself stays private to
// the block, so the harness publishes it the way a consumer's own export line
// does.
const loopback = await readFile(join(root, 'dist', 'loopback.js'), 'utf8')
const guard = await readFile(join(root, 'dist', 'guard.js'), 'utf8')
const dir = await mkdtemp(join(tmpdir(), 'dsh-guard-'))
const bundle = join(dir, 'shared.mjs')
await writeFile(bundle, `${loopback}\n${guard}\nexport { bindGuard }\n`, 'utf8')
const { bindGuard, portOf, GUARD_REASONS, DEFAULT_GUARD_POLICY } = await import(pathToFileURL(bundle).href)

/** Records the rejections the guard routes through its sink. */
function spy() {
  const denied = []
  return {
    denied,
    respond: (res, status, body) => { denied.push({ res, status, body }) },
    verdict(options, req) {
      const res = { req }
      const allowed = bindGuard({ currentPort: () => 3080, respond: this.respond, ...options })(req, res)
      return { allowed, denial: denied[denied.length - 1] }
    }
  }
}

const request = ({ host = '127.0.0.1:3080', peer = '127.0.0.1', site, origin } = {}) => ({
  method: 'GET',
  headers: {
    ...(host === null ? {} : { host }),
    ...(origin === undefined ? {} : { origin }),
    ...(site === undefined ? {} : { 'sec-fetch-site': site })
  },
  socket: peer === null ? {} : { remoteAddress: peer }
})

test('a same-origin loopback request is admitted without a reply', () => {
  const spy_ = spy()
  const { allowed, denial } = spy_.verdict({}, request({ origin: 'http://127.0.0.1:3080' }))
  assert.equal(allowed, true)
  assert.equal(denial, undefined)
})

// Every rejection path: the reason, the default code, and the 403 that says what
// the guard actually decided.
test('each rejection reason denies with its own code', () => {
  const cases = [
    ['cross_site', request({ site: 'cross-site' }), 'cross_site'],
    ['unknown_peer', request({ peer: null }), 'unknown_peer'],
    ['blank peer', request({ peer: '   ' }), 'unknown_peer'],
    ['non_loopback_peer', request({ peer: '203.0.113.7' }), 'non_loopback_peer'],
    ['non_loopback_host', request({ host: 'rebound.example' }), 'non_loopback_host'],
    // An unbracketed IPv6 Host parses to no hostname, and an empty parse is not a
    // pass — this is the drift the shared block exists to prevent.
    ['unparseable host', request({ host: '::1:3080' }), 'non_loopback_host'],
    ['foreign_origin', request({ origin: 'https://evil.example' }), 'foreign_origin'],
    ['origin on another port', request({ origin: 'http://127.0.0.1:3081' }), 'foreign_origin'],
    ['unparseable origin', request({ origin: 'not a url' }), 'foreign_origin']
  ]
  for (const [label, req, reason] of cases) {
    const spy_ = spy()
    const { allowed, denial } = spy_.verdict({}, req)
    assert.equal(allowed, false, `${label} must be denied`)
    assert.equal(denial.status, 403)
    assert.equal(denial.body.ok, false)
    assert.equal(denial.body.code, DEFAULT_GUARD_POLICY[reason].code, `${label} reports ${reason}`)
  }
})

test('policy overrides wording without touching the decision', () => {
  const spy_ = spy()
  const { allowed, denial } = spy_.verdict({
    policy: { non_loopback_host: { code: 'bad_host', error: '远程请求需要 fleet 模式' } }
  }, request({ host: '203.0.113.5:3080' }))
  assert.equal(allowed, false)
  assert.deepEqual(denial.body, { ok: false, code: 'bad_host', error: '远程请求需要 fleet 模式' })
  // A reason nobody renamed keeps the shared default.
  const other = spy()
  assert.equal(other.verdict({
    policy: { non_loopback_host: { code: 'bad_host', error: 'x' } }
  }, request({ peer: '203.0.113.7' })).denial.body.code, 'non_loopback_peer')
})

test('an unknown policy key is a typo and throws', () => {
  assert.throws(
    () => bindGuard({ currentPort: () => 3080, respond: () => {}, policy: { not_a_reason: { code: 'x' } } }),
    /unknown policy key "not_a_reason"/
  )
  assert.ok(GUARD_REASONS.includes('foreign_origin'))
})

// Fleet mode is the one place the guard relaxes, and it relaxes exactly twice.
test('allowRemoteHost admits a remote peer and Host but keeps the Origin boundary', () => {
  const spy_ = spy()
  const options = { allowRemoteHost: () => true }
  assert.equal(spy_.verdict(options, request({ host: 'box.lan:3080' })).allowed, true, 'a configured peer host')
  assert.equal(spy_.verdict(options, request({ peer: '203.0.113.7' })).allowed, true, 'a remote peer')
  assert.equal(spy_.verdict(options, request({ host: 'box.lan:3080', origin: 'https://evil.example' })).allowed, false, 'the browser boundary stays')
  assert.equal(spy_.verdict(options, request({ host: 'box.lan:3080', site: 'cross-site' })).allowed, false, 'Fetch Metadata stays enforced')
  assert.equal(spy_.verdict(options, request({ host: 'box.lan:3080', peer: null })).allowed, false, 'an unidentified peer is still a denial')
})

test('a predicate that answers false leaves the guard absolute', () => {
  const spy_ = spy()
  assert.equal(spy_.verdict({ allowRemoteHost: () => false }, request({ peer: '203.0.113.7' })).allowed, false)
})

test('an absent Host is a host-side caller, not a spoof', () => {
  const spy_ = spy()
  assert.equal(spy_.verdict({}, request({ host: null })).allowed, true)
})

test('portOf normalizes the default ports so a bare Origin still matches', () => {
  assert.equal(portOf(new URL('http://127.0.0.1')), '80')
  assert.equal(portOf(new URL('https://127.0.0.1')), '443')
  assert.equal(portOf(new URL('http://127.0.0.1:3080')), '3080')
})

test('the guard fragment reads the loopback block instead of restating it', () => {
  // The fragment file itself must stay self-contained in the ways a consumer
  // needs: no import, no re-declaration of a name the block above already
  // declared, and a private factory so the consumer's own export cannot collide.
  assert.doesNotMatch(guard, /^\s*import\s/m)
  for (const owned of ['isLoopbackName', 'isLoopbackAddress', 'hostHostname']) {
    assert.match(guard, new RegExp(`${owned}\\(`), `the guard must call ${owned} from the block above`)
    assert.doesNotMatch(guard, new RegExp(`(?:const|function|let)\\s+${owned}\\b`))
  }
})
