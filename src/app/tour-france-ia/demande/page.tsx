// `/tour-france-ia/demande` — la mini-demande qui précède la visio (PR-2b).
//
// Trois champs (nom, e-mail, ville), puis le calendrier de la visio, dans le design de l'étape 2
// (`FilEtapesTour`, classes de `classes-formulaire.ts`). Composant SERVEUR :
// aucun JavaScript client, aucun cookie, aucun script tiers. Le formulaire est natif et mène à
// l'action `envoyerDemandeTour` (`actions.ts`), qui enregistre puis redirige vers la visio.
//
//   · ni indexée ni suivie ; `Referrer-Policy: same-origin` posée par la balise `meta` de la page
//     (champ `referrer` des métadonnées) ;
//   · lit `depuis` et `utm_*` dans l'adresse (même forme que `lireSuiviArrivee`) et les porte en
//     champs cachés : la visio les recevra ;
//   · une erreur se dit par `?erreur=champs` ou `?erreur=trop`, jamais avec une donnée saisie ;
//   · la page n'écrit rien au rendu.

import type { Metadata } from "next";
import { connection } from "next/server";
import { ArrowRight, ShieldCheck } from "lucide-react";

import { TOUR_PUBLIC } from "@/features/tour-de-france/visibilite";
import { nomsDesVillesSuggerees } from "@/features/tour-de-france/villes";
import { HoneypotField } from "@/components/forms/HoneypotField";
import { BOUTON_ENVOI, CHAMP_HAUT, LIBELLE } from "@/components/booking/classes-formulaire";
import { FilEtapesTour } from "@/components/tour/FilEtapesTour";
import { lireSuiviArrivee } from "@/server/calendly/choix-rendez-vous";

import { CompteurVilles } from "../_composants/CompteurVilles";
import { PictoTour, PictoVisio } from "../_composants/Visuels";
import { CHEMIN_CONDITIONS, CONDITIONS, ETAPES, MICRO_TEXTE_CTA, NOM_DU_TOUR } from "../contenu";
import { envoyerDemandeTour } from "./actions";

export const metadata: Metadata = {
  title: { absolute: `Ma demande · ${NOM_DU_TOUR}` },
  robots: { index: false, follow: false },
  // `same-origin`, jamais `no-referrer` : le navigateur enverrait `Origin: null` sur le POST et
  // Next refuserait l'action serveur (voir `next.config.ts`).
  referrer: "same-origin",
};

const LIBELLE_BOUTON = "Choisir mon créneau de visio";
const CHAMPS_CACHES = [
  "depuis",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
] as const;

const MESSAGES_ERREUR = {
  champs: "Un champ est à corriger : vérifiez votre nom, votre e-mail et votre ville.",
  trop: "Trop de demandes depuis cette connexion. Réessayez dans une heure.",
} as const;

// Les classes des champs, du libellé et du bouton viennent de `classes-formulaire.ts`, partagées
// avec l'étape 2 : contour `border-border-strong` sur `paper`, anneau de focus `terracotta`,
// bouton `text-mocha-fg` sur `bg-terracotta` (5,24:1, appariement du design system, jamais
// `text-paper`).

/** Le dessin de chaque ligne de « En 3 étapes », dans l'ordre d'`ETAPES.liste`. */
function PictoLigne({ index }: { index: number }) {
  if (index === 0) return <PictoTour nom="heures" taille={28} />;
  if (index === 1) return <PictoVisio taille={28} />;
  return <PictoTour nom="calendrier" taille={28} />;
}

