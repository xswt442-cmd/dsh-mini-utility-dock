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
//   dsh-host-guard         -> <dsh-host-guard> ... </dsh-host-guard>
//     the loopback predicates and the same-origin request guard, embedded into a
//     plugin's lib/shared.js
//
// The fragment is selected by the marker already present in the target file, so
// one command serves either target. A consumer calls this through its own
// `dock:sync` / `guard:sync` script; the paired `check` mode is what CI runs.

import { readFile, writeFile, stat } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const FRAGMENTS = [
  { name: 'dsh-mini-utility-dock', source: 'bootstrap.js' },
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

// Locate the single marked block and resolve which fragment it names.
function locate(source) {
  const lines = source.split(/\r?\n/)
  const candidates = FRAGMENTS.map((fragment) => {
    const start = lines.reduce((hits, line, i) => line.trim() === marker(fragment.name, '') ? [...hits, i] : hits, [])
    const end = lines.reduce((hits, line, i) => line.trim() === marker(fragment.name, '/') ? [...hits, i] : hits, [])
    return { fragment, start, end }
  }).filter((candidate) => candidate.start.length || candidate.end.length)

  if (candidates.length === 0) {
    throw new Error(`no fragment marker found; expected one marked block (${FRAGMENTS.map((f) => marker(f.name, '')).join(' or ')})`)
  }
  if (candidates.length > 1) {
    throw new Error(`expected one fragment marker, found ${candidates.length}: ${candidates.map((c) => c.fragment.name).join(', ')}`)
  }

  const { fragment, start, end } = candidates[0]
  if (start.length !== 1 || end.length !== 1 || end[0] <= start[0]) {
    throw new Error(`expected exactly one marked block for ${fragment.name} (${marker(fragment.name, '')} ... ${marker(fragment.name, '/')})`)
  }
  return { lines, start: start[0], end: end[0], indent: indentation(lines[start[0]]), fragment }
}

function rendered(source, fragmentSource, block) {
  const newline = source.includes('\r\n') ? '\r\n' : '\n'
  const body = fragmentSource.replace(/\r?\n$/, '').split(/\r?\n/)
    .map((line) => line ? block.indent + line : '')
  return [...block.lines.slice(0, block.start + 1), ...body, ...block.lines.slice(block.end)].join(newline)
}

async function main() {
  const [command, fileName, ...rest] = process.argv.slice(2)
  if (!['sync', 'check'].includes(command) || !fileName || rest.length) throw new Error(usage())
  const { target, source } = await loadTarget(fileName)
  const block = locate(source)
  const fragmentSource = await readFile(resolve(packageRoot, 'dist', block.fragment.source), 'utf8')
  const output = rendered(source, fragmentSource, block)

  if (command === 'check') {
    if (source !== output) throw new Error(`${block.fragment.name} block is out of date: ${target}`)
    console.log(`ok: ${target} (${block.fragment.name})`)
    return
  }
  if (source === output) {
    console.log(`unchanged: ${target} (${block.fragment.name})`)
    return
  }
  await writeFile(target, output, 'utf8')
  console.log(`synced: ${target} (${block.fragment.name})`)
}

main().catch((cause) => error(cause instanceof Error ? cause.message : String(cause)))
