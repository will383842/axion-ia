// Garde (fiche L3, décision du fondateur du 17/11/2026) : l'entreprise n'a pas
// la certification de qualité ; aucun e-mail ne la nomme, ni dans l'objet, ni
// dans le HTML, ni dans la version texte, en français comme en anglais.
//
// Chaque gabarit est rendu avec la charge d'exemple de l'aperçu de la console
// (et ses variantes). Les URL sont retirées avant la recherche : le chemin
// technique `/…/qualiopi/…` d'un bouton vers la console est un identifiant de
// route, pas un texte lu.
//
// Ce fichier est le seul endroit où le mot est permis : il est écrit par
// concaténation pour que la recherche dans le dépôt ne le trouve pas.

import { describe, it, expect } from "vitest";

import { EMAIL_TEMPLATE_NAMES, renderEmailTemplate } from "../index";
import { PAYLOAD_EXEMPLE, VARIANTES_EXEMPLE } from "@/server/email/apercu/payloads-exemple";
import { LIBELLE_CATEGORIE, CATALOGUE } from "@/server/email/apercu/catalogue";

const MOT = new RegExp("quali" + "opi", "i");

/** Retire les adresses (href, src, URL nues) : on ne lit que le texte visible. */
function sansAdresses(s: string): string {
  return s
    .replace(/\b(?:href|src)="[^"]*"/gi, "")
    .replace(/https?:\/\/[^\s"'<>)]+/gi, "")
    .replace(/\/(?:fr|en)\/[^\s"'<>)]+/gi, "");
}

describe("aucun e-mail ne nomme la certification", () => {
  for (const name of EMAIL_TEMPLATE_NAMES) {
    for (const locale of ["fr", "en"] as const) {
      it(`${name} (${locale})`, async () => {
        // Le gabarit « effacement confirmé » ne rend la phrase des copies de
        // formation conservées que si leur nombre est renseigné.
        const variantes = [
          {},
          ...(name === "rgpd-effacement-confirme" ? [{ copiesFormationConservees: 3 }] : []),
          ...Object.values(VARIANTES_EXEMPLE[name] ?? {}),
        ];
        for (const v of variantes) {
          const r = await renderEmailTemplate(name, locale, { ...PAYLOAD_EXEMPLE, ...v });
          expect(r.subject).not.toMatch(MOT);
          expect(sansAdresses(r.html)).not.toMatch(MOT);
          expect(sansAdresses(r.text)).not.toMatch(MOT);
        }
      });
    }
  }

  it("les libellés de l'écran des gabarits ne la nomment pas", () => {
    for (const l of Object.values(LIBELLE_CATEGORIE)) expect(l).not.toMatch(MOT);
    for (const e of Object.values(CATALOGUE)) {
      expect(e.quand).not.toMatch(MOT);
      expect(e.destinataire).not.toMatch(MOT);
    }
  });
});
