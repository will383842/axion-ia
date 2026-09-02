/**
 * `axionia.inbox.recent` — la boîte de réception unifiée, quatre canaux.
 *
 * S'appuie sur l'agrégateur `admin-inbox` (`listInbox`), rendu SANS SESSION au
 * lot 4a. Un appel MCP n'a pas de cookie de navigateur : le « non lu » est un
 * état PAR PERSONNE, donc sans admin courant il n'existe pas — il n'est pas
 * publié plutôt que faux.
 *
 * ═══ CE QUI NE SORT PAS, ET POURQUOI ═══
 *
 * · Aucun lien de console : le préfixe d'administration est un segment de
 *   sécurité, et un lien dans une réponse vocale finirait dans une
 *   transcription. L'identifiant `id` est opaque ; la console le résout.
 * · Aucune coordonnée (e-mail, téléphone) : décision W-6 par défaut, rôle le
 *   plus faible.
 * · Le canal « candidature » ne rend NI nom NI adresse tant que le rôle de
 *   l'adaptateur n'ouvre pas le dossier de candidat. Les lignes restent —
 *   comptées, datées —, l'identité non.
 */

import { z } from "zod/v4";

import { listInbox, PER_CHANNEL_FETCH } from "@/features/admin-inbox/queries";

import { definirOutil } from "../contrat";
import { iso, meta, schemaSortieAvecSynthese, SchemaPage } from "../sortie";

export const VERSION = "1.0.0";

const CANAUX = ["appel", "message", "candidature", "podcast"] as const;

const LIMITE_PAR_DEFAUT = 25;
const LIMITE_MAXIMALE = 30;

const Entree = z.strictObject({
  canal: z.enum(CANAUX).optional(),
  seulementAction: z.boolean().optional(),
  page: SchemaPage.optional(),
  limite: z.number().int().min(1).max(LIMITE_MAXIMALE).optional(),
});

const Item = z.strictObject({
  /** Identifiant de la ligne dans sa source. Opaque pour le socle. */
  id: z.string().min(1),
  canal: z.enum(CANAUX),
  recuLe: z.iso.datetime(),
  objet: z.string(),
  contact: z.string().nullable(),
  /** Rang 2 — retiré au deuxième palier de compaction. */
  contexte: z.string().nullable().optional(),
  /** Rang 2. */
  statut: z.string().optional(),
  aAgir: z.boolean(),
});

const Compteurs = z.strictObject({
  appel: z.number().int().min(0),
  message: z.number().int().min(0),
  candidature: z.number().int().min(0),
  podcast: z.number().int().min(0),
});

const Synthese = z.strictObject({
  total: z.number().int().min(0),
  parCanal: Compteurs,
  aAgir: z.number().int().min(0),
  aAgirParCanal: Compteurs,
});

const Sortie = schemaSortieAvecSynthese(Item, Synthese);

export const inboxRecent = definirOutil({
  name: "inbox.recent",
  version: VERSION,
  description:
    "Ce qui est arrivé : appels réservés, messages, candidatures et demandes de " +
    "tournage, dans l'ordre chronologique, avec ce qui reste à traiter par canal.",
  effect: "read",
  dataClass: "personal",
  idempotency: "n/a",
  pagination: "page",
  input: Entree,
  output: Sortie,
  maxBytes: 20_480,
  compaction: { free: ["objet", "contexte"], tier2: ["contexte", "statut"], aggregateBy: "canal" },
  idFields: ["id"],
  governanceFields: [],
  fixtureMax: "fixtures/inbox-recent.max.json",
  async handler(entree, ctx) {
    const limite = entree.limite ?? LIMITE_PAR_DEFAUT;
    const page = entree.page ?? 1;
    // `exactOptionalPropertyTypes` : une clé absente et une clé `undefined` ne
    // sont pas la même chose pour la couche service — on n'envoie que ce qui est.
    const resultat = await listInbox({
      ...(entree.canal !== undefined ? { channel: entree.canal } : {}),
      ...(entree.seulementAction !== undefined ? { onlyAction: entree.seulementAction } : {}),
      page,
      pageSize: limite,
      adminUserId: null,
      peutVoirAppels: ctx.habilitations.peutVoirAppels,
      roleAdmin: ctx.habilitations.roleConsole,
    });

    return {
      items: resultat.rows.map((ligne) => ({
        id: ligne.sourceId,
        canal: ligne.channel,
        recuLe: iso(ligne.receivedAt) ?? new Date(0).toISOString(),
        objet: ligne.subject,
        contact: ligne.contactName,
        contexte: ligne.context,
        statut: ligne.statusLabel,
        aAgir: ligne.needsAction,
      })),
      meta: meta({
        returned: resultat.rows.length,
        hasMore: page < resultat.totalPages,
        sourceIncomplete: resultat.truncated,
        sourceNote: resultat.truncated
          ? `au moins un canal a atteint sa fenêtre de ${String(PER_CHANNEL_FETCH)} éléments : ` +
            "les plus anciens de ce canal ne sont pas comptés."
          : null,
        failedSources: resultat.failedChannels,
        version: VERSION,
        asOf: new Date(),
      }),
      synthese: {
        total: resultat.total,
        parCanal: resultat.countsByChannel,
        aAgir: resultat.actionCount,
        aAgirParCanal: resultat.actionByChannel,
      },
    };
  },
});
