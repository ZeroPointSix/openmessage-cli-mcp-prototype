import { Command } from "commander";
import { registerInteractionCommands } from "./commands/interaction-get.js";
import { registerMcpCommand } from "./commands/mcp-start.js";
import { registerSendCommand } from "./commands/send.js";
import { createClient, loadConfig } from "./config/index.js";

export function createProgram(environment: NodeJS.ProcessEnv = process.env): Command {
  const config = loadConfig(environment);
  const client = createClient(config);
  const program = new Command()
    .name("openmessage")
    .description("OpenMessage CLI and Streamable HTTP MCP server")
    .version("0.2.0");
  registerSendCommand(program, client);
  registerInteractionCommands(program, client);
  registerMcpCommand(program, client, {
    host: config.OPENMESSAGE_MCP_HOST,
    port: config.OPENMESSAGE_MCP_PORT,
    ...(config.OPENMESSAGE_MCP_BEARER_TOKEN
      ? { bearerToken: config.OPENMESSAGE_MCP_BEARER_TOKEN }
      : {}),
  });
  return program;
}

async function main(): Promise<void> {
  await createProgram().parseAsync(process.argv);
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
