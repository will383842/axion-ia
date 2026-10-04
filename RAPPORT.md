# RAPPORT — Lot A9 · fiche client : le SIRET appartient à la société

Branche de code : `opco/a9-fiche-client-siren` (depuis `origin/main` 11017d43).
Remarque de Williams (SCI Invest Sun, contact Simone Blanc, SIRET 90143483700018) :
« ça me demande le SIRET des contacts alors que c'est la société qui devrait l'avoir ».

## Ce qui a été fait

1. **Le SIREN se déduit du SIRET : une règle unique.** `sirenDuClient({ siren, siret })` dans
   `src/lib/siret.ts` (pur, sans dépendance, importable côté client). Elle rend le SIREN saisi
   s'il est valide, sinon les 9 premiers chiffres d'un SIRET valide (clé de Luhn du dépôt,
   exception La Poste comprise), sinon `null`. Elle s'accompagne de `sirenContreditLeSiret` et
   d'un libellé unique, `AVERTISSEMENT_SIREN_CONTRAIRE`.
   Elle est utilisée par :
   - le badge « SIREN à compléter » et le lien vers l'annuaire de la fiche : ils ne s'affichent
     plus quand le SIRET contient déjà le SIREN ;
   - le bouton « Rafraîchir depuis l'INSEE » : il est visible dès qu'un SIRET valide existe ;
   - `rafraichirEffectifInsee` : il lit `siret` en plus et interroge l'annuaire sur le SIREN déduit ;
   - le relevé INSEE lancé par `createClientAction`.
   - Recherche (grep) des autres lectures de `client.siren` pour un appel à l'annuaire : il n'y en
     a pas d'autre. `rechercherSiren`, appelé sur la fiche et dans `ApresLAppelVue`, cherche par
     nom. La synchro Partners garde son `sirenTransmis`, qui applique la même règle mais renvoie
     aussi d'où vient le SIREN.
2. **Écriture.** À la création et à l'édition, un SIRET valide remplissait déjà le SIREN : c'était
   en place depuis le chantier visio (`resoudreSiren`).
   **Trou corrigé :** le formulaire « Éditer » envoie le SIRET sans le SIREN. Un SIRET modifié
   **écrasait** donc en silence un SIREN déjà en base, par exemple un SIREN confirmé dans
   l'annuaire avec « C'est elle ». Désormais, si le SIREN en base contredit le SIRET, il est
   **conservé**. L'action renvoie `data.avertissement` (« Le SIREN ne correspond pas au SIRET :
   il est conservé. Vérifiez lequel est juste. »), que `ClientEditForm` affiche. La fiche montre
   le même avertissement tant que la contradiction dure.
3. **Migration de données** `20261004220000_siren_deduit_du_siret` : une seule requête,
   `UPDATE "clients" SET "siren" = left("siret", 9) WHERE "siren" IS NULL AND "siret" ~ '^[0-9]{14}$'`.
   Noms vérifiés dans `schema.prisma` (`@@map("clients")`, `siren VarChar(9)`, `siret VarChar(14)`).
   Elle est idempotente et ne contient ni DDL ni DROP.
4. **Carte d'identité en deux blocs.**
   - **Société** : raison sociale, SIRET, SIREN (ou badge et annuaire), adresse, pénalités de retard.
   - **Contact** : nom, rôle, e-mail, téléphone.
   - Un particulier n'a pas de bloc Société : son adresse et ses pénalités passent dans le bloc
     Contact.
