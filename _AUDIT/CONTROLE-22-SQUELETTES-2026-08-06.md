# Contrôle des 22 squelettes révisés — 6 août 2026

5 contrôleurs. 22 fiches, 14 problèmes bloquants.

## Verdict

**Verdict**

Le catalogue révisé est nettement meilleur que l'actuel : les garde-fous remontent avant les ateliers dans la grande majorité des fiches, « pseudonymiser n'est pas anonymiser » remplace l'évacuation par le mot « anonymisé », les livrables sont produits par le participant, et la démonstration de biais existe enfin (banque-assurance). Le travail d'analyse est sérieux et souvent juste.
Mais il n'est pas applicable en l'état : **0 fiche sur 22 est prête**, 4 sont à refaire, 14 défauts bloquants restent, et le défaut central du catalogue d'origine — un ratio de pratique déclaré 70 % que rien ne tient — n'est corrigé sur aucune fiche.
Ne pas appliquer ce lot tel quel. Il vaut comme base de travail, pas comme livrable.

**Ce qui bloque**

Par ordre de gravité.

1. **Garde-fou après le geste, sur risque sanitaire ou pénal** — `ia-pour-la-sante` : la démonstration reprend « le même courrier de sortie » à la minute 5, avant les régimes d'usage, avant la définition de la donnée de santé, avant la borne du métier. `ia-pour-l-hotellerie-restauration` : l'atelier traduit la carte, la règle allergènes/origine/fait maison arrive après. `ia-pour-l-industrie` : la consigne de poste traduite est produite (45'), la revalidation HSE est énoncée ensuite (20'). C'est exactement l'inverse de ce que ces trois fiches promettent dans leur propre note de changement.
2. **Doublon commercial non résolu** — `ia-pour-l-industrie` : 6 modules sur 8 ont un équivalent direct dans `ia-pour-la-production` **après** révision (M1, M3, M4, M6 quasi verbatim, M7, M8). Deux produits vendus séparément 3 900 € HT restent le même contenu. La dé-duplication est annoncée, pas livrée.
3. **La fiche commerciale contredit le programme** — `ia-pour-le-transport-logistique` : la requalification ne touche que `objectifsFr`. `casUsageFr`, `metaDescriptionFr`, `beneficeDirigeantFr`, `avantApresFr` et surtout `equationTempsFr` (« un document de transport rempli en quelques minutes ») continuent de vendre ce que le M3 met hors périmètre.
4. **Ratio impossible à atteindre** — `ia-pour-la-banque-assurance` : 41 % au strict, plafond absolu 52,6 % sous la lecture la plus généreuse, Module 1 sans le moindre atelier, et **aucun déjeuner déclaré sur 7 h**. La journée est matériellement inanimable.
5. **Formats 2 jours sous-programmés** — `ia-pour-la-production` (745' pour 840', 1 h 35 de vide) et `ia-pour-l-it` (760' pour 840', 20 minutes de vide × 4 demi-journées). Ce n'est pas une retouche, c'est un planning à refaire.
6. **Ratio bloquant** — `seminaire-ia-toute-l-entreprise-1j` 48,7 % (et il est désigné « modèle à répliquer sur les 21 autres »), `ia-pour-les-achats` 44,9 %, `ia-pour-la-relation-client` 46,2 %.

**Les chiffres qui comptent**

- **21 fiches sur 22 sous 60 % de pratique.** Seule `hotellerie` passe (62 %) — et elle est bloquée par ailleurs. Fourchette : 41 % à 62 %. Au décompte strict, 7 fiches sont sous 50 %.
- **Écart avec le programme Qualiopi officiel : 8 à 29 points.** Vérifié : `src/server/qualiopi/formations/catalog-import.ts:67` écrit `RATIO_PRATIQUE_PCT = 70` en dur et le pousse ligne 193 dans le programme déclaré, pour les 22. La révision ne touche pas ce fichier.
- **10 fiches sous-programmées, 467 minutes manquantes au total** (≈ 7 h 47, soit plus d'une journée de formation vendue et non livrée) : équipes −77, production −95, IT −80, journée d'initiation −65, RH −35, santé/juridique/banque −30 chacune, industrie −15, bien-commencer −10.
- **3 fiches finissent avant 16 h** pour 7 h dues : équipes à 15 h 43, journée d'initiation à 15 h 55.
- **Timeline publique cassée sur 16 fiches minimum.** Vérifié dans `src/content/formations/catalog-v2-schedule.ts:50-54` : `sectionStartMin()` ne bascule à 14 h que sur le préfixe « après-midi », et `deriveProgrammeSchedule()` remet l'horloge au début **à chaque section** — donc deux sections « Matin — » se recouvrent intégralement (achats, relation-client), et « Déjeuner » comme « Pause (15') » (banque) ne font pas avancer l'horloge du tout.
- **Prêtes en l'état : 0.** 4 à refaire (banque-assurance, production, IT, industrie), 18 à corriger.

**Cohérence du catalogue**

- **Le livrable ne distingue plus rien.** « Espace de travail persistant » devient l'artefact de 4 des 5 fiches généralistes (journée d'initiation, équipes, automatisation, séminaire). C'est précisément le reproche fait à la bibliothèque de prompts — « le livrable de quinze fiches » — reconduit sous un autre nom.
- **Industrie ≈ production** (voir bloquant 2). Et `ia-pour-les-achats` M4 duplique l'atelier tableur de `ia-pour-la-finance`.
- **Le règlement européen n'existe que dans les justifications.** Zéro occurrence de « haut risque », « règlement européen » ou « biais » dans les programmes livrés de production, IT, immobilier, BTP, commerce, hôtellerie, transport, industrie — alors que production et IT font qualifier du suivi d'activité de salarié (annexe III §4b) et que RH annonce une « qualification haut risque » absente de ses six séquences de M1. Seule `banque-assurance` le nomme correctement : elle prouve que c'est faisable, et personne ne l'a copiée.
- **Écarts injustifiés entre fiches sœurs.** RH écrit « prompts affichés en entier » ; banque-assurance ne le fait sur aucune de ses trois démonstrations, y compris celle de biais dont c'est tout l'intérêt. Immobilier verrouille sa trame juridique et interdit de l'improviser ; BTP et commerce laissent le formateur exposer les mentions obligatoires du devis bâtiment et le droit de la consommation sans rien lui fournir. BTP, immobilier et commerce déclarent un déjeuner ; banque, hôtellerie et industrie n'en déclarent aucun.
- **Contradiction interne assumée nulle part.** `relation-client` construit pendant 30 minutes une base de connaissances décrite comme « exactement ce qu'on branche sur un agent conversationnel », et n'énonce l'obligation de transparence qu'en Module 4, dernière demi-heure. `finance` pose la bonne règle (« un écart signalé ne désigne jamais une personne ») mais à l'intérieur de l'énoncé de l'atelier, pas avant.
- **`materielFr` absent sur 5 fiches** (BTP, immobilier, commerce, transport, et non déclaré ailleurs) alors que 3 ateliers sur 4 exigent des pièces réelles apportées par le participant. Sans déclaration, les participants arrivent les mains vides et les ateliers tombent.
- **Erreur de droit à corriger avant toute publication** : RH cite deux fois L.1221-9 pour l'information du CSE. Le bon article est L.2312-38 — que le même document cite correctement dans la fiche production. Cette référence part dans les objectifs pédagogiques, dans le programme Qualiopi et en en-tête d'un livrable destiné à être remis à un CSE.
- **Doctrine incohérente** : le séminaire est désigné gabarit du catalogue alors qu'il porte le pire ratio du lot et que 3 de ses 5 séquences ne se déclinent pas en 5 blocs. Le vrai gabarit, sur les chiffres, c'est `ia-pour-l-automatisation` (minutage exact, garde-fous en tête, jour 1 autonome).

**Ce que Will doit trancher**

1. **Sur quelle base se mesure le plancher de 60 % ?** Sur les minutes de séquences, ou sur les minutes de face-à-face dues ? L'écart entre les deux conventions vaut 5 à 10 points et explique la moitié des désaccords entre contrôleurs. Aucune fiche ne tient sur la seconde base. Trancher, écrire la convention, puis la faire vérifier par un test qui rougit — sinon on recommence ce chantier dans six mois.
2. **Les 70 % déclarés en base.** Soit on calcule le ratio réel fiche par fiche et on le déclare tel quel, soit on baisse la déclaration Qualiopi. Continuer à déclarer 70 % pour des programmes qui en produisent 45 % est une non-conformité opposable, vérifiable en audit en dix minutes avec le programme public sous les yeux. Ce n'est pas un arbitrage technique : c'est une déclaration contractuelle.
3. **Industrie et production : un produit ou deux ?** Si deux, il faut réécrire 6 modules sur 8. Si un, il faut retirer une référence du catalogue et décider ce qu'on dit aux prospects déjà approchés.
4. **Jusqu'où Axion-IA enseigne-t-il le droit ?** Les fiches font aujourd'hui produire par un formateur IA non-juriste : une mention d'information candidats, une note au CSE, trois articles d'une charte opposable, un courrier de litige de réception. Deux positions tenables : trames verrouillées fournies dans le kit avec interdiction écrite de les modifier en séance et formule de refus assumée (ce que fait déjà immobilier), ou retrait pur et simple de ces livrables. La position actuelle — improviser — n'en est pas une, surtout devant une salle de juristes.
5. **Le prix des journées.** Une journée à 1 900 € qui programme 5 h 43 doit être recadrée ou revue. C'est un arbitrage commercial, pas pédagogique.
6. **Transport.** On retire la planification de tournées de toute la fiche commerciale, ou on la remet dans le programme. Aujourd'hui la page publique promet ce que le déroulé refuse.
7. **Le livrable commun.** « L'espace de travail » sur 4 fiches sur 5 : signature de méthode assumée, ou aveu que les fiches ne se distinguent pas ? Si c'est une signature, il faut qu'elle soit définie une fois et déclinée différemment ; si ce n'en est pas une, il faut 4 livrables distincts.

Fichiers de référence : `C:/Users/willi/Documents/Projets/Axion-IA/axionia-wt-vente-phase0/_AUDIT/REVISION-22-SQUELETTES-2026-08-06.md`, `C:/Users/willi/Documents/Projets/Axion-IA/axionia-wt-vente-phase0/src/server/qualiopi/formations/catalog-import.ts` (lignes 55, 67, 193), `C:/Users/willi/Documents/Projets/Axion-IA/axionia-wt-vente-phase0/src/content/formations/catalog-v2-schedule.ts` (lignes 43-54).

---

## Détail par fiche

### ia-pour-bien-commencer — **a_corriger**

- Pratique : **59 %** · programmé **230 min** sur **240 min** dus

