# Couche « Méthode » — mode d'emploi

Décision : [ADR 0076](../adr/0076-couche-methode-collection-separee.md).

La couche « Méthode » range des fiches de vente internes dans la base de connaissance du
site, **à part** du RAG public : audience équipe, confidentialité interne, jamais publiée,
jamais servie à un visiteur. **Ce dépôt est public : aucun contenu de fiche, aucun titre,
aucun montant n'y figure** ; les tests n'utilisent qu'un faux corpus inventé.

> **État : rien n'est ouvert.** Aucun outil MCP, aucune route, aucune lecture par le
> chatbot, aucun générateur de contenu. Interrupteurs éteints par défaut.

## 1. Importer (geste humain, sur un poste, jamais par une routine)

```bash
# Essai à blanc (par défaut) : ne construit même pas de client de base
pnpm tsx scripts/methode/importer-methode.ts --source <copie locale du dossier>

# Avec une liste locale de noms sensibles (un nom par ligne)
pnpm tsx scripts/methode/importer-methode.ts --source <dossier> --noms-sensibles <fichier local>

# Écriture réelle (DATABASE_URL réelle exigée ; refusée sous CI ou sans terminal)
pnpm tsx scripts/methode/importer-methode.ts --source <dossier> --ecrire
```

- Liste blanche : `livres/*.md` et `livres/important-a-savoir/*.md`. Le reste est ignoré et compté.
- Une fiche avec un courriel, un téléphone ou un nom listé est refusée ; le journal donne le
  slug et le motif, jamais le texte.
- Idempotent sur le slug ; jamais de suppression, jamais de publication ; une entrée d'une
  autre source n'est pas touchée.
- Lire le journal de l'essai à blanc avant `--ecrire` : comptes, slugs, motifs seulement.

Le corpus d'abord : le fondateur relit chaque section et pose la marque `sortie: validee` sur
la ligne qui suit son titre. C'est le corpus qui fait foi, pas l'import.

Étiquettes posées : `livre:<nom du fichier>`, `type:regle|script|objection|calcul|posture`,
`chiffres-exercice` (un montant : avertissement en tête), `secteur:sante`,
`doctrine:a-revoir`. Ces trois dernières ne sortent **jamais**.

## 2. Allumer (plus tard)

`METHODE_ACTIVE=true` (Coolify, portée RUN) puis redémarrage. Seule la valeur exacte `true`
allume. Éteinte, `obtenirContexteMethode` rend `{ noyau: null, extraits: [] }` sans lire la base.
`METHODE_STUDIO_OUVERT` et `METHODE_STUDIO_SECRET` ne servent qu'à la porte du Studio
(section « Porte du Studio » ci-dessous).

⚠️ Une valeur autre que `true` ou `false` (par exemple `TRUE` ou `1`) sur `METHODE_ACTIVE` ou
`METHODE_STUDIO_OUVERT`, ou un `METHODE_STUDIO_SECRET` de moins de 32 caractères, **empêche
l'application de démarrer** (validation de `src/env.ts`, sauf si `SKIP_ENV_VALIDATION` est posé).
Mieux vaut laisser la variable absente que mal l'écrire.

## 3. Ce que rend la couche

