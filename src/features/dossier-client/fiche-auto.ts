/**
 * La FICHE PROSPECT AUTOMATIQUE au rendez-vous (décision de Will, 24/10/2026) :
 * dès qu'une personne réserve un rendez-vous Calendly de la liste blanche du
 * dossier client, sa fiche est créée dans la console (table `clients`, statut
 * `prospect`) et la rencontre y est rangée, sans clic.
 *
 * ## Ce que cela change de la règle A4
 *
 * A4 (« jamais un rattachement automatique », `rattacher.ts`) reste vraie pour
 * tout ce qui n'est pas un rendez-vous Calendly de la liste blanche, et pour
 * tout cas DOUTEUX. Le doute se juge ICI, à chaque passage, sur ce que la base
 * sait à ce moment — jamais sur la proposition posée à la réservation.
 *
 * ## Les trois issues, dans l'ordre
 *
 *   1. une fiche SÛRE : l'adresse du TITULAIRE de la réservation est celle de la
 *      fiche (`contactEmail` ou une de ses personnes), ou la demande du site
 *      reliée par Will porte le même SIREN / la même empreinte d'adresse. UNE
 *      seule fiche. Jamais un invité, jamais une raison sociale, jamais un
 *      domaine → la rencontre y est RANGÉE (`validerRattachement`). Le statut de
 *      la fiche n'est jamais touché : un client le reste ;
 *   2. sinon la fiche prospect est CRÉÉE par la porte unique : raison sociale =
 *      « Nom de l'entreprise » de Calendly s'il est utilisable, sinon le nom de
 *      l'invité (type particulier). Jamais de SIREN : il ne se pose que d'un clic
 *      de Will. S'IL Y A UN DOUTE sur l'identité (fiche proche par la proposition
 *      ou la comparaison de la porte, homonyme, domaine partagé, plusieurs fiches,
 *      invité connu ailleurs), la fiche est créée QUAND MÊME (décision de Will,
 *      24/10 : le SIRET n'est pas connu au départ) et marquée « doublon possible » :
 *      une ligne d'historique `client.doublon_possible` porte le lien vers chaque
 *      fiche proche, et une alerte (`visio.doublon_possible`) prévient Will. La
 *      fusion au SIRET viendra dans une autre PR ;
 *   3. seuls restent « à classer » (trace « doute vu », alerte « N rendez-vous à
 *      classer », jamais une panne) : un refus de la porte unique (`refuse_siren`,
 *      `motif_requis` : elle interdit la création), un rattachement refusé, et un
 *      rendez-vous sans nom utilisable (ni entreprise, ni personne : jamais
 *      « jean.dupont »).
 *
 * ## Exclus
 *
 * Reprise d'historique, test interne, rendez-vous annulé (Calendly ou rencontre
 * `annule` / `absent`), et tout le stock créé AVANT `DOSSIER_FICHE_AUTO_DEPUIS`
 * (les rencontres déjà à classer restent à Will).
 *
 * ## Qui signe : personne
 *
 * Les gestes automatiques s'écrivent SANS auteur (`parAdminId` / `rattacheParId`
 * nuls, comme les propositions de la machine) et laissent une ligne
 * `ActivityLog` « client.creation_automatique » / « rencontre.rattachement_automatique »
 * (changes.origine = "automatique"). Aucune migration, aucune fausse signature.
 *
 * ## Idempotence (cadence de 5 min, deux passages simultanés)
 *
 * Une rencontre rangée n'est plus candidate. Deux passages en même temps : la
 * porte prend un verrou sur l'adresse du titulaire ; un refus est relu avant
 * d'être compté. Un titulaire qui réserve deux fois retombe sur sa fiche.
 * Chaque rencontre a son `try` : l'une qui plante ne bloque pas les autres.
 *
 * ## Interrupteur
 *
 * `DOSSIER_FICHE_AUTO` : actif SEULEMENT si `"true"` (comme `DOSSIER_BALAYAGE_ENABLED`) ;
 * `"essai"` = à blanc (décide et compte, n'écrit rien). Avec `DOSSIER_FICHE_AUTO_DEPUIS`
 * (date ISO) absent ou illisible : rien n'est traité.
 *
 * Module neutre (sans `server-only`, sans Next) : le balayage du worker l'importe.
 */

