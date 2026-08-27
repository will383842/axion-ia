// « Entrées récentes » — QUATRIÈME porte pour un seul geste, refermée le 2026-08-27.
//
// ## Pourquoi cet écran disparaît
//
// Prendre connaissance d'une demande avait quatre portes : `contacts` (Boîte de
// réception), `contacts/appels`, `contacts/messages`, et celle-ci. Cet écran
// refaisait l'union « appels Calendly + messages du site » que `listInbox` fait
// déjà — deux lectures des mêmes tables, deux tris, deux comptages, et aucun
// moyen de savoir laquelle disait vrai quand elles divergeaient.
//
// ## Ce qui a été REPRIS, pas perdu
//
// Sa seule valeur propre était l'annotation « déjà client » : un badge qui évite
// de convertir deux fois la même personne. Elle est désormais une COLONNE de la
// Boîte de réception, alimentée par `clientsParEmail()` — la fonction extraite
// de cet écran-ci et **importée**, jamais recopiée. Les deux règles subtiles
// (comparaison insensible à la casse, « le premier client créé gagne » sur un
// e-mail en double) restent donc uniques.
//
// Les actions de ligne — « Convertir en client », « Créer un devis » — vivaient
// déjà sur la fiche de chaque demande. Elles n'ont pas bougé.
//
// ## Pourquoi un 308 et pas une suppression
//
// Même patron que les 11 routes du module Booking (2026-08-01) : les
// marque-pages et les liens collés dans des e-mails doivent continuer de
// tomber sur quelque chose d'utile. Le garde `auth()` est conservé — les tests
// E2E assertent le renvoi vers /login sans session.
//
// Décision : `_AUDIT/RESERVATION-2026-08-26/UNE-SEULE-PORTE.md`.

import { permanentRedirect, redirect } from "next/navigation";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
}

export default async function EntreesRecentesRedirect({ params }: PageProps): Promise<never> {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  permanentRedirect(`/fr/${adminPrefix}/contacts`);
}
