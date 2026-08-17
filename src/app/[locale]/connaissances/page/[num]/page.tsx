/**
 * Pagination du hub `/connaissances` par CHEMIN — `/connaissances/page/2`, …
 *
 * GEO-088 (audit GEO/AEO du 2026-08-14). Mesuré en production le 2026-08-16, à
 * l'unité : **507 fiches déclarées dans `sitemap-knowledge.xml`, 48 liées
 * depuis le hub**. 459 pages annoncées à Google sans qu'aucun lien interne n'y
 * mène.
 *
 * Route calquée sur `/blog/page/[num]` : mêmes règles canoniques, même 404
 * franc hors bornes, même 308 de `page/1` vers le hub.
 *
 * 🔴 LE PIÈGE QUE `/blog` A PAYÉ (GEO-061, rectifié le 2026-08-16) : un segment
 * dynamique qui n'entre dans AUCUN manifeste de pré-rendu n'est pas servi en
 * ISR — il est servi **entièrement dynamiquement** (`private, no-store`,
 * `cf-cache-status: BYPASS`), et chaque passage de robot traverse l'origine.
 * D'où `generateStaticParams` ci-dessous, qui couvre tout le corpus actuel avec
 * de la marge.
 */

import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";

import { KbListingView, buildKbListingMetadata } from "../../_views/KbListingView";

export const revalidate = 3600;

/**
 * Plancher de pages pré-rendues — 507 fiches à 48 par page font 11 pages.
 *
 * POURQUOI UN PLANCHER À 5 ET PAS LES 11. Toute page pré-rendue DOIT figurer
 * dans les deux listes du job `warm`, sinon elle sert une coquille vide pendant
 * une heure après chaque déploiement. Or ces listes sont plafonnées à **30 URLs
 * par appel** par le plan Cloudflare Free, et elles en portent déjà 18 :
 * pré-rendre les 11 pages ferait 29 + les hubs villes, et au-delà de 30
 * Cloudflare rejette l'appel ENTIER — plus une seule page purgée, sur tout le
 * site. Le plafond n'est pas un détail de confort, c'est un point de casse.
 *
 * Les pages 6 à 11 restent donc rendues à la demande. Elles sont **liées**
 * (chaîne `prev`/`next`), donc les 507 fiches cessent d'être orphelines — c'est
 * l'objet de GEO-088. Elles ne sont simplement pas cachées à l'edge, ce qui
 * coûte du rendu origine sur les pages les plus profondes, c'est-à-dire les
 * moins visitées. Même arbitrage que `/blog`.
 *
 * ⚠️ Volontairement SANS lecture de base : le build tourne avec les URLs stub
 * (contrat ADR 0026) et `generateStaticParams` doit rendre le même résultat au
 * build qu'en production. Compter les fiches ici renverrait 0 sous le stub, et
 * plus aucune page ne serait pré-rendue — exactement le défaut qu'on corrige.
 */
const PAGES_PRERENDUES = [2, 3, 4, 5] as const;

export function generateStaticParams(): Array<{ num: string }> {
  return PAGES_PRERENDUES.map((n) => ({ num: String(n) }));
}

interface Props {
  params: Promise<{ locale: string; num: string }>;
}

/**
 * `num` doit être un entier ≥ 2 en écriture canonique (pas de `01`, pas de
 * `+2`) : tout le reste est un 404 franc — une URL malformée ne doit pas créer
 * d'alias indexable. `1` est l'unique exception : 308 vers `/connaissances`
 * (la page 1 canonique), pour absorber les liens externes éventuels.
 */
function parseCanonicalPageNum(raw: string): number | "one" | null {
  if (raw === "1") return "one";
  if (!/^[2-9]\d*$/.test(raw)) return null;
  return parseInt(raw, 10);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, num } = await params;
  const parsed = parseCanonicalPageNum(num);
  if (parsed === null || parsed === "one") return {};
  return buildKbListingMetadata(locale, parsed);
}

export default async function ConnaissancesPaginee({ params }: Props) {
  const { locale, num } = await params;
  const parsed = parseCanonicalPageNum(num);
  if (parsed === null) notFound();
  if (parsed === "one") permanentRedirect(`/${locale}/connaissances`);
  return <KbListingView locale={locale} page={parsed} />;
}
