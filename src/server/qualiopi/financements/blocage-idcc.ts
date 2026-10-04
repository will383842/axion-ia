/**
 * Qualiopi — le dossier de financement ne se génère pas tant que l'IDCC n'est
 * pas CONFIRMÉ (INT-T67-A, cahier OPCO §8 chantier 4).
 *
 * CONTRÔLE (b0, accordé sur l'issue 656), mot pour mot : « contrôle par
 * employeur en inter-entreprises (Enrollment.clientId) ; seuls les dossiers
 * opco et mixte sont bloqués, les dossiers existants restent intacts ; les
 * sessions concernées sont comptées en production avant la fusion ».
 *
 * Ce que cela donne ici :
 *  - un dossier `cpf` ou `france_travail` n'est JAMAIS bloqué ;
 *  - un dossier `opco` ou `mixte` exige que CHAQUE EMPLOYEUR concerné soit
 *    `confirme` dans `client_idcc_controles` (INT-T61-A). Pas de ligne =
 *    `non_renseigne`. Un `confirme` qui porte un AUTRE IDCC que celui de la
 *    fiche ne vaut plus : la saisie a changé depuis la preuve ;
 *  - les employeurs concernés sont ceux des inscriptions ACTIVES dont le
 *    financement EFFECTIF est `opco` ou `mixte` (`Enrollment.clientId`, à
 *    défaut le client de la session — même règle que la ventilation des
 *    créances). Sans inscription, c'est le client de la session ;
 *  - le blocage ne vaut que pour une NOUVELLE génération : un dossier déjà
 *    généré n'est ni lu, ni modifié, ni supprimé par ce module.
 *
 * Le refus NOMME chaque employeur non confirmé et son statut, dit quoi faire
 * (confirmer l'IDCC par une preuve déclarative) et rappelle qu'il faut déposer
 * avant le début de la formation.
 *
 * Règle PURE (`deciderBlocageIdcc`) ; la lecture prend une base INJECTÉE,
 * comme `idcc-controle.ts`.
 */

import type { StatutIdcc } from "../../../../prisma/generated/client";
import { normaliserIdcc } from "@/server/qualiopi/crm/naf-opco";
import { financementTypeEffectif } from "./inter-entreprises";

// ─── Périmètre ─────────────────────────────────────────────────────────────

/** Seuls ces types de dossier sont bloqués. */
export const TYPES_DOSSIER_BLOQUES = ["opco", "mixte"] as const;

/** Le type de dossier est-il soumis au contrôle de l'IDCC ? */
export function dossierSoumisAuControleIdcc(type: string | null | undefined): boolean {
  return (TYPES_DOSSIER_BLOQUES as readonly string[]).includes(type ?? "");
}

/** Une inscription, vue par le blocage : son financement et son employeur. */
export interface InscriptionBlocage {
  readonly financementType: string | null;
  readonly clientId: string | null;
}

/** La session, vue par le blocage. */
export interface SessionBlocage {
  readonly financementType: string | null;
  readonly clientId: string | null;
  readonly enrollments: readonly InscriptionBlocage[];
}

/**
 * Les employeurs dont l'IDCC doit être confirmé, sans doublon, dans l'ordre de
 * première apparition. `null` dans la liste = un siège OPCO sans aucune
 * entreprise rattachée (ni sur l'inscription, ni sur la session).
 *
 * ⚠️ À n'appeler que pour un dossier `opco` ou `mixte` : un siège CPF ou France
 * Travail d'une session inter-entreprises n'a pas d'OPCO à désigner, son
 * employeur n'est donc pas concerné.
 */
export function employeursConcernes(session: SessionBlocage): Array<string | null> {
  const out: Array<string | null> = [];
  const ajouter = (id: string | null) => {
    if (!out.includes(id)) out.push(id);
  };
  if (session.enrollments.length === 0) {
    ajouter(session.clientId);
    return out;
  }
  for (const e of session.enrollments) {
    const type = financementTypeEffectif(e.financementType, session.financementType);
    if (!dossierSoumisAuControleIdcc(type)) continue;
    ajouter(e.clientId ?? session.clientId);
  }
  return out;
}

