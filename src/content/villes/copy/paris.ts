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
  ecosystemFr:
    "Tissu PME/ETI le plus dense de France, sièges grands-comptes (La Défense, 8e, 16e), pôle deep-tech (Station F, Quai d'Innovation, écoles d'ingénieurs). L'écosystème IA français y est concentré : Mistral AI, Hugging Face, Owkin, Photoroom, Dust. Les directions IA des grands groupes pilotent leurs déploiements depuis ces sièges.",
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
