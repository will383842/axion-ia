// `/tour-france-ia/demande` — la mini-demande qui précède la visio (PR-2b).
//
// Trois champs (nom, e-mail, ville), puis le calendrier de la visio. Composant SERVEUR :
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

import { TOUR_PUBLIC } from "@/features/tour-de-france/visibilite";
import { nomsDesVillesSuggerees } from "@/features/tour-de-france/villes";
import { HoneypotField } from "@/components/forms/HoneypotField";
import { lireSuiviArrivee } from "@/server/calendly/choix-rendez-vous";

import { CHEMIN_CONDITIONS, CONDITIONS, MICRO_TEXTE_CTA, NOM_DU_TOUR } from "../contenu";
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

// Contrastes (jetons de `globals.css`, calculés) : texte `fg` sur `paper` 17:1 ; contour des champs
// `border-field` 3,9:1 sur `paper` (WCAG 1.4.11) ; bouton `paper` sur `terracotta` 5,8:1 (AA),
// 8,3:1 au survol (`terracotta-deep`) ; anneau de focus `terracotta` 5,8:1 sur `paper`.
const LABEL = "text-fg block text-base font-bold";
const CHAMP =
  "border-border-field bg-paper text-fg focus:border-terracotta focus-visible:outline-terracotta mt-1.5 block min-h-12 w-full rounded-lg border-2 px-4 text-base focus-visible:outline-[3px] focus-visible:outline-offset-2";

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

  return (
    <main className="bg-sand w-full px-4 py-10 sm:px-6 sm:py-16">
      <div className="mx-auto w-full max-w-xl">
        <h1 className="text-fg font-serif text-[clamp(1.875rem,1.35rem+2.2vw,3rem)] leading-[1.08] font-semibold tracking-tight text-balance">
          Votre journée offerte, en trois champs
        </h1>
        <p className="text-fg mt-3 text-lg">Ensuite, vous choisissez le créneau de votre visio.</p>

        {erreur ? (
          <p
            role="alert"
            className="border-terracotta bg-terracotta-soft text-fg mt-6 rounded-lg border-2 px-4 py-3 font-medium"
          >
            {MESSAGES_ERREUR[erreur]}
          </p>
        ) : null}

        <form
          action={envoyerDemandeTour}
          className="bg-paper border-sand-deep shadow-card mt-8 grid gap-5 rounded-2xl border p-5 sm:p-8"
        >
          {CHAMPS_CACHES.map((cle) => {
            const v = suivi[cle];
            return v ? <input key={cle} type="hidden" name={cle} value={v} /> : null;
          })}

          <div>
            <label htmlFor="tdf-nom" className={LABEL}>
              Nom
            </label>
            <input
              id="tdf-nom"
              name="nom"
              autoFocus={erreur === "champs"}
              type="text"
              autoComplete="name"
              required
              maxLength={80}
              className={CHAMP}
            />
          </div>
          <div>
            <label htmlFor="tdf-email" className={LABEL}>
              E-mail
            </label>
            <input
              id="tdf-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              maxLength={254}
              className={CHAMP}
            />
          </div>
          <div>
            <label htmlFor="tdf-ville" className={LABEL}>
              Ville
            </label>
            <input
              id="tdf-ville"
              name="ville"
              type="text"
              autoComplete="address-level2"
              required
              maxLength={80}
              list="tdf-villes"
              className={CHAMP}
            />
            <datalist id="tdf-villes">
              {villes.map((v) => (
                <option key={v} value={v} />
              ))}
            </datalist>
          </div>

          <HoneypotField />

          <div className="flex flex-col gap-1.5">
            <button
              type="submit"
              className="bg-terracotta text-paper hover:bg-terracotta-deep focus-visible:outline-terracotta min-h-14 w-full rounded-full px-6 text-lg font-bold transition-colors focus-visible:outline-[3px] focus-visible:outline-offset-2 motion-reduce:transition-none"
            >
              {LIBELLE_BOUTON}
            </button>
            <p className="text-fg-soft text-center text-sm font-medium">{MICRO_TEXTE_CTA}</p>
            <p className="text-fg-soft text-center text-[0.8125rem]">
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