import { createHash } from "node:crypto";

import { entrepriseDeclaree } from "@/features/admin-rendezvous/a-venir";
import { invitesSupplementaires } from "@/features/admin-rendezvous/visio";
import { domaineDe, natureAdresse } from "@/lib/email/nature-adresse";
import { CODES_ALERTES_VISIO } from "@/server/visio/alertes";
import { hashEmailForLookup } from "@/lib/security/email-hash";
import {
  chargerFichesCandidates,
  preparerCandidat,
  trouverFichesProches,
} from "@/server/qualiopi/crm/porte-client";
import type { BaseTransactionnelle, Tx } from "./base";
import { HORS_RENCONTRES_DE_TEST } from "./client-test";
import { creerProspectDepuisRencontre, ErreurCreerProspect } from "./creer-prospect";
import {
  calculerProposition,
  chargerFichesPourRattachement,
  ErreurRattachement,
  relancerApresRattachement,
  sirenDuNumeroSaisi,
  validerRattachement,
  type DemandeLiee,
  type FicheConnuePourRattachement,
  type IndicesDeRattachement,
} from "./rattacher";

// ── Interrupteur, date d'activation ──────────────────────────────────────────

export type ModeFicheAuto = "coupe" | "essai" | "actif";

/** `"true"` actif, `"essai"` à blanc, tout le reste (absent compris) coupé. */
export function modeFicheAuto(
  env: Readonly<Record<string, string | undefined>> = process.env,
): ModeFicheAuto {
  const brut = env["DOSSIER_FICHE_AUTO"];
  if (brut === "true") return "actif";
  if (brut === "essai") return "essai";
  return "coupe";
}

/** La date d'activation : seules les rencontres créées à partir d'elle sont traitées. */
export function activeDepuis(
  env: Readonly<Record<string, string | undefined>> = process.env,
): Date | null {
  const brut = env["DOSSIER_FICHE_AUTO_DEPUIS"];
  if (!brut) return null;
  const d = new Date(brut);
  return Number.isNaN(d.getTime()) ? null : d;
}

// ── Les traces ───────────────────────────────────────────────────────────────

export const ACTION_CREATION_AUTOMATIQUE = "client.creation_automatique";
export const ACTION_DOUBLON_POSSIBLE = "client.doublon_possible";
export const ACTION_RATTACHEMENT_AUTOMATIQUE = "rencontre.rattachement_automatique";
/** Le marqueur « doute vu » : la rencontre sort des candidats et reste à Will. */
export const ACTION_DOUTE_VU = "dossier.fiche_auto_doute";

// ── Le jugement (PUR) ────────────────────────────────────────────────────────

export type Raison = "refus_porte" | "sans_nom" | "rattachement_refuse" | "creation_refusee";

const NON_ENTREPRISES: ReadonlySet<string> = new Set([
  "aucune",
  "aucun",
  "non",
  "no",
  "neant",
  "na",
  "n a",
  "nc",
  "sans",
  "sans entreprise",
  "particulier",
  "personnel",
  "perso",
  "independant",
  "freelance",
  "rien",
  "ras",
]);

