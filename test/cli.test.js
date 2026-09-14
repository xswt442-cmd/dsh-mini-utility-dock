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

// The CLI serves two fragments and picks between them by the marker present in
// the target file, so both directions need covering: the right source is chosen,
// and the wrong marker is refused rather than silently matching.
test('the fragment is chosen by the marker in the target file', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-dock-'))
  const file = join(dir, 'shared.js')
  await writeFile(file, 'export const VERSION = 1\n// <dsh-host-guard>\n// </dsh-host-guard>\n')
  const result = await run('sync', file)
  assert.equal(result.code, 0, result.stderr)
  assert.match(result.stdout, /dsh-host-guard/, 'reports which fragment it embedded')
  const source = await readFile(file, 'utf8')
  assert.match(source, /export const LOOPBACK_HOSTNAMES/)
  assert.match(source, /const bindGuard = /)
  assert.doesNotMatch(source, /DOCK_KEY/, 'must not embed the dock fragment')
  assert.equal((await run('check', file)).code, 0)
  assert.equal((await run('sync', file)).stdout.includes('unchanged'), true)

  const unknown = join(dir, 'other.js')
  await writeFile(unknown, '// <some-other-fragment>\n// </some-other-fragment>\n')
  const unknownResult = await run('sync', unknown)
  assert.equal(unknownResult.code, 1)
  assert.match(unknownResult.stderr, /no fragment marker found/)
})

test('the guard fragment stays dependency-free ESM', () => {
  // It is embedded into a host half, not a browser bundle, so ESM is expected —
  // but it must not reach for anything the consumer has to install.
  assert.doesNotMatch(guard, /\brequire\s*\(/)
  assert.doesNotMatch(guard, /^\s*import\s/m)
  for (const name of ['LOOPBACK_HOSTNAMES', 'normalizeHostValue', 'hostHostname', 'portOf', 'isLoopbackName', 'isLoopbackAddress', 'GUARD_REASONS', 'DEFAULT_GUARD_POLICY']) {
    assert.match(guard, new RegExp(`export const ${name}\\b`), `fragment must export ${name}`)
  }
  // The factory is deliberately NOT exported: a consumer that both embeds the
  // block and re-exports the same name would otherwise collide with it.
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
