# RAPPORT — Lot OPCO A6 : dossier prêt à déposer

Branche : `opco/a6-dossier-pret-a-deposer`, partie de `origin/main` (`6d984967`, #1275) puis
fusion de `origin/opco/a3-regime-paiement` (#1276) et `origin/opco/a5-etat-des-fonds` (#1277).

## Ce qui est fait

Point de départ : c'est l'**entreprise** qui dépose sa demande de prise en charge sur son
espace OPCO. L'organisme lui remet un dossier complet et suit le dépôt.

1. **Kit OPCO vérifié** (`documents/templates/kit-opco.tsx`)
   - Le kit reçoit l'**état réel** des pièces : convention **signée** (`statutSignature = signee`,
     la tripartite d'abord), programme, devis (pièce du `Devis` rattaché à la session),
     calendrier (`organisation_action`). Une pièce compte seulement si elle est **en vigueur**
     (non annulée), et c'est la plus récente qui est retenue.
   - La case est cochée (remplie, dessinée en géométrie, sans glyphe) **uniquement** si la pièce
     est présente. Chaque ligne affiche « Jointe — n° » ou « Manquante — motif », et une ligne
     « Pièces manquantes : … » suit la liste.
   - Les pièces produites après la formation (certificat, émargements, relevés, facture)
     passent sous « Pièces à produire après la formation », jamais cochées.
   - Encart « **Comment déposer chez <OPCO>** », lu **uniquement** dans `OPCO_FICHES`, avec
     « non renseigné » quand un fait vaut null :
     - qui dépose ;
     - portail entreprise ;
     - délai de dépôt ;
     - date limite (`dateLimiteDepotPourSession`, plus la date limite de l'exercice 2026 si elle
       est relevée) ;
     - régime de paiement (`regimePaiementDeSession`, libellés sobres) ;
     - bandeau d'état des fonds (`etatFondsDuClient` → `bandeauEtatFonds`), s'il y en a un.
   - Si la lecture de l'état des pièces échoue, le kit reprend l'ancienne liste fixe, où
     **rien** n'est coché.
2. **Dossier prêt à déposer (ZIP)** — `genererDossierPretADeposerAction` (`actions/qualiopi/documents.ts`)
   - Droit : `deposer_demande_financeur`, le même que le kit OPCO.
   - L'action émet un kit vérifié **via `genererKitOpcoAction`**, donc avec la même garde de
     verrou ADR 0060 et le même journal.
   - Le ZIP (`dossier-pret-a-deposer-zip.ts`, jszip) contient le kit, **seulement** les pièces
     présentes, et un `LISEZMOI.txt` qui reprend l'encart et nomme les manquantes.
   - Noms de fichiers : `nomFichierDocument`, plus le nouveau `nomFichierArchive` (« Dossier
     OPCO a deposer - <client> - <n° session>.zip »).
   - L'action est classée `verrou` (conditionnelle) au registre et ajoutée au test
     « écritures refusées sur dossier clos ».
   - Un bouton sur `qualiopi/sessions/[id]/financement` déclenche le téléchargement.
3. **Saisie du dépôt et de l'accord**
   - `enregistrerDepotDossier` + `enregistrerDepotDossierAction` posent `depotFaitLe` (date
     `AAAA-MM-JJ`, minuit UTC, `@db.Date`) et `numeroDossierExterne`.
   - Le **statut ne bouge pas** : ce n'est pas une transition.
   - L'écriture est conditionnée au statut lu (verrou optimiste) et refusée sur un dossier clos.
   - Journal : `facturation.dossier.depot_saisi`, `targetType: "DossierFinancement"` (cible
     littérale lue par l'historique). Il contient une date, un n° de dossier et l'id de session,
     sans donnée personnelle.
   - `transitionnerDossier` accepte `accordEcritLe`, posé dans la **même** écriture
     conditionnée que `accord_recu` et refusé sur toute autre transition. Il est journalisé dans
     `facturation.dossier.transition`.
   - Écrans :
     - la page financement de la session a un panneau « Dépôt de la demande de prise en
       charge » (encart, pièces, ZIP, « Dépôt fait le » + n° OPCO) ;
     - au Hub facturation, `DossiersFinancementPanel` ajoute « Date de l'accord écrit » au
       passage à l'accord et affiche « déposé le » / « accord du ».
4. **Alerte `depot_opco_a_faire`** (`alertes/regle-depot-opco-a-faire.ts`, catalogue, évaluateur)
   - Portée : session `planifiee`, financement `opco|mixte`, aucun dossier OPCO avec `depotFaitLe`.
   - Niveau `important` à J-7 de `dateLimiteDepotPourSession`, `critique` une fois la date
     dépassée. Comparaison au **jour civil de Paris**.
   - Requête bornée : `take 500`, début entre J-365 et J+60.
   - Guichet direction, `resolutionAuto` : l'alerte se referme dès que `depotFaitLe` est saisi.

**Aucune migration** : `depotFaitLe`, `accordEcritLe` et `numeroDossierExterne` existent déjà
(lot A1). Aucun nouveau modèle Prisma. Les phrases « jusqu'à 0 € de reste à charge » et « à
100 % » ne sont pas touchées, et les textes remis au client ne portent aucun délai d'Axion-IA.

## Fichiers

Nouveaux :
- `src/server/qualiopi/financements/dossier-pret-a-deposer.ts` (module pur)
- `src/server/qualiopi/financements/dossier-pret-a-deposer-lecture.ts`
- `src/server/qualiopi/financements/dossier-pret-a-deposer-zip.ts`
- `src/server/qualiopi/alertes/regle-depot-opco-a-faire.ts`
- `src/components/admin/qualiopi/DepotOpcoPanel.tsx`

Modifiés :
- `documents/templates/kit-opco.tsx`, `documents/nom-fichier.ts`
- `actions/qualiopi/documents.ts`, `actions/qualiopi/facturation-hub.ts`
- `financements/dossier-financement.ts`
- `alertes/catalogue.ts`, `alertes/evaluateur.ts`
- `sessions/verrou-dossier-registre.ts`
- `DossiersFinancementPanel.tsx`
- pages `facturation` et `sessions/[id]/financement`

Tests :
- `regle-depot-opco-a-faire.spec.ts`
- `facturation-hub-depot-accord.spec.ts`
- `dossier-pret-a-deposer.spec.ts`
- `dossier-pret-a-deposer-zip.spec.ts`
- `kit-opco-verifie.spec.tsx`
- ajouts dans `catalogue.spec.ts` et `ecritures-refusees-dossier-clos.spec.ts`

Fusion A3 + A5 : conflit dans `alertes/catalogue.ts` et `catalogue.spec.ts`, résolu en gardant
les deux entrées (`delai_facturation_opco` et `etat_fonds_perime`).

## ROUGE → VERT

| Témoin | ROUGE constaté | VERT |
| --- | --- | --- |
| Alerte J-8 rien / J-7 important / dépassé critique / dépôt fait → rien | module absent (suite en échec) | 9/9 |
| Saisie de `depotFaitLe` journalisée ; `accordEcritLe` posé à l'accord ; clos / concurrence refusés | 6/6 en échec sans le code source (vérifié par `git stash`) | 6/6 |
| Kit avec pièce manquante → non cochée et listée ; encart OPCO aux faits null → « non renseigné » ; bandeau des fonds | 3/5 en échec avant la modification du gabarit | 5/5 |
| ZIP : kit + seulement les pièces présentes ; PDF absent du stockage → manquante ; kit absent → erreur | — (écrit après le module, pas de ROUGE observé) | 3/3 |
| État des pièces / encart (module pur) | — (écrit après le module, pas de ROUGE observé) | 10/10 |

Gardes transverses (consigne n° 3, élargies à `financements/` et `actions/qualiopi/`) :
`pnpm vitest run src/lib/admin-nav.test.ts src/lib/admin-nav-icons.test.ts src/components/admin/qualiopi/__tests__/ src/server/qualiopi/sessions/__tests__/ tests/unit/ci/ src/server/qualiopi/alertes/ src/server/qualiopi/documents/ src/server/qualiopi/financements/ src/server/actions/qualiopi/`
→ **336 fichiers, 4 492 tests verts** (1 todo). Ils incluent `journal-couvre-ecritures-verrou`,
`registre-ecritures-exhaustif`, `ecritures-refusees-dossier-clos`, `tva-mention` et
`la-sonde-et-le-catalogue-ne-divergent-pas`. `tsc --noEmit` est propre ; eslint et prettier sont
propres sur tous les fichiers touchés. `next build` n'a pas été lancé.

## Limites

- **Chaque téléchargement du ZIP émet un nouveau kit numéroté**, pour qu'il reflète l'état du
  moment. Sur un dossier clos, la régénération est refusée par le verrou, comme pour le kit seul.
- **Lignes** : environ 1 150 lignes hors tests, contre ~600 visées. Le panneau client
  (≈ 230 lignes) et les commentaires (densité du dépôt) font l'essentiel du dépassement.
- La convention ne compte que **signée** (`statutSignature = signee`). Une convention signée
  hors outil, sans exemplaire au registre, apparaît « manquante ».
- La saisie du dépôt se fait sur le dossier OPCO **ouvert le plus récent** de la session (celui
  de `regimePaiementDeSession`). Sans dossier, le panneau renvoie au Hub facturation.
- L'alerte ne regarde que les sessions `planifiee`. Une fois la session démarrée,
  `opco_formation_demarree_sans_accord` prend le relais.
- L'alerte ne se lève que pour les OPCO dont `OPCO_FICHES` connaît le délai de dépôt : Atlas
  (1 j), OPCO EP (30 j), Ocapiat (0 j), Constructys (15 j). Pour Akto, OPCO 2i, Mobilités,
  Afdas, Uniformation, OPCOMMERCE et OPCO Santé, `dateLimiteDepotPourSession` rend null, et
  l'alerte **ne se lève pas** : elle n'invente aucune date. La date limite d'exercice
  (OPCOMMERCE 30/11, Mobilités 31/12) est affichée dans l'encart mais ne déclenche pas l'alerte.
- Fenêtre app/worker : rien n'est concerné. L'alerte n'utilise que des colonnes déjà migrées (A1),
  et aucune forme de job BullMQ ne change.
- Réseau OPCO non consulté : seul `OPCO_FICHES` est lu.

## Corps de PR proposé

> **feat(opco): dossier prêt à déposer — kit OPCO vérifié, ZIP, saisie du dépôt et de l'accord, alerte de dépôt (chantier OPCO A6)**
>
> C'est l'entreprise qui dépose sa demande de prise en charge sur son espace OPCO (Atlas :
> « obligatoirement par l'entreprise depuis son compte myAtlas »). Cette PR outille l'organisme
> pour lui remettre un dossier complet et savoir où en est le dépôt.
>
> - **Kit OPCO vérifié** : seules les pièces présentes au registre sont cochées (convention
>   signée, programme, devis, calendrier), les manquantes sont listées. Le kit porte un encart
>   « Comment déposer chez <OPCO> » lu dans `OPCO_FICHES` (« non renseigné » si inconnu) : date
>   limite, régime de paiement et état des fonds.
> - **Dossier prêt à déposer** : un ZIP avec le kit et les pièces présentes, plus un
>   `LISEZMOI.txt`, téléchargeable depuis la page financement de la session. Même droit et même
>   verrou que le kit.
> - **Saisie du dépôt** (« Dépôt fait le » + n° OPCO) et de la **date de l'accord écrit**.
>   Journalisées, sans donnée personnelle, avec la machine à états et son verrou optimiste
>   inchangés.
> - **Alerte `depot_opco_a_faire`** : important à J-7 de la date limite de dépôt, critique une
>   fois la date dépassée (jour de Paris). Elle se referme quand le dépôt est saisi.
>
> Aucune migration. Dépend de #1276 et #1277, fusionnées dans la branche.
>
> 🤖 Generated with [Claude Code](https://claude.com/claude-code)
>
> https://claude.ai/code/session_01246m46ms8AkZcHfji8ay68

---

Sha de tête de `opco/a6-dossier-pret-a-deposer` : `c87ddf3a8efdd02bc0b756815b8464a5809d1135`
