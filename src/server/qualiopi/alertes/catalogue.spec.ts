/**
 * Tests — alertes/catalogue.ts (T15 AGENT A).
 *
 * Vérifie : exhaustivité du catalogue (27 codes), cohérence niveau/resolutionAuto,
 * niveauFromSpec (mapping spec→enum), types corrects.
 * Module PUR : aucun mock requis.
 */

import { describe, it, expect } from "vitest";
import { ALERTE_CATALOGUE, niveauFromSpec } from "./catalogue";
import type { AlerteNiveau } from "../../../../prisma/generated/client";

// ─────────────────────────────────────────────────────────────────────────────
// Codes attendus (SPEC_PART2 §6.5 + CONTRAT-T15.md)
// ─────────────────────────────────────────────────────────────────────────────

const CODES_ATTENDUS: string[] = [
  "referent_handicap_absent",
  // Ajouté 2026-08-04 : la déclaration d'un besoin d'adaptation depuis le
  // portail n'atteignait la console par AUCUN chemin (Telegram seul). Seule
  // entrée du catalogue née d'un GESTE et non du balayage quotidien — d'où son
  // `resolutionAuto: false`, verrouillé par `besoin-adaptation.spec.ts`.
  "besoin_adaptation_declare",
  "categories_certifiees_non_renseignees",
  // Ajouté 2026-08-23 (recette du jour d'audit). Constaté À L'ÉCRAN sur
  // `/qualiopi/mode-auditeur` : « 1 formation certifiante avec code RS/RNCP »
  // présentée comme preuve de l'indicateur 1, pendant que 3, 7 ⭐ et 16 ⭐ sont
  // déclarés « non applicables ». Deux colonnes indépendantes répondent à la
  // même question, et une seule des deux a une porte d'entrée.
  "catalogue_certifiant_incoherent",
  "cloture_trace_presence_incomplete",
  "email_rebond_dur",
  "report_accord_financement_a_refaire",
  // Ajoutés 2026-08-19 (audit E2E, `D5-4-01`). Ces quatre codes étaient ÉMIS par
  // le balayage depuis leur écriture et ABSENTS de ce catalogue — donc sans
  // guichet (ils n'arrivaient dans AUCUNE boîte, rangés en `sansGuichet` par
  // `envoi-groupe.ts`) et sans résolution automatique (ouverts pour toujours,
  // même après régularisation).
  //
  // 🔑 Ils ne pouvaient pas être détectés : la garde de `routage.spec.ts`
  // construisait son ensemble EN FILTRANT sur l'appartenance à ce catalogue,
  // puis testait l'appartenance à ce catalogue. Vide par construction. Corrigée
  // dans le même commit — l'extraction part désormais de la position syntaxique
  // `code:` et couvre le ternaire des deux codes URSSAF.
  "vigilance_urssaf_absente",
  "vigilance_urssaf_perimee",
  "vigilance_urssaf_expire_j30",
  "kit_sorties_non_pretes",
  "responsable_qualite_absent",
  "facture_mentions_legales_absentes",
  // SPEC_PART5 §A.2, écrite le 2026-08-05 : la colonne `derniereVerifCoherenceAt`
  // existait depuis T1 sans qu'aucune règle ne surveille son ancienneté.
  "offres_site_non_verifiees",
  // Cycle commercial (2026-08-05). Les 3 premiers réparent un bug latent :
  // émis par l'évaluateur depuis le 2026-08-01 mais hors catalogue → jamais
  // auto-résolus. Les 2 derniers = SPEC_PART5 §D.10 (échéance de validité).
  "devis_sans_reponse",
  "signature_en_attente",
  "signature_contreseing_du",
  "devis_expire_j7",
  "devis_expire",
  // Déblocages du parcours vente (2026-08-05) : l'étape suivante attend
  // l'admin — notifiés par email interne, pas seulement affichés.
  "devis_signe_convention",
  "moteur_assemble_a_publier",
  "emails_en_attente_validation",
  "emargement_manquant",
  "session_sans_formateur",
  // Ajouté 2026-07-20 : comble l'angle mort où une session non émargée restait
  // bloquée en `en_cours` sans qu'aucune alerte ne se lève (R03 exige `realisee`,
  // que la clôture auto refuse justement de poser sans émargement).
  "session_bloquee_en_cours",
  "session_sans_dispositif_emargement",
  // Les liens SONT partis et personne n'a signe : l'angle mort que les trois
  // autres regles laissaient ouvert, et que le cron de 06:00 ouvrait lui-meme.
  "emargement_aucune_signature",
  "rappel_j7_non_envoye",
  "journee_sans_creneaux",
  // Phase « Tout pour animer » (2026-08-05) : le slot `diaporama` du kit (LE
  // .pptx projeté) n'est pas déposé pour une session qui démarre sous 7 jours.
  // Jamais levée pour une formation sans kit résolvable (sur-mesure, dupliquée).
  "diaporama_manquant_session",
  // Lot 1 §1.4 — les deux seules étapes du parcours d'un dossier qui n'avaient
  // AUCUN code d'alerte (les douze autres en avaient déjà un).
  "positionnement_sans_reponse",
  "suivi_froid_manquant",
  "satisfaction_manquante",
  "evaluation_acquis_manquante",
  "attestation_non_envoyee",
  "satisfaction_sous_seuil",
  "reclamation_sans_reponse_j15",
  "qualiopi_expire_j90",
  "qualiopi_expire_j30",
  "qualiopi_expire",
  "bpf_a_deposer_j60",
  "bpf_a_deposer_j30",
  "bpf_a_deposer_j7",
  "bpf_en_retard",
  "veille_inactive_j45",
  "cv_formateur_perime",
  "sous_traitant_qualiopi_expire_j60",
  "sous_traitant_qualiopi_expire",
  // Vigilance sous-traitance — art. 4 et 8 de la procédure signée. [2026-08-03]
  "sous_traitant_contrat_cadre_manquant",
  "sous_traitant_rc_pro_absente",
  "sous_traitant_rc_pro_expiree",
  "sous_traitant_rc_pro_expire_j60",
  "sous_traitant_verification_annuelle_due",
  "sous_traitant_incidents_repetes",
  "opco_sans_accord",
  "opco_formation_demarree_sans_accord",
  "convention_tripartite_manquante",
  "convention_formation_manquante",
  "bareme_opco_perime",
  // Conservé au catalogue bien qu'il ne soit PLUS émis (le palier J30 est couvert
  // par une relance proposée) : sans son entrée, les alertes déjà en base ne
  // s'auto-résoudraient jamais. Cf. `catalogue.ts`.
  "facture_impayee_j30",
  "facture_impayee_j60",
  // Recouvrement 2026-08-02 — filet de sécurité + suivi des relances envoyées.
  "facture_sans_echeance",
  "relance_sans_effet",
  // Suivi des dossiers de financement (2026-07-31) — `echeanceFinanceurAt`
  // existait au schéma sans aucun consommateur : financeur en retard ou dossier
  // envoyé sans réponse ne déclenchaient rien.
  "dossier_financement_sans_reponse",
  "financeur_paiement_en_retard",
  "job_ia_echoue",
  "suppression_rgpd_j30",
  "revue_trimestrielle_a_faire",
  // Chaîne d'envoi d'e-mails (audit du 2026-08-16). Comme
  // `besoin_adaptation_declare`, ces deux codes naissent d'un cron DISTINCT
  // (`formation-crons.email-sante`) et non du balayage d'`evaluerAlertes()` —
  // d'où leur `resolutionAuto: false`, sans quoi le premier
  // `synchroniserAlertes` venu les résoudrait avant que quiconque les ait lus.
  "emails_en_echec",
  "emails_bloques_en_file",
  // Ajoutés le 2026-08-31 : la sonde levait CINQ codes, ce catalogue en
  // connaissait deux. Les trois autres arrivaient en console sans niveau ni
  // guichet. La liste ci-dessus reste tenue à la main — c'est sa faiblesse ;
  // `la-sonde-et-le-catalogue-ne-divergent-pas.spec.ts` la compense en
  // dérivant la liste attendue de la sonde elle-même.
  "emails_sante_non_mesurable",
  "emails_rebonds",
  "emails_rebonds_non_detectes",
  // Lot 3 (audit e-mails 2026-09-02) : le balayage horaire des e-mails restés
  // « approuvés » sans être partis.
  "emails_approuves_abandonnes",
  // Cycle de vie du formateur sur une session (2026-09-03).
  "formateur_mission_refusee",
  "formateur_mission_sans_reponse",
  // Recette du 2026-09-03 : la proposition EXPIRÉE ne levait rien du tout.
  "formateur_mission_expiree",
  "formateur_indisponible_sur_session",
  "formateur_non_habilite_assigne",
];

