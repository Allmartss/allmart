import { db, usersTable } from "@workspace/db";
import bcrypt from "bcryptjs";

async function main() {
  const email = "supportallmart@gmail.com";
  const hash = await bcrypt.hash("admin@allmart1234", 10);

  const existing = await db.select().from(usersTable);
  const found = existing.find(u => u.email === email);

  if (found) {
    await db.execute(
      `UPDATE users SET password_hash = '${hash}', role = 'admin', name = 'Admin' WHERE email = '${email}'`
    );
    console.log("Admin user updated:", email);
  } else {
    await db.execute(
      `INSERT INTO users (email, password_hash, name, role) VALUES ('${email}', '${hash}', 'Admin', 'admin')`
    );
    console.log("Admin user created:", email);
  }
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
