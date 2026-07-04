/**
 * Prospection — Schéma Zod de création de campagne (T6, pur).
 *
 * Applique le garde-fou G1 (ciblage non vide : ≥ 1 secteur OU code NAF) AU
 * BORD de l'entrée (wizard/action), avant même l'orchestrateur. Testable sans DB.
 */

import { z } from "zod";
import {
  SECTEURS,
  TAILLES,
  TYPES_ORGANISATION,
  type Secteur,
  type Taille,
  type TypeOrganisation,
} from "@/lib/prospection/enums";

export const createCampaignSchema = z
  .object({
    nom: z.string().trim().min(1).max(200),
    departements: z.array(z.string().min(1).max(3)).min(1, "au moins un département"),
    secteurs: z.array(z.enum([...SECTEURS] as [Secteur, ...Secteur[]])).default([]),
    nafCodes: z.array(z.string().min(2).max(6)).default([]),
    tailles: z.array(z.enum([...TAILLES] as [Taille, ...Taille[]])).min(1, "au moins une taille"),
    typesOrganisation: z
      .array(z.enum([...TYPES_ORGANISATION] as [TypeOrganisation, ...TypeOrganisation[]]))
      .default([]),
    enrichirContacts: z.boolean().default(true),
    enrichirPersonnes: z.boolean().default(false),
    quotaMax: z.number().int().nonnegative().max(10_000_000).optional(),
    priorite: z.number().int().min(0).max(100).default(0),
    rythme: z.string().max(50).optional(),
  })
  .refine((d) => d.secteurs.length > 0 || d.nafCodes.length > 0, {
    message: "ciblage vide : renseignez au moins un secteur ou un code NAF",
    path: ["secteurs"],
  });

export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;
