# openmessage CLI + MCP prototype

One package, one HTTP client, two interfaces:

- CLI: `openmessage send`, `openmessage interaction get`
- MCP server mode: `openmessage mcp start` exposing `send_message` and `get_interaction` over Streamable HTTP at `/mcp`

Both interfaces call the same `OpenMessageClient`. No Message/Interaction business rules live in CLI or MCP.

## Local

`npm install`

`OPENMESSAGE_DEMO=1 node src/index.js mcp start`

Health: `GET /health`
MCP: `POST /mcp`

For real upstream mode set `OPENMESSAGE_BASE_URL`, `OPENMESSAGE_API_KEY` (optional), and `OPENMESSAGE_ORIGIN`. The client expects the MVP HTTP contract: `POST /v1/messages`, `GET /v1/interactions/:id`, and `GET /v1/messages/:id`.

Demo mode exists only so the CLI/MCP packaging and remote transport can be exercised before the new openMessage HTTP API is reachable from this account.
