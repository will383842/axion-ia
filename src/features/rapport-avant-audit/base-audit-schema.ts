/**
 * Contrat de la BASE D'AUDIT (livrable B) — 2026-11-02. Versions `base-audit/1` et `base-audit/2`.
 *
 * C'est la source de vérité du rapport : les trois documents HTML INTERNES (synthèse, fiche des
 * automatisations, schéma des dépendances) en sont des vues, et la génération de l'audit du
 * jour J la lira sans refaire la recherche. Plus aucun document ne part chez le client.
 *
 * La version 2 ajoute DEUX champs optionnels (`contexte_interne`, `automatisations`) ; aucun
 * champ de la version 1 n'est devenu obligatoire, donc les bases `base-audit/1` déjà scellées
 * continuent de s'ouvrir. Le contrat ne contrôle NI le catalogue d'automatisations NI
 * l'exactitude des citations : c'est le travail du moteur, pas du schéma. Générique : aucune section ni aucun champ
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
export const VERSION_BASE_AUDIT_2 = "base-audit/2";
export const VERSIONS_BASE_AUDIT = [VERSION_BASE_AUDIT, VERSION_BASE_AUDIT_2] as const;

export const CONFIANCES = ["etabli", "probable", "hypothese"] as const;
export const NIVEAUX = ["faible", "moyen", "fort"] as const;

const Texte = z.string().trim().min(1);
const IdBesoin = z.string().regex(/^B\d+$/);

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

/**
 * Fiche d'UNE personne (interne : elle sert à l'audit que l'on mène avec elle). Chaque demande,
 * douleur ou réserve porte la citation exacte de la personne. Une personne qui n'a pas répondu a
 * quand même une fiche : vide, avec les questions à lui poser sur place.
 */
export const FichePersonneSchema = z
  .object({
    /** Clé de la personne dans l'annexe, ou `attendu:<nom>` si elle n'a pas répondu. */
    personne: Texte,
    identite: z.object({
      nom: z.string().nullable(),
      fonction: z.string().nullable(),
      service: z.string().nullable(),
    }),
    statut: z.enum(["a_repondu", "n_a_pas_repondu"]),
    /** Ce qu'elle demande ou attend. */
    demandes: z.array(z.object({ enonce: Texte, citation: Texte, besoinId: IdBesoin.optional() })),
    /** Ce qui lui fait perdre du temps ou lui pèse. */
    douleurs: z.array(
      z.object({
        enonce: Texte,
        citation: Texte,
        tempsParSemaine: z.string().nullable(),
        besoinId: IdBesoin.optional(),
      }),
    ),
    taches: z.array(
      z.object({
        libelle: Texte,
        frequence: z.string().nullable(),
        duree: z.string().nullable(),
        repetitive: z.boolean().nullable(),
        ressaisie: z.boolean().nullable(),
        outil: z.string().nullable(),
      }),
    ),
    outils: z.array(z.string()),
    /** Ce qu'elle dit ne pas pouvoir ou ne pas vouloir changer. */
    reserves: z.array(z.object({ enonce: Texte, citation: Texte })),
    /** Questions à lui poser sur place. */
    aVerifierSurPlace: z.array(z.object({ question: Texte, pourquoi: Texte })),
  })
  .superRefine((f, ctx) => {
    if (f.statut === "n_a_pas_repondu") {
      if (f.demandes.length + f.douleurs.length + f.taches.length + f.reserves.length > 0) {
        ctx.addIssue({
          code: "custom",
          path: ["statut"],
          message:
            "Une personne qui n'a pas répondu n'a ni demande, ni douleur, ni tâche : on n'invente rien.",
        });
      }
      if (f.aVerifierSurPlace.length === 0) {
        ctx.addIssue({
          code: "custom",
          path: ["aVerifierSurPlace"],
          message:
            "Une personne qui n'a pas répondu a au moins une question à lui poser sur place.",
        });
      }
    }
  });
export type FichePersonne = z.infer<typeof FichePersonneSchema>;

// ── Version 2 : contexte interne et automatisations ─────────────────────────────────────────────

const IdAutomatisation = z.string().regex(/^A\d+$/);

/** Les mots exacts d'une personne. `personne` : clé de l'annexe, ou `attendu:<nom>`. */
export const CitationSchema = z.object({
  texte: Texte,
  personne: Texte,
  auteur: Texte,
});
export type Citation = z.infer<typeof CitationSchema>;

/** Un temps perdu tel que la personne l'a déclaré (jamais un temps estimé par nous). */
export const TempsDeclareSchema = z.object({
  libelle: Texte,
  citation: Texte,
  occurrences: z.number().positive().nullable(),
  periode: z.enum(["jour", "semaine", "mois"]).nullable(),
  minutesMin: z.number().nonnegative().nullable(),
  minutesMax: z.number().nonnegative().nullable(),
});
export type TempsDeclare = z.infer<typeof TempsDeclareSchema>;

export const GROUPES_AUTOMATISATION = ["sans_prerequis", "base_unique", "a_etudier"] as const;
export const IMPORTANCES = ["haute", "moyenne_haute", "moyenne", "faible"] as const;

