// Garde (fiche L3, décision du fondateur du 17/11/2026) : aucun e-mail d'alerte
// interne ne nomme la certification de qualité, que l'entreprise n'a pas.
// Ce fichier vit dans la zone dédiée (il lit le catalogue des alertes) ; la
// partie gabarits et libellés reste dans
// src/lib/email/templates/__tests__/aucun-e-mail-ne-nomme-la-certification.spec.tsx.
//
// Le mot est écrit par concaténation pour que la recherche dans le dépôt ne le trouve pas.

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { renderEmailTemplate } from "@/lib/email/templates";
import { ALERTE_CATALOGUE } from "../catalogue";

const MOT = new RegExp("quali" + "opi", "i");

/** Retire les adresses (href, src, URL nues) : on ne lit que le texte visible. */
function sansAdresses(s: string): string {
  return s
    .replace(/\b(?:href|src)="[^"]*"/gi, "")
    .replace(/https?:\/\/[^\s"'<>)]+/gi, "")
    .replace(/\/(?:fr|en)\/[^\s"'<>)]+/gi, "");
}

describe("aucun e-mail d'alerte interne ne nomme la certification", () => {
  // Alertes internes : chaque entrée RÉELLE du catalogue des alertes est rendue
  // (objet, HTML, texte), avec un titre et un message tels que l'évaluateur les
  // pose. Le code technique et les niveaux sont ceux du catalogue.
  describe("e-mail d'alerte interne, pour chaque entrée du catalogue", () => {
    for (const [code, entree] of Object.entries(ALERTE_CATALOGUE)) {
      it(code, async () => {
        for (const locale of ["fr", "en"] as const) {
          const payload = {
            niveau: entree.niveau,
            code,
            titre: entree.titre,
            guichet: entree.guichet,
            message: entree.titre,
            occurrences: [{ message: entree.titre }, { message: entree.titre }],
          };
          const r = await renderEmailTemplate("qualiopi-alerte-interne", locale, payload);
          expect(r.subject).not.toMatch(MOT);
          expect(sansAdresses(r.html)).not.toMatch(MOT);
          expect(sansAdresses(r.text)).not.toMatch(MOT);
          expect(entree.titre).not.toMatch(MOT);
        }
      });
    }
  });

  // Les messages sont fabriqués par l'évaluateur et les règles (ils dépendent de
  // la base) : on lit leurs sources. Une ligne `titre:` ou `message:` — ou la
  // suite d'une chaîne multi-lignes — qui nomme la certification fait rougir.
  it("les titres et messages posés par l'évaluateur et les règles ne la nomment pas", () => {
    const dossier = join(process.cwd(), "src/server/qualiopi/alertes");
    const fichiers = readdirSync(dossier).filter(
      (f) => f.endsWith(".ts") && !f.endsWith(".spec.ts"),
    );
    const fautes: string[] = [];
    for (const f of fichiers) {
      const lignes = readFileSync(join(dossier, f), "utf8").split("\n");
      let dansChamp = false;
      lignes.forEach((l, i) => {
        const t = l.trim();
        if (/^(titre|message)\s*:/.test(t)) dansChamp = true;
        if (dansChamp) {
          // Un chemin de console (« /qualiopi/offres ») est une route, pas un texte lu.
          const sansRoutes = t.replace(/\/qualiopi\/[\w/-]*/gi, "");
          if (MOT.test(sansRoutes) && !t.startsWith("//") && !t.startsWith("*")) {
            fautes.push(`${f}:${i + 1}: ${t}`);
          }
          if (/[,}]\s*$/.test(t) && !t.endsWith("+")) dansChamp = false;
        }
      });
    }
    expect(fautes).toEqual([]);
  });
});
