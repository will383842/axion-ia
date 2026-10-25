// « Ne plus recevoir de rappel » pour UN questionnaire avant audit (2026-10-26).
//
// `/questionnaire/rappels/<questionnaireId>/<jeton d'arrêt>` : le lien du bas des relances.
//   · jeton faux ou d'un autre domaine → page neutre, statut 404 ;
//   · le GET n'ÉCRIT RIEN et ne lit pas la base (les antivirus d'entreprise ouvrent les liens) :
//     une question et un bouton ; seul le POST (`actions.ts`) arrête les rappels ;
//   · `essai=1` : lien d'un e-mail d'essai de Will, la même page, rien n'est jamais écrit.
// En-têtes (`noindex`, CSP stricte, `Referrer-Policy: same-origin`) : règle `/questionnaire/:path*`
// de `next.config.ts`.

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { jetonArretRelancesPreauditValide } from "@/server/visio/questionnaire-en-ligne/jeton";

import { Coquille } from "../../../[id]/[jeton]/Coquille";
import { arreterRappelsAction } from "./actions";
import { TEXTES_RAPPELS } from "./textes";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Rappels du questionnaire — Axion-IA",
  robots: { index: false, follow: false, nocache: true },
  referrer: "same-origin",
};

interface PageProps {
  params: Promise<{ id: string; jeton: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const un = (v: string | string[] | undefined): string | null =>
  typeof v === "string" ? v : Array.isArray(v) ? (v[0] ?? null) : null;

const carte = "bg-paper bg-halo-warm shadow-card rounded-3xl p-7 sm:p-10";
const titre = "font-serif text-[34px] leading-tight font-medium tracking-tight sm:text-[40px]";
const ligne = "text-fg-soft mt-3 text-[20px] leading-relaxed";
const bouton =
  "bg-terracotta hover:bg-terracotta-deep focus-visible:outline-terracotta mt-6 inline-flex min-h-[56px] items-center justify-center rounded-full px-8 text-[19px] font-bold text-white focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-solid";

export default async function RappelsPage({ params, searchParams }: PageProps) {
  const { id, jeton } = await params;
  const sp = await searchParams;
  if (!jetonArretRelancesPreauditValide(id, jeton)) notFound();
  const essai = un(sp["essai"]) === "1";
  const erreur = un(sp["erreur"]);

  if (un(sp["fait"]) === "1") {
    return (
      <Coquille>
        <section className={carte} aria-labelledby="rappels-titre">
          <h1 id="rappels-titre" className={titre}>
            {TEXTES_RAPPELS.fait}
          </h1>
          <p className={ligne}>{TEXTES_RAPPELS.faitLigne}</p>
          {essai ? <p className={ligne}>{TEXTES_RAPPELS.essai}</p> : null}
        </section>
      </Coquille>
    );
  }

  return (
    <Coquille>
      <section className={carte} aria-labelledby="rappels-titre">
        <h1 id="rappels-titre" className={titre}>
          {TEXTES_RAPPELS.question}
        </h1>
        <p className={ligne}>{TEXTES_RAPPELS.explication}</p>
        {erreur === "trop" || erreur === "panne" ? (
          <p role="alert" className={ligne}>
            {TEXTES_RAPPELS[erreur]}
          </p>
        ) : null}
        <form action={arreterRappelsAction}>
          <input type="hidden" name="questionnaireId" value={id.toLowerCase()} />
          <input type="hidden" name="jeton" value={jeton} />
          {essai ? <input type="hidden" name="essai" value="1" /> : null}
          <button type="submit" className={bouton}>
            {TEXTES_RAPPELS.bouton}
          </button>
        </form>
        {essai ? <p className={ligne}>{TEXTES_RAPPELS.essai}</p> : null}
      </section>
    </Coquille>
  );
}
