import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn, execFileSync } from 'node:child_process'

const root = fileURLToPath(new URL('..', import.meta.url))
const bin = join(root, 'bin', 'dsh-plugin-docs.js')

function run(cwd, ...args) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [bin, ...args], { cwd, stdio: ['ignore', 'pipe', 'pipe'], env: childEnv() })
    let stdout = ''; let stderr = ''
    child.stdout.on('data', (chunk) => { stdout += chunk })
    child.stderr.on('data', (chunk) => { stderr += chunk })
    child.on('close', (code) => resolve({ code, stdout, stderr }))
  })
}

const readme = (title, body) => `# ${title}\n\n${body}\n\n## 一\n\n段落。\n\n## 二\n\n\`\`\`sh\nnpm test\n\`\`\`\n`
const readmeEn = (title, body) => `# ${title}\n\n${body}\n\n## One\n\nText.\n\n## Two\n\n\`\`\`sh\nnpm test\n\`\`\`\n`
const changelog = (first, second) => `# 更新日志\n\n## 0.1.0 - 2026-01-01\n\n### 新增\n\n- ${first}\n\n### 修复\n\n- ${second}\n`
const changelogEn = (first, second) => `# Changelog\n\n## 0.1.0 - 2026-01-01\n\n### Added\n\n- ${first}\n\n### Fixed\n\n- ${second}\n`

/** A repository directory holding one aligned pair of each document. */
async function fixture(overrides = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-docs-'))
  const files = {
    'README.md': readme('包', '中文说明'),
    'README.en.md': readmeEn('Package', 'English text'),
    'CHANGELOG.md': changelog('甲', '乙'),
    'CHANGELOG.en.md': changelogEn('alpha', 'beta'),
    ...overrides
  }
  for (const [name, body] of Object.entries(files)) await writeFile(join(dir, name), body, 'utf8')
  return dir
}

// A test that shells out to git must not inherit the repository it runs inside.
// Under a pre-commit or pre-push hook, GIT_DIR and friends point at the outer
// repository, and `git init` in a temporary directory then re-inits THAT one —
// the "re-init: ignored --initial-branch" warning is the only visible symptom,
// while the fixture quietly commits onto the wrong history. Strip the anchoring
// variables so every fixture finds its own repository by directory.
const ANCHORS = /^(GIT_DIR|GIT_WORK_TREE|GIT_INDEX_FILE|GIT_OBJECT_DIRECTORY|GIT_ALTERNATE_OBJECT_DIRECTORIES|GIT_COMMON_DIR|GIT_PREFIX|GIT_NAMESPACE|GIT_REAL_DIR)$/
const childEnv = () => Object.fromEntries(Object.entries(process.env).filter(([name]) => !ANCHORS.test(name)))

const git = (dir, ...args) => execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8', env: childEnv() }).trim()

function initRepo(dir) {
  git(dir, 'init', '-q', '--initial-branch=main')
}

function commit(dir, message) {
  git(dir, '-c', 'user.name=t', '-c', 'user.email=t@example.invalid', 'add', '-A')
  git(dir, '-c', 'user.name=t', '-c', 'user.email=t@example.invalid', 'commit', '-q', '-m', message)
  return git(dir, 'rev-parse', 'HEAD')
}

test('an aligned bilingual pair passes', async () => {
  const dir = await fixture()
  const result = await run(dir)
  assert.equal(result.code, 0, result.stderr)
  assert.match(result.stdout, /bilingual docs are structurally aligned/)
})

// The section titles may differ in language; the SHAPE may not.
test('a heading level that only one language has is reported', async () => {
  const dir = await fixture({ 'README.en.md': readmeEn('Package', 'English text') + '\n### Extra\n\nOnly in English.\n' })
  const result = await run(dir)
  assert.equal(result.code, 1)
  assert.match(result.stderr, /README structure differs between languages/)
})

test('a code fence that only one language shares is reported', async () => {
  const dir = await fixture({ 'README.en.md': readmeEn('Package', 'English text').replace('```sh', '```bash') })
  const result = await run(dir)
  assert.equal(result.code, 1)
  assert.match(result.stderr, /README structure differs/)
})

test('an unclosed fence is an error, not a silently skipped section', async () => {
  const dir = await fixture({ 'README.md': readme('包', '中文说明') + '\n```sh\nnpm test\n' })
  const result = await run(dir)
  assert.equal(result.code, 1)
  assert.match(result.stderr, /unclosed code fence/)
})

