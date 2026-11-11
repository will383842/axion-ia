# Couche « Méthode » — mode d'emploi

Décision : [ADR 0076](../adr/0076-couche-methode-collection-separee.md).

La couche « Méthode » range les fiches de vente internes d'Axion-IA (livres appliqués,
closing, audit, persuasion, posture, dossier santé) dans la base de connaissance du site,
**à part** du RAG public. Audience équipe, jamais publiée, jamais servie aux visiteurs.

> **Règle d'or : toute nouvelle automatisation qui parle à un client passe par
> `obtenirContexteMethode`.** Personne ne relit les fiches dans un autre chemin.

## 1. Importer les fiches

La source est le dossier `methode/` du dépôt de marque (copie texte du Drive « Livres
savoir par cœur » ; le Drive reste l'original).

```bash
# 1. Récupérer la copie
git -C ../axion-brand fetch origin methode/livres-2026-11-11
git -C ../axion-brand archive origin/methode/livres-2026-11-11 methode | tar -x -C /tmp/

# 2. ESSAI À BLANC (par défaut) : affiche chaque fiche, ses étiquettes, les signalements
pnpm tsx scripts/methode/importer-methode.ts /tmp/methode

# 3. Écriture réelle (DATABASE_URL réelle exigée ; refusée sur une URL stub)
pnpm tsx scripts/methode/importer-methode.ts /tmp/methode --ecrire
```

Ce que l'import garantit :

- idempotent sur le slug `methode/<fichier>/<section>` : relancer ne crée pas de doublon ;
- **jamais de suppression**, **jamais de publication** (`approved`, `team`, `internal`) ;
- une entrée de même slug venant d'une autre source n'est pas touchée (comptée « ignorée ») ;
- les `LISEZ-MOI.md` et l'extraction PDF santé ne sont pas importés.

Étiquettes posées : `livre:<auteur>`, `type:regle|script|objection|calcul|posture`,
`chiffres-exercice` (montant en € : avertissement en tête de fiche), `secteur:sante`,
`doctrine:a-revoir` (heurte la doctrine de publication : importée, **jamais servie**).

## 2. Allumer

Variable `METHODE_ACTIVE=true` (Coolify → variables d'environnement, portée RUN), puis
redémarrage. Seule la valeur exacte `true` allume. Éteinte (défaut), tout est neutre :
`obtenirContexteMethode` rend `{ noyau: null, extraits: [] }` sans lire la base.

## 3. Brancher un nouvel outil

```ts
import { obtenirContexteMethode } from "@/server/methode";

const { noyau, extraits } = await obtenirContexteMethode({
  sujet: "relance après diagnostic, objection prix",
  secteur: prospect.secteur === "sante" ? "sante" : undefined, // la santé reste à part
  max: 5, // 0 = noyau seul
});
```

- `noyau` : l'essentiel en 30 secondes + le chemin (fiche 00). À injecter toujours.
- `extraits` : les fiches les plus proches du sujet (recherche plein texte), bornées à
  1 500 caractères.
- Un générateur de **mail, offre ou script** dans `content-gen` appelle plutôt
  `blocMethodePourPromptSysteme(nature)` (`src/server/content-gen/methode-commerciale.ts`)
  et l'**ajoute à la fin** de son prompt système. Un contenu SEO public n'appelle jamais
  ni l'un ni l'autre.
- MCP : l'outil `axionia.methode.contexte` (lecture) rend la même chose.

Règles de rédaction rappelées dans le bloc injecté : seul prix public = Journée IA
(`prixJourneeIa()`, `src/content/offre.ts`) ; les autres montants sont des exercices ;
vouvoiement ; aucun client ni témoignage inventé.

## 4. Où sont les choses

| Quoi             | Où                                                    |
| ---------------- | ----------------------------------------------------- |
| Découpage (pur)  | `src/server/methode/decoupage.ts`                     |
| Point d'entrée   | `src/server/methode/index.ts`                         |
| Import           | `scripts/methode/importer-methode.ts`                 |
| Bloc content-gen | `src/server/content-gen/methode-commerciale.ts`       |
| Outil MCP        | `src/server/mcp/outils/methode-contexte.ts`           |
| Tests            | `src/server/methode/__tests__/couche-methode.spec.ts` |
| Interrupteur     | `src/env.ts`, `.env.example` (`METHODE_ACTIVE`)       |
