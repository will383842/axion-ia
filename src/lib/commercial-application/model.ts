// Candidature commerciale — modèle partagé client/serveur (tunnel sans CV,
// Mémorial de l’Isère 2026-08-12).
//
// Vit dans `lib/` (frontière de modules) : le wizard (`components/forms/…`) et
// la Server Action (`features/commercial-application/…`) consomment tous deux
// ces constantes + le schéma Zod, sans jamais s’importer l’un l’autre.
//
// Règle absolue du brief : AUCUNE mention de « PME » nulle part — on s’adresse
// à toutes les entreprises, tous types de clients.

import { z } from "zod";

/** Clé localStorage de la sauvegarde auto (le candidat peut fermer et revenir). */
export const COMMERCIAL_APPLICATION_STORAGE_KEY = "axionia-candidature-commercial-v1";

/**
 * Version du consentement RGPD affiché par le formulaire.
 *
 * v2 (lot L4) — valeur FERME décidée au plan §2.3. Elle recouvre les DEUX
 * textes affichés ensemble : la case obligatoire (étude de la candidature) et
 * la case optionnelle, décochée par défaut (conservation en vivier 2 ans).
 *
 * 🔴 Le CRM REJETTE en 422 toute fiche candidat dont la version n'est pas v2 :
 * cette constante et la liste côté CRM doivent bouger ensemble.
 */
export const COMMERCIAL_APPLICATION_CONSENT_VERSION = "memo-v2-2026-08-13";

/** Durée de conservation annoncée dans la mention RGPD (candidatures). */
export const COMMERCIAL_APPLICATION_RETENTION = "2 ans";

// ── Options à choix (chips) ─────────────────────────────────────────────────

export interface ChoiceOption {
  readonly id: string;
  readonly label: string;
}

export const B2B_ANNEES_OPTIONS = [
  { id: "moins-1", label: "Moins d'1 an" },
  { id: "1-3", label: "1 à 3 ans" },
  { id: "3-5", label: "3 à 5 ans" },
  { id: "5-10", label: "5 à 10 ans" },
  { id: "plus-10", label: "Plus de 10 ans" },
] as const satisfies readonly ChoiceOption[];

export const TYPES_CLIENTS_OPTIONS = [
  { id: "entreprises", label: "Entreprises" },
  { id: "particuliers", label: "Particuliers" },
  { id: "secteur-public", label: "Secteur public" },
  { id: "mixte", label: "Mixte" },
] as const satisfies readonly ChoiceOption[];

export const IA_OUTILS_OPTIONS = [
  { id: "chatgpt", label: "ChatGPT" },
  { id: "claude", label: "Claude" },
  { id: "gemini", label: "Gemini" },
  { id: "copilot", label: "Copilot" },
  { id: "mistral", label: "Mistral" },
  { id: "perplexity", label: "Perplexity" },
  { id: "autre", label: "Autre" },
] as const satisfies readonly ChoiceOption[];

export const INFORMATIQUE_USAGES_OPTIONS = [
  { id: "crm", label: "CRM" },
  { id: "excel-sheets", label: "Excel / Sheets" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "emailing", label: "Emailing" },
  { id: "visio", label: "Visio" },
  { id: "autre", label: "Autre" },
] as const satisfies readonly ChoiceOption[];

export const DEPLACEMENT_OPTIONS = [
  { id: "oui", label: "Oui" },
  { id: "ponctuellement", label: "Ponctuellement" },
  { id: "non", label: "Non" },
] as const satisfies readonly ChoiceOption[];

export const STATUT_OPTIONS = [
  { id: "independant", label: "Déjà indépendant" },
  { id: "auto-entrepreneur", label: "Auto-entrepreneur" },
  { id: "salarie", label: "Salarié" },
  { id: "en-recherche", label: "En recherche" },
  { id: "creation-statut", label: "Je créerai mon statut" },
] as const satisfies readonly ChoiceOption[];

