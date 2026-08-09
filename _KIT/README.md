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

## Comment le kit arrive jusqu'au formateur

Le dépôt n'est pas un canal de distribution : un formateur n'y a pas accès, et
ne doit pas y en avoir. Le chemin est le suivant.

```
_KIT/<slug>/kit-formateur.pdf
        │  pnpm tsx scripts/kit-formateur/publier-vers-r2.ts
        ▼
   R2  kits-formateur/<slug>/v<N>/kit-formateur.pdf
        │  + ligne SupportFormation (type kit_formateur_imprime, pdfKey)
        ▼
   /api/espace-formateur/kit/<sessionId>   ← re-signe à la demande
        ▼
   Espace formateur → sa session → « Télécharger le kit »
```

Le script est **idempotent** : rejoué sur un PDF inchangé (même SHA-256), il ne
fait rien. Un PDF modifié incrémente la version, et la version est dans la clé
R2 — republier n'écrase donc jamais l'objet précédent.

### ⚠️ Où lancer la publication — PAS depuis le conteneur

L'image de production est le build **standalone** de Next.js : elle embarque
`.next/standalone`, `public` et `prisma`, mais **ni `scripts/` ni `_KIT/`**
(vérifié le 2026-08-08 sur le conteneur worker). Le script n'y est pas, et les
PDF non plus.

Il se lance depuis **un clone du dépôt**, avec l'environnement de production :

```bash
# 1. Tunnel vers la base de prod (le conteneur PG n'est pas exposé)
ssh -N -L 5433:127.0.0.1:5432 axion-prod &

# 2. Environnement
export DATABASE_URL="postgresql://axionia:<motdepasse>@127.0.0.1:5433/axionia"
export R2_ACCOUNT_ID=... R2_ACCESS_KEY_ID=... R2_SECRET_ACCESS_KEY=... R2_BUCKET=...

# 3. À sec d'abord : il dit ce qu'il ferait sans rien écrire
pnpm tsx scripts/kit-formateur/publier-vers-r2.ts --dry-run
pnpm tsx scripts/kit-formateur/publier-vers-r2.ts
```

Le script refuse de démarrer si `DATABASE_URL` est absent ou pointe sur
`stub.invalid` : sans ce garde-fou, le Proxy stub répondrait `null` à tout et le
script conclurait sereinement que les 22 formations n'existent pas.

🔴 **Aucune URL signée n'est stockée.** Une URL R2 signée expire en 900 s ; une
URL figée en base est un lien mort un quart d'heure plus tard. Seule la CLÉ est
persistée, et la route signe à chaque demande. C'est le même défaut que celui
déjà corrigé sur `/api/qualiopi/documents/[id]`.

**La garde d'accès** est l'appartenance de la session (formateur principal ou
co-animateur), pas le slug de la formation — le kit contient les corrigés du
quiz d'évaluation des acquis. Session inconnue et session d'un autre formateur
rendent le même 404.

⚠️ Le kit n'est **pas** produit par le Formation Engine : `construireSupport`
lève volontairement pour ce type, et `TOUS_SUPPORT_TYPES` l'exclut. Le générer
depuis la console produirait un classeur vide qui écraserait le vrai.

## État d'avancement

Voir `_KIT/ETAT.md` — écrit à chaque génération complète, donc toujours juste.
Un tableau tenu à la main ici aurait menti dès le kit suivant.

Une formation sans ses pièces rédigées porte un avertissement en page de garde
et reste inutilisable en salle : seules ses fiches de capture sont exploitables.
