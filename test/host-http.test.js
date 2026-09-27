import test from 'node:test'
import assert from 'node:assert/strict'
import {
  CONNECTION_UNAVAILABLE,
  DEFAULT_REQUIRE_POST_POLICY,
  REQUIRE_POST_REASONS,
  connectionUnavailable,
  createBrowserAuthorizer,
  createRequirePost,
  optionalSessionId,
  sendJson
} from '../dist/host-http.js'

// A stand-in for http.ServerResponse that records exactly what a reply costs the
// caller: the status, the headers `writeHead` was given, and the body `end` got.
// The assertions below read those, because the whole point of this fragment is
// what leaves the server.
function fakeRes() {
  return {
    status: null,
    headers: null,
    body: null,
    ended: false,
    writeHead(status, headers) {
      this.status = status
      this.headers = headers
      return this
    },
    end(body) {
      this.body = body
      this.ended = true
    },
    get sent() {
      return { status: this.status, headers: this.headers, body: this.body === null ? null : JSON.parse(this.body) }
    }
  }
}

/** A guard stub that answers a fixed verdict and records that it ran. */
function guardStub(verdict = true) {
  const calls = []
  return { calls, guard: (req, res) => { calls.push(req); return verdict } }
}

test('sendJson states the response policy, not just the payload', () => {
  const res = fakeRes()
  sendJson(res, 200, { ok: true, port: 3080, pid: 4242 })
  assert.equal(res.status, 200)
  // `cache-control: no-store` is the reason this helper is shared: one host half
  // shipped its replies without it, on routes that name ports, pids and sessions.
  assert.equal(res.headers['cache-control'], 'no-store')
  assert.equal(res.headers['content-type'], 'application/json; charset=utf-8')
  assert.equal(res.body, '{"ok":true,"port":3080,"pid":4242}')
  assert.equal(res.ended, true, 'a reply that is never ended leaves the socket hanging')
})

test('the shared reply helpers keep the headers when a sink is omitted', () => {
  const res = fakeRes()
  // `respond` is injectable for tests, and defaults to this block's own sendJson,
  // so no call site can drop the no-store policy by passing nothing. The natural
  // call — just the response — is what the signature must support.
  connectionUnavailable(res)
  assert.equal(res.status, 503)
  assert.equal(res.headers['cache-control'], 'no-store')

  const viaAuthorizer = fakeRes()
  createBrowserAuthorizer({
    getConnection: () => null,
    getConnectionSeen: () => true,
    guard: () => true
  })({}, viaAuthorizer)
  assert.equal(viaAuthorizer.headers['cache-control'], 'no-store')
})

test('connectionUnavailable answers with the one shared payload', () => {
  const seen = []
  const respond = (res, status, body) => seen.push({ status, body })
  const res = fakeRes()
  const returned = connectionUnavailable(res, respond)
  assert.equal(returned, false, 'an unavailable authorizer must never read as a pass')
  assert.deepEqual(seen, [{ status: 503, body: { ok: false, code: 'connection_unavailable', error: 'browser authentication unavailable' } }])
  assert.deepEqual(seen[0].body, { ...CONNECTION_UNAVAILABLE })
  // The exported constant is a copy-on-send value, so a consumer that mutated a
  // reply body could not poison the next one.
  seen[0].body.code = 'tampered'
  assert.equal(CONNECTION_UNAVAILABLE.code, 'connection_unavailable')
})

test('requirePost admits POST in any spelling and rejects the rest', () => {
  const requirePost = createRequirePost()
  assert.equal(requirePost({ method: 'POST' }, fakeRes(), 'stop'), true)
  assert.equal(requirePost({ method: 'post' }, fakeRes(), 'stop'), true, 'the method test is case-insensitive')
  assert.equal(requirePost({ method: 'Post' }, fakeRes(), 'stop'), true)

  const res = fakeRes()
  assert.equal(requirePost({ method: 'GET' }, res, 'stop'), false)
  assert.deepEqual(res.sent, {
    status: 405,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
    body: { ok: false, code: 'method', error: 'action "stop" requires POST' }
  })
})

test('requirePost reads an absent method as GET', () => {
  const res = fakeRes()
  assert.equal(createRequirePost()({}, res, 'stop'), false)
  assert.equal(res.sent.body.code, 'method')
})

test('requirePost policy keeps an established API vocabulary', () => {
  // The instance-manager shape: its own `need_post` code, its own wording, and
  // the rejected action echoed back. None of that is a behavior difference, so
  // it is all data.
  const requirePost = createRequirePost({
    policy: { method_not_allowed: { code: 'need_post', error: '{action} 需要 POST 请求', includeAction: true } }
  })
  const res = fakeRes()
  assert.equal(requirePost({ method: 'DELETE' }, res, 'stop-self'), false)
  assert.deepEqual(res.sent.body, {
    ok: false,
    code: 'need_post',
    error: 'stop-self 需要 POST 请求',
    action: 'stop-self'
  })
})

test('requirePost rejects an unknown policy key instead of ignoring it', () => {
  assert.throws(
    () => createRequirePost({ policy: { need_post: { code: 'x' } } }),
    /unknown policy key "need_post"; expected one of method_not_allowed/
  )
  assert.deepEqual([...REQUIRE_POST_REASONS], ['method_not_allowed'])
  assert.equal(DEFAULT_REQUIRE_POST_POLICY.method_not_allowed.code, 'method')
})

