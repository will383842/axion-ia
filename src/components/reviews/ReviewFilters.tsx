// Barre de filtres + tri des avis. Server Component, 0 JS : formulaire GET qui
// recharge la page avec les query params (searchParams). INP-safe, fonctionne
// sans JavaScript. Contrat de params : note, service, secteur, tri, q.

import Link from "next/link";
import { SERVICE_LINES } from "@/lib/reviews/service-lines";
import { CLIENT_SECTORS } from "@/content/sectors";

export interface ReviewFilterValues {
  note?: string | undefined;
  service?: string | undefined;
  secteur?: string | undefined;
  tri?: string | undefined;
  q?: string | undefined;
}

const SELECT =
  "border-border bg-paper focus:border-terracotta focus:ring-terracotta/20 h-11 rounded-lg border px-3 text-sm outline-none focus:ring-4";

export function ReviewFilters({
  values,
  resetHref,
}: {
  values: ReviewFilterValues;
  resetHref: string;
}) {
  return (
    <form method="get" className="flex flex-wrap items-end gap-3" aria-label="Filtrer les avis">
      <div className="flex flex-col gap-1">
        <label htmlFor="f-note" className="text-fg-muted text-xs">
          Note
        </label>
        <select id="f-note" name="note" defaultValue={values.note ?? ""} className={SELECT}>
          <option value="">Toutes</option>
          <option value="5">5 ★</option>
          <option value="4">4 ★</option>
          <option value="3">3 ★</option>
          <option value="2">2 ★</option>
          <option value="1">1 ★</option>
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="f-service" className="text-fg-muted text-xs">
          Service
        </label>
        <select
          id="f-service"
          name="service"
          defaultValue={values.service ?? ""}
          className={SELECT}
        >
          <option value="">Tous</option>
          {SERVICE_LINES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.labelFr}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="f-secteur" className="text-fg-muted text-xs">
          Secteur
        </label>
        <select
          id="f-secteur"
          name="secteur"
          defaultValue={values.secteur ?? ""}
          className={SELECT}
        >
          <option value="">Tous</option>
          {CLIENT_SECTORS.map((s) => (
            <option key={s.slug} value={s.slug}>
              {s.labelFr}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="f-tri" className="text-fg-muted text-xs">
          Trier
        </label>
        <select id="f-tri" name="tri" defaultValue={values.tri ?? "recent"} className={SELECT}>
          <option value="recent">Plus récents</option>
          <option value="rating_desc">Note décroissante</option>
          <option value="rating_asc">Note croissante</option>
          <option value="featured">Mis en avant</option>
        </select>
      </div>
      <div className="flex flex-1 flex-col gap-1">
        <label htmlFor="f-q" className="text-fg-muted text-xs">
          Recherche
        </label>
        <input
          id="f-q"
          name="q"
          type="search"
          defaultValue={values.q ?? ""}
          placeholder="mot-clé, entreprise…"
          className={`${SELECT} min-w-[10rem] flex-1`}
        />
      </div>
      <button
        type="submit"
        className="bg-terracotta hover:bg-terracotta-deep h-11 rounded-lg px-5 text-sm font-medium text-white"
      >
        Filtrer
      </button>
      <Link
        href={resetHref}
        className="text-fg-muted hover:text-fg flex h-11 items-center text-sm underline"
      >
        Réinitialiser
      </Link>
    </form>
  );
}
