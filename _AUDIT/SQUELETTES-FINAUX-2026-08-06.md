# Squelettes finaux des 22 formations — 6 août 2026

**22/22 conformes** au recalcul indépendant. Minutage complet, ratio de pratique au-dessus du seuil de chaque format.

| Formation | Programmé | Dû | Pratique | Seuil |
|---|---|---|---|---|
| ia-pour-bien-commencer | 240 min | 240 min | **63 %** | 40 % |
| ia-pour-bien-commencer-journee | 420 min | 420 min | **61 %** | 50 % |
| ia-pour-l-automatisation | 840 min | 840 min | **62 %** | 60 % |
| ia-pour-l-hotellerie-restauration | 420 min | 420 min | **60 %** | 50 % |
| ia-pour-l-immobilier | 420 min | 420 min | **61 %** | 50 % |
| ia-pour-l-industrie | 840 min | 840 min | **61 %** | 60 % |
| ia-pour-l-it | 840 min | 840 min | **63 %** | 60 % |
| ia-pour-la-banque-assurance | 420 min | 420 min | **58 %** | 50 % |
| ia-pour-la-finance | 420 min | 420 min | **61 %** | 50 % |
| ia-pour-la-production | 840 min | 840 min | **64 %** | 60 % |
| ia-pour-la-relation-client | 420 min | 420 min | **59 %** | 50 % |
| ia-pour-la-sante | 420 min | 420 min | **58 %** | 50 % |
| ia-pour-le-btp | 420 min | 420 min | **60 %** | 50 % |
| ia-pour-le-commerce | 425 min | 420 min | **58 %** | 50 % |
| ia-pour-le-juridique | 420 min | 420 min | **56 %** | 50 % |
| ia-pour-le-marketing | 420 min | 420 min | **56 %** | 50 % |
| ia-pour-le-transport-logistique | 420 min | 420 min | **55 %** | 50 % |
| ia-pour-les-achats | 420 min | 420 min | **58 %** | 50 % |
| ia-pour-les-commerciaux | 420 min | 420 min | **61 %** | 50 % |
| ia-pour-les-equipes | 420 min | 420 min | **60 %** | 50 % |
| ia-pour-les-rh | 420 min | 420 min | **60 %** | 50 % |
| seminaire-ia-toute-l-entreprise-1j | 420 min | 420 min | **56 %** | 50 % |

---

## Verdict du contrôle

**Verdict**
Les 22 fiches sont conformes au recalcul : ratio pratique au-dessus du seuil sur chacune (marge la plus faible : transport-logistique 55 % pour 50 %, automatisation 62 % pour 60 %). Aucune fiche n'est à réécrire pour cause de ratio.
Le catalogue est applicable sur le plan pédagogique, mais pas publiable en l'état : les bloquants restants sont hors programme (relecture juridique, `materielFr` absent, kits d'animation à produire, horloge de la timeline publique fausse).

**Écarts de déclaration**
Aucun. Les 22 fiches annoncent exactement le ratio recalculé (écart = 0 partout). Les agents ont fait leur somme.

**Ce qui reste non conforme**
Aucune fiche sous son seuil. Un seul écart de volume :

| slug | ratio réel | seuil | minutes | nature |
|---|---|---|---|---|
| ia-pour-le-commerce | 58 % | 50 % | 425 programmées pour 420 dues (+5) | ajustement de 5 minutes, pas de réécriture |

Point de convention à trancher, sinon 7 fiches basculent : le seuil appliqué ici est celui de `ratio-pratique.ts` (50 % en 1 j, 60 % en 2 j). Si le plancher de 60 % de `_AUDIT/PROMPT-REVISION-SQUELETTE-FORMATION.md` fait foi, alors transport (55), séminaire / marketing / juridique (56), achats / santé / commerce / banque-assurance (58) et relation-client (59) passent non conformes — de 4 à 22 minutes à convertir chacune, et les séquences convertibles sont précisément les garde-fous (cadre réglementaire, ré-identification, biais) que le contrôle demandait de renforcer. Décision à prendre une fois, pas fiche par fiche.

**Livrables**
Aucun doublon littéral : les 22 livrables portent 22 noms distincts, et « espace de travail persistant » / « bibliothèque de prompts » ont disparu partout. Restent trois familles de forme quasi identique, différenciées seulement par le vocabulaire métier :

1. Procédure interne opposable du service — `ia-pour-la-sante` (manuel de procédures), `ia-pour-l-industrie` (procédure d'usage au système documentaire), `ia-pour-la-banque-assurance` (protocole IA du service). Même structure : périmètre autorisé, liste rouge, circuit de validation, traces, grille de contrôle.
2. Classeur d'exploitation métier — `ia-pour-la-finance` (clôture), `ia-pour-la-production` (atelier), `ia-pour-le-transport-logistique` (exploitation).
3. Trames + checklist avant diffusion — `ia-pour-le-marketing`, `ia-pour-l-immobilier`, `ia-pour-le-commerce`, `ia-pour-l-hotellerie-restauration`, `ia-pour-le-btp`.

Trois composants apparaissent dans 20 fiches sur 22 (liste rouge, grille de relecture avant diffusion, feuille de route à trois usages datés) : c'est ce qui rend les livrables interchangeables à la lecture.

Doublons de contenu signalés par les agents eux-mêmes, non résolus : `ia-pour-la-production` × `ia-pour-l-industrie` (3 600 € / 3 900 €, arbitrage fusion ou scission) ; `ia-pour-l-automatisation` × jour 2 de production / industrie / it (même bloc identifier-prototyper-tester) ; atelier tableur `ia-pour-la-finance` × `ia-pour-les-achats` ; réponses aux avis positif/négatif/injustifié `ia-pour-le-commerce` × `ia-pour-l-hotellerie-restauration` ; suivi de commandes et relances `ia-pour-le-transport-logistique` × `ia-pour-les-achats`. Et `ia-pour-bien-commencer` × `ia-pour-bien-commencer-journee` : livrables distincts, mais 4 des 5 `objectifsFr` identiques mot pour mot pour 700 € d'écart.

**À faire relire par un humain**

*Règlement (UE) 2024/1689 — le plus cité, la relecture la plus urgente*
- Art. 50 (transparence) : cité ou invoqué dans 11 fiches. Quatre agents (equipes, automatisation, marketing, commerce) signalent que la formulation retenue est plus large que l'obligation réelle — marquage machine côté fournisseur vs divulgation côté déployeur pour les contenus publiés d'intérêt général. Une position maison unique à écrire, pas 11 formulations.
- Annexe III : point 4 a) tri de candidatures (rh), 4 b) suivi/évaluation des travailleurs (journee, production, it, industrie, transport, btp), point 5 solvabilité — personnes physiques seulement (finance, banque-assurance), point 8 justice (juridique). `ia-pour-l-immobilier` a **refusé** d'écrire que le tri de candidats locataires relève de l'annexe III (le contrôle le demandait) et fonde l'interdiction sur discrimination + pièces exigibles + RGPD art. 22 : arbitrage à valider explicitement.
- Art. 4 (littératie), art. 5 (émotions au travail), art. 26 §7 (information préalable des représentants) : journee, séminaire, juridique, achats, production.
- Dates d'applicabilité : à reconfirmer à la date des sessions. `ia-pour-l-it` signale un possible report du calendrier annexe III.

*RGPD*
- Art. 4(5) — « pseudonymiser n'est pas anonymiser » : formule répétée dans 6 fiches. Une validation unique et opposable, une seule fois.
- Art. 22 (décision automatisée) : automatisation, finance, achats, immobilier, banque-assurance. La finance demande explicitement d'assouplir en « peut relever de » selon l'usage.
- Art. 35 AIPD : automatisation, it — `ia-pour-l-it` distingue AIPD RGPD et analyse d'impact sur les droits fondamentaux du règlement IA (qui ne vise pas une DSI privée) : distinction fine à valider.

*Code du travail*
- L.2312-38 (information CSE) : `ia-pour-les-rh` corrige l'erreur L.1221-9 relevée au contrôle ; à propager. Aussi production, transport.
- L.2312-8 (consultation, nouvelles technologies) : automatisation (seuil 50 salariés à écrire, sinon on annonce à une TPE une obligation qui ne la concerne pas), it, rh (information seule ou consultation : arbitrage laissé ouvert).
- L.1222-4 (dispositif de collecte porté à connaissance) : production, transport.
- L.1321-1 et s. / L.1321-4 (charte adossée au règlement intérieur) : juridique et séminaire — le régime ne vaut que pour une charte disciplinaire, distinction non tranchée.
- L.1221-6, L.1221-8, L.1132-1 : rh. Le nombre de critères de discrimination a été volontairement retiré (« 25 » n'est plus sûr) — liste à re-sourcer et dater.

*Sectoriel*
- Santé : art. 226-13 code pénal, L.1111-8 CSP (HDS), art. 9 RGPD. La « position écrite datée sur le secret partagé » doit être signée par un juriste — c'est la pièce qui tient toute l'animabilité de la journée.
- Immobilier : DPE (L.126-26 CCH), loi Carrez, loi Alur (L.721-1 CCH), arrêté honoraires du 10 janvier 2017, décret 2015-1437 (pièces locataires), art. 225-1/225-2 code pénal.
- Hôtellerie : règlement 1169/2011 annexe II **plus** décret 2015-447 pour les denrées non préemballées ; décrets origine des viandes ; « fait maison » (2014-797).
- BTP : art. 1792 code civil, mention d'assurance décennale sur devis, code de la commande publique — aucun n'est écrit dans le programme, à confirmer avant de les mettre au kit.
- Transport : règlement 561/2006, accord ADR.
- Achats : L.441-10 code de commerce — pénalité de retard de **paiement** légale vs pénalité de retard de **livraison** contractuelle, c'est la confusion à faire valider.
- Finance : mentions dues d'une relance d'impayé, montant en vigueur de l'indemnité forfaitaire — à ne pas laisser improviser en salle.
- Banque-assurance : interdiction absolue de révéler une déclaration de soupçon (qualification et périmètre des personnes tenues), droit à intervention humaine.
- Consommation : L.121-4 faux avis (marketing, commerce — vérifier le numéro d'item, ou ne citer que l'article) ; CPCE L.34-5 prospection, cas B2B non traité (marketing, commerciaux) ; code civil art. 9 droit à l'image (marketing).
- Commerce, secret des affaires : L.151-1 (commerciaux, achats).

*Documents à faire rédiger par un juriste, pas par le concepteur pédagogique*
Trames pré-rédigées remises aux participants : mention d'information des candidats et note au CSE (rh), articles types de charte (juridique, it), trois courriers-modèles achats (réserve, retard, non-conformité), formule de refus et position sur le secret partagé (santé), engagement de non-usage disciplinaire signé par l'employeur (séminaire).

*Deux corrections de code, hors fiches*
- `src/content/formations/catalog-v2-schedule.ts:50` — `sectionStartMin()` remet l'horloge à 9 h 00 (ou 14 h 00) au **début de chaque section**. Défaut confirmé sur le tree : les deux modules du matin s'afficheront tous deux à partir de 9 h 00. À corriger avant de publier le minutage. Précision : seule la chaîne exacte `"Pause"` fait avancer l'horloge de 15 min (ligne 73) — `"Pause (15')"` comme `"Pause — 15 minutes"` gèlent l'horloge et s'affichent verbatim, contrairement à ce qu'écrit l'alerte de banque-assurance.
- **Alerte obsolète, à ne pas traiter** : neuf fiches réclament la correction de `RATIO_PRATIQUE_PCT = 70` en dur. C'est **déjà fait** — `catalog-import.ts:202` appelle `ratioPratiqueDeclarable(programmeDetaille, f.duree)` et `ratio-pratique.ts:135` rend `null` si le programme ne porte pas de durées. Ces agents ont lu un tree ancien. Le point réel qui subsiste : tant que les durées ne sont pas saisies dans `catalog-v2.ts`, `Formation.ratioPratiquePct` vaut `null` et la publication est bloquée par `formations.ts:366`.

*Champs de catalogue bloquants pour l'animation (non juridiques)*
`materielFr` absent sur achats, btp, immobilier, commerce, hôtellerie, industrie, production — entre trois et six ateliers tombent par fiche si les participants arrivent sans leurs pièces réelles. Kits d'animation à produire avant la première session : automatisation, hôtellerie (8 pièces), it, juridique, achats, industrie. Déjeuner absent du programme signalé bloquant par hôtellerie, banque-assurance et transport.

---

## ia-pour-bien-commencer

240 min programmées · 152 min de pratique · **63 %**

**Livrable** : « Mes trois demandes AXION » — un feuillet recto-verso rempli par le participant en séance : ses trois demandes structurées, écrites, lancées et relancées au moins une fois pendant la formation, chacune accompagnée de la version de sortie qu'il a jugée réutilisable et de la correction qu'il a dû y apporter ; au verso, la tâche par laquelle il commence lundi et la personne à qui il pose ses questions. Complété par deux pièces remises : le mémo des cinq leviers AXION (Acteur, conteXte, Intention, Output, Normes) et la fiche « ce qui ne sort jamais, et pourquoi retirer le nom ne suffit pas ». Ce n'est ni un espace de travail persistant (rien à maintenir, rien à héberger, aucun outil à administrer) ni une bibliothèque de prompts (trois demandes propres au poste du participant, pas un catalogue générique) : c'est une production nominative, testée en salle, relançable telle quelle dès le lendemain.

**Corrections apportées**
- Minutage porté de 230' à 240' exactement (M1 87' pause comprise + M2 72' + M3 81'). Les 10 minutes en creux du passage précédent sont affectées à la pratique du M3 (30' → 40'), pas laissées en vide. Somme refaite trois fois à la main avant rendu.

> **À faire relire** — 1) RÉFÉRENCE JURIDIQUE À FAIRE RELIRE — le module 1 et le module 3 s'appuient sur l'obligation d'information du destinataire pour un contenu généré par IA. La base est l'article 50 du règlement (UE) 2024/1689 sur l'intelligence artificielle, dont les obligations de transparence s'appliquent à compter du 2 août 2026. J'ai volontairement écrit le programme SANS numéro d'article visible (formulation « le règlement européen sur l'IA impose d'informer le destinataire »), pour ne pas propager une référence non validée dans le programme Qualiopi opposable et dans les documents remis. À trancher : soit un juriste valide « article 50 » et on l'inscrit, soit on garde la formulation sans numéro. Rappel du contrôle : la même erreur a déjà été commise sur ia-pour-les-rh (L.1221-9 cité à la place de L.2312-38). 2) INCOHÉRENCE DÉCLARATIVE — src/server/qualiopi/formations/catalog-import.ts:67 écrit RATIO_PRATIQUE_PCT = 70 en dur et le pousse ligne 193 dans le programme déclaré. Cette fiche produit 63 %. Déclarer 70 % pour 63 % programmé est une non-conformité opposable, vérifiable en audit avec le programme public sous les yeux. Décision Will : faire dériver le ratio du programme, ou baisser la dé

### Programme

**Module 1 — Ce que l'IA sait faire, et ce qu'on ne lui confie jamais**

- `objectif` · **3 min** — Objectif du module : en sortant, vous décrivez en une phrase ce qu'une IA générative peut faire sur votre poste, vous citez trois informations que vous ne lui donnerez jamais, et vous savez que la même question posée avec un mot différent peut donner une réponse orientée
- `demonstration` · **12 min** — La machine ne sait pas, elle prédit — démonstration avant / après par le formateur, les deux DEMANDES affichées en entier à l'écran, sur l'outil unique de la demi-journée. Trame fournie dans le kit : (1) demande nue « Rédige un message pour annoncer un changement d'organisation », (2) même demande enrichie du contexte ; puis le geste du biais — on change UN SEUL mot de la demande (« Rédige le portrait d'un chef d'équipe efficace » → « d'une cheffe d'équipe efficace ») et la salle constate que la réponse change de camp. Aucune expertise métier requise : les deux couples de demandes sont écrits mot pour mot dans le guide d'animation
- `cadre` · **12 min** — Avant de toucher au moindre fichier : les trois régimes d'usage des données (compte grand public, offre entreprise avec engagement de non-réutilisation, environnement validé par votre entreprise), la liste de ce qui ne sort jamais, et pourquoi retirer le nom ne rend pas un document anonyme — un dossier reste identifiable par le croisement de ses autres éléments. Mention du règlement européen sur l'IA : les contenus générés diffusés à des tiers relèvent d'une obligation d'information (voir alerte de relecture juridique)
- `pratique` · **30 min** — Chasse à l'erreur et chasse au biais, chronométrée : chacun fait produire à l'IA un texte court sur son propre domaine, surligne ce qui est faux ou inventé et le compte ; puis relance la même demande en changeant un seul mot et note ce qui a bougé. C'est la salle qui corrige, pas le formateur — chacun est le seul expert de son sujet
- `verification` · **10 min** — Vérification corrigée en salle : huit situations « je peux le soumettre / je ne peux pas » (liste fournie, corrigés fournis), plus deux questions sur ce qui s'est passé pendant la chasse au biais
- `synthese` · **5 min** — Vos acquis : repérer une affirmation inventée · appliquer la liste de ce qui ne sort jamais · nommer le régime d'usage en vigueur chez vous
- `pause` · **15 min** — Pause

**Module 2 — Formuler sa demande : la méthode AXION**

- `objectif` · **3 min** — Objectif du module : en sortant, vous transformez une demande vague en demande structurée qui donne un texte utilisable dès le premier ou le deuxième essai
- `demonstration` · **12 min** — Les cinq leviers AXION — Acteur (à qui l'IA doit ressembler), conteXte (ce qu'elle ignore de votre situation), Intention (ce que le texte doit produire chez le lecteur), Output (format, longueur, ton attendus), Normes (ce qui est interdit, obligatoire, ou à ne pas inventer) — démontrés avant / après sur un même besoin, les deux demandes affichées en entier
- `pratique` · **10 min** — Déposer un document et travailler dessus : chacun dépose un fichier non sensible (PDF, export, photo d'une page) et demande à l'IA de le résumer. Les trois échecs typiques sont constatés en direct sur les machines de la salle : scan sans texte reconnu, fichier trop lourd, tableau qui se désaligne — et le contournement de chacun
- `pratique` · **30 min** — Pratique chronométrée : chacun écrit sa demande AXION sur une tâche de son poste, la lance, la relance une fois en ajoutant une seule précision au lieu de tout recommencer, et conserve la version qui marche
- `verification` · **12 min** — Vérification en binôme, grille des cinq leviers fournie : appliquée à la demande du voisin — quel levier manque, et qu'est-ce que ça change au résultat ? Restitution de trois binômes, corrigée en salle
- `synthese` · **5 min** — Vos acquis : nommer les cinq leviers · réécrire une demande vague · relancer avec une précision au lieu de tout recommencer

**Module 3 — Trois usages à emporter, et par quoi je commence lundi**

- `objectif` · **3 min** — Objectif du module : en sortant, vous repartez avec trois demandes écrites et testées, relançables telles quelles lundi matin, et vous savez ce que vous devez relire avant de diffuser quoi que ce soit
- `cadre` · **7 min** — Avant de produire quoi que ce soit de diffusable : ce qui doit être relu systématiquement (chiffres, noms, dates, citations, tout ce qui engage), ce qu'on indique au destinataire quand un écrit lui est adressé et qu'il a été rédigé avec l'IA, et le principe qui tranche tous les cas — l'IA prépare, l'humain décide et signe. Rappel de la liste du module 1 : l'atelier qui suit se fait sur des tâches réelles, pas sur des données interdites
- `demonstration` · **8 min** — Démonstration avant / après sur UNE seule tâche commune à tous les postes : l'e-mail difficile (annoncer un retard à un client). La demande AXION est affichée en entier et lue à voix haute, puis les deux sorties sont comparées ligne à ligne
- `pratique` · **40 min** — Atelier chronométré : chacun traite deux vraies tâches de son poste en appliquant AXION et la règle de ce qui ne sort jamais, relance chaque demande au moins une fois, et retient les versions qui marchent — le formateur circule et ne corrige que la formulation de la demande, jamais le fond métier
- `verification` · **15 min** — Évaluation des acquis corrigée en salle : quiz individuel de 10 questions (corrigé fourni), puis relecture par chacun de sa propre production à la grille fournie — exactitude, ton, structure, réutilisable tel quel — et note de ce qu'il doit encore corriger avant de s'en servir
- `pratique` · **5 min** — Chacun met au propre sa troisième demande et remplit le verso de son feuillet : la tâche par laquelle je commence lundi, et la personne à qui je pose mes questions
- `synthese` · **3 min** — Vos acquis : écrire une demande AXION sur une tâche de son poste · relancer plutôt que recommencer · relire et signaler avant de diffuser

---

## ia-pour-bien-commencer-journee

420 min programmées · 255 min de pratique · **61 %**

**Livrable** : « Mon protocole de poste — ce qui entre, ce qui sort, comment je le vérifie » : un document de deux pages rempli par le participant en séance, sur une trame fournie au formateur, qui contient (1) le régime d'usage identifié pour son poste, (2) sa liste « ce qui ne sort jamais » écrite sur ses propres dossiers, (3) sa grille de relecture en cinq points, calibrée sur ce qu'il a réellement produit dans la journée, (4) la mention qu'il portera au destinataire d'un écrit produit avec l'IA, (5) sa feuille de route à sept jours. Remis avec le mémo des cinq leviers AXION et la fiche « retirer le nom ne rend pas un document anonyme ». Ce n'est ni un espace de travail persistant (livrable de ia-pour-les-equipes, ia-pour-l-automatisation et du séminaire) ni une bibliothèque de prompts (livrable de quinze fiches) : c'est un artefact de CONTRÔLE, pas de production — il ne contient aucune demande réutilisable, il dit ce que le participant s'autorise à faire entrer dans l'outil et ce qu'il vérifie avant d'envoyer.

**Corrections apportées**
- Les 65 minutes non programmées sont comblées : 355 → 420 minutes exactement (M1 110 + pause 15 + M2 103 + M3 93 + pause 15 + M4 84). Somme refaite séquence par séquence, deux fois.

> **À faire relire** — RÉFÉRENCES JURIDIQUES À FAIRE RELIRE avant publication — la séquence « cadre » de 12 minutes du module 1 s'appuie sur quatre obligations du règlement (UE) 2024/1689 sur l'IA, citées dans le texte SANS numéro d'article (choix délibéré : un formateur non juriste ne doit pas énoncer d'article au tableau). Les numéros ci-dessous ne figurent donc pas dans la fiche mais fondent la trame et doivent être validés par le conseil juridique avant de partir en support d'animation : (1) obligation faite au fournisseur ET au déployeur d'assurer un niveau suffisant de littératie en IA de leur personnel — art. 4, applicable depuis le 2 février 2025 ; (2) pratiques interdites, dont la reconnaissance des émotions sur le lieu de travail — art. 5, applicable depuis le 2 février 2025 ; (3) classement en haut risque du recrutement, de la sélection de candidats et du suivi/évaluation des salariés — annexe III, points 4 a) et b) ; (4) obligation de transparence sur les contenus générés par IA — art. 50, dont l'entrée en application est la plus récente du lot et doit être vérifiée à date. Point RGPD à valider également : la formule employée en séance est « retirer le nom ne rend pas un document anonyme, cel

### Programme

**Matin — Module 1 : Le cadre avant les mains sur le clavier — ce que fait l'IA, où vont vos données, ce que la loi impose**

- `objectif` · **3 min** — Objectif du module : en sortant, vous décrivez ce qu'une IA générative fait bien, et vous savez, AVANT chaque usage, où vont les informations que vous lui donnez et ce que vous n'avez pas le droit de lui confier
- `demonstration` · **10 min** — Comment ça marche sans jargon, et pourquoi elle a l'air sûre d'elle quand elle invente — démonstration avant / après sur l'outil unique de la journée, les deux demandes affichées en entier à l'écran
- `cadre` · **12 min** — Les trois régimes d'usage : compte grand public, offre entreprise avec engagement de non-réutilisation, environnement validé par votre entreprise — et les trois questions à poser pour savoir dans lequel vous êtes (grille fournie au formateur)
- `cadre` · **10 min** — Ce qui ne sort jamais : la liste écrite, et pourquoi retirer le nom ne rend pas un document anonyme — démonstration de ré-identification à partir d'un compte rendu « anonymisé » préparé (pseudonymiser reste un traitement de données personnelles)
- `cadre` · **12 min** — Ce que le règlement européen sur l'IA change pour vous : l'obligation faite à l'employeur de vous former, les usages interdits au travail (dont la reconnaissance des émotions des salariés), les usages classés à haut risque que cette journée n'autorise pas — trier des candidatures, noter ou surveiller des collègues — et l'obligation d'indiquer un contenu généré par IA. Trame de 6 diapositives fournie, aucune expertise juridique requise du formateur
- `demonstration` · **8 min** — Le biais, vu en direct : la même demande rejouée en changeant UN SEUL mot (le prénom, le quartier, l'âge) et la réponse qui change de camp — les deux demandes et les deux réponses affichées en entier, côte à côte
- `pratique` · **40 min** — Pratique chronométrée : chacun fait produire un texte sur son propre domaine, surligne ce qui est faux, le compte, redemande à l'IA de justifier chaque affirmation ; puis rejoue sa demande en changeant un seul mot et note ce qui bascule dans la réponse
- `verification` · **10 min** — Vérification corrigée en salle : douze situations réelles à classer « ça part / ça ne part pas / ça ne part qu'en environnement validé » — jeu de cartes fourni avec le corrigé
- `synthese` · **5 min** — Vos acquis : nommer le régime d'usage de mon poste · repérer une affirmation inventée et la faire justifier · appliquer la liste de ce qui ne sort jamais
- `pause` · **15 min** — Pause

**Matin — Module 2 : Formuler et relancer jusqu'au résultat utilisable (méthode AXION)**

- `objectif` · **3 min** — Objectif du module : en sortant, vous obtenez au premier ou au deuxième essai un texte que vous pouvez envoyer après relecture
- `demonstration` · **15 min** — Les cinq leviers AXION — Acteur, conteXte, Intention, Output, Normes — démontrés avant / après sur un besoin apporté par la salle : la demande spontanée, puis la demande outillée, toutes deux affichées en entier
- `demonstration` · **8 min** — Relancer plutôt que recommencer : les quatre relances qui débloquent — préciser la contrainte, donner un exemple de sortie attendue, imposer le format, faire critiquer sa propre réponse — les quatre formulations affichées en entier
- `pratique` · **40 min** — Pratique chronométrée n°1 : chacun écrit sa demande AXION sur une tâche réelle de son poste, la lance, la relance deux fois avec deux relances différentes, conserve la version qui marche et note en une ligne ce qui l'a débloquée
- `pratique` · **20 min** — Pratique chronométrée n°2, sans accompagnement au tableau : même méthode sur une seconde tâche, en autonomie — le formateur circule et ne répond qu'aux blocages
- `verification` · **12 min** — Vérification croisée en binôme : le voisin rejoue votre demande telle qu'elle est écrite — obtient-il un résultat comparable, et les cinq leviers y sont-ils tous présents ? Chacun coche la grille des cinq leviers sur la demande de l'autre
- `synthese` · **5 min** — Vos acquis : structurer une demande en cinq leviers · choisir la relance qui débloque plutôt que tout réécrire · reconnaître une demande qui ne marchera jamais

**Après-midi — Module 3 : Travailler sur ses documents, dicter, vérifier contre la source**

- `objectif` · **3 min** — Objectif du module : en sortant, vous déposez un document dans l'outil, vous en tirez une synthèse que vous savez vérifier ligne à ligne, et vous produisez une note propre à partir d'une dictée
- `cadre` · **8 min** — Avant de déposer quoi que ce soit : quels documents ont le droit d'entrer selon le régime d'usage identifié ce matin — relecture de la liste « ce qui ne sort jamais », appliquée cette fois aux pièces jointes, aux photos d'écran et aux exports de tableur
- `demonstration` · **12 min** — Démonstration avant / après : le même document long résumé par une demande vague puis par une demande AXION, les deux affichées en entier — et les trois cas où le dépôt échoue en silence (scan sans texte reconnu, fichier trop lourd tronqué sans le dire, tableau qui se désaligne)
- `pratique` · **30 min** — Pratique chronométrée : chacun dépose un document autorisé de son poste, en tire une synthèse, puis pose trois questions précises au document et note les réponses
- `pratique` · **20 min** — Pratique chronométrée : dictée depuis le téléphone — deux minutes de dictée, transformation en note propre, puis second passage sur un compte rendu de réunion ; chacun repart avec deux notes produites sans clavier
- `verification` · **15 min** — Vérification corrigée en salle : sur la synthèse du voisin, retrouver dans le document source chaque affirmation — combien tiennent, lesquelles ont été ajoutées par l'outil ; report du décompte sur la grille remise
- `synthese` · **5 min** — Vos acquis : déposer un document autorisé et l'interroger · vérifier une synthèse contre sa source avant de la transmettre · produire un écrit à partir d'une dictée
- `pause` · **15 min** — Pause

**Après-midi — Module 4 : Ce qui sort de vos mains — mon protocole de vérification et de diffusion**

- `objectif` · **3 min** — Objectif du module : en sortant, vous disposez d'un protocole écrit, propre à votre poste, qui dit ce que vous confiez à l'IA et ce que vous vérifiez avant d'envoyer
- `demonstration` · **8 min** — Démonstration avant / après : la même production relue « à l'œil » puis passée à la grille en cinq points (exactitude, ton, format, source, réutilisable tel quel) — les deux relectures affichées en entier ; ce qu'on indique au destinataire quand un écrit a été produit avec l'IA, et le principe qui tranche : l'IA prépare, l'humain décide et signe
- `pratique` · **30 min** — Pratique chronométrée : chacun remplit son protocole de poste sur la trame fournie — son régime d'usage, sa liste « ce qui ne sort jamais » écrite sur ses propres dossiers, sa grille de relecture en cinq points calibrée sur ce qu'il a produit aujourd'hui, la mention au destinataire
- `verification` · **12 min** — Évaluation des acquis : quiz individuel de 12 questions, corrigé en salle question par question
- `verification` · **11 min** — Vérification par la production : chacun relit une de ses productions du jour à SA propre grille, note les points corrigés, et le voisin contrôle que la grille a bien été appliquée
- `pratique` · **15 min** — Feuille de route écrite dans le protocole : les trois usages que je relance cette semaine et à quel moment, ce que je ne ferai pas, à qui je pose mes questions quand je bloque
- `synthese` · **5 min** — Vos acquis : écrire ce que je confie à l'IA et ce que je ne lui confie pas · relire une production à une grille avant de l'envoyer · relancer trois usages seul dès lundi — et remise du protocole de poste

---

## ia-pour-les-equipes

420 min programmées · 254 min de pratique · **60 %**

**Livrable** : « Le mode d'emploi IA du service » — un document écrit par l'équipe pendant la journée, signé de tous, qui contient : la liste « ce qui ne sort jamais » arbitrée cas par cas en séance ; les trois demandes AXION éprouvées par un autre participant que leur auteur ; la procédure de production en série avec son contrôle par échantillon ; le tableau « qui relit quoi, qui tranche en cas de doute » ; les quatre points de contrôle avant diffusion ; et la feuille de route des trois usages tenus la semaine suivante avec le nom de celui qui relance. Ce n'est ni un espace de travail persistant (livrable de ia-pour-bien-commencer-journee, ia-pour-l-automatisation et du séminaire) ni une bibliothèque de prompts (livrable de quinze fiches) : c'est une règle de fonctionnement collective, avec des personnes nommées en face de chaque ligne. Le relevé des temps chronométrés n'y figure pas — il reste au participant.

**Corrections apportées**
- MAJEUR corrigé — les 77 minutes non programmées sont comblées : 343 min → 420 min exactement. Matin 210 min (M1 100 + pause 15 + M2 95), après-midi 210 min (M3 100 + pause 15 + M4 95). Le repas ne figure plus dans le programme et n'est pas compté. Addition refaite séquence par séquence.
- MAJEUR corrigé — ratio de pratique porté de 41,4 % à 60 % (254 min de pratique et de vérification sur les 420 min dues). Les 77 minutes récupérées sont allées intégralement en pratique et en vérification, aucune en exposé. Le M1, qui traitait quatre sujets de cadre en 17 minutes, passe à 35 minutes de cadre (20 + 15).
- MAJEUR corrigé — fragilité du ratio levée : le contrôle notait que 20 min de la pratique du M1 étaient un chronométrage SANS IA. Ce temps est ramené à 15 min et, même en l'écartant entièrement, le ratio reste à 56,9 %, au-dessus du seuil de 50 %.
- MAJEUR corrigé — livrable rendu distinct : plus aucun « espace de travail », plus aucune « bibliothèque de prompts ». Le livrable devient « Le mode d'emploi IA du service », un document écrit par l'équipe, qui n'existe sur aucune autre fiche du lot.
- MINEUR corrigé — le relevé des temps mesurés sort du livrable. Le chronométrage devient un repère personnel, explicitement non remis au client, pour que le dirigeant ne le lise pas comme un taux de gain. La séquence prévoit le cas où l'écart mesuré est nul ou négatif.
- MINEUR corrigé — animabilité du module 3 : le tableau d'exemple, la demande AXION de série pré-écrite et les trois exercices tableur avec leur corrigé sont fournis dans le guide. La séquence ne dépend plus du niveau tableur du formateur. Idem pour les dix situations du M1 et le jeu de contrôle par échantillon du M3.
- MINEUR corrigé — le module 4 porte désormais un bloc synthèse « Vos acquis » (5 min), comme les trois autres, et sa démonstration est devenue un avant/après avec les deux demandes affichées en entier.
- Garde-fous entièrement remontés avant tout atelier : les trois régimes d'usage, la démonstration de ré-identification, le biais montré en direct, le règlement européen sur l'IA et le principe « l'IA prépare, l'humain décide » occupent les 35 premières minutes utiles, avant que quiconque ait ouvert l'outil.
- Deux séquences de type cadre créées au M1 (20 min + 15 min) pour porter les règles et limites, distinctes des séquences d'exposé. Le cadre du M4 (10 min) est opérationnel — les quatre points de contrôle avant diffusion — et ne redit pas celui du matin.
- Biais et règlement européen sur l'IA nommés dans le programme lui-même, et non plus seulement dans les justifications : le contrôle avait relevé sur la fiche voisine que la référence disparaissait là où le formateur et l'auditeur la cherchent.
- Un outil unique tenu toute la journée est inscrit dans les quatre démonstrations, conformément au standard.
- Les cinq leviers AXION sont écrits en toutes lettres — Acteur, conteXte, Intention, Output, Normes — dans le titre de la démonstration du module 2.

> **À faire relire** — 1) RÉFÉRENCE JURIDIQUE À FAIRE RELIRE — la séquence cadre de 15 min du module 1 s'appuie sur le règlement (UE) 2024/1689 sur l'IA, art. 50 (transparence des contenus produits par IA, applicable depuis le 2 août 2026). Attention : l'art. 50 ne vise PAS tout écrit assisté par IA. Pour un déployeur, il cible les contenus de synthèse et les textes publiés pour informer le public sur des sujets d'intérêt général. J'ai donc rédigé la séquence en distinguant « ce que la loi impose de signaler » de « ce que l'entreprise décide de signaler par règle interne ». Le formulation exacte du support doit être relue par un juriste avant génération des documents : une extension abusive de l'art. 50 partirait dans le programme officiel opposable en audit. La démonstration de ré-identification s'appuie sur l'art. 4(5) du RGPD (la pseudonymisation reste un traitement de données personnelles) — cette référence-là est exacte, mais à confirmer aussi.
2) ARBITRAGE COMMERCIAL — le prérequis reste à trancher. La fiche vise « des collaborateurs qui utilisent déjà l'IA » et le module 2 attaque AXION en version poussée dès 10 h, mais aucun prerequisFr n'est déclaré : la fiche affiche « aucun prérequis », comme 

### Programme

**Matin — Module 1 : le cadre commun avant de toucher à quoi que ce soit**

- `objectif` · **5 min** — Ce que vous saurez faire à midi : nommer le régime d'usage de chacun de vos documents, appliquer la liste commune de l'équipe, et dire ce qui doit être signalé au destinataire
- `cadre` · **20 min** — Où passent vos données : les trois régimes d'usage (compte grand public, offre entreprise avec engagement de non-réutilisation, environnement validé par votre informatique) — et pourquoi retirer un nom ne rend pas un document anonyme : ré-identification montrée en direct sur le fichier de suivi fourni
- `cadre` · **15 min** — Les limites à connaître avant d'ouvrir l'outil : le biais montré en direct (un seul mot changé dans la demande, le résultat bascule — les deux demandes affichées en entier) ; ce que le règlement européen sur l'IA impose de signaler au destinataire et ce qui relève de la règle interne ; et ce qui reste une décision humaine
- `demonstration` · **15 min** — Avant / après sur un cas apporté par la salle : la demande vague puis la demande travaillée, les deux affichées en entier, sur l'outil unique tenu toute la journée
- `pratique` · **15 min** — Chacun réalise une tâche récurrente de sa semaine comme d'habitude, sans IA, en notant son temps et ses allers-retours — repère personnel de comparaison, gardé par le participant, jamais remis au client (l'écart mesuré peut être nul, c'est une information utile)
- `verification` · **25 min** — Arbitrage collectif des dix situations fournies, tranchées une par une : ce qui peut sortir, ce qui ne sort qu'en régime entreprise, ce qui ne sort jamais — la liste de l'équipe est écrite au tableau et entre au livrable
- `synthese` · **5 min** — Vos acquis : je nomme le régime d'usage de chacun de mes documents · j'applique la liste commune du service · je repère une demande qui introduit un biais
- `pause` · **15 min** — Pause

**Matin — Module 2 : AXION poussé — contrainte, exemple de sortie, format imposé**

