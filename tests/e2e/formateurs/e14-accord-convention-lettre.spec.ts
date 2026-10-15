// @formateurs E14 — « J'accepte » AVANT la convention → F25 ; convention signée par
// tous → F26 UNE SEULE FOIS malgré deux crochets ; « Signer ma lettre » ouvre
// directement la lettre → F28 à la signature, puis F19 dans la minute de la
// contresignature. Une seule lettre vivante d'un bout à l'autre.
//
// Lettre v3 (décision récente) : le montant de la lettre est CE QUE LE PAIEMENT
// VERSERA — les journées du seul formateur × 350 € HT + le forfait figé au choix.

import { expect, test } from "@playwright/test";

import { prisma } from "../fixtures/formateurs/base";
import { horlogePilotee } from "../fixtures/formateurs/horloge";
import {
  aParis,
  creerFormateurPret,
  creerPiece,
  creerSession,
  envoisVers,
  jourCivil,
  type FormateurBanc,
} from "../fixtures/formateurs/missions-donnees";
import {
  contresignerLettre,
  derniereMission,
  envoiRendu,
  lettresVivantes,
  M,
  missionAcceptee,
  signerConvention,
  signerMaLettre,
} from "../fixtures/formateurs/missions-gestes";
import { ATTENTE_FILE, cadreScenario } from "../fixtures/formateurs/missions-scenario";

const sc = cadreScenario("e14");

test.describe("@formateurs E14 — accord, convention, lettre, signatures", () => {
  test.setTimeout(240_000);

  test("F25 avant la convention, F26 une fois, F28 puis F19, une seule lettre vivante", async () => {
    const { pilote, monde } = sc;
    // En Isère pour une session à Lyon : le forfait de déplacement est dû.
    const a: FormateurBanc = await creerFormateurPret(monde, {
      prenom: "Aurore",
      codePostalPro: "38000",
    });
    const session = await creerSession(monde, { dansJours: 20, nbJours: 2 });

    // ── « J'accepte » avant toute convention : F25, aucune lettre ────────────
    const missionId = await missionAcceptee(pilote, monde, session.id, a.id, 4_000);
    await expect
      .poll(
        async () => (await envoisVers(a.email, "formateur-accord-enregistre")).length,
        ATTENTE_FILE,
      )
      .toBe(1);
    expect(await lettresVivantes(session.id, a.id)).toEqual([]);
    expect(await envoisVers(a.email, "formateur-lettre-a-signer")).toEqual([]);

    // ── Convention signée par le client puis par Axion ───────────────────────
    const convention = await creerPiece(monde, {
      type: "convention",
      sessionId: session.id,
      clientId: monde.clientId,
    });
    await signerConvention(pilote, monde, convention); // 1er crochet : après-signature
    // 2e crochet : le même réveil rejoué (livraison doublée), puis le passage horaire.
    await pilote.appeler(M.crochets, "lettreDue", [convention]);
    const passage = horlogePilotee(aParis(jourCivil(new Date(), 1), 10, 25));
    await pilote.appeler(M.moteur, "passerMoteurMissions", [passage.maintenant()]);

    const lettres = await lettresVivantes(session.id, a.id);
    const etat = await derniereMission(session.id, a.id);
    expect(
      lettres,
      `une seule lettre vivante (mission ${etat.statut}, blocage : ${etat.lettreBlocageMotif ?? "aucun"})`,
    ).toHaveLength(1);
    const lettre = lettres[0]!;
    expect((await derniereMission(session.id, a.id)).lettreMissionId).toBe(lettre.id);
    expect((await derniereMission(session.id, a.id)).id).toBe(missionId);

    // Montant = ce que le paiement versera : 2 journées × 350 € + 2 × 40 € de forfait.
    const meta = lettre.metadata as { annonceLettre?: { totalHtCents?: number } };
    expect(meta.annonceLettre?.totalHtCents).toBe(2 * 35_000 + 2 * 4_000);

    // F26 une seule fois, malgré les deux crochets et le passage.
    await expect
      .poll(
        async () => (await envoisVers(a.email, "formateur-lettre-a-signer")).length,
        ATTENTE_FILE,
      )
      .toBe(1);
    const f26 = (await envoisVers(a.email, "formateur-lettre-a-signer"))[0]!;
    expect(f26.jobId).toBe(`formateur-lettre-a-signer-${lettre.id}`);
    // « Signer ma lettre » ouvre DIRECTEMENT la lettre.
    const texteF26 = await envoiRendu(pilote, f26.jobId!);
    expect(texteF26.texte).toContain(`lettre=${lettre.id}`);
    expect(texteF26.texte).toMatch(/780/); // 780 € HT : le total de la lettre

    // ── « Signer ma lettre » : F28 ────────────────────────────────────────────
    const signe = await signerMaLettre(pilote, a.id, lettre.id);
    expect(signe, JSON.stringify(signe)).toMatchObject({ ok: true, statutSignature: "partielle" });
    await expect
      .poll(
        async () => (await envoisVers(a.email, "formateur-lettre-copie-signature")).length,
        ATTENTE_FILE,
      )
      .toBe(1);
    expect(await envoisVers(a.email, "piece-exemplaire-signe")).toEqual([]);

    // ── Contresignature d'Axion : F19 dans la minute ─────────────────────────
    const avantContre = Date.now();
    const contre = await contresignerLettre(pilote, monde, lettre.id);
    expect(contre, JSON.stringify(contre)).toMatchObject({ ok: true, statutSignature: "signee" });
    const f19 = await envoisVers(a.email, "piece-exemplaire-signe");
    expect(f19).toHaveLength(1);
    expect(f19[0]!.createdAt.getTime() - avantContre).toBeLessThan(60_000);
    const f28 = (await envoisVers(a.email, "formateur-lettre-copie-signature"))[0]!;
    expect(f28.createdAt.getTime()).toBeLessThan(f19[0]!.createdAt.getTime());

    // ── Une seule lettre vivante, signée des deux parties ────────────────────
    const fin = await lettresVivantes(session.id, a.id);
    expect(fin.map((l) => [l.id, l.statutSignature])).toEqual([[lettre.id, "signee"]]);
    const toutes = await prisma.documentGenere.count({
      where: { type: "lettre_mission", sessionId: session.id },
    });
    expect(toutes).toBe(1);

    // Ce qui ne part pas : ni deuxième F25, ni F26 rejoué, ni F29.
    expect(await envoisVers(a.email, "formateur-accord-enregistre")).toHaveLength(1);
    expect(await envoisVers(a.email, "formateur-lettre-a-signer")).toHaveLength(1);
    expect(await envoisVers(a.email, "formateur-lettre-rectifiee")).toEqual([]);
  });
});
