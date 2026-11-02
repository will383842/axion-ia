/**
 * Chaîne d'exécution du rapport avant audit (2026-11-02) — le moteur, indépendant de la base et de
 * l'interface.
 *
 * Étapes : besoins déclarés → chef d'orchestre (compose l'équipe) → spécialistes en parallèle →
 * analyste croisé → critique → rédacteur → ASSEMBLAGE PAR LE CODE → validation du contrat.
 *
 * Ce qui est fait par le CODE et jamais par l'IA : l'annexe intégrale des réponses (copiée de la
 * collecte), la couverture, la tendance du chiffre d'affaires (`tendance.ts`), le contrôle du
 * contrat (`base-audit-schema.ts`). L'IA ne fournit que des morceaux validés un à un.
 *
 * Le fournisseur d'IA est INJECTÉ : le bouton de la console y branche l'API Anthropic, l'analyse
 * faite à la main y branche la session, les tests y branchent un faux. Aucun appel réseau ici.
 *
 * Un spécialiste qui échoue n'arrête pas le rapport : il est noté dans les limites et le rapport
 * est marqué incomplet. Une base qui ne respecte pas le contrat n'est JAMAIS rendue.
 */

import { z } from "zod";

import type { CollecteReponses, PersonneCollectee } from "./collecte";
import {
  AnnexePersonneSchema,
  BaseAuditSchema,
  BesoinSchema,
  ElementSchema,
  ExerciceSchema,
  PisteSchema,
  SECTIONS_ANALYSE,
  VERSION_BASE_AUDIT,
  type AnnexePersonne,
  type BaseAudit,
  type Exercice,
} from "./base-audit-schema";
import {
  consigneAnalyste,
  consigneBesoins,
  consigneChef,
  consigneCritique,
  consigneRedacteur,
  consigneSpecialiste,
  type Consigne,
} from "./consignes/prompts";
import { ROLES, ROLES_DE_SYNTHESE } from "./consignes/roles";
import { exigerModeleAutorise, MODELES_RAPPORT } from "./modeles";
import { lireTendance } from "./tendance";

// ── Fournisseur d'IA (injecté) ──────────────────────────────────────────────

export interface AppelIA extends Consigne {
  readonly modele: string;
  /** Autorise la recherche web pour cet appel. */
  readonly recherche: boolean;
}

export interface ReponseIA {
  readonly texte: string;
  readonly jetonsEntree: number;
  readonly jetonsSortie: number;
  readonly nbRecherches: number;
}

export type FournisseurIA = (appel: AppelIA) => Promise<ReponseIA>;

export interface Progression {
  readonly etape: string;
  readonly fait: number;
  readonly total: number;
}

export interface OptionsRapport {
  readonly clientId: string;
  readonly raisonSociale: string;
  readonly genereLe: Date;
  readonly genereePar: string;
  readonly fournisseur: FournisseurIA;
  /** Personnes de l'équipe déclarée qui n'ont pas répondu (venues du suivi par personne). */
  readonly attenduesSansReponse?: ReadonlyArray<string>;
  readonly surProgression?: (p: Progression) => void;
}

export interface ResultatRapport {
  readonly base: BaseAudit;
  readonly jetonsEntree: number;
  readonly jetonsSortie: number;
  readonly nbRecherches: number;
}

export class ErreurRapport extends Error {
  constructor(
    readonly etape: string,
    message: string,
  ) {
    super(`Rapport avant audit — étape « ${etape} » : ${message}`);
    this.name = "ErreurRapport";
  }
}

// ── Formes attendues de chaque étape ────────────────────────────────────────

const shape = BaseAuditSchema.innerType().shape;

