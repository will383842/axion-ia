/**
 * Tests unitaires du dossier démo Qualiopi (T16 · Agent A).
 *
 * Valide que `buildDemoData()` (pure, sans I/O) produit un jeu de fixtures
 * couvrant bien l'ensemble des indicateurs Qualiopi requis.
 *
 * Aucun mock Prisma — la logique testée est entièrement pure.
 */

import { describe, it, expect } from "vitest";
import { buildDemoData } from "./demo";

describe("buildDemoData() — pureté et complétude du cycle démo Qualiopi", () => {
  const data = buildDemoData();

  // ── Identification DEMO ──────────────────────────────────────────────────

  it("toutes les données portent un marqueur DEMO ou un email @demo.axion-ia.invalid", () => {
    expect(data.client.numero).toMatch(/DEMO/);
    expect(data.client.raisonSociale).toContain("[DEMO]");
    expect(data.devis.numero).toMatch(/DEMO/);
    expect(data.formation.numero).toMatch(/DEMO/);
    expect(data.session.numero).toMatch(/DEMO/);
    expect(data.stagiaires[0].email).toMatch(/@demo\.axion-ia\.invalid$/);
    expect(data.stagiaires[1].email).toMatch(/@demo\.axion-ia\.invalid$/);
    expect(data.attestation.numero).toMatch(/DEMO/);
    expect(data.facture.numero).toMatch(/DEMO/);
    expect(data.reclamation.numero).toMatch(/DEMO/);
  });

  // ── Indicateur 5 — Objectifs pédagogiques (Formation.objectifsPedagogiques) ─

  it("indicateur 5 : la formation démo possède ≥ 3 objectifs pédagogiques avec verbe d'action", () => {
    const objs = data.formation.objectifsPedagogiques;
    expect(objs.length).toBeGreaterThanOrEqual(3);
    for (const obj of objs) {
      expect(obj.verbe).toBeTruthy();
      expect(obj.description).toBeTruthy();
    }
  });

  // ── Indicateur 8 — Positionnement à l'entrée ────────────────────────────

  it("indicateur 8 : chaque stagiaire a un questionnaire de positionnement rempli", () => {
    const positionnements = data.questionnaires.filter((q) => q.type === "positionnement");
    expect(positionnements).toHaveLength(2);
    for (const q of positionnements) {
      expect(q.reponduAt).toBeTruthy();
      expect(q.token).toBeTruthy();
    }
  });

  // ── Indicateur 11⭐ — Évaluations des acquis (initiale + finale) ──────────

  it("indicateur 11 : chaque stagiaire a une évaluation initiale ET une évaluation finale", () => {
    for (const stagiaireIndex of [0, 1] as const) {
      const evalsStag = data.evaluations.filter((e) => e.stagiaireIndex === stagiaireIndex);
      const types = evalsStag.map((e) => e.type);
      expect(types).toContain("initiale");
      expect(types).toContain("finale");
    }
  });

  it("indicateur 11 : les évaluations finales ont le niveau 'acquis'", () => {
    const finales = data.evaluations.filter((e) => e.type === "finale");
    expect(finales).toHaveLength(2);
    for (const f of finales) {
      expect(f.niveauGlobal).toBe("acquis");
      expect(f.reussite).toBe(true);
      expect(f.scorePct).toBeGreaterThanOrEqual(data.formation.seuilReussitePct);
    }
  });

  // ── Indicateur 12 — Suivi de l'exécution (présences) ────────────────────

  it("indicateur 12 : présences matin + après-midi pour chaque stagiaire (taux 100 %)", () => {
    expect(data.presences).toHaveLength(4); // 2 stagiaires × 2 créneaux
    for (const p of data.presences) {
      expect(p.present).toBe(true);
      expect(p.dureeRealiseeMinutes).toBe(p.dureePrevueMinutes);
      expect(p.source).toBe("emargement_presentiel");
    }
    // taux 100% dans les enrollments
    for (const e of data.enrollments) {
      expect(e.tauxPresencePct).toBe(100);
      expect(e.statut).toBe("presente");
    }
  });

  // ── Indicateur 17/21/22 — Moyens pédagogiques + techniques + ressources ──

  it("indicateurs 17/21/22 : moyens pédagogiques, techniques et ressources renseignés", () => {
    expect(data.formation.methodesPedagogiques.length).toBeGreaterThan(50);
    expect(data.formation.moyensTechniques.length).toBeGreaterThan(30);
    expect(data.formation.ressourcesPedagogiques.length).toBeGreaterThanOrEqual(3);
  });

  // ── Indicateur 19 — Satisfaction ─────────────────────────────────────────

  it("indicateur 31 : chaque stagiaire a un questionnaire satisfaction_chaud rempli avec note ≥ 4", () => {
    const satisfactions = data.questionnaires.filter((q) => q.type === "satisfaction_chaud");
    expect(satisfactions).toHaveLength(2);
    for (const q of satisfactions) {
      expect(q.reponduAt).toBeTruthy();
      expect(q.noteGlobale).not.toBeNull();
      expect(q.noteGlobale).toBeGreaterThanOrEqual(4);
    }
  });

  // ── Attestation (DocumentGenere) ─────────────────────────────────────────

  it("attestation : présente avec qrToken stable et hash fictif", () => {
    expect(data.attestation.type).toBe("attestation");
    expect(data.attestation.qrToken).toBeTruthy();
    expect(data.attestation.qrToken.length).toBeGreaterThan(20);
    expect(data.attestation.hashSha256).toHaveLength(64);
    expect(data.enrollments[data.attestation.stagiaireIndex].attestationResultat).toBe("complete");
  });

  // ── Facture ───────────────────────────────────────────────────────────────

  it("facture : émise, en subrogation OPCO, mention exonération TVA dans le devis", () => {
    expect(data.facture.statut).toBe("emise");
    expect(data.facture.subrogation).toBe(true);
    expect(data.facture.destinataire).toBe("opco");
    expect(data.facture.montantHtCents).toBe(data.devis.montantTotalHtCents);
    expect(data.devis.mentionTva).toContain("261-4-4°");
  });

  // ── Indicateur 31 — Réclamation résolue ──────────────────────────────────

  it("indicateur 31 : réclamation résolue avec réponse ET actions correctives", () => {
    expect(data.reclamation.statut).toBe("resolue");
    expect(data.reclamation.reponse).toBeTruthy();
    expect(data.reclamation.actionsCorrectives).toBeTruthy();
    expect(data.reclamation.dateReponse).toBeTruthy();
  });

  // ── Indicateurs 23/24/25 — Veille (3 types) ──────────────────────────────

  it("indicateurs 23/24/25 : 3 veilles couvrant légale, métiers et pédagogique avec actionDecidee", () => {
    const types = data.veilles.map((v) => v.type);
    expect(types).toContain("legale");
    expect(types).toContain("metiers");
    expect(types).toContain("pedagogique");
    for (const v of data.veilles) {
      expect(v.actionDecidee).toBeTruthy();
      expect(v.actionDecidee!.length).toBeGreaterThan(20);
    }
  });

  // ── Indicateur 25 — Partenariat ──────────────────────────────────────────

  it("indicateur 25 : partenariat actif renseigné", () => {
    expect(data.partenariat.actif).toBe(true);
    expect(data.partenariat.nom).toBeTruthy();
    expect(data.partenariat.objet.length).toBeGreaterThan(30);
  });

  // ── Indicateur 27 — Sous-traitant vérifié data.gouv ──────────────────────

  it("indicateur 27 : sous-traitant avec NDA, siret, vérification data.gouv et contrat", () => {
    expect(data.sousTraitant.actif).toBe(true);
    expect(data.sousTraitant.siret).toBeTruthy();
    expect(data.sousTraitant.nda).toBeTruthy();
    expect(data.sousTraitant.verifieDataGouvAt).toBeInstanceOf(Date);
    expect(data.sousTraitant.contratSigneAt).toBeInstanceOf(Date);
  });

  // ── Indicateur 32 — Revue de direction ───────────────────────────────────

  it("indicateur 32 : revue de direction validée avec participants, décisions et plan d'actions", () => {
    expect(data.revueDirection.statut).toBe("valide");
    expect(data.revueDirection.participants.length).toBeGreaterThanOrEqual(2);
    expect(data.revueDirection.decisions.length).toBeGreaterThanOrEqual(2);
    expect(data.revueDirection.planActions.length).toBeGreaterThanOrEqual(2);
    expect(data.revueDirection.indicateursSnapshot).toBeTruthy();
  });

  // ── Indicateur 30 — Appréciations multi-parties ──────────────────────────

  it("indicateur 30 : appréciations stagiaire ET entreprise, notes ≥ 4", () => {
    const sources = data.appreciations.map((a) => a.source);
    expect(sources).toContain("stagiaire");
    expect(sources).toContain("entreprise");
    for (const a of data.appreciations) {
      expect(a.note).toBeGreaterThanOrEqual(4);
      expect(a.commentaire).toBeTruthy();
    }
  });

  // ── Cycle commercial complet ──────────────────────────────────────────────

  it("cycle commercial : devis accepté → session réalisée → financement OPCO", () => {
    expect(data.devis.statut).toBe("accepte");
    expect(data.devis.acceptedAt).toBeInstanceOf(Date);
    expect(data.session.statut).toBe("realisee");
    expect(data.session.financementType).toBe("opco");
    expect(data.session.opcoStatut).toBe("paiement_recu");
    expect(data.session.opcoSubrogation).toBe(true);
  });

  // ── Formation publiée ─────────────────────────────────────────────────────

  it("formation : statutGeneration=publie et statut=publie avec programme détaillé", () => {
    expect(data.formation.statut).toBe("publie");
    expect(data.formation.statutGeneration).toBe("publie");
    expect(data.formation.programmeDetaille.length).toBeGreaterThanOrEqual(3);
  });

  // ── Idempotence des tokens ─────────────────────────────────────────────────

  it("les tokens de questionnaires sont stables et uniques entre eux", () => {
    const tokens = data.questionnaires.map((q) => q.token);
    const uniqueTokens = new Set(tokens);
    expect(uniqueTokens.size).toBe(tokens.length);
    // Stable = même valeur à chaque appel
    const data2 = buildDemoData();
    const tokens2 = data2.questionnaires.map((q) => q.token);
    expect(tokens).toEqual(tokens2);
  });

  it("le qrToken de l'attestation est stable et non-vide", () => {
    expect(data.attestation.qrToken).toBe(buildDemoData().attestation.qrToken);
    expect(data.attestation.qrToken.length).toBeGreaterThan(20);
  });

  // ── Couverture complète du cycle ──────────────────────────────────────────

  it("le jeu de données couvre les 17 entités du cycle complet", () => {
    // Client, Devis, Formation, Session, Stagiaires (2), Enrollments (2),
    // Présences (4), Évaluations (4), Questionnaires (4),
    // Attestation, Facture, Réclamation, Veilles (3),
    // Partenariat, SousTraitant, RevueDirection, Appréciations (2)
    expect(data.client).toBeTruthy();
    expect(data.devis).toBeTruthy();
    expect(data.formation).toBeTruthy();
    expect(data.session).toBeTruthy();
    expect(data.stagiaires).toHaveLength(2);
    expect(data.enrollments).toHaveLength(2);
    expect(data.presences).toHaveLength(4);
    expect(data.evaluations).toHaveLength(4);
    expect(data.questionnaires).toHaveLength(4);
    expect(data.attestation).toBeTruthy();
    expect(data.facture).toBeTruthy();
    expect(data.reclamation).toBeTruthy();
    expect(data.veilles).toHaveLength(3);
    expect(data.partenariat).toBeTruthy();
    expect(data.sousTraitant).toBeTruthy();
    expect(data.revueDirection).toBeTruthy();
    expect(data.appreciations).toHaveLength(2);
  });
});
