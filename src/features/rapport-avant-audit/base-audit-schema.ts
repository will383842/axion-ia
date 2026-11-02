/**
 * Contrat de la BASE D'AUDIT (livrable B) — 2026-11-02. Version `base-audit/1`.
 *
 * C'est la source de vérité du rapport : le PDF client en est un filtre, et la génération de
 * l'audit du jour J la lira sans refaire la recherche. Générique : aucune section ni aucun champ
 * propre à un client ou à un secteur ; le secteur se déclare dans `equipe_analyse` et dans les
 * éléments eux-mêmes.
 *
 * Règles que le schéma fait respecter (et qu'un test verrouille) :
 *   1. les BESOINS DÉCLARÉS passent en premier : douleurs, souhaits, objectifs, contraintes ;
 *   2. chaque piste sert au moins un besoin déclaré qui existe — sinon elle est « hors demande »,
 *      sans rang de priorité ;
 *   3. chaque affirmation porte au moins une source et un niveau de confiance ;
 *   4. l'annexe rend TOUTES les réponses reçues, mot pour mot, vides comprises ;
 *   5. aucun mot interdit (voir `mots-interdits.ts`) — vérifié par l'appelant sur le texte rendu.
 */

import { z } from "zod";

import { lireTendance } from "./tendance";

export const VERSION_BASE_AUDIT = "base-audit/1";

export const CONFIANCES = ["etabli", "probable", "hypothese"] as const;
export const NIVEAUX = ["faible", "moyen", "fort"] as const;

const Texte = z.string().trim().min(1);

export const SourceSchema = z.object({
  type: z.enum(["questionnaire", "registre", "web"]),
  /** Libellé lisible : « Réponse du dirigeant, question X », « Annuaire des entreprises », titre de page. */
  reference: Texte,
  url: z.string().url().optional(),
  /** Pour une source « questionnaire » : qui l'a dit (parcours et service), jamais un code. */
  personne: z.string().optional(),
  consulteLe: z.string().optional(),
});
export type Source = z.infer<typeof SourceSchema>;

/**
 * D'où vient une information — la distinction que le rapport ne doit jamais brouiller :
 *   · `declare` : le client l'a dit (réponse au questionnaire) ;
 *   · `trouve`  : nous l'avons trouvée (registre officiel, web), il ne l'a pas dite ;
 *   · `croise`  : les deux existent (ils concordent, ou se contredisent : voir `contradictions`).
 */
export const PROVENANCES = ["declare", "trouve", "croise"] as const;

export const ElementSchema = z
  .object({
    libelle: Texte,
    valeur: Texte,
    provenance: z.enum(PROVENANCES),
    confiance: z.enum(CONFIANCES),
    sources: z.array(SourceSchema).min(1),
  })
  .superRefine((e, ctx) => {
    const duClient = e.sources.filter((s) => s.type === "questionnaire").length;
    const denotre = e.sources.length - duClient;
    const attendu = duClient > 0 && denotre > 0 ? "croise" : duClient > 0 ? "declare" : "trouve";
    if (e.provenance !== attendu) {
      ctx.addIssue({
        code: "custom",
        path: ["provenance"],
        message: `La provenance « ${e.provenance} » ne correspond pas aux sources (attendu : « ${attendu} »).`,
      });
    }
  });
export type Element = z.infer<typeof ElementSchema>;

const SectionSchema = z.object({
  /** Synthèse de la section, en quelques phrases. */
  resume: z.string(),
  elements: z.array(ElementSchema),
});

export const BesoinSchema = z.object({
  /** Identifiant stable cité par les pistes (« B1 », « B2 »…). */
  id: z.string().regex(/^B\d+$/),
  categorie: z.enum(["douleur", "souhait", "objectif", "contrainte", "priorite"]),
  enonce: Texte,
  /** Les mots exacts des personnes. */
  citations: z
    .array(
      z.object({
        texte: Texte,
        /** « Dirigeant », « Collaborateur — service Atelier », « Référent informatique ». */
        auteur: Texte,
      }),
    )
    .min(1),
  nbPersonnes: z.number().int().min(1),
  intensite: z.enum(NIVEAUX),
  /** Désaccord entre la direction et les équipes sur ce point, s'il y en a un. */
  divergence: z.string().optional(),
});
export type Besoin = z.infer<typeof BesoinSchema>;

