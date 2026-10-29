// The self-check at /tools/rls-check. The founder runs a read-only query in their own Supabase SQL Editor and pastes its
// result here; this file reads it and explains each table in Arabic. It runs only in the browser: nothing pasted is sent
// anywhere. The query reads table descriptions (RLS, policies, grants, column names), never a row of data.
(function (root) {
  'use strict'

  // «جدول واحد», «جدولين», «3 جداول», «11 جدول»: a count of tables as the dialect says it.
  var tablesWord = function (n) { return n === 1 ? 'جدول واحد' : n === 2 ? 'جدولين' : n >= 3 && n <= 10 ? n + ' جداول' : n + ' جدول' }

  var LESSON = {
    rls: '/lessons/supabase-rls-policy-violation',
    grants: '/lessons/permission-denied-for-table',
    lovable: '/lessons/lovable-security-incidents',
  }
  // Column names that suggest the rows are about people, so a table anyone can read is a leak, not a catalogue.
  var PERSONAL = /(^|_)(email|phone|mobile|user|user_id|owner|owner_id|profile|first_name|last_name|full_name|address|birth|dob|national|iqama|passport|iban|card|password|token|secret|salary|customer|customer_id|order|invoice|payment)($|_)/i
  var RANK = { red: 3, amber: 2, grey: 1, green: 0 }

  function isTrue(expr) { return expr != null && String(expr).replace(/[()\s]/g, '').toLowerCase() === 'true' }
  function usesOwner(expr) { return expr != null && /auth\.uid\(\)|auth\.jwt\(\)/i.test(String(expr)) }
  function has(grants, role, priv) { return grants.indexOf(role + ':' + priv) >= 0 || grants.indexOf('PUBLIC:' + priv) >= 0 }
  function forRole(p, role) { return p.roles.indexOf(role) >= 0 || p.roles.indexOf('public') >= 0 }
  function covers(p, cmd) { return p.cmd === cmd || p.cmd === 'ALL' }

  /** Reads the pasted result: the JSON cell as Supabase shows it, with or without the column name or quotes around it. */
  function parse(text) {
    var s = String(text || '')
    var a = s.indexOf('{'), b = s.lastIndexOf('}')
    if (a < 0 || b < a) return null
    try {
      var j = JSON.parse(s.slice(a, b + 1))
      return j && j.tool === 'muhandis-rls-check' && Array.isArray(j.tables) ? j : null
    } catch (e) { return null }
  }

  function tableFindings(t) {
    var out = []
    var grants = t.grants || [], policies = t.policies || [], columns = t.columns || []
    var personal = columns.some(function (c) { return PERSONAL.test(c) })
    var anonRead = has(grants, 'anon', 'SELECT'), authRead = has(grants, 'authenticated', 'SELECT')
    var anonWrite = ['INSERT', 'UPDATE', 'DELETE'].some(function (p) { return has(grants, 'anon', p) })
    var authWrite = ['INSERT', 'UPDATE', 'DELETE'].some(function (p) { return has(grants, 'authenticated', p) })

    if (t.kind === 'view') {
      if (t.invoker) out.push({ level: 'green', text: 'الـ view مضبوط بـ security_invoker، فيطبّق قواعد RLS حق الجداول اللي تحته.' })
      else if (anonRead) out.push({ level: 'red', text: 'view بدون security_invoker ويقدر الزائر يقرأه: الـ view يتجاوز قواعد RLS حق الجداول اللي تحته، فأي أحد عنده المفتاح العام يقرأ اللي فيه. الحل: security_invoker = true، أو اسحب الصلاحية من anon.', link: LESSON.rls })
      else if (authRead) out.push({ level: 'amber', text: 'view بدون security_invoker: أي مستخدم مسجّل يقرأ اللي فيه بدون قواعد RLS. إذا فيه بيانات أشخاص، فعّل security_invoker = true.', link: LESSON.rls })
      else out.push({ level: 'grey', text: 'ما عليه صلاحيات للزوار ولا للمستخدمين، فالتطبيق ما يقرأه.' })
      return out
    }

    if (!t.rls) {
      if (anonRead || anonWrite) out.push({ level: 'red', text: 'RLS مطفي، وأي أحد عنده المفتاح العام ' + (anonWrite ? 'يقرأ ويضيف ويعدّل ويحذف' : 'يقرأ') + ' كل السطور، بدون تسجيل دخول. المفتاح العام موجود في كود منتجك، فاعتبره معروف للكل.', link: LESSON.rls })
      else if (authRead || authWrite) out.push({ level: 'red', text: 'RLS مطفي، وأي مستخدم مسجّل ' + (authWrite ? 'يقرأ ويعدّل' : 'يقرأ') + ' كل السطور، حتى سطور غيره.', link: LESSON.rls })
      else out.push({ level: 'grey', text: 'RLS مطفي، لكن ما عليه صلاحيات للزوار ولا للمستخدمين، فالتطبيق ما يقدر يقرأه. إذا تبي منتجك يستخدمه: فعّل RLS وأضف قاعدة، وبعدها أعط الصلاحية.', link: LESSON.grants })
      return out
    }

    var permissive = policies.filter(function (p) { return p.permissive !== 'RESTRICTIVE' })
    if (!permissive.length) {
      out.push({ level: 'grey', text: 'RLS مفعّل وما فيه قواعد، فالجدول مقفول: التطبيق ما يقرأ ولا يكتب فيه. إذا منتجك يحتاجه، أضف قاعدة لكل عملية.', link: LESSON.rls })
      return out
    }

    // Reading every row.
    var anonAll = anonRead && permissive.some(function (p) { return forRole(p, 'anon') && covers(p, 'SELECT') && isTrue(p.using) })
    var authAll = !anonAll && authRead && permissive.some(function (p) { return forRole(p, 'authenticated') && covers(p, 'SELECT') && isTrue(p.using) })
    if (anonAll) {
      out.push(personal
        ? { level: 'red', text: 'قاعدة قراءة شرطها true للزوار، والجدول فيه أعمدة تخص أشخاص (' + columns.filter(function (c) { return PERSONAL.test(c) }).join('، ') + '): أي أحد يقرأ كل السطور بدون تسجيل دخول.', link: LESSON.rls }
        : { level: 'amber', text: 'أي زائر يقرأ كل السطور. هذا مقبول فقط إذا الجدول بيانات عامة فعلًا، مثل قائمة منتجات. تأكد إن ما فيه أي معلومة تخص عميل.', link: LESSON.rls })
    } else if (authAll) {
      out.push(personal
        ? { level: 'red', text: 'قاعدة قراءة شرطها true لكل مستخدم مسجّل، والجدول فيه أعمدة تخص أشخاص: أي عميل يسجّل حساب يقرأ بيانات كل العملاء.', link: LESSON.rls }
        : { level: 'amber', text: 'أي مستخدم مسجّل يقرأ كل السطور، حتى سطور غيره. مقبول لبيانات مشتركة، وخطر لبيانات تخص كل عميل.', link: LESSON.rls })
    }

    // Changing or deleting other people's rows.
    ;['UPDATE', 'DELETE'].forEach(function (cmd) {
      var verb = cmd === 'UPDATE' ? 'يعدّل' : 'يحذف'
      if (has(grants, 'anon', cmd) && permissive.some(function (p) { return forRole(p, 'anon') && covers(p, cmd) && isTrue(p.using) }))
        out.push({ level: 'red', text: 'أي زائر ' + verb + ' أي سطر: قاعدة ' + cmd + ' شرطها true للكل.', link: LESSON.rls })
      else if (has(grants, 'authenticated', cmd) && permissive.some(function (p) { return forRole(p, 'authenticated') && covers(p, cmd) && isTrue(p.using) }))
        out.push({ level: 'red', text: 'أي مستخدم مسجّل ' + verb + ' سطور غيره: قاعدة ' + cmd + ' شرطها true.', link: LESSON.rls })
    })

    // Adding rows.
    if (has(grants, 'anon', 'INSERT') && permissive.some(function (p) { return forRole(p, 'anon') && covers(p, 'INSERT') && isTrue(p.check) }))
      out.push({ level: 'amber', text: 'أي زائر يضيف سطور بدون تسجيل دخول. مقبول لنموذج تواصل، لكن حط حد للطلبات عشان ما يمتلي سبام.' })
    else if (columns.indexOf('user_id') >= 0 && has(grants, 'authenticated', 'INSERT') && permissive.some(function (p) { return forRole(p, 'authenticated') && covers(p, 'INSERT') && isTrue(p.check) }))
      out.push({ level: 'amber', text: 'أي مستخدم مسجّل يضيف سطر باسم مستخدم ثاني: شرط الإضافة true بدل ما يتأكد إن user_id يساوي auth.uid().', link: LESSON.rls })

    if (!out.length && permissive.some(function (p) { return usesOwner(p.using) || usesOwner(p.check) }))
      out.push({ level: 'green', text: 'القواعد مربوطة بصاحب السطر عن طريق auth.uid، وما لقينا قاعدة مفتوحة للكل.' })
    if (!out.length)
      out.push({ level: 'green', text: 'ما لقينا قاعدة مفتوحة للكل. هذا فحص للقواعد الظاهرة، فجرّب بعد بحسابين إن كل واحد يشوف بياناته فقط.' })
    return out
  }

  /** Every table with its findings, the worst table first. */
  function analyse(text) {
    var j = parse(text)
    if (!j) return { ok: false }
    var tables = j.tables.map(function (t) {
      var findings = tableFindings(t)
      var level = findings.reduce(function (w, f) { return RANK[f.level] > RANK[w] ? f.level : w }, 'green')
      return { name: t.name, kind: t.kind, level: level, findings: findings }
    }).sort(function (a, b) { return RANK[b.level] - RANK[a.level] || (a.name < b.name ? -1 : 1) })
    var counts = { red: 0, amber: 0, grey: 0, green: 0 }
    tables.forEach(function (t) { counts[t.level]++ })
    return { ok: true, tables: tables, counts: counts }
  }

  var api = { analyse: analyse }
  if (typeof module === 'object' && module.exports) { module.exports = api; return }
  root.MuhandisRls = api

  // ---------- the page ----------
  var form = document.querySelector('[data-rls-check]')
  if (!form) return
  var input = form.querySelector('textarea')
  var out = document.querySelector('[data-rls-results]')
  var LABEL = { red: 'مكشوف', amber: 'تأكد منه', grey: 'مقفول', green: 'سليم' }

  document.querySelectorAll('[data-copy]').forEach(function (btn) {
    // Shown only where the browser can copy; elsewhere the query is selected by hand.
    btn.hidden = !navigator.clipboard
    btn.addEventListener('click', function () {
      var src = document.getElementById(btn.getAttribute('data-copy'))
      if (!src || !navigator.clipboard) return
      navigator.clipboard.writeText(src.textContent).then(function () {
        var was = btn.textContent
        btn.textContent = 'انتسخ'
        setTimeout(function () { btn.textContent = was }, 1600)
      })
    })
  })

  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e }

  form.addEventListener('submit', function (ev) {
    ev.preventDefault()
    var r = analyse(input.value)
    out.textContent = ''
    if (!r.ok) {
      out.appendChild(el('p', 'rls-error', 'ما قدرنا نقرأ النتيجة. انسخ خانة النتيجة كاملة من Supabase، من أول { إلى آخر }، والصقها هنا.'))
      out.focus()
      return
    }
    if (!r.tables.length) {
      out.appendChild(el('p', 'rls-error', 'ما لقينا جداول في public. تأكد إنك شغّلت الاستعلام على مشروع منتجك.'))
      out.focus()
      return
    }
    var sum = el('p', 'rls-summary')
    sum.textContent = tablesWord(r.tables.length) + ': ' + r.counts.red + ' مكشوف، ' + r.counts.amber + ' تأكد منه، ' + r.counts.grey + ' مقفول، ' + r.counts.green + ' سليم.'
    out.appendChild(sum)
    var list = el('ul', 'rls-list')
    r.tables.forEach(function (t) {
      var li = el('li', 'rls-item rls-' + t.level)
      var head = el('p', 'rls-head')
      head.appendChild(el('span', 'rls-badge', LABEL[t.level]))
      head.appendChild(el('code', null, t.name))
      if (t.kind === 'view') head.appendChild(el('span', 'rls-kind', 'view'))
      li.appendChild(head)
      t.findings.forEach(function (f) {
        var p = el('p', 'rls-finding', f.text)
        if (f.link) { p.appendChild(document.createTextNode(' ')); var a = el('a', null, 'اقرأ الدرس'); a.href = f.link; p.appendChild(a) }
        li.appendChild(p)
      })
      list.appendChild(li)
    })
    out.appendChild(list)
    var next = document.querySelector('[data-rls-next]')
    if (next) next.hidden = r.counts.red + r.counts.amber === 0
    out.focus()
  })
})(this)
