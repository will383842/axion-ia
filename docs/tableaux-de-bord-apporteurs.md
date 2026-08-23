# Tableaux de bord & traçabilité de l'argent — réseau d'apporteurs

> **Créé le** 2026-08-23 · **Aucun code écrit** — spécification fonctionnelle.
> Complète `docs/fonctionnement-reseau-apporteurs.md` (le parcours), `docs/audit-attribution-apporteurs-siren.md` (la clé SIREN), `docs/plan-recrutement-apporteurs-daffaires.md` (le plan).
>
> **Décision de Will (2026-08-23)** : chaque apporteur dispose d'un tableau de bord de suivi, et la console dispose du pilotage complet. Traçabilité intégrale des contrats, des sommes versées et des sommes en attente.
>
> ⚠️ **Cette décision annule ma recommandation précédente** (« version A d'abord, espace connecté plus tard »). L'espace apporteur entre en V1. Le coût est chiffré au §7.

---

## 1. Le principe directeur : la friction au bon endroit

Un espace connecté ajoute forcément de la friction. Toute la conception tient dans une seule règle :

> **On met de la friction là où l'apporteur a du temps. Jamais là où il n'en a pas.**

| Moment                    | Contexte réel                                                      | Friction acceptable  |
| ------------------------- | ------------------------------------------------------------------ | -------------------- |
| **Déposer un contact**    | Dans sa voiture, 90 secondes d'attention, il sort d'un rendez-vous | 🔴 **AUCUNE**        |
| Consulter ses commissions | Le soir, chez lui, au calme                                        | ✅ Connexion normale |
| Récupérer son contrat     | Une fois tous les six mois                                         | ✅ Connexion normale |

**Conséquence de conception, non négociable :**

> **Le dépôt de contact reste accessible SANS connexion**, par un lien direct porteur du code apporteur — même une fois l'espace en place.

Imposer un login au moment du dépôt ferait chuter le nombre de dépôts. Or le dépôt est la **seule** action qui crée de la valeur. L'espace connecté sert à _consulter_, pas à _saisir_.

**Pas de mot de passe.** Connexion par lien magique envoyé par email — le patron existe déjà (`espace-formateur` + `formateur-magic-link.tsx`). Un apporteur de 63 ans ne créera pas un mot de passe, et ne le retrouvera pas.

**Mobile d'abord.** Un apporteur consulte son téléphone, pas un écran 27 pouces.

---

## 2. 🔴 Le modèle de l'argent — le cœur du système

C'est la partie qui doit être irréprochable. Tout le reste est de l'affichage.

### 2.1 La règle fondatrice

> **L'apporteur est payé quand — et seulement quand — Axion-IA est payée. Au centime et au prorata.**

### 2.2 La chaîne de traçabilité, de bout en bout

Chaque euro versé à un apporteur doit être remontable jusqu'à l'euro encaissé qui le justifie :

```
Apporteur (Sophie)
   └─ Attribution (SIREN 123 456 789, déposée le 12/03, active jusqu'au 12/03/2027)
        └─ Client (Durand SAS)
             └─ Devis signé le 04/05 — 12 000 € HT
                  └─ Facture AXION-2026-0417 — 12 000 € HT
                       ├─ Encaissement #1 — 4 000 € le 15/05  →  commission acquise  600 €
                       ├─ Encaissement #2 — 4 000 € le 15/06  →  commission acquise  600 €
                       └─ Encaissement #3 — 4 000 € le 15/07  →  commission acquise  600 €
                                                                 ─────────────────────────
                                                                 Total Sophie : 1 800 €
                                                                 Dont Paul (parrain, 10 %) : 180 €
```

**Un clic depuis n'importe quelle ligne de commission doit remonter jusqu'à l'encaissement.** C'est la définition de « tracer à la perfection ».

### 2.3 Ce qui déclenche une commission

Le déclencheur est le modèle **`Payment`**, qui est déjà documenté dans votre schéma comme **la source de vérité des encaissements** (`payments`, SSOT du Hub facturation).

> **Un encaissement enregistré = une ligne de commission créée. Aucun autre déclencheur.**

Pas la signature du devis. Pas l'émission de la facture. **L'encaissement.**

### 2.4 Le prorata — parce que vos clients paient en plusieurs fois

Votre système gère déjà les échéanciers (`PaymentScheduleProfile`, `installmentNumber`, statut `partially_paid`). Il faut donc décider ce qui se passe quand une facture de 12 000 € est réglée en trois fois.

| Option                                          | Effet                                                         | Verdict                          |
| ----------------------------------------------- | ------------------------------------------------------------- | -------------------------------- |
| Payer la commission entière au 1er encaissement | Vous avancez de la trésorerie sur de l'argent pas encore reçu | ❌ Contredit la règle fondatrice |
| Attendre le solde total                         | Sophie attend 3 mois après sa vente                           | ⚠️ Démotivant, et injuste        |
| **Au prorata de chaque encaissement**           | Sophie touche 600 € à chaque échéance réglée                  | ✅ **Retenu**                    |

**Formule :**

```
commission acquise sur cet encaissement
   = commission totale  ×  (montant encaissé HT ÷ montant total HT de la facture)
```

> ⚠️ **Toujours sur le HT, jamais sur le TTC.** La TVA n'est pas un revenu : commissionner dessus reviendrait à reverser une partie de la TVA collectée.

### 2.5 Les avoirs et remboursements — la reprise

Votre schéma prévoit déjà `refunded`, `cancelled`, `void` et un modèle `Refund`. Le cas se produira.

> **Un remboursement crée une ligne de commission NÉGATIVE**, déduite du prochain versement de l'apporteur.

Ne jamais supprimer la ligne d'origine : on ajoute une reprise. L'historique doit rester lisible — c'est ce qui rend un litige défendable.

Si l'apporteur quitte le réseau avec un solde négatif : la clause de reprise doit figurer **dans le contrat**, sinon elle est inopposable.

### 2.6 Les états d'une ligne de commission

| État                      | Signification                         | Visible par l'apporteur |
| ------------------------- | ------------------------------------- | ----------------------- |
| `en_attente_encaissement` | Vente signée, rien d'encaissé         | « En cours »            |
| `acquise`                 | Encaissement reçu, commission due     | « Acquis »              |
| `a_payer`                 | Intégrée au relevé du mois            | « À verser le 5 »       |
| `payee`                   | Virement effectué                     | « Versé »               |
| `reprise`                 | Ligne négative (avoir, remboursement) | « Reprise »             |

### 2.7 Le cycle mensuel de versement

| Quand           | Ce qui se passe                                                                                              | Qui     |
| --------------- | ------------------------------------------------------------------------------------------------------------ | ------- |
| **Le 1er**      | Le système fige les lignes `acquise` du mois écoulé, déduit les reprises, génère **un relevé par apporteur** | 🤖      |
| **Le 1er**      | Chaque apporteur reçoit son relevé par email + dans son espace                                               | 🤖      |
| **Le 1er au 5** | L'apporteur émet sa facture (ou l'autofacturation la produit — cf. §7)                                       | 👤 / 🤖 |
| **Le 5**        | Vous validez le lot et payez                                                                                 | 👤      |
| **Le 5**        | Les lignes passent `payee`, les apporteurs sont notifiés                                                     | 🤖      |

