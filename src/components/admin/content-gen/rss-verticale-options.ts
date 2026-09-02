/**
 * Sources RSS — options du champ « Verticale » et langue par défaut.
 *
 * Partagé par le formulaire de CRÉATION (`RssFormClient`, composant client) et
 * celui d'ÉDITION (`RssDetailV2`, composant serveur). Audit console 2026-09-02 :
 * la création n'exposait ni la verticale ni la langue, l'édition les portait ;
 * les options vivaient dans le seul fichier d'édition.
 *
 * Module PUR (ni "use client" ni "use server") : c'est la seule forme qu'un
 * composant client ET un composant serveur peuvent importer comme une valeur.
 *
 * ⚠️ Les `value` doivent rester alignées sur `VERTICALE_VALUES` (schéma Zod de
 * `src/server/actions/content-gen/rss-sources.ts`). Ce module ne peut PAS
 * l'importer : un fichier "use server" n'exporte que des actions. Une valeur
 * absente du schéma est refusée côté serveur (`z.enum`), jamais persistée.
 */

export const RSS_VERTICALE_OPTIONS = [
  { value: "", label: "— (transversal)" },
  { value: "interventions", label: "Interventions" },
  { value: "audit", label: "Audit" },
  { value: "implementations", label: "Implémentations" },
  { value: "un_a_un", label: "Un à un" },
] as const;

/** Langue par défaut d'une source (défaut du schéma Zod `language`). */
export const RSS_LANGUAGE_DEFAULT = "fr";
