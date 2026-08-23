# Audit — Attribution des entreprises aux apporteurs d'affaires

> **Créé le** 2026-08-23 · Complète `docs/plan-recrutement-apporteurs-daffaires.md` (§4.3 et §5)
> **Question posée** : « c'est nous qui signons avec l'entreprise, pas l'apporteur. Comment attribuer chaque entreprise à son apporteur ? Par le SIRET ? Pour la première commande et uniquement pour les formations ? Est-ce tenable avec des centaines d'apporteurs, partout en France ? »
> **Verdict global** : **l'intuition est juste, la clé est fausse, la portée est mal bornée, et le vrai risque n'est pas technique.**

---

## 0. Réponses courtes

| Question                                                      | Réponse                                                                                                                                                                                                                                      |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| « Ce n'est pas l'apporteur qui signe »                        | **Exact, et c'est déjà le design.** L'apporteur n'a aucun mandat, ne négocie pas, ne signe rien (cf. plan §3.2). C'est précisément **pour cela** que le registre d'attribution est indispensable : c'est la seule preuve de qui a amené qui. |
| « Ça devrait fonctionner avec le SIRET ? »                    | **Bonne intuition, mauvaise clé.** La clé d'attribution doit être le **SIREN** (9 chiffres, l'entreprise). Le SIRET (14 chiffres) désigne un **établissement** et **change quand l'entreprise déménage**. Détail au §2.                      |
| « Première commande uniquement ? »                            | **Non — trop étroit, et contre-productif.** Prendre une **fenêtre de 12 mois** à la place. Détail au §3.1.                                                                                                                                   |
| « Uniquement les formations ? »                               | **Non.** Votre grille publique promet déjà des commissions sur les audits (30 %) et les intégrations (15 %). Restreindre maintenant reviendrait à changer le contrat de gens déjà recrutés. Détail au §3.2.                                  |
| « Le code de parrainage, c'est bien apporteur → apporteur ? » | **Oui, exactement, et rien d'autre.** C'est une couche totalement distincte de l'attribution client. Détail au §1.                                                                                                                           |
| « Est-ce tenable à des centaines d'apporteurs ? »             | **Oui techniquement, non spontanément.** La base de données n'est pas le problème. Le problème, ce sont le squattage, l'antériorité et la charge humaine. Détail aux §4 et §7.                                                               |

---

## 1. Ne jamais confondre : il y a DEUX couches indépendantes

C'est la source de confusion la plus probable du projet. Deux mécanismes, deux objectifs, aucun rapport entre eux.

|                         | **Couche RECRUTEMENT**                                         | **Couche ATTRIBUTION**                                       |
| ----------------------- | -------------------------------------------------------------- | ------------------------------------------------------------ |
| Nom                     | Code de parrainage                                             | Registre SIREN                                               |
| Qui amène qui           | Paul (apporteur) amène **Sophie**, une **nouvelle apporteuse** | Sophie amène **l'entreprise Durand**, un **client**          |
| Objet du lien           | Une **personne** qui rejoint le réseau                         | Une **entreprise** qui achète                                |
| Clé technique           | Code apporteur (`PAUL-4K2`)                                    | **SIREN** (9 chiffres)                                       |
| Déclencheur du paiement | Une vente réalisée par **Sophie**                              | Une facture **encaissée** par Axion-IA auprès de Durand      |
| Bénéficiaire            | Paul, 10 % de la commission de Sophie, 12 mois                 | Sophie, commission pleine selon la grille                    |
| Durée                   | 12 mois après la signature de Sophie                           | 12 mois après l'enregistrement de Durand                     |
| Risque juridique propre | Système pyramidal si on paie l'inscription                     | Requalification en agent commercial si le lien est perpétuel |

> **Un apporteur a UN seul code, utilisé dans DEUX contextes différents.**
> `?p=PAUL-4K2` sur une candidature = parrainage. `PAUL-4K2` sur un dépôt d'entreprise = attribution.

**Oui : le code de parrainage sert bien à ce que vos apporteurs recrutent d'autres apporteurs.** C'est le seul canal de recrutement qui se finance tout seul et ne vous coûte aucun temps.

---

