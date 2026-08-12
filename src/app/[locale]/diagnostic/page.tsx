// Page d'atterrissage publicitaire (`/[locale]/diagnostic`).
//
// ── Sa place dans le tunnel ───────────────────────────────────────────────
//   publicité vidéo Facebook → CETTE page → `/simulateur` → rapport → e-mail
//
// Elle ne contient PAS le simulateur. C'est délibéré : le simulateur est
// utilisé partout sur le site — depuis `/roi`, depuis le menu Ressources,
// depuis le pied de page — et il doit garder son habillage clair. L'y encastrer
// en version sombre le coupleraient à une page publicitaire, et toute retouche
// de cette page risquerait d'abîmer un outil servi ailleurs. Cette page fait
// une seule chose : convaincre, puis envoyer sur le simulateur.
//
// ── Mise en page ──────────────────────────────────────────────────────────
// Un seul écran de lecture au pouce, dans l'ordre : preuve → accroche →
// promesse → vidéo → bouton → détail de ce qu'on obtient → fondateur → bouton.
// Aucun lien sortant hormis les mentions légales.
//
// ⚠️ Toute affirmation de cette page doit être VÉRIFIABLE. Les pages de ce
// format affichent d'ordinaire des compteurs de clients et des témoignages ;
// nous n'en avons pas, et les inventer serait trompeur au sens de l'article
// L121-2 (et suicidaire devant des dirigeants qui vérifient). Cf. l'entête de
// `src/content/lp/diagnostic.ts`.
//
// Server Component ; seuls `VslVideo` et `VslCta` portent du JS.

import type { Metadata } from "next";
import Image from "next/image";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { Check, Clock, Quote, ShieldCheck } from "lucide-react";
import { routing } from "@/i18n/routing";
import { Container } from "@/components/layout/Container";
import { Link } from "@/i18n/navigation";
import { VslVideo } from "@/components/lp/VslVideo";
import { VslCta } from "@/components/lp/VslCta";
import { VSL_CONTENT, VSL_VIDEO } from "@/content/lp/diagnostic";

interface Props {
  params: Promise<{ locale: string }>;
}

const SIMULATOR_HREF = "/simulateur";

