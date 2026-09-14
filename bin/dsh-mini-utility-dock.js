#!/usr/bin/env node
// Embed a canonical fragment from this package into a consumer file.
//
// Two fragments are maintained the same way, because both have the same shape
// of problem: the consumer must ship the code standalone (a browser classic
// script cannot `import`, and a host half must not depend on the dock being
// installed), so the code is embedded at build time and drift is a build error.
//
//   dsh-mini-utility-dock  -> <dsh-mini-utility-dock> ... </dsh-mini-utility-dock>
//     the Mini Utility Dock bootstrap, embedded into a plugin's lib/client.js
//
//   dsh-loopback-helpers   -> <dsh-loopback-helpers> ... </dsh-loopback-helpers>
//     the loopback predicates, embedded into a plugin's lib/shared.js
//
//   dsh-host-guard         -> <dsh-host-guard> ... </dsh-host-guard>
//     the same-origin request guard, embedded into the same file
//
// The host half of a plugin embeds BOTH shared.js fragments, in the order above,
// because the guard imports the predicates. Each is an independent block with its
// own markers and its own check, so a plugin that only needs the predicates can
// embed just those.
//
// The fragment is selected by the marker already present in the target file, so
// one command serves either target. A consumer calls this through its own
// `dock:sync` / `guard:sync` script; the paired `check` mode is what CI runs.

import { readFile, writeFile, stat } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// Listed in dependency order: the guard fragment reads the predicates the
// loopback fragment declares, so a consumer that wants the guard syncs both, in
// this order, into the same file.
const FRAGMENTS = [
  { name: 'dsh-mini-utility-dock', source: 'bootstrap.js' },
  { name: 'dsh-loopback-helpers', source: 'loopback.js' },
  { name: 'dsh-host-guard', source: 'guard.js' }
]

const packageRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))
const marker = (name, edge) => `// <${edge}${name}>`

function usage() {
  const fragments = FRAGMENTS.map((f) => `  ${marker(f.name, '')} -> dist/${f.source}`).join('\n')
  return [
    'Usage: dsh-mini-utility-dock <sync|check> <consumer-file>',
    '',
    'The fragment is chosen by the marker already present in <consumer-file>:',
    fragments
  ].join('\n')
}

function error(message) {
  console.error(`dsh-mini-utility-dock: ${message}`)
  process.exitCode = 1
}

async function loadTarget(fileName) {
  if (!fileName || fileName.startsWith('-')) throw new Error('consumer-file is required')
  const target = resolve(fileName)
  const info = await stat(target).catch(() => null)
  if (!info) throw new Error(`file does not exist: ${target}`)
  if (!info.isFile()) throw new Error(`consumer-file is not a regular file: ${target}`)
  return { target, source: await readFile(target, 'utf8') }
}

function indentation(line) {
  return (/^[ \t]*/.exec(line) || [''])[0]
}

// Locate every marked block in the file, in fragment order. A host half embeds
// both shared.js fragments, so one command must maintain both; processing them in
// FRAGMENTS order also keeps the dependency order (the guard reads the predicates
// declared by the loopback block above it).
function locate(source) {
  const lines = source.split(/\r?\n/)
  const candidates = FRAGMENTS.map((fragment) => {
    const start = lines.reduce((hits, line, i) => line.trim() === marker(fragment.name, '') ? [...hits, i] : hits, [])
    const end = lines.reduce((hits, line, i) => line.trim() === marker(fragment.name, '/') ? [...hits, i] : hits, [])
    return { fragment, start, end }
  }).filter((candidate) => candidate.start.length || candidate.end.length)

  if (candidates.length === 0) {
    throw new Error(`no fragment marker found; expected at least one marked block (${FRAGMENTS.map((f) => marker(f.name, '')).join(' or ')})`)
  }
  for (const { fragment, start, end } of candidates) {
    if (start.length !== 1 || end.length !== 1 || end[0] <= start[0]) {
      throw new Error(`expected exactly one marked block for ${fragment.name} (${marker(fragment.name, '')} ... ${marker(fragment.name, '/')})`)
    }
  }
  return { lines, blocks: candidates.map(({ fragment, start, end }) => ({ fragment, start: start[0], end: end[0] })) }
}

function rendered(lines, fragmentSource, block) {
  const indent = indentation(lines[block.start])
  const body = fragmentSource.replace(/\r?\n$/, '').split(/\r?\n/)
    .map((line) => line ? indent + line : '')
  return [...lines.slice(0, block.start + 1), ...body, ...lines.slice(block.end)]
}

// Applied from the LAST block to the first. Each pass replaces a line range, so
// doing it bottom-up leaves every earlier block's line indices valid; going
// top-down would shift them and a later pass would splice the wrong lines.
async function main() {
  const [command, fileName, ...rest] = process.argv.slice(2)
  if (!['sync', 'check'].includes(command) || !fileName || rest.length) throw new Error(usage())
  const { target, source } = await loadTarget(fileName)
  const located = locate(source)

  let lines = located.lines
  const applied = []
  for (const block of [...located.blocks].reverse()) {
    const fragmentSource = await readFile(resolve(packageRoot, 'dist', block.fragment.source), 'utf8')
    lines = rendered(lines, fragmentSource, block)
    applied.unshift(block.fragment.name)
  }
  const output = lines.join(source.includes('\r\n') ? '\r\n' : '\n')

  const names = applied.join(', ')
  if (command === 'check') {
    if (output !== source) throw new Error(`marked block is out of date: ${target} (${names})`)
    console.log(`ok: ${target} (${names})`)
    return
  }
  if (source === output) {
    console.log(`unchanged: ${target} (${names})`)
    return
  }
  await writeFile(target, output, 'utf8')
  console.log(`synced: ${target} (${names})`)
}

main().catch((cause) => error(cause instanceof Error ? cause.message : String(cause)))
