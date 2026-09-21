#!/usr/bin/env node
// Bilingual structure check for the documentation pairs the DSH plugins ship:
// README.md against README.en.md, CHANGELOG.md against CHANGELOG.en.md.
//
// Verifies, naming no repository and taking no file arguments (the four names
// are the family convention):
//   * both READMEs share the same heading-level sequence and code-fence
//     languages — content inside fences is exempt, since that is where
//     language-specific examples live;
//   * both CHANGELOGs expose the same releases: version, date, per-section
//     item counts, with section titles normalized through a bilingual
//     category map (新增/Added, 修复/Fixed, ...);
//   * with `--base <revision>`, both files of each pair changed together
//     since that revision — a one-sided edit is a missing translation.
//
// Repositories opt in through their own `docs:check` script; this package
// runs the same check on its own bilingual docs.

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'

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

  for (const line of read(file).split('\n')) {
    const version = line.match(/^##\s+(\d+\.\d+\.\d+)(?:\s+-\s+(\d{4}-\d{2}-\d{2}))?\s*$/)
    if (version) {
      release = { version: version[1], date: version[2] ?? '', sections: [] }
      releases.push(release)
      section = undefined
      continue
    }
    if (!release) continue

    const heading = line.match(/^###\s+(.+?)\s*$/)
    if (heading) {
      section = { title: heading[1], items: 0 }
      release.sections.push(section)
      continue
    }
    if (section && /^\s*-\s+/.test(line)) section.items += 1
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

function assertEqual(left, right, message) {
  if (JSON.stringify(left) !== JSON.stringify(right)) {
    throw new Error(`${message}\nleft:  ${JSON.stringify(left)}\nright: ${JSON.stringify(right)}`)
  }
}

const zhReadme = markdownShape('README.md')
const enReadme = markdownShape('README.en.md')
assertEqual(zhReadme, enReadme, 'README structure differs between languages')

const normalizeLog = (file) => changelogShape(file).map((release) => ({
  version: release.version,
  date: release.date,
  sections: release.sections.map(({ title, items }) => ({
    title: category.get(title) ?? title.toLowerCase(),
    items,
  })),
}))
assertEqual(normalizeLog('CHANGELOG.md'), normalizeLog('CHANGELOG.en.md'), 'CHANGELOG structure differs between languages')

const baseIndex = process.argv.indexOf('--base')
if (baseIndex !== -1) {
  const base = process.argv[baseIndex + 1]
  if (!base) throw new Error('--base requires a Git revision')

  const changed = new Set(execFileSync('git', ['diff', '--name-only', base, 'HEAD'], { encoding: 'utf8' })
    .split(/\r?\n/)
    .filter(Boolean))

  for (const [primary, translation] of [
    ['README.md', 'README.en.md'],
    ['CHANGELOG.md', 'CHANGELOG.en.md'],
  ]) {
    if (changed.has(primary) !== changed.has(translation)) {
      throw new Error(`${primary} and ${translation} must change together`)
    }
  }
}

console.log('bilingual docs are structurally aligned')
