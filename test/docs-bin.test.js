import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
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

// The pairs a fixture declares, exactly as a repository's own config module does.
const rootPairs = `[
  { name: 'README', zh: 'README.md', en: 'README.en.md' },
  { name: 'CHANGELOG', zh: 'CHANGELOG.md', en: 'CHANGELOG.en.md', shape: 'changelog' },
]`

/**
 * A repository directory holding one aligned pair of each document. `overrides`
 * replaces or adds files; `pairs` replaces the declared config, which is what
 * lets a fixture move a document into a subdirectory without the tool knowing.
 */
async function fixture(overrides = {}, pairs = rootPairs) {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-docs-'))
  const files = {
    'README.md': readme('包', '中文说明'),
    'README.en.md': readmeEn('Package', 'English text'),
    'CHANGELOG.md': changelog('甲', '乙'),
    'CHANGELOG.en.md': changelogEn('alpha', 'beta'),
    ...overrides
  }
  for (const [name, body] of Object.entries(files)) {
    if (body === undefined) continue
    const target = join(dir, name)
    await mkdir(join(target, '..'), { recursive: true })
    await writeFile(target, body, 'utf8')
  }
  await writeFile(join(dir, 'docs.config.mjs'), `export const pairs = ${pairs}\n`, 'utf8')
  return dir
}

const check = (dir, ...args) => run(dir, '--config', 'docs.config.mjs', ...args)

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
  const result = await check(await fixture())
  assert.equal(result.code, 0, result.stderr)
  assert.match(result.stdout, /bilingual docs are structurally aligned/)
})

// The section titles may differ in language; the SHAPE may not.
test('a heading level that only one language has is reported', async () => {
  const dir = await fixture({ 'README.en.md': readmeEn('Package', 'English text') + '\n### Extra\n\nOnly in English.\n' })
  const result = await check(dir)
  assert.equal(result.code, 1)
  assert.match(result.stderr, /README structure differs between languages/)
})

test('a code fence that only one language shares is reported', async () => {
  const dir = await fixture({ 'README.en.md': readmeEn('Package', 'English text').replace('```sh', '```bash') })
  const result = await check(dir)
  assert.equal(result.code, 1)
  assert.match(result.stderr, /README structure differs/)
})

test('an unclosed fence is an error, not a silently skipped section', async () => {
  const dir = await fixture({ 'README.md': readme('包', '中文说明') + '\n```sh\nnpm test\n' })
  const result = await check(dir)
  assert.equal(result.code, 1)
  assert.match(result.stderr, /unclosed code fence/)
})

test('a changelog whose two languages list different item counts is reported', async () => {
  const dir = await fixture({ 'CHANGELOG.en.md': changelogEn('alpha', 'beta') + '- one item too many\n' })
  const result = await check(dir)
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
  assert.equal((await check(aligned)).code, 0)

  const drifted = await fixture({ 'CHANGELOG.md': zh(2), 'CHANGELOG.en.md': en(1) })
  const result = await check(drifted)
  assert.equal(result.code, 1)
  assert.match(result.stderr, /CHANGELOG structure differs between languages/)
})

// The category map is what lets 新增/Added be the same section, so a renamed
// category only in one language is still a mismatch.
test('bilingual section titles are compared through the category map', async () => {
  const oneSided = await fixture({ 'CHANGELOG.md': changelog('甲', '乙').replace('### 修复', '### 变更') })
  assert.equal((await check(oneSided)).code, 1, 'zh says 变更 while en says Fixed')

  const mapped = await fixture({
    'CHANGELOG.md': changelog('甲', '乙').replace('### 修复', '### 变更'),
    'CHANGELOG.en.md': changelogEn('alpha', 'beta').replace('### Fixed', '### Changed')
  })
  assert.equal((await check(mapped)).code, 0)
})