**MAJEUR** — Ratio de pratique sous le plancher. Pratique chronométrée 30+35+30 = 95 min, vérification 8+8+15 = 31 min, total 126 min. Sur les 215 min de séquences hors pause = 58,6 %. Sur les 240 min dues = 52,5 %. Le plancher non négociable est 60 %. Et catalog-import.ts:67 écrit RATIO_PRATIQUE_PCT = 70 en dur : le programme Qualiopi officiel déclarera 70 % de pratique pour une fiche qui en programme 52,5 %, soit 17,5 points d'écart non étayés.

  → *Il manque 18 min de pratique pour atteindre 144 min (60 % de 240). 10 min sont déjà non programmées ; convertir en plus les 8 min de 'Avant de diffuser' (M3, 7') et une partie du 12' 'Comment ça marche' en manipulation. Et faire dériver ratioPratiquePct du programme au lieu de la constante 70.*

**MINEUR** — Minutage court de 10 min. Somme réelle : M1 = 70', M2 = 70', M3 = 75', soit 215' de séquences + 15' de pause = 230' pour 240' dues (4h, CANONICAL_DUREE_HEURES['4h'] = 4).

  → *Affecter les 10 minutes à la pratique du M3 (30' → 40') plutôt que de les laisser en creux.*

**MINEUR** — Le module 3 n'a pas de bloc synthèse au standard. M1 et M2 se terminent par 'Vos acquis' en 3 formulations d'action ; M3 se termine par 'Feuille de route personnelle' (10'), qui est une projection, pas 2-3 acquis observables. Le 5e bloc manque donc sur 1 module sur 3.

  → *Ajouter 3' de 'Vos acquis' au M3 avant la feuille de route.*

**MINEUR** — La démonstration du M3 tient 3 tâches en 10 minutes ('un e-mail difficile, la synthèse d'un document long, la préparation d'une réunion'), soit 3'20 par avant/après. Le standard impose un prompt AFFICHÉ EN ENTIER : à ce rythme il est montré, pas lu. Par ailleurs le M1 précise 'les deux textes affichés en entier' — ce sont les sorties, pas la demande ; seul le M2 dit bien 'les deux demandes affichées en entier'.

  → *Ramener la démo M3 à une seule tâche avec prompt affiché en entier, et corriger la formulation du M1 en 'les deux demandes affichées en entier'.*

**MINEUR** — Le mot 'biais' reste absent de la fiche, alors que c'est la porte d'entrée du catalogue et que le défaut établi est justement 'biais n'apparaît qu'une fois dans tout le catalogue'. Le M1 traite l'invention (chasse à l'erreur, 30') mais pas le biais. Seule la fiche séminaire corrige ce défaut dans le lot.

  → *Intégrer dans la démonstration avant/après du M1 le geste 'on change un seul mot de la demande et la réponse change de camp', déjà écrit pour le séminaire — coût zéro minute, contenu universel.*

---

### ia-pour-bien-commencer-journee — **a_corriger**

- Pratique : **56 %** · programmé **355 min** sur **420 min** dus

**MAJEUR** — 65 minutes non programmées sur une journée de 7 h. Somme réelle : M1 = 85', M2 = 80', M3 = 85', M4 = 75' = 325' de séquences, + 2 pauses de 15' = 355'. Le dû est 420' de face-à-face (CANONICAL_DUREE_HEURES['1j'] = 7, catalog-import.ts:57 ; le repas d'1 h est hors face-à-face). Horloge à 9h00 : fin à 15h55. Il manque 1h05 de programme, soit exactement le défaut annoncé dans la consigne. Le même verdict reproche pourtant au squelette d'origine de ne pas justifier 700 € de plus que la 4 h.

  → *Programmer les 65 minutes manquantes, prioritairement en pratique (le M3 documents/dictée est le différenciateur revendiqué et ne porte que 40' d'atelier pour 2 exercices distincts : dépôt + dictée).*

**MAJEUR** — Ratio de pratique sous le plancher. Pratique 35+38+40+25 = 138 min, vérification 6+11+12+15 = 44 min, total 182 min. Sur 325' de séquences = 56,0 %. Sur 420' dues = 43,3 %. Le programme Qualiopi déclarera 70 % (RATIO_PRATIQUE_PCT en dur) : 26,7 points d'écart.

  → *Il faut 252 min (60 % de 420) : +70 min de pratique. Les 65 min non programmées suffisent presque à combler l'écart si elles vont intégralement en atelier.*

**MAJEUR** — Le livrable n'est pas distinct des autres fiches du lot. 'Mon espace de travail IA' est aussi le livrable de ia-pour-les-equipes ('L'espace de travail IA de l'équipe'), de ia-pour-l-automatisation ('un espace de travail persistant contenant l'automatisation') et une composante du livrable du séminaire ('un espace de travail persistant monté en direct'). La révision reproche à la bibliothèque de prompts d'être 'le livrable de quinze fiches' et la remplace par un artefact désormais commun à 4 des 5 fiches contrôlées.

  → *Différencier par ce que l'espace CONTIENT et par qui le tient : ici un espace individuel portant les documents de référence du poste et la dictée ; ailleurs un espace de service avec un responsable nommé. Sinon le nom du livrable doit changer sur au moins trois fiches.*

**MINEUR** — Le module 4 n'a pas de bloc synthèse : il se clôt sur 'Feuille de route' (10'), pas sur 2-3 acquis formulés en actions. Les M1, M2 et M3 ont bien leur 'Vos acquis'. 5e bloc manquant sur 1 module sur 4. La démonstration du M4 (12', espace de travail persistant) n'est pas non plus une démonstration avant/après avec prompt affiché.

  → *Ajouter 3' de 'Vos acquis' au M4 et reformuler sa démo en avant/après (une relance sans contexte vs la même dans l'espace qui porte les documents de référence).*

---

### ia-pour-les-equipes — **a_corriger**

- Pratique : **56 %** · programmé **343 min** sur **420 min** dus

**MAJEUR** — 77 minutes non programmées, l'écart le plus large du lot. Somme réelle : M1 = 75', M2 = 78', M3 = 80', M4 = 80' = 313' de séquences, + 2 pauses de 15' = 343' pour 420' dues. Horloge à 9h00 : fin à 15h43. Plus d'1h15 de vide sur une journée vendue 1 900 €.

  → *Programmer les 77 minutes. Le M1 est le plus serré : 17' pour les trois régimes d'usage + la liste 'ce qui ne sort jamais' + la ré-identification + la mention au destinataire, soit quatre sujets en 17 minutes — c'est le premier endroit à réalimenter.*

**MAJEUR** — Ratio de pratique sous le plancher, et fragile. Pratique 20+35+35+30 = 120 min, vérification 15+12+12+15 = 54 min, total 174 min = 55,6 % des 313' de séquences, 41,4 % des 420' dues. Surtout : les 20' de pratique du M1 sont 'réaliser une tâche comme d'habitude en se chronométrant', c'est-à-dire SANS IA. Hors ce temps, la pratique outil tombe à 154 min = 49,2 %. Le programme Qualiopi déclarera 70 %.

  → *Il faut 252 min (60 % de 420) : +78 min, soit très exactement les 77 min non programmées. Réaffecter en totalité au M3 (série + tableur) et à l'alimentation de l'espace commun.*

**MAJEUR** — Livrable non distinct : 'L'espace de travail IA de l'équipe' est le même artefact que celui de ia-pour-bien-commencer-journee, de ia-pour-l-automatisation et du séminaire. Voir le détail sur la fiche journée.

  → *Ce qui est réellement propre à cette fiche, c'est le relevé des temps mesurés et la liste 'ce qui ne sort jamais' validée collectivement. Faire porter le nom du livrable par ces deux éléments, l'espace n'étant que leur contenant.*

**MINEUR** — Le relevé des temps mesurés est remis au client et devient de fait une promesse chiffrée. Le M1 chronomètre une tâche, le M2 la refait avec AXION et 'compare', et le livrable contient 'le relevé des temps mesurés en séance, tâche par tâche'. Une mesure unique, sur une tâche choisie par le participant, en présence du formateur, sera lue par le dirigeant comme un taux de gain. Le standard interdit la promesse chiffrée non étayée ; ici le chiffre est produit mais non étayable (n = 1, pas de contre-mesure).

  → *Faire porter au livrable une mention explicite : mesure ponctuelle, non extrapolable, destinée au participant pour choisir ses chantiers — pas un taux de gain d'équipe. Et prévoir la consigne d'animation pour le cas où l'écart mesuré est nul ou négatif, qui se produira dans la salle.*

**MINEUR** — Animabilité du module 3 : 'produire quinze documents homogènes à partir d'un tableau' (35') et 'le tableur assisté : faire écrire une formule, faire expliquer un tableau croisé' (10') exigent du formateur une aisance tableur et une maîtrise du traitement en série. Ce n'est pas de l'expertise métier — la contrainte 'aucune expertise métier requise' est respectée — mais c'est une compétence outil que tous les formateurs IA n'ont pas, et l'atelier tombe si elle manque.

  → *Fournir dans le guide d'animation le tableau d'exemple, la demande AXION de série pré-écrite et les trois formules de secours, pour que la séquence ne dépende pas du niveau tableur du formateur.*

**MINEUR** — Le module 4 n'a pas de bloc synthèse ('Vos acquis' présent en M1, M2, M3, absent en M4 qui se clôt sur un bilan des temps). Sa démonstration (12') n'est pas un avant/après avec prompt affiché.

  → *Ajouter 3' de 'Vos acquis' et reformuler la démo en avant/après.*

---

### ia-pour-l-automatisation — **a_corriger**

- Pratique : **59 %** · programmé **840 min** sur **840 min** dus

**MAJEUR** — Le ratio annoncé est faux et le ratio réel est sous le plancher. Le changement affirme 'Ratio de pratique porté de ~20 % à 60 % : 500 minutes de pratique et de vérification sur 840'. 500/840 = 59,5 %, pas 60 % — et ce compte de 500 n'est atteint qu'en comptant les 40' de 'Feuille de route' comme de la pratique. Les séquences réellement étiquetées Pratique ou Vérification totalisent 105+125+125+105 = 460 min, soit 54,8 % des 840 min et 59,0 % des 780 min de contenu hors pauses. Aucune lecture n'atteint 60 %, et le programme Qualiopi déclarera 70 %.

  → *Il faut 504 min (60 % de 840), soit +44 min à convertir depuis du descendant — le minutage étant déjà plein à 840, rien ne peut être ajouté. Candidats : les 25' 'Avec quoi on va construire' (AM J1) et les 25' 'Avant la mise en service' (AM J2), à basculer en atelier. Et corriger l'affirmation du changement, qui sera lue comme une conformité acquise.*

**MAJEUR** — La promesse 'une démonstration avant/après ajoutée dans chaque demi-journée, prompt affiché en entier' n'est tenue que sur 2 demi-journées sur 4. Matin J1 (20') et Matin J2 (25') en portent une. Après-midi J1 n'a que 'La grille de tri appliquée en direct à deux cas' (20'), qui n'est ni un avant/après ni un prompt. Après-midi J2 n'a aucune démonstration : 10' objectif, 40' pratique, 25' descendant, 40' pratique, 25' évaluation, 40' feuille de route, 15' synthèse. Le bloc démonstration du standard manque donc sur la moitié du programme.

  → *Insérer un avant/après en AM J1 (une fiche de cadrage bâclée vs cadrée, prompt affiché) et en AM J2 (la même automatisation sans point de relecture puis avec), en prenant sur le descendant plutôt qu'en allongeant.*

**MAJEUR** — Deux séquences exigent une expertise que le formateur non spécialiste n'aura pas. (1) 'Pratique : construction guidée, pas à pas, du prototype de chacun' (55', Matin J2) : chaque participant a un cas différent cadré la veille, et la famille d'outils retenue peut être le 'chaînage entre applications' — c'est du dépannage individuel d'intégration en salle, la séquence la plus exposée des cinq fiches. (2) 'Vérification : chaque table classe six automatisations en feu vert / feu orange / feu rouge, correction en plénière' (35', Matin J1) : la correction oblige le formateur à trancher en direct des qualifications juridiques (art. 22 RGPD, consultation du CSE, annexe III de l'IA Act) devant la salle.

  → *Pour (1) : imposer un cas de repli commun et pré-monté, et borner les familles d'outils autorisées en atelier à l'assistant conversationnel + l'espace persistant, le chaînage restant démonstration. Pour (2) : fournir les six automatisations et leur corrigé écrit mot pour mot dans le guide d'animation — sinon le formateur improvise du conseil juridique au nom d'Axion-IA.*

**MINEUR** — Le fondement juridique vit dans les justifications, pas dans le programme. Les changements citent art. 22 RGPD, L.2312-8 II 4° du Code du travail, annexe III §4(b) et art. 50 de l'IA Act ; le programme révisé, lui, ne nomme aucun de ces textes ('ce que chaque réponse déclenche : information des salariés, consultation du CSE, analyse d'impact', 'l'information due'). Or c'est le programme qui alimente le site, le programme Qualiopi et les documents générés : la référence disparaît là où le formateur et l'auditeur la chercheraient.

  → *Nommer les textes dans le support et le guide d'animation (pas nécessairement dans l'intitulé public), au minimum sur la séquence de 45' du test de qualification et sur les 25' 'Avant la mise en service'.*

**MINEUR** — Le durcissement de prerequisFr et l'arbitrage du recouvrement avec les jours 2 de ia-pour-la-production, ia-pour-l-industrie et ia-pour-l-it sont renvoyés 'hors programme' et ne sont donc pas livrés. Une formation à 3 600 € sur 2 jours reste vendable à quelqu'un dont le seul prérequis est 'une pratique régulière des outils bureautiques', ce que la révision reconnaît elle-même insuffisant.

  → *Livrer le prerequisFr rédigé avec cette révision, pas après : c'est la condition pour que le 55' de construction guidée soit tenable.*

**MINEUR** — Le livrable ('espace de travail persistant contenant l'automatisation, sa fiche d'usage et ses documents de référence') partage son intitulé avec 3 autres fiches du lot. Il reste ici le plus distinct des quatre, parce que la fiche d'usage et la fiche feu vert / feu orange / feu rouge sont propres à la fiche.

  → *Nommer le livrable par la fiche d'usage et le feu tricolore, l'espace n'étant que le contenant.*

**MINEUR** — Point positif à conserver : le minutage est le seul juste du lot avec le séminaire — 4 demi-journées de 210 min pauses comprises, total 840 min exactement égal aux 14 h dues. Et les garde-fous sont exemplaires : les trois régimes d'usage (20'), la ré-identification (20') et le test de qualification en 4 questions (45') sont tous en Matin J1, avant la première cartographie et avant toute conception, ce qui règle le risque du client qui n'achète que le jour 1. C'est la seule fiche du lot qui rende son jour 1 exploitable seul.

  → *Aucune. Cette convention de minutage et cet ordonnancement sont ce qu'il faut répliquer sur les trois autres fiches du lot, pas le séminaire.*

---

### seminaire-ia-toute-l-entreprise-1j — **a_corriger**

- Pratique : **49 %** · programmé **420 min** sur **420 min** dus

