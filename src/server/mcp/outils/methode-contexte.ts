/**
 * `axionia.methode.contexte` — la méthode de vente, pour rédiger juste (ADR 0076).
 *
 * Lecture seule. Passe par `obtenirContexteMethode`, le point d'entrée UNIQUE de
 * la couche « Méthode » : le noyau (fiche 00, « L'essentiel en 30 secondes »
 * + « Le chemin ») puis les fiches les plus proches du sujet. Le secteur santé
 * n'est ouvert que si `secteur = "sante"`.
 *
 * Interrupteur éteint (`METHODE_ACTIVE`) : la liste est vide et `meta.sourceNote`
 * le dit — un vide expliqué, jamais un vide muet.
 *
 * ⚠️ Les montants des fiches sont des montants d'ENTRAÎNEMENT (étiquette
 *    `chiffres-exercice`), pas des prix publics.
 */

import { z } from "zod/v4";

import { methodeActive, obtenirContexteMethode } from "@/server/methode";

import { definirOutil } from "../contrat";
import { meta, schemaSortie } from "../sortie";

export const VERSION = "1.0.0";

const EXTRAITS_MAX = 10;

const Entree = z.strictObject({
  /** Ce dont parle le texte à produire (« relance après diagnostic », « objection prix »…). */
  sujet: z.string().min(2).max(300),
  /** Seule valeur reconnue : « sante ». Absent = méthode générale seule. */
  secteur: z.enum(["sante"]).optional(),
  /** Nombre d'extraits en plus du noyau (défaut 5). */
  max: z.number().int().min(0).max(EXTRAITS_MAX).optional(),
});

const Item = z.strictObject({
  role: z.enum(["noyau", "extrait"]),
  /** `methode/<fichier>/<section>`. */
  slug: z.string().regex(/^methode\/[a-z0-9-]+\/[a-z0-9-]+$/),
  titre: z.string(),
  texte: z.string(),
  collection: z.string().nullable(),
  /** Rang 2 — `livre:*`, `type:*`, `chiffres-exercice`, `secteur:sante`. */
  etiquettes: z.array(z.string()).optional(),
});

export const methodeContexte = definirOutil({
  name: "methode.contexte",
  version: VERSION,
  description:
    "La méthode de vente interne d'Axion-IA pour un sujet donné : le noyau (l'essentiel en " +
    "30 secondes et le chemin), puis les fiches les plus proches (règles, scripts, objections). " +
    "Les montants des fiches sont des exercices, jamais des prix publics. Vide si la couche est éteinte.",
  effect: "read",
  dataClass: "internal",
  idempotency: "n/a",
  pagination: "none",
  input: Entree,
  output: schemaSortie(Item),
  maxBytes: 40_960,
  compaction: { free: ["texte"], tier2: ["etiquettes"], aggregateBy: "role" },
  idFields: ["slug"],
  governanceFields: [],
  fixtureMax: "fixtures/methode-contexte.max.json",
  async handler(entree) {
    const asOf = new Date();
    if (!methodeActive()) {
      return {
        items: [],
        meta: meta({
          returned: 0,
          version: VERSION,
          asOf,
          sourceIncomplete: true,
          sourceNote: "Couche « Méthode » éteinte (interrupteur METHODE_ACTIVE).",
        }),
      };
    }
    const contexte = await obtenirContexteMethode({
      sujet: entree.sujet,
      ...(entree.secteur !== undefined ? { secteur: entree.secteur } : {}),
      ...(entree.max !== undefined ? { max: entree.max } : {}),
    });
    const items = [
      ...(contexte.noyau
        ? [
            {
              role: "noyau" as const,
              slug: contexte.noyau.slug,
              titre: contexte.noyau.titre,
              texte: contexte.noyau.texte,
              collection: null,
            },
          ]
        : []),
      ...contexte.extraits.map((x) => ({
        role: "extrait" as const,
        slug: x.slug,
        titre: x.titre,
        texte: x.texte,
        collection: x.collection,
        etiquettes: [...x.etiquettes],
      })),
    ];
    return {
      items,
      meta: meta({
        returned: items.length,
        version: VERSION,
        asOf,
        ...(contexte.noyau === null
          ? { sourceIncomplete: true, sourceNote: "Noyau introuvable : import non fait ?" }
          : {}),
      }),
    };
  },
});