test('requirePost routes its rejection through the injected sink', () => {
  const calls = []
  const requirePost = createRequirePost({ respond: (res, status, body) => calls.push({ res, status, body }) })
  const res = fakeRes()
  requirePost({ method: 'PUT' }, res, 'kill')
  assert.equal(calls.length, 1)
  assert.equal(calls[0].res, res)
  assert.equal(calls[0].status, 405)
  assert.equal(calls[0].body.error, 'action "kill" requires POST')
})

test('the authorizer lets a Connection decide, and a throwing Connection denies', () => {
  const { calls, guard } = guardStub()
  const res = fakeRes()
  const authorize = createBrowserAuthorizer({
    getConnection: () => ({ requestRejection: () => { throw new Error('the launch token is gone') } }),
    getConnectionSeen: () => true,
    guard
  })
  assert.equal(authorize({}, res), false)
  assert.deepEqual(res.sent.body, { ...CONNECTION_UNAVAILABLE })
  assert.equal(res.sent.status, 503)
  assert.deepEqual(calls, [], 'a Connection that cannot answer must not fall through to the guard')
})

test('the authorizer maps a Connection rejection onto its status code', () => {
  for (const [rejection, code, error] of [
    [401, 'unauthorized', 'browser authentication required'],
    [403, 'forbidden', 'request rejected'],
    [451, 'forbidden', 'request rejected']
  ]) {
    const res = fakeRes()
    const authorize = createBrowserAuthorizer({
      getConnection: () => ({ requestRejection: () => rejection }),
      getConnectionSeen: () => false,
      guard: () => { throw new Error('the guard is not consulted while a Connection answers') }
    })
    assert.equal(authorize({}, res), false)
    assert.equal(res.sent.status, rejection, 'the Connection chooses the status; this only names it')
    assert.deepEqual(res.sent.body, { ok: false, code, error })
  }
})

test('the authorizer passes a request the Connection permits', () => {
  const res = fakeRes()
  let asked = null
  const authorize = createBrowserAuthorizer({
    getConnection: () => ({ requestRejection: (req) => { asked = req; return undefined } }),
    getConnectionSeen: () => false,
    guard: () => false
  })
  const req = { method: 'GET', url: '/x' }
  assert.equal(authorize(req, res), true)
  assert.equal(asked, req)
  assert.equal(res.status, null, 'a permitted request gets no reply from the authorizer')
})

// The load-bearing negative: after an RC1 Connection has existed once, a reload
// gap answers 503 and must NOT reopen the route through the weaker loopback
// fence. This is the assertion that fails if the fallback is ever "simplified".
test('a seen-but-currently-absent Connection never falls back to the guard', () => {
  const { calls, guard } = guardStub(true)
  const res = fakeRes()
  const authorize = createBrowserAuthorizer({
    getConnection: () => null,
    getConnectionSeen: () => true,
    guard
  })
  assert.equal(authorize({}, res), false)
  assert.deepEqual(calls, [], 'the guard must not run on this path')
  assert.equal(res.sent.status, 503)
  assert.deepEqual(res.sent.body, { ...CONNECTION_UNAVAILABLE })
})

test('a host that never had a Connection is decided by the plugin guard', () => {
  for (const verdict of [true, false]) {
    const { calls, guard } = guardStub(verdict)
    const res = fakeRes()
    const authorize = createBrowserAuthorizer({
      getConnection: () => null,
      getConnectionSeen: () => false,
      guard
    })
    const req = { method: 'GET' }
    assert.equal(authorize(req, res), verdict)
    assert.deepEqual(calls, [req], 'the guard is handed the original request and response')
    assert.equal(res.status, null)
  }
})

test('the authorizer reads its Connection state per request', () => {
  // Service unload/reload reassigns the closure variables a consumer holds, so a
  // captured value would keep authorizing a Connection that is gone.
  let connection = null
  let seen = false
  const authorize = createBrowserAuthorizer({
    getConnection: () => connection,
    getConnectionSeen: () => seen,
    guard: () => true
  })
  assert.equal(authorize({}, fakeRes()), true, 'pre-RC1 host: the guard decides')
  seen = true
  assert.equal(authorize({}, fakeRes()), false, 'the latch alone is enough to stop serving')
  connection = { requestRejection: () => undefined }
  assert.equal(authorize({}, fakeRes()), true, 'a reloaded Connection is picked up without rebuilding')
})

test('the authorizer refuses the value-shaped arguments that go stale', () => {
  assert.throws(
    () => createBrowserAuthorizer({ connection: null, getConnectionSeen: () => false, guard: () => true }),
    /getConnection must be an accessor/
  )
  assert.throws(
    () => createBrowserAuthorizer({ getConnection: () => null, connectionSeen: false, guard: () => true }),
    /getConnectionSeen must be an accessor/
  )
  assert.throws(
    () => createBrowserAuthorizer({ getConnection: () => null, getConnectionSeen: () => false }),
    /guard is required/
  )
})

test('optionalSessionId bounds what a lookup is asked for', () => {
  assert.equal(optionalSessionId('  abc  '), 'abc')
  assert.equal(optionalSessionId('a'.repeat(512)), 'a'.repeat(512))
  assert.equal(optionalSessionId('a'.repeat(513)), null)
  assert.equal(optionalSessionId(''), null)
  assert.equal(optionalSessionId('   '), null)
  assert.equal(optionalSessionId(null), null)
  assert.equal(optionalSessionId(42), null)
  assert.equal(optionalSessionId(undefined), null)
})
