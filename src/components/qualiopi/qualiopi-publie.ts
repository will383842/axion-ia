import { getQualiopiPublicIdentity } from "@/server/qualiopi/config/public-identity";

/**
 * Vrai seulement si l'identité Qualiopi PUBLIQUE existe (divulgation activée et
 * certification obtenue). Ne rend qu'un booléen : les surfaces publiques hors
 * zone (ex. la colonne d'actions d'un article) n'ont pas besoin de la donnée,
 * et n'importent donc pas le domaine — elles passent par cette zone dédiée.
 */
export async function isQualiopiPublie(): Promise<boolean> {
  return (await getQualiopiPublicIdentity()) != null;
}
