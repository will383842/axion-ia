// Page SEO/AEO/GEO — « apporteur d'affaires indépendant · formations IA en
// entreprise ». Cible de l'annonce jemepropose.com (2026-08-23).
//
// 🔴 POURQUOI CETTE PAGE EST INDEXABLE, alors que les landings de réception (`/leboncoin`, `/indeed`) ne
// l'est pas. La distinction n'est pas cosmétique :
//
//   · `/leboncoin` est une page de RÉCEPTION d'annonce. 100 % de son
//     trafic vient du lien de l'annonce, elle ne vise aucune requête, et son
//     contenu est un quasi-doublon de `/devenir-commercial-ia`. L'indexer
//     cannibaliserait la page qui porte le JobPosting Google for Jobs, pour un
//     gain nul, avec un risque de doorway.
//
//   · CETTE page vise un CLUSTER DE REQUÊTES DISTINCT — « apporteur d'affaires
//     indépendant », « apport d'affaires formation », « devenir apporteur
//     d'affaires » — là où `/devenir-commercial-ia` vise « devenir commercial
//     IA ». Deux intentions différentes, deux vocabulaires différents : un
//     apporteur d'affaires ne se cherche pas « commercial », et réciproquement.
//
// ⚠️ La ligne à tenir : cette page reste indexable TANT QUE son contenu diffère
// réellement. Si elle dérive vers une copie de `/devenir-commercial-ia`, elle
// devient un doorway et il faudra la passer en `noindex`. La différenciation
// est éditoriale, pas technique — aucun test ne la garde.
//
// AEO/GEO : `speakable` sur les réponses directes, FAQPage en JSON-LD, réponses
// rédigées pour être citées telles quelles par un moteur de réponse (une
// affirmation vérifiable par phrase, pas de renvoi à « voir ci-dessus »).

import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { Check } from "lucide-react";

import { routing, type Locale } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import { Section } from "@/components/layout/Section";
import { HeroBadge } from "@/components/marketing/HeroBadge";
import { Cta } from "@/components/marketing/Cta";
import { JsonLd } from "@/components/marketing/JsonLd";
import { StickyMobileCta } from "@/components/marketing/StickyMobileCta";
import { UnsplashCredit } from "@/components/media/UnsplashCredit";
import { FaqBlock } from "@/components/sections/FaqBlock";
import { CtaBlock } from "@/components/sections/CtaBlock";
import { buildProductMetadata, buildWebPageJsonLd } from "@/lib/seo";
import { isQualiopiCertificationObtenue } from "@/server/qualiopi/config/flag";
import {
  AUDIT_TIERS,
  COMMISSION_FORMATION_PAR_JOURNEE_EUR,
  getCommissionById,
  getTierById,
} from "@/content/pricing";
import { COMMERCIAL_OFFER_DATE_POSTED } from "@/content/recrutement/dates";
import { memoPhoto, type MemoIserePhotoSlot } from "@/content/recrutement/memo-isere-photos";
import {
  PARTENAIRE_CE_QUE_CE_NEST_PAS,
  PARTENAIRE_ETAPES,
  PARTENAIRE_OBJECTION_IA,
  PARTENAIRE_PROFILS,
} from "@/content/recrutement/partenaire-landings";

export const revalidate = 3600;

const PATH = "/apporteur-affaires-independant-formation-ia-entreprise";

/**
 * Mentions AFFIRMANT la certification — servies UNIQUEMENT sous
 * `isQualiopiCertificationObtenue()`, appelé dans le composant.
 *
 * 🔴 Déclarées ICI, dans le fichier qui lit le drapeau. Le 2026-08-19,
 * « Organisme certifié Qualiopi » a été servi en production sur `/memo-isere`
 * précisément parce que le littéral vivait dans un fichier n'important aucun
 * drapeau. Le test `assertion-flag-surfaces.spec.ts` interdit ce montage :
 * cette page est inscrite à son registre `ASSERTION_SURFACES`.
 */
const REASSURANCE_CERTIFIE: readonly string[] = [
  "Organisme certifié Qualiopi",
  "Formations finançables OPCO",
];