- `objectif` · **3 min** — En sortant de ce module, vous obtenez un résultat au format exact attendu, sans passer dix minutes à le retoucher
- `demonstration` · **15 min** — Les cinq leviers AXION — Acteur, conteXte, Intention, Output, Normes — poussés : contrainte chiffrée, exemple de sortie fourni, format imposé, critères de refus. Avant / après, les deux demandes affichées en entier, même outil
- `pratique` · **35 min** — Chacun refait la tâche chronométrée du module 1 avec une demande AXION complète, et la retouche jusqu'à obtenir le format exact attendu — puis conserve la version qui marche
- `pratique` · **20 min** — Deuxième tour : ajouter les critères de refus, faire critiquer la sortie par l'outil lui-même, puis corriger soi-même ce que la critique a laissé passer
- `verification` · **17 min** — Contrôle croisé en binôme : le voisin rejoue votre demande sur son propre cas, sans le contexte de son auteur — ce qui ne tient pas est réécrit sur place. C'est le test d'une demande vraiment transmissible
- `synthese` · **5 min** — Vos acquis : imposer un format · fournir un exemple de sortie · reconnaître une demande qui ne se transmet pas à un collègue

**Après-midi — Module 3 : passer d'un cas à toute une série**

- `objectif` · **3 min** — En sortant de ce module, vous produisez une série de documents homogènes à partir d'un tableau, au lieu de les écrire un par un — et vous savez la contrôler
- `demonstration` · **15 min** — Avant / après : le même document écrit une fois à la main, puis quinze fois à partir du tableau fourni — demande de série affichée en entier, et ce qui casse quand la série grandit
- `pratique` · **30 min** — Chaque binôme produit une série de quinze documents à partir du tableau fourni (ou du sien s'il ne contient aucune donnée personnelle), en partant de la demande AXION de série pré-écrite du guide d'animation
- `pratique` · **22 min** — Tableur assisté : les trois exercices fournis avec leur corrigé — faire écrire une formule, faire expliquer un croisement, décrire une structure de données — sans jamais coller les données elles-mêmes
- `verification` · **25 min** — Contrôle par échantillon : trois exemplaires tirés au hasard (même format, mêmes mentions obligatoires), puis une erreur est glissée dans la série du binôme voisin — l'échantillon la retrouve-t-il ?
- `synthese` · **5 min** — Vos acquis : produire une série homogène · contrôler par échantillon · repérer l'erreur qui se duplique quinze fois
- `pause` · **15 min** — Pause

**Après-midi — Module 4 : écrire le mode d'emploi commun et la suite**

- `objectif` · **3 min** — En sortant, le service dispose d'un mode d'emploi écrit que chacun a validé, et sait qui relit quoi
- `demonstration` · **12 min** — Avant / après : la même demande envoyée seule, puis accompagnée des documents de référence du service et des consignes communes — les deux sorties comparées à l'écran, demandes affichées en entier
- `cadre` · **10 min** — Les quatre points de contrôle avant qu'un document parte : tout chiffre, tout nom propre, toute date, tout engagement pris au nom de l'entreprise — et qui tranche quand il y a doute
- `pratique` · **35 min** — L'équipe rédige son mode d'emploi commun : la liste « ce qui ne sort jamais » du matin, les trois demandes AXION éprouvées par un autre que leur auteur, la procédure de série et son contrôle par échantillon, et le tableau « qui relit quoi, qui tranche »
- `verification` · **15 min** — Évaluation des acquis : quiz individuel de 10 questions corrigé en salle, puis relecture croisée d'une production du jour à la grille commune (exactitude, ton, format, réutilisable par un collègue)
- `pratique` · **15 min** — Feuille de route inscrite au mode d'emploi : les trois usages que l'équipe tient la semaine prochaine, ce qu'elle ne fera pas, qui relance, et ce qui remonte à la direction
- `synthese` · **5 min** — Vos acquis : appliquer la règle commune écrite · faire relire par la bonne personne · relancer un usage sans attendre une nouvelle formation

---

## ia-pour-l-automatisation

840 min programmées · 520 min de pratique · **62 %**

**Livrable** : Le dossier d'exploitation de l'automatisation — un dossier constitué par le participant lui-même au fil des deux jours et remis complet à la fin, qui contient : (1) sa grille de qualification feu vert / feu orange / feu rouge, une ligne par tâche répétitive avec la conséquence tirée en clair ; (2) sa fiche de cadrage annotée par le binôme relecteur ; (3) l'automatisation construite et son journal de tests — trois jeux d'entrées, les écarts relevés, les corrections apportées ; (4) sa fiche d'usage (à quoi ça sert, sur quelles données, qui relit, quand on l'arrête, quelle information est due et à qui), contresignée par le binôme qui a réussi à la reprendre sans son auteur ; (5) sa feuille de route des automatisations suivantes, ordonnée, avec porteur et échéance. Il se distingue de l'« espace de travail persistant » et de la « bibliothèque de prompts » employés ailleurs au catalogue : ce n'est ni un contenant d'outil ni une collection de textes, c'est la documentation d'exploitation d'un objet qui tourne — la contresignature du binôme en est la preuve, et c'est la seule pièce du catalogue qui rende une réalisation reprenable par un tiers.

**Corrections apportées**
- MAJEUR — ratio sous le plancher corrigé : 460 min réelles (54,8 %) portées à 520 min (61,9 %, arrondi 62 %). Les 44 min manquantes ont été prises sur du descendant, pas ajoutées : « Avec quoi on va construire » passe de 25' descendant à 15' de cadre + 20' d'atelier de choix d'outil ; « Avant la mise en service » passe de 25' descendant à 35' de rédaction de la fiche d'usage sur trame fournie ; la « Feuille de route » (40') est ramenée à 25' et n'est PLUS comptée comme pratique dans le calcul — le compte de 520 ne repose que sur des séquences typées pratique ou verification.
- MAJEUR — démonstration avant/après désormais présente dans les 4 demi-journées. Ajout en Après-midi J1 (20' : une fiche de cadrage bâclée puis la même cadrée, prompt affiché en entier) et en Après-midi J2 (20' : la même automatisation sans point de relecture, la sortie fausse qui part au client, puis avec le contrôle qui l'intercepte). Les deux existantes (Matin J1, Matin J2) sont conservées.
- MAJEUR — animabilité de la construction guidée (55', Matin J2). Un cas de repli commun, pré-monté et fourni dans le kit, est désormais nommé dans l'intitulé : le participant dont le cas ne démarre pas bascule dessus sans immobiliser le formateur. Les familles d'outils autorisées en atelier sont bornées à l'assistant conversationnel et à l'espace persistant ; le chaînage entre applications reste en démonstration et n'est jamais monté en salle. La règle est posée en Après-midi J1 (15' de cadre), donc avant l'atelier.
- MAJEUR — animabilité du feu tricolore (35', Matin J1). Les six automatisations à classer et leur corrigé écrit mot pour mot sont fournis dans le kit d'animation : le formateur lit le corrigé, il ne tranche pas une qualification juridique en direct. L'intitulé le dit explicitement pour que le guide d'animation généré le reprenne.
- MINEUR — les textes sont remontés du commentaire dans le programme lui-même : art. 22 et art. 35 du RGPD, art. 4(5) du RGPD (pseudonymisation), art. L.2312-8 II 4° du Code du travail, annexe III §4(b) et art. 50 du règlement européen sur l'IA sont nommés dans les séquences 7 (Matin J1) et 5 (Après-midi J2). C'est le programme qui alimente le site, la déclaration Qualiopi et les documents générés.
- MINEUR — prerequisFr durci et livré avec la révision, pas renvoyé hors programme. Rédaction proposée : « Aucune compétence en programmation n'est demandée. En revanche, chaque participant vient avec une tâche qu'il refait au moins une fois par semaine, dont il connaît les règles et à laquelle il a accès pendant la formation, et il dispose d'un compte actif sur l'outil retenu ainsi que du droit d'y déposer les fichiers concernés. Un participant sans cas réel ni accès travaillera sur le cas de repli fourni, avec un bénéfice moindre. »
- MINEUR — livrable renommé et redéfini : « Le dossier d'exploitation de l'automatisation ». Il n'est plus intitulé par le contenant (« espace de travail persistant », qui est partagé par trois autres fiches du lot) mais par ce qui lui est propre — la fiche de qualification feu tricolore, la fiche d'usage contresignée et le journal de tests.
- CONSERVÉ — le minutage en 4 demi-journées de 210 min (pauses comprises, déjeuner exclu) et l'ordonnancement des garde-fous en Matin J1, avant la première cartographie et avant toute conception, que le contrôle a relevés comme les deux points exemplaires de la fiche. Le jour 1 reste exploitable seul, avec son propre livrable de sortie.
- AJOUTÉ — le geste de reprise : la vérification de l'Après-midi J2 (25') est un test de reprise à blanc, le binôme doit faire tourner l'automatisation du voisin sans son auteur. C'est la seule preuve que la fiche d'usage est suffisante.

> **À faire relire** — RÉFÉRENCES JURIDIQUES À FAIRE RELIRE — cinq textes sont désormais nommés dans le programme, donc dans le programme Qualiopi opposable, sur la page publique et dans les documents générés. Vérification faite de mon côté, mais à contrôler par un juriste avant publication : (1) art. 22 du RGPD — décision fondée exclusivement sur un traitement automatisé produisant des effets juridiques ou affectant significativement la personne : correspond bien au cas « décide sans relecture humaine et produit un effet sur une personne » ; (2) art. 4(5) du RGPD — définition de la pseudonymisation, correspond bien au fait qu'un fichier dont on retire les noms reste un traitement de données personnelles ; (3) art. 35 du RGPD — analyse d'impact relative à la protection des données ; (4) art. L.2312-8 II 4° du Code du travail — consultation du CSE sur l'introduction de nouvelles technologies : ATTENTION, l'obligation ne vaut que pour les entreprises d'au moins 50 salariés, ce que la séquence de 20' et la trame doivent dire, faute de quoi on annonce à une TPE une obligation qui ne la concerne pas ; (5) annexe III §4(b) et art. 50 du règlement européen sur l'IA, applicables depuis le 2 août 2026 (date confi

### Programme

**Matin — Jour 1 : ce qu'on peut automatiser, et ce qu'on n'automatise jamais**

- `objectif` · **10 min** — Objectif du matin : à midi, vous savez trier vos tâches répétitives et écarter celles que vous n'avez pas le droit d'automatiser
- `demonstration` · **20 min** — Démonstration avant/après : la compilation hebdomadaire d'un tableau de suivi, d'abord à la main puis pilotée par l'IA — un seul outil à l'écran, prompt affiché en entier, c'est cet outil et lui seul pour les deux jours
- `cadre` · **20 min** — Où passent vos données : les trois régimes d'usage (compte grand public, offre entreprise avec engagement de non-réutilisation, environnement validé par votre informatique) et le geste à faire avant de coller quoi que ce soit
- `pratique` · **20 min** — Pratique : chacun situe le régime dans lequel il travaille réellement aujourd'hui, et écrit ce qu'il faudrait obtenir, de qui, pour passer au régime supérieur
- `pause` · **15 min** — Pause
- `cadre` · **15 min** — Pseudonymiser n'est pas anonymiser : ré-identification en direct d'un fichier de suivi « anonymisé » fourni dans le kit, et pourquoi un fichier dont on a retiré les noms reste un traitement de données personnelles au sens de l'art. 4(5) du RGPD — et un document sous clause de confidentialité reste confidentiel
- `cadre` · **20 min** — Le test de qualification en 4 questions et les textes qui le fondent : données personnelles ? effet sur une personne ? décision sans relecture humaine (art. 22 du RGPD) ? suivi de l'activité de salariés (annexe III §4(b) du règlement européen sur l'IA, applicable depuis le 2 août 2026) ? — avec ce que chaque réponse déclenche : information des salariés, consultation du CSE (art. L.2312-8 II 4° du Code du travail), analyse d'impact (art. 35 du RGPD), ou arrêt pur et simple. Grille imprimée fournie
- `pratique` · **45 min** — Pratique : chacun passe ses propres tâches répétitives au test des 4 questions et remplit la grille, une ligne par tâche, avec la conséquence tirée en clair
- `verification` · **35 min** — Vérification : chaque table classe en feu vert / feu orange / feu rouge les six automatisations fournies dans le kit, puis justifie ; correction en plénière au corrigé écrit mot pour mot du guide d'animation — le formateur lit le corrigé, il ne tranche rien en direct
- `synthese` · **10 min** — Synthèse : trois acquis formulés en actions, et remise de la fiche « feu vert / feu orange / feu rouge » qui fait règle pendant les deux jours

**Après-midi — Jour 1 : cartographier ses tâches et cadrer son cas**

- `objectif` · **10 min** — Objectif de l'après-midi : sortir avec un cas écrit, cadré, et passé au feu vert du matin
- `demonstration` · **20 min** — Démonstration avant/après : une fiche de cadrage bâclée (« automatiser le reporting ») puis la même cadrée entrée par entrée — prompt de description du processus affiché en entier, et ce que l'IA produit dans les deux cas
- `pratique` · **45 min** — Pratique : chacun cartographie les tâches qu'il refait chaque semaine sur la trame fournie (volume, répétition, stabilité des règles, coût de l'erreur) et en retient trois candidates
- `pause` · **15 min** — Pause
- `cadre` · **15 min** — Avec quoi on va construire : les trois familles d'outils (assistant conversationnel, espace de travail persistant, chaînage entre applications) et la règle des ateliers de demain — on construit avec les deux premières, le chaînage entre applications reste en démonstration et n'est jamais monté en salle
- `pratique` · **20 min** — Pratique : chacun confronte ses trois candidates à la fiche comparative fournie et retient l'outil de sa journée de demain, ou bascule sur le cas de repli commun pré-monté si aucun de ses cas n'est accessible
- `pratique` · **50 min** — Pratique : rédiger la fiche de cadrage de son cas — entrée, étapes, sortie attendue, point de relecture humaine, qui relit, régime de données retenu, outil visé, couleur au feu tricolore
- `verification` · **25 min** — Vérification : passage en binôme avec la grille de faille fournie — donnée personnelle oubliée, contrôle absent, sortie invérifiable, salarié suivi sans le savoir, règle instable ; chaque fiche repart annotée
- `synthese` · **10 min** — Synthèse de la journée 1, ce que chacun rapporte demain (fichiers, accès, jeux d'entrées) et ce qui se passe si la seconde journée est reportée

**Matin — Jour 2 : construire le prototype**

- `objectif` · **10 min** — Objectif du matin : à midi, votre automatisation tourne sur un vrai jeu d'entrées
- `demonstration` · **25 min** — Démonstration avant/après : la même tâche montée de bout en bout devant la salle — l'instruction qui pilote l'automatisation écrite avec les cinq leviers AXION (Acteur, conteXte, Intention, Output, Normes), prompt affiché en entier, les deux essais ratés montrés et corrigés à l'écran
- `cadre` · **15 min** — Alimenter l'automatisation : déposer un fichier, coller un export, photographier un document — et les trois raisons pour lesquelles ça échoue en salle (PDF scanné sans texte reconnu, fichier trop lourd, tableau qui se désaligne à la copie), avec le contournement de chacune
- `pratique` · **55 min** — Pratique : construction guidée pas à pas du prototype, sur le cas cadré la veille — ou sur le cas de repli commun pré-monté fourni dans le kit pour qui bloque, afin que personne n'immobilise la salle
- `pause` · **15 min** — Pause
- `pratique` · **45 min** — Pratique : faire tourner son prototype sur trois jeux d'entrées différents, dont un volontairement bancal (ligne vide, date au mauvais format, colonne manquante), et consigner chaque écart dans le journal de tests
- `verification` · **30 min** — Vérification : chasse à l'erreur — chacun surligne dans sa propre sortie ce qui est faux, inventé ou invérifiable, et compte ; les comptes sont mis en commun au tableau et la salle nomme les trois erreurs les plus fréquentes
- `synthese` · **15 min** — Synthèse : ce qui a marché du premier coup, ce qui a demandé trois essais, ce qui ne passera jamais et pourquoi

**Après-midi — Jour 2 : fiabiliser, mettre en service, décider de la suite**

- `objectif` · **10 min** — Objectif de l'après-midi : rendre votre automatisation reprenable par quelqu'un d'autre que vous
- `demonstration` · **20 min** — Démonstration avant/après : la même automatisation sans point de relecture — la sortie fausse part au client — puis avec le contrôle qui l'intercepte ; l'instruction de contrôle affichée en entier
- `pratique` · **40 min** — Pratique : poser les quatre contrôles sur son propre prototype à partir de la grille fournie — le point de relecture humaine, le comportement en cas de sortie anormale, le signal d'alerte, la trace de qui a validé quoi et quand
- `pause` · **15 min** — Pause
- `pratique` · **35 min** — Pratique : rédiger la fiche d'usage sur la trame fournie (à quoi ça sert, sur quelles données, qui relit, quand on l'arrête) et l'information due — salariés concernés, consultation du CSE au titre de l'art. L.2312-8 II 4° du Code du travail, et obligation de transparence de l'art. 50 du règlement européen sur l'IA, dont la trame rappelle le périmètre exact
- `verification` · **25 min** — Vérification : test de reprise à blanc — le binôme fait tourner l'automatisation du voisin avec sa seule fiche d'usage, sans son auteur ; toute question posée à l'auteur est notée comme un manque à combler, puis la fiche est contresignée
- `verification` · **25 min** — Évaluation des acquis : quiz individuel de validation (10 questions) et grille d'auto-évaluation du prototype (contrôle humain, traçabilité, régime de données, reprenabilité, couleur au feu tricolore) ; corrigé commenté en salle
- `pratique` · **25 min** — Pratique : la feuille de route — chacun classe ses prochaines automatisations au feu tricolore, les met en ordre, nomme un porteur et une échéance pour chacune, et isole ce qui doit remonter à la direction ou au CSE avant d'être lancé
- `synthese` · **15 min** — Synthèse des deux jours et remise du dossier d'exploitation

---

## seminaire-ia-toute-l-entreprise-1j

420 min programmées · 235 min de pratique · **56 %**

**Livrable** : Le classeur de bord IA de l'entreprise — un classeur constitué page par page par les tables pendant la journée, et remis complet en fin de séance : en tête l'engagement de non-usage disciplinaire signé par la direction ; la page des trois règles communes arbitrées et écrites au tableau ; une fiche par service (tâches lourdes, temps hebdomadaire, usages IA déjà en place) ; les deux demandes AXION écrites, testées et corrigées par chaque table, avec la grille de leviers manquants remplie par la table voisine ; l'astuce d'un autre service transposée en version diffusable, rangée dans sa famille de tâches ; la page des trois engagements du service ; et le calendrier d'opposabilité annoncé par la direction. Ce n'est ni un espace de travail persistant (rien à ouvrir, rien à administrer) ni une bibliothèque de prompts (aucun fichier livré clé en main) : c'est un document de décision collective, entièrement produit en salle, qui ne contient que ce que l'entreprise a elle-même écrit.

**Corrections apportées**
- Ratio de pratique : 190 min comptées très généreusement (48,7 %) portées à 235 min de pratique et de vérification réelles, soit 56 % des 420 min dues et 60,3 % des 390 min de contenu — le seuil de 60 % réclamé par le contrôle est atteint sur le contenu. Conversions faites : les 20' « le formateur reprend chaque proposition et la généralise » deviennent 25' de réécriture par les tables sur grille ; les 20' « le cadre en clair » passent à 15' et alimentent un tri par table porté de 15' à 25' ; les 20' de restitution plénière de la séquence 2 deviennent 15' de restitution croisée corrigée ; une deuxième passe de 20' d'écriture AXION est ajoutée.
- Timeline corrigée par la structure, sans attendre le correctif de code : les cinq sections deviennent deux (« Matin — … » et « Après-midi — … »). deriveProgrammeSchedule remettait l'horloge à zéro au début de chaque section et ne basculait à 14 h que sur le préfixe « Après-midi » — avec trois sections préfixées « Après-midi », elles s'affichaient toutes trois à 14 h 00. Avec deux sections, le matin cumule à partir de 9 h et l'après-midi à partir de 14 h : la timeline publique est juste en l'état.
- Séquences 2, 4 et 5 déclinées en cinq blocs, ce qu'elles n'étaient pas : ajout d'un objectif observable au sondage et à l'après-midi, d'une démonstration commentée du résultat agrégé, d'une vérification au concours d'astuces (chaque table rejoue l'astuce transposée) et d'une vérification individuelle corrigée en salle sur les règles et engagements.
- Le formateur n'arbitre plus rien qu'il ne puisse lire : la généralisation des astuces est faite par les tables sur une grille écrite de six familles de tâches transverses, et l'écartement des astuces à risque se fait par lecture d'une liste écrite, pas par qualification RGPD improvisée devant cinquante personnes. Tout cas douteux est noté et renvoyé au conseil de l'entreprise.
- Les 8' de droit du travail (CSE, dépôt au greffe, inspection du travail) exposés par un formateur IA sont remplacés par 5' portés par la direction de l'entreprise, avec mention explicite en salle qu'Axion-IA ne délivre aucun conseil juridique. La mention du dépôt au greffe et de la transmission à l'inspection du travail est retirée du texte public.
- L'engagement de non-usage disciplinaire n'est plus oral : il est signé par la direction, projeté, remis à chaque table et agrafé en tête du classeur ; la tenue du sondage y est explicitement conditionnée.
- La mise hors jeu des usages à haut risque (recrutement, évaluation des salariés, décision sur une personne) remonte de la séquence 5 de fin d'après-midi au cadre du matin, avant le sondage, avant le concours d'astuces et avant la hiérarchisation — elle est aussi adossée au tri par table, où elle coûte zéro minute, et rappelée au moment des engagements.
- Cinq QCM (environ 40 min pour cinquante personnes) ramenés à une seule évaluation individuelle de 10' corrigée en salle, sans résultat nominatif communiqué à l'employeur ; les autres vérifications sont croisées entre tables et productives (correction croisée, restitution croisée, exécution du prompt d'une autre table, rejeu d'astuce).
- Livrable changé : « classeur de bord IA de l'entreprise », ni espace de travail persistant ni bibliothèque de prompts — tous deux déjà employés par d'autres fiches. La promesse « bibliothèque de plus de 500 prompts AXION par métier » est supprimée, c'était la seule promesse chiffrée du catalogue.
- Panorama multi-outils (ChatGPT, Claude, Gemini, Copilot) supprimé : un seul outil tenu toute la journée, avec une phrase disant que les autres assistants font la même chose. Le champ outilsFr de la fiche, qui annonce trois outils pilotés en direct, est à réaligner.
- Minutage : deux pauses de 15 min déclarées comme séquences de type pause et comptées dans les 420 min ; le déjeuner ne figure plus au programme et n'est pas compté. Somme refaite séquence par séquence : 210 min le matin, 210 min l'après-midi, 420 au total.
- La phrase « c'est le modèle à répliquer sur les 21 autres » est retirée du verdict tant que le reste du catalogue n'est pas au niveau ; seule la démonstration de biais (un mot changé dans le prompt, pari de la salle avant affichage) est signalée comme reproductible telle quelle.

> **À faire relire** — 1) Références juridiques à faire relire — je cite trois références du règlement européen sur l'IA : art. 4 (obligation de veiller à un niveau suffisant de maîtrise de l'IA chez les personnes utilisant les systèmes, applicable depuis le 2 février 2025), art. 50 (obligations de transparence sur les contenus générés par IA, applicable depuis le 2 août 2026) et annexe III (usages à haut risque, dont l'emploi et la gestion des travailleurs). Elles correspondent aux obligations décrites, mais elles partent dans le programme officiel opposable et dans les documents remis : à confirmer par le conseil d'Axion-IA avant mise en ligne. Je ne cite volontairement aucun article du code du travail dans le texte public (le rattachement de la charte au règlement intérieur, L.1321-1 et suivants, et la consultation du CSE relèvent du conseil du client, pas du formateur).

2) La séquence « Ce qu'il reste à faire pour que ces règles s'appliquent » est portée par la DIRECTION du client, pas par le formateur. Cela doit être écrit dans la convention de formation et dans le guide d'animation, sinon le formateur la reprendra par défaut et l'organisme se retrouvera à délivrer du conseil juridique en séance.



### Programme

**Matin — Socle commun, garde-fous, et photographie réelle des usages**

