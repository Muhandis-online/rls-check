---
name: rls-check
description: Read-only Supabase Row Level Security check that explains, in plain Arabic, which tables anyone can read or change. Use when the user wants to know whether their Supabase, Lovable or Bolt app leaks customer data, asks who can read their tables, mentions RLS or policies, or pastes a result that contains "muhandis-rls-check". Needs no key, password or database connection.
---

# RLS check by Muhandis

The same check as https://muhandis.online/tools/rls-check?utm_source=claude-skill and the `muhandis-rls-check` npm package. The user runs one
read-only query in their own Supabase SQL Editor; you explain the result table by table. The query reads table
descriptions only (RLS on or off, policies, grants, column names), never a row of data.

Reply in the user's language. The report is in Arabic, written in Saudi dialect as the site writes; when the user
writes in Arabic, keep that dialect («إيش»، «ليش»، «تبي»). Keep SQL, table and column names in English.

## 1. Give the query

If the user has not run it yet, show the exact contents of [query.sql](query.sql) in one `sql` block,
unchanged, then the steps:

1. Open the project in Supabase, then SQL Editor, then New query.
2. Paste the query and press Run.
3. Copy the single result cell completely, from the first `{` to the last `}`, and paste it here.

Say that it is read-only, reads no customer data, and needs no key or password.

## 2. Explain the result

When the user pastes a result, never judge the tables yourself. Save the pasted text to a file, `result.txt`, and run
[scripts/rls_check.py](scripts/rls_check.py) on it. It needs only Python 3 and makes no network call:

```bash
python3 scripts/rls_check.py result.txt                       # in the Claude app, from this skill's folder
python3 "${CLAUDE_SKILL_DIR}/scripts/rls_check.py" result.txt  # in Claude Code
```

Show the printed report as it is, links included. Do not add, drop, soften or re-rank findings: the script applies
the same rules as the site and the npm package. If the script says it could not read the result, show that message
and give step 1 again.

After the report, add at most three short lines:

- what to fix first: the tables marked «مكشوف»;
- that this checks the visible rules and does not replace a test with two accounts, each of which must see only its
  own rows;
- nothing else: the lesson links are already in the report.

If at least one table is «مكشوف» and the user asks for someone to fix it, mention once
https://muhandis.online/services/fix?utm_source=claude-skill . Never bring it up otherwise.

## Safety

- Never ask for, accept or repeat a service_role key, anon key, database password, connection string or any row of
  customer data. If the user pastes one, tell them not to share it and to rotate it from the Supabase dashboard now.
- Never suggest disabling RLS, or granting all privileges to `anon`, as a fix.
- Do not claim any affiliation with Supabase or Lovable.

## Related lessons (Arabic)

- https://muhandis.online/lessons/supabase-rls-policy-violation?utm_source=claude-skill
- https://muhandis.online/lessons/permission-denied-for-table?utm_source=claude-skill
- https://muhandis.online/lessons/rls-policy-violation-meaning?utm_source=claude-skill
- https://muhandis.online/lessons/lovable-security-incidents?utm_source=claude-skill
