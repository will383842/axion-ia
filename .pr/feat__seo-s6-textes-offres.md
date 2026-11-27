S6-2 · Textes de la FAQ géographique sans allégation ni promesse

Fiche : `docs/pilotage-seo-geo/S6-VILLES.md`, § 7, S6-2.

## Ce que fait cette PR

- `LocalGeoFaqSection.tsx` : retire les phrases que la fiche interdit, en français et en anglais : « premiers pôles / premier terrain d'intervention », « part importante de nos missions », « aux mêmes conditions que Paris », « nos consultants sont mobiles », « au cœur de notre activité », « la majorité de nos projets », « no geographic surcharge », « same rate regardless of location », « Douze régions », seuil de « 5 000 habitants ». Aucune phrase nouvelle ne promet un prix, un délai ou une présence : on lit « partout en France », « dans vos locaux », « sur devis ».
- Retire aussi les promesses du même genre trouvées à la relecture : « nous nous déplaçons systématiquement », « cas clients à proximité », « éligible sans condition », « sans aucune perte de qualité ».
- Le test `villes-sans-frais-ni-fausse-presence.spec.ts` lit maintenant aussi les cinq fichiers de pages (FAQ géographique, section de couverture, hub France, page région, gabarit par-ville) avec les motifs FRAIS, PRESENCE et ANGLAIS, une liste de motifs d'allégations (avec une phrase d'exemple en français et en anglais pour chacun) et l'absence du nom de la ville du siège.

## Ce qui ne change pas

Aucune URL, aucun JavaScript, aucun fichier gelé (`legal.ts`, `pricing.ts`, etc.). La variante servie est celle de `/sites-web-augmentes` ; les autres variantes de la FAQ ne sont rendues par aucune page, mais sont corrigées pour ne pas ressortir un jour.

## Vérifications

- `pnpm typecheck` : propre.
- `vitest` ciblé (`villes-sans-frais-ni-fausse-presence`, `allegations-non-prouvees`) : 118 tests verts. Test rouge avant le correctif (10 échecs sur la FAQ), vert après.
- `prettier --check` : propre.

## À savoir (hors périmètre)

Des phrases proches existent ailleurs et ne sont pas touchées ici : `a-propos/page.tsx`, `formations/page.tsx`, `copy/paris.ts` (page `noindex`), et dans `VilleServicePageTemplate.tsx` « Devis sous 48 h ouvrées » et « applicable à l'identique ». À trancher par Will.

VERDICT OPUS : BON
