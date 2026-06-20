/**
 * Qualiopi — Données de certification pour le JSON-LD `Organization.hasCredential`.
 *
 * Pont entre la couche qualiopi (DB-sourcée, gated Phase B) et `buildOrganizationJsonLd`
 * (générique, dans `@/lib/seo`). Le layout importe CE helper (`@/components/qualiopi/`,
 * pas un marqueur d'isolation) puis passe le résultat au builder — ainsi
 * `seo.ts` et `layout.tsx` n'importent jamais le module qualiopi.
 *
 * Renvoie `null` hors Phase B (cf. `getQualiopiPublicIdentity`). La `description`
 * réutilise la mention obligatoire verbatim (`formatMentionMarqueQualiopi`) +
 * la validité si renseignée — SSOT unique de la mention légale.
 */

import { getQualiopiPublicIdentity } from "@/server/qualiopi/config/public-identity";
import { formatMentionMarqueQualiopi } from "@/server/qualiopi/legal/legal-mentions";

export async function getQualiopiCredentialForJsonLd(): Promise<{
  number: string;
  description: string;
  issuer?: string;
} | null> {
  const id = await getQualiopiPublicIdentity();
  if (!id) return null;

  let description = formatMentionMarqueQualiopi(id.categoriesCertifiees);
  if (id.qualiopiValidite) {
    description += ` Certification valable jusqu'au ${id.qualiopiValidite}.`;
  }

  return {
    number: id.qualiopiNumero,
    description,
    ...(id.qualiopiOrganisme ? { issuer: id.qualiopiOrganisme } : {}),
  };
}
