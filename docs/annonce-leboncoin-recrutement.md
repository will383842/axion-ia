# Annonce Le Bon Coin + landing dédiée + pilotage des annonces

> **Créé le** 2026-08-23 · **Aucun code écrit.**
> Complète `docs/plan-recrutement-apporteurs-daffaires.md` (chantier C5).
> **Brief Will** : annonce Le Bon Coin France entière, landing dédiée type `memo-isere`, stats console par annonce. Focus **formations + audits uniquement**. Mettre en avant les **500 €**. Ton **fun, simple, accrocheur**.

---

## 1. L'ordre — corrigé

Le brief propose : _annonce → landing → pilotage_. **Dans cet ordre, on ne saura pas si l'annonce a marché.**

Concrètement : sans traçage, une candidature arrive dans la console **sans qu'on sache d'où elle vient**. Le Bon Coin ? Google ? Le Mémorial ? LinkedIn ? Impossible à dire.

Trois semaines plus tard, vous avez 30 candidatures et **aucun moyen de savoir si Le Bon Coin en a apporté 25 ou 2**. Donc aucun moyen de décider s'il faut y remettre de l'argent — c'est-à-dire la seule question que ce test doit trancher.

Et le problème n'attend pas : une annonce Le Bon Coin est surtout vue dans ses **48 premières heures**. Poser le traçage après la publication, c'est rater le pic.

> **Le traçage, c'est simplement l'étiquette qui dit « cette personne vient du Bon Coin ».** Sans elle, on paie une annonce à l'aveugle.

### L'ordre retenu

| #     | Étape                               | Charge    | Pourquoi ici                                                                                                |
| ----- | ----------------------------------- | --------- | ----------------------------------------------------------------------------------------------------------- |
| **0** | **Rédiger l'annonce**               | fait (§2) | Elle fixe la promesse. La landing doit dire exactement la même chose.                                       |
| **1** | **Traçage de la source**            | 0,5 j     | `leboncoin` dans `SOURCE_OPTIONS` + UTM. **Sans lui, impossible de savoir d'où viennent les candidatures.** |
| **2** | **Landing `/partenaire/leboncoin`** | 1,5 j     | L'annonce pointe dessus — elle doit exister avant.                                                          |
| **3** | **Stats console par annonce**       | 1 j       | Idéalement avant publication ; acceptable en J+2 si le traçage (1) est en place.                            |
| **4** | **Publier l'annonce**               | —         |                                                                                                             |

**Total : ~3 jours de développement avant publication.**

> ⚠️ **L'étape 1 est la seule vraiment bloquante.** Le traçage doit exister avant le premier clic. Les stats (3) peuvent suivre : les données sont déjà en base, l'écran ne fait que les lire.

---

## 2. L'annonce Le Bon Coin — prête à publier

### 2.1 Le titre

Le titre fait tout : il décide du taux de clic, et les annonces Le Bon Coin sont souvent indexées par Google. Trois options, la première recommandée :

| #        | Titre                                                               | Pourquoi                                                                 |
| -------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| **A** ✅ | **Apporteur d'affaires IA — 500 € par journée de formation vendue** | Le chiffre arrête le scroll. Le métier est nommé. Aucune promesse floue. |
| B        | Commercial indépendant IA — 500 €/formation + 30 % sur les audits   | Plus complet, mais deux chiffres diluent l'accroche                      |
| C        | Formations IA : apporteur d'affaires, 500 € par journée vendue      | Bon si la recherche « formation IA » compte plus que « apporteur »       |

### 2.2 Les trois leviers « conditions de marché » — lequel a le droit d'être utilisé

_Question de Will, 2026-08-23 : « faut-il jouer sur l'OPCO, Qualiopi et l'AI Act pour montrer que la vente est facilitée ? »_

> 🟢 **Décision Will du 2026-08-23** : **l'annonce ne sera publiée qu'une fois la certification Qualiopi obtenue.** Les trois leviers sont donc utilisables, et l'annonce les emploie tous les trois. Le tableau ci-dessous documente la dépendance — il ne restreint plus rien.

| Levier                             | Utilisable ?                | Condition                                                  |
| ---------------------------------- | --------------------------- | ---------------------------------------------------------- |
| **AI Act**                         | ✅ **OUI, immédiatement**   | Aucune. Obligation réelle, en vigueur, vérifiable.         |
| **Financement OPCO jusqu'à 100 %** | ✅ **OUI à la publication** | Suppose Qualiopi — acquise au moment de publier            |
| **Qualiopi**                       | ✅ **OUI à la publication** | Certificat délivré + `QUALIOPI_CERTIFICATION_OBTENUE=true` |

> ⚠️ **Un seul garde-fou technique à tenir** : la **landing** doit gater ces mentions sur `isQualiopiCertificationObtenue()`, pas les écrire en dur. Elle sera peut-être déployée avant le certificat, et le drapeau est ce qui garantit qu'aucune affirmation ne s'affiche avant d'être vraie. **Le texte de l'annonce, lui, est publié à la main le jour J — il peut tout dire.**
>
> Ceci ne change rien pour `/memo-isere`, qui est **en ligne aujourd'hui** : le point L9 (§6) tient jusqu'à la certification.

#### ✅ L'AI Act est le meilleur des trois — et de loin

**Article 4 du règlement européen sur l'IA, applicable depuis le 2 février 2025** : les fournisseurs et déployeurs de systèmes d'IA doivent prendre des mesures pour assurer un niveau suffisant de **maîtrise de l'IA** (« AI literacy ») chez leurs personnels.

Pour un apporteur, c'est bien plus fort qu'un argument de financement :

|                    | Argument OPCO                       | Argument AI Act                                         |
| ------------------ | ----------------------------------- | ------------------------------------------------------- |
| Ce qu'il dit       | « ça ne vous coûtera presque rien » | « **vous devez le faire** »                             |
| Ce qu'il déclenche | Lève une objection de prix          | **Crée une urgence**                                    |
| Quand il sert      | À la fin, quand le prix arrive      | **Dès la première phrase**, pour obtenir le rendez-vous |

Un apporteur n'a pas besoin d'un produit moins cher. Il a besoin d'**une raison d'appeler**. L'AI Act la lui donne.

**Et il couvre les deux produits**, ce qui rend le discours parfaitement cohérent :

- L'AI Act impose de **former** les équipes → **la formation**
- L'AI Act impose classification des risques, gouvernance, registre, transparence → **l'audit**

Votre offre d'audit vend d'ailleurs déjà explicitement la « conformité AI Act 2026 + RGPD » (`src/content/audit-detail-configs.ts`). Le discours est donc déjà aligné côté produit.

#### ⚠️ La limite à ne pas franchir sur l'AI Act

> **« C'est une obligation légale » → vrai.**
> **« Vous risquez une amende de 35 M€ » → faux.**

Le régime de sanctions du règlement (article 99) vise des articles précis — l'article 4 n'en fait pas partie. Il n'existe pas d'amende européenne directement attachée au défaut de maîtrise de l'IA.

Un réseau de 200 apporteurs qui brandirait une menace d'amende inexistante ferait exactement ce qu'on cherche à éviter : industrialiser une affirmation trompeuse.

