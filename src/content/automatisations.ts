// Catalogue d'automatisations IA classées par fonction d'entreprise.
// Page /implementation : 8 cartes en entrée, chaque slug a sa page dédiée.
// Promesse forte : forfait fixe, pas de maintenance mensuelle imposée,
// bénéfice ressenti dès la livraison. Langage non-technique pour visiteurs
// non-informés (artisan → grand compte). Source design lock : titleEm
// terracotta italique, FR canonique, EN miroir.

export type AutomatisationSlug =
  | "service-client"
  | "ventes-prospection"
  | "marketing-communication"
  | "administratif"
  | "ressources-humaines"
  | "donnees-pilotage"
  | "metier-production"
  | "communication-interne";

interface AutomationItem {
  title: string;
  benefit: string;
  audience: string;
}

interface CategoryCopy {
  eyebrow: string;
  cardTitle: string;
  cardTagline: string;
  pageTitle: string;
  pageTitleEm: string;
  pageDescription: string;
  intro: string;
  itemsTitle: string;
  items: ReadonlyArray<AutomationItem>;
  customTitle: string;
  customDescription: string;
  metaTitle: string;
  metaDescription: string;
}

export interface AutomatisationCategory {
  slug: AutomatisationSlug;
  pathFr: string;
  pathEn: string;
  fr: CategoryCopy;
  en: CategoryCopy;
}