// Where a repository keeps a document is its own decision: the tool reads the
// paths the config declares and compares them like any other pair.
test('a pair declared under a subdirectory is checked there', async () => {
  const docsPairs = `[
    { name: 'README', zh: 'README.md', en: 'README.en.md' },
    { name: 'CHANGELOG', zh: 'docs/CHANGELOG.md', en: 'docs/CHANGELOG.en.md', shape: 'changelog' },
  ]`
  const aligned = await fixture({
    'CHANGELOG.md': undefined,
    'CHANGELOG.en.md': undefined,
    'docs/CHANGELOG.md': changelog('甲', '乙'),
    'docs/CHANGELOG.en.md': changelogEn('alpha', 'beta')
  }, docsPairs)
  assert.equal((await check(aligned)).code, 0)

  const drifted = await fixture({
    'CHANGELOG.md': undefined,
    'CHANGELOG.en.md': undefined,
    'docs/CHANGELOG.md': changelog('甲', '乙'),
    'docs/CHANGELOG.en.md': changelogEn('alpha', 'beta') + '- one item too many\n'
  }, docsPairs)
  const result = await check(drifted)
  assert.equal(result.code, 1)
  assert.match(result.stderr, /CHANGELOG structure differs between languages/)
})

// The same drift, unseen: only what the repository declared is compared, so an
// undeclared document cannot fail the run.
test('a pair the repository did not declare is not checked', async () => {
  const dir = await fixture({
    'SECURITY.md': readme('安全', '中文'),
    'SECURITY.en.md': readmeEn('Security', 'English') + '\n### Extra\n\nOnly in English.\n'
  })
  const result = await check(dir)
  assert.equal(result.code, 0, result.stderr)
})

test('--base requires both files of a pair to change together', async () => {
  const dir = await fixture()
  initRepo(dir)
  const base = commit(dir, 'docs: baseline')

  await writeFile(join(dir, 'README.md'), readme('包', '中文说明改了一行'), 'utf8')
  commit(dir, 'docs: one side only')
  const oneSided = await check(dir, '--base', base)
  assert.equal(oneSided.code, 1)
  assert.match(oneSided.stderr, /README\.md and README\.en\.md must change together/)

  await writeFile(join(dir, 'README.en.md'), readmeEn('Package', 'English text changed too'), 'utf8')
  commit(dir, 'docs: both halves')
  const both = await check(dir, '--base', base)
  assert.equal(both.code, 0, both.stderr)
})

// A moved document is still one pair: the paths in the diff are the declared ones.
test('--base follows a pair into the subdirectory the config declares', async () => {
  const docsPairs = `[
    { name: 'CHANGELOG', zh: 'docs/CHANGELOG.md', en: 'docs/CHANGELOG.en.md', shape: 'changelog' },
  ]`
  const dir = await fixture({
    'CHANGELOG.md': undefined,
    'CHANGELOG.en.md': undefined,
    'docs/CHANGELOG.md': changelog('甲', '乙'),
    'docs/CHANGELOG.en.md': changelogEn('alpha', 'beta')
  }, docsPairs)
  initRepo(dir)
  const base = commit(dir, 'docs: baseline')

  await writeFile(join(dir, 'docs', 'CHANGELOG.md'), changelog('甲改了', '乙'), 'utf8')
  commit(dir, 'docs: one side only')
  const result = await check(dir, '--base', base)
  assert.equal(result.code, 1)
  assert.match(result.stderr, /docs\/CHANGELOG\.md and docs\/CHANGELOG\.en\.md must change together/)
})

test('a missing --config is refused, and so is a config that declares nothing', async () => {
  const dir = await fixture()
  const bare = await run(dir)
  assert.equal(bare.code, 1)
  assert.match(bare.stderr, /--config <module> is required/)

  const missing = await run(dir, '--config', 'nowhere.mjs')
  assert.equal(missing.code, 1)
  assert.match(missing.stderr, /nowhere\.mjs not found/)

  const empty = await fixture({}, '[]')
  const result = await check(empty)
  assert.equal(result.code, 1)
  assert.match(result.stderr, /export a non-empty array of pairs/)

  const shapeless = await fixture({}, `[
    { name: 'README', zh: 'README.md', en: 'README.en.md', shape: 'prose' },
  ]`)
  const unknown = await check(shapeless)
  assert.equal(unknown.code, 1)
  assert.match(unknown.stderr, /README: unknown shape 'prose'/)
})

test('--base without a value is refused', async () => {
  const dir = await fixture()
  const result = await check(dir, '--base')
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
    const result = await check(dir, '--base', zeros)
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
  const result = await check(dir, '--base', 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef')
  assert.notEqual(result.code, 0, 'an unusable revision is a configuration error, not a skip')
})
