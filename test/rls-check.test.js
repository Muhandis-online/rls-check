// The same cases as the site's tests/web/rls-check.test.ts, on the same fixture: the query's real output on Postgres 18
// over a Supabase-shaped database with one table per case.
'use strict'

const test = require('node:test')
const assert = require('node:assert')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const { spawnSync } = require('node:child_process')
const { QUERY, explain, report } = require('../lib')

const FIXTURE = join(__dirname, 'fixtures', 'rls-check-result.json')
const OUTPUT = readFileSync(FIXTURE, 'utf8').trim()

test('names every table by what anyone can do with it, the worst first', () => {
  const r = explain(OUTPUT)
  assert.deepStrictEqual(Object.fromEntries(r.tables.map(t => [t.name, t.level])), {
    profiles_open: 'red', orders_public_true: 'red', invoices_all_users: 'red', notes_view: 'red',
    contact_messages: 'amber', products: 'amber', locked: 'grey', no_grants: 'grey', notes_owner: 'green', safe_view: 'green',
  })
  assert.deepStrictEqual(r.counts, { red: 4, amber: 2, grey: 2, green: 2 })
  assert.strictEqual(r.tables.find(t => t.name === 'profiles_open').findings[0].link, 'https://muhandis.online/lessons/supabase-rls-policy-violation?utm_source=npm')
})

test('reads the result however it is pasted, and refuses anything else', () => {
  assert.ok(explain(`result\n"${OUTPUT}"`).ok)
  assert.ok(!explain('').ok)
  assert.ok(!explain('{"tables": []}').ok)
})

test('the query is the read-only one, tagged with the tool name', () => {
  assert.match(QUERY, /^-- Muhandis RLS check: reads table descriptions only, never a row\./)
  assert.match(QUERY, /'tool', 'muhandis-rls-check'/)
  assert.doesNotMatch(QUERY, /\b(insert|update|delete|drop|alter|grant|revoke)\b/i)
})

test('the report leads with the counts and offers a fix when something is exposed', () => {
  const text = report(OUTPUT)
  assert.match(text.split('\n')[0], /^10 جداول: 4 مكشوف، 2 تأكد منه، 2 مقفول، 2 سليم\.$/)
  assert.match(text, /muhandis\.online\/services\/fix/)
})

test('the CLI explains a file and exits 1 when a table is exposed', () => {
  const run = spawnSync(process.execPath, [join(__dirname, '..', 'cli.js'), FIXTURE, '--json'], { encoding: 'utf8' })
  assert.strictEqual(run.status, 1)
  assert.strictEqual(JSON.parse(run.stdout).counts.red, 4)
  const q = spawnSync(process.execPath, [join(__dirname, '..', 'cli.js'), 'query'], { encoding: 'utf8' })
  assert.strictEqual(q.stdout.trim(), QUERY)
})
