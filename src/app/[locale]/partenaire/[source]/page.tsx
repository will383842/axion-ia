// Landing de RÉCEPTION D'ANNONCE — `/partenaire/[source]`.
//
// Première source : `leboncoin` (annonce nationale, cf.
// `docs/annonce-leboncoin-recrutement.md`). Le gabarit est générique : ajouter
// un journal, un club d'affaires ou une école = une entrée dans
// `PARTENAIRE_LANDINGS`, pas une nouvelle page.
//
// 🔴 `noindex` ASSUMÉ — cette page est un quasi-doublon de
// `/devenir-commercial-ia`. L'indexer cannibaliserait la page principale (qui
// porte le JobPosting Google for Jobs) et exposerait au doorway, pour un gain
// nul : 100 % de son trafic vient de l'annonce. Même arbitrage que les 40
// pages ville (`sitemap-recrutement.xml/route.ts`). Elle n'est donc NI dans un
// sitemap, NI indexable.
//
// 🔴 GATE QUALIOPI — les mentions « certifié Qualiopi » et « finançable OPCO »
// passent par `isQualiopiCertificationObtenue()`. L'en-tête de `flag.ts`
// qualifie d'ILLÉGAL de les afficher avant l'obtention du certificat. Ne
// JAMAIS les écrire en dur ici : cette page peut être déployée avant, et le
// drapeau est ce qui garantit qu'aucune affirmation ne s'affiche avant d'être
// vraie. (C'est la leçon du 2026-08-19 sur `/memo-isere`, où « Qualiopi » a
// été gaté mais « finançable OPCO », trois lignes plus bas, ne l'a pas été.)
//
// 🔴 AUCUN DÉLAI DE RÉPONSE PROMIS (règle Will, 2026-08-23). Une offre ne
// s'engage jamais sur un délai : annoncé et non tenu, il détruit exactement la
// confiance qu'il cherchait à créer, et il est intenable dès que le volume
// monte. On promet une RÉPONSE À TOUS, pas une date.
//
// MOBILE D'ABORD — le lecteur arrive d'une annonce ouverte sur son téléphone.
// CTA pleine largeur sous le pouce, CTA collant, aucune grille qui déborde.

import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { Check, X } from "lucide-react";

import { routing, type Locale } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { HeroBadge } from "@/components/marketing/HeroBadge";
import { Cta } from "@/components/marketing/Cta";
import { StickyMobileCta } from "@/components/marketing/StickyMobileCta";
import { UnsplashCredit } from "@/components/media/UnsplashCredit";
import { FaqBlock } from "@/components/sections/FaqBlock";
import { CtaBlock } from "@/components/sections/CtaBlock";
import { memoPhoto, type MemoIserePhotoSlot } from "@/content/recrutement/memo-isere-photos";
import { isQualiopiCertificationObtenue } from "@/server/qualiopi/config/flag";
import {
  COMMISSION_FORMATION_PAR_JOURNEE_EUR,
  getCommissionById,
  getTierById,
  AUDIT_TIERS,
} from "@/content/pricing";
import {
  PARTENAIRE_CE_QUE_CE_NEST_PAS,
  PARTENAIRE_ETAPES,
  PARTENAIRE_LANDINGS,
  PARTENAIRE_OBJECTION_IA,
  PARTENAIRE_PROFILS,
  PARTENAIRE_REASSURANCE_BASE,
  PARTENAIRE_SOURCES,
  isPartenaireSource,
} from "@/content/recrutement/partenaire-landings";

export const revalidate = 3600;

/**
 * Mentions AFFIRMANT la certification — servies UNIQUEMENT sous
 * `isQualiopiCertificationObtenue()`, dont l'appel est trois lignes plus bas
 * dans le composant.
 *
 * 🔴 Elles vivent ICI, et pas dans `content/recrutement/partenaire-landings.ts`,
 * volontairement : le littéral doit résider dans le fichier qui lit le
 * drapeau. Le 2026-08-19, « Organisme certifié Qualiopi » a été servi en
 * production sur `/memo-isere` précisément parce qu'il était déclaré dans un
 * fichier n'important aucun drapeau — la garde existait ailleurs, personne ne
 * l'a vue. Le test `assertion-flag-surfaces.spec.ts` interdit désormais ce
 * montage : cette page est inscrite à son registre `ASSERTION_SURFACES`.
 */
