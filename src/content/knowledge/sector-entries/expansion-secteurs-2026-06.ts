/**
 * KB Axion-IA — Entries sectorielles : expansion couverture 2026-06
 * 2026-06-23
 *
 * Comble les 12 secteurs de `sector-tags.ts` qui n'avaient AUCUNE entry KB
 * dédiée (gap KB=0), dont les 2 secteurs jusqu'alors orphelins (immobilier-pro,
 * juridique). Une entry `secteur_brief` (public, editorial) par secteur.
 *
 * CONTRAT ABSOLU : aucune invention. Chaque fait est vérifiable via les sources
 * listées (toutes vérifiées HTTP 200 lors de la rédaction). EN non rédigé V1
 * (titleEn = placeholder `[EN] ...`), conforme à la désactivation du locale EN.
 */

import type { SectorKbEntry } from "./types";

export const EXPANSION_SECTEURS_KB_ENTRIES: ReadonlyArray<SectorKbEntry> = [
  // ─────────────────────────────────────────────────────────────────────────
  // 1. Assurance & mutuelles
  // ─────────────────────────────────────────────────────────────────────────
  {
    slug: "secteur-brief-assurance",
    sectorTagSlugs: ["assurance"],
    type: "secteur_brief",
    domain: "editorial",
    audience: "public",
    titleFr: "Brief sectoriel — IA dans l'assurance et les mutuelles en France",
    titleEn: "[EN] Sector Brief — AI in French Insurance and Mutuals",
    summaryFr:
      "Panorama factuel de l'usage de l'intelligence artificielle dans le secteur français de l'assurance et des mutuelles : cas d'usage en production, cadre réglementaire (AI Act, RGPD, Solvabilité II, supervision ACPR/EIOPA) et opportunités identifiées pour les acteurs B2B.",
    bodyMarkdownFr: `
## Panorama du marché

Le secteur français de l'assurance et des mutuelles fait de l'intelligence artificielle l'un de ses principaux axes d'innovation. France Assureurs, la fédération professionnelle du secteur, a publié une note de position appelant à une utilisation responsable et éthique de l'IA, reconnaissant à la fois les bénéfices opérationnels et les préoccupations légitimes (protection des données personnelles, maintien du contrôle humain, effets sur l'emploi). La fédération soutient la mise en place d'un cadre européen pour un usage éthique de l'IA, tout en plaidant pour un équilibre réglementaire.

Côté supervision, l'Autorité de contrôle prudentiel et de résolution (ACPR), adossée à la Banque de France, travaille sur la gouvernance des algorithmes d'IA dans la finance et l'assurance depuis 2018. Au niveau européen, l'EIOPA (European Insurance and Occupational Pensions Authority) a publié en août 2025 une opinion sur la gouvernance et la gestion des risques liés à l'IA, adressée aux superviseurs nationaux.

## Usages IA déployés en production

Les cas d'usage de l'IA dans l'assurance se concentrent sur plusieurs fonctions métier :

- **Tarification et scoring de risque** : modèles d'évaluation du risque et de calcul des primes, encadrés par les exigences d'équité et d'explicabilité.
- **Souscription** : automatisation partielle ou avancée des processus de souscription, notamment sur des produits standardisés.
- **Détection de fraude** : analyse des flux de données et des sinistres pour identifier des schémas anormaux.
- **Gestion des sinistres** : traitement accéléré des dossiers simples (par exemple sinistres automobiles mineurs), estimation des coûts d'indemnisation, analyse automatisée des courriels entrants.
- **Relation client** : agents conversationnels (chatbots) pour répondre aux demandes en continu, analyse de données issues d'objets connectés.

Ces usages relèvent d'applications conventionnelles que l'EIOPA cite explicitement : tarification, souscription, gestion des sinistres et détection de fraude.

## Contraintes réglementaires spécifiques

Le secteur est soumis à un empilement de cadres applicables :

- **Règlement européen sur l'IA (AI Act)** : approche par niveaux de risque. Certains usages assurantiels (notamment l'évaluation du risque et la tarification en assurance vie et santé) peuvent relever des systèmes à haut risque, impliquant des obligations de documentation, de surveillance humaine et de gestion des risques.
- **RGPD** : tout traitement de données personnelles à des fins d'IA doit respecter les principes de licéité et de minimisation. L'article 22 encadre les décisions entièrement automatisées produisant des effets juridiques ou significatifs sur les personnes — central pour la souscription et le scoring. La CNIL fournit des ressources sur la conformité des systèmes d'IA (base légale de l'intérêt légitime, audit des modèles).
- **Solvabilité II et Directive sur la distribution d'assurance (DDA/IDD)** : l'EIOPA précise que ces textes, technologiquement neutres, posent les principes de gouvernance et de gestion des risques applicables aux systèmes d'IA, sans créer de nouvelles exigences distinctes.
- **Supervision ACPR/EIOPA** : attentes en matière de gouvernance des données, traçabilité (record-keeping), équité, cybersécurité, explicabilité et supervision humaine.

L'ACPR a par ailleurs alerté les fédérations professionnelles sur les vulnérabilités de sécurité liées aux modèles d'IA avancés.

## Opportunités identifiées

Pour les organismes d'assurance et les mutuelles, l'enjeu n'est pas seulement technologique mais de conformité dès la conception. Les opportunités structurelles incluent :

- La mise en place d'une **gouvernance de l'IA** documentée, alignée sur les attentes EIOPA/ACPR, condition d'un déploiement durable.
- L'industrialisation des usages déjà éprouvés (fraude, gestion des sinistres simples, relation client) avec un cadre d'explicabilité et de supervision humaine.
- L'auditabilité des modèles de scoring et de tarification, exigée à la fois par le RGPD (article 22) et par l'AI Act pour les systèmes à haut risque.

Un cabinet d'audit et de conseil IA peut accompagner ces acteurs sur la cartographie des usages, l'évaluation de conformité réglementaire et l'implémentation maîtrisée, en articulant valeur opérationnelle et exigences de supervision.
`,
    sources: [
      "https://www.franceassureurs.fr/nos-positions/lassurance-qui-protege/utilisation-responsable-ethique-intelligence-artificielle-assurance/",
      "https://www.eiopa.europa.eu/eiopa-publishes-opinion-ai-governance-and-risk-management-2025-08-06_en",
      "https://www.eiopa.europa.eu/publications/opinion-artificial-intelligence-governance-and-risk-management_en",
      "https://www.cnil.fr/fr/intelligence-artificielle",
    ],
    lastReviewedOn: "2026-06-23",
    reviewedBy: "claude-opus-4-8",
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 2. Immobilier professionnel
  // ─────────────────────────────────────────────────────────────────────────
  {
    slug: "secteur-brief-immobilier-pro",
    sectorTagSlugs: ["immobilier-pro"],
    type: "secteur_brief",
    domain: "editorial",
    audience: "public",
    titleFr: "Immobilier professionnel : IA, cadre réglementaire et cas d'usage",
    titleEn: "[EN] Professional real estate: AI, regulation and use cases",
    summaryFr:
      "Panorama des usages de l'IA dans l'immobilier professionnel B2B (promotion, foncières, property management, proptech) et des contraintes réglementaires françaises et européennes : loi Hoguet, RGPD, AI Act, performance énergétique.",
    bodyMarkdownFr: `
## Panorama du marché

L'immobilier professionnel français regroupe des acteurs aux modèles distincts : promoteurs immobiliers, foncières et investisseurs, sociétés de property management (gestion locative et technique), syndics, ainsi qu'un écosystème proptech en croissance. Tous partagent une même réalité opérationnelle : des volumes documentaires importants (baux, actes, diagnostics, états des lieux, appels de fonds), des données de marché hétérogènes et une pression réglementaire croissante, notamment sur la performance énergétique des bâtiments.

L'exercice des activités d'entremise et de gestion est encadré depuis plus de cinquante ans par la loi Hoguet (loi n° 70-9 du 2 janvier 1970), qui impose carte professionnelle, garantie financière, assurance de responsabilité civile professionnelle et mandat écrit. Ce socle structure la chaîne de valeur et conditionne toute automatisation des processus métier, qui doit rester compatible avec les obligations de mandat, de transparence des honoraires et de protection des fonds.

## Usages IA déployés en production

Plusieurs usages de l'IA sont aujourd'hui matures dans le secteur :

- **Estimation de valeur** : modèles de valorisation s'appuyant sur des données de transactions et de caractéristiques de biens, pour appuyer (et non remplacer) l'avis de l'expert ou de l'agent.
- **Matching locataire / acquéreur** : recommandation et pré-qualification de dossiers en fonction de critères de recherche, dans le respect des règles de non-discrimination.
- **Gestion technique du parc** : maintenance prédictive d'équipements (ascenseurs, CVC), détection d'anomalies de consommation et priorisation des interventions.
- **Optimisation énergétique** : pilotage et analyse de la consommation pour cibler les travaux de rénovation, enjeu directement lié au DPE.
- **Extraction documentaire** : lecture automatisée de baux, actes et diagnostics pour structurer l'information, fiabiliser les données et accélérer le traitement administratif.

Ces usages relèvent le plus souvent de l'aide à la décision et du gain de productivité, avec une supervision humaine maintenue sur les décisions sensibles.

## Contraintes réglementaires spécifiques

Le secteur cumule plusieurs cadres exigeants :

- **Loi Hoguet** : tout outil intervenant dans l'entremise ou la gestion doit s'inscrire dans le cadre du mandat et des obligations professionnelles (carte, garantie financière, RCP, traçabilité des honoraires).
- **RGPD** : le traitement de données de candidats locataires ou d'acquéreurs est sensible. L'article 22 du RGPD encadre les décisions « fondées exclusivement sur un traitement automatisé » produisant des effets juridiques ou significatifs. La CNIL rappelle le droit à l'intervention humaine, à la transparence et à la contestation. Un scoring de dossiers de location qui écarterait automatiquement des candidats appelle une vigilance particulière : supervision humaine effective, base légale solide, analyse d'impact, et prévention de tout effet discriminatoire.
- **AI Act** (règlement (UE) 2024/1689) : entré en vigueur le 1er août 2024, avec une application progressive. Les systèmes à « risque inacceptable » sont interdits depuis le 2 février 2025 ; les obligations renforcées pour les systèmes à « haut risque » s'appliquent par paliers en 2026 et au-delà. Selon l'usage, un système d'IA dans l'immobilier peut relever de la catégorie « risque limité » (obligation de transparence, ex. chatbots) et doit, dans tous les cas, faire l'objet d'une qualification précise.
- **Performance énergétique (DPE)** : depuis le 1er janvier 2025, les logements classés G en France métropolitaine ne peuvent plus être proposés à la location, l'interdiction s'étendant ensuite aux classes F puis E selon le calendrier en vigueur. Cette contrainte fait de la donnée énergétique un actif stratégique pour les foncières et gestionnaires.

## Opportunités identifiées

Pour les acteurs de l'immobilier professionnel, l'IA crée de la valeur surtout là où elle réduit la charge documentaire et fiabilise la donnée : structuration automatisée des baux et diagnostics, consolidation d'un référentiel de parc à jour, et pilotage de la trajectoire énergétique des actifs (identification des passoires thermiques, priorisation des travaux). Le matching et l'estimation accélèrent les cycles commerciaux, à condition de conserver une supervision humaine sur les décisions affectant des personnes. L'enjeu n'est pas l'automatisation totale, mais une IA gouvernée, conforme à la loi Hoguet, au RGPD et à l'AI Act, qui dégage du temps pour les missions à forte valeur ajoutée tout en sécurisant la conformité réglementaire et énergétique.
`,
    sources: [
      "https://www.legifrance.gouv.fr/loda/id/JORFTEXT000000512228",
      "https://www.cnil.fr/fr/profilage-et-decision-entierement-automatisee",
      "https://www.service-public.gouv.fr/particuliers/actualites/A17154",
      "https://www.entreprises.gouv.fr/decryptages-de-nos-experts/le-reglement-europeen-sur-lintelligence-artificielle-publics-concernes",
    ],
    lastReviewedOn: "2026-06-23",
    reviewedBy: "claude-opus-4-8",
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 3. Juridique & Notariat
  // ─────────────────────────────────────────────────────────────────────────
  {
    slug: "secteur-brief-juridique",
    sectorTagSlugs: ["juridique"],
    type: "secteur_brief",
    domain: "editorial",
    audience: "public",
    titleFr: "Juridique & Notariat : panorama IA et enjeux de confidentialité",
    titleEn: "[EN] Legal & Notarial sector: AI overview and confidentiality stakes",
    summaryFr:
      "Panorama des usages de l'IA dans les cabinets d'avocats, offices notariaux, études de commissaires de justice et directions juridiques en France. Le secret professionnel, le RGPD et l'AI Act structurent chaque déploiement.",
    bodyMarkdownFr: `
## Panorama du marché

Le secteur juridique et notarial français regroupe plusieurs professions réglementées aux contraintes déontologiques fortes. Le notariat compte 17 306 notaires répartis dans 8 398 offices au 31 décembre 2024, selon le rapport annuel du Conseil supérieur du notariat. La profession de commissaire de justice, née le 1er juillet 2022 de la fusion des huissiers de justice et des commissaires-priseurs judiciaires, est représentée par la Chambre nationale des commissaires de justice. S'y ajoutent les cabinets d'avocats, encadrés par le Conseil national des barreaux (CNB), les directions juridiques d'entreprise et un écosystème LegalTech en croissance.

Ces acteurs partagent une caractéristique commune : ils manipulent des données sensibles couvertes par le secret professionnel ou par des obligations de confidentialité contractuelles. Cette spécificité conditionne fortement les modalités d'adoption de l'intelligence artificielle, davantage que dans d'autres secteurs B2B.

## Usages IA déployés en production

Les cas d'usage matures et réalistes dans le secteur sont les suivants :

- **Recherche jurisprudentielle et doctrinale** : interrogation en langage naturel de bases de décisions et de textes, avec restitution synthétique. Le risque principal est l'hallucination de références inexistantes, qui impose une vérification systématique des sources citées.
- **Analyse et revue de contrats** : extraction de clauses, détection d'écarts par rapport à une trame de référence, identification de risques. Utile pour la revue de masse en direction juridique.
- **Rédaction d'actes et de courriers assistée** : génération de premières versions à partir de modèles internes, relue et validée par le professionnel qui en conserve l'entière responsabilité.
- **Due diligence et data room** : tri, classement et résumé de grands volumes documentaires lors d'opérations de fusion-acquisition ou d'audit.
- **Anonymisation et pseudonymisation** : suppression automatisée des données identifiantes avant traitement externe ou publication.

L'IA y est un outil d'assistance : la décision, l'acte authentique et l'engagement de responsabilité restent humains.

## Contraintes réglementaires spécifiques

Le **secret professionnel** est l'enjeu central. Toute requête adressée à un système d'IA peut entraîner une transmission de données vers l'éditeur de l'outil, souvent hébergé dans le cloud. Le guide déontologique adopté par le CNB le 17 mars 2026 rappelle qu'il ne faut jamais transmettre à une IA générative d'informations couvertes par le secret professionnel, et recommande de vérifier les conditions d'utilisation de l'outil ainsi que d'anonymiser les données clients avant tout traitement. Le recours à des solutions auto-hébergées ou à des offres contractuellement étanches devient donc un critère de sélection déterminant.

Le **RGPD** s'applique pleinement. La CNIL a publié le 7 février 2025 de nouvelles recommandations confirmant que le cadre du RGPD permet d'appréhender les spécificités de l'IA, notamment en matière d'information des personnes, d'exercice des droits et de privacy by design.

L'**AI Act** (règlement (UE) 2024/1689), entré en vigueur le 1er août 2024, classe en haut risque les systèmes d'IA destinés à l'administration de la justice (annexe III). Ces systèmes seront soumis à des exigences renforcées — gestion des risques, qualité des données, documentation, supervision humaine — dont l'essentiel devient applicable au 2 août 2026.

S'y ajoute la **déontologie propre à chaque profession** : indépendance, compétence, prudence, information du client et juste tarification, rappelées par le CNB.

## Opportunités identifiées

Le gain principal est le temps libéré sur les tâches documentaires répétitives (recherche, revue, tri), réinvesti dans le conseil à forte valeur. Pour les structures de taille modeste, l'IA peut réduire l'écart de moyens face aux grands cabinets. La condition de réussite reste invariable : un déploiement maîtrisé, respectueux du secret professionnel et conforme au RGPD comme à l'AI Act, avec une vérification humaine systématique des productions de l'outil.
`,
    sources: [
      "https://cnb.avocat.fr/actualite/le-cnb-adopte-un-guide-sur-la-deontologie-et-l-intelligence-artificielle",
      "https://www.csn.notaires.fr/fr/rapport-annuel-du-notariat",
      "https://www.cnil.fr/fr/ia-et-rgpd-la-cnil-publie-ses-nouvelles-recommandations-pour-accompagner-une-innovation-responsable",
      "https://www.cnil.fr/fr/entree-en-vigueur-du-reglement-europeen-sur-lia-les-premieres-questions-reponses-de-la-cnil",
      "https://commissaire-justice.fr/profession-commissaire-de-justice/la-profession-en-chiffres/",
    ],
    lastReviewedOn: "2026-06-23",
    reviewedBy: "claude-opus-4-8",
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 4. Communication & médias
  // ─────────────────────────────────────────────────────────────────────────
  {
    slug: "secteur-brief-communication-medias",
    sectorTagSlugs: ["communication-medias"],
    type: "secteur_brief",
    domain: "editorial",
    audience: "public",
    titleFr: "Communication & médias : l'IA pour agences, médias et RP en France",
    titleEn: "[EN] Communication & media: AI for agencies, media and PR in France",
    summaryFr:
      "Panorama de l'adoption de l'IA dans les agences de publicité, médias audiovisuels, RP et marketing B2B en France : usages en production, contraintes réglementaires (AI Act, RGPD, droit d'auteur, déontologie ARPP) et opportunités.",
    bodyMarkdownFr: `
## Panorama du marché

Le secteur de la communication et des médias regroupe en France des acteurs hétérogènes : agences de publicité et de communication, médias audiovisuels et éditeurs de presse, agences de relations publiques (RP) et structures de marketing B2B. Tous partagent une chaîne de valeur centrée sur la production de contenus, la diffusion et la mesure d'audience. L'intelligence artificielle générative y est rapidement devenue un sujet structurant, parce qu'elle touche directement le cœur de métier : la création d'assets, le ciblage et l'analyse de performance.

L'enjeu pour ces organisations n'est pas seulement productiviste. Il est aussi réglementaire et déontologique, car la profession est encadrée par des règles spécifiques d'identification de la publicité et de loyauté de la communication. L'adoption de l'IA s'y inscrit donc dans un environnement où la transparence vis-à-vis du public est une obligation, pas une option.

## Usages IA déployés en production

Plusieurs usages sont aujourd'hui réalistes et observables chez les agences et médias français :

- **Génération de contenus et d'assets** : rédaction de variantes de messages publicitaires, déclinaisons de visuels, storyboards, sous-titrage et habillage audiovisuel. Ces sorties accélèrent la production mais relèvent des obligations de marquage des contenus générés.
- **Personnalisation et ciblage** : segmentation d'audiences et adaptation des messages selon les profils, sur la base de données comportementales — usage directement soumis au RGPD.
- **Media planning** : optimisation de l'allocation budgétaire entre canaux et prévision de performance à partir de l'historique de campagnes.
- **Veille et social listening** : détection de tendances, analyse de sentiment et suivi de réputation pour les missions RP.
- **Traduction et localisation** : adaptation multilingue de campagnes et de contenus éditoriaux, avec relecture humaine pour les contenus informatifs destinés au public.

L'IA est ici un outil d'augmentation des équipes créatives et analytiques, et non un substitut au jugement éditorial, qui reste central pour la qualité et la conformité.

## Contraintes réglementaires spécifiques

Quatre cadres se superposent et doivent être traités conjointement.

**AI Act — transparence (article 50).** Le règlement européen sur l'IA impose, à compter du 2 août 2026, des obligations de transparence : les contenus de synthèse (audio, image, vidéo, texte) doivent être marqués comme générés ou manipulés artificiellement dans un format lisible par machine ; les deepfakes doivent être signalés de manière claire et distincte, sauf œuvres manifestement artistiques, satiriques ou fictionnelles ; les textes générés destinés à informer le public doivent être divulgués sauf relecture éditoriale humaine. Ces obligations concernent au premier chef les agences et médias produisant des contenus de synthèse.

**Droit d'auteur et IA générative.** Le Conseil supérieur de la propriété littéraire et artistique (CSPLA) a conclu, dans son rapport de mission, que le droit d'auteur européen s'applique à l'entraînement et au déploiement des modèles d'IA commercialisés dans l'Union, indépendamment de la localisation des serveurs. Les agences doivent donc s'interroger sur les droits attachés aux données d'entraînement et aux contenus produits.

**RGPD — ciblage publicitaire.** La CNIL a publié des recommandations encadrant l'usage de l'IA au regard du RGPD : information des personnes, exercice des droits, choix d'une base légale pour la segmentation et le profilage. Le ciblage publicitaire reposant sur des données personnelles doit reposer sur une base juridique adaptée.

**Déontologie ARPP.** La Recommandation « Communication publicitaire numérique » de l'ARPP exige que la publicité soit clairement identifiable comme telle et que la communication soit loyale, honnête et véridique — principes qui s'appliquent intégralement aux contenus assistés ou générés par IA.

## Opportunités identifiées

L'IA bien encadrée permet aux acteurs du secteur de raccourcir les cycles de production créative, de tester davantage de variantes à budget constant et d'objectiver le media planning. Pour les agences RP, la veille automatisée renforce la réactivité. La valeur réelle se situe toutefois dans une mise en conformité dès la conception : marquage des contenus de synthèse, traçabilité des sources d'entraînement, base légale du ciblage et identification claire de la publicité. Un audit préalable des usages permet d'identifier les cas où l'IA crée de la valeur sans exposer l'organisation à un risque réglementaire ou réputationnel.
`,
    sources: [
      "https://artificialintelligenceact.eu/article/50/",
      "https://www.cnil.fr/fr/ia-et-rgpd-la-cnil-publie-ses-nouvelles-recommandations-pour-accompagner-une-innovation-responsable",
      "https://www.arpp.org/nous-consulter/regles/regles-de-deontologie/recommandation-communication-publicitaire-numerique/",
      "https://www.culture.gouv.fr/nous-connaitre/organisation-du-ministere/Conseil-superieur-de-la-propriete-litteraire-et-artistique-CSPLA/travaux-et-publications-du-cspla/missions-du-cspla/publication-du-rapport-de-mission-sur-la-loi-applicable-aux-modeles-d-ia-generative-commercialises-dans-l-union-europeenne",
    ],
    lastReviewedOn: "2026-06-23",
    reviewedBy: "claude-opus-4-8",
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 5. Automobile & mobilité
  // ─────────────────────────────────────────────────────────────────────────
  {
    slug: "secteur-brief-automobile-mobilite",
    sectorTagSlugs: ["automobile-mobilite"],
    type: "secteur_brief",
    domain: "editorial",
    audience: "public",
    titleFr: "Automobile & mobilité : panorama IA et conformité",
    titleEn: "[EN] Automotive & mobility: AI landscape and compliance",
    summaryFr:
      "Brief sectoriel sur l'IA dans l'automobile et la mobilité en France : panorama de la filière, usages en production, cadre réglementaire (AI Act, homologation ADAS, RGPD véhicules connectés) et opportunités pour constructeurs, équipementiers et sous-traitants.",
    bodyMarkdownFr: `
## Panorama du marché

La filière automobile française représente un secteur industriel structurant. Selon l'Insee, environ 4 000 sociétés travaillent directement pour la filière, employant 329 000 salariés, soit 1,6 % de l'emploi salarié privé et 1,1 % du PIB français, pour une valeur ajoutée de 31,2 milliards d'euros. La construction automobile concentre environ un quart de ces 329 000 salariés.

En intégrant l'aval (distribution, maintenance, recyclage, services de mobilité), la Direction générale des Entreprises décrit un écosystème plus large, comprenant l'amont industriel (constructeurs, équipementiers, sous-traitants) et l'aval des services. La filière investit fortement en R&D et figure parmi les premiers déposants de brevets en France.

Le secteur traverse trois ruptures simultanées identifiées par le Comité stratégique de filière : la transition technologique (motorisation électrique, évolution du mix énergétique), la transition numérique (véhicule connecté, intelligent, autonome) et la transition sociétale (nouveaux usages de mobilité, évolution du rapport à la possession). L'intelligence artificielle se positionne au croisement de ces ruptures, tant dans les processus industriels que dans le produit lui-même.

## Usages IA déployés en production

Plusieurs cas d'usage de l'IA sont opérationnels chez les constructeurs, équipementiers et sous-traitants :

- **Contrôle qualité par vision industrielle** : détection automatisée de défauts de surface, de soudure ou d'assemblage sur les lignes de production, complétant l'inspection humaine.
- **Maintenance prédictive** : analyse des données capteurs des machines et des chaînes pour anticiper les pannes et réduire les arrêts non planifiés.
- **Optimisation de la supply chain** : prévision de la demande, planification des approvisionnements et gestion des flux logistiques, dans un contexte de chaînes étendues et sensibles aux ruptures.
- **R&D et simulation** : usage de modèles pour accélérer la conception, les essais virtuels et l'optimisation de pièces.
- **Systèmes d'aide à la conduite (ADAS)** : briques de perception et de décision embarquées, qui relèvent à la fois du produit et d'exigences de sécurité réglementées.

Ces usages s'inscrivent dans une logique d'industrialisation progressive : preuve de concept, validation sur un périmètre restreint, puis déploiement contrôlé.

## Contraintes réglementaires spécifiques

L'automobile cumule plusieurs cadres exigeants qui structurent tout projet IA.

**AI Act** : le règlement européen sur l'intelligence artificielle est entré en vigueur le 1er août 2024, avec une application progressive. L'interdiction des systèmes à risque inacceptable s'applique depuis le 2 février 2025, et l'application complète aux systèmes à haut risque déjà identifiés est prévue au 2 août 2026 (notamment infrastructures critiques, emploi, biométrie). Les systèmes IA intégrés à des produits soumis à homologation peuvent relever de catégories à risque élevé, avec obligations de gestion des risques, de documentation et de surveillance humaine.

**Homologation et sécurité (ADAS)** : la mise sur le marché des fonctions d'aide à la conduite s'inscrit dans le cadre d'homologation européen et des règlements ONU élaborés au sein du WP.29 de l'UNECE, qui définissent des prescriptions de sécurité minimales. Tout système de perception ou de décision embarqué doit être validé selon ces exigences.

**RGPD et données des véhicules connectés** : la CNIL a publié un pack de conformité « véhicules connectés et données personnelles ». Les données rattachables à une personne identifiable (trajets, kilométrage, style de conduite, état des composants) sont des données personnelles. La CNIL distingue trois scénarios de traitement et recommande de privilégier le traitement local dans le véhicule, qui offre de meilleures garanties et des obligations allégées.

## Opportunités identifiées

Les marges de progression sont concrètes pour les acteurs de la filière :

- **Industrialiser les preuves de concept** : passer de pilotes isolés à des déploiements maîtrisés en qualité et maintenance, avec mesure de la valeur.
- **Sécuriser la conformité dès la conception** : intégrer AI Act, exigences d'homologation et RGPD en amont (privacy et safety by design) pour éviter les blocages tardifs.
- **Accompagner l'électrification et la décarbonation** : l'IA peut soutenir l'optimisation énergétique des process et la transformation industrielle liée au véhicule électrique.
- **Renforcer les sous-traitants** : les PME et ETI de la sous-traitance peuvent gagner en compétitivité via le contrôle qualité automatisé et la maintenance prédictive, à condition d'un cadrage adapté à leurs moyens.

Un accompagnement structuré (audit des cas d'usage, cadrage réglementaire, feuille de route) permet de prioriser les chantiers à fort retour et de maîtriser les risques propres au secteur.
`,
    sources: [
      "https://www.insee.fr/fr/statistiques/8676117",
      "https://www.entreprises.gouv.fr/secteurs-dactivite/industrie/les-comites-strategiques-de-filiere/la-filiere-automobile",
      "https://www.entreprises.gouv.fr/decryptages-de-nos-experts/le-reglement-europeen-sur-lintelligence-artificielle-publics-concernes",
      "https://www.cnil.fr/fr/vehicules-connectes-un-pack-de-conformite-pour-une-utilisation-responsable-des-donnees",
      "https://www.cnil.fr/sites/default/files/atoms/files/pack_vehicules_connectes_web.pdf",
    ],
    lastReviewedOn: "2026-06-23",
    reviewedBy: "claude-opus-4-8",
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 6. Construction & BTP
  // ─────────────────────────────────────────────────────────────────────────
  {
    slug: "secteur-brief-construction-btp",
    sectorTagSlugs: ["construction-btp"],
    type: "secteur_brief",
    domain: "editorial",
    audience: "public",
    titleFr: "Construction & BTP : IA, audit et conformité pour le secteur",
    titleEn: "[EN] Construction & BTP sector brief",
    summaryFr:
      "Panorama du secteur français de la construction et des travaux publics, des cas d'usage IA déployés en production et des contraintes réglementaires (RE2020, AI Act, RGPD) qui encadrent leur adoption.",
    bodyMarkdownFr: `
## Panorama du marché

Le bâtiment et les travaux publics constituent l'un des plus grands secteurs économiques français. Selon la Fédération française du bâtiment (FFB), le bâtiment regroupait en 2024 environ 440 000 entreprises au chiffre d'affaires positif, dont près de 94 % de taille artisanale, et mobilisait 1,749 million d'actifs (1,258 million de salariés, 95 000 intérimaires en équivalent temps plein et 396 000 non-salariés). Le chiffre d'affaires du bâtiment s'établissait à environ 208 milliards d'euros hors taxes, en recul de 3,9 % en valeur sur un an. La rénovation et l'entretien représentent une part majeure de l'activité, dont une fraction significative consacrée à la rénovation énergétique.

Les travaux publics (génie civil, routes, réseaux, ouvrages d'art) constituent une filière distincte, suivie par la Fédération nationale des travaux publics (FNTP). Le secteur est marqué par une forte sensibilité à la commande publique, aux cycles électoraux locaux et aux contraintes budgétaires des collectivités.

Le secteur reste hétérogène : une majorité de TPE et PME artisanales coexiste avec de grands groupes de construction et d'ingénierie. Cette structure conditionne directement la maturité numérique et la capacité à investir dans des outils d'intelligence artificielle.

## Usages IA déployés en production

Plusieurs usages de l'IA sortent aujourd'hui de la phase d'expérimentation et s'industrialisent, souvent couplés à la maquette numérique (BIM, Building Information Modeling). Le Centre scientifique et technique du bâtiment (CSTB) identifie notamment :

- **BIM augmenté et conception** : l'IA exploite les données des maquettes numériques pour simuler des scénarios de construction, optimiser la conception et fiabiliser les estimations.
- **Planification et chiffrage** : aide à l'estimation des coûts et des délais à partir de données historiques de projets comparables.
- **Détection de défauts et sécurité par vision** : analyse d'images de chantier (caméras, drones) pour repérer non-conformités, désordres ou situations à risque pour la sécurité des compagnons.
- **Maintenance prédictive d'ouvrages** : exploitation de capteurs et de données temps réel pour anticiper les pannes et planifier l'entretien des bâtiments et infrastructures.
- **Optimisation énergétique** : pilotage continu de la performance énergétique des bâtiments en exploitation, en cohérence avec les objectifs de sobriété.
- **Aide au choix des matériaux** : recommandation de matériaux selon des critères de durabilité et d'impact environnemental.

Ces usages visent un objectif commun : réduire les coûts, raccourcir les délais et limiter l'impact environnemental des projets.

## Contraintes réglementaires spécifiques

La construction est un secteur fortement normé, ce qui structure tout projet IA :

- **RE2020 (réglementation environnementale)** : applicable aux constructions neuves, elle introduit pour la première fois la performance environnementale via l'analyse en cycle de vie, intégrant les émissions de carbone de la phase de construction et pas seulement de l'exploitation. Les outils d'IA d'estimation carbone ou d'optimisation énergétique doivent produire des résultats traçables et cohérents avec ce cadre.
- **Normes de sécurité et de qualité de la construction** : règles de l'art, contrôle technique, responsabilité décennale. Une IA d'aide à la décision ne se substitue pas à la responsabilité des intervenants et doit rester auditable.
- **AI Act (règlement européen sur l'IA)** : premier cadre général sur l'IA, fondé sur une approche par niveaux de risque. Les systèmes utilisés pour la sécurité au travail ou le tri de candidatures peuvent relever de catégories à exigences renforcées (transparence, gouvernance, documentation).
- **RGPD** : les usages de vision sur chantier (caméras, reconnaissance de situations) impliquant des personnes identifiables relèvent de la protection des données et requièrent base légale, minimisation et information des salariés.

## Opportunités identifiées

Pour un cabinet d'audit et de conseil, les opportunités se concentrent sur des cas d'usage à fort retour : fiabilisation du chiffrage et de la planification, réduction de la sinistralité par la détection visuelle de risques, et optimisation énergétique en lien avec la RE2020. La structure du tissu (majorité de TPE/PME) appelle des solutions sobres, intégrables aux outils métiers existants, et un accompagnement progressif. Un audit préalable permet d'identifier les usages réellement matures, d'écarter les promesses non étayées et de sécuriser la conformité (AI Act, RGPD) avant tout déploiement.
`,
    sources: [
      "https://www.ffbatiment.fr/le-batiment-en-chiffres",
      "https://www.fntp.fr/les-travaux-publics-en-chiffres/",
      "https://www.ecologie.gouv.fr/politiques-publiques/reglementation-environnementale-re2020",
      "https://www.cstb.fr/toutes-les-actualites/avenir-construction-avec-ia",
      "https://artificialintelligenceact.eu/fr/",
    ],
    lastReviewedOn: "2026-06-23",
    reviewedBy: "claude-opus-4-8",
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 7. Énergie & cleantech
  // ─────────────────────────────────────────────────────────────────────────
  {
    slug: "secteur-brief-energie-cleantech",
    sectorTagSlugs: ["energie-cleantech"],
    type: "secteur_brief",
    domain: "editorial",
    audience: "public",
    titleFr: "Énergie & cleantech : panorama IA, régulation et cas d'usage",
    titleEn: "[EN] Energy & cleantech: AI, regulation and use cases brief",
    summaryFr:
      "Repères factuels pour les acteurs français de l'énergie et des cleantech : structure de la production électrique, usages IA déployés en production, cadres réglementaires (CRE, sûreté nucléaire, AI Act, NIS2) et opportunités d'optimisation.",
    bodyMarkdownFr: `
## Panorama du marché

En 2024, la production d'électricité française a atteint 539 TWh, son plus haut niveau depuis cinq ans selon le bilan électrique de RTE. Le nucléaire en représente la part dominante avec 361,7 TWh (environ 67 % de la production), tandis que les énergies renouvelables ont établi un record à 150 TWh, soit près de 28 % de la production. Cette part renouvelable combine une production hydraulique exceptionnelle (75,1 TWh, au plus haut depuis 2013) et la croissance soutenue de l'éolien et du solaire (71,6 TWh cumulés en 2024).

Le secteur regroupe des filières aux modèles très différents : producteurs renouvelables (éolien terrestre et en mer, photovoltaïque), exploitants nucléaires, gestionnaires de réseaux, fournisseurs et agrégateurs, ainsi qu'un écosystème cleantech autour de l'efficacité énergétique, du stockage et de l'hydrogène. Côté marché de détail, la Commission de régulation de l'énergie (CRE) observe une dynamique concurrentielle croissante, marquée en 2025 par une variabilité accrue des prix, notamment infrajournaliers. Cette volatilité accentue la valeur des outils d'aide à la décision sur la production, la consommation et le négoce.

## Usages IA déployés en production

Plusieurs cas d'usage de l'IA sont opérationnels chez les acteurs français de l'énergie :

- **Prévision de production renouvelable** : modèles de prévision météo et de rendement pour anticiper la production éolienne et solaire à différents horizons, indispensables face à l'intermittence.
- **Équilibrage du réseau et smart grids** : optimisation de l'injection, de l'effacement et du stockage pour maintenir l'équilibre offre-demande sur un système de plus en plus décentralisé.
- **Maintenance prédictive d'actifs** : détection précoce de défaillances sur turbines, transformateurs, panneaux et autres équipements critiques, à partir de données capteurs.
- **Optimisation de l'efficacité énergétique** : pilotage fin de la consommation des bâtiments et sites industriels, réduction des pertes.
- **Aide au négoce d'énergie (trading)** : analyse de marché et appui à la décision dans un contexte de prix volatils.

Pour une TPE/PME du secteur — installateur, bureau d'études, exploitant de petits actifs — ces usages se traduisent surtout par de la prévision, de la maintenance et du pilotage de consommation. Les PME disposant de parcs d'actifs plus étendus visent en complément l'équilibrage et l'optimisation portefeuille ; les ETI et grands comptes restent marginaux en volume mais structurants par leurs exigences.

## Contraintes réglementaires spécifiques

Le secteur énergie est l'un des plus encadrés, ce qui conditionne tout projet IA :

- **Régulation du marché de l'énergie** : la CRE est l'autorité indépendante garantissant le bon fonctionnement des marchés français de l'énergie. Les usages liés au négoce et à la facturation doivent respecter les règles de marché applicables.
- **Sûreté nucléaire** : tout usage IA touchant des installations nucléaires relève du contrôle de l'Autorité de sûreté nucléaire et de radioprotection et de l'expertise de l'IRSN ; les exigences de démonstration de sûreté y sont particulièrement strictes.
- **AI Act (règlement UE 2024/1689)** : entré en vigueur le 1er août 2024, il classe en haut risque les systèmes d'IA utilisés comme composants de sécurité dans la gestion et l'exploitation des infrastructures critiques, dont l'approvisionnement en électricité et en gaz. Ces obligations (gestion des risques, supervision humaine, documentation) s'appliquent pleinement à compter du 2 août 2026.
- **Cybersécurité des infrastructures critiques (NIS2)** : la directive (UE) 2022/2555, en cours de transposition en France via le projet de loi « Résilience », renforce les obligations de cybersécurité des opérateurs essentiels, sous le contrôle de l'ANSSI.

## Opportunités identifiées

La conjonction d'une production électrique au plus haut, d'une part renouvelable record et d'une volatilité des prix accrue crée un terrain favorable aux projets IA à valeur mesurable : meilleure prévision de production, réduction des coûts de maintenance, optimisation de la consommation et arbitrage de marché. L'enjeu, pour les acteurs français, est de déployer ces usages dans un cadre conforme (AI Act, NIS2, et selon les cas régulation CRE ou sûreté nucléaire), avec une gouvernance des données et une supervision humaine documentées. Une démarche d'audit préalable permet d'identifier les cas d'usage à fort retour sur investissement tout en sécurisant la conformité réglementaire dès la conception.
`,
    sources: [
      "https://analysesetdonnees.rte-france.com/bilan-electrique-2024/production",
      "https://www.cre.fr/electricite/marche-de-detail-de-lelectricite/presentation.html",
      "https://www.entreprises.gouv.fr/decryptages-de-nos-experts/le-reglement-europeen-sur-lintelligence-artificielle-publics-concernes",
      "https://cyber.gouv.fr/reglementation/cybersecurite-systemes-dinformation/directives-nis-nis2-et-dispositif-saiv/directive-nis-2/",
      "https://www.cre.fr/actualites/toute-lactualite/la-cre-publie-son-observatoire-des-marches-de-detail-de-lenergie-du-quatrieme-trimestre-2025.html",
    ],
    lastReviewedOn: "2026-06-23",
    reviewedBy: "claude-opus-4-8",
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 8. Maritime & portuaire
  // ─────────────────────────────────────────────────────────────────────────
  {
    slug: "secteur-brief-maritime-portuaire",
    sectorTagSlugs: ["maritime-portuaire"],
    type: "secteur_brief",
    domain: "editorial",
    audience: "public",
    titleFr: "Maritime & portuaire : IA, décarbonation et conformité en France",
    titleEn: "[EN] Maritime & ports sector brief",
    summaryFr:
      "Panorama de l'économie maritime et portuaire française, des usages d'IA déployés en production et des cadres réglementaires (OMI, AI Act, NIS2) qui structurent les projets d'intelligence artificielle du secteur.",
    bodyMarkdownFr: `
## Panorama du marché

L'économie maritime française est un ensemble d'activités diversifiées : transport maritime, construction et réparation navale, économie portuaire, pêche professionnelle et tourisme littoral. Selon le service statistique du ministère de la Transition écologique (SDES), l'économie maritime représentait en 2019 environ 1,5 % du PIB national, 43,3 milliards d'euros de valeur ajoutée et près de 525 000 emplois, soit 1,7 % de l'emploi total. Le tourisme littoral concentre la part la plus importante de la valeur ajoutée, devant le transport, la construction navale et les produits de la mer.

Le Cluster Maritime Français, créé en 2006, fédère l'ensemble des acteurs de la filière (industriels, ports, collectivités, recherche et formation) et rappelle que l'essentiel des biens échangés dans le monde transite par voie maritime. Côté infrastructures, HAROPA PORT (Le Havre, Rouen, Paris) constitue le premier ensemble portuaire français : il a déclaré un trafic maritime de l'ordre de 84,7 millions de tonnes et une activité conteneurs proche de 3,2 millions d'EVP. Aux côtés de Marseille-Fos et de Dunkerque, ces grands ports maritimes structurent les chaînes logistiques nationales.

## Usages IA déployés en production

Les acteurs maritimes et portuaires mobilisent l'intelligence artificielle sur plusieurs cas d'usage opérationnels, sans rupture avec leurs métiers existants :

- **Optimisation des routes et de la consommation de carburant** : l'analyse des données météo-océaniques, du chargement et des courants permet d'ajuster vitesse et trajectoire (weather routing) pour réduire la consommation et les émissions.
- **Maintenance prédictive des navires** : la surveillance des moteurs et équipements (capteurs, historiques de pannes) anticipe les défaillances et planifie les interventions à quai.
- **Gestion de terminal portuaire** : ordonnancement des escales, allocation des postes à quai et des engins de manutention, optimisation des flux camions/trains pour fluidifier les terminaux.
- **Prévision de trafic et d'escales** : estimation des heures d'arrivée (ETA) et anticipation des pics d'activité pour mieux dimensionner les ressources.
- **Vision par ordinateur pour l'inspection** : détection d'anomalies sur coques, conteneurs ou infrastructures à partir d'images et de captations vidéo.

Ces usages reposent sur des données déjà collectées par les armateurs, gestionnaires de terminaux et autorités portuaires : leur valorisation est un levier d'efficacité plutôt qu'un changement de modèle.

## Contraintes réglementaires spécifiques

Trois cadres principaux encadrent les projets numériques et IA du secteur :

- **OMI / IMO (décarbonation)** : la stratégie 2023 de l'Organisation maritime internationale vise des émissions nettes de gaz à effet de serre nulles vers 2050, avec des points de contrôle indicatifs en 2030 (réduction d'au moins 20 %, en visant 30 %, par rapport à 2008) et 2040 (au moins 70 %, en visant 80 %). Les outils d'optimisation de consommation s'inscrivent directement dans cette trajectoire.
- **AI Act (UE)** : le règlement européen sur l'intelligence artificielle classe les systèmes selon quatre niveaux de risque. Certains usages liés aux infrastructures critiques ou à la biométrie peuvent relever du « haut risque », avec des obligations de documentation, de supervision humaine et de traçabilité. Le calendrier d'application est échelonné et les manquements peuvent être lourdement sanctionnés.
- **NIS2 (cybersécurité portuaire)** : la directive NIS2 renforce les exigences de cybersécurité pour les entités essentielles, dont les infrastructures de transport et portuaires. Tout déploiement IA connecté aux systèmes opérationnels d'un port doit intégrer ces obligations de sécurité et de gestion des risques.

## Opportunités identifiées

La pression réglementaire et la recherche d'efficacité convergent : les projets IA les plus défendables sont ceux qui réduisent la consommation de carburant, fiabilisent la maintenance et fluidifient les terminaux, tout en respectant les exigences de l'AI Act et de NIS2. Pour les TPE et PME du secteur (services portuaires, sous-traitants navals, logistique), une démarche d'audit permet d'identifier les données disponibles, de prioriser un cas d'usage à fort retour et de cadrer la conformité dès la conception. Un déploiement progressif, ancré dans les processus existants, limite le risque et accélère la valeur. L'accompagnement consiste à relier ces enjeux métier aux cadres OMI, AI Act et NIS2 sans surdimensionner les projets.
`,
    sources: [
      "https://www.statistiques.developpement-durable.gouv.fr/edition-numerique/chiffres-cles-mer-littoral/9-economie-maritime",
      "https://www.cluster-maritime.fr/les-secteurs/",
      "https://www.haropaport.com/fr",
      "https://www.imo.org/fr/ourwork/environment/pages/2023-imo-strategy-on-reduction-of-ghg-emissions-from-ships.aspx",
      "https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai",
    ],
    lastReviewedOn: "2026-06-23",
    reviewedBy: "claude-opus-4-8",
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 9. Agriculture & élevage
  // ─────────────────────────────────────────────────────────────────────────
  {
    slug: "secteur-brief-agriculture-elevage",
    sectorTagSlugs: ["agriculture-elevage"],
    type: "secteur_brief",
    domain: "editorial",
    audience: "public",
    titleFr: "Agriculture & élevage : panorama IA pour exploitations et coopératives",
    titleEn: "[EN] Agriculture & livestock: AI sector brief",
    summaryFr:
      "Panorama de l'intelligence artificielle dans l'agriculture et l'élevage en France : marché, usages déployés en production, contraintes réglementaires (PAC, traçabilité, AI Act, données) et opportunités pour exploitations, coopératives et agro-équipementiers.",
    bodyMarkdownFr: `
## Panorama du marché

L'agriculture française demeure la première puissance agricole de l'Union européenne, avec environ 17 % de la production de l'UE et une production agricole évaluée à 89,3 milliards d'euros en 2024 (hors subventions). Le tissu productif repose sur un grand nombre d'exploitations : 416 346 exploitations étaient en activité en 2020 sur le territoire national (métropole et départements d'outre-mer), majoritairement de petite et moyenne taille. Ce secteur recouvre des réalités hétérogènes — grandes cultures, viticulture, arboriculture, maraîchage, élevage bovin, ovin, porcin et avicole — ainsi qu'un réseau dense de coopératives et d'agro-équipementiers.

Pour les TPE et PME agricoles (exploitations familiales, jeunes installés) comme pour les structures plus importantes (coopératives, ETI agro-équipement), la pression économique, la volatilité des marchés, la transition agroécologique et les contraintes de main-d'œuvre poussent à rechercher des gains de productivité et de précision. Dans ce contexte, l'intelligence artificielle est présentée par les pouvoirs publics comme un levier au service de la souveraineté alimentaire et de la compétitivité de la « ferme France ».

## Usages IA déployés en production

Plusieurs familles d'usages atteignent une maturité opérationnelle :

- **Agriculture de précision** : ajustement des apports (semis, fertilisation, irrigation, produits phytosanitaires) à la parcelle, voire à la plante, à partir de données de capteurs, de mesures biologiques et d'imagerie.
- **Télédétection et imagerie satellite ou drone** : suivi de l'état des cultures, cartographie des hétérogénéités intra-parcellaires et aide à la décision agronomique.
- **Détection de maladies et de ravageurs** : analyse d'images pour identifier précocement stress hydrique, carences, adventices et pathogènes.
- **Robotique de plein champ** : l'INRAE a développé, avec le projet ADAP2E, des robots coopératifs combinant capteurs (GPS, laser, caméras) et comportements algorithmiques pour des tâches comme le désherbage mécanique ou la gestion de la pulvérisation, sous supervision de l'agriculteur.
- **Monitoring de la santé du troupeau** : suivi individualisé des animaux (comportement, alimentation, signaux sanitaires) pour anticiper les troubles.
- **Optimisation des intrants et prévision de rendement** : modèles d'aide à la décision exploitant données météo, agronomiques et historiques.

Le ministère de l'Agriculture (rapport CGAAER, décembre 2025) souligne que ces usages couvrent l'optimisation des pratiques culturales et d'élevage, l'automatisation de tâches et l'amélioration de la traçabilité et de la gestion des filières.

## Contraintes réglementaires spécifiques

Tout projet IA agricole s'inscrit dans plusieurs cadres :

- **Politique agricole commune (PAC)** : la PAC soutient financièrement les exploitations et conditionne les aides au respect de normes environnementales et de sécurité alimentaire. Les outils numériques d'aide à la décision doivent rester compatibles avec ces exigences de conditionnalité et de déclaration.
- **Traçabilité et sécurité sanitaire** : les filières animales et végétales sont soumises à des obligations de traçabilité ; les systèmes IA mobilisés (identification, suivi sanitaire) doivent préserver la fiabilité et l'auditabilité des données.
- **Bien-être animal** : le monitoring du troupeau s'exerce dans le respect des exigences de bien-être animal, l'IA venant en appui de la décision humaine et non en substitution.
- **AI Act (règlement UE 2024/1689)** : entré en vigueur le 1er août 2024, il impose une approche par les risques. Les systèmes classés « haut risque » (impact sur la santé, la sécurité ou les droits fondamentaux) sont soumis à des obligations de documentation technique, de gouvernance des données, de supervision humaine et de surveillance ; l'application complète à ces systèmes est prévue au 2 août 2026.
- **Souveraineté et gouvernance des données agricoles** : les pouvoirs publics insistent sur l'importance d'un accès à des données fiables et adaptées aux réalités françaises, pour éviter une dépendance à des solutions importées peu adaptées et garantir la protection des données des exploitants (RGPD).

## Opportunités identifiées

Les opportunités sont concrètes pour les TPE et PME agricoles d'abord, puis les coopératives, et en complément les ETI agro-équipement : réduction et optimisation des intrants, amélioration des rendements et de la qualité, allègement de la charge administrative et réglementaire, et anticipation des risques sanitaires et climatiques. Le rôle d'un cabinet de conseil consiste à qualifier les cas d'usage réellement matures, à sécuriser la conformité (PAC, traçabilité, AI Act, RGPD), à structurer la gouvernance des données et à dimensionner des déploiements proportionnés aux moyens de l'exploitation, en gardant l'humain au centre de la décision.
`,
    sources: [
      "https://agriculture.gouv.fr/pac-politique-agricole-commune",
      "https://agriculture.gouv.fr/lintelligence-artificielle-au-service-de-lagriculture-et-de-lagroalimentaire",
      "https://chambres-agriculture.fr/actualites/actualite/les-chiffres-cles-2024-de-lagriculture-francaise",
      "https://www.inrae.fr/actualites/cooperation-intelligence-artificielle-atouts-du-robot-efficace-plein-champ",
      "https://www.entreprises.gouv.fr/decryptages-de-nos-experts/le-reglement-europeen-sur-lintelligence-artificielle-publics-concernes",
    ],
    lastReviewedOn: "2026-06-23",
    reviewedBy: "claude-opus-4-8",
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 10. Tourisme d'affaires & MICE
  // ─────────────────────────────────────────────────────────────────────────
  {
    slug: "secteur-brief-tourisme-affaires",
    sectorTagSlugs: ["tourisme-affaires"],
    type: "secteur_brief",
    domain: "editorial",
    audience: "public",
    titleFr: "Tourisme d'affaires & MICE : panorama IA pour les acteurs B2B",
    titleEn: "[EN] Business Tourism & MICE: AI Overview for B2B Players",
    summaryFr:
      "Repères factuels sur le marché français du tourisme d'affaires et du MICE (congrès, salons, événementiel professionnel, hôtellerie d'affaires) : poids économique, cas d'usage IA réellement déployés et contraintes réglementaires (RGPD, AI Act, accessibilité).",
    bodyMarkdownFr: `
## Panorama du marché

Le tourisme d'affaires et le MICE (Meetings, Incentives, Conferences, Exhibitions) regroupent l'hôtellerie d'affaires, les congrès, l'événementiel professionnel et les salons. Ils s'inscrivent dans une activité touristique française globalement record en 2024 : la France a accueilli 100 millions de visiteurs internationaux (+2 millions sur un an) pour 71 milliards d'euros de recettes internationales (+12 %), selon le bilan officiel publié par le ministère de l'Économie et Atout France.

La filière des foires, salons et congrès est structurante. D'après UNIMEV (Union française des métiers de l'événement), environ 1 200 foires et salons sont organisés chaque année en France ; le seul segment foires-expositions totalise près de 12 000 exposants, 3,2 millions de visiteurs et 2,3 millions de m² d'exposition. Le secteur s'appuie sur un parc d'infrastructures dense (parcs d'expositions, centres de congrès, arénas), particulièrement concentré en Île-de-France mais relayé en régions.

Côté TPE et PME, le tourisme d'affaires recouvre des structures variées : hôtels indépendants positionnés sur la clientèle corporate, agences événementielles, prestataires audiovisuels et logistiques, organisateurs de salons spécialisés. Ces acteurs partagent une saisonnalité marquée, une forte dépendance aux pics d'activité et une pression sur les marges qui rendent l'optimisation opérationnelle déterminante.

## Usages IA déployés en production

Plusieurs cas d'usage de l'intelligence artificielle sont aujourd'hui matures dans le secteur :

- **Revenue management et yield hôtelier** : prévision de la demande et ajustement dynamique des tarifs de chambres et d'espaces de réunion selon le calendrier des événements locaux.
- **Personnalisation du parcours participant** : recommandation de sessions, d'ateliers et de contacts à partir du profil déclaré et des centres d'intérêt, sur application mobile d'événement.
- **Matchmaking B2B en salon** : mise en relation automatisée exposants/visiteurs via algorithmes de scoring d'affinité, pour densifier les rendez-vous qualifiés.
- **Chatbots multilingues** : assistance aux participants (programme, accès, logistique) avant et pendant l'événement, en plusieurs langues.
- **Prévision de fréquentation** : anticipation des flux par créneau et par zone, utile au dimensionnement des équipes et de la restauration.
- **Optimisation logistique événementielle** : planification des installations, du nettoyage et de la sécurité, gestion des plans de salle et des files d'attente.

Ces usages reposent sur des données déjà collectées (inscriptions, scans de badge, interactions sur plateforme), ce qui en fait des chantiers à retour sur investissement rapide, à condition d'un cadrage rigoureux.

## Contraintes réglementaires spécifiques

Le traitement de données personnelles est central. Inscriptions, badges scannés, comportements de navigation et interactions de networking relèvent du **RGPD** : l'organisateur doit définir une finalité explicite, appliquer la minimisation des données, informer les personnes et sécuriser les traitements. La CNIL rappelle les six grands principes du règlement et la nécessité d'une base légale adaptée (consentement ou intérêt légitime selon les cas). Les manquements exposent à des sanctions pouvant atteindre 20 millions d'euros ou 4 % du chiffre d'affaires annuel mondial.

L'**AI Act** (règlement européen sur l'IA) introduit une classification par niveau de risque et des obligations de transparence ; certaines dispositions, notamment celles relatives à la transparence des systèmes d'IA, s'appliquent à compter d'août 2026. Les systèmes de personnalisation, de scoring de participants ou de chatbots doivent être documentés et, le cas échéant, signalés comme interactions avec une IA.

L'**accessibilité** numérique et physique des dispositifs (sites d'inscription, applications, signalétique) constitue une exigence transversale, à intégrer dès la conception des outils.

## Opportunités identifiées

Pour les TPE, PME et ETI du secteur, plusieurs leviers se dégagent. La structuration des données (CRM, plateforme événementielle, outils de billetterie) conditionne tout projet IA fiable ; un audit préalable permet d'éviter les usages non conformes. Les gains les plus accessibles concernent l'automatisation de la relation participant (chatbots, e-mails personnalisés), l'optimisation tarifaire pour l'hôtellerie d'affaires et l'amélioration du matchmaking sur salons. La mise en conformité RGPD et AI Act, loin d'être un frein, devient un argument commercial vis-à-vis de clients corporate sensibles à la protection des données. Une démarche progressive — cadrage, expérimentation sur un périmètre limité, puis industrialisation — limite le risque et préserve les budgets contraints du secteur.
`,
    sources: [
      "https://www.unimev.fr/tout-savoir-sur-le-secteur/bilans-etudes/",
      "https://www.atout-france.fr/fr/actualites/memento-portrait-de-lannee-touristique-2024",
      "https://presse.economie.gouv.fr/une-annee-2024-record-pour-le-tourisme-francais-grace-a-la-croissance-des-recettes-internationales-et-a-la-solidite-du-marche-domestique-qui-dessine-un-horizon-prometteur-pour-2025/",
      "https://www.cnil.fr/fr/reglement-europeen-protection-donnees",
      "https://artificialintelligenceact.eu/fr/",
    ],
    lastReviewedOn: "2026-06-23",
    reviewedBy: "claude-opus-4-8",
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 11. Arts, design & jeu vidéo
  // ─────────────────────────────────────────────────────────────────────────
  {
    slug: "secteur-brief-arts-creatif-design",
    sectorTagSlugs: ["arts-creatif-design"],
    type: "secteur_brief",
    domain: "editorial",
    audience: "public",
    titleFr: "Arts, design & jeu vidéo : panorama IA et cadre juridique",
    titleEn: "[EN] Arts, design & video games: AI overview and legal framework",
    summaryFr:
      "Repères factuels sur l'adoption de l'IA dans les studios design, agences créatives, animation et jeu vidéo en France : marché, usages en production, contraintes de droit d'auteur et d'AI Act, opportunités.",
    bodyMarkdownFr: `
## Panorama du marché

Le jeu vidéo est la première industrie culturelle française. Selon le Centre national du cinéma et de l'image animée (CNC), le marché français du jeu vidéo s'est établi à environ 5,68 milliards d'euros en 2024, en recul de 5,8 % après un pic historique proche de 6 milliards d'euros en 2023, tout en restant au-dessus de 5,5 milliards pour la cinquième année consécutive. Le CNC publie régulièrement des bilans et études sur le tissu économique du secteur.

Côté production, le Syndicat National du Jeu Vidéo (SNJV) publie chaque année un baromètre représentatif de la filière. L'édition 2024 fait état d'environ 420 titres français commercialisés et d'une majorité de productions indépendantes. Le baromètre documente aussi une dégradation de la santé financière des studios sur la période 2022-2024 et des tensions sur l'accès au financement.

Au-delà du jeu vidéo, le secteur « Arts, design & jeu vidéo » couvre les studios de design, agences créatives, studios d'animation et métiers d'art. Ces structures sont majoritairement des TPE et PME, dont le modèle repose sur la valeur ajoutée créative et la propriété intellectuelle.

## Usages IA déployés en production

Les outils d'IA générative et d'apprentissage automatique sont aujourd'hui intégrés à plusieurs étapes des chaînes de production créative :

- **Génération de concept art et d'assets** : exploration visuelle rapide, variations de styles, moodboards et déclinaisons de visuels en phase amont.
- **Prototypage et itération** : maquettes, storyboards et tests de direction artistique accélérés avant validation humaine.
- **Animation et rigging** : assistance au nettoyage de captation de mouvement, à l'interpolation et au rigging de personnages.
- **Jeu vidéo** : génération procédurale d'environnements, comportements de PNJ, outils d'assistance au dialogue et au game design.
- **Localisation** : pré-traduction de textes de jeu et de supports marketing, relue et validée par des linguistes professionnels.

Dans tous ces cas, l'IA intervient comme outil d'assistance : la validation, la direction artistique et la responsabilité finale restent humaines. C'est précisément ce caractère assisté qui détermine le statut juridique des contenus produits.

## Contraintes réglementaires spécifiques

Trois cadres structurent l'usage de l'IA dans les métiers créatifs en France et en Europe.

**Droit d'auteur et œuvres générées.** La protection par le droit d'auteur suppose une création originale portant l'empreinte de la personnalité de l'auteur. Le statut des contenus produits avec l'IA générative fait l'objet d'une mission dédiée du Conseil supérieur de la propriété littéraire et artistique (CSPLA), qui examine comment les critères de création, d'originalité et de paternité s'appliquent à ces contenus. Un studio doit donc documenter l'apport humain pour sécuriser ses droits.

**Données d'entraînement et droits des créateurs.** Le rapport CSPLA d'Alexandra Bensamoun (publié le 11 décembre 2024) porte sur l'obligation de transparence des données d'entraînement prévue par le règlement européen sur l'IA. Il propose un résumé détaillé, organisé par type de contenu, permettant aux titulaires de droits de vérifier le respect de leurs œuvres et des demandes d'exclusion (opt-out). Pour les créateurs, l'enjeu central est le respect de leurs œuvres dans les jeux de données et le partage de la valeur.

**AI Act et transparence des contenus générés.** L'article 50 du règlement européen sur l'intelligence artificielle impose des obligations de transparence : informer les utilisateurs d'une interaction avec une IA, et marquer dans un format lisible par machine les contenus de synthèse (images, audio, vidéo, deepfakes) ainsi que certains textes d'intérêt public. Ces obligations s'appliquent à compter du 2 août 2026. Les studios diffusant des contenus partiellement générés doivent anticiper ces exigences de marquage.

## Opportunités identifiées

L'enjeu n'est pas d'opposer IA et création, mais d'outiller les équipes tout en préservant la propriété intellectuelle et les droits des créateurs. Les leviers prioritaires :

- **Cartographier les usages** : identifier où l'IA fait gagner du temps (itération, localisation, nettoyage technique) sans diluer la signature artistique.
- **Sécuriser la chaîne de droits** : tracer l'apport humain, vérifier les conditions de licence des outils et de leurs données d'entraînement, encadrer les livrables clients.
- **Anticiper la conformité AI Act** : préparer le marquage des contenus générés et les mentions de transparence avant l'échéance réglementaire.
- **Préserver la valeur créative** : positionner l'IA comme un accélérateur de production, la direction artistique humaine restant le différenciateur commercial.

Un audit ciblé permet d'aligner gains de productivité, qualité créative et conformité juridique, adapté à la taille du studio et à ses contraintes de PI.
`,
    sources: [
      "https://www.cnc.fr/jeu-video",
      "https://snjv.org/",
      "https://artificialintelligenceact.eu/article/50/",
      "https://www.culture.gouv.fr/nous-connaitre/organisation-du-ministere/conseil-superieur-de-la-propriete-litteraire-et-artistique-cspla/travaux-et-publications-du-cspla/missions-du-cspla/ia-et-transparence-des-donnees-d-entrainement-publication-du-rapport-d-alexandra-bensamoun-sur-la-mise-en-aeuvre-du-reglement-europeen-etablissant",
      "https://www.culture.gouv.fr/nous-connaitre/organisation-du-ministere/conseil-superieur-de-la-propriete-litteraire-et-artistique-cspla/travaux-et-publications-du-cspla/missions-du-cspla/le-cspla-lance-une-mission-relative-a-la-protection-des-contenus-generes-avec-le-recours-a-l-ia-generative",
    ],
    lastReviewedOn: "2026-06-23",
    reviewedBy: "claude-opus-4-8",
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 12. Administration publique
  // ─────────────────────────────────────────────────────────────────────────
  {
    slug: "secteur-brief-administration-publique",
    sectorTagSlugs: ["administration-publique"],
    type: "secteur_brief",
    domain: "editorial",
    audience: "public",
    titleFr: "IA dans l'administration publique : usages, doctrine et conformité",
    titleEn: "[EN] AI in public administration: use cases, doctrine and compliance",
    summaryFr:
      "Panorama de l'IA dans l'administration publique française : usages déployés, contraintes réglementaires (AI Act, RGPD, transparence des décisions algorithmiques) et opportunités, dans le cadre de la doctrine d'usage de l'État.",
    bodyMarkdownFr: `
## Panorama du marché

L'administration publique française — collectivités territoriales, services de l'État, opérateurs et établissements publics — engage l'intelligence artificielle dans un cadre doctrinal structuré. La Direction interministérielle du numérique (DINUM), avec la DITP et la DGAFP, a publié un guide d'usage de l'IA pour les agents publics de l'État. Ce guide pose cinq principes directeurs : l'agent reste responsable de ses décisions, l'IA n'étant qu'un outil d'assistance ; le choix de l'outil dépend du type de données et privilégie les solutions autorisées ; l'usage de l'IA doit être transparent dès qu'elle contribue substantiellement à un contenu ou à une décision ; l'usage doit servir une utilité réelle dans le respect du droit, de l'éthique et de la sobriété ; la formation des agents est essentielle.

Cette doctrine s'appuie sur un corpus institutionnel : le Conseil d'État a posé sept principes pour les systèmes d'IA publics (primauté humaine, performance, équité, transparence, cybersécurité, soutenabilité, autonomie stratégique). Le Défenseur des droits, la Cour des comptes, le CESE et la commission sur l'IA ont complété ce cadre, en insistant sur la supervision humaine effective et la frugalité.

## Usages IA déployés en production

Plusieurs familles d'usages se déploient. La relation à l'usager mobilise des assistants conversationnels et des outils de réponse aux demandes. L'instruction de dossiers (aides, autorisations, demandes administratives) bénéficie d'outils d'aide à l'analyse documentaire et de pré-qualification. La détection de fraude et le ciblage des contrôles recourent au profilage statistique. L'optimisation des services (planification, traitement de masse de documents, synthèse) et l'analyse documentaire complètent ce panorama.

L'État met à disposition des briques mutualisées, opérées dans un cadre de confiance, afin d'éviter la dispersion des initiatives et de favoriser des solutions françaises et européennes répondant aux exigences de souveraineté et de protection des données des citoyens.

## Contraintes réglementaires spécifiques

Le secteur public concentre des usages classés à haut risque par le règlement européen sur l'IA (AI Act). L'annexe III, section 5, vise notamment les systèmes d'IA utilisés par les autorités publiques pour évaluer l'éligibilité de personnes physiques aux prestations et services d'aide publique essentiels, y compris en santé, et pour octroyer, réduire, révoquer ou récupérer ces prestations. Ces systèmes sont soumis à des obligations renforcées : gestion des risques, gouvernance des données, documentation et contrôle humain. L'essentiel des dispositions relatives aux systèmes à haut risque de l'annexe III s'applique à compter d'août 2026.

Le RGPD encadre les décisions individuelles automatisées (article 22) : une personne ne peut, en principe, faire l'objet d'une décision fondée exclusivement sur un traitement automatisé produisant des effets juridiques ou l'affectant de manière significative. Lorsque ces décisions sont admises, la personne dispose du droit d'obtenir une intervention humaine, d'exprimer son point de vue et de contester la décision.

S'ajoute le régime national de transparence des algorithmes publics, issu de la loi pour une République numérique (loi n° 2016-1321) et codifié dans le code des relations entre le public et l'administration (CRPA). Les administrations doivent informer de l'usage d'un traitement algorithmique fondant une décision individuelle (mention explicite), communiquer les règles le définissant à la demande de l'intéressé, et publier en ligne ces règles pour les organismes d'une certaine taille. Les codes sources sont, par principe, des documents administratifs communicables (article L. 300-2 du CRPA).

Enfin, les enjeux de sécurité (souveraineté, cloud de confiance, robustesse des systèmes) structurent les choix d'architecture, conformément aux orientations de l'État.

## Opportunités identifiées

Pour les administrations, l'IA offre des gains de productivité sur les tâches répétitives (traitement documentaire, synthèse, première réponse à l'usager) et une amélioration de la qualité de service. La condition de réussite tient à une gouvernance maîtrisée : cartographie des traitements, documentation de la logique décisionnelle, supervision humaine réelle et capable d'influer sur la décision, et information claire des usagers.

Un cabinet de conseil accompagne ces organisations sur l'audit de conformité (AI Act, RGPD, CRPA), la qualification du niveau de risque des cas d'usage, la conception de dispositifs de transparence et de redevabilité, et l'implémentation outillée respectueuse de la doctrine d'usage de l'État. L'enjeu central reste l'équilibre entre efficacité du service public et protection des droits : la décision finale relève de l'agent, l'IA n'étant qu'un outil d'aide.
`,
    sources: [
      "https://ia.numerique.gouv.fr/ressources/guide-dusage-de-lia/",
      "https://www.numerique.gouv.fr/offre-accompagnement/guide-usage-intelligence-artificielle/",
      "https://labo.societenumerique.gouv.fr/fr/articles/dossier-intelligence-artificielle-et-services-publics-quelle-doctrine-dusage/",
      "https://artificialintelligenceact.eu/annex/3/",
      "https://www.cnil.fr/fr/vos-droits-lintervention-humaine-face-votre-profilage-ou-une-decision-automatisee",
    ],
    lastReviewedOn: "2026-06-23",
    reviewedBy: "claude-opus-4-8",
  },
];