## 2. Audit de la clé : pourquoi SIREN et pas SIRET

### 2.1 Le rappel qui décide

|           | SIREN                                        | SIRET                                             |
| --------- | -------------------------------------------- | ------------------------------------------------- |
| Longueur  | 9 chiffres                                   | 14 chiffres (= SIREN + NIC sur 5)                 |
| Identifie | **L'entreprise** (l'entité juridique)        | **Un établissement** (un site physique)           |
| Stabilité | **Stable pour toute la vie de l'entreprise** | **Change quand l'établissement change d'adresse** |
| Quantité  | 1 par entreprise                             | 1 à N par entreprise                              |

### 2.2 Les trois scénarios où le SIRET casse l'attribution

**Scénario A — le déménagement (fréquent, et fatal).**
Sophie enregistre l'entreprise Durand, SIRET `123 456 789 00012`, à Lyon 3e. Six mois plus tard, Durand déménage à Lyon 7e. **L'INSEE ferme l'ancien SIRET et en crée un nouveau** : `123 456 789 00027`. Le SIREN, lui, n'a pas bougé.
→ Avec une clé SIRET, l'attribution de Sophie est **orpheline**. Elle ne sera pas payée. Elle le découvrira, et elle aura raison de râler.

**Scénario B — l'entreprise multi-sites.**
Le groupe Durand a 12 établissements, donc 12 SIRET, mais **un seul SIREN**. Sophie enregistre le site de Grenoble. Trois mois plus tard, la direction commande une formation pour tout le groupe, facturée au siège de Paris — **un autre SIRET**.
→ Avec une clé SIRET, Sophie ne touche rien alors qu'elle est bien à l'origine de l'affaire.

**Scénario C — la course entre deux apporteurs sur la même entreprise.**
Sophie enregistre le SIRET de Grenoble, Marc enregistre le SIRET de Paris. Même SIREN.
→ Avec une clé SIRET, **les deux dépôts passent** (deux valeurs différentes, aucune collision détectée). Le jour de la vente, deux apporteurs réclament la même commission, et vous n'avez aucune règle mécanique pour trancher. Avec une clé SIREN, le second dépôt est rejeté automatiquement à la seconde près.

### 2.3 La règle retenue

> **Clé d'attribution = SIREN, normalisé sur 9 caractères, avec un index unique.**
> **Le SIRET est capté et stocké aussi** — mais comme **contexte**, jamais comme clé.

Le SIRET reste utile : il dit _quel site_ a été visité, il sert à la logistique de la formation, et c'est souvent le numéro que l'apporteur a effectivement sous les yeux. On le garde. On ne s'en sert simplement pas pour décider qui est payé.

**Note pratique** : les 9 premiers chiffres d'un SIRET **sont** le SIREN. Si l'apporteur saisit un SIRET, on en dérive le SIREN automatiquement. Il n'y a donc rien à lui expliquer — c'est un détail d'implémentation, pas d'interface.

### 2.4 Le cas des groupes (à ne PAS sur-concevoir)

Une holding avec 5 filiales = **5 SIREN différents**. Si Sophie amène la filiale et que le groupe achète via la holding, l'attribution automatique échoue.

→ **Traitement recommandé : à la main, au cas par cas.** Un champ « rattacher cette attribution à un autre SIREN » dans la console, avec justification et trace. Ce cas représentera moins de 2 % du volume. Construire une gestion automatique des groupes coûterait plusieurs jours pour un gain marginal, et introduirait des règles impossibles à expliquer aux apporteurs.

---

## 3. Audit de la portée

### 3.1 « Première commande uniquement » → remplacer par une fenêtre de 12 mois

**Ce que fait bien votre intuition** : elle **borne** l'attribution. C'est capital, et pas seulement pour des raisons budgétaires. Une attribution **perpétuelle** transformerait l'apporteur en titulaire d'un **portefeuille permanent**, ce qui est l'un des indices caractéristiques de l'**agent commercial** (art. L.134-1 C. com.) — donc un risque direct de requalification et d'indemnité de fin de contrat. Borner, c'est protéger. Votre réflexe est le bon.

**Ce que « première commande » casse quand même** :