/** Un « nom d'entreprise » qui n'en est pas un (« - », « aucune », « non »…). */
export function entrepriseUtilisable(nom: string | null | undefined): boolean {
  const n = (nom ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  if (n.length < 2) return false;
  return !NON_ENTREPRISES.has(n);
}

/** Un nom de PERSONNE utilisable : ni vide, ni une adresse, ni « jean.dupont ». */
export function nomDePersonneUtilisable(nom: string | null | undefined): boolean {
  const n = (nom ?? "").trim();
  if (n.length < 2 || n.includes("@")) return false;
  return !/^[^\s@]+[._][^\s@]+$/.test(n);
}

/** Raison sociale + type de la fiche à créer, ou `null` (doute). PUR. */
export function identiteDeLaFiche(
  declaree: { nom: string | null; ville: string | null },
  invite: { nom: string | null },
): { raisonSociale: string; type: "entreprise" | "particulier"; ville: string | null } | null {
  if (entrepriseUtilisable(declaree.nom)) {
    return {
      raisonSociale: (declaree.nom as string).trim(),
      type: "entreprise",
      ville: declaree.ville,
    };
  }
  if (nomDePersonneUtilisable(invite.nom)) {
    return {
      raisonSociale: (invite.nom as string).trim(),
      type: "particulier",
      ville: declaree.ville,
    };
  }
  return null;
}

export type FicheSure =
  | { readonly statut: "sure"; readonly clientId: string; readonly motif: string }
  | { readonly statut: "ambigue"; readonly ids: readonly string[] }
  | null;

/**
 * La fiche SÛRE d'un rendez-vous : l'adresse du TITULAIRE (pas d'un invité), ou
 * la demande du site liée par SIREN / empreinte d'adresse (pas par le nom). Une
 * seule fiche, sinon c'est ambigu. PUR.
 */
export function ficheSure(
  titulaire: string | null,
  demande: DemandeLiee | null,
  fiches: readonly FicheConnuePourRattachement[],
): FicheSure {
  const adresse = titulaire?.trim().toLowerCase() || null;
  if (adresse && adresse.includes("@")) {
    const h = hashEmailForLookup(adresse);
    const parAdresse = fiches.filter(
      (f) =>
        (f.contactEmail ?? "").trim().toLowerCase() === adresse ||
        (h !== null && f.empreintes.includes(h)),
    );
    if (parAdresse.length > 1) return { statut: "ambigue", ids: parAdresse.map((f) => f.id) };
    const f = parAdresse[0];
    if (f) {
      const parContact = (f.contactEmail ?? "").trim().toLowerCase() === adresse;
      return {
        statut: "sure",
        clientId: f.id,
        motif: parContact ? "email_calendly" : "contact_connu",
      };
    }
  }
  if (demande) {
    const trouvees = new Set<string>();
    for (const f of fiches) {
      if (demande.siren && f.siren === demande.siren) trouvees.add(f.id);
      if (
        demande.emailHash &&
        (f.empreintes.includes(demande.emailHash) ||
          hashEmailForLookup(f.contactEmail) === demande.emailHash)
      ) {
        trouvees.add(f.id);
      }
    }
    if (trouvees.size > 1) return { statut: "ambigue", ids: [...trouvees] };
    const [clientId] = [...trouvees];
    if (clientId) return { statut: "sure", clientId, motif: "demande_liee" };
  }
  return null;
}

/** Les domaines PROFESSIONNELS des participants (le titulaire et ses invités). PUR. */
export function domainesProDe(indices: IndicesDeRattachement): Set<string> {
  return new Set(
    [indices.emailTitulaire, ...indices.emailsInvites]
      .filter((a): a is string => !!a && a.includes("@") && natureAdresse(a) === "pro")
      .map((a) => domaineDe(a.trim().toLowerCase())),
  );
}

// ── Un rendez-vous ───────────────────────────────────────────────────────────

/** Une fiche proche d'une fiche créée en doute (lien dans son historique). */
export interface ProcheLie {
  readonly ficheId: string;
  readonly signal: string;
}

export type IssueFicheAuto =
  | {
      readonly statut: "creee";
      readonly clientId: string;
      readonly relanceEnEchec: boolean;
      /** Fiches proches : la nouvelle fiche est marquée « doublon possible ». */
      readonly proches: readonly ProcheLie[];
    }
  | { readonly statut: "rattachee"; readonly clientId: string; readonly relanceEnEchec: boolean }
  | { readonly statut: "creerait"; readonly doublon: boolean }
  | { readonly statut: "rattacherait" }
  | { readonly statut: "deja_rangee" }
  | { readonly statut: "ignoree" }
  | { readonly statut: "doute"; readonly raison: Raison };

export type BaseFicheAuto = Tx & BaseTransactionnelle;

export interface OptionsFicheAuto {
  /** Remplace `relancerApresRattachement` (tests). */
  readonly relancer?: (rencontreId: string) => Promise<unknown>;
  /** À blanc : décide, n'écrit rien. */
  readonly essai?: boolean;
  /** Date d'activation : une réservation CAPTÉE avant elle n'est jamais traitée. */
  readonly depuis?: Date | null;
}

async function demandeLiee(db: Tx, submissionId: string | null): Promise<DemandeLiee | null> {
  if (!submissionId) return null;
  const d = await db.submission.findUnique({
    where: { id: submissionId },
    select: { companyName: true, registrationNumber: true, contactEmailHash: true },
  });
  if (d === null) return null;
  return {
    siren: sirenDuNumeroSaisi(d.registrationNumber),
    emailHash: d.contactEmailHash,
    raisonSociale: d.companyName,
  };
}

/** Traite UNE rencontre Calendly encore à classer. Voir l'en-tête. */
export async function assurerFicheProspectAuto(
  db: BaseFicheAuto,
  rencontreId: string,
  options: OptionsFicheAuto = {},
): Promise<IssueFicheAuto> {
  const r = await db.rencontre.findUnique({
    where: { id: rencontreId },
    select: {
      id: true,
      source: true,
      statut: true,
      clientId: true,
      rattachementStatut: true,
      repriseHistorique: true,
      estTestInterne: true,
      calendlyEventId: true,
    },
  });
  if (r === null || r.source !== "calendly" || r.calendlyEventId === null) {
    return { statut: "ignoree" };
  }
  if (r.repriseHistorique || r.estTestInterne) return { statut: "ignoree" };
  if (r.clientId !== null || r.rattachementStatut === "valide") return { statut: "deja_rangee" };
  if (r.statut === "annule" || r.statut === "absent") return { statut: "ignoree" };

  const ev = await db.calendlyEvent.findUnique({
    where: { id: r.calendlyEventId },
    select: {
      status: true,
      capturedAt: true,
      inviteeName: true,
      inviteeEmail: true,
      rawPayload: true,
      linkedSubmissionId: true,
    },
  });
  if (ev === null || ev.status !== "scheduled") return { statut: "ignoree" };
  // Une rencontre créée APRÈS l'activation pour une réservation captée AVANT reste à Will.
  if (options.depuis && ev.capturedAt.getTime() < options.depuis.getTime()) {
    return { statut: "ignoree" };
  }

  const invites = invitesSupplementaires(ev.rawPayload);
  const declaree = entrepriseDeclaree(ev.rawPayload);
  const indices: IndicesDeRattachement = {
    emailTitulaire: ev.inviteeEmail,
    emailsInvites: invites,
    entrepriseDeclaree: declaree.nom,
    clientDuReport: null,
    demandeLiee: await demandeLiee(db, ev.linkedSubmissionId),
  };
  const fiches = await chargerFichesPourRattachement(db, indices);

  const relancer =
    options.relancer ??
    ((id: string) =>
      relancerApresRattachement(
        db as unknown as Parameters<typeof relancerApresRattachement>[0],
        id,
      ));
  const apresRangement = async (): Promise<boolean> =>
    relancer(rencontreId).then(
      () => false,
      () => true,
    );

  // 1. Une fiche sûre → rattachement.
  const sure = ficheSure(ev.inviteeEmail, indices.demandeLiee, fiches);
  const proches = new Map<string, string>();
  if (sure?.statut === "ambigue") for (const id of sure.ids) proches.set(id, "plusieurs_fiches");
  if (sure?.statut === "sure") {
    if (options.essai) return { statut: "rattacherait" };
    const { clientId, motif } = sure;
    try {
      await db.$transaction(async (tx) => {
        await validerRattachement(tx, { rencontreId, clientId, parAdminId: null });
        await tx.activityLog.create({
          data: {
            adminUserId: null,
            action: ACTION_RATTACHEMENT_AUTOMATIQUE,
            targetType: "Rencontre",
            targetId: rencontreId,
            changes: { origine: "automatique", clientId, motif },
          },
        });
        await tx.rencontre.update({
          where: { id: rencontreId },
          data: { clientProposeId: null, motifProposition: null },
        });
      });
    } catch (e) {
      if (e instanceof ErreurRattachement) {
        return await relireOuDoute(db, rencontreId, "rattachement_refuse");
      }
      throw e;
    }
    return { statut: "rattachee", clientId, relanceEnEchec: await apresRangement() };
  }

  // 2. Un doute sur l'identité (fiche proche, homonyme, domaine partagé, proposition
  // faible) ne bloque PAS (décision de Will, 24/10) : on crée une NOUVELLE fiche, marquée
  // « doublon possible » avec le lien vers les fiches proches. Seul un nom absent bloque.
  const identite = identiteDeLaFiche(declaree, { nom: ev.inviteeName });
  if (identite === null) return { statut: "doute", raison: "sans_nom" };
  const proposition = calculerProposition(indices, fiches);
  if (proposition !== null) proches.set(proposition.clientId, proposition.motif);
  const domaines = domainesProDe(indices);
  for (const f of fiches) {
    if (f.domainesPro.some((d) => domaines.has(d)))
      proches.set(f.id, proches.get(f.id) ?? "domaine");
  }
  const candidat = preparerCandidat({
    type: identite.type,
    raisonSociale: identite.raisonSociale,
    emails: [ev.inviteeEmail, ...invites],
    ville: identite.ville,
  });
  for (const p of trouverFichesProches(candidat, await chargerFichesCandidates(db, candidat))) {
    proches.set(p.ficheId, p.signal);
  }
  const lies: ProcheLie[] = [...proches].map(([ficheId, signal]) => ({ ficheId, signal }));
  if (options.essai) return { statut: "creerait", doublon: lies.length > 0 };

  // 3. Création par la porte unique, sans signature.
  let cree;
  try {
    cree = await creerProspectDepuisRencontre(db, {
      rencontreId,
      raisonSociale: identite.raisonSociale,
      type: identite.type,
      ville: identite.ville,
      parAdminId: null,
      // Les traces et l'alerte « doublon possible » s'écrivent DANS la transaction de la
      // création : jamais une fiche sans sa trace.
      apresCreation: async (tx, clientId) => {
        await tx.activityLog.create({
          data: {
            adminUserId: null,
            action: ACTION_CREATION_AUTOMATIQUE,
            targetType: "Client",
            targetId: clientId,
            changes: { origine: "automatique", rencontreId },
          },
        });
        if (lies.length > 0) {
          await tx.activityLog.create({
            data: {
              adminUserId: null,
              action: ACTION_DOUBLON_POSSIBLE,
              targetType: "Client",
              targetId: clientId,
              changes: {
                origine: "automatique",
                rencontreId,
                proches: lies.map((l) => ({ ...l })),
              },
            },
          });
          // L'alerte (envoyée ensuite par le balayage, tant que `notifiedAt` est vide).
          await tx.alerteSysteme.create({
            data: {
              code: CODES_ALERTES_VISIO.doublonPossible,
              niveau: "important",
              titre: "Fiche prospect créée : doublon possible",
              message:
                `Une fiche prospect a été créée toute seule au rendez-vous, mais ${lies.length} ` +
                `fiche(s) lui ressemble(nt). Le lien est dans son historique ; la fusion se fera ` +
                `quand le SIRET sera renseigné.`,
              cibleType: "Client",
              cibleId: clientId,
              metadata: { proches: lies.length },
            },
          });
        }
        // La proposition de la réservation est dépassée : la rencontre est rangée.
        await tx.rencontre.update({
          where: { id: rencontreId },
          data: { clientProposeId: null, motifProposition: null },
        });
      },
    });
  } catch (e) {
    if (e instanceof ErreurCreerProspect || e instanceof ErreurRattachement) {
      return await relireOuDoute(db, rencontreId, "creation_refusee");
    }
    throw e;
  }
  if (cree.statut !== "cree") return await relireOuDoute(db, rencontreId, "refus_porte");
  return {
    statut: "creee",
    clientId: cree.clientId,
    relanceEnEchec: await apresRangement(),
    proches: lies,
  };
}

/**
 * Un refus peut venir d'un passage simultané qui vient de ranger la rencontre :
 * on relit avant de compter un doute.
 */
async function relireOuDoute(db: Tx, rencontreId: string, raison: Raison): Promise<IssueFicheAuto> {
  const maintenant = await db.rencontre.findUnique({
    where: { id: rencontreId },
    select: { clientId: true },
  });
  if (maintenant?.clientId) return { statut: "deja_rangee" };
  return { statut: "doute", raison };
}

// ── Le passage ───────────────────────────────────────────────────────────────

export interface BilanFichesAuto {
  readonly mode: ModeFicheAuto;
  readonly creees: number;
  readonly rattachees: number;
  /** Doutes vus à CE passage. */
  readonly doutes: number;
  /** Rencontres dont le traitement a planté (réessayées au passage suivant). */
  readonly plantees: number;
  readonly relancesEnEchec: number;
  /** À blanc : ce qui serait fait. */
  readonly creeraient: number;
  readonly rattacheraient: number;
  /** Fiches créées à CE passage avec un doute d'identité (« doublon possible »). */
  readonly doublons: ReadonlyArray<{ readonly clientId: string; readonly proches: number }>;
  /** Ce qui attend Will (doutes déjà vus compris) ; 0 hors mode actif. */
  readonly aClasser: {
    readonly nombre: number;
    readonly raisons: Record<string, number>;
    /** Condensat court de l'ensemble trié des rendez-vous à classer (aucun nom ni adresse). */
    readonly empreinte: string;
  };
}

const BILAN_VIDE: BilanFichesAuto = {
  mode: "coupe",
  creees: 0,
  rattachees: 0,
  doutes: 0,
  plantees: 0,
  relancesEnEchec: 0,
  creeraient: 0,
  rattacheraient: 0,
  doublons: [],
  // Coupé ou à blanc : plus rien n'attend, l'alerte « à classer » éventuelle est résolue.
  aClasser: { nombre: 0, raisons: {}, empreinte: "" },
};

/** Le condensat court de l'ensemble TRIÉ des rencontres à classer : ni nom ni adresse. PUR. */
export function empreinteDe(ids: Iterable<string>): string {
  return createHash("sha256")
    .update([...ids].sort().join(","))
    .digest("hex")
    .slice(0, 12);
}

/** Les doutes déjà vus : leurs rencontres et leur raison. */
async function doutesVus(db: Tx): Promise<Array<{ id: string; raison: string }>> {
  const lignes = await db.activityLog.findMany({
    where: { action: ACTION_DOUTE_VU, targetType: "Rencontre", targetId: { not: null } },
    select: { targetId: true, changes: true },
    take: 5000,
  });
  return lignes.flatMap((l) => {
    const raison =
      l.changes !== null && typeof l.changes === "object" && !Array.isArray(l.changes)
        ? (l.changes as Record<string, unknown>)["raison"]
        : null;
    return l.targetId
      ? [{ id: l.targetId, raison: typeof raison === "string" ? raison : "doute" }]
      : [];
  });
}

/** Le passage : les rencontres Calendly créées depuis l'activation, encore à classer. */
export async function assurerLesFichesProspectAuto(
  db: BaseFicheAuto,
  options: Omit<OptionsFicheAuto, "essai"> & {
    readonly env?: Readonly<Record<string, string | undefined>>;
  } = {},
): Promise<BilanFichesAuto> {
  const mode = modeFicheAuto(options.env);
  const depuis = activeDepuis(options.env);
  if (mode === "coupe" || depuis === null) return { ...BILAN_VIDE, mode };
  const essai = mode === "essai";

  const vus = await doutesVus(db);
  // Seules les réservations captées depuis l'activation (et encore planifiées) sont candidates :
  // les anciennes n'occupent jamais les places du `take`. Le contrôle par rencontre reste un filet.
  const recentes = await db.calendlyEvent.findMany({
    where: { capturedAt: { gte: depuis }, status: "scheduled" },
    select: { id: true },
    orderBy: { capturedAt: "desc" },
    take: 2000,
  });
  const candidates = await db.rencontre.findMany({
    where: {
      source: "calendly",
      clientId: null,
      rattachementStatut: { in: ["a_classer", "propose"] },
      repriseHistorique: false,
      ...HORS_RENCONTRES_DE_TEST,
      calendlyEventId: { in: recentes.map((e) => e.id) },
      createdAt: { gte: depuis },
      ...(vus.length > 0 ? { id: { notIn: vus.map((v) => v.id) } } : {}),
      OR: [{ statut: null }, { statut: { notIn: ["annule", "absent"] } }],
    },
    select: { id: true },
    orderBy: { createdAt: "asc" },
    take: 200,
  });

  const c = { creees: 0, rattachees: 0, doutes: 0, plantees: 0, relances: 0, cr: 0, ra: 0 };
  const nouveaux: Array<{ id: string; raison: string }> = [];
  const doublons: Array<{ clientId: string; proches: number }> = [];
  for (const cand of candidates) {
    try {
      const issue = await assurerFicheProspectAuto(db, cand.id, { ...options, essai, depuis });
      if (issue.statut === "creee") {
        c.creees += 1;
        if (issue.proches.length > 0) {
          doublons.push({ clientId: issue.clientId, proches: issue.proches.length });
        }
      } else if (issue.statut === "rattachee") c.rattachees += 1;
      else if (issue.statut === "creerait") c.cr += 1;
      else if (issue.statut === "rattacherait") c.ra += 1;
      else if (issue.statut === "doute") {
        c.doutes += 1;
        nouveaux.push({ id: cand.id, raison: issue.raison });
        if (!essai) {
          await db.activityLog.create({
            data: {
              adminUserId: null,
              action: ACTION_DOUTE_VU,
              targetType: "Rencontre",
              targetId: cand.id,
              changes: { origine: "automatique", raison: issue.raison },
            },
          });
        }
      }
      if ("relanceEnEchec" in issue && issue.relanceEnEchec) c.relances += 1;
    } catch {
      c.plantees += 1;
    }
  }

  let aClasser: BilanFichesAuto["aClasser"] = { nombre: 0, raisons: {}, empreinte: "" };
  if (!essai) {
    const tous = [...vus, ...(essai ? [] : nouveaux)];
    const ouverts =
      tous.length > 0
        ? await db.rencontre.findMany({
            where: {
              id: { in: tous.map((t) => t.id) },
              clientId: null,
              rattachementStatut: { in: ["a_classer", "propose"] },
              // Un rendez-vous annulé ou absent n'attend plus personne.
              OR: [{ statut: null }, { statut: { notIn: ["annule", "absent"] } }],
            },
            select: { id: true },
          })
        : [];
    const ouvertsIds = new Set(ouverts.map((o) => o.id));
    const raisons: Record<string, number> = {};
    for (const t of tous) {
      if (ouvertsIds.has(t.id)) raisons[t.raison] = (raisons[t.raison] ?? 0) + 1;
    }
    aClasser = { nombre: ouvertsIds.size, raisons, empreinte: empreinteDe(ouvertsIds) };
  }
  return {
    mode,
    creees: c.creees,
    rattachees: c.rattachees,
    doutes: c.doutes,
    plantees: c.plantees,
    relancesEnEchec: c.relances,
    creeraient: c.cr,
    rattacheraient: c.ra,
    doublons,
    aClasser,
  };
}