- [ ] ⚠️ **À faire confirmer par un juriste** avant d'écrire quoi que ce soit sur les sanctions dans le kit de vente. La formulation sûre est : _« c'est une obligation, pas une option »_ — sans chiffrer de sanction.

#### 💰 L'OPCO jusqu'à 100 % — le second pilier de l'annonce

**Le fait est exact** : pour un organisme certifié, une action de formation peut être prise en charge par l'OPCO de l'entreprise, parfois intégralement selon la branche, l'enveloppe disponible et la taille de l'entreprise.

**Combiné à l'AI Act, ça donne l'argumentaire le plus fort possible pour un apporteur** — parce que les deux leviers attaquent les deux objections opposées :

| Objection du dirigeant                              | Ce qui la lève                                               |
| --------------------------------------------------- | ------------------------------------------------------------ |
| « Je n'ai pas le temps / ce n'est pas prioritaire » | **L'AI Act** : ce n'est pas une option, c'est une obligation |
| « Je n'ai pas le budget »                           | **L'OPCO** : jusqu'à 100 %, parfois sans trésorerie à sortir |

Il ne reste presque plus d'échappatoire. C'est ce qui rend ce métier réellement accessible à un débutant : **l'argumentaire fait le travail à sa place.**

**Et l'apporteur ne monte aucun dossier** — c'est Axion-IA qui s'en charge. À mettre en avant : _« pas de paperasse OPCO pour vous »_ est un argument de recrutement à part entière.

##### ⚠️ La formulation à tenir

> **« jusqu'à 100 %, selon l'OPCO et la branche »** ✅
> **« pris en charge à 100 % »** ❌

La prise en charge dépend de l'OPCO, de la branche, de l'enveloppe et de la taille de l'entreprise. Même certifié, personne ne peut la garantir. Le « jusqu'à » assorti de sa condition est exact et défendable ; l'affirmation sèche ne l'est pas.

##### Le garde-fou technique

Le texte de l'annonce est publié **à la main**, le jour J — il peut donc tout dire.

La **landing**, elle, est du code déployé peut-être avant le certificat. Ses mentions OPCO et Qualiopi doivent donc être gatées sur `isQualiopiCertificationObtenue()` — le drapeau que votre code prévoit déjà, _« à passer à `true` le jour où le certificat est délivré, pas avant »_. C'est le motif déjà employé ligne 787 de `memo-isere` ; on l'étend simplement au reste.

- [ ] **Décision** : mentions OPCO/Qualiopi de la landing **gatées sur le drapeau**, jamais écrites en dur

---

### 2.3 🔑 Faire sauter la barrière « je n'y connais rien en IA »

_Demande de Will : « il faut que les personnes ne se disent pas "je n'y connais rien en IA". Ils n'ont pas du tout besoin d'être techniques. »_

**C'est le frein n°1 de ce recrutement.** Devant cette annonce, un excellent commercial de 58 ans avec un carnet d'adresses en or se dit : _« l'IA, c'est pas pour moi, je vais passer pour un imbécile devant le dirigeant. »_ Et il ferme la page.

#### Les deux réponses qui ne marchent pas

| Réponse                     | Pourquoi elle échoue                                                                   |
| --------------------------- | -------------------------------------------------------------------------------------- |
| « On te formera à l'offre » | Sous-entend qu'**il faut savoir**. Et ça annonce du travail avant le premier euro.     |
| « C'est facile, tu verras » | Condescendant, et non crédible : personne n'a jamais été rassuré par « c'est facile ». |

#### La seule réponse qui marche : le recadrage

> ### **Ce n'est pas votre rôle de savoir. Votre rôle, c'est de savoir QUI a le problème.**
>
> **Vous n'avez pas besoin de savoir comment fonctionne un extincteur pour dire à un commerçant que la loi lui en impose un.**

Cette phrase fait tout le travail. Elle est immédiate, universelle, et elle ne demande à personne de se sentir dépassé.

#### Les cinq appuis à mettre dans l'annonce et la landing

1. **Le dirigeant en face n'y connaît rien non plus.** C'est _exactement_ pour ça qu'il a besoin de nous. Si tout le monde savait, il n'y aurait pas de marché.
2. **Une phrase à dire, pas un argumentaire à apprendre** (voir ci-dessous).
3. **Une question technique n'est pas un piège, c'est un signal d'achat.** La réponse est toujours la même : _« excellente question — c'est exactement ce que l'expert vous détaillera. Je vous cale un rendez-vous ? »_
4. **Vous n'êtes jamais seul.** Le premier rendez-vous peut se faire à deux, en visio, avec nous.
5. **Zéro démo, zéro outil, zéro installation.** Vous ne montrez rien, vous ne configurez rien.

#### La phrase — celle qui tient dans un couloir

```
« Vous savez qu'il y a maintenant une obligation européenne de former
  les équipes qui utilisent l'IA ? La plupart des dirigeants ne le
  savent pas encore.
  Je travaille avec un organisme qui fait exactement ça.
  Vous voulez que je vous mette en relation ? »
```

**C'est tout le métier.** Cette phrase doit figurer _dans l'annonce elle-même_ — pas seulement dans le kit. Un candidat qui la lit comprend en trois secondes qu'il en est capable. C'est probablement l'élément le plus convertissant de toute la page.

#### Le bloc à insérer dans l'annonce

```
« JE N'Y CONNAIS RIEN EN IA »

Tant mieux. Ce n'est pas votre rôle.

Vous n'avez pas besoin de savoir comment fonctionne un extincteur
pour dire à un commerçant que la loi lui en impose un.

• Le dirigeant en face n'y connaît rien non plus — c'est bien pour ça
  qu'il a besoin de nous.
• Aucune démo à faire. Aucun outil à installer. Aucun devis à monter.
• On vous pose une question technique ? « Excellente question, c'est
  exactement ce que l'expert vous détaillera. Je vous cale un rendez-vous ? »
• Premier rendez-vous en visio à deux avec nous, si vous préférez.

Ce que vous avez à savoir tient en une phrase :
« Il y a maintenant une obligation européenne de former les équipes
  qui utilisent l'IA. Je travaille avec un organisme qui fait ça.
  Je vous mets en relation ? »
```

> ⚠️ **Cohérence à surveiller** : la FAQ actuelle de `/memo-isere` (ligne 555) répond _« Non. On te forme complètement à l'offre… »_. C'est la formulation qui échoue au tableau ci-dessus — elle sous-entend qu'il faut savoir. À aligner sur le recadrage.

---

### 2.4 🎯 Cibler les gens qui ont DÉJÀ un réseau

_Remarque de Will, 2026-08-23 : « il ne faudrait pas trouver des personnes avec un réseau existant aussi ? »_

**Oui — et c'est le levier de rentabilité le plus fort de toute l'annonce.** Un candidat avec 300 dirigeants dans son téléphone vaut cinquante fois un candidat qui part de zéro. Ils coûtent le même prix à recruter.

Or **l'annonce actuelle ne sélectionne pas là-dessus** : elle dit « un réseau d'entreprises — ou l'envie d'aller le construire ». C'est inclusif, mais ça dilue.

