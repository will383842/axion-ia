# Couche « Méthode » — mode d'emploi

> Décision : [ADR 0076](../adr/0076-couche-methode-collection-separee.md). Équipe seulement :
> jamais publiée, jamais dans le sitemap ni les pages, jamais servie au chatbot public des
> visiteurs.

## En une phrase

**Toute nouvelle automatisation qui parle à un client passe par `obtenirContexteMethode`**
(`src/server/methode/index.ts`). C'est le point d'entrée unique : le noyau de la méthode de
vente (fiche 00, « L'essentiel en 30 secondes » + « Le chemin ») est toujours rendu, et des
extraits sont cherchés à la demande.

## Ce qu'il y a dans la base

| Élément     | Valeur                                                                                                              |
| ----------- | ------------------------------------------------------------------------------------------------------------------- |
| Modèle      | `KnowledgeEntry` + `KnowledgeTranslation` (fr) — aucune nouvelle table                                              |
| Slug        | `methode/<fichier>/<section>` (stable : réimporter rend les mêmes)                                                  |
| Noyau       | `methode/00-axion-ia-methode-de-vente/essentiel`                                                                    |
| Statut      | `approved` — **jamais `published`**                                                                                 |
| Audience    | `team`, confidentialité `internal`, domaine `methodology`                                                           |
| Collections | `methode-vente` (tout) · `methode-secteur-sante` (à part)                                                           |
| Étiquettes  | `methode`, `livre:<auteur>`, `type:regle\|script\|objection\|calcul\|posture`, `chiffres-exercice`, `secteur:sante` |

### ⚠️ Les montants sont des EXEMPLES, jamais des prix

Les fiches citent des montants d'entraînement (290 €/mois, 1 900 € d'installation, acompte
de 30 %, abonnement, suivi à 30 jours…). **Ce ne sont ni des règles ni des prix.** Toute
section qui en cite porte l'étiquette `chiffres-exercice` et commence par l'avertissement :

> ⚠️ Montants d'entraînement, pas de prix public. […] Seul prix affiché : Journée IA
> 1 490 € HT (source : `src/content/offre.ts`).

`obtenirContexteMethode` repose cet avertissement en tête de chaque extrait concerné, même
si la fiche en base l'a perdu. Seul prix public : **Journée IA 1 490 € HT**.

### Le secteur santé est à part

La collection `methode-secteur-sante` n'est lue **que** si l'appel passe `secteur: "sante"`.
Sans ce paramètre (ou avec un autre secteur), aucune fiche santé ne sort, même si la
recherche en trouvait.

## Importer les fiches

La source d'origine reste le Drive « Livres savoir par cœur » (intact). Le dépôt
`axion-brand` (branche `methode/livres-2026-11-11`, dossier `methode/`) en porte la copie
texte.

```bash
# 1. ESSAI À BLANC (par défaut) : lit, découpe, affiche — aucune connexion à la base.
pnpm tsx scripts/methode/importer-methode.ts <chemin>/methode --detail

# 2. Écriture (base locale ou préproduction) : idempotente, aucune suppression, aucune publication.
pnpm tsx scripts/methode/importer-methode.ts <chemin>/methode --ecrire

# 3. Base de production : décision de Williams uniquement, jamais depuis une routine.
pnpm tsx scripts/methode/importer-methode.ts <chemin>/methode --ecrire --autoriser-prod
```

Ce qui est importé : `livres/0x-*.md`, `livres/important-a-savoir/`, `livres/a-etudier/`,
`secteurs/sante/…_CODE_SOURCE.md`. Ce qui ne l'est pas : `LISEZ-MOI.md`,
`EVALUATION-FICHES-*.md`, l'extrait PDF santé (doublon de comparaison) et `livres-purs/`
(couche « livre pur », étage 2, plus tard).

Essai à blanc du 2026-11-11 sur la copie : **276 fiches** (242 `methode-vente`, 34
`methode-secteur-sante`), dont **122** étiquetées `chiffres-exercice`.

