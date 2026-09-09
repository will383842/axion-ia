# Qualiopi — POINT D'ENTRÉE pour la reprise · état au 2026-09-07

> Ce fichier est écrit pour être lu **seul**. Tout ce qu'il faut pour reprendre y
> est ; la conversation qui l'a produit n'est pas nécessaire.
>
> Worktree utilisé : `C:\Users\willi\Documents\Projets\Axion-IA\wt-remise`
> (créé pendant la session ; `node_modules` y est une **jonction** vers
> `axionia/node_modules`, et `prisma/generated` doit être régénéré à chaque
> changement de branche — voir § 6).

---

## 1. ⛔ LES TROIS PREMIÈRES CHOSES À FAIRE, DANS CET ORDRE

```bash
cd /c/Users/willi/Documents/Projets/Axion-IA/wt-remise
git fetch origin main

# 1. UN BUILD EST-IL EN VOL ? Fusionner pendant un build le TUE (cancel-in-progress).
gh run list --workflow deploy-coolify.yml --limit 1 \
  --json databaseId,status,headSha --jq '.[] | "\(.databaseId) \(.status) \(.headSha[0:9])"'
curl -sI https://axion-ia.com/fr | grep -i x-axion-build-sha

# 2. QUEL EST L'ÉTAT RÉEL DES PR ? (ne jamais se fier à une réservation annoncée)
for n in 1015 1017 1018 1019; do
  gh pr view $n --json number,mergeable,mergeStateStatus --jq '"#\(.number) \(.mergeable)/\(.mergeStateStatus)"'
done

# 3. QUI D'AUTRE TRAVAILLE ? Une réservation de file NE SURVIT PAS à sa session.
#    (`axion-ia-f1` tenait la file le 06/09 puis a disparu de ListAgents.)
```

---

## 2. Ce qui est EN PRODUCTION (vérifié, pas supposé)

| PR        | Ce qu'elle a apporté                                                                                                                           |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **#1003** | budget de bundle scindé public 265 KB / admin 470 KB, gate de budget déplacée après l'E2E, `scripts/ci/bundle-check.mjs`, **ADR 0049**         |
| **#1008** | le bouton **« Relancer la remise »** — utilisé en réel le 06/09 à 13:40, exemplaire signé parti à la cliente (prouvé dans « E-mails envoyés ») |
| **#1010** | le libellé d'une alerte OUVERTE suit désormais la règle qui la produit                                                                         |
| **#1012** | journal du 06 (fusionné, **non déployé** : `paths-ignore` sur `**.md`)                                                                         |

⚠️ **Une fusion de documentation seule ne consomme aucun créneau de déploiement**
(`deploy-coolify.yml`, `paths-ignore` : `**.md`, `docs/**`, `_AUDIT/**`,
`.claude/**`). La réciproque est le piège : une PR qui mélange doc ET code n'est
pas ignorée.

---

## 3. Les PR OUVERTES — état et ORDRE DE FUSION

```
main ← #1015 ← #1017 ← #1018          #1019 et la branche « clauses » : indépendantes
```

⚠️ **Les branches se CONTIENNENT, mais GitHub l'ignore** : les quatre portent
`base = main`. Rien ne recible, rien ne protège l'ordre. **Fusionner #1017
emporte les commits de #1015.** L'ordre est à tenir à la main, une PR à la fois,
avec un `gh pr update-branch` entre chacune (chaque fusion remet les autres en
`BEHIND`).