const QuestionsParTheme = z.array(z.object({ theme: Texte, questions: z.array(Texte) }));

export const AutomatisationSchema = z.object({
  id: IdAutomatisation,
  titre: Texte,
  source: z.enum(["catalogue", "sur_mesure"]),
  catalogueId: z.string().min(1).nullable(),
  /** Vrai : c'est la base commune dont d'autres automatisations dépendent. */
  estSocle: z.boolean(),
  groupe: z.enum(GROUPES_AUTOMATISATION),
  dependDe: z.array(IdAutomatisation),
  besoinsServis: z.array(IdBesoin),
  horsDemande: z.boolean(),
  /** Le client l'a cité lui-même comme une priorité. */
  citeCommePriorite: z.boolean(),
  importance: z.enum(IMPORTANCES),
  /** 1 = la plus importante ; suite 1..n sans trou sur toute la liste. */
  rangImportance: z.number().int().min(1),
  ordreMiseEnPlace: z.number().int().min(1),
  ceQuElleFait: Texte,
  utilite: Texte,
  douleurs: z.array(CitationSchema),
  temps: z.array(TempsDeclareSchema),
  dependanceExpliquee: z.string(),
  questions: QuestionsParTheme,
  vente: z.enum(["unique", "abonnement", "a_definir"]),
  venteRaison: z.string(),
  jetonsIA: z.enum(["aucun", "peu", "moyen", "eleve"]),
  tableauDeBord: z.object({ titre: Texte, indicateurs: z.array(Texte) }).nullable(),
  /** Jamais de prix dans la base : Will le fixe. */
  prix: z.object({ etat: z.literal("a_fixer_par_will") }),
});
export type Automatisation = z.infer<typeof AutomatisationSchema>;

export const AutomatisationsSchema = z.object({
  liste: z.array(AutomatisationSchema),
  formules: z.array(
    z.object({ nom: Texte, ids: z.array(IdAutomatisation).min(1), remarque: z.string() }),
  ),
  questionsCommunes: QuestionsParTheme,
});
export type Automatisations = z.infer<typeof AutomatisationsSchema>;

const RubriqueInterneSchema = z.object({
  /** `non_repondu` (aucune réponse) et `ne_sait_pas` (réponse « je ne sais pas ») ne sont PAS un « non ». */
  etat: z.enum(["declare", "ne_sait_pas", "non_repondu"]),
  elements: z.array(z.object({ enonce: Texte, citations: z.array(CitationSchema) })),
});
export type RubriqueInterne = z.infer<typeof RubriqueInterneSchema>;

export const ContexteInterneSchema = z
  .object({
    freins: RubriqueInterneSchema,
    attentes: RubriqueInterneSchema,
    budget: RubriqueInterneSchema,
    formation: RubriqueInterneSchema,
  })
  .superRefine((c, ctx) => {
    const nb = c.budget.elements.reduce((n, e) => n + e.citations.length, 0);
    if (c.budget.etat === "declare" && nb === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["budget"],
        message: "Un budget « déclaré » porte au moins une citation.",
      });
    }
  });
export type ContexteInterne = z.infer<typeof ContexteInterneSchema>;

