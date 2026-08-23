# Fonctionnement du réseau d'apporteurs — de bout en bout

> **Créé le** 2026-08-23 · **Aucun code écrit** — ce document décrit le fonctionnement, pas l'implémentation.
> **À lire avant** `docs/plan-recrutement-apporteurs-daffaires.md` (le quoi et le quand) et `docs/audit-attribution-apporteurs-siren.md` (le pourquoi technique).
>
> Ce document répond à une seule question : **« concrètement, ça marche comment ? »**

---

## 1. Le système en une page

Trois objets, et rien d'autre.

```
   ┌──────────────┐        parraine        ┌──────────────┐
   │   APPORTEUR  │ ─────────────────────► │   APPORTEUR  │
   │     Paul     │   (code PAUL-4K2)      │    Sophie    │
   └──────────────┘                        └──────┬───────┘
                                                  │
                                                  │ dépose une entreprise
                                                  ▼
                                          ┌───────────────┐
                                          │  ATTRIBUTION  │
                                          │  SIREN 123…   │  ◄── clé unique
                                          │  Sophie · 12 mois
                                          └───────┬───────┘
                                                  │
                                                  │ Axion-IA vend et facture
                                                  ▼
                                          ┌───────────────┐
                                          │    CLIENT     │
                                          │ Entreprise    │
                                          │   Durand      │
                                          └───────┬───────┘
                                                  │
                                                  │ facture ENCAISSÉE
                                                  ▼
                                          ┌───────────────┐
                                          │  COMMISSION   │
                                          │  → Sophie     │
                                          │  → Paul (10%) │
                                          └───────────────┘
```

**Les trois règles qui résument tout :**

1. **Sophie présente. Axion-IA vend et signe. Sophie est payée.** L'apporteur n'a aucun mandat.
2. **Une entreprise appartient à un seul apporteur, identifiée par son SIREN, pendant 12 mois.**
3. **Rien n'est payé tant que la facture n'est pas encaissée.**

---

## 2. Les acteurs

| Acteur                   | Ce qu'il fait                                                          | Ce qu'il ne fait JAMAIS                               |
| ------------------------ | ---------------------------------------------------------------------- | ----------------------------------------------------- |
| **L'apporteur** (Sophie) | Rencontre des dirigeants, dépose l'entreprise, encaisse une commission | Négocier un prix, signer, s'engager au nom d'Axion-IA |
| **Le parrain** (Paul)    | Recrute d'autres apporteurs avec son code                              | Être payé sur l'inscription de son filleul            |
| **Axion-IA** (vous)      | Qualifie, prend le rendez-vous, vend, facture, encaisse, paie          | Arbitrer les litiges d'attribution au cas par cas     |
| **La machine**           | Attribue, contrôle, relance, périme, calcule                           | Rejeter définitivement une candidature                |

---

## 3. Parcours 1 — Sophie devient apporteuse

### 3.1 Elle candidate

Sophie arrive sur `/devenir-commercial-ia` (ou `/memo-isere`, ou `/partenaire/[journal]`). Elle remplit le tunnel existant — **sans CV** : identité, expériences B2B, outils IA, zone couverte, disponibilité, pitch.

Si elle est arrivée par un lien de parrainage (`?p=PAUL-4K2`), **le code a été posé en cookie dès son premier clic** et s'enregistre tout seul avec sa candidature. Elle n'a rien à faire, rien à saisir.

### 3.2 La machine calcule son score — instantanément

Au moment où elle valide, une note sur 100 est calculée **à partir des réponses qu'elle vient de donner**. Aucun appel, aucune IA, aucun délai.

