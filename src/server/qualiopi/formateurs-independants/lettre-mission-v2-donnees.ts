/**
 * Lettre de mission v2 (lot S5) — des FAITS lus en base aux données imprimées.
 *
 * Module PUR : l'action lit, cette fonction décide. Elle refuse (avec un motif
 * dit en clair) plutôt que d'imprimer une case vide :
 *  - aucune lettre sans numéro de déclaration d'activité (contrat-cadre, art.
 *    19.3 ; art. L6351-1 C. trav.) ni sans SIRET — chacun dans SA case ;
 *  - aucune lettre sans contrat-cadre v3 signé : la lettre renvoie à ses
 *    clauses (confidentialité, non-sollicitation, autofacturation) ;
 *  - aucune lettre sans l'accord du formateur (« J'accepte », ou accord noté
 *    hors outil) : la mission est conclue par l'accord, la lettre le confirme ;
 *  - l'organisme sous-traitant attend son propre lot (L11f, canal A).
 *
 * 🔑 CE QUE LA LETTRE ANNONCE EST CE QUE LE PAIEMENT VERSE (étape 4) :
 *  - les conditions financières sont celles FIGÉES sur la mission (tarif,
 *    forfait, régime de TVA), et elles seules : sans elles le paiement ne verse
 *    rien (`conditions_absentes`), donc la lettre ne part pas — jamais de
 *    350 € par défaut ;
 *  - les journées sont celles du FORMATEUR (`journeesDuFormateur`, la règle du
 *    paiement) : en co-animation, jamais celles d'un autre ;
 *  - les demi-journées suivent le découpage du paiement (`creneauxDuJour`) ;
 *  - la part de chaque mois est calculée par la formule du paiement
 *    (`montantPrevuDuMoisHtCents`) et rangée avec la lettre : l'écart d'un
 *    relevé se compare à elle.
 */

import { demiJourneesPrevues, parMoisCivil } from "@/server/qualiopi/remuneration/heures-animees";

import { montantPrevuDuMoisHtCents } from "./argent/calcul-mission";
import { journeesDuFormateur } from "./argent/journees-du-formateur";
import { PARAMETRES_ARGENT_FORMATEURS } from "./argent/parametres";
import {
  decompterJournees,
  demiJourneesDuJour,
  echeancePaiement,
  echeancesParMois,
  honorairesLettre,
  mentionTvaLettre,
  type JourLettre,
  type RegimeTvaLettre,
} from "./lettre-mission-v2-calcul";
import type { LettreMissionV2Data } from "@/server/qualiopi/documents/templates/lettre-mission-v2";

/** Le contrat-cadre auquel la lettre v2 renvoie (clauses 4 bis, 5.3, 19.3). */
export const VERSION_CONTRAT_CADRE_MINIMALE = 3;

export interface FaitsLettreV2 {
  numero: string;
  /** Le formateur destinataire : ses journées seules entrent dans la lettre. */
  trainerId: string;
  trainer: {
    prenom: string;
    nom: string;
    statut: string;
    siret: string | null;
    nda: string | null;
    regimeTvaHonoraires: RegimeTvaLettre | null;
    mandatAutofacturationSigneAt: Date | null;
    mandatAutofacturationRevoqueAt: Date | null;
    organismeSousTraitantId: string | null;
  };
  /** Le dernier contrat-cadre intégralement signé, non annulé, ou `null`. */
  contratCadre: { version: number; signeLe: Date } | null;
  mission: {
    statut: string;
    reponduAt: Date | null;
    accordHorsOutilAt: Date | null;
    tarifHtCents: number | null;
    forfaitDeplacementParJourHtCents: number | null;
    regimeTvaFige: RegimeTvaLettre | null;
  } | null;
  session: {
    titre: string;
    numero: string;
    client: string;
    stagiaires: number;
    financeurEnAttente: boolean;
    /** Adresse lisible du lieu ; ignorée à distance. */
    lieu: string;
    distanciel: boolean;
    /** Les formateurs affectés (`SessionFormateur`) : la règle des journées sans formateur désigné. */
    affectes: ReadonlyArray<{ trainerId: string }>;
    jours: ReadonlyArray<{
      date: Date;
      heureDebut: string;
      heureFin: string;
      /** Formateur désigné de la journée (`SessionJour.trainerId`), ou `null`. */
      trainerId: string | null;
    }>;
  };
  dateMission: Date;
}