export const PisteSchema = z
  .object({
    id: z.string().regex(/^P\d+$/),
    titre: Texte,
    description: Texte,
    /** Besoins déclarés auxquels la piste répond (ids `B…`). */
    besoinsServis: z.array(z.string().regex(/^B\d+$/)),
    /** Vrai : idée de l'équipe d'analyse qui ne répond à aucun besoin déclaré. */
    horsDemande: z.boolean(),
    gain: z.enum(NIVEAUX),
    effort: z.enum(NIVEAUX),
    /** 1 = d'abord. Interdit pour une piste hors demande. */
    rang: z.number().int().min(1).nullable(),
    sources: z.array(SourceSchema),
  })
  .superRefine((p, ctx) => {
    if (!p.horsDemande && p.besoinsServis.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["besoinsServis"],
        message:
          "Une piste doit répondre à au moins un besoin déclaré, sinon elle est « hors demande ».",
      });
    }
    if (p.horsDemande && p.rang !== null) {
      ctx.addIssue({
        code: "custom",
        path: ["rang"],
        message: "Une piste hors demande n'a pas de rang de priorité.",
      });
    }
    if (!p.horsDemande && p.rang === null) {
      ctx.addIssue({ code: "custom", path: ["rang"], message: "Une piste retenue a un rang." });
    }
  });
export type Piste = z.infer<typeof PisteSchema>;

const EtatPrefillSchema = z.enum(["confirme", "modifie", "non_verifie", "vide"]);

export const AnnexePersonneSchema = z.object({
  /** `main`, `it` ou `emp:…abcd` — jamais un code complet. */
  personne: z.string(),
  mode: z.enum(["main", "emp", "it"]),
  service: z.string().nullable(),
  statut: z.enum(["recue", "illisible", "ecartee"]),
  versionsRecues: z.number().int().min(0),
  recuLe: z.string(),
  aVerifier: z.boolean(),
  reponses: z.array(
    z.object({
      cle: z.string(),
      question: z.string(),
      rubrique: z.string().nullable(),
      reponse: z.string(),
      prefill: EtatPrefillSchema.optional(),
    }),
  ),
  /** Questions du parcours restées vides : on les garde, elles font partie de l'information. */
  nonRepondues: z.array(
    z.object({
      cle: z.string(),
      question: z.string(),
      rubrique: z.string().nullable(),
      essentielle: z.boolean(),
    }),
  ),
});
export type AnnexePersonne = z.infer<typeof AnnexePersonneSchema>;

export const SECTIONS_ANALYSE = [
  "identite",
  "activite_offre",
  "organisation_equipe",
  "processus",
  "outils_systeme_information",
  "donnees",
  "commercial_clients",
  "finances",
  "marche_concurrence",
  "presence_numerique",
  "reputation",
  "reglementaire",
  "maturite_ia",
] as const;

const sectionsShape = Object.fromEntries(SECTIONS_ANALYSE.map((k) => [k, SectionSchema])) as Record<
  (typeof SECTIONS_ANALYSE)[number],
  typeof SectionSchema
>;

export const ExerciceSchema = z.object({
  annee: z.number().int().min(1900).max(2100),
  chiffreAffairesEur: z.number().nullable(),
  resultatNetEur: z.number().nullable(),
  effectif: z.string().nullable(),
  confiance: z.enum(CONFIANCES),
  sources: z.array(SourceSchema).min(1),
});
export type Exercice = z.infer<typeof ExerciceSchema>;

