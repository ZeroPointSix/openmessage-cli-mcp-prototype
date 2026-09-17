import type { Command } from "commander";
import type { OpenMessageClient } from "../client/openmessage-client.js";

interface SendOptions {
  to: string;
  text: string;
  interaction?: string;
}

export function registerSendCommand(program: Command, client: OpenMessageClient): void {
  program
    .command("send")
    .description("Submit a message to OpenMessage")
    .requiredOption("--to <endpoint>", "destination endpoint")
    .requiredOption("--text <message>", "message text")
    .option("--interaction <interactionId>", "append to an existing interaction")
    .action(async (options: SendOptions) => {
      const result = await client.send({
        destination: options.to,
        content: options.text,
        ...(options.interaction ? { interactionId: options.interaction } : {}),
      });
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    });
}
