import type { Server } from "node:http";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import express from "express";
import { afterEach, describe, expect, it } from "vitest";
import { OpenMessageClient } from "../../src/client/openmessage-client.js";
import { startMcpHttpServer } from "../../src/mcp/server.js";

const closeCallbacks: (() => Promise<void>)[] = [];

afterEach(async () => {
  await Promise.all(closeCallbacks.splice(0).map((close) => close()));
});

describe("Streamable HTTP MCP integration", () => {
  it("lists only two tools, sends, then reads through an in-process upstream stub", async () => {
    const interactions = new Map<string, { messageId: string; position: string }[]>();
    const messages = new Map<string, Record<string, unknown>>();
    const upstream = express();
    upstream.use(express.json());
    upstream.post("/v1/messages", (request, response) => {
      const interactionId = request.body.interactionId ?? "int-integration";
      const messageId = "msg-integration";
      interactions.set(interactionId, [{ messageId, position: "0001" }]);
      messages.set(messageId, { messageId, ...request.body.message });
      response.status(202).json({ interactionId, messageId });
    });
    upstream.get("/v1/interactions/:id", (request, response) => {
      response.json({
        interactionId: request.params.id,
        messages: interactions.get(request.params.id) ?? [],
      });
    });
    upstream.get("/v1/messages/:id", (request, response) => {
      response.json(messages.get(request.params.id));
    });
    const upstreamServer = await listen(upstream);
    closeCallbacks.push(() => closeServer(upstreamServer));
    const upstreamAddress = upstreamServer.address();
    if (!upstreamAddress || typeof upstreamAddress === "string") {
      throw new Error("upstream failed to bind");
    }

    const running = await startMcpHttpServer({
      client: new OpenMessageClient({
        baseUrl: `http://127.0.0.1:${upstreamAddress.port}`,
        origin: "integration-agent",
      }),
      host: "127.0.0.1",
      port: 0,
      bearerToken: "mcp-token",
    });
    closeCallbacks.push(running.close);

    const client = new Client({ name: "integration-client", version: "1.0.0" });
    const transport = new StreamableHTTPClientTransport(
      new URL(`http://127.0.0.1:${running.port}/mcp`),
      { requestInit: { headers: { authorization: "Bearer mcp-token" } } },
    );
    await client.connect(transport);
    closeCallbacks.push(async () => client.close());

    const toolList = await client.listTools();
    expect(toolList.tools.map((tool) => tool.name)).toEqual(["send_message", "get_interaction"]);
    const sent = await client.callTool({
      name: "send_message",
      arguments: { destination: "agent:bob", content: "persist me" },
    });
    expect(sent.structuredContent).toEqual({
      messageId: "msg-integration",
      interactionId: "int-integration",
      accepted: true,
    });
    const interaction = await client.callTool({
      name: "get_interaction",
      arguments: { interactionId: "int-integration" },
    });
    expect(interaction.structuredContent).toEqual({
      interactionId: "int-integration",
      messages: [
        {
          messageId: "msg-integration",
          origin: "integration-agent",
          destination: "agent:bob",
          content: "persist me",
          position: "0001",
        },
      ],
    });
  });
});

async function listen(app: ReturnType<typeof express>): Promise<Server> {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, "127.0.0.1", () => resolve(server));
    server.once("error", reject);
  });
}

async function closeServer(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}