- `cadre` · **10 min** — Ouverture par la direction : l'engagement écrit de non-usage disciplinaire est lu, signé et projeté, puis remis à chaque table — rien de ce qui sera déclaré aujourd'hui ne servira à sanctionner qui que ce soit. Sans cette signature, le sondage de la fin de matinée n'a pas lieu
- `objectif` · **5 min** — Ce que chacun saura faire à 17 h 30 : les six acquis de la journée affichés au mur, cochés au fil des séquences — nommer ce qu'on ne soumet jamais, écrire une demande qui marche sans son auteur, situer les usages de son service, transposer une astuce, écrire trois engagements
- `demonstration` · **20 min** — Avant/après sur une tâche que tout le monde fait (rédiger le compte rendu d'une réunion à partir de notes) : d'abord sans IA, puis avec — un seul outil, tenu toute la journée, prompt affiché en entier à l'écran ; une phrase dit que les autres assistants font la même chose et qu'on ne change pas d'onglet aujourd'hui
- `demonstration` · **15 min** — Les trois risques montrés et non racontés : une réponse fausse mais parfaitement crédible sur un sujet que la salle connaît ; un biais qui apparaît quand on change un seul mot du prompt (la salle parie sur le résultat avant l'affichage) ; une donnée collée dans un outil grand public qu'on ne peut plus reprendre
- `cadre` · **15 min** — Le cadre en trois obligations de l'employeur, énoncées en clair : informer et consulter le comité social et économique ; dire qu'un contenu a été produit par IA quand il part à un tiers (obligations de transparence du règlement européen sur l'IA, art. 50) ; former ses équipes (art. 4). Puis la liste écrite des usages mis hors jeu pour la journée entière — recrutement, évaluation des salariés, toute décision portant sur une personne (annexe III, usages à haut risque) : ils ne seront ni déclarés, ni pratiqués, ni retenus en feuille de route
- `pratique` · **25 min** — Tri par table sur les douze cartes fournies : « ça peut sortir » / « ça ne sort jamais » / « ça ne se soumet pas du tout, c'est une décision sur une personne ». Chaque table écrit ensuite sa règle commune en une seule phrase sur la première page du classeur
- `verification` · **15 min** — Correction croisée en plénière : chaque table défend deux cartes contestées, l'arbitrage se fait sur la grille de correction fournie (donnée personnelle / donnée client / donnée de santé / décision sur une personne), la règle commune de l'entreprise est écrite au tableau devant tout le monde
- `synthese` · **5 min** — Les trois règles que tout le monde repart en connaissant, recopiées par chaque table sur sa page du classeur et cochées au mur
- `pause` · **15 min** — Pause
- `objectif` · **5 min** — Objectif de la séquence : à la fin, chaque service sait nommer ses trois tâches les plus lourdes, le temps qu'elles lui coûtent, et les usages IA déjà en place chez lui — y compris ceux que personne n'a validés
- `cadre` · **5 min** — Comment ce sondage est protégé : réponses agrégées par service, aucun service de moins de cinq réponses n'est affiché, rien de nominatif, aucune reprise individuelle — rappel de l'engagement signé à 9 h et de ce qui sera fait du résultat
- `pratique` · **15 min** — Sondage en direct, chacun répond depuis le terminal fourni ou son téléphone au choix : quels usages, pour quelles tâches, à quelle fréquence — les usages mis hors jeu le matin ne figurent pas dans le questionnaire
- `demonstration` · **10 min** — Lecture commentée du résultat agrégé, service par service : ce que la direction découvre presque toujours, et pourquoi on ne cherche jamais qui a répondu quoi
- `pratique` · **30 min** — Travail par table sur la trame fournie (une page par service) : lister les tâches lourdes, estimer le temps qu'elles prennent chaque semaine, noter les usages IA déjà en place — c'est la table qui écrit, jamais un individu, et aucun nom n'est porté sur la fiche
- `verification` · **15 min** — Restitution croisée : chaque table lit la fiche d'une autre table et signale ce qui manque ou ce qui relève d'un usage mis hors jeu le matin ; corrigé en direct sur la fiche, par son auteur
- `synthese` · **5 min** — La photographie réelle de l'entreprise, une page par service, versée au classeur de bord — deux acquis cochés au mur

**Après-midi — Méthode AXION, astuces transposées, règles et engagements**

- `objectif` · **5 min** — Objectif de l'après-midi : chaque table repart avec deux demandes écrites aux cinq leviers, testées, qui produisent le même résultat entre les mains d'un collègue qui ne les a pas écrites
- `demonstration` · **20 min** — Les cinq leviers AXION (Acteur, conteXte, Intention, Output, Normes) puis démonstration avant/après sur un cas apporté par la salle : la même demande, d'abord vague, puis passée aux cinq leviers — les deux prompts affichés en entier, les deux résultats comparés côte à côte à l'écran
- `pratique` · **35 min** — Atelier chronométré par table, fiche mémo AXION en main : écrire une demande sur une tâche réelle du service, l'essayer sur le poste de la table, la corriger jusqu'à ce que le résultat soit utilisable tel quel — le formateur circule et minute, il n'écrit à la place de personne
- `verification` · **20 min** — Vérification croisée : chaque table exécute la demande d'une autre table, sans son auteur. Si le résultat change, on note sur la grille fournie quel levier manquait (Acteur, conteXte, Intention, Output, Normes) et on le rend à l'auteur par écrit
- `pratique` · **20 min** — Deuxième passe chronométrée : chaque table corrige sa première demande avec les remarques reçues, puis en écrit une seconde, cette fois sur une tâche d'un autre service que le sien
- `synthese` · **5 min** — Ce qui fait qu'une demande marche sans son auteur : les deux leviers le plus souvent oubliés dans cette salle, relevés sur les grilles et affichés
- `pause` · **15 min** — Pause
- `demonstration` · **10 min** — Concours d'astuces : chaque table présente sa meilleure trouvaille en quatre-vingt-dix secondes chronométrées, sans commentaire ni débat — on écoute, on ne trie pas encore
- `cadre` · **10 min** — Le filtre est annoncé avant de généraliser : lecture de la liste écrite des astuces à écarter — celles qui font sortir une donnée client, une donnée de salarié ou une donnée de santé, et celles qui touchent une décision sur une personne. Le formateur applique cette liste telle qu'elle est écrite ; il n'arbitre pas en séance. Tout cas douteux est noté au tableau et renvoyé au conseil de l'entreprise, sans réponse improvisée
- `pratique` · **25 min** — Réécriture par table sur la grille des six familles de tâches transverses fournie (écrire, résumer, trier, reformuler, préparer une réunion, chercher dans ses propres documents) : chaque table prend l'astuce d'un autre service, la range dans sa famille, la transpose à son propre quotidien, l'essaie et écrit la version diffusable — la généralisation est faite par les tables, pas par le formateur
- `verification` · **10 min** — Chaque table rejoue devant la salle l'astuce qu'elle a transposée : soit elle fonctionne telle qu'elle est écrite, soit on note au tableau ce qui manquait pour qu'elle fonctionne ailleurs
- `pratique` · **15 min** — Chaque service écrit ses trois engagements concrets sur la page « engagements » du classeur et les annonce devant les autres — la hiérarchisation reprend la liste des usages mis hors jeu le matin, qui n'entrent pas dans la feuille de route
- `cadre` · **5 min** — Ce qu'il reste à faire pour que ces règles s'appliquent vraiment : c'est la direction de l'entreprise, et non le formateur, qui annonce son calendrier — information et consultation du CSE, information des salariés, examen par son propre conseil du rattachement de la charte au règlement intérieur. Axion-IA ne délivre aucun conseil juridique, et le dit à la salle
- `verification` · **10 min** — Évaluation individuelle des acquis : dix questions sur terminal fourni ou téléphone personnel au choix, corrigées et commentées en salle question par question, résultat agrégé affiché, aucun résultat nominatif communiqué à l'employeur
- `synthese` · **5 min** — Bilan : les six acquis cochés au mur, le référent IA désigné devant tout le monde, et le classeur de bord remis table par table

---

## ia-pour-les-rh

420 min programmées · 250 min de pratique · **60 %**

**Livrable** : « Le dossier de poste défendable » — un dossier par poste ouvert, assemblé et nommé par le participant en séance, ouvrable dès le lendemain sur un recrutement réel et présentable à un candidat, à un CSE ou à un contrôle. Il contient sept pièces produites dans la journée : (1) la fiche de poste déposée et remise en forme ; (2) la grille de lecture construite à partir de cette seule fiche de poste, portant en en-tête les champs interdits ; (3) les trames d'écrits validées en contrôle croisé (offre, annonce courte de multidiffusion, message d'approche, réponse au candidat non retenu, trame d'entretien professionnel) ; (4) la mention d'information des candidats (L.1221-8) complétée à partir d'une trame pré-rédigée et datée ; (5) la note d'information au CSE (L.2312-38) complétée de la même façon ; (6) le journal de relecture humaine — une ligne par production : qui a relu, quand, ce qui a été modifié ; (7) la règle de refus écrite pour le droit social (« je ne me prononce pas », l'IA n'est jamais la source). Il diffère des livrables du reste du catalogue : ce n'est ni un « espace de travail persistant » ni une « bibliothèque de prompts », mais un dossier de preuve indexé sur un poste, dont l'objet est de rendre le recrutement assisté opposable — sa valeur tient au journal de relecture et aux deux documents d'information, que personne d'autre ne produit.

**Corrections apportées**
- Minutage porté de 385 à 420 min exactement : chaque séquence porte sa durée, les deux pauses sont déclarées comme séquences de type « pause » de 15 min et comptent dans le face-à-face, et le déjeuner a été RETIRÉ du programme (il n'est pas du face-à-face). Le compte a été refait séquence par séquence : M1 120 + M2 90 + M3 120 + M4 90 = 420. Matin 9 h 00 → 12 h 30, après-midi 14 h 00 → 17 h 30.
- Ratio recalculé et non plus auto-déclaré : 250 min de pratique + vérification sur les 420 min dues, soit 60 %. Détail vérifiable — M1 40 (25 + 15) · M2 65 (15 + 35 + 15) · M3 80 (15 + 30 + 20 + 15) · M4 65 (20 + 10 + 20 + 15). La révision précédente annonçait « 240 sur 390, soit 61,5 % », chiffres non reconstituables à partir de ses séquences (décompte strict réel : 215/385 = 55,8 %). Aucune séquence n'a été rallongée pour faire tomber le total : les 35 min manquantes ont été comblées par de la PRATIQUE (les gestes de dépôt/dictée passent de 10' descendant à 15' manipulés, la construction de grille de M3 devient un exercice sur trame à trous, la « règle qui en découle » de M4 devient une reformulation écrite en binôme, l'assemblage du dossier passe de 20' d'exposé à 20' de production).
- Le chiffre RATIO_PRATIQUE_PCT = 70 codé en dur ne s'applique plus : src/server/qualiopi/formations/ratio-pratique.ts calcule désormais le ratio depuis les durées et fixe le seuil à 50 % pour le format 1 j — la fiche est donc au-dessus du seuil avec 10 points de marge, et le chiffre publié sera le chiffre programmé.
- Référence légale FAUSSE corrigée aux deux occurrences : l'information du CSE ne relève pas de L.1221-9 (qui vise le candidat : aucune information ne peut être collectée par un dispositif non porté préalablement à sa connaissance) mais de L.2312-38 (le CSE est informé, préalablement à leur utilisation, sur les méthodes ou techniques d'aide au recrutement). L.2312-38 est désormais employé partout — séquence de cadre du M1, atelier du M3, dossier livrable, synthèses de M1 et M3.
- La qualification « haut risque » du règlement européen sur l'IA, promise dans la justification mais absente des séquences, est maintenant ÉCRITE dans la séquence de cadre de 15' du Module 1 : tri, filtrage et évaluation de candidatures classés à haut risque (annexe III, point 4 a), obligations applicables depuis le 2 août 2026, et pourquoi la présynthèse sous grille imposée sans classement ni score reste en dehors de ce régime. Le point est repris dans la démonstration du M3.
- Garde-fous replacés AVANT l'atelier qui les met en jeu : le Module 1 entier (régimes d'usage des données, ré-identification, biais démontré, discrimination, information candidat et CSE, haut risque) précède toute manipulation ; le Module 2 ne fait travailler que des écrits sans donnée de candidat ; les candidatures ne sont ouvertes qu'au Module 3, et uniquement sur le jeu fourni, jamais sur des dossiers réels.
- Animabilité par un formateur non spécialiste : le décompte « 25 critères de discrimination » a été RETIRÉ du programme (le nombre exact varie selon les mises à jour du Code du travail et le formateur serait interrogé dessus) et remplacé par un renvoi à L.1132-1 avec liste sourcée et datée dans le kit formateur, à ne jamais citer de mémoire. Les deux documents juridiques du M3 sont produits sur trames PRÉ-RÉDIGÉES ET DATÉES où seuls des champs variables sont complétés, avec en-tête non retirable « Projet — à faire valider par votre conseil avant diffusion », et la formule de refus est écrite dans la séquence : « je ne me prononce pas, notez la question, votre conseil tranchera ». Tous les corrigés, grilles, jeux de candidatures et documents à erreurs plantées sont fournis.
- Module 4 rendu déclinable en cinq blocs : il avait un objectif, de la pratique et une vérification, mais aucune démonstration et se fermait sur une feuille de route. Ajout d'une démonstration avant/après de 10' (question de droit social sans source puis avec le texte fourni) et transformation de la clôture en synthèse d'acquis-actions de 10'. Les quatre modules portent désormais les cinq blocs.
- Contrainte « UN SEUL outil » désormais portée par les QUATRE démonstrations (M1 biais, M2 offre AXION, M3 présynthèse, M4 droit social), avec prompts affichés en entier — elle n'était écrite que dans celle du M2.
- Timeline publique : les modules sont préfixés « Matin · » / « Après-midi · » comme la fiche santé, pour que deriveProgrammeSchedule() démarre l'après-midi à 14 h 00 au lieu de replacer les quatre modules à 9 h 00, et le marqueur « Déjeuner » — qui n'est ni numérique ni la chaîne « Pause » et s'imprimait verbatim dans la colonne des heures — a disparu.
- Livrable changé : « bibliothèque de prompts RH » puis « espace de travail RH de l'équipe » sont tous deux écartés (le premier ne survit pas trois mois, le second est employé par une quinzaine de fiches du catalogue). Remplacé par « Le dossier de poste défendable », indexé sur un poste ouvert, dont le cœur — journal de relecture humaine, mention candidat, note CSE — n'existe dans aucune autre fiche.
- Le classement de candidatures a été supprimé partout au profit de la présynthèse sous grille imposée : à corriger dans la même passe hors programme — l'objectif « Trier et présynthétiser des candidatures » devient « Présynthétiser des candidatures sous une grille de lecture imposée, sans classement », un objectif « Rédiger la mention d'information des candidats et la note d'information au CSE » est ajouté, et la FAQ « comment anonymiser » doit être réécrite (retirer le nom d'un CV laisse un dossier ré-identifiable : c'est le régime d'usage qui protège, pas l'anonymisation), plus une FAQ sur la durée de conservation des CV.

> **À faire relire** — RELECTURE JURIDIQUE — quatre références de Code sont citées dans le programme et partiront dans le programme Qualiopi officiel et dans les documents remis. Vérification faite de leur correspondance à l'obligation décrite, à confirmer par le conseil : L.1221-6 (les informations demandées au candidat doivent présenter un lien direct et nécessaire avec l'emploi proposé) ; L.1221-8 (le candidat est expressément informé, préalablement à leur mise en œuvre, des méthodes et techniques d'aide au recrutement utilisées à son égard) ; L.2312-38 (le CSE est informé, préalablement à leur utilisation, sur les méthodes ou techniques d'aide au recrutement, et préalablement à leur introduction sur les traitements automatisés de gestion du personnel) — c'est la correction de l'erreur L.1221-9 relevée par le contrôle, L.1221-9 visant bien le candidat et non le CSE ; L.1132-1 (critères de discrimination interdits). Le NOMBRE de critères a été volontairement retiré du programme : la liste a évolué et « 25 » n'est plus sûr — la liste sourcée et datée du kit formateur doit être établie et re-datée par un humain avant la première session.

ARBITRAGE À TRANCHER, laissé ouvert dans le programme : le CSE doi

### Programme

**Matin · Module 1 — Le cadre avant les CV : ce qu'on a le droit de faire, avec quel outil**

- `objectif` · **10 min** — Accueil, ce que chacun vient chercher (tour de table en une phrase, noté au tableau), et la règle qui tient toute la journée : l'IA prépare, l'humain décide — annonce du dossier de poste que chacun repartira avec
- `cadre` · **15 min** — Les trois régimes d'usage des données RH (compte grand public, abonnement entreprise avec engagement de non-réutilisation, environnement validé par la DSI) : où passe vraiment un CV, un bulletin de paie, un dossier disciplinaire — et pourquoi retirer le nom ne suffit pas (ré-identification montrée en direct sur un CV du jeu fourni : commune + diplôme + employeur précédent). Pseudonymiser n'est pas anonymiser : le dossier reste une donnée personnelle et reste soumis au RGPD
- `demonstration` · **20 min** — Démonstration avant/après DE BIAIS, avec UN SEUL outil et les deux prompts affichés en entier à l'écran : le même lot de trois candidatures du jeu fourni, d'abord avec un prompt neutre, puis avec un prompt orienté (« profil dynamique, capable de tenir le rythme, bonne intégration dans une équipe jeune »). Chacun parie par écrit sur le classement AVANT l'affichage, puis on compare les deux sorties ligne à ligne
- `cadre` · **15 min** — Ce que le droit impose AVANT d'ouvrir un CV, en clair (fiche de synthèse remise, sources datées dans le kit formateur) : le candidat doit être informé préalablement des méthodes et techniques d'aide au recrutement utilisées (L.1221-8) ; le CSE doit être informé préalablement à leur utilisation (L.2312-38) ; on ne demande que ce qui a un lien direct et nécessaire avec l'emploi (L.1221-6) ; les critères de discrimination interdits (L.1132-1 — liste sourcée et datée fournie au formateur, à ne jamais citer de mémoire) et la façon dont un prompt les réintroduit sans le dire ; et la qualification du règlement européen sur l'IA : le tri, le filtrage et l'évaluation de candidatures sont classés à HAUT RISQUE (annexe III, point 4 a), obligations applicables depuis le 2 août 2026 — pourquoi la présynthèse sous grille imposée, sans classement ni score, reste en dehors de ce régime
- `pratique` · **25 min** — Atelier chronométré en binôme, support fourni : réécrire trois demandes de tri irrecevables (fournies telles quelles : « classe-moi ces CV du meilleur au moins bon », « écarte ceux qui ont eu des trous dans leur parcours », « dis-moi lesquels s'intégreront le mieux ») en demandes défendables — pour chacune, nommer le critère interdit, le régime d'usage retenu et la trace de décision humaine à conserver
- `verification` · **15 min** — Contrôle croisé : chaque binôme fait valider ses trois réécritures par un autre binôme sur la grille fournie (critère interdit repéré ? information due au candidat et au CSE ? trace de la décision humaine ? classement supprimé ?), puis corrigé projeté et écarts commentés en salle
- `synthese` · **5 min** — Acquis du module, formulés comme des actions : je nomme le régime d'usage adapté à chaque document RH · je repère un critère interdit dans une demande avant de la lancer · j'informe le candidat et le CSE avant la première utilisation
- `pause` · **15 min** — Pause

**Matin · Module 2 — Les écrits RH sans donnée personnelle : offres, fiches de poste, communication interne**

- `objectif` · **5 min** — Ce que vous saurez faire en sortant de ce module — produire et décliner un écrit RH publiable — et pourquoi on commence par les écrits qui ne contiennent aucune donnée de candidat
- `demonstration` · **15 min** — Démonstration avant/après avec UN SEUL outil, prompt affiché en entier : la méthode AXION (Acteur, conteXte, Intention, Output, Normes) appliquée à une offre d'emploi — d'abord la demande spontanée (« rédige une offre pour un comptable »), puis la même demande structurée par les cinq leviers, résultats comparés côte à côte
- `pratique` · **15 min** — Les trois gestes qui débloquent tout, chacun les fait sur son propre poste, chronométré : déposer une fiche de poste en PDF · dicter deux minutes depuis son téléphone · photographier un tableau ou une note manuscrite. Les trois causes d'échec sont annoncées avant (scan sans texte reconnu, fichier trop lourd, tableau désaligné) et la parade de chacune est fournie
- `pratique` · **35 min** — Atelier chronométré, au choix selon le quotidien de chacun (les trois consignes sont écrites et remises) : produire l'offre d'un poste réel puis la décliner en trois formats (annonce courte de multidiffusion, message d'approche, publication interne) · OU produire un support d'onboarding · OU produire une trame d'entretien professionnel. Le formateur passe, relance sur les cinq leviers AXION, ne rédige rien à la place
- `verification` · **15 min** — Contrôle croisé en binôme sur la grille fournie : ce qu'une offre ne doit JAMAIS affirmer sans vérification dans le document source (convention collective applicable, durée de période d'essai, rémunération, avantages, statut cadre) · formulations discriminantes réintroduites par l'outil · ton et promesse. Chaque affirmation non sourcée est barrée, corrigé fourni
- `synthese` · **5 min** — Acquis du module et premier versement au dossier de poste : je structure une demande d'écrit avec AXION · je fais entrer un document dans l'outil (dépôt, dictée, photo) · je barre toute affirmation que je n'ai pas vérifiée dans un document. Ce qui entre dans le dossier, et sous quel nom de fichier

**Après-midi · Module 3 — Candidatures et entretiens : présynthétiser, jamais classer**

- `objectif` · **5 min** — Objectif du module : produire une présynthèse de candidature défendable, et savoir prouver après coup que la décision est restée humaine
- `demonstration` · **15 min** — Démonstration avant/après avec UN SEUL outil, les deux prompts affichés en entier : la même candidature résumée « librement », puis sous une grille imposée — on surligne à l'écran ce que la version libre ajoute, ce qu'elle invente et ce qu'elle hiérarchise de son propre chef (et qui bascule dans le filtrage à haut risque vu au module 1)
- `pratique` · **15 min** — Chacun construit sa grille de lecture à partir de la SEULE fiche de poste, sur la trame à trous fournie : critères retenus, ordre, formulation exacte, et champs volontairement absents (âge, photo, situation familiale, adresse, nationalité, état de santé, appartenance syndicale) inscrits en en-tête comme interdits
- `pratique` · **30 min** — Atelier chronométré : présynthétiser les trois candidatures du jeu fourni sous SA propre grille, dans le régime d'usage conforme retenu au module 1 (aucun document réel de candidat n'est déposé), puis rédiger la réponse au candidat non retenu à partir de la trame fournie — le meilleur rapport gain/risque du métier : volume massif, aucune donnée sensible en jeu
- `pratique` · **20 min** — Atelier chronométré sur trames PRÉ-RÉDIGÉES ET DATÉES, où seuls les champs variables sont à compléter (raison sociale, poste, outil utilisé, finalité, destinataire, durée de conservation, contact) : la mention d'information des candidats (L.1221-8) et la note d'information au CSE (L.2312-38). L'en-tête « Projet — à faire valider par votre conseil avant diffusion » reste apparent et n'est pas retirable. Le formateur n'arbitre aucune question juridique : la formule à employer est « je ne me prononce pas, notez la question, votre conseil tranchera »
- `verification` · **15 min** — Contrôle croisé en binôme, grille fournie : repérer dans les productions de l'autre les informations sans lien direct avec l'emploi, les affirmations non vérifiables, tout reste de classement ou de score, et l'absence de trace de relecture humaine. Corrigé fourni, écarts relevés à l'oral
- `synthese` · **5 min** — Acquis du module, formulés comme des actions : je présynthétise sous une grille que j'ai posée · je réponds à un candidat non retenu sans le formuler moi-même à chaque fois · je fais informer candidats et CSE avant la première utilisation
- `pause` · **15 min** — Pause

**Après-midi · Module 4 — Droit social, fiabilité et ancrage**

- `objectif` · **5 min** — Objectif du module : savoir à quel moment l'IA vous ment dans votre propre domaine — et repartir avec un dossier utilisable dès demain
- `demonstration` · **10 min** — Démonstration avant/après avec UN SEUL outil, les deux prompts affichés en entier : la même question de droit social posée sans rien fournir (« quelle est la durée de préavis pour un cadre dans ma convention collective ? »), puis posée en fournissant à l'outil l'extrait de texte ouvert par le formateur — ce que la réponse gagne, et ce qu'elle cesse d'inventer
- `pratique` · **20 min** — Chasse à l'erreur chronométrée, document fourni : une réponse de droit social produite par l'IA (convention collective, période d'essai, préavis, congés) contenant des erreurs plantées — chacun surligne ce qu'il croit faux, on compte les repérages à main levée, la salle corrige, corrigé détaillé fourni avec la source de chaque point
- `pratique` · **10 min** — En binôme : écrire la règle qui en découle en une phrase applicable dans son propre service (l'IA n'est jamais la source d'une réponse de droit social : elle reformule un texte que vous lui fournissez, et vous citez la source que vous avez ouverte), plus la formule de refus à tenir devant un collègue : « je ne me prononce pas ». Les deux phrases sont lues à voix haute et versées au dossier
- `pratique` · **20 min** — Assembler et nommer LE DOSSIER DE POSTE DÉFENDABLE : y ranger la fiche de poste, la grille de lecture avec ses champs interdits en en-tête, les trames d'écrits validées, la mention candidat, la note CSE, la règle de droit social — puis ouvrir le journal de relecture humaine (une ligne par production : qui a relu, quand, ce qui a été modifié) et le partager à la personne qui le tiendra à jour
- `verification` · **15 min** — Évaluation des acquis : quiz individuel de validation (10 questions, corrigé en salle question par question) + auto-évaluation par chacun d'une production réelle du jour sur la grille de relecture (exactitude des affirmations, informations interdites, mentions dues, ton, réutilisabilité)
- `synthese` · **10 min** — Acquis-actions et feuille de route : j'ouvre un dossier de poste AVANT toute utilisation de l'IA sur un recrutement · je fais informer le CSE avant la première utilisation · je consigne chaque relecture humaine au journal. Chacun nomme les trois usages qu'il installe la semaine suivante, qui les tient, et à quelle date la mention candidat et la note CSE partent chez le conseil

---

## ia-pour-le-marketing

420 min programmées · 235 min de pratique · **56 %**

**Livrable** : « Le dossier de marque et son calendrier éditorial du trimestre » — un document unique, daté et nominatif, assemblé par le participant en fin de journée : le brief de marque (ton en trois adjectifs et trois contre-exemples, cibles et personas, interdits de langage, trois exemples de contenus validés), le calendrier éditorial des douze semaines à venir (un sujet, un format et un responsable par ligne), les trames de déclinaison multi-formats, et la grille de relecture en quatre contrôles construite par la salle pendant la chasse à l'erreur. Il diffère des deux livrables déjà employés ailleurs au catalogue : ce n'est pas un « espace de travail persistant » (aucun compte à ouvrir, aucun outil à maintenir, aucune dépendance à un éditeur — c'est un document qui se transmet et se rouvre tel quel), et ce n'est pas une « bibliothèque de prompts » (il ne contient aucune consigne recopiable : il contient la matière de l'entreprise, ce qui le rend inutilisable par un concurrent et rouvrable dans trois mois).

**Corrections apportées**
- MAJEUR — Ratio de pratique. La révision annonçait 240 min / 390 (61,5 %) mais n'en produisait que 220 (56,4 %), et la ligne « 240 min sur 390 » était recopiée mot pour mot depuis marketing, commerciaux et finance. Somme refaite séquence par séquence : 235 min de pratique + vérification, soit 56 % des 420 min dues et 60,3 % des 390 min de face-à-face pédagogique — le plancher maison est franchi dans les deux conventions. Les deux blocs de synthèse pure (« Acquis et versement au livrable », « Feuille de route ») ne sont plus comptés comme pratique : ils sont typés synthese.
- MAJEUR — Deux séquences descendantes converties en séquences appliquées, comme le demandait le contrôle : les 15' « Résultats de campagne : l'IA commente, elle ne calcule pas » deviennent 10' de démonstration avant/après suivies des ateliers ; les 15' « Droits et mentions » deviennent 10' de cadre + 10' de tri appliqué sur douze cas de diffusion fournis au kit, corrigés en salle.
- MAJEUR — Dérivation horaire corrigée. Les quatre sections « Module 1 — » à « Module 4 — » démarraient toutes à 9 h 00 sur la fiche publique (sectionStartMin() ne bascule à 14 h que sur un intitulé commençant par « Après-midi », et deriveProgrammeSchedule() réinitialise l'horloge à chaque section). Le programme est regroupé en deux sections « Matin » (modules 1 et 2, 210 min → 9 h 00-12 h 30) et « Après-midi » (modules 3 et 4, 210 min → 14 h 00-17 h 30), les modules restant identifiés par le préfixe de chaque séquence.
- MAJEUR — Le marqueur « Déjeuner — Déjeuner » est supprimé : il n'est ni numérique ni égal à « Pause », parseDurationMin() le rendait verbatim et l'horloge ne progressait pas. Le déjeuner n'est pas du face-à-face et sort du décompte ; il est porté par la coupure entre les deux sections.
- MAJEUR — La démonstration « visuels » exigeait un outil de génération d'images qu'aucune entrée du catalogue ne nomme, en violation du « un seul outil par démonstration ». Elle est remplacée par une revue commentée de quatre visuels pré-produits fournis dans le kit — aucun compte à ouvrir, aucune installation, animable par n'importe quel formateur — ramenée à 10'. L'objectif « visuels » est retiré du périmètre promis (voir alerte humaine sur objectifsFr).
- MINEUR — Le Module 4 ne portait aucune démonstration avant/après : ajout d'une micro-démonstration de 5' (le même paragraphe produit sans contrainte, puis avec obligation de citer ses sources) en tête de la chasse à l'erreur. Les cinq blocs sont désormais complets dans les quatre modules.
- MINEUR — Le Module 1 n'avait pas de séquence d'objectif explicite alors que les trois autres en avaient une. Les 10' d'accueil sont requalifiées en séquence d'objectif : chacun nomme ce qu'il produit chaque semaine et le résultat visé le soir même.
- MINEUR — « Pseudonymiser n'est pas anonymiser » était absent alors que le Module 1 cite « un fichier client » parmi les objets déposés. Ajout de la démonstration de ré-identification sur le jeu de contacts fictif du kit (code postal + tranche d'âge + fonction), dans la séquence de cadre des trois régimes d'usage — comme dans finance, achats, relation-client et production.
- MINEUR — Le mot « biais » n'apparaissait dans aucun module alors que la journée fait construire des personas. Ajout dans la vérification du Module 1 : chaque binôme relance le même brief avec le persona du voisin et relève qui a disparu du texte — le biais du brief avant celui de l'outil. Exercice universel, corrigé par la salle.
- Livrable changé. La révision proposait « L'espace de travail contenu de l'équipe » — formule employée sous une variante ou une autre par dix-sept des vingt-deux fiches du lot, et écartée par la consigne. Il devient « Le dossier de marque et son calendrier éditorial du trimestre » : un document, pas un outil ; il ne dépend d'aucun compte et se rouvre tel quel.
- Animabilité : chaque séquence de pratique s'appuie désormais sur un matériel nommé et fourni (trame de dossier de marque, tableau de sujets, quatre visuels pré-produits, trois questions de vérification de marque, douze cas de diffusion avec corrigé, grilles de contrôle croisé). Aucune séquence ne repose sur une expertise marketing sectorielle du formateur : la salle apporte la matière, le formateur anime la méthode.
- Toutes les durées sont additionnées et vérifiées : 210 min le matin + 210 min l'après-midi = 420 min, pauses de 15 min comprises et typées « pause », déjeuner exclu.

> **À faire relire** — 1) RÉFÉRENCES JURIDIQUES À FAIRE RELIRE — quatre textes sont désormais cités dans le programme officiel, et ce programme est opposable en audit : (a) code de la consommation, art. L.121-4 — liste des pratiques commerciales réputées trompeuses en toutes circonstances ; le faux avis de consommateur y figure au 21°, issu de la transposition de la directive Omnibus. Vérifier que la numérotation du point est toujours à jour avant impression, ou ne citer que l'article sans le point. (b) Règlement (UE) 2024/1689 sur l'IA, art. 50 — obligations de transparence sur les contenus générés ou manipulés. Ces obligations deviennent applicables le 2 août 2026 : à la date de cette révision (6 août 2026) elles le sont, mais la formulation exacte de ce qui est dû à un éditeur de contenu marketing (marquage lisible par machine côté fournisseur vs divulgation côté déployeur) mérite une validation juridique — le programme dit « mention due sur un contenu généré diffusé au public », ce qui est une simplification. (c) Code civil, art. 9 — fondement du droit à l'image ; correct mais indirect (la jurisprudence, pas l'article, fonde le droit à l'image). (d) CPCE, art. L.34-5 — consentement préalable à la pro

### Programme

**Matin — Le cadre, la voix de la marque, et le trimestre planifié**

- `objectif` · **10 min** — Module 1 · Ouverture et résultat visé : chacun nomme ce qu'il produit chaque semaine (posts, newsletters, pages) et ce qu'il veut avoir en main ce soir — un dossier de marque écrit et douze semaines planifiées. Règle du jour posée : l'IA fait le premier jet, la marque reste la vôtre.
- `cadre` · **20 min** — Module 1 · Les trois régimes d'usage — compte grand public, offre entreprise avec engagement de non-réutilisation, environnement validé : où passent un brief, un fichier client, un plan de lancement sous embargo. Démonstration de ré-identification menée par le formateur sur le jeu de contacts fictif du kit : retirer le nom ne rend pas le fichier anonyme, le code postal, la tranche d'âge et la fonction suffisent à retrouver la personne — pseudonymiser n'est pas anonymiser, et le fichier reste soumis au RGPD.
- `cadre` · **15 min** — Module 1 · Ce qu'on n'a pas le droit de publier, posé AVANT de produire : faux avis et faux témoignages de consommateurs (code de la consommation, art. L.121-4), allégations invérifiables et allégations environnementales, mention due sur un contenu généré diffusé au public (règlement (UE) 2024/1689 sur l'IA, art. 50), consentement préalable avant une newsletter adressée à des particuliers (code des postes et des communications électroniques, art. L.34-5). Fiche récapitulative d'une page remise au kit.
- `demonstration` · **15 min** — Module 1 · Démonstration avant / après, UN SEUL outil, prompt affiché en entier à l'écran : le même post écrit sans contexte, puis avec la méthode AXION — Acteur, conteXte, Intention, Output, Normes. On lit les deux résultats à voix haute et la salle dit ce qui a changé.
- `pratique` · **30 min** — Module 1 · Atelier chronométré : constituer le dossier de marque sur la trame fournie — ton (trois adjectifs et trois contre-exemples), cibles et personas, interdits de langage, trois exemples de contenus déjà validés — puis le tester immédiatement en relançant une publication réelle avec ce dossier en contexte. Le formateur anime la trame, la salle apporte la voix.
- `verification` · **10 min** — Module 1 · Contrôle croisé en binôme sur la grille fournie : le post produit tient-il le ton déclaré, la promesse est-elle vérifiable, la mention de contenu généré est-elle due ? Puis chaque binôme relance le même brief avec le persona du voisin et relève qui a disparu du texte — c'est le biais du brief, avant celui de l'outil.
- `synthese` · **5 min** — Module 1 · Acquis, formulés en actions : je sais où je dépose et ce que je ne dépose jamais · je sais ce que je ne peux pas publier et ce que je dois mentionner · j'ai un dossier de marque écrit que je peux rouvrir lundi.
- `pause` · **15 min** — Pause café
- `objectif` · **5 min** — Module 2 · Objectif : passer d'un message unique à une série cohérente, et ne plus repartir de zéro chaque lundi.
- `demonstration` · **15 min** — Module 2 · Démonstration avant / après, UN SEUL outil, prompt affiché en entier : déposer un brief en PDF et une fiche produit (et ce qui fait échouer le dépôt — scan sans texte reconnu, tableau qui se désaligne), puis décliner une idée en publication courte, newsletter, script vidéo et communiqué — en nommant ce qui se dégrade à chaque déclinaison.
- `pratique` · **30 min** — Module 2 · Atelier chronométré 1 : chacun décline un message réel de l'entreprise sur trois formats, en repartant de son dossier de marque et non d'une consigne nue.
- `pratique` · **25 min** — Module 2 · Atelier chronométré 2 : construire le calendrier éditorial du trimestre à partir du tableau de sujets fourni — douze semaines, un sujet et un format par semaine, et le nom de la personne qui tient chaque ligne.
- `verification` · **10 min** — Module 2 · Contrôle croisé en binôme, grille fournie : respect du dossier de marque, promesse vérifiable, appel à l'action présent, mention de contenu généré si elle est due, et calendrier réellement tenable au vu des effectifs annoncés.
- `synthese` · **5 min** — Module 2 · Acquis en actions et versement au livrable : je décline sans réécrire · je planifie mon trimestre en une séance — ce qui entre dès maintenant dans le dossier de marque.

**Après-midi — Image, résultats, visibilité de la marque, et ce qu'on diffuse**

- `objectif` · **5 min** — Module 3 · Objectif : trois usages très attendus, trois périmètres honnêtes — et savoir dire à sa direction ce que l'IA ne fera pas.
- `cadre` · **10 min** — Module 3 · Le cadre de l'image, posé avant d'en regarder une seule : à qui appartient ce qu'un outil produit selon ses conditions d'utilisation, ce qu'on ne fait jamais avec le visage ou la voix d'une personne identifiable (droit à l'image, code civil art. 9), et l'obligation de signaler une image ou une vidéo générée diffusée au public (règlement (UE) 2024/1689, art. 50).
- `demonstration` · **10 min** — Module 3 · Revue commentée des quatre visuels pré-produits fournis dans le kit — aucun compte à ouvrir, aucun outil d'image à installer : ce qui tient (illustration d'ambiance, déclinaison de gabarit, recadrage, texte alternatif) et ce qui rate systématiquement (le texte dans l'image, la charte, le logo, le visuel de marque). Le périmètre est annoncé tel quel, sans promesse de génération de visuels.
- `demonstration` · **10 min** — Module 3 · Résultats de campagne, démonstration avant / après, UN SEUL outil, prompt affiché en entier : l'IA commente, elle ne calcule pas. On décrit la structure de son tableau sans jamais coller l'export, on saisit à la main les quatre valeurs à commenter, et on montre ce qui se passe quand on lui demande un total.
- `pratique` · **30 min** — Module 3 · Atelier chronométré : chacun rédige le commentaire de sa dernière campagne à partir de ses propres chiffres saisis à la main, puis fait proposer trois hypothèses de test à budget constant et tranche celle qu'il retient.
- `pratique` · **25 min** — Module 3 · Atelier chronométré : vérifier en direct comment sa marque est décrite par un assistant IA, avec les trois questions fournies (qui est cette entreprise, que vend-elle, à qui la recommanderiez-vous), relever les erreurs et lister ce qui se corrige sur ses propres pages ; puis dégrossir une veille sur deux concurrents et marquer d'une croix tout ce qui reste à vérifier à la source.
- `verification` · **10 min** — Module 3 · Contrôle croisé en binôme, grille fournie : aucun chiffre calculé par l'outil ne subsiste dans le commentaire, aucune donnée client n'a été déposée, chaque affirmation de veille porte la mention vérifiée ou à vérifier.
- `synthese` · **5 min** — Module 3 · Acquis en actions : je connais le périmètre réel de l'image et je ne le survends pas · je commente un résultat sans exposer mes données · je sais comment ma marque est reprise et ce que je corrige sur mon site.
- `pause` · **15 min** — Pause café
- `objectif` · **5 min** — Module 4 · Objectif : ne plus rien diffuser sans savoir ce qui a été vérifié, et par qui.
- `demonstration` · **5 min** — Module 4 · Micro-démonstration avant / après, UN SEUL outil, prompt affiché en entier : le même paragraphe sur votre marché produit sans contrainte, puis avec l'obligation de citer ses sources — et ce que devient le texte quand on exige la source.
- `pratique` · **25 min** — Module 4 · Chasse à l'erreur chronométrée : on fait produire un texte sur le marché des participants, chacun surligne ce qui est faux ou invérifiable, on compte à voix haute — puis la salle en tire les quatre contrôles de sa propre grille de relecture avant diffusion.
- `cadre` · **10 min** — Module 4 · Droits et mentions, en cinq réponses fournies au kit : ce qu'on peut réutiliser d'un texte trouvé en ligne, la citation d'un client et l'accord écrit qu'elle suppose, la propriété de ce que l'outil produit, la mention due sur un contenu généré diffusé au public, et le consentement préalable avant d'écrire à un fichier de particuliers.
- `pratique` · **10 min** — Module 4 · Application immédiate : douze cas de diffusion fournis dans le kit (un avis client repris, une photo trouvée en ligne, un témoignage reformulé, une newsletter à un fichier acheté…) — chacun classe en « je publie » / « je publie avec mention » / « je ne publie pas », correction en salle avec le corrigé du formateur.
- `pratique` · **15 min** — Module 4 · Montage du livrable : assembler en un document unique, daté et nominatif le dossier de marque, le calendrier du trimestre, les trames de déclinaison et la grille de relecture — et désigner qui le tient à jour et à quelle date il est revu.
- `verification` · **15 min** — Module 4 · Évaluation des acquis : quiz individuel de validation (10 questions, corrigé en salle) puis auto-évaluation d'une production du jour sur la grille de relecture construite par la salle.
- `synthese` · **5 min** — Module 4 · Feuille de route contenu, en actions : trois usages installés dès la semaine suivante, un responsable nommé par usage, une date de revue du calendrier éditorial.

---

## ia-pour-les-commerciaux

420 min programmées · 255 min de pratique · **61 %**

**Livrable** : Le kit de rendez-vous — cinq pièces montées par chaque participant sur UNE affaire réelle de son portefeuille, emportées le soir : (1) fiche de préparation et plan de découverte en questions ouvertes, (2) trame de compte rendu dicté et ses trois sorties (compte rendu, mail de suivi, prochaines étapes datées) plus la relance à J+7, (3) fiche de riposte aux trois objections récurrentes de son marché, (4) proposition commerciale rédigée sur l'affaire, (5) grille personnelle de relecture avant envoi, construite à partir des erreurs qu'il a lui-même relevées. Différent de « l'espace de travail persistant » (celui-ci n'est pas un espace partagé d'équipe mais un dossier individuel attaché à une affaire nommée, utilisable dès le lendemain matin en rendez-vous) et de « la bibliothèque de prompts » (ce ne sont pas des prompts mais des pièces de dossier commercial : ce que le participant montre à son client, pas ce qu'il tape dans un outil).

**Corrections apportées**
- Ratio réellement calculé, séquence par séquence, au lieu de la ligne « 240 min sur 390 » recopiée à l'identique sur trois fiches : le programme précédent était à 215/390 = 55 %, il est désormais à 255/420 = 61 %.
- Dénominateur ramené au temps VENDU (420 min) et non au temps écrit hors pauses (390 min), conformément aux conventions de calcul.
- Le déjeuner, déclaré comme séquence dans la révision précédente, est retiré : il n'est pas du face-à-face, il ne compte pas et il n'apparaît plus. Les deux pauses de 15 min sont typées « pause » et comptent dans les 420 min.
- Défaut de dérivation horaire corrigé : les quatre sections « Module 1 — » à « Module 4 — » démarraient toutes à 9 h 00 sur la fiche publique (le marqueur « Déjeuner » ne fait pas avancer l'horloge, parseDurationMin le rejette). Regroupement en deux sections « Matin » (modules 1 et 2) et « Après-midi » (modules 3 et 4) : 9 h 00 → 12 h 30 et 14 h 00 → 17 h 30, pauses comprises. Les frontières de modules restent lisibles, portées par les séquences de type « objectif ».
- Module 2 : ajout de la vérification manquante — 10 min de contrôle croisé en binôme sur le tri de pipeline (tout critère décrivant la personne et non l'affaire est retiré et remplacé, on vérifie que le classement change). Le module n'en comportait aucune alors que la révision promettait « une mini-vérification par contrôle croisé dans chaque module ».
- Module 3 : ajout de la synthèse manquante — 5 min d'acquis formulés en actions. Le module s'arrêtait sur le contrôle croisé.
- Module 4 : ajout de la démonstration manquante — 5 min où le formateur vérifie une affirmation en direct (où l'on ouvre la source, ce qu'on garde, ce qu'on barre). Les cinq blocs sont désormais présents dans les quatre modules.
- Le mot « biais » entre au programme : la séquence « Qualifier sans profiler » montre en direct le biais de sélection — deux jeux de critères appliqués au même pipeline donnent deux classements différents, donc deux tournées différentes. Placée AVANT l'atelier de tri qu'elle met en jeu.
- Le règlement européen sur l'IA, absent du programme précédent, est nommé et placé en module 1 avant tout atelier : dire à un interlocuteur qu'il échange avec une IA, ne jamais envoyer sous sa signature un écrit qu'on n'a pas relu.
- La règle « aucun chiffre, aucun nom, aucune référence client dans un document sortant sans une source que vous avez ouverte » remonte du module 4 au module 1 : elle arrivait après les trois ateliers qui la mettent en jeu, dont la rédaction d'une proposition envoyée à un vrai client.
- Les cinq démonstrations portent toutes « un seul outil » et « prompt affiché en entier » ; seule celle du module 2 les portait.
- Sous-programmation comblée par de la pratique, pas par de l'exposé : + 10 min de tri chronométré des données (liste rouge personnelle construite par le participant et corrigée en salle) en module 1, + 5 min sur l'atelier de préparation de rendez-vous, et la démonstration du compte rendu dicté ramenée de 15 à 10 min au profit des 10 min de contrôle croisé. Le temps descendant tombe de 175 à 135 min.
- Livrable remplacé : « l'espace de travail de l'équipe commerciale » proposé par la révision précédente est un espace de travail persistant, déjà employé par plusieurs fiches du catalogue, et « Bibliothèque de prompts commerciaux » figure encore dans catalog-v2.ts et dans quinze autres fiches. Remplacé par le kit de rendez-vous individuel monté sur une affaire réelle nommée.
- Animabilité par un formateur non spécialiste du métier : les trois séquences qui exigeaient une connaissance du secteur portent désormais leur matériel — les dix éléments à trier sont énumérés, la trame de jeu de rôle et la grille de relecture sont fournies, et le jeu « fiche prospect + argumentaire faux » de la chasse à l'erreur est fourni au formateur. La salle apporte l'expertise sectorielle, le formateur anime le comptage.

> **À faire relire** — 1) RÉFÉRENCES JURIDIQUES — décision volontaire : aucun numéro d'article n'est écrit dans le programme, pour ne pas propager une référence fausse vers la page publique, le programme opposable et les documents remis. Les obligations décrites reposent toutefois sur des textes qu'un juriste doit confirmer avant qu'elles n'entrent dans le guide d'animation : information de la personne dont les données ont été collectées sans qu'elle les fournisse (RGPD, art. 14) et droit d'opposition à la prospection sans motif (RGPD, art. 21 §2) — ce sont les deux textes qui fondent la séquence « deux confidentialités » ; définition du secret des affaires (code de commerce, art. L.151-1) ; obligation de transparence « vous échangez avec une IA » du règlement (UE) 2024/1689, dont l'article 50 devient applicable le 2 août 2026 — DATE À CONFIRMER avant d'être affirmée en salle, la formation étant animée à compter d'août 2026 ; consentement préalable pour la prospection par courriel vers une personne physique (CPCE, art. L.34-5). Si le juriste valide, ces références vont dans le guide d'animation, pas dans le programme public.

2) ARBITRAGE HAUT RISQUE — la vente n'est pas en soi un usage à haut risque au 

### Programme

**Matin — Le cadre, la préparation du rendez-vous et le compte rendu dicté (modules 1 et 2)**

- `objectif` · **5 min** — Module 1 — Objectif : repartir ce soir avec un kit de rendez-vous monté sur une affaire réelle de votre portefeuille, utilisable dès lundi matin
- `cadre` · **15 min** — Deux confidentialités à ne pas confondre : le secret des affaires (prix négociés, marges, contrats, fichier client) d'un côté, les données personnelles d'un prospect de l'autre — ce qu'on a le droit de chercher, l'information qu'on lui doit quand on se renseigne sur lui sans le lui avoir demandé, son droit de s'opposer à la prospection sans avoir à se justifier ; et les trois régimes d'usage des outils (compte personnel, compte entreprise, outil intégré au système de l'entreprise)
- `cadre` · **5 min** — Le règlement européen sur l'IA, côté commercial : dire à un interlocuteur qu'il échange avec une IA, ne jamais envoyer sous sa signature un écrit qu'on n'a pas relu — et la règle qui vaut pour toute la journée : aucun chiffre, aucun nom, aucune référence client n'entre dans un document sortant sans une source que vous avez ouverte vous-même
- `pratique` · **10 min** — Tri chronométré, corrigé en salle : chacun classe dix éléments de son quotidien — prix négocié, fichier client, marge, contrat-cadre, remise exceptionnelle, notes manuscrites de rendez-vous, adresse mail d'un contact, plaquette publique du prospect, nom du dirigeant, compte rendu interne — en « jamais » / « avec précaution » / « librement », et repart avec sa liste rouge personnelle
- `demonstration` · **20 min** — Démonstration avant / après, un seul outil, prompts affichés en entier : « parle-moi de cette entreprise », qui invente un dirigeant, un chiffre d'affaires et une actualité, face à une préparation construite à partir des seules sources que vous fournissez ; puis construction en direct du prompt AXION (Acteur, conteXte, Intention, Output, Normes) de préparation de rendez-vous
- `pratique` · **35 min** — Atelier chronométré : chacun prépare un rendez-vous réel de sa semaine à partir des documents qu'il apporte — fiche de préparation, plan de découverte en questions ouvertes, hypothèses d'enjeux, liste de ce qui reste à vérifier (pièce 1 du kit)
- `verification` · **10 min** — Contrôle croisé en binôme, grille fournie : on barre toute affirmation dont la source n'a pas été ouverte, on compte les lignes barrées, on identifie celles que l'IA a purement inventées
- `synthese` · **5 min** — Acquis du module, formulés en trois actions
- `pause` · **15 min** — Pause
- `objectif` · **5 min** — Module 2 — Objectif : sortir du rendez-vous avec le compte rendu, le mail de suivi et les prochaines étapes déjà écrits
- `demonstration` · **10 min** — Démonstration, un seul outil, prompt affiché en entier : trois minutes dictées depuis un téléphone dans la voiture → compte rendu structuré, mail de suivi au client, prochaines étapes datées ; et les trois raisons qui font échouer une dictée (bruit ambiant, noms propres, chiffres)
- `pratique` · **30 min** — Atelier chronométré : chacun dicte le compte rendu d'un rendez-vous récent, produit les trois sorties, les corrige, puis rédige la relance à J+7 (pièce 2 du kit)
- `cadre` · **10 min** — Qualifier sans profiler, et voir le biais à l'œuvre : bâtir des critères tirés du besoin et de l'affaire, jamais de la personne ; démonstration en direct du biais de sélection — deux jeux de critères appliqués au même pipeline produisent deux classements différents, donc deux tournées différentes et deux affaires perdues
- `pratique` · **20 min** — Atelier chronométré : trier son pipeline de la semaine selon ses propres critères, puis écrire les relances correspondantes
- `verification` · **10 min** — Contrôle croisé en binôme sur le tri : tout critère qui décrit la personne et non l'affaire est retiré et remplacé, puis on vérifie de combien de rangs le classement a bougé
- `synthese` · **5 min** — Acquis du module en actions, et versement des pièces 1 et 2 au kit

**Après-midi — Objections, proposition commerciale et fiabilité (modules 3 et 4)**

- `objectif` · **5 min** — Module 3 — Objectif : s'entraîner face à l'objection avant de la subir chez le client, et écrire une proposition qui ne promet rien d'intenable
- `demonstration` · **20 min** — Démonstration, un seul outil, prompts affichés en entier : l'IA tient le rôle de l'acheteur difficile, puis relit votre proposition avec ses yeux — ce qu'elle fait bien, et le moment précis où elle devient complaisante et vous félicite au lieu de vous contredire
- `pratique` · **30 min** — Atelier chronométré en binôme, trame de jeu de rôle fournie : l'IA joue l'acheteur, chacun traite trois objections récurrentes de son marché (le prix, le délai, le concurrent déjà en place) et rédige sa réponse type (pièce 3 du kit)
- `cadre` · **5 min** — Ce qu'on ne chiffre jamais avec l'IA : remise, délai d'exécution, pénalité, engagement de résultat — et les mentions qui restent contractuelles et se recopient depuis vos conditions de vente, jamais depuis un modèle proposé par l'outil
- `demonstration` · **5 min** — Démonstration, un seul outil, trame et prompt affichés en entier : de vos notes à une proposition — structure du document, et angle selon l'interlocuteur (décideur, technique, achat)
- `pratique` · **30 min** — Atelier chronométré : rédaction d'une proposition commerciale sur l'affaire réelle en cours travaillée le matin (pièce 4 du kit)
- `verification` · **10 min** — Contrôle croisé en binôme, grille fournie : promesse tenable, aucun chiffre inventé, mentions contractuelles présentes, prochaine étape claire et datée
- `synthese` · **5 min** — Acquis du module, formulés en trois actions
- `pause` · **15 min** — Pause
- `objectif` · **5 min** — Module 4 — Objectif : repérer soi-même, sur son propre marché, le moment où l'IA se trompe avec aplomb
- `demonstration` · **5 min** — Démonstration, un seul outil, prompt affiché en entier : vérifier une affirmation en trente secondes — où l'on ouvre la source, ce qu'on garde, ce qu'on barre
- `pratique` · **25 min** — Chasse à l'erreur chronométrée : une fiche prospect et un argumentaire produits par l'IA sur le secteur des participants (jeu de documents fourni au formateur) — chacun surligne ce qui est faux, on compte, la salle corrige et dit pourquoi c'est faux
- `pratique` · **20 min** — Atelier : monter sa grille de relecture avant envoi à partir des erreurs que l'on vient de relever, puis la passer sur la proposition écrite en début d'après-midi et corriger ce qu'elle fait remonter (pièce 5 du kit — kit complété)
- `verification` · **15 min** — Évaluation des acquis : quiz individuel de validation (10 questions) corrigé en salle, puis auto-évaluation d'une production du jour sur la grille de relecture
- `pratique` · **10 min** — Feuille de route individuelle : trois usages à installer dès lundi, sur quelles affaires nommées, et ce que l'on regarde au bout d'un mois
- `synthese` · **5 min** — Acquis de la journée en trois actions, et remise du kit de rendez-vous complet

---

## ia-pour-la-finance

420 min programmées · 255 min de pratique · **61 %**

**Livrable** : Le classeur de clôture assistée du service finance — construit en séance et rouvert à chaque clôture : trame de contrôle de clôture et trame de cut-off, formules et croisements de tableur documentés en clair, trame de commentaire de gestion et de note de synthèse au dirigeant, séquence de relance d'impayé à trois niveaux, liste rouge des données du service, grille de relecture avant diffusion. Il se distingue de l'« espace de travail persistant » (outil transverse, non daté, sans processus) et de la « bibliothèque de prompts » (recueil de formulations) : c'est un classeur indexé sur un événement récurrent du métier — la clôture — dont chaque pièce est cochable par quelqu'un qui n'était pas en salle.

**Corrections apportées**
- Ratio de pratique porté de 225 à 255 minutes (61 % de 420, contre 57,7 % réels au passage précédent) : les 15' descendantes « Des trames de contrôle plutôt que des rapprochements » sont ramenées à 5' de démonstration + 15' d'atelier ; les 15' « Ce que l'IA ne fera pas » deviennent 15' de test par les participants eux-mêmes (ils font produire l'erreur au lieu de la regarder) ; les 15' « Les écrits qui rapportent » passent à 5' de présentation de trames fournies + 30' d'atelier ; l'atelier de montage du classeur passe de 20' à 30'.
- Module 2 : ajout d'une séquence de vérification (5' de contrôle croisé sur la trame de contrôle produite) et d'une synthèse d'acquis distincte (5'). Les cinq blocs y sont désormais complets.
- Module 3 : ajout d'une synthèse d'acquis (5') qui manquait, prise sur la séquence descendante « Les écrits qui rapportent ».
- Module 4 : ajout d'une démonstration avant/après (5' — le même calcul demandé deux fois, la réponse change) ; le module ne portait aucune démonstration, prise sur la démonstration du module 3 ramenée de 15' à 10'.
- Garde-fou « un écart repéré ne désigne jamais une personne » sorti de l'énoncé de l'atelier et remonté en séquence de cadre autonome (10') au module 1, AVANT tout dépôt de document et avant l'atelier de trame de contrôle. La séquence nomme explicitement, dans son intitulé livré et non plus seulement dans la justification : décision individuelle automatisée (art. 22 RGPD), information préalable des salariés et consultation du comité social et économique.
- Le règlement européen sur l'IA entre dans le programme livré : la notation de solvabilité d'une personne physique est nommée comme usage à haut risque au sens de l'annexe III du règlement (UE) 2024/1689, dans la séquence de cadre du module 1, puis rappelée en cadre au module 3 (interdiction de motiver une décision de crédit client par un score produit par l'IA).
- Biais traités explicitement : la séquence de cadre du module 1 pose que le repérage d'écart reproduit les biais de l'historique qui l'alimente (fournisseurs, services, personnes déjà contrôlés), et la grille de relecture du classeur porte ce point.
- Dérivation horaire corrigée : deux sections seulement, « Matin » et « Après-midi », au lieu de quatre sections « Module 1 » à « Module 4 » qui redémarraient toutes l'horloge à 9 h 00. Les repères de module vivent désormais dans les intitulés de séquences.
- Déjeuner retiré du programme (il n'est pas du face-à-face) ; les deux pauses de 15' sont déclarées comme séquences de type pause et comptent dans les 420 minutes.
- Objectif pédagogique « Automatiser des rapprochements simples » abandonné au profit de « Produire une trame de contrôle réutilisable » : aucune séquence ne promet plus un lettrage ou un rapprochement, et le module 1 fait produire l'échec en direct.
- Toutes les séquences sont animables sans compétence comptable : les trames de contrôle de clôture et de cut-off, les trois courriers de relance graduée, le corrigé de la chasse à l'erreur et la grille de relecture sont fournis au kit. Aucune séquence ne demande au formateur d'arbitrer une question de comptabilité.
- Livrable changé : « bibliothèque de prompts finance » et « espace de travail du service » (proposé au passage précédent, trop proche de l'espace de travail persistant d'autres fiches) remplacés par le classeur de clôture assistée.

> **À faire relire** — Trois références juridiques citées dans le programme livré demandent une relecture avant publication, parce qu'elles partiront telles quelles dans le programme officiel opposable et dans les documents remis :

1. **Art. 22 du RGPD (décision individuelle automatisée)**, cité au module 1. Il correspond bien à l'obligation décrite tant que le repérage d'écart produit un effet sur la personne sans intervention humaine ; si le service se contente de signaler pour instruction humaine, l'art. 22 ne s'applique pas stricto sensu et c'est l'information des personnes (art. 13-14) qui reste due. La formulation retenue dit « c'est une décision individuelle automatisée au sens de l'art. 22 » : à faire valider, ou à assouplir en « peut relever de l'art. 22 selon l'usage qui en est fait ».

2. **Annexe III du règlement (UE) 2024/1689 — notation de solvabilité**, cité aux modules 1 et 3. Le point pertinent de l'annexe III vise l'évaluation de la solvabilité **des personnes physiques** ; un service finance qui note des clients **personnes morales** n'est pas couvert. Le programme dit « la solvabilité d'une personne physique », ce qui est exact, mais la nuance personne physique / personne morale se p

### Programme

**Matin — Le partage des rôles, puis le tableur assisté et les trames de contrôle**

- `objectif` · **10 min** — Module 1 · Accueil et résultat attendu de la journée : ce soir, chacun sait déposer un document financier long et en tirer une synthèse fiable, obtenir une formule de tableur sans livrer ses données, et écrire autour du chiffre — les chiffres, eux, restent dans vos systèmes (comptabilité, ERP, tableur)
- `cadre` · **15 min** — Module 1 · Les trois régimes d'usage et la liste rouge du service : fichier des écritures (FEC), balance nominative, salaires, coordonnées bancaires — et pourquoi retirer les noms ne suffit pas : démonstration de ré-identification d'un état de frais « anonymisé » (pseudonymiser n'est pas anonymiser)
- `cadre` · **10 min** — Module 1 · Deux limites posées AVANT le premier atelier : un écart repéré ne désigne jamais une personne — c'est une décision individuelle automatisée au sens de l'art. 22 du RGPD, elle suppose l'information préalable des salariés et la consultation du comité social et économique, et elle reproduit les biais de l'historique qui l'alimente ; noter la solvabilité d'une personne physique est un usage à haut risque au sens de l'annexe III du règlement européen sur l'IA (règlement (UE) 2024/1689)
- `demonstration` · **15 min** — Module 1 · Démonstration avant/après : la même demande d'analyse d'un document financier, d'abord sans cadre, puis avec la méthode AXION — Acteur, conteXte, Intention, Output, Normes — prompt affiché en entier à l'écran, un seul outil
- `pratique` · **15 min** — Module 1 · Faites-la se tromper, chronométré : chacun demande à l'outil de lettrer deux extraits, de recalculer un total et de prévoir un atterrissage à partir des trois lignes fournies au kit — on relève les erreurs produites, on en tire la ligne de partage écrite au tableau
- `pratique` · **30 min** — Module 1 · Atelier chronométré : chacun dépose un document financier long (rapport, liasse, note d'un commissaire aux comptes, contrat de prêt) après l'avoir qualifié dans son régime d'usage, et en tire une synthèse structurée plus trois questions à poser à son émetteur
- `verification` · **10 min** — Module 1 · Contrôle croisé en binôme, grille fournie : le régime d'usage retenu était-il le bon, quelle affirmation de la synthèse n'est pas dans le document source, quel chiffre a été repris sans vérification
- `synthese` · **5 min** — Module 1 · Acquis : je qualifie un document avant de l'ouvrir dans un outil · je sais ce que l'IA ne calculera pas · je synthétise un document long et je sais ce que je dois vérifier derrière
- `pause` · **15 min** — Pause
- `objectif` · **5 min** — Module 2 · Résultat attendu : obtenir une formule ou un croisement de tableur en décrivant seulement la structure de ses colonnes — les données ne sortent jamais du fichier
- `demonstration` · **15 min** — Module 2 · Démonstration avant/après : une formule, un croisement et une mise en forme conditionnelle obtenus en décrivant uniquement les en-têtes de colonnes ; puis l'explication en clair d'une formule héritée que plus personne ne comprend — prompts affichés en entier
- `pratique` · **35 min** — Module 2 · Atelier chronométré : chacun apporte un besoin de tableur réel (structure des colonnes seule, aucune donnée) et repart avec sa formule, son croisement ou sa procédure, testés sur le fichier et documentés en français dans le classeur
- `demonstration` · **5 min** — Module 2 · Une trame de contrôle plutôt qu'un rapprochement : lecture commentée de la trame de clôture fournie au kit — l'IA écrit la liste des points à vérifier, c'est l'humain qui coche et qui signe
- `pratique` · **15 min** — Module 2 · Atelier chronométré : produire sa propre trame de contrôle sur un processus réel (clôture, cut-off, état de frais), en recopiant en tête de trame la borne posée le matin — un écart signalé ne désigne jamais une personne
- `verification` · **5 min** — Module 2 · Contrôle croisé en binôme : la trame de l'autre est-elle cochable par quelqu'un qui n'a pas assisté à la clôture, et sa borne est-elle bien écrite en tête
- `synthese` · **5 min** — Module 2 · Acquis et versement au classeur : je décris une structure sans livrer de données · je fais expliquer une formule héritée · je produis une trame de contrôle que quelqu'un d'autre peut dérouler

**Après-midi — Écrire autour du chiffre, puis fiabilité et ancrage**

- `objectif` · **5 min** — Module 3 · Résultat attendu : faire dire à ses indicateurs déjà calculés ce qu'ils veulent dire, pour le bon lecteur — direction, opérationnels, banque, associé
- `demonstration` · **10 min** — Module 3 · Démonstration avant/après : d'un tableau de bord déjà calculé au commentaire de gestion, puis le même commentaire reformulé pour un second niveau de lecture — prompt affiché en entier
- `pratique` · **35 min** — Module 3 · Atelier chronométré : chacun rédige le commentaire de son dernier reporting à partir de ses propres chiffres, saisis à la main dans le prompt, structure décrite — puis produit la version destinée à un second lecteur
- `cadre` · **10 min** — Module 3 · Ce qu'on n'écrit jamais : les mentions dues d'une relance d'impayé (pénalités de retard, indemnité forfaitaire de recouvrement) que l'IA oublie ou invente et qu'on reprend de la trame du kit ; et l'interdiction de motiver une décision de crédit ou un encours client par un score produit par l'IA — rappel de l'annexe III du règlement européen sur l'IA
- `demonstration` · **5 min** — Module 3 · Les trois écrits qui rapportent, trames fournies au kit : relance graduée à trois niveaux, note de synthèse au dirigeant, réponse à une demande du commissaire aux comptes — ce que chaque trame impose et ce qu'elle interdit
- `pratique` · **30 min** — Module 3 · Atelier chronométré : chacun produit soit sa séquence de relance d'impayé à trois niveaux, soit sa note de synthèse au dirigeant, à partir de la trame fournie et de son propre dossier
- `verification` · **10 min** — Module 3 · Contrôle croisé en binôme, grille fournie : aucun chiffre non vérifié, ton conforme au niveau de relance, mentions dues présentes, destinataire et niveau de lecture cohérents
- `synthese` · **5 min** — Module 3 · Acquis et versement au classeur : j'écris le commentaire de mes indicateurs · j'adapte le niveau de lecture · je dispose d'une séquence de relance prête à l'emploi
- `pause` · **15 min** — Pause
- `objectif` · **5 min** — Module 4 · Résultat attendu : repérer seul, sans aide, le moment où l'IA se trompe sur un chiffre — et savoir quoi faire à ce moment-là
- `demonstration` · **5 min** — Module 4 · Démonstration avant/après : le même calcul demandé deux fois de suite, deux réponses différentes — et le geste de relecture qui l'attrape en dix secondes
- `pratique` · **25 min** — Module 4 · Chasse à l'erreur chronométrée, corrigé fourni au kit : une note financière et un calcul produits par l'IA contenant quatre erreurs de chiffre et deux affirmations non sourcées — chacun surligne, on compte, on compare au corrigé, on en tire la règle de relecture du service
- `pratique` · **30 min** — Module 4 · Atelier chronométré : monter son classeur de clôture assistée — trames de contrôle, formules documentées, trame de commentaire, séquence de relance, liste rouge du service, glossaire maison — rangé et nommé pour être rouvert à la prochaine clôture
- `verification` · **15 min** — Module 4 · Évaluation des acquis : quiz individuel de validation (10 questions) corrigé en salle, puis auto-évaluation d'une production du jour sur la grille de relecture du classeur
- `synthese` · **5 min** — Module 4 · Feuille de route : trois usages à installer avant la prochaine clôture, qui les tient, et ce qu'on vérifie au bout d'un mois

---

## ia-pour-le-juridique

420 min programmées · 235 min de pratique · **56 %**

**Livrable** : Le dossier de cadrage IA du service juridique — un document unique assemblé et emporté par le participant, comprenant : (1) la grille de qualification des documents (soumissible tel quel / après traitement / jamais soumissible) ; (2) sa grille de points de vigilance issue de ses propres positions types ; (3) le document type du quotidien produit en séance (mise en demeure, résiliation, réponse à réclamation ou réponse à NDA) ; (4) les trois articles de charte d'usage adaptés, accompagnés de la liste cochée des actions restant à mener pour les rendre opposables ; (5) la grille de relecture ; (6) la note d'une page à remettre à la direction. Ce n'est ni un « espace de travail persistant » ni une « bibliothèque de prompts » : c'est une pièce écrite, datée, adressée à un destinataire interne, qui se présente et se fait valider — le format naturel de sortie d'un juriste.

**Corrections apportées**
- Ratio recalculé séquence par séquence et vérifié par script : 235 min de pratique+vérification sur 420 dues = 56 %. Le passage précédent annonçait « 245 min sur 390, soit 63 % », chiffre non reconstituable (le décompte réel du contrôle donnait 55 %).
- Total porté à 420 min exactement : 390 min pédagogiques + 2 pauses de 15 min déclarées comme séquences de type « pause ». Le déjeuner est retiré du programme (il n'est pas du face-à-face). Le passage précédent ne programmait que 390 min sur 420 dues, soit 30 min vendues et non écrites.
- Les 15' « Ce que la direction va vous demander » (purement descendantes) sont supprimées : leur contenu factuel passe dans le cadre « règlement européen » et le reste devient de l'atelier.
- Les 10' « La règle qui en découle » du Module 4 deviennent une vérification de 10' : chacun réécrit une des cinq erreurs de la chasse à l'hallucination en formulation vérifiable et nomme la source.
- Animabilité de la charte : les trois articles ne sont plus rédigés ex nihilo mais ADAPTÉS à partir d'articles types pré-rédigés fournis, la liste d'opposabilité est fournie à cocher, et l'intitulé écrit explicitement « le formateur n'arbitre aucune formulation : la salle qualifie, le service juridique tranche ».
- Formule de refus assumée installée dès le Module 1 (10') et réemployée au Module 3 (« écrire la phrase de refus pour toute demande qui sort de ce cadre ») — la parade utilisée sur la fiche banque-assurance est maintenant présente ici.
- Le règlement européen sur l'IA est nommé explicitement, avec ses articles : littératie IA (art. 4), transparence sur les contenus générés (art. 50), et la raison pour laquelle un service juridique d'entreprise ne relève pas de l'annexe III §8 (réservée aux autorités judiciaires).
- Sections renommées « Matin · » / « Après-midi · » pour que deriveProgrammeSchedule ne fasse plus démarrer les quatre modules à 9 h 00 ; les pauses portent une durée numérique (15) que parseDurationMin reconnaît, donc l'horloge avance.
- Module 2 doté d'une synthèse (5') ; Module 4 doté d'une démonstration (10', naissance d'une référence inventée) et d'une synthèse (5'). Les quatre modules se déclinent désormais en objectif / démonstration / pratique / vérification / synthèse.
- Module 3 réordonné : le cadre réglementaire ouvre le module, et la démonstration de l'écart sur la veille précède l'atelier de veille puis l'atelier de charte (elle arrivait après les deux ateliers).
- « Un seul outil » ajouté à toutes les démonstrations (M1 15', M2 ×2, M3 10', M4 10'), en plus de « prompt affiché en entier ».
- Garde-fou biais/hallucination remonté au Module 2 (10', avant l'atelier de synthèse de contrat) : article inexistant, décision plausible mais introuvable, et la tendance à lisser en faveur de la partie qui a rédigé. Il n'était enseigné qu'au Module 4, après trois ateliers de production.
- Les 15' de lecture des conditions d'utilisation deviennent un atelier éclair sur extraits fournis (surligner les quatre clauses qui décident du régime), au lieu d'un exposé — +15 min de pratique sans perte de contenu.
- Livrable changé : « espace de travail du service juridique » (trop proche d'« espace de travail persistant », déjà employé par plusieurs fiches) → « dossier de cadrage IA du service juridique », pièce écrite adressée à la direction.

> **À faire relire** — 1) RÉFÉRENCES JURIDIQUES À FAIRE RELIRE PAR UN JURISTE AVANT PUBLICATION — le programme officiel est opposable en audit et cette fiche s'adresse au public le plus à même de contester. Trois citations sont introduites au Module 3 (cadre 15') : règlement (UE) 2024/1689 sur l'IA — article 4 (obligation de littératie IA des personnels, applicable depuis le 2 février 2025), article 50 (obligations de transparence sur les contenus générés, entrée en application le 2 août 2026), et annexe III §8 (systèmes destinés à l'administration de la justice, réservée aux autorités judiciaires — d'où la conclusion qu'un service juridique d'entreprise n'y entre pas). Vérifier la numérotation, les dates d'applicabilité et surtout que la conclusion sur l'annexe III §8 ne soit pas lue comme un blanc-seing : un usage RH ou crédit du même service basculerait, lui, en haut risque (annexe III §4 et §5).

2) OPPOSABILITÉ DE LA CHARTE — la séquence de 20' fait cocher « consultation des représentants du personnel, dépôt, information des salariés ». Ce régime est celui du règlement intérieur (art. L.1321-4 du code du travail) et ne s'applique qu'à une charte porteuse de règles disciplinaires ou d'hygiène et sécu

### Programme

**Matin · Module 1 — Ce qu'on a le droit de soumettre, et à quel outil**

- `objectif` · **5 min** — Objectif du module : qualifier tout document AVANT de l'ouvrir dans un outil, et savoir dire non
- `cadre` · **10 min** — La règle du métier et la formule de refus assumée (« cette question relève du conseil, je ne la traite pas avec l'outil ») ; les trois régimes d'usage : compte grand public, offre entreprise avec engagement contractuel de non-réutilisation, environnement validé par votre DSI
- `cadre` · **20 min** — Deux verrous à ne pas confondre : (1) les données personnelles — pseudonymiser n'est pas anonymiser, démonstration de ré-identification à partir de trois champs d'un contrat ; (2) la clause de confidentialité, que l'anonymisation ne lève PAS — l'éditeur de l'outil reste un tiers tant qu'aucun engagement contractuel ne le lie
- `demonstration` · **15 min** — Avant / après sur un texte que vous fournissez : la même demande sans cadre, puis avec la méthode AXION — Acteur, conteXte, Intention, Output, Normes — prompt affiché en entier, un seul outil
- `pratique` · **15 min** — Atelier éclair chronométré sur extraits fournis : dans les conditions d'utilisation de trois outils, surligner les quatre clauses qui décident du régime d'usage (réutilisation des contenus, sous-traitance de données, localisation, durée de conservation) et conclure le régime de chacun
- `pratique` · **25 min** — Atelier chronométré en binôme, grille de qualification fournie : classer cinq documents du quotidien (NDA reçu, CGV, contrat client, courrier de mise en demeure, note interne) en soumissible tel quel / soumissible après traitement / jamais soumissible, et justifier chaque réponse par écrit
- `verification` · **10 min** — Contrôle croisé entre binômes sur le corrigé fourni : les cinq qualifications attendues, leur justification, et les deux pièges du jeu (le NDA qui interdit la communication à tout tiers, la note interne nominative)
- `synthese` · **5 min** — Acquis du module en trois actions : je qualifie avant d'ouvrir · je lis des conditions d'utilisation comme un contrat · je sais ce que l'anonymisation ne règle pas
- `pause` · **15 min** — Pause — 15 minutes

**Matin · Module 2 — Lire et synthétiser un contrat sous sa propre grille**

- `objectif` · **5 min** — Objectif du module : produire une synthèse de contrat qui PRÉPARE votre relecture, jamais qui la remplace
- `demonstration` · **10 min** — Déposer un fichier : contrat scanné, PDF de cent pages, annexes et pièces jointes — les trois causes d'échec du dépôt (scan sans texte reconnu, document tronqué en silence, tableau désaligné) et comment les traiter — un seul outil
- `demonstration` · **15 min** — Avant / après : synthèse libre face à synthèse sous grille imposée — prompt affiché en entier, un seul outil ; puis la borne écrite sur la comparaison de versions : l'IA oriente la relecture, l'exhaustivité reste au comparateur du traitement de texte
- `cadre` · **10 min** — Garde-fou posé AVANT l'atelier : ce que l'IA invente et ce vers quoi elle penche — article inexistant, décision plausible mais introuvable, synthèse qui lisse systématiquement en faveur de la partie qui a rédigé ; règle du service : une référence n'existe que si vous l'avez ouverte à la source
- `pratique` · **15 min** — Chacun construit SA grille de points de vigilance à partir de sa position type — liste de référence fournie à ordonner, pondérer et compléter : responsabilité, clause limitative de responsabilité, résiliation, pénalités, exclusivité, force majeure, prescription, sous-traitance de données
- `pratique` · **35 min** — Atelier chronométré : chacun applique sa grille à un contrat du jeu fourni — ou à un document dont il maîtrise le régime de confidentialité — et produit la synthèse plus la liste des questions à poser
- `verification` · **10 min** — Contrôle croisé en binôme sur grille de relecture fournie : clause manquée, affirmation non sourcée, point que la synthèse a lissé, question qui n'a pas été posée
- `synthese` · **5 min** — Acquis du module en trois actions : j'impose ma grille au lieu de subir la synthèse · je vérifie chaque référence à la source · je renvoie l'exhaustivité au comparateur

**Après-midi · Module 3 — Documents types, et ce que la direction va vous demander**

- `objectif` · **5 min** — Objectif du module : produire ce qui se réutilise, et savoir répondre à la question que la direction va poser — « qu'a-t-on le droit de faire avec l'IA ? »
- `cadre` · **15 min** — Le règlement européen sur l'IA, références en main : obligation de littératie IA des équipes (article 4, applicable depuis février 2025), obligations de transparence sur les contenus générés (article 50), et pourquoi un service juridique d'entreprise ne relève PAS de l'annexe III §8, réservée aux autorités judiciaires — le formateur donne les références et le texte, il n'arbitre pas : la salle qualifie, le service juridique tranche
- `pratique` · **20 min** — Atelier chronométré : produire un document type réutilisable du quotidien à partir de sa propre trame — mise en demeure, courrier de résiliation, réponse à réclamation, ou réponse à un NDA reçu
- `demonstration` · **10 min** — Pourquoi on ne fait pas de veille avec un outil généraliste : le même article demandé de mémoire, puis le texte fourni au modèle — l'écart montré à l'écran, les deux prompts affichés en entier, un seul outil
- `pratique` · **10 min** — Atelier chronométré : interroger et reformuler un texte réglementaire que VOUS fournissez (le seul geste tenable), puis écrire la phrase de refus pour toute demande qui sort de ce cadre
- `pratique` · **20 min** — Atelier chronométré sur trois articles types PRÉ-RÉDIGÉS et fournis : les adapter au vocabulaire de votre entreprise — ce qui est permis, ce qui est interdit, qui tranche en cas de doute — puis cocher dans la liste fournie ce qu'il reste à faire pour rendre la charte opposable (consultation des représentants du personnel, dépôt, information des salariés) ; le formateur n'arbitre aucune formulation
- `verification` · **10 min** — Contrôle croisé en binôme sur grille fournie : un article non applicable en l'état, une interdiction non vérifiable, une décision sans décideur nommé, une action d'opposabilité oubliée
- `synthese` · **5 min** — Acquis du module en trois actions : je produis un document type réutilisable · je ne fais de veille que sur un texte que j'ai fourni · je sais quelles références citer quand la direction demande le fondement
- `pause` · **15 min** — Pause — 15 minutes

**Après-midi · Module 4 — Hallucinations, limites, et mise en service**

- `objectif` · **5 min** — Objectif du module : reconnaître une référence inventée AVANT qu'elle ne sorte du service
- `demonstration` · **10 min** — Comment naît une référence inventée : la même question posée deux fois, avec puis sans le texte fourni — les deux prompts affichés en entier, un seul outil, la variable modifiée surlignée
- `pratique` · **25 min** — Chasse à l'hallucination juridique, chronométrée : un texte fourni contenant trois références fausses et deux approximations — chacun surligne, on compte, corrigé fourni et discuté
- `verification` · **10 min** — Correction en salle et règle exercée : chacun réécrit une des cinq erreurs en formulation vérifiable et nomme la source qu'il aurait dû ouvrir — le périmètre du conseil ne se délègue pas, et l'IA n'est jamais l'auteur d'une position du service
- `pratique` · **15 min** — Atelier chronométré : assembler son dossier de cadrage IA — grille de qualification, grille de vigilance, document type produit, articles de charte adaptés, grille de relecture — et rédiger la note d'une page destinée à la direction
- `verification` · **15 min** — Évaluation des acquis : quiz individuel de validation (10 questions) corrigé en salle, puis auto-évaluation d'une production du jour sur la grille de relecture
- `synthese` · **5 min** — Acquis-actions de la journée : trois usages à installer dès la semaine suivante, et les deux sujets à remonter à la direction (régime d'usage à trancher, charte à faire adopter)

---

## ia-pour-la-production

840 min programmées · 540 min de pratique · **64 %**

**Livrable** : Le classeur de bord de l'atelier, entièrement produit par le participant en séance : la liste rouge écrite de son atelier, une consigne de poste, un compte rendu de prise de poste dicté, un mode opératoire relu en binôme, un document de sécurité prêt au visa HSE (causerie, analyse d'aléa ou fiche de non-conformité), le commentaire mensuel de ses indicateurs, et le suivi hebdomadaire de son relevé d'atelier avec son jeu d'essai, son cas limite et sa procédure de retour arrière. Ce n'est ni un espace de travail persistant ni une bibliothèque de prompts : c'est un jeu de pièces d'atelier remplies avec les données réelles du participant, qui sortent de la salle utilisables telles quelles, chacune adossée à sa grille de relecture.

**Corrections apportées**
- Sous-programmation comblée : 745' → 840' exactement (4 demi-journées de 210'). Les 95 minutes manquantes ont été affectées à des ateliers supplémentaires, pas à de l'exposé allongé.
- Ratio de pratique 43 % → 64 % (540 min de pratique + vérification, dénominateur = 840 min dues, pas les minutes écrites). Le Matin J1, qui portait 95 minutes d'exposé consécutif avant la première pratique, en porte désormais 55 avant une pratique de 25' sur la liste rouge.
- Séquence HSE descendante de 25' ramenée à 10' de cadrage strictement procédural (ce que l'IA prépare / ce que le HSE valide / ce qui ne s'affiche jamais sans visa), trames pré-rédigées renvoyées au kit, et interdiction écrite au formateur d'arbitrer une question de réglementation HSE en salle. Les 15' récupérées sont passées en démonstration avant/après (10') et en relecture croisée (partie des 20').
- La qualification juridique entre dans le programme livré et non plus dans la justification : « usage à haut risque au sens de l'annexe III, point 4 b) du règlement européen sur l'IA » est écrit dans l'intitulé de séquence, avec l'art. 26 §7 du règlement, L.1222-4 et L.2312-38 du code du travail, et le traitement explicite des biais (équipe de nuit, postes formateurs, opérateurs en reprise).
- Chaque demi-journée ouvre désormais par une séquence de type « objectif » formulant un résultat observable et daté (le premier des cinq blocs manquait sur les quatre demi-journées).
- Une démonstration avant/après ajoutée au Matin J2 (causerie sécurité sur trame fournie), qui n'en portait aucune. Les quatre demi-journées en portent maintenant au moins une, prompt affiché en entier et un seul outil à chaque fois.
- Livrable changé : « L'espace de travail IA de l'atelier » devient « Le classeur de bord de l'atelier » — ni espace de travail persistant, ni bibliothèque de prompts. La composante automatisation est bornée au relevé d'atelier (suivi hebdomadaire à partir d'un relevé brut) et dite comme telle, pour que la fiche cesse d'être interchangeable avec ia-pour-l-it et ia-pour-l-automatisation.
- « Le commentaire autour du chiffre » (30' descendant) converti en cadre 10' + pratique 35' avec vérification de chaque chiffre contre sa source.
- « Formaliser ce qui se fait sans être écrit » (30' descendant) converti en démonstration 15' + pratique 40' + relecture croisée 20'.
- « Fiabiliser » (20' descendant) converti en pratique 25' : chacun fait tourner son jeu d'essai, y glisse un cas limite et écrit sa procédure de retour arrière.
- Garde-fous replacés avant l'atelier qui les met en jeu : régimes d'usage et liste rouge (pseudonymiser ≠ anonymiser) ouvrent le Matin J1 avant toute manipulation de données réelles ; la règle du visa HSE est posée en cadre 5' AVANT l'exercice de traduction de consigne (elle arrivait après dans la version précédente) ; le cadre haut risque et le test de qualification précèdent le prototypage.
- Pauses déclarées comme séquences typées « pause » (4 × 15' = 60', comptées dans les 840'). Aucun déjeuner n'apparaît ni n'est compté.
- Une vérification corrigée en salle à la fin de chaque demi-journée, plus une vérification intermédiaire après la chasse à l'erreur et après la pratique du compte rendu — le quiz final unique de 10 questions est conservé mais adossé à une évaluation de la production sur grille.

> **À faire relire** — 1) RÉFÉRENCES JURIDIQUES À FAIRE RELIRE — quatre citations entrent dans le programme officiel et dans les documents remis au client, dont potentiellement une note au CSE : (a) règlement européen sur l'IA, annexe III point 4 b) — vise bien les systèmes destinés à surveiller et évaluer la performance et le comportement des travailleurs, ce qui couvre cadences, temps par poste et rebuts par opérateur ; (b) art. 26 §7 du même règlement — obligation, pour le déployeur employeur, d'informer les représentants du personnel et les travailleurs concernés AVANT mise en service ; (c) art. L.1222-4 du code du travail — aucune information personnelle ne peut être collectée par un dispositif non porté préalablement à la connaissance du salarié ; (d) art. L.2312-38 du code du travail — information-consultation du CSE préalable à la décision de mise en œuvre de moyens ou techniques permettant un contrôle de l'activité des salariés. Ces quatre références me paraissent correspondre à l'obligation décrite, mais elles doivent être validées par un juriste avant publication. À noter : le contrôle du 6 août relève que ia-pour-les-rh cite L.1221-9 pour l'information du CSE — c'est faux, le bon article est 

### Programme

**Matin J1 — Le socle : ce qui se pratique à l'atelier, et ce qui ne sort jamais de l'entreprise**

- `objectif` · **10 min** — Objectif du matin : à midi, chacun a écrit la liste rouge de son atelier et produit une consigne de poste qui la respecte — tour de table minuté, chacun nomme l'écrit qu'il veut avoir réglé ce soir
- `cadre` · **20 min** — Les trois régimes d'usage : compte grand public, offre entreprise avec engagement de non-réutilisation, environnement validé par votre DSI — et le geste « je regarde où passent mes données avant de coller »
- `cadre` · **15 min** — Ce qui ne sort jamais de l'atelier : plans, prix de revient, données clients, données nominatives de salariés — et pourquoi retirer un nom ne suffit pas : pseudonymiser n'est pas anonymiser, un compte rendu d'équipe reste ré-identifiable
- `pratique` · **25 min** — Pratique : chacun écrit la liste rouge de SON atelier sur la trame fournie (colonne « jamais » / colonne « à neutraliser » / colonne « libre »), puis confrontation en binôme et arbitrage des cas litigieux en salle
- `pause` · **15 min** — Pause
- `demonstration` · **20 min** — Démonstration avant / après : un compte rendu de prise de poste rédigé à la main, puis le même avec l'IA — un seul outil, consigne affichée en entier à l'écran, y compris ce qui a raté au premier essai
- `demonstration` · **15 min** — La méthode AXION en 5 leviers — Acteur, conteXte, Intention, Output, Normes — démontrée levier par levier sur une consigne de poste, consigne affichée en entier
- `pratique` · **30 min** — Pratique 1 : chacun rédige avec AXION la consigne de poste réelle de son atelier, en respectant sa propre liste rouge
- `pratique` · **25 min** — Pratique 2 : échange des consignes en binôme, retour sur la grille d'auto-évaluation fournie, puis chacun reprend sa consigne
- `verification` · **25 min** — Vérification corrigée en salle : 5 questions sur les régimes d'usage et la liste rouge, puis passage de trois consignes produites au vidéoprojecteur avec la grille (destinataire nommé, contexte suffisant, format attendu, contrainte de sécurité)
- `synthese` · **10 min** — Synthèse : les deux gestes que j'applique dès cet après-midi, écrits sur ma fiche de route personnelle

**Après-midi J1 — Les écrits du terrain : compte rendu de poste et mode opératoire**

- `objectif` · **5 min** — Objectif de l'après-midi : à 17 h, chacun a dans son classeur un compte rendu de poste et un mode opératoire de son atelier, produits et relus en séance
- `demonstration` · **20 min** — Déposer, dicter, photographier — démonstration avant / après : trois minutes dictées après le point de production deviennent un compte rendu, des décisions et des points à relancer (consigne affichée en entier), puis ce qui fait échouer l'exercice : scan sans texte reconnu, photo de tableau désalignée, dictée sans nommer les postes
- `pratique` · **40 min** — Pratique 1 : chacun dicte son point de production ou sa prise de poste et produit le compte rendu — téléphone accepté, on travaille debout comme au poste
- `verification` · **15 min** — Vérification corrigée en salle : trois comptes rendus passés à la grille fournie (faits / décisions / à relancer), et repérage collectif de ce que la machine a ajouté et que personne n'a dit
- `pause` · **15 min** — Pause
- `demonstration` · **15 min** — Démonstration avant / après : du geste raconté au mode opératoire structuré sur une opération d'atelier — trame fournie, consigne affichée en entier
- `pratique` · **40 min** — Pratique 2 : chacun produit le mode opératoire d'une opération réelle de son atelier à partir de la trame fournie
- `pratique` · **20 min** — Pratique 3 : relecture croisée en binôme sur la grille fournie (exactitude, ordre des étapes, points de sécurité, réutilisabilité), puis reprise du mode opératoire par son auteur
- `cadre` · **5 min** — Règle posée avant l'exercice suivant : toute consigne à portée sécurité repart au visa du responsable HSE avant affichage — ce que l'IA prépare, ce qui ne s'affiche jamais sans visa
- `pratique` · **20 min** — Pratique 4 : traduire et simplifier — chacun reprend sa consigne en langage clair, puis dans la langue parlée par son équipe, et marque l'emplacement du visa HSE
- `verification` · **10 min** — Vérification corrigée en salle : 5 questions sur les entrées de matière et la règle du visa
- `synthese` · **5 min** — Synthèse du jour 1 : les deux écrits que je sais produire seul demain matin

**Matin J2 — Fiabiliser ce qui sort : chasse à l'erreur, documents de sécurité, commentaire d'indicateurs**

- `objectif` · **5 min** — Objectif du matin : à midi, chacun a compté les erreurs de la machine sur son propre process et préparé un document de sécurité prêt au visa HSE
- `pratique` · **30 min** — Pratique 1 — la chasse à l'erreur : on fait produire un texte sur VOTRE process, chacun surligne au feutre ce qui est faux sur sa propre impression, et on compte
- `verification` · **15 min** — Vérification corrigée en salle : mise en commun et construction du tableau des erreurs types (référence inventée, étape sautée, chiffre plausible et faux, consigne de sécurité adoucie) — ce que chacun change dans sa relecture
- `cadre` · **10 min** — Cadrage procédural des documents obligatoires : ce que l'IA prépare, ce que le responsable HSE valide, ce qui ne s'affiche jamais sans visa — les trames pré-rédigées (causerie, analyse d'aléa, fiche de non-conformité et action corrective) sont fournies au kit, le formateur n'arbitre aucune question de réglementation HSE et renvoie au responsable HSE du client
- `demonstration` · **10 min** — Démonstration avant / après sur une causerie sécurité à partir de la trame fournie — consigne affichée en entier, un seul outil
- `pause` · **15 min** — Pause
- `pratique` · **45 min** — Pratique 2 : chacun prépare un document réel de son atelier à partir de la trame fournie — causerie sécurité, analyse d'un aléa, ou fiche de non-conformité et action corrective
- `pratique` · **20 min** — Pratique 3 : relecture croisée en binôme sur la grille, puis reprise et marquage de l'emplacement du visa HSE avant classement
- `cadre` · **10 min** — On ne fait jamais calculer l'IA : le chiffre vient de votre système, l'IA n'écrit que le commentaire autour — pourquoi un modèle de langage produit un TRS plausible et faux, et le geste de recopier le chiffre depuis la source
- `pratique` · **35 min** — Pratique 4 : à partir d'indicateurs déjà calculés (TRS, rebuts, plan de charge — jeu fourni pour ceux qui n'ont pas les leurs), chacun rédige le commentaire du mois de son atelier et vérifie chaque chiffre contre sa source
- `verification` · **10 min** — Vérification corrigée en salle : 5 questions sur les erreurs types et la règle du calcul
- `synthese` · **5 min** — Synthèse : les trois documents que je ne repousserai plus

**Après-midi J2 — Automatiser un relevé d'atelier, jamais un jugement sur une personne**

- `objectif` · **5 min** — Objectif de l'après-midi : à 17 h, chacun a qualifié son cas d'automatisation et fait tourner un suivi hebdomadaire sur son propre relevé d'atelier
- `cadre` · **20 min** — Ce qu'on n'automatise jamais sur une personne : suivre les cadences, les temps par poste ou les rebuts par opérateur relève du suivi de la performance et du comportement des travailleurs — usage à haut risque au sens de l'annexe III, point 4 b) du règlement européen sur l'IA. Information préalable des salariés concernés et de leurs représentants (art. 26, §7 du règlement), information individuelle préalable (art. L.1222-4 du code du travail) et consultation du CSE avant mise en œuvre (art. L.2312-38). Où naissent les biais : un indicateur qui pénalise systématiquement l'équipe de nuit, les postes formateurs, ou les opérateurs en reprise
- `cadre` · **10 min** — Le test de qualification en 4 questions, à passer avant tout prototype : y a-t-il des données personnelles ? un effet sur une personne ? une obligation de sécurité engagée ? une décision prise sans relecture humaine ? — une seule réponse « oui » stoppe le prototype et renvoie à la direction et au CSE
- `pratique` · **20 min** — Pratique 1 : chacun passe son idée d'automatisation au test des 4 questions, écrit son verdict sur la fiche fournie, et les cas litigieux sont arbitrés en salle
- `demonstration` · **15 min** — Démonstration avant / après : un relevé d'atelier brut (colonnes en vrac, dates hétérogènes) devient un suivi hebdomadaire lisible — un seul outil, consigne affichée en entier
- `pause` · **15 min** — Pause
- `pratique` · **45 min** — Pratique 2 : chacun construit le suivi hebdomadaire de son propre relevé d'atelier — uniquement sur un cas qui a passé le test des 4 questions
- `pratique` · **25 min** — Pratique 3 — fiabiliser : chacun fait tourner son jeu d'essai, y glisse un cas limite (ligne vide, unité changée, semaine à 4 jours), écrit le signal à émettre quand le résultat est douteux et sa procédure de retour arrière
- `verification` · **25 min** — Évaluation des acquis corrigée en salle : quiz individuel de 10 questions, puis évaluation de la production d'atelier sur la grille fournie (exactitude, sécurité, structure, réutilisabilité)
- `pratique` · **20 min** — Pratique 4 : chacun assemble et nomme son classeur de bord d'atelier — liste rouge, consigne, compte rendu, mode opératoire, document visé, commentaire d'indicateurs, suivi hebdomadaire et procédure de retour arrière — et note où il le range pour le rouvrir lundi
- `synthese` · **10 min** — Synthèse et feuille de route : trois usages et une automatisation à installer, un porteur et une échéance par ligne

---

## ia-pour-les-achats

420 min programmées · 245 min de pratique · **58 %**

**Livrable** : Le dossier d'arbitrage fournisseur — constitué page par page par le participant pendant la journée et utilisable dès le lendemain : (1) la liste rouge de son service, en tête de dossier ; (2) sa grille de comparaison pondérée (coût complet, délai, incoterm, pénalité de retard, garanties, panel) ; (3) le comparatif réel de ses trois devis, totaux recalculés à la main et questions à reposer à chaque fournisseur ; (4) sa note d'arbitrage d'une page prête pour le décideur ; (5) sa séquence de relance à trois niveaux, dont un niveau en anglais ; (6) son courrier de réserve à réception, confronté aux modèles validés du kit ; (7) sa préparation de négociation (limite basse, réponses aux trois objections, plan B) ; (8) sa feuille de route à trois usages, avec un responsable et une date. Il diffère de l'« espace de travail persistant » (qui est un contenant d'outils, employé par quatre fiches généralistes) et de la « bibliothèque de prompts » (qui n'est jamais rouverte) : c'est une pièce de dossier achat sur un fournisseur réel, qui part au décideur, pas un classeur de méthode.

**Corrections apportées**
- BLOQUANT levé — ratio de pratique porté de 44,9 % à 58 % (245 min de pratique et vérification sur 420 min dues). Les minutes ont été prises sur des séquences descendantes converties en application immédiate, pas ajoutées : « Déposer trois devis » (20' d'exposé → 15' de pratique), « Écrire le besoin » (15' d'exposé → 10' de pratique sur trame), « Le litige à réception » (20' d'exposé → 10' de cadre + 20' de pratique comparée aux modèles du kit).
- MAJEUR levé — Module 1 rééquilibré : la pratique passe de 15 à 45 minutes (dont vérification) et le plus long bloc descendant consécutif tombe de 65 à 20 minutes. « Les trois régimes d'usage » ramené de 25' à 15', suivi immédiatement d'une pratique de 10' où chacun vérifie sur son propre poste sous quel régime il travaille ; le bloc confidentialité passe de 20' à 20' mais absorbe désormais le règlement européen sur l'IA et le RGPD, puis débouche directement sur 25' de pratique.
- MAJEUR levé — dérivation horaire réparée : DEUX sections seulement, « Matin — … » et « Après-midi — … », les quatre modules devenant des repères (« M1 · », « M2 · »…) dans les intitulés de séquences. Avec quatre sections dont deux commençaient par « Matin », deriveProgrammeSchedule() remettait l'horloge à 9 h à chaque section et le module 2 recouvrait intégralement le module 1. Le matin court désormais 9 h 00 → 12 h 30 et l'après-midi 14 h 00 → 17 h 30, sans recouvrement.
- MAJEUR levé — animabilité du litige à réception. Ce n'est plus « écrire un courrier qui tient » (arbitrage juridico-commercial qu'un formateur IA non acheteur ne peut ni porter ni corriger), mais : 10' de cadre lu à la trame fournie, puis 20' où chacun écrit son courrier et le confronte phrase à phrase à TROIS modèles validés du kit (réserve à réception, retard de livraison, non-conformité). Le modèle fait foi, il ne se modifie pas en séance, et toute question de fond est notée pour le juriste du client. Le formateur corrige un écart à un modèle, pas un fond de droit.
- MAJEUR levé — la séquence « Le tableur assisté » (15', descendante, compétence neuve sans pratique à 45 minutes de la fin, doublon des 40' d'atelier tableur de ia-pour-la-finance) est supprimée. Les minutes sont redistribuées sur la chasse à l'erreur (20') et sur la production de la note d'arbitrage (15').
- MAJEUR levé — le Module 4 porte enfin une démonstration avant / après (10' : la note d'arbitrage écrite à la main, puis produite à partir du comparatif du matin) et se décline donc en cinq blocs complets, comme les trois autres.
- MINEUR levé — chaque module ouvre sur une séquence « objectif » de 5 minutes énonçant un résultat observable (4 × 5' = 20'), prises sur des séquences descendantes, pas ajoutées au total.
- Garde-fous entièrement remontés avant les gestes qui les mettent en jeu : régimes d'usage, secret des affaires, données personnelles des fournisseurs personnes physiques, pseudonymisation, règlement européen sur l'IA et RGPD art. 22 sont tous en Module 1, AVANT le dépôt des devis (M2) et avant l'atelier comparatif. Dans le squelette d'origine, l'atelier du M2 faisait exactement ce que le M4 allait interdire.
- Le règlement européen sur l'IA et la question des biais entrent dans le PROGRAMME, plus seulement dans les justifications : le règlement (UE) 2024/1689 est nommé en M1 (obligation de former les utilisateurs, transparence, interdiction du classement automatique d'un fournisseur personne physique), et la démonstration de biais de 15' en M2 montre le même lot de devis classé différemment par deux grilles — juste avant l'atelier de comparaison.
- Livrable changé : « l'espace de travail achats du service » proposé par la révision précédente reprenait mot pour mot le reproche fait à la bibliothèque de prompts (même artefact sur quatre fiches généralistes sous un autre nom). Remplacé par le dossier d'arbitrage fournisseur, pièce de dossier sur un fournisseur réel. La séquence dédiée de 15' « L'espace de travail du service » disparaît du M4.
- Le déjeuner n'est pas déclaré comme séquence : il est matérialisé par la bascule de section (fin du matin 12 h 30, reprise 14 h 00) et ne consomme aucune des 420 minutes dues. Les deux pauses de 15 minutes, elles, sont bien déclarées comme séquences de type pause et comptées dans le face-à-face.
- Note pour la mise en catalogue : les deux pauses doivent porter une durée numérique (temps: "15'") et non le libellé « Pause », faute de quoi parseDurationMin() renvoie null et l'horloge de la timeline publique n'avance pas de 30 minutes sur la journée.

> **À faire relire** — 1) RÉFÉRENCES JURIDIQUES À FAIRE RELIRE — quatre citations entrent dans le programme opposable et dans les documents remis. (a) Règlement (UE) 2024/1689 sur l'IA, art. 4 : obligation pour fournisseurs et déployeurs d'assurer un niveau suffisant de maîtrise de l'IA chez leurs utilisateurs, applicable depuis le 2 février 2025 — vérifier le numéro d'article et la formulation. (b) RGPD art. 22 : décision individuelle entièrement automatisée — invoqué pour le classement automatique d'un fournisseur personne physique ; le rattachement est défendable mais mérite confirmation, un classement de devis n'est pas toujours une « décision produisant des effets juridiques ». (c) Art. L.151-1 du code de commerce : définition de l'information protégée au titre du secret des affaires — invoqué pour les tarifs négociés et le coût de revient. (d) Art. L.441-10 du code de commerce : délais de paiement et pénalités de retard de PAIEMENT entre professionnels. La séquence M3 distingue volontairement cette pénalité légale de la pénalité de retard de LIVRAISON, purement contractuelle — c'est la confusion la plus fréquente chez les acheteurs, et c'est le point exact à faire valider. Aucune de ces quatre cita

### Programme

**Matin — Cadre d'usage et comparaison de devis (modules 1 et 2)**

- `objectif` · **5 min** — M1 · Objectif du module : à la fin, chacun sait ce qu'il peut coller, ce qu'il ne colle jamais, et repart avec son devis de travail prêt — chacun nomme en une phrase le cas qu'il veut avoir traité ce soir
- `demonstration` · **15 min** — M1 · Démonstration avant / après sur un devis : la comparaison faite à la main, puis la même avec l'IA — un seul outil, la consigne affichée en entier à l'écran ; ce qu'elle aligne (postes, écarts, questions à poser) et ce qu'elle ne calcule pas (totaux, stocks, prévisions)
- `cadre` · **15 min** — M1 · Les trois régimes d'usage et le geste « où passent mes données » : compte grand public, offre entreprise avec engagement écrit de non-réutilisation, environnement validé par la DSI — où lire la clause, en trois clics, sur chacun
- `pratique` · **10 min** — M1 · Pratique : chacun ouvre l'outil sur son poste, retrouve sous quel régime il travaille et où est écrit (ou absent) l'engagement de non-réutilisation, et note la réponse en tête de son dossier — tour de salle rapide sur les écarts
- `cadre` · **20 min** — M1 · Ce qui ne sort jamais, et pourquoi retirer un nom ne suffit pas : tarifs négociés, contrats, coût de revient (secret des affaires, art. L.151-1 du code de commerce) ; un devis reste couvert par sa clause de confidentialité même sans le nom du fournisseur ; un devis d'artisan, d'indépendant ou d'auto-entrepreneur porte des données personnelles — pseudonymiser n'est pas anonymiser. Ce qu'impose le règlement européen sur l'IA (UE 2024/1689) à un service achats : former ses utilisateurs (art. 4), dire ce qui a été écrit avec l'IA, et ne jamais laisser une machine classer seule un fournisseur personne physique (RGPD art. 22) — la décision reste signée par un acheteur
- `pratique` · **25 min** — M1 · Pratique : chacun écrit la liste rouge de son service sur la trame à trois colonnes du kit (jamais / seulement en offre entreprise / libre), la fait relire par son voisin qui doit y trouver un oubli, puis prépare son devis de travail exploitable — c'est la matière de tous les ateliers de la journée
- `verification` · **10 min** — M1 · Vérification corrigée en salle : 5 cas concrets projetés (« je colle / je ne colle pas / je reformule »), chacun répond par écrit, correction et vote à main levée sur les deux cas qui divisent
- `synthese` · **5 min** — M1 · Synthèse : les deux gestes que je fais avant chaque copier-coller, et la phrase que je dis au collègue qui veut coller un contrat fournisseur
- `pause` · **15 min** — Pause café — 15 minutes, comptées dans le face-à-face
- `objectif` · **5 min** — M2 · Objectif du module : à la fin, chacun a produit un comparatif de trois devis réels, avec ses propres critères, ses totaux recalculés à la main et ses questions à reposer à chaque fournisseur
- `pratique` · **15 min** — M2 · Pratique : déposer ses trois devis (PDF, scan, tableau) et repérer immédiatement ce qui fait échouer l'exercice — scan sans texte reconnu, tableau qui se désaligne, page manquante. Test de contrôle fourni : faire recopier trois montants tirés au hasard et les confronter au document d'origine
- `demonstration` · **15 min** — M2 · Démonstration de biais : le même lot de devis comparé avec deux grilles différentes donne deux classements différents — les deux consignes sont affichées en entier, côte à côte. Ce qu'il faut en retenir : la grille de comparaison vient de vous, l'IA ne fait qu'appliquer la vôtre, y compris quand elle est mauvaise
- `pratique` · **35 min** — M2 · Atelier : comparatif réel sur ses trois devis de travail — critères posés et pondérés (coût complet, délai, incoterm, pénalité de retard, garanties, panel existant), postes alignés, totaux recalculés à la main, questions à reposer à chaque fournisseur
- `pratique` · **10 min** — M2 · Pratique : du besoin flou à la consultation — chacun transforme deux lignes de besoin réel en trame de consultation structurée à partir du modèle du kit (objet, périmètre, critères de choix, pièces à fournir, délai de réponse)
- `verification` · **5 min** — M2 · Vérification : échange de comparatifs en binôme — trouver en cinq minutes une erreur de total et un critère manquant chez son voisin ; correction en salle sur les deux cas les plus fréquents
- `synthese` · **5 min** — M2 · Synthèse : ce que je ne délègue jamais dans un comparatif (les critères, les totaux, la décision), et l'ordre dans lequel je m'y prends la prochaine fois

**Après-midi — Relances, litiges, négociation et arbitrage (modules 3 et 4)**

- `objectif` · **5 min** — M3 · Objectif du module : à la fin, chacun a écrit sa séquence de relance à trois niveaux, un courrier de réserve confronté au modèle du kit, et tenu un face-à-face avec un fournisseur qui refuse
- `demonstration` · **15 min** — M3 · Démonstration avant / après : d'un fil d'e-mails embrouillé sur une commande en retard à une relance calibrée sur la relation — un seul outil, la consigne affichée en entier, y compris la partie qui décrit le ton et ce qu'il ne faut pas écrire
- `pratique` · **30 min** — M3 · Atelier 1 : chacun écrit ses trois niveaux de relance sur un dossier réel (rappel courtois, relance ferme, escalade au responsable), puis la version anglaise du niveau 2 pour un fournisseur étranger — aucune donnée de la liste rouge n'entre dans l'exercice
- `cadre` · **10 min** — M3 · Le cadre du litige à réception, lu à la trame du kit : réserve, non-conformité, mise en demeure — ce qu'on écrit et ce qu'on n'écrit jamais (pas de chiffrage de préjudice, pas de résiliation annoncée, pas de reconnaissance de responsabilité). Attention au vocabulaire : une pénalité de retard de livraison est une clause de VOTRE contrat, rien n'est automatique ; à ne pas confondre avec les pénalités de retard de paiement, dues de plein droit entre professionnels (art. L.441-10 du code de commerce)
- `pratique` · **20 min** — M3 · Pratique : chacun rédige son courrier de réserve à réception sur un cas réel, puis le compare phrase à phrase aux trois modèles validés fournis dans le kit (réserve à réception, retard de livraison, non-conformité) et surligne ses trois écarts — le modèle du kit fait foi et ne se modifie pas en séance ; toute question de fond est notée pour le juriste du client
- `pratique` · **25 min** — M3 · Atelier 2 : jeu de rôle — l'IA joue le fournisseur qui refuse (scénario, posture et trois objections fournis clés en main dans le kit). Chacun prépare ses réponses, sa limite basse et son plan B, puis passe cinq minutes devant son binôme, grille d'observation en main
- `verification` · **10 min** — M3 · Vérification corrigée en salle : trois relances anonymes projetées — dire laquelle engage l'entreprise plus que nécessaire, laquelle sera ignorée, et pourquoi ; correction argumentée
- `synthese` · **5 min** — M3 · Synthèse : les deux écrits que je produirai désormais en dix minutes, et celui que je ferai toujours relire avant envoi
- `pause` · **15 min** — Pause café — 15 minutes, comptées dans le face-à-face
- `objectif` · **5 min** — M4 · Objectif du module : à la fin, chacun sait faire tomber une note de marché inventée et repart avec son dossier d'arbitrage fournisseur prêt à être envoyé au décideur
- `demonstration` · **10 min** — M4 · Démonstration avant / après : la note d'arbitrage d'une page, d'abord telle qu'on l'écrit à la main aujourd'hui, puis produite à partir du comparatif du matin — consigne affichée en entier, sources du comparatif attachées
- `pratique` · **20 min** — M4 · Chasse à l'erreur : on fait produire une note de marché sur votre famille d'achat, chacun surligne ce qui est faux et on compte à voix haute — fournisseur inventé, référence inventée, prix plausible mais faux. Règle de vérification retenue : toute donnée chiffrée ou tout nom cité doit se retrouver dans une source à vous, sinon il disparaît
- `pratique` · **15 min** — M4 · Pratique : chacun rédige sa note d'arbitrage d'une page à partir de son propre comparatif (recommandation, deux risques, une question ouverte) et la classe dans son dossier d'arbitrage fournisseur
- `verification` · **15 min** — M4 · Évaluation des acquis : quiz individuel de 10 questions corrigé en salle, puis évaluation croisée du dossier d'arbitrage sur la grille du kit (critères posés, totaux recalculés, questions au fournisseur, liste rouge respectée, aucune donnée interdite soumise)
- `synthese` · **10 min** — M4 · Feuille de route et clôture : trois usages installés dans le service dès la semaine suivante, un responsable et une date pour chacun, écrits en dernière page du dossier

---

## ia-pour-la-relation-client

420 min programmées · 248 min de pratique · **59 %**

**Livrable** : Le référentiel de réponse de l'équipe support, produit en séance : trois fiches de base de connaissances opposables (un motif et un seul, une réponse validée, une date de revue, un propriétaire nommé), la trame de traitement de réclamation et la trame d'escalade vers le niveau 2, la liste rouge de ce qui ne se colle jamais, la grille des quatre contrôles avant envoi (le fait, l'engagement, le ton, les mentions) et la note de causes racines au responsable. Distinct de l'« espace de travail persistant » (qui est un contenant d'outil, pas un contenu opposable) et de la « bibliothèque de prompts » : ce référentiel ne contient aucune consigne d'IA, il contient les réponses validées et les règles d'envoi que l'équipe applique même sans IA.

**Corrections apportées**
- BLOQUANT ratio de pratique : 46 % (180 min) → 59 % (248 min sur 420 dues). Gisement pris là où le contrôle l'indiquait — « trois régimes d'usage » 25' → 12' de cadre + 8' de vérification appliquée (chacun classe l'outil réellement utilisé par son équipe et écrit ce qu'il a le droit d'y coller), « ce qu'on ne colle jamais » 20' → 15', neutralisation 15' → 25' — plus la reconstruction de la clôture (voir ligne suivante). Somme recalculée séquence par séquence, pas estimée.
- MAJEUR module 4 sans aucun atelier (80 min descendantes en fin de journée) : la « prise en main du livrable » (10') est fondue dans la feuille de route (5'), les 20' de cadre « frontière de transparence » sont remontées au matin, et les minutes libérées ouvrent un atelier de clôture de 20' (chacun applique les quatre contrôles à ses fiches et à sa réponse la plus fréquente). La demi-journée se termine désormais sur 65 min de production et d'évaluation, pas sur 45 min sans rien produire.
- MAJEUR garde-fou placé après l'usage qu'il encadre : la frontière de transparence passe du module 4 (dernière demi-heure) à une séquence de cadre de 15' au matin, avant le premier atelier. Les quatre garde-fous (régimes d'usage, liste rouge et limite de la pseudonymisation, transparence, biais) occupent désormais les minutes 30 à 80 de la journée, c'est-à-dire avant la première manipulation de données réelles.
- MAJEUR absent de la révision précédente : ni le règlement européen sur l'IA ni les biais n'étaient nommés. Ajout d'une séquence de cadre de 15' qui porte les trois règles d'envoi — informer le client qu'il échange avec un automate, ne jamais publier d'élément du dossier d'un client dans une réponse visible de tous, et repérer quand la réponse générée n'est pas la même selon le nom, la langue ou le ton du client (trois exemples fournis au kit).
- MAJEUR dérivation horaire : les quatre sections « Matin — Module 1 », « Matin — Module 2 », « Après-midi — Module 3 », « Après-midi — Module 4 » se recouvraient deux à deux, sectionStartMin() (src/content/formations/catalog-v2-schedule.ts:50) remettant l'horloge à 9 h 00 ou 14 h 00 à CHAQUE section. Le programme est ramené à deux sections, une « Matin » et une « Après-midi », chacune portant deux arcs pédagogiques complets. C'est le seul correctif possible côté contenu ; l'autre remède (cumul de l'horloge) est un correctif de code, signalé en alerte.
- MINEUR module 2 sans synthèse : il se terminait sur la chasse à l'erreur. Ajout de 5' d'acquis en fin de matinée, prélevées sur les 20' AXION ramenées à 15'.
- MINEUR module 3 sans démonstration avant / après : les 20' « Reprendre un dossier en cours » sont requalifiées en démonstration explicite (15') sur un historique fourni au kit, et l'atelier correspondant passe de 25' à 30'.
- MINEUR aucun module ne portait de séquence d'objectif : chaque demi-journée s'ouvre désormais sur un objectif formulé en résultat observable (« ce que chacun saura produire avant midi : deux réponses types et une réclamation traitée »).
- Livrable renommé : « l'espace de travail du support » proposé par la révision entrait en collision avec l'« espace de travail persistant » déjà employé par plusieurs fiches du catalogue. Remplacé par « le référentiel de réponse de l'équipe support », qui nomme le contenu opposable et non le contenant.
- Animabilité : toute séquence qui demandait au formateur une matière métier qu'il n'a pas déclare désormais sa fourniture au kit — ticket de démonstration, historique de vingt échanges, trois scénarios de client mécontent et trame d'escalade, jeu de verbatims neutralisés, cinq extraits de la vérification, grilles de contrôle croisé et grille de notation. Aucune séquence ne repose sur « le formateur expliquera ».

> **À faire relire** — 1) RÉFÉRENCE JURIDIQUE À FAIRE RELIRE. L'obligation « un client qui échange avec un automate doit le savoir » repose sur l'article 50, paragraphe 1, du règlement (UE) 2024/1689 sur l'intelligence artificielle (systèmes destinés à interagir directement avec des personnes physiques), dont l'application générale est fixée au 2 août 2026. La correspondance article / obligation a été vérifiée et paraît exacte, mais elle part dans le programme officiel opposable : à faire confirmer par un conseil avant publication. Choix fait dans la fiche : la séquence nomme « le règlement européen sur l'IA » sans écrire le numéro d'article, pour qu'une erreur de numérotation ne se propage pas dans le diaporama, le livret et les documents remis.

2) QUALIFICATION HAUT RISQUE — ARBITRAGE COMMERCIAL. La relation client générique n'est pas listée à l'annexe III du règlement : la journée est traitée comme un usage à obligation de transparence, pas comme un usage à haut risque, et ne comporte donc pas d'analyse d'impact. Cette qualification tombe si le support du client traite l'accès au crédit, à l'assurance, aux soins ou à un service public essentiel — ces usages basculent en annexe III. Décision à prendre

### Programme

**Matin — Le cadre du ticket, puis les réponses (modules 1 et 2)**

- `objectif` · **10 min** — Objectif du matin : « est-ce qu'on va nous remplacer ? » — ce que l'IA prend en charge, ce que le conseiller garde et valide, et ce que chacun saura produire avant midi (deux réponses types réutilisables et une réclamation traitée)
- `demonstration` · **20 min** — Démonstration avant / après sur un ticket fourni au kit : la même demande client traitée sans IA, puis avec — un seul outil, la consigne affichée en entier
- `cadre` · **12 min** — Les trois régimes d'usage : compte grand public, offre entreprise avec engagement de non-réutilisation, environnement validé par la direction — la seule question à se poser avant de coller un ticket
- `verification` · **8 min** — Appliqué et corrigé en salle : chacun classe l'outil réellement utilisé par son équipe dans l'un des trois régimes et écrit ce qu'il a le droit d'y coller
- `cadre` · **15 min** — La liste rouge : nom, adresse, numéro de dossier, pièce d'identité, moyen de paiement — et pourquoi retirer le nom ne suffit pas sur un historique de réclamation (pseudonymiser n'est pas anonymiser)
- `cadre` · **15 min** — Ce qui part au client : le règlement européen sur l'IA impose d'informer le client qu'il échange avec un automate ; rien du dossier d'un client ne se publie dans une réponse visible de tous ; et le biais — repérer quand la réponse générée n'est pas la même selon le nom, la langue ou le ton du client (trois exemples fournis au kit)
- `pratique` · **25 min** — Pratique : chacun neutralise trois demandes réelles (une simple, une réclamation, une hors périmètre) et constitue le jeu de travail de sa journée
- `verification` · **10 min** — Vérification corrigée en salle (5 questions) : sur cinq extraits fournis, ce qui peut être collé, ce qui doit être neutralisé, ce qui ne sort jamais
- `pause` · **15 min** — Pause café
- `objectif` · **5 min** — Objectif du module 2 : produire une réponse type réutilisable et une réclamation traitée, l'une et l'autre validées par un pair sur grille
- `demonstration` · **15 min** — La méthode AXION (Acteur, conteXte, Intention, Output, Normes) appliquée à une réclamation agressive — avant / après, consigne affichée en entier : le ton de la maison et les mentions obligatoires sont des Normes, pas une option
- `pratique` · **35 min** — Atelier : chacun traite les trois demandes de son jeu de travail, puis contrôle croisé en binôme sur la grille fournie (exactitude, engagement pris, ton, réutilisabilité)
- `verification` · **20 min** — La chasse à l'erreur, corrigée par la salle : repérer dans les réponses produites la garantie, le délai ou le geste commercial que personne n'a autorisés — on compte, chaque binôme annonce son score
- `synthese` · **5 min** — Acquis du matin : les deux gestes que j'applique dès le prochain ticket

**Après-midi — Dossiers en cours, base de connaissances et ce qui part au client (modules 3 et 4)**

- `objectif` · **5 min** — Objectif de l'après-midi : reprendre un dossier en cours en cinq minutes, transformer les réponses qui marchent en fiches opposables, et n'envoyer aucune réponse qui engage l'entreprise sans qu'on l'ait voulu
- `demonstration` · **15 min** — Démonstration avant / après sur un historique fourni au kit : d'un fil de vingt échanges aux faits, aux engagements déjà pris et à la prochaine action
- `pratique` · **30 min** — Atelier : chacun reprend un dossier en cours neutralisé et produit sa fiche de reprise ; le binôme vérifie qu'aucun engagement n'a été perdu ni inventé
- `pratique` · **25 min** — Atelier — jeu de rôle : l'IA joue le client mécontent qui revient une troisième fois (trois scénarios et la trame d'escalade fournis au kit) ; chacun conduit l'échange et rédige l'escalade vers le niveau 2
- `pause` · **15 min** — Pause café
- `pratique` · **20 min** — Atelier : ce que disent 200 demandes — chacun regroupe un jeu de verbatims neutralisés (fourni au kit) en causes racines et écrit la note d'une page au responsable
- `cadre` · **10 min** — Ce qui rend une fiche opposable : un motif et un seul, une réponse validée, une date de revue, un propriétaire nommé — et où la base vit, qui la maintient, qui la relit
- `pratique` · **30 min** — Atelier : chacun rédige ses trois premières fiches de base de connaissances à partir de ses réponses du matin
- `verification` · **10 min** — Vérification croisée : deux fiches par binôme passées à la grille (motif unique, réponse exacte, date de revue, propriétaire nommé)
- `demonstration` · **10 min** — Relire avant d'envoyer : les quatre contrôles — le fait, l'engagement, le ton, les mentions — démontrés sur une réponse produite le matin
- `pratique` · **20 min** — Atelier de clôture : chacun applique les quatre contrôles à ses fiches et à sa réponse la plus fréquente, et y pose la mention d'information du client posée le matin
- `verification` · **15 min** — Évaluation des acquis : quiz individuel (10 questions) et notation sur grille de trois productions d'atelier (une réponse type, une réclamation, une fiche de base de connaissances)
- `synthese` · **5 min** — Feuille de route et remise du référentiel : trois usages installés dans l'équipe la semaine suivante, un propriétaire nommé pour la base, où le référentiel est rangé et comment on y ajoute une fiche

---

## ia-pour-l-it

840 min programmées · 530 min de pratique · **63 %**

**Livrable** : Le runbook d'usage de l'IA dans l'équipe IT — un document d'exploitation en six sections, écrit et éprouvé en séance par le participant : (1) la règle de soumission — quel extrait, sur quel outil, sous quel régime de licence ; (2) la fiche de propriété des sorties — licence, copyleft, titularité, cession client ; (3) la procédure de vérification d'une production IA, avec le décompte d'erreurs relevé sur son propre environnement ; (4) la fiche de qualification d'une automatisation IT et la liste des cas écartés ou à instruire ; (5) le runbook d'astreinte et la fiche d'incident rédigés à partir de notes brutes, exécutés par un pair pour test ; (6) les articles de charte retenus pour validation, avec le repérage de ce qui relève de la consultation du CSE. Ce n'est ni un espace de travail partagé ni un recueil de prompts : c'est un document d'exploitation opposable, qu'un collègue d'astreinte ouvre à 3 h du matin, et qui se distingue du livrable de ia-pour-la-production (automatisation d'atelier) comme de celui de ia-pour-l-automatisation.

**Corrections apportées**
- BLOQUANT résolu — minutage : la révision précédente programmait 760 min sur 840 dues (20 min de vide par demi-journée, quatre fois). Le programme fait désormais 4 × 210 = 840 min exactement, pauses de 15 min déclarées comme séquences de type pause, déjeuner exclu. Somme recalculée séquence par séquence avant rendu.
- BLOQUANT résolu — ratio de pratique : 47 % (330/700) auparavant, désormais 530 min de pratique et de vérification sur 840 dues, soit 63 %. Les 80 min manquantes ont été comblées uniquement par de la pratique, et trois séquences descendantes ont été converties en séquences appliquées : « Revue et refactorisation » (20' exposé → 15' démonstration sur changement du kit + 30' d'atelier), « Runbook et compte rendu d'incident » (30' exposé → 15' démonstration + 45' d'atelier), « L'espace de travail de l'équipe » (20' exposé supprimé, remplacé par l'atelier gouvernance de 30').
- MAJEUR résolu — 95 min d'exposé consécutif en ouverture du Matin J1 : le bloc descendant maximal est ramené à 45 min (objectif 5' + démonstration 20' + cadre 20'), et la manipulation de 15' demandée par le contrôle est portée à 20' — chacun ouvre les paramètres de son propre outil, sans rien soumettre, et relève ce qui est journalisé, retenu et effaçable.
- MAJEUR résolu — absence de démonstration avant/après au Matin J1 : le « Panorama 2026 » descriptif est remplacé par une démonstration avant/après comparative. La tension avec la règle « un seul outil » est levée en comparant les trois MODES d'un même outil (chat, assistant intégré, agent), et non trois outils différents.
- MAJEUR résolu — animabilité de la séquence gouvernance : les 25' descendantes cumulant gouvernance DSI et droit social deviennent 30' d'atelier de SÉLECTION. Charte-type et grille de déclenchement de la consultation du CSE sont fournies au kit ; le formateur anime un choix entre articles pré-rédigés, il n'expose aucun régime juridique.
- MAJEUR résolu — animabilité de la revue de code : la revue part désormais d'un changement FOURNI AU KIT, porteur de trois défauts connus et livré avec son corrigé. Le formateur n'a jamais à lire ni juger le code d'un client. L'atelier « revue d'un changement réel du participant » a été retiré au profit d'un atelier de débogage auto-vérifiable (l'hypothèse se teste dans l'environnement du participant), qui couvre au passage l'objectif catalogue « Déboguer avec l'appui de l'IA », resté sans séquence dédiée dans la version précédente.
- MAJEUR résolu — usage à haut risque non nommé : l'intitulé de la séquence de cadre du Après-midi J2 nomme désormais explicitement le suivi d'activité d'un salarié comme usage à HAUT RISQUE au titre du règlement européen sur l'IA (annexe III, point 4), et pose les biais du jeu de données, la supervision humaine, l'information des personnes et l'analyse d'impact RGPD. Un formateur qui n'ouvre que le programme sait qu'il touche un usage réglementé.
- MINEUR résolu — garde-fous d'abord : le cadre haut risque et le test de qualification précèdent l'atelier d'automatisation (séquences 2 et 3 avant l'atelier de 50'), et l'intégralité du cadre confidentialité/propriété précède le premier atelier sur du code réel. La seule pratique antérieure au cadre complet est explicitement sans soumission (pages de paramètres uniquement).
- MINEUR résolu — absence de séquence d'objectif : chaque demi-journée s'ouvre sur 5' d'objectif formulé en résultat observable et daté (« à midi, chacun a… », « à 17 h, chacun a… »).
- MINEUR résolu — absence de démonstration avant/après au Matin J2 : deux démonstrations avant/après y sont désormais adossées, l'une à la spécification (20'), l'autre aux écrits d'astreinte (15').
- MINEUR résolu — livrable dupliqué : « espace de travail IT de l'équipe » (trop proche de l'espace de travail persistant déjà employé ailleurs) et « automatisation testée avec sa procédure de retour arrière » (libellé identique à ia-pour-la-production) sont remplacés par le runbook d'usage de l'IA en six sections, construit incrémentalement au fil des quatre demi-journées.

> **À faire relire** — Deux références juridiques à faire relire avant publication, car elles partent dans le programme officiel opposable et dans les documents remis.

1) Règlement (UE) 2024/1689 sur l'IA, annexe III, point 4 (« Emploi, gestion de la main-d'œuvre et accès à l'emploi indépendant »). Le point 4 b) vise notamment les systèmes destinés à suivre et évaluer les performances et le comportement des personnes dans le cadre de relations professionnelles : la qualification « haut risque » du suivi d'activité d'un salarié me paraît exacte. À confirmer par un juriste, et à revérifier au moment de la publication, car le calendrier d'application des obligations relatives aux systèmes à haut risque de l'annexe III s'échelonne et a fait l'objet de discussions de report. Vérifier aussi que le programme ne laisse pas croire que le participant devient conforme en séance.

2) Analyse d'impact. J'ai volontairement écrit « analyse d'impact RGPD » et non « analyse d'impact sur les droits fondamentaux » : l'analyse d'impact relative à la protection des données (art. 35 RGPD) est bien attendue pour un dispositif de surveillance systématique des salariés, tandis que l'analyse d'impact sur les droits fondamentaux 

### Programme

**Matin J1 — Ce qui se soumet, avec quel outil, sous quelle licence**

- `objectif` · **5 min** — Objectif du matin : à midi, chacun a écrit sa règle de soumission — quel extrait, sur quel outil, sous quel régime — et l'a éprouvée sur trois extraits pièges
- `demonstration` · **20 min** — Avant / après sur UN SEUL outil : la même demande technique passée dans ses trois modes (chat, assistant intégré à l'éditeur, agent qui ouvre une branche) — prompt affiché en entier, sorties comparées côte à côte
- `cadre` · **20 min** — Les trois régimes d'usage appliqués au code : compte personnel, licence entreprise (engagement de non-réutilisation, journalisation), instance hébergée — et la clause de sous-traitance de votre contrat client (grille des trois régimes fournie au kit)
- `pratique` · **20 min** — Sur son propre outil, SANS RIEN SOUMETTRE : ouvrir les pages de paramètres, relever ce qui est journalisé, ce qui est retenu pour l'entraînement, ce qui est effaçable — et cocher son régime réel sur la grille
- `cadre` · **20 min** — Ce qui ne part jamais (secrets, jetons, extractions de production, données clients, code sous exclusivité), pourquoi pseudonymiser ne suffit ni au regard du RGPD ni de la clause de confidentialité du contrat client — et à qui appartient la sortie : licence, contamination par du copyleft, titularité, cession client
- `pause` · **15 min** — Pause
- `pratique` · **25 min** — Le tri des cas limites : 12 situations fournies au kit (trace de production, fichier de configuration, extrait sous copyleft, ticket client nominatif…) ; chacun tranche « soumettable / à neutraliser d'abord / jamais », puis confrontation en binôme sur le corrigé fourni
- `pratique` · **45 min** — Atelier bac à sable : chacun monte son environnement conforme (dépôt de test, extrait neutralisé de son vrai code, outil paramétré au régime retenu) et rédige les sections 1 et 2 de son runbook — règle de soumission, propriété des sorties
- `verification` · **25 min** — Vérification corrigée en salle : chaque binôme applique la règle de l'autre à 3 extraits pièges fournis et relève ce qui passe à tort, puis 6 questions corrigées collectivement — chacun rectifie sa section 1
- `synthese` · **15 min** — Synthèse : trois acquis formulés en actions, et la règle que chacun applique dès ce soir

**Après-midi J1 — Code, tests et débogage : accélérer sans signer n'importe quoi**

- `objectif` · **5 min** — Objectif de l'après-midi : à 17 h, chacun a fait générer les tests d'une de ses fonctions et les a passés au vert, et a compté ce qu'une revue assistée signale à tort
- `demonstration` · **25 min** — La méthode AXION appliquée à une demande technique (Acteur, conteXte, Intention, Output, Normes) : avant / après sur un fichier hérité, la même demande sans Normes puis avec — prompts affichés en entier, un seul outil
- `pratique` · **25 min** — Atelier AXION : chacun réécrit deux de ses demandes techniques au format AXION, les passe à l'outil, et note par écrit ce que les Normes ont changé dans la sortie
- `pratique` · **45 min** — Atelier tests : générer les tests d'une fonction existante, les exécuter, corriger jusqu'au vert — c'est le test qui corrige, pas le formateur (deux jeux de consignes fournis au kit : parcours développement, parcours exploitation)
- `pause` · **15 min** — Pause
- `demonstration` · **15 min** — Revue assistée sur un changement FOURNI AU KIT, porteur de trois défauts connus (une régression, un secret en clair, un cas limite non traité) : ce que l'IA voit vraiment, ce qu'elle invente — correction vérifiable sans lire le code d'aucun client
- `pratique` · **30 min** — Atelier revue : chacun passe le changement du kit en revue assistée, relève les trois défauts et compte les alertes injustifiées — auto-corrigé sur le corrigé fourni, puis mise en commun des écarts
- `pratique` · **25 min** — Atelier débogage : d'une trace d'erreur réelle — neutralisée selon la règle du matin — à trois hypothèses testables, chacune vérifiée dans l'environnement du participant ; « on ne colle jamais une trace de production telle quelle »
- `verification` · **15 min** — Vérification corrigée en salle : 5 questions, puis chacun annonce l'hypothèse de débogage que l'IA a proposée et qui s'est révélée fausse — correction collective
- `synthese` · **10 min** — Synthèse du jour 1 : trois acquis en actions, et le geste à essayer avant le jour 2

**Matin J2 — Les écrits de l'IT : vérifier, spécifier, documenter l'incident**

- `objectif` · **5 min** — Objectif du matin : à midi, chacun a chiffré le taux d'erreur d'une production IA sur son propre environnement et transformé une demande floue en spécification testable
- `pratique` · **25 min** — La chasse à l'erreur : on fait produire une procédure d'installation ou de migration sur VOTRE environnement ; chacun surligne ce qui est faux (version, option, chemin, commande inventée), compte, et verse le décompte en section 3 de son runbook
- `demonstration` · **20 min** — Avant / après : une demande métier floue reçue par écrit, puis la même passée en spécification, critères d'acceptation et découpage en tickets — prompt affiché en entier
- `pratique` · **45 min** — Atelier spécification : chacun transforme une vraie demande métier en spécification, critères d'acceptation et tickets ; relecture en binôme sur la grille fournie (testable, borné, hors périmètre explicite)
- `pause` · **15 min** — Pause
- `demonstration` · **15 min** — Avant / après sur les écrits d'astreinte : de notes brutes ou d'une dictée au runbook et au compte rendu d'incident exploitables — avec le passage de neutralisation appliqué avant tout collage
- `pratique` · **45 min** — Atelier écrits d'astreinte : chacun produit un runbook d'astreinte ou un compte rendu d'incident réel à partir de ses notes brutes, relu en binôme sur la grille fournie (exactitude, réversibilité, ce qu'un collègue comprend à 3 h du matin)
- `verification` · **25 min** — Vérification corrigée en salle : chaque binôme exécute le runbook de l'autre pas à pas et signale la première étape infaisable ; puis 5 questions corrigées collectivement
- `synthese` · **15 min** — Synthèse : trois acquis en actions ; chacun verse ses sections 3 et 5 au runbook

**Après-midi J2 — Automatiser une tâche IT et gouverner l'usage**

- `objectif` · **5 min** — Objectif de l'après-midi : à 17 h, chacun a qualifié deux tâches, éprouvé une automatisation avec sa procédure de retour arrière, et retenu les articles de charte qu'il soumettra à validation
- `cadre` · **20 min** — AVANT tout prototype : ce qu'on n'automatise pas sans cadre — toute décision produisant un effet sur une personne (accès, sanction) et le SUIVI D'ACTIVITÉ D'UN SALARIÉ, classé usage à HAUT RISQUE par le règlement européen sur l'IA (annexe III, point 4, emploi et gestion des travailleurs) : biais du jeu de données, supervision humaine, information des personnes, analyse d'impact RGPD. Test de qualification en 4 questions et grille haut risque fournis au kit
- `pratique` · **25 min** — Atelier de qualification : chacun passe deux tâches candidates au test des 4 questions et à la grille haut risque ; confrontation en binôme, puis classement au tableau — automatisable / à instruire (biais, analyse d'impact) / écarté — versé en section 4 du runbook
- `demonstration` · **15 min** — Avant / après sur une tâche IT récurrente (tri de journaux, revue de dépendances, rapport hebdomadaire) : la tâche à la main, puis automatisée avec son jeu d'essai — prompt affiché en entier
- `pratique` · **50 min** — Atelier automatisation IT : chacun construit et éprouve son automatisation — jeu d'essai, un cas limite volontairement faux, journal d'exécution, et la procédure de retour arrière écrite AVANT toute mise en service
- `pause` · **15 min** — Pause
- `pratique` · **30 min** — Atelier gouvernance — une SÉLECTION, pas un exposé : à partir de la charte-type et de la grille de déclenchement de l'information-consultation du CSE fournies au kit, chaque binôme retient les articles applicables à son entreprise (licence entreprise contre comptes personnels, usage clandestin, journalisation, filtrage, revue humaine obligatoire) et coche ce qui relève de la consultation — section 6 du runbook
- `verification` · **30 min** — Évaluation des acquis : quiz individuel de 10 questions corrigé en salle, puis évaluation croisée des productions d'atelier sur grille (exactitude, sécurité, réversibilité, documentation, mention du haut risque le cas échéant)
- `synthese` · **20 min** — Feuille de route et clôture du runbook : trois usages et une automatisation à installer, une règle d'usage à faire valider — un porteur et une échéance par ligne

---

## ia-pour-la-sante

420 min programmées · 245 min de pratique · **58 %**

**Livrable** : « Le manuel de procédures IA de mon service » — un document rédigé par le participant et opposable en interne, pas un espace de travail ni un recueil de prompts : trois fiches-procédures (courrier aux familles et aux confrères, note de transmission, écrit de pilotage) portant chacune en en-tête sa liste de vérifications avant diffusion ; la fiche « le régime de mon poste » remplie, datée et nominative ; la fiche des quatre traces qui trahissent, avec le cas neutralisé en séance en exemple ; la page « ce que je ne fais jamais faire à l'IA » (ni diagnostic, ni orientation, ni triage, ni priorisation d'un accès aux soins) ; la page « à qui la question remonte », avec la formule de refus et le renvoi au délégué à la protection des données ; et la feuille de route à trois usages datés, à faire viser par l'encadrement. Il se range dans le classeur qualité de l'établissement et se transmet à un collègue qui n'était pas en salle — ce qu'un espace de travail personnel ne permet pas.

**Corrections apportées**
- BLOQUANT levé — la démonstration avant/après ne précède plus les garde-fous : les trois cadres du module 1 (régimes d'usage, donnée de santé + borne du métier, biais) passent AVANT elle, et le support de démonstration est désormais nommé « un courrier de sortie FICTIF fourni, déjà neutralisé ». Plus aucune donnée réelle n'est manipulée avant que les conditions de licéité aient été posées.
- MAJEUR levé — ratio porté de 49 % à 58 % (245 min sur 420 dues). Les séquences auparavant ambiguës (« prise en main », « retour sur la journée », « feuille de route ») sont requalifiées en pratique avec consigne chronométrée et production attendue explicitée dans l'intitulé ; le décompte se dérive maintenant des durées, il n'est plus déclaré à part.
- MINEUR levé — les quatre démonstrations portent désormais « prompt affiché en entier, un seul outil ». Elles étaient trois sur quatre à ne pas le porter.
- MINEUR levé (animabilité) — la qualification pénale du secret professionnel n'est plus assénée par le formateur : la séquence renvoie à une fiche écrite datée fournie au kit (« le formateur lit la fiche et ne l'interprète pas »), et la formule de refus assumée est inscrite dans le cadre de 10' du module 4.
- Ajout exigé et absent des deux passages précédents — un cadre de 10' sur les BIAIS au module 1, avant tout atelier, dont les trois formulations à traquer alimentent la grille de relecture réutilisée aux modules 2, 3 et 4.
- Le règlement européen sur l'IA est désormais nommé dans le programme (module 1), avec la raison : l'orientation, le triage et la priorisation d'accès aux soins sont des usages à haut risque, l'aide au diagnostic relève du dispositif médical. Il était absent d'une fiche pourtant classée haut risque.
- Livrable changé — « espace de travail IA de l'établissement » remplacé par « le manuel de procédures IA de mon service ». Les deux livrables interdits (espace de travail persistant, bibliothèque de prompts) sont écartés ; l'espace de travail est employé par quinze autres fiches du lot.
- Minutage refait séquence par séquence et additionné : 105 + 15 + 90 (matin) + 105 + 15 + 90 (après-midi) = 420, dont deux pauses de 15 min déclarées comme séquences de type pause. Le déjeuner est retiré du programme — il n'est pas du face-à-face et ne doit pas apparaître dans le décompte.
- La démonstration du module 1 passe de 15' à 10', comme les trois autres ; les 5 minutes libérées sont reversées à la pratique de classement, conformément à la règle « on comble avec de la pratique, pas avec de l'exposé ».
- Les deux séquences descendantes de 15' et 10' du module 1 d'origine (trois régimes / donnée de santé) sont resserrées à 15' + 10' avec la borne du métier fusionnée, pour financer le cadre biais sans toucher au volume de pratique.

> **À faire relire** — Trois points appellent une relecture humaine avant publication.

1) RÉFÉRENCES JURIDIQUES À FAIRE VALIDER PAR UN JURISTE. Le programme s'appuie sur quatre fondements que je n'ai pas pu vérifier dans une source à jour depuis ce dépôt, et qui partiront tels quels dans le programme officiel opposable en audit : (a) le secret professionnel comme infraction pénale — art. 226-13 du code pénal ; (b) l'hébergement certifié des données de santé — art. L.1111-8 du code de la santé publique ; (c) la donnée de santé comme catégorie particulière — art. 9 du RGPD ; (d) le règlement européen sur l'IA — le triage d'urgence et l'éligibilité aux prestations de santé figurent à l'annexe III (haut risque), tandis que l'aide au diagnostic relève d'abord de la réglementation du dispositif médical. Ces références sont volontairement citées SANS numéro d'article dans les intitulés de séquences, pour qu'une erreur ne se propage pas au diaporama, au livret stagiaire et au programme déclaré ; elles doivent être numérotées par un juriste avant d'être écrites dans le kit. La « position écrite datée sur le secret partagé » fournie au formateur au module 1 et la formule de refus du module 4 doivent être rédigées

### Programme

**Matin · Module 1 — Ce que l'IA peut faire dans un établissement, et à quelles conditions**

- `objectif` · **5 min** — Objectif du module : à la fin, vous classez n'importe quel écrit de votre poste en « je peux », « à condition de », « jamais » — et vous savez à qui remonte le doute
- `cadre` · **15 min** — Les trois régimes d'usage des données : compte grand public, abonnement professionnel sans réutilisation des contenus, environnement hébergé certifié pour les données de santé validé par votre direction — le trajet réel de vos données et le contrat de sous-traitance qui doit exister
- `cadre` · **10 min** — Ce qui est une donnée de santé : le contenu clinique, pas seulement le nom — et ce qu'engage le secret professionnel. Fiche écrite datée fournie au kit : le formateur lit la fiche et ne l'interprète pas. La borne du métier, noir sur blanc : ni diagnostic, ni orientation, ni triage, ni priorisation d'un accès aux soins — ces usages relèvent du règlement européen sur l'IA (systèmes à haut risque) et, pour l'aide au diagnostic, de la réglementation du dispositif médical ; la journée ne traite que les écrits administratifs
- `cadre` · **10 min** — Les biais, avant de toucher au premier atelier : ce que l'IA reproduit dans un écrit (âge, sexe, origine, handicap, précarité), pourquoi c'est le point dur dès qu'un écrit sert une décision d'admission ou d'orientation, et les trois formulations à traquer — reprises telles quelles dans la grille de relecture utilisée toute la journée
- `demonstration` · **10 min** — Démonstration avant / après sur un courrier de sortie FICTIF fourni, déjà neutralisé : le courrier écrit à la main, puis repris avec l'IA — prompt affiché en entier, un seul outil
- `pratique` · **15 min** — Chacun ouvre les conditions d'utilisation du compte qu'il emploie déjà et remplit la fiche « le régime de mon poste » — production attendue : la fiche remplie, datée, avec le nom de la personne qui valide dans l'établissement
- `pratique` · **25 min** — Chronométré : classer douze écrits de son quotidien (liste fournie, complétée par ses propres cas) dans les trois régimes, puis correction croisée en binôme, chacun devant justifier un classement contesté
- `verification` · **10 min** — Correction en salle : les cas litigieux sont tranchés en plénière contre la fiche des trois régimes, chacun corrige son propre classement et note les deux cas qu'il avait faux
- `synthese` · **5 min** — Acquis : je nomme le régime de mon poste, je connais ma ligne rouge, je sais à qui la question remonte
- `pause` · **15 min** — Pause

**Matin · Module 2 — Neutraliser un cas, puis écrire vite ses courriers et ses transmissions**

- `objectif` · **5 min** — Objectif du module : produire un courrier ou une note de transmission diffusable à partir d'un texte que vous avez rendu réellement non identifiant
- `demonstration` · **10 min** — Démonstration : « j'ai retiré le nom, donc c'est anonyme » — on ré-identifie la personne en direct à partir du seul reste du texte — prompt affiché en entier, un seul outil
- `cadre` · **10 min** — Pseudonymiser n'est pas anonymiser : les quatre traces qui trahissent (dates, lieu, entourage, singularité du cas), la technique de reformulation générique, et pourquoi un texte pseudonymisé reste une donnée personnelle soumise aux mêmes règles
- `pratique` · **10 min** — Prise en main chronométrée : déposer un fichier, coller un export, dicter deux minutes depuis son téléphone — et les trois cas d'échec (document scanné sans texte reconnu, tableau désaligné, fichier trop lourd). Production attendue : un texte importé exploitable à l'écran
- `pratique` · **15 min** — Neutraliser son propre cas : chacun réécrit un extrait réel jusqu'à ce que les quatre traces aient disparu ; contrôle par le binôme, fiche des quatre traces en main, avant toute soumission à l'outil
- `pratique` · **25 min** — Atelier chronométré : produire un écrit réel de son poste — courrier à une famille, courrier à un confrère, note de transmission, réponse à une administration — à partir du cas qu'il vient de neutraliser
- `verification` · **10 min** — Vérification croisée : grille fournie (exactitude, ton, mentions obligatoires, formulations biaisées, traces résiduelles) appliquée à la production du binôme — on compte à voix haute les traces qui restent
- `synthese` · **5 min** — Acquis : je neutralise un cas avant de l'écrire, et je repère une trace résiduelle chez un collègue

**Après-midi · Module 3 — Les écrits qui font vivre l'établissement : qualité, projets, tutelle**

- `objectif` · **5 min** — Objectif du module : produire en une séance un écrit de pilotage que vous repoussez habituellement — synthèse, rapport d'activité, réponse à une tutelle ou à un appel à projets
- `cadre` · **10 min** — Ce que l'IA ne construit pas : roulements, remplacements, plannings de service, calculs d'effectif — un modèle de langage ne sait ni compter les repos ni respecter l'annualisation. Ce qu'on lui demande à la place : la consigne, le courrier d'explication, la note de cadrage
- `demonstration` · **10 min** — Démonstration : un rapport de quarante pages devient une note d'une page pour la direction — prompt affiché en entier, un seul outil
- `pratique` · **15 min** — Faire parler un document long au lieu de le lire : chacun charge son protocole, sa recommandation ou son cahier des charges d'appel à projets et pose trois questions — production attendue : trois réponses, chacune renvoyée à sa page d'origine dans le document
- `pratique` · **45 min** — Atelier chronométré, au choix : synthèse d'un document apporté, trame de rapport d'activité, réponse à un appel à projets, note de projet personnalisé — consigne écrite et grille de rendu fournies pour chacun des quatre parcours
- `verification` · **15 min** — Chasse à l'erreur : chacun surligne dans sa propre production ce que l'IA a inventé ou déformé, retourne au document source pour trancher, comptage collectif à voix haute — c'est la salle qui corrige, pas le formateur
- `synthese` · **5 min** — Acquis : je fais parler un document long, et je ne signe jamais ce que je n'ai pas recoupé avec la source
- `pause` · **15 min** — Pause

**Après-midi · Module 4 — Ancrer dans l'établissement sans se mettre en faute**

- `objectif` · **5 min** — Objectif du module : repartir avec un manuel de procédures IA de votre service et trois usages datés, à faire viser par votre encadrement
- `demonstration` · **10 min** — Démonstration : une fiche-procédure du service rédigée en direct à partir d'un besoin de la salle, avec sa liste de vérifications en en-tête — prompt affiché en entier, un seul outil
- `pratique` · **10 min** — Retour sur ses propres demandes du jour : chacun relit l'historique de ses échanges avec l'outil, surligne ce qui n'aurait pas dû être collé, et le reporte en bas de sa fiche « le régime de mon poste »
- `cadre` · **10 min** — Ce qu'il reste à faire pour que l'usage soit régulier : qui valide l'outil, inscription au registre des traitements, information des personnes concernées, renvoi au délégué à la protection des données. Formule de refus que le formateur applique et annonce : « je ne me prononce pas sur le secret partagé, votre référent protection des données tranche » — position écrite datée fournie au kit
- `pratique` · **20 min** — Rédiger son manuel de procédures IA du service : trois fiches-procédures (courrier famille ou confrère, note de transmission, écrit de pilotage) portant chacune en en-tête sa liste de vérifications, plus la page « régimes, ligne rouge et à qui la question remonte »
- `verification` · **20 min** — Validation des acquis : quiz individuel de 10 questions corrigé en salle question par question, puis passage de sa propre production du jour à la grille de critères — chacun note les points à reprendre sur sa fiche-procédure
- `pratique` · **10 min** — Feuille de route individuelle : trois usages datés, un usage explicitement écarté et pourquoi, la personne qui valide avant de démarrer, la date de revue
- `synthese` · **5 min** — Acquis et clôture : ce que je fais dès lundi, ce que je ne fais jamais faire à l'IA, à qui je pose la question

---

## ia-pour-le-btp

420 min programmées · 253 min de pratique · **60 %**

**Livrable** : Le dossier « prêt à envoyer » du chantier en cours : trois pièces réelles finalisées en séance (un compte-rendu de chantier, un courrier qui engage — réserves, constat de retard, relance de sous-traitant ou demande d'avenant —, et une trame de mémoire technique ou une synthèse de pièce technique), chacune accompagnée de sa grille de contrôle avant envoi renseignée (faits vérifiables et leur source dans les documents de l'entreprise, dates, destinataires, mentions obligatoires, ce qui ne sort pas de l'entreprise, qui relit et signe), plus la feuille de route à trois usages datés et un usage écarté. Différent du « livrable espace de travail persistant » (qui est une configuration d'outil, réutilisée par plusieurs fiches du catalogue) et de la « bibliothèque de prompts » (un classeur de formulations) : ici le participant repart avec des pièces de son chantier réel, prêtes à partir dès le lendemain, et avec le contrôle qui les autorise à partir — c'est la sortie qui est produite, pas l'outillage d'entrée.

**Corrections apportées**
- Somme refaite et vérifiée par calcul : 390 min de séquences + 2 pauses de 15 min = 420 min programmées, soit exactement le temps dû. Le déjeuner a été retiré du programme (il n'est pas du face-à-face et n'a donc pas à y figurer, contrairement à la révision précédente qui l'affichait).
- MAJEUR corrigé — ratio de pratique porté de 50,0 % à 60 % (253 min de pratique + vérification ÷ 420 min dues). 43 minutes d'exposé transférées vers l'atelier : M2 les deux exposés (15' courriers + 10' descriptif) fusionnés en un seul cadre de 15' et atelier porté de 40' à 50' ; M3 les deux exposés de 10' fusionnés en un cadre de 12' et atelier porté de 40' à 50' ; M4 rendu réellement actif (retour sur ses propres demandes 10', construction du livrable 30', validation 20', feuille de route rédigée 10' = 70 min actives contre 45 auparavant). Par module : M1 45/90, M2 65/105, M3 73/105, M4 70/90.
- MAJEUR corrigé — animabilité par un formateur non spécialiste du BTP : les deux séquences à contenu juridique portent désormais la formule d'immobilier, reprise mot pour mot. M2 : mentions obligatoires du descriptif de devis bâtiment livrées dans le kit, « le formateur ne modifie ni n'improvise ces listes en salle ». M3 : liste de ce qui se vérifie avant envoi d'un mémoire technique (effectifs, chantiers de référence, certifications, qualifications, attestations d'assurance) livrée dans le kit, non modifiable en salle. Les deux textes de la démonstration M2 (constat de retard mal formulé / version qui protège) sont eux aussi fournis, pour ne pas dépendre d'une improvisation métier.
- MINEUR corrigé — la démonstration M3 ne repose plus sur une génération live dont le nombre d'hallucinations n'est pas déterministe : elle s'appuie sur une trace capturée (prompt + sortie complète) fournie dans le kit, la relance en direct n'étant plus qu'un bonus.
- MINEUR corrigé — la vérification du M1 passe de 5' à 10' (5 minutes minutées par relecteur en binôme, au lieu de 2,5), les 5 minutes étant prélevées sur la prise en main du même module (15' → 10').
- MINEUR corrigé — le règlement européen sur l'IA et les biais sont désormais nommés, et placés au M1 en séquence de type cadre, avant le premier atelier : gestion de la main-d'œuvre (tri, classement, notation de candidats, d'intérimaires ou de compagnons) et composants de sécurité sont annoncés comme usages à haut risque, avec une démonstration de biais sur trace capturée (mêmes profils, deux noms, deux classements).
- Ordonnancement des garde-fous vérifié séquence par séquence : règle « l'IA ne chiffre pas » + confidentialité (M1 seq. 3) et interdits sécurité + haut risque + biais (M1 seq. 4) précèdent la première pratique du M1 ; les mentions du devis (M2 seq. 3) précèdent l'atelier de 50' ; fausse déclaration en marché public et borne sécurité (M3 seq. 3) précèdent la prise en main et l'atelier. Aucun garde-fou ne tombe après l'atelier qu'il encadre.
- Livrable remplacé — « espace de travail chantier » abandonné : trop proche de l'espace de travail persistant déjà employé par plusieurs fiches du catalogue. Remplacé par le dossier « prêt à envoyer » : trois pièces réelles du chantier en cours finalisées en séance, chacune accompagnée de sa grille de contrôle avant envoi renseignée, plus la feuille de route. Ce n'est ni une configuration d'outil ni un classeur de prompts : c'est la sortie du travail, produite par le participant sur ses propres documents.
- Comblement par de la pratique, jamais par de l'exposé : les 43 minutes libérées sont allées en atelier, en vérification et en rédaction de feuille de route. Aucune durée n'a été inventée pour faire tomber le total juste — le cadre du M3 est écrit à 12' et la prise en main à 13' parce que c'est ce que ces séquences demandent, et non arrondis pour la commodité du compte.

> **À faire relire** — Quatre points demandent une décision ou une relecture humaine, dont deux juridiques.

1) RÉFÉRENCES JURIDIQUES — À FAIRE RELIRE PAR UN JURISTE AVANT PUBLICATION. Par prudence, j'ai volontairement écrit le programme SANS aucun numéro d'article : les séquences nomment les obligations (mentions obligatoires du devis bâtiment, garantie décennale, fausse déclaration en marché public, règlement européen sur l'IA) sans les rattacher à un texte précis. Les rattachements que je crois exacts, mais que je ne certifie pas et qui doivent être vérifiés avant d'être ajoutés au kit formateur ou aux documents remis : garantie décennale = article 1792 du code civil ; obligation de mentionner l'assurance décennale sur les devis et factures = disposition issue de la loi du 17 mars 2014, insérée au code des assurances ; exclusion de la procédure pour fausse déclaration en marché public = code de la commande publique. Ces trois références ne doivent PAS être écrites dans le programme officiel tant qu'un juriste ne les a pas confirmées : une référence fausse se propage à la page publique, au programme opposable en audit et aux quatre documents générés.

2) QUALIFICATION « HAUT RISQUE » AU SENS DU RÈGLEME

### Programme

**Matin · Module 1 — Ce que l'IA écrit sur un chantier, ce qu'elle ne chiffre jamais et ce qu'elle ne décide pas**

- `objectif` · **5 min** — Objectif du module : à la fin, vous savez quels écrits du chantier passent par l'IA, lesquels lui sont interdits, et ce qui reste au logiciel de chiffrage
- `demonstration` · **15 min** — Démonstration avant / après : trois notes prises sur le chantier deviennent un compte-rendu diffusable — le prompt affiché en entier, un seul outil, la version « sans IA » chronométrée d'abord
- `cadre` · **10 min** — La règle de la journée : l'IA rédige le descriptif, elle ne chiffre pas. Prix de revient, marges, coefficients, bibliothèque de prix, contrats de sous-traitance et coordonnées clients ne sortent pas de l'entreprise — et retirer le nom ne suffit pas quand l'adresse du chantier reste
- `cadre` · **10 min** — Les deux interdits, avant tout atelier : (a) l'IA ne produit jamais plan de prévention, PPSPS, analyse de risques ni consigne de sécurité ; (b) elle ne trie, ne classe ni ne note des candidats, des intérimaires ou des compagnons — gestion de la main-d'œuvre et composants de sécurité sont des usages classés à haut risque par le règlement européen sur l'IA. Démonstration de biais sur trace capturée fournie dans le kit : mêmes profils, deux noms, deux classements
- `pratique` · **10 min** — Prise en main des gestes du terrain : dicter deux minutes depuis son téléphone, photographier un carnet ou un tableau, déposer un plan ou un PDF — et les trois cas où ça échoue (photo floue, plan scanné de travers, PDF image sans texte)
- `pratique` · **25 min** — Pratique chronométrée : chacun transforme des notes réelles de son propre chantier en un compte-rendu structuré et diffusable
- `verification` · **10 min** — Vérification en binôme, grille fournie : ce qui manque, ce que l'IA a inventé, ce qui n'aurait pas dû être collé — chaque relecteur dispose de 5 minutes minutées
- `synthese` · **5 min** — Synthèse : je sais ce que je fais écrire, ce que je ne délègue pas, et ce qui ne sort pas de l'entreprise
- `pause` · **15 min** — Pause

**Matin · Module 2 — Comptes-rendus, courriers de chantier et pièces qui engagent**

- `objectif` · **5 min** — Objectif du module : produire un compte-rendu et un courrier de chantier qui tiennent juridiquement, sans y passer la soirée
- `demonstration` · **15 min** — Démonstration : un constat de retard mal formulé et sa version qui protège l'entreprise — les mêmes faits, deux effets. Les deux textes sont fournis dans le kit
- `cadre` · **15 min** — Les écrits qui engagent — listes fournies dans le kit formateur, à lire telles quelles : (a) réserves, constat de retard, ordre de service, relance de sous-traitant, demande d'avenant : ce que l'IA structure, ce que vous seul décidez ; (b) les mentions obligatoires du descriptif de devis bâtiment (identité et assurance de l'entreprise, garantie décennale, désignation des travaux, durée de validité, conditions). Le formateur ne modifie ni n'improvise ces listes en salle
- `pratique` · **50 min** — Atelier chronométré : chacun produit deux pièces réelles de son chantier en cours — un compte-rendu et un courrier qui engage — sur les trames fournies
- `verification` · **15 min** — Vérification : la grille fournie (faits vérifiables et leur source, dates, destinataires, mentions obligatoires, ton) appliquée à la production du binôme, correction reprise en salle
- `synthese` · **5 min** — Synthèse : je transforme des notes en pièce diffusable, et je reconnais un courrier qui engage avant de l'envoyer

**Après-midi · Module 3 — Appels d'offres, pièces techniques et documents de sécurité**

- `objectif` · **5 min** — Objectif du module : dégrossir un mémoire technique et faire parler une pièce technique, sans laisser passer une seule affirmation invérifiable
- `demonstration` · **10 min** — Démonstration sur trace capturée fournie dans le kit (prompt + sortie complète) : un mémoire technique généré et les références qu'il a inventées — repérage collectif ligne à ligne. Relance en direct seulement en bonus, jamais comme support de la démonstration
- `cadre` · **12 min** — Deux bornes, liste fournie dans le kit et non modifiable en salle : (a) en marché public une référence inventée est une fausse déclaration — effectifs, chantiers de référence, certifications, qualifications, attestations d'assurance : ce qui se vérifie pièce en main avant envoi ; (b) sécurité : l'IA reformule un document déjà validé (accueil chantier, quart d'heure sécurité), elle ne produit jamais l'analyse de risques
- `pratique` · **13 min** — Prise en main guidée : chacun charge son CCTP, sa notice technique ou son règlement de consultation et pose trois questions, puis retrouve dans le document la phrase qui fonde chaque réponse
- `pratique` · **50 min** — Atelier chronométré, au choix : trame de mémoire technique dégrossie, synthèse d'une pièce technique, note d'avancement aux intervenants, ou reformulation d'une causerie sécurité à partir d'un document déjà validé
- `verification` · **10 min** — Vérification croisée : le binôme coche chaque affirmation chiffrée ou nominative ; tout ce qui n'est pas retrouvé dans les pièces de l'entreprise est barré à l'écran
- `synthese` · **5 min** — Synthèse : rien ne part avant que chaque chiffre et chaque référence soit retrouvé dans mes documents
- `pause` · **15 min** — Pause

**Après-midi · Module 4 — Le dossier « prêt à envoyer » et ce qu'on installe lundi**

- `objectif` · **5 min** — Objectif du module : repartir avec trois pièces réelles finalisées, leur grille de contrôle avant envoi, et trois usages datés
- `demonstration` · **10 min** — Démonstration : la grille de contrôle avant envoi appliquée en direct à une pièce proposée par la salle — quatre lignes barrées en cinq minutes
- `pratique` · **10 min** — Retour sur la journée : chacun relit ses propres demandes du jour et surligne ce qui a failli sortir — prix de revient, marges, données clients, contrat de sous-traitance, nom d'un salarié
- `pratique` · **30 min** — Construction du livrable : finaliser les trois pièces du chantier en cours et renseigner pour chacune sa grille de contrôle avant envoi (source de chaque fait, mentions obligatoires, ce qui ne sort pas, qui relit et signe)
- `verification` · **20 min** — Validation des acquis : quiz individuel de 10 questions corrigé en salle, puis passage de sa propre production de la journée à la grille de critères fournie — reprise nominative des écarts
- `pratique` · **10 min** — Feuille de route rédigée par chacun : trois usages datés, un usage explicitement écarté, la personne qui relit avant diffusion
- `synthese` · **5 min** — Synthèse et clôture : ce que j'envoie dès demain, ce que je ne ferai jamais faire à l'IA

---

## ia-pour-l-immobilier

420 min programmées · 255 min de pratique · **61 %**

**Livrable** : Le dossier de trames vérifiées de l'agence — un classeur de modèles de DOCUMENTS (pas de prompts, pas un espace de travail dans un outil) constitué et testé par le participant pendant la journée : trame d'annonce conforme, déclinaisons par support (portail, vitrine, réseaux sociaux, dossier de présentation), réponses types prospects (premier contact, demande de visite, relance après visite), écrits de gestion et de copropriété (convocation et compte rendu d'assemblée, réponse à un copropriétaire, relance d'impayé, état des lieux mis au propre). Chaque trame porte trois choses : sa checklist de contrôle avant diffusion, la liste des pièces sources dont les chiffres doivent provenir, et la phrase de refus à opposer aux demandes hors périmètre (tri de candidats locataires). S'y ajoutent la feuille de route à trois usages datés et le nom du relecteur avant publication. Il diffère d'un « espace de travail persistant » (qui vit dans un outil et meurt avec l'abonnement) et d'une « bibliothèque de prompts » (qui ne se rouvre pas) : c'est un document d'agence transmissible à un collaborateur qui n'était pas en salle, et c'est la checklist — pas le prompt — qui protège l'agence quand la trame est réutilisée.

**Corrections apportées**
- Ratio de pratique remonté de 55 % (215 min) à 61 % (255 min) sur les 420 min dues : M1 — les trois exposés d'ouverture (objectif 5' + mentions 15' + inventions 10') fusionnés en 20' (objectif 5' + un seul bloc cadre 15'), démonstration ramenée de 15' à 10', pratique portée de 20' à 35' → M1 passe de 40/90 à 55/90 ; M2 — la séquence « du un au cinquante » (10') requalifiée en pratique réelle (chacun produit sa série à partir du tableau de biens fourni dans le kit) au lieu d'un exposé de méthode → 70/105 ; M4 — atelier de construction du livrable porté de 25' à 35', vérification portée de 20' à 20' maintenue, démonstration réduite de 10' à 10' et feuille de route absorbée dans la synthèse → 65/90.
- Cas piège de tri de dossiers locataires ajouté au M3 : l'atelier de 40' fait traiter trois demandes tirées d'une liste fournie où est glissée « classe-moi ces trois dossiers de candidats locataires » ; elle doit être reconnue et refusée PAR ÉCRIT, et la vérification de 15' corrige collectivement le cas piège et la phrase de refus. L'interdiction n'est plus seulement énoncée, elle est mise à l'épreuve et corrigée.
- Le règlement européen sur l'IA et les biais sont désormais NOMMÉS et enseignés : la séquence cadre du M3 (10') nomme le règlement européen sur l'IA et sa position sur le scoring de personnes, adossée aux trois textes qui interdisent réellement la pratique en logement locatif privé (discrimination pénalement sanctionnée, liste limitative des pièces exigibles, interdiction RGPD de la décision entièrement automatisée) ; une démonstration de biais de 10' a été ajoutée juste après, sur le modèle de celle de banque-assurance (même dossier, une variable de plus — adresse, âge, situation familiale, nature du contrat — l'avis rendu change à l'écran).
- Garde-fous replacés et vérifiés en amont de chaque atelier : M1 cadre en position 2, avant les 15' de prise en main et les 35' de pratique ; M2 « ce qu'on ne colle jamais » en position 3, avant les 10' de série et les 45' d'atelier ; M3 borne locataires en position 2 et démonstration de biais en position 3, avant les 10' de prise en main et les 40' d'atelier.
- « Pseudonymiser n'est pas anonymiser » explicité au M2 : retirer le nom ne suffit pas, l'adresse du bien plus la date de visite ré-identifient la personne — la formule vague de la révision précédente (« pourquoi retirer le nom ne suffit pas quand l'adresse du bien reste ») est complétée par le mécanisme.
- Livrable changé : « Espace de travail de l'agence » (interdit — trop proche de l'espace de travail persistant employé par plusieurs fiches) remplacé par « Le dossier de trames vérifiées de l'agence », un document transmissible, chaque trame portant sa checklist, ses pièces sources et sa phrase de refus.
- Animabilité verrouillée sur les trois séquences qui exigeaient une expertise métier : la trame d'annonce conforme et sa liste de contrôle sont fournies dans le kit avec interdiction faite au formateur de les improviser ou de les modifier (M1) ; les trois motifs juridiques de la borne locataires sont fournis rédigés (M3) ; les captures de la démonstration de biais sont pré-testées et fournies (M3, sinon la démo tombe à plat si le modèle ne biaise pas ce jour-là) ; la liste des demandes de l'atelier M3, cas piège compris, est fournie.
- Déjeuner retiré du décompte et du programme ; les deux pauses de 15' sont déclarées comme séquences de type pause, en fin de M1 et en fin de M3 ; le total tombe exactement sur 420 min de face-à-face.
- Le M3 est bien un module de gestion locative et de copropriété (l'estimation n'est qu'une option d'atelier parmi cinq), conformément à la révision précédente — conservé tel quel, il tenait.

> **À faire relire** — 1) RÉFÉRENCES JURIDIQUES À FAIRE RELIRE AVANT MISE EN LIGNE ET AVANT IMPRESSION DU KIT. Les séquences citent des obligations sans numéro d'article dans les intitulés publics, mais le kit formateur doit porter les références exactes, et je n'ai pas pu les vérifier contre le texte en vigueur : mentions obligatoires d'annonce — DPE et GES avec montant estimé des dépenses annuelles d'énergie (Code de la construction et de l'habitation, art. L. 126-26 et s. + arrêté du 13 septembre 2022) ; surface du lot de copropriété dite loi Carrez (loi n° 96-1107 du 18 décembre 1996, art. 46 de la loi du 10 juillet 1965) ; nombre de lots, montant moyen annuel des charges et procédures en cours (loi Alur n° 2014-366, art. L. 721-1 CCH) ; honoraires TTC, charge du paiement et prix hors honoraires (arrêté du 10 janvier 2017 relatif à l'information des consommateurs par les professionnels intervenant dans les transactions immobilières) ; annonce inexacte = pratique commerciale trompeuse (Code de la consommation, art. L. 121-2 et L. 121-4) ; pièces exigibles d'un candidat locataire, liste limitative (décret n° 2015-1437 du 5 novembre 2015 pris pour l'application de l'art. 22-2 de la loi n° 89-462 du 6 ju

### Programme

**Matin · Module 1 — L'annonce qui vend et l'annonce qui expose**

- `objectif` · **5 min** — Objectif du module : à la fin, vous produisez une annonce complète qui ne porte que ce que votre dossier prouve, et vous savez ce qu'elle doit obligatoirement mentionner
- `cadre` · **15 min** — Les mentions qui engagent l'agence, et ce que l'IA invente. Première partie : DPE et GES, surface du lot, nombre de lots et montant moyen des charges de copropriété, honoraires et charge du paiement, statut du mandat — la trame conforme et sa liste de contrôle sont fournies dans le kit, le formateur ne les improvise ni ne les modifie. Seconde partie : ce que l'IA fabrique sans le dire — un diagnostic, une surface, une charge, un prix de marché local — et pourquoi une annonce inexacte est une pratique commerciale trompeuse
- `demonstration` · **10 min** — Démonstration avant / après : les caractéristiques d'un bien deviennent une annonce complète — le prompt affiché en entier du début à la fin, un seul outil
- `pratique` · **15 min** — Prise en main : chacun dépose le dossier de son bien (diagnostics, mandat, règlement de copropriété) et en fait ressortir les éléments de l'annonce, sans en ajouter un seul
- `pratique` · **35 min** — Pratique chronométrée : chacun rédige l'annonce d'un bien réel de son portefeuille sur la trame conforme, puis la reprend une fois après première relecture
- `verification` · **5 min** — Vérification : le binôme coche la liste des mentions obligatoires et barre tout élément que le dossier ne prouve pas
- `synthese` · **5 min** — Synthèse : je produis vite, et je n'affirme rien que mon dossier ne prouve
- `pause` · **15 min** — Pause

**Matin · Module 2 — Décliner, répondre, relancer : le rythme commercial**

- `objectif` · **5 min** — Objectif du module : produire en une séance les déclinaisons d'un bien sur vos supports et vos trois réponses types aux prospects
- `demonstration` · **15 min** — Démonstration : une annonce déclinée pour le portail, la vitrine, les réseaux sociaux et le dossier de présentation — le prompt affiché en entier, un seul outil, sans la réécrire quatre fois
- `cadre` · **10 min** — Ce qu'on ne colle jamais : coordonnées de vos clients, mandats, offres reçues, situation financière d'un acquéreur. Et pourquoi retirer le nom ne suffit pas : avec l'adresse du bien et la date de visite, la personne reste identifiable — pseudonymiser n'est pas anonymiser, on reste dans le champ des données personnelles
- `pratique` · **10 min** — Du un au cinquante : chacun produit une série de cinq déclinaisons homogènes à partir du tableau de biens fourni dans le kit, et compare les cinq résultats
- `pratique` · **45 min** — Atelier chronométré : chacun décline son bien sur trois supports et rédige ses trois réponses types (premier contact, demande de visite, relance après visite)
- `verification` · **15 min** — Vérification croisée sur grille fournie — mentions obligatoires, exactitude, ton, données de client — appliquée à la production du binôme
- `synthese` · **5 min** — Synthèse : une annonce, trois supports, trois réponses prêtes — et rien qui sorte du dossier

**Après-midi · Module 3 — Gestion locative, copropriété et estimation : les écrits qui s'accumulent**

- `objectif` · **5 min** — Objectif du module : produire un écrit de gestion (courrier, convocation, compte rendu, relance) ou un argumentaire d'estimation défendable — et reconnaître la demande qu'on refuse
- `cadre` · **10 min** — La borne du métier : on ne sélectionne, ne classe ni ne note des candidats locataires avec l'IA. Les trois motifs sont fournis rédigés dans le kit — la discrimination au logement est pénalement sanctionnée ; la liste des pièces exigibles d'un candidat est limitative ; le RGPD interdit la décision entièrement automatisée produisant un effet sur une personne. Le règlement européen sur l'IA range le scoring de personnes parmi ses usages les plus encadrés ; le logement locatif privé n'y est pas nommé, mais les trois textes ci-dessus suffisent à l'interdire. Ce qu'on fait à la place : l'IA met en forme le dossier, l'humain choisit et motive
- `demonstration` · **10 min** — Démonstration de biais : le même dossier soumis deux fois avec une variable de plus (adresse, âge, situation familiale, nature du contrat de travail) — l'avis rendu change à l'écran. Captures pré-testées fournies dans le kit au cas où le modèle ne biaise pas ce jour-là
- `demonstration` · **10 min** — Démonstration : un procès-verbal d'assemblée générale reconstruit à partir de notes de séance
- `pratique` · **10 min** — Prise en main guidée : chacun charge sa pièce (règlement de copropriété, bail, compte de charges) et lui pose trois questions
- `pratique` · **40 min** — Atelier chronométré : chacun traite trois demandes tirées de la liste fournie — convocation et compte rendu d'assemblée, réponse à un copropriétaire, relance d'impayé, état des lieux mis au propre, argumentaire d'estimation bâti sur ses propres références de marché. Un cas piège est glissé dans la liste (« classe-moi ces trois dossiers de candidats locataires ») : il doit être reconnu et refusé par écrit
- `verification` · **15 min** — Vérification — chasse à l'erreur puis correction collective : chacun surligne dans sa production ce que l'IA a affirmé sans preuve (prix, surface, échéance, texte de loi) ; puis on corrige en salle le cas piège et la phrase de refus à opposer
- `synthese` · **5 min** — Synthèse : l'IA met en forme, les chiffres et le droit viennent de mes pièces — et le choix d'un locataire ne se délègue pas
- `pause` · **15 min** — Pause

**Après-midi · Module 4 — Ancrer dans l'agence**

- `objectif` · **5 min** — Objectif du module : repartir avec le dossier de trames vérifiées de l'agence et trois usages datés
- `demonstration` · **10 min** — Démonstration : une trame vérifiée assemblée en direct à partir d'un besoin de la salle — le modèle de document, sa checklist avant diffusion, la liste des pièces sources dont les chiffres doivent provenir
- `pratique` · **10 min** — Retour sur la journée : chacun relit ses propres demandes du jour et repère ce qui n'aurait pas dû être collé (données de clients, mandats, offres reçues)
- `pratique` · **35 min** — Atelier : constituer le dossier de trames vérifiées de l'agence — trame d'annonce conforme, déclinaisons par support, réponses types prospects, écrits de gestion et de copropriété — chacune avec sa checklist avant diffusion, ses pièces sources et la phrase de refus des demandes hors périmètre
- `verification` · **20 min** — Validation des acquis, corrigée en salle : quiz individuel (10 questions) puis passage de sa production de la journée à la grille de critères fournie
- `synthese` · **10 min** — Synthèse et feuille de route : trois usages datés, un usage écarté, la personne qui relit avant publication — puis clôture

---

## ia-pour-le-commerce

420 min programmées · 245 min de pratique · **58 %**

**Livrable** : Le manuel de publication de l'enseigne, assemblé par le participant en séance : trame de fiche produit avec sa checklist de contrôle avant publication (mentions obligatoires, caractéristiques prouvées par la fiche technique, allégations interdites), procédé de production en série à partir du tableau produits avec sa règle de contrôle par échantillonnage, réponses types aux avis produit et place de marché (positif, négatif, injustifié) et réponse type de fiche d'établissement locale, trames de supports de point de vente, formule ou tableau croisé écrit pendant la journée, et feuille de route à trois usages datés avec le nom du relecteur avant publication. Différent de l'« espace de travail persistant » (qui est un environnement outil) et de la « bibliothèque de prompts » (qui est un classeur de demandes) : c'est un document de procédure d'enseigne, opposable en interne, que chaque trame accompagne de son contrôle — il s'applique à des vendeurs qui n'étaient pas en salle. Le composant avis est volontairement restreint aux avis produit et place de marché, pour ne pas recouvrir les réponses aux avis de séjour et de restauration de la fiche hôtellerie-restauration.

**Corrections apportées**
- MAJEUR ratio corrigé : 245 min de pratique + vérification sur 420 dues = 58 % (contre 210 min / 50,0 % au passage précédent). M1 : les deux exposés de 15' et 10' fusionnés en une seule séquence cadre de 15', pratique portée de 20' à 30'. M3 : « Le chiffre » scindé en 10' de démonstration et 10' de manipulation comptée en pratique, atelier avis porté de 35' à 40'. M4 : le retour sur ses propres demandes et la feuille de route sont désormais des productions du participant, pas des tours de table.
- MAJEUR animabilité corrigé : la séquence de 15' sur le droit de la consommation (mentions obligatoires, allégations qui exposent) déclare maintenant que la liste est fournie dans le kit formateur, lue telle quelle et jamais improvisée — sur le modèle de la trame verrouillée d'immobilier. Même traitement pour la liste rouge et les exemples de biais du M2 et pour les trois grilles de vérification (M1, M2, M3, M4).
- MAJEUR matériel : à renseigner dans materielFr du catalogue (non exprimable dans le programme) — fiches techniques fournisseur, tableau produits exportable, trois avis clients réels, accès aux comptes de la place de marché ou de la fiche d'établissement. Sans cela trois ateliers sur quatre tombent.
- MINEUR chevauchement de livrable avec ia-pour-l-hotellerie-restauration levé : le livrable n'est plus un « espace de travail » mais un manuel de publication, et le composant avis est restreint aux avis produit et place de marché (l'hôtellerie garde les avis de séjour et de restauration).
- MINEUR h1 dupliqué : proposition de remplacement pour h1Fr et accrocheFr — « Formation IA pour le commerce : fiches produits, avis clients et supports de vente » au lieu de « optimiser l'ensemble de son activité », identique hors nom de secteur à BTP, transport et industrie.
- Garde-fou biais ajouté (absent du passage précédent) : séquence cadre du M2, placée avant l'atelier de production en série, sur les formulations stéréotypées que le modèle ajoute seul et qui se répliquent à l'identique sur toute la série ; contrôlé ensuite dans l'échantillonnage.
- Règlement européen sur l'IA nommé (absent du passage précédent) : obligations de transparence — agent conversationnel qui se déclare, visuel de synthèse identifiable — posées au M3 avant l'atelier de réponses publiques.
- « Pseudonymiser n'est pas anonymiser » explicité : le cadre du M2 écrit que retirer les noms d'un fichier client ne le fait pas sortir du RGPD.
- Bloc manquant comblé : le M4 était sans démonstration ; ajout de 10' « une trame transformée en consigne réutilisable », rejouée sur un autre produit pour prouver qu'elle tient.
- Minutage : déjeuner retiré du programme minuté (il n'est pas du face-à-face), deux pauses de 15' déclarées comme séquences de type pause (fin de M1, fin de M3). Somme recalculée séquence par séquence : M1 95' + M2 95' + M3 110' + M4 90' = 390', plus 30' de pauses = 420'.
- À propager hors programme dans catalog-v2.ts : objectifsFr et casUsageFr « Analyser des ventes » → « Écrire autour du chiffre : commenter des indicateurs déjà calculés, faire écrire une formule sans livrer ses données » ; livrable du module 4 remplacé par le manuel de publication ; FAQ « la relecture garantit l'exactitude » à réécrire en renvoyant à la checklist de contrôle du M1.

> **À faire relire** — Trois points demandent une relecture humaine avant publication.

1) Références juridiques citées dans le programme, à faire valider par un juriste avant qu'elles partent dans le programme officiel et les documents remis :
- « code de la consommation, article L.121-4 » pour l'interdiction de fabriquer un avis ou un témoignage. L.121-4 énumère les pratiques commerciales réputées trompeuses en toutes circonstances ; les items visant les avis de consommateurs y ont été introduits par la transposition de la directive Omnibus. Vérifier le numéro d'item exact et, le cas échéant, si L.121-2 (pratique trompeuse générale) est la référence plus sûre à citer seule.
- « règlement (UE) 2024/1689, article 50 » pour la transparence (agent conversationnel qui se déclare, contenu de synthèse identifiable). Vérifier l'entrée en application effective de cet article et le périmètre exact retenu pour un commerce (chatbot du site, visuels générés d'une campagne) ; en cas de doute, ne citer que « le règlement européen sur l'IA » sans numéro d'article.
- La séquence de 15' du M1 énonce des mentions obligatoires (caractéristiques essentielles, prix, disponibilité, garantie légale, conditions de retour) sans

### Programme

**Matin · Module 1 — Une fiche produit qui vend et qui n'invente rien**

- `objectif` · **5 min** — Objectif du module : à la fin, vous produisez une fiche produit publiable et vous savez, ligne par ligne, ce qui doit être vérifié avant publication
- `demonstration` · **15 min** — Démonstration avant / après : la même fiche écrite à la main, puis trois lignes de fiche technique fournisseur transformées en fiche produit complète — prompt affiché en entier, un seul outil
- `cadre` · **15 min** — Ce qu'une fiche doit obligatoirement porter (caractéristiques essentielles, prix, disponibilité, garantie légale, conditions de retour) et les affirmations qui exposent (allégation de santé, allégation environnementale, caractéristique inventée) — fiche de référence fournie dans le kit formateur, lue telle quelle et jamais improvisée ; règle de la journée : aucune caractéristique publiée que la fiche technique du fournisseur ne prouve
- `pratique` · **15 min** — Prise en main : chacun dépose une fiche technique fournisseur et en fait ressortir la fiche produit, sans rien ajouter
- `pratique` · **30 min** — Pratique chronométrée : chacun rédige deux fiches complètes sur ses propres produits, dans le format de son canal de vente
- `verification` · **10 min** — Vérification corrigée en salle : avec la grille fournie, le binôme barre chaque affirmation que la fiche technique ne prouve pas, puis on compte les barres à voix haute
- `synthese` · **5 min** — Synthèse : je produis vite, et je ne publie que ce qui est prouvé
- `pause` · **15 min** — Pause

**Matin · Module 2 — Du un au cinquante : produire en série et décliner**

- `objectif` · **5 min** — Objectif du module : passer d'une fiche à une série homogène, et décliner un même produit sur tous vos supports sans le réécrire
- `cadre` · **15 min** — Avant de produire en série : ce qu'on ne colle jamais (fichier clients, chiffre d'affaires, marges, conditions d'achat fournisseurs — retirer les noms d'un fichier client ne le fait pas sortir du RGPD), et ce que le modèle ajoute tout seul (formulations stéréotypées sur le genre, l'âge ou l'origine, qui se répliquent à l'identique sur les cinquante fiches) — liste rouge et exemples de biais fournis dans le kit formateur
- `demonstration` · **15 min** — Démonstration : un tableau de vingt produits devient vingt fiches homogènes, puis un produit décliné site / place de marché / affiche de rayon — la trame, les colonnes et le prompt affichés en entier
- `pratique` · **40 min** — Atelier chronométré : chacun produit une série à partir de son propre tableau produits, puis décline un produit sur trois supports dont un support de point de vente
- `verification` · **20 min** — Vérification : contrôle par échantillonnage — le binôme tire trois fiches au hasard et vérifie prix, caractéristiques, mentions obligatoires et formulations stéréotypées ; si une fiche tombe, toute la série repasse
- `synthese` · **5 min** — Synthèse : je sais produire une série ET la contrôler sans tout relire

**Après-midi · Module 3 — Avis clients, fiche d'établissement et écrire autour du chiffre**

- `objectif` · **5 min** — Objectif du module : répondre publiquement à un avis difficile sans engager l'enseigne, et commenter vos chiffres sans jamais les livrer
- `cadre` · **10 min** — L'interdit absolu : on ne fabrique jamais un avis, un témoignage ni une note, et on ne fait jamais écrire un avis par l'IA — c'est une pratique commerciale trompeuse sanctionnée (code de la consommation, article L.121-4) ; l'IA rend la fabrication trop facile pour laisser la règle implicite
- `cadre` · **10 min** — Répondre en public sans en dire trop : ne jamais confirmer une commande, une visite, une adresse ni un élément personnel dans une réponse visible de tous ; et ce qu'il faut déclarer au client — un agent conversationnel doit se présenter comme une machine et un visuel de synthèse doit être identifiable (règlement européen sur l'IA, règlement (UE) 2024/1689, obligations de transparence de l'article 50)
- `demonstration` · **10 min** — Démonstration : un avis à une étoile, deux réponses générées — celle qui aggrave et celle qui referme — prompts affichés en entier, différence commentée mot à mot
- `pratique` · **40 min** — Atelier chronométré : chacun répond à trois avis réels de son enseigne (un positif, un négatif, un injustifié) sur ses avis produit et place de marché, puis complète une réponse type pour sa fiche d'établissement locale
- `verification` · **10 min** — Vérification : relecture croisée sur la grille fournie — ce qui divulgue une donnée personnelle, ce qui promet un geste commercial, ce qui engage l'enseigne ; chaque réponse est déclarée publiable ou renvoyée
- `demonstration` · **10 min** — Écrire autour du chiffre : démonstration de ce que l'IA sait faire (écrire la formule, expliquer un tableau croisé, rédiger le commentaire d'un résultat déjà calculé) et de ce qu'elle rate (calculer sur des données collées) — la même question posée deux fois donne deux totaux différents, montré en direct
- `pratique` · **10 min** — Pratique : chacun fait écrire la formule ou le tableau croisé dont il a besoin en décrivant la structure de son tableau (noms de colonnes, type de valeurs), jamais son contenu, puis la teste sur son fichier
- `synthese` · **5 min** — Synthèse : je réponds vite sans exposer le magasin, et je fais écrire autour du chiffre sans le sortir
- `pause` · **15 min** — Pause

