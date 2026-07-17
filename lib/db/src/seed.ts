import { loadEnv } from "./load-env.js";
loadEnv();

import bcrypt from "bcryptjs";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { eq } from "drizzle-orm";
import { usersTable } from "./schema/users.js";
import { settingsTable } from "./schema/settings.js";

const { Pool } = pg;

const connectionString = process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("SUPABASE_DB_URL or DATABASE_URL must be set.");
}

const pool = new Pool({ connectionString });
const db = drizzle(pool);

async function upsertSetting(key: string, value: string) {
  await db
    .insert(settingsTable)
    .values({ key, value })
    .onConflictDoNothing();
}

async function seedUsers() {
  const users = [
    {
      email: "supportallmart@gmail.com",
      name: "Admin",
      password: "admin@allmart1234",
      role: "admin" as const,
    },
  ];

  for (const u of users) {
    const passwordHash = await bcrypt.hash(u.password, 10);

    const [existing] = await db
      .select({ id: usersTable.id, role: usersTable.role })
      .from(usersTable)
      .where(eq(usersTable.email, u.email));

    if (existing) {
      await db
        .update(usersTable)
        .set({ name: u.name, role: u.role, passwordHash, profileComplete: true })
        .where(eq(usersTable.email, u.email));
      console.log(`  ✓ Updated ${u.email} → role=${u.role}`);
    } else {
      await db.insert(usersTable).values({
        email: u.email,
        name: u.name,
        passwordHash,
        role: u.role,
        profileComplete: true,
      });
      console.log(`  ✓ Created ${u.role}: ${u.email}`);
    }
  }
}

async function seedSettings() {
  const defaults = [
    { key: "referralSignupBonus", value: "20" },
    { key: "referralReferrerBonus", value: "10" },
    {
      key: "referralNote",
      value: "Refer friends and earn bonus credits you can use on your next order!",
    },
  ];

  for (const s of defaults) {
    await upsertSetting(s.key, s.value);
    console.log(`  ✓ Setting: ${s.key} = ${s.value}`);
  }
}

async function main() {
  console.log("==> Seeding database...");

  console.log("  Users:");
  await seedUsers();

  console.log("  Settings:");
  await seedSettings();

  console.log("==> Seed complete.");
  await pool.end();
}

main().catch((err) => {
  console.error("Seed failed:", err);
  pool.end();
  process.exit(1);
});