export const AUTOMATISATIONS: ReadonlyArray<AutomatisationCategory> = [
  {
    slug: "service-client",
    pathFr: "/implementation/par-fonction/service-client",
    pathEn: "/implementation/by-function/customer-service",
    fr: {
      eyebrow: "Service & Relation client",
      cardTitle: "Service client",
      cardTagline: "Répondre 24/7, mieux et plus vite — sans embaucher.",
      pageTitle: "Automatisations",
      pageTitleEm: "service client",
      pageDescription:
        "Vos clients obtiennent une réponse jour et nuit. Vos avis montent. Vos équipes ne croulent plus sous les mails.",
      intro:
        "Le service client est la fonction où l'IA donne le résultat le plus visible en premier : moins d'attente, plus d'avis positifs, des équipes soulagées. Voici ce qu'on peut installer chez vous, en forfait fixe, sans abonnement mensuel.",
      itemsTitle: "Ce que l'on installe",
      items: [
        {
          title: "Chatbot site web 24/7",
          benefit:
            "Vos clients obtiennent une réponse à 2h du matin. Vous récupérez des ventes pendant que vous dormez.",
          audience: "Tous secteurs · Artisan → Grand compte",
        },
        {
          title: "Tri et réponse automatique des mails",
          benefit:
            "Les mails entrants sont classés et pré-rédigés. Vous validez en 1 clic au lieu d'écrire pendant 30 minutes.",
          audience: "Tous secteurs",
        },
        {
          title: "Standard téléphonique IA",
          benefit:
            "Plus aucun appel raté. L'IA prend le message, qualifie l'appel et vous envoie un résumé clair.",
          audience: "TPE / PME / professions libérales",
        },
        {
          title: "Suivi satisfaction post-prestation",
          benefit:
            "Un SMS ou mail part automatiquement. Vous savez qui est content et qui rappeler avant qu'il parte.",
          audience: "Services, BTP, e-commerce",
        },
        {
          title: "Relance automatique des avis Google",
          benefit:
            "Vos étoiles montent toutes seules. Les clients satisfaits laissent un avis sans qu'on les harcèle.",
          audience: "Artisan, commerce, restauration",
        },
        {
          title: "Réponse automatique aux avis en ligne",
          benefit:
            "Tous vos avis Google, Trustpilot, TripAdvisor reçoivent une réponse pro et personnalisée. Votre image se renforce.",
          audience: "Restauration, hôtellerie, services",
        },
        {
          title: "Centre d'aide intelligent",
          benefit:
            "Vos clients trouvent leurs réponses seuls dans une base de connaissances qui apprend de leurs questions.",
          audience: "SaaS, e-commerce, services techniques",
        },
      ],
      customTitle: "Une autre automatisation en tête ?",
      customDescription:
        "Cette liste n'est pas exhaustive. Si vous avez une idée précise — un cas que vous voyez chez un concurrent, un agacement quotidien chez vos équipes, une demande récurrente de vos clients — décrivez-la. On revient avec un devis ferme sous 48h ouvrées.",
      metaTitle: "Automatisations IA service client · Axion-IA",
      metaDescription:
        "7 automatisations IA service client à installer en forfait fixe : chatbot 24/7, tri des mails, standard téléphonique, suivi satisfaction, relance avis, réponse aux avis, centre d'aide.",
    },
    en: {
      eyebrow: "Customer Service & Relations",
      cardTitle: "Customer service",
      cardTagline: "24/7 answers, better and faster — no extra hires.",
      pageTitle: "Customer service",
      pageTitleEm: "automations",
      pageDescription:
        "Your customers get answers day and night. Your reviews climb. Your teams stop drowning in emails.",
      intro:
        "Customer service is the area where AI delivers the most visible result first: less waiting, more positive reviews, relieved teams. Here is what we install for you, on a fixed fee, with no monthly subscription.",
      itemsTitle: "What we install",
      items: [
        {
          title: "24/7 website chatbot",
          benefit: "Your customers get answers at 2am. You capture sales while you sleep.",
          audience: "All sectors · SMB → Enterprise",
        },
        {
          title: "Automatic email triage and replies",
          benefit:
            "Incoming emails are sorted and pre-drafted. You validate in 1 click instead of writing for 30 minutes.",
          audience: "All sectors",
        },
        {
          title: "AI phone receptionist",
          benefit:
            "No more missed calls. AI takes the message, qualifies the call and sends you a clear summary.",
          audience: "Small business / freelance professionals",
        },
        {
          title: "Post-service satisfaction tracking",
          benefit:
            "An SMS or email goes out automatically. You know who is happy and who to call before they leave.",
          audience: "Services, construction, e-commerce",
        },
        {
          title: "Automatic Google review requests",
          benefit:
            "Your stars climb on their own. Satisfied customers leave reviews without being chased.",
          audience: "Trades, retail, hospitality",
        },
        {
          title: "Automatic replies to online reviews",
          benefit:
            "All your Google, Trustpilot, TripAdvisor reviews get professional, personalized answers. Your image strengthens.",
          audience: "Hospitality, services",
        },
        {
          title: "Smart help center",
          benefit:
            "Your customers find answers themselves in a knowledge base that learns from their questions.",
          audience: "SaaS, e-commerce, technical services",
        },
      ],
      customTitle: "Another automation in mind?",
      customDescription:
        "This list is not exhaustive. If you have a specific idea — something you saw at a competitor, a daily annoyance for your teams, a recurring customer request — describe it. We come back with a firm quote within 48 business hours.",
      metaTitle: "AI customer service automations · Axion-IA",
      metaDescription:
        "7 AI customer service automations on a fixed-fee basis: 24/7 chatbot, email triage, phone receptionist, satisfaction tracking, review requests, review replies, help center.",
    },
  },
  {
    slug: "ventes-prospection",
    pathFr: "/implementation/par-fonction/ventes-prospection",
    pathEn: "/implementation/by-function/sales-prospecting",
    fr: {
      eyebrow: "Ventes & Prospection",
      cardTitle: "Ventes & prospection",
      cardTagline: "Plus de leads qualifiés, plus de devis signés, sans embaucher de commerciaux.",
      pageTitle: "Automatisations",
      pageTitleEm: "ventes",
      pageDescription:
        "Vos commerciaux ne perdent plus leur temps. Vos devis partent en 30 secondes. Vos prospects vous trouvent au lieu de l'inverse.",
      intro:
        "La fonction commerciale est celle où l'IA fait gagner le plus d'argent visible : plus de devis envoyés, mieux ciblés, mieux relancés. On installe ces automatisations en forfait fixe, sans commission ni abonnement.",
      itemsTitle: "Ce que l'on installe",
      items: [
        {
          title: "Génération de devis en 30 secondes",
          benefit:
            "Vous décrivez le besoin à l'oral ou par mail, le devis sort prêt à envoyer. Vous faites 10 devis par matinée au lieu de 2.",
          audience: "Artisan, BTP, services B2B",
        },
        {
          title: "Prospection LinkedIn ciblée",
          benefit:
            "200 prospects qualifiés contactés chaque semaine avec un message personnalisé, sans commercial dédié.",
          audience: "B2B PME → ETI",
        },
        {
          title: "Scoring automatique des leads entrants",
          benefit:
            "Vos commerciaux n'appellent que les prospects chauds. Le taux de transformation double.",
          audience: "PME B2B, e-commerce premium",
        },
        {
          title: "Relance automatique des devis non signés",
          benefit: "Plus aucun devis oublié. Le taux de signature passe typiquement de 20 à 35 %.",
          audience: "Tous B2B",
        },
        {
          title: "Recherche automatique de prospects sur le web",
          benefit:
            "50 nouvelles cibles qualifiées (annuaires, Pages Jaunes, Maps, LinkedIn) chaque lundi matin.",
          audience: "Artisan, commerce, B2B local",
        },
        {
          title: "Assistant commercial pour préparer les RDV",
          benefit:
            "Avant chaque RDV, votre commercial reçoit une fiche : historique du client, actu de l'entreprise, points de douleur, accroches possibles.",
          audience: "PME B2B, grands comptes",
        },
        {
          title: "Suivi et priorisation du pipeline",
          benefit:
            "L'IA vous dit chaque matin sur quelles affaires se concentrer cette semaine pour maximiser le CA du mois.",
          audience: "PME B2B avec CRM (Salesforce, HubSpot, Pipedrive)",
        },
      ],
      customTitle: "Un cas commercial à part ?",
      customDescription:
        "Vente complexe, cycle long, plusieurs interlocuteurs, secteur réglementé — chaque entreprise a son tempo. Décrivez votre processus de vente actuel, on revient avec une proposition d'automatisation chiffrée sous 48h ouvrées.",
      metaTitle: "Automatisations IA ventes & prospection · Axion-IA",
      metaDescription:
        "7 automatisations IA ventes : génération devis 30s, prospection LinkedIn, scoring leads, relances, recherche prospects, assistant RDV, priorisation pipeline. Forfait fixe.",
    },
    en: {
      eyebrow: "Sales & Prospecting",
      cardTitle: "Sales & prospecting",
      cardTagline: "More qualified leads, more signed quotes, no extra sales hires.",
      pageTitle: "Sales",
      pageTitleEm: "automations",
      pageDescription:
        "Your salespeople stop wasting time. Your quotes go out in 30 seconds. Your prospects find you instead of the other way around.",
      intro:
        "Sales is where AI generates the most visible revenue: more quotes sent, better targeted, better followed up. We install these automations on a fixed fee, no commission, no subscription.",
      itemsTitle: "What we install",
      items: [
        {
          title: "30-second quote generation",
          benefit:
            "You describe the need by voice or email, the quote comes out ready to send. 10 quotes a morning instead of 2.",
          audience: "Trades, construction, B2B services",
        },
        {
          title: "Targeted LinkedIn prospecting",
          benefit:
            "200 qualified prospects contacted each week with a personalized message, no dedicated rep.",
          audience: "B2B SMB → mid-market",
        },
        {
          title: "Automatic inbound lead scoring",
          benefit: "Your reps only call hot prospects. Conversion rate doubles.",
          audience: "B2B SMB, premium e-commerce",
        },
        {
          title: "Automatic follow-up on unsigned quotes",
          benefit: "No quote forgotten. Sign rate typically goes from 20% to 35%.",
          audience: "All B2B",
        },
        {
          title: "Automatic web prospect research",
          benefit: "50 new qualified targets (directories, Maps, LinkedIn) every Monday morning.",
          audience: "Trades, local B2B",
        },
        {
          title: "Sales assistant for meeting prep",
          benefit:
            "Before each meeting, your rep gets a brief: customer history, company news, pain points, opening lines.",
          audience: "B2B SMB, enterprise",
        },
        {
          title: "Pipeline tracking and prioritization",
          benefit:
            "AI tells you each morning which deals to focus on this week to maximize the month.",
          audience: "B2B SMB with CRM (Salesforce, HubSpot, Pipedrive)",
        },
      ],
      customTitle: "A specific sales case?",
      customDescription:
        "Complex sale, long cycle, multiple stakeholders, regulated industry — every business has its rhythm. Describe your current sales process, we come back with a costed proposal within 48 business hours.",
      metaTitle: "AI sales & prospecting automations · Axion-IA",
      metaDescription:
        "7 AI sales automations: 30s quote generation, LinkedIn prospecting, lead scoring, follow-ups, prospect research, meeting assistant, pipeline prioritization. Fixed fee.",
    },
  },
  {
    slug: "marketing-communication",
    pathFr: "/implementation/par-fonction/marketing-communication",
    pathEn: "/implementation/by-function/marketing-communication",
    fr: {
      eyebrow: "Marketing & Communication",
      cardTitle: "Marketing & com'",
      cardTagline: "Publier, écrire, créer — 10x plus vite, sans agence.",
      pageTitle: "Automatisations",
      pageTitleEm: "marketing",
      pageDescription:
        "Vos posts partent tous seuls. Votre site remonte sur Google. Vos visuels se créent en 30 secondes. Sans graphiste, sans rédacteur.",
      intro:
        "Le marketing est l'usage IA où l'on voit le résultat dans les 7 jours : plus de présence en ligne, plus de visibilité, moins de coûts d'agence. Forfait fixe, vous restez propriétaire de tout ce qu'on installe.",
      itemsTitle: "Ce que l'on installe",
      items: [
        {
          title: "Création automatique de posts réseaux sociaux",
          benefit:
            "Un mois de contenu (LinkedIn, Instagram, Facebook) généré en 1 heure. Vous publiez 3x par semaine sans y penser.",
          audience: "Tous secteurs",
        },
        {
          title: "Newsletter automatique",
          benefit:
            "Votre newsletter part chaque vendredi, alimentée par votre blog, vos actus ou un fil RSS choisi.",
          audience: "Tous secteurs",
        },
        {
          title: "Génération d'articles SEO",
          benefit:
            "Votre site remonte sur Google sur vos mots-clés métier, sans payer 1 500 €/mois à une agence." /* price-exempt: coût agence SEO concurrente, pas un tarif Axion-IA */,
          audience: "TPE → ETI",
        },
        {
          title: "Création de visuels produits",
          benefit:
            "Photos détourées, fonds blancs, bannières, fiches produits — générées en 30 secondes par visuel.",
          audience: "E-commerce, artisan, commerce",
        },
        {
          title: "Réponse automatique aux DM Instagram et Messenger",
          benefit: "Vous convertissez les DM en clients pendant que vous travaillez ou dormez.",
          audience: "Commerce, artisan, marques DTC",
        },
        {
          title: "Optimisation automatique des campagnes ads",
          benefit:
            "L'IA ajuste vos budgets, vos audiences et vos créas chaque jour pour maximiser votre ROAS.",
          audience: "E-commerce, B2B avec budget ads",
        },
        {
          title: "Personnalisation du site web selon le visiteur",
          benefit:
            "Le site change automatiquement (titre, image, témoignage) selon d'où vient le visiteur. Le taux de conversion grimpe.",
          audience: "E-commerce premium, SaaS",
        },
      ],
      customTitle: "Un besoin marketing spécifique ?",
      customDescription:
        "Stratégie de contenu sur un secteur précis, automatisation d'un événement annuel, gestion d'une communauté multi-langue — toute idée se chiffre. Décrivez le besoin, on revient sous 48h.",
      metaTitle: "Automatisations IA marketing & communication · Axion-IA",
      metaDescription:
        "7 automatisations IA marketing : posts réseaux sociaux, newsletter, articles SEO, visuels produits, DM Instagram, ads, personnalisation site. Forfait fixe.",
    },
    en: {
      eyebrow: "Marketing & Communications",
      cardTitle: "Marketing & comms",
      cardTagline: "Publish, write, create — 10x faster, no agency needed.",
      pageTitle: "Marketing",
      pageTitleEm: "automations",
      pageDescription:
        "Your posts go out by themselves. Your site climbs on Google. Your visuals get created in 30 seconds. No designer, no copywriter.",
      intro:
        "Marketing is where AI shows results within 7 days: more online presence, more visibility, fewer agency costs. Fixed fee, you own everything we install.",
      itemsTitle: "What we install",
      items: [
        {
          title: "Automatic social media post creation",
          benefit:
            "A month of content (LinkedIn, Instagram, Facebook) generated in 1 hour. You post 3x a week without thinking about it.",
          audience: "All sectors",
        },
        {
          title: "Automatic newsletter",
          benefit:
            "Your newsletter goes out every Friday, fed by your blog, news or a chosen RSS feed.",
          audience: "All sectors",
        },
        {
          title: "SEO article generation",
          benefit:
            "Your site climbs on Google on your industry keywords, without paying €1,500/month to an agency." /* price-exempt: competitor SEO agency cost, not an Axion-IA price */,
          audience: "Small business → mid-market",
        },
        {
          title: "Product visual creation",
          benefit:
            "Cropped photos, white backgrounds, banners, product sheets — generated in 30 seconds per visual.",
          audience: "E-commerce, retail, trades",
        },
        {
          title: "Automatic replies to Instagram and Messenger DMs",
          benefit: "You convert DMs into customers while you work or sleep.",
          audience: "Retail, DTC brands",
        },
        {
          title: "Automatic ad campaign optimization",
          benefit: "AI adjusts your budgets, audiences and creatives daily to maximize ROAS.",
          audience: "E-commerce, B2B with ad budget",
        },
        {
          title: "Visitor-based website personalization",
          benefit:
            "The site changes automatically (headline, image, testimonial) based on where the visitor came from. Conversion climbs.",
          audience: "Premium e-commerce, SaaS",
        },
      ],
      customTitle: "A specific marketing need?",
      customDescription:
        "Content strategy in a specific sector, annual event automation, multi-language community management — any idea can be quoted. Describe the need, we come back within 48h.",
      metaTitle: "AI marketing & communication automations · Axion-IA",
      metaDescription:
        "7 AI marketing automations: social posts, newsletter, SEO articles, product visuals, Instagram DMs, ads, site personalization. Fixed fee.",
    },
  },
  {
    slug: "administratif",
    pathFr: "/implementation/par-fonction/administratif",
    pathEn: "/implementation/by-function/back-office",
    fr: {
      eyebrow: "Administratif & Back-office",
      cardTitle: "Administratif",
      cardTagline: "Vous ne tapez plus jamais une facture, ni un contrat, ni un compte-rendu.",
      pageTitle: "Automatisations",
      pageTitleEm: "back-office",
      pageDescription:
        "Vos équipes administratives gagnent une demi-journée par jour. Les erreurs de saisie disparaissent. Le classement se fait tout seul.",
      intro:
        "Le back-office est l'usage IA le moins glamour mais le plus rentable : c'est là que vos équipes perdent le plus de temps sur des tâches répétitives. On automatise au forfait, sans abonnement.",
      itemsTitle: "Ce que l'on installe",
      items: [
        {
          title: "Lecture et saisie automatique des factures fournisseurs",
          benefit:
            "Vous ne tapez plus jamais une facture. Tout est lu, classé et envoyé à votre comptable automatiquement.",
          audience: "Tous secteurs",
        },
        {
          title: "Tri et classement automatique des mails et pièces jointes",
          benefit: "Votre boîte mail se range toute seule. Vous n'archivez plus rien à la main.",
          audience: "Tous secteurs",
        },
        {
          title: "Pré-remplissage automatique des contrats et bons de commande",
          benefit:
            "Un contrat client = 3 minutes au lieu de 30. Avec relecture juridique intégrée.",
          audience: "BTP, immobilier, services B2B",
        },
        {
          title: "Extraction de données depuis vos PDF",
          benefit:
            "Devis fournisseurs, fiches techniques, contrats — les chiffres sortent dans Excel sans copier-coller.",
          audience: "Achats, comptabilité, bureaux d'études",
        },
        {
          title: "Rapprochement bancaire automatique",
          benefit:
            "Vos écritures comptables sont pré-mâchées. Votre comptable boucle les mois en 2h au lieu de 2 jours.",
          audience: "TPE / PME",
        },
        {
          title: "Compte-rendu automatique de réunion",
          benefit:
            "Plus jamais de prise de notes. Un résumé clair, des décisions et des actions arrivent par mail dès la fin du Zoom/Teams/Meet.",
          audience: "Tous secteurs",
        },
        {
          title: "Génération automatique de bons de commande",
          benefit:
            "Vos achats récurrents (consommables, matières premières) sont déclenchés automatiquement au bon moment.",
          audience: "Restauration, industrie, commerce",
        },
      ],
      customTitle: "Un autre processus à automatiser ?",
      customDescription:
        "Toute tâche administrative répétitive est automatisable : déclarations sociales, notes de frais, relances clients, états de stock. Décrivez le processus actuel et le volume mensuel, on revient avec un devis sous 48h.",
      metaTitle: "Automatisations IA administratif & back-office · Axion-IA",
      metaDescription:
        "7 automatisations IA back-office : saisie factures, tri mails, contrats, extraction PDF, rapprochement bancaire, comptes-rendus, bons de commande. Forfait fixe.",
    },
    en: {
      eyebrow: "Back-office & Admin",
      cardTitle: "Back-office",
      cardTagline: "You never type an invoice, a contract, or meeting notes again.",
      pageTitle: "Back-office",
      pageTitleEm: "automations",
      pageDescription:
        "Your admin teams save half a day, every day. Data entry errors disappear. Filing happens by itself.",
      intro:
        "Back-office is the least glamorous but most profitable AI use: this is where your teams waste the most time on repetitive tasks. Fixed-fee automation, no subscription.",
      itemsTitle: "What we install",
      items: [
        {
          title: "Automatic supplier invoice reading and entry",
          benefit:
            "You never type an invoice again. Everything is read, filed and sent to your accountant automatically.",
          audience: "All sectors",
        },
        {
          title: "Automatic email and attachment sorting",
          benefit: "Your inbox files itself. You stop archiving by hand.",
          audience: "All sectors",
        },
        {
          title: "Automatic pre-fill of contracts and purchase orders",
          benefit: "A customer contract = 3 minutes instead of 30. With built-in legal review.",
          audience: "Construction, real estate, B2B services",
        },
        {
          title: "Data extraction from your PDFs",
          benefit:
            "Supplier quotes, spec sheets, contracts — numbers land in Excel without copy-paste.",
          audience: "Procurement, accounting, engineering",
        },
        {
          title: "Automatic bank reconciliation",
          benefit:
            "Your bookkeeping entries are pre-chewed. Your accountant closes months in 2h instead of 2 days.",
          audience: "Small business",
        },
        {
          title: "Automatic meeting minutes",
          benefit:
            "Never take notes again. A clear summary, decisions and actions land by email the moment the Zoom/Teams/Meet ends.",
          audience: "All sectors",
        },
        {
          title: "Automatic purchase order generation",
          benefit:
            "Your recurring purchases (consumables, raw materials) trigger themselves at the right moment.",
          audience: "Hospitality, manufacturing, retail",
        },
      ],
      customTitle: "Another process to automate?",
      customDescription:
        "Any repetitive admin task can be automated: payroll filings, expenses, customer reminders, inventory reports. Describe the current process and monthly volume, we come back with a quote within 48h.",
      metaTitle: "AI back-office & admin automations · Axion-IA",
      metaDescription:
        "7 AI back-office automations: invoice entry, email sorting, contracts, PDF extraction, bank reconciliation, meeting minutes, purchase orders. Fixed fee.",
    },
  },
  {
    slug: "ressources-humaines",
    pathFr: "/implementation/par-fonction/ressources-humaines",
    pathEn: "/implementation/by-function/human-resources",
    fr: {
      eyebrow: "RH & Formation",
      cardTitle: "Ressources humaines",
      cardTagline: "Recruter mieux, former plus vite, garder vos talents.",
      pageTitle: "Automatisations",
      pageTitleEm: "RH",
      pageDescription:
        "Vous traitez 200 CV en 5 minutes. Vos nouveaux sont opérationnels en 1 semaine. Vos équipes ne posent plus 50 fois la même question.",
      intro:
        "L'IA appliquée aux RH fait gagner du temps sur le recrutement, l'onboarding et le quotidien des équipes. Tout au forfait, sans abonnement par utilisateur.",
      itemsTitle: "Ce que l'on installe",
      items: [
        {
          title: "Tri automatique des CV reçus",
          benefit:
            "200 CV deviennent 10 finalistes en 5 minutes, avec scoring par adéquation au poste et raisons claires.",
          audience: "PME → grand groupe (recrutement actif)",
        },
        {
          title: "Réponse automatique aux candidats",
          benefit:
            "Aucun candidat n'attend une réponse. Refus argumentés, convocations, relances — tout part automatiquement et reste humain.",
          audience: "Tous recruteurs",
        },
        {
          title: "Chatbot interne sur vos procédures",
          benefit:
            "Vos équipes obtiennent une réponse instantanée à toutes leurs questions RH/IT/paie. Plus de tickets, plus d'interruptions.",
          audience: "PME → ETI (>30 personnes)",
        },
        {
          title: "Génération automatique de fiches de poste",
          benefit: "Une fiche pro, conforme et attractive en 2 minutes au lieu de 2 heures.",
          audience: "RH actifs, cabinets de recrutement",
        },
        {
          title: "Onboarding automatisé d'un nouveau salarié",
          benefit:
            "Parcours J-1 / J+1 / J+7 / J+30 envoyé automatiquement. Plus aucun nouveau perdu les premiers jours.",
          audience: "PME → grand groupe",
        },
        {
          title: "Gestion intelligente des plannings et congés",
          benefit:
            "Les conflits de planning sont détectés à l'avance. Les remplacements proposés automatiquement.",
          audience: "Restauration, retail, santé, industrie",
        },
        {
          title: "Détection des signaux faibles de démission",
          benefit:
            "L'IA analyse les signaux (mails, calendrier, absences) et alerte le manager avant que le talent ne parte.",
          audience: "Grandes équipes >100 personnes",
        },
      ],
      customTitle: "Un sujet RH spécifique ?",
      customDescription:
        "Politique de mobilité interne, automatisation des entretiens annuels, formation continue à la carte — chaque organisation a ses priorités RH. Décrivez le besoin, on revient sous 48h.",
      metaTitle: "Automatisations IA ressources humaines · Axion-IA",
      metaDescription:
        "7 automatisations IA RH : tri CV, réponse candidats, chatbot procédures, fiches de poste, onboarding, plannings, signaux démission. Forfait fixe.",
    },
    en: {
      eyebrow: "HR & Training",
      cardTitle: "Human resources",
      cardTagline: "Hire better, train faster, keep your people.",
      pageTitle: "HR",
      pageTitleEm: "automations",
      pageDescription:
        "200 CVs in 5 minutes. New hires up to speed in 1 week. Teams stop asking the same question 50 times.",
      intro:
        "AI applied to HR saves time on hiring, onboarding and daily team operations. All on fixed fees, no per-seat subscription.",
      itemsTitle: "What we install",
      items: [
        {
          title: "Automatic CV screening",
          benefit:
            "200 CVs become 10 finalists in 5 minutes, with role-fit scoring and clear reasons.",
          audience: "SMB → enterprise (active recruiting)",
        },
        {
          title: "Automatic candidate replies",
          benefit:
            "No candidate waits for an answer. Reasoned rejections, interview invites, follow-ups — all automated, all human-feeling.",
          audience: "All recruiters",
        },
        {
          title: "Internal chatbot on your procedures",
          benefit:
            "Your teams get instant answers to all HR/IT/payroll questions. No more tickets, no more interruptions.",
          audience: "SMB → mid-market (>30 people)",
        },
        {
          title: "Automatic job description generation",
          benefit: "A professional, compliant, attractive job ad in 2 minutes instead of 2 hours.",
          audience: "Active HR, search firms",
        },
        {
          title: "Automated new-hire onboarding",
          benefit:
            "D-1 / D+1 / D+7 / D+30 journey sent automatically. No new hire lost in the first days.",
          audience: "SMB → enterprise",
        },
        {
          title: "Smart scheduling and leave management",
          benefit: "Schedule conflicts caught early. Replacements suggested automatically.",
          audience: "Hospitality, retail, healthcare, manufacturing",
        },
        {
          title: "Early-attrition signal detection",
          benefit:
            "AI watches signals (emails, calendar, absences) and alerts the manager before the talent leaves.",
          audience: "Large teams >100 people",
        },
      ],
      customTitle: "A specific HR topic?",
      customDescription:
        "Internal mobility policy, automated annual reviews, on-demand learning — every organization has its HR priorities. Describe the need, we come back within 48h.",
      metaTitle: "AI HR automations · Axion-IA",
      metaDescription:
        "7 AI HR automations: CV screening, candidate replies, procedure chatbot, job descriptions, onboarding, scheduling, attrition signals. Fixed fee.",
    },
  },
  {
    slug: "donnees-pilotage",
    pathFr: "/implementation/par-fonction/donnees-pilotage",
    pathEn: "/implementation/by-function/data-analytics",
    fr: {
      eyebrow: "Données & Pilotage",
      cardTitle: "Données & pilotage",
      cardTagline: "Voir votre boîte en un coup d'œil. Décider sans tâtonner.",
      pageTitle: "Automatisations",
      pageTitleEm: "données",
      pageDescription:
        "Vos chiffres se mettent à jour tout seuls. Les anomalies vous sont signalées. Vous savez sur quoi vous concentrer chaque matin.",
      intro:
        "L'IA transforme vos données dispersées en décisions claires. On installe des tableaux de bord et des analyses qui parlent en langage humain, pas en formules.",
      itemsTitle: "Ce que l'on installe",
      items: [
        {
          title: "Tableau de bord IA mis à jour automatiquement",
          benefit:
            "Chaque matin, vous voyez votre boîte en un coup d'œil : CA, marges, alertes, points à traiter aujourd'hui.",
          audience: "TPE → ETI",
        },
        {
          title: "Analyse client automatique",
          benefit:
            "L'IA vous dit qui rapporte vraiment, qui coûte, qui va partir. Vous arrêtez de gaspiller votre énergie commerciale.",
          audience: "Tous B2B, e-commerce",
        },
        {
          title: "Détection des clients à risque de partir",
          benefit:
            "Vous êtes alerté avant qu'un client mécontent s'en aille. Vous le rattrapez à temps, vous gardez le CA.",
          audience: "Abonnement, services récurrents, B2B SaaS",
        },
        {
          title: "Synthèse automatique des retours clients",
          benefit:
            "Avis, mails, tickets, sondages — l'IA en sort les 3 vraies douleurs récurrentes. Vous savez quoi corriger en priorité.",
          audience: "Tous secteurs",
        },
        {
          title: "Veille concurrentielle automatisée",
          benefit:
            "Prix, nouveautés, communication, recrutements de la concurrence — un résumé hebdo dans votre boîte mail. Plus 2h/semaine perdues.",
          audience: "E-commerce, B2B, retail",
        },
        {
          title: "Prévisions de vente",
          benefit:
            "Vous savez quel sera votre CA dans 30 / 60 / 120 jours, par produit et par client. Vous achetez juste, vous staffez juste.",
          audience: "E-commerce, industrie, distribution",
        },
        {
          title: "Détection automatique d'anomalies",
          benefit:
            "Fraude, erreur de stock, anomalie de qualité, dérive de coût — l'IA repère ce qu'aucun humain ne verrait à temps.",
          audience: "E-commerce, industrie, finance",
        },
      ],
      customTitle: "Une analyse spécifique à automatiser ?",
      customDescription:
        "Analyse de cohorte, segmentation marketing, scoring de risque — tout indicateur que vous regardez aujourd'hui à la main peut être automatisé. Décrivez ce que vous suivez en Excel, on revient avec un devis sous 48h.",
      metaTitle: "Automatisations IA données & pilotage · Axion-IA",
      metaDescription:
        "7 automatisations IA pilotage : tableaux de bord, analyse client, détection churn, retours clients, veille, prévisions, anomalies. Forfait fixe.",
    },
    en: {
      eyebrow: "Data & Decision-making",
      cardTitle: "Data & analytics",
      cardTagline: "See your business at a glance. Decide without guessing.",
      pageTitle: "Data",
      pageTitleEm: "automations",
      pageDescription:
        "Your numbers update themselves. Anomalies get flagged. You know what to focus on every morning.",
      intro:
        "AI turns your scattered data into clear decisions. We install dashboards and analyses that speak in human language, not formulas.",
      itemsTitle: "What we install",
      items: [
        {
          title: "Auto-updated AI dashboard",
          benefit:
            "Every morning, you see your business at a glance: revenue, margins, alerts, today's priorities.",
          audience: "Small business → mid-market",
        },
        {
          title: "Automatic customer analysis",
          benefit:
            "AI tells you who actually drives revenue, who costs you, who is about to leave. You stop wasting commercial energy.",
          audience: "All B2B, e-commerce",
        },
        {
          title: "Customer-churn risk detection",
          benefit:
            "You get alerted before an unhappy customer leaves. You save the deal in time, you keep the revenue.",
          audience: "Subscription, recurring services, B2B SaaS",
        },
        {
          title: "Automatic synthesis of customer feedback",
          benefit:
            "Reviews, emails, tickets, surveys — AI pulls out the 3 recurring real pains. You know what to fix first.",
          audience: "All sectors",
        },
        {
          title: "Automated competitive intelligence",
          benefit:
            "Competitor prices, launches, comms, hires — a weekly summary in your inbox. No more 2h/week lost.",
          audience: "E-commerce, B2B, retail",
        },
        {
          title: "Sales forecasting",
          benefit:
            "You know your revenue in 30 / 60 / 120 days, by product and customer. You buy right, you staff right.",
          audience: "E-commerce, manufacturing, distribution",
        },
        {
          title: "Automatic anomaly detection",
          benefit:
            "Fraud, stock errors, quality drift, cost overruns — AI spots what no human would catch in time.",
          audience: "E-commerce, manufacturing, finance",
        },
      ],
      customTitle: "A specific analysis to automate?",
      customDescription:
        "Cohort analysis, marketing segmentation, risk scoring — any indicator you watch by hand today can be automated. Describe what you track in Excel, we come back with a quote within 48h.",
      metaTitle: "AI data & analytics automations · Axion-IA",
      metaDescription:
        "7 AI analytics automations: dashboards, customer analysis, churn detection, feedback, intel, forecasting, anomalies. Fixed fee.",
    },
  },
  {
    slug: "metier-production",
    pathFr: "/implementation/par-fonction/metier-production",
    pathEn: "/implementation/by-function/operations",
    fr: {
      eyebrow: "Métier & Production",
      cardTitle: "Métier & production",
      cardTagline: "L'IA dans votre cœur de métier — diagnostic, chiffrage, terrain.",
      pageTitle: "Automatisations",
      pageTitleEm: "métier",
      pageDescription:
        "Le BTP chiffre 3x plus vite. Le restaurateur commande sans y penser. Le SAV diagnostique en 30 secondes.",
      intro:
        "Selon votre secteur, l'IA peut s'installer au cœur même de votre métier — pas seulement en support. Voici les usages les plus rentables, par profession.",
      itemsTitle: "Ce que l'on installe",
      items: [
        {
          title: "Chiffrage automatique de chantier (BTP, rénovation)",
          benefit:
            "Vous chiffrez un chantier complet (matériaux, main d'œuvre, marges) en 10 minutes au lieu de 2 heures. À partir d'un brief vocal ou de photos.",
          audience: "Artisan, BTP, rénovation",
        },
        {
          title: "Génération automatique de menus et commandes fournisseurs",
          benefit:
            "Vos menus sont générés selon les arrivages, les saisons et la marge cible. Les commandes partent toutes seules le dimanche.",
          audience: "Restauration, traiteurs, collectivités",
        },
        {
          title: "Assistant juridique et conformité",
          benefit:
            "Contrats vérifiés en 30 secondes. RGPD, CGV, baux, accords de confidentialité — toutes vos pièces juridiques relues par l'IA avant signature.",
          audience: "PME, cabinets, professions libérales",
        },
        {
          title: "Aide au diagnostic (médical, technique, SAV)",
          benefit:
            "Vos techniciens trouvent la panne 3x plus vite. Le médecin gagne 10 min par consultation.",
          audience: "SAV, santé, industrie, automobile",
        },
        {
          title: "Optimisation des tournées",
          benefit: "20 % de carburant en moins, 1 RDV de plus par jour, par technicien ou livreur.",
          audience: "Logistique, plombiers, électriciens, livraison",
        },
        {
          title: "Génération automatique de rapports clients",
          benefit:
            "Audit, expertise, état des lieux, diagnostic — un rapport pro et illustré en 15 minutes au lieu d'une demi-journée.",
          audience: "Conseil, immo, expertise, audit",
        },
        {
          title: "Inventaire et stocks intelligents",
          benefit:
            "Plus de rupture, plus de surstock. L'IA prévoit, commande et alerte au bon moment.",
          audience: "Commerce, restauration, industrie",
        },
      ],
      customTitle: "Votre métier n'est pas dans la liste ?",
      customDescription:
        "Tout métier a ses tâches répétitives ou ses moments de friction. Décrivez votre journée type ou votre processus opérationnel le plus pénible, on revient avec une proposition chiffrée sous 48h.",
      metaTitle: "Automatisations IA métier & production · Axion-IA",
      metaDescription:
        "7 automatisations IA métier : chiffrage chantier, menus restau, juridique, diagnostic, tournées, rapports, inventaire. Forfait fixe.",
    },
    en: {
      eyebrow: "Operations & Core Business",
      cardTitle: "Operations",
      cardTagline: "AI inside your core craft — diagnosis, quoting, fieldwork.",
      pageTitle: "Operations",
      pageTitleEm: "automations",
      pageDescription:
        "Construction quotes 3x faster. Restaurants order without thinking. Service teams diagnose in 30 seconds.",
      intro:
        "Depending on your industry, AI can sit at the heart of your craft — not just on the side. Here are the most profitable uses, by profession.",
      itemsTitle: "What we install",
      items: [
        {
          title: "Automatic construction quoting",
          benefit:
            "You quote a full project (materials, labor, margin) in 10 minutes instead of 2 hours. From a voice brief or photos.",
          audience: "Trades, construction, renovation",
        },
        {
          title: "Automatic menu and supplier-order generation",
          benefit:
            "Menus generated by arrivals, seasons and target margin. Orders go out by themselves on Sunday.",
          audience: "Restaurants, caterers, food service",
        },
        {
          title: "Legal & compliance assistant",
          benefit:
            "Contracts checked in 30 seconds. GDPR, T&Cs, leases, confidentiality agreements — every legal doc reviewed by AI before signing.",
          audience: "SMB, professional services",
        },
        {
          title: "Diagnosis support (medical, technical, service)",
          benefit:
            "Your technicians find faults 3x faster. The doctor saves 10 min per consultation.",
          audience: "Service, healthcare, manufacturing, automotive",
        },
        {
          title: "Route optimization",
          benefit: "20% less fuel, 1 extra appointment per day per technician or driver.",
          audience: "Logistics, plumbers, electricians, delivery",
        },
        {
          title: "Automatic customer report generation",
          benefit:
            "Audit, expertise, inspection, diagnosis — a professional, illustrated report in 15 minutes instead of half a day.",
          audience: "Consulting, real estate, audit",
        },
        {
          title: "Smart inventory and stock",
          benefit:
            "No stockouts, no overstock. AI forecasts, orders and alerts at the right moment.",
          audience: "Retail, hospitality, manufacturing",
        },
      ],
      customTitle: "Your industry is not on the list?",
      customDescription:
        "Every craft has its repetitive tasks and friction moments. Describe a typical day or your most painful operational process, we come back with a costed proposal within 48h.",
      metaTitle: "AI operations & core-business automations · Axion-IA",
      metaDescription:
        "7 AI operations automations: construction quotes, restaurant menus, legal, diagnosis, routes, reports, inventory. Fixed fee.",
    },
  },
  {
    slug: "communication-interne",
    pathFr: "/implementation/par-fonction/communication-interne",
    pathEn: "/implementation/by-function/internal-communication",
    fr: {
      eyebrow: "Communication interne",
      cardTitle: "Communication interne",
      cardTagline: "Vos équipes savent tout, comprennent tout, ne se perdent plus.",
      pageTitle: "Automatisations",
      pageTitleEm: "internes",
      pageDescription:
        "Vos équipes ne posent plus 50 fois la même question. Les réunions tiennent en un résumé clair. Le multi-langue ne ralentit plus personne.",
      intro:
        "L'IA fluidifie la communication interne — on gagne en clarté, en autonomie et en vélocité, sans ajouter d'outil que personne n'utilise.",
      itemsTitle: "Ce que l'on installe",
      items: [
        {
          title: "Chatbot interne RH / IT / paie / procédures",
          benefit:
            "Vos équipes obtiennent une réponse instantanée à toutes leurs questions internes. Plus d'interruptions, plus de tickets.",
          audience: "PME → grand groupe",
        },
        {
          title: "Résumé automatique des réunions de direction",
          benefit:
            "Tout le monde sait ce qui s'est dit, sans relire 40 pages. Décisions, actions, échéances — clair pour chacun.",
          audience: "Toutes équipes >20 personnes",
        },
        {
          title: "Traduction automatique en temps réel",
          benefit:
            "Mails, documents, réunions Zoom — vos équipes France/Espagne/Allemagne se comprennent en direct.",
          audience: "Entreprises multi-pays",
        },
        {
          title: "Recherche intelligente dans la base documentaire",
          benefit:
            "Vos équipes trouvent en 5 secondes ce qu'elles cherchaient pendant 30 minutes dans Drive ou SharePoint.",
          audience: "PME → grand groupe",
        },
        {
          title: "Assistant procédures qualité et conformité",
          benefit:
            "Vos process internes (ISO, RGPD, sécurité) sont accessibles en langage naturel. Plus de PDF de 80 pages.",
          audience: "Industrie, santé, finance, audit",
        },
        {
          title: "Newsletter interne automatique",
          benefit:
            "Une com hebdo claire et synthétique part toute seule. Vos équipes savent ce qui se passe sans noyer leurs boîtes.",
          audience: "Équipes >50 personnes, télétravail",
        },
      ],
      customTitle: "Un sujet de comm' interne particulier ?",
      customDescription:
        "Onboarding multi-sites, change management, animation de communauté interne — tout besoin de fluidification se chiffre. Décrivez le besoin, on revient sous 48h.",
      metaTitle: "Automatisations IA communication interne · Axion-IA",
      metaDescription:
        "6 automatisations IA communication interne : chatbot RH/IT, résumé réunions, traduction, recherche docs, procédures qualité, newsletter interne. Forfait fixe.",
    },
    en: {
      eyebrow: "Internal Communication",
      cardTitle: "Internal comms",
      cardTagline: "Your teams know everything, understand everything, get lost no more.",
      pageTitle: "Internal",
      pageTitleEm: "automations",
      pageDescription:
        "Your teams stop asking the same question 50 times. Meetings turn into clear summaries. Multi-language stops slowing anyone down.",
      intro:
        "AI smooths internal communication — clarity, autonomy and speed, without adding yet another tool no one uses.",
      itemsTitle: "What we install",
      items: [
        {
          title: "Internal HR / IT / payroll chatbot",
          benefit:
            "Your teams get instant answers to internal questions. No more interruptions, no more tickets.",
          audience: "SMB → enterprise",
        },
        {
          title: "Automatic leadership meeting summaries",
          benefit:
            "Everyone knows what was said without reading 40 pages. Decisions, actions, deadlines — clear for all.",
          audience: "Teams >20 people",
        },
        {
          title: "Real-time automatic translation",
          benefit:
            "Emails, documents, Zoom meetings — your France/Spain/Germany teams understand each other live.",
          audience: "Multi-country companies",
        },
        {
          title: "Smart search across your document library",
          benefit:
            "Your teams find in 5 seconds what they used to look for 30 minutes in Drive or SharePoint.",
          audience: "SMB → enterprise",
        },
        {
          title: "Quality & compliance procedures assistant",
          benefit:
            "Your internal processes (ISO, GDPR, security) are accessible in natural language. No more 80-page PDFs.",
          audience: "Manufacturing, healthcare, finance, audit",
        },
        {
          title: "Automatic internal newsletter",
          benefit:
            "A clear, synthetic weekly comms goes out by itself. Teams stay informed without inbox overload.",
          audience: "Teams >50 people, remote work",
        },
      ],
      customTitle: "A specific internal comms topic?",
      customDescription:
        "Multi-site onboarding, change management, internal community — any smoothing need can be quoted. Describe the need, we come back within 48h.",
      metaTitle: "AI internal communication automations · Axion-IA",
      metaDescription:
        "6 AI internal communication automations: HR/IT chatbot, meeting summaries, translation, doc search, quality procedures, internal newsletter. Fixed fee.",
    },
  },
];

