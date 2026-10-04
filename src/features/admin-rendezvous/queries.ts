// Requêtes RV (read-only, appelées depuis les RSC). V1 : Calendly.
// Fetch + normalisation + filtres/tri/pagination EN MÉMOIRE (volumes admin =
// centaines de lignes). Si un jour Calendly + Booking dépassent quelques
// milliers → basculer vers une vue SQL UNION paginée (cf. plan §risques).
//
// Build-safety (ADR 0026) : au build, `prisma` est un Proxy stub qui renvoie []
// → ces fonctions renvoient vide sans connexion DB. Rien à guarder ici.

import { prisma } from "@/lib/prisma";
import { compterParType, passeLeFiltre } from "./type-rdv";
import type { TypeRendezVous } from "@/server/calendly/type-rendez-vous";
import { fromCalendly, type CalendlyEventRow } from "./normalize";
import type { PublicRdv, RdvAVenir, RdvFilters, RdvPasse, UnifiedRdv } from "./types";
import { etatRendezVous, invitesSupplementaires, momentVisio } from "./visio";
import type { PointLu } from "./point";
import { entrepriseEtBesoin, reponsesFormulaire } from "./a-venir";

export const CAL_SELECT = {
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
  // Un rendez-vous de candidature n'est jamais proposé à l'enregistrement
  // (« Enregistrer cette visio ? », `enregistrementPropose`).
  linkedJobApplicationId: true,
  // Le type classé (lot L3). NULL possible : `fromCalendly` se replie sur le nom.
  typeRendezVous: true,
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

/**
 * Filtre par type de rendez-vous (2026-10-04, lot L3 ; publics du 2026-09-19).
 *
 * Lit `typeRendezVous`, déjà résolu par `fromCalendly` (colonne, sinon nom —
 * double verrou apporteur compris). Filtré en mémoire, comme le reste de ce
 * module. `clients` et `apporteurs` restent acceptés (`passeLeFiltre`).
 *
 * Sans `public`, la liste est rendue telle quelle — les appelants historiques
 * (boîte de réception, outil MCP) ne voient aucune différence.
 */
export function filtrerParPublic<T extends UnifiedRdv>(
  rows: T[],
  cible: PublicRdv | undefined,
): T[] {
  if (!cible) return rows;
  return rows.filter((r) => passeLeFiltre(r.typeRendezVous, cible));
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

export async function listRendezVous(filters: RdvFilters): Promise<{
  rows: UnifiedRdv[];
  total: number;
  /** Décompte par type, tous les AUTRES filtres appliqués (compteurs des onglets). */
  parType: Record<TypeRendezVous, number>;
}> {
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
  // Compté AVANT le filtre de type : chaque onglet annonce ce qu'il montrera.
  const parType = compterParType(rows);
  rows = filtrerParPublic(rows, filters.public);

  const total = rows.length;
  const page = filters.page && filters.page > 0 ? filters.page : 1;
  const pageSize = filters.pageSize && filters.pageSize > 0 ? filters.pageSize : 25;
  const paged = rows.slice((page - 1) * pageSize, page * pageSize);
  return { rows: paged, total, parType };
}

/**
 * Les rendez-vous rattachés à UNE fiche (`linked_submission_id`), du plus
 * récent au plus ancien (2026-09-19).
 *
 * Sert la fiche apporteur : le rattachement automatique pose le lien, encore
 * fallait-il qu'on le voie depuis le dossier. Même normalisation que la liste,
 * donc même statut dérivé (« Passé ») et même format.
 *
 * ⚠️ L'appelant décide du rôle AVANT d'appeler (`peutVoirLesAppels`) : ces
 * lignes portent les coordonnées de l'invité.
 */
export async function listRendezVousDeFiche(submissionId: string): Promise<UnifiedRdv[]> {
  const events = await prisma.calendlyEvent.findMany({
    where: { linkedSubmissionId: submissionId },
    select: CAL_SELECT,
    orderBy: [{ startTime: "desc" }, { capturedAt: "desc" }],
    take: 20,
  });
  const rows = (events as CalendlyEventRow[]).map(fromCalendly);
  rows.sort(
    (a, b) => (b.startTime ?? b.createdAt).getTime() - (a.startTime ?? a.createdAt).getTime(),
  );
  return rows;
}

/**
 * RDV du mois regroupés par `dayKey` (« YYYY-MM-DD »), triés intra-jour.
 *
 * `options.public` est FACULTATIF : sans lui, tout le mois, comme avant.
 */
export async function getRdvMonth(
  year: number,
  month: number,
  options: { public?: PublicRdv } = {},
): Promise<Map<string, UnifiedRdv[]>> {
  const rows = filtrerParPublic(await fetchAllCalendly(), options.public);
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

/** Le point déjà fait : la carte le montre au lieu de le redemander. */
const SUIVI_SELECT = {
  select: {
    issue: true,
    suite: true,
    suiteLe: true,
    note: true,
    decision: true,
    noteSur20: true,
  },
} as const;

type SuiviBrut = {
  issue: NonNullable<RdvAVenir["suivi"]>["issue"];
  suite: NonNullable<RdvAVenir["suivi"]>["suite"];
  suiteLe: Date | null;
  note: string | null;
  decision: "retenu" | "a_revoir" | "non_retenu" | null;
  noteSur20: number | null;
} | null;

type LigneAvecSuivi = CalendlyEventRow & { suivi: SuiviBrut };

function suiviAffiche(s: SuiviBrut): RdvAVenir["suivi"] {
  return s
    ? {
        issue: s.issue,
        suite: s.suite,
        suiteLe: s.suiteLe ? s.suiteLe.toISOString().slice(0, 10) : null,
        note: s.note,
        decision: s.decision,
        noteSur20: s.noteSur20,
      }
    : null;
}

/**
 * Les rendez-vous à venir, du plus proche au plus lointain (2026-09-27).
 *
 * Sert l'onglet « Rendez-vous ». Un rendez-vous y reste jusqu'à 30 minutes
 * après sa fin (`momentVisio`) : c'est pendant l'appel, et juste après, qu'on
 * a le plus besoin de sa carte.
 *
 * Les annulés sont écartés : la carte d'un appel qui n'aura pas lieu est du
 * bruit dans une liste qui répond à « qui j'appelle ? ».
 */
export async function listRendezVousAVenir(
  options: { public?: PublicRdv; maintenant?: Date; limite?: number } = {},
): Promise<RdvAVenir[]> {
  const maintenant = options.maintenant ?? new Date();
  const events = (await prisma.calendlyEvent.findMany({
    where: {
      status: "scheduled",
      // Borne large côté base ; la fenêtre exacte (fin + 30 min) se décide
      // ci-dessous, là où l'heure de fin manquante est gérée.
      startTime: { gte: new Date(maintenant.getTime() - 6 * 3_600_000) },
    },
    select: { ...CAL_SELECT, suivi: SUIVI_SELECT },
    orderBy: [{ startTime: "asc" }],
    take: 200,
  })) as LigneAvecSuivi[];

  const rows = events.flatMap((e): RdvAVenir[] => {
    if (!e.startTime) return [];
    const moment = momentVisio(e.startTime, e.endTime, maintenant);
    if (moment === "terminee") return [];
    const { entreprise, besoin } = entrepriseEtBesoin(reponsesFormulaire(e.rawPayload));
    const base = fromCalendly(e);
    return [
      {
        ...base,
        // `fromCalendly` dérive « Passé » dès la fin ; ici l'appel reste
        // affiché 30 minutes de plus, et il est toujours programmé.
        status: "scheduled",
        // Le début est passé : les boutons du point s'ouvrent, et le restent
        // pendant la grâce. L'AFFICHAGE, lui, lit `etat` (2026-09-28).
        enCours: e.startTime.getTime() <= maintenant.getTime(),
        etat: etatRendezVous(e.startTime, e.endTime, maintenant),
        entreprise,
        besoin,
        autresInvites: invitesSupplementaires(e.rawPayload),
        suivi: suiviAffiche(e.suivi),
      },
    ];
  });
  return filtrerParPublic(rows, options.public).slice(0, options.limite ?? 50);
}

/** Jusqu'où remonte l'onglet « Passés ». */
export const JOURS_PASSES = 90;

/**
 * Les rendez-vous terminés des 90 derniers jours, du plus récent au plus
 * ancien, avec leur point (2026-09-28).
 *
 * Demande de Will : « il ne faudrait pas qu'il bascule sur une page rendez-vous
 * passés ? ». Jusque-là, un rendez-vous dont le point était fait n'était plus
 * visible que depuis sa fiche — et un rendez-vous SANS point disparaissait en
 * silence de « À faire le point » au bout de 30 jours. Ici il reste, marqué
 * « Sans point ».
 *
 * · « terminé » = fin ≤ maintenant (`etatRendezVous`), grâce de 30 minutes
 *   comprise : un rendez-vous qui vient de finir est à la fois sur sa carte
 *   « À venir » et ici — c'est voulu, il est bien terminé ;
 * · les annulés sont exclus : il n'y a rien à constater ;
 * · `no_show` / `completed` posés à la main restent : ce sont des rendez-vous
 *   passés, et leur point est peut-être encore à faire.
 */
export async function listRendezVousPasses(
  options: { public?: PublicRdv; maintenant?: Date; jours?: number } = {},
): Promise<RdvPasse[]> {
  const maintenant = options.maintenant ?? new Date();
  const jours = options.jours ?? JOURS_PASSES;
  const events = (await prisma.calendlyEvent.findMany({
    where: {
      status: { in: ["scheduled", "no_show", "completed"] },
      startTime: {
        gte: new Date(maintenant.getTime() - jours * 86_400_000),
        lte: maintenant,
      },
    },
    select: { ...CAL_SELECT, suivi: SUIVI_SELECT },
    orderBy: [{ startTime: "desc" }],
    take: 500,
  })) as LigneAvecSuivi[];

  const rows = events.flatMap((e): RdvPasse[] => {
    if (!e.startTime || e.status === "canceled") return [];
    if (etatRendezVous(e.startTime, e.endTime, maintenant) !== "termine") return [];
    return [
      {
        ...fromCalendly(e),
        entreprise: entrepriseEtBesoin(reponsesFormulaire(e.rawPayload)).entreprise,
        suivi: suiviAffiche(e.suivi),
      },
    ];
  });
  rows.sort((a, b) => (b.startTime as Date).getTime() - (a.startTime as Date).getTime());
  return filtrerParPublic(rows, options.public);
}

/**
 * Le point de chaque rendez-vous, clé = identifiant Calendly (2026-09-28).
 *
 * Sert la colonne « Statut » de « Appels réservés » : « Passé » ne dit pas si
 * l'échange a eu lieu, le point le dit.
 */
export async function lirePointsDesRendezVous(
  calendlyEventIds: readonly string[],
): Promise<Map<string, PointLu>> {
  const resultat = new Map<string, PointLu>();
  if (calendlyEventIds.length === 0) return resultat;
  const lignes = await prisma.rendezVousSuivi.findMany({
    where: { calendlyEventId: { in: [...calendlyEventIds] } },
    select: { calendlyEventId: true, issue: true, suite: true, decision: true },
  });
  for (const s of lignes) {
    resultat.set(s.calendlyEventId, { issue: s.issue, suite: s.suite, decision: s.decision });
  }
  return resultat;
}
