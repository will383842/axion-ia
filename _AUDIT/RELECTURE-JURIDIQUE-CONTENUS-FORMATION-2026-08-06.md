# Relecture juridique — contenus pédagogiques des formations

**Date d'ouverture** : 2026-08-06
**Destinataire** : conseil d'Axion-IA
**Statut** : ⏳ en attente de relecture — aucune de ces formulations n'est bloquante pour la production, toutes sont diffusées en salle

---

## Comment lire ce document

Le contenu pédagogique rédigé des formations (`src/content/formations/modules/`) applique
une règle stricte : **le formateur n'arbitre aucune question juridique**. La formule est
écrite dans les notes d'animation et se prononce telle quelle :

> « Je ne me prononce pas, notez la question, votre conseil tranchera. »

Cette règle protège l'organisme, mais elle ne couvre pas tout. Trois catégories de
formulations subsistent et demandent un avis :

1. **Ce que le CATALOGUE affirme** — le programme opposable, remis au client et à l'OPCO.
   C'est la catégorie la plus exposée : ces phrases sont vendues, pas seulement dites.
2. **Ce que le contenu rédigé pose comme règle de prudence** — présenté comme une position
   d'organisme, pas comme une règle de droit, mais qui sera entendu comme telle en salle.
3. **Les qualifications juridiques implicites** — « ceci est une donnée personnelle »,
   « ceci relève du haut risque », qui décident du comportement enseigné.

⚠️ **Priorité absolue : la catégorie 1.** Une affirmation fausse dans le contenu rédigé se
corrige avant la prochaine session. Une affirmation fausse dans le catalogue est déjà
partie chez des clients.

---

## Catégorie 1 — Affirmations du CATALOGUE (priorité haute)

### 1.1 Obligation d'informer qu'on échange avec une IA

**Où** : séquences `cadre` de plusieurs fiches (relation client, commerciaux, marketing).
**Ce que le catalogue affirme** : que le règlement européen sur l'IA impose d'informer un
interlocuteur qu'il échange avec une IA, ou qu'un contenu lui a été adressé après
production assistée.

**Pourquoi c'est signalé** : trois rédacteurs ont refusé, indépendamment, de reprendre
cette affirmation à leur compte, et ont renvoyé au conseil. Le cas d'un agent
conversationnel autonome et celui d'un conseiller qui rédige avec l'aide d'un outil ne
sont pas nécessairement le même régime.

**Ce qui est en jeu** : la formulation est dans le programme opposable de plusieurs
formations vendues.

### 1.2 Article 4 du règlement (UE) 2024/1689 — littératie IA

**Où** : séquence `cadre` de `ia-pour-le-juridique`, reprise dans un prompt de démonstration.
**Affirmation** : applicabilité depuis février 2025.
**Demande** : confirmer la référence, la date, et la portée pour un organisme de formation.

### 1.3 Usages classés à haut risque

**Où** : séquences `cadre` de plusieurs fiches — recrutement (RH), solvabilité d'une
personne physique (finance), gestion de la main-d'œuvre et composants de sécurité (BTP),
tri de candidatures (RH).
**Demande** : valider chaque qualification, et surtout la **frontière** enseignée — par
exemple, en RH : « la présynthèse sous grille imposée, sans classement ni score, reste en
dehors de ce régime ». C'est cette frontière qui décide de ce que les stagiaires feront
lundi.

### 1.4 Références du droit du travail citées en RH

**Où** : séquence `cadre` de `ia-pour-les-rh`.
**Affirmations** : information préalable du candidat sur les méthodes d'aide au
recrutement (L.1221-8), information préalable du CSE (L.2312-38), lien direct et
nécessaire avec l'emploi (L.1221-6), critères de discrimination interdits (L.1132-1).
**Demande** : confirmer les références et leur formulation. Le kit formateur doit les
porter **sourcées et datées** — le contenu rédigé interdit explicitement de les citer de
mémoire.

### 1.5 Fausse déclaration en marché public

**Où** : `ia-pour-le-btp`, module 3.
**Affirmation** : « en marché public, une référence inventée est une fausse déclaration ».
**Demande** : confirmer la qualification.

---

## Catégorie 2 — Règles de prudence posées par le contenu rédigé

Ces formulations sont présentées comme des **positions d'organisme**, volontairement
rigides pour tenir en salle sans arbitrage. Elles ne prétendent pas énoncer le droit, mais
seront entendues comme telles.