const SortieBesoins = z.object({ besoins: z.array(BesoinSchema) });
const SortiePlan = z.object({
  roles: z
    .array(
      z.object({
        id: z.string().min(1),
        titre: z.string().min(1),
        mission: z.string().min(1),
        questions: z.array(z.string()),
      }),
    )
    .min(1),
});
const SortieSpecialiste = z.object({
  constats: z.array(z.object({ section: z.enum(SECTIONS_ANALYSE), element: ElementSchema })),
  exercices: z.array(ExerciceSchema).default([]),
  limites: z.array(z.string()).default([]),
});
const SortieAnalyste = z.object({
  reponseDirection: shape.meta.shape.reponseDirection,
  pistes: z.array(PisteSchema),
  contradictions: shape.contradictions,
  questions_jour_j: shape.questions_jour_j,
  propositions_fiche: shape.propositions_fiche,
});
const SortieCritique = z.object({
  corrections: z.array(
    z.object({
      gravite: z.enum(["bloquant", "important", "mineur"]),
      probleme: z.string().min(1),
      ou: z.string().default(""),
    }),
  ),
});
const SortieRedacteur = z.object({
  resumes: z.record(z.string(), z.string()).default({}),
  lectureFinanciere: z.string().default(""),
});

// ── Appel d'une étape : modèle autorisé, JSON validé, une réparation ─────────

function extraireJson(texte: string): unknown {
  const sansBarrieres = texte.replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "");
  const debut = sansBarrieres.indexOf("{");
  const fin = sansBarrieres.lastIndexOf("}");
  if (debut < 0 || fin < debut) throw new Error("aucun objet JSON dans la réponse");
  return JSON.parse(sansBarrieres.slice(debut, fin + 1));
}

class Compteur {
  entree = 0;
  sortie = 0;
  recherches = 0;
  ajouter(r: ReponseIA): void {
    this.entree += r.jetonsEntree;
    this.sortie += r.jetonsSortie;
    this.recherches += r.nbRecherches;
  }
}

async function etape<T extends z.ZodTypeAny>(
  nom: string,
  schema: T,
  consigne: Consigne,
  modele: string,
  recherche: boolean,
  fournisseur: FournisseurIA,
  compteur: Compteur,
): Promise<z.infer<T>> {
  exigerModeleAutorise(modele);
  let derniereErreur = "";
  for (let essai = 0; essai < 2; essai += 1) {
    const user =
      essai === 0
        ? consigne.user
        : `${consigne.user}\n\nTA RÉPONSE PRÉCÉDENTE ÉTAIT INVALIDE : ${derniereErreur}\nRends à nouveau UNIQUEMENT l'objet JSON corrigé.`;
    const r = await fournisseur({ ...consigne, user, modele, recherche });
    compteur.ajouter(r);
    try {
      return schema.parse(extraireJson(r.texte)) as z.infer<T>;
    } catch (e) {
      derniereErreur = e instanceof Error ? e.message.slice(0, 1500) : String(e);
    }
  }
  throw new ErreurRapport(nom, `réponse invalide après une réparation : ${derniereErreur}`);
}

// ── Assemblage (code pur) ───────────────────────────────────────────────────

function annexeDe(p: PersonneCollectee): AnnexePersonne {
  return AnnexePersonneSchema.parse({
    personne: p.cle,
    mode: p.mode,
    service: p.service,
    statut: p.statut,
    versionsRecues: p.nbVersions,
    recuLe: p.recuLe.toISOString(),
    aVerifier: p.aVerifier,
    reponses: p.champs.map((c) => ({
      cle: c.cle,
      question: c.question,
      rubrique: c.rubrique,
      reponse: c.reponse,
      ...(c.prefill !== undefined ? { prefill: c.prefill } : {}),
    })),
    nonRepondues: p.nonRepondus.map((n) => ({
      cle: n.cle,
      question: n.question,
      rubrique: n.rubrique,
      essentielle: n.essentielle,
    })),
  });
}

