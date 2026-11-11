/**
 * MISE À L'ÉCART des contacts de la page guide pour UNE adresse (jamais de suppression).
 *
 * Règle : une opposition ou une demande d'effacement reçue en message privé ne supprime aucune
 * donnée de personne. Les lignes `contacts_guide_reseau` de l'adresse passent à
 * `merci_statut = 'ecarte'` ; l'effacement reste une décision humaine.
 *
 * - Clé : `hashEmailForLookup` (même calcul que `page-confirmation.ts`) ; la marque `email_key = '-'`
 *   d'un jeton consommé n'est donc jamais ciblée.
 * - Idempotent : les lignes déjà `ecarte` (ou `ecartee`, ancienne graphie) ne sont pas réécrites.
 * - Adresse inconnue : zéro ligne, aucune erreur.
 * - Aucune adresse dans les journaux ni dans le retour (un compteur seulement).
 */
import { prisma } from "@/lib/prisma";
import { hashEmailForLookup } from "@/lib/security/email-hash";
import { MERCI_STATUT_ECARTE, MERCI_STATUTS_ECARTES_LUS } from "./merci-statut";

/** Sous-ensemble du client Prisma (ou d'un client de transaction) dont la fonction a besoin. */
export interface ClientMiseAEcart {
  readonly contactGuideReseau: Pick<typeof prisma.contactGuideReseau, "updateMany">;
}

export async function mettreContactsAEcart(
  email: string,
  client: ClientMiseAEcart = prisma,
): Promise<{ readonly ecartes: number }> {
  const emailKey = hashEmailForLookup(email);
  if (!emailKey) throw new Error("[guides-reseau] empreinte d'adresse indisponible");
  const r = await client.contactGuideReseau.updateMany({
    where: { emailKey, merciStatut: { notIn: [...MERCI_STATUTS_ECARTES_LUS] } },
    data: { merciStatut: MERCI_STATUT_ECARTE },
  });
  return { ecartes: r.count };
}