**BLOQUANT** — C'est la fiche du lot la plus éloignée du plancher de pratique, et elle est présentée comme 'le modèle à répliquer sur les 21 autres'. En comptant très généreusement TOUT travail de table et tout QCM (15 + 65 + 50 + 30 + 30), on obtient 190 min sur 390 min de contenu = 48,7 %, et 45,2 % des 420 min dues. En ne comptant que la pratique sur l'outil et la vérification, on tombe à 132 min = 33,8 %. La séquence 4 (55 min, concours d'astuces) et la séquence 5 (50 min, règles et engagements) ne contiennent aucune manipulation d'outil : 105 min, soit 27 % de la journée, sont de la plénière. Le programme Qualiopi officiel déclarera 70 % (RATIO_PRATIQUE_PCT = 70 en dur, catalog-import.ts:67) : plus de 20 points d'écart, sur la fiche qui sert de gabarit au reste du catalogue.

  → *Il faut 234 min (60 % de 390) : +44 min à convertir, sans marge de minutage puisque la journée est déjà pleine à 420. Candidats : les 20' 'Le formateur reprend chaque proposition' (S4) à transformer en réécriture par les tables, les 15' 'Ce que la direction découvre presque toujours' (S2) et les 20' 'Le cadre en clair' (S1) à transformer en tri par table. Et surtout : retirer du verdict la phrase 'c'est le modèle à répliquer sur les 21 autres' tant que le ratio n'est pas atteint — sinon le défaut se propage à 21 fiches.*

**MAJEUR** — 3 séquences sur 5 ne se déclinent pas en 5 blocs. Séquence 2 : aucun objectif observable, aucune démonstration (10' protection du sondage, 15' sondage, 15' lecture, 30' table, 20' restitution, 15' QCM). Séquence 4 : aucun objectif, aucune démonstration avant/après, aucune vérification — 55 min de présentations et de sélection. Séquence 5 : aucun objectif, aucune démonstration, aucune pratique outil — 50 min de plénière plus un QCM de 7'. Seules les séquences 1 et 3 portent objectif implicite, démo avant/après, pratique, vérification et synthèse.

  → *Typer les séquences 2, 4 et 5 : ouvrir chacune par un objectif observable rattaché à un objectif global, doter la 4 d'une vérification (chaque table rejoue l'astuce d'une autre table) et la 5 d'une démonstration avant/après sur un cas mis de côté pour cause de haut risque.*

**MAJEUR** — Deux séquences supposent une expertise que le formateur n'aura pas. (1) S4, 20' : 'le formateur reprend chaque proposition, l'améliore, la généralise aux autres services' — improviser devant 50 personnes la transposition d'une astuce comptable vers la production et les RH suppose une connaissance transverse de l'entreprise cliente ; et dans la même séquence il doit 'écarter devant tout le monde celles qui exposent une donnée ou qui touchent une décision sur une personne', c'est-à-dire arbitrer en direct une qualification RGPD / IA Act. (2) S5, 8' : 'consultation du CSE, dépôt et transmission à l'inspection du travail, information des salariés' — c'est du droit du travail (L.1321-1 s.) exposé en 8 minutes par un organisme de formation IA, avec le risque que le client le reçoive comme un conseil juridique.

  → *Fournir une grille écrite de généralisation (les 6 familles de tâches transverses) et une liste écrite des astuces à écarter, pour que le formateur applique au lieu d'arbitrer. Sur S5, faire porter la séquence par la direction cliente ou par un renvoi écrit à son conseil, et l'inscrire noir sur blanc dans le guide d'animation.*

**MAJEUR** — La timeline publique restera fausse et la révision le sait. Les changements signalent que deriveProgrammeSchedule remet l'horloge au début de chaque section et ne bascule à 14 h que sur le préfixe 'Après-midi'. Or les séquences 3, 4 ET 5 commencent toutes par 'Après-midi —' : elles s'afficheront toutes trois à 14 h 00. Poser un minutage juste (420 min exactes) tout en produisant une timeline qui montre trois séquences simultanées est pire que la timeline vide actuelle — c'est l'argument que la révision emploie elle-même sur ia-pour-bien-commencer, sans en tirer la conséquence ici.

  → *Le correctif de deriveProgrammeSchedule (champ de début explicite, ou cumul de l'horloge entre sections d'une même demi-journée) est un prérequis de mise en ligne, pas un 'point technique à traiter en même temps'. Sans lui, ne pas publier le minutage.*

**MINEUR** — L'engagement de non-usage disciplinaire n'est pas écrit dans le livrable. Le changement dit que 'l'engagement écrit de non-usage disciplinaire est annoncé par la direction en toute première séquence' et le programme le reprend (S1, 10'), mais il est annoncé oralement et ne figure dans aucun des cinq livrables. Un engagement oral ne protège ni les salariés qui déclarent en S2 des 'usages que personne n'a validés', ni Axion-IA qui organise cette remontée.

  → *Faire figurer l'engagement, signé par la direction, dans le livrable de la séquence 1 aux côtés du guide des bonnes pratiques, et conditionner la tenue du sondage à sa signature.*

**MINEUR** — La mise à l'écart des usages haut risque (recrutement, évaluation, décision sur une personne) arrive en séquence 5, à 8', après que la séquence 2 a fait remonter les usages déjà en place service par service et que la séquence 4 a diffusé les astuces à toute l'entreprise. Le filtre de la S4 rattrape partiellement, mais rien entre 9 h et l'après-midi ne dit à la salle qu'un CV ou un entretien annuel ne se soumet pas.

  → *Adosser la mention aux 15' de tri par table de la séquence 1 ('ça peut sortir / ça ne sort jamais'), où elle coûte zéro minute, et la rappeler en S5 au moment de la hiérarchisation comme prévu.*

**MINEUR** — Point positif à conserver : le minutage est exact (S1 90' + S2 105' + S3 90' + S4 55' + S5 50' = 390', plus 2 pauses de 15' = 420' pour 7 h dues), le retrait de la 'bibliothèque de plus de 500 prompts' supprime la seule promesse chiffrée du catalogue, et la démonstration de biais en S1 ('un biais qui apparaît quand on change un seul mot du prompt') est le seul endroit des cinq fiches contrôlées où le défaut établi 'biais n'apparaît qu'une fois dans tout le catalogue' est réellement corrigé.

  → *Aucune. Reprendre la démonstration de biais telle quelle dans ia-pour-bien-commencer, qui est la porte d'entrée du catalogue.*

---

### ia-pour-les-rh — **a_corriger**

- Pratique : **56 %** · programmé **385 min** sur **420 min** dus

**MAJEUR** — Ratio de pratique réel sous le seuil, et l'auto-déclaration est fausse. Décompte strict des séquences de pratique et de vérification : M1 30' + M2 55' (40+15) + M3 70' (30+25+15) + M4 60' (25+20+15) = 215 min sur 385 = 55,8 %. Décompte le plus favorable (en comptant les 10' « construire sa grille » et les 10' « gestes qui débloquent ») : 235/385 = 61,0 %. La fiche annonce « 240 min sur 390, soit 61,5 % » : ni le 240 ni le 390 ne sont reconstituables à partir des séquences écrites. Surtout, src/server/qualiopi/formations/catalog-import.ts:67 écrit RATIO_PRATIQUE_PCT = 70 en dur et le pousse dans le programme Qualiopi officiel (ligne 193) : la révision laisse un écart de 14 points entre ce qui est déclaré et ce qui est programmé.

  → *Convertir ~55 min de descendant en pratique (le 20' « cadre du recrutement » de M1 devient un tri de cas ; le 10' « règle qui en découle » de M4 devient une reformulation en binôme), puis remplacer le chiffre annoncé par le décompte réel et faire dériver ratioPratiquePct des durées au lieu de la constante 70.*

**MAJEUR** — Minutage : 385 min programmées pour 420 dues (1 j). Trois interruptions sont déclarées sans durée (« Pause — Pause », « Déjeuner — Déjeuner ») : même en leur imputant 15+15 min, on est à 415, et le déjeuner n'est pas chiffré. La fiche affirme elle-même 390 min de face-à-face : son propre total est faux de 5 min. Il reste donc au minimum 35 min de journée non programmées, sur un programme public.

  → *Chiffrer les interruptions comme le fait la fiche santé (« Pause — 15 minutes », « Déjeuner — 1 heure ») et ajouter les 35 min manquantes dans les modules 2 et 4, qui sont les plus courts (95 et 85 min).*

**MAJEUR** — La qualification « haut risque » est promise dans la justification mais absente du programme livré. Le bullet des changements annonce un Module 1 contenant « qualification haut risque » ; aucune des six séquences du Module 1 ne la mentionne. Le mot n'apparaît que dans le verdict et les justifications, jamais dans une séquence animable. Le formateur ouvre la fiche et n'a rien à dire sur le règlement européen, sur une fiche dont le verdict fonde tout son raisonnement sur l'annexe III §4a applicable depuis le 2 août 2026.

  → *Écrire la qualification dans la séquence de 20' du Module 1 : « le tri et l'évaluation de candidatures sont classés à haut risque (annexe III §4a), applicable depuis le 2 août 2026 — pourquoi la présynthèse sous grille imposée reste en dehors ».*

**MAJEUR** — Référence légale fausse, répétée deux fois : « information du CSE (L.1221-9) ». L'article L.1221-9 du Code du travail vise le candidat (aucune information ne peut être collectée par un dispositif non porté à sa connaissance), pas le CSE. L'information du CSE sur les méthodes d'aide au recrutement relève de L.2312-38 — que le même document cite correctement dans la fiche ia-pour-la-production (ligne 727). Cette référence part dans les objectifs pédagogiques, dans le programme Qualiopi officiel et en en-tête d'un livrable destiné à être remis à un CSE.

  → *Remplacer L.1221-9 par L.2312-38 aux deux occurrences (bullets « Le cadre devient le Module 1 » et « Nouveau bloc pratique ») et vérifier le libellé retenu pour le livrable.*

**MAJEUR** — Animabilité : le bloc de 25' « rédiger la mention d'information des candidats et la note d'information au CSE » fait produire deux documents à portée juridique sous la supervision d'un formateur IA non-juriste. Il devra arbitrer en séance des questions qu'il ne peut pas trancher (le CSE doit-il être consulté ou seulement informé ? la mention doit-elle figurer sur l'annonce ou dans l'accusé de réception ?). Le décompte « 25 critères de discrimination » du Module 1 pose le même problème : le formateur sera interrogé sur la liste exacte.

  → *Fournir des trames pré-rédigées et datées où le participant ne remplit que des champs variables, imposer la mention « projet à faire valider par votre conseil » en en-tête, et joindre au kit formateur une liste des critères sourcée et datée plus la formule de refus déjà retenue dans la fiche banque-assurance (« je ne me prononce pas »).*

**MAJEUR** — Timeline publique inexploitable : les quatre sections s'appellent « Module 1 » à « Module 4 ». deriveProgrammeSchedule (src/content/formations/catalog-v2-schedule.ts:50-55) redémarre l'horloge à 9 h 00 pour toute section dont le libellé ne commence pas par « après-midi ». Les quatre modules s'afficheront donc tous à 9 h 00 sur la fiche publique, et « Déjeuner » (non numérique et différent de la chaîne « Pause ») ne fait pas avancer l'horloge : il sera imprimé tel quel dans la colonne des heures. Seule la fiche santé du même lot préfixe ses modules « Matin · » / « Après-midi · ».

  → *Préfixer les modules « Matin · » / « Après-midi · » comme la fiche santé, et rendre l'horloge cumulative à l'intérieur d'une demi-journée dans catalog-v2-schedule.ts (le défaut est signalé par les concepteurs dans la seule fiche santé, jamais corrigé côté code).*

**MINEUR** — Module 4 non déclinable en 5 blocs : il a un objectif (5'), une pratique (25' + 20') et une vérification (15'), mais aucune démonstration avant/après avec prompt affiché, et sa clôture est une feuille de route de 10' — pas une synthèse en 2-3 acquis formulés comme des actions, contrairement aux modules 1, 2 et 3 qui en portent une.

  → *Ajouter 5' d'acquis-actions en fin de Module 4 et déplacer 10' pour y loger une démonstration avant/après sur la vérification d'une affirmation de droit social.*

**MINEUR** — Contrainte « UN SEUL outil » respectée dans une seule démonstration sur trois : seule celle du Module 2 précise « avec un seul outil ». Les démonstrations de M1 (biais) et M3 (présynthèse) affichent bien les prompts en entier mais ne bornent pas l'outil.

  → *Ajouter « un seul outil » aux deux démonstrations concernées.*

---

### ia-pour-la-sante — **a_corriger**

- Pratique : **49 %** · programmé **390 min** sur **420 min** dus

**BLOQUANT** — Le garde-fou arrive après le geste qu'il encadre, sur une fiche à usage haut risque — exactement le défaut que la révision reproche au squelette d'origine. La deuxième séquence de la journée (min 5 à 20) est une démonstration où « le même courrier de sortie » est repris avec l'IA, prompt affiché en entier. Un courrier de sortie est une donnée de santé par son contenu clinique. Cette démonstration précède les trois régimes d'usage (min 20), la définition de la donnée de santé (min 35), la borne du métier (min 45) et la séquence « pseudonymiser n'est pas anonymiser » (Module 2, ~min 110). La salle voit donc le geste modélisé avant d'avoir la moindre condition de licéité, et le programme ne dit nulle part que le courrier est fictif ou déjà neutralisé.

  → *Déplacer la démonstration après la borne du métier (soit après la séquence de 5' « ni diagnostic, ni orientation »), et écrire dans l'intitulé de la séquence « sur un courrier fictif fourni, déjà neutralisé » — ce qui coûte zéro minute et lève le défaut.*

**MAJEUR** — Ratio de pratique le plus bas des trois fiches structurellement saines. Décompte strict des séquences étiquetées Pratique / Atelier / Vérification / Validation : M1 35' (15+20) + M2 55' (40+15) + M3 55' (40+15) + M4 45' (25+20) = 190 min sur 390 = 48,7 %. En comptant aussi les deux « prise en main » (10' et 15'), le « retour sur la journée » (10') et la feuille de route (15') comme du travail participant : 240/390 = 61,5 %. La fiche n'annonce aucun ratio, elle ne démontre donc jamais son propre plancher, alors que catalog-import.ts:67 déclarera 70 % en base : 21 points d'écart au mieux, 21 points au pire selon le décompte retenu.

  → *Requalifier explicitement les quatre séquences ambiguës en « Pratique » avec consigne chronométrée et production attendue (elles le sont déjà de fait), ce qui porte le ratio écrit à 61,5 %, puis dériver ratioPratiquePct des durées.*

**MINEUR** — Minutage juste mais horloge cassée pour la deuxième moitié de chaque demi-journée. 390 min de face-à-face + 2 pauses de 15' = 420 min exactement : c'est la seule fiche du lot dont les interruptions sont chiffrées et dont le total tombe juste. En revanche, avec les libellés « Matin · Module 2 » et « Après-midi · Module 4 », deriveProgrammeSchedule redémarre l'horloge à 9 h 00 et à 14 h 00 : le Module 2 s'affichera à 9 h 00 au lieu de ~10 h 45, le Module 4 à 14 h 00 au lieu de ~15 h 55. Les concepteurs signalent le défaut dans leur note technique mais ne le corrigent pas.

  → *Rendre l'horloge cumulative à l'intérieur d'une demi-journée dans src/content/formations/catalog-v2-schedule.ts (sectionStartMin ne doit réinitialiser qu'au passage matin→après-midi), sinon la timeline publique de la fiche reste fausse malgré un minutage correct.*

