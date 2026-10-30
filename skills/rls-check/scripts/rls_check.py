"""The RLS check's analyser in Python, for the Claude skill: the same rules and the same Arabic text as lib/rls-check.js
(the site's public/rls-check.js). test/skill.test.js checks that both give the same result on every fixture.

It reads the JSON result of query.sql, which the project owner runs in their own Supabase SQL Editor: table descriptions
only (RLS on or off, policies, grants, column names), never a row of data. It needs no key and makes no network call.

    python3 rls_check.py result.txt          # the report, in Arabic
    python3 rls_check.py result.txt --json   # the same as JSON
"""
import json
import re

SITE = "https://muhandis.online"
LESSON = {
    "rls": SITE + "/lessons/supabase-rls-policy-violation",
    "grants": SITE + "/lessons/permission-denied-for-table",
    "lovable": SITE + "/lessons/lovable-security-incidents",
}
# Column names that suggest the rows are about people, so a table anyone can read is a leak, not a catalogue.
PERSONAL = re.compile(
    r"(^|_)(email|phone|mobile|user|user_id|owner|owner_id|profile|first_name|last_name|full_name|address|birth|dob|"
    r"national|iqama|passport|iban|card|password|token|secret|salary|customer|customer_id|order|invoice|payment)($|_)",
    re.I,
)
RANK = {"red": 3, "amber": 2, "grey": 1, "green": 0}
LABEL = {"red": "مكشوف", "amber": "تأكد منه", "grey": "مقفول", "green": "سليم"}


def tables_word(n):
    return "جدول واحد" if n == 1 else "جدولين" if n == 2 else f"{n} جداول" if 3 <= n <= 10 else f"{n} جدول"


def is_true(expr):
    return expr is not None and re.sub(r"[()\s]", "", str(expr)).lower() == "true"


def uses_owner(expr):
    return expr is not None and re.search(r"auth\.uid\(\)|auth\.jwt\(\)", str(expr), re.I) is not None


def has(grants, role, priv):
    return f"{role}:{priv}" in grants or f"PUBLIC:{priv}" in grants


def for_role(p, role):
    roles = p.get("roles") or []
    return role in roles or "public" in roles


def covers(p, cmd):
    return p.get("cmd") == cmd or p.get("cmd") == "ALL"


def parse(text):
    """The JSON cell as Supabase shows it, with or without the column name or quotes around it."""
    s = str(text or "")
    a, b = s.find("{"), s.rfind("}")
    if a < 0 or b < a:
        return None
    try:
        j = json.loads(s[a : b + 1])
    except ValueError:
        return None
    return j if isinstance(j, dict) and j.get("tool") == "muhandis-rls-check" and isinstance(j.get("tables"), list) else None


def f(level, text, link=None):
    return {"level": level, "text": text, "link": link}