#### La technique : attirer, ne pas exiger

On n'écrit **pas** « il faut un réseau » — ça ferme la porte à des motivés, et ça n'attire personne activement.

On écrit : **« votre carnet d'adresses vaut de l'argent »**. C'est un compliment adressé à exactement la bonne personne. Elle se reconnaît, elle se sent vue, elle candidate.

#### 🥇 La cible que personne ne vise : ceux qui visitent déjà des entreprises

C'est le meilleur profil pour une annonce Le Bon Coin, et il est massivement présent sur cette plateforme :

> **Les commerciaux qui sont déjà chez un dirigeant dix fois par semaine.**
> Télécoms, énergie, mutuelle santé collective, sécurité, propreté, fournitures de bureau, logiciels de gestion, flotte automobile, assurance pro…

Ils sont **déjà en face de la bonne personne**. Ajouter une carte ne leur coûte **rien** : ni prospection, ni déplacement, ni temps. C'est du revenu marginal pur sur des rendez-vous qu'ils font déjà.

Et le pitch n'est pas « changez de métier » — c'est **« ajoutez une ligne à ce que vous faites déjà »**. Infiniment plus facile à accepter.

#### Les profils à nommer explicitement

Nommer les métiers est ce qui déclenche la reconnaissance. Une liste vague ne convertit personne.

- Commerciaux B2B en poste (une carte de plus) ou en reconversion
- **Commerciaux qui tournent déjà chez les dirigeants** (télécom, énergie, mutuelle, sécurité, fournitures…)
- Agents commerciaux multicartes
- Courtiers en assurance ou en financement professionnel
- Consultants indépendants (RH, gestion, organisation, qualité)
- Mandataires en immobilier d'entreprise
- Anciens dirigeants, anciens responsables d'agence
- **Jeunes retraités du commerce** — déjà dans l'annonce, à conserver

#### ⚠️ Une seule annonce pour démarrer — correction du 2026-08-23

_Une version antérieure de ce document recommandait de publier deux annonces d'emblée (large + multicarte) pour tester deux cibles. **C'est une erreur au lancement**, pour deux raisons :_

1. **Un A/B test sur petits volumes ne dit rien.** À 30 candidatures sur trois semaines, couper en deux donne 15 contre 15 : l'écart observé est du bruit, pas un résultat. On déciderait sur une illusion.
2. **Le Bon Coin sanctionne les doublons.** Deux annonces proches pour la même offre est un motif classique de suppression pour multi-diffusion — on risquerait de perdre les deux.

**À la place : une annonce unique qui porte les deux angles.** Le bloc « Votre carnet d'adresses vaut de l'argent » s'adresse déjà directement aux multicartes _à l'intérieur_ de l'annonce large. On touche les deux cibles sans diviser le trafic ni doubler le coût.

**La vraie question du lancement n'est pas « quelle annonce ? » mais « est-ce que Le Bon Coin marche pour ce profil ? »** Une seule annonce y répond, et c'est la seule chose à savoir pour décider de remettre de l'argent dans ce canal.

##### Quand ouvrir une seconde annonce

Seuil : **40+ candidatures et un coût par apporteur actif acceptable après 3 semaines.** Alors seulement, ajouter une annonce dédiée multicarte, avec un titre et un corps **franchement différents** (pour éviter le doublon), sur une URL distincte :

|       | Annonce A — lancement                                           | Annonce B — plus tard, si A fonctionne                                  |
| ----- | --------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Titre | Apporteur d'affaires IA — 500 € par journée de formation vendue | Vous visitez déjà des entreprises ? Ajoutez une carte à 500 €/formation |
| Cible | Tous profils commerciaux, bloc carnet d'adresses inclus         | Ceux qui sont déjà chez le dirigeant                                    |
| URL   | `/partenaire/leboncoin`                                         | `/partenaire/leboncoin?a=multicarte`                                    |

On compare au **coût par apporteur actif**, jamais au nombre de candidatures.

#### ⚠️ Ne pas confondre avec les têtes de réseau

Le levier n°1 du plan (§7.1) — courtiers, experts-comptables, réseaux de mandataires, clubs d'affaires — ce sont des **structures** qui amènent 20 apporteurs chacune. **Elles ne se recrutent pas par petite annonce**, mais par démarchage direct et personnalisé.

Le Bon Coin recrute des **individus** à réseau. Les deux canaux sont complémentaires, ils ne se remplacent pas.

#### 🚀 Ceux qui peuvent apporter du CA vite : la vraie objection, et le parcours accéléré

_Relance de Will : « ceux qui ont déjà un réseau et peuvent nous apporter du CA rapidement, en as-tu tenu compte ? »_

**Partiellement seulement.** Le bloc précédent les _attire_, le scoring les _détecte_ (/25 sur la taille du carnet) — mais **rien ne change pour eux ensuite**. Un candidat avec 200 dirigeants dans son téléphone suivait exactement le même chemin qu'un débutant : même webinaire du mercredi, mêmes emails J0/J2/J7. C'est un gâchis.

##### Leur objection n'est pas celle des autres

| Profil              | Ce qu'il se demande                             |
| ------------------- | ----------------------------------------------- |
| Débutant            | « Est-ce que j'en suis capable ? »              |
| **Profil à réseau** | **« Est-ce que je vais griller mon réseau ? »** |

Un commercial avec un vrai carnet ne doute pas de sa capacité à vendre. **Son carnet EST son capital**, construit sur quinze ans. Il ne va pas le dépenser sur un partenaire non éprouvé. S'il recommande Axion-IA et qu'on met trois semaines à rappeler, **c'est lui qui perd la face**, pas nous.

> **Notre réactivité est son risque de réputation.** C'est le seul verrou à faire sauter, et il ne se lève pas avec des arguments : il se lève avec des engagements.

##### Les trois engagements qui débloquent ce profil

1. **Rappel de toute entreprise présentée sous 48 h.** Peu coûteux à tenir aux premiers volumes, et c'est exactement ce qui le rassure.
2. **Le premier rendez-vous se fait avec lui**, en visio. Il ne s'expose pas seul.
3. **Pas de webinaire, pas d'attente.** Appel sous 24 h, contrat dans la foulée.

##### Le parcours accéléré

| Étape               | Standard                            | **Fast lane (carnet ≥ 50 dirigeants ou score ≥ 70)** |
| ------------------- | ----------------------------------- | ---------------------------------------------------- |
| Après candidature   | Invitation au webinaire du mercredi | **Appel personnel sous 24 h**                        |
| Contrat             | Après le webinaire                  | **Dans la foulée de l'appel**                        |
| Premier rendez-vous | Seul, quand il veut                 | **À deux, en visio, sous 7 jours**                   |
| Objectif            | 1er contact déposé sous 30 j        | **1re commission encaissée sous 45 j**               |

Le scoring (C1) fournit déjà le tri. Il ne manque que l'aiguillage en aval.

##### ⚠️ Mais le CA le plus rapide ne viendra pas de cette annonce