| PR    | Branche                                      | Contenu                                                                                 |
| ----- | -------------------------------------------- | --------------------------------------------------------------------------------------- |
| #1015 | `qualiopi/le-rafraichissement-se-voit`       | le compteur de libellés rafraîchis s'arrêtait au serveur                                |
| #1017 | `qualiopi/accord-formateur-hors-outil`       | statut `accord_hors_outil` + geste « Consigner l'accord » **(porte une migration)**     |
| #1018 | `qualiopi/tva-verrou-a-la-creation`          | verrou TVA au point de création, **ADR 0050**                                           |
| #1019 | `qualiopi/lot-f-formateur-fantome`           | lot F — D8, D9, D10                                                                     |
| —     | `qualiopi/contrat-formateur-delai-et-mandat` | clauses du contrat de sous-traitance (délai, fait générateur, mandat d'autofacturation) |
| —     | `qualiopi/journal-du-06-apres-midi`          | journal de l'après-midi du 06                                                           |

🔴 **À MESURER AVANT DE FUSIONNER #1019** : Will a fusionné **#1020**
(« `resolutionAuto: false` ne tenait pas sa promesse ») pendant la session. #1019
ajoute justement une entrée `resolutionAuto: false` au catalogue. Rebaser #1019
sur `main` et relancer `src/server/qualiopi/alertes/` **avant** de la fusionner.

---

## 4. Les DÉCISIONS de Will prises ce jour — ne pas les re-arbitrer

| Sujet                       | Décision                                                                                                                                                                      |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rattrapage exemplaire signé | **bouton seul** d'abord, puis **oui au cron** (renversement confirmé en direct : borne basse 01/09, plafond par passage, le bouton reste) — chantier repris par `axion-ia-6c` |
| Délai de paiement formateur | **30 jours** + déclencheur décalé (facture émise après validation du relevé)                                                                                                  |
| Ordre de livraison          | **clauses → pilotage → autofacturation**                                                                                                                                      |
| Autofacturation             | **oui**, avec mandat, mention, droit de contestation                                                                                                                          |
| Changement de formateur     | **alerte, pas envoi automatique** (D10)                                                                                                                                       |

---

## 5. ⛔ CE QUI RESTE À FAIRE — la suite du chantier « payer les formateurs »

### 5.1 Étape 2 : le PILOTAGE (décidé, non commencé)

**Les données existent, la surface manque.** `TrainerStatement` porte déjà
`echeanceAt`, `payeAt`, `moyenPaiement`, `referenceVirement`, et il est **indexé
sur `echeanceAt`**. Mais :

- **aucune alerte** sur un relevé formateur échu — l'alerte d'impayé à 60 jours
  existe, elle porte sur les factures **clients** (`evaluateur.ts` ~l. 1915) ;
- l'écran `/qualiopi/remuneration` n'a **pas** de colonne « en retard ».

À livrer : une règle `releve_formateur_echu` (catalogue + évaluateur + garde), et
l'écran « ce qu'on doit, à qui, échu ou à venir ».

### 5.2 Étape 3 : l'AUTOFACTURATION (décidée, non commencée)

La clause du mandat est écrite (branche `contrat-formateur-delai-et-mandat`), le
code ne l'est pas. Ce qu'il faut :

1. produire la **facture d'honoraires** à partir du `TrainerStatement` validé ;
2. mention **« Autofacturation »**, émission au nom et pour le compte du
   sous-traitant, numéro de TVA intracommunautaire s'il y est assujetti ;
3. transmission au formateur + **fenêtre de contestation de 8 jours** ;
4. **format électronique** : `genererXmlCII` (Factur-X) existe déjà et sert les
   factures clients — le réutiliser plutôt que d'en écrire un second.

⚠️ **Calendrier de la réforme** : au 1ᵉʳ septembre 2026 toutes les entreprises
doivent pouvoir **RECEVOIR** ; l'obligation d'**ÉMETTRE** ne touche les TPE/PME
qu'au **1ᵉʳ septembre 2027**. Il y a donc de la marge sur l'émission, mais
l'autofacturation doit naître conforme.

⚠️ **Le mandat doit être SIGNÉ avant le premier usage.** Générer une facture
d'autofacturation sans mandat en vigueur rend la pièce irrégulière et la TVA
qu'elle porte non déductible.

### 5.3 Le contrat APPORTEUR (vérifié, non traité)

🔑 **La construction n'est PAS la même que pour le formateur, et c'est ce qui la
rend possible :**

- **formateur** — « payé quand le client a payé » est **illicite** : l'art.
  L.441-10 du Code de commerce plafonne le délai convenu (60 j, ou 45 j fin de
  mois expressément stipulés), ces plafonds sont d'**ordre public**, la clause est
  **réputée non écrite** et l'amende va jusqu'à **2 M€** pour une personne morale ;
- **apporteur** — la même idée est **licite**, parce qu'on ne retarde pas une
  dette : on définit le **fait générateur** du droit (commission **acquise à
  l'encaissement**).

Et l'architecture d'`axion-apporteurs` est **déjà bâtie dessus** :
`paiement.recu` est l'un des sept types d'événements du contrat v1
(`src/server/partners/contrat.ts`, et `packages/contracts/events.ts` côté
Partners). La version fautive à ne pas écrire serait « due à la signature, payée
à l'encaissement ».

⚠️ Le contrat apporteur v1 vit dans le dépôt **`axion-apporteurs`**, pas ici.

### 5.4 Autres restes, plus anciens

- **D2** — payer un formateur sur une session que le client n'a pas réglée :
  arbitrage, pas défaut. Le correctif engagé rend l'encaissement **visible**.
- **D11** — la commission d'apporteur est **publiée et chiffrée** sur le site
  public sans back-office. `axion-ia-90` a retiré la promesse de tableau de bord
  (#1021, fusionnée) ; **les montants, eux, sont toujours affichés**.
- **Échéancier** — aucun modèle `Echeancier`, quatre circuits d'acompte qui ne se
  parlent pas (§ 8 de l'état vivant du 05/09).
- **L'alerte formateur sur `AXI-SESS-2026-001`** se fermera d'un clic dès que
  #1017 sera en production.

---

## 6. ⚠️ PIÈGES DE CE WORKTREE — lire avant de lancer quoi que ce soit

1. **`prisma/generated` est LOCAL à la branche.** Changer de branche sans
   régénérer produit des erreurs de typecheck qui ressemblent à des défauts de
   code (`'accord_hors_outil' does not exist in type…`). Après tout `checkout` :

   ```bash
   SKIP_ENV_VALIDATION=true DATABASE_URL="postgresql://stub:stub@stub.invalid:5432/stub" pnpm prisma:generate
   ```

2. **`pnpm test` (suite complète) tue la machine** — OOM observé deux fois.
   Cibler des répertoires.

3. 🔴 **`typecheck` + `eslint` + `format:check` + tests NE COUVRENT PAS Gate A.**
   Trois rouges de CI dans la même journée ont été causés par ça. Avant tout
   push :

   ```bash
   pnpm typecheck && pnpm lint && pnpm format:check
   for c in anti-hex anti-siren admin-gardes positionnement radius use-client zod contrast i18n; do
     echo "── $c"; pnpm "$c:check" || break
   done
   ```

4. **`git checkout -b <nom>` SANS base part de la branche courante**, pas de
   `main`. C'est comme ça que trois PR se sont retrouvées à se contenir.
   Toujours : `git checkout -b <nom> origin/main`.

---

## 7. 🔑 Les cinq leçons de la session — elles se répètent, elles valent mieux qu'un rappel

1. **Une correction ferme le chemin nominal et laisse le stock derrière.**
   Vu quatre fois : la remise d'exemplaire, le libellé des alertes ouvertes,
   l'assertion E2E de l'attestation, les affectations d'un formateur désactivé.
   « Les prochains passeront-ils ? » et « ceux qui auraient dû passer
   passeront-ils ? » sont deux questions ; on n'en pose qu'une.

2. **Un témoin qui répond à une question VOISINE de celle qu'on pose.**
   Le plus fréquent, et le plus coûteux :
   - « chaque motif trouve ≥ 1 fichier » reste vert sur `(admin)` nu, qui trouve
     8 chunks de `api/admin/` sans exclure aucun `page-*.js` ;
   - `fs.globSync` rend 311 fichiers là où le moteur réel en rend 0 ;
   - « 0 `use client` ajouté » n'est pas « 0 octet ajouté » ;
   - `mergeStateStatus` dit si une PR **peut** fusionner, jamais **où** ;
   - trois fois dans un seul fichier de garde : « trente (30) jours » matchait le
     préavis de résiliation, puis la clause de règlement des différends, et
     « Autofacturation » matchait **le commentaire du test lui-même**.
     → **Mesurer dans la RÉGION, pas dans le fichier. Et retirer les commentaires
     avant de mesurer une pièce.**

3. **Un témoin qui dépend du formatage ne mesure pas le code.** Prettier
   reformate ; une regex écrite sur une ligne rend alors ROUGE (ou VERT) sur un
   code juste. Normaliser les espaces, ou remonter le bloc syntaxique.

4. **Une leçon consignée dans un commit qui n'a pas atterri ne protège
   personne — y compris son auteur.** J'ai réécrit `#1010` dans un commentaire
   après avoir documenté le piège le matin même sur `#980`.

5. **Vérifier dans le CODE avant de servir une liste d'audit.** D1, D3 et D7
   étaient corrigés depuis la veille quand je les ai annoncés « restants ». Un
   document d'audit décrit le monde au moment où il a été écrit.

---

## 8. Coordination inter-sessions — ce qu'il faut savoir

- **Une réservation de file de fusion ne survit pas à la session qui la porte.**
  `axion-ia-f1` a tenu la file toute la matinée du 06 puis a disparu de
  `ListAgents` ; sa réservation est morte avec elle.
- **Annoncer un acte APRÈS l'avoir fait, pas seulement avant.** Un doublon d'envoi
  a été évité de justesse parce qu'une session a répondu à temps — pas parce
  qu'elle avait prévenu.
- `axion-ia-6c` porte le **cron de rattrapage** de l'exemplaire signé et le
  chantier **émargement**. `axion-ia-90` porte les **promesses publiques
  apporteurs**. Les prévenir avant de toucher à leurs zones.
