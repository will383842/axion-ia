# Plan de recrutement — Réseau national d'apporteurs d'affaires IA

> **Statut** : plan de travail actif — créé le 2026-08-23
> **Objectif** : constituer un réseau d'apporteurs d'affaires partout en France pour les formations, audits et intégrations IA d'Axion-IA.
> **Contrainte** : le plus vite possible, au coût de recrutement le plus bas possible.
> **Méthode** : on exécute les chantiers **les uns après les autres**, dans l'ordre du §6.

---

## 1. La décision qui structure tout : quelle métrique on pilote

On ne pilote **pas** le nombre d'inscrits.

Recruter 500 personnes est facile et quasi gratuit. Le problème est ailleurs : environ **85 % d'entre elles ne déposeront jamais un seul contact**, tout en consommant de l'onboarding, du support, une ligne CRM et de l'attention.

**La métrique unique du projet :**

> ### Nombre d'apporteurs ayant déposé leur **1er contact qualifié** dans les 30 jours suivant leur signature.

Tout le reste (candidatures reçues, contrats signés, comptes créés) n'est qu'un indicateur intermédiaire. Un canal qui produit 200 inscrits et 2 actifs est un **mauvais** canal, même s'il est gratuit.

**Conséquence stratégique n°1** : ne pas chercher à recruter 200 individus un par un. Chercher à signer **10 têtes de réseau** qui en amènent 20 chacune. Voir §7.1.

---

## 2. Décisions actées

| #   | Décision                                           | Détail                                                                                                                                                                                    |
| --- | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | **Cible de sourcing élargie**                      | On cherche des **apporteurs d'affaires** _et_ des **commerciaux indépendants** (agents commerciaux, multicartes, freelances de la vente, retraités du commerce).                          |
| D2  | **Un seul type de contrat : apporteur d'affaires** | Quel que soit le profil recruté, tout le monde signe un **contrat d'apporteur d'affaires**. Aucun contrat d'agent commercial. Voir §3 pour le pourquoi — c'est un point juridique majeur. |
| D3  | **Rémunération à la commission uniquement**        | Grille = SSOT `src/content/pricing.ts` → `COMMERCIAL_COMMISSIONS`. Aucun fixe, aucun droit d'entrée, aucun frais à la charge de l'apporteur.                                              |
| D4  | **Coût de démarrage nul pour l'apporteur**         | Argument central du recrutement, déjà porté par la copy (`COMMERCIAL_HERO`). À ne jamais contredire.                                                                                      |
| D5  | **Pas de closing obligatoire**                     | L'apporteur présente et met en relation. Axion-IA conclut. Déjà porté par `COMMERCIAL_OPPORTUNITY.darkCard`.                                                                              |

---

## 3. ⚠️ Le point juridique le plus important du projet

### 3.1 Pourquoi apporteur d'affaires et surtout PAS agent commercial

Ce sont **deux statuts totalement différents en droit**, et la confusion coûte cher.

|                | Apporteur d'affaires                                | Agent commercial                                                                                       |
| -------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Rôle           | **Met en relation.** Il signale un prospect, point. | **Négocie et/ou conclut** au nom du mandant, de façon permanente.                                      |
| Cadre légal    | Contrat libre (droit commun des contrats)           | **Statut d'ordre public** — art. L.134-1 et s. du Code de commerce                                     |
| Fin de contrat | Selon ce que le contrat prévoit                     | **Indemnité compensatrice obligatoire**, en pratique souvent **~2 ans de commissions** (art. L.134-12) |
| Registre       | Aucun                                               | Immatriculation au registre spécial (RSAC)                                                             |

**Le risque concret** : si vous signez des contrats d'agent commercial avec 200 personnes et que vous en résiliez 150 au bout d'un an, chacune peut réclamer une indemnité de fin de contrat. C'est un passif potentiel qui peut atteindre plusieurs centaines de milliers d'euros, sur un réseau qui n'a presque rien vendu.

→ **C'est pour cela que D2 existe. Elle n'est pas négociable.**

### 3.2 Le piège de la requalification (à lire absolument)

Un juge qualifie un contrat **d'après les faits, pas d'après son titre**. Écrire « contrat d'apporteur d'affaires » en haut de la page ne protège de rien si, dans la réalité :

- l'apporteur **négocie les prix** ou les conditions,
- il **signe** des documents au nom d'Axion-IA,
- il a un **mandat permanent** de représentation,
- il reçoit des **objectifs chiffrés**, un **reporting obligatoire**, des **directives**.

Ces éléments-là feraient basculer en agent commercial (indemnité de rupture) — voire, avec un lien de subordination, en **salariat déguisé** (travail dissimulé, redressement URSSAF, requalification en CDI).

**Règles de terrain à tenir, sans exception :**

- [ ] L'apporteur **ne négocie jamais** un prix. Il oriente vers Axion-IA.
- [ ] L'apporteur **ne signe rien** au nom d'Axion-IA.
- [ ] Aucun **objectif chiffré imposé**, aucune sanction en cas d'inactivité (on peut fixer une durée de validité de l'exclusivité d'un contact, ce n'est pas la même chose).
- [ ] Aucun **horaire**, aucune **présence** obligatoire, aucun outil imposé.
- [ ] Le vocabulaire interne suit : on ne dit pas « nos commerciaux », on dit « nos apporteurs » ou « nos partenaires ». Y compris dans les emails et le CRM.