const REASSURANCE_CERTIFIE: readonly string[] = [
  "Organisme certifié Qualiopi",
  "Formations finançables OPCO",
];

interface Props {
  params: Promise<{ locale: string; source: string }>;
}

/** Pré-rend une page par source connue. */
export function generateStaticParams(): Array<{ source: string }> {
  return PARTENAIRE_SOURCES.map((source) => ({ source }));
}

// ── Formatage ───────────────────────────────────────────────────────────────

const NBSP = " ";

/** « 1 500 € » — espace insécable, pas d'unité cassée en fin de ligne. */
function euros(montant: number): string {
  return `${montant.toLocaleString("fr-FR").replace(/ |\s/g, NBSP)}${NBSP}€`;
}

/** Commission pour `jours` journées — DÉRIVÉE de la constante SSOT, jamais
 *  réécrite. Deux barèmes publics ont déjà divergé de 150 €/journée pour
 *  avoir été saisis à la main (cf. `pricing.ts` l. 813). */
function commission(jours: number): string {
  return euros(jours * COMMISSION_FORMATION_PAR_JOURNEE_EUR);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, source } = await params;
  if (!hasLocale(routing.locales, locale) || !isPartenaireSource(source)) return {};
  const l = PARTENAIRE_LANDINGS[source];

  // Pas de `buildProductMetadata` ici : ce helper pose les canoniques et les
  // hreflang d'une page destinée au crawl. Celle-ci ne l'est pas.
  return {
    title: { absolute: l.metaTitle },
    description: l.metaDescription,
    robots: { index: false, follow: true },
  };
}

// ── Primitives locales ──────────────────────────────────────────────────────

/**
 * Photo curée + crédit photographe.
 *
 * ⚠️ CGU Unsplash §9 — l'attribution est OBLIGATOIRE et se rend SUR la page.
 * On ne la retire pas sans retirer la photo. C'est pour cela qu'elle est
 * intégrée au composant plutôt que laissée à l'appelant : un crédit qu'il faut
 * penser à ajouter est un crédit qu'on oublie.
 *
 * Les photos viennent du lot curé de `/memo-isere` (servi en local, 0 hotlink).
 * ⚠️ Le slot `territoire` en est EXCLU : il montre le corridor
 * Grenoble-Lyon-Valence-Die, ce qui contredirait le « partout en France » de
 * cette page.
 *
 * `ratio` fixe la boîte AVANT le chargement ⇒ CLS = 0, exigence stricte
 * d'`AGENTS.md` (0, pas 0,1).
 */
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

/** CTA candidature. Pleine largeur sous le pouce sur mobile, dimensionné au
 *  contenu dès `sm`. `whitespace-nowrap` : posé à côté du micro-texte, le
 *  bouton se laissait comprimer et sa flèche passait seule à la ligne. */
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