À dire franchement : si la priorité est **du chiffre d'affaires vite**, Le Bon Coin n'est pas le bon levier principal. Une annonce construit du volume sur des mois.

**Les têtes de réseau du plan §7.1** — courtiers en financement pro, experts-comptables, réseaux de mandataires, clubs d'affaires — peuvent produire du CA en **semaines**, parce qu'elles arrivent avec un portefeuille déjà constitué. Elles se recrutent par démarchage direct et personnalisé, **coût 0 €, uniquement du temps**.

> **Recommandation : mener les deux en parallèle.** 10 emails ciblés par jour vers des têtes de réseau pendant que l'annonce se prépare. Ne pas attendre les 3 jours de dev pour commencer à parler aux bonnes personnes.

#### 🔤 Le mot « B2B » — à employer, mais toujours doublé

Le corps de l'annonce ne contenait **pas une seule fois** le mot « B2B ». C'est un manque, pour trois raisons :

1. **C'est le mot par lequel la cible se désigne elle-même.** « Commercial B2B » est un identifiant de métier. Ne pas l'écrire, c'est rater la reconnaissance immédiate.
2. **C'est un terme de recherche.** Il figure déjà dans votre stratégie de mots-clés (`commercial-offer.ts` : « vente B2B », « prospection entreprises »). Les annonces Le Bon Coin remontent dans Google.
3. **🔑 C'est le critère le plus lourd de votre scoring.** Le barème du plan (§4.4) attribue **/30 aux années de vente B2B** — la note la plus haute de tous les critères, et le schéma de candidature porte déjà `b2bDejaVendu` et `b2bAnnees`. Si le tri en aval privilégie le B2B, l'annonce en amont doit l'attirer. Sinon on paie pour attirer des profils que le scoring va ensuite déclasser.

**Mais toujours doublé d'une version en français simple.** Un commercial de 63 ans ne dit pas « je faisais du B2B », il dit « je vendais aux entreprises ». S'appuyer sur le seul sigle ferait perdre exactement le segment retraités.

> ✅ **« vente B2B (aux entreprises) »** · **« commerciaux B2B — vente aux entreprises »**
> ❌ « B2B » seul, répété · ❌ « vente aux entreprises » seul, sans le sigle

#### Le bloc à insérer dans l'annonce

```
VOTRE CARNET D'ADRESSES VAUT DE L'ARGENT

Vous avez déjà vendu aux entreprises ? Vous avez l'essentiel.
Le B2B, c'est votre métier — l'IA, c'est le nôtre. Le reste, on s'en occupe.

Et si vous visitez déjà des entreprises toute la journée — télécom,
énergie, mutuelle, sécurité, propreté, fournitures, logiciels — c'est
encore plus simple : vous êtes déjà en face de la bonne personne.
Une phrase de plus dans un rendez-vous que vous faisiez de toute façon.

Ce métier va bien à : commerciaux B2B (vente aux entreprises), en poste
ou anciens · agents commerciaux multicartes · courtiers en assurance ou
en financement pro · consultants indépendants · mandataires en immobilier
d'entreprise · anciens dirigeants · et jeunes retraités du commerce,
dont le carnet d'adresses vaut de l'or.

Vous partez de zéro ? C'est possible aussi. Ce sera juste plus long.
```

Deux lignes portent tout le travail :

- **« Le B2B, c'est votre métier — l'IA, c'est le nôtre. »** Elle fait d'une pierre deux coups : elle capte le mot-clé _et_ elle règle la barrière « je n'y connais rien en IA » (§2.3) en une seule phrase. C'est la meilleure ligne de l'annonce.
- **« Vous partez de zéro ? C'est possible aussi. Ce sera juste plus long. »** Honnête, n'exclut personne, et prévient le débutant que ce ne sera pas immédiat — ce qui évite la déception à trois semaines.

---

### 2.5 ⭐ L'ANNONCE FINALE — prête à copier-coller

> **Version du 2026-08-23, révisée après retours Will** : tutoiement (harmonisation `memo-isere`), **aucun délai promis**, **appel visio individuel** au lieu du webinaire.
> Publier **une seule annonce** (§2.4), et **uniquement après obtention du certificat Qualiopi**.

#### Harmonisation avec `/memo-isere` — ce que j'ai vérifié

| Point                       | `/memo-isere`                                                                             | Annonce Le Bon Coin        | État                          |
| --------------------------- | ----------------------------------------------------------------------------------------- | -------------------------- | ----------------------------- |
| **Registre**                | **Tutoiement** (« Tu proposes », « ta zone », « toi, tu touches »)                        | Était en vouvoiement       | ✅ **Aligné en tutoiement**   |
| **Délai de réponse**        | _« On te rappelle vite »_ — aucun délai chiffré                                           | Promettait 24 h / 48 h     | ✅ **Délais retirés**         |
| **Format d'accueil**        | _« un échange téléphonique »_ (l. 573)                                                    | Parlait de webinaire hebdo | ✅ **Appel visio individuel** |
| **Commission**              | 500 €/journée, % sur audits et intégrations                                               | Identique                  | ✅                            |
| **Déclencheur de paiement** | _« une fois que le client a réglé sa facture — pas à la signature »_ (l. 578)             | Identique                  | ✅                            |
| **Avertissement revenus**   | _« exemples de calcul, pas une promesse : tes revenus dépendent de tes ventes »_ (l. 532) | Absent                     | ✅ **Repris à l'identique**   |
| **Candidature**             | _« 3 minutes chrono · zéro CV, zéro lettre de motivation »_                               | Formulation différente     | ✅ **Alignée**                |
| **Tableau de suivi**        | Promis (l. 578)                                                                           | Absent                     | ✅ **Ajouté**                 |
| **AI Act + OPCO**           | Les deux, en ouverture                                                                    | Les deux                   | ✅                            |

> ⚠️ **Incohérence relevée DANS `memo-isere` même** : le `<h1>` est en vouvoiement (_« Deve**nez** commercial IA indépendant sur **votre** territoire »_) alors que tout le reste de la page tutoie (_« **Tu** proposes… de **ta** zone »_). Deux registres à trois lignes d'écart. À trancher — et à appliquer aux deux pages en même temps.

> ⚠️ **Le « tableau de suivi » est promis sur `memo-isere` (l. 578) mais n'existe pas encore** (chantier C6, 4 j). L'annonce ne partant qu'après la certification, il sera très probablement livré d'ici là — mais c'est à vérifier avant publication.

#### Titre

```
Apporteur d'affaires IA — 500 € par journée de formation vendue
```

#### Corps