def table_findings(t):
    out = []
    grants, policies, columns = t.get("grants") or [], t.get("policies") or [], t.get("columns") or []
    personal_cols = [c for c in columns if PERSONAL.search(c)]
    personal = bool(personal_cols)
    anon_read, auth_read = has(grants, "anon", "SELECT"), has(grants, "authenticated", "SELECT")
    anon_write = any(has(grants, "anon", p) for p in ("INSERT", "UPDATE", "DELETE"))
    auth_write = any(has(grants, "authenticated", p) for p in ("INSERT", "UPDATE", "DELETE"))

    if t.get("kind") == "view":
        if t.get("invoker"):
            out.append(f("green", "الـ view مضبوط بـ security_invoker، فيطبّق قواعد RLS حق الجداول اللي تحته."))
        elif anon_read:
            out.append(f("red", "view بدون security_invoker ويقدر الزائر يقرأه: الـ view يتجاوز قواعد RLS حق الجداول اللي تحته، فأي أحد عنده المفتاح العام يقرأ اللي فيه. الحل: security_invoker = true، أو اسحب الصلاحية من anon.", LESSON["rls"]))
        elif auth_read:
            out.append(f("amber", "view بدون security_invoker: أي مستخدم مسجّل يقرأ اللي فيه بدون قواعد RLS. إذا فيه بيانات أشخاص، فعّل security_invoker = true.", LESSON["rls"]))
        else:
            out.append(f("grey", "ما عليه صلاحيات للزوار ولا للمستخدمين، فالتطبيق ما يقرأه."))
        return out

    if not t.get("rls"):
        if anon_read or anon_write:
            out.append(f("red", "RLS مطفي، وأي أحد عنده المفتاح العام " + ("يقرأ ويضيف ويعدّل ويحذف" if anon_write else "يقرأ") + " كل السطور، بدون تسجيل دخول. المفتاح العام موجود في كود منتجك، فاعتبره معروف للكل.", LESSON["rls"]))
        elif auth_read or auth_write:
            out.append(f("red", "RLS مطفي، وأي مستخدم مسجّل " + ("يقرأ ويعدّل" if auth_write else "يقرأ") + " كل السطور، حتى سطور غيره.", LESSON["rls"]))
        else:
            out.append(f("grey", "RLS مطفي، لكن ما عليه صلاحيات للزوار ولا للمستخدمين، فالتطبيق ما يقدر يقرأه. إذا تبي منتجك يستخدمه: فعّل RLS وأضف قاعدة، وبعدها أعط الصلاحية.", LESSON["grants"]))
        return out

    permissive = [p for p in policies if p.get("permissive") != "RESTRICTIVE"]
    if not permissive:
        out.append(f("grey", "RLS مفعّل وما فيه قواعد، فالجدول مقفول: التطبيق ما يقرأ ولا يكتب فيه. إذا منتجك يحتاجه، أضف قاعدة لكل عملية.", LESSON["rls"]))
        return out

    # Reading every row.
    anon_all = anon_read and any(for_role(p, "anon") and covers(p, "SELECT") and is_true(p.get("using")) for p in permissive)
    auth_all = (not anon_all) and auth_read and any(for_role(p, "authenticated") and covers(p, "SELECT") and is_true(p.get("using")) for p in permissive)
    if anon_all:
        out.append(
            f("red", "قاعدة قراءة شرطها true للزوار، والجدول فيه أعمدة تخص أشخاص (" + "، ".join(personal_cols) + "): أي أحد يقرأ كل السطور بدون تسجيل دخول.", LESSON["rls"])
            if personal
            else f("amber", "أي زائر يقرأ كل السطور. هذا مقبول فقط إذا الجدول بيانات عامة فعلًا، مثل قائمة منتجات. تأكد إن ما فيه أي معلومة تخص عميل.", LESSON["rls"])
        )
    elif auth_all:
        out.append(
            f("red", "قاعدة قراءة شرطها true لكل مستخدم مسجّل، والجدول فيه أعمدة تخص أشخاص: أي عميل يسجّل حساب يقرأ بيانات كل العملاء.", LESSON["rls"])
            if personal
            else f("amber", "أي مستخدم مسجّل يقرأ كل السطور، حتى سطور غيره. مقبول لبيانات مشتركة، وخطر لبيانات تخص كل عميل.", LESSON["rls"])
        )

    # Changing or deleting other people's rows.
    for cmd in ("UPDATE", "DELETE"):
        verb = "يعدّل" if cmd == "UPDATE" else "يحذف"
        if has(grants, "anon", cmd) and any(for_role(p, "anon") and covers(p, cmd) and is_true(p.get("using")) for p in permissive):
            out.append(f("red", f"أي زائر {verb} أي سطر: قاعدة {cmd} شرطها true للكل.", LESSON["rls"]))
        elif has(grants, "authenticated", cmd) and any(for_role(p, "authenticated") and covers(p, cmd) and is_true(p.get("using")) for p in permissive):
            out.append(f("red", f"أي مستخدم مسجّل {verb} سطور غيره: قاعدة {cmd} شرطها true.", LESSON["rls"]))

    # Adding rows.
    if has(grants, "anon", "INSERT") and any(for_role(p, "anon") and covers(p, "INSERT") and is_true(p.get("check")) for p in permissive):
        out.append(f("amber", "أي زائر يضيف سطور بدون تسجيل دخول. مقبول لنموذج تواصل، لكن حط حد للطلبات عشان ما يمتلي سبام."))
    elif "user_id" in columns and has(grants, "authenticated", "INSERT") and any(for_role(p, "authenticated") and covers(p, "INSERT") and is_true(p.get("check")) for p in permissive):
        out.append(f("amber", "أي مستخدم مسجّل يضيف سطر باسم مستخدم ثاني: شرط الإضافة true بدل ما يتأكد إن user_id يساوي auth.uid().", LESSON["rls"]))

    if not out and any(uses_owner(p.get("using")) or uses_owner(p.get("check")) for p in permissive):
        out.append(f("green", "القواعد مربوطة بصاحب السطر عن طريق auth.uid، وما لقينا قاعدة مفتوحة للكل."))
    if not out:
        out.append(f("green", "ما لقينا قاعدة مفتوحة للكل. هذا فحص للقواعد الظاهرة، فجرّب بعد بحسابين إن كل واحد يشوف بياناته فقط."))
    return out


def analyse(text):
    """Every table with its findings, the worst table first."""
    j = parse(text)
    if not j:
        return {"ok": False}
    tables = []
    for t in j["tables"]:
        findings = table_findings(t)
        level = "green"
        for x in findings:
            if RANK[x["level"]] > RANK[level]:
                level = x["level"]
        tables.append({"name": t.get("name"), "kind": t.get("kind"), "level": level, "findings": findings})
    tables.sort(key=lambda t: (-RANK[t["level"]], t["name"]))
    counts = {k: 0 for k in RANK}
    for t in tables:
        counts[t["level"]] += 1
    return {"ok": True, "tables": tables, "counts": counts}


def report(text):
    """The result as Arabic markdown, as the site shows it."""
    r = analyse(text)
    if not r["ok"]:
        return "ما قدرنا نقرأ النتيجة. انسخ خانة النتيجة كاملة من Supabase، من أول { إلى آخر }، والصقها هنا."
    if not r["tables"]:
        return "ما لقينا جداول في public. تأكد إنك شغّلت الاستعلام على مشروع منتجك."
    c = r["counts"]
    lines = [f"**{tables_word(len(r['tables']))}: {c['red']} مكشوف، {c['amber']} تأكد منه، {c['grey']} مقفول، {c['green']} سليم.**", ""]
    for t in r["tables"]:
        kind = " (view)" if t["kind"] == "view" else ""
        lines.append(f"### {LABEL[t['level']]}: `{t['name']}`{kind}")
        for x in t["findings"]:
            lines.append(f"- {x['text']}" + (f" [اقرأ الدرس]({x['link']}?utm_source=claude-skill)" if x["link"] else ""))
        lines.append("")
    return "\n".join(lines)


if __name__ == "__main__":
    import sys

    args = [a for a in sys.argv[1:] if a != "--json"]
    text = open(args[0], encoding="utf-8").read() if args else sys.stdin.read()
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except AttributeError:
        pass
    if "--json" in sys.argv:
        print(json.dumps(analyse(text), ensure_ascii=False, indent=2))
    else:
        print(report(text))
