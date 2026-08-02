"use client";
// use-client: useRouter + useSearchParams pour navigation filtres URL
// Filtres Site Explorer — Sprint Site Explorer Admin 2026-05-22.
// Client component : lit/écrit les search params via navigation.

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";

export function SiteExplorerFilters() {
  const router = useRouter();
  const sp = useSearchParams();
  const [, startTransition] = useTransition();

  const update = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(sp.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      params.delete("page");
      startTransition(() => router.push(`?${params.toString()}`));
    },
    [router, sp],
  );

  return (
    <div className="flex flex-wrap gap-3">
      <select
        value={sp.get("type") ?? ""}
        onChange={(e) => update("type", e.target.value)}
        aria-label="Filtrer par type"
        className="rounded-lg border border-[color:var(--color-admin-border-strong)] px-3 py-2 text-sm"
      >
        <option value="">Tous les types</option>
        <option value="static">Statique</option>
        <option value="dynamic_db">Dynamique DB</option>
        <option value="dynamic_template">Modèle</option>
        <option value="dynamic_filesystem">Système de fichiers</option>
      </select>

      <select
        value={sp.get("status") ?? ""}
        onChange={(e) => update("status", e.target.value)}
        aria-label="Filtrer par statut"
        className="rounded-lg border border-[color:var(--color-admin-border-strong)] px-3 py-2 text-sm"
      >
        <option value="">Tous les statuts</option>
        <option value="live">En ligne (200)</option>
        <option value="not_found">404</option>
        <option value="redirect">Redirection</option>
        <option value="error">Erreur</option>
        <option value="unknown">Inconnu</option>
        <option value="draft">Brouillon</option>
      </select>

      <select
        value={sp.get("category") ?? ""}
        onChange={(e) => update("category", e.target.value)}
        aria-label="Filtrer par catégorie"
        className="rounded-lg border border-[color:var(--color-admin-border-strong)] px-3 py-2 text-sm"
      >
        <option value="">Toutes les catégories</option>
        <option value="commercial">Commercial &amp; offres</option>
        <option value="villes">Villes &amp; implantations</option>
        <option value="contenu">Contenu éditorial</option>
        <option value="aide">Aide &amp; FAQ</option>
        <option value="conversion">Formulaires &amp; conversion</option>
        <option value="transversal">Transversal</option>
        <option value="galerie">Galerie</option>
        <option value="legal">Légal &amp; footer</option>
        <option value="autre">Autre</option>
      </select>

      <select
        value={sp.get("section") ?? ""}
        onChange={(e) => update("section", e.target.value)}
        aria-label="Filtrer par section"
        className="rounded-lg border border-[color:var(--color-admin-border-strong)] px-3 py-2 text-sm"
      >
        <option value="">Toutes les sections</option>
        {[
          "blog",
          "guides",
          "actualites",
          "connaissances",
          "cas-concrets",
          "comparaisons",
          "glossaire",
          "galerie",
          "presse",
          "stack-ia",
          "faq",
          "centre-aide",
          "audit",
          "interventions",
          "un-a-un",
          "implementation",
          "sites-web-augmentes",
          "implantations",
          "equipe",
          "contact",
          "demande-devis",
        ].map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>

      <select
        value={sp.get("indexable") ?? ""}
        onChange={(e) => update("indexable", e.target.value)}
        aria-label="Filtrer par indexabilité"
        className="rounded-lg border border-[color:var(--color-admin-border-strong)] px-3 py-2 text-sm"
      >
        <option value="">Indexable : tout</option>
        <option value="true">Indexable</option>
        <option value="false">Noindex</option>
      </select>

      <select
        value={sp.get("quality") ?? ""}
        onChange={(e) => update("quality", e.target.value)}
        aria-label="Filtrer par feu tricolore"
        className="rounded-lg border border-[color:var(--color-admin-border-strong)] px-3 py-2 text-sm"
      >
        <option value="">Feu : tout</option>
        <option value="green">Parfaite</option>
        <option value="orange">À retoucher</option>
        <option value="red">Cassée</option>
        <option value="unset">⚪ Non revue</option>
      </select>

      <select
        value={sp.get("sort") ?? ""}
        onChange={(e) => update("sort", e.target.value)}
        aria-label="Trier"
        className="rounded-lg border border-[color:var(--color-admin-border-strong)] px-3 py-2 text-sm"
      >
        <option value="">Tri : par défaut</option>
        <option value="indexable_first">Indexables d&apos;abord</option>
        <option value="noindex_first">Noindex d&apos;abord</option>
      </select>

      <label className="flex cursor-pointer items-center gap-2 text-sm text-[color:var(--color-admin-fg-soft)]">
        <input
          type="checkbox"
          checked={sp.get("gscRequested") === "true"}
          onChange={(e) => update("gscRequested", e.target.checked ? "true" : "")}
          className="rounded"
        />
        GSC demandé
      </label>

      <label className="flex cursor-pointer items-center gap-2 text-sm text-[color:var(--color-admin-fg-soft)]">
        <input
          type="checkbox"
          checked={sp.get("editable") === "true"}
          onChange={(e) => update("editable", e.target.checked ? "true" : "")}
          className="rounded"
        />
        Éditables uniquement
      </label>

      <label className="flex cursor-pointer items-center gap-2 text-sm text-[color:var(--color-admin-fg-soft)]">
        <input
          type="checkbox"
          checked={sp.get("anomaliesOnly") === "true"}
          onChange={(e) => update("anomaliesOnly", e.target.checked ? "true" : "")}
          className="rounded"
        />
        Avec anomalies
      </label>

      <input
        type="search"
        placeholder="Rechercher un path ou titre…"
        defaultValue={sp.get("search") ?? ""}
        onBlur={(e) => update("search", e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") update("search", (e.target as HTMLInputElement).value);
        }}
        className="w-56 rounded-lg border border-[color:var(--color-admin-border-strong)] px-3 py-2 text-sm"
        aria-label="Recherche"
      />
    </div>
  );
}
