#!/usr/bin/env node
// Embed a canonical fragment from this package into a consumer file.
//
// Every fragment is maintained the same way, because all of them have the same
// shape of problem: the consumer must ship the code standalone (a browser classic
// script cannot `import`, and a host half must not depend on this package being
// installed), so the code is embedded at build time and drift is a build error.
//
//   dsh-loopback-helpers   -> <dsh-loopback-helpers> ... </dsh-loopback-helpers>
//     the loopback predicates, embedded into a plugin's lib/shared.js
//
//   dsh-host-guard         -> <dsh-host-guard> ... </dsh-host-guard>
//     the same-origin request guard, embedded into the same file
//
//   dsh-host-http          -> <dsh-host-http> ... </dsh-host-http>
//     the host response glue: JSON replies, the POST gate, the browser
//     authorizer, embedded into the same file below the guard block
//
//   dsh-utility-launcher   -> <dsh-utility-launcher> ... </dsh-utility-launcher>
//     the shared launcher assembly: one icon plus the menu of utility panels it
//     opens, embedded into a plugin's lib/client.js
//
// The host half of a plugin embeds ALL THREE shared.js fragments, in the order
// above, because its guard reads the predicates the block above it declares. Each
// is an independent block with its own markers and its own check, so a plugin that
// only needs the predicates can embed just those.
//
// The fragment is selected by the marker already present in the target file, so
// one command serves every target and only a named block is ever touched. A
// consumer calls this through its own `launcher:sync` / `guard:sync` /
// `loopback:sync` / `http:sync` script; the paired `check` mode is what CI runs.

import { readFile, writeFile, stat } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// Listed in the order the blocks sit in a consumer's file. That order is
// load-bearing for the consumer, not for this tool:
//
//   1. the guard fragment reads the predicates the loopback fragment declares, so
//      a consumer that wants the guard syncs both, loopback first;
//   2. the host-http fragment lands below the guard block, where a consumer's own
//      `lib/shared.js` glue has always lived. It depends on neither block above
//      it and declares nothing they declare, so the three coexist in one file;
//   3. the launcher is independent of all of them and lands in the client half
//      instead, so it sits last.
//
// `main()` replaces each block working from the bottom of the file upward, and it
// orders that pass by the line numbers it found rather than by this list, so
// adding a row here states where a block sits and cannot shift another block's
// splice. Registering a fragment whose markers sit in a different order is still
// worth catching — `dsh-plugin-parity` checks it across repositories.
const FRAGMENTS = [
  { name: 'dsh-loopback-helpers', source: 'loopback.js' },
  { name: 'dsh-host-guard', source: 'guard.js' },
  { name: 'dsh-host-http', source: 'host-http.js' },
  { name: 'dsh-utility-launcher', source: 'launcher.js' }
]

const packageRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))
const marker = (name, edge) => `// <${edge}${name}>`

function usage() {
  const fragments = FRAGMENTS.map((f) => `  ${marker(f.name, '')} ... ${marker(f.name, '/')}  ->  dist/${f.source}`).join('\n')
  return [
    'Usage: dsh-mini-utility-dock <sync|check> <consumer-file>',
    '',
    'The blocks to maintain are the ones whose markers are present in <consumer-file>;',
    'one command handles every block in that file:',
    fragments,
    '',
    'A plugin host half embeds the three lib/shared.js blocks: the loopback',
    'predicates, the same-origin guard that reads them, and the host HTTP glue',
    '(JSON replies, the POST gate, the browser authorizer) below the guard. The',
    'launcher block belongs to the client half in lib/client.js.',
    '`sync` writes them, `check` exits non-zero on drift.'
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
// all three shared.js fragments, so one command must maintain all of them;
// processing them in FRAGMENTS order also keeps the dependency order (the guard
// reads the predicates declared by the loopback block above it, and the HTTP glue
// sits below both without reading either).
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
  const blocks = candidates.map(({ fragment, start, end }) => ({ fragment, start: start[0], end: end[0] }))
  // Each block is replaced by splicing its own line range, so two different
  // fragments' ranges must not overlap. Interleaved markers (`<A> <B> </A> </B>`)
  // would make one pass write into the range another pass had just rewritten, so
  // the result would be corrupted rather than merely stale; the uniqueness of each
  // marker pair is enforced above, and this closes the case a single pair cannot.
  for (let i = 0; i < blocks.length; i++) {
    for (let j = i + 1; j < blocks.length; j++) {
      if (blocks[i].start <= blocks[j].end && blocks[j].start <= blocks[i].end) {
        throw new Error(`marked blocks for ${blocks[i].fragment.name} and ${blocks[j].fragment.name} overlap; each marker pair must enclose its own lines`)
      }
    }
  }
  return { lines, blocks }
}

function rendered(lines, fragmentSource, block) {
  const indent = indentation(lines[block.start])
  const body = fragmentSource.replace(/\r?\n$/, '').split(/\r?\n/)
    .map((line) => line ? indent + line : '')
  return [...lines.slice(0, block.start + 1), ...body, ...lines.slice(block.end)]
}

// One pass over the target file maintains EVERY marked block it carries, applied
// from the bottom of the file upward so each block's line indices are still valid
// when its turn comes. See the loop below for why that order is the whole trick.
async function main() {
  const [command, fileName, ...rest] = process.argv.slice(2)
  if (!['sync', 'check'].includes(command) || !fileName || rest.length) throw new Error(usage())
  const { target, source } = await loadTarget(fileName)
  const located = locate(source)

  let lines = located.lines
  const applied = []
  // Walk by line position, the block nearest the end of the file first. Each pass
  // replaces a line range, so every block above it must keep valid indices; going
  // top-down would shift them and a later pass would splice the wrong lines.
  // `locate()` has already rejected any file whose marker ranges overlap, so these
  // blocks are disjoint: the pass can be ordered by the lines themselves rather
  // than by the table, and a table/file order disagreement then only rewrites
  // blocks in a different sequence, corrupting nothing.
  for (const block of [...located.blocks].sort((a, b) => b.start - a.start)) {
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