export const SOURCE_OPTIONS = [
  { id: "memorial-isere", label: "Le Mémorial de l’Isère" },
  // 2026-08-23 — annonce nationale Le Bon Coin (cf.
  // `docs/annonce-leboncoin-recrutement.md`). Sans cette entrée, une
  // candidature venue de l'annonce arrive indistinguable de tout le reste :
  // impossible de mesurer si le canal vaut son coût, donc impossible de
  // décider d'y remettre de l'argent. Purement additif : `sourceConnaissance`
  // n'est consommé qu'en affichage (`optionLabel`) et transmis au CRM comme
  // chaîne libre — aucun contrat à propager.
  { id: "leboncoin", label: "Le Bon Coin" },
  { id: "site-web", label: "Site web Axion-IA.com" },
  { id: "qr-code", label: "QR code" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "bouche-a-oreille", label: "Bouche à oreille" },
  { id: "autre", label: "Autre" },
] as const satisfies readonly ChoiceOption[];

/** Retrouve le label lisible d’une option (fallback : l’id brut). */
export function optionLabel(options: readonly ChoiceOption[], id: string | undefined): string {
  if (!id) return "—";
  return options.find((o) => o.id === id)?.label ?? id;
}

// ── Zone de travail : régions + départements (métropole + DROM) ─────────────

/** Les 13 régions métropolitaines — sélectionnables d’un tap. */
export const REGIONS_ZONE = [
  "Auvergne-Rhône-Alpes",
  "Bourgogne-Franche-Comté",
  "Bretagne",
  "Centre-Val de Loire",
  "Corse",
  "Grand Est",
  "Hauts-de-France",
  "Île-de-France",
  "Normandie",
  "Nouvelle-Aquitaine",
  "Occitanie",
  "Pays de la Loire",
  "Provence-Alpes-Côte d’Azur",
] as const;

export interface Departement {
  readonly code: string;
  readonly nom: string;
}

/** 101 départements (96 métropole + 5 DROM) — recherche + sélection fine. */
export const DEPARTEMENTS: readonly Departement[] = [
  { code: "01", nom: "Ain" },
  { code: "02", nom: "Aisne" },
  { code: "03", nom: "Allier" },
  { code: "04", nom: "Alpes-de-Haute-Provence" },
  { code: "05", nom: "Hautes-Alpes" },
  { code: "06", nom: "Alpes-Maritimes" },
  { code: "07", nom: "Ardèche" },
  { code: "08", nom: "Ardennes" },
  { code: "09", nom: "Ariège" },
  { code: "10", nom: "Aube" },
  { code: "11", nom: "Aude" },
  { code: "12", nom: "Aveyron" },
  { code: "13", nom: "Bouches-du-Rhône" },
  { code: "14", nom: "Calvados" },
  { code: "15", nom: "Cantal" },
  { code: "16", nom: "Charente" },
  { code: "17", nom: "Charente-Maritime" },
  { code: "18", nom: "Cher" },
  { code: "19", nom: "Corrèze" },
  { code: "2A", nom: "Corse-du-Sud" },
  { code: "2B", nom: "Haute-Corse" },
  { code: "21", nom: "Côte-d’Or" },
  { code: "22", nom: "Côtes-d’Armor" },
  { code: "23", nom: "Creuse" },
  { code: "24", nom: "Dordogne" },
  { code: "25", nom: "Doubs" },
  { code: "26", nom: "Drôme" },
  { code: "27", nom: "Eure" },
  { code: "28", nom: "Eure-et-Loir" },
  { code: "29", nom: "Finistère" },
  { code: "30", nom: "Gard" },
  { code: "31", nom: "Haute-Garonne" },
  { code: "32", nom: "Gers" },
  { code: "33", nom: "Gironde" },
  { code: "34", nom: "Hérault" },
  { code: "35", nom: "Ille-et-Vilaine" },
  { code: "36", nom: "Indre" },
  { code: "37", nom: "Indre-et-Loire" },
  { code: "38", nom: "Isère" },
  { code: "39", nom: "Jura" },
  { code: "40", nom: "Landes" },
  { code: "41", nom: "Loir-et-Cher" },
  { code: "42", nom: "Loire" },
  { code: "43", nom: "Haute-Loire" },
  { code: "44", nom: "Loire-Atlantique" },
  { code: "45", nom: "Loiret" },
  { code: "46", nom: "Lot" },
  { code: "47", nom: "Lot-et-Garonne" },
  { code: "48", nom: "Lozère" },
  { code: "49", nom: "Maine-et-Loire" },
  { code: "50", nom: "Manche" },
  { code: "51", nom: "Marne" },
  { code: "52", nom: "Haute-Marne" },
  { code: "53", nom: "Mayenne" },
  { code: "54", nom: "Meurthe-et-Moselle" },
  { code: "55", nom: "Meuse" },
  { code: "56", nom: "Morbihan" },
  { code: "57", nom: "Moselle" },
  { code: "58", nom: "Nièvre" },
  { code: "59", nom: "Nord" },
  { code: "60", nom: "Oise" },
  { code: "61", nom: "Orne" },
  { code: "62", nom: "Pas-de-Calais" },
  { code: "63", nom: "Puy-de-Dôme" },
  { code: "64", nom: "Pyrénées-Atlantiques" },
  { code: "65", nom: "Hautes-Pyrénées" },
  { code: "66", nom: "Pyrénées-Orientales" },
  { code: "67", nom: "Bas-Rhin" },
  { code: "68", nom: "Haut-Rhin" },
  { code: "69", nom: "Rhône" },
  { code: "70", nom: "Haute-Saône" },
  { code: "71", nom: "Saône-et-Loire" },
  { code: "72", nom: "Sarthe" },
  { code: "73", nom: "Savoie" },
  { code: "74", nom: "Haute-Savoie" },
  { code: "75", nom: "Paris" },
  { code: "76", nom: "Seine-Maritime" },
  { code: "77", nom: "Seine-et-Marne" },
  { code: "78", nom: "Yvelines" },
  { code: "79", nom: "Deux-Sèvres" },
  { code: "80", nom: "Somme" },
  { code: "81", nom: "Tarn" },
  { code: "82", nom: "Tarn-et-Garonne" },
  { code: "83", nom: "Var" },
  { code: "84", nom: "Vaucluse" },
  { code: "85", nom: "Vendée" },
  { code: "86", nom: "Vienne" },
  { code: "87", nom: "Haute-Vienne" },
  { code: "88", nom: "Vosges" },
  { code: "89", nom: "Yonne" },
  { code: "90", nom: "Territoire de Belfort" },
  { code: "91", nom: "Essonne" },
  { code: "92", nom: "Hauts-de-Seine" },
  { code: "93", nom: "Seine-Saint-Denis" },
  { code: "94", nom: "Val-de-Marne" },
  { code: "95", nom: "Val-d’Oise" },
  { code: "971", nom: "Guadeloupe" },
  { code: "972", nom: "Martinique" },
  { code: "973", nom: "Guyane" },
  { code: "974", nom: "La Réunion" },
  { code: "976", nom: "Mayotte" },
];

