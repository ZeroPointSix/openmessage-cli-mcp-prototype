# OpenMessage CLI + MCP

The official lightweight OpenMessage client provides two interfaces from one package and binary:

- Human and scripts: `openmessage send` and `openmessage interaction get`
- Agents: `openmessage mcp start`, exposing Streamable HTTP at `/mcp`

Both interfaces call the same `OpenMessageClient`. The package does not contain Message or
Interaction state machines, delivery state, retry queues, or local persistence.

## Requirements

- Node.js 24 or newer
- pnpm 11 or newer

## Install and build

```bash
pnpm install
pnpm build
pnpm link --global
```

## Configuration

| Variable | Required | Purpose |
| --- | --- | --- |
| `OPENMESSAGE_BASE_URL` | yes | OpenMessage HTTP API base URL |
| `OPENMESSAGE_API_KEY` | no | Upstream API bearer token |
| `OPENMESSAGE_ORIGIN` | no | Message origin; defaults to `openmessage-cli` |
| `OPENMESSAGE_MCP_BEARER_TOKEN` | no | Independent bearer token required by `/mcp` |
| `OPENMESSAGE_MCP_HOST` | no | MCP bind host; defaults to `127.0.0.1` |
| `OPENMESSAGE_MCP_PORT` | no | MCP port; defaults to `3000` |

The upstream OpenMessage credential and downstream MCP credential are separate security
boundaries. Do not reuse one as the other.

## CLI

```bash
openmessage send --to <endpoint> --text <message> [--interaction <interactionId>]
openmessage interaction get <interactionId>
openmessage mcp start [--host 127.0.0.1] [--port 3000]
```

Send output reports `accepted: true`: this means OpenMessage persisted/accepted the message.
It does not mean the destination endpoint received it.

## MCP

The stateless Streamable HTTP server exposes exactly two tools:

- `send_message`
- `get_interaction`

`GET /health` is available for process health checks. The MCP endpoint is `POST /mcp`.

## Development

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm build
pnpm smoke
pnpm pack:verify
# or all gates:
pnpm verify
```

The integration test in `test/integration` starts an in-process OpenMessage HTTP stub and the
real Streamable HTTP MCP transport. It is intentionally not described as an end-to-end test.

The no-mock test in `test/e2e/real-openmessage.test.ts` requires all three variables below:

| Variable | Purpose |
| --- | --- |
| `OPENMESSAGE_E2E_BASE_URL` | Reachable OpenMessage test API |
| `OPENMESSAGE_E2E_API_KEY` | Test-environment upstream bearer token |
| `OPENMESSAGE_E2E_DESTINATION` | Test destination accepted by that environment |

Run it with `pnpm test:e2e:real`. The test starts only the local MCP adapter; all
`send_message` and `get_interaction` persistence calls go to the configured real OpenMessage
service with no upstream mock or stub. Normal test runs skip this suite when any required variable
is absent. CI logs a visible notice in that case rather than reporting a fake E2E pass.
