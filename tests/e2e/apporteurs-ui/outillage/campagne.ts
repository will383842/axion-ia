// Aides de la campagne de tests par l'interface : captures versionnées, « monde » du bac à sable
// (monde.ts : création directe en base LOCALE de données fictives, passages du worker, horloge simulée).
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Page } from "@playwright/test";

/** Captures de la campagne : versionnées (le dossier `captures/` des specs précédentes est ignoré). */
export const CAPTURES_CAMPAGNE = join(
  fileURLToPath(new URL("..", import.meta.url)),
  "captures-campagne",
);
mkdirSync(CAPTURES_CAMPAGNE, { recursive: true });

export async function capturer(page: Page, nom: string): Promise<void> {
  await page.screenshot({ path: join(CAPTURES_CAMPAGNE, `${nom}.png`), fullPage: true });
}

/** Joue une commande de `monde.ts` (base locale seulement : le script refuse tout le reste). */
export function monde<T = Record<string, unknown>>(
  commande: string,
  args: Record<string, unknown> = {},
): T {
  const sortie = execFileSync(
    "npx",
    ["tsx", "tests/e2e/apporteurs-ui/outillage/monde.ts", commande, JSON.stringify(args)],
    { encoding: "utf8", timeout: 240_000 },
  );
  return JSON.parse(sortie.trim().split("\n").pop()!) as T;
}

export interface ApporteurMonde {
  id: string;
  email: string;
  lien: string;
}

/** Apporteur fictif signé (contrat 2.8 par défaut). */
export const apporteurMonde = (
  court: string,
  extra: Record<string, unknown> = {},
): ApporteurMonde => monde<ApporteurMonde>("apporteur", { court, ...extra });

/** `datetime-local` de Paris (AAAA-MM-JJTHH:MM), décalé de `ms` millisecondes. */
export function localParis(ms = 0): string {
  const f = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Paris",
    dateStyle: "short",
    timeStyle: "short",
  });
  return f.format(new Date(Date.now() + ms)).replace(" ", "T");
}

/** SIREN fictif unique (clé de Luhn valide) : aucune collision d'une exécution à l'autre. */
export function sirenFictif(): string {
  const luhn = (x: string): boolean =>
    [...x].reverse().reduce((s, c, i) => {
      let d = Number(c);
      if (i % 2 === 1) {
        d *= 2;
        if (d > 9) d -= 9;
      }
      return s + d;
    }, 0) %
      10 ===
    0;
  for (;;) {
    const c = String(900_000_000 + Math.floor(Math.random() * 99_999_999));
    if (luhn(c)) return c;
  }
}
