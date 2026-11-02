/**
 * Contrat v1 de la réception : schéma strict (tout champ inconnu est refusé).
 * Les messages de zod ne sont JAMAIS renvoyés ni journalisés (ils peuvent citer une valeur).
 */
import { z } from "zod";

export const TYPES_EVENEMENT = [
  "session_ouverte",
  "etape_validee",
  "entretien_valide",
  "audit_termine",
  "rapport_brouillon",
] as const;

export const SOURCES_RAPPORT = ["claude_code_pc", "gabarit"] as const;

export const MAX_DONNEES_OCTETS = 64 * 1024;
export const MAX_CORPS_OCTETS = 512 * 1024;
export const MAX_LOT = 50;
export const MAX_EVENEMENTS_SESSION = 5000;
/** seq borné : un numéro démesuré ne doit jamais pouvoir coûter du calcul côté base. */
export const MAX_SEQ = 2 * MAX_EVENEMENTS_SESSION;

// La taille de `donnees` (64 Ko en OCTETS) est contrôlée événement par événement dans reception.ts :
// un événement trop gros est rejeté seul, il ne fait pas refuser tout le lot.
const donnees = z.record(z.string(), z.unknown());

const evenement = z
  .object({
    eventId: z.string().uuid(),
    seq: z.number().int().min(1).max(MAX_SEQ),
    type: z.enum(TYPES_EVENEMENT),
    etape: z.string().min(1).max(40),
    etapeIndex: z.number().int().min(0).max(7),
    etapesTotal: z.literal(7),
    heurePC: z.string().datetime({ offset: true }),
    donnees,
    empreinte: z.string().regex(/^[0-9a-fA-F]{64}$/),
  })
  .strict();

export const corpsLotSchema = z
  .object({
    schema: z.literal("audit-terrain.evenements/1"),
    sessionId: z.string().uuid(),
    outilVersion: z.string().min(1).max(40),
    mode: z.literal("reel"),
    lot: z.array(evenement).min(1).max(MAX_LOT),
  })
  .strict();

export const donneesRapportSchema = z.object({ source: z.enum(SOURCES_RAPPORT) }).passthrough();

export type CorpsLot = z.infer<typeof corpsLotSchema>;
export type EvenementRecu = CorpsLot["lot"][number];
