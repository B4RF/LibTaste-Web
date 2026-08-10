import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const generatedUrl = new URL("../src/api/generated.ts", import.meta.url);
const webDirectory = fileURLToPath(new URL("..", import.meta.url));
const cliPath = fileURLToPath(
  new URL(
    "../../../node_modules/openapi-typescript/bin/cli.js",
    import.meta.url,
  ),
);
const temporaryPath = join(tmpdir(), `libtaste-openapi-${process.pid}.ts`);

const generated = spawnSync(
  process.execPath,
  [cliPath, "../../openapi/openapi.yaml", "-o", temporaryPath],
  { cwd: webDirectory, encoding: "utf8" },
);
if (generated.status !== 0) {
  console.error(
    generated.stderr || generated.stdout || "OpenAPI generation failed.",
  );
  process.exit(generated.status ?? 1);
}

const expected = (await readFile(temporaryPath, "utf8")).replaceAll(
  "\r\n",
  "\n",
);
const committed = (await readFile(generatedUrl, "utf8")).replaceAll(
  "\r\n",
  "\n",
);
rmSync(temporaryPath, { force: true });

if (committed !== expected) {
  console.error(
    "Generated OpenAPI types are stale. Regenerate them with: npm run openapi:generate",
  );
  process.exitCode = 1;
} else {
  console.log("Generated OpenAPI types match openapi/openapi.yaml.");
}