5. **L'effectif n'apparaît plus deux fois.** La case « Effectif » de la carte est retirée. Le
   bouton INSEE et son message de retour passent sous la tuile « Effectif » de « Branche et
   OPCO », via `complementEffectif`.
   J'ai aussi retiré la case « OPCO » de la carte : c'était un autre doublon de la tuile OPCO
   (même nom, même n° d'adhérent). Pour un particulier, l'OPCO n'a pas de sens.
6. **Point 4 — aucun autre écran ne demande un SIRET à une personne :**
   - fiche stagiaire et inscription : aucun champ SIRET (grep sur `qualiopi/stagiaires`) ;
   - personnes de la fiche client (`components/admin/dossier-client`) : aucun SIRET ;
   - `ClientForm` et `ClientEditForm` : le SIRET suit la raison sociale, avant le groupe contact,
     et il est masqué pour un particulier ;
   - `VenteWizard` : ordre Raison sociale → SIRET → e-mail de contact ;
   - planning (`planning/[type]/[id]`, carte « Entreprise & contact ») : Client → SIRET →
     Adresse → Contact.

   Aucun libellé n'est trompeur, donc rien n'a été corrigé ailleurs.

## Fichiers

- `src/lib/siret.ts` : `sirenDuClient`, `sirenContreditLeSiret`, `AVERTISSEMENT_SIREN_CONTRAIRE`
- `src/server/qualiopi/crm/effectif-insee.ts` : lecture par `sirenDuClient`
- `src/server/actions/qualiopi/clients.ts` : relevé à la création ; SIREN contraire conservé à l'édition avec avertissement
- `src/components/admin/qualiopi/ClientEditForm.tsx` : affiche l'avertissement
- `src/app/[locale]/(admin)/[adminPrefix]/qualiopi/clients/[id]/page.tsx` : blocs Société / Contact, `complementEffectif`
- `prisma/migrations/20261004220000_siren_deduit_du_siret/migration.sql`
- Tests ajoutés :
  - `src/lib/__tests__/le-siren-d-un-client-se-lit-aussi-dans-son-siret.spec.ts`
  - `src/server/qualiopi/crm/__tests__/le-releve-insee-lit-le-siren-du-siret.spec.ts`
  - `src/server/actions/qualiopi/__tests__/un-siren-different-du-siret-n-est-jamais-ecrase.spec.ts`
  - `src/app/[locale]/(admin)/[adminPrefix]/qualiopi/clients/[id]/__tests__/la-carte-separe-la-societe-du-contact.spec.tsx`
  - `tests/unit/ci/le-siren-des-fiches-existantes-est-tire-du-siret.spec.ts`
- Test adapté : `la-fiche-dit-ce-que-l-opco-a-deja-pris-en-charge.spec.tsx`. La provenance et le
  bouton INSEE se lisent maintenant dans la tuile unique. Les anciens libellés (« 10 salariés »,
  « Relevé INSEE (borne basse…) », « Saisi en console ») étaient ceux de la case retirée.

## ROUGE → VERT

- **ROUGE**, commit `2c5108f1` (tests seuls) : 16 tests en échec sur 22, pour la bonne raison :
  - `sirenDuClient` absent ;
  - migration absente ;
  - relevé INSEE « sans_siren » sur une fiche qui a un SIRET ;
  - SIREN en base écrasé (aucun avertissement) ;
  - sur la fiche : « SIREN à compléter » présent, blocs `data-bloc` absents, 3 `>Effectif<`.
- **VERT** sur la tête :
  - les 22 tests du lot passent ;
  - suite demandée `src/server/qualiopi/ src/server/actions/qualiopi/ tests/unit/ci/ src/components/admin/qualiopi/__tests__/ qualiopi/clients/`, plus `src/lib/` et `src/features/dossier-client/` : premier passage 2 échecs (le test A7d adapté ci-dessus), puis dernier passage sur la tête : **922 fichiers, 12 511 tests passés**, 1 todo, 0 échec ;
  - `pnpm qualiopi:isolation-check` : OK, 0 violation ;
  - `pnpm typecheck` : OK ;
  - eslint et prettier lancés à la main sur les fichiers touchés : OK.

## Limites

- **Création avec un SIREN et un SIRET contradictoires dans le même formulaire : la création reste
  refusée**, avec un message motivé (`resoudreSiren`). C'est un comportement existant, verrouillé
  par `un-siren-contraire-au-siret-est-refuse.spec.ts`. Les deux identifiants viennent de la même
  saisie : c'est une faute de frappe, et refuser est plus sûr que choisir. La règle « conservé +
  avertissement » vaut pour un SIREN **déjà en base**.
- La migration ne recontrôle pas la clé de Luhn (le SQL est celui de la consigne). Tout SIRET écrit
  par la console l'a déjà passée, et la lecture la recontrôle. Une ancienne valeur fausse
  donnerait un SIREN faux, mais visible sur la fiche. Les SIREN vides `''` (et non NULL) ne sont
  pas traités ; le script `scripts/visio/deriver-siren.ts` les couvre.
- Fenêtre app/worker : aucune énumération, aucune forme de job, aucune colonne nouvelle.
  `effectif-insee.ts` lit `siret`, une colonne qui existe déjà.
- Poids : `src/lib/siret.ts` est embarqué par `ClientEditForm` et `ClientForm`. Il gagne environ
  0,3 kB avant compression. Non mesuré, faute de `next build` (interdit) : à confirmer par l'étape
  « Poids du bundle » de la CI (cliquet admin à 470 kB).
- Je n'ai pas fait de capture d'écran : le rendu n'a été vérifié que par les tests de rendu
  statique.

## Corps de PR proposé

> **Lot A9 — fiche client : le SIRET appartient à la société, plus au contact**
>
> - `sirenDuClient({ siren, siret })` : SIREN saisi valide, sinon les 9 premiers chiffres d'un SIRET valide (Luhn). Elle alimente le badge « SIREN à compléter », le bouton « Rafraîchir depuis l'INSEE », le relevé INSEE (fiche et création).
> - Édition : un SIREN en base qui contredit le SIRET saisi est **conservé**, avec l'avertissement « Le SIREN ne correspond pas au SIRET ». Avant, il était écrasé en silence.
> - Migration de données idempotente `20261004220000_siren_deduit_du_siret` (UPDATE seul).
> - Carte d'identité en deux blocs, **Société** (raison sociale, SIRET, SIREN, adresse, pénalités) et **Contact** (nom, rôle, e-mail, téléphone). Pas de bloc Société pour un particulier.
> - L'effectif et l'OPCO ne se lisent plus qu'une fois, dans « Branche et OPCO ». Le bouton INSEE est sous la tuile Effectif (`complementEffectif`).
>
> Tests : 5 fichiers de témoins (ROUGE en `2c5108f1`, VERT ensuite), suite Qualiopi + `tests/unit/ci` verte, `qualiopi:isolation-check` et `typecheck` OK.
>
> 🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Tête de la branche de code

`16c1dc34dc57043563070d2b2d4f8cb13e1f44c0`
