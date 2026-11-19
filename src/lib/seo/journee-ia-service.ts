// Le nœud JSON-LD « Service » de La Journée IA, construit à UN seul endroit.
//
// La landing `/fr/journee-ia` et l'accueil `/fr` émettent tous les deux ce nœud :
// ils l'appellent ici, ce qui garantit qu'ils sont identiques octet pour octet
// (un seul `@id`, un seul prix, une seule description). Le prix vient de
// `JOURNEE_IA_TIER` : rien n'est écrit à la main.
//
// `Organization`, `WebSite` et `Person` restent émis par le layout
// (`src/app/[locale]/layout.tsx`) : le nœud les référence par `@id`, sans les
// réémettre.

import { DESCRIPTION_SERVICE_JOURNEE_IA, remplacerJetons } from "@/content/journee-ia-commun";
import { JOURNEE_IA_TIER, prixAffichable } from "@/content/pricing";
import { JOURNEE_IA_SERVICE_ID, SITE_URL, buildServiceJsonLd } from "@/lib/seo";

/** `@id` du nœud Service de La Journée IA (source : `@/lib/seo`, lu aussi par l'Organization). */
export { JOURNEE_IA_SERVICE_ID };

/** `@id` de la WebPage de la landing, que le Service désigne comme page principale. */
export const JOURNEE_IA_WEBPAGE_ID = `${SITE_URL}/fr/journee-ia#webpage`;

/** `@id` de l'Organization, émise par le layout. */
const ORGANIZATION_ID = `${SITE_URL}/#organization`;

export function buildJourneeIaServiceJsonLd() {
  const prix = JOURNEE_IA_TIER.priceFlat;
  if (prix === undefined) {
    throw new Error("JOURNEE_IA_TIER doit porter un prix ferme (priceFlat).");
  }
  return buildServiceJsonLd({
    locale: "fr",
    path: "/journee-ia",
    id: JOURNEE_IA_SERVICE_ID,
    name: "La Journée IA",
    description: remplacerJetons(DESCRIPTION_SERVICE_JOURNEE_IA),
    priceEur: prix,
    // R7 : la Journée IA est le seul palier dont le montant reste public (interrupteur coupé).
    prixPublic: prixAffichable(JOURNEE_IA_TIER),
    serviceType: "Audit et formation à l’IA en entreprise",
    areasServed: [{ type: "Country", name: "France" }],
    availableChannels: [{ name: "Dans les locaux du client, partout en France" }],
    providerId: ORGANIZATION_ID,
    audience: { audienceType: "PME et TPE", minEmployees: 5, maxEmployees: 249 },
    offer: {
      unitText: "journée",
      unitCode: "DAY",
      valueAddedTaxIncluded: false,
      eligibleCustomerType: "http://purl.org/goodrelations/v1#Business",
      sellerId: ORGANIZATION_ID,
    },
    termsOfService: `${SITE_URL}/fr/conditions-generales`,
    mainEntityOfPageId: JOURNEE_IA_WEBPAGE_ID,
  });
}
