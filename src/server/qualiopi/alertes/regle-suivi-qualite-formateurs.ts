/**
 * Qualiopi ind. 21 (NC majeure) — les ALERTES INTERNES du suivi de la qualité pédagogique
 * des intervenants externes. Aucune n'écrit au formateur : elles s'adressent au guichet
 * « qualité » de la console.
 *
 *   - `fi_observation_manquante`       la 1re mission est finie, pas d'observation ;
 *   - `fi_observation_insuffisante`    l'observation est sous le seuil (habilitation non confirmée) ;
 *   - `fi_evaluation_mission_a_saisir` relance interne : grille après mission absente à J+3 ;
 *   - `fi_evaluation_mission_manquante` alerte : toujours absente à J+7 ;
 *   - `fi_entretien_a_prevoir`         satisfaction des stagiaires sous le seuil d'entretien ;
 *   - `fi_missions_suspendues`         satisfaction sous le seuil de suspension, aucune décision ;
 *   - `fi_reevaluation_a_prevoir`      réévaluation annuelle dans 30 jours ;
 *   - `fi_reevaluation_echue`          réévaluation annuelle échue (la garde refuse) ;
 *   - `fi_cv_declare_perime`           CV déclaré de plus de 24 mois (#1551).
 *
 * Toutes se referment seules quand leur cause disparaît (grille ou décision saisie).
 * Interrupteur `formateurs.suivi_qualite` éteint : aucune candidate.
 *
 * 🔑 CHAQUE ALERTE EST TRACÉE AU JOURNAL : à sa première apparition (aucune alerte ouverte
 * de même code et même cible), une ligne `qualiopi.formateur.suivi_qualite_alerte`.
 */

import type { AlerteNiveau } from "../../../../prisma/generated/client";
import { prisma } from "@/lib/prisma";
import { journaliser } from "@/server/journal/journaliser";

import { jourParis } from "../formateurs-independants/argent/dates";
import {
  lireAllumageSuiviQualite,
  lireFaitsSuiviQualite,
} from "../formateurs-independants/suivi-qualite/lecture";
import { lireReglagesSuiviQualite } from "../formateurs-independants/suivi-qualite/reglages-lecture";
import {
  cvDeclarePerime,
  etatEvaluationMission,
  etatObservation,
  etatReevaluation,
  missionsAReprendre,
  missionsSuivies,
} from "../formateurs-independants/suivi-qualite/regles";
import type { AlerteCandidate } from "./evaluateur";

const virgule = (n: number) => String(Math.round(n * 100) / 100).replace(".", ",");
const dateFr = (jour: string) => jour.split("-").reverse().join("/");

export const CODES_SUIVI_QUALITE = [
  "fi_observation_manquante",
  "fi_observation_insuffisante",
  "fi_evaluation_mission_a_saisir",
  "fi_evaluation_mission_manquante",
  "fi_entretien_a_prevoir",
  "fi_missions_suspendues",
  "fi_reevaluation_a_prevoir",
  "fi_reevaluation_echue",
  "fi_cv_declare_perime",
] as const;

