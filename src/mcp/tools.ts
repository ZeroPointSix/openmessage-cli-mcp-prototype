import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { OpenMessageClient } from "../client/openmessage-client.js";

export const OPENMESSAGE_TOOL_NAMES = ["send_message", "get_interaction"] as const;

function toolResult<T extends object>(value: T) {
  const structuredContent = { ...value } as Record<string, unknown>;
  return {
    content: [{ type: "text" as const, text: JSON.stringify(structuredContent) }],
    structuredContent,
  };
}

export function registerOpenMessageTools(server: McpServer, client: OpenMessageClient): void {
  server.registerTool(
    "send_message",
    {
      description:
        "Persist a message in OpenMessage. Success means accepted/persisted, not delivered.",
      inputSchema: {
        destination: z.string().min(1).describe("Destination endpoint id"),
        content: z.string().min(1).describe("Message text"),
        interactionId: z
          .string()
          .min(1)
          .optional()
          .describe("Existing interaction id; omit to create one"),
      },
    },
    async ({ destination, content, interactionId }) =>
      toolResult(
        await client.send({
          destination,
          content,
          ...(interactionId ? { interactionId } : {}),
        }),
      ),
  );

  server.registerTool(
    "get_interaction",
    {
      description: "Read the ordered messages currently persisted in an interaction.",
      inputSchema: { interactionId: z.string().min(1).describe("Interaction id") },
    },
    async ({ interactionId }) => toolResult(await client.getInteraction(interactionId)),
  );
}
