import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const destination = mkdtempSync(join(tmpdir(), "openmessage-pack-"));
try {
  const output = execFileSync("pnpm", ["pack", "--pack-destination", destination], {
    encoding: "utf8",
  });
  const archive = output.trim().split("\n").at(-1);
  if (!archive) throw new Error("pnpm pack did not return an archive");
  const listing = execFileSync("tar", ["-tf", archive], { encoding: "utf8" });
  for (const required of ["package/dist/cli.js", "package/dist/cli.d.ts", "package/README.md"]) {
    if (!listing.includes(required)) throw new Error(`package is missing ${required}`);
  }
  const packageJson = JSON.parse(
    execFileSync("tar", ["-xOf", archive, "package/package.json"], { encoding: "utf8" }),
  );
  if (packageJson.bin?.openmessage !== "./dist/cli.js") {
    throw new Error("package bin does not point to dist/cli.js");
  }
  process.stdout.write("Package verification passed\n");
} finally {
  rmSync(destination, { recursive: true, force: true });
}