/** Les candidates, sans trace au journal (pur côté écriture). */
export async function candidatesSuiviQualite(now: Date): Promise<AlerteCandidate[]> {
  const allumeLe = await lireAllumageSuiviQualite();
  if (allumeLe === null) return [];
  // Les seuils RÉGLÉS ; illisibles ou base en panne : les défauts (ne lève jamais).
  const R = await lireReglagesSuiviQualite();

  const formateurs = await prisma.trainer.findMany({
    where: { statut: "sous_traitant", actif: true, finCollaborationAt: null },
    select: {
      id: true,
      nom: true,
      prenom: true,
      documents: {
        where: { type: "cv", archiveAt: null },
        select: { dateCvDeclaree: true, createdAt: true },
      },
    },
  });

  const alertes: AlerteCandidate[] = [];
  // Par session : une alerte, qui nomme tous les formateurs concernés (co-animation).
  const parSession = new Map<
    string,
    {
      code:
        | "fi_evaluation_mission_a_saisir"
        | "fi_evaluation_mission_manquante"
        | "fi_entretien_a_prevoir";
      noms: string[];
      detail: string;
    }
  >();
  const ajouterSession = (
    code:
      | "fi_evaluation_mission_a_saisir"
      | "fi_evaluation_mission_manquante"
      | "fi_entretien_a_prevoir",
    sessionId: string,
    nom: string,
    detail: string,
  ) => {
    const cle = `${code}::${sessionId}`;
    const e = parSession.get(cle);
    if (e) e.noms.push(nom);
    else parSession.set(cle, { code, noms: [nom], detail });
  };

  for (const t of formateurs) {
    const nom = `${t.prenom} ${t.nom}`.trim();
    const f = await lireFaitsSuiviQualite(t.id, allumeLe);
    if (!f.trouve || !f.externe) continue;

    const obs = etatObservation(f, now, R);
    if (obs.alerte === "manquante" && obs.premiere !== null) {
      alertes.push({
        code: "fi_observation_manquante",
        niveau: "important" as AlerteNiveau,
        titre: "Formateur : observation de la 1re mission non saisie",
        message: `${nom} a terminé sa première mission (fin le ${dateFr(obs.premiere.fin)}) sans grille d'observation. Son habilitation n'est pas confirmée : aucune autre mission ne lui sera confiée avant l'observation (Qualiopi ind. 21).`,
        cibleType: "Trainer",
        cibleId: t.id,
      });
    } else if (obs.alerte === "insuffisante") {
      alertes.push({
        code: "fi_observation_insuffisante",
        niveau: "important" as AlerteNiveau,
        titre: "Formateur : observation sous le seuil, habilitation non confirmée",
        message: `La dernière observation de ${nom} est sous ${virgule(R.observationMoyenneMin)}/5. Aucune autre mission avant une nouvelle observation favorable (Qualiopi ind. 21).`,
        cibleType: "Trainer",
        cibleId: t.id,
      });
    }

    const aujourdhui = jourParis(now);
    for (const m of missionsSuivies(f)) {
      if (m.fin > aujourdhui) continue;
      const saisie = f.evaluations.some((e) => e.sessionId === m.sessionId);
      const etat = etatEvaluationMission(m.fin, saisie, now, R);
      if (etat === "relance") {
        ajouterSession("fi_evaluation_mission_a_saisir", m.sessionId, nom, dateFr(m.fin));
      } else if (etat === "alerte") {
        ajouterSession("fi_evaluation_mission_manquante", m.sessionId, nom, dateFr(m.fin));
      }
    }

    const { entretien, suspension } = missionsAReprendre(f, R);
    for (const m of entretien) {
      ajouterSession("fi_entretien_a_prevoir", m.sessionId, nom, virgule(m.satisfaction ?? 0));
    }
    if (suspension.length > 0) {
      alertes.push({
        code: "fi_missions_suspendues",
        niveau: "critique" as AlerteNiveau,
        titre: "Formateur : nouvelles missions suspendues (satisfaction des stagiaires)",
        message: `La satisfaction des stagiaires de ${nom} est sous ${virgule(R.satisfactionSuspensionSous)}/5 sur ${suspension.length} mission(s). Ses nouvelles missions sont refusées jusqu'à une décision motivée en console (fiche › Suivi qualité).`,
        cibleType: "Trainer",
        cibleId: t.id,
      });
    }

    const reeval = etatReevaluation(f, now, R);
    if (reeval.etat === "rappel" && reeval.echeance !== null) {
      alertes.push({
        code: "fi_reevaluation_a_prevoir",
        niveau: "info" as AlerteNiveau,
        titre: "Formateur : réévaluation annuelle à prévoir",
        message: `La réévaluation annuelle de ${nom} arrive à échéance le ${dateFr(reeval.echeance)}. Passé cette date, aucune nouvelle mission ne lui sera confiée tant qu'elle n'est pas saisie.`,
        cibleType: "Trainer",
        cibleId: t.id,
      });
    } else if (reeval.etat === "echue" && reeval.echeance !== null) {
      alertes.push({
        code: "fi_reevaluation_echue",
        niveau: "important" as AlerteNiveau,
        titre: "Formateur : réévaluation annuelle échue",
        message: `La réévaluation annuelle de ${nom} est échue depuis le ${dateFr(reeval.echeance)}. Aucune nouvelle mission avant qu'elle soit saisie (Qualiopi ind. 21).`,
        cibleType: "Trainer",
        cibleId: t.id,
      });
    }

    // Le CV le plus récent ; sa date DÉCLARÉE seulement (#1551).
    let cv: { dateCvDeclaree: Date | null; createdAt: Date } | null = null;
    for (const d of t.documents) if (cv === null || d.createdAt > cv.createdAt) cv = d;
    if (cv !== null && cvDeclarePerime(cv.dateCvDeclaree, now, R)) {
      alertes.push({
        code: "fi_cv_declare_perime",
        niveau: "important" as AlerteNiveau,
        titre: `Formateur : CV déclaré de plus de ${R.cvDeclareMaxMois} mois`,
        message: `Le CV de ${nom} est daté de plus de ${R.cvDeclareMaxMois} mois (date déclarée par le formateur). Demandez un CV à jour : il ne prouve plus ses compétences (Qualiopi ind. 21).`,
        cibleType: "Trainer",
        cibleId: t.id,
      });
    }
  }

  for (const [cle, e] of parSession) {
    const sessionId = cle.split("::")[1]!;
    const qui = e.noms.join(", ");
    if (e.code === "fi_evaluation_mission_a_saisir") {
      alertes.push({
        code: "fi_evaluation_mission_a_saisir",
        niveau: "info" as AlerteNiveau,
        titre: "Grille d'évaluation après mission à saisir",
        message: `Mission finie le ${e.detail} : la grille d'évaluation de ${qui} n'est pas saisie (relance à J+${R.evaluationRelanceJours}, alerte à J+${R.evaluationAlerteJours}).`,
        cibleType: "TrainingSession",
        cibleId: sessionId,
      });
    } else if (e.code === "fi_evaluation_mission_manquante") {
      alertes.push({
        code: "fi_evaluation_mission_manquante",
        niveau: "important" as AlerteNiveau,
        titre: "Grille d'évaluation après mission manquante",
        message: `Mission finie le ${e.detail} : la grille d'évaluation de ${qui} manque toujours après ${R.evaluationAlerteJours} jours (Qualiopi ind. 21).`,
        cibleType: "TrainingSession",
        cibleId: sessionId,
      });
    } else {
      alertes.push({
        code: "fi_entretien_a_prevoir",
        niveau: "important" as AlerteNiveau,
        titre: "Formateur : entretien à prévoir (satisfaction des stagiaires)",
        message: `Satisfaction des stagiaires de ${e.detail}/5 (seuil ${virgule(R.satisfactionEntretienSous)}) : un entretien est à prévoir avec ${qui}, puis à consigner en console.`,
        cibleType: "TrainingSession",
        cibleId: sessionId,
      });
    }
  }
  return alertes;
}

