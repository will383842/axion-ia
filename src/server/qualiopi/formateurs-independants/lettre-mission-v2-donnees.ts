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
 * Les conditions financières FIGÉES sur la mission (tarif, forfait de
 * déplacement, régime de TVA) priment ; à défaut, le tarif arrêté (350 € HT la
 * journée) et le régime de la fiche.
 */

import {
  TARIF_JOURNEE_HT_CENTS,
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
    jours: ReadonlyArray<{ date: Date; heureDebut: string; heureFin: string }>;
  };
  dateMission: Date;
}

export type LettreV2Assemblee =
  { ok: true; data: LettreMissionV2Data } | { ok: false; motif: string };

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
  const regime = m.regimeTvaFige ?? t.regimeTvaHonoraires;
  if (regime === null) {
    return { ok: false, motif: "Le régime de TVA du formateur n'est pas renseigné." };
  }

  const jours: JourLettre[] = [...f.session.jours]
    .map((j) => ({ date: dateCivile(j.date), heureDebut: j.heureDebut, heureFin: j.heureFin }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const lieu = f.session.distanciel ? "à distance" : f.session.lieu;
  // Un forfait ne s'applique qu'aux journées sur place.
  const forfait = f.session.distanciel ? null : m.forfaitDeplacementParJourHtCents;
  const joursDeplacement = forfait !== null && forfait > 0 ? jours.length : 0;
  const tarif = m.tarifHtCents ?? TARIF_JOURNEE_HT_CENTS;

  let honoraires: ReturnType<typeof honorairesLettre>;
  try {
    honoraires = honorairesLettre({
      jours,
      tarifJourneeHtCents: tarif,
      forfaitDeplacementParJourHtCents: forfait,
      joursDeplacement,
    });
  } catch (err) {
    return { ok: false, motif: err instanceof Error ? err.message : "Montant illisible." };
  }
  const { journees, demiJournees } = decompterJournees(jours);
  const parMois = echeancesParMois(jours);
  const derniere = jours[jours.length - 1]!.date;
  const mandatEnVigueur =
    t.mandatAutofacturationSigneAt !== null && t.mandatAutofacturationRevoqueAt === null;

  return {
    ok: true,
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