| Ce qu'on regarde                | Ce qui rapporte                                         | Points |
| ------------------------------- | ------------------------------------------------------- | ------ |
| Années de vente aux entreprises | +10 ans → 30 · 5-10 → 25 · 3-5 → 18 · 1-3 → 10 · <1 → 3 | /30    |
| Type de clients                 | Vend déjà aux entreprises (≠ particuliers)              | /15    |
| Statut                          | Déjà indépendant → peut facturer demain matin           | /15    |
| Déplacement                     | Oui > Ponctuellement > Non                              | /10    |
| Outils IA                       | En utilise déjà au moins un                             | /10    |
| Outils informatiques            | CRM ou LinkedIn → sait prospecter                       | /10    |
| Zone                            | Cohérente et pas déjà saturée                           | /10    |

### 3.3 Ce qui se passe selon la note

| Note        | Ce que fait la machine                             | Ce que vous faites                                |
| ----------- | -------------------------------------------------- | ------------------------------------------------- |
| **≥ 70**    | Alerte Telegram immédiate, marquée « prioritaire » | **Vous appelez sous 24 h**                        |
| **40 – 69** | Invitation automatique au webinaire du mercredi    | **Rien.** Vous ne les rappelez que s'ils viennent |
| **< 40**    | Mise en vivier, séquence email uniquement          | **Rien**                                          |

> ⚠️ **Le score oriente, il ne rejette jamais.** Aucune candidature n'est supprimée. Un retraité noté 35 peut avoir 40 ans de carnet d'adresses que le barème ne sait pas voir — il reste joignable, il passe simplement par le webinaire.

### 3.4 Le webinaire remplace l'entretien

Un créneau fixe, chaque semaine. Même durée que vous soyez 3 ou 60 dans la salle. C'est **ce qui rend le réseau scalable** : sans lui, il faudrait 200 entretiens individuels.

À la fin : le contrat part en signature électronique (DocuSeal est déjà en place).

### 3.5 Elle signe → l'onboarding démarre tout seul

| Quand        | Ce qu'elle reçoit                                                              | But                                 |
| ------------ | ------------------------------------------------------------------------------ | ----------------------------------- |
| **Immédiat** | Kit de vente, grille de commissions, **son code apporteur**, lien du webinaire | Qu'elle ait tout, tout de suite     |
| **48 h**     | « Une question avant de démarrer ? » + 3 objections traitées                   | La rattraper avant qu'elle décroche |
| **7 jours**  | « Déposez votre premier contact » — un seul bouton                             | **Provoquer le premier acte**       |

Le J7 est le plus important. Un apporteur qui a déposé une fois déposera encore. Un apporteur qui n'a jamais déposé ne déposera jamais.

**Zéro intervention humaine sur ces trois emails.**

---

## 4. Parcours 2 — Sophie dépose une entreprise

### 4.1 La scène réelle

Sophie sort d'un rendez-vous chez Durand, à Grenoble. Elle est dans sa voiture, sur son téléphone. Elle a **90 secondes d'attention**, pas plus.

### 4.2 Ce qu'elle voit

```
┌──────────────────────────────────────────┐
│  Déposer un contact                      │
│                                          │
│  Votre code       [ SOPHIE-7B3 ]         │
│                                          │
│  Entreprise                              │
│  [ durand grenoble        🔍 ]           │
│   ┌────────────────────────────────┐     │
│   │ DURAND SAS                     │     │
│   │ 12 rue Ampère, 38000 Grenoble  │     │
│   │ SIREN 123 456 789              │     │
│   └────────────────────────────────┘     │
│                                          │
│  Qui avez-vous rencontré ?               │
│  Nom + fonction  [ ______________ ]      │
│  Tél ou email    [ ______________ ]      │
│  Ce qui a été dit [ _____________ ]      │
│                                          │
│  ☐ J'ai informé cette personne que je    │
│    transmets ses coordonnées             │
│                                          │
│            [  Envoyer  ]                 │
└──────────────────────────────────────────┘
```

**Elle ne tape jamais un numéro.** Elle écrit « durand grenoble », choisit dans la liste, et le SIREN, le SIRET, la raison sociale et l'adresse se remplissent seuls. C'est ce qui rend le dépôt faisable en 90 secondes — et ce qui garantit des données justes.