### 3.3 Autres obligations

- [ ] **SIRET obligatoire** pour chaque apporteur avant tout versement. Pas de SIRET = travail dissimulé. Le tunnel de candidature doit collecter le SIRET (ou l'engagement d'en créer un, cf. `STATUT_OPTIONS` → `creation-statut`).
- [ ] **Facturation** : l'apporteur émet une facture, on ne « verse » pas une commission sans facture.
- [ ] **RGPD** : quand l'apporteur nous transmet les coordonnées d'un prospect, il opère un transfert de données personnelles. Le contrat doit prévoir qu'il a informé la personne et qu'il dispose d'une base légale. Le formulaire de dépôt de contact doit porter une case de confirmation.
- [ ] **Vivier candidats** : conservation 2 ans, déjà en place (`COMMERCIAL_APPLICATION_RETENTION`, consentement `memo-v2-2026-08-13`).

### 3.4 🔴 Le sujet financement — à trancher AVANT le premier recrutement

**Le problème.** La doctrine interne du projet est explicite et gatée dans le code : **aucune affirmation OPCO / Qualiopi / CPF** tant que `isQualiopiCertificationObtenue()` est faux (cf. `src/content/equipe/williams.ts`, `src/content/keywords/master.ts`).

Or la copy de recrutement vend, comme argument d'ouverture de portes :

> « beaucoup de nos prestations sont finançables : nous montons le dossier avec l'entreprise, qui n'a parfois même pas à avancer les fonds »
> — `COMMERCIAL_OPPORTUNITY.paragraphs.fr`

**Pourquoi c'est grave à l'échelle d'un réseau.** Un argument approximatif tenu par une personne est un malentendu. Le même argument mis dans un kit de vente distribué à 200 personnes qui le répètent en rendez-vous devient une **pratique commerciale trompeuse** industrialisée (art. L.121-2 C. conso), avec en face des dirigeants qui prendront une décision d'achat sur cette base.

**Trois issues possibles — il faut en choisir une :**

