/**
 * Version du gabarit de la pièce d'ORIGINE, pour rendre un duplicata ou une
 * régénération avec la mise en page qu'elle avait à l'émission.
 *
 * Règle du fondateur : une pièce déjà envoyée garde exactement sa mise en page.
 *
 * C'est le même mécanisme que l'exemplaire signé (`exemplaire-signe.ts`) :
 * `metadata.renderData.gabaritVersion` de la ligne `documents_generes`, lue par
 * `versionGabaritInstantane` (absente → 1). Aucune colonne ni migration.
 */
import { prisma } from "@/lib/prisma";
import { versionGabaritInstantane } from "./templates/gabarit-versions";

/**
 * - `documentId` nul : la pièce n'a jamais eu de PDF, donc pas de mise en page à
 *   préserver → `undefined` (version courante) ;
 * - ligne trouvée : version de son instantané, **1 si absente** (pièce émise
 *   avant l'introduction des versions) ;
 * - ligne introuvable : `1`, la lecture prudente de « pas de version enregistrée ».
 */
export async function versionGabaritDeLaPieceOrigine(
  documentId: string | null | undefined,
): Promise<number | undefined> {
  if (documentId === null || documentId === undefined) return undefined;
  const doc = await prisma.documentGenere.findUnique({
    where: { id: documentId },
    select: { metadata: true },
  });
  const meta = doc?.metadata;
  const snapshot =
    typeof meta === "object" && meta !== null && !Array.isArray(meta)
      ? (meta as { renderData?: unknown }).renderData
      : undefined;
  return versionGabaritInstantane(snapshot);
}
