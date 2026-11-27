// Lot 2 du relevé mensuel des apporteurs : gabarit DORMANT (aucun émetteur).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { renderEmailTemplate } from "../index";
import { apporteurReleveMensuelSubject } from "../apporteur-releve-mensuel";

const norm = (s: string) => s.replace(/\s+/g, " ");
const LIEN = "https://exemple.invalid/apporteur/dossier/id/jeton";
const BASE = {
  contactName: "Claire Martin",
  mois: "octobre 2026",
  totalMois: "TOTAL-FICTIF",
  nombreCommissions: 3,
  report: "REPORT-FICTIF",
  delaiForme: "DELAI-FORME",
  delaiCalcul: "DELAI-CALCUL",
  delaiReponse: "DELAI-REPONSE",
  pdfR2Key: "releves/REL-2026-10-0001.pdf",
};
const rendre = async (extra: Record<string, unknown> = {}) =>
  renderEmailTemplate("apporteur-releve-mensuel" as never, "fr", { ...BASE, ...extra });

describe("e-mail apporteur-releve-mensuel", () => {
  it("objet : « Votre relevé de commissions de <mois> »", () => {
    expect(apporteurReleveMensuelSubject("fr", BASE)).toBe(
      "Votre relevé de commissions de octobre 2026",
    );
  });

  it("variante sans mouvement : « Votre relevé de <mois> : aucun mouvement »", async () => {
    const p = { ...BASE, aucunMouvement: true };
    expect(apporteurReleveMensuelSubject("fr", p)).toBe(
      "Votre relevé de octobre 2026 : aucun mouvement",
    );
    const t = norm((await rendre({ aucunMouvement: true })).text);
    expect(t).toContain("aucun mouvement");
    expect(t).not.toContain("TOTAL-FICTIF");
  });

  it("corps : total, nombre, report, délais lus dans le payload", async () => {
    const t = norm((await rendre()).text);
    expect(t).toContain("Bonjour Claire, voici le récapitulatif");
    expect(t).toContain("TOTAL-FICTIF");
    expect(t).toContain("3 commissions");
    expect(t).toContain("REPORT-FICTIF");
    for (const d of ["DELAI-FORME", "DELAI-CALCUL", "DELAI-REPONSE"]) expect(t).toContain(d);
  });

  it("dit que le relevé n'est pas une facture et que les autofactures font foi", async () => {
    for (const extra of [{}, { aucunMouvement: true }]) {
      const t = norm((await rendre(extra)).text);
      expect(t).toContain(
        "Ce relevé est un récapitulatif, qui n'est pas une facture : vos autofactures restent les pièces qui font foi.",
      );
    }
  });

  it("sans report ni délai dans le payload : rien d'inventé", async () => {
    const t = norm(
      (
        await rendre({
          report: undefined,
          delaiForme: undefined,
          delaiCalcul: undefined,
          delaiReponse: undefined,
        })
      ).text,
    );
    expect(t).not.toContain("REPORT-FICTIF");
    expect(t).not.toMatch(/\d+ (jours|mois)/);
  });

  it("lien de l'espace : porté par lienEspace (posé par l'émetteur)", async () => {
    const { html } = await rendre({ lienEspace: LIEN });
    expect(html).toContain(`href="${LIEN}"`);
  });

  it("pièce jointe : le payload porte la r2Key, le gabarit ne la recopie jamais", async () => {
    const r = await rendre();
    expect(r.html).not.toContain("releves/REL-2026-10-0001.pdf");
    expect(r.text).not.toContain("releves/REL-2026-10-0001.pdf");
  });

  it("source : aucun montant, délai ni durée en dur", () => {
    const src = readFileSync(join(__dirname, "../apporteur-releve-mensuel.tsx"), "utf8");
    expect(src).not.toMatch(/\d+\s?(€|euros|jours|mois)\b/i);
    expect(src).not.toMatch(/\b\d+[,.]\d{2}\b/);
  });
});