**MINEUR** — Animabilité : la séquence de 10' « ce qu'engage le secret professionnel, qui est un délit » fait énoncer une qualification pénale par un formateur non-soignant et non-juriste, qui recevra ensuite les questions de salle sur le secret partagé — le pire scénario identifié par les concepteurs eux-mêmes dans leurs justifications, sans qu'aucun support ne soit prévu dans le programme livré.

  → *Joindre au kit une position écrite datée et la formule de refus (« je ne me prononce pas, votre référent protection des données tranche »), et l'inscrire dans l'intitulé de la séquence de 15' du Module 4 qui renvoie déjà au délégué à la protection des données.*

**MINEUR** — Une seule des quatre démonstrations respecte intégralement le standard. M1 précise « prompt affiché en entier, un seul outil » ; M3 précise le prompt mais pas l'outil ; M2 (ré-identification) et M4 (espace de travail créé en direct) ne mentionnent ni prompt affiché ni outil unique.

  → *Ajouter « prompt affiché en entier, un seul outil » aux trois démonstrations qui ne le portent pas.*

---

### ia-pour-le-juridique — **a_corriger**

- Pratique : **55 %** · programmé **390 min** sur **420 min** dus

**MAJEUR** — Ratio annoncé non reconstituable et sous le seuil au décompte strict. Séquences explicitement de pratique ou de contrôle croisé : M1 35' (25+10) + M2 50' (35+15) + M3 65' (25+30+10) + M4 65' (30+20+15) = 215 min sur 390 = 55,1 %. En comptant en plus les 15' « construire sa grille » et la moitié des 20' de veille : 240/390 = 61,5 %. La fiche annonce « 245 min sur 390, soit 63 % » : le total de 390 est juste, celui de 245 ne l'est pas. Et catalog-import.ts:67 déclarera 70 % en base dans le programme Qualiopi officiel.

  → *Convertir en pratique les 15' « ce que la direction va vous demander » du Module 3 (purement descendant) et les 10' « la règle qui en découle » du Module 4, puis republier le décompte réel.*

