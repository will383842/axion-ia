/**
 * Orchestration de l'équipe éditoriale (PR 12).
 *
 * Ordre : stratège/brief → gardien → vérificateur phase A → plan → rédaction → vérificateur
 * phase B → mailleur → éditeur SEO → conformité (sur le texte final) → rédacteur en chef.
 *
 * Ce module ne contient QUE la logique d'enchaînement : arrêts, plafond de coût par job,
 * renvois bornés, journal de chaque rôle. Les rôles eux-mêmes (modules voisins) sont injectés
 * par le worker. Éteint (`CONTENT_EQUIPE_EDITORIALE` ≠ « true »), le worker n'appelle rien d'ici.
 */

import { PLAFOND_COUT_ARTICLE_USD, RENVOIS_MAX } from "./redacteur-en-chef";
import type { DecisionEnChef, Renvoi, SortieEnChef } from "./redacteur-en-chef";
import type { Brief } from "./brief";
import type { DecisionGardien } from "./gardien";
import type { ResultatConformite } from "./conformite";
import type { ResultatStrategie } from "./strategie";

/** Plafond de coût par job (`jobId`) : 3,00 $, le même que celui du rédacteur en chef. */
export const PLAFOND_JOB_USD = PLAFOND_COUT_ARTICLE_USD;

export type NomRole =
  | "strateg"
  | "gardien"
  | "verificateur-a"
  | "plan-redaction"
  | "verificateur-b"
  | "mailleur"
  | "editeur-seo"
  | "conformite"
  | "redacteur-en-chef";

export interface EntreeJournal {
  readonly role: NomRole;
  readonly decision: string;
  readonly dureeMs: number;
  readonly coutUsd: number;
  /** Numéro de passe (0 = première, 1-2 = après un renvoi). */
  readonly passe: number;
  readonly detail?: string | undefined;
}

export type IssueEquipe =
  "publier" | "a_relire" | "ecarte" | "mise_a_jour" | "relecture_humaine" | "plafond" | "arret";

/** Contenu de `outputJsonRaw.equipe` (champ facultatif ; lecture seule dans la console). */
export interface JournalEquipe {
  readonly version: 1;
  readonly issue: IssueEquipe;
  readonly raison?: string | undefined;
  readonly renvois: number;
  readonly coutTotalUsd: number;
  readonly plafondUsd: number;
  readonly entrees: ReadonlyArray<EntreeJournal>;
}

export class PlafondJobAtteint extends Error {
  constructor(
    readonly coutUsd: number,
    readonly avantRole: string,
  ) {
    super(
      `Plafond de ${PLAFOND_JOB_USD.toFixed(2)} $ par job atteint (${coutUsd.toFixed(2)} $) avant « ${avantRole} »`,
    );
    this.name = "PlafondJobAtteint";
  }
}

/** Tient le journal et applique le plafond. Une instance par job. */
export class SuiviEquipe {
  private readonly entrees: EntreeJournal[] = [];
  private passe = 0;
  /** Coût rendu par un rôle mais pas (encore) lu dans le registre : compté en plus, on compte large. */
  private horsRegistreUsd = 0;
  private dernierCoutRegistre = 0;

  constructor(
    private readonly lireCoutJob: () => Promise<number>,
    private readonly horloge: () => number = Date.now,
  ) {}

  nouvellePasse(): void {
    this.passe += 1;
  }
  get numeroPasse(): number {
    return this.passe;
  }

  /** Coût courant du job : registre + coûts rendus par les rôles non inscrits au registre. */
  async coutCourant(): Promise<number> {
    const registre = await this.lireCoutJob();
    this.dernierCoutRegistre = registre;
    return registre + this.horsRegistreUsd;
  }

  /** Vérifie le plafond AVANT un appel payant. Lève `PlafondJobAtteint` (lecture en échec = lève aussi). */
  async verifierPlafond(avantRole: string): Promise<number> {
    const cout = await this.coutCourant();
    if (cout >= PLAFOND_JOB_USD) throw new PlafondJobAtteint(cout, avantRole);
    return cout;
  }

