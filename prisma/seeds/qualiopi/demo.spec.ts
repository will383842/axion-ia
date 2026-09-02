/**
 * Tests unitaires du dossier démo Qualiopi (T16 · Agent A).
 *
 * Valide que `buildDemoData()` (pure, sans I/O) produit un jeu de fixtures
 * couvrant bien l'ensemble des indicateurs Qualiopi requis.
 *
 * Aucun mock Prisma — la logique testée est entièrement pure.
 */

import { describe, it, expect } from "vitest";
import { STATUT_REVUE_COUVRANTE } from "@/server/qualiopi/registres/statuts-revue";
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

  // ── Indicateur 10 — Adaptation de la prestation (accompagnement) ─────────

  it("indicateur 10 : au moins un enrollment porte adaptationsRealisees (texte non vide)", () => {
    const avecAdaptation = data.enrollments.filter(
      (e) => typeof e.adaptationsRealisees === "string" && e.adaptationsRealisees.trim().length > 0,
    );
    expect(avecAdaptation.length).toBeGreaterThanOrEqual(1);
    expect(avecAdaptation[0]!.adaptationsRealisees).toContain("[DEMO]");
  });

  // ── Indicateurs 17/18 — Inventaire des moyens pédagogiques ───────────────

  it("indicateurs 17/18 : inventaire moyens (salle + matériel + plateforme) actifs et vérifiés", () => {
    const categories = data.moyens.map((m) => m.categorie);
    expect(categories).toContain("salle");
    expect(categories).toContain("materiel");
    expect(categories).toContain("plateforme");
    for (const m of data.moyens) {
      expect(m.actif).toBe(true);
      expect(m.dateVerification).toBeInstanceOf(Date);
      expect(m.libelle).toBeTruthy();
    }
    // off.18 : chaque catégorie utilisée a au moins un moyen vérifié.
    const categoriesVerifiees = new Set(
      data.moyens.filter((m) => m.actif && m.dateVerification != null).map((m) => m.categorie),
    );
    expect(new Set(categories)).toEqual(categoriesVerifiees);
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
    // 🔴 2026-09-02 — cette assertion VERROUILLAIT la faute : elle exigeait
    // « valide », un statut qu'aucun lecteur de l'application ne reconnaît.
    // Un test qui fige une valeur fausse est pire qu'un test absent.
    expect(data.revueDirection.statut).toBe(STATUT_REVUE_COUVRANTE);
    expect(data.revueDirection.participants.length).toBeGreaterThanOrEqual(2);
    expect(data.revueDirection.decisions.length).toBeGreaterThanOrEqual(2);
    expect(data.revueDirection.planActions.length).toBeGreaterThanOrEqual(2);
    expect(data.revueDirection.indicateursSnapshot).toBeTruthy();
  });

  // ── Indicateur 30 — Appréciations multi-parties (T17 : 4 sources) ───────

  it("indicateur 30 : appréciations stagiaire, entreprise, financeur ET formateur, notes ≥ 4", () => {
    const sources = data.appreciations.map((a) => a.source);
    expect(sources).toContain("stagiaire");
    expect(sources).toContain("entreprise");
    expect(sources).toContain("financeur");
    expect(sources).toContain("formateur");
    expect(data.appreciations).toHaveLength(4);
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

  it("formation : statutGeneration=publie et statut=actif (condition fiche publique) avec programme détaillé", () => {
    expect(data.formation.statut).toBe("actif");
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

  // ── Indicateur 21 — Formateur salarié avec CV (T17) ──────────────────────

  it("indicateur 21 : trainer salarié avec cvUrl, cvUploadedAt et email DEMO", () => {
    expect(data.trainer.statut).toBe("salarie");
    expect(data.trainer.cvUrl).toBeTruthy();
    expect(data.trainer.cvUploadedAt).toBeInstanceOf(Date);
    expect(data.trainer.email).toMatch(/@demo\.axion-ia\.invalid$/);
  });

  // ── Indicateur 26 — Référent handicap SiteSettings (T17) ─────────────────

  it("indicateur 26 : 3 SiteSettings référent handicap (nom, email, téléphone) catégorie qualiopi", () => {
    expect(data.siteSettings).toHaveLength(3);
    const keys = data.siteSettings.map((s) => s.key);
    expect(keys).toContain("referent_handicap_nom");
    expect(keys).toContain("referent_handicap_email");
    expect(keys).toContain("referent_handicap_telephone");
    for (const s of data.siteSettings) {
      expect(s.category).toBe("qualiopi");
      expect(s.value).toBeTruthy();
      expect(s.description).toBeTruthy();
    }
  });

  // ── Indicateurs 1/2 — Indicateurs publiés sur la formation (T17) ─────────

  it("indicateurs 1/2 : formation démo avec indicateursPublies ≥ 3 + methodeCalculIndicateurs", () => {
    expect(data.formation.indicateursPublies.length).toBeGreaterThanOrEqual(3);
    for (const ind of data.formation.indicateursPublies) {
      expect(ind.libelle).toBeTruthy();
      expect(ind.valeur).toBeGreaterThan(0);
      expect(ind.unite).toBeTruthy();
      expect(ind.annee).toBeGreaterThanOrEqual(2025);
    }
    expect(data.formation.methodeCalculIndicateurs.length).toBeGreaterThan(50);
    expect(data.formation.indicateursPubliesAt).toBeInstanceOf(Date);
  });

  // ── Indicateur 27 — Sous-traitant avec screenshot (T17) ──────────────────

  it("indicateur 27 : sousTraitant avec screenshotUrl et screenshotDate renseignés", () => {
    expect(data.sousTraitant.screenshotUrl).toBeTruthy();
    expect(data.sousTraitant.screenshotDate).toBeInstanceOf(Date);
  });

  // ── BPF Dépense (T17 · CLUSTER 5) ────────────────────────────────────────

  it("BPF : dépense démo renseignée (annee, catégorie, libellé, montant > 0)", () => {
    expect(data.bpfDepense.annee).toBeGreaterThanOrEqual(2026);
    expect(data.bpfDepense.categorie).toBeTruthy();
    expect(data.bpfDepense.libelle).toContain("[DEMO]");
    expect(data.bpfDepense.montantHtCents).toBeGreaterThan(0);
  });

  // ── Couverture complète du cycle ──────────────────────────────────────────

  it("le jeu de données couvre les 21 entités du cycle complet (T17)", () => {
    // Client, Devis, Formation (avec indicateurs), Session (avec coFormateur),
    // Trainer, Stagiaires (2), Enrollments (2), Présences (4), Évaluations (4),
    // Questionnaires (4), Attestation, Facture, Réclamation, Veilles (3),
    // Partenariat, SousTraitant (avec screenshot), RevueDirection,
    // Appréciations (4), SiteSettings (3), BpfDepense
    expect(data.client).toBeTruthy();
    expect(data.devis).toBeTruthy();
    expect(data.formation).toBeTruthy();
    expect(data.session).toBeTruthy();
    expect(data.trainer).toBeTruthy();
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
    expect(data.appreciations).toHaveLength(4);
    expect(data.siteSettings).toHaveLength(3);
    expect(data.bpfDepense).toBeTruthy();
  });

  // ── T18 — Client IDCC (convention collective Syntec) ─────────────────────

  it("T18 : client démo possède un idcc cohérent avec NAF 6201Z (Syntec 1486)", () => {
    expect(data.client.idcc).toBeTruthy();
    expect(data.client.idcc).toBe("1486");
  });

  // ── T18 — Formation certifiante RS + cpfEligible ─────────────────────────

  it("T18 : formation certifiante de type RS avec codeRs marqué DEMO", () => {
    expect(data.formation.certificationType).toBe("rs");
    expect(data.formation.codeRs).toBeTruthy();
    expect(data.formation.codeRs).toMatch(/DEMO/);
  });

  it("T18 : certificateur renseigné, numéros DEMO, estCertificateur=false", () => {
    expect(data.formation.certificateurNom).toContain("[DEMO]");
    expect(data.formation.numeroEnregistrementFc).toMatch(/DEMO/);
    expect(data.formation.estCertificateur).toBe(false);
    expect(data.formation.numeroHabilitation).toMatch(/DEMO/);
  });

  it("T18 : dates certification cohérentes (enregistrement passé, échéance future)", () => {
    expect(data.formation.dateEnregistrementCertif).toBeInstanceOf(Date);
    expect(data.formation.dateEcheanceCertif).toBeInstanceOf(Date);
    expect(data.formation.dateEcheanceCertif.getTime()).toBeGreaterThan(Date.now());
    expect(data.formation.dateEnregistrementCertif.getTime()).toBeLessThan(Date.now());
  });

  it("T18 : blocsCompetences ≥ 2 avec code et libelle [DEMO]", () => {
    const blocs = data.formation.blocsCompetences;
    expect(blocs.length).toBeGreaterThanOrEqual(2);
    for (const b of blocs) {
      expect(b.code).toBeTruthy();
      expect(b.libelle).toContain("[DEMO]");
    }
  });

  it("T18 : edofVerifieAt non null → computeCpfEligible = true → cpfEligible = true", () => {
    // Vérifie les 3 conditions cumulatives de computeCpfEligible
    // (certification-service.ts — logique pure inline, sans importer le module
    //  pour ne pas déclencher l'import @/lib/prisma dans ce test pur).
    const f = {
      certificationType: data.formation.certificationType,
      codeRncp: null as string | null,
      codeRs: data.formation.codeRs,
      blocsCompetences: data.formation.blocsCompetences,
      edofVerifieAt: data.formation.edofVerifieAt,
    };

    // Condition 1 : certificationType !== "aucune"
    expect(f.certificationType).not.toBe("aucune");
    // Condition 2 : codeRs non vide
    expect(f.codeRs.trim()).not.toBe("");
    // Condition 3 : edofVerifieAt non null
    expect(f.edofVerifieAt).toBeInstanceOf(Date);

    // Champ calculé persisté
    expect(data.formation.cpfEligible).toBe(true);
  });

  // ── T18 — Session barème OPCO PAR DOSSIER ────────────────────────────────

  it("T18 : session avec barème OPCO par dossier (priseEnChargeMontantCents > 0)", () => {
    expect(data.session.priseEnChargeMontantCents).toBeGreaterThan(0);
    expect(data.session.priseEnChargeUnite).toBe("euro_heure");
  });

  it("T18 : plafonds formation et annuel renseignés (centimes > 0)", () => {
    expect(data.session.priseEnChargePlafondFormationCents).toBeGreaterThan(0);
    expect(data.session.priseEnChargePlafondAnnuelCents).toBeGreaterThan(0);
    // Plafond annuel doit être >= plafond formation
    expect(data.session.priseEnChargePlafondAnnuelCents).toBeGreaterThanOrEqual(
      data.session.priseEnChargePlafondFormationCents,
    );
  });

  it("T18 : source URL et date de relevé barème renseignées (traçabilité dossier OPCO)", () => {
    expect(data.session.priseEnChargeSourceUrl).toBeTruthy();
    expect(data.session.priseEnChargeSourceUrl).toMatch(/demo\.axion-ia\.invalid/);
    expect(data.session.priseEnChargeReleveLe).toBeInstanceOf(Date);
  });

  it("T18 : cohérence barème — montant × duree × participants ≤ plafond formation", () => {
    // 35 €/h × 7 h × 2 stagiaires = 490 € = 49 000 centimes ≤ plafondFormation
    const calcul =
      data.session.priseEnChargeMontantCents *
      data.session.dureeReelleHeures *
      data.session.nbParticipantsReels;
    expect(calcul).toBeLessThanOrEqual(data.session.priseEnChargePlafondFormationCents);
  });
});