1. **Obtenir Qualiopi d'abord**, puis lancer le réseau. Le plus sûr, le plus lent.
2. **Retirer l'argument financement du kit de vente** et de la copy de recrutement. Le réseau se lance tout de suite, avec un argument en moins.
3. **Reformuler en conditionnel vérifiable** — n'affirmer que ce qui est vrai aujourd'hui (« nous étudions l'éligibilité avec vous »), sans jamais promettre une prise en charge. Nécessite une validation de la formulation exacte.

- [ ] **DÉCISION WILL REQUISE** : entourer 1, 2 ou 3. Aucun kit de vente n'est diffusé avant.

### 3.5 Interdiction absolue : CPF

Si un jour une prestation devient éligible CPF : le **démarchage commercial y est interdit** (loi n° 2022-1587 du 19 décembre 2022). Un réseau d'apporteurs qui prospecte sur du CPF est illégal par construction. À graver dans le contrat d'apporteur.

---

## 4. Les explications simples (le glossaire du projet)

### 4.1 Le « code de parrainage » — qu'est-ce que c'est exactement

**En une phrase** : c'est un petit code personnel donné à chaque apporteur, qu'il transmet à ses connaissances, et qui permet de savoir automatiquement que c'est _lui_ qui les a amenées.

**Concrètement, la scène :**

1. Paul signe son contrat d'apporteur. Le système lui attribue un code : `PAUL-4K2`.
2. Paul connaît trois anciens collègues commerciaux. Il leur envoie son lien :
   `axion-ia.com/devenir-commercial-ia?p=PAUL-4K2`
3. Sophie clique, remplit la candidature. Le code `PAUL-4K2` est enregistré **avec** sa candidature, sans qu'elle ait rien à faire.
4. Sophie signe, puis vend une formation trois mois plus tard. Elle touche sa commission normale.
5. **Parce que Sophie est enregistrée comme filleule de Paul, Paul touche en plus un petit pourcentage** — pris sur la marge d'Axion-IA, **jamais** prélevé sur Sophie.

**Pourquoi c'est le levier le plus puissant du plan** : un commercial indépendant connaît d'autres commerciaux indépendants. C'est le seul canal où le recrutement se fait tout seul, sans que vous ne payiez ni annonce, ni temps de prospection. Un réseau qui se recrute lui-même passe de croissance linéaire à croissance exponentielle.

#### 🔴 La règle juridique à ne jamais franchir

> **On ne rémunère JAMAIS l'acte de recruter. On rémunère UNIQUEMENT les ventes réelles du filleul.**

Payer quelqu'un parce qu'il a fait _inscrire_ quelqu'un d'autre — sans vente derrière — c'est un **système pyramidal** (art. L.121-15 du Code de la consommation) : nullité du contrat, sanctions pénales, et réputation détruite.

**Le format sain, à retenir :**

| Élément                  | Valeur retenue                                                    |
| ------------------------ | ----------------------------------------------------------------- |
| Déclencheur du paiement  | Une **vente réellement encaissée** par le filleul                 |
| Montant                  | **10 % de la commission du filleul**                              |
| Durée                    | **12 mois** à compter de la signature du filleul                  |
| Qui paie                 | **Axion-IA**, sur sa marge                                        |
| Prélevé sur le filleul ? | **Non, jamais**                                                   |
| Profondeur               | **1 seul niveau.** Le filleul du filleul ne rapporte rien à Paul. |
| Prime à l'inscription    | **Aucune. Zéro. Jamais.**                                         |

Le « 1 seul niveau » n'est pas un détail de confort : c'est ce qui distingue visiblement un programme de parrainage d'un système pyramidal.

---

### 4.2 L'onboarding automatique J0 / J2 / J7 — c'est quoi, et est-ce lourd ?

**Le problème qu'il résout.** Quelqu'un signe le lundi. S'il ne reçoit rien, il oublie. Trois semaines plus tard il n'a rien fait, et vous découvrez que vous avez 40 inscrits fantômes. La seule alternative sans automatisation, c'est **vous** qui rappelez 200 personnes une par une. Impossible.

**Ce que c'est, très simplement** : trois emails écrits **une seule fois**, envoyés **tout seuls** à chaque nouvel apporteur, décalés dans le temps.

| Quand                  | Email                                | Contenu                                                                                       | Son unique but                                             |
| ---------------------- | ------------------------------------ | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| **J0** — immédiat      | « Bienvenue, voici tout »            | Le kit de vente (PDF), la grille de commissions, le lien du webinaire, son code de parrainage | Qu'il ait tout, tout de suite                              |
| **J2** — 48 h après    | « Une question avant de démarrer ? » | Rappel du webinaire, 3 objections classiques traitées, un lien de réponse directe             | Le rattraper avant qu'il décroche                          |
| **J7** — 7 jours après | « Déposez votre premier contact »    | Un seul bouton, vers le formulaire de dépôt                                                   | Provoquer le **premier acte**, qui est le vrai basculement |

Le J7 est le plus important des trois. Un apporteur qui a déposé un contact une fois en déposera d'autres. Un apporteur qui n'en a jamais déposé n'en déposera jamais.

#### Est-ce lourd à mettre en place ? → **Non. C'est même le chantier le plus léger.**

Tout est déjà là dans votre code :

- `enqueueEmail()` (`src/server/queue/queues.ts:704`) accepte déjà une option **`delayMs`** → l'envoi différé à J2 et J7 est un simple paramètre, il n'y a **rien à construire**.
- Vous avez déjà **82 templates email** dans `src/lib/email/templates/`, avec une mise en page commune (`_layout.tsx`).
- Le template **J0 existe déjà** : `candidature-commercial-confirmee.tsx`.

**Reste à faire** : écrire 2 templates (J2, J7) et ajouter 2 appels `enqueueEmail` avec un délai.
**Charge réelle : ~1 jour**, dont la majorité est la rédaction des textes, pas le code.

---

### 4.3 L'écran « déposer un contact » — c'est quoi, et comment ça marche ?

**Le problème qu'il résout.** Aujourd'hui, un apporteur qui rencontre un dirigeant intéressé doit… quoi ? Vous envoyer un mail ? Un SMS ? Vous appeler ? Résultat : il ne le fait pas, ou l'information se perd, ou deux apporteurs revendiquent le même prospect et vous ne pouvez pas trancher.

**Ce que c'est** : un formulaire ultra-court où l'apporteur enregistre le prospect qu'il vient de rencontrer.

```
┌─────────────────────────────────────────┐
│  Déposer un contact                     │
│                                         │
│  Entreprise      [ ____________ ]       │
│  Personne + tél  [ ____________ ]       │
│  En 1 ligne      [ ____________ ]       │
│                                         │
│  ☐ J'ai informé cette personne que      │
│    je transmets ses coordonnées         │
│                                         │
│            [  Envoyer  ]                │
└─────────────────────────────────────────┘
```

**Ce qui se passe ensuite, automatiquement** : le contact est horodaté, enregistré **au nom de l'apporteur**, il arrive dans la console admin et déclenche une alerte Telegram. Si l'entreprise signe six mois plus tard — même en vous appelant directement sans repasser par l'apporteur — la trace existe et **la commission lui revient**.

**Pourquoi c'est l'écran le plus important du projet** : c'est la matérialisation de la promesse déjà écrite sur la landing (« Vous présentez. C'est tracé. Vous touchez. »). Sans lui, cette phrase est un mensonge. Et c'est l'unique geste qui transforme un inscrit en apporteur actif — donc la métrique du §1.

#### Est-ce lourd ? → **Ça dépend entièrement de la version choisie. Et c'est LA décision à prendre.**

**Version A — le formulaire public à code (RECOMMANDÉE pour démarrer)**

Une page publique `/deposer-un-contact`. L'apporteur saisit son code (`PAUL-4K2`) + les 3 champs. Pas de compte, pas de mot de passe, pas de connexion.

- ✅ Réutilise exactement le mécanisme du tunnel de candidature qui existe déjà (Server Action + rate-limit Redis + honeypot + chiffrement PII + notification Telegram).
- ✅ **Zéro friction** pour l'apporteur — et la friction est l'ennemi n°1 quand on veut du volume.
- ✅ Marche depuis un téléphone, dans la voiture, juste après le rendez-vous.
- ⚠️ Il ne voit pas ses contacts en cours. Il faut lui envoyer un récap par email.
- **Charge : ~1 jour.**

