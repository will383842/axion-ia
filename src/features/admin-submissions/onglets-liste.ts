// Les onglets d'une liste de messages (Actifs / Archivés / Corbeille), et ceux
// de la liste des apporteurs (2026-10-07, demande de Will) :
// « En cours » (par défaut) / « Archivés » / « Tous » / « Corbeille ».
//
// Module PUR : la liste le lit, le test aussi.
//
// 🔑 Aucun paramètre nouveau : « Tous » est `includeArchived=true` sans filtre
// de statut — ce que le serveur sait déjà lire. Les autres listes ne changent pas.

import type { PerimetreSubmissions } from "./query";

export type OngletListe = "active" | "archived" | "all" | "trash";

export interface OngletsListe {
  readonly options: ReadonlyArray<{ value: OngletListe; label: string; href: string }>;
  readonly current: OngletListe;
}

export function ongletsListe(input: {
  readonly perimetre?: PerimetreSubmissions;
  readonly base: string;
  readonly searchParams: Record<string, string | undefined>;
}): OngletsListe {
  const { base, searchParams, perimetre } = input;
  const deleted = searchParams["deleted"] === "true";
  const includeArchived = searchParams["includeArchived"] === "true";
  const archivesSeules = includeArchived && searchParams["status"] === "archived";
  const apporteurs = perimetre === "apporteurs";

  const current: OngletListe = deleted
    ? "trash"
    : archivesSeules
      ? "archived"
      : apporteurs && includeArchived
        ? "all"
        : "active";

  const options: Array<{ value: OngletListe; label: string; href: string }> = [
    { value: "active", label: apporteurs ? "En cours" : "Actifs", href: base },
    { value: "archived", label: "Archivés", href: `${base}?includeArchived=true&status=archived` },
  ];
  if (apporteurs)
    options.push({ value: "all", label: "Tous", href: `${base}?includeArchived=true` });
  options.push({ value: "trash", label: "Corbeille", href: `${base}?deleted=true` });
  return { options, current };
}
