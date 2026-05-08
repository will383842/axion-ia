import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { ArrowRight, Check, Clock, Minus, ShieldCheck, Sparkles, X } from "lucide-react";
import { routing, type Locale } from "@/i18n/routing";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { Cta } from "@/components/marketing/Cta";
import { CaseStudyCard } from "@/components/marketing/CaseStudyCard";
import { CtaBlock } from "@/components/sections/CtaBlock";
import { ProcessSteps } from "@/components/sections/ProcessSteps";
import { FaqAccordion } from "@/components/marketing/FaqAccordion";
import { Illustration } from "@/components/visual/Illustration";
import { StickyMobileCta } from "@/components/marketing/StickyMobileCta";
import { ImplementationHeroSchema } from "@/components/sections/ImplementationHeroSchema";
import { Link } from "@/i18n/navigation";
import { AUTOMATISATIONS } from "@/content/automatisations";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { JsonLd } from "@/components/marketing/JsonLd";
import { buildProductMetadata, buildServiceJsonLd } from "@/lib/seo";
import { buildServiceAreasServed } from "@/lib/service-coverage";
import { LocalCoverageSection } from "@/components/sections/LocalCoverageSection";
import { LocalGeoFaqSection } from "@/components/sections/LocalGeoFaqSection";

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  return buildProductMetadata({
    locale,
    path: "/implementation",
    title:
      locale === "fr"
        ? "ImplÃ©mentation IA Â· Catalogue par fonction Â· AxionIA"
        : "AI implementation Â· Catalogue by function Â· AxionIA",
    description:
      locale === "fr"
        ? "Catalogue d'automatisations IA par fonction d'entreprise (service client, ventes, marketing, RH, donnÃ©es, mÃ©tier...). Forfait fixe Ã  partir de 490 â‚¬, sans abonnement mensuel, livraison 2-6 semaines."
        : "AI automation catalogue by business function (customer service, sales, marketing, HR, data, operations...). Fixed fee from â‚¬490, no monthly subscription, 2-6 week delivery.",
  });
}

