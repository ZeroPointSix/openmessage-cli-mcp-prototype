import type { Command } from "commander";
import type { OpenMessageClient } from "../client/openmessage-client.js";
import { startMcpHttpServer } from "../mcp/server.js";

interface McpStartOptions {
  host: string;
  port: string;
}

export function registerMcpCommand(
  program: Command,
  client: OpenMessageClient,
  defaults: { host: string; port: number; bearerToken?: string },
): void {
  const mcp = program.command("mcp").description("MCP server operations");
  mcp
    .command("start")
    .description("Start the stateless Streamable HTTP MCP server")
    .option("--host <host>", "bind host", defaults.host)
    .option("--port <port>", "bind port", String(defaults.port))
    .action(async (options: McpStartOptions) => {
      const port = Number(options.port);
      if (!Number.isInteger(port) || port < 0 || port > 65_535) {
        throw new Error("--port must be an integer between 0 and 65535");
      }
      const running = await startMcpHttpServer({
        client,
        host: options.host,
        port,
        ...(defaults.bearerToken ? { bearerToken: defaults.bearerToken } : {}),
      });
      process.stderr.write(
        `OpenMessage MCP listening at http://${options.host}:${running.port}/mcp\n`,
      );
      const shutdown = async (signal: string) => {
        process.stderr.write(`Received ${signal}; shutting down OpenMessage MCP\n`);
        await running.close();
        process.exitCode = 0;
      };
      process.once("SIGINT", () => void shutdown("SIGINT"));
      process.once("SIGTERM", () => void shutdown("SIGTERM"));
    });
}