/** La règle branchée dans l'évaluateur : candidates, et trace au journal des nouvelles. */
export async function regleSuiviQualiteFormateurs(now: Date): Promise<AlerteCandidate[]> {
  const candidates = await candidatesSuiviQualite(now);
  if (candidates.length === 0) return candidates;
  try {
    const ouvertes = await prisma.alerteSysteme.findMany({
      where: { code: { in: [...CODES_SUIVI_QUALITE] }, resolue: false },
      select: { code: true, cibleId: true },
    });
    const deja = new Set(ouvertes.map((o) => `${o.code}::${o.cibleId ?? ""}`));
    for (const c of candidates) {
      if (deja.has(`${c.code}::${c.cibleId ?? ""}`)) continue;
      await journaliser(prisma, {
        action: "qualiopi.formateur.suivi_qualite_alerte",
        targetType: c.cibleType ?? "qualiopi",
        targetId: c.cibleId ?? null,
        changes: { code: c.code, niveau: c.niveau },
        session: null,
      });
    }
  } catch (err) {
    // La trace est tolérante (comme `journaliser` hors transaction) : l'alerte, elle, part.
    console.error(
      "[suivi-qualite] trace des alertes au journal en échec :",
      err instanceof Error ? err.message : String(err),
    );
  }
  return candidates;
}
