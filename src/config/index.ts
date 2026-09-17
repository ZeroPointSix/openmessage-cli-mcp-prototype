import { z } from "zod";
import { OpenMessageClient } from "../client/openmessage-client.js";

const environmentSchema = z.object({
  OPENMESSAGE_BASE_URL: z.string().url(),
  OPENMESSAGE_API_KEY: z.string().min(1).optional(),
  OPENMESSAGE_ORIGIN: z.string().min(1).default("openmessage-cli"),
  OPENMESSAGE_MCP_BEARER_TOKEN: z.string().min(1).optional(),
  OPENMESSAGE_MCP_HOST: z.string().min(1).default("127.0.0.1"),
  OPENMESSAGE_MCP_PORT: z.coerce.number().int().min(0).max(65_535).default(3000),
});

export type OpenMessageConfig = z.infer<typeof environmentSchema>;

export function loadConfig(environment: NodeJS.ProcessEnv = process.env): OpenMessageConfig {
  return environmentSchema.parse(environment);
}

export function createClient(config: OpenMessageConfig): OpenMessageClient {
  return new OpenMessageClient({
    baseUrl: config.OPENMESSAGE_BASE_URL,
    ...(config.OPENMESSAGE_API_KEY ? { apiKey: config.OPENMESSAGE_API_KEY } : {}),
    origin: config.OPENMESSAGE_ORIGIN,
  });
}