**Pourquoi on exige la personne rencontrée** : un SIREN seul n'est pas un contact, c'est une ligne dans un annuaire. Exiger un nom, une fonction et un moyen de la joindre est ce qui empêche un apporteur de déposer 5 000 entreprises en une nuit pour réserver un département (voir §7.4).

### 4.3 Les quatre contrôles, en une seconde

Avant d'accepter quoi que ce soit, la machine vérifie, dans cet ordre :

| #   | Contrôle                                                              | Si ça bloque, elle voit               |
| --- | --------------------------------------------------------------------- | ------------------------------------- |
| 1   | Le SIREN existe et l'entreprise est active                            | « Entreprise introuvable ou fermée »  |
| 2   | **Personne d'autre ne l'a déjà déposée**                              | « Cette entreprise est déjà suivie »  |
| 3   | **Axion-IA ne la connaît pas déjà** (client, devis, demande entrante) | « Entreprise déjà connue d'Axion-IA » |
| 4   | Sophie n'a pas dépassé **15 dépôts cette semaine**                    | « Quota hebdomadaire atteint »        |

Le message du contrôle 2 **ne dit jamais par qui** — ni le nom, ni la date, ni la région. RGPD, et surtout : pas de conflit direct entre apporteurs.

### 4.4 Si tout passe

- L'entreprise est **enregistrée au nom de Sophie**, horodatée à la seconde par le serveur.
- Elle reçoit un email : _« Durand SAS est enregistrée à votre nom jusqu'au 23 août 2027. »_
- Une alerte Telegram vous prévient.
- La fiche arrive dans votre console, en attente de qualification.

À partir de cet instant, **Sophie n'a plus rien à faire**. C'est vous qui prenez la main.

---

## 5. Parcours 3 — Axion-IA vend, Sophie est payée

### 5.1 Vous prenez le relais

Vous appelez Durand. Vous qualifiez, vous proposez, vous envoyez un devis, vous signez, vous facturez. **Sophie n'intervient à aucun moment** — c'est exactement le principe de l'apporteur d'affaires, et c'est ce qui vous protège juridiquement.

### 5.2 La résolution de la commission

Quand une facture est **encaissée**, la machine remonte la chaîne :

```
Facture encaissée
   → Client
   → son SIREN
   → une attribution active existe-t-elle sur ce SIREN ?
       → OUI, et la commande a été signée dans les 12 mois → commission à Sophie
       → OUI, mais signée après 12 mois              → aucune commission
       → NON                                          → aucune commission
   → Sophie a-t-elle un parrain, signé il y a moins de 12 mois ?
       → OUI → 10 % de la commission de Sophie à Paul, EN PLUS (sur votre marge)
```

### 5.3 Le point non négociable

> **La commission naît à l'ENCAISSEMENT, jamais à la signature.**

Payer à la signature, c'est verser des commissions sur des factures jamais réglées — sans aucun moyen de récupérer l'argent chez un indépendant. Avec 300 apporteurs, quelques impayés suffisent à créer une hémorragie.

### 5.4 Ce que couvre l'attribution

- **Toutes les prestations** de la grille (formations, audits 30 %, intégrations 15 %, 1-to-1). Pas seulement les formations.
- **Toutes les commandes signées dans les 12 mois** suivant le dépôt. Pas seulement la première.

_Pourquoi pas « la première commande » : Sophie amène Durand, qui achète un audit à 490 € (commission ~147 €), puis trois semaines plus tard une intégration à 28 000 € (~4 200 €). Avec la règle « première commande », elle toucherait 147 € et partirait. Et elle raconterait pourquoi._

_Pourquoi pas « à vie » : une attribution perpétuelle ferait de Sophie la titulaire d'un portefeuille permanent — l'un des indices caractéristiques de l'agent commercial, donc un risque d'indemnité de fin de contrat. **Borner protège.**_

---

## 6. Parcours 4 — Paul parraine Sophie

C'est une couche **totalement séparée** de l'attribution des entreprises. Ne jamais confondre les deux.