const REASSURANCE_BASE: readonly string[] = [
  "Statut libre : micro-entreprise, agent commercial, apporteur",
  "Cumulable avec ton activité actuelle",
  "Démarrer ne te coûte rien",
];

interface Props {
  params: Promise<{ locale: string }>;
}

const NBSP = " ";

function euros(montant: number): string {
  return `${montant.toLocaleString("fr-FR").replace(/\s/g, NBSP)}${NBSP}€`;
}

function commission(jours: number): string {
  return euros(jours * COMMISSION_FORMATION_PAR_JOURNEE_EUR);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const isFr = locale === "fr";

  const title = isFr
    ? "Apporteur d'affaires indépendant · formations IA en entreprise"
    : "Independent business introducer · AI training for companies";

  return {
    ...(await buildProductMetadata({
      locale,
      path: PATH,
      title,
      description: isFr
        ? `Devenez apporteur d'affaires indépendant pour des formations et audits IA en entreprise, partout en France. ${commission(1)} par journée de formation vendue. Vous présentez, nous vendons — aucune connaissance en IA requise.` /* price-exempt: commission d'apport d'affaires, pas un tarif client */
        : `Become an independent business introducer for AI training and audits, anywhere in France. You introduce, we sell — no AI knowledge required.`,
    })),
    title: { absolute: title },
  };
}

/** Photo curée + crédit (CGU Unsplash §9 — l'attribution ne se retire pas sans
 *  retirer la photo, d'où son intégration au composant). `ratio` fixe la boîte
 *  avant chargement ⇒ CLS = 0. */
function Photo({
  slot,
  alt,
  ratio,
  sizes,
  priority,
  className,
}: {
  slot: MemoIserePhotoSlot;
  alt: string;
  ratio: string;
  sizes: string;
  priority?: boolean;
  className?: string;
}) {
  const p = memoPhoto(slot);
  return (
    <figure className={className}>
      <div
        className={cn(
          "border-border shadow-card relative overflow-hidden rounded-2xl border",
          ratio,
        )}
      >
        <Image
          src={p.src}
          alt={alt}
          fill
          sizes={sizes}
          {...(priority ? { priority: true } : {})}
          className="object-cover"
        />
      </div>
      <figcaption>
        <UnsplashCredit
          photographerName={p.photographer}
          photographerUrl={p.photographerUrl}
          className="text-right"
        />
      </figcaption>
    </figure>
  );
}

function CtaCandidature({ track }: { track: string }) {
  return (
    <Cta
      href="/devenir-commercial-ia/candidature"
      size="lg"
      track={track}
      className="w-full shrink-0 justify-center whitespace-nowrap sm:w-auto"
    >
      Je candidate →
    </Cta>
  );
}