export const BaseAuditSchema = z
  .object({
    version: z.literal(VERSION_BASE_AUDIT),
    meta: z.object({
      clientId: z.string().uuid(),
      raisonSociale: Texte,
      generePar: z.string(),
      genereLe: z.string(),
      questionnaires: z.array(z.string()),
      /** Faux : le rapport s'est arrêté avant la fin (crédits épuisés, panne) ; voir `limites`. */
      complet: z.boolean(),
      limites: z.array(z.string()),
      /**
       * Qui a rempli la partie « direction » du questionnaire. Si ce n'est pas un dirigeant, ses
       * réponses sur le budget, la vision et les priorités sont celles d'un salarié.
       */
      reponseDirection: z.object({
        fournieParUnDirigeant: z.enum(["oui", "non", "inconnu"]),
        /** Fonction déclarée du répondant (« Styliste modéliste »). */
        repondant: Texte,
        remarque: z.string(),
      }),
    }),
    /** EN PREMIER : ce que le client a dit vouloir et subir. */
    besoins_declares: z.array(BesoinSchema),
    /** Les spécialistes composés pour CE client, avec leur modèle. */
    equipe_analyse: z.array(
      z.object({
        role: Texte,
        mission: Texte,
        modele: z.string(),
        questionsDeRecherche: z.array(z.string()),
      }),
    ),
    ...sectionsShape,
    /** Évolution de l'activité : chiffres relevés (avec sources) ; la tendance est CALCULÉE (tendance.ts). */
    evolution_financiere: z.object({
      exercices: z.array(ExerciceSchema),
      tendance: z.enum(["croissance", "stabilite", "decroissance", "indeterminee"]),
      tauxAnnuelMoyenPct: z.number().nullable(),
      lecture: z.string(),
      limites: z.array(z.string()),
    }),
    pistes: z.array(PisteSchema),
    contradictions: z.array(
      z.object({
        sujet: Texte,
        versionA: Texte,
        versionB: Texte,
        sources: z.array(SourceSchema).min(1),
      }),
    ),
    questions_jour_j: z.array(
      z.object({
        question: Texte,
        pourquoi: Texte,
        besoinId: z
          .string()
          .regex(/^B\d+$/)
          .optional(),
      }),
    ),
    propositions_fiche: z.array(
      z.object({
        champ: Texte,
        valeur: Texte,
        confiance: z.enum(CONFIANCES),
        sources: z.array(SourceSchema).min(1),
        /** `auto` : champ vide + source sûre. `a_cocher` : Will décide. */
        application: z.enum(["auto", "a_cocher"]),
      }),
    ),
    couverture: z.object({
      personnesAvecReponse: z.number().int().min(0),
      reponsesDonnees: z.number().int().min(0),
      questionsSansReponse: z.number().int().min(0),
      personnesAttenduesSansReponse: z.array(z.string()),
      alertes: z.array(
        z.object({ niveau: z.enum(["info", "attention", "rouge"]), texte: z.string() }),
      ),
    }),
    /** Toutes les réponses, intégralement. */
    annexe_reponses: z.array(AnnexePersonneSchema),
    sources: z.array(SourceSchema),
  })
  .superRefine((b, ctx) => {
    // La direction n'a pas (ou pas sûrement) parlé : il faut lui poser la question le jour J.
    if (
      b.meta.reponseDirection.fournieParUnDirigeant !== "oui" &&
      b.questions_jour_j.length === 0
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["questions_jour_j"],
        message:
          "La partie « direction » n'a pas été remplie par un dirigeant : au moins une question pour la direction est obligatoire.",
      });
    }
    // Le chiffre et la tendance doivent concorder : on recalcule avec le même code.
    const ev = b.evolution_financiere;
    const lue = lireTendance(
      ev.exercices.map((e) => ({ annee: e.annee, chiffreAffairesEur: e.chiffreAffairesEur })),
      new Date(b.meta.genereLe).getUTCFullYear(),
    );
    if (ev.tendance !== lue.tendance || ev.tauxAnnuelMoyenPct !== lue.tauxAnnuelMoyenPct) {
      ctx.addIssue({
        code: "custom",
        path: ["evolution_financiere", "tendance"],
        message: `La tendance annoncée ne correspond pas aux chiffres (calculée : ${lue.tendance}, ${String(lue.tauxAnnuelMoyenPct)} %).`,
      });
    }
    // Les chiffres sont TROUVÉS (registre, comptes publiés, web), jamais repris d'une réponse du client.
    ev.exercices.forEach((x, i) => {
      if (!x.sources.some((s) => s.type !== "questionnaire")) {
        ctx.addIssue({
          code: "custom",
          path: ["evolution_financiere", "exercices", i, "sources"],
          message: `L'exercice ${x.annee} n'a aucune source web ou registre : le chiffre d'affaires doit être trouvé, pas déclaré.`,
        });
      }
    });
    const annees = ev.exercices.map((e) => e.annee);
    if (new Set(annees).size !== annees.length) {
      ctx.addIssue({
        code: "custom",
        path: ["evolution_financiere", "exercices"],
        message: "Deux exercices portent la même année.",
      });
    }
    const ids = new Set(b.besoins_declares.map((x) => x.id));
    if (ids.size !== b.besoins_declares.length) {
      ctx.addIssue({
        code: "custom",
        path: ["besoins_declares"],
        message: "Identifiants de besoin en double.",
      });
    }
    b.pistes.forEach((p, i) => {
      for (const id of p.besoinsServis) {
        if (!ids.has(id)) {
          ctx.addIssue({
            code: "custom",
            path: ["pistes", i, "besoinsServis"],
            message: `La piste ${p.id} cite le besoin ${id}, qui n'existe pas.`,
          });
        }
      }
    });
    b.questions_jour_j.forEach((q, i) => {
      if (q.besoinId !== undefined && !ids.has(q.besoinId)) {
        ctx.addIssue({
          code: "custom",
          path: ["questions_jour_j", i, "besoinId"],
          message: `Le besoin ${q.besoinId} n'existe pas.`,
        });
      }
    });
  });
export type BaseAudit = z.infer<typeof BaseAuditSchema>;
