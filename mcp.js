#!/usr/bin/env node
// An MCP server for the RLS check. It holds no database credentials and opens no connection: the agent (or the official
// Supabase MCP) runs the read-only query, and this server explains the result in plain Arabic, table by table.
'use strict'

const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js')
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js')
const { z } = require('zod')
const { QUERY, TOOL_URL, tag, explain, report } = require('./lib')
const { version } = require('./package.json')

const server = new McpServer({ name: 'muhandis-rls-check', version })

server.registerTool('rls_check_query', {
  title: 'RLS check: the read-only query',
  description: 'Returns a read-only SQL query that lists every table and view in the public schema of a Supabase (Postgres) project with its RLS state, grants to anon/authenticated, column names and policies. It reads no row of data. Run it in the project (SQL Editor, or a Supabase MCP execute_sql tool), then pass the single JSON result cell to rls_check_explain.',
  annotations: { readOnlyHint: true, openWorldHint: false },
}, async () => ({ content: [{ type: 'text', text: QUERY }] }))

server.registerTool('rls_check_explain', {
  title: 'RLS check: explain the result',
  description: 'Explains the output of rls_check_query table by table, worst first: which tables anyone with the public (anon) key can read or change, which any signed-in user can read across users, which are locked, which are safe. Findings are in Arabic for founders (labels also given in English) and link to Arabic lessons on muhandis.online. Works offline on the pasted result.',
  inputSchema: { result: z.string().describe('The JSON result cell of rls_check_query, as text (it starts with {"tool":"muhandis-rls-check"...)') },
  annotations: { readOnlyHint: true, openWorldHint: false },
}, async ({ result }) => {
  const r = explain(result, 'mcp')
  return {
    content: [
      { type: 'text', text: report(result, 'mcp') },
      { type: 'text', text: JSON.stringify(r) },
    ],
    isError: !r.ok,
  }
})

server.registerPrompt('rls_check', {
  title: 'Check my Supabase tables',
  description: 'Run the read-only RLS check on this project and explain it in Arabic. Browser version: ' + tag(TOOL_URL, 'mcp'),
}, () => ({
  messages: [{ role: 'user', content: { type: 'text', text: 'Call rls_check_query, run the query on my Supabase project (read-only), pass the result to rls_check_explain, then summarise the exposed tables first, in Arabic, with the fix for each.' } }],
}))

server.connect(new StdioServerTransport())