|              | Ce que Paul déclenche                                 | Ce que Sophie déclenche    |
| ------------ | ----------------------------------------------------- | -------------------------- |
| Il amène     | **Sophie**, une personne                              | **Durand**, une entreprise |
| Clé          | Son code `PAUL-4K2`                                   | Le SIREN de Durand         |
| Il est payé  | 10 % de la commission de Sophie, 12 mois              | —                          |
| Payé par qui | **Axion-IA, sur sa marge.** Jamais prélevé sur Sophie | —                          |

**Un apporteur a un seul code, utilisé dans deux contextes** : dans une URL de candidature (`?p=PAUL-4K2`) c'est du parrainage ; dans un dépôt d'entreprise c'est de l'attribution.

### 🔴 La règle qui protège du pénal

> **On ne rémunère jamais l'acte de recruter. Uniquement les ventes réelles du filleul.**

Payer une prime à l'inscription = **système pyramidal** (art. L.121-15 C. conso) : nullité et sanctions pénales. Et **un seul niveau de profondeur** — le filleul de Sophie ne rapporte rien à Paul. C'est précisément ce qui rend le programme visiblement distinct d'une pyramide.

---

## 7. Les cas qui fâchent — et ce que fait la machine

### 7.1 Deux apporteurs déposent la même entreprise

> **Premier arrivé, horodatage serveur, zéro arbitrage humain.**

Le second reçoit immédiatement « cette entreprise est déjà suivie », sans savoir par qui. La règle est **écrite dans le contrat** et **répétée dans l'email J0**.

_Pourquoi zéro arbitrage : à 300 apporteurs, ces litiges arriveront chaque semaine. La première exception accordée devient la jurisprudence que tous invoqueront. Une règle mécanique et publiée est acceptée ; une règle négociable engendre une négociation à chaque cas._

### 7.2 L'entreprise était déjà cliente

Bloqué automatiquement à la soumission. C'est le cas qui coûte de l'argent réel — il faut qu'il soit impossible **avant** le premier apporteur, pas traité après le premier litige.

### 7.3 L'entreprise déménage

Aucun effet. **C'est toute la raison d'utiliser le SIREN et pas le SIRET.** Quand une entreprise change d'adresse, l'INSEE lui donne un nouveau SIRET mais son SIREN ne bouge jamais. L'attribution de Sophie survit.

### 7.4 Un apporteur essaie de réserver un département

Trois garde-fous, **les trois ou rien** :

| Garde-fou                         | Effet                                                                                              |
| --------------------------------- | -------------------------------------------------------------------------------------------------- |
| **Preuve de contact obligatoire** | Un nom, une fonction, un téléphone direct, une phrase de contexte. Ça ne se fabrique pas en masse. |
| **Quota 15 dépôts / semaine**     | Un vrai apporteur n'en fait pas 40. Un squatteur, si.                                              |
| **Péremption à 90 jours**         | Une fiche sans suite retourne au pot commun.                                                       |

Sans la péremption, le stock d'entreprises « réservées mais mortes » gèle progressivement tout le territoire.

### 7.5 La fiche dort depuis 90 jours

| Jour | Ce qui se passe                                                                                                  |
| ---- | ---------------------------------------------------------------------------------------------------------------- |
| J+75 | Email à Sophie : _« Durand SAS expire dans 15 jours »_                                                           |
| J+90 | Si aucune suite documentée : l'attribution **périme**, l'entreprise retourne au pot commun. Sophie est prévenue. |

Une « suite documentée » = un événement daté sur la fiche : appel de qualification, rendez-vous pris, devis envoyé.

### 7.6 Le groupe de sociétés

Une holding avec 5 filiales = 5 SIREN. Si Sophie amène la filiale et que le groupe achète via la holding, l'attribution automatique échoue.

> **Traitement : à la main, dans la console, avec justification et trace.**

Moins de 2 % du volume. Automatiser coûterait plusieurs jours et produirait des règles impossibles à expliquer aux apporteurs.

---

