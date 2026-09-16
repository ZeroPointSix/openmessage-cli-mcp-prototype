import type { Command } from "commander";
import type { OpenMessageClient } from "../client/openmessage-client.js";
import { startMcpHttpServer } from "../mcp/server.js";

interface McpStartOptions {
  host: string;
  port: string;
}

interface RunningMcpServer {
  close: () => Promise<void>;
}

export function createShutdownHandler(
  running: RunningMcpServer,
  writeError: (message: string) => void = (message) => process.stderr.write(message),
): (signal: string) => Promise<void> {
  let shutdown: Promise<void> | undefined;
  return (signal: string) => {
    if (shutdown) return shutdown;
    writeError(`Received ${signal}; shutting down OpenMessage MCP\n`);
    shutdown = running
      .close()
      .then(() => {
        process.exitCode = 0;
      })
      .catch((error: unknown) => {
        writeError(
          `OpenMessage MCP shutdown failed: ${
            error instanceof Error ? error.message : String(error)
          }\n`,
        );
        process.exitCode = 1;
      });
    return shutdown;
  };
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
      const shutdown = createShutdownHandler(running);
      process.once("SIGINT", () => void shutdown("SIGINT"));
      process.once("SIGTERM", () => void shutdown("SIGTERM"));
    });
}
