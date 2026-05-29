// MANUAL FIX 2026-05-28 — anti-doorway HCU 2024.
// Wikipedia-sourced facts. EN = mirror FR (Will rule 2026-05-22).

import type { VilleCopy } from "./types";

export const TALENCE_COPY: VilleCopy = {
  pitchFr:
    "Talence (33), 46 338 habitants, commune limitrophe sud de Bordeaux dans le premier anneau métropolitain. Densité élevée (5 549 hab/km²), tissu tertiaire dominant à plus de 90 %, peu d'industrie. Pôle universitaire majeur : Université de Bordeaux, KEDGE Business School, ENSEIRB-MATMECA, Arts et Métiers ParisTech. Desservie par le tramway B et la gare de Talence-Médoquine (rouverte septembre 2025). Axion-IA accompagne TPE, PME de services, professions libérales et structures de l'écosystème enseignement-recherche.",
  pitchEn:
    "Talence (33), 46 338 habitants, commune limitrophe sud de Bordeaux dans le premier anneau métropolitain. Densité élevée (5 549 hab/km²), tissu tertiaire dominant à plus de 90 %, peu d'industrie. Pôle universitaire majeur : Université de Bordeaux, KEDGE Business School, ENSEIRB-MATMECA, Arts et Métiers ParisTech. Desservie par le tramway B et la gare de Talence-Médoquine (rouverte septembre 2025). Axion-IA accompagne TPE, PME de services, professions libérales et structures de l'écosystème enseignement-recherche.",
  directAnswerFr:
    "Axion-IA, cabinet d'architectes IA seniors, intervient à Talence (Gironde, Bordeaux Métropole) auprès des TPE, PME de services tertiaires, professions libérales, artisans et structures liées au pôle universitaire. Audit Flash {{price:audit-flash|flat}}, interventions sur site, implémentation IA code custom et coaching 1-to-1 dirigeants. Nos consultants se déplacent depuis Bordeaux centre via tramway B ou rocade. Code custom, pas de no-code, conformité RGPD intégrée.",
  directAnswerEn:
    "Axion-IA, cabinet d'architectes IA seniors, intervient à Talence (Gironde, Bordeaux Métropole) auprès des TPE, PME de services tertiaires, professions libérales, artisans et structures liées au pôle universitaire. Audit Flash {{price:audit-flash|flat}}, interventions sur site, implémentation IA code custom et coaching 1-to-1 dirigeants. Nos consultants se déplacent depuis Bordeaux centre via tramway B ou rocade. Code custom, pas de no-code, conformité RGPD intégrée.",
  seoHook: "tertiaire universitaire & professions libérales",
  ecosystemFr:
    "Talence est intégrée à Bordeaux Métropole et constitue un pôle universitaire majeur de Nouvelle-Aquitaine. Le tissu économique est tertiaire à plus de 90 % de la population active : services aux entreprises, professions libérales (santé, juridique, conseil), commerces de proximité, restauration étudiante. Présence forte de l'enseignement supérieur (Université de Bordeaux campus sciences, KEDGE, ENSEIRB-MATMECA, Arts et Métiers ParisTech) qui structure un écosystème R&D, ingénierie et services. Industrie marginale, agriculture quasi-inexistante.",
  ecosystemEn:
    "Talence est intégrée à Bordeaux Métropole et constitue un pôle universitaire majeur de Nouvelle-Aquitaine. Le tissu économique est tertiaire à plus de 90 % de la population active : services aux entreprises, professions libérales (santé, juridique, conseil), commerces de proximité, restauration étudiante. Présence forte de l'enseignement supérieur (Université de Bordeaux campus sciences, KEDGE, ENSEIRB-MATMECA, Arts et Métiers ParisTech) qui structure un écosystème R&D, ingénierie et services. Industrie marginale, agriculture quasi-inexistante.",
  distancesFr:
    "Bordeaux centre à 4 km (10 min tramway B), gare Bordeaux Saint-Jean à 6 km, aéroport Bordeaux-Mérignac à 12 km, Pessac à 4 km, Villenave-d'Ornon à 3 km. Accès rocade A630 sorties 16 et 17. Gare de Talence-Médoquine rouverte en septembre 2025 (TER Bordeaux-Arcachon).",
  distancesEn:
    "Bordeaux centre à 4 km (10 min tramway B), gare Bordeaux Saint-Jean à 6 km, aéroport Bordeaux-Mérignac à 12 km, Pessac à 4 km, Villenave-d'Ornon à 3 km. Accès rocade A630 sorties 16 et 17. Gare de Talence-Médoquine rouverte en septembre 2025 (TER Bordeaux-Arcachon).",
  topSectorsNaf: [
    "Services tertiaires aux entreprises",
    "Professions libérales (santé, juridique, conseil)",
    "Enseignement supérieur & recherche",
    "Programmation informatique & ingénierie",
    "Commerce de détail & restauration",
    "Artisanat BTP & rénovation",
  ],
  servicesContext: {
    audit: {
      fr: "Audit IA à Talence : diagnostic pour TPE services, professions libérales, cabinets et PME du premier anneau bordelais. Audit Flash {{price:audit-flash|flat}}, ROI chiffré, livré sous 5 jours ouvrés.",
      en: "Audit IA à Talence : diagnostic pour TPE services, professions libérales, cabinets et PME du premier anneau bordelais. Audit Flash {{price:audit-flash|flat}}, ROI chiffré, livré sous 5 jours ouvrés.",
    },
    interventions: {
      fr: "Interventions IA sur site à Talence : ateliers TPE/PME locales (cabinets libéraux, services aux entreprises, artisans). Formation équipes sur cas métier concrets, vos équipes repartent autonomes.",
      en: "Interventions IA sur site à Talence : ateliers TPE/PME locales (cabinets libéraux, services aux entreprises, artisans). Formation équipes sur cas métier concrets, vos équipes repartent autonomes.",
    },
    implementation: {
      fr: "Implémentation IA à Talence : code custom pour automatisation prise de RDV cabinets, classification dossiers, chatbot client, agents IA métier services aux entreprises.",
      en: "Implémentation IA à Talence : code custom pour automatisation prise de RDV cabinets, classification dossiers, chatbot client, agents IA métier services aux entreprises.",
    },
    unAUn: {
      fr: "Coaching 1-to-1 à Talence : sessions sur site ou visio pour dirigeants TPE, professions libérales, gérants commerces et patrons PME services. À partir de {{price:intervention-dirigeants|flat}}.",
      en: "Coaching 1-to-1 à Talence : sessions sur site ou visio pour dirigeants TPE, professions libérales, gérants commerces et patrons PME services. À partir de {{price:intervention-dirigeants|flat}}.",
    },
  },
  faqGeolocalisee: [
    {
      q: "Quels sont les tarifs pour une intervention IA à Talence ?",
      a: "Audit Flash {{price:audit-flash|flat}} (4 h sur site, livré sous 5 jours ouvrés), interventions sur site à partir de {{price:intervention-4h|flat}} la demi-journée, coaching 1-to-1 dirigeant à partir de {{price:intervention-dirigeants|flat}}. Tarifs publics consultables.",
    },
    {
      q: "Axion-IA se déplace-t-il à Talence depuis Bordeaux centre ?",
      a: "Oui, nos consultants se déplacent à Talence depuis Bordeaux centre en 10 min (tramway B, ligne directe) ou via la rocade A630 (sorties 16 ou 17). Délai d'intervention sous 5 jours ouvrés.",
    },
    {
      q: "Quelles communes proches couvrez-vous autour de Talence ?",
      a: "Nous intervenons à Talence et dans les communes limitrophes : Bordeaux, Pessac, Bègles, Gradignan, Villenave-d'Ornon, et plus largement sur Bordeaux Métropole (Mérignac, Bouliac, Cenon).",
    },
    {
      q: "Travaillez-vous avec les professions libérales et cabinets de Talence ?",
      a: "Oui, secteur cœur du tissu local. Cas IA fréquents : automatisation prise de RDV, classification dossiers patient/client, génération comptes-rendus, agents IA réponse, optimisation facturation. Code custom, intégration outils métier.",
    },
    {
      q: "Comment Axion-IA garantit-il la conformité RGPD à Talence ?",
      a: "Conformité RGPD intégrée dès la conception : hébergement UE, anonymisation, registre des traitements, DPA fourni. Code custom auditable, pas de dépendance SaaS US opaque. Conforme AI Act EU 2026.",
    },
    {
      q: "Accompagnez-vous les startups et structures liées au pôle universitaire bordelais ?",
      a: "Oui, nous accompagnons les TPE issues de l'écosystème Université de Bordeaux, KEDGE, ENSEIRB-MATMECA et Arts et Métiers. Cas typiques : structuration outillage IA, code custom, conformité RGPD/AI Act, gouvernance données.",
    },
  ],
};
