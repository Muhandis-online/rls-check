// The Claude skill (skills/rls-check) must say exactly what the site and the npm package say: the same query, and a
// Python analyser that gives the same result as lib/rls-check.js. Skipped where python3 is not installed.
'use strict'

const test = require('node:test')
const assert = require('node:assert')
const { readFileSync, readdirSync, writeFileSync, mkdtempSync } = require('node:fs')
const { join } = require('node:path')
const { tmpdir } = require('node:os')
const { spawnSync } = require('node:child_process')
const { analyse } = require('../lib/rls-check.js')

const ROOT = join(__dirname, '..')
const SKILL = join(ROOT, 'skills', 'rls-check')
const SCRIPT = join(SKILL, 'scripts', 'rls_check.py')
const FIXTURES = join(__dirname, 'fixtures')
const PYTHON = ['python3', 'python'].find(p => spawnSync(p, ['--version']).status === 0)

const python = (file, ...args) => spawnSync(PYTHON, [SCRIPT, file, ...args], { encoding: 'utf8' })
const SITE = 'https://muhandis.online'

test('the skill ships the same query as the package', () => {
  assert.strictEqual(readFileSync(join(SKILL, 'query.sql'), 'utf8'), readFileSync(join(ROOT, 'query.sql'), 'utf8'))
})

test('SKILL.md names the skill and says when to use it', () => {
  const head = readFileSync(join(SKILL, 'SKILL.md'), 'utf8').split('---')[1]
  assert.match(head, /^name: rls-check$/m)
  const description = head.match(/^description: (.+)$/m)[1]
  assert.ok(description.length <= 1024)
})

test('the Python analyser gives the same result as lib/rls-check.js on every fixture', { skip: !PYTHON && 'python3 not installed' }, () => {
  for (const name of readdirSync(FIXTURES).filter(f => f.endsWith('.json'))) {
    const file = join(FIXTURES, name)
    const js = analyse(readFileSync(file, 'utf8'))
    const run = python(file, '--json')
    assert.strictEqual(run.status, 0, run.stderr)
    const py = JSON.parse(run.stdout)
    // The skill links the lessons with their full address; the site links them relative to itself.
    for (const t of py.tables) for (const f of t.findings) {
      if (f.link) f.link = f.link.replace(SITE, '')
      else delete f.link
    }
    assert.deepStrictEqual(py, js, name)
  }
})

test('the Python analyser reads the result however it is pasted, and refuses anything else', { skip: !PYTHON && 'python3 not installed' }, () => {
  const output = readFileSync(join(FIXTURES, 'rls-check-result.json'), 'utf8').trim()
  const dir = mkdtempSync(join(tmpdir(), 'rls-skill-'))
  const cases = [[`result\n"${output}"`, true], ['', false], ['{"tables": []}', false]]
  for (const [text, ok] of cases) {
    const file = join(dir, 'pasted.txt')
    writeFileSync(file, text)
    assert.strictEqual(JSON.parse(python(file, '--json').stdout).ok, ok, text.slice(0, 20))
  }
})
