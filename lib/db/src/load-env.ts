import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

/**
 * Walk up the directory tree from the calling file's location and load the
 * first .env / .env.local / .env.production found. Shell variables that are
 * already set always take priority — this only fills in what's missing.
 *
 * Call this at the very top of any entry-point script that reads process.env,
 * so drizzle-kit, tsx, and other spawned processes pick up the values even
 * when the parent shell didn't export them (common in GitHub Codespaces & CI).
 */
export function loadEnv() {
  const __filename = fileURLToPath(import.meta.url);
  let dir = path.dirname(__filename);

  for (let i = 0; i < 6; i++) {
    for (const name of [".env", ".env.local", ".env.production"]) {
      const file = path.join(dir, name);
      if (fs.existsSync(file)) {
        const lines = fs.readFileSync(file, "utf8").split("\n");
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith("#")) continue;
          const eq = trimmed.indexOf("=");
          if (eq === -1) continue;
          const key = trimmed.slice(0, eq).trim();
          let val = trimmed.slice(eq + 1).trim();
          // Strip surrounding quotes
          if (
            (val.startsWith('"') && val.endsWith('"')) ||
            (val.startsWith("'") && val.endsWith("'"))
          ) {
            val = val.slice(1, -1);
          }
          // Never overwrite a var already in the shell environment
          if (!process.env[key]) process.env[key] = val;
        }
        return; // stop after first .env found
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
}