export function getAutomatisation(slug: AutomatisationSlug): AutomatisationCategory {
  const found = AUTOMATISATIONS.find((c) => c.slug === slug);
  if (!found) throw new Error(`Unknown automatisation slug: ${slug}`);
  return found;
}

export const AUTOMATISATION_SLUGS: ReadonlyArray<AutomatisationSlug> = AUTOMATISATIONS.map(
  (c) => c.slug,
);

// Slugs FR vs EN — extraits depuis `pathFr` / `pathEn` car les slugs EN sont
// traduits (ex `customer-service` ≠ `service-client`). Indispensable pour
// `generateStaticParams` côté EN et pour le sitemap-index multilingue.
export const AUTOMATISATION_SLUGS_FR: ReadonlyArray<string> = AUTOMATISATIONS.map((c) =>
  c.pathFr.split("/").pop()!,
);
export const AUTOMATISATION_SLUGS_EN: ReadonlyArray<string> = AUTOMATISATIONS.map((c) =>
  c.pathEn.split("/").pop()!,
);

/** Lookup `AutomatisationCategory` par slug, en cherchant dans pathFr OU pathEn. */
export function getAutomatisationByLocaleSlug(slug: string): AutomatisationCategory | undefined {
  return AUTOMATISATIONS.find(
    (c) => c.pathFr.endsWith(`/${slug}`) || c.pathEn.endsWith(`/${slug}`) || c.slug === slug,
  );
}
