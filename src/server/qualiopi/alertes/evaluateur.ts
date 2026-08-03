/**
 * Qualiopi — Évaluateur des alertes système (SPEC_PART2 §6.5).
 *
 * Scanne la DB et retourne la liste des alertes à créer/maintenir.
 * Stub-aware : early-exit si DATABASE_URL contient "stub.invalid".
 * Fail-soft par règle : une erreur n'interrompt pas les autres règles.
 * Seuils et dates via getQualiopiConfig (jamais en dur).
 */

import { prisma } from "@/lib/prisma";
import { compterEnAttente } from "@/server/email/outbox-service";
import { getQualiopiConfig } from "@/server/qualiopi/config/site-settings";
import { listBaremesEnVigueur } from "@/server/qualiopi/financements/bareme-opco";
import { estBaremePerime, opcoLabel } from "@/server/qualiopi/financements/opco-referentiel";
import { STATUTS_FACTURE_OUVERTE } from "@/server/qualiopi/financements/statuts-facture";
import { libellePalier } from "@/server/qualiopi/financements/relance-paliers";
import {
  CONFORMITE_DEFAUTS,
  addMonths,
  trouverValide,
  vigilancePerimee,
  vigilanceRequise,
} from "@/server/qualiopi/trainers/conformite";
import {
  cumulAnnuelFormateurCents,
  listTrainerDocuments,
} from "@/server/qualiopi/trainers/documents";
import type { AlerteNiveau } from "../../../../prisma/generated/client";

// ─────────────────────────────────────────────────────────────────────────────
// Type de retour de l'évaluateur
// ─────────────────────────────────────────────────────────────────────────────