**Version B — l'espace apporteur complet**

Un vrai espace connecté, avec la liste de ses contacts, leur statut, ses commissions.

- ✅ Beaucoup plus engageant sur la durée, indispensable au-delà de ~50 apporteurs actifs.
- ✅ Le patron d'authentification existe déjà : `espace-formateur` + `formateur-magic-link.tsx` sont clonables.
- ⚠️ Nécessite un modèle Prisma dédié, une migration, l'auth, l'écran de suivi, le calcul des commissions.
- **Charge : ~5 à 6 jours.**

> **Recommandation : faire A maintenant, B plus tard.** La version A est bâtie sur la même Server Action que la version B utilisera. Le travail n'est pas jeté — il est réutilisé. Construire B en premier retarderait le lancement de trois semaines pour un écran que personne n'a encore besoin de consulter.

- [ ] **DÉCISION WILL REQUISE** : A d'abord (recommandé), ou B directement ?

---

### 4.4 Le scoring automatique des candidatures — c'est quoi, et comment ça marche ?

**Le problème qu'il résout.** Si le plan fonctionne, vous recevrez 30 à 60 candidatures par semaine. Vous ne pouvez pas en rappeler 60. Et si vous rappelez dans l'ordre d'arrivée, vous passerez 80 % de votre temps sur des profils qui ne vendront rien, pendant que les trois excellents attendront dix jours et iront voir ailleurs.

**Ce que c'est** : un petit calcul automatique qui attribue une note sur 100 à chaque candidature, **au moment où elle arrive**, à partir des réponses **déjà collectées** par le formulaire. La note s'affiche dans la console à côté du nom.

**Comment ça marche — le barème** (à partir des champs qui existent déjà dans `src/lib/commercial-application/model.ts`) :

| Signal                                        | Ce qu'on récompense                                                                                                                               | Points  |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| 🆕 **Taille du carnet d'adresses dirigeants** | _« Combien de dirigeants d'entreprise pouvez-vous appeler demain matin ? »_ — `150+` → 25 · `50-150` → 21 · `20-50` → 15 · `5-20` → 8 · `0-5` → 2 | **/25** |
| `B2B_ANNEES_OPTIONS`                          | Années de vente aux entreprises : `plus-10` → 25 · `5-10` → 21 · `3-5` → 15 · `1-3` → 8 · `moins-1` → 2                                           | **/25** |
| `STATUT_OPTIONS`                              | Déjà `independant` ou `auto-entrepreneur` → peut facturer demain matin                                                                            | **/12** |
| `TYPES_CLIENTS_OPTIONS`                       | Vend déjà aux `entreprises` ou en `mixte` (≠ particuliers)                                                                                        | **/10** |
| `DEPLACEMENT_OPTIONS`                         | Accepte de se déplacer (`oui` > `ponctuellement` > `non`)                                                                                         | **/8**  |
| `IA_OUTILS_OPTIONS`                           | Utilise déjà au moins un outil IA → n'aura pas peur du sujet                                                                                      | **/8**  |
| `INFORMATIQUE_USAGES_OPTIONS`                 | Utilise déjà un CRM ou LinkedIn → sait prospecter avec des outils                                                                                 | **/7**  |
| Zone couverte                                 | Territoire déclaré cohérent et non déjà saturé                                                                                                    | **/5**  |

> 🔴 **La question la plus prédictive du recrutement n'est aujourd'hui pas posée.**
> Le formulaire mesure l'_expérience_ (années de B2B, types de clients, expériences détaillées) mais jamais le **stock** : combien de dirigeants cette personne peut-elle appeler _demain matin_. Or c'est ce stock qui détermine s'il y aura un contact déposé dans les 30 jours — c'est-à-dire la métrique unique du §1.
>
> **Une seule ligne de chips à ajouter au tunnel**, et le scoring gagne son meilleur signal. À faire dans le même lot que C1.

**Ce qu'on en fait — c'est là que se trouve le gain de temps :**

| Note        | Traitement                                                                             | Qui agit |
| ----------- | -------------------------------------------------------------------------------------- | -------- |
| **≥ 70**    | Appel personnel **sous 24 h** + alerte Telegram immédiate                              | Vous     |
| **40 – 69** | Invitation automatique au webinaire hebdo. Vous ne les rappelez que s'ils y assistent. | Personne |
| **< 40**    | Mis en vivier, séquence email uniquement. Pas d'appel.                                 | Personne |

Vous ne passez plus d'appels qu'aux ~20 % du haut. Les 80 % restants ne sont pas jetés — ils passent par le webinaire, qui coûte le même temps qu'ils soient 3 ou 60.

> ⚠️ **Un garde-fou** : la note **oriente**, elle ne **rejette** jamais automatiquement. Un profil noté 35 peut être un retraité avec 40 ans de carnet d'adresses que le barème ne sait pas voir. Aucune candidature n'est supprimée par le score. Et il faut relire le barème tous les mois en le confrontant à ceux qui vendent vraiment.

#### Est-ce lourd ? → **Non, c'est le plus simple de tous.**

