// Requêtes RV (read-only, appelées depuis les RSC). V1 : Calendly.
// Fetch + normalisation + filtres/tri/pagination EN MÉMOIRE (volumes admin =
// centaines de lignes). Si un jour Calendly + Booking dépassent quelques
// milliers → basculer vers une vue SQL UNION paginée (cf. plan §risques).
//
// Build-safety (ADR 0026) : au build, `prisma` est un Proxy stub qui renvoie []
// → ces fonctions renvoient vide sans connexion DB. Rien à guarder ici.

import { prisma } from "@/lib/prisma";
import { fromCalendly, type CalendlyEventRow } from "./normalize";
import type { RdvFilters, UnifiedRdv } from "./types";

const CAL_SELECT = {
  id: true,
  eventTypeName: true,
  status: true,
  startTime: true,
  endTime: true,
  inviteeName: true,
  inviteeEmail: true,
  inviteePhone: true,
  location: true,
  // 🔑 Nécessaire pour DÉRIVER le format (téléphone / visio) du `type` que
  // Calendly pose, plutôt que de la forme du texte — `location` est librement
  // éditable en console, donc sa forme ne fait pas foi (cf. `calendly/canal.ts`).
  //
  // Coût MESURÉ en production le 2026-08-31, pas estimé : 19 lignes,
  // 19 kB au total, **1 031 octets de moyenne** par charge brute. Au plafond
  // théorique de `MAX_FETCH` (2 000) cela ferait ~2 Mo ; la table en compte 19.
  // Si ce volume devenait un sujet, la réponse serait de paginer en base, pas
  // de retirer ce champ — le retirer rendrait le format faux en silence.
  rawPayload: true,
  notes: true,
  capturedAt: true,
} as const;

/**
 * Plafond de lignes lues AVANT filtrage et pagination. Exporté : l'adaptateur
 * MCP (`src/server/mcp/outils/rendezvous-list.ts`) s'en sert pour déclarer une
 * fenêtre incomplète quand le total l'atteint, plutôt que de recopier « 2000 ».
 */
export const MAX_FETCH_CALENDLY = 2000;

async function fetchAllCalendly(): Promise<UnifiedRdv[]> {
  const events = await prisma.calendlyEvent.findMany({
    select: CAL_SELECT,
    orderBy: [{ startTime: "desc" }, { capturedAt: "desc" }],
    take: MAX_FETCH_CALENDLY,
  });
  const rows = (events as CalendlyEventRow[]).map(fromCalendly);
  // Re-tri EN MÉMOIRE sur l'ancre d'affichage (`startTime` sinon `capturedAt`),
  // celle-là même qui décide du `dayKey`.
  //
  // Sans lui, l'ordre venait du `ORDER BY start_time DESC` de Postgres, qui
  // place les NULL EN TÊTE : dès qu'une réservation était enrichie (donc dotée
  // d'un horaire), elle tombait sous toutes celles restées sans heure, quelle
  // que soit sa date. Constaté en production le 2026-07-29 — le RDV du 23/07
  // s'affichait après ceux du 09/07 et du 01/07.
  rows.sort((a, b) => {
    const ta = (a.startTime ?? a.createdAt).getTime();
    const tb = (b.startTime ?? b.createdAt).getTime();
    return tb - ta;
  });
  return rows;
}

/** Tri intra-jour : créneaux horodatés d'abord (par heure), puis « heure ? ». */
function sortWithinDay(arr: UnifiedRdv[]): void {
  arr.sort((a, b) => {
    if (a.timeConfirmed && b.timeConfirmed) {
      return (a.startTime as Date).getTime() - (b.startTime as Date).getTime();
    }
    if (a.timeConfirmed !== b.timeConfirmed) return a.timeConfirmed ? -1 : 1;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });
}

export async function listRendezVous(
  filters: RdvFilters,
): Promise<{ rows: UnifiedRdv[]; total: number }> {
  let rows = await fetchAllCalendly();

  if (filters.source && filters.source !== "calendly") rows = [];
  if (filters.status) rows = rows.filter((r) => r.status === filters.status);
  if (filters.from) rows = rows.filter((r) => r.dayKey >= (filters.from as string));
  if (filters.to) rows = rows.filter((r) => r.dayKey <= (filters.to as string));
  if (filters.q) {
    const q = filters.q.toLowerCase();
    rows = rows.filter((r) =>
      [r.title, r.contactName, r.contactEmail].some(
        (v) => v != null && v.toLowerCase().includes(q),
      ),
    );
  }

  const total = rows.length;
  const page = filters.page && filters.page > 0 ? filters.page : 1;
  const pageSize = filters.pageSize && filters.pageSize > 0 ? filters.pageSize : 25;
  const paged = rows.slice((page - 1) * pageSize, page * pageSize);
  return { rows: paged, total };
}

/** RDV du mois regroupés par `dayKey` (« YYYY-MM-DD »), triés intra-jour. */
export async function getRdvMonth(year: number, month: number): Promise<Map<string, UnifiedRdv[]>> {
  const rows = await fetchAllCalendly();
  const prefix = `${year}-${String(month).padStart(2, "0")}`;
  const byDay = new Map<string, UnifiedRdv[]>();
  for (const r of rows) {
    if (!r.dayKey.startsWith(prefix)) continue;
    const arr = byDay.get(r.dayKey);
    if (arr) arr.push(r);
    else byDay.set(r.dayKey, [r]);
  }
  for (const arr of byDay.values()) sortWithinDay(arr);
  return byDay;
}
