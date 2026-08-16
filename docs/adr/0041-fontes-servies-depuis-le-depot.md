# ADR 0041 — Les fontes sont servies depuis le dépôt, plus depuis Google

- **Statut** : accepté
- **Date** : 2026-08-16
- **Contexte** : chantier GEO/AEO, vague 3
- **Remplace** : rien (le choix `next/font/google` n'avait jamais fait l'objet d'un ADR)

## Le problème

`next/font/google` a une propriété que son nom ne dit pas : il va chercher le
CSS sur `fonts.googleapis.com` puis les fichiers `.woff2` sur
`fonts.gstatic.com` **pendant le build**, pas au runtime. Le résultat est bien
auto-hébergé — aucun visiteur ne joint Google — mais **le build de production
dépendait d'un fetch vivant vers un tiers**.

Le 2026-08-16, ce tiers a rendu `404` sur des URLs que son propre CSS venait de
servir aux runners GitHub :

```
Failed to fetch font file from `https://fonts.gstatic.com/s/manrope/v20/xn7KYHE…woff2`.
An error occurred in `next/font`.
TypeError: Cannot read properties of null (reading '1')
> Build failed because of webpack errors
```

Conséquences mesurées le jour même :

- dernier déploiement réussi à **14 h 51** (`cf26c3c`) ; **aucun build passé
  après 15 h 56** ;
- **trois gates rouges** sur du code sain, dont une PR de **documentation pure**
  (#648) et un correctif de chemins d'images (#657) ;
- diagnostic coûteux : le symptôme (`Cannot read properties of null`) ne nomme
  pas la cause, et l'échec est intermittent selon l'edge CDN qui répond au
  runner. Depuis un poste français au même moment, les mêmes URLs répondaient
  `200` — de quoi conclure « flake » et rejouer le job indéfiniment.

Ce point de rupture ne figurait dans **aucun** des 155 constats de l'audit
GEO/AEO du 2026-08-14. On audite les tiers dont dépend une _page_ ; on n'audite
pas ceux dont dépend un _build_.

## La décision

Bascule des quatre familles vers **`next/font/local`**, avec les `.woff2`
versionnés dans `src/fonts/`.

| Famille     | Fichier                                       | Usage                         |
| ----------- | --------------------------------------------- | ----------------------------- |
| Manrope     | `manrope-latin-var.woff2`                     | corps, titres — site public   |
| Fraunces    | `fraunces-latin-var.woff2` + `…-italic.woff2` | serif éditoriale              |
| Inconsolata | `inconsolata-latin-var.woff2`                 | `<code>`, chiffres tabulaires |
| Inter       | `inter-latin-var.woff2`                       | console d'administration      |

**192 Ko au total dans le dépôt.**

### Ce qui ne change pas — et pourquoi on peut l'affirmer

Les fichiers déposés sont **exactement ceux que Google servait** pour ces mêmes
appels, et les déclarations `@font-face` recopient à l'identique celles que son
CSS produisait : mêmes fichiers, mêmes graisses, mêmes styles. Un seul fichier
variable couvre plusieurs graisses parce que c'est déjà ce que Google renvoyait
(`Manrope:wght@400;600` et `Inter:wght@400;500;600;700` pointent chacun sur un
fichier unique).

- **Poids envoyé au visiteur : inchangé.** `next/font/google` plaçait déjà ces
  mêmes octets dans le bundle. Rien n'entre ni ne sort du budget Web Vitals.
- **Sous-ensemble `latin` seulement.** Il couvre le français en entier, `œ`/`Œ`
  compris (`U+0152-0153` en fait partie). Le site est francophone uniquement
  (décision Will du 2026-08-12) ; les sous-ensembles cyrillique, grec et
  vietnamien n'étaient jamais téléchargés par un visiteur.
- **Repli métrique conservé.** `adjustFontFallback: true` n'existe pas en local :
  il faut nommer la fonte-repère. Fraunces prend `"Times New Roman"` — c'est la
  serif que le chargeur Google retenait. Les `size-adjust` / `ascent-override`
  restent calculés sur les métriques du fichier réel, donc la chaîne de repli
  décrite dans `layout.tsx` (et le comportement CLS qu'elle produit) est
  préservée.
- **`preload: false` sur Inconsolata** est conservé tel quel.

### Ce que ça coûte

Rafraîchir une fonte devient un geste **manuel et explicite** au lieu d'être
implicite à chaque build. C'est le prix assumé : une fonte ne change pas de
dessin plus d'une fois tous les quelques années, et un build ne doit pas
dépendre d'un serveur tiers pour aboutir.

## Comment rafraîchir une fonte

1. Récupérer le CSS avec **l'agent utilisateur qu'emploie Next** (c'est lui qui
   décide du format servi ; un autre agent renvoie du `.ttf`) :

   ```
   UA='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/104.0.0.0 Safari/537.36'
   curl -s -A "$UA" 'https://fonts.googleapis.com/css2?family=Manrope:wght@400;600&display=swap'
   ```

2. Y prendre le bloc `/* latin */` — celui dont l'`unicode-range` commence par
   `U+0000-00FF`.
3. Télécharger son `.woff2` dans `src/fonts/`.
4. Reporter les couples graisse/style du CSS dans le tableau `src:` du layout.
5. `pnpm test tests/unit/ci/fontes-build-hermetique.spec.ts` — le garde vérifie
   que chaque fichier cité existe et porte bien la signature `wOF2`.

## Le garde

`tests/unit/ci/fontes-build-hermetique.spec.ts` interdit la récidive :

- aucun fichier de `src/` ne réimporte le chargeur Google ;
- les deux layouts déclarent bien leurs fontes en local (« plus de chargeur
  Google » serait aussi vrai d'un layout qui n'aurait plus aucune fonte) ;
- chaque fichier cité existe — un chemin mort ne casse pas le typecheck, il ne
  casse que le build ;
- chaque fichier est un vrai `woff2` — un fichier vide ou un pointeur LFS
  passerait `existsSync` sans qu'aucun glyphe ne s'affiche ;
- et le fichier de test **s'inspecte lui-même** pour garantir qu'il ne trouve
  pas sa propre documentation, piège déjà payé plusieurs fois dans ce dépôt.

Vu rouge avant d'être vu vert : la réintroduction de l'import Google dans un
layout fait tomber les deux premiers tests.

## Effet de bord à traiter ailleurs

`fonts.googleapis.com` et `fonts.gstatic.com` restent autorisés par la CSP
(`src/lib/csp.ts`). Ces directives n'ont désormais **plus aucun consommateur, ni
au build ni au runtime**. Elles peuvent être retirées — dans une PR qui ne fait
que ça, une CSP ne se resserre pas en passant. La justification du garde-fou
sous-traitants (`src/content/__tests__/subprocessors-coherence.spec.ts`) a été
rectifiée : elle affirmait un mécanisme qui n'existe plus.