> ⛔ **La sécurité repose sur l'approbation à la main, section par section. Le filtre n'est
> qu'un filet.** Une section n'est servie que si sa **première ligne** est exactement
> `sortie: validee`, posée par le fondateur dans le corpus, sous le titre de la section.
> Sans cette marque : jamais servie, même saine (le noyau compris). Aucune variante n'est
> tolérée (casse, espace, accent, retrait, mise en forme, marque dans le corps). L'import
> **ne pose jamais** la marque et ne la déduit de rien : il recopie le corpus ; réimporter un
> corpus sans marque la retire (avec `--ecrire`, une entrée refusée ou disparue perd aussi sa ligne de marque, sans être supprimée). La marque doit être sur la ligne qui suit IMMÉDIATEMENT la ligne de titre, telle qu'écrite dans le fichier : retrait, BOM, ligne de mise en page ou « # » intercalée la rendent invalide. Une section dont le corps contient un sous-titre `###`, un titre indenté ou un commentaire HTML n'est pas approuvable. Aucune fonction du code ne peut l'écrire. La ligne de marque
> n'est pas rendue à l'appelant.
>
> **Fiches PDF : dès qu'une ligne du corps d'une section marquée est sautée, supprimée ou
> fusionnée (« # » intercalé, étiquette de mise en page, recollage « -suite »), ou qu'un titre
> « N. » entre dans son corps, la section ENTIÈRE n'est pas servie.**

`obtenirContexteMethode({ sujet, max? })` rend un noyau et au plus dix extraits de 1 500
caractères, **approuvés, puis passés par `filtrerPourSortie`** (second filet) : une fiche avec un montant, un courriel,
un téléphone, une promesse de gain, un témoignage, un ancrage local, ou une des trois
étiquettes interdites, n'est pas rendue. Si le noyau est refusé, il n'est jamais remplacé par une fiche qui n'est pas un noyau ; un autre noyau sain (autre fiche numérotée 00), s'il existe, peut être servi. Pour retrouver un noyau, le fondateur réécrit sa section « essentiel » sans chiffres.

Appelants autorisés aujourd'hui : l'import et la porte du Studio (`src/app/api/internal/methode/studio/route.ts`). Tout autre fichier qui importerait la couche
fait échouer `aucun-extrait-prive.spec.ts` : ajouter un appelant est une décision à part.

## Porte du Studio

`POST /api/internal/methode/studio` : route sœur, **lecture seule**, **fermée par défaut**, avec son
propre secret. Le Studio y envoie un sujet et reçoit des extraits. Elle ne lit que par
`obtenirContexteMethode` : elle ne sert donc que des sections **marquées à la main** puis passées par
`filtrerPourSortie`. Le noyau, les étiquettes et la collection ne sont jamais rendus.

**Ordre des refus** (figé par les tests ; une route fermée ressemble à une route absente) :

| Ordre | Condition                                                                 | Réponse |
| ----- | ------------------------------------------------------------------------- | ------- |
| 1     | `DATABASE_URL` de build hors ligne (`stub.invalid`)                       | 503     |
| 2     | `METHODE_STUDIO_OUVERT` ou `METHODE_ACTIVE` différente de `"true"` exacte | 404     |
| 3     | `METHODE_STUDIO_SECRET` absent ou de moins de 32 caractères               | 503     |
| 4     | plus de 30 appels par minute et par adresse                               | 429     |
| 5     | en-tête `x-methode-secret` absent ou faux (comparaison à temps constant)  | 401     |
| 6     | corps illisible, trop long, ou différent de `{ sujet }`                   | 400     |

Les verbes GET, PUT, PATCH et DELETE rendent 405 (`Allow: POST`). **Toute** réponse, succès comme
refus, porte `Cache-Control: no-store`.

**Entrée** : `{ "sujet": "<2 à 300 caractères>" }`, aucun autre champ. **Sortie** :
`{ "items": [{ "slug", "titre", "texte", "source": "methode" }], "meta": { "returned": N } }`, au plus
5 extraits de 1 500 caractères. Le nombre d'extraits n'est pas réglable par le client. Rien de la
demande ni du texte servi n'est écrit au journal.

**Variables** (noms seulement, jamais de valeur dans le dépôt) : `METHODE_ACTIVE`,
`METHODE_STUDIO_OUVERT`, `METHODE_STUDIO_SECRET`. Aucune configuration commise ne les pose.

**Gestes du fondateur pour l'ouvrir** (décrits ici, jamais faits par l'usine) :

1. G3 : poser `METHODE_ACTIVE=true` sur le site (Coolify, portée RUN), puis redémarrer.
2. G4 : poser le **même** `METHODE_STUDIO_SECRET` (32 caractères au moins) sur le site et sur le
   Studio, puis `METHODE_STUDIO_OUVERT=true` sur le site, puis redémarrer.

Pour refermer : retirer `METHODE_STUDIO_OUVERT` (ou la poser à `false`) ; la route répond 404.

## 4. Où sont les choses

| Quoi                 | Où                                                       |
| -------------------- | -------------------------------------------------------- |
| Découpage (pur)      | `src/server/methode/decoupage.ts`                        |
| Filtre de sortie     | `src/server/methode/filtre-sortie.ts`                    |
| Point d'entrée       | `src/server/methode/index.ts`                            |
| Import               | `scripts/methode/importer-methode.ts`                    |
| Garde de publication | `src/server/actions/knowledge/_transition.ts`            |
| Tests                | `src/server/methode/__tests__/` (faux corpus uniquement) |
| Interrupteurs        | `src/env.ts`, `.env.example` (commentés)                 |
