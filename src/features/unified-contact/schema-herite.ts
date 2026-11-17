import { z } from "zod";
import { unifiedContactBase } from "@/lib/schemas/unified-contact-schema";

/**
 * Forme HÉRITÉE (champ unique `nom`) : SERVEUR SEULEMENT, pour une page ouverte
 * avant la mise en ligne qui envoie encore `nom` — zéro demande perdue.
 * Volontairement hors du module de schéma importé par le formulaire : le
 * paquet du navigateur ne doit pas la porter.
 */
export const unifiedContactSchemaHerite = unifiedContactBase.extend({
  nom: z.string().trim().min(2, "Nom requis (2 caractères minimum).").max(80, "Nom trop long."),
});
