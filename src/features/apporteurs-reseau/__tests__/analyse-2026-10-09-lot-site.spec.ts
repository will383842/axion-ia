import { describe, expect, it, vi } from "vitest";

// Analyse du 09/10/2026 (document tiers « modifications du contrat 2.5 », lot 2 « site ») :
// corrections du code qui ne changent pas le texte du contrat.

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { LEGAL_PAGES } from "@/content/legal";
import { construireCsvDas2, SEUIL_DAS2_CENTS } from "../commissions";
import { deuxCases } from "../contrat-pdf";
import { signeAvant26 } from "../etablissement-presentation";
import { ibanValide } from "../regles-dossier";
import { jugerAdmission, LIBELLE_REFUS_ADMISSION } from "../regles";
import { TEXTES } from "@/app/apporteur/dossier/[id]/[jeton]/textes";

/** Calcule la clé ISO 13616 d'un IBAN (mod 97). */
function avecCle(pays: string, bban: string): string {
  const num = (bban + pays + "00").replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  let r = 0;
  for (const ch of num) r = (r * 10 + Number(ch)) % 97;
  return `${pays}${String(98 - r).padStart(2, "0")}${bban}`;
}

describe("lot site — analyse du 09/10", () => {
  it("point 3 : un apporteur ne signe jamais avec le SIREN d'AXION IA", () => {
    expect(
      jugerAdmission({ active: true, francaise: true, naf: null, siren: "108018631" }),
    ).toEqual({
      ok: false,
      motif: "siren_de_la_societe",
    });
    expect(LIBELLE_REFUS_ADMISSION.siren_de_la_societe).toContain("Axion-IA");
    expect(
      jugerAdmission({ active: true, francaise: true, naf: null, siren: "732829320" }).ok,
    ).toBe(true);
  });

  it("versions comparées par composante : « 2.10 » est après « 2.5 » et « 2.6 »", () => {
    expect(deuxCases("2.10")).toBe(true);
    expect(deuxCases("2.4")).toBe(false);
    expect(signeAvant26({ version: "2.10" })).toBe(false);
    expect(signeAvant26({ version: "2.5" })).toBe(true);
  });

  it("IBAN : seuls les comptes de la zone SEPA sont acceptés", () => {
    expect(ibanValide("FR76 3000 6000 0112 3456 7890 189")).toBe(true);
    expect(ibanValide("DE89 3704 0044 0532 0130 00")).toBe(true);
    // IBAN tunisien à clé VALIDE (calculée), hors SEPA : refusé.
    expect(ibanValide(avecCle("TN", "10006035183598478831"))).toBe(false);
    expect(ibanValide(avecCle("FR", "30006000011234567890189"))).toBe(true);
  });

  it("DAS 2 : SIRET et repère du seuil de 2 400 €", () => {
    const csv = construireCsvDas2(2026, [
      {
        nom: "A",
        denomination: null,
        siren: "732829320",
        siret: "73282932000074",
        adresse: null,
        totalCents: SEUIL_DAS2_CENTS + 1,
        lignes: 2,
      },
      {
        nom: "B",
        denomination: null,
        siren: "732829320",
        adresse: null,
        totalCents: 1_000,
        lignes: 1,
      },
    ]);
    expect(csv).toContain("siret");
    expect(csv).toContain("a_declarer_seuil_2400");
    expect(csv).toContain("73282932000074");
    expect(csv).toMatch(/;oui\r\n/);
    expect(csv).toMatch(/;non\r\n/);
  });

  it("RGPD : section dédiée aux personnes présentées (FR et EN), avec base légale et critères", () => {
    const sections = LEGAL_PAGES.flatMap((p) => [...p.fr.sections, ...p.en.sections]);
    const dediees = sections.filter((x) => x.anchor === "personnes-presentees-par-un-apporteur");
    expect(dediees.length).toBe(2);
    expect(dediees.some((x) => x.body.includes("6.1.f"))).toBe(true);
    expect(dediees.some((x) => x.body.includes("ne sont pas supprimées automatiquement"))).toBe(
      true,
    );
  });

  it("résidents étrangers : prévenus, sans être renvoyés vers la micro-entreprise française", () => {
    expect(TEXTES.horsFranceTexte).toContain("résident fiscalement en France");
    expect(TEXTES.sansSirenTexte.startsWith("Si vous résidez en France")).toBe(true);
  });
});
