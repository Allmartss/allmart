import { defineConfig } from "drizzle-kit";
import fs from "fs";
import path from "path";

// ---------------------------------------------------------------------------
// Auto-load .env files before reading process.env.
// drizzle-kit spawns its own process, so it won't see vars that were only
// exported in the parent shell (common in GitHub Codespaces and CI).
// Search upward from lib/db/ until we find a .env file or hit the fs root.
// ---------------------------------------------------------------------------
function loadEnvFile() {
  let dir = __dirname;
  for (let i = 0; i < 5; i++) {
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
          // Strip surrounding quotes from value
          let val = trimmed.slice(eq + 1).trim();
          if ((val.startsWith('"') && val.endsWith('"')) ||
              (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          // Don't overwrite vars already set in the shell
          if (!process.env[key]) process.env[key] = val;
        }
        return; // stop after first .env found
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) break; // reached fs root
    dir = parent;
  }
}

loadEnvFile();

// ---------------------------------------------------------------------------

const connectionString = process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "SUPABASE_DB_URL or DATABASE_URL must be set.\n" +
    "  • Create a .env file in the project root with: DATABASE_URL=postgres://...\n" +
    "  • Or export the variable in your shell before running pnpm db push\n" +
    "  • In GitHub Codespaces: open a NEW terminal after adding the secret,\n" +
    "    old sessions don't see newly added secrets."
  );
}

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  dialect: "postgresql",
  dbCredentials: {
    url: connectionString,
  },
});