**MAJEUR** — Animabilité : le Module 3 fait rédiger « les trois articles clés d'une charte d'usage interne » (30') puis lister « ce qu'il reste à faire pour la rendre opposable — consultation, dépôt, information des salariés » — c'est le régime du règlement intérieur (L.1321-4), et la séquence de 15' qui précède couvre la clause IA dans les contrats clients et fournisseurs et la propriété des productions. Un formateur IA non-juriste ne peut ni animer ni arbitrer ces 45 minutes devant une salle de juristes, qui sont précisément le public le plus à même de contester. La parade retenue ailleurs dans le lot (grille apportée par le participant, formule de refus assumée) n'est pas installée sur ces deux séquences.

  → *Fournir des articles types pré-rédigés que la salle adapte, écrire dans l'intitulé « le formateur n'arbitre pas : la salle qualifie, le service juridique tranche », et reprendre la formule de refus assumée de la fiche banque-assurance.*

**MAJEUR** — La fiche vend « qu'a-t-on le droit de faire avec l'IA ? » comme le vrai motif de venue du juriste en 2026 et ne nomme jamais le règlement européen. Le Module 3 parle d'« obligation de former les équipes à l'usage de l'IA » (c'est l'article 4 du règlement, applicable depuis février 2025) et de « clause IA » sans citer aucun fondement. Un juriste demandera la source dans les deux minutes ; le formateur n'aura rien.

  → *Nommer explicitement le règlement européen dans la séquence de 15' du Module 3 : obligation de littératie IA (art. 4), obligations de transparence sur les contenus générés (art. 50), et la raison pour laquelle un service juridique d'entreprise n'entre pas dans l'annexe III §8 réservée aux autorités judiciaires.*

**MAJEUR** — Timeline publique : quatre sections nommées « Module 1 » à « Module 4 », aucune ne commençant par « Après-midi ». deriveProgrammeSchedule les fera toutes démarrer à 9 h 00 sur la fiche publique, et « Déjeuner » ne fait pas avancer l'horloge. Le minutage interne est pourtant juste — le défaut est purement dans le libellé des sections.

  → *Préfixer « Matin · » / « Après-midi · » comme la fiche santé, et chiffrer les interruptions (« Pause — 15 minutes », « Déjeuner — 1 heure ») : 390 + 30 = 420, la journée tombe alors juste.*

**MINEUR** — Deux modules sur quatre ne se déclinent pas en 5 blocs. Le Module 2 n'a aucune synthèse : il s'arrête sur le contrôle croisé de 15' et enchaîne sur le déjeuner. Le Module 4 n'a ni démonstration ni synthèse (sa clôture de 10' est une feuille de route). Par ailleurs, au Module 3, la démonstration (la « démonstration de l'écart » incluse dans les 20' de veille) arrive après les deux ateliers du module au lieu de les précéder.

  → *Ajouter 5' d'acquis-actions en fin de M2 et de M4, remonter la séquence de veille avant l'atelier de charte.*

**MINEUR** — Aucune des deux démonstrations ne borne l'outil. M1 (20') et M2 (15') précisent bien « prompt affiché en entier » mais pas « un seul outil ».

  → *Ajouter « un seul outil » aux deux intitulés.*

---

### ia-pour-la-banque-assurance — **a_refaire**

- Pratique : **41 %** · programmé **390 min** sur **420 min** dus

**BLOQUANT** — C'est la seule fiche du lot qui ne peut atteindre 60 % de pratique sous aucune lecture. Séquences de pratique et de vérification : M1 15' (la seule vérification) + M2 35' + M3 65' (45+20) + M4 45' (30+15) = 160 min sur 390 = 41,0 %. En comptant en plus les 25' de liste rouge co-construite et les 20' de feuille de route : 205/390 = 52,6 % — plafond absolu. Le reste est descendant : 20' de régimes, 20' de frontière haut risque, 20' de règle de traçabilité, plus trois démonstrations de 25', 20' et 15'. Le Module 1 ne contient aucun atelier chronométré. Le programme Qualiopi officiel déclarera pourtant 70 % (catalog-import.ts:67 et 193) : 29 points d'écart avec ce qui est programmé.

  → *Reconstruire le déroulé : convertir au moins 75 min de descendant en pratique chronométrée (les 20' de régimes deviennent un tri de pièces, les 20' de frontière un test de qualification en 4 questions sur les propres dossiers, les 20' de traçabilité la rédaction de la trace elle-même). Les contenus sont bons, c'est leur mode de délivrance qui ne tient pas.*

**BLOQUANT** — Aucun déjeuner n'est déclaré sur une journée de 7 h. Le déroulé enchaîne M1 → Pause (15') → M2 → M3 → Pause (15') → M4, soit 390 min de face-à-face et 30 min d'interruption seulement. Les trois autres fiches du lot déclarent toutes un déjeuner. En l'état la journée est matériellement inanimable et le programme est publiable tel quel sur le site.

  → *Insérer le déjeuner entre M2 et M3 et rééquilibrer : la journée doit se lire 9 h 00 → 12 h 30 / 13 h 30 → 17 h 00.*

**MAJEUR** — Aucune des trois démonstrations n'affiche le prompt, alors que le standard l'impose sans exception. M1 (25', ré-identification), M2 (20', biais) et M3 (15', conditions générales interrogées) décrivent toutes un résultat à l'écran sans jamais mentionner le prompt affiché en entier ni l'outil unique. C'est particulièrement grave sur la démonstration de biais, dont tout le propos est la comparaison de deux prompts ne différant que d'une variable : sans les deux prompts à l'écran, la démonstration ne prouve rien et se réduit à une affirmation du formateur. La fiche RH du même lot écrit correctement « prompts affichés en entier » sur la démonstration équivalente.

  → *Reprendre les trois intitulés sur le modèle RH : « les deux prompts affichés en entier, un seul outil, la variable ajoutée surlignée ».*

**MAJEUR** — Trois modules sur quatre échouent aux 5 blocs. M1 : pas de synthèse (il enchaîne sur la pause) et pas de pratique individuelle chronométrée. M2 : pas de séquence de vérification. M4 : pas de démonstration, et sa clôture de 20' est une feuille de route, pas une synthèse en 2-3 acquis-actions. Seul le Module 3 porte les cinq blocs complets.

  → *Ajouter une synthèse de 5' à M1 et M4, une vérification à M2, et une démonstration courte à M4 — à financer sur les minutes reconverties du descendant.*

**MAJEUR** — Timeline publique : quatre sections « Module 1 » à « Module 4 », aucune préfixée « Après-midi » — les quatre s'afficheront à 9 h 00. De plus, les pauses sont notées « Pause (15') », qui ne correspond ni au format numérique attendu par parseDurationMin (regex ^(\d+)\s*'?$) ni à la chaîne exacte « Pause » testée ensuite : la pause tombera dans la branche verbatim, l'horloge n'avancera pas du tout et « Pause (15') » sera imprimé dans la colonne des heures. Les fiches santé (« Pause — 15 minutes ») et RH (« Pause — Pause ») utilisent au moins une notation que le parseur reconnaît.

  → *Écrire « Pause — 15 minutes » et préfixer les sections « Matin · » / « Après-midi · ». Voir src/content/formations/catalog-v2-schedule.ts:42-55.*

**MINEUR** — Animabilité : la séquence de 25' « la liste rouge du métier, écrite par la salle » fait produire la liste des interdits par les participants, sans liste de référence fournie. Si la salle omet un item (les éléments de sinistre corporel, par exemple, ou un encours), le silence du formateur non spécialiste vaudra validation. Le programme prévoit par ailleurs la bonne parade sur le reste de la fiche (formule de refus assumée, renvoi à la conformité) : elle manque seulement ici.

  → *Fournir une liste rouge de référence que la salle complète et discute, plutôt qu'une liste construite ex nihilo qu'un formateur non spécialiste devrait valider.*

**MINEUR** — Contradiction d'intitulé entre M1 et M3 : le Module 1 enseigne trois régimes d'usage dont l'un (environnement validé par la conformité) autorise le traitement de données réelles, alors que l'objectif du Module 3 affirme « sans qu'aucune donnée nominative ait quitté l'établissement ». La formulation est réconciliable (« quitté l'établissement » ≠ « traitée »), mais elle rejoue en une ligne le slogan absolu que la révision est justement venue supprimer.

  → *Reformuler l'objectif de M3 : « dans le régime d'usage que vous avez identifié au module 1 ».*

---

### ia-pour-le-marketing — **a_corriger**

- Pratique : **56 %** · programmé **420 min** sur **420 min** dus

**MAJEUR** — Ratio de pratique réel 220 min / 390 min de face-à-face pédagogique = 56,4 %, contre 61,5 % annoncés dans la ligne de changements. Détail par module : M1 40' (atelier 30 + contrôle croisé 10), M2 55' (40+15), M3 65' (35+20+10), M4 60' (chasse 25 + montage espace 20 + évaluation 15). Les 240 min revendiquées ne sont atteintes qu'en comptant comme pratique deux blocs de synthèse pure : « Acquis du module et versement au livrable » (10', M2) et « Feuille de route contenu » (10', M4). Même en les comptant, on plafonne à 230' = 59,0 %, donc sous le plancher maison de 60 % dans les deux conventions de calcul. Et catalog-import.ts:67 écrit RATIO_PRATIQUE_PCT = 70 en dur : le programme Qualiopi officiel déclarera 70 % pour une journée qui en produit 56 %.

  → *Convertir en séquences appliquées les 15' « Résultats de campagne : l'IA commente, elle ne calcule pas » (M3) et les 15' « Droits et mentions » (M4), aujourd'hui descendantes : +30' → 250/390 = 64,1 %. Et cesser de recopier la ligne « 240 min sur 390 » d'une fiche à l'autre : elle est identique mot pour mot dans marketing, commerciaux et finance, dont les programmes n'ont pas la même structure.*

**MAJEUR** — Les quatre sections sont intitulées « Module 1 — … » à « Module 4 — … ». sectionStartMin() (src/content/formations/catalog-v2-schedule.ts:50) ne bascule à 14 h que si l'intitulé commence par « Après-midi », et deriveProgrammeSchedule() réinitialise l'horloge à chaque section : les quatre modules démarreront tous à 9 h 00 sur la fiche publique. Le Module 3 (105') s'affichera 9 h 00 → 10 h 45, le Module 4 (90') 9 h 00 → 10 h 30. Le marqueur « Déjeuner — Déjeuner » n'est ni numérique ni égal à « Pause » : parseDurationMin() le rend verbatim et l'horloge ne progresse pas. La révision a appliqué le renommage « Matin »/« Après-midi » sur achats, relation-client, production et IT, et l'a oublié ici.

  → *Regrouper en deux sections « Matin » (M1+M2) et « Après-midi » (M3+M4). Aucun test ne couvre le recouvrement horaire entre sections (catalog-v2-schedule.test.ts ne vérifie que le nombre d'items et l'absence de durée brute) : le défaut passera la CI en silence.*

**MAJEUR** — Module 3, séquence 20' « Visuels, démonstration avant/après » : elle exige un outil de génération d'images, alors que le standard impose UN SEUL outil par démonstration et que la révision constate elle-même qu'aucun outil d'image n'est nommé dans le catalogue. Le programme révisé n'en nomme toujours aucun. Par ailleurs l'objectif « visuels » reste adossé à 0 minute de pratique : les 35' et 20' d'atelier du M3 portent sur le commentaire de résultats et la visibilité de marque, pas sur les visuels.

  → *Soit nommer l'outil d'image dans materielFr et l'assumer comme second outil déclaré de la journée, soit supprimer la démonstration et la remplacer par une revue commentée de 4 visuels pré-produits fournis au kit (animable, sans compte à ouvrir), et retirer « visuels » de l'objectif pédagogique comme la révision le propose déjà hors programme.*

**MINEUR** — Module 4 ne porte aucune démonstration avant/après : les 5 blocs sont incomplets (objectif 5', pratique 25', vérification 15', synthèse 10', pas de démo). Module 1 n'a pas de séquence « objectif du module » explicite alors que M2, M3 et M4 en ont une — l'objectif observable rattaché à un objectif global n'y est pas formulé.

  → *Ajouter 5' d'objectif en tête de M1 (pris sur les 10' d'accueil) et adosser la chasse à l'erreur du M4 à une micro-démonstration avant/après de 5'.*

**MINEUR** — Le mot « biais » n'apparaît dans aucun des quatre modules, alors que la journée fait construire un brief de marque avec personas et cibles. « Pseudonymiser n'est pas anonymiser » est absent, alors que le M1 (15') cite explicitement « un fichier client » parmi les objets déposés — c'est la seule des 7 fiches du lot où ce contresens n'est pas corrigé.

  → *Ajouter la démonstration de ré-identification aux 15' « trois régimes d'usage » du M1, comme dans finance, achats, relation-client et production.*

---

### ia-pour-les-commerciaux — **a_corriger**

- Pratique : **55 %** · programmé **420 min** sur **420 min** dus

**MAJEUR** — Ratio réel 215 min / 390 min = 55,1 %, contre 61,5 % annoncés — écart de 25 minutes. Détail : M1 40' (30+10), M2 45' (30+15), M3 70' (30+30+10), M4 60' (25+20+15). C'est la plus faible des trois fiches d'une journée qui revendiquent toutes la même valeur « 240 min sur 390 » : la ligne est manifestement recopiée et non calculée.

  → *Le M2 est le module faible (45' sur 95'). Basculer les 15' descendantes « Qualifier sans profiler » en 8' d'exposé + 7' de tri appliqué, et les 10' « Dicter depuis son téléphone » en manipulation guidée : +17' → 232/390 = 59,5 %. Il faut aller chercher encore ~5' dans le M4 pour franchir le plancher.*

**MAJEUR** — Deux modules sur quatre ne se déclinent pas en 5 blocs. Le Module 2 (5' objectif, 10' geste, 15' démo, 30' atelier, 15' exposé, 15' atelier, 5' acquis) ne comporte AUCUNE séquence de vérification ni contrôle croisé — alors que la ligne de changements promet explicitement « mini-vérification par contrôle croisé dans chaque module ». Le Module 3 (5', 20', 30', 10', 30', 10' contrôle croisé) ne comporte AUCUNE synthèse ni acquis formulés en actions. La promesse écrite est démentie par le programme livré.

  → *M2 : découper les 15' « Qualifier sans profiler » en 10' d'exposé + 5' de contrôle croisé sur le tri de pipeline. M3 : prendre 5' sur les 10' « De vos notes à une proposition » pour poser les 2-3 acquis du module.*

**MAJEUR** — Même défaut de dérivation horaire que marketing : quatre sections « Module 1 — » à « Module 4 — », aucune ne commençant par « Après-midi ». Les quatre modules s'afficheront à partir de 9 h 00 sur la fiche publique, le Module 3 (105') en 9 h 00 → 10 h 45 alors qu'il suit le déjeuner. Le marqueur « Déjeuner » ne fait pas avancer l'horloge (parseDurationMin le rejette).

  → *Regrouper en « Matin » (M1+M2) / « Après-midi » (M3+M4).*

**MINEUR** — Le mot « biais » n'apparaît nulle part, alors que le Module 2 enseigne à bâtir des critères de tri d'affaires et que le Module 3 fait relire des propositions par l'IA — deux endroits où le biais de sélection et la complaisance du modèle se produisent. La révision nomme bien la complaisance en M3, jamais le biais.

  → *Une ligne dans les 15' « Qualifier sans profiler » : deux jeux de critères → deux classements de pipeline, comme la démonstration de biais déjà écrite dans ia-pour-les-achats.*

**MINEUR** — Les démonstrations du M1 et du M3 portent « prompts affichés en entier » mais pas la mention « un seul outil » exigée par le standard ; seul le M2 la porte.

  → *Aligner la formulation des trois démonstrations sur celle du M2.*

---

### ia-pour-la-finance — **a_corriger**

- Pratique : **58 %** · programmé **420 min** sur **420 min** dus

**MAJEUR** — Ratio réel 225 min / 390 min = 57,7 %, contre 61,5 % annoncés — écart de 15 minutes. Détail : M1 40' (30+10), M2 55' (40+15), M3 70' (35+25+10), M4 60' (25+20+15). C'est la meilleure des trois fiches d'une journée, mais elle reste sous le plancher de 60 % et à 12 points des 70 % que catalog-import.ts déclarera au programme Qualiopi.

  → *Basculer les 15' descendantes « Des trames de contrôle plutôt que des rapprochements » (M2) en exposé de 8' + application de 7' : 232/390 = 59,5 %. Ajouter 5' de contrôle croisé au M2 (cf. défaut suivant) : 237/390 = 60,8 %.*

**MAJEUR** — Module 2 (5', 15', 40', 15', 15', 5') : aucune séquence de vérification ni contrôle croisé. Module 3 (5', 15', 35', 15', 25', 10' contrôle croisé) : aucune synthèse ni acquis. Deux modules sur quatre ne tiennent pas les 5 blocs, alors que la ligne de changements annonce « mini-vérification par contrôle croisé dans chaque module ».

  → *M2 : transformer les 5' « Acquis du module et versement au livrable » en 5' de contrôle croisé sur la trame de contrôle produite, et ajouter les acquis dans la respiration du déjeuner. M3 : ajouter 5' d'acquis pris sur les 15' « Les écrits qui rapportent ».*

**MAJEUR** — Le garde-fou « un écart signalé ne désigne jamais une personne » est écrit à l'intérieur de l'énoncé de l'atelier (M2, 15' — « avec la borne écrite en tête de trame »), pas avant lui. La séquence descendante qui le précède (15' « Des trames de contrôle plutôt que des rapprochements ») ne la porte pas, et le Module 1 n'en dit rien. Appliqué à des notes de frais ou des remboursements rattachables à un salarié, c'est une suspicion algorithmique sur une personne : décision automatisée au sens de l'art. 22 RGPD, information préalable des salariés. La règle doit précéder le geste, pas l'accompagner.

  → *Remonter la borne dans les 15' qui précèdent l'atelier, et l'annoncer dès la liste rouge du Module 1. Ni « décision automatisée », ni « art. 22 », ni « information des représentants du personnel » n'apparaissent dans le programme livré — seule la justification les évoque.*

**MAJEUR** — Même défaut de dérivation horaire que marketing et commerciaux : quatre sections « Module 1 — » à « Module 4 — ». Les quatre modules démarreront à 9 h 00 sur la fiche publique.

  → *Regrouper en « Matin » (M1+M2) / « Après-midi » (M3+M4).*

**MINEUR** — Les 40' d'atelier tableur du M2 recoupent les 15' « Le tableur assisté » du M4 de ia-pour-les-achats : même geste (décrire la structure, ne jamais livrer les données, obtenir la formule ou le croisement), enseigné dans deux fiches vendues séparément.

  → *Arbitrer : soit retirer la séquence d'achats (elle y est de toute façon orpheline, cf. fiche achats), soit la borner explicitement au comparatif de devis.*

---

### ia-pour-la-production — **a_refaire**

- Pratique : **43 %** · programmé **745 min** sur **840 min** dus

**BLOQUANT** — Minutage insuffisant de 95 minutes. Somme des séquences : Matin J1 165', Après-midi J1 180', Matin J2 160', Après-midi J2 180' = 685'. Avec les 4 pauses valorisées à 15' (PAUSE_MIN dans catalog-v2-schedule.ts) : 745' pour 840' dus (2 jours × 7 h). Chaque demi-journée est courte : 180/210, 195/210, 175/210, 195/210. Le Matin J2 laisse 35 minutes vides, soit une demi-heure de plus que la pause déclarée.

  → *Reprogrammer 95 minutes réparties sur les quatre demi-journées, en priorité sur la pratique (cf. défaut suivant). Aucune séquence ne doit être allongée artificiellement : ce sont des ateliers qu'il faut ajouter.*

**BLOQUANT** — Ratio de pratique 295 min / 685 min = 43,1 %, soit 17 points sous le plancher maison et 27 points sous les 70 % que catalog-import.ts déclarera au programme Qualiopi officiel. Par demi-journée : Matin J1 45/165 = 27,3 %, Après-midi J1 90/180 = 50 %, Matin J2 90/160 = 56,3 %, Après-midi J2 70/180 = 38,9 %. Le Matin J1 aligne 95 minutes d'exposé consécutif (20+25+30+20) avant la première pratique. La révision ne déclare aucun chiffre de ratio sur cette fiche, contrairement aux fiches d'une journée.

  → *Atteindre 60 % sur une base de 780' (840 moins 60' de pauses) demande 468' de pratique : il faut ajouter 173 minutes. Les 95' manquantes affectées à de l'atelier n'en apportent que la moitié ; il faut convertir en plus ~80' de descendant — 30' « Formaliser ce qui se fait sans être écrit », 30' « Le commentaire autour du chiffre », 20' « Fiabiliser » — en séquences appliquées. C'est une reconstruction du planning, pas une retouche.*

**MAJEUR** — Animabilité : les 25' « Les documents obligatoires : document unique, causerie sécurité, plan de prévention, analyse d'aléa » sont une séquence descendante de contenu réglementaire HSE. Un formateur IA non-spécialiste ne peut ni exposer le régime du DUERP ni arbitrer en salle une question sur le plan de prévention. La règle « le responsable HSE valide avant affichage » protège le livrable du client, elle ne protège pas l'animation. C'est la séquence du lot qui s'écarte le plus de la contrainte « n'importe quel formateur IA doit pouvoir assurer n'importe quelle formation ».

  → *Ramener à 10' de cadrage strictement procédural (« ce que l'IA prépare / ce que le HSE valide / ce qui ne s'affiche jamais sans visa »), fournir les trames pré-rédigées au kit, et basculer les 15' récupérées sur la pratique de 45'.*

**MAJEUR** — La qualification juridique du suivi d'activité reste dans la justification et n'entre jamais dans le programme livré. La justification cite « usage à haut risque, annexe III §4b » et « art. 26(7) AI Act » ; la séquence de 20' de l'Après-midi J2 ne dit que « information préalable des salariés et du CSE obligatoire avant mise en service ». Le formateur qui n'ouvre que le programme — c'est-à-dire le guide d'animation et le livret générés depuis ce squelette — ne saura pas qu'il enseigne un usage haut risque. C'est exactement le défaut d'origine du catalogue (« IA Act » une seule occurrence) reconduit sous une autre forme.

  → *Écrire « usage à haut risque au sens de l'annexe III §4b du règlement européen sur l'IA » dans l'intitulé de la séquence de 20', et non seulement dans le commentaire.*

**MINEUR** — Le Matin J2 ne porte aucune démonstration avant/après (chasse à l'erreur, exposé documents obligatoires, pratique, commentaire du chiffre, vérification). Aucune des quatre demi-journées ne porte de séquence « objectif du module » explicite formulant un objectif observable rattaché à un objectif global — les 5 blocs sont donc amputés du premier partout.

  → *Ouvrir chaque demi-journée par 5' d'objectif observable et adosser une démonstration avant/après de 10' à la séquence « documents obligatoires ».*

**MINEUR** — Le livrable « un prototype d'automatisation de suivi testé, avec son jeu d'essai et sa procédure de retour arrière » est formulé mot pour mot comme celui de ia-pour-l-it (Après-midi J2 : « automatisation testée avec sa procédure de retour arrière ») et recoupe frontalement ia-pour-l-automatisation (2 j). Les trames d'atelier et la liste rouge sont bien spécifiques, la composante automatisation ne l'est pas.

  → *Borner l'automatisation de cette fiche au relevé d'atelier (suivi hebdomadaire à partir d'un relevé brut) et le dire dans le libellé du livrable, pour que les trois fiches cessent d'être interchangeables.*

---

### ia-pour-les-achats — **a_corriger**

- Pratique : **45 %** · programmé **420 min** sur **420 min** dus

**BLOQUANT** — Ratio de pratique 175 min / 390 min = 44,9 %, soit 15 points sous le plancher et 25 points sous les 70 % déclarés au programme Qualiopi. Détail : M1 25/100 = 25 %, M2 45/95 = 47,4 %, M3 65/115 = 56,5 %, M4 40/80 = 50 %. Contrairement à marketing, commerciaux et finance, la révision ne déclare aucun chiffre de ratio sur cette fiche — le verdict reproche pourtant au squelette d'origine ses « ~9 % de pratique » sans mesurer ce qu'il propose à la place.

  → *Il manque 59 minutes de pratique pour atteindre 60 %. Sources : 20' « Déposer trois devis » (M2) et 15' « Écrire le besoin » (M2) et 20' « Le litige à réception » (M3) sont descendantes et se prêtent toutes trois à une mise en application immédiate sur le devis de travail déjà constitué au M1.*

**MAJEUR** — Module 1 : 15 minutes de pratique sur 100. Après 10' d'ouverture, la salle subit 65 minutes d'exposé consécutif (20' « ce que l'IA fait et ne fait pas » + 25' « les trois régimes d'usage » + 20' « ce qui ne sort jamais ») avant le premier geste. C'est un module quasi purement descendant, ce que le standard maison qualifie de défaut.

  → *Ramener les trois régimes d'usage à 15' et « ce qui ne sort jamais » à 15', et porter la pratique de constitution de la liste rouge et du devis de travail de 15' à 25'.*

**MAJEUR** — Dérivation horaire cassée malgré le renommage. Les sections sont « Matin — Module 1 », « Matin — Module 2 », « Après-midi — Module 3 », « Après-midi — Module 4 ». deriveProgrammeSchedule() réinitialise l'horloge à CHAQUE section : les deux sections « Matin » démarreront toutes deux à 9 h 00, les deux « Après-midi » toutes deux à 14 h 00. Le Module 2 s'affichera 9 h 00 → 10 h 35 en recouvrement complet du Module 1 (9 h 00 → 10 h 40). La justification écrite dans la révision (« sans ce renommage, les quatre modules démarreraient tous à 9 h ») est donc fausse : le renommage n'en corrige que la moitié. Le test catalog-v2-schedule.test.ts ne vérifie aucun recouvrement — la CI restera verte.

  → *Deux sections seulement, « Matin » et « Après-midi », les modules devenant des repères dans les intitulés de séquences ; ou étendre sectionStartMin() pour cumuler l'horloge entre sections d'une même demi-journée.*

**MAJEUR** — Animabilité : les 20' « Le litige à réception : réserves, non-conformité, pénalité de retard — écrire un courrier qui tient sans engager plus que nécessaire ». Juger ce qui « tient » et ce qui « engage » est un arbitrage juridico-commercial. Un formateur IA non acheteur ne peut ni porter la séquence ni corriger les productions des participants — et contrairement à la chasse à l'erreur, ce n'est pas la salle qui peut trancher : les participants viennent précisément chercher cette réponse.

  → *Fournir au kit trois courriers-modèles validés (réserve à réception, mise en demeure de délai, non-conformité) et transformer la séquence en comparaison de sa propre production au modèle. Animable sans expertise, et le livrable y gagne.*

**MAJEUR** — Module 4 : les 15' « Le tableur assisté » introduisent une compétence entièrement neuve, en descendant, sans une minute de pratique, à 45 minutes de la fin de journée — et dupliquent les 40' d'atelier tableur de ia-pour-la-finance. Le Module 4 ne porte par ailleurs aucune démonstration avant/après : les 5 blocs y sont incomplets.

  → *Retirer la séquence tableur d'ici (elle est traitée sérieusement dans la fiche finance) et redistribuer les 15' sur la chasse à l'erreur, ou l'adosser à 10' d'application sur le comparatif de devis déjà produit au M2.*

**MINEUR** — Aucun des quatre modules ne porte de séquence « objectif du module » énonçant un objectif observable rattaché à un objectif global. Aucun marqueur de déjeuner n'est déclaré, alors que marketing, commerciaux et finance en portent un.

  → *5' d'objectif en tête de chaque module, pris sur les séquences descendantes ; ajouter le marqueur déjeuner entre M2 et M3.*

---

### ia-pour-la-relation-client — **a_corriger**

- Pratique : **46 %** · programmé **420 min** sur **420 min** dus

**BLOQUANT** — Ratio de pratique 180 min / 390 min = 46,2 %, soit 14 points sous le plancher et 24 points sous les 70 % déclarés au programme Qualiopi. Détail : M1 25/105 = 23,8 %, M2 55/90 = 61,1 %, M3 65/115 = 56,5 %, M4 35/80 = 43,8 %. La révision affirme que le jeu de rôle « porte le ratio de pratique bien au-delà de 60 % » : elle ne le calcule pas, et c'est faux — le jeu de rôle pèse 25 minutes sur 390.

  → *Il manque 54 minutes. Le M1 est le gisement : 25' « trois régimes d'usage » et 20' « ce qu'on ne colle jamais » peuvent céder 20' à la pratique de neutralisation (qui ne fait que 15' pour trois demandes à traiter). Le M4 (cf. défaut suivant) en fournit 20 autres.*

**MAJEUR** — Module 4 : 80 minutes sans un seul atelier. Séquences : 20' de cadre (frontière de transparence), 15' de relecture appliquée, 20' d'évaluation, 15' de feuille de route, 10' de prise en main du livrable. Aucune démonstration avant/après non plus. C'est le module le plus descendant des 7 fiches contrôlées, et il clôt la journée — la salle sort sur 45 minutes sans production.

  → *Fusionner la prise en main du livrable (10') dans la feuille de route et ouvrir un atelier de 20' : chacun verse dans la base de connaissances la fiche correspondant à sa réponse la plus fréquente, en appliquant la frontière de transparence qui vient d'être posée.*

**MAJEUR** — Garde-fou placé après l'usage qu'il encadre. La frontière de transparence — « personnaliser sans faire croire à une conversation humaine, un client qui échange avec un automate doit le savoir », obligation applicable depuis le 2 août 2026 — est en Module 4, dernière demi-heure. Or le Module 2 produit 40 minutes durant les réponses types, et le Module 3 construit 30 minutes durant la base de connaissances : la révision décrit elle-même ce livrable comme « exactement ce qu'on branche ensuite sur un agent conversationnel ». La fiche énonce en verdict la règle « les règles doivent précéder les gestes qu'elles encadrent » et ne l'applique pas à son propre programme. Ce n'est pas bloquant au sens de l'annexe III (la relation client n'est pas un usage haut risque), mais c'est une contradiction interne du livrable.

  → *Remonter la frontière de transparence en Module 1, à côté des 20' « ce qu'on ne colle jamais », ou en ouverture du Module 2 avant l'atelier de réponses types. Le M4 la rappelle et l'applique, il ne la découvre pas.*

**MAJEUR** — Dérivation horaire : mêmes collisions que ia-pour-les-achats. « Matin — Module 1 » et « Matin — Module 2 » démarrent toutes deux à 9 h 00, « Après-midi — Module 3 » et « Après-midi — Module 4 » toutes deux à 14 h 00. Le Module 2 s'affichera 9 h 00 → 10 h 30 par-dessus le Module 1 (9 h 00 → 10 h 45).

  → *Deux sections « Matin » / « Après-midi », ou cumul de l'horloge entre sections de même demi-journée dans sectionStartMin().*

**MINEUR** — Module 2 : aucune séquence de synthèse ni acquis (il se termine sur la chasse à l'erreur). Module 3 : aucune démonstration avant/après explicitement libellée. Aucun des quatre modules ne porte de séquence « objectif du module ».

  → *5' d'acquis en fin de M2 pris sur les 20' AXION, et requalifier les 20' « Reprendre un dossier en cours » (M3) en démonstration avant/après, ce qu'elle est déjà de fait.*

---

### ia-pour-l-it — **a_refaire**

- Pratique : **47 %** · programmé **760 min** sur **840 min** dus

**BLOQUANT** — Minutage insuffisant de 80 minutes. Les quatre demi-journées font exactement 175' chacune (Matin J1 15+25+30+25+25+40+15, Après-midi J1 20+20+45+20+40+20+10, Matin J2 15+25+25+45+30+25+10, Après-midi J2 25+20+20+50+20+25+15) = 700'. Avec les 4 pauses à 15' : 760' pour 840' dus. Chaque demi-journée programme 190 minutes au lieu de 210 : 20 minutes de vide, quatre fois.

  → *Reprogrammer 20 minutes de pratique par demi-journée. C'est aussi la moitié du chemin vers le ratio (défaut suivant).*

**BLOQUANT** — Ratio de pratique 330 min / 700 min = 47,1 %, soit 13 points sous le plancher et 23 points sous les 70 % déclarés au programme Qualiopi. Par demi-journée : Matin J1 55/175 = 31,4 %, Après-midi J1 95/175 = 54,3 %, Matin J2 105/175 = 60 %, Après-midi J2 75/175 = 42,9 %. Seul le Matin J2 atteint le standard.

  → *Atteindre 60 % sur une base de 780' demande 468' : il manque 138 minutes. Les 80' de vide comblées par de l'atelier n'en donnent que 60 % ; il faut convertir en plus 20' « Revue et refactorisation », 30' « Runbook et compte rendu d'incident » et 20' « L'espace de travail de l'équipe » en séquences appliquées. Comme pour production, c'est une reconstruction du planning.*

**MAJEUR** — Matin J1 : 95 minutes d'exposé consécutif (15' ouverture + 25' panorama + 30' régimes d'usage + 25' ce qui ne part jamais) avant la première pratique, et AUCUNE démonstration avant/après de la demi-journée — le « Panorama 2026 » est descriptif, pas comparatif. Sur la fiche la plus technique du catalogue, devant des développeurs, c'est le risque de décrochage le plus élevé des 7 fiches contrôlées, et c'est précisément le public que le verdict décrit comme prêt à juger la formation dépassée « dans la première demi-heure ».

  → *Transformer le panorama en démonstration avant/après (la même demande passée au chat, à l'assistant intégré et à l'agent), et intercaler 15' de manipulation après les régimes d'usage : chacun vérifie sur son propre outil ce qui est journalisé et ce qui est retenu.*

**MAJEUR** — Animabilité : deux séquences descendantes exigent une expertise que le formateur n'aura pas. Les 25' « Gouverner l'IA dans l'entreprise » cumulent gouvernance DSI (licences, usage clandestin, journalisation, filtrage) et droit social (déclenchement de l'information-consultation du CSE au titre de l'introduction d'une nouvelle technologie). Les 20' « Revue et refactorisation : distinguer ce qu'elle voit vraiment de ce qu'elle invente » supposent de lire du code en salle. La parade annoncée — « c'est le test qui corrige, pas le formateur » — couvre bien les 45' de génération de tests, elle ne couvre ni l'une ni l'autre de ces deux séquences.

  → *Gouvernance : fournir une charte-type et une grille de déclenchement CSE au kit, et transformer la séquence en atelier de sélection d'articles — le formateur anime un choix, il n'expose pas un régime juridique. Revue : partir d'un changement fourni au kit, déjà porteur de trois défauts connus, pour que la correction soit vérifiable sans lire le code du client.*

**MAJEUR** — Même défaut que production : « suivi d'activité d'un salarié » (Après-midi J2, 20') est un usage annexe III §4b, et ni « haut risque », ni « règlement européen sur l'IA », ni analyse d'impact n'apparaissent dans le programme livré. La justification de la révision cite bien la consultation du CSE ; l'intitulé de séquence ne porte que « accès, sanction, suivi d'activité d'un salarié ». Le formateur qui n'ouvre que le programme ne saura pas qu'il touche un usage réglementé.

  → *Nommer la qualification dans l'intitulé de la séquence de 20', et pas seulement dans le commentaire de la révision.*

**MINEUR** — Matin J2 ne porte aucune démonstration avant/après. Aucune des quatre demi-journées ne porte de séquence « objectif du module » énonçant un objectif observable. Le libellé du livrable — « automatisation testée avec sa procédure de retour arrière » — est identique à celui de ia-pour-la-production et recoupe ia-pour-l-automatisation.

  → *5' d'objectif par demi-journée, une démonstration avant/après adossée aux 25' « Du besoin métier à la spécification », et un libellé de livrable qui distingue l'automatisation IT (script récurrent, tri de journaux) de celle de l'atelier de production.*

---

### ia-pour-le-btp — **a_corriger**

- Pratique : **54 %** · programmé **420 min** sur **420 min** dus

**MAJEUR** — Ratio de pratique sous le plancher. Pratique + vérification = 210 min (M1 15+25+5, M2 40+15, M3 15+40+10, M4 25+20) sur 390 min de séquences = 53,8 %. Rapporté aux 420 min de face-à-face déclarées (1j = 7 h, catalog-import.ts:55, pauses incluses) = 50,0 %. Par module : M1 45/90 = 50 %, M2 55/105 = 52 %, M3 65/105 = 62 %, M4 45/90 = 50 %. Or catalog-import.ts:67 écrit RATIO_PRATIQUE_PCT = 70 en dur dans le programme Qualiopi officiel : 20 points d'écart entre ce qui est déclaré et ce qui est programmé.

  → *Transférer 40 min d'exposé vers l'atelier : M2 réduire les deux exposés (15' courriers + 10' descriptif) à 15' au total et porter l'atelier à 50' ; M3 réduire les deux exposés de 10' à 12' au total et porter l'atelier à 50'. On atteint 250/390 = 64 % et 59,5 % sur base 420.*

**MAJEUR** — Deux séquences exigent un contenu juridique que le formateur IA n'a pas et que rien ne déclare fourni : M2 10' « mentions obligatoires du devis bâtiment (assurance et garantie décennale, conditions, validité) » et M3 10' « en marché public, une référence inventée est une fausse déclaration : effectifs, chantiers de référence, certifications, qualifications, assurances — la liste de ce qui se vérifie ». La fiche immobilier du même lot protège son animateur (« la trame conforme fournie, et pourquoi on ne la modifie pas », plus interdiction écrite de l'improviser) ; BTP ne le fait pas.

  → *Livrer les deux listes dans le kit formateur et reprendre mot pour mot la formule d'immobilier : trame fournie, interdiction de l'improviser ou de la modifier en salle.*

**MAJEUR** — materielFr absent du catalogue (aucun champ materielFr dans catalog-v2.ts entre les lignes 1734 et 1844) alors que 3 ateliers sur 4 exigent des pièces réelles : « notes réelles de son chantier » (M1), « deux pièces réelles de son chantier en cours » (M2), « chacun charge son CCTP ou sa notice » (M3). Le change note l'annonce en texte mais le champ reste à écrire.

  → *Renseigner materielFr : documents de chantier réels (notes, CCTP ou notice, mémoire ou consultation en cours), téléphone accepté pour la dictée.*

**MINEUR** — M3, démo 10' : « un mémoire technique généré, et les trois références inventées qu'il contient — repérage en direct ». Le nombre d'hallucinations n'est pas déterministe en génération live ; la démo peut ne rien produire à repérer.

  → *Livrer une trace capturée (prompt + sortie) dans le kit et ne relancer en direct qu'en bonus.*

**MINEUR** — M1 : 5' de vérification en binôme pour une production de 25'. À deux, chaque participant dispose de 2,5 min de relecture — le bloc de vérification existe formellement mais ne peut pas fonctionner.

  → *Porter la vérification à 10', prélevées sur les 20' d'exposé du même module.*

**MINEUR** — Le programme ne nomme ni l'IA Act ni le biais, et ne cite pas la méthode AXION, alors que trois fiches du même lot (hôtellerie, industrie, transport) ouvrent leur démo par « méthode AXION (Acteur, conteXte, Intention, Output, Normes) ». Incohérence de lot plus qu'un défaut propre.

  → *Trancher au niveau du lot : soit AXION est nommée et déployée dans les 6 fiches, soit dans aucune.*

**MINEUR** — Points conformes, à confirmer tels quels : minutage exact (390' de séquences + 2 pauses de 15' = 420' dus, déjeuner déclaré hors temps, préfixes « Matin · » / « Après-midi · » présents donc la timeline bascule bien à 14 h) ; garde-fous tous antérieurs à l'atelier qu'ils encadrent (règle « l'IA ne chiffre pas » et exclusion PPSPS/analyse de risques en M1 avant la première pratique ; mentions du devis avant l'atelier M2 ; fausse déclaration et borne sécurité avant l'atelier M3) ; 5 blocs complets sur 4 modules sur 4 ; livrable produit par le participant et distinct du reste du catalogue (le mémoire technique n'existe nulle part ailleurs).

---

### ia-pour-l-immobilier — **a_corriger**

- Pratique : **55 %** · programmé **420 min** sur **420 min** dus

**MAJEUR** — Ratio de pratique sous le plancher. Pratique + vérification = 215 min (M1 15+20+5, M2 45+15, M3 15+40+15, M4 25+20) sur 390 min de séquences = 55,1 % ; 51,2 % sur les 420 min de face-à-face déclarées. Par module : M1 40/90 = 44 %, M2 60/105 = 57 %, M3 70/105 = 67 %, M4 45/90 = 50 %. Le programme Qualiopi importé déclarera 70 % (catalog-import.ts:67).

  → *M1 : ramener les trois exposés (15' mentions + 10' inventions + 5' objectif) à 20' au total et porter la pratique de 20' à 30'. M4 : porter l'atelier de construction de 25' à 35' en réduisant démo et retour. On atteint 235/390 = 60,3 %.*

**MAJEUR** — La borne « on ne sélectionne, ne classe ni ne note des candidats locataires avec l'IA » (M3, 10') est correctement placée avant l'atelier, mais aucune séquence ne la met à l'épreuve : les cinq options d'atelier du M3 (convocation d'AG, réponse à copropriétaire, relance d'impayé, état des lieux, argumentaire d'estimation) ne contiennent aucun cas de tri de dossier locataire à reconnaître et refuser, et la vérification de 15' ne porte que sur les affirmations sans preuve. Une interdiction énoncée et jamais pratiquée ne s'installe pas.

  → *Ajouter au M3 un cas piège : une demande de « classement des trois dossiers locataires » glissée dans la liste des tâches à qualifier, avec correction collective dans la vérification.*

**MAJEUR** — Le programme ne nomme jamais la qualification haut risque ni le biais. La justification du change note invoque explicitement « l'amont d'un usage à haut risque sans jamais le nommer » et « le mot biais était absent », mais le programme révisé ne les nomme pas davantage : zéro occurrence de « haut risque », « règlement européen » ou « biais » dans les quatre modules. Comparaison interne : le programme de banque-assurance écrit « usages classés à haut risque par la réglementation européenne » et porte une « Démonstration de biais » de 20' où l'avis rendu change à l'écran.

  → *Reprendre la formulation de banque-assurance dans la séquence de 10' du M3 et y greffer une démo de biais courte (même bien, deux profils de candidat).*

**MAJEUR** — materielFr absent du catalogue alors que trois séquences l'exigent : « déposer le dossier du bien (diagnostics, règlement de copropriété, mandat) » (M1, 15'), « l'annonce d'un bien réel de son portefeuille » (M1, 20'), « chacun charge sa pièce » — règlement de copropriété, bail, compte de charges (M3, 15'). Le change note ne le mentionne pas, contrairement à celui de BTP et d'hôtellerie.

  → *Renseigner materielFr : dossier complet d'un bien réel (diagnostics dont DPE, mandat, règlement de copropriété), et pour les gestionnaires un bail ou un compte de charges.*

**MINEUR** — Points conformes : minutage exact (390' + 2 pauses de 15' = 420' dus, déjeuner déclaré, préfixes Matin/Après-midi présents) ; ordonnancement des garde-fous correct (mentions obligatoires et « ce que l'IA invente » en M1 avant la pratique ; « ce qu'on ne colle jamais » en M2 avant l'atelier de 45' ; borne locataires en tête du M3) ; 5 blocs complets sur 4 modules sur 4 ; livrable produit par le participant et distinct. À souligner : c'est la seule des six fiches qui protège explicitement l'animateur non spécialiste (« la trame conforme fournie, et pourquoi on ne la modifie pas ») — formule à reprendre dans les cinq autres.

---

### ia-pour-le-commerce — **a_corriger**

- Pratique : **54 %** · programmé **420 min** sur **420 min** dus

**MAJEUR** — Ratio de pratique sous le plancher. Pratique + vérification = 210 min (M1 15+20+5, M2 40+20, M3 35+20+10, M4 25+20) sur 390 min = 53,8 % ; 50,0 % sur les 420 min déclarées. Par module : M1 40/90 = 44 %, M2 60/105 = 57 %, M3 65/105 = 62 %, M4 45/90 = 50 %. Et le compte de 210 min est déjà généreux : il inclut les 20' « Le chiffre », qui sont pour moitié un exposé. Sans elles, 190/390 = 48,7 %.

  → *M1 : fusionner les exposés de 15' et 10' en 15' et porter la pratique de 20' à 30'. M3 : scinder « Le chiffre » en 10' d'exposé et 10' de manipulation étiquetée pratique, et porter l'atelier avis de 35' à 40'.*

**MAJEUR** — Animabilité : M1, 15' — « ce que la fiche doit obligatoirement porter (caractéristiques essentielles, prix, disponibilité, garantie, conditions de retour) et les affirmations qui exposent : allégation santé, allégation environnementale ». C'est du droit de la consommation, et rien ne déclare que la liste est fournie au formateur. Même défaut que BTP ; immobilier, lui, verrouille sa trame.

  → *Livrer la liste dans le kit avec interdiction de l'improviser, sur le modèle de la trame conforme d'immobilier.*

**MAJEUR** — materielFr absent du catalogue alors que M1 exige « déposer une fiche technique fournisseur ou un tableau produits », M2 « son propre tableau » et M3 « trois avis réels de son établissement ». Sans déclaration, les participants arrivent sans matière et trois ateliers sur quatre tombent.

  → *Renseigner materielFr : fiches techniques fournisseur, tableau produits exportable, trois avis clients réels.*

**MINEUR** — Chevauchement de livrable avec ia-pour-l-hotellerie-restauration : « réponses types aux avis (positif, négatif, injustifié) » ici, « trames de réponse aux avis (positif, négatif, injuste) » là — même objet, même triptyque, formulation quasi verbatim. Les deux fiches restent distinctes par ailleurs (fiche produit et série d'un côté, carte et groupes de l'autre), mais un client qui compare les deux catalogues verra le doublon.

  → *Différencier le composant : ici réponses aux avis produit et place de marché, là réponses aux avis de séjour et de restauration.*

**MINEUR** — h1Fr « Formation IA pour le commerce : optimiser l'ensemble de son activité » (catalog-v2.ts:1973) est identique, hors nom de secteur, à celui du BTP (ligne 1745) et quasi identique à ceux de transport (2304) et industrie (2191). Le change note du BTP propose de retoucher le sien en invoquant ce doublon ; celui de commerce ne dit rien, donc le doublon subsiste après révision.

  → *Retoucher le h1 de commerce en même temps que celui du BTP, et traiter transport et industrie dans la foulée.*

**MINEUR** — Points conformes : minutage exact (390' + 2 pauses = 420', déjeuner déclaré, préfixes Matin/Après-midi présents) ; garde-fous tous antérieurs (obligations et règle « aucune caractéristique que la fiche technique ne prouve » avant la pratique M1 ; « ce qu'on ne colle jamais » avant l'atelier M2 ; interdit de fabriquer un avis et règle de réponse publique avant l'atelier M3) ; 5 blocs complets sur 4 modules sur 4 ; livrable produit par le participant. Le contrôle par échantillonnage du M2 (20', « le binôme tire trois fiches au hasard ») est la meilleure trouvaille du lot pour vérifier une production en série — transférable à BTP et industrie.

---

### ia-pour-l-hotellerie-restauration — **a_corriger**

- Pratique : **62 %** · programmé **420 min** sur **420 min** dus

**BLOQUANT** — Le garde-fou allergènes arrive après l'atelier qu'il encadre. Le change note annonce noir sur blanc « Poser le garde-fou allergènes / origine / fait maison / appellations AVANT l'atelier menus ». Le programme livré ne le fait pas : la seule mention antérieure est une incise dans la démonstration de 15' (« et ce que la traduction a fait des allergènes »), puis l'atelier de 45' fait traduire et adapter la carte, et ce n'est qu'ensuite que vient « Revalidation obligatoire sur la fiche technique : allergènes, origine des viandes, fait maison, appellations » (20'). Aucune séquence n'énonce l'obligation d'information sur les 14 allergènes avant que les participants produisent. Sur un risque sanitaire puis pénal, c'est l'ordre exact que la mission interdit.

  → *Créer une séquence de 12' « ce qui est réglementé sur une carte » avant l'atelier du M3, prélevée sur les 20' de la feuille de route du M4, et conserver la revalidation de 20' en aval comme contrôle.*

**MAJEUR** — 5 blocs : 2 modules complets sur 4. M1 n'a pas d'objectif observable (« Les trois moments où part le temps » est un contenu, pas un objectif) et pas de synthèse — il se termine sur la vérification. M4 n'a ni démonstration ni synthèse/clôture — il se termine sur la feuille de route. M2 et M3 sont exemplaires (objectif « le résultat visé », démo avant/après, atelier chronométré, contrôle croisé sur grille fournie, synthèse).

  → *Aligner M1 et M4 sur la structure de M2 : ouvrir par « le résultat visé » et fermer par une synthèse de 5', prélevées sur les 20' de liste rouge (M1) et les 20' de feuille de route (M4).*

**MAJEUR** — Timeline publique inerte. Aucun module n'est préfixé « Matin · » / « Après-midi · ». sectionStartMin() (src/content/formations/catalog-v2-schedule.ts:51) ne bascule à 14 h 00 que si l'intitulé de section commence par « après-midi » ; les quatre modules démarreront donc tous à 9 h 00 sur la fiche publique. Le change note identifie le problème dans sa « Réserve » et ne le corrige pas, alors que BTP, immobilier et commerce l'ont corrigé dans le même lot.

  → *Préfixer M1 et M2 par « Matin · », M3 et M4 par « Après-midi · », comme les trois autres fiches du lot.*

**MAJEUR** — Aucun déjeuner déclaré. Le compte est juste (390' de séquences + 2 pauses de 15' = 420' = les 7 h dues) mais la journée s'enchaîne sans coupure repas, alors que BTP, immobilier et commerce déclarent « Déjeuner — 1 heure » dans le même document. Un programme public d'une journée CHR sans pause déjeuner n'est pas défendable.

  → *Déclarer le déjeuner entre M2 et M3, hors des 420 min de face-à-face.*

**MAJEUR** — Animabilité : la démonstration du M3 (15') demande de montrer « ce que la traduction a fait des allergènes » dans une langue étrangère. Elle exige soit une compétence linguistique que le formateur IA n'a pas, soit un exemple pré-testé — non déclaré dans le kit.

  → *Livrer dans le kit une carte d'exemple avec sa traduction fautive capturée et l'allergène déplacé identifié.*

**MINEUR** — Ratio de pratique : 240 min (M1 30+15, M2 45+20, M3 45+20, M4 25+20+20) sur 390 = 61,5 %. C'est la seule des six fiches contrôlées à franchir le plancher de 60 % sur la base pédagogique. Sur les 420 min de face-à-face déclarées, 57,1 %. Reste 8,5 à 13 points sous les 70 % que catalog-import.ts:67 écrira dans le programme Qualiopi.

  → *Rien à corriger sur la fiche ; c'est la constante RATIO_PRATIQUE_PCT = 70 qui doit être calculée à partir du programme au lieu d'être écrite en dur.*

**MINEUR** — Le retrait de la planification des équipes n'est propagé qu'à objectifsFr. Restent en base et sur la page publique : casUsageFr « L'aide à la planification des équipes » (catalog-v2.ts:2100) et metaDescriptionFr « ... menus et supports, planification des équipes » (2087). Le change note ne vise que « l'objectif et la séquence ».

  → *Retirer l'item de casUsageFr et réécrire metaDescriptionFr avec les demandes de groupes à la place.*

---

### ia-pour-l-industrie — **a_refaire**

- Pratique : **58 %** · programmé **825 min** sur **840 min** dus

**BLOQUANT** — La dé-duplication annoncée n'est pas livrée. Le verdict pose que « son jour 2 est mot pour mot celui d'ia-pour-la-production ». En comparant les deux versions RÉVISÉES, 6 des 8 modules d'industrie ont un équivalent direct dans production : M1 (régimes d'usage 30' + liste rouge 20' : plans, prix, données nominatives) ≈ production Matin J1 (30' + 20', mêmes listes) ; M3 (gamme, compte rendu d'intervention, consigne de poste, version simplifiée ou traduite, puis revalidation HSE) ≈ production Après-midi J1 (mode opératoire, traduire et simplifier, « toute consigne à portée sécurité est revalidée par le responsable HSE ») ; M4 (« commenter les indicateurs sans jamais les recalculer ») ≈ production Matin J2 (« le commentaire autour du chiffre... on ne fait jamais calculer l'IA ») ; M6 ≈ production Après-midi J2, quasi verbatim (« Ce qu'on n'automatise jamais sur une personne : cadences, temps par poste, rebuts par opérateur — information préalable des salariés et du CSE ») ; M7 (« ce qui survit à six mois, c'est l'espace partagé du service, pas le classeur de prompts ») ≈ production (« l'espace de travail qui survit à la formation... ce qui remplace le classeur de prompts ») ; M8 chasse à l'erreur ≈ production Matin J2 (« on fait produire un texte sur VOTRE process, chacun surligne ce qui est faux, on compte »). Seul M5 (préparation d'audit ou de certification) est propre à l'industrie ; M2 (non-conformité) recoupe partiellement la pratique documents obligatoires de production. Deux produits vendus séparément à 3 900 € HT restent le même contenu après révision.

  → *Refaire le périmètre : garder à l'industrie ce que production n'a pas (audit et certification, réclamation client, référentiel interrogé, revue d'écart) et retirer d'industrie les modules 1, 3, 4, 6, 7 en les remplaçant par des contenus site-spécifiques, ou fusionner les deux offres.*

**BLOQUANT** — Garde-fou sécurité placé après l'atelier. M3 fait produire pendant 45' « une gamme ou un compte rendu réel, puis le décline en consigne de poste et en version simplifiée ou traduite pour les équipes non francophones », et n'énonce qu'ensuite (20') que « tout document à portée sécurité — mode opératoire, consigne, plan de prévention, analyse de risques — est revalidé par le responsable HSE avant diffusion ». La consigne de poste traduite, qui est exactement le document à portée sécurité visé, est produite avant que la règle soit posée.

  → *Remonter la règle HSE avant l'atelier (à la place de la démonstration ou en la réduisant à 10'), et transformer les 20' aval en vérification croisée sur grille, ce qui comble aussi le bloc manquant.*

**MAJEUR** — Même inversion au M6 : « information préalable des salariés et consultation des représentants du personnel avant toute mise en service d'un suivi automatisé » (20') est placé après l'atelier de 40' où chaque table qualifie trois suivis du site. Moins grave que M3 (l'atelier qualifie, il ne déploie pas), mais l'ordre reste inverse.

  → *Permuter la séquence de 20' et l'atelier de 40'.*

**MAJEUR** — Minutage : J1 = 390' de séquences + 2 pauses de 15' = 420' (conforme) ; J2 = 390' + 1 seule pause de 15' = 405'. Total 825' contre 840' dues (2j = 14 h, catalog-import.ts:55) : 15 minutes manquantes. Et le J2 enchaîne M6 + M7 + M8 = 290 minutes consécutives sans aucune pause déclarée. Aucun déjeuner n'est déclaré, ni J1 ni J2, contrairement à BTP, immobilier et commerce.

  → *Ajouter une pause de 15' entre M6 et M7 et une seconde entre M7 et M8, déclarer un déjeuner sur chaque jour, et redistribuer 15' de séquence pour retomber sur 840'.*

**MAJEUR** — 5 blocs : 4 modules complets sur 8. M1 n'a ni objectif observable (« Les trois chantiers où le temps part vraiment » est un contenu) ni synthèse. M3 et M6 n'ont pas de vérification : leur séquence de 20' est un exposé de règle (« Le passage obligé »), pas un contrôle de la production. M8 n'a ni démonstration ni synthèse. M2, M4, M5, M7 sont complets.

  → *Convertir les deux « Le passage obligé » en vérifications sur grille après les avoir remontées en amont, et encadrer M1 et M8 par un objectif et une synthèse.*

**MAJEUR** — Ratio de pratique : 450 min sur 780 min de séquences = 57,7 % ; 53,6 % sur les 840 min dues. Détail : J1 = 215/390 = 55,1 % (M1 45/95, M2 65/100, M3 45/100, M4 60/95), J2 = 235/390 = 60,3 % (M5 65/100, M6 40/95, M7 65/100, M8 65/95). La fiche est vendue scindable (scindable: true, catalog-v2.ts:2187) : un client qui n'achète que le J1 reçoit une journée à 55 % de pratique, sous le plancher, avec 70 % déclarés au programme Qualiopi.

  → *Les deux modules qui plombent le J1 sont M1 (45/95) et M3 (45/100) : convertir les 20' descendants de M3 en vérification et transférer 15' de liste rouge M1 vers l'atelier remonte le J1 à 250/390 = 64 %.*

**MINEUR** — « Documents dépourvus d'identifiants et de valeurs de procédé » (M2, 45') et « décide agrégation, anonymisation réelle ou abandon » (M6, 40') font reposer deux ateliers sur une opération qu'aucune séquence n'enseigne ni ne contrôle. C'est le motif « anonymisé = évacuation du RGPD » déjà relevé sur le catalogue. Le seul endroit du catalogue qui traite réellement le sujet est banque-assurance : « pseudonymiser n'est pas anonymiser — un dossier dont on a retiré le nom, ré-identifié devant la salle en trois questions » (25').

  → *Importer cette séquence de ré-identification dans le M1, au moins en version 10'.*

**MINEUR** — « Classé à haut risque par la réglementation européenne » figure dans la justification du change note et nulle part dans le programme, alors que banque-assurance le nomme explicitement dans son programme et porte une démonstration de biais de 20'. Sur les six fiches contrôlées, zéro programme ne nomme le règlement européen et zéro ne contient de séquence de biais.

  → *Nommer le classement dans la séquence de 20' du M6, dans les mêmes termes que banque-assurance.*

**MINEUR** — Aucun préfixe « Matin · » / « Après-midi · » : les intitulés commencent par « Jour 1 · Module... », que sectionStartMin() ne reconnaît pas. Les 8 modules démarreront tous à 9 h 00 sur la timeline publique.

  → *Renommer en « Jour 1 · Matin — » / « Jour 1 · Après-midi — » ne suffira pas (le test porte sur le début de chaîne) : soit préfixer par « Après-midi », soit étendre sectionStartMin() à une détection par inclusion.*

---

### ia-pour-le-transport-logistique — **a_corriger**

- Pratique : **59 %** · programmé **420 min** sur **420 min** dus

**BLOQUANT** — Le catalogue continue de vendre ce que le programme retire. La requalification annoncée ne vise que objectifsFr. Restent inchangés et alimentent la page publique comme les documents Qualiopi générés : casUsageFr « L'aide à la planification de tournées » (catalog-v2.ts:2318), metaDescriptionFr « planification de tournées, reporting, documents de transport » (2306), beneficeDirigeantFr « Une planification facilitée et des documents produits plus rapidement » (2330), avantApresFr « Une planification facilitée » (2336) et surtout equationTempsFr « 1 journée → un document de transport rempli en quelques minutes à partir des informations de la commande » (2333) — cette dernière porte précisément sur les documents que le M3 met hors périmètre (lettre de voiture, déclarations de matières dangereuses). Le programme et la fiche commerciale se contredisent frontalement.

  → *Propager la requalification à casUsageFr, metaDescriptionFr, beneficeDirigeantFr, avantApresFr et equationTempsFr ; réécrire l'équation temps sur le litige (« un courrier de réserve structuré à partir des faits du dossier »), qui est le nouveau cœur de la journée.*

**MAJEUR** — 5 blocs : 1 module complet sur 4. M1 n'a ni objectif observable (« Les trois moments où l'exploitation perd des heures » est un contenu) ni synthèse. M3 n'a pas de synthèse — il s'arrête sur la vérification. M4 n'a ni démonstration ni synthèse. Seul M2 est complet (résultat visé, démo avant/après, atelier 45', contrôle croisé 20', synthèse 10').

  → *Aligner M1, M3 et M4 sur M2 : ouvrir par « le résultat visé » et fermer par une synthèse de 5-10', prélevées sur la liste rouge du M1 et la feuille de route du M4.*

**MAJEUR** — Ratio de pratique : 230 min (M1 30+15, M2 45+20, M3 20+40+15, M4 30+15) sur 390 min = 59,0 %, donc juste sous le plancher ; 54,8 % sur les 420 min de face-à-face déclarées. Par module : M1 45/95 = 47 %, M2 65/100 = 65 %, M3 75/100 = 75 %, M4 45/95 = 47 %. Les deux modules en défaut sont M1 et M4.

  → *Porter l'atelier du M4 de 30' à 45' en réduisant la séquence descendante de 20' à 12' et la feuille de route de 20' à 13' : le ratio passe à 245/390 = 62,8 %.*

**MAJEUR** — M4 sous-dimensionné : un seul atelier de 30' doit produire la synthèse d'exploitation en version direction ET en version équipe, PUIS monter l'espace de travail qui est le livrable annoncé de la journée. À titre de comparaison, industrie consacre 45' au seul montage de l'espace (M7) et hôtellerie 20'. Le livrable « monté en séance » ne l'est pas réellement.

  → *Scinder : 25' pour la synthèse d'exploitation, 20' pour le montage de l'espace, en récupérant sur l'exposé de 20' et la feuille de route de 20'.*

**MAJEUR** — materielFr absent du catalogue (aucun champ entre les lignes 2293 et 2410) alors que M1 exige « dix pièces de l'exploitation », M2 « deux dossiers réels — une réserve à la livraison, un retard réclamé par le client » et M3 « les consignes de sa tournée du lendemain ». Le change note ne le mentionne pas, contrairement à ceux de BTP, hôtellerie et industrie.

  → *Renseigner materielFr : deux dossiers de litige réels, un ordre de transport ou une commande client, le contrat type de l'entreprise.*

**MINEUR** — Aucun déjeuner déclaré (390' de séquences + 2 pauses de 15' = 420' conformes, mais journée sans coupure repas) et aucun préfixe « Matin · » / « Après-midi · », donc les quatre modules démarreront tous à 9 h 00 sur la timeline publique via sectionStartMin(). Même défaut qu'hôtellerie et industrie, corrigé chez BTP, immobilier et commerce dans le même lot.

  → *Déclarer le déjeuner entre M2 et M3 et préfixer M3 et M4 par « Après-midi · ».*

**MINEUR** — h1Fr « Formation IA pour le transport et la logistique : optimiser l'ensemble de l'activité » (catalog-v2.ts:2304) est quasi identique à ceux du BTP (1745) et du commerce (1973), tous deux en « optimiser l'ensemble de son activité ». Le change note ne le traite pas.

  → *Retoucher en même temps que ceux du BTP et du commerce.*

**MINEUR** — « Pièces dépourvues d'identifiants et de tarifs » (M2, 45') : même évacuation que chez industrie — retirer les identifiants d'un dossier de litige qui garde la date, le lieu de livraison et la nature de la marchandise ne l'anonymise pas, et aucune séquence n'enseigne l'opération.

  → *Importer la démonstration de ré-identification de banque-assurance dans le M1.*

**MINEUR** — Point fort à préserver : ce sont les garde-fous les mieux placés des six fiches. Les deux bornes de la journée (vérification des temps de conduite et de repos, exclusion de la lettre de voiture et des déclarations de matières dangereuses) sont en deuxième position du M3, avant l'atelier de 40' ; « ce qu'on n'automatise jamais sur une personne » précède l'atelier du M4 ; la confidentialité et la liste rouge occupent tout le M1. Et la chasse à l'erreur en direct sur la réglementation sociale (M3, 20') est le seul dispositif du lot qui traite un sujet réglementaire sans demander d'expertise au formateur, puisque c'est la salle qui corrige.

  → *Généraliser ce dispositif aux trois fiches où le formateur doit aujourd'hui porter seul un contenu juridique : marché public (BTP), allégations consommateur (commerce), allergènes (hôtellerie) — sous réserve de livrer dans le kit une fiche de référence au cas où la salle se trompe aussi.*

---