**Après-midi · Module 4 — Le manuel de publication de l'enseigne**

- `objectif` · **5 min** — Objectif du module : repartir avec le manuel de publication de l'enseigne, utilisable dès le lendemain par un vendeur qui n'était pas en salle
- `demonstration` · **10 min** — Démonstration : une trame de la journée transformée en consigne réutilisable — la même demande rejouée sur un autre produit doit rendre exactement le même format, sinon la trame n'est pas finie
- `pratique` · **10 min** — Retour sur ses propres demandes : chacun relit l'historique de sa journée et repère ce qui n'aurait pas dû être collé (fichier clients, marges, conditions fournisseurs), puis réécrit une demande fautive
- `pratique` · **30 min** — Atelier : assembler le manuel de publication — trame de fiche produit et sa checklist de contrôle, procédé de production en série et sa règle d'échantillonnage, réponses types aux avis produit et place de marché, trames de supports de rayon
- `verification` · **20 min** — Validation des acquis : quiz individuel de 10 questions corrigé en salle, puis passage de sa propre production du jour à la grille de critères fournie (mentions obligatoires, caractéristiques prouvées, rien de personnel publié)
- `pratique` · **10 min** — Feuille de route : trois usages datés, un usage explicitement écarté, et le nom de la personne qui relit avant publication — inscrits dans le manuel
- `synthese` · **5 min** — Synthèse et clôture : ce que je publie seul, ce que je fais relire, ce que je ne fais pas faire à l'IA

