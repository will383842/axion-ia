// Aides communes des specs du bac à sable : semeur, e-mail « capturé » (file BullMQ du Redis LOCAL,
// aucun worker, rien n'est envoyé), captures d'écran.
import { execSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Page } from "@playwright/test";
import Redis from "ioredis";

export const CAPTURES = join(fileURLToPath(new URL("..", import.meta.url)), "captures");
mkdirSync(CAPTURES, { recursive: true });

export interface ApporteurSeme {
  id: string;
  email: string;
  lien: string;
}

/** Crée un apporteur FICTIF directement en base locale (le semeur refuse toute base non locale). */
export function semer(
  court: string,
  statut: "signe" | "dossier_en_cours" = "signe",
): ApporteurSeme {
  const sortie = execSync(`npx tsx tests/e2e/apporteurs-ui/outillage/semer.ts ${court} ${statut}`, {
    encoding: "utf8",
  });
  return JSON.parse(sortie.trim().split("\n").pop()!) as ApporteurSeme;
}

export async function capture(page: Page, nom: string): Promise<void> {
  await page.screenshot({ path: join(CAPTURES, `${nom}.png`), fullPage: true });
}

export interface EmailCapture {
  cle: string;
  name: string;
  data: string;
}

/** Les e-mails en file (jamais envoyés) dont la charge contient `motif`. */
export async function emailsCaptures(motif: string | RegExp): Promise<EmailCapture[]> {
  const redis = new Redis(process.env["REDIS_URL"] ?? "redis://127.0.0.1:6379");
  try {
    const out: EmailCapture[] = [];
    for (const cle of await redis.keys("bull:*")) {
      if ((await redis.type(cle)) !== "hash") continue;
      const data = ((await redis.hget(cle, "data")) ?? "").replace(/\\\//g, "/");
      const ok = typeof motif === "string" ? data.includes(motif) : motif.test(data);
      if (ok) out.push({ cle, name: (await redis.hget(cle, "name")) ?? "", data });
    }
    return out;
  } finally {
    redis.disconnect();
  }
}

export async function refuserCookies(page: Page): Promise<void> {
  const b = page
    .getByRole("button", { name: /refuser|continuer sans accepter|tout refuser/i })
    .first();
  if (await b.isVisible({ timeout: 1500 }).catch(() => false))
    await b.click().catch(() => undefined);
}

export const aujourdhuiParis = (): string =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Paris" }).format(new Date());

/** SIRET fictif (clé de Luhn valide) d'un SIREN fictif. */
export function siretDe(siren: string): string {
  const luhn = (x: string): boolean =>
    [...x].reverse().reduce((a, c, i) => {
      let d = Number(c);
      if (i % 2 === 1) {
        d *= 2;
        if (d > 9) d -= 9;
      }
      return a + d;
    }, 0) %
      10 ===
    0;
  for (let i = 1; i < 100000; i++) {
    const c = `${siren}${String(i).padStart(5, "0")}`;
    if (luhn(c)) return c;
  }
  throw new Error("aucun SIRET de test");
}
