// MANUAL-REWRITE 2026-05-28 — Audit Will batch 100 #2 (qs moyen → premium).
// Chatou (78, Yvelines) — Boucle de Seine, berceau impressionniste (Maison Fournaise), capitale des antiquaires.

import type { VilleCopy } from "./types";

export const CHATOU_COPY: VilleCopy = {
  pitchFr:
    "Chatou (78, Yvelines), au cœur de la boucle de Seine et berceau de l'impressionnisme avec la Maison Fournaise sur l'île des Impressionnistes, est aussi la capitale française des antiquaires avec sa célèbre foire. Son tissu mêle TPE de commerce d'art et d'antiquités, artisans d'art, PME de services et d'ingénierie, professions libérales et commerces. Axion-IA accompagne en priorité ces TPE puis les PME, les ETI restant minoritaires.",
  pitchEn:
    "Chatou (78, Yvelines), au cœur de la boucle de Seine et berceau de l'impressionnisme avec la Maison Fournaise sur l'île des Impressionnistes, est aussi la capitale française des antiquaires avec sa célèbre foire. Son tissu mêle TPE de commerce d'art et d'antiquités, artisans d'art, PME de services et d'ingénierie, professions libérales et commerces. Axion-IA accompagne en priorité ces TPE puis les PME, les ETI restant minoritaires.",
  directAnswerFr:
    "Axion-IA est un cabinet d'architectes seniors en intelligence artificielle qui intervient à Chatou (78) et dans la boucle de Seine. Nous accompagnons en priorité les TPE — antiquaires, artisans d'art, commerces et indépendants — puis les PME de services et d'ingénierie de l'ouest parisien, et plus marginalement les ETI. Nous définissons un cas d'usage IA concret — catalogue, devis, relation client, gestion documentaire — avant tout déploiement, sur site ou en visio.",
  directAnswerEn:
    "Axion-IA est un cabinet d'architectes seniors en intelligence artificielle qui intervient à Chatou (78) et dans la boucle de Seine. Nous accompagnons en priorité les TPE — antiquaires, artisans d'art, commerces et indépendants — puis les PME de services et d'ingénierie de l'ouest parisien, et plus marginalement les ETI. Nous définissons un cas d'usage IA concret — catalogue, devis, relation client, gestion documentaire — avant tout déploiement, sur site ou en visio.",
  seoHook: "antiquaires & ouest parisien",
  ecosystemFr:
    "Chatou occupe la boucle de Seine entre Le Vésinet, Rueil-Malmaison et Croissy. Ville résidentielle aisée de l'ouest parisien, marquée par l'héritage impressionniste de la Maison Fournaise et la foire nationale à la brocante et aux jambons. Tissu de TPE d'antiquités et d'art, artisans d'art, PME de services et d'ingénierie, commerces de centre-ville et professions libérales.",
  ecosystemEn:
    "Chatou occupe la boucle de Seine entre Le Vésinet, Rueil-Malmaison et Croissy. Ville résidentielle aisée de l'ouest parisien, marquée par l'héritage impressionniste de la Maison Fournaise et la foire nationale à la brocante et aux jambons. Tissu de TPE d'antiquités et d'art, artisans d'art, PME de services et d'ingénierie, commerces de centre-ville et professions libérales.",
  distancesFr:
    "Paris-Saint-Lazare à 20 min par le RER A et la ligne L. La Défense à 12 min. Gare de Chatou-Croissy sur le RER A. Aéroport de Paris-Charles-de-Gaulle à 40 min. Rueil-Malmaison à 8 min.",
  distancesEn:
    "Paris-Saint-Lazare à 20 min par le RER A et la ligne L. La Défense à 12 min. Gare de Chatou-Croissy sur le RER A. Aéroport de Paris-Charles-de-Gaulle à 40 min. Rueil-Malmaison à 8 min.",
  topSectorsNaf: [
    "Commerce d'antiquités, d'art & brocante",
    "Artisanat d'art & restauration de mobilier",
    "Conseil & services aux entreprises",
    "Ingénierie & études techniques",
    "Commerce de détail & professions libérales",
  ],
  servicesContext: {
    audit: {
      fr: "Audit IA à Chatou : diagnostic ciblé pour les TPE d'antiquités et d'art, artisans et PME de services de la boucle de Seine, aboutissant à un cas d'usage prioritaire et un ROI chiffré.",
      en: "Audit IA à Chatou : diagnostic ciblé pour les TPE d'antiquités et d'art, artisans et PME de services de la boucle de Seine, aboutissant à un cas d'usage prioritaire et un ROI chiffré.",
    },
    interventions: {
      fr: "Interventions IA sur site à Chatou : ateliers pratiques pour l'antiquaire, l'artisan d'art, le commerce ou le cabinet de services. Vos collaborateurs sont autonomes ensuite.",
      en: "Interventions IA sur site à Chatou : ateliers pratiques pour l'antiquaire, l'artisan d'art, le commerce ou le cabinet de services. Vos collaborateurs sont autonomes ensuite.",
    },
    implementation: {
      fr: "Implémentation IA à Chatou : catalogue et estimation d'objets d'art assistés, classification d'images, devis, agents conversationnels et CRM augmentés pour TPE-PME de l'ouest parisien.",
      en: "Implémentation IA à Chatou : catalogue et estimation d'objets d'art assistés, classification d'images, devis, agents conversationnels et CRM augmentés pour TPE-PME de l'ouest parisien.",
    },
    unAUn: {
      fr: "Coaching 1-to-1 à Chatou : sessions pour dirigeants de TPE — antiquaires, artisans d'art, commerçants — et de PME de services, dans vos locaux ou en visio.",
      en: "Coaching 1-to-1 à Chatou : sessions pour dirigeants de TPE — antiquaires, artisans d'art, commerçants — et de PME de services, dans vos locaux ou en visio.",
    },
    sitesWeb: {
      fr: "Sites web augmentés à Chatou : galeries et boutiques en ligne enrichies d'IA pour antiquaires et commerces d'art — fiches objets générées, recherche visuelle, prise de contact qualifiée.",
      en: "Sites web augmentés à Chatou : galeries et boutiques en ligne enrichies d'IA pour antiquaires et commerces d'art — fiches objets générées, recherche visuelle, prise de contact qualifiée.",
    },
  },
  services: {
    sitesWeb: {
      fr: {
        hero: "Axion-IA conçoit des sites web et plateformes SaaS augmentés par l'IA à Chatou (78), dans la boucle de Seine. La commune a un tissu rare : sur l'Île des Impressionnistes cohabitent EDF Lab Chatou — site historique de la R&D du groupe EDF depuis 1946, cœur du Laboratoire National d'Hydraulique et Environnement (LNHE) et du laboratoire Saint-Venant — et la Foire nationale à la brocante et aux jambons, plus grande brocante de France (plus de 320 antiquaires SNCAO-GA depuis 1970). S'y ajoutent le siège du laboratoire pharmaceutique familial Mayoly Spindler (avenue de l'Europe), la présence de Thales et plus de 2 000 entreprises. Nous construisons des plateformes IA-native sur mesure pour ces profils : portails de calcul scientifique, marketplaces d'antiquités, sites e-commerce et vitrines multi-CMS — code custom, hébergement UE/RGPD, zéro lock-in éditeur.",
        whyHere: [
          "L'écosystème scientifique de Chatou — EDF Lab et son LNHE/laboratoire Saint-Venant sur l'Île des Impressionnistes (~500 chercheurs en hydraulique, calcul et simulation) — appelle des plateformes web techniques : portails de visualisation de données, interfaces de modèles, documentation interactive, et non de simples sites vitrines.",
          "La capitale française des antiquaires : les exposants de la Foire de Chatou et les marchands d'art de la boucle de Seine ont besoin de boutiques en ligne et marketplaces enrichies d'IA — fiches objets générées à partir d'une photo, recherche visuelle, estimation assistée, traduction pour l'acheteur international.",
          "Le siège de Mayoly Spindler (pharma/dermocosmétique familial fondé en 1899, avenue de l'Europe) et la présence de Thales installent une demande de SaaS B2B exigeants : portails partenaires, espaces réglementaires, applicatifs métier sécurisés, qu'une agence web généraliste ne sait pas livrer.",
          "Tissu de plus de 2 000 entreprises avec 553 créations en 2024, dont 181 en activités scientifiques, techniques et de soutien : PME de conseil et d'ingénierie, professions libérales et commerces de l'ouest parisien, tous candidats à un site web qui qualifie et convertit, pas seulement qui présente.",
        ],
        methodology: [
          {
            step: "Cadrage à Chatou",
            detail:
              "Kick-off sur site à Chatou ou en visio : nous cartographions votre besoin réel selon votre profil — portail technique type EDF Lab/LNHE, marketplace d'antiquaire, espace partenaire pharma façon Mayoly Spindler, ou vitrine e-commerce. Périmètre, parcours utilisateur et contraintes RGPD posés noir sur blanc.",
          },
          {
            step: "Architecture & maquettes",
            detail:
              "Conception UX/UI et wireframes mobile-first : choix de la stack (CMS headless, SaaS sur mesure, e-commerce multi-CMS) et des points d'IA — génération de fiches, recherche sémantique, agent conversationnel. Maquettes validées avant la moindre ligne de code.",
          },
          {
            step: "Développement & IA",
            detail:
              "Développement du site/plateforme avec les briques IA intégrées : fiches objets d'art générées depuis photo et recherche visuelle pour les antiquaires, chatbot RAG sur vos documents, search sémantique pour un portail scientifique. Code custom, pas de dépendance bloquante.",
          },
          {
            step: "Recette & contenus",
            detail:
              "Tests d'acceptation sur vos vraies données, optimisation Web Vitals (LCP, INP, CLS), accessibilité et SEO local boucle de Seine. Mise en place des contenus, traductions et fiches assistées par IA avec relecture humaine.",
          },
          {
            step: "Mise en ligne & autonomie",
            detail:
              "Déploiement, hébergement UE/RGPD, formation de votre équipe à la console et runbook remis. Vous gardez la main : code, contenus et modèles restent chez vous, reprenables en interne ou par tout intégrateur.",
          },
        ],
        pricing: [
          {
            sizeLabel: "TPE",
            price: "Site vitrine ou boutique IA",
            detail:
              "Antiquaires et marchands de la Foire de Chatou, artisans d'art, commerces et indépendants de la boucle de Seine : site vitrine ou boutique e-commerce avec fiches objets générées par IA et prise de contact qualifiée. Devis à partir de 48 h selon la complexité.",
          },
          {
            sizeLabel: "PME",
            price: "Plateforme web sur mesure",
            detail:
              "PME de conseil, d'ingénierie et de services scientifiques de l'ouest parisien : site ou application métier multi-CMS, espace client, chatbot RAG sur votre documentation, intégration CRM. Pour structures de quelques dizaines à 250 collaborateurs.",
          },
          {
            sizeLabel: "ETI",
            price: "SaaS IA-native & portails",
            detail:
              "Profils type laboratoire familial Mayoly Spindler ou ETI de la boucle de Seine : portail partenaires, espace réglementaire, SaaS B2B avec recherche sémantique et agents, sécurité et conformité dès la conception.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Plateformes & portails techniques",
            detail:
              "Profils type EDF Lab Chatou / LNHE ou Thales : portails de calcul et de données scientifiques, interfaces de modèles et de simulation, documentation interactive, gouvernance IA, déploiement multi-équipes.",
          },
        ],
        faq: [
          {
            q: "Concevez-vous des plateformes web pour les profils scientifiques type EDF Lab Chatou ?",
            a: "Oui. Pour les structures de R&D comme EDF Lab Chatou et son LNHE / laboratoire Saint-Venant (hydraulique, simulation, calcul), nous concevons des portails techniques : visualisation de données, interfaces de modèles, documentation interactive et recherche sémantique. Code custom, hébergement UE et conformité RGPD, sans verrou éditeur.",
          },
          {
            q: "Pouvez-vous faire une marketplace ou une boutique en ligne pour les antiquaires de Chatou ?",
            a: "Oui, c'est une spécificité locale. Pour les exposants de la Foire de Chatou et les marchands d'art de la boucle de Seine, nous construisons des boutiques et marketplaces enrichies d'IA : génération de fiches objets à partir d'une photo, recherche visuelle, estimation assistée et traduction pour les acheteurs internationaux.",
          },
          {
            q: "Faites-vous de l'e-commerce multi-CMS et du mobile, ou seulement du sur-mesure ?",
            a: "Les deux. Nous couvrons l'UX/UI, le responsive mobile-first et l'e-commerce sur plusieurs CMS (headless ou classiques) aussi bien que le SaaS développé sur mesure. Le choix dépend de votre besoin réel — boutique d'antiquaire, espace partenaire pharma type Mayoly Spindler ou portail technique — défini au cadrage à Chatou.",
          },
          {
            q: "En combien de temps ai-je un devis pour un site à Chatou ?",
            a: "À partir de 48 h selon la complexité après le cadrage initial. Nous précisons le périmètre, la stack et les briques IA, puis nous remettons un devis clair. Le kick-off se fait sur site à Chatou ou en visio.",
          },
          {
            q: "Où sont hébergées les données et suis-je dépendant d'Axion-IA ensuite ?",
            a: "Hébergement en Union européenne par défaut, conformité RGPD, minimisation des données. Aucun lock-in : code, contenus et modèles IA restent chez vous, reprenables en interne ou par tout intégrateur. Particulièrement important pour les profils réglementés de la boucle de Seine comme un laboratoire pharmaceutique.",
          },
        ],
        guarantees:
          "Devis clair à partir de 48 h selon la complexité, périmètre et stack écrits avant tout développement. Hébergement en Union européenne par défaut, conformité RGPD et minimisation des données — un standard exigé par les profils sensibles de Chatou, du laboratoire pharmaceutique Mayoly Spindler à la R&D d'EDF Lab. Web Vitals optimisés (LCP, INP, CLS), accessibilité et SEO local. Zéro lock-in : code, contenus et modèles restent votre propriété, repris en interne ou par tout intégrateur de l'ouest parisien. Aucun chiffre de performance ni témoignage inventé : nous nous engageons sur un livrable défini contractuellement.",
      },
      en: {
        hero: "Axion-IA builds AI-augmented websites and SaaS platforms in Chatou (78), in the Seine loop. The town has a rare fabric: on the Île des Impressionnistes, EDF Lab Chatou — the EDF group's historic R&D site since 1946 and home of the National Hydraulics and Environment Laboratory (LNHE) and the Saint-Venant lab — coexists with the national antiques and ham fair, France's largest flea market (over 320 SNCAO-GA antique dealers since 1970). Add the headquarters of the family-owned pharmaceutical lab Mayoly Spindler (avenue de l'Europe), a Thales presence and more than 2,000 companies. We build bespoke AI-native platforms for these profiles: scientific computing portals, antiques marketplaces, e-commerce sites and multi-CMS storefronts — custom code, EU/GDPR hosting, zero vendor lock-in.",
        whyHere: [
          "Chatou's scientific ecosystem — EDF Lab and its LNHE/Saint-Venant laboratory on the Île des Impressionnistes (~500 researchers in hydraulics, computing and simulation) — calls for technical web platforms: data visualization portals, model interfaces, interactive documentation, not mere brochure sites.",
          "France's antiques capital: exhibitors at the Foire de Chatou and the Seine-loop art dealers need AI-enhanced online shops and marketplaces — item listings generated from a photo, visual search, assisted appraisal, translation for the international buyer.",
          "The Mayoly Spindler headquarters (family pharma/dermocosmetics founded in 1899, avenue de l'Europe) and a Thales presence drive demand for demanding B2B SaaS: partner portals, regulatory spaces, secure business apps that a generalist web agency cannot deliver.",
          "A fabric of over 2,000 companies with 553 created in 2024, including 181 in scientific, technical and support activities: consulting and engineering SMEs, professionals and retailers of western Paris, all candidates for a website that qualifies and converts, not just presents.",
        ],
        methodology: [
          {
            step: "Framing in Chatou",
            detail:
              "On-site kick-off in Chatou or by video: we map your real need by profile — technical portal à la EDF Lab/LNHE, antique-dealer marketplace, pharma partner space à la Mayoly Spindler, or e-commerce storefront. Scope, user journey and GDPR constraints set down in writing.",
          },
          {
            step: "Architecture & mockups",
            detail:
              "UX/UI design and mobile-first wireframes: choice of stack (headless CMS, bespoke SaaS, multi-CMS e-commerce) and AI touchpoints — listing generation, semantic search, conversational agent. Mockups validated before a single line of code.",
          },
          {
            step: "Development & AI",
            detail:
              "Building the site/platform with AI blocks integrated: art-object listings generated from a photo and visual search for antique dealers, RAG chatbot on your documents, semantic search for a scientific portal. Custom code, no blocking dependency.",
          },
          {
            step: "Acceptance & content",
            detail:
              "Acceptance tests on your real data, Web Vitals optimization (LCP, INP, CLS), accessibility and Seine-loop local SEO. Content setup, translations and AI-assisted listings with human review.",
          },
          {
            step: "Go-live & autonomy",
            detail:
              "Deployment, EU/GDPR hosting, training of your team on the console and runbook handed over. You keep control: code, content and models stay with you, recoverable in-house or by any integrator.",
          },
        ],
        pricing: [
          {
            sizeLabel: "Micro-business",
            price: "AI storefront or shop",
            detail:
              "Antique dealers from the Foire de Chatou, art craftspeople, retailers and freelancers of the Seine loop: brochure site or e-commerce shop with AI-generated item listings and qualified contact capture. Quote from 48 h depending on complexity.",
          },
          {
            sizeLabel: "SME",
            price: "Bespoke web platform",
            detail:
              "Consulting, engineering and scientific-services SMEs of western Paris: multi-CMS site or business app, client area, RAG chatbot on your documentation, CRM integration. For structures from a few dozen to 250 staff.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "AI-native SaaS & portals",
            detail:
              "Profiles like the family lab Mayoly Spindler or Seine-loop mid-caps: partner portal, regulatory space, B2B SaaS with semantic search and agents, security and compliance by design.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Technical platforms & portals",
            detail:
              "Profiles like EDF Lab Chatou / LNHE or Thales: scientific computing and data portals, model and simulation interfaces, interactive documentation, AI governance, multi-team deployment.",
          },
        ],
        faq: [
          {
            q: "Do you design web platforms for scientific profiles like EDF Lab Chatou?",
            a: "Yes. For R&D structures such as EDF Lab Chatou and its LNHE / Saint-Venant laboratory (hydraulics, simulation, computing), we design technical portals: data visualization, model interfaces, interactive documentation and semantic search. Custom code, EU hosting and GDPR compliance, with no vendor lock-in.",
          },
          {
            q: "Can you build a marketplace or online shop for Chatou's antique dealers?",
            a: "Yes, it's a local specialty. For exhibitors at the Foire de Chatou and Seine-loop art dealers we build AI-enhanced shops and marketplaces: item listings generated from a photo, visual search, assisted appraisal and translation for international buyers.",
          },
          {
            q: "Do you do multi-CMS e-commerce and mobile, or only bespoke work?",
            a: "Both. We cover UX/UI, mobile-first responsive and e-commerce on several CMS (headless or classic) as well as bespoke SaaS development. The choice depends on your real need — antique-dealer shop, pharma partner space à la Mayoly Spindler or technical portal — defined at the framing in Chatou.",
          },
          {
            q: "How quickly do I get a quote for a website in Chatou?",
            a: "From 48 h depending on complexity after the initial framing. We specify scope, stack and AI blocks, then deliver a clear quote. The kick-off takes place on site in Chatou or by video.",
          },
          {
            q: "Where is data hosted and am I then dependent on Axion-IA?",
            a: "EU hosting by default, GDPR compliance, data minimization. No lock-in: code, content and AI models stay with you, recoverable in-house or by any integrator. Particularly important for regulated Seine-loop profiles such as a pharmaceutical laboratory.",
          },
        ],
        guarantees:
          "Clear quote from 48 h depending on complexity, scope and stack written before any development. EU hosting by default, GDPR compliance and data minimization — a standard required by Chatou's sensitive profiles, from the Mayoly Spindler pharmaceutical lab to EDF Lab R&D. Optimized Web Vitals (LCP, INP, CLS), accessibility and local SEO. Zero lock-in: code, content and models remain your property, taken over in-house or by any western-Paris integrator. No invented performance figures or testimonials: we commit to a contractually defined deliverable.",
      },
    },
  },

  faqGeolocalisee: [
    {
      q: "Axion-IA intervient-il à Chatou et dans la boucle de Seine ?",
      a: "Oui, Axion-IA intervient à Chatou et dans toute la boucle de Seine (Le Vésinet, Croissy, Rueil-Malmaison, Bougival). Nos consultants se déplacent sur site depuis Paris (RER A, 20 min) ou animent les sessions en visio.",
    },
    {
      q: "Accompagnez-vous les antiquaires et commerces d'art de Chatou ?",
      a: "Oui, c'est une spécificité locale. Pour les TPE d'antiquités, brocanteurs et artisans d'art, l'IA aide au catalogage, à l'estimation assistée, à la recherche visuelle d'objets et à la relation client.",
    },
    {
      q: "Quels secteurs accompagnez-vous en priorité à Chatou ?",
      a: "Nous accompagnons d'abord les TPE — antiquaires, artisans, commerces, indépendants — puis les PME de services et d'ingénierie de l'ouest parisien. Les ETI restent minoritaires sur la commune.",
    },
    {
      q: "Quel budget prévoir pour un audit IA à Chatou ?",
      a: "Nos tarifs sont publics et calibrés selon la taille, de la TPE à la PME. L'audit livre un cas d'usage prioritaire et un ROI chiffré avant tout déploiement.",
    },
    {
      q: "Comment se déroule une intervention IA à Chatou ?",
      a: "Nos consultants se déplacent depuis Paris (RER A, 20 min) ou La Défense (12 min). L'intervention dure au moins une journée, sous forme d'atelier pratique dans vos locaux, pour rendre vos équipes autonomes.",
    },
    {
      q: "Axion-IA respecte-t-il le RGPD lors de ses interventions à Chatou ?",
      a: "Oui, toutes nos interventions à Chatou sont conformes au RGPD : minimisation des données, hébergement maîtrisé et absence de dépendance bloquante aux outils déployés.",
    },
  ],
};