Découpage : une section numérotée (1., 2., 3.… dans l'ordre) = une fiche ; une liste
numérotée imbriquée qui repart à 1 reste dans sa section ; chaque bloc « MISE EN
SITUATION », « CARTES MÉMO », « ? TESTE-TOI » = une fiche. Le découpage des extraits PDF est
heuristique : relire l'essai à blanc (`--detail`) avant toute écriture.

## Allumer

1. Importer (ci-dessus) sur la base visée.
2. Poser `METHODE_ACTIVE=true` (Coolify → variables d'environnement, app **et** worker si un
   job l'utilise), puis redémarrer.
3. Éteindre = retirer la variable (ou `false`) : `obtenirContexteMethode` rend
   `{ noyau: null, extraits: [] }` sans lire la base, et **rien ne change nulle part**.

Seule la valeur exacte `"true"` allume la couche.

## Brancher un nouvel outil

```ts
import { obtenirContexteMethode, formaterContextePourPrompt } from "@/server/methode";

const contexte = await obtenirContexteMethode({
  sujet: "le prospect dit que c'est trop cher", // texte libre, recherche plein texte fr
  secteur: prospect.secteur === "sante" ? "sante" : undefined,
  max: 3, // défaut 5, plafond 10
});
const blocPrompt = formaterContextePourPrompt(contexte); // "" si éteint
```

Branchements existants (v1, minimaux) :

- **MCP** : outil de lecture `axionia.methode.contexte` (`src/server/mcp/outils/methode-contexte.ts`).
  Demandé sous le nom `methode_contexte` ; la grammaire du socle impose
  `adaptateur.domaine.action`.
- **Génération de contenu** : `injecterMethodeDansPromptSysteme(prompt, nature)`
  (`src/server/content-gen/methode-commerciale.ts`) n'ajoute le noyau que si
  `METHODE_ACTIVE` ET `nature ∈ { mail, offre, script }`. Les générateurs actuels de
  content-gen produisent des **pages publiques** (blog, villes, comparatifs) : ils ne
  l'appellent pas et ne doivent jamais l'appeler.
- **Chatbot public** : non touché. Ses lectures filtrent `status = published` ET
  `audience = public` ; les fiches Méthode n'y apparaissent jamais.

## Règles à tenir dans ce qui est servi

Vouvoiement côté client, « Williams » pour le fondateur, aucune mention de la ville du siège
hors mentions légales, aucune formule de non-garantie des gains, aucun prix hors Journée IA
1 490 € HT. Les entreprises et montants
des fiches sont des exemples pour s'entraîner : Axion-IA ne les présente jamais comme des
clients ou des prix réels.

## Fiches propres (axion-brand `methode/propre/`, relecture R13 du 2026-11-13)

Le dossier à importer est désormais `methode/propre/` (branche `methode/propre-2026-11-11`
d'axion-brand). Ses fiches portent un en-tête YAML (`slug`, `titre`, `secteur`) et, sous
chaque titre de section, un marqueur `<!-- id: … ; type: … ; chiffres-exercice: oui|non -->`.

- **L'id de l'auteur fait la section du slug**, tel quel : `methode/<dernier segment du slug
d'en-tête>/<id>`. Un fichier sans aucun marqueur fait une seule fiche `…/fiche`.
- `chiffres-exercice` = marqueur de l'auteur **OU** détection automatique (union : un montant
  ne passe jamais sans l'avertissement).
- Le noyau de la fiche 00 est la citation « L'ESSENTIEL EN 30 SECONDES » + « LE CHEMIN » de la
  section 1 ; elle en est retirée et devient `methode/00-axion-ia-methode-de-vente/essentiel`.
- `INDEX.md` et tout dossier commençant par `_` (`_controles/`) ne sont jamais importés.
- Une entrée de même slug dont `sourceFactoryId` ≠ `methode-import` n'est jamais touchée.

Essai à blanc mesuré le 2026-11-13 : **345 fiches** (vente 261, santé 84), **137 chiffres-exercice**,
**0 doublon de slug**, 340 des 342 ids d'auteur repris (les 2 restants sont des titres sans corps).