/**
 * Ce que la lettre ANNONCE, en centimes HT : le total et la part de chaque mois
 * (`AAAA-MM`), calculée par la formule du paiement. Rangé dans les métadonnées
 * de la lettre (`annonceLettre`) : l'écart d'un relevé s'y compare.
 */
export interface AnnonceLettre {
  totalHtCents: number;
  parMois: Record<string, number>;
}

export type LettreV2Assemblee =
  | {
      ok: true;
      data: LettreMissionV2Data;
      annonce: AnnonceLettre;
      /** Les journées de la lettre (celles du formateur), triées. */
      jours: ReadonlyArray<JourLettre>;
    }
  | { ok: false; motif: string };

const PARIS_DATE = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "Europe/Paris",
});
const PARIS_HEURE = new Intl.DateTimeFormat("fr-FR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Paris",
});

/** `AAAA-MM-JJ` → `JJ/MM/AAAA`. */
function civile(iso: string): string {
  const [a, m, j] = iso.split("-");
  return `${j}/${m}/${a}`;
}

/** La date civile d'une `SessionJour.date` (colonne `@db.Date`, minuit UTC). */
function dateCivile(d: Date): string {
  return d.toISOString().slice(0, 10);
}

const STATUTS_ACCORD = new Set(["acceptee", "accord_hors_outil"]);