// ── Mois (libellés FR) ──────────────────────────────────────────────────────

export const MOIS_FR = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
] as const;

/** `"2026-09"` → `"septembre 2026"` (fallback : la valeur brute). */
export function formatMoisAnnee(value: string | undefined): string {
  if (!value) return "—";
  const m = /^(\d{4})-(\d{2})$/.exec(value);
  if (!m) return value;
  const mois = MOIS_FR[Number(m[2]) - 1];
  return mois ? `${mois} ${m[1]}` : value;
}

// ── Schéma Zod (source de vérité serveur, réutilisé côté client) ────────────

const MOIS_ANNEE = /^\d{4}-(0[1-9]|1[0-2])$/;

export const experienceSchema = z
  .object({
    entreprise: z.string().trim().min(1).max(120),
    ville: z.string().trim().min(1).max(120),
    poste: z.string().trim().min(1).max(120),
    debut: z.string().regex(MOIS_ANNEE),
    fin: z.string().regex(MOIS_ANNEE).optional(),
    posteActuel: z.boolean(),
    typesClients: z
      .array(z.enum(TYPES_CLIENTS_OPTIONS.map((o) => o.id) as [string, ...string[]]))
      .max(TYPES_CLIENTS_OPTIONS.length)
      .optional(),
  })
  .refine((e) => e.posteActuel || Boolean(e.fin), {
    message: "Indique la date de fin ou coche « poste actuel ».",
    path: ["fin"],
  });

export type ExperienceInput = z.infer<typeof experienceSchema>;

