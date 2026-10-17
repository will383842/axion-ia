// Simulateur de gains v2 — RÉFÉRENTIEL DES TÂCHES AUTOMATISABLES.
//
// C'est l'actif central du simulateur. Tout chiffre affiché dans le rapport se
// ramène à une ligne de ce fichier, ce qui rend le résultat opposable : un
// dirigeant sceptique peut demander « d'où sort ce chiffre ? » et obtenir une
// réponse en une phrase (`proofFr`).
//
// ── RÈGLE D'OR : UNE TÂCHE = UN ACTE DISTINCT ─────────────────────────────
// Deux tâches PEUVENT partager une même `volumeKey` (un devis est rédigé PUIS
// relancé : deux actes, deux lignes, un seul volume). Mais deux tâches ne
// doivent JAMAIS décrire le même acte, sinon le temps est compté deux fois et
// le rapport ment par surestimation. Pour nuancer une tâche selon le secteur,
// utiliser `sectorMinutesFactor` — surtout PAS une seconde tâche.
//
// ── RÈGLE DE CALIBRAGE DES `minutesPerUnit` ───────────────────────────────
// Le temps est AMORTI sur le volume déclaré. Exemple : toutes les factures ne
// sont pas relancées. Plutôt que d'inventer une question « combien de factures
// relancez-vous ? » (à laquelle personne ne sait répondre), la tâche de relance
// porte un temps unitaire amorti sur TOUTES les factures émises, et le
// `proofFr` explique l'amortissement. Le lecteur peut refaire le calcul.
//
// ── RÈGLE DE CALIBRAGE DES `automationRate` ───────────────────────────────
// Jamais 1. Il reste toujours la relecture, la décision et l'envoi. Un taux
// supérieur à 0,85 doit correspondre à un acte quasi mécanique. Un acte qui
// engage la responsabilité de l'entreprise ou demande un arbitrage humain
// plafonne à 0,5. Ce qui ne s'automatise pas du tout appartient à
// `non-automatable.ts` — pas ici avec un taux de 0.
//
// ⚠️ Ces valeurs sont des HYPOTHÈSES DE MODÈLE argumentées, pas les résultats
// d'une étude. Aucun `proofFr` ne doit affirmer « observé sur N entreprises »
// sans étude publiable derrière (art. L121-2 du Code de la consommation).

import type { AutomatableTask } from "./types";

