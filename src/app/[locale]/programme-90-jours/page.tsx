// GEO V2-05 / V2-06 : page d'offre « programme-90-jours » (gabarit commun, Server Component sans JS client).
import type { Metadata } from "next";

import { PAGES_OFFRES_SUITE } from "../_offres-suite/contenu";
import { PageOffreSuiteRendue, metadonneesOffreSuite } from "../_offres-suite/PageOffreSuite";

export const revalidate = 3600;

const PAGE = PAGES_OFFRES_SUITE["programme-90-jours"];

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return metadonneesOffreSuite(PAGE, params);
}

export default function Page({ params }: Props) {
  return PageOffreSuiteRendue({ p: PAGE, params });
}