export const commercialApplicationSchema = z
  .object({
    prenom: z.string().trim().min(1).max(60),
    nom: z.string().trim().min(1).max(60),
    email: z.string().trim().email().max(180),
    telephone: z.string().trim().min(6).max(40),
    /** FACULTATIF (décision Will 2026-08-12 — réserve légale levée par l’option). */
    dateNaissance: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    /** FACULTATIF (décision Will 2026-08-12). */
    nationalite: z.string().trim().max(80).optional(),
    ville: z.string().trim().min(1).max(120),
    codePostal: z
      .string()
      .trim()
      .regex(/^[0-9A-Za-z][0-9A-Za-z -]{2,9}$/),
    b2bDejaVendu: z.boolean(),
    b2bAnnees: z.enum(B2B_ANNEES_OPTIONS.map((o) => o.id) as [string, ...string[]]).optional(),
    experiences: z.array(experienceSchema).min(1).max(8),
    iaUtilise: z.boolean(),
    iaOutils: z
      .array(z.enum(IA_OUTILS_OPTIONS.map((o) => o.id) as [string, ...string[]]))
      .max(IA_OUTILS_OPTIONS.length)
      .optional(),
    iaOutilAutre: z.string().trim().max(120).optional(),
    iaUsage: z.string().trim().max(600).optional(),
    informatiqueUtilise: z.boolean(),
    informatiqueUsages: z
      .array(z.enum(INFORMATIQUE_USAGES_OPTIONS.map((o) => o.id) as [string, ...string[]]))
      .max(INFORMATIQUE_USAGES_OPTIONS.length)
      .optional(),
    informatiqueAutre: z.string().trim().max(120).optional(),
    zoneMobile: z.boolean(),
    /** Labels lisibles (« Isère (38) », « Auvergne-Rhône-Alpes »). */
    zones: z.array(z.string().trim().min(1).max(60)).max(30).optional(),
    /**
     * OBLIGATOIRE (Will 2026-08-18). Métier de terrain : une candidature sans
     * réponse ici n'est pas exploitable côté recrutement.
     *
     * ⚠️ PAS de `.optional()` — et surtout pas d'`z.enum().optional()` sur un
     * champ dont l'UI peut renvoyer la chaîne vide : ce couple rejette `""`
     * avec un message générique, sans jamais désigner le champ fautif (défaut
     * constaté sur le formulaire de contact le 2026-08-17). Ici l'UI est en
     * chips et le wizard garantit une valeur non vide avant l'envoi.
     */
    deplacement: z.enum(DEPLACEMENT_OPTIONS.map((o) => o.id) as [string, ...string[]]),
    pitch: z.string().trim().min(150).max(800),
    messageLibre: z.string().trim().max(2000).optional(),
    disponibilite: z.string().regex(MOIS_ANNEE),
    permisVehicule: z.boolean(),
    statut: z.enum(STATUT_OPTIONS.map((o) => o.id) as [string, ...string[]]).optional(),
    linkedin: z.string().trim().max(255).optional(),
    sourceConnaissance: z.enum(SOURCE_OPTIONS.map((o) => o.id) as [string, ...string[]]).optional(),
    consent: z.literal(true),
    /**
     * Accord OPTIONNEL de conservation en vivier (lot L4).
     *
     * `z.boolean().optional()` et surtout PAS `z.literal(true)` : la case est
     * facultative, un refus (`false`) comme une absence sont des réponses
     * parfaitement valides. L'exiger la rendrait bloquante — donc plus un
     * consentement libre, donc juridiquement sans valeur.
     */
    consentVivier: z.boolean().optional(),
  })
  .refine((d) => d.zoneMobile || (d.zones?.length ?? 0) > 0, {
    message: "Choisis au moins une zone, ou « Peu importe, je suis mobile ».",
    path: ["zones"],
  })
  // « Pourquoi, et pour quoi faire ? » est OBLIGATOIRE quand la réponse IA
  // est Oui (retour Will 2026-08-13) — gardé aussi côté serveur.
  .refine((d) => !d.iaUtilise || Boolean(d.iaUsage && d.iaUsage.trim().length > 0), {
    message: "Explique en quelques mots pourquoi, et pour quoi faire.",
    path: ["iaUsage"],
  });

export type CommercialApplicationInput = z.infer<typeof commercialApplicationSchema>;

/** Résumé de la zone pour notification / récap (« Isère (38), Drôme (26) »). */
export function zoneResume(d: Pick<CommercialApplicationInput, "zoneMobile" | "zones">): string {
  if (d.zoneMobile) return "Peu importe — mobile";
  const zones = d.zones ?? [];
  if (zones.length === 0) return "—";
  if (zones.length <= 4) return zones.join(", ");
  return `${zones.slice(0, 4).join(", ")} +${zones.length - 4}`;
}
