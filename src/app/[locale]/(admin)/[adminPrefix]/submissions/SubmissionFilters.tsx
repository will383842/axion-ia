"use client";
// use-client: useRouter + form submit pour navigation filtres URL params.

import { useRouter, usePathname } from "next/navigation";
import { useState } from "react";

interface FiltersProps {
  initial: Record<string, string | undefined>;
}

export function SubmissionFilters({ initial }: FiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState({
    type: initial.type ?? "all",
    status: initial.status ?? "all",
    locale: initial.locale ?? "all",
    search: initial.search ?? "",
    dateFrom: initial.dateFrom ?? "",
    dateTo: initial.dateTo ?? "",
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(state)) {
      if (v && v !== "all") params.set(k, v);
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  function handleReset() {
    router.push(pathname);
  }

  return (
    <form onSubmit={handleSubmit} className="admin-card admin-filters">
      <div className="admin-filters-grid">
        <div className="admin-field">
          <label htmlFor="type" className="admin-label">
            Type
          </label>
          <select
            id="type"
            value={state.type}
            onChange={(e) => setState({ ...state, type: e.target.value })}
            className="admin-input"
          >
            <option value="all">Tous</option>
            <option value="audit">Audit</option>
            <option value="implementation">Implémentation</option>
            <option value="intervention">Intervention</option>
            <option value="contact">Contact</option>
          </select>
        </div>

        <div className="admin-field">
          <label htmlFor="status" className="admin-label">
            Statut
          </label>
          <select
            id="status"
            value={state.status}
            onChange={(e) => setState({ ...state, status: e.target.value })}
            className="admin-input"
          >
            <option value="all">Tous</option>
            <option value="new">Nouveau</option>
            <option value="in_progress">En cours</option>
            <option value="processed">Traité</option>
            <option value="archived">Archivé</option>
          </select>
        </div>

        <div className="admin-field">
          <label htmlFor="locale" className="admin-label">
            Locale
          </label>
          <select
            id="locale"
            value={state.locale}
            onChange={(e) => setState({ ...state, locale: e.target.value })}
            className="admin-input"
          >
            <option value="all">Toutes</option>
            <option value="fr">FR</option>
            <option value="en">EN</option>
          </select>
        </div>

        <div className="admin-field">
          <label htmlFor="search" className="admin-label">
            Recherche (email, nom, société)
          </label>
          <input
            id="search"
            type="text"
            value={state.search}
            onChange={(e) => setState({ ...state, search: e.target.value })}
            className="admin-input"
            placeholder="Min 2 caractères"
            minLength={2}
          />
        </div>

        <div className="admin-field">
          <label htmlFor="dateFrom" className="admin-label">
            Date début
          </label>
          <input
            id="dateFrom"
            type="date"
            value={state.dateFrom}
            onChange={(e) => setState({ ...state, dateFrom: e.target.value })}
            className="admin-input"
          />
        </div>

        <div className="admin-field">
          <label htmlFor="dateTo" className="admin-label">
            Date fin
          </label>
          <input
            id="dateTo"
            type="date"
            value={state.dateTo}
            onChange={(e) => setState({ ...state, dateTo: e.target.value })}
            className="admin-input"
          />
        </div>
      </div>
      <div className="admin-filters-actions">
        <button type="submit" className="admin-button">
          Appliquer
        </button>
        <button type="button" onClick={handleReset} className="admin-button-ghost">
          Réinitialiser
        </button>
      </div>
    </form>
  );
}
