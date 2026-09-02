#!/usr/bin/env node
import { readFile, writeFile, stat } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const START = '// <dsh-mini-utility-dock>'
const END = '// </dsh-mini-utility-dock>'
const packageRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))
const bootstrapPath = resolve(packageRoot, 'dist', 'bootstrap.js')

function usage() {
  return 'Usage: dsh-mini-utility-dock <sync|check> <client-file>'
}

function error(message) {
  console.error(`dsh-mini-utility-dock: ${message}`)
  process.exitCode = 1
}

async function loadTarget(fileName) {
  if (!fileName || fileName.startsWith('-')) throw new Error('client-file is required')
  const target = resolve(fileName)
  const info = await stat(target).catch(() => null)
  if (!info) throw new Error(`file does not exist: ${target}`)
  if (!info.isFile()) throw new Error(`client-file is not a regular file: ${target}`)
  return { target, source: await readFile(target, 'utf8') }
}

function indentation(line) {
  return (/^[ \t]*/.exec(line) || [''])[0]
}

function locate(source) {
  const lines = source.split(/\r?\n/)
  const starts = lines.reduce((found, line, index) => line.trim() === START ? [...found, index] : found, [])
  const ends = lines.reduce((found, line, index) => line.trim() === END ? [...found, index] : found, [])
  if (starts.length !== 1 || ends.length !== 1 || ends[0] <= starts[0]) {
    throw new Error(`expected exactly one marked block (${START} ... ${END})`)
  }
  return { lines, start: starts[0], end: ends[0], indent: indentation(lines[starts[0]]) }
}

function rendered(source, bootstrap) {
  const newline = source.includes('\r\n') ? '\r\n' : '\n'
  const block = locate(source)
  const body = bootstrap.replace(/\r?\n$/, '').split(/\r?\n/)
    .map((line) => line ? block.indent + line : '')
  const output = [...block.lines.slice(0, block.start + 1), ...body, ...block.lines.slice(block.end)]
    .join(newline)
  return { output, block }
}

async function main() {
  const [command, fileName, ...rest] = process.argv.slice(2)
  if (!['sync', 'check'].includes(command) || !fileName || rest.length) throw new Error(usage())
  const { target, source } = await loadTarget(fileName)
  const bootstrap = await readFile(bootstrapPath, 'utf8')
  const result = rendered(source, bootstrap)
  if (command === 'check') {
    if (source !== result.output) throw new Error(`marked block is out of date: ${target}`)
    console.log(`ok: ${target}`)
    return
  }
  if (source === result.output) {
    console.log(`unchanged: ${target}`)
    return
  }
  await writeFile(target, result.output, 'utf8')
  console.log(`synced: ${target}`)
}

main().catch((cause) => error(cause instanceof Error ? cause.message : String(cause)))
