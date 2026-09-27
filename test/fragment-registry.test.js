import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const cliSource = await readFile(join(root, 'bin', 'dsh-mini-utility-dock.js'), 'utf8')
const paritySource = await readFile(join(root, 'bin', 'dsh-plugin-parity.js'), 'utf8')

// The registry table is the one place a fragment is declared. A row whose source
// file is missing syncs nothing and says nothing — it fails in a consumer
// checkout instead — so the table and the `dist/` directory are compared here.
const registered = [...cliSource.matchAll(/\{ name: '([^']+)', source: '([^']+)' \}/g)]
  .map(([, name, source]) => ({ name, source }))

test('the fragment registry is complete and unambiguous', async () => {
  assert.ok(registered.length >= 4, `expected the four family fragments, found ${registered.length}`)
  const names = registered.map((f) => f.name)
  assert.equal(new Set(names).size, names.length, `duplicate marker in FRAGMENTS: ${names.join(', ')}`)
  const sources = registered.map((f) => f.source)
  assert.equal(new Set(sources).size, sources.length, `two fragments reading one dist file: ${sources.join(', ')}`)

  for (const { name, source } of registered) {
    const file = join(root, 'dist', source)
    const info = await stat(file).catch(() => null)
    assert.ok(info?.isFile(), `${name} is registered but dist/${source} does not exist`)
    // The marker a consumer writes and the file the CLI reads must be one entry;
    // a row that points at the wrong file would sync the wrong code silently.
    assert.match(source, /\.js$/, `${name} must name a .js fragment`)
    const body = await readFile(file, 'utf8')
    assert.match(body, /^\s*\/\//, `${name} must open with its own header comment`)
    assert.ok(
      body.includes(`dsh-mini-utility-dock/dist/${source}`),
      `${name}: the header must name its own source of truth (${source})`
    )
  }
})

test('the registered fragments are the documented ones', () => {
  // The CLI header comment is what a reader of `bin/` trusts, and `usage()` maps
  // each marker to its `dist/` file from this same table; a fragment registered
  // without being documented is how a fourth block becomes invisible to whoever
  // adds the fifth.
  const header = cliSource.slice(0, cliSource.indexOf('\nimport '))
  let position = -1
  for (const { name } of registered) {
    const at = header.indexOf(name)
    assert.ok(at >= 0, `the CLI header does not mention ${name}`)
    assert.ok(at > position, `the CLI header lists ${name} out of FRAGMENTS order`)
    position = at
  }
})

test('every block the parity check compares is a registered fragment', () => {
  const compared = [...paritySource.matchAll(/\{ name: '([^']+)', label: '[^']+' \}/g)].map(([, name]) => name)
  assert.ok(compared.length, 'the parity check compares no block at all')
  const names = registered.map((f) => f.name)
  for (const name of compared) {
    assert.ok(names.includes(name), `parity compares ${name}, which the dock does not register`)
  }
  // The host half's three blocks are the cross-repo surface; the launcher lands
  // in a client half and is compared by `launcher:check`, not here.
  for (const hostBlock of ['dsh-loopback-helpers', 'dsh-host-guard', 'dsh-host-http']) {
    assert.ok(compared.includes(hostBlock), `parity must compare the ${hostBlock} block`)
  }
  assert.ok(!compared.includes('dsh-utility-launcher'), 'the client block is not part of the shared.js comparison')
})

test('the parity check documents the flags it accepts', () => {
  // The member list is caller-supplied on purpose, so the tool must name no
  // repository; its usage block must state every flag it reads.
  for (const flag of ['--root', '--member', '--fleet', '--self-test']) {
    assert.match(paritySource, new RegExp(`Usage:[\\s\\S]*${flag.replace(/-/g, '\\-')}`), `usage must document ${flag}`)
  }
  assert.doesNotMatch(paritySource.slice(0, paritySource.indexOf('\nimport ')), /dsh-(ballast|treekeeper|instance-manager)\b/,
    'the parity check must stay free of repository names of its own')
})
