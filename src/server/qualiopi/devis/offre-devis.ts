/**
 * Offre d'un devis à formules (A = achat, B = abonnement) — schéma v1, PUR.
 *
 * ⛔ AUCUN montant, taux ni remise par défaut dans ce fichier : tout vient de la
 * saisie. Les seules constantes sont des DURÉES ou des énumérations.
 * Aucune unité d'IA ni prix fournisseur : le mode d'IA est un choix, pas un tarif.
 */
import { z } from "zod";

import { TAUX_TVA_STANDARD } from "../legal/tva";
import { verifierDependances } from "./dependances";

/** Durée de garantie proposée à la saisie (jours). Une durée, pas un prix. */
export const GARANTIE_JOURS_PAR_DEFAUT = 30;

export const FORMULES = ["achat", "abonnement"] as const;
export type Formule = (typeof FORMULES)[number];

const cents = z.number().int().min(0);
/** Points de base : 10000 = 100 %. Pas de maximum = remise > 100 % = prix négatif. */
const BPS_MAX = 10000;
const bps = z.number().int().min(0).max(BPS_MAX);
/**
 * Taux de TVA (bps) : la TVA est TOUJOURS facturée (ordre permanent, ADR 0050).
 * Plancher = le taux standard EXISTANT (`TAUX_TVA_STANDARD`, en %) converti en bps ;
 * aucune valeur inventée ici. Un taux supérieur reste accepté (cf. `clampTauxLigneCreation`).
 */
const tauxTva = z
  .number()
  .int()
  .min(TAUX_TVA_STANDARD * 100)
  .max(BPS_MAX);
const texte = z.string().trim().min(1);

const ligne = z
  .object({
    libelle: texte,
    quantite: z.number().positive(),
    prixHtCents: cents,
    tauxTvaBps: tauxTva,
  })
  .strict();
export type LigneOffre = z.infer<typeof ligne>;

const phase = z
  .object({
    rang: z.number().int().min(1),
    libelle: texte,
    pourcentage: z.number().int().min(1).max(100),
    declencheur: z.enum(["signature", "avancement", "livraison"]),
    delaiJours: z.number().int().min(0).optional(),
    dateEstimee: z.string().optional(),
  })
  .strict();
export type PhaseOffre = z.infer<typeof phase>;

const phases = z
  .array(phase)
  .min(1)
  .superRefine((p, ctx) => {
    if (p.reduce((s, x) => s + x.pourcentage, 0) !== 100) {
      ctx.addIssue({ code: "custom", message: "La somme des pourcentages doit valoir 100." });
    }
    if (new Set(p.map((x) => x.rang)).size !== p.length) {
      ctx.addIssue({ code: "custom", message: "Les rangs de phases doivent être distincts." });
    }
  });

const modeIA = z.enum(["client_direct", "via_axion_forfait", "incluse"]);

const automatisation = z
  .object({
    code: texte,
    libelle: texte,
    facultative: z.boolean(),
    dependDe: z.array(z.string()),
    prixHtCents: cents,
    tauxTvaBps: tauxTva,
    palier: z.string().optional(),
    modeIA,
    moisIAInclus: z.number().int().min(1).optional(),
    modeIAApres: z.enum(["client_direct", "via_axion_forfait"]).optional(),
  })
  .strict()
  .superRefine((a, ctx) => {
    if (a.modeIA === "incluse" && (a.moisIAInclus === undefined || a.modeIAApres === undefined)) {
      ctx.addIssue({ code: "custom", message: "IA incluse : moisIAInclus et modeIAApres requis." });
    }
  });

const MOIS_PERIODE = [1, 2, 6, 12] as const;
const moisPeriode = z.union([z.literal(1), z.literal(2), z.literal(6), z.literal(12)]);

const achat = z
  .object({
    lignes: z.array(ligne),
    phases,
    hebergement: z.enum(["client", "axion"]),
    hebergementMensuelHtCents: cents.optional(),
    maintenance: z
      .object({
        regle: z.enum(["obligatoire", "facultative"]),
        moisOfferts: z.number().int().min(0),
        mensuelHtCents: cents,
        periodesMois: z.array(moisPeriode).min(1),
      })
      .strict(),
  })
  .strict()
  .superRefine((a, ctx) => {
    if (a.hebergement === "axion" && a.hebergementMensuelHtCents === undefined) {
      ctx.addIssue({
        code: "custom",
        message: "Hébergement Axion : mensuel requis (ligne séparée).",
      });
    }
  });