const NIVEAUX_VALIDES: AlerteNiveau[] = ["info", "important", "critique"];

// ─────────────────────────────────────────────────────────────────────────────
// Tests catalogue
// ─────────────────────────────────────────────────────────────────────────────

describe("ALERTE_CATALOGUE", () => {
  it("contient exactement les codes attendus", () => {
    const codesPresents = Object.keys(ALERTE_CATALOGUE).sort();
    const codesAttendus = [...CODES_ATTENDUS].sort();
    expect(codesPresents).toEqual(codesAttendus);
  });

  it("chaque entrée a un niveau valide", () => {
    for (const [code, entry] of Object.entries(ALERTE_CATALOGUE)) {
      expect(NIVEAUX_VALIDES, `${code} niveau invalide`).toContain(entry.niveau);
    }
  });

  it("chaque entrée a un titre non-vide", () => {
    for (const [code, entry] of Object.entries(ALERTE_CATALOGUE)) {
      expect(entry.titre, `${code} titre vide`).toBeTruthy();
      expect(entry.titre.length, `${code} titre trop court`).toBeGreaterThan(3);
    }
  });

  it("resolutionAuto est un booléen pour chaque entrée", () => {
    for (const [code, entry] of Object.entries(ALERTE_CATALOGUE)) {
      expect(typeof entry.resolutionAuto, `${code} resolutionAuto n'est pas un booléen`).toBe(
        "boolean",
      );
    }
  });

  // Vérifications niveau SPEC §6.5
  it("referent_handicap_absent est critique", () => {
    expect(ALERTE_CATALOGUE["referent_handicap_absent"]?.niveau).toBe("critique");
  });

  it("emargement_manquant est critique", () => {
    expect(ALERTE_CATALOGUE["emargement_manquant"]?.niveau).toBe("critique");
  });

  it("evaluation_acquis_manquante est critique", () => {
    expect(ALERTE_CATALOGUE["evaluation_acquis_manquante"]?.niveau).toBe("critique");
  });

  it("satisfaction_manquante est important", () => {
    expect(ALERTE_CATALOGUE["satisfaction_manquante"]?.niveau).toBe("important");
  });

  it("attestation_non_envoyee est important", () => {
    expect(ALERTE_CATALOGUE["attestation_non_envoyee"]?.niveau).toBe("important");
  });

  it("reclamation_sans_reponse_j15 est critique", () => {
    expect(ALERTE_CATALOGUE["reclamation_sans_reponse_j15"]?.niveau).toBe("critique");
  });

  it("qualiopi_expire est critique", () => {
    expect(ALERTE_CATALOGUE["qualiopi_expire"]?.niveau).toBe("critique");
  });

  it("qualiopi_expire_j30 est critique", () => {
    expect(ALERTE_CATALOGUE["qualiopi_expire_j30"]?.niveau).toBe("critique");
  });

  it("qualiopi_expire_j90 est important", () => {
    expect(ALERTE_CATALOGUE["qualiopi_expire_j90"]?.niveau).toBe("important");
  });

  it("bpf_en_retard est critique", () => {
    expect(ALERTE_CATALOGUE["bpf_en_retard"]?.niveau).toBe("critique");
  });

  it("bpf_a_deposer_j60 est info", () => {
    expect(ALERTE_CATALOGUE["bpf_a_deposer_j60"]?.niveau).toBe("info");
  });

  it("suppression_rgpd_j30 est info", () => {
    expect(ALERTE_CATALOGUE["suppression_rgpd_j30"]?.niveau).toBe("info");
  });

  // Vérifications resolutionAuto SPEC §6.5
  it("referent_handicap_absent a resolutionAuto=true", () => {
    expect(ALERTE_CATALOGUE["referent_handicap_absent"]?.resolutionAuto).toBe(true);
  });

  it("emargement_manquant a resolutionAuto=true", () => {
    expect(ALERTE_CATALOGUE["emargement_manquant"]?.resolutionAuto).toBe(true);
  });

  it("reclamation_sans_reponse_j15 a resolutionAuto=true", () => {
    expect(ALERTE_CATALOGUE["reclamation_sans_reponse_j15"]?.resolutionAuto).toBe(true);
  });

  it("satisfaction_manquante a resolutionAuto=false", () => {
    expect(ALERTE_CATALOGUE["satisfaction_manquante"]?.resolutionAuto).toBe(false);
  });

  it("evaluation_acquis_manquante a resolutionAuto=false", () => {
    expect(ALERTE_CATALOGUE["evaluation_acquis_manquante"]?.resolutionAuto).toBe(false);
  });

  it("qualiopi_expire a resolutionAuto=false", () => {
    expect(ALERTE_CATALOGUE["qualiopi_expire"]?.resolutionAuto).toBe(false);
  });

  it("qualiopi_expire_j30 a resolutionAuto=true", () => {
    expect(ALERTE_CATALOGUE["qualiopi_expire_j30"]?.resolutionAuto).toBe(true);
  });

  it("bpf_a_deposer_j60 a resolutionAuto=true", () => {
    expect(ALERTE_CATALOGUE["bpf_a_deposer_j60"]?.resolutionAuto).toBe(true);
  });

  it("suppression_rgpd_j30 a resolutionAuto=false", () => {
    expect(ALERTE_CATALOGUE["suppression_rgpd_j30"]?.resolutionAuto).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests niveauFromSpec
// ─────────────────────────────────────────────────────────────────────────────

describe("niveauFromSpec", () => {
  it("CRITIQUE → critique", () => {
    expect(niveauFromSpec("CRITIQUE")).toBe("critique");
  });

  it("IMPORTANT → important", () => {
    expect(niveauFromSpec("IMPORTANT")).toBe("important");
  });

  it("INFO → info", () => {
    expect(niveauFromSpec("INFO")).toBe("info");
  });

  it("insensible à la casse", () => {
    expect(niveauFromSpec("critique")).toBe("critique");
    expect(niveauFromSpec("Critique")).toBe("critique");
    expect(niveauFromSpec("important")).toBe("important");
    expect(niveauFromSpec("Important")).toBe("important");
    expect(niveauFromSpec("info")).toBe("info");
  });

  it("valeur inconnue → info (fallback)", () => {
    expect(niveauFromSpec("INCONNU")).toBe("info");
    expect(niveauFromSpec("")).toBe("info");
    expect(niveauFromSpec("URGENT")).toBe("info");
  });
});
