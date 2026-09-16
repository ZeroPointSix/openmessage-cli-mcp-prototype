#!/usr/bin/env node
import express from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';

const args = process.argv.slice(2);
const baseUrl = process.env.OPENMESSAGE_BASE_URL || '';
const token = process.env.OPENMESSAGE_API_KEY || '';
const origin = process.env.OPENMESSAGE_ORIGIN || 'prototype-agent';
const demo = process.env.OPENMESSAGE_DEMO !== '0' && !baseUrl;

const demoInteractions = new Map();

class OpenMessageClient {
  async send({ destination, content, interactionId }) {
    if (demo) {
      const iid = interactionId || 'int_' + randomUUID().replaceAll('-', '').slice(0, 16);
      const mid = 'msg_' + randomUUID().replaceAll('-', '').slice(0, 16);
      const list = demoInteractions.get(iid) || [];
      list.push({ id: mid, origin, destination, content, createdAt: new Date().toISOString(), position: String(list.length) });
      demoInteractions.set(iid, list);
      return { accepted: true, messageId: mid, interactionId: iid, demo: true };
    }
    const body = { interactionId, message: { origin, destination, content } };
    const res = await fetch(new URL('/v1/messages', baseUrl), {
      method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error('openMessage send failed: ' + res.status + ' ' + await res.text());
    return await res.json();
  }

  async getInteraction(interactionId) {
    if (demo) return { interactionId, messages: demoInteractions.get(interactionId) || [], demo: true };
    const headers = token ? { authorization: 'Bearer ' + token } : {};
    const res = await fetch(new URL('/v1/interactions/' + encodeURIComponent(interactionId), baseUrl), { headers });
    if (!res.ok) throw new Error('openMessage interaction read failed: ' + res.status + ' ' + await res.text());
    const interaction = await res.json();
    const refs = interaction.messages || [];
    const messages = await Promise.all(refs.map(async (ref) => {
      const r = await fetch(new URL('/v1/messages/' + encodeURIComponent(ref.messageId), baseUrl), { headers });
      if (!r.ok) throw new Error('openMessage message read failed: ' + r.status + ' ' + await r.text());
      return { ...(await r.json()), position: ref.position };
    }));
    return { interactionId, messages };
  }
}

const client = new OpenMessageClient();

function valueAfter(flag, fallback) {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
}

function makeMcpServer() {
  const server = new McpServer({ name: 'openmessage', version: '0.1.0' });
  server.registerTool('send_message', {
    description: 'Submit one message to openMessage. Success means accepted/persisted, not delivered.',
    inputSchema: {
      destination: z.string().describe('Destination endpoint id'),
      content: z.string().describe('Text content'),
      interactionId: z.string().optional().describe('Existing interaction id; omit to create a new interaction')
    }
  }, async ({ destination, content, interactionId }) => {
    const out = await client.send({ destination, content, interactionId });
    return { content: [{ type: 'text', text: JSON.stringify(out) }], structuredContent: out };
  });
  server.registerTool('get_interaction', {
    description: 'Read the messages currently persisted in one interaction.',
    inputSchema: { interactionId: z.string() }
  }, async ({ interactionId }) => {
    const out = await client.getInteraction(interactionId);
    return { content: [{ type: 'text', text: JSON.stringify(out) }], structuredContent: out };
  });
  return server;
}

async function startMcp() {
  const port = Number(process.env.PORT || valueAfter('--port', '3000'));
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.get('/health', (_req, res) => res.json({ ok: true, service: 'openmessage-cli-mcp-prototype', mode: demo ? 'demo' : 'upstream', upstream: baseUrl || null }));
  app.post('/mcp', async (req, res) => {
    const server = makeMcpServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on('close', () => transport.close());
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });
  app.listen(port, '0.0.0.0', () => console.log('openmessage MCP listening on :' + port + '/mcp mode=' + (demo ? 'demo' : 'upstream')));
}

async function main() {
  if (args[0] === 'mcp' && args[1] === 'start') return startMcp();
  if (args[0] === 'send') {
    const destination = valueAfter('--to');
    const content = valueAfter('--text');
    const interactionId = valueAfter('--interaction');
    if (!destination || !content) throw new Error('usage: openmessage send --to <endpoint> --text <message> [--interaction <id>]');
    console.log(JSON.stringify(await client.send({ destination, content, interactionId }), null, 2));
    return;
  }
  if (args[0] === 'interaction' && args[1] === 'get' && args[2]) {
    console.log(JSON.stringify(await client.getInteraction(args[2]), null, 2));
    return;
  }
  console.log('openmessage prototype

  openmessage send --to <endpoint> --text <message> [--interaction <id>]
  openmessage interaction get <interactionId>
  openmessage mcp start [--port 3000]');
}

main().catch((err) => { console.error(err?.stack || String(err)); process.exit(1); });
