import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { Globe2, Building2, Mail, Clock } from "lucide-react";
import { routing, type Locale } from "@/i18n/routing";
import { Container } from "@/components/layout/Container";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { AuditRequestForm } from "@/components/forms/AuditRequestForm";
import { buildProductMetadata } from "@/lib/seo";

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
        ? "Demander un audit IA Â· 6 Ã©tapes Â· AxionIA"
        : "Request an AI audit Â· 6 steps Â· AxionIA",
    description:
      locale === "fr"
        ? "Formulaire 6 Ã©tapes pour demander un audit IA AxionIA â€” niveau (Flash / Process / StratÃ©gique PME / ETI), taille, secteur, lieu, pÃ©rimÃ¨tre. Devis personnalisÃ© sous 48 h ouvrÃ©es."
        : "6-step form to request an AxionIA AI audit â€” level (Flash / Process / Strategic SMB / mid-cap), size, sector, location, scope. Personalised quote within 48 business hours.",
    alternates: { fr: "/audit/demande", en: "/audit/request" },
  });
}

export default async function AuditRequest({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";

  // Breadcrumb visuel + JSON-LD intÃ©grÃ© (composant unique). L'item "Accueil"
  // est ajoutÃ© automatiquement par le composant.
  const breadcrumbItems = [
    { href: "/audit", label: isFr ? "Audit & optimisation" : "Audit & optimization" },
    { href: "/audit/demande", label: isFr ? "Demande" : "Request" },
  ];

  const labels = isFr
    ? {
        step: "Ã‰tape",
        next: "Suivant",
        previous: "PrÃ©cÃ©dent",
        cancel: "Annuler",
        submit: "Envoyer ma demande",
        sending: "Envoiâ€¦",
        successHeader: "Demande enregistrÃ©e",
        successTitle: "On vous rappelle sous 48 h ouvrÃ©es",
        successBody:
          "Notre Ã©quipe Ã©tudie votre contexte et vous renvoie un devis personnalisÃ© par email â€” avec un crÃ©neau d'appel proposÃ© pour le cadrage. VÃ©rifiez vos spams si rien n'arrive sous 48 h.",
        successCta: "Faire une autre demande",
        failure: "Une erreur est survenue. RÃ©essayez ou Ã©crivez Ã  contact@axion-ia.com.",

        s1Eyebrow: "1 Â· Niveau d'audit",
        s1Title: "Quel niveau d'audit vous correspond ?",
        s1Description:
          "Du diagnostic flash au plan stratÃ©gique multi-sites. Le niveau sÃ©lectionnÃ© prÃ©remplit la suite â€” vous pourrez tout modifier.",
        auditTypes: [
          {
            key: "flash" as const,
            label: "Niveau 1 Â· Flash",
            description:
              "Mini-diagnostic ciblÃ© sur 1 zone clÃ© Â· on identifie 3 Ã  5 endroits oÃ¹ l'IA peut s'insÃ©rer dans votre entreprise, avec gains estimÃ©s.",
            priceFrom: "490 â‚¬ (distance) Â· 890 â‚¬ (sur site)",
          },
          {
            key: "process" as const,
            label: "Niveau 2 Â· Audit ciblÃ©",
            description:
              "Audit poussÃ© d'un service complet (RH, finance, vente, opsâ€¦). On liste tout ce qui peut Ãªtre automatisÃ© avec gains chiffrÃ©s et plan 6-12 mois.",
            priceFrom: "1 900 â‚¬ â†’ 3 900 â‚¬",
          },
          {
            key: "strategique-pme" as const,
            label: "Niveau 3 Â· StratÃ©gique PME",
            description:
              "Vision IA globale pour PME 20-250 salariÃ©s Â· 2-4 services majeurs Ã©tudiÃ©s, plan d'action 12-24 mois avec budgets.",
            priceFrom: "4 900 â‚¬ â†’ 9 900 â‚¬",
          },
          {
            key: "strategique-eti" as const,
            label: "Niveau 4 Â· StratÃ©gique ETI",
            description:
              "Audit stratÃ©gique multi-sites pour ETI / groupes Â· alignement CODIR, roadmap groupe 24 mois, gouvernance & AI Act.",
            priceFrom: "Ã€ partir de 12 000 â‚¬ Â· sur devis sur mesure",
          },
        ],

        s2Eyebrow: "2 Â· Votre entreprise",
        s2Title: "Parlez-nous de vous",
        s2Description:
          "On a besoin de la taille et du secteur d'activitÃ© pour calibrer le devis et orienter le pÃ©rimÃ¨tre d'audit.",
        sizeLabel: "Taille de votre entreprise",
        sizes: [
          { key: "tpe" as const, label: "TPE / Artisan (1-9)" },
          { key: "pme" as const, label: "PME (10-49)" },
          { key: "mid" as const, label: "Moyenne (50-249)" },
          { key: "enterprise" as const, label: "Grande (250+)" },
        ],
        industryLabel: "Secteur d'activitÃ©",
        industryPlaceholder: "Ex : industrie, juridique, retail, santÃ©, hÃ´tellerieâ€¦",
        companyNameLabel: "Nom de l'entreprise (optionnel)",
        companyNamePlaceholder: "Ex : ACME SAS",

        s3Eyebrow: "3 Â· Lieu & modalitÃ©",
        s3Title: "Sur site ou Ã  distance ?",
        s3Description:
          "On intervient partout en France et Ã  l'international. Sur site recommandÃ© dÃ¨s le niveau Process pour les ateliers mÃ©tiers. Ã€ distance possible partout.",
        modalityLabel: "ModalitÃ© souhaitÃ©e",
        modalityRemote: "Ã€ distance",
        modalityRemoteHint: "Visio sÃ©curisÃ©e + entretiens Â· gain de temps + tarif rÃ©duit.",
        modalityOnsite: "Sur site",
        modalityOnsiteHint: "Notre Ã©quipe se dÃ©place Â· observation directe + immersion Ã©quipe.",
        cityLabel: "Ville",
        cityPlaceholder: "Ex : Paris, Lyon, Bruxelles, GenÃ¨veâ€¦",
        countryLabel: "Pays",
        countryPlaceholder: "Ex : France, Belgique, Suisse, Luxembourg, Marocâ€¦",

        s4Eyebrow: "4 Â· PÃ©rimÃ¨tre & objectifs",
        s4Title: "Que voulez-vous Ã©tudier ?",
        s4Description:
          "DÃ©crivez prÃ©cisÃ©ment ce que vous voulez auditer et les bÃ©nÃ©fices attendus. Plus c'est prÃ©cis, plus le devis est juste.",
        scopeLabel: "PÃ©rimÃ¨tre d'audit",
        scopeGlobal: "Audit global",
        scopeGlobalHint: "Toute l'entreprise, tous les services, vue d'ensemble.",
        scopeSingleArea: "Audit ciblÃ©",
        scopeSingleAreaHint: "Un seul service, un commerce, un type de dossier prÃ©cis.",
        scopeDetailLabel: "PrÃ©cisez le pÃ©rimÃ¨tre",
        scopeDetailPlaceholder:
          "Ex : Â« commerce de 8 personnes, focus relation client + caisse Â» â€” ou Â« tous les services sauf l'IT, dont Ã©quipe commerciale 25p, RH 5p, ops 12p Â».",
        maturityLabel: "Votre maturitÃ© IA actuelle",
        maturityZero: "Aucun usage IA en place",
        maturityStarting: "Premiers usages testÃ©s",
        maturityMature: "Usages IA matures, on optimise",
        goalsLabel: "Objectifs de l'audit",
        goalsPlaceholder:
          "Ex : Â« libÃ©rer du temps Ã  l'Ã©quipe commerciale Â», Â« rÃ©duire les dÃ©penses de prestations externes Â», Â« automatiser les saisies rÃ©pÃ©titives Â»â€¦",

        s5Eyebrow: "5 Â· Vos coordonnÃ©es",
        s5Title: "Comment vous joindre ?",
        s5Description: "Nom, email professionnel et tÃ©lÃ©phone â€” pour le call de cadrage.",
        contactLabel: "Nom & prÃ©nom",
        emailLabel: "Email professionnel",
        phoneLabel: "TÃ©lÃ©phone (optionnel Â· pour le call de cadrage si devis acceptÃ©)",
        roleLabel: "Votre rÃ´le dans l'entreprise (optionnel)",
        rolePlaceholder: "Ex : Direction, DRH, COO, Head of operationsâ€¦",

        s6Eyebrow: "6 Â· RÃ©cap & envoi",
        s6Title: "On vÃ©rifie ensemble avant l'envoi",
        s6Description:
          "Tout est modifiable en revenant sur les Ã©tapes prÃ©cÃ©dentes. Cliquez sur Â« Envoyer Â» quand le rÃ©cap est OK.",
        consentLabel:
          "J'accepte que mes donnÃ©es soient utilisÃ©es pour traiter cette demande conformÃ©ment Ã  la politique de confidentialitÃ©. Aucune donnÃ©e n'est revendue ni transmise Ã  des tiers.",
        recapTitle: "Votre demande en un coup d'Å“il",
        recapModality: "ModalitÃ©",
        recapType: "Type d'audit",
        recapSize: "Taille",
        recapIndustry: "Secteur",
        recapLocation: "Lieu",
        recapScope: "PÃ©rimÃ¨tre",
        recapMaturity: "MaturitÃ© IA",
        recapContact: "Contact",

        stepLabels: ["Type", "Entreprise", "Lieu", "PÃ©rimÃ¨tre", "Contact", "RÃ©cap"] as const,
      }
    : {
        step: "Step",
        next: "Next",
        previous: "Previous",
        cancel: "Cancel",
        submit: "Send my request",
        sending: "Sendingâ€¦",
        successHeader: "Request saved",
        successTitle: "We will call you back within 48 business hours",
        successBody:
          "Our team reviews your context and emails you a personalised quote â€” with a proposed framing call slot. Check your spam if nothing arrives within 48 h.",
        successCta: "Send another request",
        failure: "An error occurred. Try again or email contact@axion-ia.com.",

        s1Eyebrow: "1 Â· Audit level",
        s1Title: "Which audit level fits you?",
        s1Description:
          "From the flash diagnosis to the multi-site strategic plan. The selected level pre-fills the next steps â€” you can change anything later.",
        auditTypes: [
          {
            key: "flash" as const,
            label: "Level 1 Â· Flash",
            description:
              "Targeted mini-diagnosis on 1 key area Â· we identify 3 to 5 places where AI can fit in your company, with estimated gains.",
            priceFrom: "â‚¬490 (remote) Â· â‚¬890 (on site)",
          },
          {
            key: "process" as const,
            label: "Level 2 Â· Targeted audit",
            description:
              "In-depth audit of a full service (HR, finance, sales, opsâ€¦). We list everything that can be automated with costed gains and a 6-12 month plan.",
            priceFrom: "â‚¬1,900 â†’ â‚¬3,900",
          },
          {
            key: "strategique-pme" as const,
            label: "Level 3 Â· Strategic SMB",
            description:
              "Global AI vision for SMBs 20-250 staff Â· 2-4 major services studied, 12-24 month action plan with budgets.",
            priceFrom: "â‚¬4,900 â†’ â‚¬9,900",
          },
          {
            key: "strategique-eti" as const,
            label: "Level 4 Â· Strategic mid-cap",
            description:
              "Multi-site strategic audit for mid-caps / groups Â· leadership alignment, 24-month group roadmap, governance & AI Act.",
            priceFrom: "From â‚¬12,000 Â· custom quote, no cap",
          },
        ],

        s2Eyebrow: "2 Â· Your company",
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
        industryPlaceholder: "e.g. industry, legal, retail, healthcare, hospitalityâ€¦",
        companyNameLabel: "Company name (optional)",
        companyNamePlaceholder: "e.g. ACME SAS",

        s3Eyebrow: "3 Â· Location & modality",
        s3Title: "On site or remote?",
        s3Description:
          "We work everywhere in France and worldwide. On site recommended from Process level for business workshops. Remote possible everywhere.",
        modalityLabel: "Preferred modality",
        modalityRemote: "Remote",
        modalityRemoteHint: "Secure video + interviews Â· time saved + reduced fee.",
        modalityOnsite: "On site",
        modalityOnsiteHint: "Our team travels Â· direct observation + team immersion.",
        cityLabel: "City",
        cityPlaceholder: "e.g. Paris, Lyon, Brussels, Genevaâ€¦",
        countryLabel: "Country",
        countryPlaceholder: "e.g. France, Belgium, Switzerland, Luxembourg, Moroccoâ€¦",

        s4Eyebrow: "4 Â· Scope & goals",
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
          'e.g. "8-person store, focus on customer relation + checkout" â€” or "all services except IT, including 25-person sales, 5-person HR, 12-person ops".',
        maturityLabel: "Current AI maturity",
        maturityZero: "No AI use in place",
        maturityStarting: "Early uses tried",
        maturityMature: "Mature AI uses, optimizing",
        goalsLabel: "Audit goals",
        goalsPlaceholder:
          'e.g. "identify 5 to 10 AI quick-wins to free up sales time", "benchmark our maturity vs competitors", "cost a 12-month implementation plan"â€¦',

        s5Eyebrow: "5 Â· Your contact",
        s5Title: "How can we reach you?",
        s5Description: "Name, professional email and phone â€” for the framing call.",
        contactLabel: "Full name",
        emailLabel: "Professional email",
        phoneLabel: "Phone (optional Â· for the framing call if quote accepted)",
        roleLabel: "Your role at the company (optional)",
        rolePlaceholder: "e.g. CEO, Head of HR, COO, Head of operationsâ€¦",

        s6Eyebrow: "6 Â· Recap & send",
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

  // Bandeau rÃ©assurance â€” 4 pills.
  const reassurance = [
    {
      icon: Globe2,
      label: isFr ? "France & international" : "France & international",
    },
    {
      icon: Building2,
      label: isFr ? "TPE â†’ grandes entreprises" : "Small â†’ enterprise",
    },
    {
      icon: Clock,
      label: isFr ? "Devis sous 48 h ouvrÃ©es" : "Quote within 48 business hours",
    },
    {
      icon: Mail,
      label: isFr ? "Aucune relance, aucun engagement" : "No follow-up spam, no commitment",
    },
  ];

  return (
    <>
      <Container className="border-border border-b py-3">
        <Breadcrumbs items={breadcrumbItems} />
      </Container>
      {/* Hero compact â€” paddings rÃ©duits pour rapprocher le formulaire de la fold. */}
      <section className="bg-halo-warm relative overflow-hidden pt-8 pb-14 sm:pt-10 sm:pb-16 lg:pt-12 lg:pb-20">
        <Container className="relative">
          <p className="text-fg-muted text-[13px] font-medium tracking-[0.16em] uppercase">
            <span
              aria-hidden="true"
              className="bg-terracotta mr-3 inline-block h-1.5 w-1.5 rounded-full align-middle"
            />
            {isFr ? "Demande d'audit Â· 6 Ã©tapes" : "Audit request Â· 6 steps"}
          </p>
          <h1
            className="text-fg mt-4 text-[clamp(2rem,5vw,3.5rem)] leading-[1.04] font-medium tracking-tight"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            {isFr ? "Demander un " : "Request an "}
            <span className="text-terracotta italic">
              {isFr ? "audit IA personnalisÃ©" : "personalised AI audit"}
            </span>
          </h1>
          <p className="text-fg-soft mt-4 max-w-2xl text-base leading-relaxed sm:text-lg">
            {isFr
              ? "6 questions pour cadrer votre projet. Devis personnalisÃ© sous 48 h ouvrÃ©es Â· TPE â†’ ETI Â· France & international."
              : "6 questions to frame your project. Personalised quote within 48 business hours Â· Small â†’ enterprise Â· France & worldwide."}
          </p>

          {/* Bandeau rÃ©assurance â€” 4 pills */}
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
    </>
  );
}
