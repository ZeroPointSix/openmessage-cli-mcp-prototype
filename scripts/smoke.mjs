import { spawnSync } from "node:child_process";

for (const args of [["--help"], ["interaction", "--help"], ["mcp", "start", "--help"]]) {
  const result = spawnSync(process.execPath, ["dist/cli.js", ...args], {
    encoding: "utf8",
    env: { ...process.env, OPENMESSAGE_BASE_URL: "http://127.0.0.1:1" },
  });
  if (result.status !== 0) {
    process.stderr.write(result.stderr);
    process.exit(result.status ?? 1);
  }
  if (!result.stdout.includes("openmessage") && !result.stdout.includes("Usage:")) {
    throw new Error(`unexpected smoke output for ${args.join(" ")}`);
  }
}
process.stdout.write("CLI smoke checks passed\n");
