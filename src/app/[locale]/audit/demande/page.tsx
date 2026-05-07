import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { Globe2, Building2, Mail, Clock } from "lucide-react";
import { routing, type Locale } from "@/i18n/routing";
import { Container } from "@/components/layout/Container";
import { JsonLd } from "@/components/marketing/JsonLd";
import { AuditRequestForm } from "@/components/forms/AuditRequestForm";
import { buildProductMetadata, buildBreadcrumbJsonLd } from "@/lib/seo";

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  return buildProductMetadata({
    locale,
    path: "/audit/demande",
    title:
      locale === "fr"
        ? "Demander un audit IA · 6 étapes · AxionIA"
        : "Request an AI audit · 6 steps · AxionIA",
    description:
      locale === "fr"
        ? "Formulaire 6 étapes pour demander un audit IA AxionIA — niveau (Flash / Process / Stratégique PME / ETI), taille, secteur, lieu, périmètre. Devis personnalisé sous 48 h ouvrées."
        : "6-step form to request an AxionIA AI audit — level (Flash / Process / Strategic SMB / mid-cap), size, sector, location, scope. Personalised quote within 48 business hours.",
    alternates: { fr: "/audit/demande", en: "/audit/request" },
  });
}

export default async function AuditRequest({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";

  const breadcrumb = buildBreadcrumbJsonLd({
    locale: loc,
    items: [
      { name: isFr ? "Accueil" : "Home", href: "/" },
      { name: isFr ? "Audit & optimisation" : "Audit & optimization", href: "/audit" },
      { name: isFr ? "Demande" : "Request", href: "/audit/demande" },
    ],
  });

  const labels = isFr
    ? {
        step: "Étape",
        next: "Suivant",
        previous: "Précédent",
        cancel: "Annuler",
        submit: "Envoyer ma demande",
        sending: "Envoi…",
        successHeader: "Demande enregistrée",
        successTitle: "On vous rappelle sous 48 h ouvrées",
        successBody:
          "Notre équipe étudie votre contexte et vous renvoie un devis personnalisé par email — avec un créneau d'appel proposé pour le cadrage. Vérifiez vos spams si rien n'arrive sous 48 h.",
        successCta: "Faire une autre demande",
        failure: "Une erreur est survenue. Réessayez ou écrivez à contact@axion-ia.com.",

        s1Eyebrow: "1 · Niveau d'audit",
        s1Title: "Quel niveau d'audit vous correspond ?",
        s1Description:
          "Du diagnostic flash au plan stratégique multi-sites. Le niveau sélectionné préremplit la suite — vous pourrez tout modifier.",
        auditTypes: [
          {
            key: "flash" as const,
            label: "Niveau 1 · Flash",
            description:
              "Mini-diagnostic ciblé sur 1 zone clé · on identifie 3 à 5 endroits où l'IA peut s'insérer dans votre entreprise, avec gains estimés.",
            priceFrom: "490 € (distance) · 890 € (sur site)",
          },
          {
            key: "process" as const,
            label: "Niveau 2 · Audit ciblé",
            description:
              "Audit poussé d'un service complet (RH, finance, vente, ops…). On liste tout ce qui peut être automatisé avec gains chiffrés et plan 6-12 mois.",
            priceFrom: "1 900 € → 3 900 €",
          },
          {
            key: "strategique-pme" as const,
            label: "Niveau 3 · Stratégique PME",
            description:
              "Vision IA globale pour PME 20-250 salariés · 2-4 services majeurs étudiés, plan d'action 12-24 mois avec budgets.",
            priceFrom: "4 900 € → 9 900 €",
          },
          {
            key: "strategique-eti" as const,
            label: "Niveau 4 · Stratégique ETI",
            description:
              "Audit stratégique multi-sites pour ETI / groupes · alignement CODIR, roadmap groupe 24 mois, gouvernance & AI Act.",
            priceFrom: "À partir de 12 000 € · sur devis sur mesure",
          },
        ],

        s2Eyebrow: "2 · Votre entreprise",
        s2Title: "Parlez-nous de vous",
        s2Description:
          "On a besoin de la taille et du secteur d'activité pour calibrer le devis et orienter le périmètre d'audit.",
        sizeLabel: "Taille de votre entreprise",
        sizes: [
          { key: "tpe" as const, label: "TPE / Artisan (1-9)" },
          { key: "pme" as const, label: "PME (10-49)" },
          { key: "mid" as const, label: "Moyenne (50-249)" },
          { key: "enterprise" as const, label: "Grande (250+)" },
        ],
        industryLabel: "Secteur d'activité",
        industryPlaceholder: "Ex : industrie, juridique, retail, santé, hôtellerie…",
        companyNameLabel: "Nom de l'entreprise (optionnel)",
        companyNamePlaceholder: "Ex : ACME SAS",

        s3Eyebrow: "3 · Lieu & modalité",
        s3Title: "Sur site ou à distance ?",
        s3Description:
          "On intervient partout en France et à l'international. Sur site recommandé dès le niveau Process pour les ateliers métiers. À distance possible partout.",
        modalityLabel: "Modalité souhaitée",
        modalityRemote: "À distance",
        modalityRemoteHint: "Visio sécurisée + entretiens · gain de temps + tarif réduit.",
        modalityOnsite: "Sur site",
        modalityOnsiteHint: "Notre équipe se déplace · observation directe + immersion équipe.",
        cityLabel: "Ville",
        cityPlaceholder: "Ex : Paris, Lyon, Bruxelles, Genève…",
        countryLabel: "Pays",
        countryPlaceholder: "Ex : France, Belgique, Suisse, Luxembourg, Maroc…",

        s4Eyebrow: "4 · Périmètre & objectifs",
        s4Title: "Que voulez-vous étudier ?",
        s4Description:
          "Décrivez précisément ce que vous voulez auditer et les bénéfices attendus. Plus c'est précis, plus le devis est juste.",
        scopeLabel: "Périmètre d'audit",
        scopeGlobal: "Audit global",
        scopeGlobalHint: "Toute l'entreprise, tous les services, vue d'ensemble.",
        scopeSingleArea: "Audit ciblé",
        scopeSingleAreaHint: "Un seul service, un commerce, un type de dossier précis.",
        scopeDetailLabel: "Précisez le périmètre",
        scopeDetailPlaceholder:
          "Ex : « commerce de 8 personnes, focus relation client + caisse » — ou « tous les services sauf l'IT, dont équipe commerciale 25p, RH 5p, ops 12p ».",
        maturityLabel: "Votre maturité IA actuelle",
        maturityZero: "Aucun usage IA en place",
        maturityStarting: "Premiers usages testés",
        maturityMature: "Usages IA matures, on optimise",
        goalsLabel: "Objectifs de l'audit",
        goalsPlaceholder:
          "Ex : « libérer du temps à l'équipe commerciale », « réduire les dépenses de prestations externes », « automatiser les saisies répétitives »…",

        s5Eyebrow: "5 · Vos coordonnées",
        s5Title: "Comment vous joindre ?",
        s5Description: "Nom, email professionnel et téléphone — pour le call de cadrage.",
        contactLabel: "Nom & prénom",
        emailLabel: "Email professionnel",
        phoneLabel: "Téléphone (optionnel · pour le call de cadrage si devis accepté)",
        roleLabel: "Votre rôle dans l'entreprise (optionnel)",
        rolePlaceholder: "Ex : Direction, DRH, COO, Head of operations…",

        s6Eyebrow: "6 · Récap & envoi",
        s6Title: "On vérifie ensemble avant l'envoi",
        s6Description:
          "Tout est modifiable en revenant sur les étapes précédentes. Cliquez sur « Envoyer » quand le récap est OK.",
        consentLabel:
          "J'accepte que mes données soient utilisées pour traiter cette demande conformément à la politique de confidentialité. Aucune donnée n'est revendue ni transmise à des tiers.",
        recapTitle: "Votre demande en un coup d'œil",
        recapModality: "Modalité",
        recapType: "Type d'audit",
        recapSize: "Taille",
        recapIndustry: "Secteur",
        recapLocation: "Lieu",
        recapScope: "Périmètre",
        recapMaturity: "Maturité IA",
        recapContact: "Contact",

        stepLabels: ["Type", "Entreprise", "Lieu", "Périmètre", "Contact", "Récap"] as const,
      }
    : {
        step: "Step",
        next: "Next",
        previous: "Previous",
        cancel: "Cancel",
        submit: "Send my request",
        sending: "Sending…",
        successHeader: "Request saved",
        successTitle: "We will call you back within 48 business hours",
        successBody:
          "Our team reviews your context and emails you a personalised quote — with a proposed framing call slot. Check your spam if nothing arrives within 48 h.",
        successCta: "Send another request",
        failure: "An error occurred. Try again or email contact@axion-ia.com.",

        s1Eyebrow: "1 · Audit level",
        s1Title: "Which audit level fits you?",
        s1Description:
          "From the flash diagnosis to the multi-site strategic plan. The selected level pre-fills the next steps — you can change anything later.",
        auditTypes: [
          {
            key: "flash" as const,
            label: "Level 1 · Flash",
            description:
              "Targeted mini-diagnosis on 1 key area · we identify 3 to 5 places where AI can fit in your company, with estimated gains.",
            priceFrom: "€490 (remote) · €890 (on site)",
          },
          {
            key: "process" as const,
            label: "Level 2 · Targeted audit",
            description:
              "In-depth audit of a full service (HR, finance, sales, ops…). We list everything that can be automated with costed gains and a 6-12 month plan.",
            priceFrom: "€1,900 → €3,900",
          },
          {
            key: "strategique-pme" as const,
            label: "Level 3 · Strategic SMB",
            description:
              "Global AI vision for SMBs 20-250 staff · 2-4 major services studied, 12-24 month action plan with budgets.",
            priceFrom: "€4,900 → €9,900",
          },
          {
            key: "strategique-eti" as const,
            label: "Level 4 · Strategic mid-cap",
            description:
              "Multi-site strategic audit for mid-caps / groups · leadership alignment, 24-month group roadmap, governance & AI Act.",
            priceFrom: "From €12,000 · custom quote, no cap",
          },
        ],

        s2Eyebrow: "2 · Your company",
        s2Title: "Tell us about you",
        s2Description:
          "We need the size and the sector to calibrate the quote and orient the audit scope.",
        sizeLabel: "Company size",
        sizes: [
          { key: "tpe" as const, label: "Small / Trades (1-9)" },
          { key: "pme" as const, label: "PME (10-49)" },
          { key: "mid" as const, label: "Mid-market (50-249)" },
          { key: "enterprise" as const, label: "Enterprise (250+)" },
        ],
        industryLabel: "Sector",
        industryPlaceholder: "e.g. industry, legal, retail, healthcare, hospitality…",
        companyNameLabel: "Company name (optional)",
        companyNamePlaceholder: "e.g. ACME SAS",

        s3Eyebrow: "3 · Location & modality",
        s3Title: "On site or remote?",
        s3Description:
          "We work everywhere in France and worldwide. On site recommended from Process level for business workshops. Remote possible everywhere.",
        modalityLabel: "Preferred modality",
        modalityRemote: "Remote",
        modalityRemoteHint: "Secure video + interviews · time saved + reduced fee.",
        modalityOnsite: "On site",
        modalityOnsiteHint: "Our team travels · direct observation + team immersion.",
        cityLabel: "City",
        cityPlaceholder: "e.g. Paris, Lyon, Brussels, Geneva…",
        countryLabel: "Country",
        countryPlaceholder: "e.g. France, Belgium, Switzerland, Luxembourg, Morocco…",

        s4Eyebrow: "4 · Scope & goals",
        s4Title: "What do you want audited?",
        s4Description:
          "Describe precisely what you want audited and the expected benefits. The more precise, the more accurate the quote.",
        scopeLabel: "Audit scope",
        scopeGlobal: "Global audit",
        scopeGlobalHint: "Whole company, every service, big picture.",
        scopeSingleArea: "Targeted audit",
        scopeSingleAreaHint: "One service, one storefront, a single case type.",
        scopeDetailLabel: "Detail the scope",
        scopeDetailPlaceholder:
          'e.g. "8-person store, focus on customer relation + checkout" — or "all services except IT, including 25-person sales, 5-person HR, 12-person ops".',
        maturityLabel: "Current AI maturity",
        maturityZero: "No AI use in place",
        maturityStarting: "Early uses tried",
        maturityMature: "Mature AI uses, optimizing",
        goalsLabel: "Audit goals",
        goalsPlaceholder:
          'e.g. "identify 5 to 10 AI quick-wins to free up sales time", "benchmark our maturity vs competitors", "cost a 12-month implementation plan"…',

        s5Eyebrow: "5 · Your contact",
        s5Title: "How can we reach you?",
        s5Description: "Name, professional email and phone — for the framing call.",
        contactLabel: "Full name",
        emailLabel: "Professional email",
        phoneLabel: "Phone (optional · for the framing call if quote accepted)",
        roleLabel: "Your role at the company (optional)",
        rolePlaceholder: "e.g. CEO, Head of HR, COO, Head of operations…",

        s6Eyebrow: "6 · Recap & send",
        s6Title: "Let's check together before sending",
        s6Description:
          "Anything can be edited by going back to previous steps. Click Send when the recap looks good.",
        consentLabel:
          "I agree to my data being used to process this request in accordance with the privacy policy. No data is sold or transmitted to third parties.",
        recapTitle: "Your request at a glance",
        recapModality: "Modality",
        recapType: "Audit type",
        recapSize: "Size",
        recapIndustry: "Sector",
        recapLocation: "Location",
        recapScope: "Scope",
        recapMaturity: "AI maturity",
        recapContact: "Contact",

        stepLabels: ["Type", "Company", "Location", "Scope", "Contact", "Recap"] as const,
      };

  // Bandeau réassurance — 4 pills.
  const reassurance = [
    {
      icon: Globe2,
      label: isFr ? "France & international" : "France & international",
    },
    {
      icon: Building2,
      label: isFr ? "TPE → grandes entreprises" : "Small → enterprise",
    },
    {
      icon: Clock,
      label: isFr ? "Devis sous 48 h ouvrées" : "Quote within 48 business hours",
    },
    {
      icon: Mail,
      label: isFr ? "Aucune relance, aucun engagement" : "No follow-up spam, no commitment",
    },
  ];

  return (
    <>
      {/* Hero compact — paddings réduits pour rapprocher le formulaire de la fold. */}
      <section className="bg-halo-warm relative overflow-hidden py-14 sm:py-16 lg:py-20">
        <Container className="relative">
          <p className="text-fg-muted text-[13px] font-medium tracking-[0.16em] uppercase">
            <span
              aria-hidden="true"
              className="bg-terracotta mr-3 inline-block h-1.5 w-1.5 rounded-full align-middle"
            />
            {isFr ? "Demande d'audit · 6 étapes" : "Audit request · 6 steps"}
          </p>
          <h1
            className="text-fg mt-4 text-[clamp(2rem,5vw,3.5rem)] leading-[1.04] font-medium tracking-tight"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            {isFr ? "Demander un " : "Request an "}
            <span className="text-terracotta italic">
              {isFr ? "audit IA personnalisé" : "personalised AI audit"}
            </span>
          </h1>
          <p className="text-fg-soft mt-4 max-w-2xl text-base leading-relaxed sm:text-lg">
            {isFr
              ? "6 questions pour cadrer votre projet. Devis personnalisé sous 48 h ouvrées · TPE → ETI · France & international."
              : "6 questions to frame your project. Personalised quote within 48 business hours · Small → enterprise · France & worldwide."}
          </p>

          {/* Bandeau réassurance — 4 pills */}
          <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-3 text-sm">
            {reassurance.map((r) => {
              const Icon = r.icon;
              return (
                <li
                  key={r.label}
                  className="bg-paper/70 border-border-strong text-fg flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[13px] font-medium"
                >
                  <Icon className="text-terracotta-deep h-4 w-4" aria-hidden="true" />
                  {r.label}
                </li>
              );
            })}
          </ul>
        </Container>
      </section>

      {/* Form */}
      <div className="bg-bg py-10 sm:py-14">
        <Container>
          <AuditRequestForm labels={labels} locale={loc} />
        </Container>
      </div>

      <JsonLd data={breadcrumb} />
    </>
  );
}
