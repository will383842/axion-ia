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

Étiquettes posées : `livre:<nom du fichier>`, `type:regle|script|objection|calcul|posture`,
`chiffres-exercice` (un montant : avertissement en tête), `secteur:sante`,
`doctrine:a-revoir`. Ces trois dernières ne sortent **jamais**.

## 2. Allumer (plus tard)

`METHODE_ACTIVE=true` (Coolify, portée RUN) puis redémarrage. Seule la valeur exacte `true`
allume. Éteinte, `obtenirContexteMethode` rend `{ noyau: null, extraits: [] }` sans lire la base.
`METHODE_STUDIO_OUVERT` et `METHODE_STUDIO_SECRET` sont déclarées mais aucune route ne les lit
encore.

## 3. Ce que rend la couche

`obtenirContexteMethode({ sujet, max? })` rend un noyau et au plus dix extraits de 1 500
caractères, **tous passés par `filtrerPourSortie`** : une fiche avec un montant, un courriel,
un téléphone, une promesse de gain, un témoignage, un ancrage local, ou une des trois
étiquettes interdites, n'est pas rendue. Si le noyau est refusé, il n'est jamais remplacé par une fiche qui n'est pas un noyau ; un autre noyau sain (autre fiche numérotée 00), s'il existe, peut être servi. Pour retrouver un noyau, le fondateur réécrit sa section « essentiel » sans chiffres.

Appelants autorisés aujourd'hui : l'import seul. Tout autre fichier qui importerait la couche
fait échouer `aucun-extrait-prive.spec.ts` : ajouter un appelant est une décision à part.

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