export const metadata: Metadata = {
  title: "Quelles tâches votre entreprise peut arrêter de faire à la main · Axion-IA",
  description:
    "Un diagnostic de trois minutes : vos premières tâches à automatiser, le temps et l'argent récupérables, la feuille de route. Gratuit, sans inscription.",
  robots: { index: false, follow: false },
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function DiagnosticLandingPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const c = VSL_CONTENT;

  return (
    <div className="axion-vsl-shell bg-vsl min-h-screen">
      <Container className="max-w-3xl px-5 pt-6 pb-16 sm:pt-10">
        {/* ── Marque, sans navigation ───────────────────────────────────── */}
        <p className="text-mocha-fg text-center text-[15px] font-bold tracking-[0.2em] uppercase">
          Axion<span className="text-terracotta-on-mocha">-</span>IA
        </p>

        {/* ── Qualification de l'audience ───────────────────────────────── */}
        {/* Une seule ligne, juste sous la marque : elle dit à qui la page parle
            avant que le visiteur ait à se poser la question. */}
        <p className="border-border-on-mocha bg-mocha/60 text-mocha-fg mx-auto mt-5 flex w-fit items-center gap-2 rounded-full border px-3.5 py-1.5 text-center text-[12.5px] leading-snug font-semibold">
          <span
            aria-hidden="true"
            className="bg-terracotta-on-mocha h-1.5 w-1.5 shrink-0 rounded-full"
          />
          {c.eyebrow}
        </p>

        {/* ── Accroche ──────────────────────────────────────────────────── */}
        {/* Le titre vient AVANT les preuves, contrairement aux pages de ce
            format qui ouvrent sur un compteur de clients. Deux raisons : nous
            n'avons pas ce compteur, et la version détaillée des preuves
            occupait 430 px — le titre commençait sous la ligne de flottaison,
            ce qui vide une page publicitaire de sa raison d'être. */}
        <h1 className="text-mocha-fg mt-6 text-center text-[30px] leading-[1.14] font-bold tracking-tight text-balance sm:text-[44px]">
          {c.title.lead}{" "}
          {/* Le soulignement porte sur la promesse, pas sur la phrase entière :
              tout souligner ne souligne rien. `decoration-terracotta-on-mocha`
              plutôt qu'une bordure — le trait suit les retours à la ligne. */}
          <span className="decoration-terracotta-on-mocha underline decoration-[3px] underline-offset-[6px]">
            {c.title.underlined}
          </span>{" "}
          {c.title.tail}{" "}
          <em
            className="text-terracotta-on-mocha not-italic"
            style={{ fontFamily: "var(--font-serif)", fontStyle: "italic" }}
          >
            {c.title.accent}
          </em>
        </h1>

        {/* ── Objections levées d'avance ────────────────────────────────── */}
        <p className="text-mocha-fg-muted mx-auto mt-5 max-w-xl text-center text-[16px] leading-relaxed text-pretty sm:text-[17px]">
          <strong className="text-mocha-fg font-bold">{c.subtitle.strong}</strong> {c.subtitle.rest}
        </p>

        {/* ── Preuves ───────────────────────────────────────────────────── */}
        {/* Une ligne compacte, sous la promesse : elle la rend crédible sans
            repousser le titre. Faits vérifiables uniquement — aucun compteur de
            clients, aucun témoignage, aucun logo. */}
        <ul role="list" className="mt-5 flex flex-wrap justify-center gap-x-4 gap-y-2">
          {c.proofs.map((proof) => (
            <li key={proof.label} className="flex items-center gap-1.5">
              <Check
                aria-hidden="true"
                className="text-terracotta-on-mocha h-3.5 w-3.5 shrink-0"
                strokeWidth={3}
              />
              <span className="text-mocha-fg text-[13px] leading-none font-semibold">
                {proof.label}
              </span>
            </li>
          ))}
        </ul>

        {/* ── Vidéo ─────────────────────────────────────────────────────── */}
        {/* Absente tant qu'aucune vidéo n'est publiée (`VSL_VIDEO === null`) :
            un cadre noir vide ou une affiche manquante ferait plus de mal que
            l'absence du bloc. */}
        {VSL_VIDEO ? (
          <VslVideo
            src={VSL_VIDEO.src}
            poster={VSL_VIDEO.poster}
            durationLabel={VSL_VIDEO.durationLabel}
            label={c.videoLabel}
            landing={c.slug}
            className="mt-9"
          />
        ) : null}

        {/* ── Appel à l'action principal ────────────────────────────────── */}
        <div className="mt-9 flex flex-col items-center gap-3">
          <VslCta
            href={SIMULATOR_HREF}
            label={c.ctaPrimary}
            placement={VSL_VIDEO ? "sous-video" : "hero"}
            landing={c.slug}
          />
          <p className="text-mocha-fg-muted flex items-center gap-2 text-center text-[13px] leading-snug">
            <Clock aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
            {c.ctaHint}
          </p>
        </div>

        {/* ── Ce que le visiteur obtient ────────────────────────────────── */}
        <section aria-labelledby="vsl-obtenir" className="mt-14">
          <h2
            id="vsl-obtenir"
            className="text-mocha-fg text-center text-[21px] leading-tight font-bold tracking-tight sm:text-[26px]"
          >
            Ce que vous obtenez au bout
          </h2>
          <ul role="list" className="mx-auto mt-6 flex max-w-xl flex-col gap-3">
            {c.deliverables.map((item) => (
              <li
                key={item}
                className="border-border-on-mocha bg-mocha/50 flex items-start gap-3 rounded-2xl border p-4"
              >
                <span
                  aria-hidden="true"
                  className="bg-terracotta text-paper mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                >
                  <Check className="h-3.5 w-3.5" strokeWidth={3} />
                </span>
                <span className="text-mocha-fg text-[15px] leading-snug text-pretty">{item}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* ── Fondateur ─────────────────────────────────────────────────── */}
        {/* Une personne identifiable, avec son nom et son visage, remplace ici
            les témoignages que nous n'avons pas. C'est moins spectaculaire et
            infiniment plus solide : c'est vrai, et c'est vérifiable sur le
            site. */}
        <section className="border-border-on-mocha mt-14 border-t pt-10">
          <figure className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
            <Image
              src={c.founder.photo}
              alt={c.founder.photoAlt}
              width={110}
              height={110}
              loading="lazy"
              className="h-[110px] w-[110px] shrink-0 rounded-2xl object-cover"
            />
            <div className="min-w-0">
              <Quote aria-hidden="true" className="text-terracotta-on-mocha h-6 w-6" />
              <blockquote className="text-mocha-fg mt-2 text-[16px] leading-relaxed text-pretty">
                « {c.founder.quote} »
              </blockquote>
              <figcaption className="text-mocha-fg-muted mt-3 text-[13.5px]">
                <span className="text-mocha-fg font-semibold">{c.founder.name}</span> —{" "}
                {c.founder.role}
              </figcaption>
            </div>
          </figure>
        </section>

        {/* ── Appel à l'action final ────────────────────────────────────── */}
        <div className="mt-12 flex flex-col items-center gap-3">
          <VslCta
            href={SIMULATOR_HREF}
            label={c.ctaPrimary}
            placement="bas-de-page"
            landing={c.slug}
          />
        </div>

        {/* ── Mentions ──────────────────────────────────────────────────── */}
        <p className="text-mocha-fg-muted mx-auto mt-12 flex max-w-xl items-start gap-2 text-center text-[12px] leading-relaxed">
          <ShieldCheck aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{c.legal}</span>
        </p>
        <p className="text-mocha-fg-muted mt-6 text-center text-[12px]">
          <Link href="/mentions-legales" className="hover:text-mocha-fg underline">
            Mentions légales
          </Link>
          <span aria-hidden="true" className="mx-2">
            ·
          </span>
          <Link href="/politique-confidentialite" className="hover:text-mocha-fg underline">
            Confidentialité
          </Link>
        </p>
      </Container>
    </div>
  );
}
