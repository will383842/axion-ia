// MANUAL-REWRITE 2026-05-27 — Audit Will : ville 3 issues, rewrite complet.
// Narbonne (11, Aude) — Capitale romaine Narbonnaise, viticulture #1 France, NARBO VIA, Canal du Midi UNESCO.

import type { VilleCopy } from "./types";

export const NARBONNE_COPY: VilleCopy = {
  pitchFr:
    "Narbonne (11), sous-préfecture de l'Aude (55 000 habitants, agglo 130 000), ancienne capitale de la Narbonnaise romaine et carrefour autoroutier A9/A61, concentre un tissu unique : viticulture AOC (1er département viticole de France — Corbières, Minervois, La Clape, Languedoc), négoce de vins, logistique fret Espagne, tourisme antique (cathédrale Saint-Just, Palais des Archevêques, Horreum, NARBO VIA) et balnéaire (Narbonne-Plage, Gruissan), commerce centre historique et BTP rénovation patrimoine. Axion-IA y intervient pour tous types d'activités.",
  pitchEn:
    "Narbonne (11), sous-préfecture de l'Aude (55 000 habitants, agglo 130 000), ancienne capitale de la Narbonnaise romaine et carrefour autoroutier A9/A61, concentre un tissu unique : viticulture AOC (1er département viticole de France — Corbières, Minervois, La Clape, Languedoc), négoce de vins, logistique fret Espagne, tourisme antique (cathédrale Saint-Just, Palais des Archevêques, Horreum, NARBO VIA) et balnéaire (Narbonne-Plage, Gruissan), commerce centre historique et BTP rénovation patrimoine. Axion-IA y intervient pour tous types d'activités.",
  directAnswerFr:
    "Axion-IA est un cabinet d'architectes IA seniors qui intervient à Narbonne (11). Nous accompagnons en priorité les TPE et PME du Narbonnais : domaines viticoles et négociants en vins AOC (Corbières, Minervois, La Clape), prestataires logistiques fret Espagne via A9, hôteliers-restaurateurs du centre historique et du littoral (Narbonne-Plage, Gruissan), artisans du BTP rénovation patrimoine et résidentiel littoral, commerces du cœur de ville et acteurs du tourisme antique (NARBO VIA, Canal du Midi). Interventions ETI possibles en complément.",
  directAnswerEn:
    "Axion-IA est un cabinet d'architectes IA seniors qui intervient à Narbonne (11). Nous accompagnons en priorité les TPE et PME du Narbonnais : domaines viticoles et négociants en vins AOC (Corbières, Minervois, La Clape), prestataires logistiques fret Espagne via A9, hôteliers-restaurateurs du centre historique et du littoral (Narbonne-Plage, Gruissan), artisans du BTP rénovation patrimoine et résidentiel littoral, commerces du cœur de ville et acteurs du tourisme antique (NARBO VIA, Canal du Midi). Interventions ETI possibles en complément.",
  seoHook: "viticulture AOC, logistique & tourisme antique",
  ecosystemFr:
    "Narbonne structure le Bas-Languedoc côtier autour de son cœur historique (cathédrale Saint-Just-et-Saint-Pasteur, Palais des Archevêques, Horreum gallo-romain) et du Canal du Midi (UNESCO) qui traverse la ville. Tissu économique : viticulture AOC (Corbières, Minervois, La Clape, Languedoc — 1er département France en volume), négoce et logistique vins, fret routier et ferroviaire vers l'Espagne (A9 + axe Perpignan), tourisme patrimoine antique (NARBO VIA, ouvert 2021, architecture Foster + Partners) et balnéaire (Narbonne-Plage, Gruissan, étangs), commerce centre-ville, BTP rénovation patrimoine et résidentiel littoral.",
  ecosystemEn:
    "Narbonne structure le Bas-Languedoc côtier autour de son cœur historique (cathédrale Saint-Just-et-Saint-Pasteur, Palais des Archevêques, Horreum gallo-romain) et du Canal du Midi (UNESCO) qui traverse la ville. Tissu économique : viticulture AOC (Corbières, Minervois, La Clape, Languedoc — 1er département France en volume), négoce et logistique vins, fret routier et ferroviaire vers l'Espagne (A9 + axe Perpignan), tourisme patrimoine antique (NARBO VIA, ouvert 2021, architecture Foster + Partners) et balnéaire (Narbonne-Plage, Gruissan, étangs), commerce centre-ville, BTP rénovation patrimoine et résidentiel littoral.",
  distancesFr:
    "Gare SNCF Narbonne en centre-ville (TGV Paris 4h30, axe Bordeaux-Marseille et Toulouse-Perpignan). Carrefour A9 (Espagne-Lyon) × A61 (Toulouse). Béziers 25 km, Carcassonne 60 km, Perpignan 60 km, Montpellier 95 km, Toulouse 150 km, Barcelone 220 km. Aéroports Béziers Cap d'Agde 30 km, Perpignan 60 km, Montpellier 95 km.",
  distancesEn:
    "Gare SNCF Narbonne en centre-ville (TGV Paris 4h30, axe Bordeaux-Marseille et Toulouse-Perpignan). Carrefour A9 (Espagne-Lyon) × A61 (Toulouse). Béziers 25 km, Carcassonne 60 km, Perpignan 60 km, Montpellier 95 km, Toulouse 150 km, Barcelone 220 km. Aéroports Béziers Cap d'Agde 30 km, Perpignan 60 km, Montpellier 95 km.",
  topSectorsNaf: [
    "Viticulture AOC & négoce de vins (Corbières, Minervois, La Clape)",
    "Logistique & transport fret Espagne (carrefour A9/A61)",
    "Tourisme patrimoine antique (NARBO VIA, Canal du Midi) & balnéaire (Narbonne-Plage, Gruissan)",
    "Commerce centre historique & hôtellerie-restauration",
    "BTP rénovation patrimoine & résidentiel littoral",
  ],
  servicesContext: {
    audit: {
      fr: "Audit IA à Narbonne : diagnostic adapté aux domaines viticoles, négociants en vins, prestataires logistiques A9, hôteliers-restaurateurs du centre antique et du littoral, artisans BTP et commerces. ROI chiffré, audit Flash dès {{price:audit-flash|flat}}.",
      en: "Audit IA à Narbonne : diagnostic adapté aux domaines viticoles, négociants en vins, prestataires logistiques A9, hôteliers-restaurateurs du centre antique et du littoral, artisans BTP et commerces. ROI chiffré, audit Flash dès {{price:audit-flash|flat}}.",
    },
    interventions: {
      fr: "Interventions IA sur site à Narbonne : formats adaptés au domaine viticole, à la cave coopérative, à l'entrepôt logistique, à l'hôtel-restaurant patrimoine ou littoral, à l'artisan BTP. Vos équipes repartent autonomes.",
      en: "Interventions IA sur site à Narbonne : formats adaptés au domaine viticole, à la cave coopérative, à l'entrepôt logistique, à l'hôtel-restaurant patrimoine ou littoral, à l'artisan BTP. Vos équipes repartent autonomes.",
    },
    implementation: {
      fr: "Implémentation IA à Narbonne : automatisation devis et fiches techniques viticoles, agents conversationnels multilingues œnotourisme et tourisme antique, prédiction stocks et rotations négoce vins, OCR factures et bons de livraison logistique, CRM clients hôtellerie-restauration.",
      en: "Implémentation IA à Narbonne : automatisation devis et fiches techniques viticoles, agents conversationnels multilingues œnotourisme et tourisme antique, prédiction stocks et rotations négoce vins, OCR factures et bons de livraison logistique, CRM clients hôtellerie-restauration.",
    },
    unAUn: {
      fr: "Coaching 1-to-1 à Narbonne : sessions au domaine viticole, à l'entrepôt logistique, à l'hôtel ou en visio. Dirigeants TPE/PME viticulture, négoce, logistique, tourisme et BTP souhaitant maîtriser l'IA appliquée à leur métier.",
      en: "Coaching 1-to-1 à Narbonne : sessions au domaine viticole, à l'entrepôt logistique, à l'hôtel ou en visio. Dirigeants TPE/PME viticulture, négoce, logistique, tourisme et BTP souhaitant maîtriser l'IA appliquée à leur métier.",
    },
  },
  faqGeolocalisee: [
    {
      q: "Axion-IA intervient-il à Narbonne et dans l'Aude ?",
      a: "Oui, Axion-IA intervient à Narbonne et dans tout le Bas-Languedoc (Béziers, Carcassonne, Perpignan, Lézignan-Corbières, Sigean) ainsi qu'au littoral (Narbonne-Plage, Gruissan). Consultants depuis Montpellier ou Toulouse via A9/A61, ou en visio. Carrefour autoroutier idéal pour combiner plusieurs sites en une journée.",
    },
    {
      q: "Accompagnez-vous les domaines viticoles et négociants en vins AOC du Narbonnais ?",
      a: "Oui, c'est notre cœur d'intervention local. Cas d'usage : automatisation fiches techniques cuvées, traduction multilingue export (EN/DE/NL/CN), agents conversationnels œnotourisme et visite cave, prédiction stocks par appellation (Corbières, Minervois, La Clape, Languedoc), CRM négoce et OCR factures fournisseurs.",
    },
    {
      q: "Quels services IA pour la logistique et le fret Espagne via A9 ?",
      a: "Carrefour A9 (Espagne-Lyon) × A61 (Toulouse) : forte demande prestataires transport et logistique. Cas d'usage : OCR bons de livraison et CMR, automatisation devis transport, prédiction délais et planning camions, suivi flotte, traduction documents douaniers FR/ES.",
    },
    {
      q: "Accompagnez-vous l'hôtellerie-restauration et le tourisme antique (NARBO VIA, Canal du Midi) ?",
      a: "Oui, agents conversationnels multilingues (FR/EN/DE/ES/IT) pour réservations et concierge, automatisation devis groupes œnotourisme et patrimoine, OCR factures, gestion yield occupation, contenus multilingues sites NARBO VIA, cathédrale Saint-Just, Canal du Midi, plages de Narbonne-Plage et Gruissan.",
    },
    {
      q: "Quels services pour les TPE artisans BTP rénovation patrimoine et littoral ?",
      a: "Audit Flash, intervention 1 journée formation, coaching 1-to-1 dirigeants. Cas d'usage : automatisation devis chantiers rénovation patrimoine (centre antique) et résidentiel littoral, OCR factures fournisseurs, suivi planning équipes, génération comptes-rendus de chantier, photos avant/après IA.",
    },
    {
      q: "Comment se déroule une mission depuis Montpellier, Toulouse ou Perpignan ?",
      a: "Montpellier 95 km via A9, Toulouse 150 km via A61, Perpignan 60 km via A9. Frais de déplacement facturés à part, tarifs publics. Possibilité de combiner Narbonne + Béziers + Carcassonne ou Narbonne + Perpignan en une journée.",
    },
  ],
};
