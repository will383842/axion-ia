/**
 * `axionia.methode.contexte` — le contexte « Méthode » de vente (ADR 0076).
 *
 * Outil de LECTURE (`methode_contexte` dans la demande de Williams ; la grammaire
 * du socle impose « adaptateur.domaine.action », d'où `methode.contexte`). Il ne
 * fait qu'appeler le point d'entrée unique `obtenirContexteMethode` :
 *
 *   - premier item : le NOYAU (fiche 00, « L'essentiel » + « Le chemin ») ;
 *   - items suivants : les extraits trouvés pour `sujet` (collection santé
 *     seulement si `secteur = "sante"`).
 *
 * Interrupteur `METHODE_ACTIVE` éteint ⇒ aucun item, aucun accès à la base.
 * Les montants des fiches sont des EXEMPLES d'entraînement : chaque item qui en
 * cite porte `chiffresExercice: true` et l'avertissement en tête de `texte`.
 */

import { z } from "zod/v4";

import { obtenirContexteMethode } from "@/server/methode";

import { definirOutil } from "../contrat";
import { meta, schemaSortie } from "../sortie";

export const VERSION = "1.0.0";

const Entree = z.strictObject({
  /** Le sujet : situation, objection, type de message à écrire… */
  sujet: z.string().min(1).max(500),
  /** `"sante"` ouvre le dossier secteur santé ; absent, il reste fermé. */
  secteur: z.enum(["sante"]).optional(),
  max: z.number().int().min(1).max(10).optional(),
});

const Item = z.strictObject({
  slug: z.string().regex(/^methode\/[a-z0-9-]+\/[a-z0-9-]+$/),
  /** Vrai pour le noyau (toujours en premier quand il existe). */
  noyau: z.boolean(),
  titre: z.string(),
  texte: z.string(),
  collection: z.enum(["methode-vente", "methode-secteur-sante"]),
  chiffresExercice: z.boolean(),
  /** Rang 2 — les étiquettes (`livre:*`, `type:*`, `chiffres-exercice`…). */
  etiquettes: z.array(z.string()).optional(),
});

type ItemSortie = z.output<typeof Item>;

export const methodeContexte = definirOutil({
  name: "methode.contexte",
  version: VERSION,
  description:
    "Le contexte de méthode de vente Axion-IA (équipe seulement) : le noyau toujours " +
    "rendu, puis les fiches trouvées pour un sujet. Montants = exemples d'entraînement, " +
    "jamais des prix. Vide si la couche est éteinte.",
  effect: "read",
  dataClass: "internal",
  idempotency: "n/a",
  pagination: "none",
  input: Entree,
  output: schemaSortie(Item),
  maxBytes: 32_768,
  compaction: { free: ["texte", "titre"], tier2: ["etiquettes"], aggregateBy: "collection" },
  idFields: ["slug"],
  governanceFields: [],
  fixtureMax: "fixtures/methode-contexte.max.json",
  async handler(entree) {
    const contexte = await obtenirContexteMethode({
      sujet: entree.sujet,
      ...(entree.secteur !== undefined ? { secteur: entree.secteur } : {}),
      ...(entree.max !== undefined ? { max: entree.max } : {}),
    });
    const versItem = (e: (typeof contexte.extraits)[number], noyau: boolean): ItemSortie => ({
      slug: e.slug,
      noyau,
      titre: e.titre,
      texte: e.texte,
      collection:
        e.collection === "methode-secteur-sante" ? "methode-secteur-sante" : "methode-vente",
      chiffresExercice: e.chiffresExercice,
      etiquettes: [...e.etiquettes],
    });
    const items: ItemSortie[] = [
      ...(contexte.noyau ? [versItem(contexte.noyau, true)] : []),
      ...contexte.extraits.map((e) => versItem(e, false)),
    ];
    return {
      items,
      meta: meta({ returned: items.length, version: VERSION, asOf: new Date() }),
    };
  },
});