export function assemblerLettreV2(f: FaitsLettreV2): LettreV2Assemblee {
  const t = f.trainer;
  if (t.statut !== "sous_traitant") {
    return { ok: false, motif: "La lettre v2 est réservée aux formateurs indépendants." };
  }
  if (t.organismeSousTraitantId !== null) {
    return {
      ok: false,
      motif: "La lettre d'un organisme sous-traitant n'est pas encore disponible.",
    };
  }
  const nda = (t.nda ?? "").trim();
  if (nda === "") {
    return {
      ok: false,
      motif:
        "Le numéro de déclaration d'activité du formateur manque : aucune lettre ne part sans lui.",
    };
  }
  const siret = (t.siret ?? "").trim();
  if (siret === "") {
    return { ok: false, motif: "Le SIRET du formateur manque : la lettre l'imprime dans sa case." };
  }
  if (f.contratCadre === null || f.contratCadre.version < VERSION_CONTRAT_CADRE_MINIMALE) {
    return {
      ok: false,
      motif: `Le contrat-cadre version ${VERSION_CONTRAT_CADRE_MINIMALE} n'est pas signé : la lettre renvoie à ses clauses.`,
    };
  }
  const m = f.mission;
  if (m === null || !STATUTS_ACCORD.has(m.statut)) {
    return {
      ok: false,
      motif: "Le formateur n'a pas encore accepté la mission : la lettre confirme son accord.",
    };
  }
  const accord = m.statut === "acceptee" ? m.reponduAt : m.accordHorsOutilAt;
  if (accord === null) {
    return { ok: false, motif: "La date de l'accord du formateur est inconnue." };
  }
  if (f.session.jours.length === 0) {
    return {
      ok: false,
      motif: "Aucune journée n'est déclarée sur la session : la lettre les liste une par une.",
    };
  }
  // ARGENT — la lettre n'annonce que ce que le paiement versera : celui-ci ne
  // lit que les conditions FIGÉES sur la mission. Aucune valeur par défaut.
  if (m.tarifHtCents === null) {
    return {
      ok: false,
      motif:
        "Le tarif de la mission n'est pas figé : la lettre n'annonce que ce que le paiement versera. Figez les conditions de la mission (choix du formateur) avant d'émettre la lettre.",
    };
  }
  if (m.regimeTvaFige === null) {
    return {
      ok: false,
      motif:
        "Le régime de TVA de la mission n'est pas figé : la lettre n'annonce que ce que le paiement versera. Figez les conditions de la mission (choix du formateur) avant d'émettre la lettre.",
    };
  }
  const regime = m.regimeTvaFige;
  const siens = journeesDuFormateur(f.session.jours, f.trainerId, f.session.affectes);
  if (siens.length === 0) {
    return {
      ok: false,
      motif:
        "Aucune journée de la session n'est attribuée à ce formateur : la lettre ne liste que les siennes.",
    };
  }

  const jours: JourLettre[] = siens
    .map((j) => ({ date: dateCivile(j.date), heureDebut: j.heureDebut, heureFin: j.heureFin }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const lieu = f.session.distanciel ? "à distance" : f.session.lieu;
  // Un forfait ne s'applique qu'aux journées sur place.
  const forfait = f.session.distanciel ? null : m.forfaitDeplacementParJourHtCents;
  const joursDeplacement = forfait !== null && forfait > 0 ? jours.length : 0;
  const tarif = m.tarifHtCents;

  let honoraires: ReturnType<typeof honorairesLettre>;
  const parMoisAnnonce: Record<string, number> = {};
  try {
    honoraires = honorairesLettre({
      jours,
      tarifJourneeHtCents: tarif,
      forfaitDeplacementParJourHtCents: forfait,
      joursDeplacement,
    });
    // La part de chaque mois, par la formule du PAIEMENT (forfait plafonné
    // compris : au-dessus, le paiement refuse, donc la lettre aussi).
    const conditions = {
      tarifJourneeHtCents: tarif,
      forfaitDeplacementParJourHtCents: forfait,
      regimeTva: regime,
    };
    const prevues = demiJourneesPrevues(
      jours.map((j) => ({ jour: j.date, heureDebut: j.heureDebut, heureFin: j.heureFin })),
      PARAMETRES_ARGENT_FORMATEURS,
    );
    for (const mois of parMoisCivil(prevues)) {
      parMoisAnnonce[mois.mois] = montantPrevuDuMoisHtCents(mois, conditions);
    }
  } catch (err) {
    return { ok: false, motif: err instanceof Error ? err.message : "Montant illisible." };
  }
  const sommeMois = Object.values(parMoisAnnonce).reduce((a, b) => a + b, 0);
  if (sommeMois !== honoraires.totalHtCents) {
    // Garde-fou : deux calculs de la même annonce ne divergent jamais en silence.
    return {
      ok: false,
      motif: `Le total de la lettre (${honoraires.totalHtCents} c HT) diffère de la somme des mois payés (${sommeMois} c HT) : rien n'est émis.`,
    };
  }
  const { journees, demiJournees } = decompterJournees(jours);
  const parMois = echeancesParMois(jours);
  const derniere = jours[jours.length - 1]!.date;
  const mandatEnVigueur =
    t.mandatAutofacturationSigneAt !== null && t.mandatAutofacturationRevoqueAt === null;

  return {
    ok: true,
    annonce: { totalHtCents: honoraires.totalHtCents, parMois: parMoisAnnonce },
    jours,
    data: {
      numero: f.numero,
      partie: {
        forme: "independant",
        nomPrenom: `${t.prenom} ${t.nom}`.trim(),
        siret,
        nda,
      },
      contratCadre: {
        version: f.contratCadre.version,
        signeLe: PARIS_DATE.format(f.contratCadre.signeLe),
      },
      accordLe: `${PARIS_DATE.format(accord)} à ${PARIS_HEURE.format(accord)}`,
      formation: {
        intitule: f.session.titre,
        reference: f.session.numero,
        client: f.session.client,
        stagiaires: f.session.stagiaires,
      },
      jours: jours.map((j) => ({
        date: civile(j.date),
        horaires: `${j.heureDebut}-${j.heureFin}`,
        demiJournees: demiJourneesDuJour(j),
        lieu,
      })),
      journees,
      demiJournees,
      tarifJourneeHtCents: tarif,
      honorairesHtCents: honoraires.honorairesHtCents,
      deplacement:
        honoraires.deplacementHtCents > 0 && forfait !== null
          ? {
              forfaitParJourHtCents: forfait,
              joursDeplacement,
              totalHtCents: honoraires.deplacementHtCents,
            }
          : null,
      totalHtCents: honoraires.totalHtCents,
      mentionTva: mentionTvaLettre(regime, honoraires.totalHtCents),
      echeancePaiement: civile(echeancePaiement(derniere)),
      ...(parMois.length > 1 ? { echeancesParMois: parMois.map((e) => civile(e.echeance)) } : {}),
      autofacturation: mandatEnVigueur,
      financeurEnAttente: f.session.financeurEnAttente,
      mentionExpresse: null,
      dateMission: PARIS_DATE.format(f.dateMission),
    },
  };
}
