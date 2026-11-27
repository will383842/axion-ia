fix(seo) : verrou « noindex ⇒ hors plan du site » et commentaires périmés corrigés (S2-4)

Fiche S2-4 de `docs/pilotage-seo-geo/S2-TRI-INDEXATION.md`. Aucun changement de comportement : seuls des commentaires et un test changent.

## Commentaires corrigés (aucun code exécutable touché)

- `src/app/sitemap.ts` (pages service × ville) : elles ne sont plus « indexables » depuis la décision du 18/11/2026 ; ne les remettre au plan du site que si la page repasse indexable.
- `src/app/sitemap.ts` (glossaire) : seuil de 120 mots (et non 80), sur la prose française.
- `src/app/sitemap-news-evergreen.xml/route.ts` (deux endroits) : passé 90 jours, l'actualité est archivée et sa page est une « pierre tombale » en noindex, elle n'« reste » pas indexable.
- `src/app/[locale]/presse/[slug]/page.tsx` : seuil de 60 mots sans PDF (et non 250). Même ligne que dans la PR S2-2, la fusion se fait sans conflit.

## Verrou général (`tests/unit/seo/sitemap-hygiene.spec.ts`)

Test de table : pour chaque famille (villes, glossaire, FAQ, livres, galerie, presse, blog), la page et le plan du site appellent la même fonction d'indexabilité. Si l'un des deux dérive, le test rougit. Le helper `sansCommentairesStrict` évite qu'un `/*` placé dans un commentaire de ligne n'avale le code, et il a son propre test. Un test vérifie aussi que les commentaires périmés ne reviennent pas.

## À savoir

Les lignes **galerie** et **presse** dépendent des modules partagés créés par les PR S2-1 et S2-2, pas encore fusionnées dans cette base : elles sont ignorées tant que ces modules n'existent pas, et deviennent exigeantes dès leur fusion. Vérifié sur un arbre où les trois branches sont fusionnées : 31 tests verts, aucun ignoré. Une fois S2-1 et S2-2 fusionnées, on pourra retirer la condition `exigeSiExiste`.

## Ce qui ne change pas

Aucune page supprimée, aucune URL, aucune balise robots, aucun contenu visible, aucune migration. Aucun JavaScript client.

## Vérifications

- Test écrit d'abord : le test des commentaires périmés échoue sans les corrections.
- `tsc --noEmit` vert ; `tests/unit/seo/sitemap-hygiene.spec.ts` : 17 verts, 2 ignorés (voir plus haut).
- Relecture Opus en deux tours : le 1er tour a demandé 6 corrections (faux vert livres, jeton FAQ trop large, commentaire oublié, faux bloc de commentaire qui aurait fait échouer la ligne galerie après S2-1…), toutes faites ; le 2e tour porte sur le code final.

VERDICT OPUS : BON