> Sophie amène l'entreprise Durand. Première commande : un audit à 490 €. Sa commission : ~147 €.
> Trois semaines plus tard, sur la base de cet audit, Durand signe une intégration à 28 000 €.
> Commission qu'aurait dû toucher Sophie : ~4 200 €. **Elle touche 0 €.**

Elle partira, et elle racontera pourquoi autour d'elle — dans un milieu où les indépendants se parlent beaucoup. Or l'audit d'entrée qui débouche sur la vraie mission est exactement le parcours que votre offre encourage.

Pire : la règle crée une **incitation perverse**. Un apporteur qui comprend le mécanisme va _retenir_ son entreprise jusqu'à ce qu'elle soit prête à commander gros. Il ne déposera plus les contacts au bon moment, et vous perdrez la visibilité en temps réel qui fait tout l'intérêt du registre.

**Les trois options, comparées :**

| Option                                     | Risque de requalification             | Motivation apporteur                        | Complexité                | Verdict        |
| ------------------------------------------ | ------------------------------------- | ------------------------------------------- | ------------------------- | -------------- |
| Première commande seulement                | Faible                                | ❌ Effondrement dès le 1er gros deal manqué | Faible                    | Non            |
| **Fenêtre de 12 mois, toutes prestations** | **Faible (bornée)**                   | ✅ **Alignée sur le cycle de vente réel**   | **Faible (test de date)** | ✅ **Retenue** |
| À vie                                      | ❌ **Élevé** (portefeuille permanent) | ✅                                          | Moyenne                   | Non            |

> **Règle retenue : toute commande signée par l'entreprise dans les 12 mois suivant l'enregistrement du contact est attribuée à l'apporteur. Après 12 mois, plus rien, sans exception.**

Le coût de calcul est nul : c'est une comparaison de dates. Et la règle tient en une phrase, ce qui est la vraie condition de survie à 300 apporteurs.

### 3.2 « Uniquement les formations » → non

**Pourquoi c'est à écarter :**

1. **Votre grille publique promet déjà le contraire.** `COMMERCIAL_COMMISSIONS` (`src/content/pricing.ts`) affiche des commissions sur les **audits à 30 %** et les **intégrations à 15 %**. La page `/devenir-commercial-ia` est en ligne, indexée, et porte une offre Google for Jobs. Les gens candidatent **sur cette base**.
2. **Changer maintenant, c'est modifier le contrat de gens déjà recrutés.** Le coût réputationnel est sans commune mesure avec l'économie réalisée.
3. **Vous couperiez les plus grosses affaires.** 15 % d'une intégration pèse largement plus qu'une commission forfaitaire de formation. C'est justement ce qui rend le réseau attractif face aux autres cartes que vos apporteurs pourraient prendre.

**La préoccupation légitime derrière la question** — « les audits et les intégrations sont plus complexes, l'apporteur y contribue moins » — **est déjà traitée par la grille elle-même** : les taux diffèrent par prestation, ce qui est exactement le bon endroit pour ajuster. Il n'y a rien à changer.

> **Règle retenue : toutes les prestations de la grille `COMMERCIAL_COMMISSIONS`, aux taux déjà publiés. Ce qui borne l'engagement, c'est la fenêtre de 12 mois — pas le type de produit.**

### 3.3 Le périmètre exact, activité par activité

_Question de Will, 2026-08-23 : « ça concerne quoi ? les formations, ou d'autres activités d'Axion-IA ? »_

Confrontation du catalogue réel (`PRICING_CATEGORIES`) à la grille de commissions (`COMMERCIAL_COMMISSIONS`), toutes deux dans `src/content/pricing.ts` :

