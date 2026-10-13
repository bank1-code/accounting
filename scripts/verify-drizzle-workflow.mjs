import { spawnSync } from "node:child_process";

const result = spawnSync("pnpm", ["db:generate"], {
  cwd: process.cwd(),
  encoding: "utf8",
  env: process.env,
});
const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;

if (result.status !== 0) {
  process.stderr.write(output);
  throw new Error("Drizzle generation failed");
}
if (/\?\s|Is .+ created or renamed|rename/i.test(output)) {
  process.stderr.write(output);
  throw new Error("Drizzle generation required interactive input");
}
console.log("Drizzle workflow check passed without interactive prompts");