export default async function ApporteurAffairesPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const loc = locale as Locale;
  setRequestLocale(loc);

  const certifie = isQualiopiCertificationObtenue();

  // Montants DÉRIVÉS du SSOT (`pricing.ts`). Les tiers audit sont annoncés
  // « à partir de » (`isFromPrice`) : la commission calculée est donc un
  // PLANCHER — d'où « au moins » partout, jamais « jusqu'à ».
  const pctAudit = getCommissionById("com-audit").percent ?? 30;
  const auditTpe = getTierById(AUDIT_TIERS, "audit-flash").priceFlat ?? 0;
  const auditPme = getTierById(AUDIT_TIERS, "audit-strategique-pme").priceMin ?? 0;
  const commAuditTpe = Math.round((auditTpe * pctAudit) / 100);
  const commAuditPme = Math.round((auditPme * pctAudit) / 100);

  const reassurance = [...(certifie ? REASSURANCE_CERTIFIE : []), ...REASSURANCE_BASE];

  // ── FAQ ──────────────────────────────────────────────────────────────────
  // Rédigée pour l'AEO : chaque réponse commence par une affirmation
  // AUTOPORTANTE, citable hors contexte par un moteur de réponse. Jamais de
  // « comme vu plus haut » — une citation tronquée doit rester vraie.
  const faq = [
    {
      id: "definition",
      question: "C'est quoi, un apporteur d'affaires indépendant ?",
      answer:
        "Un apporteur d'affaires met en relation une entreprise et un prestataire, et perçoit une commission quand l'affaire se conclut. Il ne négocie pas, ne signe rien au nom du prestataire et n'a aucun mandat de représentation : son rôle s'arrête à la mise en relation. C'est ce qui le distingue de l'agent commercial, qui négocie et dispose d'un statut légal propre.",
    },
    {
      id: "remuneration",
      question: "Combien rapporte l'apport d'affaires sur une formation IA ?",
      answer: `Chez Axion-IA, la commission est de ${commission(1)} par journée de formation vendue : une formation de deux journées rapporte ${commission(2)}, de trois journées ${commission(3)}. Sur un audit, la commission est de ${pctAudit} % de la facture — le plus petit audit démarre à ${euros(auditTpe)} HT, soit au moins ${euros(commAuditTpe)}. Ce sont des exemples de calcul et non une promesse de revenu : la rémunération dépend des ventes conclues.`,
    },
    {
      id: "statut",
      question: "Quel statut faut-il pour être apporteur d'affaires ?",
      answer:
        "Il faut un statut d'indépendant permettant d'émettre une facture : micro-entreprise, entreprise individuelle ou société. La création d'une micro-entreprise est gratuite et se fait en ligne en une quinzaine de minutes. Aucun diplôme n'est exigé, et il n'existe pas de registre spécifique à l'apport d'affaires, contrairement à l'agent commercial.",
    },
    {
      id: "competences-ia",
      question: "Faut-il connaître l'intelligence artificielle ?",
      answer:
        "Non. L'apporteur d'affaires signale une entreprise intéressée ; c'est l'organisme qui présente l'offre, chiffre et vend. Aucune démonstration technique n'est attendue de sa part. Le dirigeant en face n'est lui-même pas spécialiste — c'est précisément la raison pour laquelle il fait appel à un organisme de formation.",
    },
    {
      id: "obligation-legale",
      question: "Pourquoi les entreprises ont-elles besoin de formations à l'IA ?",
      answer:
        "Depuis février 2025, le règlement européen sur l'intelligence artificielle impose aux entreprises qui déploient des systèmes d'IA d'assurer un niveau suffisant de maîtrise de l'IA chez leurs personnels (article 4). Cette obligation concerne toutes les tailles d'entreprise et tous les secteurs. Elle est encore largement méconnue des dirigeants, ce qui laisse le marché ouvert.",
    },
    {
      id: "paiement",
      question: "Quand l'apporteur d'affaires est-il payé ?",
      answer:
        "La commission est due lorsque le client a réglé sa facture, et non à la signature du devis. C'est la règle usuelle de l'apport d'affaires : elle protège les deux parties d'un versement sur une vente qui ne serait jamais encaissée. L'apporteur facture ensuite sa commission au prestataire.",
    },
    {
      id: "salarie",
      question: "Peut-on être apporteur d'affaires en étant salarié ?",
      answer:
        "C'est possible dans la plupart des cas, mais le contrat de travail doit être vérifié au préalable : une clause d'exclusivité ou de non-concurrence peut l'interdire. La vérification incombe au salarié. Beaucoup d'apporteurs exercent en complément d'une activité principale.",
    },
    {
      id: "age",
      question: "Y a-t-il un âge limite pour devenir apporteur d'affaires ?",
      answer:
        "Aucun. L'activité est ouverte à tout indépendant en capacité de facturer, sans limite d'âge. Les commerciaux à la retraite y sont particulièrement bien placés : le carnet d'adresses est constitué et le rythme est libre. L'effet d'une activité indépendante sur une pension dépend en revanche de la situation personnelle et doit être vérifié auprès de la caisse de retraite.",
    },
  ];

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  } as const;

  const webpageJsonLd = buildWebPageJsonLd({
    locale: loc,
    path: PATH,
    name: "Apporteur d'affaires indépendant · formations IA en entreprise",
    speakable: { selectors: ["h1", "[data-speakable]"] },
  });

  return (
    <>
      <JsonLd data={webpageJsonLd} />
      {/* `emitJsonLd={false}` sur <FaqBlock> plus bas : le FAQPage est émis ICI,
          une seule fois. Deux FAQPage sur une même URL se neutralisent. */}
      <JsonLd data={faqJsonLd} />

      {/* 1 ── Héro */}
      <Section tone="halo-warm" className="pt-8 pb-10 sm:pt-12 sm:pb-14 lg:pt-16 lg:pb-20">
        <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-14">
          <div>
            <HeroBadge className="mb-5 justify-start">
              <span
                aria-hidden="true"
                className="bg-terracotta inline-block h-1.5 w-1.5 rounded-full"
              />
              Apport d&apos;affaires · partout en France
            </HeroBadge>

            <h1 className="display-editorial text-fg text-balance">
              Apporteur d&apos;affaires indépendant,{" "}
              <span className="text-terracotta italic" style={{ fontFamily: "var(--font-serif)" }}>
                pour des formations IA en entreprise
              </span>
            </h1>

            <p data-speakable className="text-fg-soft mt-5 max-w-xl text-lg leading-relaxed">
              Vous mettez en relation une entreprise avec notre organisme, et vous touchez une
              commission quand l&apos;affaire se conclut. {commission(1)} par journée de formation
              vendue, {pctAudit}&nbsp;% sur un audit. Vous ne négociez pas et vous ne signez rien :
              nous nous en chargeons.
            </p>

            <div className="mt-7 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-4">
              <CtaCandidature track="apporteur-hero-apply" />
              <p className="text-fg-muted text-sm">
                3 minutes chrono ⏱️ · zéro CV, zéro lettre de motivation
              </p>
            </div>
          </div>

          {/* Élément LCP. Budget AGENTS.md : LCP ≤ 1 800 ms p75 — jamais de lazy-load. */}
          <Photo
            slot="hero"
            alt="Un apporteur d'affaires indépendant en rendez-vous avec une dirigeante d'entreprise."
            ratio="aspect-[4/3]"
            sizes="(min-width: 1024px) 46vw, 100vw"
            priority
          />
        </div>
      </Section>

      {/* 2 ── Réassurance */}
      <Section className="py-5 sm:py-8">
        <ul
          className="flex flex-wrap items-center gap-x-5 gap-y-2 sm:justify-center sm:gap-x-8"
          role="list"
        >
          {reassurance.map((t) => (
            <li key={t} className="text-fg-soft inline-flex items-center gap-2 text-sm font-medium">
              <Check aria-hidden="true" className="text-sage h-4 w-4 shrink-0" />
              {t}
            </li>
          ))}
        </ul>
      </Section>

      {/* 3 ── La définition. Bloc AEO : c'est la réponse directe que cherche un
          moteur pour « c'est quoi un apporteur d'affaires ». */}
      <Section
        tone="sand"
        eyebrow="Le métier"
        title="Apporteur d'affaires,"
        titleEm="ce n'est pas commercial"
        className="py-10 sm:py-14"
      >
        <div className="mt-6 grid gap-8 lg:grid-cols-2 lg:gap-12">
          <div>
            <p data-speakable className="text-fg leading-relaxed">
              Un apporteur d&apos;affaires <strong>met en relation</strong> une entreprise et un
              prestataire, puis perçoit une commission quand l&apos;affaire se conclut. Il ne
              négocie pas les prix, ne signe rien au nom du prestataire et n&apos;a aucun mandat de
              représentation.
            </p>
            <p className="text-fg-soft mt-4 leading-relaxed">
              C&apos;est ce qui le distingue de l&apos;<strong>agent commercial</strong>, qui
              négocie, dispose d&apos;un mandat permanent et relève d&apos;un statut légal propre.
              Deux métiers voisins, deux réalités juridiques différentes.
            </p>
            <p className="text-fg-soft mt-4 leading-relaxed">
              Concrètement, chez nous : vous signalez une entreprise, nous l&apos;appelons, nous
              présentons, nous chiffrons, nous facturons. Votre part du travail s&apos;arrête à la
              porte que vous avez ouverte.
            </p>
          </div>

          <div className="bg-paper border-border rounded-2xl border p-6 sm:p-7">
            <h3 className="text-fg font-serif text-xl font-semibold">
              Pourquoi le marché est ouvert
            </h3>
            <p data-speakable className="text-fg-soft mt-3 leading-relaxed">
              Depuis février 2025, le règlement européen sur l&apos;IA impose aux entreprises qui
              déploient des systèmes d&apos;IA d&apos;assurer un niveau suffisant de maîtrise de
              l&apos;IA chez leurs équipes. L&apos;obligation vaut pour toutes les tailles
              d&apos;entreprise et tous les secteurs.
            </p>
            <p className="text-fg-soft mt-3 leading-relaxed">
              Elle reste largement méconnue des dirigeants. Vous n&apos;arrivez donc pas avec un
              produit à pousser, mais avec une information qu&apos;ils n&apos;ont pas.
              {certifie
                ? " Et la formation peut être financée jusqu'à 100 % par leur OPCO, selon l'OPCO et la branche."
                : ""}
            </p>
          </div>
        </div>
      </Section>

      {/* 4 ── Rémunération */}
      <Section
        eyebrow="La commission"
        title="Ce que rapporte"
        titleEm="une mise en relation"
        className="py-10 sm:py-14"
      >
        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          <article className="bg-paper border-border rounded-2xl border p-6 sm:p-7">
            <h3 className="text-fg font-serif text-xl font-semibold">Une formation IA</h3>
            <p className="text-terracotta mt-3 font-serif text-3xl font-semibold">
              {commission(1)}
            </p>
            <p className="text-fg-muted text-sm font-medium">par journée vendue</p>
            <ul className="text-fg-soft mt-4 space-y-1.5 text-sm">
              <li>Deux journées : {commission(2)}</li>
              <li>Trois journées : {commission(3)}</li>
              {certifie ? <li>Finançable jusqu&apos;à 100 % par l&apos;OPCO</li> : null}
            </ul>
          </article>

          <article className="bg-paper border-border rounded-2xl border p-6 sm:p-7">
            <h3 className="text-fg font-serif text-xl font-semibold">Un audit IA</h3>
            <p className="text-terracotta mt-3 font-serif text-3xl font-semibold">{pctAudit} %</p>
            <p className="text-fg-muted text-sm font-medium">de la facture</p>
            <ul className="text-fg-soft mt-4 space-y-1.5 text-sm">
              <li>
                Dès {euros(auditTpe)} HT → au moins {euros(commAuditTpe)}
              </li>
              <li>
                Audit de PME dès {euros(auditPme)} HT → au moins {euros(commAuditPme)}
              </li>
            </ul>
          </article>
        </div>

        <p className="text-fg-muted mt-5 text-sm">
          Ce sont des exemples de calcul, pas une promesse : vos revenus dépendent des ventes
          conclues. La commission est due lorsque le client a réglé sa facture, pas à la signature.
        </p>
      </Section>

      {/* 5 ── « Je n'y connais rien en IA » */}
      <Section
        tone="sand"
        eyebrow="La question qu'on nous pose le plus"
        title="« Je n'y connais rien en IA »"
        titleEm="Ce n'est pas votre rôle."
        className="py-10 sm:py-14"
      >
        <div className="mt-6 grid gap-8 lg:grid-cols-2 lg:gap-12">
          <div>
            <p data-speakable className="text-fg text-lg leading-relaxed font-medium">
              Vous n&apos;avez pas besoin de savoir comment fonctionne un extincteur pour dire à un
              commerçant que la loi lui en impose un.
            </p>
            <p className="text-fg-soft mt-4 leading-relaxed">
              Votre métier, c&apos;est la relation et le carnet d&apos;adresses. Le nôtre,
              c&apos;est l&apos;IA. Aucune démonstration technique n&apos;est attendue de vous.
            </p>
            <Photo
              slot="terrain"
              alt="Une formation IA animée devant une équipe en entreprise : c'est l'organisme qui intervient, pas l'apporteur."
              ratio="aspect-[16/10]"
              sizes="(min-width: 1024px) 46vw, 100vw"
              className="mt-6"
            />
          </div>

          <ul className="space-y-3" role="list">
            {PARTENAIRE_OBJECTION_IA.map((t) => (
              <li key={t} className="text-fg-soft flex gap-3 text-sm leading-relaxed">
                <Check aria-hidden="true" className="text-sage mt-0.5 h-4 w-4 shrink-0" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      {/* 6 ── Comment ça se passe */}
      <Section
        eyebrow="Le parcours"
        title="Comment"
        titleEm="ça se passe"
        className="py-10 sm:py-14"
      >
        <ol className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3" role="list">
          {PARTENAIRE_ETAPES.map((e, i) => (
            <li key={e.titre} className="border-border rounded-xl border p-5">
              <span
                aria-hidden="true"
                className="bg-terracotta-soft text-terracotta-deep mb-3 flex h-8 w-8 items-center justify-center rounded-full font-serif text-sm font-semibold"
              >
                {i + 1}
              </span>
              <h3 className="text-fg font-semibold">{e.titre}</h3>
              <p className="text-fg-soft mt-1 text-sm leading-relaxed">{e.texte}</p>
            </li>
          ))}
        </ol>
      </Section>

      {/* 7 ── Profils */}
      <Section
        tone="sand"
        eyebrow="À qui ça va"
        title="Votre carnet d'adresses"
        titleEm="vaut de l'argent"
        description="Si vous avez déjà vendu aux entreprises, vous avez l'essentiel. Et si vous visitez déjà des entreprises toute la journée, vous êtes déjà en face de la bonne personne."
        className="py-10 sm:py-14"
      >
        <ul className="mt-7 grid gap-2.5 sm:grid-cols-2" role="list">
          {PARTENAIRE_PROFILS.map((p) => (
            <li key={p} className="text-fg-soft flex gap-2.5 text-sm leading-relaxed">
              <Check aria-hidden="true" className="text-sage mt-0.5 h-4 w-4 shrink-0" />
              <span>{p}</span>
            </li>
          ))}
        </ul>

        <div className="bg-paper border-border mt-8 rounded-2xl border p-6 sm:p-7">
          <h3 className="text-fg font-serif text-xl font-semibold">Aucune limite d&apos;âge</h3>
          <p data-speakable className="text-fg-soft mt-2 leading-relaxed">
            L&apos;activité est ouverte à tout indépendant en capacité de facturer, sans limite
            d&apos;âge. Les commerciaux à la retraite y sont particulièrement bien placés : le
            carnet d&apos;adresses est constitué et le rythme est libre.
          </p>
        </div>
      </Section>

      {/* 8 ── Ce que ce n'est pas */}
      <Section
        eyebrow="Cartes sur table"
        title="Ce que ce"
        titleEm="n'est pas"
        className="py-10 sm:py-14"
      >
        <div className="mt-7 grid gap-4 sm:grid-cols-2">
          {PARTENAIRE_CE_QUE_CE_NEST_PAS.map((c) => (
            <div key={c.t} className="border-border rounded-xl border p-5">
              <p className="text-fg font-semibold">{c.t}</p>
              <p className="text-fg-soft mt-1.5 text-sm leading-relaxed">{c.d}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* 9 ── FAQ. `emitJsonLd={false}` : le FAQPage est émis en tête de page. */}
      <FaqBlock
        eyebrow="FAQ"
        title="Questions sur"
        titleEm="l'apport d'affaires"
        items={faq}
        emitJsonLd={false}
        tone="sand"
      />

      <CtaBlock
        eyebrow="On recrute"
        title="Prêt à ouvrir"
        titleEm="quelques portes ?"
        description="Trois minutes chrono, zéro CV, zéro lettre de motivation. On répond à toutes les candidatures."
        cta={<CtaCandidature track="apporteur-final-apply" />}
      />

      <StickyMobileCta
        href="/devenir-commercial-ia/candidature"
        label="Je candidate →"
        track="apporteur-sticky-apply"
      />

      {/* Date de publication de l'offre — utilisée par le cron de fraîcheur.
          Pas de JobPosting ici : il vit sur `/devenir-commercial-ia`, qui est la
          page canonique pour Google for Jobs. Deux JobPosting pour la même offre
          se feraient concurrence dans l'index. */}
      <meta itemProp="datePosted" content={COMMERCIAL_OFFER_DATE_POSTED} />
    </>
  );
}
