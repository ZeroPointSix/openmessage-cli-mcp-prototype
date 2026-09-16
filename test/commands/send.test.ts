import { Command } from "commander";
import { describe, expect, it, vi } from "vitest";
import type { OpenMessageClient } from "../../src/client/openmessage-client.js";
import { registerSendCommand } from "../../src/commands/send.js";

describe("send command", () => {
  it("maps --to, --text, and --interaction into OpenMessageClient.send", async () => {
    const send = vi.fn().mockResolvedValue({
      messageId: "msg-1",
      interactionId: "int-1",
      accepted: true,
    });
    const client = { send } as unknown as OpenMessageClient;
    const program = new Command().exitOverride();
    registerSendCommand(program, client);
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    try {
      await program.parseAsync(
        [
          "node",
          "openmessage",
          "send",
          "--to",
          "agent:bob",
          "--text",
          "hello",
          "--interaction",
          "int-existing",
        ],
        { from: "node" },
      );
    } finally {
      stdout.mockRestore();
    }

    expect(send).toHaveBeenCalledOnce();
    expect(send).toHaveBeenCalledWith({
      destination: "agent:bob",
      content: "hello",
      interactionId: "int-existing",
    });
  });
});
