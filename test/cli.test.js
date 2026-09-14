import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'

const root = fileURLToPath(new URL('..', import.meta.url))
const cli = join(root, 'bin', 'dsh-mini-utility-dock.js')
const bootstrap = await readFile(join(root, 'dist', 'bootstrap.js'), 'utf8')
const loopback = await readFile(join(root, 'dist', 'loopback.js'), 'utf8')
const guard = await readFile(join(root, 'dist', 'guard.js'), 'utf8')

function run(...args) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [cli, ...args], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''; let stderr = ''
    child.stdout.on('data', (chunk) => { stdout += chunk })
    child.stderr.on('data', (chunk) => { stderr += chunk })
    child.on('close', (code) => resolve({ code, stdout, stderr }))
  })
}

test('sync embeds the canonical fragment and preserves marker indentation', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-dock-'))
  const file = join(dir, 'client.js')
  await writeFile(file, 'const plugin = {}\n    // <dsh-mini-utility-dock>\n    // </dsh-mini-utility-dock>\n')
  const result = await run('sync', file)
  assert.equal(result.code, 0, result.stderr)
  const source = await readFile(file, 'utf8')
  assert.match(source, /    \/\/ <dsh-mini-utility-dock>/)
  assert.match(source, /    const DOCK_KEY/)
  assert.match(source, /    \/\/ <\/dsh-mini-utility-dock>/)
  assert.equal((await run('check', file)).code, 0)
  assert.equal((await run('sync', file)).stdout.includes('unchanged'), true)
})

test('check rejects stale or malformed files with a useful error', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-dock-'))
  const stale = join(dir, 'stale.js')
  await writeFile(stale, '// <dsh-mini-utility-dock>\n// old\n// </dsh-mini-utility-dock>\n')
  const staleResult = await run('check', stale)
  assert.equal(staleResult.code, 1)
  assert.match(staleResult.stderr, /out of date/)
  const malformed = join(dir, 'malformed.js')
  await writeFile(malformed, '// <dsh-mini-utility-dock>\n')
  const malformedResult = await run('sync', malformed)
  assert.equal(malformedResult.code, 1)
  assert.match(malformedResult.stderr, /exactly one marked block/)
})

test('bootstrap remains a classic self-contained protocol v1 script', () => {
  assert.doesNotMatch(bootstrap, /^\s*(?:import|export)\s/m)
  assert.doesNotMatch(bootstrap, /\brequire\s*\(/)
  assert.match(bootstrap, /createhelper\.dsh\.utility-dock/)
  assert.match(bootstrap, /DOCK_VERSION = 1/)
})

// A host half embeds BOTH shared.js fragments, so the CLI maintains every marked
// block it finds in one pass, in dependency order. Both directions need covering:
// the right source reaches each block, and an unknown marker is refused.
test('every marked block in the target file is maintained', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-dock-'))
  const file = join(dir, 'shared.js')
  await writeFile(file, [
    'export const VERSION = 1',
    '// <dsh-loopback-helpers>',
    '// </dsh-loopback-helpers>',
    '',
    '// <dsh-host-guard>',
    '// </dsh-host-guard>',
    ''
  ].join('\n'))
  const result = await run('sync', file)
  assert.equal(result.code, 0, result.stderr)
  assert.match(result.stdout, /dsh-loopback-helpers, dsh-host-guard/, 'reports both fragments')
  const source = await readFile(file, 'utf8')

  // The predicates come from the loopback block, the factory from the guard block,
  // and the guard block must NOT re-declare or import what the block above it
  // already published — that would be a redeclaration error in the consumer file.
  assert.match(source, /export const LOOPBACK_HOSTNAMES/)
  assert.match(source, /export const isLoopbackAddress/)
  assert.match(source, /^const bindGuard = /m)
  assert.doesNotMatch(source, /^\s*import\s/m, 'fragments must not import; they share one consumer file')
  const declarations = (source.match(/const isLoopbackName = |export const isLoopbackName = /g) || []).length
  assert.equal(declarations, 1, 'isLoopbackName must be declared exactly once')

  assert.doesNotMatch(source, /DOCK_KEY/, 'must not embed the dock fragment')
  assert.equal((await run('check', file)).code, 0)
  assert.equal((await run('sync', file)).stdout.includes('unchanged'), true)

  // Order matters: the guard reads predicates the loopback block declares, so a
  // guard block placed above it would be a real defect, not a style choice.
  assert.ok(
    source.indexOf('// <dsh-loopback-helpers>') < source.indexOf('// <dsh-host-guard>'),
    'the loopback block must precede the guard block'
  )

  const unknown = join(dir, 'other.js')
  await writeFile(unknown, '// <some-other-fragment>\n// </some-other-fragment>\n')
  const unknownResult = await run('sync', unknown)
  assert.equal(unknownResult.code, 1)
  assert.match(unknownResult.stderr, /no fragment marker found/)
})