/** Règles de cohérence d'une liste d'automatisations (ids, dépendances, rangs, besoins, groupes). */
function verifierAutomatisations(
  a: Automatisations,
  idsBesoins: ReadonlySet<string>,
  ctx: z.RefinementCtx,
): void {
  const mal = (path: Array<string | number>, message: string) =>
    ctx.addIssue({ code: "custom", path: ["automatisations", ...path], message });
  const liste = a.liste;
  const ids = liste.map((x) => x.id);
  if (new Set(ids).size !== ids.length) mal(["liste"], "Identifiants d'automatisation en double.");
  const parId = new Map(liste.map((x) => [x.id, x]));

  liste.forEach((x, i) => {
    for (const d of x.dependDe) {
      if (!parId.has(d)) {
        mal(["liste", i, "dependDe"], `${x.id} dépend de ${d}, qui n'existe pas.`);
      } else if (d === x.id) {
        mal(["liste", i, "dependDe"], `${x.id} dépend d'elle-même.`);
      } else if ((parId.get(d)?.ordreMiseEnPlace ?? 0) >= x.ordreMiseEnPlace) {
        mal(
          ["liste", i, "ordreMiseEnPlace"],
          `${d} doit être mise en place avant ${x.id}, dont elle est un prérequis.`,
        );
      }
    }
    for (const b of x.besoinsServis) {
      if (!idsBesoins.has(b))
        mal(["liste", i, "besoinsServis"], `${x.id} cite le besoin ${b}, qui n'existe pas.`);
    }
    if ((x.source === "catalogue") !== (x.catalogueId !== null)) {
      mal(
        ["liste", i, "catalogueId"],
        `${x.id} : un identifiant de catalogue si et seulement si la source est « catalogue ».`,
      );
    }
    if (!x.horsDemande) {
      if (x.douleurs.length === 0) {
        mal(
          ["liste", i, "douleurs"],
          `${x.id} n'est pas « hors demande » : elle cite au moins une douleur.`,
        );
      }
      if (!x.besoinsServis.some((b) => idsBesoins.has(b))) {
        mal(
          ["liste", i, "besoinsServis"],
          `${x.id} n'est pas « hors demande » : elle sert au moins un besoin déclaré.`,
        );
      }
    }
  });

  // Rangs d'importance : exactement la suite 1..n.
  const rangs = liste.map((x) => x.rangImportance).sort((p, q) => p - q);
  if (rangs.some((r, i) => r !== i + 1)) {
    mal(["liste"], "Les rangs d'importance doivent former la suite 1..n, sans trou ni doublon.");
  }

  // Pas de boucle de dépendances.
  const etat = new Map<string, 1 | 2>();
  let boucle = false;
  const visiter = (id: string): void => {
    if (etat.get(id) === 2 || boucle) return;
    if (etat.get(id) === 1) {
      boucle = true;
      return;
    }
    etat.set(id, 1);
    for (const d of parId.get(id)?.dependDe ?? []) if (parId.has(d)) visiter(d);
    etat.set(id, 2);
  };
  for (const id of parId.keys()) visiter(id);
  if (boucle) mal(["liste"], "Les dépendances forment une boucle.");

  // « base unique » : c'est le socle, ou une automatisation qui en dépend (directement ou non).
  const dependDuSocle = (id: string, vus: Set<string>): boolean => {
    if (vus.has(id)) return false;
    vus.add(id);
    return (parId.get(id)?.dependDe ?? []).some(
      (d) => parId.get(d)?.estSocle === true || dependDuSocle(d, vus),
    );
  };
  liste.forEach((x, i) => {
    if (x.groupe === "base_unique" && !x.estSocle && !dependDuSocle(x.id, new Set())) {
      mal(
        ["liste", i, "groupe"],
        `${x.id} est dans « base unique » : elle est le socle ou en dépend.`,
      );
    }
  });

  a.formules.forEach((f, i) => {
    for (const id of f.ids) {
      if (!parId.has(id))
        mal(["formules", i, "ids"], `La formule « ${f.nom} » cite ${id}, qui n'existe pas.`);
    }
  });
}

export const BaseAuditSchema = z
  .object({
    version: z.enum(VERSIONS_BASE_AUDIT),
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
    /** Une fiche par personne (a répondu ou non), pour l'audit mené avec elle. */
    fiches_personnes: z.array(FichePersonneSchema),
    /** Toutes les réponses, intégralement. */
    annexe_reponses: z.array(AnnexePersonneSchema),
    sources: z.array(SourceSchema),
    /** Version 2. Freins, attentes, budget et formation, avec les mots des personnes. */
    contexte_interne: ContexteInterneSchema.optional().nullable(),
    /** Version 2. `null` : l'étape a échoué (une limite le dit dans `meta.limites`). */
    automatisations: AutomatisationsSchema.optional().nullable(),
  })
  .superRefine((b, ctx) => {
    if (b.version === VERSION_BASE_AUDIT_2) {
      if (b.contexte_interne === undefined || b.contexte_interne === null) {
        ctx.addIssue({
          code: "custom",
          path: ["contexte_interne"],
          message: "Une base « base-audit/2 » porte le contexte interne.",
        });
      }
      if (b.automatisations === undefined) {
        ctx.addIssue({
          code: "custom",
          path: ["automatisations"],
          message:
            "Une base « base-audit/2 » porte les automatisations (ou null si l'étape a échoué).",
        });
      } else if (b.automatisations === null && b.meta.limites.length === 0) {
        ctx.addIssue({
          code: "custom",
          path: ["meta", "limites"],
          message:
            "Des automatisations à null (étape échouée) exigent au moins une limite qui le dit.",
        });
      }
    }
    if (b.automatisations !== undefined && b.automatisations !== null) {
      verifierAutomatisations(b.automatisations, new Set(b.besoins_declares.map((x) => x.id)), ctx);
    }
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
    // Une fiche par personne qui a répondu, et pas deux fiches pour la même clé.
    const clesFiches = b.fiches_personnes.map((f) => f.personne);
    if (new Set(clesFiches).size !== clesFiches.length) {
      ctx.addIssue({
        code: "custom",
        path: ["fiches_personnes"],
        message: "Deux fiches portent la même personne.",
      });
    }
    for (const a of b.annexe_reponses) {
      if (
        a.statut === "recue" &&
        !b.fiches_personnes.some((f) => f.personne === a.personne && f.statut === "a_repondu")
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["fiches_personnes"],
          message: `La personne ${a.personne} a répondu mais n'a pas de fiche.`,
        });
      }
    }
    b.fiches_personnes.forEach((f, i) => {
      for (const x of [...f.demandes, ...f.douleurs]) {
        if (x.besoinId !== undefined && !ids.has(x.besoinId)) {
          ctx.addIssue({
            code: "custom",
            path: ["fiches_personnes", i],
            message: `La fiche ${f.personne} cite le besoin ${x.besoinId}, qui n'existe pas.`,
          });
        }
      }
    });
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