| Formation | Formulation | Nature |
|---|---|---|
| Relation client, commerce | « Un avis ou un témoignage qui n'a pas été écrit par un client est une pratique commerciale trompeuse » | Interdiction posée en absolu. L'interdiction ne bouge pas ; la **qualification** est à confirmer. |
| Relation client, commerce, hôtellerie | Ne jamais confirmer publiquement qu'une personne est cliente, ne rien révéler de son dossier | Ligne non retirable. À valider comme doctrine. |
| Achats | « Un devis reste couvert par sa clause de confidentialité même sans le nom du fournisseur » | Reprise du catalogue. |
| Achats | « Pseudonymiser n'est pas anonymiser : le devis d'un indépendant reste rattachable à la personne » | Qualification RGPD. |
| Juridique | « Un NDA condamne un document, pas l'outil » — et « la clause vise le tiers, pas le nom » | Formulations à portée juridique, au cœur d'un corrigé. |
| Finance | Liste rouge présentée comme interdiction absolue, sans qualification de régime d'usage | Position d'organisme assumée, volontairement plus stricte que le droit. |
| Finance, achats | Mentions dues des trames de relance (pénalités de retard, indemnité forfaitaire de recouvrement) portées par la **trame du kit**, jamais par l'outil | ⚠️ **La trame du kit elle-même doit être validée** : le contenu la traite comme source de vérité. |
| Commerce | « Regretter l'expérience vécue sans admettre un fait précis en public » | Frontière fine sur la réponse publique à un avis. |
| Commerciaux | « Ce qui est contractuel se recopie mot pour mot depuis le document d'origine » | Règle de prudence, pas règle de droit. Formulée comme telle. |

---

## Catégorie 3 — Lectures strictes à valider

Ces décisions **resserrent** ce que le catalogue promet. Elles sont défendables, mais elles
créent un écart entre la promesse commerciale et ce qui se passe en salle.

### 3.1 Santé — interdiction absolue sans régime dérogatoire

Le catalogue vend le vocabulaire « compte-rendu médical » et son équation de temps promet
« un compte-rendu mis en forme à partir de notes dictées ». Le contenu rédigé interdit
toute donnée de patient dans un outil, **sans exception présentée en salle**, et fait
travailler sur du matériel fictif du kit. Le troisième régime du catalogue (environnement
hébergé certifié) existe en séquence `cadre` mais n'est **pas** présenté comme une porte
ouverte dans les blocs rédigés.

**À valider** : cette lecture stricte, et l'écart qu'elle crée avec le vocabulaire de vente.

### 3.2 Commerciaux, finance — « vos propres affaires » resserré

Le catalogue vend « chacun travaille sur ses propres affaires en cours » (commerciaux) et
« chacun dépose un document financier long » (finance). Le contenu resserre : documents
**publics** du prospect, interlocuteur désigné par sa **fonction**, montants remplacés par
« montant A » ; et, en finance, on **qualifie** son propre document à la main sans rien
déposer, on **dépose** le document équivalent du kit.

**À valider** : le resserrement, ou la reformulation de la promesse au catalogue.

### 3.3 BTP — ligne de partage sur les pièces de consultation

Autorisé : pièce de consultation **publiée**, sans aucun prix. Jamais : DPGF, conditions,
prix.

**À valider** : cette ligne de partage.

### 3.4 Immobilier, hôtellerie — interdits métier structurants

- Une annonce immobilière ne porte aucun critère discriminatoire, et l'IA peut en
  réintroduire par le vocabulaire.
- L'IA ne produit **jamais** une liste d'allergènes ni une mention réglementaire de carte :
  elles se recopient depuis les fiches techniques validées.

**À valider** : ces interdits comme doctrine d'organisme.

---

## Ce qui n'est PAS demandé ici

- Le contenu rédigé **ne cite aucun article de loi de mémoire**. Les références vivent dans
  les séquences `cadre` du catalogue et dans le kit formateur, sourcées et datées.
- Les questions de stagiaires qui touchent au droit sont traitées par la formule de
  non-arbitrage. Ce n'est pas une échappatoire : c'est la posture enseignée, et elle est
  elle-même un acquis de plusieurs formations.

---

## Dépendance liée — le kit formateur imprimé

Plusieurs formulations ci-dessus renvoient à des pièces du kit (listes sourcées et datées,
trames de relance, corrigés). **Ce kit n'existe pas encore.** Il est référencé par les
plans B de toutes les formations rédigées, et sans lui aucun repli n'est exécutable le jour
où l'outil tombe.

Sa production est la première dépendance avant une session réelle — et les pièces
juridiques qu'il portera relèvent de la même relecture que ce document.
