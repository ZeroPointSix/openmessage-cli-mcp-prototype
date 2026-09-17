import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { OpenMessageClient } from "../../src/client/openmessage-client.js";
import { startMcpHttpServer } from "../../src/mcp/server.js";

let client: Client;
const closeCallbacks: (() => Promise<void>)[] = [];

beforeEach(async () => {
  const running = await startMcpHttpServer({
    client: new OpenMessageClient({ baseUrl: "http://127.0.0.1:1" }),
    host: "127.0.0.1",
    port: 0,
  });
  closeCallbacks.push(running.close);
  client = new Client({ name: "schema-test-client", version: "1.0.0" });
  await client.connect(
    new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${running.port}/mcp`)),
  );
  closeCallbacks.push(async () => client.close());
});

afterEach(async () => {
  for (const close of closeCallbacks.splice(0).reverse()) {
    await close();
  }
});

describe("registered MCP tool surface", () => {
  it("publishes only the expected schemas and keeps interactionId optional for send", async () => {
    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name)).toEqual(["send_message", "get_interaction"]);

    const send = tools.find((tool) => tool.name === "send_message");
    expect(send?.inputSchema).toMatchObject({
      type: "object",
      required: ["destination", "content"],
      properties: {
        destination: { type: "string", minLength: 1 },
        content: { type: "string", minLength: 1 },
        interactionId: { type: "string", minLength: 1 },
      },
    });
    expect(send?.inputSchema.required).not.toContain("interactionId");

    const getInteraction = tools.find((tool) => tool.name === "get_interaction");
    expect(getInteraction?.inputSchema).toMatchObject({
      type: "object",
      required: ["interactionId"],
      properties: {
        interactionId: { type: "string", minLength: 1 },
      },
    });
  });

  it.each([
    ["missing destination", "send_message", { content: "hello" }],
    ["empty destination", "send_message", { destination: "", content: "hello" }],
    ["missing content", "send_message", { destination: "agent:bob" }],
    ["empty content", "send_message", { destination: "agent:bob", content: "" }],
    [
      "empty optional interactionId",
      "send_message",
      { destination: "agent:bob", content: "hello", interactionId: "" },
    ],
    ["missing interactionId", "get_interaction", {}],
    ["empty interactionId", "get_interaction", { interactionId: "" }],
  ])("rejects %s before the upstream client is called", async (_case, name, args) => {
    const result = await client.callTool({ name, arguments: args });
    expect(result.isError).toBe(true);
    expect(result.content).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "text",
          text: expect.stringMatching(/validation|invalid|required|too_small/i),
        }),
      ]),
    );
  });
});
