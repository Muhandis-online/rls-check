// The RLS check outside the browser: the same read-only query and the same analyser as https://muhandis.online/tools/rls-check.
// lib/rls-check.js is the site's public/rls-check.js, copied byte for byte; in Node it only exports its analyser.
'use strict'

const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const { analyse } = require('./rls-check.js')

const SITE = 'https://muhandis.online'
const TOOL_URL = SITE + '/tools/rls-check'

// Every link to the site names where the visit came from (?utm_source=), so the site's KPI page can count it:
// 'npm' from the command line, 'mcp' from the MCP server.
const tag = (url, source) => url + '?utm_source=' + source

/** The read-only query: run it in your own Supabase SQL Editor. It reads table descriptions only, never a row. */
const QUERY = readFileSync(join(__dirname, '..', 'query.sql'), 'utf8').trim()

const LABEL = { red: 'مكشوف', amber: 'تأكد منه', grey: 'مقفول', green: 'سليم' }
const LABEL_EN = { red: 'exposed', amber: 'check it', grey: 'locked', green: 'safe' }

// «جدول واحد», «جدولين», «3 جداول», «11 جدول»: the count as the site says it.
const tablesWord = n => n === 1 ? 'جدول واحد' : n === 2 ? 'جدولين' : n >= 3 && n <= 10 ? n + ' جداول' : n + ' جدول'

/** The analyser's report, with each lesson link made absolute so it works outside the site. */
function explain(text, source = 'npm') {
  const r = analyse(text)
  if (!r.ok) return r
  return {
    ok: true,
    counts: r.counts,
    tables: r.tables.map(t => ({
      name: t.name,
      kind: t.kind,
      level: t.level,
      label: LABEL[t.level],
      labelEn: LABEL_EN[t.level],
      findings: t.findings.map(f => ({ level: f.level, text: f.text, ...(f.link ? { link: tag(SITE + f.link, source) } : {}) })),
    })),
  }
}

/** The report as plain text, worst table first, in Arabic as the site shows it. */
function report(text, source = 'npm') {
  const r = explain(text, source)
  if (!r.ok) return 'ما قدرنا نقرأ النتيجة. انسخ خانة النتيجة كاملة من Supabase، من أول { إلى آخر }.\n(Could not read the result: paste the whole result cell, from the first { to the last }.)'
  if (!r.tables.length) return 'ما لقينا جداول في public. تأكد إنك شغّلت الاستعلام على مشروع منتجك.'
  const c = r.counts
  const lines = [tablesWord(r.tables.length) + ': ' + c.red + ' مكشوف، ' + c.amber + ' تأكد منه، ' + c.grey + ' مقفول، ' + c.green + ' سليم.', '']
  for (const t of r.tables) {
    lines.push('[' + t.label + '] ' + t.name + (t.kind === 'view' ? ' (view)' : ''))
    for (const f of t.findings) lines.push('  - ' + f.text + (f.link ? ' ' + f.link : ''))
  }
  if (c.red + c.amber) lines.push('', 'تبي مهندس يصلّحها معك؟ ' + tag(SITE + '/services/fix', source))
  return lines.join('\n')
}

module.exports = { QUERY, TOOL_URL, tag, explain, report }
