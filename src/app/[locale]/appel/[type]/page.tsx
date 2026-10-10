/**
 * `/fr/appel/<type>` — l'adresse PROPRE de chacun des cinq rendez-vous.
 *
 *   /fr/appel/diagnostic      Diagnostic IA
 *   /fr/appel/echange-projet  Échange projet
 *   /fr/appel/apporteur       Échange apporteur d'affaires   (lien privé)
 *   /fr/appel/salon-gofab     Rencontre au salon GOFAB       (lien privé)
 *   /fr/appel/formateur-independant
 *                             Échange formateur indépendant  (lien privé, 2026-10-09)
 *
 * ## Pourquoi cette page ne contient (presque) rien
 *
 * Le calendrier, les créneaux, le formulaire, la confirmation, le report et
 * l'annulation sont UN SEUL parcours, déjà écrit pour `/appel?rdv=…`. Cette
 * route n'en est que la porte : elle traduit le segment d'URL en choix et rend la
 * page d'`/appel` avec ce choix. Recopier la page quatre fois aurait fait quatre
 * pages qui divergent ; la table `types-reservables.ts` porte tout ce qui change
 * d'un type à l'autre.
 *
 * ## 🔴 Ces adresses ne s'indexent pas
 *
 * Deux types sont « En privé » chez Calendly (liens secrets), et les deux autres
 * ont déjà leur adresse publique (`/appel?rdv=…`) : une seconde adresse
 * indexable ferait deux pages pour un même rendez-vous.
 *
 * Les routes statiques voisines (`reserver`, `reporter`, `confirme`, `annuler`)
 * l'emportent sur ce segment dynamique : aucun conflit.
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import AppelPage from "../page";
import { PARAM_RDV } from "@/server/calendly/choix-rendez-vous";
import { choixDeLaRoute, configDuChoix } from "@/server/calendly/types-reservables";

/**
 * Même fraîcheur que `/appel` (`SLOTS_REVALIDATE_SECONDS`) — littéral, Next exige
 * une valeur analysable statiquement. Inerte tant que la page lit `searchParams`.
 */
export const revalidate = 900;

interface Props {
  params: Promise<{ locale: string; type: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

export async function generateMetadata({ params }: Pick<Props, "params">): Promise<Metadata> {
  const { type } = await params;
  const choix = choixDeLaRoute(type);
  if (!choix) return { robots: { index: false, follow: false } };
  return {
    title: { absolute: `${configDuChoix(choix).nom} · réservation · Axion-IA` },
    robots: { index: false, follow: false },
  };
}

export default async function RendezVousPage({ params, searchParams }: Props) {
  const { locale, type } = await params;
  const choix = choixDeLaRoute(type);
  if (!choix) notFound();
  const sp = await searchParams;
  // Le choix vient du SEGMENT, jamais d'un `?rdv=` : s'il y en a un dans l'URL, le
  // segment l'emporte (`/appel/apporteur?rdv=diagnostic` reste l'apporteur).
  return (
    <AppelPage
      params={Promise.resolve({ locale })}
      searchParams={Promise.resolve({ ...sp, [PARAM_RDV]: choix })}
    />
  );
}