```
Depuis février 2025, une loi européenne oblige les entreprises à former
leurs équipes qui utilisent l'IA. Presque aucune ne le sait encore.
Et la formation peut être financée jusqu'à 100 % par leur OPCO.

Tu connais des dirigeants. Nous formons leurs équipes.
Tu présentes, on s'occupe du reste, tu touches ta commission.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TU N'ARRIVES PAS AVEC UN PRODUIT À POUSSER

Tu arrives avec :
 • une obligation légale que le dirigeant ignore,
 • un financement déjà prévu, qui peut couvrir jusqu'à 100 %
   (selon l'OPCO et la branche),
 • un organisme certifié Qualiopi derrière toi.

Souvent, le dirigeant n'a même pas de trésorerie à sortir.
C'est toute la différence entre déranger quelqu'un et lui rendre service.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DEUX PRODUITS. C'EST TOUT.

Pas de catalogue de 40 pages à apprendre. Deux choses à retenir :

▸ UNE FORMATION IA en entreprise
  500 € pour toi, par journée vendue.
  Une formation de 2 jours = 1 000 €. De 3 jours = 1 500 €.
  Finançable jusqu'à 100 % par l'OPCO de l'entreprise.

▸ UN AUDIT IA en entreprise
  30 % de la facture, pour toi.
  Le plus petit audit démarre à 1 190 € HT → au moins 357 €.
  Un audit de PME démarre à 1 900 € HT → au moins 570 €.

Ce sont des exemples de calcul, pas une promesse :
tes revenus dépendent de tes ventes.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

« JE N'Y CONNAIS RIEN EN IA »

Tant mieux. Ce n'est pas ton rôle.
Le B2B, c'est ton métier — l'IA, c'est le nôtre.

Tu n'as pas besoin de savoir comment fonctionne un extincteur
pour dire à un commerçant que la loi lui en impose un.

 • Le dirigeant en face n'y connaît rien non plus — c'est bien pour ça
   qu'il a besoin de nous.
 • Aucune démo. Aucun outil à installer. Aucun devis à monter.
   Aucun dossier OPCO à remplir : on s'occupe de tout.
 • Une question technique ? « Excellente question, c'est exactement ce
   que l'expert vous détaillera. Je vous cale un rendez-vous ? »
 • Ton premier rendez-vous, on peut le faire à deux, en visio.

Ce que tu as à savoir tient en une phrase :

 « Il y a maintenant une obligation européenne de former les équipes
   qui utilisent l'IA, et c'est finançable jusqu'à 100 %. Je travaille
   avec un organisme certifié qui fait exactement ça.
   Je vous mets en relation ? »

Voilà. C'est tout le métier.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TON CARNET D'ADRESSES VAUT DE L'ARGENT

Tu as déjà vendu aux entreprises ? Tu as l'essentiel.

Et si tu visites déjà des entreprises toute la journée — télécom,
énergie, mutuelle, sécurité, propreté, fournitures, logiciels — c'est
encore plus simple : tu es déjà en face de la bonne personne.
Une phrase de plus dans un rendez-vous que tu faisais de toute façon.

Ce métier va bien aux commerciaux B2B (vente aux entreprises), en poste
ou anciens · agents commerciaux multicartes · courtiers en assurance ou
en financement pro · consultants indépendants · mandataires en
immobilier d'entreprise · anciens dirigeants.

Ton carnet, c'est ton capital, et la vraie question n'est pas « est-ce
que j'en suis capable » — c'est « est-ce que je vais griller mon
réseau ». Alors on s'engage :

 • Chaque entreprise que tu nous présentes est rappelée. Tu ne seras
   jamais celui qui a recommandé un injoignable.
 • Ton premier rendez-vous, on le fait avec toi, en visio.
 • Chaque entreprise est enregistrée à ton nom. Même si elle nous
   appelle directement ensuite, la commission te revient.

Tu pars de zéro ? C'est possible aussi. Ce sera juste plus long.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ON EST UNE JEUNE BOÎTE, ET ÇA SE SENT

Axion-IA est une startup française. Concrètement, pour toi :

 • Tu parles directement à ceux qui décident. Pas de service RH,
   pas de formulaire interne, pas de manager intermédiaire.
 • Une idée ? On l'essaie la semaine d'après.
 • Tu arrives tôt : le réseau se construit maintenant, et les premiers
   arrivés choisissent leurs entreprises.

Et surtout : on est des gens sympas. Ce n'est pas un slogan, c'est
notre façon de bosser. Si l'ambiance compte pour toi autant que la
commission, on va bien s'entendre.

AUCUNE LIMITE D'ÂGE

25 ans ou 70 ans : ce qui compte, c'est ton carnet d'adresses et ton
envie. Les commerciaux et apporteurs d'affaires à la retraite sont
particulièrement les bienvenus — ton réseau vaut de l'or, tu n'as plus
rien à prouver, et tu choisis ton rythme.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

COMMENT ÇA SE PASSE

1. Tu candidates en 3 minutes. On répond à TOUTES les candidatures —
   personne ne reste sans réponse. On revient vers toi dans les
   prochaines semaines.
2. Un appel en visio, juste toi et nous : on t'explique l'offre, tu poses
   tes questions. Pas de réunion collective, un vrai échange.
3. Tu parles d'Axion-IA à une entreprise que tu connais et tu nous la
   signales : elle est enregistrée à ton nom.
4. On appelle, on présente, on monte le dossier de financement, on vend.
5. L'entreprise (ou son OPCO) nous paie → on te paie.

TU NE CLOSES JAMAIS.
C'est nous qui vendons. Tu ouvres la porte, c'est tout.
Pas de négociation, pas de devis, pas de dossier OPCO,
pas de relance d'impayés.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CE QU'IL FAUT

 • Avoir déjà vendu aux entreprises (B2B) — ou connaître des dirigeants.
   C'est le seul vrai atout qui compte.
 • Un statut d'indépendant, ou l'envie d'en créer un : c'est gratuit et
   ça prend un quart d'heure en ligne.
 • Rien d'autre. Pas de diplôme. Aucune connaissance en IA.

CE QUE CE N'EST PAS

 • Pas de salaire fixe. Tu es payé à la commission, sur les ventes
   réelles, une fois que le client a réglé sa facture.
 • Pas de frais d'entrée, pas de kit à acheter, pas de stock.
   Démarrer ne te coûte rien.
 • Pas de recrutement en cascade. On ne te demandera jamais de recruter
   qui que ce soit pour gagner de l'argent.
 • Pas d'objectif imposé, pas de reporting, pas de hiérarchie.
   Tu y consacres le temps que tu veux.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PARTOUT EN FRANCE. À distance ou sur le terrain, comme tu préfères.
Un tableau de suivi te montre tes entreprises et tes commissions.

Tout est détaillé ici — candidature en 3 minutes chrono,
zéro CV, zéro lettre de motivation :

    axion-ia.com/partenaire/leboncoin

À très vite 👋
```

#### 🔗 L'URL à mettre dans l'annonce

```
axion-ia.com/partenaire/leboncoin
```

- **URL canonique réelle** : `https://axion-ia.com/fr/partenaire/leboncoin` — `routing.ts` déclare `localePrefix: "always"`, donc toutes les pages portent le préfixe de langue.
- La forme courte sans `/fr` est redirigée par le middleware next-intl vers la version `/fr`. C'est plus lisible dans une annonce, et ça marche.
- **La source est dans le CHEMIN, pas en query string** : `/partenaire/leboncoin` plutôt que `?utm_source=leboncoin`. Les plateformes de petites annonces tronquent ou encodent mal les paramètres — le chemin, jamais.

