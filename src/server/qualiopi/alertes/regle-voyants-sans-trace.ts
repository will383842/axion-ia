/**
 * 🔴 CHANTIER QNC, LOT L12 — LES ALERTES DES VOYANTS D'INDICATEURS (exigence O13).
 *
 * Un voyant `rouge` (cf. `parcours/voyants-indicateurs.ts`) devient une alerte :
 * la trace que le lot producteur aurait dû écrire n'existe pas (ou est
 * incomplète) alors que l'échéance est passée. Un code par indicateur
 * (`voyant_ind_NN_sans_trace`), pour que chacun ait son guichet et se referme
 * seul quand la trace apparaît.
 *
 * Ce que la règle ne fait PAS :
 *   - un voyant `non_evalue` (lot éteint, absent, lecture en échec) n'alerte
 *     jamais : on ne sait pas, on n'accuse pas — l'écran le dit ;
 *   - une session d'essai n'est jamais lue (`SESSION_REELLE`) : aucune alerte ;
 *   - les voyants d'organisme (23 veille, 26 handicap) sont émis une fois,
 *     sans cible de session.
 *
 * Même calcul que l'écran : `construireVoyants` est la SEULE définition du rouge.
 */

import { prisma } from "@/lib/prisma";
import { SESSION_REELLE } from "../essai/perimetre";
import { chargerTracesVoyants } from "../parcours/charger-traces-voyants";
import { construireVoyants, type IndicateurAVoyant } from "../parcours/voyants-indicateurs";
import type { AlerteCandidate } from "./evaluateur";

const MS_JOUR = 24 * 60 * 60 * 1000;
/** Même fenêtre arrière que « À traiter » : au-delà, plus rien n'est ni rattrapable ni utile. */
const FENETRE_ARRIERE_JOURS = 45;
const PLAFOND_SESSIONS = 300;

/** Voyants qui portent sur l'organisme et non sur une session. */
const VOYANTS_ORGANISME: ReadonlySet<IndicateurAVoyant> = new Set<IndicateurAVoyant>([23, 26]);

/** Littéral par indicateur : lu par les verrous du catalogue. */
// Forme `code: "…"` : le dépouillement de `routage.spec.ts` ne lit que celle-là.
export const CODE_VOYANT: Readonly<Record<IndicateurAVoyant, { readonly code: string }>> = {
  4: { code: "voyant_ind_04_sans_trace" },
  6: { code: "voyant_ind_06_sans_trace" },
  9: { code: "voyant_ind_09_sans_trace" },
  10: { code: "voyant_ind_10_sans_trace" },
  11: { code: "voyant_ind_11_sans_trace" },
  12: { code: "voyant_ind_12_sans_trace" },
  17: { code: "voyant_ind_17_sans_trace" },
  19: { code: "voyant_ind_19_sans_trace" },
  21: { code: "voyant_ind_21_sans_trace" },
  23: { code: "voyant_ind_23_sans_trace" },
  26: { code: "voyant_ind_26_sans_trace" },
  27: { code: "voyant_ind_27_sans_trace" },
  30: { code: "voyant_ind_30_sans_trace" },
  31: { code: "voyant_ind_31_sans_trace" },
};

export async function regleVoyantsSansTrace(now: Date): Promise<AlerteCandidate[]> {
  const sessions = await prisma.trainingSession.findMany({
    where: {
      ...SESSION_REELLE,
      statut: { in: ["planifiee", "en_cours", "realisee"] },
      dateFin: { gte: new Date(now.getTime() - FENETRE_ARRIERE_JOURS * MS_JOUR) },
    },
    orderBy: { dateDebut: "asc" },
    take: PLAFOND_SESSIONS,
    select: { id: true, numero: true, dateDebut: true, dateFin: true, estTestInterne: true },
  });
  if (sessions.length === 0) return [];
  const traces = await chargerTracesVoyants(
    sessions.map((s) => s.id),
    now,
  );
  const out: AlerteCandidate[] = [];
  const organismeDeja = new Set<IndicateurAVoyant>();
  for (const s of sessions) {
    const t = traces.get(s.id);
    if (t === undefined) continue; // session d'essai ou introuvable : aucun voyant réel
    for (const v of construireVoyants(t, {
      dateDebut: s.dateDebut,
      dateFin: s.dateFin,
      estTestInterne: s.estTestInterne,
      maintenant: now,
    })) {
      if (v.etat !== "rouge") continue;
      if (VOYANTS_ORGANISME.has(v.indicateur)) {
        if (organismeDeja.has(v.indicateur)) continue;
        organismeDeja.add(v.indicateur);
        out.push({
          code: CODE_VOYANT[v.indicateur].code,
          niveau: "important",
          titre: `Indicateur ${v.indicateur} : aucune trace réelle`,
          message: `${v.libelle} — ${v.manque ?? "trace absente"} Le voyant ne passe au vert qu'avec la trace, pas avec une donnée présente.`,
        });
        continue;
      }
      out.push({
        code: CODE_VOYANT[v.indicateur].code,
        niveau: "important",
        titre: `Indicateur ${v.indicateur} : aucune trace réelle sur la session ${s.numero}`,
        message:
          `${v.libelle} — session ${s.numero}. ${v.manque ?? "Trace absente."} ` +
          "Le voyant ne passe au vert qu'avec la trace écrite par le geste lui-même : une donnée présente ne suffit pas. " +
          "L'alerte se referme seule dès que la trace existe.",
        cibleType: "TrainingSession",
        cibleId: s.id,
      });
    }
  }
  return out;
}