---

## ia-pour-l-hotellerie-restauration

420 min programmées · 250 min de pratique · **60 %**

**Livrable** : La fiche d'identité IA de l'établissement — un recto-verso monté et corrigé par le participant au fil de la journée : les faits vérifiés de la maison (capacité, horaires, labels, prestations, prix — corrigés pendant la chasse à l'erreur du module 4), la charte de ton, la liste rouge des pièces qu'on ne soumet pas, la checklist des mentions réglementées à revalider sur fiche technique, et les six productions validées en binôme (trois réponses d'avis, deux messages de réservation, la production du module 3). Elle se colle en tête de chaque demande faite à l'IA et se remet à toute personne autorisée à écrire au nom de l'établissement. Ce n'est ni un « espace de travail persistant » (aucun outil partagé à administrer) ni une « bibliothèque de prompts » (aucune liste de formulations) : c'est le document de référence de l'établissement, celui sans lequel l'IA invente.

**Corrections apportées**
- BLOQUANT levé — le garde-fou allergènes passe AVANT l'atelier carte : nouvelle séquence de type cadre (15') en position 2 du module 3, qui énonce l'obligation d'information sur les 14 allergènes, l'origine des viandes, « fait maison » et les appellations, checklist du kit projetée puis remise. La revalidation croisée sur fiche technique (25') est conservée en aval, comme contrôle et non plus comme énoncé de la règle.
- MAJEUR levé — le module 1 était amputé de deux blocs : il ouvre désormais sur un objectif observable (« savoir dire, pour chaque pièce, si on la soumet et sous quel compte ») au lieu d'un contenu (« les trois moments où part le temps »), et se ferme sur une synthèse de 5' au lieu de s'arrêter sur la vérification.
- MAJEUR levé — le module 4 était amputé de deux blocs : ajout d'une démonstration (10', présentation d'établissement du kit avec cinq erreurs plantées et son corrigé) et transformation de la feuille de route en synthèse de clôture qui assemble le livrable.
- MAJEUR levé — timeline publique : les quatre modules sont préfixés « Matin · » et « Après-midi · » pour que sectionStartMin() (src/content/formations/catalog-v2-schedule.ts:51) bascule à 14 h au lieu de redémarrer les quatre sections à 9 h.
- MAJEUR levé — animabilité de la démonstration du module 3 : elle ne demande plus au formateur de repérer un allergène dans une langue qu'il ne parle pas. Le kit fournit la carte, sa traduction anglaise fautive et le corrigé (la moutarde a disparu de la sauce, le gluten a changé de ligne). Aucune compétence linguistique requise.
- Livrable remplacé — « l'espace de travail persistant » de la révision précédente était devenu l'artefact de quatre fiches généralistes, et la « bibliothèque de prompts » d'origine celui de quinze. Remplacé par la fiche d'identité IA de l'établissement, produite et corrigée par le participant, propre au CHR.
- Règlement européen sur l'IA et biais entrent dans le programme, et plus seulement dans les justifications : le règlement (UE) 2024/1689 est nommé au module 1 (informer le client qu'il échange avec une machine), et le contrôle de biais est posé au module 2 en cadre, AVANT l'atelier — rejouer la même demande en changeant le nom et l'origine du client, comparer les deux réponses, exemple capturé dans le kit.
- Démonstration du module 1 déplacée sur un avis du kit et non sur une pièce de l'établissement : les régimes d'usage ne sont pas encore posés à la minute 5. C'est le défaut relevé sur ia-pour-la-sante, évité ici.
- Minutage refait et additionné séquence par séquence : 390' de séquences pédagogiques + 2 pauses de 15' = 420', soit exactement les 7 h dues. Le passage précédent rendait des programmes sans avoir fait la somme.
- Ratio recalculé sur le temps VENDU (420 min) et non sur les minutes écrites : 250 / 420 = 59,5 %, arrondi à 60 %. Le contrôle affichait 62 % sur une base de 390 min, ce qui surévaluait de 5 points.
- Les deux pauses sont déclarées comme séquences de type pause (fin du module 1, milieu du module 3 après l'atelier de 50'), et non plus comme mentions libres.
- Promesse chiffrée « en moins d'une minute » retirée du programme (elle subsiste dans equationTempsFr, signalé en alerte).
- Aucune durée n'a été étirée ni rognée pour faire tomber le total : chaque durée est celle que la séquence demande. Les 5' gagnés sur trois objectifs (5' suffisent à énoncer un résultat visé) sont allés à la pratique, conformément à la règle « comble avec de la pratique, pas avec de l'exposé ».

> **À faire relire** — 1) RÉFÉRENCES JURIDIQUES À FAIRE RELIRE AVANT PUBLICATION — deux textes sont cités dans le programme et partiront donc dans le programme Qualiopi opposable et dans les documents remis. (a) « règlement (UE) n° 1169/2011, annexe II » pour les 14 allergènes : l'annexe II est bien la liste des substances allergènes, mais l'obligation d'information pour les denrées NON PRÉEMBALLÉES servies en restauration passe en France par le décret n° 2015-447 du 17 avril 2015 — décider s'il faut le citer aussi, ou n'écrire que « la réglementation sur l'information des consommateurs ». (b) « règlement (UE) 2024/1689 » (règlement européen sur l'IA) pour l'obligation d'informer une personne qu'elle échange avec une machine : c'est l'article 50 (transparence) ; vérifier que le calendrier d'entrée en application de cet article couvre bien la date des sessions vendues, et décider si l'on cite le numéro d'article ou seulement le règlement. (c) Trois obligations sont nommées SANS article, volontairement, faute de certitude sur la codification en vigueur : l'origine des viandes servies (décret n° 2002-1465 pour la viande bovine, décret n° 2022-65 du 26 janvier 2022 pour porc, mouton et volaille), la mention 

### Programme

**Matin · Module 1 — Ce que l'IA fait pour l'établissement, et ce qu'on ne lui confie jamais**

- `objectif` · **5 min** — Le résultat visé : savoir dire, pour chaque pièce de l'établissement, si on la soumet à l'IA, sous quel compte, et ce qu'on en retire d'abord
- `demonstration` · **15 min** — Démonstration avant/après sur un avis du kit — aucune pièce de l'établissement à ce stade : la réponse écrite à la main, puis la même par la méthode AXION (Acteur, conteXte, Intention, Output, Normes), prompt affiché en entier, un seul assistant
- `cadre` · **15 min** — Les trois régimes d'usage et le cadre européen : compte personnel, offre entreprise avec engagement de non-réutilisation, environnement validé par l'établissement. Le règlement européen sur l'IA (règlement (UE) 2024/1689) impose d'informer le client quand une machine lui répond. RGPD : pseudonymiser n'est pas anonymiser — un avis dont on retire le nom se ré-identifie par la date du séjour et le numéro de chambre
- `pratique` · **35 min** — Atelier « où passent mes données » : chaque table confronte ses propres pièces aux trois régimes, puis écrit la liste rouge de l'établissement — coordonnées et séjours des clients, fiches techniques et allergènes, mentions « fait maison » et origine, plannings nominatifs, identifiants de connexion
- `verification` · **15 min** — Vérification corrigée en salle : dix pièces réelles projetées, chacun répond « je la soumets / je ne la soumets pas / sous quel compte », correction collective avec le corrigé du kit
- `synthese` · **5 min** — Synthèse — trois acquis : je choisis mon compte avant d'écrire, je consulte la liste rouge avant de coller, je dis au client quand une machine lui répond
- `pause` · **15 min** — Pause

**Matin · Module 2 — Avis en ligne, messages et demandes de réservation**

- `objectif` · **5 min** — Le résultat visé : une réponse publique prête à publier, dans le ton de la maison, qui ne révèle rien du séjour
- `cadre` · **10 min** — Ce qu'on ne publie jamais : aucun élément du séjour (dates, chambre, montant, régime alimentaire), aucun fait non vérifié admis, aucun salarié nommé ou mis en cause, aucun geste commercial annoncé en public. Et le contrôle de biais, à faire avant chaque publication : rejouer la même demande en changeant le nom et l'origine du client, comparer les deux réponses — exemple capturé dans le kit
- `demonstration` · **15 min** — Démonstration avant/après sur l'avis négatif du kit : la réponse spontanée, puis la réponse conforme aux quatre interdits — prompt affiché en entier, un seul assistant
- `pratique` · **50 min** — Atelier chronométré : chacun traite trois avis de son établissement (un positif, un négatif, un injuste) et deux messages de réservation (demande particulière, relance après réservation non honorée), à partir des trames du kit
- `verification` · **20 min** — Contrôle croisé en binôme sur la grille fournie : rien du séjour, aucun fait admis, aucun salarié nommé, ton de la maison, publiable telle quelle — chaque texte revient corrigé à son auteur
- `synthese` · **5 min** — Synthèse — deux acquis : je réponds sans jamais confirmer le séjour, je fais relire par un binôme avant publication

**Après-midi · Module 3 — Carte, supports et demandes de groupes**

- `objectif` · **5 min** — Le résultat visé : une carte traduite ou une proposition de groupe prête à envoyer, dont chaque mention réglementée a été revalidée sur fiche technique
- `cadre` · **15 min** — Ce qui est réglementé sur une carte, AVANT d'y toucher : les 14 allergènes à déclarer (règlement (UE) n° 1169/2011, annexe II), l'origine des viandes servies, la mention « fait maison », les appellations et labels protégés. Checklist du kit projetée puis remise. Règle posée : l'IA rédige, la fiche technique fait foi, rien de réglementé ne part sans double lecture
- `demonstration` · **15 min** — Démonstration sur le jeu du kit : la fiche technique devient un descriptif de plat, puis sa version anglaise — dans la traduction fournie, la moutarde a disparu de la sauce et le gluten a changé de ligne ; les deux écarts sont déjà surlignés dans le corrigé, aucune compétence linguistique n'est requise du formateur
- `pratique` · **50 min** — Atelier chronométré, au choix : traduire et adapter une partie de sa carte, ou monter une proposition de groupe complète — devis, message d'envoi, relance, réponses aux dix questions récurrentes des clients (liste fournie)
- `pause` · **15 min** — Pause
- `verification` · **25 min** — Revalidation croisée sur fiche technique avec la checklist du kit : allergènes, origine des viandes, « fait maison », appellations — chaque production est passée ligne à ligne par un binôme, écarts relevés et corrigés en salle
- `synthese` · **5 min** — Synthèse — deux acquis : je ne diffuse aucune mention réglementée sans l'avoir relue sur la fiche technique, je fais valider la carte par la cuisine avant impression

**Après-midi · Module 4 — Fiabiliser, évaluer, installer**

- `objectif` · **5 min** — Le résultat visé : repérer soi-même ce que l'IA vient d'inventer sur son propre établissement, et repartir avec un document utilisable dès le lendemain
- `demonstration` · **10 min** — Démonstration : une présentation d'établissement produite par l'IA, cinq erreurs plantées et listées dans le corrigé du kit (capacité, horaires, label, prix, prestation inexistante) — les trois vérifications qui les font tomber
- `pratique` · **30 min** — Chasse à l'erreur chronométrée : chacun fait produire une présentation de SON établissement, surligne ce qui est faux, compte, puis écrit les faits exacts dans sa fiche d'identité
- `verification` · **25 min** — Quiz individuel de validation des acquis (10 questions), puis correction commentée question par question, chaque réponse renvoyant à la séquence qui traitait le point
- `synthese` · **10 min** — Synthèse et feuille de route : on assemble la fiche d'identité IA de l'établissement, on nomme qui répond aux avis et sous quel délai, qui valide les mentions réglementées, et les trois usages installés dès la semaine suivante

---

## ia-pour-l-industrie

840 min programmées · 515 min de pratique · **61 %**

**Livrable** : La procédure d'usage de l'IA dans le système documentaire du site — rédigée par le participant, contrôlée en binôme sur grille et prête à être versée au manuel qualité : périmètre autorisé, liste rouge du site, circuit de revalidation HSE et qualité, traces à conserver, grille de contrôle avant diffusion. Elle est accompagnée des cinq documents produits et corrigés pendant les deux jours : une fiche de non-conformité avec son analyse de cause, une réponse structurée à une réclamation client, une procédure existante mise à jour avec sa fiche d'évolution de version, une réponse à un questionnaire client ou fournisseur, et une revue d'écart d'audit avec son plan d'action daté. Ce livrable n'est ni un espace de travail persistant ni une bibliothèque de prompts : c'est un document versionné et opposable, que l'auditeur peut demander à voir.

**Corrections apportées**
- Minutage remis d'aplomb : 825 minutes programmées deviennent 840, exactement le temps dû pour un format 2 jours. Somme recalculée module par module — 110+100+115+95 = 420 au jour 1, 115+95+110+100 = 420 au jour 2.
- Quatre pauses de 15 minutes déclarées comme séquences de type pause, deux par jour, une par demi-journée (fin de M1, fin de M3, fin de M5, fin de M7). La révision précédente n'en déclarait que trois et laissait 290 minutes consécutives sans coupure au jour 2. Aucun déjeuner n'est déclaré : il n'est pas du face-à-face.
- Ratio de pratique porté de 58 % à 61 % (515 minutes de pratique et de vérification sur les 840 dues). Chaque journée tient seule au-dessus du plancher — 255/420 = 61 % au jour 1, 260/420 = 62 % au jour 2 — ce qui était le vrai enjeu puisque la fiche est vendue scindable en 2×1 jour.
- Garde-fou HSE remonté AVANT l'atelier : la règle de revalidation par le responsable HSE est désormais une séquence de cadre de 15 minutes en deuxième position du module 3, avant les 40 minutes de production. Les 20 minutes descendantes qui la portaient en aval sont devenues une vérification croisée sur grille.
- Même inversion corrigée au module 6 : le cadre (règlement européen sur l'IA, information préalable des salariés, consultation des représentants du personnel, borne sur la libération de lot) précède maintenant l'atelier de qualification au lieu de le suivre.
- Dé-duplication réellement livrée face à ia-pour-la-production. Retirés d'industrie parce que production les porte déjà : dictée et compte rendu d'intervention, traduction et simplification de consigne, commentaire d'indicateurs déjà calculés, chasse à l'erreur sur le process, espace de travail persistant, prototype d'automatisation de suivi. Ajoutés à la place, absents de production : maîtrise documentaire et mise à jour de procédure versionnée (M3), questionnaires clients et audits fournisseurs (M4), préparation de certification et revue d'écart (M5), procédure d'usage de l'IA versée au manuel qualité (M7). Industrie prend la qualité, la certification et l'auditabilité ; production garde l'atelier et le terrain.
- Cinq blocs complets dans les huit modules : chacun porte un objectif formulé en résultat observable, une démonstration avant/après avec prompt affiché en entier et un seul outil, une pratique chronométrée, une vérification corrigée en salle et une synthèse. Les modules 1 et 8, qui n'avaient ni objectif ni synthèse, et les modules 3 et 6, qui n'avaient pas de vérification, sont alignés.
- « Pseudonymiser n'est pas anonymiser » enseigné et démontré au module 1 (ré-identification en trois questions, 15 minutes), avant tout atelier. Les deux ateliers qui reposaient sur des « documents dépourvus d'identifiants » sans que l'opération soit jamais enseignée renvoient maintenant explicitement à la règle du module 1.
- Le règlement européen sur l'IA est nommé dans le programme lui-même, au module 6, et non plus seulement dans la note de changement. Une démonstration de biais de 15 minutes est ajoutée — le même dossier soumis deux fois avec une variable de plus, l'avis qui change à l'écran — avec jeu de données fictif fourni au formateur.
- Intitulés préfixés par « Matin J1 », « Après-midi J1 », « Matin J2 », « Après-midi J2 » en début de chaîne, comme l'exige sectionStartMin(). Les huit modules ne démarreront plus tous à 9 h 00 sur la timeline publique.
- Livrable remplacé : ni espace de travail persistant, ni bibliothèque de prompts. Le participant repart avec la procédure d'usage de l'IA de son site, rédigée et relue en binôme, plus les cinq documents produits en séance — un document versionné et opposable, cohérent avec l'identité qualité/audit de la fiche.
- Animabilité par un formateur non industriel : chaque séquence descendante est adossée à une trame, une grille ou un jeu de données fourni dans le kit. Aucune séquence ne demande au formateur de trancher un contenu métier — aux modules 4 et 6, c'est la salle qui qualifie et le formateur qui anime la correction à la grille.

> **À faire relire** — Trois points demandent un arbitrage humain avant publication.

1. RÉFÉRENCES JURIDIQUES À VÉRIFIER. Le module 6 affirme que le suivi et l'évaluation de la performance des travailleurs est un usage classé à haut risque par le règlement européen sur l'IA, et qu'une information préalable des salariés et une consultation des représentants du personnel sont requises avant mise en service d'un dispositif de suivi automatisé. J'ai volontairement écarté tout numéro d'article du programme : une référence fausse partirait dans le programme officiel opposable et dans les documents générés. La formulation retenue doit être relue par quelqu'un qui peut confirmer le rattachement et la date d'entrée en application des obligations concernées. Même chose pour la borne « la décision de libération de lot et la signature d'une déclaration de conformité restent celles d'une personne désignée » : juste sur le fond, mais la formulation exacte dépend du régime produit du client.

2. RECOUVREMENT RÉSIDUEL ASSUMÉ AVEC ia-pour-la-production. Deux blocs restent proches : le cadre de confidentialité du module 1 et la séquence « ce qu'on n'automatise jamais sur une personne » du module 6. Je ne les ai pas retir

### Programme

**Matin J1 · Module 1 — Le système documentaire du site face à l'IA : ce qui sort, ce qui ne sort jamais**

- `objectif` · **5 min** — Le résultat visé : savoir, devant n'importe quelle pièce du système documentaire du site, si on peut la déposer dans un assistant, dans quel environnement, ou pas du tout — et pouvoir le justifier devant un auditeur
- `cadre` · **15 min** — Les trois régimes d'usage (compte grand public, offre entreprise avec engagement de non-réutilisation, environnement validé par la DSI) et les engagements qui s'ajoutent au RGPD sur un site industriel : accord de confidentialité du donneur d'ordre, secret des affaires, propriété des plans et nomenclatures — un document reste couvert par la clause même quand on en a retiré le nom du client
- `demonstration` · **15 min** — Démonstration « pseudonymiser n'est pas anonymiser » : un rapport d'incident dont on a retiré le nom de l'opérateur, ré-identifié devant la salle en trois questions (équipe, poste de la ligne, date de l'arrêt) — un seul outil, prompt affiché en entier, script de relance fourni au formateur
- `pratique` · **35 min** — Atelier chronométré : chaque table écrit la liste rouge du site sur la trame fournie (plans et nomenclatures, paramètres et gammes de fabrication, cahiers des charges clients sous accord, données nominatives d'opérateurs) puis classe quinze pièces réelles du système documentaire en trois colonnes selon le régime d'usage
- `verification` · **20 min** — Vérification corrigée en salle : dix pièces tirées de la trame — « je la dépose, dans quel environnement, ou pas du tout » — chacun répond seul, correction collective, les écarts sont comptés
- `synthese` · **5 min** — Synthèse : les trois phrases affichables au service qualité — ce qu'on dépose, où, et qui tranche en cas de doute
- `pause` · **15 min** — Pause

**Matin J1 · Module 2 — Non-conformités et réclamations clients : de la note brute à la fiche exploitable**

- `objectif` · **5 min** — Le résultat visé : une fiche de non-conformité complète — fait, analyse de cause, action corrective, preuve attendue — et la réponse client qui en découle, rédigées à partir de notes brutes
- `demonstration` · **15 min** — Démonstration avant / après : la même non-conformité en trois lignes illisibles, puis en fiche exploitable et en réponse client structurée — méthode AXION (Acteur, conteXte, Intention, Output, Normes), prompt affiché en entier, un seul outil ; et les deux endroits où l'assistant a inventé une cause qui n'existe pas
- `pratique` · **50 min** — Atelier chronométré : chacun traite une non-conformité interne et une réclamation client réelles, sur pièces préparées selon la règle du module 1 — sortie attendue : la fiche renseignée, la liste des questions à poser au producteur du défaut, et le projet de réponse au client
- `verification` · **25 min** — Contrôle croisé en binôme sur la grille fournie : le fait est-il séparé de l'hypothèse ? l'action est-elle vérifiable et datée ? une cause a-t-elle été inventée ? tout chiffre repris est-il retrouvable dans la pièce source ? chaque binôme compte ses écarts et corrige
- `synthese` · **5 min** — Synthèse : l'IA fait parler la note brute et tient la structure, le responsable qualité tranche la cause et signe la réponse

**Après-midi J1 · Module 3 — Maîtrise documentaire : mettre à jour une procédure sans casser sa traçabilité**

- `objectif` · **5 min** — Le résultat visé : une procédure existante mise à jour, accompagnée de sa fiche d'évolution de version (ce qui change, pourquoi, qui est impacté, qui valide) — lisible par celui qui l'exécute
- `cadre` · **15 min** — Avant de toucher au premier document : tout écrit à portée sécurité — mode opératoire, consigne de poste, plan de prévention, analyse de risques — est revalidé par le responsable HSE avant diffusion, et la validation laisse une trace datée dans le système documentaire. Ce qui n'a pas cette trace ne s'affiche pas et ne remplace pas la version en vigueur. La règle est écrite au tableau et reprise dans le livrable
- `demonstration` · **15 min** — Démonstration avant / après : une procédure de contrôle réécrite par l'assistant — ce qu'il améliore (structure, ordre des étapes, langage) et les trois pièges observés en direct : la référence de norme inventée, l'étape de sécurité supprimée par souci de concision, l'indice de version perdu. Prompt affiché en entier, un seul outil
- `pratique` · **40 min** — Atelier chronométré : chacun met à jour une procédure réelle de son site et produit sa fiche d'évolution de version sur la trame fournie, en marquant explicitement les paragraphes qui devront repasser par la HSE avant diffusion
- `verification` · **20 min** — Vérification croisée en binôme sur la grille fournie : aucune étape de sécurité perdue entre l'ancienne et la nouvelle version, chaque référence normative citée retrouvée dans le document déposé, l'indice de version et le circuit de validation renseignés, les paragraphes à revalider identifiés — correction en salle
- `synthese` · **5 min** — Synthèse : on met à jour un document maîtrisé, on ne le réécrit jamais sans tracer ce qui a changé ni qui l'a validé
- `pause` · **15 min** — Pause

**Après-midi J1 · Module 4 — Questionnaires clients, audits fournisseurs et dossiers de qualification**

- `objectif` · **5 min** — Le résultat visé : une réponse complète à un questionnaire client ou à un audit fournisseur, appuyée sur les documents du site et non sur la mémoire de celui qui répond
- `demonstration` · **15 min** — Démonstration : les documents de référence du site déposés (manuel qualité, certificats, procédures), puis un questionnaire client traité question par question — et la phrase que l'assistant a affirmée sans qu'aucun document ne l'appuie. Prompt affiché en entier, un seul outil
- `pratique` · **45 min** — Atelier chronométré : chacun répond à un questionnaire réel — questionnaire client, dossier de qualification, ou grille d'audit fournisseur adressée à un sous-traitant — et marque en face de chaque réponse la pièce qui la prouve
- `verification` · **20 min** — Vérification aux sources en binôme : toute réponse sans pièce de preuve en face est barrée et transformée en question à poser en interne — on compte combien de réponses ne tenaient pas
- `synthese` · **10 min** — Synthèse du jour 1 : trois acquis — je sais dire ce qui peut sortir du site, je sais transformer une note brute en fiche opposable, je ne réponds jamais à un client sans la pièce qui prouve

**Matin J2 · Module 5 — Préparer une certification ou un audit client**

- `objectif` · **5 min** — Le résultat visé : le dossier d'audit dégrossi — écarts précédents repris, preuves attendues listées, revue d'écart et plan d'action daté
- `demonstration` · **15 min** — Démonstration : un référentiel déposé puis interrogé exigence par exigence — et la référence d'exigence que l'assistant a inventée en chemin, retrouvée en trois secondes par recherche dans le document. Prompt affiché en entier, un seul outil
- `pratique` · **45 min** — Atelier chronométré : chacun prépare la revue d'écart de son site à partir du référentiel réellement applicable (norme de système, exigence client, référentiel donneur d'ordre) et rédige le plan d'action correspondant — une ligne par écart, avec porteur, échéance et preuve attendue
- `verification` · **25 min** — Vérification aux sources en binôme : chaque exigence citée doit être retrouvée dans le document déposé, sinon la phrase saute ; chaque chiffre repris doit venir d'un enregistrement du site, jamais d'un calcul de l'assistant — on compte les phrases supprimées
- `synthese` · **10 min** — Synthèse : l'IA dégrossit le dossier et pose les bonnes questions, l'auditeur ne discute qu'avec des preuves
- `pause` · **15 min** — Pause

**Matin J2 · Module 6 — Ce que l'IA ne décide jamais sur un site : les personnes, et la conformité produit**

- `objectif` · **5 min** — Le résultat visé : savoir dire, devant un projet de suivi ou de contrôle automatisé, si l'on est encore sur de l'activité ou déjà sur l'évaluation d'une personne — et ce que cela déclenche avant toute mise en service
- `cadre` · **20 min** — Le cadre, posé avant l'atelier : dès qu'un suivi porte sur des indicateurs individuels (cadences, rebuts par opérateur, temps par poste), on est sur le suivi et l'évaluation de la performance des travailleurs, usage classé à haut risque par le règlement européen sur l'IA — avec information préalable des salariés et consultation des représentants du personnel avant toute mise en service : qui la déclenche, à quel moment, avec quelle trace. Et la borne produit : la décision de libération de lot et la signature d'une déclaration de conformité restent celles d'une personne désignée, jamais d'un système
- `demonstration` · **15 min** — Démonstration de biais : la même évaluation soumise deux fois avec une variable de plus (ancienneté, équipe, site d'origine) — l'avis rendu change à l'écran, sans qu'aucune donnée de performance n'ait bougé. Prompt affiché en entier, un seul outil, jeu de données fictif fourni dans le kit
- `pratique` · **35 min** — Atelier chronométré : chaque table qualifie trois dispositifs réels du site (cadences par ligne, rebuts par opérateur, temps par poste, géolocalisation des engins, contrôle qualité par vision) avec la grille en quatre questions — y a-t-il des données personnelles, un effet sur une personne, une obligation de sécurité, une décision sans relecture ? — et tranche : agrégation, abandon, ou dossier d'information préalable à monter
- `verification` · **15 min** — Vérification : correction collective des qualifications à la grille, table par table — les désaccords sont arbitrés en salle et la règle retenue est écrite
- `synthese` · **5 min** — Synthèse : on assiste des écrits et des dossiers, jamais un jugement sur quelqu'un ni une décision de conformité produit

**Après-midi J2 · Module 7 — Écrire la procédure d'usage de l'IA du site**

- `objectif` · **5 min** — Le résultat visé : la procédure d'usage de l'IA du site, rédigée, prête à être versée au manuel qualité et à être présentée à un auditeur
- `demonstration` · **15 min** — Démonstration : une procédure d'usage type projetée et commentée point par point — périmètre autorisé, liste rouge, circuit de validation, traces conservées, conduite à tenir en cas de doute — et les trois endroits qu'un auditeur regarde en premier
- `pratique` · **45 min** — Atelier chronométré : chacun rédige la procédure d'usage de l'IA de son site sur la trame fournie, en y reversant la liste rouge du module 1, la règle de revalidation HSE du module 3 et la grille de qualification du module 6
- `verification` · **25 min** — Contrôle croisé en binôme sur la grille de relecture fournie : le périmètre est-il borné ? la liste rouge est-elle nommée ? qui valide est-il désigné par fonction et non par prénom ? les traces à conserver sont-elles listées ? la conduite en cas de doute est-elle écrite ? — correction et reprise immédiate
- `synthese` · **5 min** — Synthèse : ce qui tient dans le temps, c'est une procédure datée et validée, pas une habitude individuelle
- `pause` · **15 min** — Pause

**Après-midi J2 · Module 8 — Évaluation, revue des productions et feuille de route**

- `objectif` · **5 min** — Le résultat visé : savoir ce qui est diffusable en l'état parmi ce qu'on a produit en deux jours, et par où commencer lundi
- `demonstration` · **15 min** — Démonstration : la même demande passée trois fois de suite donne trois textes différents — pourquoi une production IA n'est jamais un enregistrement, et ce qu'il faut donc conserver côté site (le document validé et sa trace, pas la conversation)
- `verification` · **20 min** — Quiz individuel de validation des acquis (10 questions couvrant les régimes d'usage, la liste rouge, la revalidation HSE, la vérification aux sources et la qualification des suivis) + correction commentée en salle
- `pratique` · **25 min** — Revue des productions des deux jours à la grille de contrôle avant diffusion : chacun classe ses cinq documents en trois piles — diffusable en l'état, repasse par la qualité, repasse par la HSE — et note en face ce qui manque
- `pratique` · **25 min** — Feuille de route du site : trois usages priorisés, un porteur et une échéance par ligne, ce qui doit passer devant la direction et devant les représentants du personnel avant tout déploiement — rédigée sur la trame fournie et lue à voix haute par chaque participant
- `synthese` · **10 min** — Synthèse des deux jours : je sais ce qui sort du site et sous quel régime, je produis des documents opposables et non des brouillons, et j'ai une procédure écrite qui survivra à mon départ du service

---

## ia-pour-le-transport-logistique

420 min programmées · 230 min de pratique · **55 %**

**Livrable** : Le classeur d'exploitation : les écrits types produits par le participant pendant la journée — courrier de réserve et de litige, consignes de tournée, demande et relance d'affrètement, synthèse d'exploitation en version direction et en version équipe — réunis dans un document unique avec la grille de contrôle avant diffusion (faits datés, responsabilité non admise, délais retrouvés au contrat, temps de conduite vérifiés) et la liste rouge des pièces qui ne sortent pas du service. Il est assemblé en séance (atelier de 20 min du module 4) et se diffuse tel quel au reste de l'exploitation. Il ne s'agit ni d'un espace de travail persistant ni d'une bibliothèque de prompts : c'est un document d'exploitation, autonome de tout outil, qui reste valable si l'entreprise change d'assistant.

**Corrections apportées**
- Livrable remplacé : la révision proposait « L'espace de travail IA de l'exploitation », doublon avec plusieurs autres fiches du catalogue. Remplacé par « Le classeur d'exploitation », document autonome assemblé par le participant, indépendant de tout outil.
- Minutage porté de 390 à 420 min : les deux pauses de 15 min sont désormais des séquences déclarées de type « pause » (fin de M1, fin de M3) et comptent dans le face-à-face. Le déjeuner n'apparaît pas dans le programme, conformément à la convention de calcul ; il est à poser dans la convocation entre M2 et M3.
- Ratio recalculé sur le temps VENDU et non sur le temps écrit : 230 min (pratique + vérification) ÷ 420 = 55 %. Le contrôle relevait 59 % calculés sur 390 min, soit 54,8 % réels — sous le plancher affiché. Somme refaite séquence par séquence et vérifiée par script.
- MAJEUR corrigé (5 blocs) : M1, M3 et M4 ouvrent maintenant par un objectif formulé en résultat observable et ferment par une synthèse en acquis. Les quatre modules se déclinent en objectif / démonstration / pratique / vérification / synthèse.
- MAJEUR corrigé (M4 sous-dimensionné) : l'atelier unique de 30 min est scindé en 25 min de rédaction de la synthèse d'exploitation (version direction + version équipe) et 20 min d'assemblage effectif du livrable. Le quiz passe de 15 min réels à une séquence de vérification de 15 min, et la feuille de route de 20 min d'exposé à 10 min d'écriture par le participant.
- MAJEUR corrigé (ratio par module) : M1 passe de 45/95 à 30/85 en pratique pure mais l'exposé descendant y est réduit ; M4 passe de 45/95 (47 %) à 70/105 (67 %) en convertissant l'exposé de 20 min et la feuille de route de 20 min en 15 min de cadre + 10 min d'écriture.
- MINEUR corrigé (fausse anonymisation) : la mention « pièces dépourvues d'identifiants et de tarifs » du M2 est supprimée — elle laissait croire que retirer les identifiants suffit. Remplacée par « sur pièces reconstituées à partir du kit lorsque le dossier réel ne peut pas sortir », et adossée à une démonstration de ré-identification de 15 min ajoutée au M1.
- Garde-fous manquants ajoutés : le règlement européen sur l'IA est désormais nommé (M4, suivi et évaluation de la performance des travailleurs = usage à haut risque) et une démonstration de biais de 10 min est créée — ni l'un ni l'autre n'existaient dans la révision précédente.
- Ordre des garde-fous vérifié : régimes d'usage et liste rouge (M1) avant tout atelier sur dossier réel ; bornes temps de conduite et exclusion des documents réglementés (M3, position 2) avant l'atelier tournées de 40 min ; « ce qu'on n'automatise jamais sur une personne » (M4, position 2) avant l'atelier reporting.
- Animabilité : chaque séquence à contenu réglementaire s'appuie sur un support du kit, jamais sur l'expertise du formateur — dix pièces fournies (M1), grille de contrôle fournie (M2), fiche de référence temps de conduite dans le kit formateur en cas d'erreur de la salle (M3), checklist fournie (M3).
- MINEUR corrigé (timeline publique) : les modules sont préfixés « Matin · » et « Après-midi · », les quatre modules ne démarreront plus tous à 9 h 00.
- BLOQUANT — non corrigeable dans le programme, à propager dans catalog-v2.ts : casUsageFr (l. 2318), metaDescriptionFr (2306), beneficeDirigeantFr (2330), avantApresFr (2336) et equationTempsFr (2333) vendent toujours la planification de tournées et « un document de transport rempli en quelques minutes », que le M3 met hors périmètre. Remplacements proposés — casUsageFr : « Les courriers de réserve, de litige et de réclamation », « Les consignes et instructions de tournée », « La demande et la relance d'affrètement », « Le commentaire du reporting d'exploitation » ; equationTempsFr : « 1 journée → un courrier de réserve structuré à partir des faits du dossier » ; avantApresFr.apres : « Des écrits d'exploitation homogènes, contrôlés avant diffusion » ; beneficeDirigeantFr : « Des courriers de litige et des consignes de tournée homogènes dans tout le service, contrôlés avant diffusion. »
- MAJEUR — materielFr absent du catalogue (aucun champ entre les l. 2293 et 2410) alors que trois ateliers exigent des pièces. Valeur proposée : « Deux dossiers de litige récents (une réserve à la livraison, un retard réclamé), un ordre de transport ou une commande client, le contrat type de l'entreprise, et les indicateurs d'exploitation de la semaine écoulée. »
- MINEUR — h1Fr (l. 2304) quasi identique à ceux du BTP et du commerce (« optimiser l'ensemble de son activité »). Proposition : « Formation IA pour le transport et la logistique : litiges, consignes de tournée et affrètement ».
- MINEUR — outilsFr à surcharger sur un seul assistant : le défaut catalogue promet « les trois assistants », ce qui contredit la règle « une démonstration, un seul outil » appliquée dans les quatre modules.

> **À faire relire** — 1) RÉFÉRENCES JURIDIQUES — j'ai volontairement retiré tout numéro d'article des titres de séquences, pour qu'aucune référence non vérifiée ne parte dans le programme officiel ni dans les documents générés. Les obligations décrites reposent sur : le règlement (CE) n° 561/2006 pour les temps de conduite et de repos (M3), l'accord ADR pour les déclarations de matières dangereuses (M3), le règlement (UE) 2024/1689 annexe III pour le classement à haut risque du suivi et de l'évaluation de la performance des travailleurs — dont l'applicabilité au 2 août 2026 doit être confirmée (M4), et les articles L.1222-4 (information préalable du salarié sur un dispositif de collecte) et L.2312-38 du Code du travail (consultation des représentants du personnel sur les moyens de contrôle de l'activité) (M4). À faire relire par un juriste AVANT de faire figurer ces références dans le guide d'animation ou le livret stagiaire.

2) ARBITRAGE COMMERCIAL — la correction du défaut BLOQUANT touche la page publique (metaDescriptionFr, beneficeDirigeantFr, avantApresFr, equationTempsFr, casUsageFr) : la fiche cesse de vendre la planification de tournées et le remplissage de documents de transport, pour vendre l

### Programme

**Matin · L'exploitation et l'IA : ce qui peut sortir, ce qui ne sort jamais**

- `objectif` · **5 min** — Le résultat visé : devant n'importe quelle pièce de l'exploitation, savoir si on peut la déposer dans un assistant, et dans quel environnement
- `demonstration` · **15 min** — Avant / après : un appel de conducteur noté à la volée devient une consigne de livraison claire — méthode AXION (Acteur, conteXte, Intention, Output, Normes), prompt affiché en entier, un seul assistant
- `demonstration` · **15 min** — « Retirer le nom n'anonymise pas » : un dossier de litige privé de ses identifiants, ré-identifié devant la salle en trois questions (date, lieu de livraison, nature de la marchandise) — le dossier reste une donnée personnelle
- `cadre` · **15 min** — Les trois régimes d'usage — compte personnel, offre entreprise avec engagement de non-réutilisation, environnement validé par la direction : ce que chacun autorise avant de déposer un ordre de transport, un contrat client ou un dossier de litige
- `pratique` · **20 min** — Atelier : la salle écrit la liste rouge de l'exploitation — tarifs et taux d'affrètement, contrats clients, données personnelles et positions des conducteurs, pièces touchant un contentieux en cours
- `verification` · **10 min** — Vérification corrigée en salle : dix pièces de l'exploitation fournies dans le kit — « je la dépose, dans quel environnement, ou pas du tout »
- `synthese` · **5 min** — Acquis : je classe chaque pièce avant de la déposer ; je traite un dossier privé de son nom comme une donnée personnelle
- `pause` · **15 min** — Pause

**Matin · Litiges, réserves et réclamations clients**

- `objectif` · **5 min** — Le résultat visé : un courrier de réserve ou de litige qui expose les faits datés sans admettre de responsabilité
- `demonstration` · **15 min** — Avant / après : la même avarie traitée en courrier improvisé puis en courrier structuré — prompt affiché en entier, un seul assistant, et la liste de ce qu'on ne concède jamais par écrit
- `pratique` · **45 min** — Atelier chronométré : chacun traite deux dossiers — une réserve à la livraison, un retard réclamé par le client — sur pièces reconstituées à partir du kit lorsque le dossier réel ne peut pas sortir du service
- `verification` · **20 min** — Contrôle croisé en binôme avec la grille fournie : les faits sont-ils datés ? une responsabilité est-elle admise ? chaque délai et chaque réserve cités se retrouvent-ils au contrat type, ou l'assistant les a-t-il inventés ?
- `pratique` · **10 min** — Reprise : chacun corrige son courrier d'après la grille et le verse à son classeur d'exploitation
- `synthese` · **5 min** — Acquis : l'assistant rédige, l'exploitant tranche, le contrat fait foi ; tout délai cité est retrouvé au contrat ou supprimé

**Après-midi · Consignes de tournée, documents et affrètement**

- `objectif` · **5 min** — Le résultat visé : produire les consignes et les courriers qui accompagnent une tournée, sans jamais laisser l'assistant construire la tournée
- `cadre` · **20 min** — Chasse à l'erreur en direct : on interroge l'assistant sur les temps de conduite et de repos, la salle surligne ce qui est faux (fiche de référence dans le kit du formateur) — d'où les deux bornes de la journée : toute tournée est vérifiée au regard de la réglementation sociale avant diffusion, et les documents réglementés (lettre de voiture, déclaration de matières dangereuses) restent hors du périmètre de la génération assistée
- `demonstration` · **15 min** — Une commande client devient instructions au conducteur, message au client et courrier d'accompagnement : trois sorties, une seule demande, prompt affiché en entier
- `pratique` · **40 min** — Atelier chronométré : chacun produit les consignes de sa tournée du lendemain, puis une demande d'affrètement et sa relance sous-traitant
- `verification` · **15 min** — Vérification croisée avec la checklist fournie : heures, adresses, contraintes de quai, mentions contractuelles, temps de conduite — tout chiffre non retrouvé dans la commande est surligné puis corrigé
- `synthese` · **5 min** — Acquis : le TMS ordonnance, l'assistant rédige ; rien ne part au conducteur sans contrôle des temps de conduite
- `pause` · **15 min** — Pause

**Après-midi · Suivi d'activité, personnes et classeur d'exploitation**

- `objectif` · **5 min** — Le résultat visé : rédiger le commentaire du reporting d'exploitation à partir d'indicateurs déjà calculés par vos outils, sans jamais noter quelqu'un
- `cadre` · **15 min** — Ce qu'on n'automatise jamais sur une personne : suivi individuel des conducteurs, géolocalisation, notation de la performance — le suivi et l'évaluation de la performance des travailleurs sont classés à haut risque par le règlement européen sur l'IA ; information préalable des salariés et consultation des représentants du personnel avant toute mise en service
- `demonstration` · **10 min** — Le biais rendu visible : le même tableau d'aléas commenté deux fois par l'assistant, avec puis sans les noms des conducteurs — le ton change et la faute se déplace
- `pratique` · **25 min** — Atelier chronométré : chacun rédige la synthèse d'exploitation de sa semaine (taux de service, aléas, litiges) en version direction puis en version équipe
- `pratique` · **20 min** — Atelier : assemblage du classeur d'exploitation — les écrits produits dans la journée, la grille de contrôle avant diffusion et la liste rouge, réunis en un document unique diffusable au service
- `verification` · **15 min** — Quiz individuel de validation des acquis (10 questions) + correction commentée en salle
- `pratique` · **10 min** — Feuille de route écrite par chaque participant : trois usages priorisés, qui les porte, ce qui doit passer devant la direction et les représentants du personnel avant mise en service
- `synthese` · **5 min** — Acquis : l'assistant commente des indicateurs déjà calculés ; aucune personne n'est notée, et rien ne se met en service sans information préalable

---

## ia-pour-la-banque-assurance

420 min programmées · 245 min de pratique · **58 %**

**Livrable** : Le protocole IA du service — un document de quatre pages assemblé et signé en séance par le participant : (1) sa liste rouge complétée sur ses propres pièces et la grille de qualification des trois régimes d'usage ; (2) le test de qualification en quatre questions appliqué à trois dossiers réels, avec les trois phrases de l'établissement et la formule de renvoi à la conformité ; (3) ses trois réponses types et ses trames de synthèse et de courrier, chacune portant en en-tête ses champs interdits, sa mention de validation humaine et son modèle de ligne de trace ; (4) sa feuille de route et le point d'arrêt « à faire valider par la conformité avant déploiement ». C'est une procédure interne opposable, à faire viser par un responsable — et non un environnement outillé (« espace de travail persistant ») ni un recueil de formulations (« bibliothèque de prompts »), qui sont les livrables d'autres fiches du catalogue.

**Corrections apportées**
- BLOQUANT levé — ratio de pratique porté de 41 % à 58 % (245 min sur 420 dues). 85 minutes de descendant ont été converties en pratique chronométrée, exactement selon la piste du contrôle : les 20' d'exposé sur les régimes d'usage deviennent 15' de cadre + 25' de tri de vingt pièces ; les 20' de frontière haut risque deviennent 15' de cadre + 25' de test de qualification en 4 questions sur les propres dossiers ; la liste rouge co-construite (25' non typée) devient 5' de liste de référence remise + 20' de confrontation aux pièces réelles ; les 20' de feuille de route deviennent 10' d'écriture effective. Les quatre séquences « résultat visé » passent de 10' à 5'.
- BLOQUANT levé — le Module 1 contient désormais deux ateliers chronométrés (tri de pièces 25', confrontation de la liste rouge 20') là où il n'en portait aucun.
- MAJEUR levé — les trois démonstrations portent maintenant « prompt affiché en entier, un seul outil ». La démonstration de biais du M2 précise « les deux prompts affichés en entier côte à côte, la variable ajoutée surlignée » : sans les deux prompts à l'écran, elle ne prouvait rien.
- MAJEUR levé — les quatre modules portent les cinq blocs. Ajout d'une synthèse de 5' au M1 et au M4 (le M4 clôturait sur une feuille de route, pas sur des acquis-actions), d'une vérification de 10' au M2 (huit situations, correction collective), et d'une démonstration de 10' au M4 (une réponse type et sa ligne de trace).
- MINEUR levé — animabilité de la liste rouge : elle n'est plus construite ex nihilo par la salle (un formateur non spécialiste ne pouvait pas valider une omission par son silence). Une liste rouge de référence imprimée est remise (identité, santé et questionnaire médical, encours et incidents, éléments de sinistre corporel, déclaration de soupçon), et la salle la complète, la barre et la discute. Même parade appliquée au tri de pièces et à la vérification : corrigé du formateur fourni.
- MINEUR levé — contradiction M1/M3 supprimée : l'objectif du M3 disait « sans qu'aucune donnée nominative ait quitté l'établissement », ce qui rejouait le slogan absolu que la révision venait supprimer. Il dit désormais « dans le régime d'usage identifié au module 1 ».
- Tenu de la révision précédente, non rejoué : les trois régimes d'usage à la place du slogan « aucune donnée nominative ne sort » ; la démonstration « pseudonymiser n'est pas anonymiser » ; le module entier sur les usages hors périmètre placé AVANT tout atelier sur dossier ; la déclaration de soupçon nommée en interdiction absolue ; les données de santé dans la liste rouge ; le sinistre comme cas central du M3 avec vérification aux sources ; la règle de traçabilité posée avant l'atelier du M4 ; la formule de renvoi à la conformité écrite par les tables.
- Livrable changé — la révision précédente proposait « l'espace de travail IA du service », qui est le livrable réservé d'autres fiches et que la consigne interdit ici ; le catalogue actuel annonce « bibliothèque de prompts », également interdit. Remplacés par un protocole de service en quatre pages, assemblé page par page au fil des quatre modules — chaque atelier produit une page, ce qui rend le livrable vérifiable en fin de journée.
- Le déjeuner n'est pas déclaré dans ce programme, conformément à la consigne (le face-à-face dû est de 420 min, déjeuner exclu). Les deux pauses de 15 min sont typées « pause » et comptent dans les 420. Voir alerte humaine : la timeline publique, elle, doit porter le déjeuner.

> **À faire relire** — 1) RÉFÉRENCES JURIDIQUES À FAIRE RELIRE (aucun numéro d'article n'a été cité volontairement, pour ne pas propager une référence fausse dans le programme opposable, mais trois affirmations de fond engagent l'organisme et doivent être validées par un juriste avant publication) : (a) le classement en « haut risque » par le règlement européen sur l'IA de l'évaluation de solvabilité / notation de crédit ET de la tarification et sélection des risques en assurance vie et santé — vérifier le périmètre exact (l'assurance dommages n'est a priori pas visée, alors que le public de la fiche inclut des courtiers IARD) et la date d'applicabilité réellement en vigueur au jour de la session ; (b) l'interdiction de révéler l'existence d'une déclaration de soupçon, présentée en séance comme une interdiction absolue assortie d'un risque pénal — confirmer la qualification et le périmètre des personnes tenues ; (c) le droit du client à être informé et à obtenir une intervention humaine face à une décision automatisée — confirmer les conditions de déclenchement (décision entièrement automatisée produisant un effet juridique ou significatif) avant de l'énoncer comme un droit général. 2) DÉJEUNER : la cons

### Programme

**Module 1 — Le cadre d'abord : dans quel environnement chaque pièce a le droit d'être traitée**

- `objectif` · **5 min** — Le résultat visé : savoir, devant n'importe quelle pièce d'un dossier, dans quel environnement on a le droit de la traiter — ou pas du tout
- `cadre` · **15 min** — Les trois régimes d'usage : compte grand public, offre entreprise avec engagement de non-réutilisation, environnement validé par la conformité — ce que chacun autorise, ce qu'aucun n'autorise, et les quatre questions à poser à sa DSI (fiche remise imprimée)
- `pratique` · **25 min** — Tri chronométré : vingt pièces de dossier (fournies) réparties par chaque table entre les trois régimes ou « pas du tout » — grille de tri et corrigé du formateur fournis
- `demonstration` · **15 min** — Pseudonymiser n'est pas anonymiser : un dossier privé de son nom, ré-identifié devant la salle en trois questions — les prompts affichés en entier, un seul outil
- `cadre` · **5 min** — La liste rouge de référence du métier, remise imprimée : identité et coordonnées, données de santé et questionnaire médical, encours et incidents de paiement, éléments de sinistre corporel — et l'interdiction absolue de laisser sortir quoi que ce soit qui touche à une déclaration de soupçon
- `pratique` · **20 min** — Chaque table confronte la liste rouge de référence à ses propres pièces : ajoute ce qui lui manque, barre ce qui ne la concerne pas, nomme son cas litigieux → page 1 du protocole
- `verification` · **15 min** — Dix pièces projetées, réponse individuelle écrite : « je la traite, dans quel environnement, ou pas du tout » — correction collective sur le corrigé du formateur
- `synthese` · **5 min** — Deux acquis-actions : je qualifie la pièce avant d'ouvrir l'outil ; je pose lundi les quatre questions à ma DSI
- `pause` · **15 min** — Pause

**Module 2 — Ce que l'IA ne touche jamais dans ce métier**

- `objectif` · **5 min** — Le résultat visé : reconnaître les décisions qui ne se délèguent pas, et savoir ce qu'on doit au client quand un outil est intervenu dans son dossier
- `cadre` · **15 min** — La frontière posée : octroi et notation de crédit, tarification et sélection des risques en santé et prévoyance — usages classés à haut risque par le règlement européen sur l'IA, hors du périmètre de cette journée et de vos outils du quotidien ; et le droit du client à être informé et à obtenir une intervention humaine
- `demonstration` · **20 min** — Démonstration de biais : le même dossier soumis deux fois, une seule variable de plus (âge, adresse, situation familiale) — les deux prompts affichés en entier côte à côte, un seul outil, la variable ajoutée surlignée, et l'avis rendu qui change à l'écran
- `pratique` · **25 min** — Chaque participant passe trois de ses propres dossiers au test de qualification en quatre questions (grille fournie) : est-ce une décision sur une personne ? produit-elle un effet ? qui la signe ? qu'en saura le client ? → page 2 du protocole
- `pratique` · **25 min** — Atelier chronométré par table : écrire les trois phrases de l'établissement — ce qu'on dit au client, qui décide, ce qu'on trace — et la formule de renvoi à la conformité quand le doute persiste (« je ne me prononce pas, notre service conformité tranche »)
- `verification` · **10 min** — Huit situations projetées, réponse individuelle : « dans le périmètre / hors périmètre / à faire trancher par la conformité » — correction collective
- `synthese` · **5 min** — Deux acquis-actions : l'IA prépare, l'humain décide et signe ; toute décision doit rester justifiable un an plus tard

**Module 3 — Sinistres, dossiers et documents contractuels**

- `objectif` · **5 min** — Le résultat visé : la synthèse d'un dossier et le courrier qui l'accompagne, prêts pour un rendez-vous, produits dans le régime d'usage identifié au module 1
- `demonstration` · **15 min** — Des conditions générales déposées puis interrogées garantie par garantie, franchise et exclusion comprises — le prompt affiché en entier, un seul outil — et la clause que l'outil a inventée, retrouvée en direct
- `pratique` · **50 min** — Atelier chronométré : chacun traite un cas complet sur dossier reconstitué fourni — déclaration de sinistre ou reprise d'historique — jusqu'au courrier d'acceptation ou de refus motivé
- `verification` · **20 min** — Vérification aux sources en binômes croisés : chaque garantie, chaque franchise, chaque délai cité doit être retrouvé dans le document déposé, sinon la phrase saute — aucun contenu réglementaire produit de mémoire
- `synthese` · **5 min** — Deux acquis-actions : l'IA structure, le gestionnaire signe ; je ne laisse passer aucune référence contractuelle non retrouvée à la source
- `pause` · **15 min** — Pause

**Module 4 — Réponses aux clients, traçabilité et protocole du service**

- `objectif` · **5 min** — Le résultat visé : des réponses homogènes aux questions récurrentes, tracées, qui ne tiennent jamais lieu de conseil
- `cadre` · **10 min** — La règle, posée avant l'atelier : toute réponse qui touche une garantie, un tarif ou une décision passe par une validation nommée et laisse une trace — c'est ce qui rend le devoir de conseil justifiable a posteriori
- `demonstration` · **10 min** — Une réponse type produite à l'écran puis sa ligne de trace écrite dans la foulée (qui a demandé, quel outil, qui a validé, quand) — le prompt affiché en entier, un seul outil
- `pratique` · **30 min** — Atelier chronométré : chacun produit trois réponses types de son service, chacune portant en en-tête ses champs interdits, sa mention de validation humaine et sa ligne de trace → page 3 du protocole
- `verification` · **15 min** — Quiz individuel de validation des acquis (10 questions) + correction commentée en salle
- `pratique` · **10 min** — Chacun écrit sa feuille de route : trois usages priorisés, l'environnement à faire valider par la conformité, ce qui remonte à la direction avant tout déploiement → page 4 du protocole
- `synthese` · **5 min** — Trois acquis-actions : je qualifie avant d'ouvrir l'outil ; je vérifie toute référence contractuelle à la source ; je trace toute réponse qui engage l'établissement

---