export interface AlerteCandidate {
  code: string;
  niveau: AlerteNiveau;
  titre: string;
  message: string;
  cibleType?: string;
  cibleId?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers internes
// ─────────────────────────────────────────────────────────────────────────────

/** Retourne une date = now() - N jours. */
function daysAgo(n: number, now = new Date()): Date {
  return new Date(now.getTime() - n * 24 * 60 * 60 * 1000);
}

/** Retourne une date = now() + N jours. */
function daysFromNow(n: number, now = new Date()): Date {
  return new Date(now.getTime() + n * 24 * 60 * 60 * 1000);
}

// ─────────────────────────────────────────────────────────────────────────────
// Règles individuelles — chacune retourne AlerteCandidate[]
// ─────────────────────────────────────────────────────────────────────────────

/** R01 — Référent handicap absent si nom vide dans config. */
async function regleReferentHandicap(now: Date): Promise<AlerteCandidate[]> {
  void now;
  const nom = await getQualiopiConfig("referent_handicap_nom");
  if (nom && nom.trim().length > 0) return [];
  return [
    {
      code: "referent_handicap_absent",
      niveau: "critique",
      titre: "Référent handicap absent",
      message:
        "Aucun référent handicap renseigné dans la configuration. Obligatoire Qualiopi (ind.26⭐).",
    },
  ];
}

/** R01b — Responsable qualité non désigné si nom vide dans config. */
async function regleResponsableQualite(now: Date): Promise<AlerteCandidate[]> {
  void now;
  const nom = await getQualiopiConfig("responsable_qualite_nom");
  if (nom && nom.trim().length > 0) return [];
  return [
    {
      code: "responsable_qualite_absent",
      niveau: "important",
      titre: "Responsable qualité non désigné",
      message:
        "Aucun responsable/référent qualité renseigné dans la configuration. L'auditeur COFRAC attend une personne identifiée qui pilote le référentiel et prépare les audits (critère 7).",
    },
  ];
}

/** R02 — Réclamations sans réponse depuis > N jours (N = seuil_reclamation_jours, défaut 15). */
async function regleReclamationsSansReponse(now: Date): Promise<AlerteCandidate[]> {
  const joursCfg = await getQualiopiConfig("seuil_reclamation_jours").catch(() => 15);
  const jours = typeof joursCfg === "number" && joursCfg > 0 ? joursCfg : 15;
  const seuil = daysAgo(jours, now);
  const reclamations = await prisma.reclamation.findMany({
    where: {
      statut: { in: ["nouvelle", "en_cours"] },
      dateReception: { lte: seuil },
      dateReponse: null,
    },
    select: { id: true, numero: true, reclamantNom: true, dateReception: true },
  });
  return reclamations.map((r) => ({
    code: "reclamation_sans_reponse_j15",
    niveau: "critique" as AlerteNiveau,
    titre: "Réclamation sans réponse depuis +15 jours",
    message: `La réclamation ${r.numero} de ${r.reclamantNom} (reçue le ${r.dateReception.toLocaleDateString("fr-FR")}) n'a pas encore de réponse.`,
    cibleType: "Reclamation",
    cibleId: r.id,
  }));
}

/** R03 — Émargements manquants : session realisee + enrollment sans emargement > 48h. */
async function regleEmargementManquant(now: Date): Promise<AlerteCandidate[]> {
  const threshold = daysAgo(2, now); // 48h
  const enrollments = await prisma.enrollment.findMany({
    where: {
      session: { statut: "realisee", dateFin: { lte: threshold } },
      statut: { in: ["planifiee", "presente"] },
      emargementSigneAt: null,
    },
    select: {
      id: true,
      trainee: { select: { nom: true, prenom: true } },
      session: { select: { id: true, numero: true } },
    },
  });
  return enrollments.map((e) => ({
    code: "emargement_manquant",
    niveau: "critique" as AlerteNiveau,
    titre: "Émargement manquant (session réalisée)",
    message: `L'émargement de ${e.trainee.prenom} ${e.trainee.nom} est manquant pour la session ${e.session.numero} (réalisée il y a >48h).`,
    cibleType: "Enrollment",
    cibleId: e.id,
  }));
}

/**
 * R03ter — Session bloquée en `en_cours` faute d'émargement.
 *
 * Comble un angle mort : `regleEmargementManquant` (R03) filtre sur
 * `session.statut = "realisee"`, mais la clôture automatique
 * (`qualiopi-formation-crons-worker.ts`) refuse précisément de passer une session
 * en `realisee` tant qu'aucun inscrit n'a de trace de présence. Une session
 * totalement non émargée ne pouvait donc déclencher NI la clôture, NI R03 : elle
 * restait indéfiniment `en_cours`, absente du BPF, des attestations et des
 * indicateurs, sans le moindre signal.
 *
 * Seuil à 72 h après `dateFin` — au-delà de la fenêtre de 24 h de la clôture
 * automatique, pour ne pas doublonner avec elle sur un simple décalage de cron.
 */
async function regleSessionBloqueeEnCours(now: Date): Promise<AlerteCandidate[]> {
  const sessions = await prisma.trainingSession.findMany({
    where: {
      statut: "en_cours",
      // Fenêtre GLISSANTE, pas seulement un plancher : sans borne haute, le
      // premier passage du cron remonterait d'un coup TOUTES les sessions jamais
      // clôturées depuis la mise en service — une salve d'alertes critiques qui
      // noierait les vraies (chaque alerte critique déclenche un e-mail).
      dateFin: { lte: daysAgo(3, now), gte: daysAgo(365, now) },
      // Le motif est VÉRIFIÉ, pas supposé : aucun inscrit ne porte de trace de
      // présence. Sans cette clause, une session restée « en cours » pour une
      // autre raison (clôture refusée sur le financement, dateFin non mise à
      // jour, session de démo) déclencherait une alerte qui MENT sur son
      // diagnostic, et l'administrateur chercherait un émargement qui existe.
      enrollments: {
        none: {
          OR: [{ emargementSigneAt: { not: null } }, { tauxPresencePct: { not: null } }],
        },
      },
      // ⚠️ Une session SANS AUCUN inscrit satisfait aussi `enrollments: { none }`.
      // Elle n'a pourtant rien à émarger — le worker la clôture sans garde.
      // Prisma ne sait pas filtrer sur un `_count` dans le `where` : le tri se
      // fait après lecture (voir le `.filter` ci-dessous), sinon le message
      // afficherait « aucun émargement pour ses 0 inscrit(s) ».
    },
    select: {
      id: true,
      numero: true,
      titreSession: true,
      client: { select: { raisonSociale: true } },
      _count: { select: { enrollments: true } },
    },
    take: 50,
  });

  return sessions
    .filter((s) => s._count.enrollments > 0)
    .map((s) => ({
      code: "session_bloquee_en_cours",
      niveau: "critique" as AlerteNiveau,
      titre: "Session non clôturée faute d'émargement",
      message:
        `La session ${designerSession(s)} est terminée depuis plus de 72 h mais reste « en cours » : ` +
        `aucun de ses ${s._count.enrollments} inscrit(s) ne porte de trace de présence. ` +
        `Tant qu'elle n'est pas clôturée, elle n'alimente ni le BPF, ni les attestations, ni les indicateurs.`,
      cibleType: "TrainingSession",
      cibleId: s.id,
    }));
}

/**
 * Désignation d'une session dans un message d'alerte : son numéro ET son client.
 *
 * 🔴 Les alertes ne nommaient que le numéro (« la session AXI-SESS-2026-001 »).
 * Il fallait ouvrir la fiche pour savoir de QUI il s'agit — sur trois sessions
 * c'est pénible, sur trente c'est inutilisable, et le lecteur ne peut pas
 * arbitrer l'urgence sans connaître le client. Quand aucun client n'est
 * rattaché, on le DIT : c'est souvent l'anomalie elle-même.
 */
function designerSession(s: {
  numero: string;
  titreSession?: string | null;
  client?: { raisonSociale: string } | null;
}): string {
  const qui = s.client?.raisonSociale ?? "aucun client rattaché";
  return s.titreSession != null && s.titreSession !== ""
    ? `${s.numero} « ${s.titreSession} » (${qui})`
    : `${s.numero} (${qui})`;
}

/** R03bis — Session sans formateur : démarre sous 7 jours, aucun formateur principal assigné. */
async function regleSessionSansFormateur(now: Date): Promise<AlerteCandidate[]> {
  const horizon = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const sessions = await prisma.trainingSession.findMany({
    where: {
      statut: { in: ["planifiee", "en_cours"] },
      // 🔴 Vérification E2E 2026-07-26 — `lte: horizon` seul n'avait PAS de borne
      // basse : toute session sans formateur, si ancienne soit-elle, ressortait
      // avec le message « démarre le <date passée> ». C'est exactement le piège
      // que `regleSessionBloqueeEnCours` garde déjà (`gte: daysAgo(365)`).
      dateDebut: { lte: horizon, gte: daysAgo(365, now) },
      formateurPrincipalId: null,
    },
    select: {
      id: true,
      numero: true,
      titreSession: true,
      dateDebut: true,
      client: { select: { raisonSociale: true } },
    },
  });
  return sessions.map((s) => {
    // 🔴 Le titre et le verbe étaient figés au FUTUR (« à J-7 », « démarre le »)
    // alors que la borne basse de 365 jours — volontaire, pour qu'une vraie
    // non-conformité ne disparaisse pas en silence — fait remonter des sessions
    // commencées depuis des semaines. Une alerte qui annonce au futur un fait
    // passé se lit comme une erreur du système, et on cesse de la lire.
    const passee = s.dateDebut.getTime() < now.getTime();
    const date = s.dateDebut.toLocaleDateString("fr-FR");
    return {
      code: "session_sans_formateur",
      niveau: "important" as AlerteNiveau,
      titre: passee
        ? "Session démarrée sans formateur principal"
        : "Session à J-7 sans formateur principal",
      message: passee
        ? `La session ${designerSession(s)} a démarré le ${date} sans formateur principal assigné. L'habilitation est requise AVANT animation : l'obligation n'est plus imminente, elle est dépassée.`
        : `La session ${designerSession(s)} démarre le ${date} sans formateur principal assigné (habilitation requise avant animation).`,
      cibleType: "TrainingSession",
      cibleId: s.id,
    };
  });
}

/** R04 — Satisfaction manquante : session realisee > 7 jours + questionnaire non rempli. */
async function regleSatisfactionManquante(now: Date): Promise<AlerteCandidate[]> {
  const threshold = daysAgo(7, now);
  const enrollments = await prisma.enrollment.findMany({
    where: {
      session: { statut: "realisee", dateFin: { lte: threshold } },
      statut: { in: ["planifiee", "presente"] },
      questionnaires: {
        none: {
          type: "satisfaction_chaud",
          reponduAt: { not: null },
        },
      },
    },
    select: {
      id: true,
      trainee: { select: { nom: true, prenom: true } },
      session: { select: { numero: true } },
    },
  });
  return enrollments.map((e) => ({
    code: "satisfaction_manquante",
    niveau: "important" as AlerteNiveau,
    titre: "Questionnaire de satisfaction non rempli",
    message: `Le questionnaire de satisfaction de ${e.trainee.prenom} ${e.trainee.nom} (session ${e.session.numero}) n'est pas rempli 7 jours après la session.`,
    cibleType: "Enrollment",
    cibleId: e.id,
  }));
}

/** R05 — Évaluation des acquis manquante : session realisee > 2 jours sans éval finale. */
async function regleEvaluationAcquisManquante(now: Date): Promise<AlerteCandidate[]> {
  const threshold = daysAgo(2, now);
  const enrollments = await prisma.enrollment.findMany({
    where: {
      session: { statut: "realisee", dateFin: { lte: threshold } },
      statut: { in: ["planifiee", "presente"] },
      evaluations: {
        none: {
          type: "finale",
        },
      },
    },
    select: {
      id: true,
      trainee: { select: { nom: true, prenom: true } },
      session: { select: { numero: true } },
    },
  });
  return enrollments.map((e) => ({
    code: "evaluation_acquis_manquante",
    niveau: "critique" as AlerteNiveau,
    titre: "Évaluation finale des acquis manquante",
    message: `L'évaluation finale des acquis de ${e.trainee.prenom} ${e.trainee.nom} (session ${e.session.numero}) est manquante 2 jours après la session.`,
    cibleType: "Enrollment",
    cibleId: e.id,
  }));
}

/** R06 — Attestation non envoyée : session realisee > 3 jours + attestationGenereeAt null. */
async function regleAttestationNonEnvoyee(now: Date): Promise<AlerteCandidate[]> {
  const threshold = daysAgo(3, now);
  const enrollments = await prisma.enrollment.findMany({
    where: {
      session: { statut: "realisee", dateFin: { lte: threshold } },
      statut: { in: ["planifiee", "presente"] },
      attestationGenereeAt: null,
    },
    select: {
      id: true,
      trainee: { select: { nom: true, prenom: true } },
      session: { select: { numero: true } },
    },
  });
  return enrollments.map((e) => ({
    code: "attestation_non_envoyee",
    niveau: "important" as AlerteNiveau,
    titre: "Attestation non envoyée au stagiaire",
    message: `L'attestation de ${e.trainee.prenom} ${e.trainee.nom} (session ${e.session.numero}) n'a pas été générée/envoyée 3 jours après la session.`,
    cibleType: "Enrollment",
    cibleId: e.id,
  }));
}

/** R07 — Satisfaction sous seuil (seuil_satisfaction_pct, défaut 90%). */
async function regleSatisfactionSousSeuil(_now: Date): Promise<AlerteCandidate[]> {
  const seuilCfg = await getQualiopiConfig("seuil_satisfaction_pct").catch(() => 90);
  const SEUIL_SATISFACTION_PCT = typeof seuilCfg === "number" && seuilCfg > 0 ? seuilCfg : 90;

  // On cherche des sessions réalisées ayant un taux de satisfaction calculable
  const sessions = await prisma.trainingSession.findMany({
    where: { statut: "realisee" },
    select: {
      id: true,
      numero: true,
      enrollments: {
        select: {
          questionnaires: {
            where: { type: "satisfaction_chaud", reponduAt: { not: null } },
            select: { noteGlobale: true },
          },
        },
      },
    },
  });

  const alertes: AlerteCandidate[] = [];
  for (const session of sessions) {
    const notes = session.enrollments
      .flatMap((e) => e.questionnaires)
      .map((q) => q.noteGlobale)
      .filter((n): n is number => n !== null);

    if (notes.length === 0) continue;
    const moyenne = notes.reduce((a, b) => a + b, 0) / notes.length;
    const pct = (moyenne / 5) * 100;
    if (pct < SEUIL_SATISFACTION_PCT) {
      alertes.push({
        code: "satisfaction_sous_seuil",
        niveau: "important",
        titre: "Taux de satisfaction sous le seuil",
        message: `La session ${session.numero} a un taux de satisfaction de ${pct.toFixed(0)}% (seuil : ${SEUIL_SATISFACTION_PCT}%).`,
        cibleType: "TrainingSession",
        cibleId: session.id,
      });
    }
  }
  return alertes;
}

/** R08 — Qualiopi expire dans 90/30 jours ou déjà expirée. */
async function regleQualiopiExpiration(now: Date): Promise<AlerteCandidate[]> {
  const validiteStr = await getQualiopiConfig("qualiopi_validite");
  if (!validiteStr) return [];

  const validite = new Date(validiteStr);
  if (isNaN(validite.getTime())) return [];

  const alertes: AlerteCandidate[] = [];

  if (validite <= now) {
    alertes.push({
      code: "qualiopi_expire",
      niveau: "critique",
      titre: "Certification Qualiopi expirée",
      message: `La certification Qualiopi a expiré le ${validite.toLocaleDateString("fr-FR")}. Renouvellement urgent.`,
    });
  } else if (validite <= daysFromNow(30, now)) {
    alertes.push({
      code: "qualiopi_expire_j30",
      niveau: "critique",
      titre: "Certification Qualiopi expire dans 30 jours",
      message: `La certification Qualiopi expire le ${validite.toLocaleDateString("fr-FR")} (dans ≤30 jours).`,
    });
  } else if (validite <= daysFromNow(90, now)) {
    alertes.push({
      code: "qualiopi_expire_j90",
      niveau: "important",
      titre: "Certification Qualiopi expire dans 90 jours",
      message: `La certification Qualiopi expire le ${validite.toLocaleDateString("fr-FR")} (dans ≤90 jours).`,
    });
  }

  return alertes;
}

/** R09 — BPF : selon la date (>1er avril, >1er mai, >24 mai, >31 mai) et bpf non déposé.
 *  Marqueur réel "BPF déposé" = SiteSetting `bpf_annee_deposee` (mise à jour par l'admin
 *  après dépôt sur maf.fr) >= année du BPF dû. [T17.1 — remplace l'ancienne heuristique
 *  RevueDirection.] Le BPF d'une année N se dépose en N+1 ; on évalue l'obligation de
 *  l'année précédente (déclarable au printemps de l'année courante).
 */
async function regleBpf(now: Date): Promise<AlerteCandidate[]> {
  const annee = now.getFullYear();
  const anneeBpf = annee - 1; // BPF de l'année N-1, à déposer avant le 31 mai de l'année N.

  // 🔴 Audit certification 2026-07-26 (F56). L'obligation de déposer un BPF
  // (art. L6352-11) ne naît qu'avec la DÉCLARATION D'ACTIVITÉ. Sans NDA,
  // l'organisme n'est pas encore un organisme de formation au sens du code du
  // travail : il ne doit aucun bilan.
  //
  // La règle concluait à un manquement à partir de la seule absence de dépôt, et
  // affichait « BPF en retard — régularisation urgente auprès de la DREETS » en
  // CRITIQUE à un organisme qui n'était pas déclaré. Sur un écran qu'un
  // certificateur peut ouvrir, l'alerte l'amène à une conclusion fausse et
  // défavorable. Et deux faux positifs en critique apprennent à ignorer le
  // niveau critique — le jour où une vraie alerte tombe, elle se noie.
  const nda = await getQualiopiConfig("nda_numero");
  if (typeof nda !== "string" || nda.trim() === "") return [];

  const anneeDeposee = await getQualiopiConfig("bpf_annee_deposee");
  const bpfDepose = typeof anneeDeposee === "number" && anneeDeposee >= anneeBpf;
  if (bpfDepose) return [];

  // Seuils BPF (dates légales françaises DREETS — fixées par décret, pas configurables)
  const avrilThreshold = new Date(`${annee}-04-01`);
  const maiThreshold = new Date(`${annee}-05-01`);
  const mai24Threshold = new Date(`${annee}-05-24`);
  const mai31Threshold = new Date(`${annee}-05-31`);

  if (now >= mai31Threshold) {
    return [
      {
        code: "bpf_en_retard",
        niveau: "critique",
        titre: "Bilan Pédagogique et Financier en retard",
        message: `Le BPF ${anneeBpf} aurait dû être déposé avant le 31 mai. Régularisation urgente auprès de la DREETS.`,
      },
    ];
  }
  if (now >= mai24Threshold) {
    return [
      {
        code: "bpf_a_deposer_j7",
        niveau: "critique",
        titre: "Bilan Pédagogique et Financier à déposer (J-7)",
        message: `Le BPF ${anneeBpf} doit être déposé avant le 31 mai (dans ≤7 jours).`,
      },
    ];
  }
  if (now >= maiThreshold) {
    return [
      {
        code: "bpf_a_deposer_j30",
        niveau: "important",
        titre: "Bilan Pédagogique et Financier à déposer (J-30)",
        message: `Le BPF ${anneeBpf} doit être déposé avant le 31 mai (dans ≤30 jours).`,
      },
    ];
  }
  if (now >= avrilThreshold) {
    return [
      {
        code: "bpf_a_deposer_j60",
        niveau: "info",
        titre: "Bilan Pédagogique et Financier à déposer (J-60)",
        message: `Le BPF ${anneeBpf} doit être déposé avant le 31 mai. Préparez vos données.`,
      },
    ];
  }

  return [];
}

/** R10 — Veille inactive depuis > 45 jours. */
async function regleVeilleInactive(now: Date): Promise<AlerteCandidate[]> {
  const threshold = daysAgo(45, now);
  const derniere = await prisma.veille.findFirst({
    orderBy: { dateVeille: "desc" },
    select: { dateVeille: true },
  });
  if (!derniere || derniere.dateVeille <= threshold) {
    const msgDate = derniere
      ? `Dernière entrée : ${derniere.dateVeille.toLocaleDateString("fr-FR")}.`
      : "Aucune entrée de veille enregistrée.";
    return [
      {
        code: "veille_inactive_j45",
        niveau: "important",
        titre: "Aucune entrée de veille depuis 45 jours",
        message: `La veille réglementaire/pédagogique n'a pas été mise à jour depuis plus de 45 jours. ${msgDate} Obligation Qualiopi (ind.23/24/25).`,
      },
    ];
  }
  return [];
}

/** R11 — CV formateur périmé : cvUploadedAt > 12 mois pour formateur actif. */
async function regleCvFormateurPerime(now: Date): Promise<AlerteCandidate[]> {
  const threshold = new Date(now);
  threshold.setFullYear(threshold.getFullYear() - 1);

  const formateurs = await prisma.trainer.findMany({
    where: {
      actif: true,
      OR: [{ cvUploadedAt: { lt: threshold } }, { cvUploadedAt: null }],
    },
    select: { id: true, nom: true, prenom: true, cvUploadedAt: true },
  });
  return formateurs.map((f) => ({
    code: "cv_formateur_perime",
    niveau: "important" as AlerteNiveau,
    titre: "CV formateur non mis à jour depuis 12 mois",
    message: `Le CV de ${f.prenom} ${f.nom} ${
      f.cvUploadedAt
        ? `date du ${f.cvUploadedAt.toLocaleDateString("fr-FR")} (>12 mois)`
        : "n'a jamais été uploadé"
    }. Mise à jour requise.`,
    cibleType: "Trainer",
    cibleId: f.id,
  }));
}

/** R12 — Sous-traitants (SousTraitant OF) : aucun champ qualiopi_validite dans le modèle
 *  → on vérifie la date de vérification data.gouv.fr (verifieDataGouvAt) comme proxy.
 *  Si null ou > 12 mois → alerte. Modèle SousTraitant n'a pas de date d'expiration Qualiopi
 *  explicite dans le schéma T15, on alerte sur les sous-traitants actifs non vérifiés.
 *  Note: les Trainers sous-traitants individuels ont sousTraitantVerifieAt.
 */
async function regleSousTraitantsQualiopi(now: Date): Promise<AlerteCandidate[]> {
  const alertes: AlerteCandidate[] = [];

  // Trainers sous-traitants actifs avec date de vérification périmée (proxy Qualiopi)
  const trainersST = await prisma.trainer.findMany({
    where: { actif: true, statut: "sous_traitant" },
    select: { id: true, nom: true, prenom: true, sousTraitantVerifieAt: true },
  });

  // 🔴 Vérification E2E 2026-07-26 — faux positif à 100 %, niveau CRITIQUE.
  // `sousTraitantVerifieAt` est la date à laquelle la vérification data.gouv.fr
  // a été FAITE (schema.prisma) — donc une date PASSÉE. La règle la comparait à
  // `now + 60 j` puis calculait `verifieAt - now`, toujours ≤ 0 : un
  // sous-traitant vérifié hier était déclaré « expiré ». La preuve de conformité
  // servait à conclure au manquement.
  //
  // Sémantique correcte, conforme au commentaire de tête de la règle : une
  // vérification vaut 12 mois à compter du jour où elle a été faite.
  const VALIDITE_MOIS = 12;
  const perime = daysAgo(365, now); // vérification trop ancienne → expirée
  const bientotPerime = daysAgo(365 - 60, now); // expire sous 60 jours

  for (const t of trainersST) {
    if (!t.sousTraitantVerifieAt) {
      alertes.push({
        code: "sous_traitant_qualiopi_expire",
        niveau: "critique",
        titre: "Qualiopi sous-traitant expiré (sessions futures en cours)",
        message: `Le formateur sous-traitant ${t.prenom} ${t.nom} n'a jamais été vérifié (aucune date de vérification).`,
        cibleType: "Trainer",
        cibleId: t.id,
      });
    } else if (t.sousTraitantVerifieAt <= perime) {
      alertes.push({
        code: "sous_traitant_qualiopi_expire",
        niveau: "critique",
        titre: "Qualiopi sous-traitant expiré (sessions futures en cours)",
        message: `La vérification Qualiopi du formateur sous-traitant ${t.prenom} ${t.nom} date du ${t.sousTraitantVerifieAt.toLocaleDateString("fr-FR")} : elle a plus de ${VALIDITE_MOIS} mois.`,
        cibleType: "Trainer",
        cibleId: t.id,
      });
    } else if (t.sousTraitantVerifieAt <= bientotPerime) {
      const joursRestants = Math.ceil(
        (t.sousTraitantVerifieAt.getTime() - perime.getTime()) / (24 * 60 * 60 * 1000),
      );
      alertes.push({
        code: "sous_traitant_qualiopi_expire_j60",
        niveau: "important",
        titre: "Qualiopi sous-traitant expire dans 60 jours",
        message: `La vérification Qualiopi du formateur sous-traitant ${t.prenom} ${t.nom} (du ${t.sousTraitantVerifieAt.toLocaleDateString("fr-FR")}) atteint ${VALIDITE_MOIS} mois dans ${joursRestants} jours.`,
        cibleType: "Trainer",
        cibleId: t.id,
      });
    }
  }

  return alertes;
}

/**
 * R12 bis — Vigilance sous-traitance : contrat-cadre, RC pro, vérification annuelle.
 *
 * Couvre les DEUX natures d'intervenant externe — l'organisme (`SousTraitant`)
 * et la personne physique (`Trainer` avec `statut: "sous_traitant"`). La règle
 * R12 ne surveillait que la seconde ; le moteur de conformité ne comptait que la
 * première. Chacune avait donc son angle mort. [2026-08-03]
 *
 * ⚠️ Les seuils suivent la procédure de sous-traitance signée le 03/08 :
 *   - contrat-cadre → CRITIQUE : sans lui l'intervenant n'est pas compté conforme
 *     (off.27), quelles que soient ses autres pièces ;
 *   - RC pro absente → IMPORTANT, jamais critique : elle n'est pas exigée à
 *     l'entrée (§ 4.2), et un critique permanent sur un état accepté
 *     apprendrait à ignorer les critiques ;
 *   - RC pro expirée → CRITIQUE : elle existait, elle est tombée ;
 *   - vérification annuelle → rappel 30 jours avant l'échéance (art. 8).
 */
async function regleVigilanceSousTraitance(now: Date): Promise<AlerteCandidate[]> {
  const alertes: AlerteCandidate[] = [];
  const dans60j = daysFromNow(60, now);
  const dans30j = daysFromNow(30, now);

  const [organismes, formateurs] = await Promise.all([
    prisma.sousTraitant.findMany({
      where: { actif: true },
      select: {
        id: true,
        nom: true,
        contratSigneAt: true,
        rcProEcheanceAt: true,
        rcProAttestationUrl: true,
        prochaineVerifAt: true,
      },
    }),
    prisma.trainer.findMany({
      where: { actif: true, statut: "sous_traitant" },
      select: {
        id: true,
        nom: true,
        prenom: true,
        sousTraitantContratSigneAt: true,
        rcProEcheanceAt: true,
        rcProAttestationUrl: true,
        sousTraitantProchaineVerifAt: true,
      },
    }),
  ]);

  /** Les deux natures traitées par le même code : une divergence de règle entre
   *  elles serait invisible et se paierait en audit. */
  const cibles = [
    ...organismes.map((o) => ({
      cibleType: "SousTraitant" as const,
      cibleId: o.id,
      libelle: o.nom,
      contratSigneAt: o.contratSigneAt,
      rcProEcheanceAt: o.rcProEcheanceAt,
      rcProAttestationUrl: o.rcProAttestationUrl,
      prochaineVerifAt: o.prochaineVerifAt,
    })),
    ...formateurs.map((t) => ({
      cibleType: "Trainer" as const,
      cibleId: t.id,
      libelle: `${t.prenom} ${t.nom}`.trim(),
      contratSigneAt: t.sousTraitantContratSigneAt,
      rcProEcheanceAt: t.rcProEcheanceAt,
      rcProAttestationUrl: t.rcProAttestationUrl,
      prochaineVerifAt: t.sousTraitantProchaineVerifAt,
    })),
  ];

  for (const c of cibles) {
    if (c.contratSigneAt === null) {
      alertes.push({
        code: "sous_traitant_contrat_cadre_manquant",
        niveau: "critique",
        titre: "Sous-traitant sans contrat-cadre signé",
        message: `${c.libelle} est référencé comme sous-traitant sans contrat-cadre signé : il n'est pas compté comme conforme (indicateur 27) et ne devrait pas se voir confier de mission.`,
        cibleType: c.cibleType,
        cibleId: c.cibleId,
      });
    }

    // `?.` volontaire : le fail-soft par règle avale les exceptions, donc une
    // valeur absente ferait taire TOUTE la vigilance sous-traitance sans bruit.
    if (!c.rcProAttestationUrl?.trim()) {
      alertes.push({
        code: "sous_traitant_rc_pro_absente",
        niveau: "important",
        titre: "Sous-traitant sans attestation RC pro",
        message: `${c.libelle} n'a pas fourni d'attestation de responsabilité civile professionnelle. Elle n'est pas exigée à l'entrée, mais AXION IA reste responsable devant le client de la bonne exécution des actions sous-traitées.`,
        cibleType: c.cibleType,
        cibleId: c.cibleId,
      });
    } else if (c.rcProEcheanceAt !== null && c.rcProEcheanceAt <= now) {
      alertes.push({
        code: "sous_traitant_rc_pro_expiree",
        niveau: "critique",
        titre: "Attestation RC pro sous-traitant expirée",
        message: `L'attestation RC pro de ${c.libelle} a expiré le ${c.rcProEcheanceAt.toLocaleDateString("fr-FR")}. Elle avait été fournie et acceptée : demander le renouvellement avant toute nouvelle mission.`,
        cibleType: c.cibleType,
        cibleId: c.cibleId,
      });
    } else if (c.rcProEcheanceAt !== null && c.rcProEcheanceAt <= dans60j) {
      alertes.push({
        code: "sous_traitant_rc_pro_expire_j60",
        niveau: "important",
        titre: "Attestation RC pro sous-traitant expire dans 60 jours",
        message: `L'attestation RC pro de ${c.libelle} expire le ${c.rcProEcheanceAt.toLocaleDateString("fr-FR")}.`,
        cibleType: c.cibleType,
        cibleId: c.cibleId,
      });
    }

    if (c.prochaineVerifAt !== null && c.prochaineVerifAt <= dans30j) {
      alertes.push({
        code: "sous_traitant_verification_annuelle_due",
        niveau: "important",
        titre: "Vérification annuelle d'un sous-traitant à effectuer",
        message: `Les pièces de ${c.libelle} (NDA, assurance, CV) sont à revérifier avant le ${c.prochaineVerifAt.toLocaleDateString("fr-FR")} — article 8 de la procédure de sous-traitance.`,
        cibleType: c.cibleType,
        cibleId: c.cibleId,
      });
    }
  }

  // ── Article 8 : tenir compte des incidents à la reconduction ───────────────
  //
  // Sans ce bloc, le registre d'incidents existerait sans que rien ne le lise —
  // Will ne verrait un formateur défaillant qu'en ouvrant sa fiche, c'est-à-dire
  // au moment où il vient précisément de décider de l'affecter.
  //
  // 🔴 Niveau « important », JAMAIS « critique » : cette alerte INFORME, elle
  // n'interdit pas. Un formateur qui a fait tomber deux sessions peut rester le
  // bon choix pour une mission donnée, et l'arbitrage revient à Will (même
  // logique que la RC pro non bloquante).
  const faitsBloquants = await prisma.incident.groupBy({
    by: ["trainerId", "sousTraitantId"],
    where: {
      dateIncident: { gte: daysFromNow(-730, now) },
      faitIntervenant: { in: ["annulation_tardive", "desistement"] },
      OR: [{ trainerId: { not: null } }, { sousTraitantId: { not: null } }],
    },
    _count: { _all: true },
  });

  const libelleParCible = new Map(cibles.map((c) => [`${c.cibleType}:${c.cibleId}`, c.libelle]));

  for (const groupe of faitsBloquants) {
    if (groupe._count._all < 2) continue;

    const cibleType = groupe.trainerId !== null ? ("Trainer" as const) : ("SousTraitant" as const);
    const cibleId = groupe.trainerId ?? groupe.sousTraitantId;
    if (cibleId === null) continue;

    // Un intervenant devenu inactif n'est plus dans `cibles` : ne pas alerter sur
    // quelqu'un qu'on ne peut plus affecter de toute façon.
    const libelle = libelleParCible.get(`${cibleType}:${cibleId}`);
    if (libelle === undefined) continue;

    alertes.push({
      code: "sous_traitant_incidents_repetes",
      niveau: "important",
      titre: "Intervenant externe : incidents répétés",
      message: `${libelle} a fait tomber ${groupe._count._all} sessions en 24 mois (annulation tardive ou désistement). À prendre en compte lors de la reconduction — article 8 de la procédure de sous-traitance.`,
      cibleType,
      cibleId,
    });
  }

  return alertes;
}

/** R13 — OPCO sans accord J-7 + OPCO formation démarrée sans accord. */
async function regleOpco(now: Date): Promise<AlerteCandidate[]> {
  const j7 = daysFromNow(7, now);
  const alertes: AlerteCandidate[] = [];

  // Sessions planifiées dans 7 jours sans accord OPCO
  const sansAccordJ7 = await prisma.trainingSession.findMany({
    where: {
      statut: "planifiee",
      dateDebut: { lte: j7, gt: now },
      opcoStatut: "non_demande",
      // 🔴 Vérification E2E 2026-07-26 — même défaut que F56, dans la MÊME
      // fonction, sur la requête d'à côté : `non_demande` est la valeur par
      // défaut du schéma, donc toute session à J-7 qu'aucun OPCO ne finance
      // levait « sans accord OPCO ». La garde est identique à celle du bloc
      // ci-dessous.
      OR: [{ opcoSubrogation: true }, { dossiersFinancement: { some: {} } }],
    },
    select: { id: true, numero: true, dateDebut: true },
  });
  for (const s of sansAccordJ7) {
    alertes.push({
      code: "opco_sans_accord",
      niveau: "important",
      titre: "Session dans 7 jours sans accord OPCO",
      message: `La session ${s.numero} démarre le ${s.dateDebut.toLocaleDateString("fr-FR")} sans accord OPCO (statut : non demandé).`,
      cibleType: "TrainingSession",
      cibleId: s.id,
    });
  }

  // Sessions démarrées sans accord OPCO.
  //
  // 🔴 F56 — `opcoStatut` vaut `non_demande` PAR DÉFAUT (schema.prisma). Filtrer
  // dessus seul faisait donc lever une alerte CRITIQUE « formation démarrée sans
  // accord OPCO » sur TOUTE session passée en `en_cours`, y compris celles qu'aucun
  // OPCO ne finance — vérifié en production : 0 dossier de financement,
  // `opcoSubrogation = false`, et l'alerte tombait quand même.
  //
  // Un OPCO n'est concerné que si un dossier de financement existe, ou si la
  // subrogation de paiement a été demandée. Sans l'un des deux, il n'y a pas
  // d'accord à obtenir, donc pas de manquement.
  const demarreeSansAccord = await prisma.trainingSession.findMany({
    where: {
      statut: "en_cours",
      dateDebut: { lte: now },
      opcoStatut: { in: ["non_demande", "demande_en_cours"] },
      OR: [{ opcoSubrogation: true }, { dossiersFinancement: { some: {} } }],
    },
    select: { id: true, numero: true },
  });
  for (const s of demarreeSansAccord) {
    alertes.push({
      code: "opco_formation_demarree_sans_accord",
      niveau: "critique",
      titre: "Formation démarrée sans accord OPCO",
      message: `La session ${s.numero} a démarré sans accord OPCO définitif.`,
      cibleType: "TrainingSession",
      cibleId: s.id,
    });
  }

  return alertes;
}

/** R14 — Convention tripartite manquante : opcoSubrogation = true + non signée + J-3. */
async function regleConventionTripartite(now: Date): Promise<AlerteCandidate[]> {
  const j3 = daysFromNow(3, now);
  const sessions = await prisma.trainingSession.findMany({
    where: {
      statut: "planifiee",
      opcoSubrogation: true,
      conventionTripartiteSigneeAt: null,
      dateDebut: { lte: j3 },
    },
    select: { id: true, numero: true, dateDebut: true },
  });
  return sessions.map((s) => ({
    code: "convention_tripartite_manquante",
    niveau: "critique" as AlerteNiveau,
    titre: "Convention tripartite manquante (subrogation OPCO)",
    message: `La session ${s.numero} (démarrage le ${s.dateDebut.toLocaleDateString("fr-FR")}) est en subrogation OPCO mais la convention tripartite n'est pas signée.`,
    cibleType: "TrainingSession",
    cibleId: s.id,
  }));
}

/**
 * R15 — Factures impayées : ESCALADE J+60 uniquement.
 *
 * 🔴 Audit certification 2026-07-26 (F59). La règle ne regardait que le statut
 * `emise`. Or une facture partiellement réglée reste due pour son solde — et
 * c'est précisément le cas du RESTE À CHARGE : l'OPCO verse sa part, la facture
 * bascule en `partiellement_payee`, et si l'entreprise ne règle jamais la
 * sienne, aucune alerte ne tombait. Le trou portait exactement sur le scénario
 * de financement mixte, le plus fréquent en formation professionnelle.
 *
 * 🔴 2026-08-02 — la règle était en réalité du CODE MORT, et le correctif F59
 * n'avait rien pu changer à cela. Le filtre omettait `en_retard`, alors que le
 * cron de 06:30 UTC (`handleFacturesRetard`) a déjà basculé dans ce statut TOUTE
 * facture échue avant que le cron d'alertes de 07:00 UTC ne s'exécute. Le `where`
 * ne pouvait donc plus ramener une seule ligne : une facture échue depuis 30 ou
 * 60 jours est, par construction, `en_retard`. Le filtre part désormais du SSOT
 * `STATUTS_FACTURE_OUVERTE`, qui inclut les trois statuts ouverts.
 *
 * ── Division du travail entre relances et alertes (anti-doublon) ─────────────
 *
 *   J1 / J15 / J30 → `RelanceProposee` : une ACTION à faire, dans le hub
 *                    facturation, avec son bouton « Envoyer la relance ».
 *   J60            → alerte critique : une ESCALADE, parce qu'aucun palier de
 *                    relance n'existe au-delà de J30 — plus personne ne
 *                    proposerait rien, et la créance vieillirait en silence.
 *
 * L'émission de `facture_impayee_j30` est donc SUPPRIMÉE : elle doublait la
 * relance J30 déjà proposée pour le même fait. Deux signaux concurrents sur un
 * même impayé, c'est deux cycles de vie à tenir — l'admin envoie la relance, la
 * proposition passe `envoyee`, et l'alerte reste ouverte à côté sans plus rien
 * signifier. Le code `facture_impayee_j30` reste au CATALOGUE (et lui seul
 * permet aux alertes déjà en base de s'auto-résoudre) : voir `catalogue.ts`.
 */
async function regleFacturesImpayees(now: Date): Promise<AlerteCandidate[]> {
  const j60 = daysAgo(60, now);
  const alertes: AlerteCandidate[] = [];

  const factures = await prisma.factureFormation.findMany({
    where: {
      statut: { in: [...STATUTS_FACTURE_OUVERTE] },
      echeanceAt: { not: null, lte: j60 },
      // Un avoir n'est pas une créance : il crédite le client.
      avoirDeId: null,
    },
    select: { id: true, numero: true, echeanceAt: true, statut: true },
  });

  for (const f of factures) {
    if (!f.echeanceAt) continue;
    // Garde applicative doublant le `where` : le filtre SQL est l'autorité, mais
    // la règle ne doit jamais dépendre de lui seul pour rester juste.
    if (f.echeanceAt > j60) continue;
    alertes.push({
      code: "facture_impayee_j60",
      niveau: "critique",
      titre: "Facture impayée depuis +60 jours",
      message: `${f.statut === "partiellement_payee" ? `Le solde de la facture ${f.numero} est impayé` : `La facture ${f.numero} est impayée`} depuis plus de 60 jours (échéance : ${f.echeanceAt.toLocaleDateString("fr-FR")}). Aucun palier de relance automatique n'existe au-delà de 30 jours : cette créance demande une décision (mise en demeure, échéancier, provision).`,
      cibleType: "FactureFormation",
      cibleId: f.id,
    });
  }

  return alertes;
}

/**
 * R15 bis — Facture émise SANS date d'échéance (filet de sécurité).
 *
 * 🔴 Le trou structurel du recouvrement. `handleFacturesRetard` sélectionne les
 * factures sur `echeanceAt < now` ; aucune comparaison SQL n'étant vraie pour
 * NULL, une facture sans échéance n'était jamais candidate — donc jamais
 * `en_retard`, jamais relancée, jamais alertée, et absente du prévisionnel de
 * trésorerie faute de mois de rattachement. La créance vieillissait sans laisser
 * la moindre trace à l'écran.
 *
 * Le cron répare désormais ces lignes de lui-même. Cette règle reste néanmoins
 * nécessaire pour deux raisons :
 *   1. elle couvre la fenêtre entre la création de la facture et le passage
 *      quotidien du cron ;
 *   2. elle DÉNONCE un chemin de création défaillant — si l'alerte revient, un
 *      émetteur a de nouveau omis la colonne, et la réparation automatique
 *      masquerait le défaut sans elle.
 *
 * Une alerte PAR FACTURE (et non un compteur global) : la résolution auto suit
 * la cible, et l'admin doit pouvoir ouvrir la pièce concernée.
 */
async function regleFactureSansEcheance(): Promise<AlerteCandidate[]> {
  const factures = await prisma.factureFormation.findMany({
    where: {
      statut: { in: [...STATUTS_FACTURE_OUVERTE] },
      echeanceAt: null,
      // Un avoir ne porte pas d'échéance de paiement : il crédite, il ne réclame
      // rien. L'y attendre produirait une alerte permanente et insoluble.
      avoirDeId: null,
    },
    select: { id: true, numero: true, emiseAt: true, echeanceAt: true },
  });

  return (
    factures
      // Garde applicative doublant le `where` : le filtre SQL est l'autorité, mais
      // une règle qui n'en dépend QUE de lui n'est vérifiable par aucun test.
      .filter((f) => f.echeanceAt === null)
      .map((f) => ({
        code: "facture_sans_echeance",
        niveau: "important" as AlerteNiveau,
        titre: "Facture émise sans date d'échéance",
        message: `La facture ${f.numero}${f.emiseAt !== null ? ` (émise le ${f.emiseAt.toLocaleDateString("fr-FR")})` : ""} n'a pas de date d'échéance : elle est INVISIBLE du circuit de relance tant que celle-ci manque — jamais marquée en retard, jamais proposée à la relance, absente du prévisionnel de trésorerie. Renseignez l'échéance sur la fiche facture (le passage quotidien du cron la reconstitue sinon à partir de la date d'émission et du délai du client).`,
        cibleType: "FactureFormation",
        cibleId: f.id,
      }))
  );
}

/**
 * R15 ter — Relance ENVOYÉE restée sans effet depuis plus de 15 jours.
 *
 * Demande explicite du propriétaire : « des alertes pour me dire les relances
 * passées ». Envoyer une relance n'est pas un résultat. Sans ce signal, une
 * relance partie devient une case cochée : la proposition disparaît de l'écran
 * « à traiter », et plus rien ne rappelle qu'elle n'a rien produit — jusqu'au
 * palier suivant, qui ne vient que si le cron le propose.
 *
 * Condition retenue : relance `envoyee` il y a plus de 15 jours, facture
 * toujours ouverte, et AUCUN encaissement enregistré depuis l'envoi. Quinze
 * jours = le délai au bout duquel un client de bonne foi a payé ou répondu.
 *
 * ⚠️ « Aucun encaissement depuis l'envoi » et non « facture non soldée » : un
 * versement partiel arrivé après la relance prouve qu'elle a porté, même si le
 * solde reste dû. Alerter alors reviendrait à ignorer la réponse du client.
 *
 * Une seule alerte par FACTURE (cible = la facture, pas la relance) : deux
 * paliers restés sans effet sur la même créance sont un seul problème.
 */
async function regleRelanceSansEffet(now: Date): Promise<AlerteCandidate[]> {
  const j15 = daysAgo(15, now);

  const relances = await prisma.relanceProposee.findMany({
    where: {
      statut: "envoyee",
      traiteeAt: { not: null, lte: j15 },
      factureFormationId: { not: null },
      factureFormation: { statut: { in: [...STATUTS_FACTURE_OUVERTE] }, avoirDeId: null },
    },
    orderBy: { traiteeAt: "desc" },
    select: {
      palier: true,
      traiteeAt: true,
      factureFormationId: true,
      factureFormation: {
        select: {
          id: true,
          numero: true,
          payments: { where: { status: "succeeded" }, select: { paidAt: true } },
        },
      },
    },
  });

  const vues = new Set<string>();
  const alertes: AlerteCandidate[] = [];
  for (const r of relances) {
    const f = r.factureFormation;
    if (f === null || r.traiteeAt === null) continue;
    // Garde applicative doublant le `where` (les mocks de test ignorent le SQL).
    if (r.traiteeAt > j15) continue;
    // Une seule alerte par facture — `orderBy traiteeAt desc` garantit qu'on
    // retient la relance la PLUS RÉCENTE, celle dont l'absence d'effet compte.
    if (vues.has(f.id)) continue;

    const encaissementDepuis = f.payments.some(
      (p) => p.paidAt !== null && p.paidAt >= (r.traiteeAt as Date),
    );
    if (encaissementDepuis) continue;

    vues.add(f.id);
    alertes.push({
      code: "relance_sans_effet",
      niveau: "important",
      titre: "Relance envoyée sans effet depuis +15 jours",
      message: `La relance « ${libellePalier(r.palier)} » de la facture ${f.numero}, envoyée le ${r.traiteeAt.toLocaleDateString("fr-FR")}, n'a donné lieu à aucun encaissement depuis. Passez au palier suivant depuis le hub facturation, ou tranchez (échéancier, mise en demeure, recouvrement).`,
      cibleType: "FactureFormation",
      cibleId: f.id,
    });
  }

  return alertes;
}

/**
 * Suivi des dossiers de financement (OPCO / France Travail).
 *
 * 🔴 2026-07-31 — `DossierFinancement.echeanceFinanceurAt` existait au schéma,
 * avec son commentaire (« les OPCO paient à 30-60 j »), et RIEN ne le lisait.
 * Même famille de défaut que les refs des circuits de signature : la donnée
 * est saisie, aucun consommateur. Conséquence : un financeur en retard de
 * paiement ou un dossier envoyé jamais instruit ne déclenchaient AUCUN signal —
 * le suivi reposait sur la mémoire de l'admin.
 *
 * Deux règles :
 *  1. `dossier_financement_sans_reponse` — statut `envoye` depuis +30 j sans
 *     accord ni refus. 30 j = le délai d'instruction usuel d'un OPCO ; au-delà,
 *     relancer est légitime et attendre en silence fait perdre le financement.
 *  2. `financeur_paiement_en_retard` — accord obtenu (voire facturé), échéance
 *     de paiement saisie et DÉPASSÉE, paiement non reçu. Critique : c'est de la
 *     trésorerie due, et les OPCO ne relancent jamais d'eux-mêmes.
 *
 * ⚠️ Distinct de `facture_impayee_j30/j60` : celles-ci partent de la FACTURE et
 * de son échéance propre. Un dossier subrogé peut être en retard AVANT toute
 * facture (accord reçu, échéance passée) — c'est précisément le cas que la
 * facturation ne voit pas.
 */
/**
 * Devis envoyé sans réponse — refonte console phase 1 (2026-08-01).
 *
 * 🔴 Trou trouvé en vérifiant le plan « À traiter » avec Will : un devis
 * `envoye` pouvait dormir ÉTERNELLEMENT — aucune règle ne le surveillait,
 * contrairement aux dossiers OPCO (+30 j) et aux factures. Le client qui ne
 * répond pas est pourtant la relance commerciale la plus banale qui soit.
 *
 * 7 jours : le délai de relance commerciale usuel, plus court que les 30 j
 * d'un dossier OPCO (une administration répond en semaines, un client en jours).
 */
async function regleDevisSansReponse(now: Date): Promise<AlerteCandidate[]> {
  const devisDormants = await prisma.devis.findMany({
    where: { statut: "envoye", sentAt: { not: null, lte: daysAgo(7, now) } },
    select: {
      id: true,
      numero: true,
      sentAt: true,
      client: { select: { raisonSociale: true } },
    },
  });
  const alertes: AlerteCandidate[] = [];
  for (const d of devisDormants) {
    if (!d.sentAt) continue;
    alertes.push({
      code: "devis_sans_reponse",
      niveau: "important",
      titre: "Devis envoyé sans réponse depuis +7 jours",
      message: `Le devis ${d.numero} (${d.client.raisonSociale}) est parti le ${d.sentAt.toLocaleDateString("fr-FR")} sans acceptation ni refus : relancer le client.`,
      cibleType: "Devis",
      cibleId: d.id,
    });
  }
  return alertes;
}

/**
 * Signature qui traîne sur une pièce émise — refonte console phase 1
 * (2026-08-01), le second trou trouvé avec le devis dormant.
 *
 * Un lien de signature émis mais jamais signé (`en_attente`), ou une pièce
 * signée d'un seul côté (`partielle`), n'alertait personne : il fallait ouvrir
 * la bonne fiche pour s'en apercevoir. Or une convention non signée à J-2 de
 * la formation est exactement ce qu'un contrôle relève.
 *
 * ⚠️ `updatedAt` comme horloge : la colonne bouge à chaque événement de
 * signature (statut dérivé recalculé). 7 jours SANS mouvement = ça traîne.
 */
async function regleSignatureEnAttente(now: Date): Promise<AlerteCandidate[]> {
  const pieces = await prisma.documentGenere.findMany({
    where: {
      statutSignature: { in: ["en_attente", "partielle"] },
      updatedAt: { lte: daysAgo(7, now) },
    },
    select: { id: true, type: true, numero: true, statutSignature: true, updatedAt: true },
  });
  return pieces.map((p) => ({
    code: p.statutSignature === "partielle" ? "signature_contreseing_du" : "signature_en_attente",
    niveau: "important" as const,
    titre:
      p.statutSignature === "partielle"
        ? "Pièce signée d'un seul côté depuis +7 jours"
        : "Lien de signature sans signature depuis +7 jours",
    message:
      p.statutSignature === "partielle"
        ? `La pièce ${p.numero} (${p.type}) porte une signature depuis le ${p.updatedAt.toLocaleDateString("fr-FR")} mais il manque la contrepartie : contresigner ou relancer l'autre partie.`
        : `La pièce ${p.numero} (${p.type}) attend sa première signature depuis le ${p.updatedAt.toLocaleDateString("fr-FR")} : relancer le signataire ou réémettre le lien.`,
    cibleType: "DocumentGenere",
    cibleId: p.id,
  }));
}

/**
 * Sélection Prisma partagée pour résoudre un libellé humain de dossier de
 * financement (voir `libelleDossier` ci-dessous) — factorisée pour ne pas
 * dupliquer les 4 relations entre les deux requêtes de `regleDossiersFinancement`.
 */
const SELECT_DOSSIER_LIBELLE = {
  client: { select: { raisonSociale: true } },
  trainingSession: {
    select: { numero: true, titreSession: true, client: { select: { raisonSociale: true } } },
  },
  coachingContract: {
    select: { numero: true, client: { select: { raisonSociale: true } } },
  },
  auditMission: {
    select: { numero: true, titre: true, client: { select: { raisonSociale: true } } },
  },
  devis: {
    select: { numero: true, client: { select: { raisonSociale: true } } },
  },
} as const;

interface DossierPourLibelle {
  numeroDossierExterne: string | null;
  client: { raisonSociale: string } | null;
  trainingSession: {
    numero: string;
    titreSession: string;
    client: { raisonSociale: string } | null;
  } | null;
  coachingContract: { numero: string; client: { raisonSociale: string } | null } | null;
  auditMission: {
    numero: string;
    titre: string;
    client: { raisonSociale: string } | null;
  } | null;
  devis: { numero: string; client: { raisonSociale: string } | null } | null;
}

/**
 * Libellé humain d'un dossier de financement pour les messages d'alerte.
 *
 * 🔴 Audit du 2026-08-01 (défaut P1) — sans `numeroDossierExterne`, le message
 * retombait sur `d.id.slice(0, 8)`, un fragment d'UUID illisible pour Will.
 * `DossierFinancement` n'a pas de client obligatoire : le rattachement se fait
 * soit directement (`client`), soit via l'entité financée (session, contrat de
 * coaching, mission d'audit, devis) qui porte elle-même un client optionnel.
 * On descend cette chaîne de relations et on ne retombe sur un intitulé
 * générique que si AUCUNE d'elles n'est renseignée (cas jamais rencontré en
 * pratique, mais un dossier de financement orphelin de toute relation est
 * concevable en théorie — d'où ce filet documenté plutôt qu'un UUID inventé).
 */
function libelleDossier(d: DossierPourLibelle): string {
  if (d.numeroDossierExterne) return d.numeroDossierExterne;
  if (d.client) return d.client.raisonSociale;
  if (d.trainingSession) {
    return (
      d.trainingSession.client?.raisonSociale ??
      `session ${d.trainingSession.numero} (${d.trainingSession.titreSession})`
    );
  }
  if (d.coachingContract) {
    return (
      d.coachingContract.client?.raisonSociale ?? `contrat de coaching ${d.coachingContract.numero}`
    );
  }
  if (d.auditMission) {
    return d.auditMission.client?.raisonSociale ?? `mission d'audit « ${d.auditMission.titre} »`;
  }
  if (d.devis) {
    return d.devis.client?.raisonSociale ?? `devis ${d.devis.numero}`;
  }
  return "dossier sans référence identifiable";
}

async function regleDossiersFinancement(now: Date): Promise<AlerteCandidate[]> {
  const alertes: AlerteCandidate[] = [];

  // 1. Envoyé sans réponse depuis +30 jours.
  const sansReponse = await prisma.dossierFinancement.findMany({
    where: { statut: "envoye", envoyeAt: { not: null, lte: daysAgo(30, now) } },
    select: {
      id: true,
      financeurNom: true,
      numeroDossierExterne: true,
      envoyeAt: true,
      ...SELECT_DOSSIER_LIBELLE,
    },
  });
  for (const d of sansReponse) {
    if (!d.envoyeAt) continue;
    alertes.push({
      code: "dossier_financement_sans_reponse",
      niveau: "important",
      titre: "Dossier de financement envoyé sans réponse depuis +30 jours",
      message: `Le dossier ${libelleDossier(d)} (${d.financeurNom ?? "financeur non nommé"}) est parti le ${d.envoyeAt.toLocaleDateString("fr-FR")} sans accord ni refus : relancer le financeur.`,
      cibleType: "DossierFinancement",
      cibleId: d.id,
    });
  }

  // 2. Échéance de paiement du financeur dépassée, paiement non reçu.
  const enRetard = await prisma.dossierFinancement.findMany({
    where: {
      statut: { in: ["accord_recu", "facture"] },
      echeanceFinanceurAt: { not: null, lte: now },
      paiementRecuAt: null,
    },
    select: {
      id: true,
      financeurNom: true,
      numeroDossierExterne: true,
      echeanceFinanceurAt: true,
      ...SELECT_DOSSIER_LIBELLE,
    },
  });
  for (const d of enRetard) {
    if (!d.echeanceFinanceurAt) continue;
    alertes.push({
      code: "financeur_paiement_en_retard",
      niveau: "critique",
      titre: "Paiement du financeur en retard (échéance dépassée)",
      message: `Le paiement du dossier ${libelleDossier(d)} (${d.financeurNom ?? "financeur non nommé"}) était attendu le ${d.echeanceFinanceurAt.toLocaleDateString("fr-FR")} et n'est pas reçu : relancer le financeur.`,
      cibleType: "DossierFinancement",
      cibleId: d.id,
    });
  }

  return alertes;
}

/**
 * Vigilance URSSAF des sous-traitants (art. L.8222-1) — demandé par Will le
 * 2026-08-01.
 *
 * L'attestation vaut 6 mois et devient obligatoire dès 5 000 € de cumul
 * annuel ; sans elle, l'OF est SOLIDAIREMENT responsable des cotisations
 * impayées du prestataire. La fiche formateur la signalait déjà en rouge —
 * mais il fallait OUVRIR la fiche pour le voir. Ici, elle remonte chaque matin.
 *
 * 🔴 Zéro logique dupliquée : seuil (`vigilanceRequise`), sélection de la
 * pièce (`trouverValide`) et péremption (`vigilancePerimee`) sont LES MÊMES
 * fonctions que la carte conformité de la fiche. La règle NDA voisine a montré
 * ce que coûte une réimplémentation locale : un faux positif à 100 % resté
 * critique pendant des semaines (cf. regleSousTraitantsQualiopi, 2026-07-26).
 */
async function regleVigilanceUrssaf(now: Date): Promise<AlerteCandidate[]> {
  const alertes: AlerteCandidate[] = [];

  const trainersST = await prisma.trainer.findMany({
    where: { actif: true, statut: "sous_traitant" },
    select: { id: true, nom: true, prenom: true },
  });
  if (trainersST.length === 0) return alertes;

  const annee = now.getFullYear();
  for (const t of trainersST) {
    const [documents, montantRetenuCents] = await Promise.all([
      listTrainerDocuments(t.id),
      cumulAnnuelFormateurCents(t.id, annee),
    ]);

    // Sous le seuil : aucune obligation, aucune alerte — un formateur à 800 €
    // de cumul n'a pas à fournir d'attestation.
    if (!vigilanceRequise("sous_traitant", montantRetenuCents, CONFORMITE_DEFAUTS)) continue;

    const nomComplet = `${t.prenom} ${t.nom}`.trim();
    const doc = trouverValide(documents, "attestation_vigilance_urssaf", now);

    if (vigilancePerimee(doc, now, CONFORMITE_DEFAUTS)) {
      alertes.push({
        code: doc === null ? "vigilance_urssaf_absente" : "vigilance_urssaf_perimee",
        niveau: "critique",
        titre:
          doc === null
            ? "Attestation de vigilance URSSAF absente (responsabilité solidaire)"
            : "Attestation de vigilance URSSAF périmée (responsabilité solidaire)",
        message:
          doc === null
            ? `Le sous-traitant ${nomComplet} a dépassé le seuil de ${CONFORMITE_DEFAUTS.seuilVigilanceCents / 100} € de cumul annuel sans attestation de vigilance URSSAF valide (art. L.8222-1) : la demander et la verser à sa fiche.`
            : `L'attestation de vigilance URSSAF de ${nomComplet} a plus de ${CONFORMITE_DEFAUTS.vigilanceValiditeMois} mois : en demander une nouvelle (art. L.8222-1, renouvellement semestriel).`,
        cibleType: "Trainer",
        cibleId: t.id,
      });
      continue;
    }

    // Préavis : l'attestation est valide mais atteint ses 6 mois sous 30 jours.
    if (doc !== null && doc.dateEmission !== null) {
      const expireLe = addMonths(doc.dateEmission, CONFORMITE_DEFAUTS.vigilanceValiditeMois);
      if (expireLe <= daysFromNow(30, now)) {
        const joursRestants = Math.max(
          0,
          Math.ceil((expireLe.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)),
        );
        alertes.push({
          code: "vigilance_urssaf_expire_j30",
          niveau: "important",
          titre: "Attestation de vigilance URSSAF à renouveler sous 30 jours",
          message: `L'attestation de vigilance URSSAF de ${nomComplet} atteint ses ${CONFORMITE_DEFAUTS.vigilanceValiditeMois} mois le ${expireLe.toLocaleDateString("fr-FR")} (dans ${joursRestants} jours) : demander le renouvellement dès maintenant.`,
          cibleType: "Trainer",
          cibleId: t.id,
        });
      }
    }
  }

  return alertes;
}

/** R16 — Demandes RGPD non traitées > 30 jours. */
async function regleRgpdSuppression(now: Date): Promise<AlerteCandidate[]> {
  const threshold = daysAgo(30, now);
  const demandes = await prisma.rgpdDemande.findMany({
    where: {
      type: "suppression",
      statut: "demandee",
      demandeAt: { lte: threshold },
    },
    select: { id: true, traineeId: true, demandeAt: true },
  });
  return demandes.map((d) => ({
    code: "suppression_rgpd_j30",
    niveau: "info" as AlerteNiveau,
    titre: "Demande de suppression RGPD non traitée depuis 30 jours",
    message: `Une demande de suppression RGPD (trainee ${d.traineeId}) est en attente depuis le ${d.demandeAt.toLocaleDateString("fr-FR")} (>30 jours).`,
    cibleType: "RgpdDemande",
    cibleId: d.id,
  }));
}

/** R17 — Convention de formation (L.6353-1) manquante avant démarrage (off.9⭐).
 *  Session planifiee dont dateDebut ∈ [now, now+5j] sans DocumentGenere convention. */
async function regleConventionFormation(now: Date): Promise<AlerteCandidate[]> {
  const limite = daysFromNow(5, now);
  const sessions = await prisma.trainingSession.findMany({
    where: {
      // 🔴 Constat F7, 2026-07-26 — la règle ne regardait QUE les sessions
      // `planifiee` démarrant dans les 5 jours. Une session DÉJÀ DÉMARRÉE sans
      // convention était donc parfaitement silencieuse, alors que c'est le cas
      // le plus grave : l'obligation est dépassée, plus seulement imminente.
      // Vérifié en production : `AXI-SESS-2026-001` est `en_cours` depuis le
      // 08/07, sans convention, et un certificat de réalisation a même été émis
      // — sans qu'aucune alerte ne se lève.
      //
      // Borne basse d'un an : sans elle, le premier passage du cron déverserait
      // une salve sur tout l'historique (piège déjà rencontré sur R03bis).
      statut: { in: ["planifiee", "en_cours", "realisee"] },
      dateDebut: { lte: limite, gte: daysAgo(365, now) },
      // 🔴 Vérification E2E 2026-07-26 — la règle n'acceptait que la convention.
      // Vendue à un particulier, la pièce exigée par le code du travail est un
      // CONTRAT de formation (L6353-3), type `contrat` : une session
      // parfaitement en règle levait quand même une alerte CRITIQUE
      // « Convention manquante ». La règle ne vérifiait pas quelle obligation
      // s'applique.
      documents: {
        none: { type: { in: ["convention", "convention_tripartite", "contrat"] } },
      },
    },
    select: { id: true, numero: true, dateDebut: true, statut: true },
  });
  return sessions.map((s) => {
    // Le message doit dire au lecteur où il en est : « à produire avant le
    // démarrage » et « la session a démarré sans » n'appellent pas la même
    // urgence, même si le niveau reste critique dans les deux cas.
    const dejaDemarree = s.statut !== "planifiee";
    const dateFr = s.dateDebut.toLocaleDateString("fr-FR");
    return {
      code: "convention_formation_manquante",
      niveau: "critique" as AlerteNiveau,
      titre: dejaDemarree
        ? "Session démarrée SANS convention de formation"
        : "Convention de formation manquante avant démarrage",
      message: dejaDemarree
        ? `La session ${s.numero} a démarré le ${dateFr} sans convention (L.6353-1) ni contrat de formation (L.6353-3). L'obligation n'est plus imminente, elle est dépassée : régulariser et documenter le retard (ind.9⭐).`
        : `Aucune convention (L.6353-1) ni contrat de formation (L.6353-3) n'est généré pour la session ${s.numero} (début le ${dateFr}). Obligatoire avant démarrage (ind.9⭐).`,
      cibleType: "TrainingSession",
      cibleId: s.id,
    };
  });
}

/** R18 (LOT 4) — Revue trimestrielle à réaliser (info, non bloquante — décision B4).
 *
 *  Gatée par la clé de config `revue_trimestrielle_activee` (défaut true).
 *  Le modèle RevueDirection n'a NI champ période NI titre/notes (une seule
 *  revue par année, `annee @unique`) → convention SANS migration : la cadence
 *  trimestrielle est considérée couverte si une revue de direction a été TENUE
 *  OU MISE À JOUR (dateRevue) depuis le début du trimestre précédent. En
 *  pratique : l'admin rouvre la revue de l'année chaque trimestre, met à jour
 *  `dateRevue` + décisions/plan d'actions, et l'alerte se résout (resolutionAuto).
 */
async function regleRevueTrimestrielle(now: Date): Promise<AlerteCandidate[]> {
  const activee = await getQualiopiConfig("revue_trimestrielle_activee").catch(() => false);
  if (activee !== true) return [];

  // Début du trimestre PRÉCÉDENT (heure locale serveur — granularité au jour,
  // suffisante pour une cadence trimestrielle).
  const trimestreCourant = Math.floor(now.getMonth() / 3); // 0..3
  let anneePrec = now.getFullYear();
  let trimestrePrec = trimestreCourant - 1;
  if (trimestrePrec < 0) {
    trimestrePrec = 3;
    anneePrec -= 1;
  }
  const debutTrimestrePrec = new Date(anneePrec, trimestrePrec * 3, 1);

  const revueRecente = await prisma.revueDirection.findFirst({
    where: { dateRevue: { gte: debutTrimestrePrec } },
    select: { id: true },
  });
  if (revueRecente !== null) return [];

  const labelTrimestrePrec = `T${trimestrePrec + 1} ${anneePrec}`;
  return [
    {
      code: "revue_trimestrielle_a_faire",
      niveau: "info",
      titre: "Revue trimestrielle à réaliser",
      message: `Aucune revue de direction tenue ou mise à jour depuis le trimestre ${labelTrimestrePrec}. Cadence trimestrielle non bloquante : mettez à jour la revue de l'année (date, décisions, plan d'actions) pour couvrir le trimestre.`,
    },
  ];
}

/** R21 — Barème OPCO en vigueur dont le relevé portail est périmé (> N mois). */
async function regleBaremeOpcoPerime(now: Date): Promise<AlerteCandidate[]> {
  const configVal = await getQualiopiConfig("bareme_opco_validite_mois").catch(() => 12);
  const mois = typeof configVal === "number" && configVal > 0 ? configVal : 12;

  const baremes = await listBaremesEnVigueur(now);
  return baremes
    .filter((b) => estBaremePerime(b.releveLe, mois, now))
    .map((b) => ({
      code: "bareme_opco_perime",
      niveau: "important" as AlerteNiveau,
      titre: "Barème OPCO à rafraîchir (relevé trop ancien)",
      message: `Le barème ${opcoLabel(b.opco)} ${
        b.releveLe
          ? `a été relevé le ${b.releveLe.toLocaleDateString("fr-FR")} (> ${mois} mois)`
          : "n'a pas de date de relevé"
      }. Vérifiez le portail OPCO et créez une nouvelle version si les plafonds ont changé.`,
      cibleType: "BaremeOpco",
      cibleId: b.id,
    }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Catalogue des règles
// ─────────────────────────────────────────────────────────────────────────────

type RegleFn = (now: Date) => Promise<AlerteCandidate[]>;

/** R-outbox — Des emails commerciaux attendent une validation manuelle.
 *
 *  Une corbeille de validation ne vaut que si quelqu'un l'ouvre. Sans ce
 *  signal, un devis « marqué envoyé » pouvait rester indéfiniment non expédié.
 *  Le seuil est à 1 : l'attente n'est pas un état normal, c'est une action due.
 */
async function regleEmailsEnAttente(): Promise<AlerteCandidate[]> {
  const n = await compterEnAttente();
  if (n === 0) return [];
  return [
    {
      code: "emails_en_attente_validation",
      niveau: "important",
      titre: "Des emails attendent votre validation",
      message: `${n} email${n > 1 ? "s" : ""} en attente dans la corbeille de validation. Tant qu'ils ne sont pas approuvés, rien ne part chez le client.`,
      cibleType: "EmailOutbox",
    },
  ];
}

const REGLES: Array<{ nom: string; fn: RegleFn }> = [
  { nom: "referent_handicap", fn: regleReferentHandicap },
  { nom: "responsable_qualite", fn: regleResponsableQualite },
  { nom: "reclamations_sans_reponse", fn: regleReclamationsSansReponse },
  { nom: "emargement_manquant", fn: regleEmargementManquant },
  { nom: "session_sans_formateur", fn: regleSessionSansFormateur },
  { nom: "session_bloquee_en_cours", fn: regleSessionBloqueeEnCours },
  { nom: "satisfaction_manquante", fn: regleSatisfactionManquante },
  { nom: "evaluation_acquis_manquante", fn: regleEvaluationAcquisManquante },
  { nom: "attestation_non_envoyee", fn: regleAttestationNonEnvoyee },
  { nom: "satisfaction_sous_seuil", fn: regleSatisfactionSousSeuil },
  { nom: "qualiopi_expiration", fn: regleQualiopiExpiration },
  { nom: "bpf", fn: regleBpf },
  { nom: "veille_inactive", fn: regleVeilleInactive },
  { nom: "emails_en_attente_validation", fn: regleEmailsEnAttente },
  { nom: "cv_formateur_perime", fn: regleCvFormateurPerime },
  { nom: "sous_traitants_qualiopi", fn: regleSousTraitantsQualiopi },
  { nom: "vigilance_sous_traitance", fn: regleVigilanceSousTraitance },
  { nom: "vigilance_urssaf", fn: regleVigilanceUrssaf },
  { nom: "opco", fn: regleOpco },
  { nom: "convention_tripartite", fn: regleConventionTripartite },
  { nom: "convention_formation", fn: regleConventionFormation },
  { nom: "factures_impayees", fn: regleFacturesImpayees },
  { nom: "facture_sans_echeance", fn: regleFactureSansEcheance },
  { nom: "relance_sans_effet", fn: regleRelanceSansEffet },
  { nom: "dossiers_financement", fn: regleDossiersFinancement },
  { nom: "devis_sans_reponse", fn: regleDevisSansReponse },
  { nom: "signatures_en_attente", fn: regleSignatureEnAttente },
  { nom: "rgpd_suppression", fn: regleRgpdSuppression },
  { nom: "revue_trimestrielle", fn: regleRevueTrimestrielle },
  { nom: "bareme_opco_perime", fn: regleBaremeOpcoPerime },
];

// ─────────────────────────────────────────────────────────────────────────────
// Point d'entrée public
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Évalue toutes les règles et retourne la liste des alertes candidates.
 *
 * Stub-aware : retourne [] si DATABASE_URL contient "stub.invalid".
 * Fail-soft par règle : une erreur de règle est loggée et ignorée.
 */
export async function evaluerAlertes(): Promise<AlerteCandidate[]> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    return [];
  }

  const now = new Date();
  const toutes: AlerteCandidate[] = [];

  for (const { nom, fn } of REGLES) {
    try {
      const candidates = await fn(now);
      toutes.push(...candidates);
    } catch (err) {
      console.error(
        `[evaluateur-alertes] erreur règle ${nom}:`,
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  return toutes;
}
