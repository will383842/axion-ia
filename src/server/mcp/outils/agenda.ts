/**
 * `axionia.agenda.jour` et `axionia.agenda.semaine` — ce qui occupe l'agenda.
 *
 * S'appuie sur `getAgendaFenetre` (`admin-agenda`), « prêt en l'état » selon
 * le cahier des charges : il fusionne les réservations en base et l'agenda
 * Google (donc Calendly et l'iPhone), dédupliqué. Aucune session requise.
 *
 * `pagination: "none"` — `getAgendaFenetre` n'a ni `limit` ni curseur (§ 13.1).
 * La fenêtre est bornée par l'outil : un jour, ou sept.
 *
 * ═══ LES DEUX ÉTAGES DE VÉRITÉ SUR LA SOURCE ═══
 *
 * · Google injoignable → `failedSources: ["google"]`. La journée revient avec
 *   les seules réservations, et le socle SAIT qu'il lui manque une source.
 * · Google a coupé sa liste → `sourceIncomplete: true`. Distinct de la
 *   compaction du socle.
 * · Google non configuré n'est PAS une panne : c'est dit dans `sourceNote`.
 */

import { z } from "zod/v4";

import { getAgendaFenetre } from "@/features/admin-agenda/queries";
import { fromParisLocalInput } from "@/lib/calendar-grid";

import { definirOutil } from "../contrat";
import { iso, meta, SchemaJour, schemaSortie } from "../sortie";

export const VERSION = "1.0.0";

const SOURCES = ["calendly", "google", "console"] as const;
const FORMATS = ["telephone", "visio", "inconnu"] as const;

const Item = z.strictObject({
  /** Clé de l'élément dans sa source (`cal_…`, `gg_…`). Opaque. */
  id: z.string().min(1),
  source: z.enum(SOURCES),
  titre: z.string(),
  debut: z.iso.datetime().nullable(),
  fin: z.iso.datetime().nullable(),
  journeeEntiere: z.boolean(),
  occupe: z.boolean(),
  jour: SchemaJour,
  /** Masqué (null) sans habilitation — décision W-6 par défaut. */
  contact: z.string().nullable(),
  format: z.enum(FORMATS),
  annule: z.boolean(),
  /** Rang 2. */
  lieu: z.string().nullable().optional(),
  /** Rang 2. */
  note: z.string().nullable().optional(),
});

const Sortie = schemaSortie(Item);

const JOURS_D_UNE_SEMAINE = 7;

/** Minuit à Paris pour un jour civil « YYYY-MM-DD », ou `null` si la forme est fausse. */
function minuitParis(jour: string): Date | null {
  return fromParisLocalInput(`${jour}T00:00`);
}

/** Le jour civil `n` jours après `jour`, en calendrier UTC (les jours civils n'ont pas d'heure). */
function jourPlus(jour: string, n: number): string {
  const [a, m, j] = jour.split("-").map(Number);
  const d = new Date(Date.UTC(a ?? 1970, (m ?? 1) - 1, (j ?? 1) + n));
  return d.toISOString().slice(0, 10);
}

async function lireFenetre(premierJour: string, nbJours: number, peutVoirAppels: boolean) {
  const debut = minuitParis(premierJour);
  const fin = minuitParis(jourPlus(premierJour, nbJours));
  if (debut === null || fin === null) {
    throw new Error("jour civil illisible — attendu YYYY-MM-DD");
  }
  const fenetre = await getAgendaFenetre(debut, fin, peutVoirAppels);
  const diag = fenetre.diagnostics;

  const failedSources = diag.googleConfigure && !diag.googleOk ? ["google"] : [];
  let sourceNote: string | null = null;
  if (!diag.googleConfigure) {
    sourceNote = "agenda Google non configuré : seules les réservations en base sont listées.";
  } else if (diag.googleTronque) {
    sourceNote = "l'agenda Google a coupé sa liste : la fenêtre est incomplète côté Google.";
  }

  return {
    items: fenetre.items.map((it) => ({
      id: it.key,
      source: it.source,
      titre: it.titre,
      debut: iso(it.debut),
      fin: iso(it.fin),
      journeeEntiere: it.journeeEntiere,
      occupe: it.occupe,
      jour: it.jour,
      contact: it.contact,
      format: it.format,
      annule: it.annule,
      lieu: it.lieu,
      note: it.note,
    })),
    meta: meta({
      returned: fenetre.items.length,
      sourceIncomplete: diag.googleTronque,
      sourceNote,
      failedSources,
      version: VERSION,
      asOf: new Date(),
    }),
  };
}

export const agendaJour = definirOutil({
  name: "agenda.jour",
  version: VERSION,
  description:
    "Tout ce qui occupe une journée : réservations en ligne, agenda personnel et " +
    "indisponibilités posées depuis la console, fusionnés et triés.",
  effect: "read",
  dataClass: "personal",
  idempotency: "n/a",
  pagination: "none",
  input: z.strictObject({ jour: SchemaJour }),
  output: Sortie,
  maxBytes: 20_480,
  compaction: { free: ["titre", "note"], tier2: ["lieu", "note"], aggregateBy: "source" },
  idFields: ["id"],
  governanceFields: [],
  fixtureMax: "fixtures/agenda-jour.max.json",
  handler: (entree, ctx) => lireFenetre(entree.jour, 1, ctx.habilitations.peutVoirAppels),
});

export const agendaSemaine = definirOutil({
  name: "agenda.semaine",
  version: VERSION,
  description:
    "Les sept jours à partir d'une date : réservations, agenda personnel et " +
    "indisponibilités, fusionnés et triés, avec le jour civil de chaque élément.",
  effect: "read",
  dataClass: "personal",
  idempotency: "n/a",
  pagination: "none",
  input: z.strictObject({ depuis: SchemaJour }),
  output: Sortie,
  maxBytes: 49_152,
  compaction: { free: ["titre", "note"], tier2: ["lieu", "note"], aggregateBy: "jour" },
  idFields: ["id"],
  governanceFields: [],
  fixtureMax: "fixtures/agenda-semaine.max.json",
  handler: (entree, ctx) =>
    lireFenetre(entree.depuis, JOURS_D_UNE_SEMAINE, ctx.habilitations.peutVoirAppels),
});
