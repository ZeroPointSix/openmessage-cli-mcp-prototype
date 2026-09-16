import { randomUUID } from "node:crypto";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { afterEach, describe, expect, it } from "vitest";
import { OpenMessageClient } from "../../src/client/openmessage-client.js";
import { startMcpHttpServer } from "../../src/mcp/server.js";

const baseUrl = process.env.OPENMESSAGE_E2E_BASE_URL;
const apiKey = process.env.OPENMESSAGE_E2E_API_KEY;
const destination = process.env.OPENMESSAGE_E2E_DESTINATION;
const configured = Boolean(baseUrl && apiKey && destination);
const closeCallbacks: (() => Promise<void>)[] = [];

function structuredRecord(value: unknown): Record<string, unknown> {
  expect(value).toBeTruthy();
  expect(typeof value).toBe("object");
  expect(Array.isArray(value)).toBe(false);
  return value as Record<string, unknown>;
}

afterEach(async () => {
  for (const close of closeCallbacks.splice(0).reverse()) {
    await close();
  }
});

describe.skipIf(!configured)("real OpenMessage E2E", () => {
  it("persists through authenticated MCP send_message and reads the same content", async () => {
    if (!baseUrl || !apiKey || !destination) {
      throw new Error("real OpenMessage E2E environment is incomplete");
    }
    const origin = `openmessage-cli-e2e-${randomUUID()}`;
    const content = `ZER-1162 real E2E ${randomUUID()}`;
    const mcpToken = randomUUID();
    const running = await startMcpHttpServer({
      client: new OpenMessageClient({ baseUrl, apiKey, origin }),
      host: "127.0.0.1",
      port: 0,
      bearerToken: mcpToken,
    });
    closeCallbacks.push(running.close);

    const client = new Client({ name: "real-e2e-client", version: "1.0.0" });
    const transport = new StreamableHTTPClientTransport(
      new URL(`http://127.0.0.1:${running.port}/mcp`),
      { requestInit: { headers: { authorization: `Bearer ${mcpToken}` } } },
    );
    await client.connect(transport);
    closeCallbacks.push(async () => client.close());

    const sent = await client.callTool({
      name: "send_message",
      arguments: { destination, content },
    });
    expect(sent.isError).not.toBe(true);
    const sentContent = structuredRecord(sent.structuredContent);
    expect(sentContent).toMatchObject({
      accepted: true,
      interactionId: expect.any(String),
      messageId: expect.any(String),
    });
    const interactionId = String(sentContent.interactionId);
    const messageId = String(sentContent.messageId);

    const interaction = await client.callTool({
      name: "get_interaction",
      arguments: { interactionId },
    });
    expect(interaction.isError).not.toBe(true);
    const interactionContent = structuredRecord(interaction.structuredContent);
    expect(interactionContent).toMatchObject({ interactionId });
    const messages = interactionContent.messages;
    expect(Array.isArray(messages)).toBe(true);
    expect(messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: messageId,
          origin,
          destination,
          content,
          createdAt: expect.any(String),
        }),
      ]),
    );
  });
});
