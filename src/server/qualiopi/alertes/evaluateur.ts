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
        `La session ${s.numero} est terminée depuis plus de 72 h mais reste « en cours » : ` +
        `aucun de ses ${s._count.enrollments} inscrit(s) ne porte de trace de présence. ` +
        `Tant qu'elle n'est pas clôturée, elle n'alimente ni le BPF, ni les attestations, ni les indicateurs.`,
      cibleType: "TrainingSession",
      cibleId: s.id,
    }));
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
    select: { id: true, numero: true, titreSession: true, dateDebut: true },
  });
  return sessions.map((s) => ({
    code: "session_sans_formateur",
    niveau: "important" as AlerteNiveau,
    titre: "Session à J-7 sans formateur principal",
    message: `La session ${s.numero} « ${s.titreSession} » démarre le ${s.dateDebut.toLocaleDateString("fr-FR")} sans formateur principal assigné (habilitation requise avant animation).`,
    cibleType: "TrainingSession",
    cibleId: s.id,
  }));
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

/** R15 — Factures impayées J+30 et J+60. */
async function regleFacturesImpayees(now: Date): Promise<AlerteCandidate[]> {
  const j30 = daysAgo(30, now);
  const j60 = daysAgo(60, now);
  const alertes: AlerteCandidate[] = [];

  // 🔴 Audit certification 2026-07-26 (F59). La règle ne regardait que le statut
  // `emise`. Or une facture partiellement réglée reste due pour son solde — et
  // c'est précisément le cas du RESTE À CHARGE : l'OPCO verse sa part, la facture
  // bascule en `partiellement_payee`, et si l'entreprise ne règle jamais la
  // sienne, AUCUNE alerte ne tombe. Jamais. Le trou portait exactement sur le
  // scénario de financement mixte, le plus fréquent en formation professionnelle.
  const factures = await prisma.factureFormation.findMany({
    where: {
      statut: { in: ["emise", "partiellement_payee"] },
      echeanceAt: { not: null, lte: j30 },
    },
    select: { id: true, numero: true, echeanceAt: true, statut: true },
  });

  for (const f of factures) {
    if (!f.echeanceAt) continue;
    if (f.echeanceAt <= j60) {
      alertes.push({
        code: "facture_impayee_j60",
        niveau: "critique",
        titre: "Facture impayée depuis +60 jours",
        message: `${f.statut === "partiellement_payee" ? `Le solde de la facture ${f.numero} est impayé` : `La facture ${f.numero} est impayée`} depuis plus de 60 jours (échéance : ${f.echeanceAt.toLocaleDateString("fr-FR")}).`,
        cibleType: "FactureFormation",
        cibleId: f.id,
      });
    } else {
      alertes.push({
        code: "facture_impayee_j30",
        niveau: "important",
        titre: "Facture impayée depuis +30 jours",
        message: `${f.statut === "partiellement_payee" ? `Le solde de la facture ${f.numero} est impayé` : `La facture ${f.numero} est impayée`} depuis plus de 30 jours (échéance : ${f.echeanceAt.toLocaleDateString("fr-FR")}).`,
        cibleType: "FactureFormation",
        cibleId: f.id,
      });
    }
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
async function regleDossiersFinancement(now: Date): Promise<AlerteCandidate[]> {
  const alertes: AlerteCandidate[] = [];

  // 1. Envoyé sans réponse depuis +30 jours.
  const sansReponse = await prisma.dossierFinancement.findMany({
    where: { statut: "envoye", envoyeAt: { not: null, lte: daysAgo(30, now) } },
    select: { id: true, financeurNom: true, numeroDossierExterne: true, envoyeAt: true },
  });
  for (const d of sansReponse) {
    if (!d.envoyeAt) continue;
    alertes.push({
      code: "dossier_financement_sans_reponse",
      niveau: "important",
      titre: "Dossier de financement envoyé sans réponse depuis +30 jours",
      message: `Le dossier ${d.numeroDossierExterne ?? d.id.slice(0, 8)} (${d.financeurNom ?? "financeur non nommé"}) est parti le ${d.envoyeAt.toLocaleDateString("fr-FR")} sans accord ni refus : relancer le financeur.`,
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
    select: { id: true, financeurNom: true, numeroDossierExterne: true, echeanceFinanceurAt: true },
  });
  for (const d of enRetard) {
    if (!d.echeanceFinanceurAt) continue;
    alertes.push({
      code: "financeur_paiement_en_retard",
      niveau: "critique",
      titre: "Paiement du financeur en retard (échéance dépassée)",
      message: `Le paiement du dossier ${d.numeroDossierExterne ?? d.id.slice(0, 8)} (${d.financeurNom ?? "financeur non nommé"}) était attendu le ${d.echeanceFinanceurAt.toLocaleDateString("fr-FR")} et n'est pas reçu : relancer le financeur.`,
      cibleType: "DossierFinancement",
      cibleId: d.id,
    });
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
  { nom: "opco", fn: regleOpco },
  { nom: "convention_tripartite", fn: regleConventionTripartite },
  { nom: "convention_formation", fn: regleConventionFormation },
  { nom: "factures_impayees", fn: regleFacturesImpayees },
  { nom: "dossiers_financement", fn: regleDossiersFinancement },
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
