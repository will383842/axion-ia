# Kits formateur imprimés

Un classeur A4 par formation : ce que le formateur pose sur la table quand
l'outil tombe en panne devant la salle. Sans lui, les plans B écrits dans les
fiches ne renvoient à rien.

Cahier des charges : `_AUDIT/KIT-FORMATEUR-INVENTAIRE-2026-08-07.md`.

⚠️ À ne pas confondre avec `docs/kits/1-to-1-afest/`, qui est le kit d'un autre
dispositif : l'accompagnement individuel AFEST. Ici, il s'agit du classeur
imprimé des sessions de groupe du catalogue.

## Ce que contient un kit

| Préfixe | Nature                                                               | Qui la produit                     |
| ------- | -------------------------------------------------------------------- | ---------------------------------- |
| **A**   | Pièces rédigées : quiz, corrigés, grilles, trames, textes d'exercice | Écrites à la main                  |
| **B**   | Fiches de capture : le prompt exact à coller, ce qu'il faut annoter  | Générées depuis la fiche formation |

Les pièces se désignent par leur code (`A3`, `B2`), **jamais par un numéro de
page**. Une pagination ne survit pas à la première pièce ajoutée — c'est la
leçon des 154 renvois inventés retirés par la PR #553, dont 7 fiches sur 15
présentaient des collisions.

## Produire les kits

```bash
pnpm tsx scripts/kit-formateur/build-kits.ts          # les 22
pnpm tsx scripts/kit-formateur/build-kits.ts ia-pour-les-rh   # une seule
bash scripts/kit-formateur/build-pdf.sh               # HTML → PDF A4
```

`build-kits.ts` lit le contenu rédigé des formations et produit
`_KIT/<slug>/kit-formateur.html` : page de garde, sommaire, pièces rédigées,
fiches de capture, et l'annexe « ce que les plans B exigent ». **Le prompt d'une
fiche de capture est celui de la fiche formation** — il ne peut pas en diverger,
puisqu'il n'est jamais recopié.

## Écrire les pièces d'une formation

Créer `_KIT/<slug>/pieces.html` : une suite de `<section class="piece">`, sans
`<html>` ni `<head>`. Chaque section se déclare par ses attributs `data-*`, ce
qui alimente le sommaire automatiquement :

```html
<section
  class="piece"
  data-piece="A6"
  data-titre="Les huit situations « je peux / je ne peux pas » + corrigé"
  data-bloc="M1, vérification"
  data-tirage="1 par stagiaire + corrigé formateur"
>
  …
</section>
```

- Un **verso** ou un **corrigé** répète `data-piece` et **omet** `data-titre` :
  il prolonge sa pièce au lieu d'ouvrir une ligne de sommaire à lui.
- Une fiche de capture écrite à la main ajoute `data-couvre="mod-2"` : le
  générateur cesse alors d'en produire une pour ce module, et le classeur ne
  porte pas deux fiches concurrentes pour la même démonstration.

Classes disponibles : `.encadre` / `.encadre-titre`, `.texte-exercice`,
`.corrige`, `.prompt-bloc`, `.banniere`, `.champ-date`, `.lignes`, `.petit`,
`.deux-colonnes`, `.coche`.

## Deux exigences non négociables

**Toute sortie d'outil imprimée porte sa date de capture.** Les interfaces
changent vite ; une démonstration qui montre une interface disparue
décrédibilise la formation en direct. Au-delà de trois mois, on recapture.

**Toute trame remise porte la mention « projet — à faire valider par votre
conseil avant diffusion »**, non retirable. Le formateur n'arbitre aucune
question juridique.

## État d'avancement

| Formation                | Pièces rédigées   |
| ------------------------ | ----------------- |
| `ia-pour-bien-commencer` | ✅ 11 pièces      |
| les 21 autres            | ⏳ ossature seule |

Une formation sans ses pièces rédigées porte un avertissement en page de garde
et reste inutilisable en salle : seules ses fiches de capture sont exploitables.