// ─── Statut lu ─────────────────────────────────────────────────────────────

/** Ce que la base dit d'un employeur. */
export interface EmployeurIdccLu {
  readonly id: string;
  readonly raisonSociale: string;
  /** `Client.idcc`, brut. */
  readonly idccSaisi: string | null;
  /** Ligne de `client_idcc_controles` ; `null` = pas de ligne. */
  readonly controle: { readonly statut: StatutIdcc; readonly idcc: string | null } | null;
}

/**
 * Statut EFFECTIF d'un employeur : pas de ligne → `non_renseigne` ; un
 * `confirme` dont l'IDCC n'est plus celui de la fiche → `probable` (la preuve
 * portait sur une autre convention, elle ne confirme plus rien).
 */
export function statutIdccEffectif(e: EmployeurIdccLu): {
  statut: StatutIdcc;
  confirmationPerimee: boolean;
} {
  if (e.controle === null) return { statut: "non_renseigne", confirmationPerimee: false };
  if (e.controle.statut === "confirme") {
    const saisi = normaliserIdcc(e.idccSaisi);
    if (saisi === null || e.controle.idcc !== saisi) {
      return { statut: "probable", confirmationPerimee: true };
    }
  }
  return { statut: e.controle.statut, confirmationPerimee: false };
}

// ─── Décision ──────────────────────────────────────────────────────────────

/** Libellés des statuts, pour le message rendu à l'humain. */
export const LIBELLES_STATUT_IDCC: Record<StatutIdcc, string> = {
  non_renseigne: "non renseigné",
  probable: "probable",
  concordant: "concordant",
  anomalie: "en anomalie",
  confirme: "confirmé",
};

/** Un employeur qui bloque la génération, et pourquoi. */
export interface EmployeurBloquant {
  readonly id: string | null;
  readonly raisonSociale: string | null;
  readonly statut: StatutIdcc;
  readonly confirmationPerimee: boolean;
}

export type DecisionBlocageIdcc =
  | { readonly bloque: false }
  | { readonly bloque: true; readonly bloquants: EmployeurBloquant[]; readonly message: string };

/** Rappel commun à tout refus. */
export const RAPPEL_DEPOT = "déposer avant le début de la formation";

