import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const root = fileURLToPath(new URL('..', import.meta.url))
const launcher = await readFile(join(root, 'dist', 'launcher.js'), 'utf8')

// The fragment is a classic-script body: it expects React, h, window and document
// as free identifiers and exports nothing, the way a consumer's factory scope
// supplies them. Evaluating it with stubs exercises the claim protocol alone -
// no component ever renders here.
function loadFragment() {
  const sandbox = {
    React: { useState: (value) => [value, () => {}], useEffect: () => {} },
    h: () => null,
    console: { error: () => {} },
    navigator: { language: 'en' },
    document: {
      querySelector: () => null,
      createElement: () => ({ setAttribute: () => {}, textContent: '' }),
      head: { appendChild: () => {} },
      addEventListener: () => {},
      removeEventListener: () => {},
    },
    window: {},
    module: { exports: {} },
  }
  vm.runInNewContext(`${launcher}\nmodule.exports.registerUtilityLauncher = registerUtilityLauncher`, sandbox)
  return { registerUtilityLauncher: sandbox.module.exports.registerUtilityLauncher, window: sandbox.window }
}

/** A scope stub that records registrations and keeps its dispose handler. */
function scopeStub() {
  const registrations = []
  let dispose = null
  return {
    registrations,
    slots: {
      inject(name, mount) { mount() },
      register(options) { registrations.push(options) },
    },
    on(event, handler) { if (event === 'dispose') dispose = handler },
    dispose() { if (dispose) dispose() },
  }
}

test('exactly one copy registers the launcher and the others wait', () => {
  const { registerUtilityLauncher, window } = loadFragment()
  const first = scopeStub()
  const second = scopeStub()

  registerUtilityLauncher(first)
  registerUtilityLauncher(second)

  assert.deepEqual(first.registrations.map((r) => r.id), ['utility-launcher'])
  assert.deepEqual(second.registrations, [], 'a second copy must not register a second launcher')
  assert.equal(typeof window.__CREATEHELPER_DSH_UTILITY_LAUNCHER_V1__, 'object',
    'the claim is page state with an owner, not a boolean latch')
})

test('a disposed owner releases the claim and the waiting copy takes over', () => {
  const { registerUtilityLauncher, window } = loadFragment()
  const first = scopeStub()
  const second = scopeStub()
  registerUtilityLauncher(first)
  registerUtilityLauncher(second)

  // What a hot reload does: the owner's fiber goes away with its registration.
  first.dispose()

  assert.deepEqual(second.registrations.map((r) => r.id), ['utility-launcher'],
    'the launcher must come back without a page reload')
  assert.equal(window.__CREATEHELPER_DSH_UTILITY_LAUNCHER_V1__.owner, second)
})

test('a rejected registration releases the claim instead of stranding it', () => {
  const { registerUtilityLauncher, window } = loadFragment()
  const failing = scopeStub()
  failing.slots.register = () => { throw new Error('slot "shell.overlay" is not declared') }
  const waiting = scopeStub()

  registerUtilityLauncher(failing)
  registerUtilityLauncher(waiting)

  assert.deepEqual(waiting.registrations.map((r) => r.id), ['utility-launcher'])
  assert.equal(window.__CREATEHELPER_DSH_UTILITY_LAUNCHER_V1__.owner, waiting)
})

test('a claim left by the retired boolean latch is replaced, not trusted', () => {
  const { registerUtilityLauncher, window } = loadFragment()
  window.__CREATEHELPER_DSH_UTILITY_LAUNCHER_V1__ = true
  const scope = scopeStub()

  registerUtilityLauncher(scope)

  assert.deepEqual(scope.registrations.map((r) => r.id), ['utility-launcher'])
})
