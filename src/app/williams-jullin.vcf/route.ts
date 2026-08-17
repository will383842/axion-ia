// Fiche contact de Williams Jullin — /williams-jullin.vcf
//
// Cible du QR « ENREGISTRER MON CONTACT » de la carte de visite : le QR encode
// `https://axion-ia.com/qr/vc`, qui redirige ici. Scanner la carte affiche
// directement la fiche contact native du téléphone, prête à enregistrer.
//
// ⚠️ Route racine NON localisée. `.vcf` DOIT figurer dans la liste des
// extensions exclues du `matcher` de `src/proxy.ts`, sinon la règle « 0bis »
// 301 vers `/fr/williams-jullin.vcf` — qui n'existe pas. Cf. le commentaire du
// matcher, qui documente le même piège pour `.html` et `.pdf`.
//
// `force-static` : la fiche est une constante, aucun accès DB ni Redis. Elle
// est donc pré-rendue au build, y compris sous le contrat `stub.invalid`
// (ADR 0026), et ne coûte rien au runtime.
//
// `Content-Disposition: inline` est délibéré : avec `attachment`, Safari iOS
// range le fichier dans Fichiers et impose deux gestes de plus. En `inline`,
// il affiche la fiche et son bouton « Créer un nouveau contact ». Chrome
// Android télécharge de toute façon, et l'URL se terminant par `.vcf`, le nom
// de fichier reste correct.

import { buildVCard, VCARD_FILENAME } from "@/lib/vcard";

export const runtime = "nodejs";
export const dynamic = "force-static";

export function GET(): Response {
  return new Response(buildVCard(), {
    headers: {
      "Content-Type": "text/vcard; charset=utf-8",
      "Content-Disposition": `inline; filename="${VCARD_FILENAME}"`,
      // La fiche ne change qu'à la main : on peut la mettre en cache long côté
      // CDN, tout en gardant une fenêtre courte côté navigateur.
      "Cache-Control": "public, max-age=3600, s-maxage=604800",
      // Une fiche contact n'a rien à faire dans un index de recherche.
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
