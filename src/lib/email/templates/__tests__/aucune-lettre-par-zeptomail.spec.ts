/**
 * Garde — LISTE FERMÉE des gabarits envoyés avec `marketing: true` (lot L2).
 *
 * ── POURQUOI ────────────────────────────────────────────────────────────────
 * Tout le site envoie par ZeptoMail, dont les conditions interdisent « mass
 * emailing campaigns, including […] newsletters », sous peine de suspension —
 * et ce compte porte AUSSI les factures, les convocations Qualiopi et les liens
 * de connexion. Décision n° 2 de Will (24/09) : la lettre partira un jour par
 * MailWizz + PowerMTA, JAMAIS par ZeptoMail.
 *
 * Le seul envoi `marketing: true` légitime était la confirmation du double
 * opt-in. Depuis l'amendement de Will (24/09), elle ne part plus d'aucun
 * parcours (gabarit dormant) : AUCUN appel du code de production ne porte ce
 * drapeau. Cette garde relit TOUS les appels `enqueueEmail(` et rougit si un
 * gabarit hors liste part avec lui — c'est-à-dire si quelqu'un commence à
 * envoyer une « lettre » par le tuyau transactionnel.
 *
 * Elle rougit AUSSI si un appel `marketing: true` passe un gabarit qui n'est pas
 * une chaîne littérale : ce qu'on ne peut pas lire, on ne peut pas garder.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** La liste FERMÉE. L'allonger est une décision, pas un correctif. */
const GABARITS_MARKETING_AUTORISES: ReadonlySet<string> = new Set(["newsletter-confirm-optin"]);

const MARKETING = /marketing:\s*true/;

const SRC = join(process.cwd(), "src");

function fichiersDeProduction(dossier: string, out: string[] = []): string[] {
  for (const entree of readdirSync(dossier)) {
    const complet = join(dossier, entree);
    if (statSync(complet).isDirectory()) {
      if (entree === "__tests__" || entree === "node_modules") continue;
      fichiersDeProduction(complet, out);
    } else if (/\.(ts|tsx)$/.test(entree) && !/\.(spec|test)\./.test(entree)) {
      out.push(complet);
    }
  }
  return out;
}

/** Texte de chaque appel `enqueueEmail(...)`, parenthèses équilibrées. */
function appels(source: string): string[] {
  const out: string[] = [];
  let i = source.indexOf("enqueueEmail(");
  while (i !== -1) {
    const debut = i + "enqueueEmail(".length;
    let profondeur = 1;
    let j = debut;
    while (j < source.length && profondeur > 0) {
      const c = source[j];
      if (c === "(") profondeur++;
      else if (c === ")") profondeur--;
      j++;
    }
    out.push(source.slice(debut, j - 1));
    i = source.indexOf("enqueueEmail(", j);
  }
  return out;
}

const APPELS = fichiersDeProduction(SRC).flatMap((f) => {
  const src = readFileSync(f, "utf8");
  // La DÉFINITION de la fonction n'est pas un appel.
  if (/export async function enqueueEmail\(/.test(src)) return [];
  return appels(src).map((texte) => ({ fichier: f.slice(SRC.length + 1), texte }));
});

describe("aucune lettre ne part par ZeptoMail", () => {
  it("témoin : la garde voit bien les appels d'envoi du dépôt", () => {
    expect(APPELS.length).toBeGreaterThan(20);
    expect(
      APPELS.some((a) => a.texte.includes("guide-ia-envoi") || a.fichier.includes("guide-ia")),
    ).toBe(true);
  });

  it("témoin : la garde SAIT lire un appel `marketing: true` (aucun n'existe plus en production)", () => {
    // Plus aucun appel réel ne porte le drapeau : sans ce témoin synthétique,
    // un détecteur cassé passerait au vert en ne voyant rien.
    const faux = appels('await enqueueEmail("lettre-exemple", to, "fr", {}, { marketing: true });');
    expect(faux).toHaveLength(1);
    expect(MARKETING.test(faux[0] ?? "")).toBe(true);
  });

  it("🔴 tout envoi `marketing: true` porte un gabarit de la liste fermée", () => {
    const fautifs = APPELS.filter((a) => /marketing:\s*true/.test(a.texte))
      .map((a) => {
        const litteral = /^\s*["']([a-z0-9-]+)["']/.exec(a.texte)?.[1] ?? null;
        return { ...a, gabarit: litteral };
      })
      .filter((a) => a.gabarit === null || !GABARITS_MARKETING_AUTORISES.has(a.gabarit))
      .map((a) => `${a.fichier} → ${a.gabarit ?? "(gabarit non littéral)"}`);
    expect(fautifs).toEqual([]);
  });

  it("🔴 « Votre guide » n'est JAMAIS marketing : c'est la livraison d'un document demandé", () => {
    const envoi = readFileSync(join(SRC, "server/guide-ia/envoi.ts"), "utf8");
    for (const a of appels(envoi)) expect(a).not.toMatch(/marketing/);
  });
});
