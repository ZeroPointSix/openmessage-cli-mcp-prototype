import { z } from "zod";

const sendResponseSchema = z.object({
  messageId: z.string().min(1),
  interactionId: z.string().min(1),
  accepted: z.boolean().optional(),
});

const interactionMessageReferenceSchema = z
  .object({
    messageId: z.string().min(1),
    position: z.union([z.string(), z.number()]).optional(),
    content: z.unknown().optional(),
  })
  .passthrough();

const canonicalMessageSchema = z
  .object({
    id: z.string().min(1),
    origin: z.string().min(1),
    destination: z.string().min(1),
    content: z.unknown(),
    createdAt: z.string().min(1),
  })
  .strict();

const interactionSchema = z
  .object({
    interactionId: z.string().optional(),
    id: z.string().optional(),
    messages: z.array(interactionMessageReferenceSchema).default([]),
  })
  .passthrough();

export interface SendMessageInput {
  destination: string;
  content: string;
  interactionId?: string;
}

export interface SendMessageResult {
  messageId: string;
  interactionId: string;
  accepted: true;
}

export interface InteractionResult {
  interactionId: string;
  messages: Record<string, unknown>[];
}

export interface OpenMessageClientOptions {
  baseUrl: string;
  apiKey?: string;
  origin?: string;
  fetch?: typeof globalThis.fetch;
}

export class OpenMessageHttpError extends Error {
  constructor(
    readonly operation: string,
    readonly status: number,
    readonly responseBody: string,
  ) {
    super(`OpenMessage ${operation} failed with HTTP ${status}: ${responseBody || "<empty>"}`);
    this.name = "OpenMessageHttpError";
  }
}

export class OpenMessageClient {
  private readonly baseUrl: URL;
  private readonly fetchImpl: typeof globalThis.fetch;
  private readonly headers: Record<string, string>;
  private readonly origin: string;

  constructor(options: OpenMessageClientOptions) {
    this.baseUrl = new URL(options.baseUrl);
    this.fetchImpl = options.fetch ?? globalThis.fetch;
    this.origin = options.origin ?? "openmessage-cli";
    this.headers = options.apiKey ? { authorization: `Bearer ${options.apiKey}` } : {};
  }

  async send(input: SendMessageInput): Promise<SendMessageResult> {
    const response = await this.fetchImpl(this.url("/v1/messages"), {
      method: "POST",
      headers: { "content-type": "application/json", ...this.headers },
      body: JSON.stringify({
        ...(input.interactionId ? { interactionId: input.interactionId } : {}),
        message: {
          origin: this.origin,
          destination: input.destination,
          content: input.content,
        },
      }),
    });
    const payload = sendResponseSchema.parse(await this.readJson(response, "send message"));
    return { messageId: payload.messageId, interactionId: payload.interactionId, accepted: true };
  }

  async getInteraction(interactionId: string): Promise<InteractionResult> {
    const response = await this.fetchImpl(
      this.url(`/v1/interactions/${encodeURIComponent(interactionId)}`),
      { headers: this.headers },
    );
    const interaction = interactionSchema.parse(await this.readJson(response, "get interaction"));
    const messages = await Promise.all(
      interaction.messages.map(async (entry) => {
        if (entry.content !== undefined) return entry;
        const messageId = entry.messageId;
        const messageResponse = await this.fetchImpl(
          this.url(`/v1/messages/${encodeURIComponent(messageId)}`),
          { headers: this.headers },
        );
        const message = canonicalMessageSchema.parse(
          await this.readJson(messageResponse, "get message"),
        );
        return entry.position === undefined ? message : { ...message, position: entry.position };
      }),
    );
    return {
      interactionId: interaction.interactionId ?? interaction.id ?? interactionId,
      messages,
    };
  }

  private url(path: string): URL {
    return new URL(path, this.baseUrl);
  }

  private async readJson(response: Response, operation: string): Promise<unknown> {
    if (!response.ok) {
      throw new OpenMessageHttpError(operation, response.status, await response.text());
    }
    return response.json();
  }
}