| Famille du catalogue                       | Tiers                                                                          | Commission                 | Ligne de la grille                 |
| ------------------------------------------ | ------------------------------------------------------------------------------ | -------------------------- | ---------------------------------- |
| **Interventions — formations collectives** | `intervention-essentielle`, `intervention-approfondie`, `intervention-temps`   | ✅ **Forfait par journée** | `com-formation-1j` / `-2j` / `-3j` |
| **Interventions — 1-to-1**                 | `intervention-dirigeants`, `intervention-membre-equipe`                        | ✅ **Barème**              | `com-un-a-un`                      |
| **Audits**                                 | `audit-flash`, `audit-cible`, `audit-strategique-pme`, `audit-strategique-eti` | ✅ **30 % de la facture**  | `com-audit`                        |
| **Implémentation**                         | `impl-poc` (Pilote IA), `impl-grand-programme`, `impl-ia-custom`               | ✅ **15 % de la facture**  | `com-integration`                  |
| **Maintenance**                            | `maintenance-standard`                                                         | 🔴 **AUCUNE**              | —                                  |
| **Codage & développement web**             | `codage-web`                                                                   | 🔴 **AUCUNE**              | —                                  |

**Donc : 4 des 6 lignes d'activité sont commissionnées aujourd'hui.** L'apporteur ne vend pas que de la formation — il ouvre la porte sur tout, et c'est ce que promet déjà la page publique.

_Le « coup de projecteur » (podcast, interviews, page dédiée) est à 0 € : rien à commissionner par construction._

#### 🔴 Les deux trous à combler

**Maintenance.** C'est un revenu **récurrent**, ce qui change tout : commissionner à l'infini sur un abonnement crée une **rente**, c'est-à-dire un portefeuille permanent — précisément l'indice qui fait basculer vers l'agent commercial (§3.1).

> **Recommandation : commission sur les 12 premiers mois d'abonnement uniquement.** Bornée, cohérente avec la fenêtre R2, et sans risque de requalification.

**Codage & développement web.** Prestation de projet, de même nature qu'une implémentation.

> **Recommandation : l'aligner sur `com-integration` (15 %)**, ou un taux inférieur si cette activité est moins prioritaire commercialement. À trancher — mais **ne pas la laisser sans commission** : un apporteur qui amène un projet web et ne touche rien ne comprendra pas la règle, et cessera de remonter ce type d'affaire.

#### Trois ambiguïtés à lever dans le périmètre déjà couvert

