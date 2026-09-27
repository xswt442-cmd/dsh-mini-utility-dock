import test from 'node:test'
import assert from 'node:assert/strict'
import { LOOPBACK_HOSTNAMES, hostHostname, isLoopbackAddress, isLoopbackName, normalizeHostValue } from '../dist/loopback.js'

// These are the decisions the fragments encode, asserted here rather than only in
// a consumer's copy of the block: what counts as loopback is the one thing every
// host half must agree on, and both historical drifts were in this file — one
// rejected IPv6 loopback everywhere, one disagreed on the Host spellings.

test('the loopback allowlist is exact spellings only', () => {
  assert.deepEqual([...LOOPBACK_HOSTNAMES], ['127.0.0.1', 'localhost', '::1'])
})

test('isLoopbackName takes the documented names, case and padding folded', () => {
  for (const name of ['127.0.0.1', 'localhost', '::1', 'LOCALHOST', '  LocalHost  ']) {
    assert.equal(isLoopbackName(name), true, `${name} must be admitted`)
  }
})

test('isLoopbackName takes both spellings of the mapped IPv4 loopback', () => {
  // What Node puts in a socket address, and what the URL parser emits for the
  // same address out of a browser Origin.
  assert.equal(isLoopbackName('::ffff:127.0.0.1'), true)
  assert.equal(isLoopbackName('::ffff:7f00:1'), true)
  assert.equal(isLoopbackName('[::ffff:127.0.0.1]'), false, 'brackets are the Host parser\'s business, not this one')
})

// The rebinding surface: a name that merely contains or extends a loopback
// literal is not loopback, or DNS rebinding would reach the API.
test('isLoopbackName fails closed on anything that only looks loopback', () => {
  for (const name of [
    'api.localhost', 'evil.localhost', '127.0.0.1.evil.example', 'localhost.evil.example',
    '203.0.113.5', '::2', '::ffff:8.8.8.8', '::ffff:127.0.0.2', '::ffff:1.2.3',
    '::ffff:999.1.1.1', '127.0.0.2', '', '   ', null, undefined
  ]) {
    assert.equal(isLoopbackName(name), false, `${JSON.stringify(name)} must stay rejected`)
  }
})

test('isLoopbackAddress covers the whole 127/8 range plus the IPv6 and mapped forms', () => {
  for (const address of ['127.0.0.1', '127.255.0.1', '127.1.2.3', '::1', '::ffff:127.0.0.1', '::ffff:7f00:1', '::ffff:127.0.0.2']) {
    assert.equal(isLoopbackAddress(address), true, `${address} is a loopback peer`)
  }
})

test('isLoopbackAddress fails closed on an unknown or absent peer', () => {
  // A peer the guard cannot identify is not a peer it may admit.
  for (const address of ['10.0.0.5', '192.168.1.1', '203.0.113.7', 'localhost', '::2', '', '  ', null, undefined]) {
    assert.equal(isLoopbackAddress(address), false, `${JSON.stringify(address)} is not a loopback peer`)
  }
})

test('hostHostname splits the port without mistaking an IPv6 colon for one', () => {
  assert.equal(hostHostname('127.0.0.1:3080'), '127.0.0.1')
  assert.equal(hostHostname('localhost'), 'localhost')
  assert.equal(hostHostname('[::1]:3080'), '::1')
  assert.equal(hostHostname('[::ffff:127.0.0.1]:80'), '::ffff:127.0.0.1')
  assert.equal(hostHostname('REBOUND.EXAMPLE:8080'), 'rebound.example')
  // An unbracketed IPv6 literal (RFC 7230 forbids it, a client can still send it)
  // parses to a hostname that is not a loopback name — the guard reports that as a
  // Host rejection rather than reading an empty parse as a pass.
  assert.equal(hostHostname('::1:3080'), '')
  assert.equal(isLoopbackName(hostHostname('::1:3080')), false)
  assert.equal(hostHostname(undefined), '')
})

test('normalizeHostValue is the single canonicalization every path shares', () => {
  assert.equal(normalizeHostValue('  LOCALHOST:3080  '), 'localhost:3080')
  assert.equal(normalizeHostValue(null), '')
  assert.equal(normalizeHostValue(undefined), '')
})