test('neither fragment reaches for anything the consumer must install', () => {
  // Both are embedded into a host half, not a browser bundle, so ESM is expected
  // — but neither may import, because they share one consumer file and would
  // collide with what the other block declares.
  for (const [name, text] of [['loopback', loopback], ['guard', guard]]) {
    assert.doesNotMatch(text, /\brequire\s*\(/, `${name} must not require()`)
    assert.doesNotMatch(text, /^\s*import\s/m, `${name} must not import`)
  }
  for (const exported of ['LOOPBACK_HOSTNAMES', 'normalizeHostValue', 'hostHostname', 'isLoopbackName', 'isLoopbackAddress']) {
    assert.match(loopback, new RegExp(`export const ${exported}\\b`), `loopback must export ${exported}`)
  }
  // The guard owns policy only: it uses the predicates above instead of restating
  // them, so it must not re-export or re-declare any of them.
  for (const owned of ['LOOPBACK_HOSTNAMES', 'isLoopbackName', 'isLoopbackAddress', 'hostHostname']) {
    assert.doesNotMatch(guard, new RegExp(`(?:const|function|let)\\s+${owned}\\b`), `guard must not redeclare ${owned}`)
    assert.doesNotMatch(guard, new RegExp(`export const ${owned}\\b`), `guard must not re-export ${owned}`)
  }
  for (const exported of ['portOf', 'GUARD_REASONS', 'DEFAULT_GUARD_POLICY']) {
    assert.match(guard, new RegExp(`export const ${exported}\\b`), `guard must export ${exported}`)
  }
  // The factory is deliberately NOT exported: a consumer that both embeds the
  // block and declares the same name would otherwise collide with it.
  assert.doesNotMatch(guard, /^export const createGuard\b/m, 'the factory stays module-private')
  assert.match(guard, /^const bindGuard = /m)
})

test('every dock:embed command documented in the READMEs actually runs', async () => {
  // Smoke-guard against README drift: the fenced `npm run dock:embed ...`
  // examples are extracted and executed, so a renamed script or a changed
  // CLI surface breaks the suite before it breaks a user.
  const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
  const script = pkg.scripts && pkg.scripts['dock:embed']
  assert.ok(script, 'package.json must define a dock:embed script')
  assert.equal(script, 'node bin/dsh-mini-utility-dock.js')

  const dir = await mkdtemp(join(tmpdir(), 'dsh-dock-'))
  const file = join(dir, 'client.js')
  await writeFile(file, '// <dsh-mini-utility-dock>\n// </dsh-mini-utility-dock>\n')
  // Pre-sync so the documented `check` (listed first in the READMEs) passes.
  assert.equal((await run('sync', file)).code, 0)
  const sample = file.replace(/\\/g, '/')

  for (const name of ['README.md', 'README.en.md']) {
    const doc = await readFile(join(root, name), 'utf8')
    const commands = [...doc.matchAll(/npm run dock:embed( -- (?:check|sync))? path\/to\/client\.js/g)]
    assert.ok(commands.length, `${name} should document dock:embed usage`)
    for (const [, args] of commands) {
      const viaNpm = await new Promise((resolve) => {
        // shell: true so `npm` resolves on Windows as well.
        const child = spawn(`npm run dock:embed${args || ''} "${sample}"`,
          { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], shell: true })
        let stdout = ''; let stderr = ''
        child.stdout.on('data', (chunk) => { stdout += chunk })
        child.stderr.on('data', (chunk) => { stderr += chunk })
        child.on('close', (code) => resolve({ code, stdout, stderr }))
      })
      assert.equal(viaNpm.code, 0, `${name}: npm run dock:embed${args || ''} failed: ${viaNpm.stderr}`)
    }
  }
})