test('a changelog whose two languages list different item counts is reported', async () => {
  const dir = await fixture({ 'CHANGELOG.en.md': changelogEn('alpha', 'beta') + '- one item too many\n' })
  const result = await run(dir)
  assert.equal(result.code, 1)
  assert.match(result.stderr, /CHANGELOG structure differs between languages/)
})

// The `Unreleased` section is where the newest edits land, so it is not exempt
// from the comparison: a one-sided change to its item count must be reported even
// though it carries no version number or date.
test('the Unreleased section is compared for item counts', async () => {
  const zh = (n) => `# 更新日志\n\n## Unreleased\n\n${'- 条目\n'.repeat(n)}\n## 0.1.0 - 2026-01-01\n\n### 新增\n\n- 甲\n`
  const en = (n) => `# Changelog\n\n## Unreleased\n\n${'- item\n'.repeat(n)}\n## 0.1.0 - 2026-01-01\n\n### Added\n\n- alpha\n`

  const aligned = await fixture({ 'CHANGELOG.md': zh(2), 'CHANGELOG.en.md': en(2) })
  assert.equal((await run(aligned)).code, 0)

  const drifted = await fixture({ 'CHANGELOG.md': zh(2), 'CHANGELOG.en.md': en(1) })
  const result = await run(drifted)
  assert.equal(result.code, 1)
  assert.match(result.stderr, /CHANGELOG structure differs between languages/)
})

// The category map is what lets 新增/Added be the same section, so a renamed
// category only in one language is still a mismatch.
test('bilingual section titles are compared through the category map', async () => {
  const oneSided = await fixture({ 'CHANGELOG.md': changelog('甲', '乙').replace('### 修复', '### 变更') })
  assert.equal((await run(oneSided)).code, 1, 'zh says 变更 while en says Fixed')

  const mapped = await fixture({
    'CHANGELOG.md': changelog('甲', '乙').replace('### 修复', '### 变更'),
    'CHANGELOG.en.md': changelogEn('alpha', 'beta').replace('### Fixed', '### Changed')
  })
  assert.equal((await run(mapped)).code, 0)
})

test('--base requires both files of a pair to change together', async () => {
  const dir = await fixture()
  initRepo(dir)
  const base = commit(dir, 'docs: baseline')

  await writeFile(join(dir, 'README.md'), readme('包', '中文说明改了一行'), 'utf8')
  commit(dir, 'docs: one side only')
  const oneSided = await run(dir, '--base', base)
  assert.equal(oneSided.code, 1)
  assert.match(oneSided.stderr, /README\.md and README\.en\.md must change together/)

  await writeFile(join(dir, 'README.en.md'), readmeEn('Package', 'English text changed too'), 'utf8')
  commit(dir, 'docs: both halves')
  const both = await run(dir, '--base', base)
  assert.equal(both.code, 0, both.stderr)
})

test('--base without a value is refused', async () => {
  const dir = await fixture()
  const result = await run(dir, '--base')
  assert.equal(result.code, 1)
  assert.match(result.stderr, /--base requires a Git revision/)
})

// The crash this guards against: a workflow passes `github.event.before`, and on
// a first push or a force-push that value is the null OID. `git diff 000... HEAD`
// is not "no base" — it is an error, and it used to kill the check on a branch
// that had done nothing wrong.
test('an all-zero base is the null OID, so the pair test is skipped rather than fatal', async () => {
  for (const zeros of ['0'.repeat(40), '0'.repeat(64)]) {
    const dir = await fixture()
    initRepo(dir)
    commit(dir, 'docs: baseline')
    const result = await run(dir, '--base', zeros)
    assert.equal(result.code, 0, `a null OID must not fail the run: ${result.stderr}`)
    assert.match(result.stdout, /null OID/)
    assert.match(result.stdout, /pair-change check skipped/)
    assert.match(result.stdout, /bilingual docs are structurally aligned/)
  }
})

test('a real revision that does not exist still fails loudly', async () => {
  const dir = await fixture()
  initRepo(dir)
  commit(dir, 'docs: baseline')
  const result = await run(dir, '--base', 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef')
  assert.notEqual(result.code, 0, 'an unusable revision is a configuration error, not a skip')
})