export const AUTOMATABLE_TASKS: readonly AutomatableTask[] = [
  // ═══════════════════════════════════════════════════════════════════════
  // ADMINISTRATIF
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: "facture_emission",
    fn: "administratif",
    labelFr: "Établir et envoyer une facture",
    volumeKey: "factures_emises_mois",
    minutesPerUnit: 12,
    automationRate: 0.75,
    confidence: "haute",
    effort: 2,
    weeksToValue: 4,
    lever: "implementation",
    howFr:
      "La facture se génère depuis le devis ou le bon de commande déjà validé, part automatiquement au bon contact, et se classe seule dans votre comptabilité.",
    proofFr:
      "Le contenu d'une facture est entièrement déterminé par des données qui existent déjà ailleurs. Le quart de temps conservé couvre les cas particuliers et le contrôle avant envoi.",
  },
  {
    id: "facture_relance",
    fn: "administratif",
    labelFr: "Relancer les factures impayées",
    volumeKey: "factures_emises_mois",
    minutesPerUnit: 2.5,
    automationRate: 0.85,
    confidence: "haute",
    effort: 2,
    weeksToValue: 3,
    lever: "implementation",
    howFr:
      "Les relances partent seules selon un calendrier que vous fixez, avec le bon ton à chaque étape, et s'arrêtent dès que le paiement arrive.",
    proofFr:
      "Temps amorti sur toutes les factures émises : environ une facture sur cinq demande deux relances de six minutes. La relance d'impayé est une tâche à déclenchement calendaire, sans jugement à porter.",
  },
  {
    id: "saisie_documents",
    fn: "administratif",
    labelFr: "Saisir et classer les documents reçus",
    volumeKey: "saisie_documents_mois",
    minutesPerUnit: 6,
    automationRate: 0.8,
    confidence: "haute",
    effort: 2,
    weeksToValue: 3,
    lever: "implementation",
    howFr:
      "Le document est lu automatiquement à réception, ses informations clés sont extraites, et il se range au bon endroit sans intervention.",
    proofFr:
      "La lecture automatique de documents structurés (factures, bons, attestations) est une technologie mature. Le cinquième conservé couvre les documents illisibles et les exceptions.",
    sectorMinutesFactor: { juridique: 1.3, sante_medecine: 1.3, collectivites_public: 1.2 },
  },
  {
    id: "email_tri_reponse",
    fn: "administratif",
    labelFr: "Trier et répondre aux e-mails courants",
    volumeKey: "emails_traites_jour",
    minutesPerUnit: 2.5,
    automationRate: 0.35,
    confidence: "prudente",
    effort: 1,
    weeksToValue: 1,
    lever: "formation",
    howFr:
      "Les messages sont triés par nature et par urgence, et les réponses récurrentes sont proposées prêtes à relire — vous gardez la main sur l'envoi.",
    proofFr:
      "Taux volontairement bas : la question ne compte que les e-mails auxquels quelqu'un doit vraiment répondre, et ceux-là demandent en majorité une décision. Seul le tri et les réponses récurrentes s'automatisent.",
  },
  {
    id: "rdv_planification",
    fn: "administratif",
    labelFr: "Caler un rendez-vous",
    volumeKey: "rdv_planifies_semaine",
    minutesPerUnit: 8,
    automationRate: 0.85,
    confidence: "haute",
    effort: 1,
    weeksToValue: 1,
    lever: "implementation",
    howFr:
      "Le client choisit lui-même un créneau réellement libre dans votre agenda, reçoit sa confirmation et son rappel, et se replanifie seul s'il doit décaler.",
    proofFr:
      "Le temps mesuré est celui des allers-retours de disponibilité, pas celui du rendez-vous. Ces échanges disparaissent entièrement dès que l'agenda est ouvert en libre-service.",
  },

  // ═══════════════════════════════════════════════════════════════════════
  // COMMERCIAL
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: "devis_redaction",
    fn: "commercial",
    labelFr: "Rédiger un devis",
    volumeKey: "devis_emis_semaine",
    minutesPerUnit: 35,
    automationRate: 0.6,
    confidence: "moyenne",
    effort: 3,
    weeksToValue: 6,
    lever: "implementation",
    howFr:
      "Le devis se pré-remplit à partir de la demande du client et de votre bibliothèque de prestations ; vous n'intervenez plus que sur le chiffrage et les conditions.",
    proofFr:
      "La mise en forme, la reprise des coordonnées et le rappel des prestations standard sont mécaniques. Les quarante pour cent conservés correspondent au chiffrage, qui engage l'entreprise.",
    sectorMinutesFactor: {
      btp_immobilier: 1.6,
      industrie_logistique: 1.4,
      artisanat_services: 0.8,
    },
  },
  {
    id: "devis_relance",
    fn: "commercial",
    labelFr: "Relancer un devis sans réponse",
    volumeKey: "devis_emis_semaine",
    minutesPerUnit: 6,
    automationRate: 0.85,
    confidence: "haute",
    effort: 2,
    weeksToValue: 3,
    lever: "implementation",
    howFr:
      "Chaque devis déclenche sa propre séquence de relance, adaptée au montant et au délai, et s'interrompt dès que le client répond.",
    proofFr:
      "Temps amorti sur tous les devis émis : environ deux devis sur trois demandent une à deux relances de cinq minutes. C'est la tâche la plus systématiquement oubliée en TPE-PME, donc celle où le gain est le plus net.",
  },
  {
    id: "prospect_qualification",
    fn: "commercial",
    labelFr: "Qualifier une demande entrante",
    volumeKey: "prospects_qualifies_mois",
    minutesPerUnit: 15,
    automationRate: 0.6,
    confidence: "moyenne",
    effort: 2,
    weeksToValue: 4,
    lever: "site",
    howFr:
      "La demande arrive déjà enrichie et classée : nature du besoin, urgence, cohérence avec votre offre. Les demandes hors périmètre sont écartées avant d'arriver sur votre bureau.",
    proofFr:
      "Le recueil d'informations et la vérification de cohérence sont automatisables ; la décision de poursuivre reste humaine, d'où un taux limité à trois cinquièmes.",
  },
  {
    id: "relance_commerciale",
    fn: "commercial",
    labelFr: "Écrire une relance commerciale personnalisée",
    volumeKey: "relances_commerciales_mois",
    minutesPerUnit: 8,
    automationRate: 0.7,
    confidence: "haute",
    effort: 1,
    weeksToValue: 2,
    lever: "formation",
    howFr:
      "Le message est proposé déjà personnalisé à partir de l'historique du contact et de la dernière interaction ; vous relisez et vous envoyez.",
    proofFr:
      "Rédiger un message court à partir d'un contexte connu est l'usage le plus mature de l'assistance à la rédaction. Le tiers conservé couvre la relecture et l'adaptation au ton de la relation.",
  },
  {
    id: "proposition_longue",
    fn: "commercial",
    labelFr: "Produire une proposition commerciale détaillée",
    volumeKey: "propositions_longues_mois",
    minutesPerUnit: 180,
    automationRate: 0.5,
    confidence: "moyenne",
    effort: 2,
    weeksToValue: 3,
    lever: "formation",
    howFr:
      "La trame, le rappel du contexte client, la présentation de la méthode et les annexes se construisent en quelques minutes à partir de vos documents existants.",
    proofFr:
      "La moitié du temps d'une proposition part dans des parties réutilisables d'un dossier à l'autre. L'autre moitié — la compréhension du besoin et la stratégie — reste entièrement humaine.",
  },

  // ═══════════════════════════════════════════════════════════════════════
  // RELATION CLIENT
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: "appel_tracabilite",
    fn: "relation_client",
    labelFr: "Noter et tracer un appel client",
    volumeKey: "appels_entrants_jour",
    minutesPerUnit: 4,
    automationRate: 0.7,
    confidence: "moyenne",
    effort: 2,
    weeksToValue: 4,
    lever: "implementation",
    howFr:
      "Le compte-rendu de l'appel s'écrit tout seul et se range dans la fiche du client, avec les actions à faire déjà identifiées.",
    proofFr:
      "Le temps mesuré est celui de la trace écrite après l'appel, pas celui de l'appel lui-même. Cette saisie est le premier poste sacrifié quand la journée est chargée — d'où sa valeur réelle supérieure au temps affiché.",
  },
  {
    id: "demande_ecrite_reponse",
    fn: "relation_client",
    labelFr: "Répondre à une demande écrite",
    volumeKey: "demandes_ecrites_jour",
    minutesPerUnit: 9,
    automationRate: 0.65,
    confidence: "moyenne",
    effort: 2,
    weeksToValue: 3,
    lever: "site",
    howFr:
      "Les questions récurrentes trouvent leur réponse en libre-service sur votre site ; celles qui vous parviennent arrivent avec un projet de réponse fondé sur vos documents.",
    proofFr:
      "Une part importante des demandes écrites porte sur des informations déjà publiées. Le tiers conservé correspond aux situations particulières qui exigent une réponse rédigée sur mesure.",
  },
  {
    id: "reclamation_traitement",
    fn: "relation_client",
    labelFr: "Traiter une réclamation",
    volumeKey: "reclamations_mois",
    minutesPerUnit: 45,
    automationRate: 0.35,
    confidence: "prudente",
    effort: 3,
    weeksToValue: 6,
    lever: "audit",
    howFr:
      "La reconstitution du dossier, l'historique du client et le rappel des engagements pris sont préparés avant que vous ouvriez le sujet.",
    proofFr:
      "Seule la préparation du dossier s'automatise. L'arbitrage, le geste commercial et la relation restent humains — d'où un taux volontairement bas, le plus bas du référentiel.",
  },

  // ═══════════════════════════════════════════════════════════════════════
  // PRODUCTION ET MÉTIER
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: "compte_rendu_reunion",
    fn: "production",
    labelFr: "Produire un compte-rendu de réunion",
    volumeKey: "comptes_rendus_semaine",
    minutesPerUnit: 40,
    automationRate: 0.8,
    confidence: "haute",
    effort: 1,
    weeksToValue: 1,
    lever: "formation",
    howFr:
      "La réunion est transcrite puis résumée en décisions, actions et responsables. Vous relisez, vous corrigez deux phrases, vous diffusez.",
    proofFr:
      "C'est l'usage où l'écart entre le temps humain et le temps machine est le plus grand du référentiel, et celui qui produit un résultat visible dès la première utilisation, sans aucun paramétrage.",
    sectorMinutesFactor: { juridique: 1.4, sante_medecine: 1.3, collectivites_public: 1.5 },
  },
  {
    id: "recherche_documentaire",
    fn: "production",
    labelFr: "Retrouver une information dans vos documents",
    volumeKey: "recherches_documentaires_semaine",
    minutesPerUnit: 12,
    automationRate: 0.7,
    confidence: "moyenne",
    effort: 3,
    weeksToValue: 8,
    lever: "implementation",
    howFr:
      "Vous posez la question en français et vous obtenez la réponse avec le document et la page qui la portent, au lieu de fouiller vos dossiers.",
    proofFr:
      "Le gain suppose que vos documents soient d'abord rassemblés et indexés — c'est ce qui explique le délai de mise en œuvre, le plus long du référentiel avec le contrôle de conformité.",
    sectorMinutesFactor: { juridique: 1.8, comptabilite_finance: 1.4, sante_medecine: 1.3 },
  },
  {
    id: "document_redaction",
    fn: "production",
    labelFr: "Rédiger un document métier",
    volumeKey: "documents_rediges_semaine",
    minutesPerUnit: 50,
    automationRate: 0.5,
    confidence: "moyenne",
    effort: 1,
    weeksToValue: 2,
    lever: "formation",
    howFr:
      "Le premier jet est produit à partir de vos modèles et de vos notes ; votre travail commence à la relecture, là où se trouve votre valeur.",
    proofFr:
      "La moitié du temps d'un document part dans la page blanche et la mise en forme. L'expertise, elle, ne s'automatise pas — d'où un taux qui reste à la moitié.",
    sectorMinutesFactor: { juridique: 1.6, sante_medecine: 1.2, collectivites_public: 1.3 },
  },
  {
    id: "controle_conformite",
    fn: "production",
    labelFr: "Contrôler la conformité d'un dossier",
    volumeKey: "controles_conformite_mois",
    minutesPerUnit: 25,
    automationRate: 0.55,
    confidence: "prudente",
    effort: 3,
    weeksToValue: 8,
    lever: "implementation",
    howFr:
      "Les pièces manquantes, les incohérences de dates et les écarts avec votre référentiel sont signalés avant que vous ouvriez le dossier.",
    proofFr:
      "La détection des anomalies s'automatise ; la validation finale engage votre responsabilité et reste humaine. Le taux est volontairement prudent car une erreur non détectée coûte plus cher que le temps gagné.",
    sectors: [
      "juridique",
      "comptabilite_finance",
      "sante_medecine",
      "industrie_logistique",
      "collectivites_public",
      "btp_immobilier",
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // MARKETING
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: "publication_contenu",
    fn: "marketing",
    labelFr: "Produire une publication",
    volumeKey: "publications_mois",
    minutesPerUnit: 35,
    automationRate: 0.75,
    confidence: "haute",
    effort: 1,
    weeksToValue: 1,
    lever: "formation",
    howFr:
      "Le texte, les déclinaisons par réseau et les visuels d'accompagnement sont produits en une passe, à partir d'une idée et de votre ligne éditoriale.",
    proofFr:
      "Format court, contraintes claires, ton défini à l'avance : ce sont les conditions où l'assistance à la rédaction est la plus fiable. Le quart conservé couvre le choix du sujet et la validation.",
  },
  {
    id: "article_redaction",
    fn: "marketing",
    labelFr: "Rédiger un article de fond",
    volumeKey: "articles_rediges_mois",
    minutesPerUnit: 210,
    automationRate: 0.6,
    confidence: "moyenne",
    effort: 2,
    weeksToValue: 2,
    lever: "formation",
    howFr:
      "Plan, premier jet, titres, résumé et métadonnées sont produits ensemble ; vous apportez l'expérience terrain et les exemples, qui sont la seule chose qui distingue votre article.",
    proofFr:
      "Le gain porte sur la structure et la mise en forme. Un article sans apport propre n'a aucune valeur, ni pour vos lecteurs ni pour votre référencement — d'où un taux qui ne dépasse pas trois cinquièmes.",
  },

  // ═══════════════════════════════════════════════════════════════════════
  // RESSOURCES HUMAINES
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: "candidature_tri",
    fn: "rh",
    labelFr: "Trier une candidature",
    volumeKey: "candidatures_recues_mois",
    minutesPerUnit: 8,
    automationRate: 0.7,
    confidence: "moyenne",
    effort: 2,
    weeksToValue: 3,
    lever: "implementation",
    howFr:
      "Chaque candidature arrive résumée et rapprochée des exigences réelles du poste, avec les points à vérifier en entretien.",
    proofFr:
      "La lecture et le résumé s'automatisent. La décision de recevoir quelqu'un reste humaine, et doit le rester : un tri entièrement automatique exposerait l'entreprise à un risque de discrimination.",
  },
  {
    id: "entretien_synthese",
    fn: "rh",
    labelFr: "Rédiger la synthèse d'un entretien",
    volumeKey: "entretiens_menes_mois",
    minutesPerUnit: 20,
    automationRate: 0.75,
    confidence: "haute",
    effort: 1,
    weeksToValue: 1,
    lever: "formation",
    howFr:
      "Vos notes d'entretien deviennent une synthèse structurée et comparable d'un candidat à l'autre, prête à partager avec le décideur.",
    proofFr:
      "Mise en forme et structuration de notes existantes : le cas le plus favorable de l'assistance à la rédaction, puisque toute la matière est déjà là.",
  },
  {
    id: "onboarding_preparation",
    fn: "rh",
    labelFr: "Préparer l'intégration d'un nouvel arrivant",
    volumeKey: "onboardings_an",
    minutesPerUnit: 240,
    automationRate: 0.5,
    confidence: "moyenne",
    effort: 2,
    weeksToValue: 4,
    lever: "implementation",
    howFr:
      "Le parcours d'intégration, les documents à signer, les accès à ouvrir et le programme des premiers jours se déclenchent à la signature du contrat.",
    proofFr:
      "La logistique de l'intégration est répétitive et se déclenche sur un événement connu. L'accueil humain, lui, ne se délègue pas — d'où un taux à la moitié.",
  },

  // ═══════════════════════════════════════════════════════════════════════
  // FINANCE ET PILOTAGE
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: "reporting_production",
    fn: "finance",
    labelFr: "Produire un reporting récurrent",
    volumeKey: "reportings_produits_mois",
    minutesPerUnit: 120,
    automationRate: 0.65,
    confidence: "moyenne",
    effort: 3,
    weeksToValue: 6,
    lever: "implementation",
    howFr:
      "L'extraction, le croisement et la mise en forme se font seuls ; le commentaire vous est proposé, et vous gardez l'analyse.",
    proofFr:
      "Un reporting récurrent est par définition reproductible. Le tiers conservé couvre le commentaire et l'analyse, qui sont la seule raison pour laquelle quelqu'un lit ce document.",
  },
  {
    id: "rapprochement_ecritures",
    fn: "finance",
    labelFr: "Rapprocher écritures et justificatifs",
    volumeKey: "rapprochements_mois",
    minutesPerUnit: 20,
    automationRate: 0.7,
    confidence: "moyenne",
    effort: 3,
    weeksToValue: 6,
    lever: "implementation",
    howFr:
      "Les correspondances évidentes se font seules ; seuls les écarts réels remontent pour arbitrage.",
    proofFr:
      "Le rapprochement est une mise en correspondance sur des critères stables. Le tiers conservé correspond aux écarts, qui sont précisément la partie qui demande votre jugement.",
    sectorMinutesFactor: { comptabilite_finance: 1.3 },
  },
] as const;

/** Index par identifiant, pour la reprise d'un rapport et les tests. */
const TASK_BY_ID: ReadonlyMap<string, AutomatableTask> = new Map(
  AUTOMATABLE_TASKS.map((t) => [t.id, t]),
);

export function getAutomatableTask(id: string): AutomatableTask | undefined {
  return TASK_BY_ID.get(id);
}