/** Un exercice par année : à égalité, le mieux sourcé (le plus de sources, puis le plus sûr). */
function fusionnerExercices(liste: ReadonlyArray<Exercice>): Exercice[] {
  const rang = { etabli: 3, probable: 2, hypothese: 1 } as const;
  const parAnnee = new Map<number, Exercice>();
  for (const x of liste) {
    const deja = parAnnee.get(x.annee);
    if (
      deja === undefined ||
      rang[x.confiance] > rang[deja.confiance] ||
      (rang[x.confiance] === rang[deja.confiance] && x.sources.length > deja.sources.length)
    ) {
      parAnnee.set(x.annee, x);
    }
  }
  return [...parAnnee.values()].sort((a, b) => a.annee - b.annee);
}

// ── Le rapport ──────────────────────────────────────────────────────────────

export async function executerRapport(
  dossier: CollecteReponses,
  opts: OptionsRapport,
): Promise<ResultatRapport> {
  const compteur = new Compteur();
  const limites: string[] = [];
  const progresser = (nom: string, fait: number, total: number): void =>
    opts.surProgression?.({ etape: nom, fait, total });

  if (dossier.totaux.personnesAvecReponse === 0) {
    throw new ErreurRapport("collecte", "aucune réponse lisible : il n'y a rien à analyser.");
  }
  for (const a of dossier.alertes) if (a.niveau !== "info") limites.push(a.texte);

  const appel = <T extends z.ZodTypeAny>(
    nom: string,
    schema: T,
    consigne: Consigne,
    modele: string,
    recherche = false,
  ) => etape(nom, schema, consigne, modele, recherche, opts.fournisseur, compteur);

  // 1. Besoins déclarés
  progresser("Besoins déclarés", 0, 6);
  const besoins = (
    await appel("besoins", SortieBesoins, consigneBesoins(dossier), ROLES_DE_SYNTHESE.chef.modele)
  ).besoins;
  const besoinsJson = JSON.stringify(besoins);

  // 2. Chef d'orchestre : compose l'équipe
  progresser("Composition de l'équipe", 1, 6);
  const plan = await appel(
    "chef d'orchestre",
    SortiePlan,
    consigneChef(dossier, besoinsJson),
    ROLES_DE_SYNTHESE.chef.modele,
  );

  // 3. Spécialistes en parallèle (un échec n'arrête pas les autres)
  progresser("Recherches et analyses", 2, 6);
  const resultats = await Promise.allSettled(
    plan.roles.map((r) => {
      const du_catalogue = ROLES.find((x) => x.id === r.id);
      const recherche = du_catalogue?.recherche ?? true;
      const modele = du_catalogue?.modele ?? MODELES_RAPPORT.execution;
      return appel(
        `spécialiste « ${r.titre} »`,
        SortieSpecialiste,
        consigneSpecialiste(r, besoinsJson, dossier, recherche),
        modele,
        recherche,
      );
    }),
  );
  const constats: z.infer<typeof SortieSpecialiste>[] = [];
  resultats.forEach((res, i) => {
    if (res.status === "fulfilled") constats.push(res.value);
    else {
      limites.push(
        `Le spécialiste « ${plan.roles[i]?.titre ?? "?"} » n'a pas pu aboutir : ${String(res.reason instanceof Error ? res.reason.message : res.reason)}`,
      );
    }
  });
  if (constats.length === 0)
    throw new ErreurRapport("spécialistes", "aucun spécialiste n'a abouti.");
  for (const c of constats) limites.push(...c.limites);

  // 4. Analyste croisé
  progresser("Croisement", 3, 6);
  const constatsJson = JSON.stringify(constats);
  const analyse = await appel(
    "analyste croisé",
    SortieAnalyste,
    consigneAnalyste(besoinsJson, constatsJson),
    ROLES_DE_SYNTHESE.analyste.modele,
  );

  // 5. Critique
  progresser("Relecture critique", 4, 6);
  const critique = await appel(
    "critique",
    SortieCritique,
    consigneCritique(JSON.stringify({ besoins, constats, analyse })),
    ROLES_DE_SYNTHESE.critique.modele,
  );
  const bloquantes = critique.corrections.filter((c) => c.gravite === "bloquant");
  for (const c of bloquantes)
    limites.push(
      `Point à corriger signalé par la relecture : ${c.probleme}${c.ou !== "" ? ` (${c.ou})` : ""}`,
    );

  // 6. Rédacteur : résumés de sections et lecture financière
  progresser("Rédaction", 5, 6);
  const redaction = await appel(
    "rédacteur",
    SortieRedacteur,
    consigneRedacteur(
      JSON.stringify({ besoins, constats, analyse }),
      JSON.stringify(critique.corrections),
    ),
    ROLES_DE_SYNTHESE.redacteur.modele,
  );

  // 7. Assemblage par le code
  const elements = new Map<string, z.infer<typeof ElementSchema>[]>();
  for (const c of constats) {
    for (const k of c.constats)
      elements.set(k.section, [...(elements.get(k.section) ?? []), k.element]);
  }
  const section = (k: (typeof SECTIONS_ANALYSE)[number]) => ({
    resume: redaction.resumes[k] ?? "",
    elements: elements.get(k) ?? [],
  });
  const exercices = fusionnerExercices(constats.flatMap((c) => c.exercices));
  const tendance = lireTendance(
    exercices.map((e) => ({ annee: e.annee, chiffreAffairesEur: e.chiffreAffairesEur })),
    opts.genereLe.getUTCFullYear(),
  );

  const brouillon = {
    version: VERSION_BASE_AUDIT,
    meta: {
      clientId: opts.clientId,
      raisonSociale: opts.raisonSociale,
      generePar: opts.genereePar,
      genereLe: opts.genereLe.toISOString(),
      questionnaires: dossier.questionnaires.map((q) => q.ref),
      complet:
        limites.length === 0 ||
        limites.every((l) => !/n'a pas pu aboutir|à corriger signalé/.test(l)),
      limites,
      reponseDirection: analyse.reponseDirection,
    },
    besoins_declares: besoins,
    equipe_analyse: plan.roles.map((r) => ({
      role: r.titre,
      mission: r.mission,
      modele: (ROLES.find((x) => x.id === r.id)?.modele ?? MODELES_RAPPORT.execution) as string,
      questionsDeRecherche: r.questions,
    })),
    ...Object.fromEntries(SECTIONS_ANALYSE.map((k) => [k, section(k)])),
    evolution_financiere: {
      exercices,
      tendance: tendance.tendance,
      tauxAnnuelMoyenPct: tendance.tauxAnnuelMoyenPct,
      lecture: redaction.lectureFinanciere,
      limites: tendance.limites,
    },
    pistes: analyse.pistes,
    contradictions: analyse.contradictions,
    questions_jour_j: analyse.questions_jour_j,
    propositions_fiche: analyse.propositions_fiche,
    couverture: {
      personnesAvecReponse: dossier.totaux.personnesAvecReponse,
      reponsesDonnees: dossier.totaux.reponsesDonnees,
      questionsSansReponse: dossier.totaux.questionsSansReponse,
      personnesAttenduesSansReponse: [...(opts.attenduesSansReponse ?? [])],
      alertes: [...dossier.alertes],
    },
    annexe_reponses: dossier.personnes.map(annexeDe),
    sources: [],
  };

  const valide = BaseAuditSchema.safeParse(brouillon);
  if (!valide.success) {
    const detail = valide.error.issues
      .slice(0, 5)
      .map((i) => `${i.path.join(".")} : ${i.message}`)
      .join(" ; ");
    throw new ErreurRapport("contrôle du contrat", detail);
  }
  progresser("Terminé", 6, 6);
  return {
    base: valide.data,
    jetonsEntree: compteur.entree,
    jetonsSortie: compteur.sortie,
    nbRecherches: compteur.recherches,
  };
}