C'est une **fonction pure** : elle prend les réponses du formulaire, elle rend un nombre. Pas de base de données, pas d'API, pas d'IA, pas de dépendance. Elle est testable unitairement en quelques minutes.

**Charge : ~0,5 jour** (calcul + affichage dans la console + tests).

---

## 5. La table de charge — vue d'ensemble

| #   | Chantier                                                    | Charge    | Ce qui existe déjà et qu'on réutilise                                                                                                      |
| --- | ----------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| C1  | Scoring automatique                                         | **0,5 j** | Tous les champs sont déjà collectés                                                                                                        |
| C2  | Code de parrainage                                          | **1 j**   | `SOURCE_OPTIONS`, cookie UTM, `Submission.details` (JSON → pas de migration)                                                               |
| C3  | Onboarding auto J0/J2/J7                                    | **1 j**   | `enqueueEmail({delayMs})`, `_layout.tsx`, template J0 déjà écrit                                                                           |
| C4  | Dépôt de contact + registre d'attribution SIREN             | **~6 j**  | Server Action de candidature, `Client.siren`/`siret`, chaîne `Devis→Client`, rate-limit, honeypot, chiffrement PII, Telegram, crons BullMQ |
| C5  | Landing `/partenaire/[source]`                              | **1,5 j** | Page `memo-isere` à généraliser, cookie UTM déjà en place                                                                                  |
| C6  | Espace apporteur connecté (lien magique, 6 écrans mobile)   | **4 j**   | `espace-formateur`, `formateur-magic-link.tsx`                                                                                             |
| C7  | Moteur de commissions (prorata, reprises, relevés mensuels) | **4 j**   | `Payment` (SSOT encaissements), `Invoice`, `Refund`                                                                                        |
| C8  | Console de pilotage (6 écrans + alertes)                    | **3 j**   | Design system admin (ADR 0028), notifications                                                                                              |

**Total pour rendre le réseau opérationnel (C1 → C5) : ~10 jours de développement.**

> ⚠️ **C4 a été réévalué de 1 j à ~6 j** après l'audit d'attribution du 2026-08-23. L'estimation initiale portait sur un formulaire simple à 3 champs, **sans registre d'attribution par entreprise**. La décision d'attribuer chaque entreprise à son apporteur est meilleure — et plus lourde. Spécification complète : **`docs/audit-attribution-apporteurs-siren.md`**.

> ⚠️ **C6 → C8 entrent en V1** (décision Will, 2026-08-23) : espace apporteur connecté + moteur de commissions + console de pilotage. **Total pilotage complet : ~17 jours** au lieu de ~10. L'exigence de traçabilité intégrale coûte environ 7 jours de plus — arbitrage assumé. Spécification : **`docs/tableaux-de-bord-apporteurs.md`**.
> C6 est reporté et n'est déclenché qu'au seuil du §6.

---

## 6. L'ordre d'exécution

> On fait **un chantier à la fois**, on le termine, on le déploie, on passe au suivant.

### Étape 0 — Les deux décisions bloquantes

- [ ] **§3.4** — trancher le sujet financement (Qualiopi d'abord / retirer l'argument / reformuler)
- [ ] **§4.3** — trancher version A ou version B pour le dépôt de contact
- [ ] **Attribution** — acter les décisions **A1 → A11** de `docs/audit-attribution-apporteurs-siren.md`

_Rien ne part avant. Le kit de vente dépend de la première, le planning de la seconde._

### Étape 1 — C1 · Scoring automatique · 0,5 j

- [ ] Écrire la fonction pure de scoring + tests unitaires (barème du §4.4)
- [ ] Calculer le score à la soumission, le stocker dans `Submission.details`
- [ ] L'afficher dans la console `contacts/candidatures` (pastille couleur + note)
- [ ] Alerte Telegram renforcée si score ≥ 70

_On commence par là parce que c'est le plus rapide, que ça ne dépend de rien, et que ça sert dès la première candidature reçue._

### Étape 2 — C2 · Code de parrainage · 1 j

