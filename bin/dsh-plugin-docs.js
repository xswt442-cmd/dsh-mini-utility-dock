#!/usr/bin/env node
// Bilingual structure check for the documentation pairs a repository ships.
//
// The pairs are the repository's own declaration — `--config <module>` points at
// a module exporting `{ name, zh, en, shape? }` entries, so which documents
// exist, where they live, and how each is compared is decided there, never here.
// Two shapes are provided:
//   * `markdown` (the default): both files share the same heading-level sequence
//     and code-fence languages — content inside fences is exempt, since that is
//     where language-specific examples live;
//   * `changelog`: both files expose the same releases — the `Unreleased` section
//     included, since that is where the newest edits land — with version, date,
//     per-section item counts, section titles normalized through a bilingual
//     category map (新增/Added, 修复/Fixed, ...);
//   * with `--base <revision>`, both files of every declared pair changed
//     together since that revision — a one-sided edit is a missing translation.
//     An all-zero revision is the null OID, which is what `github.event.before`
//     carries for a branch that was just created or force-pushed: there is no
//     previous revision to diff against, so that one requirement is skipped with
//     a note instead of dying inside `git diff`.
//
// Repositories opt in through their own `docs:check` script; this package
// declares its pairs the same way.

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const read = (file) => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n')

function markdownShape(file) {
  let fenced = false
  const headings = []
  const fences = []

  for (const line of read(file).split('\n')) {
    const fence = line.match(/^\s*```\s*(\S*)/)
    if (fence) {
      if (!fenced) fences.push(fence[1])
      fenced = !fenced
      continue
    }
    if (fenced) continue
    const heading = line.match(/^(#{1,3})\s+/)
    if (heading) headings.push(heading[1].length)
  }

  if (fenced) throw new Error(`${file}: unclosed code fence`)
  return { headings, fences }
}

function changelogShape(file) {
  const releases = []
  let release
  let section

  // A `## ...` heading opens a release and clears the current section, so bullets
  // that follow it before any `###` still count — into an anonymous leading
  // section — instead of being silently dropped.
  const openRelease = (version, date) => {
    release = { version, date, sections: [] }
    releases.push(release)
    section = undefined
  }

  for (const line of read(file).split('\n')) {
    const version = line.match(/^##\s+(\d+\.\d+\.\d+)(?:\s+-\s+(\d{4}-\d{2}-\d{2}))?\s*$/)
    if (version) {
      openRelease(version[1], version[2] ?? '')
      continue
    }
    // `Unreleased` is the version-less top release and usually the most-edited
    // section, so it is compared with the same shape as a numbered one. Both
    // languages keep the literal heading, so the labels match directly.
    if (/^##\s+Unreleased\s*$/i.test(line)) {
      openRelease('Unreleased', '')
      continue
    }
    if (!release) continue

    const heading = line.match(/^###\s+(.+?)\s*$/)
    if (heading) {
      section = { title: heading[1], items: 0 }
      release.sections.push(section)
      continue
    }
    if (/^\s*-\s+/.test(line)) {
      if (!section) {
        section = { title: '', items: 0 }
        release.sections.push(section)
      }
      section.items += 1
    }
  }

  return releases
}

const category = new Map([
  ['新增', 'added'], ['Added', 'added'],
  ['修复', 'fixed'], ['Fixed', 'fixed'],
  ['变更', 'changed'], ['Changed', 'changed'],
  ['移除', 'removed'], ['Removed', 'removed'],
  ['安全', 'security'], ['Security', 'security'],
  ['性能', 'performance'], ['Performance', 'performance'],
  ['兼容性', 'compatibility'], ['Compatibility', 'compatibility'],
  ['维护', 'maintenance'], ['Maintenance', 'maintenance'],
])

const normalizeLog = (file) => changelogShape(file).map((release) => ({
  version: release.version,
  date: release.date,
  sections: release.sections.map(({ title, items }) => ({
    title: category.get(title) ?? title.toLowerCase(),
    items,
  })),
}))

function assertEqual(left, right, message) {
  if (JSON.stringify(left) !== JSON.stringify(right)) {
    throw new Error(`${message}\nleft:  ${JSON.stringify(left)}\nright: ${JSON.stringify(right)}`)
  }
}

// The repository declares its own pairs; this tool names none of them. Paths are
// read from the current directory, so run it from the repository root — `--base`
// compares against paths as Git reports them.
async function loadPairs(argv) {
  const index = argv.indexOf('--config')
  const file = argv[index + 1]
  if (index === -1 || !file) {
    throw new Error('--config <module> is required: the module exports the bilingual pairs this repository ships')
  }
  if (!fs.existsSync(file)) throw new Error(`${file} not found — declare the repository's pairs there`)

  const loaded = await import(pathToFileURL(path.resolve(file)).href)
  const pairs = loaded.pairs ?? loaded.default

  if (!Array.isArray(pairs) || pairs.length === 0) {
    throw new Error(`${file}: export a non-empty array of pairs`)
  }
  for (const pair of pairs) {
    for (const field of ['name', 'zh', 'en']) {
      if (typeof pair?.[field] !== 'string' || !pair[field]) throw new Error(`${file}: every pair needs name, zh and en`)
    }
    if (pair.shape !== undefined && !shapes[pair.shape]) throw new Error(`${file}: ${pair.name}: unknown shape '${pair.shape}'`)
  }
  return pairs
}

const shapes = { markdown: markdownShape, changelog: normalizeLog }

const pairs = await loadPairs(process.argv)

for (const pair of pairs) {
  const shape = shapes[pair.shape ?? 'markdown']
  assertEqual(shape(pair.zh), shape(pair.en), `${pair.name} structure differs between languages`)
}

const baseIndex = process.argv.indexOf('--base')
if (baseIndex !== -1) {
  const base = process.argv[baseIndex + 1]
  if (!base) throw new Error('--base requires a Git revision')

  // The null OID, in either hash length. A workflow that passes
  // `github.event.before` here gets it whenever a branch is created or
  // force-pushed, and `git diff 000... HEAD` is not a comparison with no base —
  // it is an error. So the honest reading is the one the push event states: there
  // is nothing before this push, and the pair test cannot run.
  if (/^0+$/.test(base)) {
    console.log(`note: --base ${base} is the null OID (new branch or force-push) — pair-change check skipped`)
  } else {
    const changed = new Set(execFileSync('git', ['diff', '--name-only', base, 'HEAD'], { encoding: 'utf8' })
      .split(/\r?\n/)
      .filter(Boolean))

    for (const pair of pairs) {
      if (changed.has(pair.zh) !== changed.has(pair.en)) {
        throw new Error(`${pair.zh} and ${pair.en} must change together`)
      }
    }
  }
}

console.log('bilingual docs are structurally aligned')
