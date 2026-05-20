/**
 * Keyword Strategy — Batch J : Presse & Médias
 *
 * Mode J — généré 2026-05-20
 * Prompt master : `_AUDIT/PROMPT-KEYWORD-STRATEGY-MASTER-V1.md` v1.2
 *
 * Objectif : capter les journalistes, rédacteurs et podcasteurs
 * qui cherchent un expert IA B2B à interviewer, citer ou inviter.
 * Ces pages génèrent des backlinks éditoriaux à haute autorité.
 *
 * Familles couvertes (5) :
 *   J1 — Journalistes cherchant un expert IA à interviewer         (6 seeds)
 *   J2 — Médias cherchant des chiffres / études IA                 (6 seeds)
 *   J3 — Rédacteurs de classements presse                          (5 seeds)
 *   J4 — Kit médias (logos, biographie, photos presse)             (5 seeds)
 *   J5 — Presse spécialisée (radio, TV, podcast, conférence)       (6 seeds)
 *   TOTAL : 28 seeds
 *
 * Règles respectées :
 *   - intent : "informationnel" (journaliste en phase de recherche)
 *   - module : "transversal" (pas lié à un service unique)
 *   - niveau=1 jamais combiné à priorite=1
 *   - H1 ≠ keyword brut (toujours bénéfice + différenciateur)
 *   - metaTitle ≤ 60 chars / metaDescription ≤ 155 chars
 *   - Pas de prix ni récompenses non obtenus
 *   - Pas de "OÜ" visible, pas de "Made in France"
 *   - Positionnement : "franco-européen" / "fondé en France, implanté en Europe"
 */

import type { KeywordSeed } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
//  J1 — JOURNALISTES CHERCHANT UN EXPERT IA À INTERVIEWER
//
//  Douleur : Le journaliste presse éco / tech a une deadline serrée.
//  Il cherche sur Google un expert accessible, crédible, sachant parler
//  aux non-techniciens, disponible sous 24-48 h.
//  Intent : informationnel (phase de sourcing expert avant contact direct).
//  Pages cibles : /fr/presse/ + /fr/presse/intervenants/
// ─────────────────────────────────────────────────────────────────────────────

