import type { Command } from "commander";
import type { OpenMessageClient } from "../client/openmessage-client.js";

export function registerInteractionCommands(program: Command, client: OpenMessageClient): void {
  const interaction = program.command("interaction").description("Interaction operations");
  interaction
    .command("get")
    .description("Read the currently persisted messages in an interaction")
    .argument("<interactionId>", "interaction id")
    .action(async (interactionId: string) => {
      const result = await client.getInteraction(interactionId);
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    });
}
