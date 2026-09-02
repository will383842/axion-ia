/**
 * `axionia.rendezvous.list` — les rendez-vous réservés (Calendly ; Booking gelé).
 *
 * S'appuie sur `listRendezVous` (`admin-rendezvous`) — sans session.
 *
 * ⚠️ LA SOURCE LIT AU PLUS `MAX_FETCH_CALENDLY` LIGNES avant de filtrer et de
 *    paginer. Quand le total atteint ce plafond, la fenêtre est incomplète du
 *    côté de la source — c'est `sourceIncomplete`, pas une compaction du socle.
 *
 * ═══ CE QUI EST MASQUÉ SANS HABILITATION (W-6, défaut) ═══
 *
 * Le nom du contact, les notes (saisies par le prospect, souvent avec ses
 * coordonnées) : `null`. Le titre reste le nom du type de rendez-vous.
 * E-mail et téléphone ne sont pas dans le schéma du tout.
 */

import { z } from "zod/v4";

import { listRendezVous, MAX_FETCH_CALENDLY } from "@/features/admin-rendezvous/queries";
import { RDV_STATUS_LABELS, type RdvStatus } from "@/features/admin-rendezvous/types";

import { definirOutil } from "../contrat";
import { iso, meta, SchemaJour, SchemaPage, schemaSortie } from "../sortie";

export const VERSION = "1.0.0";

/** Dérivé de la table des libellés de la console — jamais recopié. */
const STATUTS = Object.keys(RDV_STATUS_LABELS) as [RdvStatus, ...RdvStatus[]];
const FORMATS = ["telephone", "visio", "inconnu"] as const;

const LIMITE_PAR_DEFAUT = 25;
const LIMITE_MAXIMALE = 50;

const Entree = z.strictObject({
  statut: z.enum(STATUTS).optional(),
  /** Jour civil inclus. */
  depuis: SchemaJour.optional(),
  /** Jour civil inclus. */
  jusqua: SchemaJour.optional(),
  page: SchemaPage.optional(),
  limite: z.number().int().min(1).max(LIMITE_MAXIMALE).optional(),
});

const Item = z.strictObject({
  /** Identifiant de l'événement dans sa source. Opaque. */
  id: z.string().min(1),
  titre: z.string(),
  debut: z.iso.datetime().nullable(),
  fin: z.iso.datetime().nullable(),
  heureConfirmee: z.boolean(),
  jour: SchemaJour,
  statut: z.enum(STATUTS),
  contact: z.string().nullable(),
  format: z.enum(FORMATS),
  /** Rang 2. Masqué sans habilitation. */
  notes: z.string().nullable().optional(),
});

export const rendezVousList = definirOutil({
  name: "rendezvous.list",
  version: VERSION,
  description:
    "Les rendez-vous réservés en ligne, filtrables par statut et par période, " +
    "avec leur créneau et leur format (téléphone ou visio).",
  effect: "read",
  dataClass: "personal",
  idempotency: "n/a",
  pagination: "page",
  input: Entree,
  output: schemaSortie(Item),
  maxBytes: 32_768,
  compaction: { free: ["titre", "notes"], tier2: ["notes"], aggregateBy: "statut" },
  idFields: ["id"],
  governanceFields: [],
  fixtureMax: "fixtures/rendezvous-list.max.json",
  async handler(entree, ctx) {
    const limite = entree.limite ?? LIMITE_PAR_DEFAUT;
    const page = entree.page ?? 1;
    const visible = ctx.habilitations.peutVoirAppels;
    const resultat = await listRendezVous({
      ...(entree.statut !== undefined ? { status: entree.statut } : {}),
      ...(entree.depuis !== undefined ? { from: entree.depuis } : {}),
      ...(entree.jusqua !== undefined ? { to: entree.jusqua } : {}),
      page,
      pageSize: limite,
    });
    const incomplet = resultat.total >= MAX_FETCH_CALENDLY;

    return {
      items: resultat.rows.map((r) => ({
        id: r.sourceRecordId,
        titre: r.title,
        debut: iso(r.startTime),
        fin: iso(r.endTime),
        heureConfirmee: r.timeConfirmed,
        jour: r.dayKey,
        statut: r.status,
        contact: visible ? r.contactName : null,
        format: r.format,
        notes: visible ? r.notes : null,
      })),
      meta: meta({
        returned: resultat.rows.length,
        hasMore: page * limite < resultat.total,
        sourceIncomplete: incomplet,
        sourceNote: incomplet
          ? `la source ne lit que les ${String(MAX_FETCH_CALENDLY)} rendez-vous les plus récents.`
          : null,
        version: VERSION,
        asOf: new Date(),
      }),
    };
  },
});