- [ ] Générer un code unique et lisible à la signature du contrat
- [ ] Lire le paramètre `?p=CODE` dans l'URL et le poser en cookie (même mécanisme que le cookie UTM)
- [ ] Ajouter `parrainage` dans `SOURCE_OPTIONS` + un champ code visible et pré-rempli
- [ ] Enregistrer le lien parrain → filleul dans `Submission.details`
- [ ] Afficher le parrain dans la console
- [ ] Rédiger la clause de parrainage dans le contrat (règles du §4.1 : ventes réelles, 10 %, 12 mois, 1 niveau, jamais l'inscription)

### Étape 3 — C4 · Dépôt de contact + registre d'attribution SIREN · ~6 j

> 📄 **Spécification complète : `docs/audit-attribution-apporteurs-siren.md`** — clé SIREN (et non SIRET), fenêtre de 12 mois, anti-squattage, charge révisée.

- [ ] Modèle `AttributionApporteur` (SIREN unique) + migration
- [ ] Autocomplétion entreprise par API publique — l'apporteur ne tape **jamais** un numéro (+ repli manuel)
- [ ] Page publique `/deposer-un-contact` — entreprise + personne rencontrée + case RGPD
- [ ] Server Action calquée sur `commercial-application/actions.ts` (rate-limit, honeypot, chiffrement PII, hash IP)
- [ ] Contrôles bloquants : doublon SIREN, antériorité `Client`, quota 15/semaine
- [ ] Cron de péremption à 90 jours
- [ ] Écran console + rattachement manuel des groupes de sociétés
- [ ] Résolution `Facture encaissée → Client.siren → attribution active → commission`
- [ ] Notification Telegram + email « contact bien enregistré à votre nom »

_Avant C3, parce que l'email J7 pointe vers cette page — elle doit exister d'abord._

### Étape 4 — C3 · Onboarding automatique · 1 j

- [ ] Template J2 « une question avant de démarrer ? »
- [ ] Template J7 « déposez votre premier contact » → lien vers `/deposer-un-contact`
- [ ] Deux `enqueueEmail` avec `delayMs` à la signature du contrat
- [ ] Compléter le J0 existant : kit de vente, grille de commissions, code de parrainage, lien webinaire
- [ ] Vérifier le marquage `marketing` et le respect de la désinscription

### Étape 5 — C5 · Landing `/partenaire/[source]` · 1,5 j

- [ ] Généraliser la page `memo-isere` en gabarit paramétrable
- [ ] Une URL par canal : journal, club d'affaires, école, association, salon
- [ ] UTM automatiques + attribution de la source à la candidature
- [ ] QR code par source (réutiliser `admin-qr-codes`) pour les flyers et la presse papier
- [ ] Garder `noindex` sur les déclinaisons (même raison que les 40 pages villes : contenu quasi identique → doorway)

### Étape 6 — Les tâches non-dev, en parallèle des étapes 1 à 5

- [ ] **Contrat d'apporteur d'affaires** relu par un juriste, avec les clauses du §3.2, §3.3, §3.5 et la clause de parrainage du §4.1
- [ ] **Kit de vente** (PDF) — conforme à la décision §3.4
- [ ] **Webinaire hebdomadaire** : créneau fixe, support, replay automatique
- [ ] **Signature électronique** du contrat (DocuSeal est déjà en place, cf. ADR 0014)

### Étape 7 — C6 · Espace apporteur connecté · 4 j

> 📄 **Spécification : `docs/tableaux-de-bord-apporteurs.md` §3**

- [ ] Connexion par **lien magique**, sans mot de passe (cloner `espace-formateur`)
- [ ] Accueil mobile : 3 chiffres (versé / à verser / en cours) + bouton « Déposer un contact »
- [ ] Mes entreprises (avancement + compte à rebours, **sans les montants avant signature**)
- [ ] Mes commissions · Mes filleuls · Mes documents
- [ ] ⚠️ Cloisonnement testé explicitement (un apporteur ne voit jamais un autre, y compris par URL)
- [ ] ⚠️ Mesure bundle avant/après **à la main** (les gates CI sont en `continue-on-error`)

### Étape 8 — C7 · Moteur de commissions · 4 j

> 📄 **Spécification : `docs/tableaux-de-bord-apporteurs.md` §2**

- [ ] Déclencheur = `Payment` (SSOT des encaissements), **jamais la signature**
- [ ] Prorata sur chaque encaissement, calculé sur le **HT**
- [ ] Lignes de reprise négatives sur avoir / remboursement (`Refund`)
- [ ] Relevé mensuel par apporteur (le 1er), seuil de versement 50 €
- [ ] Calcul du parrainage (10 %, 12 mois, 1 niveau)

### Étape 9 — C8 · Console de pilotage · 3 j

> 📄 **Spécification : `docs/tableaux-de-bord-apporteurs.md` §4**

- [ ] Écran Pilotage (réseau · pipeline · argent · rendement par canal)
- [ ] Alertes — dont **contacts non qualifiés depuis > 48 h**, la plus importante
- [ ] Écrans Apporteurs · Contacts déposés · Attributions · Commissions · Contrats · Anomalies
- [ ] Navigation traçante dans les deux sens : commission ↔ encaissement ↔ facture ↔ devis ↔ client ↔ attribution ↔ apporteur

---

## 7. Les canaux de recrutement

### 7.1 🥇 Levier n°1 — Les têtes de réseau (le meilleur rapport effort/volume)

Ne pas recruter 200 individus. Signer **10 personnes ou structures qui en amènent 20 chacune**.

On cherche des gens qui ont **déjà** le carnet d'adresses dirigeants et qui vendent **déjà** de l'immatériel :

| Cible                                                   | Pourquoi ça marche                                                     | Volume potentiel        |
| ------------------------------------------------------- | ---------------------------------------------------------------------- | ----------------------- |
| Courtiers en financement professionnel                  | Voient tous les dirigeants, vendent déjà du montage de dossier         | 5 – 50                  |
| Réseaux de mandataires (immobilier d'entreprise)        | Milliers d'indépendants déjà structurés, culture commission            | 20 – 200                |
| Experts-comptables et AGC                               | Prescripteur n°1 du dirigeant, cherchent des services à valeur ajoutée | 1 cabinet = 200 clients |
| Consultants RH / QVT / transformation indépendants      | Même acheteur, offre complémentaire, pas concurrente                   | 1 – 5                   |
| Agents commerciaux multicartes (fédérations du secteur) | Cherchent activement une carte de plus                                 | 10 – 100                |
| Clubs d'affaires (BNI, Dynabuy, CJD, CCI locales)       | Une visite = 30 indépendants dans la salle                             | 3 – 10 par visite       |

**Le pitch n'est pas « deviens apporteur ».** C'est : _« j'ajoute une ligne de revenu à votre réseau, sans que vous changiez quoi que ce soit à votre activité. »_ Plus l'override de parrainage sur les ventes de ses membres.

- [ ] Constituer une liste de 200 têtes de réseau ciblées
- [ ] 10 emails personnalisés par jour, 3 semaines
- **Coût : 0 €.**

### 7.2 Le volume gratuit ou quasi gratuit

- [ ] **Google for Jobs** — vous l'avez déjà (JobPosting multi-lieux sur `/devenir-commercial-ia`). **Vérifier qu'il est bien remonté** : c'est votre plus gros robinet gratuit. Le cron de fraîcheur (`JOB_OFFER_FRESHNESS_MAX_DAYS = 45`) surveille déjà la péremption.
- [ ] **Leboncoin Emploi** — très fort sur ce profil exact (indépendant, complément de revenu, province). Quelques dizaines d'euros.
- [ ] **Indeed / HelloWork / Meteojob / Jobijoba** — dépôt organique gratuit.
- [ ] **France Travail** — ⚠️ refuse souvent les offres sans contrat de travail. Tester, ne pas compter dessus.
- [ ] **LinkedIn manuel** — recherche `"agent commercial" OR "apporteur d'affaires" OR "multicarte"` + filtre région ; 25 invitations/jour avec une note de 200 caractères. ~15 candidatures/semaine si le message est bon.
- [ ] **Annuaires spécialisés agents commerciaux / apporteurs** — plusieurs existent, gratuits ou < 100 €/an. _À vérifier un par un avant d'y investir du temps : je ne les ai pas validés._
- [ ] **Écoles — BTS NDRC, BUT TC** — un mail au responsable des relations entreprises de 50 établissements = 50 promotions touchées.

### 7.3 🎯 Les commerciaux retraités — comment les accrocher

**Pourquoi ce segment est le meilleur de tous, et pourquoi personne ne le cible.** Un commercial de 63 ans qui vient de partir en retraite, c'est : 35 ans de carnet d'adresses **encore chaud**, une crédibilité immédiate face à un dirigeant, aucune pression sur ses revenus, et une disponibilité totale. Personne ne va les chercher, parce que tout le monde recrute « des jeunes dynamiques ».

#### Ce qui les motive — et ce n'est pas l'argent

L'erreur qui tue ce recrutement, c'est de leur parler de « revenus déplafonnés ». Ce n'est pas leur sujet. Leurs vrais moteurs, dans l'ordre :

1. **Rester utile et rester dans le jeu.** La retraite est souvent vécue comme une mise à l'écart brutale.
2. **Garder le lien social** — les déjeuners, les rendez-vous, les gens.
3. **Transmettre.** Ils ont une expertise et plus personne à qui la donner.
4. **Choisir son rythme.** Deux jours par semaine, et pas en août.
5. **Aucun patron, aucun objectif, aucun reporting.** Ils ont donné.
6. _Et seulement ensuite_ : un complément de revenu agréable.

#### 🔑 L'objection n°1 qui bloque tout, et la clé qui l'ouvre

> **« Est-ce que ça va toucher ma pension de retraite ? »**

C'est **la** question. Tant qu'elle n'a pas de réponse claire et rassurante, rien ne se passe — et la plupart n'osent même pas la poser, ils disparaissent simplement.

Le dispositif du **cumul emploi-retraite** permet, sous conditions (notamment avoir liquidé l'ensemble de ses pensions à taux plein et atteint l'âge requis), de reprendre une activité **sans plafonnement de revenus**. Le statut de micro-entreprise rend la démarche simple.

- [ ] ⚠️ **À faire valider par l'expert-comptable avant toute communication** : je ne garantis ni les seuils, ni les conditions exactes, ni leur état actuel. Ne jamais affirmer un chiffre non vérifié à un retraité — c'est sa pension.
- [ ] Une fois validé : produire **une page dédiée « Retraité : ce que ça change (et ne change pas) pour votre pension »**. C'est cette page, à elle seule, qui débloque le segment.

#### Le message qui fonctionne

> **« Vous avez 35 ans de carnet d'adresses. Nous avons un sujet que vos anciens clients réclament.
> Trois rendez-vous par mois, à votre rythme. Pas de patron, pas d'objectif. »**

Vocabulaire à **bannir** : « job », « poste », « objectifs », « performance », « challenge », « recrutement », « jeune et dynamique ».
Vocabulaire à **utiliser** : « votre expérience », « à votre rythme », « transmettre », « rester dans le coup », « votre réseau ».

#### Où les trouver

- [ ] **La presse locale et régionale** — c'est leur média n°1, très loin devant. **Le Mémorial de l'Isère touche exactement ce segment** : ce n'est pas un hasard si ce canal a été choisi, et c'est un argument fort pour le dupliquer.
- [ ] **LinkedIn** — cette tranche d'âge y est très active et sous-sollicitée. Filtrer sur des intitulés passés (« ancien directeur commercial », « retraité »).
- [ ] **Radios locales** — encart peu cher, audience parfaitement alignée.
- [ ] **Clubs services (Rotary, Lions) et associations d'anciens dirigeants** — forte densité de profils, mais ⚠️ beaucoup de ces structures sont **bénévoles par statut** : les approcher pour de la **prescription et de la mise en relation**, pas pour y recruter des apporteurs rémunérés. Vérifier au cas par cas.
- [ ] **Alumni d'écoles de commerce**, section « seniors ».
- [ ] **Bulletins municipaux et journaux d'associations** — coût quasi nul, lectorat exactement ciblé.

### 7.4 Dupliquer le Mémorial de l'Isère

`/memo-isere` est un test grandeur nature. **Il faut le mesurer sérieusement** : coût de l'encart ÷ nombre de candidatures reçues avec `source = memorial-isere`.

- [ ] Relever le résultat 3 semaines après parution
- [ ] Si le coût par candidature est bon → dupliquer sur la presse quotidienne régionale et les journaux gratuits locaux, **une landing `/partenaire/[journal]` par titre** (chantier C5)

C'est potentiellement le canal le moins cher de France pour ce profil, et le seul qui atteint le segment retraités du §7.3.

---

## 8. Le planning 90 jours

**Budget cible : moins de 2 000 €.**

| Période           | Ce qu'on fait                                                                                                                                            |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Semaines 1–2**  | Décisions §3.4 et §4.3. Chantiers C1 → C4. Contrat juriste. Kit de vente. Premier webinaire calé.                                                        |
| **Semaines 3–6**  | C5. 200 emails têtes de réseau. Dépôt sur tous les jobboards gratuits. LinkedIn 25/jour. **Mesure du Mémorial de l'Isère.** Page « retraités » en ligne. |
| **Semaines 7–12** | On double le budget sur les **2 canaux qui ont le meilleur coût par apporteur _actif_**. **On coupe tous les autres, sans état d'âme.**                  |

### L'objectif honnête

Viser 200 apporteurs actifs en 90 jours est **irréaliste** — autant le dire maintenant plutôt que de le constater au jour 90.

> **Objectif tenable : 30 à 40 apporteurs actifs + 3 têtes de réseau signées.**

Et cela vaut infiniment mieux que 400 inscrits fantômes, qui coûtent du support et ne rapportent rien. Les têtes de réseau sont ce qui fait basculer le trimestre suivant.

---

## 9. Le tableau de bord de pilotage

À relever **chaque semaine**, une seule ligne par canal :

| Canal               | Coût € | Candidatures | Score ≥ 70 | Contrats signés | **Actifs (1er contact déposé)** | **€ / actif** |
| ------------------- | ------ | ------------ | ---------- | --------------- | ------------------------------- | ------------- |
| Têtes de réseau     |        |              |            |                 |                                 |               |
| Google for Jobs     |        |              |            |                 |                                 |               |
| Leboncoin           |        |              |            |                 |                                 |               |
| LinkedIn            |        |              |            |                 |                                 |               |
| Mémorial de l'Isère |        |              |            |                 |                                 |               |
| Parrainage          |        |              |            |                 |                                 |               |
| Retraités           |        |              |            |                 |                                 |               |

**La seule colonne qui décide** est la dernière. Un canal gratuit qui produit 0 actif est plus coûteux qu'un canal à 300 € qui en produit 10.

---

## 10. Sources dans le code

| Sujet                                          | Fichier                                                |
| ---------------------------------------------- | ------------------------------------------------------ |
| Copy de recrutement                            | `src/content/recrutement/commercial-offer.ts`          |
| Grille de commissions (SSOT)                   | `src/content/pricing.ts` → `COMMERCIAL_COMMISSIONS`    |
| Modèle du tunnel de candidature                | `src/lib/commercial-application/model.ts`              |
| Server Action de candidature                   | `src/features/commercial-application/actions.ts`       |
| Zone Mémorial de l'Isère                       | `src/content/recrutement/memo-isere-zone.ts`           |
| Dates de publication des offres                | `src/content/recrutement/dates.ts`                     |
| Sitemap recrutement                            | `src/app/sitemap-recrutement.xml/route.ts`             |
| File d'envoi email (`delayMs`)                 | `src/server/queue/queues.ts`                           |
| Templates email                                | `src/lib/email/templates/`                             |
| Patron d'espace connecté à cloner              | `src/app/[locale]/espace-formateur`                    |
| Doctrine financement (gate Qualiopi)           | `src/content/equipe/williams.ts`                       |
| SIREN / SIRET client                           | `prisma/schema.prisma` → `model Client` (l. 5505-5507) |
| Encaissements (SSOT)                           | `prisma/schema.prisma` → `model Payment`               |
| **Fonctionnement de bout en bout**             | **`docs/fonctionnement-reseau-apporteurs.md`**         |
| **Audit d'attribution des entreprises**        | **`docs/audit-attribution-apporteurs-siren.md`**       |
| **Tableaux de bord & traçabilité de l'argent** | **`docs/tableaux-de-bord-apporteurs.md`**              |
| **Annonce Le Bon Coin + landing + pilotage**   | **`docs/annonce-leboncoin-recrutement.md`**            |