  /** Coût rendu par un rôle dont l'appel n'écrit pas au registre (rédacteur en chef). */
  compterHorsRegistre(usd: number): void {
    if (Number.isFinite(usd) && usd > 0) this.horsRegistreUsd += usd;
  }

  async role<T>(
    role: NomRole,
    fn: () => Promise<T>,
    lire: (r: T) => { decision: string; coutUsd?: number; detail?: string },
  ): Promise<T> {
    const debut = this.horloge();
    try {
      const r = await fn();
      const l = lire(r);
      this.entrees.push({
        role,
        decision: l.decision,
        dureeMs: Math.max(0, this.horloge() - debut),
        coutUsd: l.coutUsd ?? 0,
        passe: this.passe,
        ...(l.detail ? { detail: l.detail.slice(0, 500) } : {}),
      });
      return r;
    } catch (err) {
      this.entrees.push({
        role,
        decision: "erreur",
        dureeMs: Math.max(0, this.horloge() - debut),
        coutUsd: 0,
        passe: this.passe,
        detail: (err instanceof Error ? err.message : String(err)).slice(0, 500),
      });
      throw err;
    }
  }

  async journal(issue: IssueEquipe, renvois: number, raison?: string): Promise<JournalEquipe> {
    let coutTotalUsd = this.dernierCoutRegistre + this.horsRegistreUsd;
    try {
      coutTotalUsd = await this.coutCourant();
    } catch {
      /* dernier coût connu */
    }
    return {
      version: 1,
      issue,
      ...(raison ? { raison: raison.slice(0, 500) } : {}),
      renvois,
      coutTotalUsd,
      plafondUsd: PLAFOND_JOB_USD,
      entrees: [...this.entrees],
    };
  }
}

// ── Avant l'écriture : stratège → gardien → phase A ──────────────────────────

export interface DepsAvant {
  readonly brief: () => Promise<ResultatStrategie>;
  readonly gardien: (brief: Brief) => Promise<DecisionGardien>;
  /** Phase A du vérificateur (dossier de preuves). Ne lève pas : le worker gère son repli. */
  readonly dossier: () => Promise<{ readonly coutUsd: number; readonly detail?: string }>;
}

export type ResultatAvant =
  | { readonly statut: "continuer"; readonly brief: Brief; readonly angle?: string | undefined }
  | { readonly statut: "arret"; readonly issue: IssueEquipe; readonly raison: string };

