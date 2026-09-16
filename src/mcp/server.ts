import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express, { type NextFunction, type Request, type Response } from "express";
import type { Server } from "node:http";
import type { OpenMessageClient } from "../client/openmessage-client.js";
import { registerOpenMessageTools } from "./tools.js";

export interface McpHttpServerOptions {
  client: OpenMessageClient;
  host: string;
  port: number;
  bearerToken?: string;
}

export function createMcpServer(client: OpenMessageClient): McpServer {
  const server = new McpServer({ name: "openmessage", version: "0.2.0" });
  registerOpenMessageTools(server, client);
  return server;
}

export function createMcpHttpApp(
  client: OpenMessageClient,
  options: { bearerToken?: string } = {},
) {
  const app = express();
  app.use(express.json({ limit: "1mb" }));
  app.get("/health", (_request, response) => {
    response.json({ ok: true, service: "openmessage", transport: "streamable-http" });
  });
  app.post(
    "/mcp",
    authenticate(options.bearerToken),
    async (request: Request, response: Response) => {
      const server = createMcpServer(client);
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true,
      });
      response.on("close", () => {
        void transport.close();
        void server.close();
      });
      try {
        await server.connect(transport);
        await transport.handleRequest(request, response, request.body);
      } catch (error) {
        process.stderr.write(`MCP request failed: ${formatError(error)}\n`);
        if (!response.headersSent) response.status(500).json({ error: "MCP request failed" });
      }
    },
  );
  app.all("/mcp", (_request, response) => {
    response.status(405).set("Allow", "POST").json({ error: "Method not allowed" });
  });
  return app;
}

export async function startMcpHttpServer(options: McpHttpServerOptions): Promise<{
  port: number;
  close: () => Promise<void>;
}> {
  const app = createMcpHttpApp(
    options.client,
    options.bearerToken ? { bearerToken: options.bearerToken } : {},
  );
  const server = await new Promise<Server>((resolve, reject) => {
    const listener = app.listen(options.port, options.host, () => resolve(listener));
    listener.once("error", reject);
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("MCP server did not bind to a TCP port");
  }
  return {
    port: address.port,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}

function authenticate(expectedToken?: string) {
  return (request: Request, response: Response, next: NextFunction) => {
    if (!expectedToken) {
      next();
      return;
    }
    if (request.headers.authorization !== `Bearer ${expectedToken}`) {
      response.status(401).json({ error: "Unauthorized" });
      return;
    }
    next();
  };
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
