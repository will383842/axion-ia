// @formateurs E-B1 — Une mission qui FAIT DÉPASSER 5 000 € HT d'honoraires cumulés,
// sans attestation de vigilance URSSAF vérifiée : refusée, avec un message clair ;
// avec l'attestation validée : acceptée.
//
// Seuil (décision récente, `src/lib/vigilance.ts`) : 5 000 € HT cumulés AVEC la
// mission en jeu (relevés validés, facture reçue ou payés + missions ouvertes).
// L'attestation est exigée AVANT : aux cartes, à l'affectation, au « J'accepte ».
//
// ÉCART AU PLAN (noté au rapport) : le plan demandait aussi un refus « à l'émission
// de la lettre ». Le code suit la décision du 14/10/2026 (contrat-cadre v4,
// art. 18.2) : une mission DÉJÀ ACCEPTÉE est maintenue sans attestation, sa lettre
// part, seul le VIREMENT attend l'attestation (`lettre-mission-v2-generation.ts`
// ~l.235, `MANQUES_VIGILANCE` dans `moteur-mission.ts`). Le banc constate ce
// comportement (la lettre part) dans un test à part.

import { expect, test } from "@playwright/test";

import { prisma } from "../fixtures/formateurs/base";
import {
  creerFormateurPret,
  creerPiece,
  creerSession,
  poserAttestationVigilance,
} from "../fixtures/formateurs/missions-donnees";
import {
  choisir,
  derniereMission,
  lettresVivantes,
  M,
  missionAcceptee,
  repondre,
  signerConvention,
  type Resultat,
} from "../fixtures/formateurs/missions-gestes";
import { cadreScenario } from "../fixtures/formateurs/missions-scenario";

const sc = cadreScenario("eb1");
const TRAINERS = "@/server/actions/qualiopi/trainers";
const MESSAGE_CONSOLE =
  "Avec cette mission, les honoraires de ce formateur atteignent 5 000 € HT : son attestation de vigilance URSSAF doit être vérifiée avant de la lui confier.";
const MESSAGE_FORMATEUR =
  /^Avec cette mission, vos honoraires avec nous atteignent 5 000 € hors taxes : nous avons besoin de votre attestation de vigilance URSSAF/;

/** Les espaces insécables du code (« 5 000 € ») comparés comme des espaces. */
const plat = (x: unknown): string => String(x).replace(/[\u00a0\u202f]/g, " ");

/** Un relevé d'honoraires VALIDÉ (le mois dernier) : le cumul du formateur. */
async function cumulDeja(trainerId: string, htCents: number): Promise<void> {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() - 1);
  await prisma.trainerStatement.create({
    data: {
      trainerId,
      periodeYear: d.getUTCFullYear(),
      periodeMonth: d.getUTCMonth() + 1,
      statut: "valide",
      tvaRegime: "franchise_293b",
      totalHtCents: htCents,
      totalTtcCents: htCents,
    },
  });
}

test.describe("@formateurs E-B1 — seuil URSSAF de 5 000 € cumulés", () => {
  test.setTimeout(240_000);

  test("sans attestation : grisé, affectation et « J'accepte » refusés ; avec : accepté", async () => {
    const { pilote, monde } = sc;
    const t = await creerFormateurPret(monde, { prenom: "Oscar" });
    const s = await creerSession(monde, { dansJours: 20, nbJours: 2 }); // 700 € HT
    const s2 = await creerSession(monde, { dansJours: 27, nbJours: 2 });

    // Proposé quand son cumul était nul ; entre-temps un relevé de 4 800 € est validé.
    const c = await choisir(pilote, monde, s.id, [{ trainerId: t.id }]);
    expect(c).toEqual({ data: expect.objectContaining({ missionProposee: true }) });
    await cumulDeja(t.id, 480_000);

    // ── Les cartes : grisé, avec la raison ───────────────────────────────────
    const cartes = await pilote.appeler<{
      indisponibles: Array<{ trainerId: string; refus: Array<{ code: string; texte: string }> }>;
    }>(M.serviceChoix, "lireCartesChoix", [s2.id, new Date()]);
    const carte = cartes.indisponibles.find((x) => x.trainerId === t.id);
    expect(carte?.refus.map((r) => plat(r.texte))).toEqual([MESSAGE_CONSOLE]);

    // ── L'affectation : refusée, message clair ───────────────────────────────
    const aff = await pilote.appeler<Resultat<unknown>>(
      TRAINERS,
      "assignTrainerToSessionAction",
      [{ sessionId: s2.id, trainerId: t.id }],
      sc.console(),
    );
    expect("error" in aff && plat(aff.error)).toBe(`Assignation refusée : ${MESSAGE_CONSOLE}`);

    // ── « J'accepte » : refusé, et le formateur sait quoi faire ──────────────
    const m = await derniereMission(s.id, t.id);
    const refus = await repondre(pilote, t.id, m.id, "acceptee");
    expect("error" in refus && plat(refus.error)).toMatch(MESSAGE_FORMATEUR);
    expect((await derniereMission(s.id, t.id)).statut).toBe("en_attente");

    // ── L'attestation est déposée et vérifiée : tout passe ───────────────────
    await poserAttestationVigilance(t.id);
    expect(await repondre(pilote, t.id, m.id, "acceptee")).toEqual({
      data: expect.objectContaining({ statut: "acceptee" }),
    });
    const aff2 = await pilote.appeler<Resultat<unknown>>(
      TRAINERS,
      "assignTrainerToSessionAction",
      [{ sessionId: s2.id, trainerId: t.id }],
      sc.console(),
    );
    expect(aff2, JSON.stringify(aff2)).toEqual({ data: expect.anything() });
  });

  test("écart au plan : une mission DÉJÀ acceptée reçoit sa lettre même au-delà du seuil", async () => {
    const { pilote, monde } = sc;
    const t = await creerFormateurPret(monde, { prenom: "Pauline" });
    const s = await creerSession(monde, { dansJours: 22, nbJours: 2 });
    await missionAcceptee(pilote, monde, s.id, t.id);
    await cumulDeja(t.id, 480_000);
    const conv = await creerPiece(monde, {
      type: "convention",
      sessionId: s.id,
      clientId: monde.clientId,
    });
    await signerConvention(pilote, monde, conv);
    // Décision du 14/10 : la lettre part ; seul le virement attendra l'attestation.
    expect(await lettresVivantes(s.id, t.id)).toHaveLength(1);
    expect((await derniereMission(s.id, t.id)).lettreBlocageMotif).toBeNull();
  });
});
