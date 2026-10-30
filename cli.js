#!/usr/bin/env node
// muhandis-rls-check: prints the read-only query, or explains its result. It never connects to your database and needs
// no key: you run the query yourself in the Supabase SQL Editor, save the result cell, and pass it here.
'use strict'

const { readFileSync } = require('node:fs')
const { QUERY, TOOL_URL, tag, explain, report } = require('./lib')

const args = process.argv.slice(2)
const json = args.includes('--json')
const rest = args.filter(a => a !== '--json')

const HELP = `muhandis-rls-check

  muhandis-rls-check query            اطبع الاستعلام (للقراءة فقط) وشغّله في SQL Editor حق Supabase
                                      print the read-only query to run in your Supabase SQL Editor
  muhandis-rls-check result.json      اشرح النتيجة جدول جدول / explain the result, table by table
  cat result.json | muhandis-rls-check
  muhandis-rls-check mcp              شغّل خادم MCP لمساعد الذكاء الاصطناعي / start the MCP server
  --json                              النتيجة بصيغة JSON / machine-readable output

The same check in the browser: ${tag(TOOL_URL, 'npm')}`

function read(src) {
  return src === '-' || !src ? readFileSync(0, 'utf8') : readFileSync(src, 'utf8')
}

if (rest[0] === 'mcp') {
  // `npx -y muhandis-rls-check mcp` starts the MCP server: one package, one command, on every OS (npx -p … fails under cmd).
  require('./mcp.js')
} else if (rest[0] === 'query') {
  process.stdout.write(QUERY + '\n')
} else if (rest[0] === '-h' || rest[0] === '--help' || (!rest.length && process.stdin.isTTY)) {
  process.stdout.write(HELP + '\n')
} else {
  const text = read(rest[0])
  const r = explain(text)
  process.stdout.write((json ? JSON.stringify(r, null, 2) : report(text)) + '\n')
  // Exit 1 when a table is exposed, so the check can gate a CI step.
  process.exitCode = r.ok ? (r.counts.red ? 1 : 0) : 2
}