- [ ] ⚠️ **À tester une fois la page en ligne, avant de payer l'annonce** : que `axion-ia.com/partenaire/leboncoin` (sans `/fr`) redirige bien, depuis un mobile et depuis un desktop.

#### Ce qui a changé, et pourquoi

| Correction                     | Avant                                                                           | Maintenant                                                                                                                                                 |
| ------------------------------ | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Aucun délai promis**         | « appelée sous 48 h », « on te rappelle sous 24 h », « démarrer cette semaine » | **« On répond à TOUTES les candidatures »** · **« Chaque entreprise que tu nous présentes est rappelée »** — un engagement de principe, pas un chronomètre |
| **Appel visio, pas webinaire** | « webinaire du mercredi »                                                       | **« Un appel en visio, juste toi et nous… Pas de réunion collective, un vrai échange »**                                                                   |
| **Tutoiement**                 | Vouvoiement                                                                     | Tutoiement, comme `memo-isere`                                                                                                                             |

**Pourquoi retirer les délais est une bonne décision** : un engagement chiffré non tenu détruit exactement la confiance qu'il cherchait à créer — et c'est le profil à réseau, le plus précieux, qui le remarquerait en premier. `memo-isere` l'avait déjà compris avec son _« on te rappelle vite »_.

**Pourquoi l'appel individuel bat le webinaire** : pour le profil à réseau, un webinaire collectif est un signal négatif — il dit « tu es un numéro parmi cinquante ». Un appel en visio dit l'inverse. Le coût est plus élevé côté temps (c'est le goulot du plan §8.4), mais c'est le bon arbitrage tant que le volume reste maîtrisable.

#### Longueur et repli si la limite de caractères bloque

Le texte fait environ **3 900 caractères**. Si Le Bon Coin impose une limite plus basse, couper **dans cet ordre** :

1. La liste des métiers dans « Votre carnet d'adresses » (garder les deux premières lignes)
2. Les puces de « Ce qu'il faut »
3. Les deux dernières puces de « Ce que ce n'est pas » — **jamais les deux premières** : ce sont elles qui distinguent l'annonce d'une arnaque
4. Les bullets de « Vous avez un vrai réseau ? » — mais **garder les deux lignes d'accroche** et au minimum l'engagement des 48 h

**Ne jamais couper** : le bloc « Je n'y connais rien en IA », les deux produits chiffrés, « Vous ne closez jamais ». Ce sont les trois piliers de conversion.

#### ⚠️ Si les liens externes sont retirés

Beaucoup de plateformes de petites annonces suppriment les URL du corps. Deux replis :

- Écrire l'adresse sans protocole ni `www` (souvent toléré) : `axion-ia.com/partenaire/leboncoin`
- Ou renvoyer par la recherche : _« Cherchez "Axion-IA apporteur d'affaires" sur Google »_ — moins bon, car on perd le traçage de la source. Dans ce cas, s'appuyer sur la question « Comment nous avez-vous connus ? » du formulaire de candidature.

### 2.6 Pourquoi cette annonce est construite comme ça

| Choix                                                      | Raison                                                                                                                                             |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Ouvrir sur l'AI Act, pas sur l'argent**                  | Le titre porte déjà les 500 €. Le corps doit répondre à « c'est quoi le piège ? » — et l'obligation légale prouve que le marché est réel.          |
| **« Deux produits. C'est tout. »**                         | LE message. Le commercial indépendant a peur de la complexité, pas du travail. La simplicité est l'argument de conversion n°1.                     |
| **« Le B2B, c'est votre métier — l'IA, c'est le nôtre. »** | La meilleure ligne de l'annonce : elle capte le mot-clé métier _et_ désamorce la barrière technique en une phrase.                                 |
| **« Vous ne closez jamais »**                              | L'objection n°1 du profil apporteur. La lever élimine l'essentiel des hésitations.                                                                 |
| **Chiffres vérifiables, jamais de « gagnez jusqu'à »**     | 500 €, 357 €, 570 € sortent de `pricing.ts` et de la grille publique. Un « jusqu'à 5 000 €/mois » aurait fait fuir les bons et attiré les mauvais. |

> ⚠️ **Corrigé le 2026-08-23, après vérification du rendu réel de la landing.** Ce document annonçait « un audit de PME démarre à **4 900 €** → au moins 1 470 € ». C'est le prix d'un **sous-palier** (`audit-strategique-pme-20-50`), pas celui du tier : `audit-strategique-pme.priceMin` vaut **1 900 €**, l'en-tête uniforme « À partir de 1 900 € · sur devis » décidé le 2026-06-03.
>
> La landing, qui dérive du SSOT, affichait donc 1 900 € / 570 € pendant que l'annonce promettait 4 900 € / 1 470 €. Le pire cas possible : le lecteur clique l'annonce et découvre un chiffre **plus petit**. C'est exactement l'incident que `pricing.ts` documente déjà (deux barèmes publics divergents de 150 €/journée) — la leçon étant précisément de ne jamais recopier un montant à la main.
> | **« jusqu'à 100 %, selon l'OPCO et la branche »** | Le plafond assorti de sa condition est exact et défendable. « Pris en charge à 100 % » ne le serait pas. |
> | **Une section « Ce que ce n'est pas »** | Contre-intuitif mais décisif : c'est ce qui distingue l'annonce des arnaques MLM du même rayon. Rassure les candidats **et** aide la modération. |
> | **Mention explicite des retraités et des multicartes** | Deux segments à fort potentiel que personne ne cible (plan §7.3 et §2.4). Quelques lignes suffisent à les débloquer. |
> | **Ton direct, zéro emoji, zéro majuscule hurlante** | Le public visé (35-70 ans, commerciaux expérimentés) fuit le ton « startup cool ». Ici, « fun » veut dire _« on ne me prend pas la tête »_. |
> | **« Vous partez de zéro ? Ce sera juste plus long. »** | Honnête, n'exclut personne, et prévient la déception à trois semaines. |

### 2.7 ⚠️ Règles Le Bon Coin à respecter

**À bannir absolument** (déclencheurs de suppression, et signaux d'arnaque pour le lecteur) :

- « revenus illimités », « gagnez jusqu'à X € par mois », « devenez votre propre patron »
- « travaillez depuis chez vous », « temps partiel, gros revenus »
- Majuscules excessives, chaînes d'emojis, points d'exclamation multiples
- Toute formulation qui laisse croire à un salaire ou à un revenu garanti

**À dire clairement** (protège juridiquement _et_ filtre les candidats) :

- Statut indépendant, rémunération à la commission uniquement
- Aucun frais à la charge du candidat

- [ ] ⚠️ **À vérifier avant publication** : la catégorie exacte (Emploi vs Services), le tarif de dépôt, et la politique actuelle de Le Bon Coin sur les offres **sans contrat de travail**. Certaines plateformes refusent les annonces à commission seule. **Je n'ai pas vérifié ce point** — le faire avant de compter sur ce canal.

---

## 3. La landing `/partenaire/leboncoin`

### 3.1 Une excellente nouvelle sur le coût

La page `memo-isere` est déjà construite à partir de composants réutilisables : `Container`, `Section`, `HeroBadge`, `DarkTriadPanel`, `FeatureMediaCard`, `FaqBlock`, `CtaBlock`, `StickyMobileCta`, `JsonLd`. Elle importe déjà `COMMISSION_FORMATION_PAR_JOURNEE_EUR` et gate déjà sur `isQualiopiCertificationObtenue()`.

**Il n'y a donc quasiment rien à créer** — on assemble les mêmes briques avec un autre contenu.

### 3.2 La structure, section par section

| #   | Section                       | Contenu                                                                                   | Rôle                                                             |
| --- | ----------------------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| 1   | **Héro**                      | « Deux produits. Une commission. Zéro closing. » + les deux chiffres (500 € / 30 %) + CTA | Confirmer en 3 secondes la promesse de l'annonce                 |
| 2   | **Deux produits, c'est tout** | Deux cartes seulement. Formation à gauche, audit à droite.                                | **Le cœur du « c'est simple »**                                  |
| 3   | **Combien je gagne ?**        | Petit simulateur : nombre de formations/audits par mois → gain                            | La section qui accroche : un commercial _joue_ avec les chiffres |
| 4   | **Comment ça marche**         | 4 étapes visuelles                                                                        | Rendre le processus évident                                      |
| 5   | **Vous ne closez jamais**     | Panneau sombre, une seule idée forte                                                      | Lever l'objection n°1                                            |
| 6   | **Trois scénarios honnêtes**  | « 1 formation/mois », « 2 formations + 1 audit », « le mois où ça décolle »               | Rendre le revenu concret sans rien promettre                     |
| 7   | **Ce que ce n'est pas**       | Reprise de l'annonce                                                                      | Crédibilité, différenciation face aux arnaques                   |
| 8   | **Qui peut le faire**         | Indépendants · salariés qui veulent un complément · jeunes retraités · en reconversion    | Élargir sans diluer                                              |
| 9   | **FAQ**                       | 8 vraies questions (§3.4)                                                                 | Traiter les freins un par un                                     |
| 10  | **CTA final**                 | « Candidature en 3 minutes, sans CV »                                                     | Convertir                                                        |

### 3.3 Le simulateur — la section « fun », et ses limites

C'est l'élément le plus engageant pour ce public : un commercial ne lit pas une grille, il **calcule ce qu'il va gagner**.

Mais deux garde-fous :

- **Honnêteté** : il calcule à partir de `pricing.ts`, jamais de chiffres inventés. Aucun réglage par défaut flatteur. Une mention « ce sont des ordres de grandeur, pas une promesse de revenu ».
- **Poids** : `AGENTS.md` impose **First Load JS ≤ 75 KB gz**. L'ADR 0040 a déjà posé une doctrine de budget de charge pour le simulateur `/roi` — s'en inspirer. Si le budget est menacé, une version **sans JavaScript** (trois scénarios pré-calculés, section 6) fait 90 % du travail pour 0 KB.

⚠️ Et le budget doit être **mesuré à la main** : d'après `AGENTS.md`, les gates de bundle en CI sont en `continue-on-error: true`. Aucune PR qui alourdit le bundle ne rougira.

### 3.4 Les 8 questions de la FAQ

1. Combien je gagne, vraiment ?
2. Il faut connaître l'IA ? _(non)_
3. Je dois vendre, négocier, faire des devis ? _(non)_
4. Il faut un statut ? Ça coûte quoi ? _(oui / rien)_
5. Je suis salarié, j'ai le droit ? _(clause d'exclusivité à vérifier — réponse honnête)_
6. Je suis retraité, ça touche ma pension ? _(cf. §6)_
7. Quand suis-je payé ? _(quand l'entreprise nous a payés)_
8. Et si l'entreprise me contacte directement ? _(elle est à votre nom, la commission vous revient)_

---

## 4. 🔴 Le point SEO / AEO / GEO — une correction nécessaire

Le brief demande « perfection SEO, AEO, GEO » sur la landing. **Sur cette page précise, c'est contre-productif — et votre propre code a déjà tranché la question.**

`src/app/sitemap-recrutement.xml/route.ts` documente la règle :

> _« N'émet QUE la page France + la candidature : les 40 pages ville sont en `noindex` (offre commune ≈ 89 % de contenu identique → doorway). »_

Une landing `/partenaire/leboncoin` est, par construction, un quasi-doublon de `/devenir-commercial-ia`. L'indexer, c'est :

- **cannibaliser** la page principale sur les mêmes requêtes,
- s'exposer à une **pénalité doorway**,
- pour un gain nul : **100 % de son trafic vient de l'annonce**, pas de Google.

### Où va l'effort SEO/AEO/GEO à la place

| Cible                               | Ce qu'on y met                                                                                                                                                        |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`/devenir-commercial-ia`**        | La page qui doit ranker. Elle porte déjà le JobPosting multi-lieux Google for Jobs. C'est là qu'on renforce le contenu, les entités, les réponses citables (AEO/GEO). |
| **L'annonce Le Bon Coin elle-même** | Les annonces LBC sont souvent indexées par Google. Le travail de mots-clés se fait **dans le titre de l'annonce** — d'où les trois variantes du §2.1.                 |
| **`/partenaire/leboncoin`**         | `noindex`. Objectif unique : **convertir**.                                                                                                                           |

> **Décision recommandée : `noindex` sur toutes les landings `/partenaire/[source]`**, cohérent avec le traitement déjà appliqué aux 40 pages ville.

**Alternative, si vous voulez vraiment une seconde page indexable** : il faut qu'elle vise un **cluster de requêtes différent** avec un contenu réellement original (par exemple « complément de revenu commercial indépendant » plutôt que « devenir apporteur d'affaires IA »). C'est un autre projet que la réception d'une annonce — à traiter séparément.

---

## 5. Le pilotage — savoir quelle annonce rapporte

### 5.1 Ce qui existe déjà

- Cookie UTM (`readUtmCookie`, `UTM_COOKIE_NAME`) — posé au premier clic
- `SOURCE_OPTIONS` dans le tunnel de candidature
- Le scoring (chantier C1)
- Le module `admin-qr-codes` — pour les futures annonces papier

**Il manque** : l'entrée `leboncoin` dans `SOURCE_OPTIONS`, et un écran qui agrège.

### 5.2 L'écran « Annonces » de la console

Une ligne par annonce ou canal :

| Annonce             | Coût | Vues | Clics landing | Candidatures | Score ≥ 70 | Signés | **Actifs** | **€ / actif** |
| ------------------- | ---- | ---- | ------------- | ------------ | ---------- | ------ | ---------- | ------------- |
| LBC — titre A       |      |      |               |              |            |        |            |               |
| LBC — titre B       |      |      |               |              |            |        |            |               |
| Mémorial de l'Isère |      |      |               |              |            |        |            |               |
| LinkedIn            |      |      |               |              |            |        |            |               |

**La seule colonne qui décide est la dernière.** Un canal gratuit qui produit 0 actif coûte plus cher qu'un canal à 300 € qui en produit 10.

### 5.3 Ce qu'on mesure au lancement

**Une seule annonce, une seule URL** (cf. §2.4). La question à laquelle on répond n'est pas « quel titre accroche le mieux ? » mais **« est-ce que Le Bon Coin produit des apporteurs actifs, et à quel prix ? »**

Le test de titres n'a de sens qu'à partir de volumes lisibles — soit après le seuil de 40 candidatures. Avant, l'écart mesuré serait du bruit.

---

## 6. Ce que ce dossier débloque, et ce qui reste bloqué

### ✅ Débloqué : cette annonce n'a pas besoin de Qualiopi

Le point §3.4 du plan bloquait le kit de vente à cause de l'argument « produits financés ».

**En centrant sur l'AI Act, les formations, les audits et les 500 €, cette annonce et cette landing ne mentionnent jamais le financement.** Elles sont donc **publiables immédiatement**, sans attendre la décision Qualiopi.

C'est un vrai déblocage — et l'argument de remplacement est meilleur que celui qu'il remplace (§2.2).

### 🔴 Découvert en écrivant ce dossier : `/memo-isere` affirme déjà le financement OPCO, en production

En allant lire la page comme demandé, j'y ai trouvé une dizaine d'affirmations de prise en charge OPCO **non conditionnées à la certification** :

| Ligne                      | Texte en production                                                                                       |
| -------------------------- | --------------------------------------------------------------------------------------------------------- |
| 790                        | `"Formations finançables OPCO"` — bande de réassurance                                                    |
| 567                        | « Les formations sont finançables par les OPCO, donc le coût réel pour le client est faible, voire nul. » |
| 871-874                    | Carte entière « **L'OPCO paie** » — _« l'objection prix disparaît de la conversation »_                   |
| 1126                       | « Et l'OPCO paie la formation à ta place. »                                                               |
| 601                        | **Metadata description de la page** — donc indexée par Google                                             |
| 561, 686, 1247, 1313, 1415 | Mentions diverses                                                                                         |

**Pourquoi c'est un problème, en trois lignes du dépôt lui-même :**

1. `src/server/qualiopi/config/flag.ts` (en-tête) : _« Afficher "Qualiopi / éligible CPF / **finançable OPCO**" avant la certification est **ILLÉGAL**. »_
2. `src/content/keywords/master.ts` : `"OPCO"`, `"finançable"`, `"financement"` sont dans `BANNED_TERMS`, avec le commentaire _« Axion-IA n'a NI Qualiopi NI OPCO/CPF NI dispositif de financement : interdiction de tout claim de financement/aide (publicité trompeuse). »_
3. Le financement OPCO d'une action de formation **suppose la certification Qualiopi**. Sans elle, la prise en charge n'est pas seulement non garantie : elle est **impossible**. Le claim est donc factuellement faux aujourd'hui.

**Comment c'est arrivé** : le correctif du 2026-08-19 a traité la mention « Qualiopi » de la bande de réassurance (ligne 787-789, correctement gatée sur `isQualiopiCertificationObtenue()`) — et a **laissé la ligne « Formations finançables OPCO » juste en dessous**, ligne 790, en dur. Même défaut, même fichier, une ligne d'écart.

**Pourquoi c'est urgent** : cette page est la cible de l'annonce du Mémorial de l'Isère. Elle recrute des gens à qui elle enseigne l'argument — qui le répéteront ensuite en rendez-vous. C'est très exactement le mécanisme d'industrialisation décrit au §3.4 du plan, sauf qu'il est déjà en cours.

**Trois options :**

| #        | Option                                                                  | Effet                                                                                |
| -------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| **1** ✅ | **Remplacer l'argument OPCO par l'argument AI Act** partout sur la page | La page reste aussi convaincante — voir le tableau du §2.2. Aucun claim faux.        |
| 2        | Gater toutes les mentions sur `isQualiopiCertificationObtenue()`        | Correct, mais laisse des trous dans la page tant que la certification n'est pas là   |
| 3        | Ne rien faire                                                           | Le réseau se construit sur une affirmation que le dépôt qualifie lui-même d'illégale |

- [ ] **DÉCISION WILL REQUISE** — et elle est indépendante du chantier Le Bon Coin : la page est en ligne **maintenant**.

### ⚠️ Reste bloqué : le kit de vente

Le premier apporteur qui entendra _« c'est finançable ? »_ devra répondre. Cette question relève du **kit de vente**, pas de l'annonce — mais elle arrivera dès le premier rendez-vous. La décision §3.4 reste donc à prendre avant les premières mises en relation.

### ⚠️ Ne pas promettre ce qui n'existe pas encore

L'espace apporteur et le registre d'attribution représentent ~10 jours de développement (C4 + C6). **L'annonce ne doit donc pas promettre un tableau de bord ni un « enregistrement en 90 secondes ».**

C'est pourquoi le texte du §2.2 dit _« vous nous la signalez : elle est enregistrée à votre nom »_ — vrai dès aujourd'hui, y compris avec un enregistrement manuel pendant les premières semaines.

> **Arbitrage** : lancer l'annonce maintenant avec un suivi manuel pour les 20 premiers apporteurs (parfaitement tenable à ce volume, et c'est un _test de canal_), puis livrer C4 pendant ce temps. Ou attendre 10 jours. **Recommandation : lancer maintenant.**