/** Bandeau terracotta de relance, entre deux sections longues. */
function BandeCta({ title, track }: { title: string; track: string }) {
  return (
    <section
      className="py-10 sm:py-14"
      style={{
        background:
          "linear-gradient(135deg, var(--color-terracotta), var(--color-terracotta-deep))",
      }}
    >
      <Container className="flex flex-col items-center gap-5 text-center sm:flex-row sm:justify-between sm:gap-6 sm:text-left">
        <h2 className="max-w-xl font-serif text-2xl leading-snug font-semibold text-[color:var(--color-bg)] sm:text-3xl">
          {title}
        </h2>
        <Cta
          href="/devenir-commercial-ia/candidature"
          size="lg"
          track={track}
          className="text-terracotta-deep w-full shrink-0 justify-center bg-[color:var(--color-paper)] shadow-[0_8px_24px_-8px_rgba(0,0,0,0.35)] hover:bg-[color:var(--color-bg)] sm:w-auto"
        >
          Je candidate →
        </Cta>
      </Container>
    </section>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

export default async function PartenaireLandingPage({ params }: Props) {
  const { locale, source } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  if (!isPartenaireSource(source)) notFound();
  setRequestLocale(locale as Locale);

  const l = PARTENAIRE_LANDINGS[source];
  const certifie = isQualiopiCertificationObtenue();

  // Montants DÉRIVÉS du SSOT. `audit-flash` et `audit-strategique-pme` sont
  // tous deux annoncés « à partir de » (`isFromPrice`) : la commission
  // calculée en dessous est donc un PLANCHER, jamais un plafond — d'où les
  // formulations « au moins ».
  const pctAudit = getCommissionById("com-audit").percent ?? 30;
  const auditTpe = getTierById(AUDIT_TIERS, "audit-flash").priceFlat ?? 0;
  const auditPme = getTierById(AUDIT_TIERS, "audit-strategique-pme").priceMin ?? 0;
  const commissionAuditTpe = Math.round((auditTpe * pctAudit) / 100);
  const commissionAuditPme = Math.round((auditPme * pctAudit) / 100);

  const reassurance = [...(certifie ? REASSURANCE_CERTIFIE : []), ...PARTENAIRE_REASSURANCE_BASE];

  const faq = [
    {
      id: "gains",
      question: "Combien je gagne, concrètement ?",
      answer: `${commission(1)} par journée de formation vendue : une formation de 2 journées, c'est ${commission(2)} ; de 3 journées, ${commission(3)}. Sur un audit, ${pctAudit} % de la facture — le plus petit audit démarre à ${euros(auditTpe)} HT, soit au moins ${euros(commissionAuditTpe)} pour toi. Ce sont des exemples de calcul, pas une promesse : tes revenus dépendent de tes ventes.`,
    },
    {
      id: "connaissances-ia",
      question: "Il faut connaître l'IA ?",
      answer:
        "Non, et ce n'est pas ton rôle. Le B2B, c'est ton métier — l'IA, c'est le nôtre. Tu n'as pas besoin de savoir comment fonctionne un extincteur pour dire à un commerçant que la loi lui en impose un. Aucune démo, aucun outil à installer : tu ouvres la porte, on fait le reste.",
    },
    {
      id: "closing",
      question: "Je dois vendre, négocier, faire des devis ?",
      answer:
        "Jamais. Tu ne closes pas. C'est nous qui appelons, présentons, chiffrons et facturons. Tu n'as ni négociation, ni devis, ni relance d'impayés à gérer.",
    },
    {
      id: "statut",
      question: "Il faut un statut ? Ça coûte quoi ?",
      answer:
        "Il faut être indépendant pour pouvoir facturer ta commission — micro-entreprise, agent commercial ou société. Si tu n'en as pas encore, la création en ligne est gratuite et prend un quart d'heure. Aucun frais d'entrée de notre côté, aucun kit à acheter.",
    },
    {
      id: "salarie",
      question: "Je suis salarié, j'ai le droit ?",
      answer:
        "En général oui, mais vérifie ton contrat de travail : une clause d'exclusivité ou de non-concurrence peut te l'interdire, et c'est à toi de t'en assurer avant de démarrer. Beaucoup de nos apporteurs exercent en complément de leur activité principale.",
    },
    {
      id: "retraite",
      question: "Je suis à la retraite, est-ce que ça change quelque chose ?",
      answer:
        "Aucune limite d'âge, et les commerciaux à la retraite sont particulièrement les bienvenus : le carnet d'adresses vaut de l'or et le rythme est libre. En revanche, l'effet d'une activité indépendante sur ta pension dépend de ta situation personnelle — fais-le confirmer par ta caisse de retraite ou ton comptable avant de te lancer. Nous ne donnons pas de conseil sur ce point.",
    },
    {
      id: "paiement",
      question: "Quand suis-je payé ?",
      answer:
        "Quand l'entreprise nous a payés. C'est la règle de l'apport d'affaires : la commission est due à l'encaissement, pas à la signature. Tu la factures ensuite à Axion-IA.",
    },
    {
      id: "contact-direct",
      question: "Et si l'entreprise nous contacte directement ensuite ?",
      answer:
        "Elle reste enregistrée à ton nom. Qu'elle signe avec toi ou qu'elle nous appelle de son côté, la commission te revient.",
    },
    {
      id: "reponse",
      question: "Vous répondez à toutes les candidatures ?",
      answer:
        "Oui, à toutes — y compris celles qu'on ne retient pas. On revient vers toi dans les prochaines semaines.",
    },
  ];

  return (
    <>
      {/* 1 ── Héro. Grille 2 colonnes dès `lg` ; sur mobile la photo passe SOUS
          le CTA — un bouton placé après une image de 500 px n'est jamais vu au
          premier écran. */}
      <Section tone="halo-warm" className="pt-8 pb-10 sm:pt-12 sm:pb-14 lg:pt-16 lg:pb-20">
        <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-14">
          <div>
            <HeroBadge className="mb-5 justify-start">
              <span
                aria-hidden="true"
                className="bg-terracotta inline-block h-1.5 w-1.5 rounded-full"
              />
              {l.canal} · On recrute partout en France
            </HeroBadge>

            <h1 className="display-editorial text-fg text-balance">
              {l.h1}{" "}
              <span className="text-terracotta italic" style={{ fontFamily: "var(--font-serif)" }}>
                {l.h1Em}
              </span>
            </h1>

            <p data-speakable className="text-fg-soft mt-5 max-w-xl text-lg leading-relaxed">
              {l.chapo}
            </p>

            <div className="mt-7 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-4">
              <CtaCandidature track="partenaire-hero-apply" />
              <p className="text-fg-muted text-sm">
                3 minutes chrono ⏱️ · zéro CV, zéro lettre de motivation
              </p>
            </div>
          </div>

          {/* `priority` : c'est l'élément LCP de la page. Budget AGENTS.md :
              LCP ≤ 1 800 ms p75 — jamais de lazy-load ici. */}
          <Photo
            slot="hero"
            alt="Un apporteur d'affaires indépendant en rendez-vous avec une dirigeante d'entreprise, autour d'une table."
            ratio="aspect-[4/3]"
            sizes="(min-width: 1024px) 46vw, 100vw"
            priority
          />
        </div>
      </Section>

      {/* 2 ── Bande de réassurance. Mentions non cliquables : elles s'enroulent,
          jamais de conteneur scrollable (inatteignable au clavier). */}
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

      {/* 3 ── Tu n'arrives pas avec un produit à pousser */}
      <Section className="py-8 sm:py-12">
        <div className="bg-mocha relative overflow-hidden rounded-2xl px-6 py-8 sm:px-10 sm:py-11">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-30"
            style={{
              backgroundImage:
                "radial-gradient(90% 120% at 85% 0%, var(--color-terracotta) 0%, transparent 55%)",
            }}
          />
          <div className="relative">
            <h2 className="font-serif text-[26px] leading-snug font-semibold text-[color:var(--color-bg)] sm:text-4xl">
              Tu n&apos;arrives pas avec un produit à pousser.{" "}
              <span className="text-terracotta-soft italic">
                Tu arrives avec une obligation légale que le dirigeant ignore.
              </span>
            </h2>
            <p className="mt-5 max-w-2xl leading-relaxed text-[color:var(--color-bg)]/80">
              Depuis février 2025, le règlement européen sur l&apos;IA impose aux entreprises
              d&apos;assurer un niveau suffisant de maîtrise de l&apos;IA chez leurs équipes.
              Presque aucune ne le sait encore.
              {certifie
                ? " Et la formation peut être financée jusqu'à 100 % par leur OPCO, selon l'OPCO et la branche : souvent, le dirigeant n'a même pas de trésorerie à sortir."
                : ""}
            </p>
            <p className="text-terracotta-soft mt-4 font-medium">
              C&apos;est toute la différence entre déranger quelqu&apos;un et lui rendre service.
            </p>
          </div>
        </div>
      </Section>

      {/* 4 ── Deux produits */}
      <Section
        tone="sand"
        eyebrow="L'offre"
        title="Deux produits."
        titleEm="C'est tout."
        description="Pas de catalogue de 40 pages à apprendre. Deux choses à retenir, et tu es opérationnel."
        className="py-10 sm:py-14"
      >
        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          <article className="bg-paper border-border rounded-2xl border p-6 sm:p-7">
            <h3 className="text-fg font-serif text-xl font-semibold">Une formation IA</h3>
            <p className="text-terracotta mt-3 font-serif text-3xl font-semibold">
              {commission(1)}
            </p>
            <p className="text-fg-muted text-sm font-medium">pour toi, par journée vendue</p>
            <ul className="text-fg-soft mt-4 space-y-1.5 text-sm">
              <li>Une formation de 2 journées : {commission(2)}</li>
              <li>De 3 journées : {commission(3)}</li>
              {certifie ? (
                <li>Finançable jusqu&apos;à 100 % par l&apos;OPCO de l&apos;entreprise</li>
              ) : null}
            </ul>
          </article>

          <article className="bg-paper border-border rounded-2xl border p-6 sm:p-7">
            <h3 className="text-fg font-serif text-xl font-semibold">Un audit IA</h3>
            <p className="text-terracotta mt-3 font-serif text-3xl font-semibold">{pctAudit} %</p>
            <p className="text-fg-muted text-sm font-medium">de la facture, pour toi</p>
            <ul className="text-fg-soft mt-4 space-y-1.5 text-sm">
              <li>
                Le plus petit audit démarre à {euros(auditTpe)} HT → au moins{" "}
                {euros(commissionAuditTpe)}
              </li>
              <li>
                Un audit de PME démarre à {euros(auditPme)} HT → au moins{" "}
                {euros(commissionAuditPme)}
              </li>
            </ul>
          </article>
        </div>

        <p className="text-fg-muted mt-5 text-sm">
          Ce sont des exemples de calcul, pas une promesse : tes revenus dépendent de tes ventes.
        </p>
      </Section>

      {/* 5 ── « Je n'y connais rien en IA » — le frein n°1 */}
      <Section
        eyebrow="Le vrai frein"
        title="« Je n'y connais rien en IA »"
        titleEm="Tant mieux."
        className="py-10 sm:py-14"
      >
        <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-12">
          <div>
            <p className="text-fg text-lg leading-relaxed font-medium">
              Ce n&apos;est pas ton rôle. Le B2B, c&apos;est ton métier — l&apos;IA, c&apos;est le
              nôtre.
            </p>
            <p className="text-fg-soft mt-4 leading-relaxed">
              Tu n&apos;as pas besoin de savoir comment fonctionne un extincteur pour dire à un
              commerçant que la loi lui en impose un.
            </p>
            <div className="border-border-strong mt-6 border-l-2 pl-4">
              <p className="text-fg-soft text-sm italic">
                « Il y a maintenant une obligation européenne de former les équipes qui utilisent
                l&apos;IA
                {certifie ? ", et c'est finançable jusqu'à 100 %" : ""}. Je travaille avec un
                organisme qui fait exactement ça. Je vous mets en relation ? »
              </p>
              <p className="text-fg-muted mt-2 text-sm font-medium">
                Voilà. C&apos;est tout le métier.
              </p>
            </div>
          </div>

          <div>
            <ul className="space-y-3" role="list">
              {PARTENAIRE_OBJECTION_IA.map((t) => (
                <li key={t} className="text-fg-soft flex gap-3 text-sm leading-relaxed">
                  <Check aria-hidden="true" className="text-sage mt-0.5 h-4 w-4 shrink-0" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
            <Photo
              slot="terrain"
              alt="Une formation IA animée devant une équipe en entreprise : c'est nous qui intervenons, pas l'apporteur."
              ratio="aspect-[16/10]"
              sizes="(min-width: 1024px) 46vw, 100vw"
              className="mt-7"
            />
          </div>
        </div>
      </Section>

      <BandeCta title="Ton carnet d'adresses vaut de l'argent 💶" track="partenaire-band-apply" />

      {/* 6 ── Comment ça se passe */}
      <Section
        eyebrow="Le parcours"
        title="Comment"
        titleEm="ça se passe"
        className="py-10 sm:py-14"
      >
        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-12">
          <ol className="space-y-5" role="list">
            {PARTENAIRE_ETAPES.map((e, i) => (
              <li key={e.titre} className="flex gap-4">
                <span
                  aria-hidden="true"
                  className="bg-terracotta-soft text-terracotta-deep flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-serif text-sm font-semibold"
                >
                  {i + 1}
                </span>
                <div>
                  <h3 className="text-fg font-semibold">{e.titre}</h3>
                  <p className="text-fg-soft mt-1 text-sm leading-relaxed">{e.texte}</p>
                </div>
              </li>
            ))}
          </ol>

          <Photo
            slot="equipe"
            alt="Un échange en visio avec l'équipe Axion-IA au démarrage : l'apporteur n'est jamais seul."
            ratio="aspect-[4/3]"
            sizes="(min-width: 1024px) 38vw, 100vw"
            className="lg:sticky lg:top-24 lg:self-start"
          />
        </div>

        <div className="bg-sand-deep/40 border-border mt-8 rounded-2xl border p-6">
          <p className="text-fg font-serif text-xl font-semibold">Tu ne closes jamais.</p>
          <p className="text-fg-soft mt-2 leading-relaxed">
            C&apos;est nous qui vendons. Tu ouvres la porte, c&apos;est tout. Pas de négociation,
            pas de devis, pas de relance d&apos;impayés.
          </p>
        </div>
      </Section>

      {/* 7 ── À qui ça va + aucune limite d'âge */}
      <Section
        tone="sand"
        eyebrow="Les profils"
        title="Ton carnet d'adresses"
        titleEm="vaut de l'argent"
        description="Tu as déjà vendu aux entreprises ? Tu as l'essentiel. Et si tu visites déjà des entreprises toute la journée, tu es déjà en face de la bonne personne : une phrase de plus dans un rendez-vous que tu faisais de toute façon."
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

        <Photo
          slot="candidature"
          alt="Une candidature déposée depuis un téléphone, en trois minutes et sans CV."
          ratio="aspect-[16/9]"
          sizes="100vw"
          className="mt-8"
        />

        <div className="bg-paper border-border mt-8 rounded-2xl border p-6 sm:p-7">
          <h3 className="text-fg font-serif text-xl font-semibold">Aucune limite d&apos;âge</h3>
          <p className="text-fg-soft mt-2 leading-relaxed">
            25 ans ou 70 ans : ce qui compte, c&apos;est ton carnet d&apos;adresses et ton envie.
            Les commerciaux et apporteurs d&apos;affaires à la retraite sont particulièrement les
            bienvenus — ton réseau vaut de l&apos;or, tu n&apos;as plus rien à prouver, et tu
            choisis ton rythme.
          </p>
          <p className="text-fg-muted mt-3 text-sm">
            Tu pars de zéro ? C&apos;est possible aussi. Ce sera juste plus long.
          </p>
        </div>
      </Section>

      {/* 8 ── Ce que ce n'est pas — la section qui nous distingue des arnaques */}
      <Section
        eyebrow="Jouons cartes sur table"
        title="Ce que ce"
        titleEm="n'est pas"
        className="py-10 sm:py-14"
      >
        <div className="mt-7 grid gap-4 sm:grid-cols-2">
          {PARTENAIRE_CE_QUE_CE_NEST_PAS.map((c) => (
            <div key={c.t} className="border-border rounded-xl border p-5">
              <p className="text-fg flex items-center gap-2 font-semibold">
                <X aria-hidden="true" className="text-terracotta h-4 w-4 shrink-0" />
                {c.t}
              </p>
              <p className="text-fg-soft mt-1.5 text-sm leading-relaxed">{c.d}</p>
            </div>
          ))}
        </div>

        <div className="bg-sand-deep/40 border-border mt-8 rounded-2xl border p-6">
          <p className="text-fg font-serif text-xl font-semibold">
            On est une jeune boîte, et ça se sent
          </p>
          <p className="text-fg-soft mt-2 leading-relaxed">
            Tu parles directement à ceux qui décident : pas de service RH, pas de formulaire
            interne, pas de manager intermédiaire. Une idée ? On l&apos;essaie la semaine
            d&apos;après. Et surtout : on est des gens sympas. Ce n&apos;est pas un slogan,
            c&apos;est notre façon de travailler.
          </p>
        </div>
      </Section>

      {/* 9 ── FAQ. `emitJsonLd` désactivé : page noindex, un FAQPage n'y a
          aucun sens et polluerait le graphe d'entités du site. */}
      <FaqBlock
        eyebrow="FAQ"
        title="Questions"
        titleEm="légitimes"
        items={faq}
        emitJsonLd={false}
        tone="sand"
      />

      {/* 10 ── CTA final */}
      <CtaBlock
        eyebrow="On recrute"
        title="Prêt à ouvrir"
        titleEm="quelques portes ?"
        description="Trois minutes chrono, zéro CV, zéro lettre de motivation. On répond à toutes les candidatures."
        cta={<CtaCandidature track="partenaire-final-apply" />}
      />

      <StickyMobileCta
        href="/devenir-commercial-ia/candidature"
        label="Je candidate →"
        track="partenaire-sticky-apply"
      />
    </>
  );
}
