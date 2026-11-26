# Contre-relecture · Studio PR #1766 « Pinterest, PR 0 », après corrections

- Rôle : auditeur, lecture seule. Aucune ligne du Studio n'a été modifiée.
- Relu : `git diff origin/master...FETCH_HEAD` (`feat/pinterest-pr0`, tête `e5a7e9fe`, master `65dcd08f`), et le commit de
  corrections seul (`git diff 048a8c6d e5a7e9fe` : 3 fichiers, 14 lignes changées, test non modifié).
- Référence : `revues/relecture-studio-pr0.md` (branche `verdict/studio-pr0`), section 5, C-1 à C-7.
- Test lancé : `tests/reseaux/regles-officielles.test.ts` sur `e5a7e9fe` (copie de `docs/` et `tests/`, Vitest d'axion-ia, config
  minimale) → **7 réussis, 1 sauté** (`MOTS_FONDATEUR` absent ; contrôle des noms privés fait à la main ci-dessous). Le test
  confronte ligne à ligne le `.md` au `.json` : la cohérence JSON/MD des cellules modifiées est donc vérifiée.

## Corrections

| Correction                                                                         | État          | Constat                                                                                                                                                                                                                                       |
| ---------------------------------------------------------------------------------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C-1 · « 125 » retiré de la cellule officielle `texte_alternatif`                   | **faite**     | `.json` et `.md` : « 500 signes au plus sur Pinterest ». Le 125 ne reste que dans la note de `ALT_MAX_PINTEREST` (qui parle du code).                                                                                                         |
| C-2 · `site.domaine` présenté comme existant                                       | **faite**     | `0015:22` « réglage `site.domaine`, créé en PR 3, défaut = hôte de `BASE_PUBLIQUE` » (`contrat.ts:100` vérifié) ; réutilisation de `lienDeChezNous` (`zernio-inbox-corps.ts:76` vérifié) avec égalité stricte d'hôte. Voir N-1.               |
| C-3 · ADR-0012 durcie sans le dire                                                 | **faite**     | `0015:26` « signale un doublon et le fondateur tranche » ; comparaison sur les « contenus déjà publiés ou programmés » ; « Aucun amendement de l'ADR-0012 ». Conforme à `0012:15`.                                                            |
| C-4 · 210 min non sourcé, lieu des heures absent                                   | **faite**     | `0015:28` : 210 = plus petit écart (17:30 → 21:00), « écart conseillé de la cadence (message, pas refus) », conforme à `reglages.ts:223-224` ; heures dans `REGLAGES_CADENCE_DEFAUT.reseaux.pinterest`, jamais codées dans la page. Voir N-2. |
| C-5 · constantes inexistantes présentées comme dans le code                        | **faite**     | `valeur_code` « 1 (à poser en PR 3) » et « 500 signes (à poser en PR 3) », identiques dans `.json` et `.md`.                                                                                                                                  |
| C-6 · régénération de l'extrait, préalable de la PR 3                              | **faite**     | `0015:61` « préalable de la PR 3 (avant la PR 3) » ; les trois cellules restent « inconnu ». (Redondance « préalable … (avant la PR 3) », sans effet.)                                                                                        |
| C-7a · « pas de boîte de réception » sans source                                   | **faite**     | `0015:34` « (doc `reference.mdx`, hors extrait) ».                                                                                                                                                                                            |
| C-7b · `RecyclingConfig` dans la cellule `duplication`                             | **faite**     | Texte vérifié dans l'extrait (`components/schemas/RecyclingConfig/description` : « Content variations are recommended for X and Pinterest to avoid duplicate flags »). Voir N-3.                                                              |
| C-7c · « débit » → « débit en rafale (≥ 10) »                                      | **faite**     | `REGLES-OFFICIELLES.md:211`.                                                                                                                                                                                                                  |
| C-7d · fusion des deux lignes « À valider » à mentionner dans la description de PR | **non faite** | La description de #1766 ne la mentionne pas (elle parle encore de `git am patches/pinterest-pr0.patch` et ne cite pas le commit de corrections). Nit, sans effet sur les fichiers.                                                            |

## Nouveaux constats (aucun bloquant)

- **N-1 (nit) · `lienDeChezNous` n'est pas strict aujourd'hui.** La fonction accepte les sous-domaines
  (`zernio-inbox-corps.ts:87` : `hote === dom || hote.endsWith(`.${dom}`)`) et n'est pas exportée. « Réutilise `lienDeChezNous`
  avec égalité stricte d'hôte » demande donc un changement en PR 3 (option stricte et export), pas une réutilisation telle quelle.
  La phrase précédente de D10 (« ni sous-domaine ») et le test annoncé (« lien hors domaine refusé ») lèvent l'ambiguïté ;
  suggestion : « … avec une option d'égalité stricte d'hôte, à ajouter en PR 3 (elle accepte les sous-domaines aujourd'hui) ».
  La formulation de C-2 dans la première relecture portait la même ambiguïté.
- **N-2 (nit) · `REGLAGES_CADENCE_DEFAUT.reseaux.pinterest` n'existe pas encore** (`domaine/cadence/reglages.ts` n'a aucune
  entrée `pinterest`). « Les quatre heures vivent dans » est au présent, comme C-2 et C-5 avant correction ; ajouter « (entrée à
  créer avec l'import) ».
- **N-3 (nit) · pointeur de la cellule `duplication`.** La phrase `RecyclingConfig` n'est pas sous le pointeur `copie_depot`
  (`…/responses/409`) ; elle est nommée dans la valeur, même convention que la cellule `statistiques` (nit déjà noté). Elle vient
  aussi du contexte du recyclage automatique (copies reprogrammées), pas d'une règle générale sur tout envoi ; la cellule reste
  exacte (« recommande »).
- Exactitude : chaque ajout du commit de corrections a été confronté au code ou à l'extrait du Studio (`BASE_PUBLIQUE`,
  `lienDeChezNous`, `ecartMinMinutes`, `REGLAGES_CADENCE_DEFAUT`, ADR-0012 l. 15, `RecyclingConfig`, réponses 409 et 429) : rien
  d'inexact hors N-1 et N-2.
- Contenu privé : balayage du diff complet et du commit de corrections (IP, adresses, identifiants, prix, noms) : **rien**.
  Les cibles restent des gabarits.

## Bilan

Les corrections C-1 à C-7 sont faites exactement dans les fichiers ; seule la mention dans la description de PR (C-7d) manque.
Les trois nouveaux constats portent sur le temps des verbes et sur un pointeur ; ils peuvent être repris dans la PR 3 sans rouvrir
la PR 0. Le relevé est exact et cohérent, et le test passe.

VERDICT: BON