function Requis() {
  return (
    <span className="text-terracotta-deep ml-1" aria-hidden="true">
      *
    </span>
  );
}

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function DemandePage({ searchParams }: Props) {
  if (!TOUR_PUBLIC) await connection();
  const sp = await searchParams;
  const suivi = lireSuiviArrivee(
    Object.fromEntries(Object.entries(sp).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])),
  );
  const erreur = sp["erreur"] === "champs" || sp["erreur"] === "trop" ? sp["erreur"] : null;
  const villes = nomsDesVillesSuggerees();
  // Composant serveur asynchrone : appelé ici, il rend son élément, ou rien sous le seuil.
  const compteur = await CompteurVilles();

  return (
    <main className="bg-canvas w-full px-4 pt-6 pb-16 sm:px-6 sm:pt-10">
      <div className="mx-auto w-full max-w-xl">
        <FilEtapesTour etapeCourante={1} />

        <h1
          className="text-fg mt-2.5 mb-1.5 text-[clamp(1.625rem,5.5vw,2.125rem)] leading-tight font-semibold tracking-tight"
          style={{ fontFamily: "var(--font-serif)" }}
        >
          Votre journée offerte commence ici
        </h1>
        <p className="text-fg-soft mb-5 text-[15px] leading-relaxed">
          Une minute, trois champs, puis vous choisissez votre visio.
        </p>

        <div className="border-terracotta/35 bg-terracotta-soft mb-5 rounded-2xl border p-4 sm:p-5">
          <p className="text-fg text-sm font-semibold">{ETAPES.titre}</p>
          <ol className="mt-3 grid gap-3">
            {ETAPES.liste.map((etape, i) => (
              <li key={etape} className="text-fg flex items-center gap-3 text-[15px]">
                <span className="bg-paper text-terracotta-deep grid h-10 w-10 shrink-0 place-items-center rounded-full">
                  <PictoLigne index={i} />
                </span>
                {etape}
              </li>
            ))}
          </ol>
          {compteur ? (
            <>
              <p className="text-fg mt-4 text-sm font-semibold">Les villes les plus demandées</p>
              {compteur}
            </>
          ) : null}
        </div>

        {erreur ? (
          <p
            role="alert"
            className="border-terracotta bg-terracotta-soft text-fg mb-5 rounded-lg border-2 px-4 py-3 font-medium"
          >
            {MESSAGES_ERREUR[erreur]}
          </p>
        ) : null}

        <form action={envoyerDemandeTour} className="space-y-5">
          {CHAMPS_CACHES.map((cle) => {
            const v = suivi[cle];
            return v ? <input key={cle} type="hidden" name={cle} value={v} /> : null;
          })}

          <div>
            <label htmlFor="tdf-nom" className={LIBELLE}>
              Nom
              <Requis />
            </label>
            <input
              id="tdf-nom"
              name="nom"
              autoFocus={erreur === "champs"}
              type="text"
              autoComplete="name"
              required
              maxLength={80}
              className={CHAMP_HAUT}
            />
          </div>
          <div>
            <label htmlFor="tdf-email" className={LIBELLE}>
              E-mail
              <Requis />
            </label>
            <input
              id="tdf-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              maxLength={254}
              className={CHAMP_HAUT}
            />
          </div>
          <div>
            <label htmlFor="tdf-ville" className={LIBELLE}>
              Ville
              <Requis />
            </label>
            <input
              id="tdf-ville"
              name="ville"
              type="text"
              autoComplete="address-level2"
              required
              maxLength={80}
              list="tdf-villes"
              className={CHAMP_HAUT}
            />
            <datalist id="tdf-villes">
              {villes.map((v) => (
                <option key={v} value={v} />
              ))}
            </datalist>
          </div>

          <HoneypotField />

          <div className="space-y-3 pt-1">
            <button type="submit" className={BOUTON_ENVOI}>
              {LIBELLE_BOUTON}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
            <p className="text-fg-soft flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center text-[13px]">
              <ShieldCheck className="text-sage h-4 w-4 shrink-0" aria-hidden="true" />
              {MICRO_TEXTE_CTA}
            </p>
            <p className="text-fg-soft text-center text-[13px]">
              {CONDITIONS}{" "}
              <a
                href={CHEMIN_CONDITIONS}
                className="text-fg font-semibold underline underline-offset-2"
              >
                Conditions
              </a>
            </p>
          </div>
        </form>

        <p className="text-fg-soft mt-8 text-sm leading-snug">
          Axion IA, responsable du traitement, utilise ces informations pour organiser votre visio
          et compter les demandes de chaque ville. Les clés de comptage sont conservées sous forme
          d’empreintes chiffrées. Votre téléphone vous sera demandé à l’étape suivante, pour la
          visio. Vous pouvez demander l’effacement de vos données à tout moment.
        </p>
      </div>
    </main>
  );
}