export default async function ImplementationListing({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";

  // Breadcrumb visuel + JSON-LD intÃ©grÃ© (composant unique). L'item "Accueil"
  // est ajoutÃ© automatiquement par le composant.
  const breadcrumbItems = [
    {
      href: "/implementation",
      label: isFr ? "ImplÃ©mentation IA" : "AI implementation",
    },
  ];

  // Engagements/rÃ©assurance â€” pills sous le hero. Vrais engagements opÃ©rables,
  // pas de chiffre client inventÃ©.
  const trustItems = isFr
    ? [
        { icon: Clock, label: "Devis ferme sous 48 h" },
        { icon: ShieldCheck, label: "Forfait fixe Â· sans abonnement" },
        { icon: Sparkles, label: "Livraison en 2 Ã  6 semaines" },
        { icon: Check, label: "Formation incluse Â· vous Ãªtes propriÃ©taire" },
      ]
    : [
        { icon: Clock, label: "Firm quote within 48 h" },
        { icon: ShieldCheck, label: "Fixed fee Â· no subscription" },
        { icon: Sparkles, label: "Delivery in 2 to 6 weeks" },
        { icon: Check, label: "Training included Â· you own everything" },
      ];

  // Bandeau pricing transparent â€” fourchettes par typologie de projet,
  // alignÃ©es sur le catalogue Module 3.
  const pricingTiers = isFr
    ? [
        {
          tag: "Ã€ partir de",
          price: "490 â‚¬",
          label: "Mise en route IA",
          desc: "Une premiÃ¨re automatisation simple installÃ©e chez vous. IdÃ©al artisan, commerce, TPE qui veut tester sans risque.",
        },
        {
          tag: "Forfait fixe",
          price: "Sur devis",
          label: "ImplÃ©mentation standard",
          desc: "Plusieurs automatisations connectÃ©es entre elles dans une cohÃ©rence mÃ©tier. Devis personnalisÃ© selon votre pÃ©rimÃ¨tre.",
        },
        {
          tag: "Sur mesure",
          price: "Sur devis",
          label: "IA Custom Â· ETI & grands comptes",
          desc: "ModÃ¨les fine-tuned, Ã©quipe dÃ©diÃ©e, intÃ©gration profonde. Pour les pÃ©rimÃ¨tres complexes ou les institutions.",
        },
      ]
    : [
        {
          tag: "From",
          price: "â‚¬490",
          label: "AI start-up",
          desc: "A first simple automation installed at your place. Great for trades, retail, SMB who want a risk-free test.",
        },
        {
          tag: "Fixed fee",
          price: "On quote",
          label: "Standard implementation",
          desc: "Several automations connected together in business coherence. Personalized quote based on your scope.",
        },
        {
          tag: "Custom",
          price: "On quote",
          label: "Custom AI Â· mid-cap & enterprise",
          desc: "Fine-tuned models, dedicated team, deep integration. For complex perimeters or institutions.",
        },
      ];

  const pillars = isFr
    ? [
        {
          eyebrow: "IdÃ©al",
          title: "Audit d'abord",
          description:
            "Pour cadrer votre projet et identifier les usages Ã  plus fort impact avant d'investir. Quatre niveaux d'audit, du diagnostic Flash Ã  l'audit stratÃ©gique ETI.",
          ctaLabel: "Voir les niveaux d'audit",
          ctaHref: "/audit",
        },
        {
          eyebrow: "Si vous savez",
          title: "ImplÃ©mentation directe",
          description:
            "Vous avez une idÃ©e prÃ©cise (chatbot, devis auto, assistant commercial). On l'installe en 2 Ã  6 semaines, en forfait fixe.",
          ctaLabel: "Voir le catalogue",
          ctaHref: "#catalogue",
        },
        {
          eyebrow: "Notre engagement",
          title: "Sans abonnement",
          description:
            "Vous payez une fois, c'est Ã  vous. Pas de maintenance mensuelle imposÃ©e. Ã‰volutions plus tard si vous le dÃ©cidez.",
          ctaLabel: "Comment Ã§a marche",
          ctaHref: "/methodologie",
        },
      ]
    : [
        {
          eyebrow: "Ideal",
          title: "Audit first",
          description:
            "To frame your project and identify the highest-impact uses before investing. Four audit levels, from Flash diagnosis to strategic mid-cap audit.",
          ctaLabel: "See audit levels",
          ctaHref: "/audit",
        },
        {
          eyebrow: "If you know",
          title: "Direct implementation",
          description:
            "You have a clear idea (chatbot, auto-quoting, sales assistant). We install it in 2 to 6 weeks, fixed fee.",
          ctaLabel: "See the catalogue",
          ctaHref: "#catalogue",
        },
        {
          eyebrow: "Our commitment",
          title: "No subscription",
          description:
            "You pay once, it's yours. No imposed monthly maintenance. Future evolutions only if you decide so.",
          ctaLabel: "How it works",
          ctaHref: "/methodologie",
        },
      ];

  // Bloc comparatif â€” Make/Zapier vs Agence classique vs AxionIA.
  // Frontal, honnÃªte, mais visuellement orientÃ© pour mettre AxionIA en
  // valeur (4 critÃ¨res âœ“/âœ— en pied + colonne mise en avant).
  // CritÃ¨re states : "yes" / "no" / "partial".
  const comparison = isFr
    ? {
        eyebrow: "On peut comparer",
        title: "Make Â· agence Â·",
        titleEm: "AxionIA",
        description:
          "Trois maniÃ¨res d'automatiser votre entreprise avec l'IA. Sur 4 critÃ¨res qui comptent vraiment, voici comment chacun se positionne.",
        criteriaLabels: [
          "Forfait fixe (pas de dÃ©passement)",
          "Livraison â‰¤ 6 semaines",
          "Vraie IA (pas juste no-code)",
          "Vous Ãªtes propriÃ©taire Â· sans abonnement",
        ],
        cols: [
          {
            name: "Make / Zapier",
            tag: "Plateforme no-code (DIY)",
            price: "0 â‚¬ â†’ 99 â‚¬/mois",
            highlight: false,
            pros: [
              "Bon pour automatisations trÃ¨s simples (si A â†’ alors B)",
              "DÃ©marrage gratuit possible",
            ],
            cons: [
              "Vous configurez tout vous-mÃªme : aucun service, aucun accompagnement",
              "Forte courbe d'apprentissage technique pour des cas avancÃ©s",
              "Plafonne vite : pas d'IA rÃ©elle, pas d'intelligence mÃ©tier",
              "CoÃ»ts qui explosent au volume (facturÃ© Ã  la tÃ¢che)",
              "Abonnement permanent â€” vous payez tant que Ã§a tourne",
              "Maintenance et corrections de pannes Ã  votre charge",
            ],
            criteria: ["no", "yes", "no", "no"] as const,
            verdict:
              "C'est une plateforme, pas un partenaire. Ã€ vous de tout faire, de tout maintenir.",
          },
          {
            name: "Agence classique",
            tag: "Sur mesure profond",
            price: "25 kâ‚¬ â†’ 200 kâ‚¬",
            highlight: false,
            pros: [
              "CapacitÃ© Ã  traiter des sujets trÃ¨s complexes",
              "Sur mesure poussÃ©, Ã©quipe dÃ©diÃ©e",
            ],
            cons: [
              "Devis Ã©lastiques, dÃ©passements frÃ©quents",
              "DÃ©lais 3 Ã  6 mois minimum",
              "RÃ©gie au temps : vous payez les hÃ©sitations",
              "Maintenance continue souvent imposÃ©e",
            ],
            criteria: ["no", "no", "yes", "partial"] as const,
            verdict:
              "Pertinent pour des projets trÃ¨s grands ou avec contraintes techniques rares.",
          },
          {
            name: "AxionIA",
            tag: "Cabinet IA & automatisation",
            price: "490 â‚¬ â†’ sur devis",
            highlight: true,
            badge: "Le meilleur des deux mondes",
            pros: [
              "Cabinet spÃ©cialisÃ© IA & automatisation â€” vous avez un partenaire, pas un outil",
              "Forfait fixe Â· devis ferme avant tout dÃ©marrage",
              "Vraie IA connectÃ©e Ã  vos outils (pas juste un workflow)",
              "Livraison en 2 Ã  6 semaines, sprints + dÃ©mos hebdo",
              "Vous Ãªtes propriÃ©taire â€” code, donnÃ©es, accÃ¨s",
              "Pas d'abonnement mensuel imposÃ©",
              "Catalogue Ã©prouvÃ© (~50 automatisations) + sur mesure",
              "S'adapte de l'artisan Ã  l'ETI Â· IA Custom pour les grands comptes",
            ],
            cons: ["Pas de rÃ©gie continue (volontairement â€” vous restez libre)"],
            criteria: ["yes", "yes", "yes", "yes"] as const,
            verdict:
              "L'expertise d'un cabinet IA, l'agilitÃ© d'une Ã©quipe spÃ©cialisÃ©e, sans la facture ni la dÃ©pendance â€” l'Ã©quilibre que personne d'autre ne propose en France.",
          },
        ],
      }
    : {
        eyebrow: "Let's compare",
        title: "Make Â· agency Â·",
        titleEm: "AxionIA",
        description:
          "Three ways to automate your business with AI. On the 4 criteria that actually matter, here is how each positions itself.",
        criteriaLabels: [
          "Fixed fee (no overrun)",
          "Delivery â‰¤ 6 weeks",
          "Real AI (not just no-code)",
          "You own it Â· no subscription",
        ],
        cols: [
          {
            name: "Make / Zapier",
            tag: "DIY no-code platform",
            price: "â‚¬0 â†’ â‚¬99/mo",
            highlight: false,
            pros: ["Good for very simple automations (if A â†’ then B)", "Free tier to start"],
            cons: [
              "You configure everything yourself â€” no service, no support",
              "Steep learning curve for advanced cases",
              "Caps quickly: no real AI, no business intelligence",
              "Costs explode with volume (per-task billing)",
              "Permanent subscription â€” you pay as long as it runs",
              "Maintenance and outages on you",
            ],
            criteria: ["no", "yes", "no", "no"] as const,
            verdict: "It's a platform, not a partner. You do everything, you maintain everything.",
          },
          {
            name: "Classic agency",
            tag: "Deep custom",
            price: "â‚¬25k â†’ â‚¬200k",
            highlight: false,
            pros: ["Can tackle very complex topics", "Deep custom, dedicated team"],
            cons: [
              "Elastic quotes, frequent overruns",
              "3 to 6 month minimum delivery",
              "Time-and-materials: you pay the hesitations",
              "Continuous maintenance often required",
            ],
            criteria: ["no", "no", "yes", "partial"] as const,
            verdict: "Right for very large projects or rare technical constraints.",
          },
          {
            name: "AxionIA",
            tag: "AI & automation consultancy",
            price: "â‚¬490 â†’ on quote",
            highlight: true,
            badge: "Best of both worlds",
            pros: [
              "Specialized AI & automation consultancy â€” a partner, not a tool",
              "Fixed fee Â· firm quote before any kick-off",
              "Real AI wired to your tools (not just a workflow)",
              "Delivery in 2 to 6 weeks, sprints + weekly demos",
              "You own it â€” code, data, access",
              "No imposed monthly subscription",
              "Proven catalogue (~50 automations) + custom",
              "Scales from trades to mid-cap Â· Custom AI for enterprise",
            ],
            cons: ["No continuous time-and-materials (by design â€” you stay free)"],
            criteria: ["yes", "yes", "yes", "yes"] as const,
            verdict:
              "An AI consultancy's expertise, a specialized team's agility, without the bill or the lock-in â€” the balance no one else offers.",
          },
        ],
      };

  // ScÃ©narios types â€” couvrent le spectre artisan â†’ grand groupe pour
  // que chaque visiteur se reconnaisse. Format avant/aprÃ¨s pour rendre
  // tangible. Pas des tÃ©moignages : ordres de grandeur typiques.
  // Disclaimer assumÃ© en bas de section (transparence FR L.121-1).
  const scenarios = isFr
    ? [
        {
          size: "Artisan / TPE",
          industry: "Plombier, Ã©lectricien, paysagiste",
          metric: "Ã— 3 devis envoyÃ©s",
          before: "Avant : 30 min le soir, devis oubliÃ©s, clients qui partent.",
          after:
            "AprÃ¨s : un brief vocal sur chantier, le devis sort en 30 secondes, prÃªt Ã  envoyer.",
        },
        {
          size: "Commerce / restauration",
          industry: "Boutique, restaurant, hÃ´tel",
          metric: "100 % avis rÃ©pondus",
          before: "Avant : avis Google ignorÃ©s, DM Instagram en retard, clients perdus.",
          after:
            "AprÃ¨s : tous les avis et DM reÃ§oivent une rÃ©ponse pro 24/7. Les Ã©toiles montent toutes seules.",
        },
        {
          size: "Cabinet libÃ©ral / TPE",
          industry: "Expert-comptable, avocat, mÃ©decin",
          metric: "âˆ’ 4 h / semaine",
          before:
            "Avant : saisie de factures, comptes-rendus tapÃ©s Ã  la main, paperasse partout.",
          after:
            "AprÃ¨s : tout est lu, classÃ©, prÃ©-rÃ©digÃ©. L'Ã©quipe se recentre sur le conseil et le diagnostic.",
        },
        {
          size: "PME B2B (10-50)",
          industry: "Services, SaaS, distribution spÃ©cialisÃ©e",
          metric: "+ 22 % taux de signature",
          before: "Avant : devis envoyÃ©s et oubliÃ©s, commerciaux qui appellent Ã  l'aveugle.",
          after:
            "AprÃ¨s : relances automatiques, leads scorÃ©s, commerciaux focalisÃ©s sur les chauds.",
        },
        {
          size: "ETI (100-500)",
          industry: "Industrie, distribution, retail multi-sites",
          metric: "20 h rÃ©cupÃ©rÃ©es / mois",
          before:
            "Avant : reporting Excel manuel, veille concurrentielle improvisÃ©e, donnÃ©es dispersÃ©es.",
          after:
            "AprÃ¨s : tableaux de bord auto, prÃ©visions chiffrÃ©es, veille hebdo synthÃ©tisÃ©e, anomalies dÃ©tectÃ©es avant qu'elles coÃ»tent.",
        },
        {
          size: "Grand groupe (500+)",
          industry: "SiÃ¨ges, multi-pays, fonctions support centralisÃ©es",
          metric: "Ã— 5 productivitÃ© support",
          before: "Avant : 50 fois la mÃªme question RH/IT/paie, Ã©quipes interrompues sans cesse.",
          after:
            "AprÃ¨s : chatbot interne sur vos procÃ©dures, traduction temps rÃ©el, recherche dans Drive en 5 secondes.",
        },
      ]
    : [
        {
          size: "Trades / micro-business",
          industry: "Plumber, electrician, landscaper",
          metric: "3Ã— quotes sent",
          before: "Before: 30 min in the evening, forgotten quotes, customers leaving.",
          after: "After: voice brief on site, quote out in 30 seconds, ready to send.",
        },
        {
          size: "Retail / hospitality",
          industry: "Shop, restaurant, hotel",
          metric: "100% reviews answered",
          before: "Before: Google reviews ignored, Instagram DMs late, customers lost.",
          after: "After: every review and DM gets a pro reply 24/7. Stars climb on their own.",
        },
        {
          size: "Professional firm / small biz",
          industry: "Accountant, lawyer, doctor",
          metric: "âˆ’4 h / week",
          before: "Before: invoice entry, hand-typed minutes, paperwork everywhere.",
          after:
            "After: everything read, sorted, pre-drafted. The team refocuses on advice and diagnosis.",
        },
        {
          size: "B2B SMB (10-50)",
          industry: "Services, SaaS, specialty distribution",
          metric: "+22% sign rate",
          before: "Before: quotes sent and forgotten, reps calling blind.",
          after: "After: automatic follow-ups, scored leads, reps focus on the hot ones.",
        },
        {
          size: "Mid-market (100-500)",
          industry: "Manufacturing, distribution, multi-site retail",
          metric: "20 h recovered / month",
          before: "Before: manual Excel reporting, ad-hoc competitive intel, scattered data.",
          after:
            "After: auto dashboards, forecasts, weekly summarized intel, anomalies caught before they cost.",
        },
        {
          size: "Enterprise (500+)",
          industry: "HQs, multi-country, centralized support functions",
          metric: "5Ã— support productivity",
          before: "Before: same HR/IT/payroll question 50 times, teams constantly interrupted.",
          after:
            "After: internal chatbot on your procedures, real-time translation, Drive search in 5 seconds.",
        },
      ];

  // Process â€” comment se dÃ©roule un projet, transparence totale.
  const processSteps = isFr
    ? [
        {
          id: "p1",
          title: "Vous dÃ©crivez le besoin",
          description:
            "Formulaire de 5 min ou appel de 20 min. On creuse le contexte, les outils en place, les contraintes.",
        },
        {
          id: "p2",
          title: "Devis ferme sous 48 h ouvrÃ©es",
          description:
            "PÃ©rimÃ¨tre prÃ©cis, jalons, prix fixe. Vous signez ou pas â€” sans engagement avant signature.",
        },
        {
          id: "p3",
          title: "Cadrage technique Â· 1 sprint",
          description:
            "On valide les dÃ©tails, on connecte les outils, on aligne avec vos Ã©quipes.",
        },
        {
          id: "p4",
          title: "Build Â· 2 Ã  6 semaines",
          description: "Sprints courts, dÃ©mos hebdomadaires, validation continue. Pas de tunnel.",
        },
        {
          id: "p5",
          title: "Livraison + formation incluse",
          description:
            "Demi-journÃ©e de prise en main avec vos Ã©quipes. Documentation, runbook, accÃ¨s Ã  tout. C'est Ã  vous.",
        },
      ]
    : [
        {
          id: "p1",
          title: "You describe the need",
          description:
            "5-minute form or 20-minute call. We dig into context, existing tools, constraints.",
        },
        {
          id: "p2",
          title: "Firm quote within 48 business hours",
          description:
            "Precise scope, milestones, fixed price. You sign or not â€” no commitment before.",
        },
        {
          id: "p3",
          title: "Technical framing Â· 1 sprint",
          description: "We validate details, connect tools, align with your teams.",
        },
        {
          id: "p4",
          title: "Build Â· 2 to 6 weeks",
          description: "Short sprints, weekly demos, continuous validation. No tunnel effect.",
        },
        {
          id: "p5",
          title: "Delivery + training included",
          description:
            "Half-day onboarding with your teams. Docs, runbook, full access. It's yours.",
        },
      ];

  // FAQ â€” levÃ©e d'objections principales (prix, propriÃ©tÃ©, dÃ©lai, donnÃ©es,
  // garantie, dÃ©pendance). 8 questions FR, 8 EN. GÃ©nÃ¨re JSON-LD FAQPage auto.
  const faqs = isFr
    ? [
        {
          id: "q-prix",
          question: "Combien Ã§a coÃ»te vraiment, en pratique ?",
          answer:
            "Une premiÃ¨re automatisation simple dÃ©marre Ã  490 â‚¬ HT. Les implÃ©mentations standards (plusieurs automatisations connectÃ©es) et l'IA Custom pour ETI ou grands comptes sont chiffrÃ©es sur devis selon votre pÃ©rimÃ¨tre. Toujours en forfait fixe : devis ferme avant tout dÃ©marrage, pas de dÃ©passement.",
        },
        {
          id: "q-proprio",
          question: "Qui est propriÃ©taire de ce que vous installez ?",
          answer:
            "Vous. Le code, les workflows, les configurations, la documentation â€” tout est livrÃ© dans vos comptes, vos outils, votre infrastructure. Si vous nous quittez demain, tout continue de fonctionner.",
        },
        {
          id: "q-abonnement",
          question: "Y a-t-il une maintenance mensuelle obligatoire ?",
          answer:
            "Non. Vous payez une fois, c'est Ã  vous. Si plus tard vous voulez faire Ã©voluer (nouvelles automatisations, ajustements), vous nous rappelez et on chiffre une mission complÃ©mentaire. Aucune redevance ne tourne en arriÃ¨re-plan.",
        },
        {
          id: "q-delai",
          question: "Combien de temps avant que Ã§a tourne chez moi ?",
          answer:
            "Entre 2 et 6 semaines selon la complexitÃ©, Ã  compter de la signature du devis. Une automatisation simple (lecture de factures, chatbot site web) : 2 semaines. Un projet plus structurant (assistant commercial connectÃ© Ã  votre CRM) : 4 Ã  6 semaines.",
        },
        {
          id: "q-donnees",
          question: "Mes donnÃ©es sortent-elles de chez moi ?",
          answer:
            "HÃ©bergement UE par dÃ©faut, modÃ¨les compatibles RGPD. Pour les sujets sensibles, on dÃ©ploie en infra dÃ©diÃ©e ou on utilise des modÃ¨les open-source (Llama, Mistral) hÃ©bergÃ©s chez vous. Les choix techniques sont justifiÃ©s dans le devis avant signature.",
        },
        {
          id: "q-garantie",
          question: "Et si je ne suis pas satisfait Ã  la livraison ?",
          answer:
            "Sprints courts avec dÃ©mos hebdomadaires : vous validez Ã  chaque Ã©tape, pas de mauvaise surprise Ã  la fin. Ã€ la livraison, 30 jours de support inclus pour ajustements. Si une fonctionnalitÃ© livrÃ©e ne correspond pas au cahier des charges signÃ©, on la corrige sans surcoÃ»t.",
        },
        {
          id: "q-prerequis",
          question: "Faut-il dÃ©jÃ  avoir une culture IA ou une Ã©quipe data en interne ?",
          answer:
            "Non. On part de votre niveau rÃ©el â€” vos outils actuels, vos vraies tÃ¢ches rÃ©pÃ©titives, votre quotidien. Aucune compÃ©tence technique n'est requise pour dÃ©marrer. On choisit ensemble des cas d'usage simples et tangibles, on construit la trajectoire Ã  votre rythme, et la formation incluse Ã  la livraison rend vos Ã©quipes autonomes. Si vous n'avez jamais touchÃ© Ã  l'IA, c'est mÃªme souvent plus simple â€” pas d'habitudes Ã  dÃ©faire.",
        },
        {
          id: "q-taille",
          question: "C'est adaptÃ© Ã  une entreprise comme la mienne ?",
          answer:
            "Oui, du moment qu'il y a une tÃ¢che rÃ©pÃ©titive ou un agacement quotidien. Notre catalogue couvre artisan (devis, suivi clients) â†’ grand groupe (assistant juridique, agents internes). Si vous hÃ©sitez, l'audit Flash (490 â‚¬) cadre le projet en 2 jours.",
        },
        {
          id: "q-hors-catalogue",
          question: "Mon besoin n'est pas dans le catalogue, vous le faites quand mÃªme ?",
          answer:
            "Oui. Le catalogue reprÃ©sente les usages les plus demandÃ©s. Toute tÃ¢che rÃ©pÃ©titive ou processus chronophage spÃ©cifique Ã  votre mÃ©tier est automatisable. DÃ©crivez-le, on revient avec un devis ferme sous 48 h.",
        },
      ]
    : [
        {
          id: "q-price",
          question: "How much does it really cost, in practice?",
          answer:
            "A first simple automation starts at â‚¬490 (excl. VAT). Standard implementations (multiple connected automations) and Custom AI for mid-cap or enterprise are quoted on a per-scope basis. Always fixed-fee: firm quote before any kick-off, no overrun.",
        },
        {
          id: "q-owner",
          question: "Who owns what you install?",
          answer:
            "You do. Code, workflows, configurations, documentation â€” everything is delivered into your accounts, your tools, your infrastructure. If you leave us tomorrow, everything keeps running.",
        },
        {
          id: "q-sub",
          question: "Is there a mandatory monthly maintenance?",
          answer:
            "No. You pay once, it's yours. If later you want to evolve (new automations, adjustments), you call us back and we quote a follow-up mission. Nothing runs in the background.",
        },
        {
          id: "q-time",
          question: "How long before it runs at my place?",
          answer:
            "Between 2 and 6 weeks depending on complexity, from quote signature. Simple automation (invoice reading, web chatbot): 2 weeks. Larger project (sales assistant connected to your CRM): 4 to 6 weeks.",
        },
        {
          id: "q-data",
          question: "Does my data leave my premises?",
          answer:
            "EU hosting by default, GDPR-compatible models. For sensitive topics, we deploy on dedicated infra or use open-source models (Llama, Mistral) hosted with you. Technical choices are justified in the quote before signing.",
        },
        {
          id: "q-guarantee",
          question: "What if I'm not satisfied at delivery?",
          answer:
            "Short sprints with weekly demos: you validate at every step, no bad surprise at the end. At delivery, 30 days of included support for adjustments. If a delivered feature doesn't match the signed scope, we fix it at no extra cost.",
        },
        {
          id: "q-prereq",
          question: "Do I need an existing AI culture or in-house data team to start?",
          answer:
            "No. We start from your actual level â€” your current tools, your real repetitive tasks, your daily reality. No technical skill is required to begin. We pick simple, tangible use cases together, we build the trajectory at your pace, and the included training at delivery makes your teams autonomous. If you've never touched AI, it's often even simpler â€” no habits to undo.",
        },
        {
          id: "q-size",
          question: "Is this fit for a company like mine?",
          answer:
            "Yes, as long as there is a repetitive task or daily annoyance. Our catalogue covers trades (quoting, follow-up) â†’ enterprise (legal assistant, internal agents). If unsure, the Flash audit (â‚¬490) frames the project in 2 days.",
        },
        {
          id: "q-not-listed",
          question: "My need is not in the catalogue, do you still do it?",
          answer:
            "Yes. The catalogue covers the most requested uses. Any repetitive task or time-consuming process specific to your craft can be automated. Describe it, we come back with a firm quote within 48 h.",
        },
      ];

  // 8 nÅ“uds du schÃ©ma hero â€” un par fonction mÃ©tier. L'ordre suit la
  // disposition horaire du SVG (top, top-right, right, bot-right, bottom,
  // bot-left, left, top-left). BÃ©nÃ©fices courts, mesurables, parlants.
  const heroNodes = isFr
    ? [
        { label: "Ventes", benefit: "+ CA, âˆ’ coÃ»t", accent: "primary" as const },
        { label: "Service client", benefit: "RÃ©ponse 24/7", accent: "terracotta" as const },
        { label: "Marketing", benefit: "VisibilitÃ© 10Ã—", accent: "terracotta" as const },
        { label: "DonnÃ©es", benefit: "DÃ©cisions claires", accent: "primary" as const },
        { label: "MÃ©tier", benefit: "Chiffrer en 30 s", accent: "terracotta" as const },
        { label: "Admin", benefit: "ZÃ©ro saisie", accent: "sage" as const },
        { label: "RH", benefit: "Recruter 5Ã— +", accent: "mocha" as const },
        { label: "Com' interne", benefit: "Ã‰quipes alignÃ©es", accent: "sage" as const },
      ]
    : [
        { label: "Sales", benefit: "+ revenue, âˆ’ cost", accent: "primary" as const },
        { label: "Customer service", benefit: "24/7 answers", accent: "terracotta" as const },
        { label: "Marketing", benefit: "10Ã— visibility", accent: "terracotta" as const },
        { label: "Data", benefit: "Clear decisions", accent: "primary" as const },
        { label: "Operations", benefit: "Quote in 30 s", accent: "terracotta" as const },
        { label: "Back-office", benefit: "Zero data entry", accent: "sage" as const },
        { label: "HR", benefit: "5Ã— faster hiring", accent: "mocha" as const },
        { label: "Internal comms", benefit: "Aligned teams", accent: "sage" as const },
      ];

  // Service JSON-LD avec areasServed multi-rÃ©gions (Sprint 14.9 levier 2).
  const serviceJsonLd = buildServiceJsonLd({
    locale: loc,
    path: "/implementation",
    name: isFr
      ? "ImplÃ©mentation IA opÃ©rationnelle Â· AxionIA"
      : "Operational AI implementation Â· AxionIA",
    description: isFr
      ? "Mise en production de cas IA opÃ©rationnels en 6 Ã  12 semaines : agents conversationnels, automatisation back-office, intÃ©gration CRM/ERP, IA custom. ROI chiffrÃ©, formation incluse, dÃ¨s 990 â‚¬ HT."
      : "Production deployment of operational AI cases in 6 to 12 weeks: conversational agents, back-office automation, CRM/ERP integration, custom AI. Costed ROI, training included, from â‚¬990.",
    serviceType: "AI implementation",
    priceEur: 990,
    areasServed: buildServiceAreasServed(loc),
  });

  return (
    <>
      <JsonLd data={serviceJsonLd} />
      <Container className="border-border border-b py-3">
        <Breadcrumbs items={breadcrumbItems} />
      </Container>
      {/* HERO â€” layout 2 colonnes (texte + schÃ©ma SVG), alignÃ© /audit + /interventions */}
      <section className="bg-halo-warm text-fg relative overflow-hidden pt-12 pb-20 sm:pt-14 sm:pb-24 lg:pt-16 lg:pb-28">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(to right, var(--color-border-strong) 1px, transparent 1px), linear-gradient(to bottom, var(--color-border-strong) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
            maskImage: "radial-gradient(ellipse at center, white 20%, transparent 75%)",
            WebkitMaskImage: "radial-gradient(ellipse at center, white 20%, transparent 75%)",
            opacity: 0.18,
          }}
        />

        <Container className="relative">
          <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-14 xl:gap-16">
            <div className="max-w-xl">
              <p className="text-fg-muted text-[13px] font-medium tracking-[0.16em] uppercase">
                <span
                  aria-hidden="true"
                  className="bg-terracotta mr-3 inline-block h-1.5 w-1.5 rounded-full align-middle"
                />
                {isFr ? "Module 3 Â· ImplÃ©mentation IA" : "Module 3 Â· AI implementation"}
              </p>

              <h1 className="display-editorial text-fg mt-5">
                {isFr ? "Vous savez dÃ©jÃ  ce qu'il vous faut ? " : "Already know what you need? "}
                <span
                  className="text-terracotta mx-2 italic"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  {isFr ? "On l'installe." : "We install it."}
                </span>
              </h1>

              <p className="text-fg-soft mt-6 max-w-2xl text-lg leading-relaxed sm:text-xl">
                {isFr
                  ? "Aucun prÃ©requis technique â€” on part de votre niveau rÃ©el, de vos outils actuels, de votre quotidien. Forfait fixe Ã  partir de 490 â‚¬, livraison en 2 Ã  6 semaines. Vous payez une fois, c'est Ã  vous â€” pas d'abonnement mensuel."
                  : "No technical prerequisite â€” we start from your actual level, your current tools, your daily reality. Fixed fee from â‚¬490, delivery in 2 to 6 weeks. You pay once, it's yours â€” no monthly subscription."}
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Cta href="/contact" size="lg" track="impl-hero-primary">
                  {isFr ? "DÃ©crire mon besoin Â· rÃ©ponse 48 h" : "Describe my need Â· 48 h reply"}
                  <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </Cta>
                <Cta href="/audit" variant="outline" size="lg" track="impl-hero-audit">
                  {isFr ? "Commencer par un audit" : "Start with an audit"}
                </Cta>
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-2xl lg:mx-0 lg:max-w-none">
              {/* Mobile / tablette < lg : grid compact 2Ã—4 â€” le SVG 8 satellites
                  serait illisible sous 1024 px. MÃªme contenu, autre densitÃ©. */}
              <ul
                aria-label={
                  isFr
                    ? "Les 8 fonctions automatisables et leur gain"
                    : "The 8 automatable functions and their gain"
                }
                className="grid grid-cols-2 gap-3 sm:gap-4 lg:hidden"
              >
                {heroNodes.map((node) => {
                  const accentBg: Record<typeof node.accent, string> = {
                    terracotta: "bg-terracotta-soft border-terracotta/30",
                    primary: "bg-primary-soft border-primary/30",
                    sage: "bg-sage-soft border-sage/30",
                    mocha: "bg-sand border-mocha-fg/15",
                  };
                  const accentDot: Record<typeof node.accent, string> = {
                    terracotta: "bg-terracotta",
                    primary: "bg-primary",
                    sage: "bg-sage",
                    mocha: "bg-mocha",
                  };
                  return (
                    <li
                      key={node.label}
                      className={`flex flex-col gap-1.5 rounded-xl border p-4 ${accentBg[node.accent]}`}
                    >
                      <span className="flex items-center gap-2">
                        <span
                          aria-hidden="true"
                          className={`inline-block h-2 w-2 rounded-full ${accentDot[node.accent]}`}
                        />
                        <span className="text-fg text-sm leading-tight font-semibold">
                          {node.label}
                        </span>
                      </span>
                      <span className="text-fg-soft text-[13px] leading-snug">{node.benefit}</span>
                    </li>
                  );
                })}
              </ul>

              {/* Desktop â‰¥ lg : schÃ©ma SVG riche (entreprise + 8 satellites).
                  max-w-none pour utiliser tout l'espace de la colonne grille
                  (1.2fr) et Ã©galer le AuditHeroSchema en taille visuelle. */}
              <ImplementationHeroSchema
                className="hero-schema pointer-events-none hidden lg:block"
                centerLabel={isFr ? "Votre entreprise" : "Your company"}
                ariaLabel={
                  isFr
                    ? "SchÃ©ma : votre entreprise au centre, entourÃ©e des 8 fonctions automatisables (ventes, service client, marketing, donnÃ©es, mÃ©tier, admin, RH, communication interne) avec leur gain concret."
                    : "Diagram: your company at the center, surrounded by 8 automatable functions (sales, customer service, marketing, data, operations, back-office, HR, internal comms) with their concrete gain."
                }
                nodes={heroNodes}
              />
            </div>
          </div>
        </Container>
      </section>

      {/* BANDEAU RÃ‰ASSURANCE â€” engagements visibles immÃ©diatement sous le hero. */}
      <section className="bg-paper border-border border-y py-8">
        <Container>
          <ul className="grid grid-cols-2 gap-x-8 gap-y-5 lg:grid-cols-4">
            {trustItems.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.label} className="flex items-center gap-3">
                  <span className="bg-terracotta-soft text-terracotta-deep flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
                    <Icon aria-hidden="true" className="h-4 w-4" />
                  </span>
                  <span className="text-fg text-sm leading-snug font-medium">{item.label}</span>
                </li>
              );
            })}
          </ul>
        </Container>
      </section>

      <Section
        eyebrow={isFr ? "Deux portes d'entrÃ©e" : "Two ways in"}
        title={
          isFr ? "Audit, ou directement implÃ©mentation" : "Audit, or straight to implementation"
        }
      >
        <ul className="grid gap-6 md:grid-cols-3">
          {pillars.map((p) => (
            <li
              key={p.title}
              className="border-border bg-paper flex flex-col gap-5 rounded-2xl border p-7 sm:p-8"
            >
              <p className="text-fg-muted text-[12px] font-medium tracking-[0.18em] uppercase">
                {p.eyebrow}
              </p>
              <h3
                className="text-fg text-[1.6rem] leading-tight font-medium"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                {p.title}
              </h3>
              <p className="text-fg-soft text-base leading-relaxed">{p.description}</p>
              <div className="mt-auto pt-2">
                {p.ctaHref.startsWith("#") ? (
                  <a
                    href={p.ctaHref}
                    className="text-terracotta-deep hover:text-terracotta inline-flex items-center gap-1 text-sm font-semibold"
                  >
                    {p.ctaLabel} â†’
                  </a>
                ) : (
                  <Link
                    href={p.ctaHref as never}
                    className="text-terracotta-deep hover:text-terracotta inline-flex items-center gap-1 text-sm font-semibold"
                  >
                    {p.ctaLabel} â†’
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      </Section>

      {/* CATALOGUE 8 fonctions â€” cÅ“ur de la page conversion. */}
      <Section
        id="catalogue"
        eyebrow={isFr ? "Catalogue par fonction" : "Catalogue by function"}
        title={isFr ? "Choisissez le dÃ©partement Ã " : "Pick the function to"}
        titleEm={isFr ? "automatiser" : "automate"}
        description={
          isFr
            ? "8 fonctions d'entreprise, ~50 automatisations prÃªtes Ã  installer. Cliquez sur un domaine pour voir tout ce que l'on peut mettre en place â€” du standard tÃ©lÃ©phonique IA au chiffrage de chantier en 30 secondes."
            : "8 business functions, ~50 automations ready to install. Click on an area to see everything we can set up â€” from AI phone receptionist to 30-second project quoting."
        }
      >
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {AUTOMATISATIONS.map((cat) => {
            const c = cat[loc];
            return (
              <li key={cat.slug}>
                <CaseStudyCard
                  href={`/implementation/par-fonction/${cat.slug}`}
                  title={c.cardTitle}
                  excerpt={c.cardTagline}
                  industry={c.eyebrow}
                  metric={`${c.items.length} ${isFr ? "automatisations" : "automations"}`}
                />
              </li>
            );
          })}
        </ul>
        <div className="border-border mt-12 flex flex-col items-start gap-4 border-t pt-8 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-fg-soft max-w-xl text-base leading-relaxed">
            {isFr ? (
              <>
                <strong className="text-fg font-semibold">
                  Votre cas n&apos;est pas dans la liste ?
                </strong>{" "}
                Toute tÃ¢che rÃ©pÃ©titive est automatisable. DÃ©crivez votre besoin,{" "}
                <Link
                  href="/contact"
                  className="text-terracotta-deep font-semibold underline-offset-4 hover:underline"
                >
                  devis ferme sous 48 h
                </Link>
                .
              </>
            ) : (
              <>
                <strong className="text-fg font-semibold">Your case is not on the list?</strong> Any
                repetitive task can be automated. Describe your need,{" "}
                <Link
                  href="/contact"
                  className="text-terracotta-deep font-semibold underline-offset-4 hover:underline"
                >
                  firm quote within 48 h
                </Link>
                .
              </>
            )}
          </p>
          <Link
            href="/implementation/par-techno"
            className="text-fg-muted hover:text-terracotta-deep text-sm font-medium underline-offset-4 hover:underline"
          >
            {isFr
              ? "Approche par technologie (avancÃ©) â†’"
              : "Tech-driven approach (advanced) â†’"}
          </Link>
        </div>
      </Section>

      {/* BANDEAU PRICING â€” placÃ© aprÃ¨s le catalogue : le visiteur a vu
          l'offre, il est prÃªt pour le prix. Forfait fixe, pas de 50k visible
          en tÃªte (l'IA Custom est volontairement "sur devis"). */}
      <Section
        tone="paper"
        eyebrow={isFr ? "Tarifs Â· transparence" : "Pricing Â· full transparency"}
        title={isFr ? "Combien Ã§a coÃ»te," : "What it costs,"}
        titleEm={isFr ? "vraiment" : "truly"}
        description={
          isFr
            ? "Forfait fixe systÃ©matique. Devis ferme avant tout dÃ©marrage. Pas de dÃ©passement, pas d'abonnement, pas de surprise."
            : "Always fixed fee. Firm quote before kick-off. No overrun, no subscription, no surprise."
        }
      >
        <ul className="grid gap-6 md:grid-cols-3">
          {pricingTiers.map((tier) => (
            <li
              key={tier.label}
              className="border-border bg-bg flex flex-col gap-4 rounded-2xl border p-7 sm:p-8"
            >
              <p className="text-fg-muted text-[12px] font-medium tracking-[0.18em] uppercase">
                {tier.tag}
              </p>
              <p
                className="text-terracotta-deep text-3xl leading-none font-medium tracking-tight sm:text-4xl"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                {tier.price}
              </p>
              <h3 className="text-fg text-xl leading-tight font-semibold">{tier.label}</h3>
              <p className="text-fg-soft text-base leading-relaxed">{tier.desc}</p>
            </li>
          ))}
        </ul>
        <p className="text-fg-soft mt-8 text-sm">
          {isFr ? (
            <>
              Tous les prix HT. Devis ferme avant signature.{" "}
              <Link
                href="/contact"
                className="text-terracotta-deep font-semibold underline-offset-4 hover:underline"
              >
                Demander un devis pour mon cas â†’
              </Link>
            </>
          ) : (
            <>
              All prices excl. VAT. Firm quote before signing.{" "}
              <Link
                href="/contact"
                className="text-terracotta-deep font-semibold underline-offset-4 hover:underline"
              >
                Request a quote for my case â†’
              </Link>
            </>
          )}
        </p>
      </Section>

      {/* COMPARATIF â€” Make / Agence / AxionIA. LevÃ©e d'objection "pourquoi
          pas X ?". Visuellement orientÃ© pour positionner AxionIA en climax :
          colonne mise en avant (scale + ring + fond teintÃ©) + matrice critÃ¨res
          qui rend la supÃ©rioritÃ© visible en un coup d'oeil. */}
      <Section
        tone="sand"
        eyebrow={comparison.eyebrow}
        title={comparison.title}
        titleEm={comparison.titleEm}
        description={comparison.description}
      >
        <ul className="grid items-stretch gap-6 md:grid-cols-3 md:gap-5 lg:gap-6">
          {comparison.cols.map((col) => (
            <li
              key={col.name}
              className={
                col.highlight
                  ? "border-terracotta bg-paper ring-terracotta/25 relative z-10 flex flex-col gap-5 rounded-2xl border-2 p-7 shadow-2xl ring-4 sm:p-8 lg:scale-[1.04]"
                  : "border-border bg-paper/70 relative flex flex-col gap-5 rounded-2xl border p-7 sm:p-8"
              }
            >
              {col.highlight ? (
                <span className="bg-terracotta text-mocha-fg absolute -top-3 left-1/2 inline-flex -translate-x-1/2 items-center rounded-full px-4 py-1.5 text-[11px] font-semibold tracking-wide whitespace-nowrap uppercase shadow-lg">
                  {"â˜…"} {col.badge ?? (isFr ? "Notre approche" : "Our approach")}
                </span>
              ) : null}

              <div className="space-y-1">
                <h3
                  className={
                    col.highlight
                      ? "text-terracotta-deep text-2xl leading-tight font-medium sm:text-[1.6rem]"
                      : "text-fg-soft text-2xl leading-tight font-medium"
                  }
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  {col.name}
                </h3>
                <p className="text-fg-muted text-[12px] font-medium tracking-[0.16em] uppercase">
                  {col.tag}
                </p>
              </div>

              <p
                className={
                  col.highlight
                    ? "text-fg text-3xl leading-none font-medium tracking-tight sm:text-[2.5rem]"
                    : "text-fg-soft text-2xl leading-none font-medium"
                }
                style={{ fontFamily: "var(--font-serif)" }}
              >
                {col.price}
              </p>

              <ul className="space-y-2.5">
                {col.pros.map((pro) => (
                  <li key={pro} className="flex items-start gap-2.5">
                    <Check
                      aria-hidden="true"
                      className={
                        col.highlight
                          ? "text-sage mt-0.5 h-4 w-4 shrink-0"
                          : "text-fg-muted mt-0.5 h-4 w-4 shrink-0"
                      }
                    />
                    <span
                      className={
                        col.highlight
                          ? "text-fg text-sm leading-relaxed"
                          : "text-fg-soft text-sm leading-relaxed"
                      }
                    >
                      {pro}
                    </span>
                  </li>
                ))}
                {col.cons.map((con) => (
                  <li key={con} className="flex items-start gap-2.5">
                    <Minus aria-hidden="true" className="text-fg-muted mt-0.5 h-4 w-4 shrink-0" />
                    <span className="text-fg-muted text-sm leading-relaxed">{con}</span>
                  </li>
                ))}
              </ul>

              <ul
                className={
                  col.highlight
                    ? "border-terracotta/40 space-y-2 border-t pt-4"
                    : "border-border space-y-2 border-t pt-4"
                }
                aria-label={isFr ? "Comparatif sur 4 critÃ¨res" : "Comparison on 4 criteria"}
              >
                {comparison.criteriaLabels.map((label, i) => {
                  const state = col.criteria[i];
                  return (
                    <li
                      key={label}
                      className="flex items-center justify-between gap-3 text-[12.5px] leading-snug"
                    >
                      <span className={col.highlight ? "text-fg" : "text-fg-soft"}>{label}</span>
                      {state === "yes" ? (
                        <span
                          aria-label={isFr ? "Oui" : "Yes"}
                          className="bg-sage/15 text-sage flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                        >
                          <Check aria-hidden="true" className="h-3.5 w-3.5" />
                        </span>
                      ) : state === "no" ? (
                        <span
                          aria-label={isFr ? "Non" : "No"}
                          className="bg-fg-muted/15 text-fg-muted flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                        >
                          <X aria-hidden="true" className="h-3.5 w-3.5" />
                        </span>
                      ) : (
                        <span
                          aria-label={isFr ? "Partiel" : "Partial"}
                          className="bg-fg-muted/15 text-fg-muted flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                        >
                          <Minus aria-hidden="true" className="h-3.5 w-3.5" />
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>

              <p
                className={
                  col.highlight
                    ? "text-terracotta-deep mt-auto text-base leading-relaxed font-semibold"
                    : "text-fg-soft mt-auto text-sm leading-relaxed italic"
                }
              >
                {col.verdict}
              </p>

              {col.highlight ? (
                <Cta
                  href="/contact"
                  size="lg"
                  track="impl-compare-axionia"
                  className="mt-2 w-full justify-center"
                >
                  {isFr ? "DÃ©crire mon besoin Â· 48 h" : "Describe my need Â· 48 h"}
                  <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </Cta>
              ) : null}
            </li>
          ))}
        </ul>
      </Section>

      {/* SCÃ‰NARIOS TYPES â€” couvrent le spectre artisan â†’ grand groupe.
          Format avant/aprÃ¨s pour rendre tangible. Pas de tÃ©moignages clients :
          ordres de grandeur typiques. Disclaimer transparence en fin de section. */}
      <Section
        tone="paper"
        eyebrow={isFr ? "Pour qui Ã§a change tout" : "For whom it changes everything"}
        title={isFr ? "TPE, PME, ETI ou grand groupe â€”" : "Small, mid-market or enterprise â€”"}
        titleEm={isFr ? "Ã  chacun son scÃ©nario" : "each its own scenario"}
        description={
          isFr
            ? "Notre cÅ“ur de cible : les TPE et PME qui veulent une IA opÃ©rationnelle vite, sans tunnel ni rÃ©gie. Mais nos automatisations s'adaptent aussi Ã  l'ETI, au grand groupe et aux institutions â€” IA Custom dÃ©diÃ©e pour les pÃ©rimÃ¨tres complexes."
            : "Our core target: small businesses and SMBs who want operational AI fast, no tunnel, no time-and-materials. But our automations also fit mid-market, enterprise and institutions â€” dedicated Custom AI for complex perimeters."
        }
      >
        <ul className="grid gap-5 md:grid-cols-2">
          {scenarios.map((s) => (
            <li
              key={s.industry}
              className="border-border bg-bg flex flex-col gap-4 rounded-2xl border p-6 sm:p-7"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <span className="bg-terracotta-soft text-terracotta-deep inline-flex w-fit items-center rounded-full px-3 py-1 text-[11px] font-semibold tracking-wide uppercase">
                    {s.size}
                  </span>
                  <p className="text-fg-soft text-sm">{s.industry}</p>
                </div>
                <p
                  className="text-terracotta-deep text-2xl leading-none font-medium tracking-tight sm:text-[1.75rem]"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  {s.metric}
                </p>
              </div>
              <div className="border-border space-y-2 border-t pt-4">
                <p className="text-fg-muted flex items-start gap-2 text-sm leading-relaxed">
                  <span
                    aria-hidden="true"
                    className="text-fg-muted mt-0.5 inline-block w-12 shrink-0 text-[11px] font-semibold tracking-[0.18em] uppercase"
                  >
                    {isFr ? "Avant" : "Before"}
                  </span>
                  <span className="text-fg-soft">{s.before}</span>
                </p>
                <p className="text-fg flex items-start gap-2 text-sm leading-relaxed">
                  <span
                    aria-hidden="true"
                    className="text-terracotta-deep mt-0.5 inline-block w-12 shrink-0 text-[11px] font-semibold tracking-[0.18em] uppercase"
                  >
                    {isFr ? "AprÃ¨s" : "After"}
                  </span>
                  <span className="text-fg">{s.after}</span>
                </p>
              </div>
            </li>
          ))}
        </ul>
        <p className="text-fg-muted mt-10 text-xs leading-relaxed">
          {isFr
            ? "ScÃ©narios reprÃ©sentatifs et non tÃ©moignages clients. Les rÃ©sultats varient selon le contexte, les outils en place et l'engagement des Ã©quipes. Votre cas est unique â€” devis personnalisÃ© sous 48 h."
            : "Representative scenarios, not client testimonials. Outcomes depend on context, existing tools and team engagement. Your case is unique â€” personalized quote within 48 h."}
        </p>
      </Section>

      {/* PROCESS â€” comment se dÃ©roule un projet. LÃ¨ve l'opacitÃ©. */}
      <Section
        tone="sand"
        eyebrow={isFr ? "Comment Ã§a se passe" : "How it runs"}
        title={isFr ? "5 Ã©tapes," : "5 steps,"}
        titleEm={isFr ? "zÃ©ro tunnel" : "zero tunnel"}
        description={
          isFr
            ? "Sprints courts, dÃ©mos hebdomadaires, validation continue. Vous voyez l'avancement en permanence â€” pas de boÃ®te noire."
            : "Short sprints, weekly demos, continuous validation. You see progress at all times â€” no black box."
        }
      >
        <ProcessSteps steps={processSteps} />
      </Section>

      {/* FAQ â€” levÃ©e d'objections (prix, propriÃ©tÃ©, dÃ©lai, donnÃ©es, garantie).
          Ã‰met automatiquement un FAQPage JSON-LD pour le SEO/AEO. */}
      <Section
        eyebrow={isFr ? "Vos questions" : "Your questions"}
        title={isFr ? "On" : "We"}
        titleEm={isFr ? "lÃ¨ve toutes vos objections" : "lift every objection"}
        description={
          isFr
            ? "Les vraies questions des dirigeants avant de signer. Si la vÃ´tre n'est pas listÃ©e, posez-la directement."
            : "The real questions executives ask before signing. If yours is not listed, ask it directly."
        }
      >
        <FaqAccordion items={faqs} className="mx-auto max-w-3xl" />
      </Section>

      {/* COUVERTURE NATIONALE (Sprint 14.9 levier 3 â€” pSEO) */}
      <LocalCoverageSection
        isFr={isFr}
        serviceLabelFr="L'implÃ©mentation IA"
        serviceLabelEn="AI implementation"
        serviceSlug="implementation"
        tone="paper"
      />

      {/* FAQ GÃ‰OLOCALISÃ‰E (Sprint 14.9 levier 4 â€” pSEO) */}
      <LocalGeoFaqSection isFr={isFr} service="implementation" tone="sand" />

      {/* CLOSING ILLUSTRATION â€” Sprint Visual Rhythm 2026 */}
      <Section tone="canvas">
        <Container className="max-w-3xl">
          <Illustration
            slot="IMPL-03-closing"
            aspectRatio="16:9"
            filenameTarget="public/illustrations/implementation-closing.avif"
            caption={
              isFr
                ? "ImplÃ©mentation livrÃ©e â€” systÃ¨me opÃ©rationnel, clÃ©s remises"
                : "Implementation delivered â€” operational system, keys handed over"
            }
            alt={
              isFr
                ? "Illustration Ã©ditoriale d'un systÃ¨me opÃ©rationnel livrÃ© Ã  l'issue d'une implÃ©mentation AxionIA."
                : "Editorial illustration of an operational system delivered at the end of an AxionIA implementation."
            }
          />
        </Container>
      </Section>

      <CtaBlock
        eyebrow={isFr ? "PrÃªt Ã  dÃ©marrer" : "Ready to start"}
        title={isFr ? "Vous payez une fois." : "You pay"}
        titleEm={isFr ? "C'est Ã  vous." : "once."}
        titleTail={isFr ? "" : " It's yours."}
        description={
          isFr
            ? "Forfait fixe, livraison en 2 Ã  6 semaines, formation incluse. Pas d'abonnement, pas de maintenance imposÃ©e. RÃ©ponse Ã  votre brief sous 48 h ouvrÃ©es."
            : "Fixed fee, 2 to 6 week delivery, training included. No subscription, no imposed maintenance. Reply to your brief within 48 business hours."
        }
        cta={
          <>
            <Cta href="/contact" size="lg" track="impl-final-primary">
              {isFr ? "DÃ©crire mon besoin Â· rÃ©ponse 48 h" : "Describe my need Â· 48 h reply"}
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Cta>
            <Cta href="/audit" size="lg" variant="outline" track="impl-final-audit">
              {isFr ? "Commencer par un audit" : "Start with an audit"}
            </Cta>
          </>
        }
        tone="mocha"
      />

      {/* CTA flottant mobile â€” visible < lg, aprÃ¨s scroll passÃ© le hero,
          cachÃ© en bas de page (le CTA Block final reprend le relais). */}
      <StickyMobileCta
        href="/contact"
        label={isFr ? "DÃ©crire mon besoin Â· 48 h" : "Describe my need Â· 48 h"}
        track="impl-sticky-mobile"
      />
    </>
  );
}