**Seuil minimum de versement : 50 €.** En dessous, le solde est reporté au mois suivant. Sinon vous ferez des virements de 12 € à 200 personnes.

### 2.8 Un rappel qui reste vrai

Aucun versement sans **SIRET valide** et sans **facture** (ou mandat d'autofacturation). Payer un apporteur sans SIRET, c'est du travail dissimulé.

---

### 2.9 🔴 Le cofinancement : une partie payée par l'OPCO, le solde par l'entreprise

_Cas soulevé par Will le 2026-08-23. C'est le scénario qui casserait le modèle en silence._

#### La bonne nouvelle : le prorata absorbe le cas sans aucune exception

Formation 12 000 € HT — OPCO 8 000 €, entreprise 4 000 € de reste à charge :

| Encaissement | Payeur     | Commission acquise      |
| ------------ | ---------- | ----------------------- |
| 8 000 €      | OPCO Atlas | 8/12 de la commission   |
| 4 000 €      | Durand SAS | 4/12 de la commission   |
|              |            | **= commission pleine** |

**Aucun cas particulier à coder.** C'est précisément parce que le déclencheur est `Payment` — l'encaissement — et non la facture ni le payeur. Un cofinancement à trois payeurs fonctionnerait pareil.

#### 🔴 Le piège : la facture adressée à l'OPCO

Votre schéma prévoit `FactureFormationDestinataire = entreprise | **opco** | stagiaire | france_travail`, avec un `destinataireSiret` distinct du client.

**En subrogation, la facture de la part OPCO est adressée à l'OPCO** : son `destinataireSiret` est celui de l'OPCO, pas celui de l'entreprise bénéficiaire.

Si la résolution de commission passait par le destinataire de la facture, deux catastrophes :

1. La part OPCO — **souvent les deux tiers** — ne trouverait aucune attribution. L'apporteur perdrait l'essentiel de sa commission, sans comprendre pourquoi.
2. Pire : si un apporteur déposait un jour un OPCO comme entreprise, il encaisserait une commission sur **tous les dossiers financés de France**.

> **R13 — La résolution passe par l'entreprise BÉNÉFICIAIRE** (`FactureFormation.clientId` → `Client.siren`), **jamais** par le destinataire de la facture.
>
> **R14 — Les financeurs sont sur liste noire de dépôt.** Un OPCO, France Travail, une région, un OF partenaire ne peuvent jamais être déposés comme entreprise attribuable.

#### Sur quel montant commissionner ?

> **Sur le total HT de la prestation (12 000 €), pas sur le reste à charge (4 000 €).**

Commissionner sur le reste à charge créerait une incitation absurde : l'apporteur serait **pénalisé précisément quand l'argument du financement fonctionne le mieux** — l'argument qu'on lui demande justement d'utiliser pour ouvrir les portes.

Et c'est déjà cohérent avec votre grille : `COMMERCIAL_COMMISSIONS` s'appuie sur `basisTierId`, c'est-à-dire **le prix de la prestation**, pas le net encaissé auprès du client.

#### Le délai — le vrai sujet, et il est humain

Votre schéma le dit lui-même : `echeanceFinanceurAt` → _« les OPCO paient à 30-60 j »_. En pratique : après la formation, après justification (émargements, attestation), parfois bien au-delà.

Sophie verra donc « en cours » sur les deux tiers de sa commission pendant des mois. **Si le tableau de bord n'affiche qu'un vague « en cours », elle croira qu'on la balade.**

→ **Le tableau de bord doit ventiler par payeur et afficher l'échéance attendue :**

```
Durand SAS · Formation 2 jours · commission 1 800 €
├─ Entreprise      600 €   ✅ versé le 05/06
└─ OPCO Atlas    1 200 €   ⏳ paiement financeur attendu ~15/09
```

`DossierPayeur` (`payeurType`, `montantAttenduCents`) et `DossierFinancement.echeanceFinanceurAt` fournissent **exactement** ces deux informations. **Rien à créer** — juste à afficher.

#### Si l'OPCO refuse ou réduit sa prise en charge

`DossierFinancementStatut` prévoit `refuse`, et `montantAccordeCents` peut être inférieur à `montantDemandeCents`. Deux cas, **tous deux déjà couverts par la règle du prorata** :

| Cas                             | Conséquence                                                                                                       |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| L'entreprise paie la différence | Encaissement → commission acquise normalement. Rien de spécial.                                                   |
| Personne ne paie la différence  | **Aucun encaissement → aucune commission.** Et **aucune reprise à faire**, puisqu'on n'avait rien versé d'avance. |

> **C'est l'argument le plus fort en faveur du prorata** : sur un dossier de financement, il n'y a jamais de commission à aller récupérer chez un indépendant.

#### ⚠️ Rappel de séquencement

Tout ce mécanisme est **prêt dans le schéma** et doit être conçu correctement dès maintenant. Mais un financement OPCO suppose la certification Qualiopi — ce qui **ramène au point bloquant §3.4 du plan**. On construit la mécanique ; on ne vend pas l'argument avant que la certification existe.

---

## 3. L'espace apporteur — écran par écran

**Connexion** : lien magique par email, aucun mot de passe. **Mobile d'abord.**

### 3.1 Accueil — trois chiffres et un bouton

```
┌────────────────────────────────────┐
│  Bonjour Sophie                    │
│                                    │
│   1 800 €      600 €      2 400 €  │
│    versé      à verser    en cours │
│   (2026)      (le 5/09)            │
│                                    │
│  ⚠️ Durand SAS expire dans 12 jours│
│                                    │
│  ┌──────────────────────────────┐  │
│  │  ＋  DÉPOSER UN CONTACT      │  │
│  └──────────────────────────────┘  │
│                                    │
│  Mes entreprises (7)             › │
│  Mes commissions                 › │
│  Mes filleuls (2)                › │
│  Mes documents                   › │
└────────────────────────────────────┘
```

Trois chiffres, pas dix. **« à verser » est le chiffre qui la fait revenir.**

### 3.2 Mes entreprises

Chaque ligne : nom, date de dépôt, **compte à rebours d'échéance**, et un statut simple.

| Statut affiché               | Ce que ça veut dire                          |
| ---------------------------- | -------------------------------------------- |
| 🔵 En cours de qualification | Axion-IA n'a pas encore appelé               |
| 🟢 Rendez-vous pris          | Le contact a été pris                        |
| 🟠 Proposition en cours      | Un devis a été envoyé                        |
| ✅ Signé                     | Une commande existe → commission en route    |
| ⚪ Périmée                   | 90 jours sans suite, retournée au pot commun |

> **Question de confidentialité tranchée** : l'apporteur voit **l'avancement**, jamais **les montants** avant signature. Il n'a pas à connaître le prix négocié avec le client — il n'est pas mandaté pour négocier (cf. R9), et le lui montrer l'inciterait à s'en mêler. Après signature, il voit **sa** commission, pas la marge d'Axion-IA.

### 3.3 Mes commissions

Une ligne par prestation :

```
Durand SAS · Formation 2 jours
Commission totale        1 800 €
├─ Versé                 1 200 €   ✅ 05/06 et 05/07
├─ Acquis, à verser        600 €   → le 05/08
└─ En attente encaissement   0 €
```

Et un historique des relevés mensuels, téléchargeables.

### 3.4 Mes filleuls

Qui elle a parrainé, la date, ce que ça lui a rapporté, l'échéance des 12 mois — et **son lien de parrainage prêt à copier/partager**.

### 3.5 Mes documents

Contrat signé, avenants, relevés mensuels, attestations annuelles.

### 3.6 Déposer un contact

Le formulaire du §4.2 de `fonctionnement-reseau-apporteurs.md`, **également accessible hors connexion**.

---

## 4. La console — pilotage complet

Réutilise le design system admin existant (ADR 0028, `docs/admin-design-system.md`).

### 4.1 Pilotage — l'écran d'ouverture

| Bloc          | Ce qu'il montre                                                                |
| ------------- | ------------------------------------------------------------------------------ |
| **Réseau**    | Candidats · signés · **actifs (ont déposé)** · dormants (>60 j sans dépôt)     |
| **Pipeline**  | Contacts à qualifier · en cours · convertis · périmés                          |
| **Argent**    | CA généré par le réseau · commissions acquises · à verser · versées · reprises |
| **Rendement** | Coût par apporteur actif, **par canal de recrutement**                         |

Le tableau de bord de pilotage du plan (§9) se remplit **tout seul** à partir de là.

### 4.2 Les alertes qui appellent une action

- Contacts déposés non qualifiés depuis **> 48 h** ← _la plus importante : c'est ce qui tue la motivation du réseau_
- Attributions à **moins de 15 jours** de péremption
- Commissions à verser ce mois
- Apporteurs actifs devenus dormants
- Anomalies de dépôt (tentatives de doublon, quotas atteints)

### 4.3 Les écrans

| Écran                | Contenu                                                                                                   |
| -------------------- | --------------------------------------------------------------------------------------------------------- |
| **Apporteurs**       | Liste + fiche : contrat, SIRET, score de candidature, parrain, activité, CA généré, commissions, filleuls |
| **Contacts déposés** | File de qualification, priorisée par ancienneté                                                           |
| **Attributions**     | Toutes, filtrables par état / département / apporteur. Rattachement manuel des groupes de sociétés        |
| **Commissions**      | Le registre. Filtre par état. Bouton « générer les relevés du mois »                                      |
| **Contrats**         | Qui a signé quoi, quelle version, quand — via DocuSeal                                                    |
| **Anomalies**        | Rejets automatiques, tentatives de squattage, quotas dépassés                                             |

### 4.4 La règle de traçabilité

> **Depuis n'importe quelle ligne de commission, on doit atteindre en un clic : l'encaissement, la facture, le devis, le client, l'attribution, l'apporteur.**
>
> **Et inversement** : depuis un apporteur, on doit voir tout l'argent qu'il a généré et tout ce qu'il a reçu.

C'est cette double navigation qui rend un litige instantanément tranchable — et un contrôle comptable serein.

---

## 5. Ce qui tourne sans vous

| Automatique 🤖                                          | Humain 👤                                      |
| ------------------------------------------------------- | ---------------------------------------------- |
| Score des candidatures                                  | Appeler les candidats prioritaires             |
| Emails J0 / J2 / J7                                     | Animer le webinaire (1 h/semaine)              |
| Contrôles de dépôt (doublon, antériorité, quota)        | **Qualifier les contacts déposés** ← le goulot |
| Alerte de péremption J-75, péremption J+90              | Vendre                                         |
| Création des lignes de commission à chaque encaissement | Valider le lot mensuel                         |
| Calcul du prorata et des reprises                       | Payer                                          |
| Relevés mensuels + notifications                        |                                                |
| Calcul du parrainage                                    |                                                |
| Litiges d'attribution (règle mécanique)                 |                                                |

**Quatre lignes humaines, toutes commerciales.** Aucune saisie administrative.

---

## 6. Deux points de vigilance propres à ce chantier

### 6.1 Sécurité et cloisonnement

L'espace apporteur est une **nouvelle surface publique authentifiée** exposant des données personnelles et financières.

- Un apporteur ne doit **jamais** voir les données d'un autre — y compris par manipulation d'URL. À vérifier explicitement par des tests, pas seulement par l'UI.
- Les messages de collision ne révèlent jamais l'identité de l'autre apporteur (cf. R3).
- Passer `/security-review` avant la mise en ligne.

### 6.2 Budget de performance

`AGENTS.md` impose **First Load JS ≤ 75 KB gz par route** et **INP ≤ 100 ms**. Un espace avec tableaux et graphiques peut faire exploser ce budget.

⚠️ Et il faut le mesurer **à la main** : d'après `AGENTS.md`, les gates de bundle en CI sont en `continue-on-error: true` — **aucune PR qui alourdit le bundle ne rougira**. Compter sur la gate serait une fausse sécurité.

→ Mesure avant/après sur les routes de l'espace apporteur, dans la PR qui les introduit.

---

## 7. Le coût — révisé, honnêtement

| Chantier                                                | Charge    | Réutilise                                                        |
| ------------------------------------------------------- | --------- | ---------------------------------------------------------------- |
| C4 · Registre d'attribution SIREN                       | **6 j**   | Server Action candidature, `Client.siren`, chaîne `Devis→Client` |
| C6 · Espace apporteur (lien magique + 6 écrans mobile)  | **4 j**   | `espace-formateur`, `formateur-magic-link.tsx`                   |
| C7 · Moteur de commissions (prorata, reprises, relevés) | **4 j**   | `Payment` (SSOT encaissements), `Invoice`, `Refund`              |
| C8 · Console de pilotage (6 écrans + alertes)           | **3 j**   | Design system admin (ADR 0028), notifications                    |
| **Total pilotage complet**                              | **~17 j** |                                                                  |

À comparer avec les **~10 j** de la V1 sans espace connecté. **L'exigence de pilotage coûte environ 7 jours de plus.** C'est un arbitrage légitime — mais il doit être fait les yeux ouverts.

**Ce qui ne change pas** : C1 (scoring, 0,5 j), C2 (parrainage, 1 j), C3 (onboarding, 1 j), C5 (landings, 1,5 j) restent inchangés, et **C1 reste le bon point de départ**.

### Hors périmètre, à traiter plus tard

| Reporté                                                         | Déclencheur                                                                                                         |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **Autofacturation** (Axion-IA émet la facture pour l'apporteur) | Aux premières commissions — à valider avec l'expert-comptable, en tenant compte de la facturation électronique 2026 |
| Gestion automatique des groupes de sociétés                     | Probablement jamais                                                                                                 |
| Personne dédiée à la qualification                              | 100–150 apporteurs actifs                                                                                           |

---

## 8. Décisions à confirmer

- [ ] **B1** — Commission versée **au prorata de chaque encaissement** (et non au solde total)
- [ ] **B2** — Commission calculée sur le **HT**
- [ ] **B3** — Versement **mensuel**, relevé le 1er, paiement le 5
- [ ] **B4** — **Seuil minimum de 50 €**, report en dessous
- [ ] **B5** — Un remboursement crée une **ligne de reprise négative** (clause à mettre au contrat)
- [ ] **B6** — L'apporteur voit **l'avancement** mais **pas les montants** avant signature
- [ ] **B7** — Le **dépôt reste accessible sans connexion**, même avec l'espace en place
- [ ] **B8** — Connexion par **lien magique**, sans mot de passe
- [ ] **B9** — Espace apporteur **en V1** — coût accepté : ~17 j au lieu de ~10 j
- [ ] **B10** — Cofinancement : commission sur le **total HT de la prestation**, pas sur le reste à charge
- [ ] **B11** — Résolution par l'**entreprise bénéficiaire** (`clientId`), jamais par le destinataire de la facture _(R13)_
- [ ] **B12** — **Liste noire des financeurs** au dépôt : OPCO, France Travail, régions, OF partenaires _(R14)_
- [ ] **B13** — Le tableau de bord **ventile par payeur** et affiche l'échéance financeur attendue

**Toujours ouvert et bloquant pour le kit de vente** : le sujet financement / Qualiopi (§3.4 du plan).
