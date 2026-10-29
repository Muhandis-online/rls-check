// Starts mcp.js over stdio as a client would, lists its tools, and runs both on the fixture.
'use strict'

const { Client } = require('@modelcontextprotocol/sdk/client/index.js')
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')

;(async () => {
  const client = new Client({ name: 'smoke', version: '0' })
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [join(__dirname, '..', 'mcp.js')] }))
  const { tools } = await client.listTools()
  const query = await client.callTool({ name: 'rls_check_query', arguments: {} })
  const result = readFileSync(join(__dirname, 'fixtures', 'rls-check-result.json'), 'utf8')
  const explained = await client.callTool({ name: 'rls_check_explain', arguments: { result } })
  const bad = await client.callTool({ name: 'rls_check_explain', arguments: { result: 'nope' } })
  console.log(JSON.stringify({
    tools: tools.map(t => t.name),
    queryStartsRight: query.content[0].text.startsWith('-- Muhandis RLS check'),
    firstLine: explained.content[0].text.split('\n')[0],
    red: JSON.parse(explained.content[1].text).counts.red,
    badIsError: bad.isError,
  }))
  await client.close()
})().catch(e => { console.error(e); process.exit(1) })
