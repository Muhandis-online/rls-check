# RLS check for Supabase: who can read your customers' data?

A **read-only** query you run in your own Supabase SQL Editor, and an analyser that explains the result table by table:

- which tables anyone with the public (anon) key can read or change;
- which tables let any signed-in user read other users' rows;
- which tables are locked, and which are safe.

The findings are written in **Arabic for non-technical founders**, with English labels (`exposed`, `check it`,
`locked`, `safe`), and each one links to an Arabic lesson on the fix.

- **It reads no data.** The query reads table descriptions only: RLS state, policies, grants and column names. Never a row.
- **It needs no key or password** and opens no connection to your database. You run the query yourself, or an agent
  runs it through the official Supabase MCP.
- **It is the same check as the browser tool** at [muhandis.online/tools/rls-check](https://muhandis.online/tools/rls-check):
  `lib/rls-check.js` is the site's analyser, copied byte for byte.

## Usage

### 1. In the browser (easiest)

Open [the check page](https://muhandis.online/tools/rls-check), copy the query, run it in Supabase and paste the
result. Everything happens in your browser; nothing is sent anywhere.

### 2. From the command line

```bash
npx muhandis-rls-check query > query.sql     # the query: run it in your SQL Editor
npx muhandis-rls-check result.json           # paste the result cell into a file; this explains it
npx muhandis-rls-check result.json --json    # the same explanation as JSON
```

It exits with `1` when a table is exposed, so it can be a CI step.

### 3. For an AI assistant (MCP)

Add it to Claude, Cursor or any MCP client. The assistant runs the query (through the official Supabase MCP, for
example) and this server explains the result. The server itself holds no connection details.

```json
{
  "mcpServers": {
    "muhandis-rls-check": { "command": "npx", "args": ["-y", "muhandis-rls-check", "mcp"] }
  }
}
```

Tools: `rls_check_query` returns the query, `rls_check_explain` explains a result.

### 4. As a Claude skill

The same check as a [Claude skill](skills/rls-check/SKILL.md): Claude gives you the query, then runs the pasted result
through `skills/rls-check/scripts/rls_check.py`, a Python copy of the analyser that the tests hold to the same output
as `lib/rls-check.js`. It needs no key and makes no network call.

- **Claude app:** download `rls-check.zip` from the [latest release](https://github.com/Muhandis-online/rls-check/releases/latest),
  then Customize > Skills, upload it and turn it on. Code execution must be enabled.
- **Claude Code:**

```
/plugin marketplace add Muhandis-online/rls-check
/plugin install rls-check@muhandis
```

## What it checks

| Label | Arabic | Meaning |
|---|---|---|
| `exposed` | مكشوف | RLS is off and the visitor role has a grant; or a policy whose condition is `true` on a table with personal columns; or a view without `security_invoker` that visitors can read; or an update or delete policy open to everyone |
| `check it` | تأكد منه | Data everyone can read that has no personal columns, such as a product list; or inserts without sign-in, such as a contact form |
| `locked` | مقفول | RLS on with no policies, or no grants: the app cannot reach it |
| `safe` | سليم | Policies tied to the row's owner through `auth.uid()` |

Personal columns are recognised by name (`email`, `phone`, `user_id`, `iban`, `national`, `iqama` and similar).

## Limits

This checks the rules you can see; it does not replace a test. After it, sign in with two accounts and confirm each
one sees only its own rows. Supabase's own Security Advisor flags related issues (RLS disabled, security-definer views,
permissive policies); this tool adds an explanation in Arabic for the product's owner, and a link to how to fix each
finding.

Found an exposed table and want an engineer to fix it with you? [muhandis.online/services/fix](https://muhandis.online/services/fix)

---

Made by [Muhandis](https://muhandis.online), a software company for businesses in Saudi Arabia and the GCC. MIT licence.
