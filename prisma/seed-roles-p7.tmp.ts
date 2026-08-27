// TEMPORAIRE (audit réservation 2026-08-26, P7) — sème 6 comptes de rôle de
// test, purgeables (`email LIKE 'axi-p7-%'`). Base de DEV uniquement. Ce
// fichier n'est pas committé (suffixe .tmp.ts, retiré après le parcours P7).
import { PrismaClient } from "./generated/client";
import { hashPassword } from "../src/lib/auth-password";

const ROLES = [
  "super_admin",
  "admin",
  "editor",
  "reader",
  "responsable_qualite",
  "secretaire",
] as const;

async function main() {
  const prisma = new PrismaClient();
  const passwordHash = await hashPassword("AdminAxion2026!");
  for (const role of ROLES) {
    const email = `axi-p7-${role.replace(/_/g, "-")}@axion-ia.test`;
    await prisma.adminUser.upsert({
      where: { email },
      create: { email, name: `AXI-P7 ${role}`, passwordHash, role, status: "active" },
      update: { role, passwordHash, status: "active" },
    });
    console.log("semé:", email, role);
  }
  await prisma.$disconnect();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