export async function avantEcriture(suivi: SuiviEquipe, deps: DepsAvant): Promise<ResultatAvant> {
  try {
    await suivi.verifierPlafond("stratège");
    const res = await suivi.role("strateg", deps.brief, (r) => ({
      decision: r.statut,
      ...(r.statut === "brief" ? { coutUsd: r.coutUsd } : {}),
      ...(r.statut === "refus" || r.statut === "mise-a-jour"
        ? { detail: `mot-clé « ${r.motCle} » possédé par ${r.proprietaire}` }
        : {}),
    }));
    if (res.statut === "refus") {
      return {
        statut: "arret",
        issue: "ecarte",
        raison: `Mot-clé « ${res.motCle} » déjà possédé par ${res.proprietaire}`,
      };
    }
    if (res.statut === "mise-a-jour") {
      return {
        statut: "arret",
        issue: "mise_a_jour",
        raison: `Mot-clé « ${res.motCle} » : mettre à jour ${res.proprietaire}`,
      };
    }
    if (res.statut === "desactive") {
      return { statut: "arret", issue: "arret", raison: "Stratège éteint" };
    }
    const brief = res.brief;

    const decision = await suivi.role(
      "gardien",
      () => deps.gardien(brief),
      (d) => ({
        decision: d.decision,
        detail: d.raison,
      }),
    );
    if (decision.decision === "ecarter") {
      return { statut: "arret", issue: "ecarte", raison: decision.raison };
    }
    if (decision.decision === "mettre_a_jour") {
      return { statut: "arret", issue: "mise_a_jour", raison: decision.raison };
    }
    if (decision.decision === "relecture_humaine") {
      return { statut: "arret", issue: "relecture_humaine", raison: decision.raison };
    }
    // « desactive » ne peut pas arriver ici (équipe allumée) ; par prudence : aucune écriture payée.
    if (decision.decision === "desactive") {
      return { statut: "arret", issue: "arret", raison: decision.raison };
    }

    await suivi.verifierPlafond("vérificateur (phase A)");
    await suivi.role("verificateur-a", deps.dossier, (r) => ({
      decision: "dossier",
      coutUsd: r.coutUsd,
      ...(r.detail ? { detail: r.detail } : {}),
    }));
    return {
      statut: "continuer",
      brief,
      angle: decision.decision === "reorienter" ? decision.angle : undefined,
    };
  } catch (err) {
    if (err instanceof PlafondJobAtteint) {
      return { statut: "arret", issue: "plafond", raison: err.message };
    }
    return {
      statut: "arret",
      issue: "relecture_humaine",
      raison: `Erreur de l'équipe avant écriture : ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// ── Après l'écriture : vérificateur B → … → rédacteur en chef ────────────────

export interface RapportRole<O> {
  readonly output: O;
  readonly decision: string;
  readonly coutUsd?: number;
  readonly detail?: string;
}

export interface DepsFin<O> {
  /** Vérificateur phase B sur la sortie. Ne remplace pas le texte. */
  readonly verificateurB: (o: O) => Promise<RapportRole<O>>;
  readonly mailleur: (o: O) => Promise<RapportRole<O>>;
  readonly editeurSeo: (o: O) => Promise<RapportRole<O>>;
  readonly conformite: (o: O) => Promise<ResultatConformite>;
  readonly enChef: (
    o: O,
    ctx: { renvoisFaits: number; coutDepenseUsd: number; conformite: ResultatConformite },
  ) => Promise<SortieEnChef>;
  /** Renvoi : le rôle responsable reprend (nouveau plan/rédaction). Rend le nouvel état ou lève. */
  readonly renvoyer: (o: O, renvois: ReadonlyArray<Renvoi>) => Promise<RapportRole<O>>;
}

export type ResultatFin<O> =
  | { readonly statut: "publier"; readonly output: O; readonly decision: DecisionEnChef }
  | {
      readonly statut: "stop";
      readonly issue: Exclude<IssueEquipe, "publier">;
      readonly output: O;
      readonly raison: string;
      readonly causes: ReadonlyArray<string>;
    };

const resume = (c: ResultatConformite): string =>
  c.constats.length === 0
    ? c.decision
    : `${c.decision} : ${c.constats.map((x) => x.code).join(", ")}`;

export async function apresEcriture<O>(
  suivi: SuiviEquipe,
  sortieInitiale: O,
  deps: DepsFin<O>,
): Promise<ResultatFin<O> & { readonly renvois: number }> {
  let output = sortieInitiale;
  let renvois = 0;
  const stop = (
    issue: Exclude<IssueEquipe, "publier">,
    raison: string,
    causes: ReadonlyArray<string> = [],
  ) => ({ statut: "stop" as const, issue, output, raison, causes, renvois });

  // Borne dure : une passe initiale + RENVOIS_MAX renvois.
  for (let tour = 0; tour <= RENVOIS_MAX; tour++) {
    try {
      await suivi.verifierPlafond("vérificateur (phase B)");
      const b = await suivi.role(
        "verificateur-b",
        () => deps.verificateurB(output),
        (r) => ({
          decision: r.decision,
          ...(r.coutUsd !== undefined ? { coutUsd: r.coutUsd } : {}),
          ...(r.detail ? { detail: r.detail } : {}),
        }),
      );
      output = b.output;

      await suivi.verifierPlafond("mailleur");
      const m = await suivi.role(
        "mailleur",
        () => deps.mailleur(output),
        (r) => ({
          decision: r.decision,
          ...(r.coutUsd !== undefined ? { coutUsd: r.coutUsd } : {}),
          ...(r.detail ? { detail: r.detail } : {}),
        }),
      );
      output = m.output;

      await suivi.verifierPlafond("éditeur SEO");
      const s = await suivi.role(
        "editeur-seo",
        () => deps.editeurSeo(output),
        (r) => ({
          decision: r.decision,
          ...(r.coutUsd !== undefined ? { coutUsd: r.coutUsd } : {}),
          ...(r.detail ? { detail: r.detail } : {}),
        }),
      );
      output = s.output;

      // Conformité rejouée sur le texte FINAL (celui que l'éditeur SEO vient de rendre).
      await suivi.verifierPlafond("conformité");
      const conformite = await suivi.role(
        "conformite",
        () => deps.conformite(output),
        (r) => ({
          decision: r.decision,
          coutUsd: r.coutUsd,
          ...(r.constats.length > 0 ? { detail: resume(r) } : {}),
        }),
      );

      const coutAvant = await suivi.verifierPlafond("rédacteur en chef");
      const chef = await suivi.role(
        "redacteur-en-chef",
        () => deps.enChef(output, { renvoisFaits: renvois, coutDepenseUsd: coutAvant, conformite }),
        (r) => ({
          decision: r.decision.type,
          coutUsd: r.coutJugeUsd,
          ...(r.decision.type === "renvoi"
            ? {
                detail: r.decision.renvois
                  .map((x) => `${x.role}: ${x.criteres.join("+")}`)
                  .join(" ; "),
              }
            : "blockCauses" in r.decision
              ? { detail: r.decision.blockCauses.slice(0, 3).join(" | ") }
              : {}),
        }),
      );
      // Le coût du juge est déjà au registre (même jobId) : il est relu au prochain contrôle, jamais compté deux fois.
      const d = chef.decision;
      if (d.type === "publier" || d.type === "inchange") {
        return { statut: "publier", output, decision: d, renvois };
      }
      if (d.type === "a_relire") {
        return stop("a_relire", d.blockCauses[0] ?? "Relecture humaine obligatoire", d.blockCauses);
      }
      if (d.type === "arret") {
        return stop("ecarte", d.blockCauses[0] ?? "Arrêt du rédacteur en chef", d.blockCauses);
      }
      if (d.type === "relecture_humaine") {
        return stop("relecture_humaine", d.blockCauses[0] ?? "Relecture humaine", d.blockCauses);
      }
      // Renvoi : borné. Le rédacteur en chef borne déjà (renvoisFaits) ; on borne aussi ici.
      if (renvois >= RENVOIS_MAX) {
        return stop("relecture_humaine", `Plus de ${RENVOIS_MAX} renvois : relecture humaine`);
      }
      await suivi.verifierPlafond("renvoi");
      renvois += 1;
      suivi.nouvellePasse();
      const r = await suivi.role(
        "plan-redaction",
        () => deps.renvoyer(output, d.renvois),
        (x) => ({
          decision: `renvoi ${renvois}`,
          ...(x.coutUsd !== undefined ? { coutUsd: x.coutUsd } : {}),
          ...(x.detail ? { detail: x.detail } : {}),
        }),
      );
      output = r.output;
    } catch (err) {
      if (err instanceof PlafondJobAtteint) return stop("plafond", err.message);
      return stop(
        "relecture_humaine",
        `Erreur de l'équipe : ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
  return stop("relecture_humaine", `Plus de ${RENVOIS_MAX} renvois : relecture humaine`);
}

/**
 * Première écriture (plan puis rédaction, faites par le générateur) : plafond vérifié avant
 * l'appel, rôle journalisé. Rend `null` si le plafond est atteint (aucune écriture payée).
 */
export async function premiereEcriture<O>(
  suivi: SuiviEquipe,
  ecrire: () => Promise<RapportRole<O>>,
): Promise<{ readonly output: O } | { readonly arret: string }> {
  try {
    await suivi.verifierPlafond("plan et rédaction");
  } catch (err) {
    if (err instanceof PlafondJobAtteint) return { arret: err.message };
    throw err;
  }
  const r = await suivi.role("plan-redaction", ecrire, (x) => ({
    decision: "ecrit",
    ...(x.coutUsd !== undefined ? { coutUsd: x.coutUsd } : {}),
    ...(x.detail ? { detail: x.detail } : {}),
  }));
  return { output: r.output };
}