---

## 7. Décisions à acter

- [ ] **L1** — Ordre retenu : traçage → landing → stats → publication _(et non l'inverse)_
- [ ] **L2** — Titre de l'annonce : **A**, B ou C — **une seule annonce au lancement** (§2.4), seconde annonce multicarte seulement au-delà de 40 candidatures
- [ ] **L3** — Landing `/partenaire/leboncoin` en **`noindex`** ; l'effort SEO/AEO/GEO va sur `/devenir-commercial-ia`
- [ ] **L4** — Simulateur interactif, **ou** trois scénarios statiques si le budget bundle est menacé
- [ ] **L5** — Lancer maintenant avec suivi manuel, **ou** attendre les 10 j de C4
- [ ] **L6** — Vérifier la politique Le Bon Coin (catégorie, tarif, offres sans contrat de travail)
- [ ] **L7** — Ajouter `leboncoin` à `SOURCE_OPTIONS`
- [ ] **L8** — Arguments de marché : **AI Act + OPCO jusqu'à 100 % + Qualiopi**, l'annonce n'étant publiée qu'après certification _(décision Will 2026-08-23)_
- [ ] **L9** — 🔴 `/memo-isere` est **en ligne aujourd'hui**, avant la certification : ses ~10 claims OPCO (§6) restent à traiter tant que le certificat n'est pas délivré
- [ ] **L10** — Faire valider par un juriste la formulation AI Act avant le kit de vente (**ne jamais chiffrer de sanction**)
- [ ] **L11** — Landing : mentions OPCO/Qualiopi **gatées sur `isQualiopiCertificationObtenue()`**, jamais en dur
- [ ] **L12** — Formulation OPCO tenue partout : **« jusqu'à 100 %, selon l'OPCO et la branche »**, jamais « pris en charge à 100 % »
- [ ] **L13** — Aligner la FAQ de `/memo-isere` ligne 555 (« on te forme complètement à l'offre ») sur le recadrage « ce n'est pas votre rôle de savoir » (§2.3)
