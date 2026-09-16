import { describe, expect, it } from "vitest";
import { OPENMESSAGE_TOOL_NAMES } from "../../src/mcp/tools.js";

describe("MCP tool surface", () => {
  it("declares only the two OpenMessage agent capabilities", () => {
    expect([...OPENMESSAGE_TOOL_NAMES]).toEqual(["send_message", "get_interaction"]);
  });
});