| Cas                                       | Problème                                                                                                                                         | Piste                                                                                                                                                                               |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `intervention-conference`                 | Une conférence n'est pas une journée de formation. Aucune ligne ne la vise explicitement.                                                        | Forfait dédié, calé sur le prix réel du tier                                                                                                                                        |
| `intervention-sur-demande`                | Format sur mesure, sans tarif fixe → aucun forfait applicable                                                                                    | Passer en pourcentage, comme les audits                                                                                                                                             |
| `impl-grand-programme` / `impl-ia-custom` | `com-integration` est à 15 % avec `impl-poc` (le plus petit) pour base. Sur un grand programme, 15 % peut représenter une somme très importante. | **Ne pas plafonner brutalement** — un plafond démotive exactement sur les plus grosses affaires. Préférer un **palier dégressif** (ex. 15 % jusqu'à un seuil, taux réduit au-delà). |

#### ⚠️ Deux conséquences à ne pas manquer

1. **Toute modification de la grille est une modification d'une promesse publique.** `COMMERCIAL_COMMISSIONS` est la SSOT consommée par `/devenir-commercial-ia`, page en ligne et indexée avec une offre Google for Jobs. On complète les trous **avant** de recruter, pas après.

2. **Le cofinancement OPCO ne concerne que la famille formation.** Un audit, une intégration ou un projet web sont payés **intégralement par l'entreprise**. Le mécanisme du §2.9 de `docs/tableaux-de-bord-apporteurs.md` ne s'applique donc qu'aux interventions — ce qui simplifie le modèle mental de l'apporteur, et doit être dit clairement dans le kit de vente.

#### Décisions à acter

- [ ] **A12** — Maintenance : commission sur les **12 premiers mois** d'abonnement (ou exclusion explicite)
- [ ] **A13** — Codage web : taux à fixer (aligné sur les 15 % de l'intégration ?)
- [ ] **A14** — Conférences : forfait dédié
- [ ] **A15** — Interventions sur demande : passer en pourcentage
- [ ] **A16** — Gros programmes : palier dégressif au-delà d'un seuil, plutôt qu'un plafond sec

---

## 4. Les 10 modes de défaillance à l'échelle

C'est ici que se joue la tenabilité réelle. Aucun de ces points n'est théorique : tous se produiront avec des centaines d'apporteurs.

### P1 — 🔴 Le squattage de SIREN (le risque n°1, de très loin)

**Le scénario** : un apporteur malin récupère une liste de 5 000 entreprises de sa région et les dépose toutes en une nuit. Il « réserve » un département entier. Ensuite, chaque prospect entrant qui vous contacte spontanément se retrouve « déjà attribué » à lui. Il est payé sur du travail qu'il n'a pas fait, et les apporteurs honnêtes de sa région ne trouvent plus rien à déposer.

**Ce mode de défaillance détruit le système à lui seul.** Trois protections, toutes obligatoires dès le jour 1 :

- **Preuve de contact obligatoire.** Un SIREN seul n'est PAS un contact. On exige : le **nom + fonction de la personne rencontrée**, son **téléphone ou email direct**, et **une ligne libre sur ce qui a été dit**. C'est la mesure anti-squattage la plus efficace, parce qu'elle ne se fabrique pas en masse.
- **Quota dur.** Maximum **15 dépôts par apporteur et par semaine**. Un vrai apporteur n'en fait pas 40. Un squatteur, si.
- **Péremption automatique.** Une attribution sans aucune suite documentée sous **90 jours expire** et l'entreprise retourne au pot commun. Non négociable — sans ça, le stock d'entreprises « réservées mais mortes » gèle progressivement tout le territoire.

### P2 — La collision entre deux apporteurs

Deux apporteurs déposent le même SIREN à trois jours d'intervalle.

> **Règle : premier arrivé, horodatage serveur, point. Aucun arbitrage humain.**

À 300 apporteurs, arbitrer les litiges au cas par cas deviendrait votre activité principale. Le second reçoit un message automatique immédiat : « cette entreprise est déjà suivie » — **sans jamais révéler par qui** (RGPD, et évitement des conflits directs entre apporteurs).

La règle doit être **écrite dans le contrat** et **répétée dans l'email J0**. Une règle mécanique et publiée est acceptée ; une règle négociable engendre une négociation à chaque cas.

### P3 — 🔴 L'antériorité Axion-IA

Un apporteur « amène » une entreprise qui est **déjà cliente**, ou déjà en discussion depuis trois mois, ou déjà passée par un formulaire du site. C'est le cas qui coûte de l'argent réel et qui crée les vrais conflits.

**Protection : contrôle automatique et bloquant à la soumission**, contre `Client.siren`, contre les attributions existantes, et contre les demandes entrantes récentes. Le dépôt est refusé sur-le-champ avec le motif « entreprise déjà connue d'Axion-IA ». Ce contrôle doit exister **avant** le premier apporteur, pas après le premier litige.

### P4 — La saisie du SIRET à la main (problème d'ergonomie ET de données)

Un apporteur dans sa voiture, sur son téléphone, ne connaît pas le SIRET de l'entreprise qu'il vient de quitter, et va taper 14 chiffres avec un taux d'erreur élevé. Résultat : des attributions sur des numéros faux, donc irrécupérables au moment de facturer.

> **Solution : ne jamais lui demander de taper un numéro.**
> Il tape **le nom de l'entreprise + la ville**, choisit dans une liste déroulante, et le SIREN / SIRET / raison sociale / adresse / code NAF se remplissent seuls.

C'est **la recommandation technique la plus importante de cet audit** : elle améliore simultanément l'ergonomie, la qualité des données et la détection des doublons.

**Source de données** : l'API publique de recherche d'entreprises de l'État (annuaire des entreprises / data.gouv.fr) est gratuite. Le projet utilise déjà `geo.api.gouv.fr` pour les communes (cf. `memo-isere-zone.ts`) — le précédent existe.

- [ ] ⚠️ **À vérifier avant de coder** : nom exact du point d'entrée, quotas, conditions d'usage, et comportement si l'API est indisponible (prévoir un repli en saisie manuelle plutôt qu'un blocage du dépôt).

### P5 — La normalisation

Le SIREN doit être stocké **normalisé** : 9 caractères, chiffres uniquement, espaces et points retirés, index unique en base. Sans ça, `123456789` et `123 456 789` cohabitent et le contrôle de doublon ne détecte rien. C'est trivial à faire au départ, très pénible à rattraper après 10 000 lignes.

### P6 — 🔴 Le déclencheur du paiement : encaissement, pas signature

> **Une commission n'est due que lorsque la facture est ENCAISSÉE.**

Payer à la signature, c'est s'exposer à verser des commissions sur des factures jamais réglées. Avec 300 apporteurs, quelques impayés suffisent à créer une hémorragie de trésorerie sur laquelle vous n'avez aucun recours (vous ne récupérez pas une commission déjà versée à un indépendant).

Cette règle doit figurer **dans le contrat**, en toutes lettres.

### P7 — 🔴 La charge humaine (le vrai plafond, et il arrive vite)

Le calcul honnête :

| Apporteurs actifs | Dépôts/mois (à 3 chacun) | Après rejet auto (~45 %) | À qualifier par jour ouvré |
| ----------------- | ------------------------ | ------------------------ | -------------------------- |
| 50                | 150                      | ~80                      | **~4**                     |
| 150               | 450                      | ~250                     | **~12**                    |
| **300**           | **900**                  | **~500**                 | **~25**                    |

À 300 apporteurs, qualifier 25 contacts par jour, c'est **un poste à temps plein**. La base de données s'en moque — 900 lignes par mois, c'est du bruit. **C'est l'humain qui plafonne, pas la technique.**

Deux conséquences à assumer :

- Les rejets automatiques (déjà connu, quota dépassé, SIREN invalide, hors cible) doivent éliminer **le plus possible sans intervention**. Chaque point de pourcentage gagné là, c'est du temps humain économisé.
- **Prévoir le recrutement d'une personne dédiée autour de 100–150 apporteurs actifs.** Ne pas l'anticiper, c'est se retrouver avec un réseau qui dépose des contacts que personne ne traite — et rien ne démotive plus vite un apporteur qu'un contact déposé qui ne reçoit jamais de nouvelles.

### P8 — RGPD

L'apporteur nous transmet les données personnelles d'un tiers (nom, fonction, téléphone d'un dirigeant). Axion-IA en devient responsable de traitement.

- Case obligatoire au dépôt : « j'ai informé cette personne que je transmets ses coordonnées à Axion-IA ».
- Chiffrement des coordonnées au repos — `encryptPii` existe déjà et est utilisé par le tunnel de candidature.
- **Cloisonnement strict** : un apporteur ne doit jamais voir les entreprises déposées par un autre. Y compris dans les messages d'erreur (cf. P2).
- Mention d'information à fournir au prospect, et durée de conservation définie.
- ⚠️ Le projet dispose déjà d'un corpus RGPD conséquent (AIPD, mentions, registre) issu du chantier prospection — **le réutiliser plutôt que de repartir de zéro**.

### P9 — Les litiges

« C'est moi qui l'ai amené. » Cela arrivera **chaque semaine** à partir de ~100 apporteurs.

La seule défense qui tienne : **horodatage serveur + journal immuable + règle publiée à l'avance**. Ne jamais négocier au cas par cas — la première exception accordée devient la jurisprudence que tous les autres invoqueront. Le module `admin-activity-logs` existe déjà et fournit la traçabilité.

### P10 — La facturation des commissions (le point administratif sous-estimé)

Chaque apporteur doit **émettre une facture** pour être payé (cf. plan §3.3). À 45 ventes attribuées par mois, cela fait 45 factures d'indépendants à réclamer, vérifier, rapprocher et payer — tous les mois, avec des gens qui ne sont pas comptables et dont beaucoup enverront des documents non conformes.

> **Recommandation : l'autofacturation (mandat de facturation).** Axion-IA émet elle-même la facture au nom et pour le compte de l'apporteur, à partir des attributions et des encaissements qu'elle connaît déjà. L'apporteur n'a plus rien à produire.

C'est une pratique courante et admise dans les réseaux d'apporteurs, et **c'est ce qui rend le paiement scalable**. Elle suppose un mandat écrit dans le contrat et le respect des mentions obligatoires.

- [ ] ⚠️ **À valider par l'expert-comptable**, notamment au regard de la facturation électronique obligatoire de 2026 — le schéma `Invoice` porte déjà les champs de routage (`payerSiret`, `siren`).

---

## 5. Ce que le code permet déjà — et ce qui manque

### 5.1 ✅ Les bonnes nouvelles

| Brique                                         | État              | Où                                  |
| ---------------------------------------------- | ----------------- | ----------------------------------- |
| `Client.siren` (9) + `Client.siret` (14)       | **Déjà en base**  | `prisma/schema.prisma:5505-5507`    |
| `Client.source` (texte libre)                  | **Déjà en base**  | idem                                |
| Chaîne `Devis → clientId → Client`             | **Déjà en place** | `model Devis`                       |
| Chaîne facture → encaissement                  | **Déjà en place** | `Invoice`, `FactureFormation`       |
| Recherche client par nom / SIRET / SIREN       | **Déjà livrée**   | commit `377eb57ff`                  |
| Chiffrement PII, hash IP, rate-limit, honeypot | **Déjà en place** | `commercial-application/actions.ts` |
| Journal d'activité pour la preuve              | **Déjà en place** | `admin-activity-logs`               |
| Crons planifiés (péremption 90 j)              | **Déjà en place** | workers BullMQ                      |
| Corpus RGPD (AIPD, mentions)                   | **Déjà rédigé**   | `_PROSPECTION-BASE-ENTREPRISES/`    |

**La chaîne complète `Apporteur → SIREN → Client → Devis → Facture → encaissement` est donc constructible sur l'existant.** Il manque essentiellement **un maillon** : la table d'attribution, et sa résolution au moment de facturer.

### 5.2 ⚠️ Le point d'architecture à connaître

Le dépôt a contenu un **module Prospection complet** — base Sirene de toutes les entreprises françaises, ingestion du Stock, écrans d'administration, campagnes, couverture géographique. Il a été **délibérément retiré** (commit `58a89c383`, PR #278) au motif qu'il faisait **doublon avec Axion CRM Pro**.

Aujourd'hui, sur `main` :

- les **modèles Prisma et les migrations sont toujours là** (les tables existent, vides) ;
- le **code applicatif n'y est plus** ;
- la navigation admin pointe vers Axion CRM Pro (commit `376b90e2e`).

**Conséquence pour l'attribution** : il n'y a **pas de référentiel SIREN local** exploitable. Deux voies :

| Voie                                                                 | Coût   | Verdict                                                                         |
| -------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------- |
| Ressusciter le module Prospection                                    | Élevé  | ❌ **Non.** Ce serait revenir sur une décision d'architecture prise et assumée. |
| Interroger l'API publique de recherche d'entreprises à la volée (P4) | Faible | ✅ **Oui.** Gratuit, aucune base à maintenir, aucune donnée à tenir à jour.     |

⚠️ **Ne pas réintroduire de référentiel entreprises local sans un arbitrage explicite** : ce serait annuler PR #278.

### 5.3 Ce qu'il reste à construire

1. Un modèle `AttributionApporteur` : `siren` (unique), `apporteurId`, `siret`, `raisonSociale`, `adresse`, contact rencontré (chiffré), `deposeLe`, `expireLe`, `statut`.
2. La migration correspondante.
3. Le formulaire de dépôt, avec autocomplétion par l'API publique.
4. Les contrôles bloquants : doublon SIREN, antériorité `Client`, quota hebdomadaire, validité du SIREN.
5. Le cron de péremption à 90 jours.
6. L'écran de console (liste, recherche, rattachement manuel pour les groupes).
7. La résolution au moment de facturer : `Facture → Client.siren → attribution active → apporteur → commission`.
8. Le relevé de commissions par apporteur (et, si validé, l'autofacturation).

---

## 6. Verdict de tenabilité

| Dimension                     | Verdict                        | Commentaire                                                                                                 |
| ----------------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| **Volume de données**         | ✅ **Aucun problème**          | ~11 000 lignes/an à 300 apporteurs. Insignifiant pour PostgreSQL.                                           |
| **Couverture France entière** | ✅ **Aucun problème**          | Le SIREN est national par nature. Aucune logique de territoire n'est nécessaire.                            |
| **Règle d'attribution**       | ✅ **Tenable**                 | À condition qu'elle soit **mécanique et publiée** : SIREN, premier arrivé, 12 mois, 90 jours de péremption. |
| **Qualité des données**       | ✅ **Tenable**                 | **Uniquement** avec l'autocomplétion (P4). En saisie libre, le système se dégrade en quelques mois.         |
| **Résistance à l'abus**       | ⚠️ **Tenable sous conditions** | Quota + preuve de contact + péremption. Les trois, ou rien.                                                 |
| **Charge humaine**            | 🔴 **C'est le vrai plafond**   | ~25 contacts/jour à qualifier à 300 apporteurs. Prévoir une personne dédiée dès 100–150 actifs.             |
| **Charge administrative**     | ⚠️ **À traiter tôt**           | 45 factures d'indépendants par mois. L'autofacturation est la seule sortie propre.                          |
| **Risque juridique**          | ✅ **Maîtrisé**                | La fenêtre de 12 mois **renforce** la qualification d'apporteur d'affaires plutôt que de l'affaiblir.       |

> **Conclusion : le système est tenable, et il est même bien plus proche que prévu — la moitié des briques existent déjà. Ce qui le ferait échouer n'est pas la technique, c'est (1) le squattage si les trois garde-fous ne sont pas posés dès le départ, et (2) l'absence d'une personne pour traiter les contacts quand le volume arrive.**

---

## 7. Révision de la charge de développement

Le §5 du plan estimait le chantier C4 (« dépôt de contact ») à **1 jour**. Cette estimation portait sur un formulaire simple à 3 champs, **sans registre d'attribution**. La proposition d'attribuer par numéro d'entreprise est meilleure — et plus lourde. Estimation corrigée :

| Sous-chantier                                                | Charge       |
| ------------------------------------------------------------ | ------------ |
| Modèle `AttributionApporteur` + migration                    | 0,5 j        |
| Autocomplétion via l'API publique (+ repli manuel)           | 1 j          |
| Formulaire de dépôt + Server Action (calquée sur l'existant) | 1 j          |
| Contrôles bloquants (doublon, antériorité, quota)            | 1 j          |
| Cron de péremption 90 jours                                  | 0,5 j        |
| Écran console + rattachement manuel groupes                  | 1 j          |
| Résolution facture → attribution → commission                | 1 j          |
| **Total C4 révisé**                                          | **~6 jours** |

L'autofacturation (P10) et le relevé de commissions sont **hors périmètre C4** — à traiter quand les premières commissions tomberont, pas avant.

**Impact sur le plan** : C4 passe de 1 à ~6 jours. Le total « réseau opérationnel » (C1→C5) passe de ~5 à **~10 jours**. Cela reste très raisonnable pour ce que ça verrouille, et l'ordre d'exécution du plan §6 ne change pas — C1 (scoring, 0,5 j) reste le bon point de départ, et ne dépend d'aucune de ces décisions.

---

## 8. Décisions à acter

- [ ] **A1** — Clé d'attribution = **SIREN** (le SIRET est stocké comme contexte)
- [ ] **A2** — Portée = **toutes les commandes signées dans les 12 mois** suivant l'enregistrement (pas « première commande »)
- [ ] **A3** — Périmètre = **toutes les prestations** de `COMMERCIAL_COMMISSIONS` (pas « formations uniquement »)
- [ ] **A4** — Collision = **premier arrivé, horodatage serveur, zéro arbitrage**
- [ ] **A5** — Péremption = **90 jours** sans suite documentée
- [ ] **A6** — Quota = **15 dépôts / apporteur / semaine**
- [ ] **A7** — Dépôt valide **uniquement** avec nom + fonction + contact direct de la personne rencontrée
- [ ] **A8** — Commission due **à l'encaissement**, jamais à la signature
- [ ] **A9** — Autocomplétion par **API publique**, pas de référentiel local (ne pas annuler PR #278)
- [ ] **A10** — Groupes de sociétés = **rattachement manuel**, pas d'automatisation
- [ ] **A11** — Autofacturation : à valider avec l'expert-comptable (hors périmètre immédiat)