## 8. Côté Will : votre journée type

### 8.1 Ce que vous voyez

| Écran                | Ce qu'il montre                                                           |
| -------------------- | ------------------------------------------------------------------------- |
| **Candidatures**     | Les nouvelles, triées par score, pastille couleur. Vous appelez les ≥ 70. |
| **Contacts déposés** | Les entreprises en attente de qualification, avec l'apporteur et la date. |
| **Attributions**     | Toutes les entreprises attribuées, leur échéance, leur état.              |
| **Commissions**      | Ce qui est dû, à qui, sur quelles factures encaissées.                    |

### 8.2 Ce qui vous alerte sur Telegram

- Une candidature à **score ≥ 70** → à appeler sous 24 h
- Un **contact déposé** → à qualifier
- Une facture **encaissée** avec attribution → une commission est due

### 8.3 Ce que vous faites vraiment, chaque jour

1. Rappeler les candidatures prioritaires.
2. Qualifier les contacts déposés (appeler l'entreprise).
3. Vendre.

**Tout le reste tourne sans vous** : le scoring, les trois emails d'onboarding, les contrôles de dépôt, les relances de péremption, le calcul des commissions.

### 8.4 🔴 Le vrai plafond du système : vous

| Apporteurs actifs | Contacts à qualifier / jour ouvré |
| ----------------- | --------------------------------- |
| 50                | ~4                                |
| 150               | ~12                               |
| **300**           | **~25**                           |

À 300 apporteurs, qualifier 25 contacts par jour est **un poste à temps plein**. La base de données s'en moque (900 lignes/mois, c'est du bruit).

> **Prévoir une personne dédiée dès 100–150 apporteurs actifs.** Rien ne démotive plus vite un apporteur qu'un contact déposé qui ne reçoit jamais de nouvelles.

---

## 9. Le cycle de vie d'une attribution

```
   Sophie dépose
        │
        ▼
   ┌─────────┐  contrôle échoué   ┌──────────┐
   │ DÉPOSÉE │ ─────────────────► │ REJETÉE  │  (doublon / déjà client /
   └────┬────┘                    └──────────┘   quota / SIREN invalide)
        │ contrôles OK
        ▼
   ┌─────────┐   90 j sans suite   ┌──────────┐
   │ ACTIVE  │ ──────────────────► │ PÉRIMÉE  │ → retour au pot commun
   └────┬────┘                     └──────────┘
        │
        ├── vente signée dans les 12 mois ──► ┌────────────┐
        │                                     │ CONVERTIE  │
        │                                     └─────┬──────┘
        │                                           │ facture encaissée
        │                                           ▼
        │                                     ┌────────────┐
        │                                     │ COMMISSION │
        │                                     │   PAYABLE  │
        │                                     └────────────┘
        │
        └── 12 mois écoulés sans vente ─────► ┌──────────┐
                                              │ EXPIRÉE  │
                                              └──────────┘
```

---

## 10. Automatique vs humain — la carte de la scalabilité

| Étape                                | Qui                                               |
| ------------------------------------ | ------------------------------------------------- |
| Calcul du score                      | 🤖 Machine                                        |
| Tri et priorisation des candidatures | 🤖 Machine                                        |
| **Appel des candidats prioritaires** | 👤 **Vous**                                       |
| Webinaire hebdomadaire               | 👤 Vous (1 h/semaine, quel que soit le nombre)    |
| Envoi du contrat                     | 🤖 Machine                                        |
| Les 3 emails d'onboarding            | 🤖 Machine                                        |
| Autocomplétion entreprise            | 🤖 Machine                                        |
| Les 4 contrôles de dépôt             | 🤖 Machine                                        |
| **Qualification du contact déposé**  | 👤 **Vous** ← _le goulot_                         |
| **Vente, devis, signature**          | 👤 **Vous**                                       |
| Relance J-15 et péremption J+90      | 🤖 Machine                                        |
| Résolution facture → commission      | 🤖 Machine                                        |
| Calcul du parrainage                 | 🤖 Machine                                        |
| Paiement de la commission            | 👤 Vous                                           |
| Litiges d'attribution                | 🤖 Machine (règle mécanique, **pas d'arbitrage**) |