export const KW_PRESSE_J: KeywordSeed[] = [
  // ── J1.1 ────────────────────────────────────────────────────────────────────
  {
    keyword: "expert intelligence artificielle entreprise France interview",
    intent: "informationnel",
    kbType: "guide",
    module: "transversal",
    cible: "toutes-cibles",
    priorite: 1,
    niveau: 3,
    injection: {
      h1: "Besoin d'un expert IA B2B pour votre article ? Axion-IA répond aux médias sous 48 h",
      metaTitle: "Expert IA entreprises France — Interview & Presse | Axion-IA",
      metaDescription:
        "Cabinet IA franco-européen disponible pour interviews presse, radio et TV. Expertise PME/ETI, chiffres sourcés, disponibilité 48 h. Contactez-nous.",
      h2Variants: [
        "Pourquoi solliciter un cabinet IA spécialisé B2B pour vos articles ?",
        "Quels angles et chiffres peut fournir Axion-IA à la presse ?",
        "Comment prendre contact pour une interview dans les 48 h ?",
      ],
    },
    urlCible: "/fr/presse/",
    canonicalParent: "/fr/presse/",
    source: "manuel",
    note: "JSON-LD NewsroomPage + Person (speaker) — page d'accueil newsroom, lien direct 'Contact presse' en above-the-fold",
  },

  // ── J1.2 ────────────────────────────────────────────────────────────────────
  {
    keyword: "spécialiste IA PME France témoignage presse",
    intent: "informationnel",
    kbType: "case_study",
    module: "transversal",
    cible: "pme",
    priorite: 1,
    niveau: 3,
    injection: {
      h1: "Témoignages et études de cas IA pour PME — Sources presse vérifiables",
      metaTitle: "Spécialiste IA PME France — Témoignages presse | Axion-IA",
      metaDescription:
        "Axion-IA publie des études de cas IA concrets pour PME françaises : gains de temps, ROI chiffré, verbatims clients disponibles pour la presse.",
      h2Variants: [
        "Des cas clients réels utilisables comme sources journalistiques",
        "ROI IA en PME : chiffres vérifiés et contextualisés",
        "Comment accéder aux verbatims et contacts clients pour vos articles ?",
      ],
    },
    urlCible: "/fr/presse/etudes-de-cas/",
    canonicalParent: "/fr/presse/",
    source: "manuel",
    note: "JSON-LD NewsroomPage + CaseStudy — lier vers /fr/ressources/ pour cas clients ; mentionner disponibilité sources à la presse",
  },

  // ── J1.3 ────────────────────────────────────────────────────────────────────
  {
    keyword: "cabinet IA France source journaliste",
    intent: "informationnel",
    kbType: "guide",
    module: "transversal",
    cible: "toutes-cibles",
    priorite: 1,
    niveau: 3,
    injection: {
      h1: "Axion-IA, source d'expertise IA pour journalistes et rédactions",
      metaTitle: "Cabinet IA France — Source presse & journalistes | Axion-IA",
      metaDescription:
        "Rédaction spécialisée IA B2B ? Axion-IA fournit citations sourcées, données terrain et accès experts. Franco-européen, réponse sous 48 h.",
      h2Variants: [
        "Quelle expertise Axion-IA met-il à disposition des rédactions ?",
        "Données terrain et chiffres IA disponibles pour vos articles",
        "Protocole de contact presse — réponse garantie sous 48 h",
      ],
    },
    urlCible: "/fr/presse/",
    canonicalParent: "/fr/presse/",
    source: "manuel",
    note: "JSON-LD NewsroomPage — page newsroom principale, inclure section 'Espace presse' avec email direct et fil RSS communiqués",
  },

  // ── J1.4 ────────────────────────────────────────────────────────────────────
  {
    keyword: "conférencier IA entreprise disponible France",
    intent: "informationnel",
    kbType: "guide",
    module: "transversal",
    cible: "toutes-cibles",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Conférencier IA B2B disponible en France et en Europe — Axion-IA",
      metaTitle: "Conférencier IA entreprise France | Axion-IA — Intervenants",
      metaDescription:
        "Axion-IA propose des interventions keynote sur l'IA en entreprise pour congrès, séminaires et médias. Pédagogie terrain, cas réels PME/ETI.",
      h2Variants: [
        "Quels formats d'intervention propose Axion-IA ?",
        "Thématiques keynote : IA, automatisation, transformation digitale",
        "Demander une disponibilité pour votre événement ou émission",
      ],
    },
    urlCible: "/fr/intervenants/",
    canonicalParent: "/fr/presse/",
    source: "manuel",
    note: "JSON-LD Person (speaker) + Event — page /fr/intervenants/ à créer si inexistante ; schema Event pour les prochaines conférences listées",
  },

  // ── J1.5 ────────────────────────────────────────────────────────────────────
  {
    keyword: "expert IA B2B France interview média",
    intent: "informationnel",
    kbType: "guide",
    module: "transversal",
    cible: "toutes-cibles",
    priorite: 1,
    niveau: 3,
    injection: {
      h1: "Expert IA B2B franco-européen — Disponible pour vos interviews médias",
      metaTitle: "Expert IA B2B France — Interview médias | Axion-IA",
      metaDescription:
        "Cabinet spécialisé IA pour entreprises. Fondateurs disponibles pour radio, TV, presse écrite et podcasts. Réponse presse sous 48 h.",
      h2Variants: [
        "Qui sont les experts IA d'Axion-IA interviewables ?",
        "Formats d'intervention : radio, TV, presse écrite, podcast",
        "Prise de contact presse — disponibilités et formulaire",
      ],
    },
    urlCible: "/fr/presse/intervenants/",
    canonicalParent: "/fr/presse/",
    source: "manuel",
    note: "JSON-LD Person (speaker) — lier vers biographie fondateur et kit médias ; hreflang FR canonique",
  },

  // ── J1.6 ────────────────────────────────────────────────────────────────────
  {
    keyword: "porte-parole intelligence artificielle entreprises France",
    intent: "informationnel",
    kbType: "guide",
    module: "transversal",
    cible: "toutes-cibles",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Axion-IA — Porte-parole terrain sur l'IA en entreprise en France",
      metaTitle: "Porte-parole IA entreprises France | Axion-IA Presse",
      metaDescription:
        "Spécialisé dans l'IA appliquée aux PME et ETI françaises, Axion-IA prend la parole dans les médias avec des données terrain vérifiées.",
      h2Variants: [
        "Pourquoi un porte-parole IA ancré dans la réalité terrain ?",
        "Prises de position et données terrain disponibles pour la presse",
        "Demander un angle ou une citation pour votre article",
      ],
    },
    urlCible: "/fr/presse/",
    canonicalParent: "/fr/presse/",
    source: "manuel",
    note: "JSON-LD NewsroomPage + Person — s'assurer que la page presse contient une section 'Angles et prises de position disponibles'",
  },

  // ─────────────────────────────────────────────────────────────────────────────
  //  J2 — MÉDIAS CHERCHANT DES CHIFFRES / ÉTUDES IA
  //
  //  Douleur : Le rédacteur a besoin de données récentes et sourcées sur l'IA
  //  en entreprise en France. Il cherche un cabinet qui publie des chiffres,
  //  des études, des sondages exploitables avec attribution.
  //  Pages cibles : /fr/presse/chiffres-cles/ + /fr/presse/communiques/
  // ─────────────────────────────────────────────────────────────────────────────

  {
    keyword: "étude IA PME France chiffres 2026",
    intent: "informationnel",
    kbType: "guide",
    module: "transversal",
    cible: "toutes-cibles",
    priorite: 1,
    niveau: 2,
    injection: {
      h1: "Chiffres IA PME France 2026 — Données terrain Axion-IA exploitables par la presse",
      metaTitle: "Étude IA PME France 2026 — Chiffres & Sources | Axion-IA",
      metaDescription:
        "Axion-IA publie des chiffres terrain sur l'adoption de l'IA en PME françaises : gains de temps, ROI, freins identifiés. Libres de droits presse.",
      h2Variants: [
        "Quels chiffres clés sur l'IA en PME Axion-IA a-t-il collectés en 2026 ?",
        "Méthodologie : comment ces données terrain sont-elles produites ?",
        "Télécharger le rapport et les data press-ready",
      ],
    },
    urlCible: "/fr/presse/chiffres-cles/",
    canonicalParent: "/fr/presse/",
    source: "manuel",
    note: "JSON-LD NewsroomPage + Dataset — publier un rapport annuel ou semestriel en PDF téléchargeable avec citation obligatoire 'Source : Axion-IA'",
  },

  // ── J2.2 ────────────────────────────────────────────────────────────────────
  {
    keyword: "statistiques intelligence artificielle entreprises françaises 2026",
    intent: "informationnel",
    kbType: "guide",
    module: "transversal",
    cible: "toutes-cibles",
    priorite: 2,
    niveau: 2,
    injection: {
      h1: "Statistiques IA en entreprise France 2026 — Synthèse Axion-IA",
      metaTitle: "Statistiques IA entreprises France 2026 | Axion-IA Presse",
      metaDescription:
        "Taux d'adoption, économies réalisées, secteurs pionniers : Axion-IA compile les statistiques IA pour entreprises françaises à jour 2026.",
      h2Variants: [
        "Taux d'adoption de l'IA dans les PME et ETI françaises",
        "Économies de temps et gains financiers mesurés par secteur",
        "Sources et méthodologie — données citables en presse",
      ],
    },
    urlCible: "/fr/presse/chiffres-cles/",
    canonicalParent: "/fr/presse/",
    source: "manuel",
    note: "JSON-LD NewsroomPage — consolider les statistiques dans une page unique mise à jour trimestriellement ; lien 'Dernière mise à jour' visible",
  },

  // ── J2.3 ────────────────────────────────────────────────────────────────────
  {
    keyword: "cabinet IA France communiqué de presse",
    intent: "informationnel",
    kbType: "guide",
    module: "transversal",
    cible: "toutes-cibles",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Communiqués de presse Axion-IA — Actualités IA B2B en France",
      metaTitle: "Communiqués de presse — Cabinet IA France | Axion-IA",
      metaDescription:
        "Retrouvez tous les communiqués de presse d'Axion-IA : nouvelles offres, études terrain, partenariats, prises de parole presse IA B2B.",
      h2Variants: [
        "Derniers communiqués de presse Axion-IA",
        "Demander à être ajouté à la liste de diffusion presse",
        "Archives et historique des publications presse",
      ],
    },
    urlCible: "/fr/presse/communiques/",
    canonicalParent: "/fr/presse/",
    source: "manuel",
    note: "JSON-LD NewsroomPage + NewsArticle — chaque communiqué = slug /fr/presse/[slug] avec JSON-LD NewsArticle complet ; fil RSS dédié presse",
  },

  // ── J2.4 ────────────────────────────────────────────────────────────────────
  {
    keyword: "résultats IA PME concrets France source presse",
    intent: "informationnel",
    kbType: "case_study",
    module: "transversal",
    cible: "pme",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Résultats IA concrets en PME françaises — Sources presse vérifiées Axion-IA",
      metaTitle: "Résultats IA PME France — Sources presse | Axion-IA",
      metaDescription:
        "Axion-IA documente des cas réels d'IA en PME : -30 % temps facturation, automatisation relances, gains RH. Citations presse disponibles.",
      h2Variants: [
        "Résultats mesurés sur des PME françaises accompagnées par Axion-IA",
        "Verbatims et témoignages disponibles avec accord client",
        "Comment utiliser ces données dans vos articles ?",
      ],
    },
    urlCible: "/fr/presse/etudes-de-cas/",
    canonicalParent: "/fr/presse/",
    source: "manuel",
    note: "JSON-LD CaseStudy + NewsroomPage — les études de cas clients doivent préciser si le client autorise citation nommée ou anonymisée",
  },

  // ── J2.5 ────────────────────────────────────────────────────────────────────
  {
    keyword: "données ROI intelligence artificielle entreprise France",
    intent: "informationnel",
    kbType: "guide",
    module: "transversal",
    cible: "toutes-cibles",
    priorite: 2,
    niveau: 2,
    injection: {
      h1: "ROI de l'IA en entreprise France — Données et benchmarks 2026 Axion-IA",
      metaTitle: "ROI IA entreprise France 2026 — Données | Axion-IA Presse",
      metaDescription:
        "Axion-IA publie des données ROI IA vérifiées pour entreprises françaises : économies de temps, gains financiers, délais de rentabilité observés.",
      h2Variants: [
        "Quels ROI observés sur les projets IA accompagnés par Axion-IA ?",
        "Délai de retour sur investissement moyen selon la taille d'entreprise",
        "Télécharger le benchmark ROI IA 2026",
      ],
    },
    urlCible: "/fr/presse/chiffres-cles/",
    canonicalParent: "/fr/presse/",
    source: "manuel",
    note: "JSON-LD NewsroomPage + Dataset — inclure tableau comparatif ROI par secteur ; données agrégées et anonymisées issues des accompagnements réels",
  },

  // ── J2.6 ────────────────────────────────────────────────────────────────────
  {
    keyword: "baromètre adoption IA PME ETI France 2026",
    intent: "informationnel",
    kbType: "guide",
    module: "transversal",
    cible: "toutes-cibles",
    priorite: 2,
    niveau: 2,
    injection: {
      h1: "Baromètre Axion-IA 2026 — Adoption de l'IA dans les PME et ETI françaises",
      metaTitle: "Baromètre IA PME ETI France 2026 | Axion-IA Presse",
      metaDescription:
        "Axion-IA publie son baromètre annuel sur l'adoption de l'IA en entreprise : freins, usages leaders, secteurs en avance. Données citables.",
      h2Variants: [
        "Les grands enseignements du baromètre Axion-IA 2026",
        "Secteurs français les plus avancés dans l'adoption de l'IA",
        "Accéder au baromètre complet et aux tableaux de données",
      ],
    },
    urlCible: "/fr/presse/chiffres-cles/",
    canonicalParent: "/fr/presse/",
    source: "manuel",
    note: "JSON-LD NewsroomPage + Dataset — publiable sous forme de rapport PDF avec infographies ; format 'baromètre' très repris par la presse économique",
  },

  // ─────────────────────────────────────────────────────────────────────────────
  //  J3 — RÉDACTEURS DE CLASSEMENTS PRESSE
  //
  //  Douleur : Le rédacteur écrit un article de type "Top 10 cabinets IA France"
  //  ou "Meilleures agences IA 2026". Il cherche des acteurs référencés,
  //  légitimes, avec des pages presse claires.
  //  Pages cibles : /fr/presse/ + /fr/presse/kit-medias/
  // ─────────────────────────────────────────────────────────────────────────────

  {
    keyword: "meilleur cabinet IA France classement 2026",
    intent: "informationnel",
    kbType: "guide",
    module: "transversal",
    cible: "toutes-cibles",
    priorite: 2,
    niveau: 2,
    injection: {
      h1: "Axion-IA dans les classements cabinets IA France 2026 — Critères et positionnement",
      metaTitle: "Cabinet IA France classement 2026 | Axion-IA Presse",
      metaDescription:
        "Axion-IA figure parmi les cabinets IA B2B de référence en France. Retrouvez nos données de positionnement et critères pour les rédacteurs de classements.",
      h2Variants: [
        "Sur quels critères Axion-IA se positionne-t-il comme cabinet IA ?",
        "Données et références disponibles pour vos classements presse",
        "Contacter l'équipe pour inclure Axion-IA dans votre sélection",
      ],
    },
    urlCible: "/fr/presse/kit-medias/",
    canonicalParent: "/fr/presse/",
    source: "manuel",
    note: "JSON-LD NewsroomPage — NE PAS promettre un classement officiel non obtenu ; se positionner sur les critères objectifs (ancienneté, cas clients, secteurs couverts)",
  },

  // ── J3.2 ────────────────────────────────────────────────────────────────────
  {
    keyword: "top consultants IA France liste experts",
    intent: "informationnel",
    kbType: "guide",
    module: "transversal",
    cible: "toutes-cibles",
    priorite: 2,
    niveau: 2,
    injection: {
      h1: "Experts IA B2B France — Profils et spécialisations Axion-IA",
      metaTitle: "Consultants IA France — Experts & Profils | Axion-IA Presse",
      metaDescription:
        "Axion-IA réunit des experts IA spécialisés PME/ETI : formation, audit, implémentation, coaching. Profils détaillés disponibles pour la presse.",
      h2Variants: [
        "Les domaines d'expertise couverts par les consultants Axion-IA",
        "Profils biographiques disponibles pour vos articles",
        "Demander des portraits et citations pour vos classements",
      ],
    },
    urlCible: "/fr/presse/intervenants/",
    canonicalParent: "/fr/presse/",
    source: "manuel",
    note: "JSON-LD Person — une fiche par consultant/fondateur avec photo libre de droits, bio courte 100 mots, spécialités, secteurs maîtrisés",
  },

  // ── J3.3 ────────────────────────────────────────────────────────────────────
  {
    keyword: "cabinet IA France recommandé entreprises référence",
    intent: "informationnel",
    kbType: "guide",
    module: "transversal",
    cible: "toutes-cibles",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Axion-IA — Cabinet IA franco-européen recommandé par ses clients entreprises",
      metaTitle: "Cabinet IA recommandé France | Axion-IA — Références",
      metaDescription:
        "PME, ETI et grandes écoles font confiance à Axion-IA pour leurs projets IA. Références, témoignages et cas clients disponibles pour la presse.",
      h2Variants: [
        "Quels types d'entreprises font appel à Axion-IA ?",
        "Témoignages clients disponibles pour vos articles",
        "Secteurs de référence et cas emblématiques",
      ],
    },
    urlCible: "/fr/presse/etudes-de-cas/",
    canonicalParent: "/fr/presse/",
    source: "manuel",
    note: "JSON-LD NewsroomPage + Review — inclure citations clients avec prénom, poste, secteur ; anonymisable sur demande",
  },

  // ── J3.4 ────────────────────────────────────────────────────────────────────
  {
    keyword: "agence IA France référence presse spécialisée",
    intent: "informationnel",
    kbType: "guide",
    module: "transversal",
    cible: "toutes-cibles",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Axion-IA référencé dans la presse spécialisée IA et innovation",
      metaTitle: "Cabinet IA France presse spécialisée | Axion-IA",
      metaDescription:
        "Axion-IA est cité dans la presse tech et économique pour son approche terrain de l'IA en entreprise. Revue de presse et ressources médias disponibles.",
      h2Variants: [
        "Où Axion-IA a-t-il déjà été cité dans la presse ?",
        "Ressources médias disponibles pour les rédacteurs",
        "S'abonner au fil presse Axion-IA",
      ],
    },
    urlCible: "/fr/presse/",
    canonicalParent: "/fr/presse/",
    source: "manuel",
    note: "JSON-LD NewsroomPage — inclure une section 'Revue de presse' listant les citations médias existantes avec liens ; renforcer la preuve sociale éditoriale",
  },

  // ── J3.5 ────────────────────────────────────────────────────────────────────
  {
    keyword: "expert IA startup PME ETI France benchmark presse",
    intent: "informationnel",
    kbType: "guide",
    module: "transversal",
    cible: "toutes-cibles",
    priorite: 3,
    niveau: 3,
    injection: {
      h1: "Benchmark IA pour Startups, PME et ETI françaises — Axion-IA",
      metaTitle: "Benchmark IA France startups PME ETI | Axion-IA Presse",
      metaDescription:
        "Axion-IA publie des benchmarks IA différenciés par taille d'entreprise. Données comparatives libres de droits pour rédacteurs de classements.",
      h2Variants: [
        "Comment l'usage de l'IA diffère-t-il entre startup, PME et ETI ?",
        "Benchmarks et indicateurs par taille d'entreprise",
        "Télécharger les tableaux de données pour vos classements",
      ],
    },
    urlCible: "/fr/presse/chiffres-cles/",
    canonicalParent: "/fr/presse/",
    source: "manuel",
    note: "JSON-LD Dataset + NewsroomPage — différencier clairement les segments pour maximiser la pertinence lors du sourcing presse par type de média",
  },

  // ─────────────────────────────────────────────────────────────────────────────
  //  J4 — KIT MÉDIAS
  //
  //  Douleur : Le journaliste doit illustrer son article ou son plateau TV.
  //  Il cherche logos haute définition, photos presse, biographies courtes
  //  et citations prêtes à l'emploi. Un kit médias structuré réduit les allers-retours.
  //  Pages cibles : /fr/presse/kit-medias/
  // ─────────────────────────────────────────────────────────────────────────────

  {
    keyword: "kit presse cabinet IA France téléchargement",
    intent: "informationnel",
    kbType: "guide",
    module: "transversal",
    cible: "toutes-cibles",
    priorite: 1,
    niveau: 3,
    injection: {
      h1: "Kit presse Axion-IA — Logos, photos et biographies libres de droits",
      metaTitle: "Kit presse cabinet IA France | Axion-IA — Téléchargement",
      metaDescription:
        "Téléchargez le kit presse Axion-IA : logos HD (PNG/SVG), photos équipe libres de droits, biographies, citations clés et contacts presse.",
      h2Variants: [
        "Que contient le kit presse Axion-IA ?",
        "Télécharger logos, photos et biographies en haute résolution",
        "Conditions d'utilisation des visuels Axion-IA",
      ],
    },
    urlCible: "/fr/presse/kit-medias/",
    canonicalParent: "/fr/presse/",
    source: "manuel",
    note: "JSON-LD NewsroomPage — page kit médias avec ZIP téléchargeable contenant logos (PNG 1200px + SVG), 2-3 photos équipe 300 dpi, bio 50/100/200 mots",
  },

  // ── J4.2 ────────────────────────────────────────────────────────────────────
  {
    keyword: "logo Axion-IA téléchargement presse haute définition",
    intent: "informationnel",
    kbType: "guide",
    module: "transversal",
    cible: "toutes-cibles",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Logo Axion-IA en haute définition — Téléchargement libre pour la presse",
      metaTitle: "Logo Axion-IA HD — Téléchargement presse | Kit médias",
      metaDescription:
        "Téléchargez le logo officiel Axion-IA en PNG, SVG et fond blanc / fond sombre. Utilisation presse autorisée avec mention de la source.",
      h2Variants: [
        "Versions disponibles du logo Axion-IA (clair, sombre, monochrome)",
        "Règles d'utilisation du logo dans vos publications",
        "Télécharger le pack logos complet",
      ],
    },
    urlCible: "/fr/presse/kit-medias/",
    canonicalParent: "/fr/presse/",
    source: "manuel",
    note: "JSON-LD NewsroomPage + ImageObject — fournir logos SVG + PNG 1200px ; préciser usage autorisé et restrictions (pas de déformation, couleurs officielles)",
  },

  // ── J4.3 ────────────────────────────────────────────────────────────────────
  {
    keyword: "biographie fondateur expert IA France presse",
    intent: "informationnel",
    kbType: "guide",
    module: "transversal",
    cible: "toutes-cibles",
    priorite: 1,
    niveau: 3,
    injection: {
      h1: "Biographie fondateur Axion-IA — Expert IA B2B, profil presse complet",
      metaTitle: "Biographie fondateur Axion-IA — Expert IA France | Presse",
      metaDescription:
        "Retrouvez la biographie officielle du fondateur d'Axion-IA : parcours, expertises IA, secteurs accompagnés. Versions 50, 100 et 200 mots disponibles.",
      h2Variants: [
        "Parcours et spécialisation IA du fondateur",
        "Biographies en 50, 100 et 200 mots pour tous formats médias",
        "Photo presse haute résolution et citation officielle",
      ],
    },
    urlCible: "/fr/presse/kit-medias/",
    canonicalParent: "/fr/presse/",
    source: "manuel",
    note: "JSON-LD Person (founder) + NewsroomPage — inclure champ 'sameAs' LinkedIn/URL officielle ; biographies multiformats pour adaptation rapide par le journaliste",
  },

  // ── J4.4 ────────────────────────────────────────────────────────────────────
  {
    keyword: "photos presse cabinet IA France libres de droits",
    intent: "informationnel",
    kbType: "guide",
    module: "transversal",
    cible: "toutes-cibles",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Photos presse Axion-IA — Visuels libres de droits pour vos publications",
      metaTitle: "Photos presse cabinet IA France | Axion-IA Kit médias",
      metaDescription:
        "Téléchargez les photos presse officielles d'Axion-IA : équipe, interventions, plateaux. Libres de droits avec mention 'Photo : Axion-IA'.",
      h2Variants: [
        "Photos équipe et fondateur disponibles en haute résolution",
        "Photos d'intervention et de formation en entreprise",
        "Conditions d'utilisation et mention obligatoire",
      ],
    },
    urlCible: "/fr/presse/kit-medias/",
    canonicalParent: "/fr/presse/",
    source: "manuel",
    note: "JSON-LD ImageObject — chaque photo avec caption, credit 'Axion-IA', licence CC BY 4.0 ; liée au pipeline image-bank pour variants WebP/AVIF automatiques",
  },

  // ── J4.5 ────────────────────────────────────────────────────────────────────
  {
    keyword: "contact presse cabinet intelligence artificielle France",
    intent: "informationnel",
    kbType: "guide",
    module: "transversal",
    cible: "toutes-cibles",
    priorite: 1,
    niveau: 3,
    injection: {
      h1: "Contact presse Axion-IA — Joignez notre équipe médias sous 48 h",
      metaTitle: "Contact presse Axion-IA | Cabinet IA France — Médias",
      metaDescription:
        "Journalistes et rédacteurs : contactez l'équipe presse Axion-IA pour interviews, citations, chiffres et kit médias. Réponse garantie 48 h.",
      h2Variants: [
        "Comment contacter l'équipe presse Axion-IA ?",
        "Quel délai de réponse pour une demande presse urgente ?",
        "Formulaire de demande presse et ressources disponibles",
      ],
    },
    urlCible: "/fr/presse/",
    canonicalParent: "/fr/presse/",
    source: "manuel",
    note: "JSON-LD NewsroomPage + ContactPoint — email presse dédié, SLA 48 h affiché ; formulaire de contact avec champ 'deadline article' pour priorisation",
  },

  // ─────────────────────────────────────────────────────────────────────────────
  //  J5 — PRESSE SPÉCIALISÉE (RADIO, TV, PODCAST, CONFÉRENCE)
  //
  //  Douleur : Le producteur de podcast IA B2B, le directeur de programme radio
  //  ou l'organisateur de conférence cherche un intervenant solide, disponible,
  //  capable d'expliquer l'IA sans jargon à un public mixte.
  //  Pages cibles : /fr/intervenants/ + /fr/presse/
  // ─────────────────────────────────────────────────────────────────────────────

  {
    keyword: "IA en entreprise expert commentateur radio TV France",
    intent: "informationnel",
    kbType: "guide",
    module: "transversal",
    cible: "toutes-cibles",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Expert IA en entreprise — Commentateur disponible radio et TV en France",
      metaTitle: "Expert IA entreprise — Radio & TV France | Axion-IA",
      metaDescription:
        "Axion-IA met à disposition un expert IA B2B pour interventions radio et TV : pédagogique, terrain, disponible. Contactez-nous pour vos émissions.",
      h2Variants: [
        "Pourquoi faire appel à un expert terrain pour commenter l'IA en entreprise ?",
        "Types d'émissions et formats couverts par Axion-IA",
        "Demander une disponibilité pour votre émission",
      ],
    },
    urlCible: "/fr/intervenants/",
    canonicalParent: "/fr/presse/",
    source: "manuel",
    note: "JSON-LD Person (speaker) + BroadcastEvent — inclure expériences médias antérieures si disponibles ; biographie adaptée format radio (30 secondes de présentation)",
  },

  // ── J5.2 ────────────────────────────────────────────────────────────────────
  {
    keyword: "podcast intelligence artificielle B2B intervenant France",
    intent: "informationnel",
    kbType: "guide",
    module: "transversal",
    cible: "toutes-cibles",
    priorite: 1,
    niveau: 3,
    injection: {
      h1: "Invité podcast IA B2B — Expert Axion-IA disponible pour vos épisodes",
      metaTitle: "Podcast IA B2B — Intervenant France | Axion-IA",
      metaDescription:
        "Producteurs de podcasts IA : invitez un expert Axion-IA pour parler d'IA en entreprise avec des cas réels, des chiffres et une pédagogie accessible.",
      h2Variants: [
        "Quels sujets IA B2B Axion-IA couvre-t-il dans les podcasts ?",
        "Podcasts déjà réalisés et extraits disponibles",
        "Demander une participation à votre podcast",
      ],
    },
    urlCible: "/fr/intervenants/",
    canonicalParent: "/fr/presse/",
    source: "manuel",
    note: "JSON-LD Person + PodcastEpisode (si épisodes existants) — inclure liste de podcasts déjà réalisés avec liens ; angle différenciateur : cas concrets PME vs théorie",
  },

  // ── J5.3 ────────────────────────────────────────────────────────────────────
  {
    keyword: "conférence intelligence artificielle 2026 intervenants France",
    intent: "informationnel",
    kbType: "guide",
    module: "transversal",
    cible: "toutes-cibles",
    priorite: 2,
    niveau: 2,
    injection: {
      h1: "Intervenants IA pour conférences 2026 en France — Axion-IA",
      metaTitle: "Intervenants IA conférences France 2026 | Axion-IA",
      metaDescription:
        "Planifiez votre conférence IA 2026 avec un intervenant Axion-IA : keynote, table ronde, atelier. Spécialiste IA B2B avec cas terrain PME/ETI.",
      h2Variants: [
        "Formats d'intervention disponibles pour vos conférences IA",
        "Thèmes keynote 2026 : IA, automatisation, transformation des métiers",
        "Demander une disponibilité et un devis intervenant",
      ],
    },
    urlCible: "/fr/intervenants/",
    canonicalParent: "/fr/presse/",
    source: "manuel",
    note: "JSON-LD Person + Event — lister les prochaines conférences prévues si disponibles ; formulaire de demande d'intervention avec champ date/format/audience",
  },

  // ── J5.4 ────────────────────────────────────────────────────────────────────
  {
    keyword: "expert IA ETI France keynote transformation digitale",
    intent: "informationnel",
    kbType: "guide",
    module: "transversal",
    cible: "eti",
    priorite: 2,
    niveau: 3,
    injection: {
      h1: "Keynote IA pour ETI françaises — Expert Axion-IA pour vos séminaires",
      metaTitle: "Expert IA ETI France — Keynote & Séminaire | Axion-IA",
      metaDescription:
        "Axion-IA anime des keynotes sur l'IA pour ETI : transformation digitale, cas terrain, ROI concrets. Franco-européen, adapté à vos équipes dirigeantes.",
      h2Variants: [
        "Pourquoi une keynote IA spécifique aux défis des ETI ?",
        "Contenu typique d'une intervention Axion-IA pour comité de direction",
        "Réserver un intervenant pour votre séminaire annuel",
      ],
    },
    urlCible: "/fr/intervenants/",
    canonicalParent: "/fr/presse/",
    source: "manuel",
    note: "JSON-LD Person (speaker) + Event — angle ETI : enjeux de gouvernance IA, structuration des équipes, prise de décision dirigeant face à l'IA",
  },

  // ── J5.5 ────────────────────────────────────────────────────────────────────
  {
    keyword: "table ronde IA entreprise France organisateurs événements",
    intent: "informationnel",
    kbType: "guide",
    module: "transversal",
    cible: "toutes-cibles",
    priorite: 3,
    niveau: 3,
    injection: {
      h1: "Axion-IA en table ronde IA — Intervenant disponible pour vos événements",
      metaTitle: "Table ronde IA entreprise France | Axion-IA Intervenants",
      metaDescription:
        "Organisateurs d'événements : invitez Axion-IA à vos tables rondes IA. Expert terrain, pédagogique, capable de débattre des enjeux réels en entreprise.",
      h2Variants: [
        "Quel positionnement Axion-IA adopte-t-il en table ronde ?",
        "Sujets de débat maîtrisés par les experts Axion-IA",
        "Contact et disponibilité pour vos événements professionnels",
      ],
    },
    urlCible: "/fr/intervenants/",
    canonicalParent: "/fr/presse/",
    source: "manuel",
    note: "JSON-LD Person + Event — préciser la capacité à débattre avec des contradicteurs (industriels, élus, académiques) ; angle 'praticien terrain vs théoricien'",
  },

  // ── J5.6 ────────────────────────────────────────────────────────────────────
  {
    keyword: "formation presse journaliste intelligence artificielle entreprise",
    intent: "informationnel",
    kbType: "guide",
    module: "transversal",
    cible: "toutes-cibles",
    priorite: 3,
    niveau: 3,
    injection: {
      h1: "Axion-IA forme les journalistes aux enjeux réels de l'IA en entreprise",
      metaTitle: "Formation journalistes IA entreprise | Axion-IA Presse",
      metaDescription:
        "Rédactions et écoles de journalisme : Axion-IA propose des formations pour comprendre et couvrir l'IA en entreprise avec rigueur et cas concrets.",
      h2Variants: [
        "Pourquoi former les journalistes aux réalités de l'IA B2B ?",
        "Programme de sensibilisation IA pour rédactions et étudiants journalisme",
        "Contacter Axion-IA pour une intervention en école ou rédaction",
      ],
    },
    urlCible: "/fr/intervenants/",
    canonicalParent: "/fr/presse/",
    source: "manuel",
    note: "JSON-LD Person + Course — angle original et peu concurrentiel : positionner Axion-IA comme pédagogue de l'IA pour les prescripteurs d'opinion que sont les journalistes",
  },
];
