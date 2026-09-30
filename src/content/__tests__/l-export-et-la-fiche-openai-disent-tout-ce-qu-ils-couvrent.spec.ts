/**
 * ⛔ L'EXPORT ET LA FICHE OPENAI DISENT TOUT CE QU'ILS COUVRENT
 * (vérification finale V1, RGPD-03 et RGPD-04).
 *
 * RGPD-03 — l'export art. 15 ne rend la transcription d'un participant que
 * si Williams a VALIDÉ la correspondance de sa voix (`voixValideeLe`). Une
 * voix pas encore attribuée existe pourtant pendant les 12 mois de
 * conservation des segments : l'export doit le DIRE (exclusion déclarée,
 * réponse manuelle), pas le taire.
 *
 * RGPD-04 — la fiche publique du sous-traitant « OpenAI, LLC (comptes rendus
 * de rendez-vous) » ne parlait que des visios, sur le consentement. La dictée
 * après un rendez-vous téléphonique passe aussi par OpenAI, sur l'intérêt
 * légitime (art. 6.1.f, notice et registre) : le jour où l'interrupteur passe à
 * `active`, la page /sous-processeurs et la notice se seraient contredites.
 *
 * Mutation qui rougit : retirer la ligne `TranscriptionSegment` des
 * exclusions → 1er cas ; retirer la dictée de `purposeFr` / `purposeEn` → 2e.
 * Contre-témoin : la finalité « visioconférences » et le consentement restent.
 * Angle mort : la base légale typée (`legalBasis`) n'accepte qu'une valeur ;
 * la base mixte est écrite dans le texte, que la page publique affiche.
 */

import { describe, expect, it } from "vitest";

import { EXCLUSIONS_EXPORT_DOSSIER, NOTICE_EXCLUSIONS_DOSSIER } from "@/lib/rgpd-dossier-client";
import { SUBPROCESSORS } from "@/content/subprocessors";

describe("⛔ l'export et la fiche OpenAI disent tout ce qu'ils couvrent", () => {
  it("🔴 RGPD-03 : la transcription d'une voix non attribuée est une exclusion déclarée", () => {
    const e = EXCLUSIONS_EXPORT_DOSSIER.find((x) => x.modele === "TranscriptionSegment");
    expect(e?.motif).toMatch(/voix/);
    expect(e?.motif).toMatch(/pas encore attribu/);
    expect(e?.motif).toMatch(/sous un mois/);
    expect(NOTICE_EXCLUSIONS_DOSSIER.some((n) => n.includes("TranscriptionSegment"))).toBe(true);
  });

  it("🔴 RGPD-04 : la fiche OpenAI des comptes rendus nomme la dictée et sa base 6.1.f", () => {
    const f = SUBPROCESSORS.find((s) => s.name === "OpenAI, LLC (comptes rendus de rendez-vous)");
    expect(f).toBeDefined();
    expect(f?.purposeFr).toMatch(/dict/i);
    expect(f?.purposeFr).toMatch(/6\.1\.f/);
    expect(f?.purposeEn).toMatch(/dictat/i);
    expect(f?.purposeEn).toMatch(/6\.1\.f/);
  });

  it("contre-témoin : la visio et son consentement restent annoncés", () => {
    const f = SUBPROCESSORS.find((s) => s.name === "OpenAI, LLC (comptes rendus de rendez-vous)");
    expect(f?.purposeFr).toMatch(/visioconférence/);
    expect(f?.purposeFr).toMatch(/6\.1\.a/);
    expect(f?.legalBasis).toBe("6.1.a_consent");
  });
});
