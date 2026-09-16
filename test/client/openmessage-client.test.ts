import { describe, expect, it, vi } from "vitest";
import { OpenMessageClient, OpenMessageHttpError } from "../../src/client/openmessage-client.js";

describe("OpenMessageClient", () => {
  it("maps send arguments to the HTTP contract and reports accepted, not delivered", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        Response.json({ messageId: "msg-1", interactionId: "int-1" }, { status: 202 }),
      );
    const client = new OpenMessageClient({
      baseUrl: "https://openmessage.example/",
      apiKey: "upstream-token",
      origin: "test-agent",
      fetch: fetchMock,
    });
    await expect(
      client.send({
        destination: "agent:bob",
        content: "hello",
        interactionId: "int-existing",
      }),
    ).resolves.toEqual({ messageId: "msg-1", interactionId: "int-1", accepted: true });
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toBe("https://openmessage.example/v1/messages");
    expect(init).toMatchObject({
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer upstream-token",
      },
    });
    expect(JSON.parse(String(init?.body))).toEqual({
      interactionId: "int-existing",
      message: { origin: "test-agent", destination: "agent:bob", content: "hello" },
    });
  });

  it("composes interaction references into complete messages", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({
          interactionId: "int-1",
          messages: [{ messageId: "msg-1", position: "0001" }],
        }),
      )
      .mockResolvedValueOnce(Response.json({ messageId: "msg-1", content: "persisted hello" }));
    const client = new OpenMessageClient({
      baseUrl: "https://openmessage.example",
      fetch: fetchMock,
    });
    await expect(client.getInteraction("int-1")).resolves.toEqual({
      interactionId: "int-1",
      messages: [{ messageId: "msg-1", content: "persisted hello", position: "0001" }],
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      new URL("https://openmessage.example/v1/messages/msg-1"),
      { headers: {} },
    );
  });

  it("maps non-success responses to OpenMessageHttpError", async () => {
    const client = new OpenMessageClient({
      baseUrl: "https://openmessage.example",
      fetch: vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response('{"error":"denied"}', { status: 403 })),
    });
    const error = await client.getInteraction("int-denied").catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(OpenMessageHttpError);
    expect(error).toMatchObject({
      operation: "get interaction",
      status: 403,
      responseBody: '{"error":"denied"}',
    });
  });
});
