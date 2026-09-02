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
