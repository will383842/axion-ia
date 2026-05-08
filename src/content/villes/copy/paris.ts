// Paris — contenu éditorial gold standard (Sprint 14.9, doctrine v3.2).
// Curaté manuellement par Will. Sera la référence pour la phase LLM
// d'industrialisation (50 villes top en sem 1-2). Le script `import-insee-villes.ts`
// ne touche pas ce fichier.
import type { VilleCopy } from "./types";

export const PARIS_COPY: VilleCopy = {
  pitchFr:
    "Capitale économique européenne, Paris concentre 215 000 entreprises actives, le siège des grands groupes français et l'écosystème IA national (Mistral, Hugging Face, Station F). AxionIA y intervient sur site dans Paris intra-muros et toute l'Île-de-France, des cabinets indépendants aux directions IA des grands comptes.",
  pitchEn:
    "Europe's economic capital, Paris hosts 215,000 active businesses, headquarters of major French groups and the national AI ecosystem (Mistral, Hugging Face, Station F). AxionIA delivers on-site engagements throughout Paris and Greater Paris, from independent firms to AI leadership of large corporates.",
  servicesContext: {
    audit: {
      fr: "Audit IA à Paris : pôle prioritaire d'AxionIA. 4 niveaux (Flash 490 € HT, Ciblé 1 900-3 900 €, Stratégique PME 4 900-9 900 €, Stratégique ETI dès 12 000 €). Délai moyen entre signature et kick-off : 5-10 jours ouvrés. Aucun frais de déplacement intra-muros ni petite couronne.",
      en: "AI audit in Paris: AxionIA priority hub. 4 tiers (Flash €490, Targeted €1,900-3,900, SME Strategic €4,900-9,900, Mid-cap Strategic from €12,000). Average lead time between signature and kick-off: 5-10 business days. No travel fees within Paris and inner suburbs.",
    },
    interventions: {
      fr: "Interventions IA à Paris : 5 formats (Essentielle 490 € HT 1 journée, Équipes, Managers, Conférence ½ journée, Dirigeants). Disponibles dans les 20 arrondissements, La Défense, première couronne (Levallois, Boulogne, Issy, Neuilly). Démos sur vos vraies données, jusqu'à 100 collaborateurs par session.",
      en: "AI sessions in Paris: 5 formats (Essential €490 1 day, Teams, Managers, Half-day talk, Executives). Available across all 20 arrondissements, La Défense, inner suburbs (Levallois, Boulogne, Issy, Neuilly). Demos on your real data, up to 100 collaborators per session.",
    },
    implementation: {
      fr: "Implémentation IA à Paris : mise en production en 6-12 semaines, ROI chiffré, formation incluse. Hybride sur site / distance, kick-off à Paris obligatoire. Cas typiques parisiens : lecture de factures, comptes-rendus de réunions automatisés, qualification IA des leads, agents conversationnels CRM/ERP.",
      en: "AI implementation in Paris: production deployment in 6-12 weeks, costed ROI, training included. Hybrid on-site / remote, kick-off in Paris required. Typical Paris cases: invoice reading, automated meeting minutes, AI lead qualification, CRM/ERP conversational agents.",
    },
  },
  directAnswerFr:
    "AxionIA est un cabinet IA opérationnel basé en UE qui intervient à Paris (75) sur site dans les 20 arrondissements et la première couronne. Nous accompagnons toutes tailles d'entreprise — TPE, PME, ETI, grandes entreprises (sièges La Défense, 8e, 16e) et startups parisiennes (Station F, French Tech) — sur leurs cas IA opérationnels : diagnostic 5 jours, démos sur vos vraies données, plan d'action chiffré. Tarif public dès 490 € HT pour l'intervention essentielle 1 journée. Aucun lock-in technologique.",
  directAnswerEn:
    "AxionIA is an EU-based operational AI consultancy delivering on-site engagements across all 20 Paris arrondissements and the inner suburbs. We support every company size — micro-businesses, SMEs, mid-caps, large enterprises (La Défense, 8th, 16th HQs) and startups (Station F, French Tech) — on their operational AI use cases: 5-day diagnosis, demos on your real data, costed action plan. Public pricing from €490 for the 1-day essential engagement. No tech lock-in.",
  topSectorsNaf: [
    "Banque & Finance",
    "Conseil & Services aux entreprises",
    "Tech & Édition logicielle",
    "Édition, Médias & Communication",
    "Mode & Luxe",
    "Tourisme & Hôtellerie premium",
  ],
  distancesFr:
    "Gares Montparnasse, du Nord, de Lyon et Saint-Lazare au cœur de Paris ; Roissy-Charles-de-Gaulle à 45 km, Orly à 25 km. Métro 14 lignes + RER A/B/C/D/E. Interventions sur site possibles en demi-journée depuis n'importe quel arrondissement.",
  distancesEn:
    "Montparnasse, Gare du Nord, Gare de Lyon and Saint-Lazare stations in central Paris; Roissy-Charles-de-Gaulle 45 km, Orly 25 km. Métro 14 lines + RER A/B/C/D/E. Half-day on-site engagements from any arrondissement.",
  ecosystemFr:
    "Tissu B2B le plus dense de France toutes tailles confondues — micro-entreprises et indépendants (215 000 actives intra-muros), PME et ETI (cabinets d'expertise, scale-ups, ETI conseil), sièges grandes entreprises (La Défense, 8e, 16e), pôle deep-tech (Station F, Quai d'Innovation, écoles d'ingénieurs). L'écosystème IA français y est concentré : Mistral AI, Hugging Face, Owkin, Photoroom, Dust. Les directions IA des grands groupes pilotent leurs déploiements depuis ces sièges.",
  ecosystemEn:
    "Densest B2B fabric in France across every company size — micro-businesses and independents (215,000 active within Paris), SMEs and mid-caps (expertise firms, scale-ups, mid-cap consulting), large-enterprise HQs (La Défense, 8th, 16th districts), deep-tech hub (Station F, Quai d'Innovation, engineering schools). The French AI ecosystem clusters here: Mistral AI, Hugging Face, Owkin, Photoroom, Dust. Major-group AI leadership steers deployments from these headquarters.",
  heroSchema: {
    centerSubLabel: "215 K entreprises actives",
    satellites: [
      { label: "La Défense", detail: "1ère place tertiaire EU", accent: "primary" },
      { label: "Station F", detail: "1 000+ startups deep-tech", accent: "terracotta" },
      { label: "Banque · Finance", detail: "Sièges + family offices", accent: "mocha" },
      { label: "Conseil · Audit", detail: "Cabinets stratégie", accent: "primary" },
      { label: "Tech · SaaS", detail: "Mistral, Hugging Face", accent: "sage" },
      { label: "Mode · Luxe", detail: "Maisons + cosmétique", accent: "terracotta" },
    ],
  },
  faqGeolocalisee: [
    {
      q: "Combien coûte un audit IA opérationnel à Paris ?",
      a: "Notre audit Essentiel (5 jours, 12 entretiens, 3 cas d'usage chiffrés) est facturé 9 800 € HT à Paris comme partout en France. Aucun supplément géographique : nos consultants sont basés à Paris, les frais de déplacement sont intégrés dans le forfait pour toute mission en Île-de-France.",
    },
    {
      q: "Avez-vous des cas clients à Paris ?",
      a: "Oui — plusieurs cas concrets dans nos références sont basés à Paris ou en proche couronne (cabinet comptable Boulogne-Billancourt, ETI conseil 9e arrondissement, scale-up SaaS Sentier). Les cas clients récents sont consultables dans la rubrique Cas concrets, filtrables par ville d'intervention.",
    },
    {
      q: "Quels secteurs sont prioritaires à Paris ?",
      a: "Nos déploiements parisiens couvrent en priorité la finance (cabinets d'expertise, family offices, asset managers), le conseil (cabinets stratégie, audit, juridique), la tech (scale-ups B2B SaaS, éditeurs logiciels), et le luxe (maisons de mode, cosmétique). Tout secteur B2B avec >20 collaborateurs est éligible à un audit.",
    },
    {
      q: "Pouvez-vous intervenir sur site dans nos bureaux parisiens ?",
      a: "Oui — toutes nos interventions Paris sont par défaut sur site, dans vos bureaux. Nos consultants sont mobiles sur l'ensemble des arrondissements, La Défense, et la première couronne (Levallois, Boulogne, Issy, Neuilly). Les ateliers d'idéation et restitutions clés se tiennent toujours en présentiel.",
    },
    {
      q: "En combien de temps pouvez-vous démarrer une mission à Paris ?",
      a: "Pour un audit Essentiel à Paris, le délai moyen entre signature et kick-off est de 10 jours ouvrés. Si votre besoin est urgent (Q+1 budget, contrainte calendaire CODIR), nous réservons des créneaux courts à 5 jours sur Paris en priorité absolue.",
    },
    {
      q: "Travaillez-vous avec les startups parisiennes (Station F, French Tech) ?",
      a: "Oui — nous accompagnons régulièrement les scale-ups séries A-B issues de Station F, du Quai d'Innovation et des programmes French Tech. Notre offre Essentielle est calibrée pour les structures 20-150 collaborateurs avec un product-market fit établi qui veulent passer du POC IA à un déploiement opérationnel.",
    },
  ],
};
