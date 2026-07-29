"use client";
// use-client: useRouter + form submit pour navigation filtres URL params.

import { useRouter, usePathname } from "next/navigation";
import { useState } from "react";
import { UNIFIED_TYPE_LABELS } from "@/features/admin-submissions/type-labels";

// Refonte « Boîte de réception » 2026-07-29 — filtre « Catégorie ».
//
// Le sélecteur « Type » ci-dessous porte l'enum DB `SubmissionType`, qui ne
// compte que 5 valeurs : partenariat, presse, recrutement, speaker,
// investisseur, support et « autre » y sont TOUS écrasés en « contact ». Il
// était donc impossible d'isoler la presse depuis cette page — d'où les cinq
// entrées de sidebar figées qui existaient pour contourner ce manque.
// Ce second sélecteur expose `details.unifiedType`, le type fin réel (12
// valeurs, cf. UNIFIED_TYPE_LABELS), et rend ces raccourcis superflus.
//
// Les deux groupes reprennent la structure du formulaire public : projet IA
// d'un côté, autres demandes de l'autre.
const CLIENT_UNIFIED_TYPES = [
  "audit",
  "implementation",
  "formation",
  "un_a_un",
  "devis",
  "support_client",
] as const;
const AUTRE_UNIFIED_TYPES = [
  "partenariat",
  "presse",
  "recrutement",
  "speaker",
  "investisseur",
  "autre",
] as const;

interface FiltersProps {
  initial: Record<string, string | undefined>;
  /**
   * Masque le sélecteur « Catégorie » sur les vues déjà verrouillées sur un
   * sous-ensemble de types (onglets Clients / Presse / …) : le filtre y serait
   * inopérant, `forcedTypes` étant prioritaire côté serveur. Afficher un
   * contrôle sans effet est pire que ne pas l'afficher.
   */
  hideCategory?: boolean;
}

export function SubmissionFilters({ initial, hideCategory = false }: FiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState({
    type: initial.type ?? "all",
    unifiedType: initial.unifiedType ?? "all",
    status: initial.status ?? "all",
    locale: initial.locale ?? "all",
    search: initial.search ?? "",
    dateFrom: initial.dateFrom ?? "",
    dateTo: initial.dateTo ?? "",
    // Sprint Notif Infra 2026-05-26 / fix P0-2 + P1-2 audit 2026-05-27.
    replyStatus: initial.replyStatus ?? "all",
    includeArchived: initial.includeArchived ?? "false",
    // Corbeille (2026-07-10) — passthrough caché : conserve l'onglet Corbeille
    // (deleted=true) quand on applique un filtre depuis cette vue.
    deleted: initial.deleted ?? "false",
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(state)) {
      // `unifiedType` n'a aucun effet sur les vues à types forcés : ne pas le
      // pousser dans l'URL évite un paramètre trompeur dans la barre d'adresse.
      if (k === "unifiedType" && hideCategory) continue;
      if (v && v !== "all" && v !== "false" && v !== "") params.set(k, v);
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
            <option value="intervention">Intervention (Formation / 1-to-1)</option>
            <option value="contact">
              Contact générique (Partenariat / Presse / Recrutement / Speaker / Investisseur /
              Support / Autre)
            </option>
            <option value="quote_request">Devis</option>
          </select>
        </div>

        {hideCategory ? null : (
          <div className="admin-field">
            <label htmlFor="unifiedType" className="admin-label">
              Catégorie
            </label>
            <select
              id="unifiedType"
              value={state.unifiedType}
              onChange={(e) => setState({ ...state, unifiedType: e.target.value })}
              className="admin-input"
            >
              <option value="all">Toutes</option>
              <optgroup label="Projet IA">
                {CLIENT_UNIFIED_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {UNIFIED_TYPE_LABELS[t]}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Autres demandes">
                {AUTRE_UNIFIED_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {UNIFIED_TYPE_LABELS[t]}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>
        )}

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
            Langue
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

        {/* Sprint Notif Infra 2026-05-26 / fix P1-2 — filtre statut réponse */}
        <div className="admin-field">
          <label htmlFor="replyStatus" className="admin-label">
            Statut réponse
          </label>
          <select
            id="replyStatus"
            value={state.replyStatus}
            onChange={(e) => setState({ ...state, replyStatus: e.target.value })}
            className="admin-input"
          >
            <option value="all">Tous</option>
            <option value="unanswered">Sans réponse</option>
            <option value="answered">Répondus</option>
            <option value="failed">Échec d&apos;envoi</option>
          </select>
        </div>

        {/* Toggle archivés retiré 2026-07-10 : remplacé par les onglets
            Actifs / Archivés / Corbeille de SubmissionsV2. `includeArchived`
            reste en state comme passthrough caché (préserve l'onglet Archivés
            quand on applique un filtre). */}
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