const abonnement = z
  .object({
    miseEnServiceLignes: z.array(ligne),
    phases,
    mensuelCatalogueHtCents: cents,
    tauxTvaBps: tauxTva,
    terme: z.enum(["a_echoir", "echu"]),
    modeAvance: z
      .enum(["premiere_periode_seulement", "toutes_periodes"])
      .default("premiere_periode_seulement"),
    periodes: z
      .array(z.object({ mois: moisPeriode, remiseBps: bps }).strict())
      .min(1)
      .max(4),
    engagementMois: z.union([
      z.literal(0),
      z.literal(3),
      z.literal(6),
      z.literal(12),
      z.literal(24),
    ]),
    reconduction: z.enum(["mensuelle", "annuelle", "aucune"]),
    preavisMois: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    /** Fourni par la saisie : aucune valeur par défaut dans le code. */
    indemniteSortieTauxBps: bps,
  })
  .strict()
  .superRefine((a, ctx) => {
    const mois = a.periodes.map((p) => p.mois);
    if (new Set(mois).size !== mois.length) {
      ctx.addIssue({ code: "custom", message: "Les périodes doivent avoir des mois distincts." });
    }
  });

const serviceTiers = z
  .object({
    nom: texte,
    obligatoire: z.boolean(),
    estimationHtCents: cents.nullable(),
    rythme: z.enum(["ponctuel", "mensuel", "annuel"]),
  })
  .strict();

export const offreDevisV1 = z
  .object({
    v: z.literal(1),
    /** Offre réservée aux clients professionnels. */
    client: z.literal("professionnel"),
    formulesProposees: z.array(z.enum(FORMULES)).min(1).max(2),
    automatisations: z.array(automatisation),
    achat: achat.optional(),
    abonnement: abonnement.optional(),
    /** HORS totaux. */
    servicesTiers: z.array(serviceTiers),
    plafondAConfirmer: z.object({ montantHtCents: cents, texte }).strict().nullable(),
    garantie: z.object({ jours: z.number().int().min(0).nullable() }).strict(),
    textes: z.array(
      z
        .object({
          bibliothequeId: z.string().optional(),
          version: z.string().optional(),
          texte: z.string(),
          actif: z.boolean(),
        })
        .strict(),
    ),
  })
  .strict()
  .superRefine((o, ctx) => {
    if (new Set(o.formulesProposees).size !== o.formulesProposees.length) {
      ctx.addIssue({ code: "custom", message: "Formules en double." });
    }
    if (o.formulesProposees.includes("abonnement") && !o.abonnement) {
      ctx.addIssue({
        code: "custom",
        path: ["abonnement"],
        message: "Formule B : abonnement requis.",
      });
    }
    if (o.formulesProposees.includes("achat") && !o.achat) {
      ctx.addIssue({
        code: "custom",
        path: ["achat"],
        message: "Formule A : achat (et règle de maintenance) requis.",
      });
    }
    // Plusieurs phases ET plusieurs taux de TVA : la TVA par palier ne se répartirait
    // plus exactement (même règle que `echeancierPhases`, refusée ici dès la saisie).
    // Les automatisations comptent toutes : leur sélection n'est connue qu'au choix.
    const tauxAutos = o.automatisations.map((a) => a.tauxTvaBps);
    const blocs = [
      { cle: "achat" as const, phases: o.achat?.phases, lignes: o.achat?.lignes },
      {
        cle: "abonnement" as const,
        phases: o.abonnement?.phases,
        lignes: o.abonnement?.miseEnServiceLignes,
      },
    ];
    for (const b of blocs) {
      if (!b.phases || !b.lignes || b.phases.length < 2) continue;
      const taux = new Set([...b.lignes.map((l) => l.tauxTvaBps), ...tauxAutos]);
      if (taux.size > 1) {
        ctx.addIssue({
          code: "custom",
          path: [b.cle, "phases"],
          message: "Plusieurs phases avec plusieurs taux de TVA : refusé.",
        });
      }
    }
    const dep = verifierDependances(o.automatisations);
    if (!dep.ok) {
      ctx.addIssue({
        code: "custom",
        path: ["automatisations"],
        message: `Dépendances invalides (${dep.motif} : ${dep.chemin?.join(" → ") ?? dep.code}).`,
      });
    }
  });

export type OffreDevisV1 = z.infer<typeof offreDevisV1>;
export const PERIODES_MOIS_AUTORISEES: readonly number[] = MOIS_PERIODE;
