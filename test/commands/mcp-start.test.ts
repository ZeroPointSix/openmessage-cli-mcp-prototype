import { afterEach, describe, expect, it, vi } from "vitest";
import { createShutdownHandler } from "../../src/commands/mcp-start.js";

const originalExitCode = process.exitCode;

afterEach(() => {
  process.exitCode = originalExitCode;
});

describe("MCP shutdown", () => {
  it("closes at most once when multiple signals arrive", async () => {
    const close = vi.fn().mockResolvedValue(undefined);
    const writeError = vi.fn();
    const shutdown = createShutdownHandler({ close }, writeError);

    await Promise.all([shutdown("SIGINT"), shutdown("SIGTERM")]);

    expect(close).toHaveBeenCalledOnce();
    expect(writeError).toHaveBeenCalledOnce();
    expect(process.exitCode).toBe(0);
  });

  it("contains close failures instead of creating an unhandled rejection", async () => {
    const close = vi.fn().mockRejectedValue(new Error("close failed"));
    const writeError = vi.fn();
    const shutdown = createShutdownHandler({ close }, writeError);

    await expect(shutdown("SIGTERM")).resolves.toBeUndefined();

    expect(close).toHaveBeenCalledOnce();
    expect(writeError).toHaveBeenCalledWith("OpenMessage MCP shutdown failed: close failed\n");
    expect(process.exitCode).toBe(1);
  });
});
