# The MCP server over stdio, for directories that start it to check it (Glama). It holds no keys and opens no connection.
FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY lib ./lib
COPY cli.js mcp.js query.sql ./
ENTRYPOINT ["node", "cli.js", "mcp"]