const dateFr = (d: Date) =>
  d.toLocaleDateString("fr-FR", {
    timeZone: "Europe/Paris",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

function libelleBloquant(b: EmployeurBloquant): string {
  if (b.id === null) return "une inscription sans entreprise rattachée";
  const nom = `« ${b.raisonSociale ?? "Entreprise sans raison sociale"} »`;
  if (b.confirmationPerimee) {
    return `${nom} (confirmation portant sur un autre IDCC que celui de la fiche)`;
  }
  return `${nom} (IDCC ${LIBELLES_STATUT_IDCC[b.statut]})`;
}

/** Le message de refus, au vouvoiement, nommant chaque employeur bloquant. */
export function messageRefusIdcc(
  bloquants: readonly EmployeurBloquant[],
  dateDebut: Date | null,
): string {
  const noms = bloquants.map(libelleBloquant);
  const qui =
    noms.length === 1
      ? `l'IDCC de l'entreprise ${noms[0]} n'est pas confirmé`
      : `l'IDCC de ces entreprises n'est pas confirmé : ${noms.join(", ")}`;
  const sansEntreprise = bloquants.some((b) => b.id === null);
  const quoiFaire = sansEntreprise
    ? "Rattachez chaque inscription financée par l'OPCO à son employeur, puis confirmez son IDCC"
    : noms.length === 1
      ? "Confirmez l'IDCC de ce client par une preuve déclarative"
      : "Confirmez l'IDCC de chacun de ces clients par une preuve déclarative";
  const quand =
    dateDebut instanceof Date && !Number.isNaN(dateDebut.getTime())
      ? ` Rappel : la demande est à ${RAPPEL_DEPOT}, prévu le ${dateFr(dateDebut)}.`
      : ` Rappel : la demande est à ${RAPPEL_DEPOT}.`;
  return (
    `Le dossier de financement ne peut pas être généré : ${qui}. ` +
    `${quoiFaire} (attestation de l'entreprise, déclaration à l'OPCO ou accord de prise en charge), ` +
    `depuis la fiche client, puis relancez la génération.${quand}`
  );
}

/**
 * La règle : un dossier `opco`/`mixte` n'est généré que si chaque employeur
 * concerné est `confirme`. Un employeur concerné absent de `lus` (fiche
 * supprimée) bloque comme `non_renseigne`.
 */
export function deciderBlocageIdcc(input: {
  readonly typeDossier: string;
  readonly employeurs: ReadonlyArray<string | null>;
  readonly lus: readonly EmployeurIdccLu[];
  readonly dateDebut: Date | null;
}): DecisionBlocageIdcc {
  if (!dossierSoumisAuControleIdcc(input.typeDossier)) return { bloque: false };
  const parId = new Map(input.lus.map((e) => [e.id, e]));
  const bloquants: EmployeurBloquant[] = [];
  for (const id of input.employeurs) {
    const lu = id === null ? undefined : parId.get(id);
    if (lu === undefined) {
      bloquants.push({
        id,
        raisonSociale: null,
        statut: "non_renseigne",
        confirmationPerimee: false,
      });
      continue;
    }
    const { statut, confirmationPerimee } = statutIdccEffectif(lu);
    if (statut !== "confirme") {
      bloquants.push({ id, raisonSociale: lu.raisonSociale, statut, confirmationPerimee });
    }
  }
  if (bloquants.length === 0) return { bloque: false };
  return { bloque: true, bloquants, message: messageRefusIdcc(bloquants, input.dateDebut) };
}

/** Une génération refusée faute d'IDCC confirmé. Le message est fait pour l'écran. */
export class GenerationDossierRefuseeIdcc extends Error {
  readonly bloquants: EmployeurBloquant[];
  constructor(decision: Extract<DecisionBlocageIdcc, { bloque: true }>) {
    super(decision.message);
    this.name = "GenerationDossierRefuseeIdcc";
    this.bloquants = decision.bloquants;
  }
}

// ─── Lecture ───────────────────────────────────────────────────────────────

/** Sous-ensemble du client Prisma pour lire le statut IDCC des employeurs. */
export interface LecteurIdccEmployeurs {
  client: {
    findMany(args: {
      where: { id: { in: string[] } };
      select: {
        id: true;
        raisonSociale: true;
        idcc: true;
        idccControle: { select: { statut: true; idcc: true } };
      };
    }): Promise<
      Array<{
        id: string;
        raisonSociale: string;
        idcc: string | null;
        idccControle: { statut: StatutIdcc; idcc: string | null } | null;
      }>
    >;
  };
}

/** Lit le statut IDCC des employeurs (aucune requête s'il n'y en a pas). */
export async function lireIdccEmployeurs(
  db: LecteurIdccEmployeurs,
  ids: ReadonlyArray<string | null>,
): Promise<EmployeurIdccLu[]> {
  const reels = ids.filter((id): id is string => id !== null);
  if (reels.length === 0) return [];
  const lignes = await db.client.findMany({
    where: { id: { in: reels } },
    select: {
      id: true,
      raisonSociale: true,
      idcc: true,
      idccControle: { select: { statut: true, idcc: true } },
    },
  });
  return lignes.map((l) => ({
    id: l.id,
    raisonSociale: l.raisonSociale,
    idccSaisi: l.idcc,
    controle: l.idccControle,
  }));
}

/**
 * Garde à appeler JUSTE AVANT de créer un dossier : lève
 * `GenerationDossierRefuseeIdcc` si un employeur concerné n'est pas confirmé.
 * Ne lit rien pour un dossier CPF ou France Travail.
 */
export async function exigerIdccConfirme(
  db: LecteurIdccEmployeurs,
  input: {
    typeDossier: string;
    employeurs: ReadonlyArray<string | null>;
    dateDebut: Date | null;
  },
): Promise<void> {
  if (!dossierSoumisAuControleIdcc(input.typeDossier)) return;
  const lus = await lireIdccEmployeurs(db, input.employeurs);
  const decision = deciderBlocageIdcc({ ...input, lus });
  if (decision.bloque) throw new GenerationDossierRefuseeIdcc(decision);
}
