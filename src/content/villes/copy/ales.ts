// MANUAL-REWRITE 2026-05-28 — Audit Will batch 100 (qs moyen → premium).
// Alès (30, Gard) — ancien bassin minier reconverti, porte des Cévennes, industrie & PME.

import type { VilleCopy } from "./types";

export const ALES_COPY: VilleCopy = {
  pitchFr:
    "Axion-IA, cabinet d'architectes seniors en intelligence artificielle, accompagne les TPE et PME d'Alès, ancien bassin minier devenu pôle industriel et porte des Cévennes. Industrie, sous-traitance, BTP, commerce et tourisme vert : nous transformons l'IA en gains concrets, sans jargon ni dépendance technique.",
  pitchEn:
    "Axion-IA, cabinet d'architectes seniors en intelligence artificielle, accompagne les TPE et PME d'Alès, ancien bassin minier devenu pôle industriel et porte des Cévennes. Industrie, sous-traitance, BTP, commerce et tourisme vert : nous transformons l'IA en gains concrets, sans jargon ni dépendance technique.",
  directAnswerFr:
    "Axion-IA est un cabinet d'architectes seniors en intelligence artificielle qui intervient à Alès auprès des TPE et PME en priorité, des PME ensuite. Nous ciblons l'industrie et la sous-traitance issues de la reconversion du bassin minier, le BTP, le commerce et le tourisme cévenol. Audit sur place sur mesure avec ROI chiffré, puis interventions sur site, vos équipes restant autonomes.",
  directAnswerEn:
    "Axion-IA est un cabinet d'architectes seniors en intelligence artificielle qui intervient à Alès auprès des TPE et PME en priorité, des PME ensuite. Nous ciblons l'industrie et la sous-traitance issues de la reconversion du bassin minier, le BTP, le commerce et le tourisme cévenol. Audit sur place sur mesure avec ROI chiffré, puis interventions sur site, vos équipes restant autonomes.",
  seoHook: "industrie & Cévennes",
  ecosystemFr:
    "Alès, ancien coeur du bassin houiller cévenol, s'est reconvertie en pôle industriel et technologique appuyé par l'École des Mines d'Alès (IMT Mines Alès) et le parc scientifique de l'Arche. Le tissu mêle PME industrielles et de sous-traitance, BTP, mécanique, plasturgie, commerce et tourisme vert au pied des Cévennes, avec un fort besoin de modernisation des process.",
  ecosystemEn:
    "Alès, ancien coeur du bassin houiller cévenol, s'est reconvertie en pôle industriel et technologique appuyé par l'École des Mines d'Alès (IMT Mines Alès) et le parc scientifique de l'Arche. Le tissu mêle PME industrielles et de sous-traitance, BTP, mécanique, plasturgie, commerce et tourisme vert au pied des Cévennes, avec un fort besoin de modernisation des process.",
  distancesFr:
    "Alès est reliée à Nîmes (gare TGV) en environ 45 km par la N106. L'aéroport de Nîmes-Garons et l'A9 sont accessibles via Nîmes ; Montpellier est à environ 1h.",
  distancesEn:
    "Alès est reliée à Nîmes (gare TGV) en environ 45 km par la N106. L'aéroport de Nîmes-Garons et l'A9 sont accessibles via Nîmes ; Montpellier est à environ 1h.",
  topSectorsNaf: [
    "Industrie et sous-traitance mécanique",
    "Plasturgie et matériaux",
    "BTP et travaux spécialisés",
    "Commerce de détail et de gros",
    "Tourisme vert et activités de plein air (Cévennes)",
  ],
  servicesContext: {
    audit: {
      fr: "Audit IA à Alès pour PME industrielles, sous-traitants et acteurs du BTP : nous cartographions vos process (maintenance, contrôle qualité, planification, devis) et chiffrons un ROI réaliste. Audit sur place sur mesure dès {{price:audit-flash|flat}}.",
      en: "Audit IA à Alès pour PME industrielles, sous-traitants et acteurs du BTP : nous cartographions vos process (maintenance, contrôle qualité, planification, devis) et chiffrons un ROI réaliste. Audit sur place sur mesure dès {{price:audit-flash|flat}}.",
    },
    interventions: {
      fr: "Interventions IA sur site à Alès : formats adaptés à l'atelier industriel, au chantier ou au commerce. Vos collaborateurs prennent ensuite la main sur les outils en autonomie.",
      en: "Interventions IA sur site à Alès : formats adaptés à l'atelier industriel, au chantier ou au commerce. Vos collaborateurs prennent ensuite la main sur les outils en autonomie.",
    },
    implementation: {
      fr: "Implémentation IA à Alès : maintenance prédictive, contrôle qualité visuel, optimisation de production et de planning, chiffrage automatisé de devis et agents conversationnels B2B pour les PME industrielles.",
      en: "Implémentation IA à Alès : maintenance prédictive, contrôle qualité visuel, optimisation de production et de planning, chiffrage automatisé de devis et agents conversationnels B2B pour les PME industrielles.",
    },
    unAUn: {
      fr: "Coaching 1-to-1 à Alès pour dirigeants de TPE et PME industrielles, BTP ou commerce : sessions dans vos locaux ou en visio pour piloter votre feuille de route IA sans dépendre d'un prestataire.",
      en: "Coaching 1-to-1 à Alès pour dirigeants de TPE et PME industrielles, BTP ou commerce : sessions dans vos locaux ou en visio pour piloter votre feuille de route IA sans dépendre d'un prestataire.",
    },
    sitesWeb: {
      fr: "Sites web augmentés à Alès : portails B2B, configurateurs et outils IA sur mesure pour l'industrie, la sous-traitance et le tourisme vert cévenol.",
      en: "Sites web augmentés à Alès : portails B2B, configurateurs et outils IA sur mesure pour l'industrie, la sous-traitance et le tourisme vert cévenol.",
    },
  },
  faqGeolocalisee: [
    {
      q: "Axion-IA accompagne-t-il les PME industrielles d'Alès ?",
      a: "Oui, l'industrie et la sous-traitance issues de la reconversion du bassin minier sont au coeur de notre cible alésienne, ainsi que le BTP et le commerce. Nous travaillons en priorité avec les TPE et PME, l'accompagnement des ETI restant marginal.",
    },
    {
      q: "Quels gains IA pour un sous-traitant ou industriel alésien ?",
      a: "Maintenance prédictive des machines, contrôle qualité visuel, optimisation de planning et chiffrage automatisé des devis. Chaque piste est chiffrée en ROI dans l'Audit sur place avant toute implémentation.",
    },
    {
      q: "Quel est le tarif d'une intervention IA à Alès ?",
      a: "L'Audit sur place sur mesure démarre à {{price:audit-flash|flat}} et la Formation 4 h à {{price:intervention-4h|flat}}. Tous nos tarifs sont publics et sans devis opaque ; chaque chantier d'implémentation est ensuite chiffré selon le ROI.",
    },
    {
      q: "Intervenez-vous dans les Cévennes autour d'Alès ?",
      a: "Oui, nous couvrons le bassin alésien et les Cévennes : Saint-Christol-lès-Alès, Saint-Privat-des-Vieux, La Grand-Combe et les communes du Gard nord. Frais de déplacement facturés à part, tarifs publics.",
    },
    {
      q: "Vos solutions IA sont-elles conformes au RGPD ?",
      a: "Oui, chaque solution déployée à Alès respecte le RGPD et l'AI Act. Vos données de production et données clients restent maîtrisées, sans verrou technologique ni dépendance à un prestataire unique.",
    },
  ],
};