**Trois lignes humaines seulement** — et elles sont toutes du commerce, pas de l'administratif. C'est la définition de la scalabilité ici.

---

## 11. La carte de référence — toutes les règles

| #   | Règle                                                                                                                                                    |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Clé d'attribution = **SIREN** (9 chiffres). Le SIRET est stocké comme contexte.                                                                          |
| R2  | Attribution valable **12 mois**, toutes prestations de la grille.                                                                                        |
| R3  | Collision = **premier arrivé, horodatage serveur, aucun arbitrage**.                                                                                     |
| R4  | **Péremption à 90 jours** sans suite documentée. Alerte à J-75.                                                                                          |
| R5  | **Quota 15 dépôts / apporteur / semaine.**                                                                                                               |
| R6  | Dépôt valide **uniquement** avec nom + fonction + contact direct de la personne rencontrée.                                                              |
| R7  | Commission due **à l'encaissement**, jamais à la signature.                                                                                              |
| R8  | Parrainage : **10 %, 12 mois, 1 seul niveau, sur les ventes réelles uniquement.** Jamais sur l'inscription.                                              |
| R9  | L'apporteur **ne négocie pas, ne signe pas, n'a aucun mandat**.                                                                                          |
| R10 | **SIRET obligatoire** pour l'apporteur avant tout versement.                                                                                             |
| R11 | Groupes de sociétés = **rattachement manuel**.                                                                                                           |
| R12 | Le score **oriente**, il ne rejette jamais.                                                                                                              |
| R13 | Résolution de commission par l'**entreprise bénéficiaire**, jamais par le destinataire de la facture (une facture en subrogation est adressée à l'OPCO). |
| R14 | **Financeurs sur liste noire de dépôt** : OPCO, France Travail, régions, OF partenaires ne sont jamais des entreprises attribuables.                     |
| R15 | En cofinancement, la commission porte sur le **total HT de la prestation**, pas sur le reste à charge.                                                   |

---

## 12. Ce qui n'est PAS dans la première version

Volontairement laissé de côté — à ne construire que quand le besoin existera vraiment :

> ⚠️ **Mis à jour le 2026-08-23 — décision de Will** : l'**espace apporteur connecté** entre finalement **en V1**, avec le pilotage complet côté console. Spécification : **`docs/tableaux-de-bord-apporteurs.md`**.

| Reporté                                                         | Déclencheur                                                   |
| --------------------------------------------------------------- | ------------------------------------------------------------- |
| **Autofacturation** (Axion-IA émet la facture pour l'apporteur) | Aux premières commissions — à valider avec l'expert-comptable |
| **Gestion automatique des groupes**                             | Probablement jamais                                           |
| **Personne dédiée à la qualification**                          | 100–150 apporteurs actifs                                     |

Un principe de conception survit à ce changement de périmètre, et il est essentiel : **le dépôt de contact reste accessible SANS connexion**, par lien direct porteur du code apporteur. L'espace sert à _consulter_, jamais à _saisir_ — parce qu'un dépôt se fait dans une voiture, en 90 secondes, et qu'un login à ce moment-là ferait chuter le seul geste qui crée de la valeur.

---

## 13. Les décisions encore ouvertes

| #                | Décision                                                                                          | Impact                               |
| ---------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------ |
| **§3.4 du plan** | **Le sujet financement / Qualiopi** — certifier d'abord, retirer l'argument du kit, ou reformuler | 🔴 **Bloquant** pour le kit de vente |
| A1 → A11         | Les règles d'attribution de l'audit                                                               | Recommandations données, à confirmer |
| Version A ou B   | Dépôt public à code, ou espace connecté d'emblée                                                  | A recommandé                         |

**Aucune de ces décisions ne bloque C1 (le scoring)**, qui reste le bon point de départ.
