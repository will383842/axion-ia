# Pages équipe R2b2 : schémas (vous êtes, partout en France, avant/après, sans chamboulement, Journée IA, services, citations)

## Résumé

Deuxième passe du lot. Les blocs visuels de la fiche équipe sont prêts ; le branchement final dans la fiche reste pour R2d.

- **Villes** : chaque ville de « Partout en France » renvoie vers sa page indexée `/implantations/<région>/<ville>`. Ne restent que les villes qui ont une copie rédigée, qui sont dans la cohorte indexable et dont la région existe : aucun lien vers une page noindex (les pages `/audit/par-ville/*` ne sont plus utilisées).
- **AvantApres** : vrai tableau (`caption` masquée, deux `th scope="col"`, rôles ARIA explicites), cellules « avant » en pointillés, « après » terracotta, flèche en pseudo-élément, survol sous `motion-safe:`.
- **Rassurance** (« sans chamboulement ») : fond foncé avec halo terracotta seul, cinq tuiles à icône, un h3 par tuile.
- **PorteEntree** (Journée IA) : frise de la journée (`FriseEtapes`, déjà fusionnée), étiquettes de moment et chiffres facultatifs (donnés en props, jamais inventés), `GARANTIE_PHRASE` importée, bouton avec `focus-visible:ring-terracotta`.
- **MetiersCollaborateur** (services) : carte mise en avant en premier (fond foncé, halo terracotta), autres cartes à icône, flèche qui glisse sous `motion-safe:`.
- **CitationsTerrain** : première citation en grand avec guillemet SVG décoratif, les autres en grille, `cite` sous chaque citation.
- Chaque composant garde ses props d'origine (`donnees`) et accepte en plus `entete`, `id` (et `moments`, `chiffres`, `auteur` selon le cas) ; sans `entete`, le titre de la donnée sert de H2.

## Fichiers

- `src/lib/equipe/villes-phares.ts` (liens et filtre)
- `src/components/equipe/BlocsTransformation.tsx`, `MetiersCollaborateur.tsx`, `CitationsTerrain.tsx`
- `src/components/equipe/visuels/VousEtes.tsx`, `Silhouettes.tsx`, `PartoutEnFrance.tsx` (première passe)
- `src/components/equipe/__tests__/r2b2-schemas.spec.tsx` (19 tests)
- `src/components/equipe/__tests__/profil-williams.spec.tsx` : attentes des H3 mises à jour, car ces composants sont déjà utilisés par la fiche actuelle (cinq tuiles, cinq étapes de la Journée IA, puis les services). L'assemblage définitif est R2d.

## Vérifications

- `vitest run src/components/equipe src/lib/equipe` : tout vert (dont les 19 tests du lot)
- eslint et prettier : propres sur `src/components/equipe` et `src/lib/equipe`
- `tsc --noEmit` : passe sans erreur
- grep des mots interdits dans `src/components/equipe`, `src/content/equipe`, `src/lib/equipe` : rien en dehors des tests de garde existants
- `pnpm-lock.yaml` : non touché. La branche existante a été reconstruite sur `origin/main` sans réinstallation.

## Relecture Opus (cette passe)

Corrigé : carte « Transformation » désormais mise en avant chez Williams (avant, c'était « Mise en place ») ; aucune carte mise en avant si aucune n'est désignée ; garantie affichée une seule fois (elle est déjà dans l'étape de la frise, avec sa condition) ; `CitationsTerrain` exige `auteur` (prénom du collaborateur, passé par la fiche) ; focus visible sur les liens des services et de la Journée IA.

Écart signalé, non modifié : le plan (§ 4.3) nommait `PourQuiEntreprises` (3 tailles, 10 secteurs, lien `/formations/secteurs`) ; la première passe a livré `VousEtes` (cartes Coût / Action / Gain) et `PartoutEnFrance`. À valider ou aligner avant R2d.

VERDICT OPUS : À CORRIGER — seul reste l'écart `VousEtes` / `PourQuiEntreprises` ci-dessus, à trancher avant l'assemblage (R2d).
