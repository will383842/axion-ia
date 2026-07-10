// Cockpit — HUB DE PILOTAGE, couche de lecture (read-only, appelée par le RSC).
//
// Elle ne calcule rien : elle rassemble ce que les trois piliers savent déjà et
// délègue tout le verdict à la fonction pure `construireHub`.
//
// ── Aucune requête neuve pour le planning ────────────────────────────────────
// `getPlanningMonth` renvoie une `Map<jour, events[]>` où une prestation
// multi-jours apparaît sous CHACUN de ses jours. Le hub raisonne sur des
// prestations, pas sur des jours : on déduplique par `key` avant de la lui
// passer, sinon une formation de trois jours compterait pour TROIS sessions non
// staffées, et pour trois lignes dans le signal.
//
// (Elle ne se signalerait PAS en conflit avec elle-même pour autant :
// `findConflicts` exclut déjà la cible par sa `key`. La dédup sert au comptage,
// pas à la détection de conflits — ne pas confondre les deux protections.)
//
// ── Pourquoi on ne lit la conformité que des formateurs AFFECTÉS ─────────────
// `getTrainerConformite` fait plusieurs requêtes par formateur. Les interroger
// tous coûterait N fois le prix pour un signal qui, de toute façon, ne concerne
// que ceux qu'on s'apprête à envoyer chez un client (cf. `signalNonConformes`).
//
// Build-safety (ADR 0026) : toutes les lectures appelées ici sont déjà
// stub-safe ; au build, le hub rend simplement une liste de signaux vide.

import { getPlanningMonth } from "./queries";
import { getChargeMois } from "./charge-queries";
import { joursOuvresDuMois } from "./charge";
import { mobiliseLeFormateur } from "./conflicts";
import { construireHub, type ConformiteFormateur, type Signal } from "./hub";
import type { PlanningEvent } from "./types";
import { getTrainerConformite } from "@/server/qualiopi/trainers/documents";
import { listTrainers } from "@/server/qualiopi/trainers/trainers";
import { listAnomaliesPeriode, listRelevesPeriode } from "@/server/qualiopi/remuneration/queries";
import { listIndisposEntre } from "@/server/qualiopi/trainers/availability-queries";
import { joursIndisponibles } from "@/server/qualiopi/trainers/availability";

/**
 * Aplatit la `Map<jour, events[]>` en une liste de prestations DISTINCTES.
 * La `key` (`formation:<uuid>` / `coaching:<uuid>`) est stable inter-sources.
 */
export function deduplerEvents(byDay: Map<string, PlanningEvent[]>): PlanningEvent[] {
  const parKey = new Map<string, PlanningEvent>();
  for (const events of byDay.values()) {
    for (const e of events) if (!parKey.has(e.key)) parKey.set(e.key, e);
  }
  return [...parKey.values()];
}

/** Ids des formateurs affectés à une prestation qui mobilise (annulée exclue). */
export function formateursAffectes(events: readonly PlanningEvent[]): string[] {
  const ids = new Set<string>();
  for (const e of events) {
    const fid = e.formateurId ?? null;
    if (fid !== null && mobiliseLeFormateur(e)) ids.add(fid);
  }
  return [...ids];
}

/** Relevés qu'un humain n'a pas encore tranchés. Au-delà, ils ne sont plus « à traiter ». */
const STATUTS_EN_ATTENTE = new Set(["brouillon", "a_valider"]);

/**
 * Les signaux du hub pour le mois `year`/`month`.
 *
 * `maintenant` est injecté (jamais `new Date()` ici) pour que la page reste
 * testable et que le verdict ne dépende pas de l'instant du rendu.
 */
export async function getHubSignaux(
  year: number,
  month: number,
  adminPrefix: string,
  maintenant: Date,
): Promise<Signal[]> {
  // Fenêtre ÉLARGIE d'un mois de part et d'autre : un congé de trois semaines à
  // cheval sur deux mois doit être vu depuis le mois affiché. `listIndisposEntre`
  // intersecte, elle ne filtre pas sur la date de début.
  const debutFenetre = new Date(Date.UTC(year, month - 2, 1));
  const finFenetre = new Date(Date.UTC(year, month + 1, 0));

  const [byDay, charges, releves, anomalies, indisposRows] = await Promise.all([
    getPlanningMonth(year, month),
    getChargeMois(year, month, joursOuvresDuMois(year, month)),
    listRelevesPeriode({ year, month }),
    listAnomaliesPeriode({ year, month }),
    listIndisposEntre(debutFenetre, finFenetre),
  ]);

  const events = deduplerEvents(byDay);

  const indispos = new Map<string, Set<string>>();
  for (const row of indisposRows) {
    const acc = indispos.get(row.trainerId) ?? new Set<string>();
    for (const j of joursIndisponibles([row])) acc.add(j);
    indispos.set(row.trainerId, acc);
  }

  // Conformité : seulement les formateurs qu'on s'apprête à envoyer en mission.
  const affectes = new Set(formateursAffectes(events));
  const conformites: ConformiteFormateur[] = [];
  if (affectes.size > 0) {
    const trainers = await listTrainers({ actifOnly: true });
    const noms = new Map(trainers.map((t) => [t.id, `${t.prenom} ${t.nom}`.trim()]));

    const resultats = await Promise.all(
      [...affectes].map(async (trainerId) => {
        const c = await getTrainerConformite(trainerId, year, maintenant);
        return { trainerId, c };
      }),
    );

    for (const { trainerId, c } of resultats) {
      // `null` = formateur introuvable (ou stub de build) : on ne l'accuse pas
      // de non-conformité, on n'a simplement rien pu évaluer.
      if (c === null) continue;
      conformites.push({
        trainerId,
        nom: noms.get(trainerId) ?? "Formateur",
        conforme: c.conforme,
        nbBloquants: c.manquements.filter((m) => m.gravite === "bloquant").length,
      });
    }
  }

  return construireHub(
    {
      events,
      charges,
      conformites,
      relevesEnAttente: releves
        .filter((r) => STATUTS_EN_ATTENTE.has(r.statut))
        .map((r) => ({ id: r.id, trainerNom: r.trainerNom, totalTtcCents: r.totalTtcCents })),
      anomalies: anomalies.map((a) => ({ id: a.id, trainerNom: a.trainerNom, motif: a.motif })),
      indispos,
    },
    maintenant,
    adminPrefix,
  );
}
