/**
 * L-INV — l'INVITATION AUTOMATIQUE à l'échange formateur (F1), ses rappels (S1 : F2, J+3 et
 * J+7, déclarés au registre commun des campagnes) et le RATTRAPAGE UNIQUE du stock (F55,
 * U7 b). Livré ÉTEINT.
 *
 * 🔴 Rien ne part tant que `formateurs.invitation_auto` ET `formateurs.suivi_echange` ne
 * sont pas allumés (sans le suivi, une réservation ne serait ni rattachée ni confirmée), et
 * tant que le texte n'est pas validé (l'adaptateur `envois.ts` le revérifie, le worker le
 * relit au départ). L'invitation automatique des APPORTEURS (`commercial-application/
 * invitation-auto.ts`) n'est pas touchée : autre population, autre file, autre gabarit.
 *
 * Règles :
 *   · F1 : 15 à 20 min après la candidature (balayage toutes les 5 min, fenêtre de 72 h),
 *     UNE par personne (empreinte d'adresse), jamais après une réservation (formateur ou
 *     apporteur), une fiche ouverte, un registre rouge, une opposition, une décision ;
 *   · S1 : rappels J+3 et J+7 au plus, rien après 14 jours, arrêt sur réservation (même
 *     annulée), réponse humaine, « J'ai répondu ailleurs », décision, fiche ouverte ;
 *   · clôture « sans suite » à J+30, SANS e-mail, si rien ne s'est passé ;
 *   · F55 : une seule fois, sans rappel, après l'aperçu de la liste figée et `confirmer=oui` ;
 *   · au plus 30 envois par passage ; relances et rattrapage portent `priority: 10` ;
 *   · `maintenant` est un PARAMÈTRE (le banc l'appelle avec son horloge).
 *
 * Aucun statut de recrutement n'est écrit : seulement `invitationFormateurAt`,
 * `rattrapageAt`, `clotureSansSuiteAt`.
 */

import { createHash } from "node:crypto";

import { FENETRE_ENVOI_PAR_DEFAUT, type RegleCampagne } from "@/lib/relances/campagne";
import { prisma } from "@/lib/prisma";
import type { DeclarationCampagne, FaitsCampagne } from "@/server/relances/registre-campagnes";

import {
  SELECT_CANDIDATURE_INVITATION,
  lireFaitsInvitation,
  motifNePasInviter,
  type CandidatureInvitation,
} from "./invitation-formateurs-faits";
import type { EnvoiFormateur, ResultatEnvoiFormateur } from "./envois";
import { lienEchangeFormateur } from "./jeton-reservation";

const MINUTE_MS = 60_000;
const JOUR_MS = 24 * 60 * MINUTE_MS;

export const DELAI_INVITATION_FORMATEUR_MS = 15 * MINUTE_MS;
export const FENETRE_INVITATION_FORMATEUR_MS = 72 * 60 * MINUTE_MS;
export const CLOTURE_SANS_SUITE_MS = 30 * JOUR_MS;
export const PLAFOND_INVITATIONS_PAR_PASSAGE = 30;
export const PRIORITE_RATTRAPAGE = 10;
/**
 * Budget horaire de F1, sous la boîte partagée (40 e-mails par heure pour tout le site) :
 * le balayage tourne toutes les 5 min, le plafond par passage seul autoriserait 360/h.
 */
export const BUDGET_F1_PAR_HEURE = 20;
export const FENETRE_CLOTURE_MS = 60 * JOUR_MS;
/** Le stock du rattrapage : les candidatures reçues depuis le 09/10/2026 (heure de Paris). */
export const DEBUT_STOCK_RATTRAPAGE = new Date("2026-10-08T22:00:00.000Z");

/**
 * Le lien d'invitation : la page du site, marquée pour le rattachement (`fa-<id>`), avec
 * le jeton signé qui préremplit la réservation (lot B, M25).
 */
export function lienInvitation(candidatureId: string): string {
  return lienEchangeFormateur(candidatureId);
}

function payloadInvitation(candidatureId: string, prenom: string | null): Record<string, unknown> {
  return { ...(prenom ? { prenom } : {}), lien: lienInvitation(candidatureId) };
}

export interface DependancesInvitation {
  /** `invitation_auto` ET `suivi_echange`. Lecture en échec : coupé. */
  readonly allume: () => Promise<boolean>;
  /**
   * Depuis quand les deux interrupteurs sont allumés (la plus récente écriture des deux
   * réglages). Le balayage n'invite que ce qui est arrivé APRÈS : le stock d'avant passe
   * par le rattrapage, avec aperçu. `null` : illisible, rien ne part.
   */
  readonly allumeLe: () => Promise<Date | null>;
  /** F1 enfilés ou garés dans l'heure écoulée. `null` : illisible, rien ne part. */
  readonly envoyesDerniereHeure: (maintenant: Date) => Promise<number | null>;
  readonly envoyer: (e: EnvoiFormateur) => Promise<ResultatEnvoiFormateur>;
}

async function allumeParDefaut(): Promise<boolean> {
  const { invitationAutoFormateursAllumee } = await import("./etats-entree");
  return invitationAutoFormateursAllumee();
}

async function allumeLeParDefaut(): Promise<Date | null> {
  const { dateAllumageInvitationFormateurs } = await import("./etats-entree");
  return dateAllumageInvitationFormateurs();
}

async function envoyesDerniereHeureParDefaut(maintenant: Date): Promise<number | null> {
  const depuis = new Date(maintenant.getTime() - 60 * MINUTE_MS);
  try {
    const [journal, corbeille] = await Promise.all([
      prisma.emailLog.count({
        where: { template: "formateur-invitation-echange", createdAt: { gte: depuis } },
      }),
      prisma.emailOutbox.count({
        where: { template: "formateur-invitation-echange", createdAt: { gte: depuis } },
      }),
    ]);
    return journal + corbeille;
  } catch {
    return null;
  }
}

async function envoyerParDefaut(e: EnvoiFormateur): Promise<ResultatEnvoiFormateur> {
  const { envoyer } = await import("./envois");
  return envoyer(e);
}

function dependances(deps?: Partial<DependancesInvitation>): DependancesInvitation {
  return {
    allume: deps?.allume ?? allumeParDefaut,
    allumeLe: deps?.allumeLe ?? allumeLeParDefaut,
    envoyesDerniereHeure: deps?.envoyesDerniereHeure ?? envoyesDerniereHeureParDefaut,
    envoyer: deps?.envoyer ?? envoyerParDefaut,
  };
}

const estPartie = (r: ResultatEnvoiFormateur) => r === "envoye" || r === "en-validation";
/** Panne ou texte pas encore validé : on retentera. Tout autre refus est définitif. */
const estPassager = (r: ResultatEnvoiFormateur) => r === "texte-non-valide" || r === "indisponible";

// ─── F1 : le balayage ─────────────────────────────────────────────────────────

export interface BilanInvitations {
  readonly allume: boolean;
  readonly invitees: number;
  readonly closes: number;
  readonly refus: number;
  readonly ecartees: Readonly<Record<string, number>>;
  readonly plafondAtteint: boolean;
}

export async function passerInvitationsFormateurs(
  maintenant: Date,
  deps?: Partial<DependancesInvitation>,
): Promise<BilanInvitations> {
  const ecartees: Record<string, number> = {};
  const vide = (allume: boolean): BilanInvitations => ({
    allume,
    invitees: 0,
    closes: 0,
    refus: 0,
    ecartees,
    plafondAtteint: false,
  });
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) return vide(false);
  const d = dependances(deps);
  let allume = false;
  try {
    allume = await d.allume();
  } catch {
    allume = false;
  }
  if (!allume) return vide(false);

  const t = maintenant.getTime();
  const [allumeLe, dejaCetteHeure] = await Promise.all([
    d.allumeLe(),
    d.envoyesDerniereHeure(maintenant),
  ]);
  if (allumeLe === null || dejaCetteHeure === null) {
    ecartees["etat-illisible"] = 1;
    return vide(true);
  }
  const plafond = Math.min(
    PLAFOND_INVITATIONS_PAR_PASSAGE,
    Math.max(0, BUDGET_F1_PAR_HEURE - dejaCetteHeure),
  );
  const candidates = (await prisma.jobApplication.findMany({
    where: {
      submittedAt: {
        gte: new Date(Math.max(t - FENETRE_INVITATION_FORMATEUR_MS, allumeLe.getTime())),
        lte: new Date(t - DELAI_INVITATION_FORMATEUR_MS),
      },
      status: "new",
      // L0c-3 (saisie en console) a sa propre case « Envoyer l'invitation ».
      origine: "formulaire",
      invitationFormateurAt: null,
      rattrapageAt: null,
      clotureSansSuiteAt: null,
    },
    orderBy: { submittedAt: "asc" },
    take: 200,
    select: SELECT_CANDIDATURE_INVITATION,
  })) as CandidatureInvitation[];

  const faits = await lireFaitsInvitation(candidates, () => null);
  const servies = new Set<string>();
  let invitees = 0;
  let refus = 0;
  let plafondAtteint = false;
  for (const c of candidates) {
    const f = faits.get(c.id);
    const motif = f ? motifNePasInviter(f) : "illisible";
    if (!f || motif) {
      ecartees[motif ?? "illisible"] = (ecartees[motif ?? "illisible"] ?? 0) + 1;
      continue;
    }
    if (servies.has(f.personneId)) {
      ecartees["deja-invitee"] = (ecartees["deja-invitee"] ?? 0) + 1;
      continue;
    }
    if (invitees + refus >= plafond) {
      plafondAtteint = true;
      break;
    }
    servies.add(f.personneId);
    const r = await d.envoyer({
      gabarit: "formateur-invitation-echange",
      destinataire: f.destinataire!,
      payload: payloadInvitation(c.id, f.prenom),
      entityType: "JobApplication",
      entityId: c.id,
      // Une par PERSONNE : la même clé pour toutes ses candidatures.
      jobId: `fi-invit-${f.personneId}`,
    });
    if (estPartie(r)) {
      await prisma.jobApplication.updateMany({
        where: { id: c.id, invitationFormateurAt: null },
        data: { invitationFormateurAt: maintenant },
      });
      invitees += 1;
      continue;
    }
    refus += 1;
    // Texte non validé ou file en panne : inutile d'enchaîner, le passage suivant reprend.
    if (estPassager(r)) break;
    // Refus DÉFINITIF (adresse retenue, crochet non rempli…) : la candidature est close
    // « sans suite », sans e-mail — sinon elle serait retentée toutes les 5 minutes.
    await prisma.jobApplication.updateMany({
      where: { id: c.id, clotureSansSuiteAt: null },
      data: { clotureSansSuiteAt: maintenant },
    });
  }

  const closes = await clorerSansSuite(maintenant);
  return { allume: true, invitees, closes, refus, ecartees, plafondAtteint };
}

/** J+30 sans réservation, sans réponse, sans décision : « sans suite », SANS e-mail. */
async function clorerSansSuite(maintenant: Date): Promise<number> {
  const invitees = (await prisma.jobApplication.findMany({
    where: {
      // Une fenêtre bornée (J+30 à J+60) : les candidatures qui ne se closent pas (réservé,
      // répondu) en sortent d'elles-mêmes au lieu de bloquer les suivantes.
      invitationFormateurAt: {
        gte: new Date(maintenant.getTime() - FENETRE_CLOTURE_MS),
        lte: new Date(maintenant.getTime() - CLOTURE_SANS_SUITE_MS),
      },
      clotureSansSuiteAt: null,
      status: "new",
    },
    orderBy: { invitationFormateurAt: "asc" },
    take: 200,
    select: SELECT_CANDIDATURE_INVITATION,
  })) as CandidatureInvitation[];
  if (invitees.length === 0) return 0;
  const faits = await lireFaitsInvitation(invitees, (c) => c.invitationFormateurAt);
  let closes = 0;
  for (const c of invitees) {
    const f = faits.get(c.id);
    if (!f || f.reserve || f.reponseHumaine || f.ficheOuverte) continue;
    const { count } = await prisma.jobApplication.updateMany({
      where: { id: c.id, clotureSansSuiteAt: null },
      data: { clotureSansSuiteAt: maintenant },
    });
    closes += count;
  }
  return closes;
}

// ─── S1 : les rappels, déclarés au registre commun des campagnes ─────────────

export const REGLE_S1: RegleCampagne<"j3" | "j7"> = {
  etapes: [
    { id: "j3", delaiMs: 3 * JOUR_MS },
    { id: "j7", delaiMs: 7 * JOUR_MS },
  ],
  ecartMinMs: 3 * JOUR_MS,
  silenceApresMs: 14 * JOUR_MS,
  max: 2,
  unParJour: true,
  fenetre: FENETRE_ENVOI_PAR_DEFAUT,
};

export const ID_CAMPAGNE_S1 = "invit-relance";

/** Les rappels déjà tentés pour cette candidature (journal ET corbeille). */
async function envoisS1(ids: readonly string[]): Promise<Map<string, Date[]>> {
  const sortie = new Map<string, Date[]>();
  if (ids.length === 0) return sortie;
  const [journal, corbeille] = await Promise.all([
    prisma.emailLog.findMany({
      where: {
        template: "formateur-invitation-relance",
        entityType: "JobApplication",
        entityId: { in: [...ids] },
        status: { not: "failed" },
      },
      select: { entityId: true, createdAt: true },
    }),
    prisma.emailOutbox.findMany({
      where: {
        template: "formateur-invitation-relance",
        entityType: "JobApplication",
        entityId: { in: [...ids] },
      },
      select: { entityId: true, createdAt: true },
    }),
  ]);
  for (const l of [...journal, ...corbeille]) {
    if (!l.entityId) continue;
    sortie.set(l.entityId, [...(sortie.get(l.entityId) ?? []), l.createdAt]);
  }
  return sortie;
}

export async function lireFaitsS1(maintenant: Date): Promise<readonly FaitsCampagne[]> {
  // Le registre commun ne lit que les seize ; `suivi_echange` (registre de l'entrée) est
  // relu ici : sans le suivi, un rappel mènerait à une réservation ni rattachée ni confirmée.
  const { lireEtatsEntree } = await import("./etats-entree");
  if (!(await lireEtatsEntree()).suivi_echange) return [];
  const candidatures = (await prisma.jobApplication.findMany({
    where: {
      invitationFormateurAt: {
        gte: new Date(maintenant.getTime() - REGLE_S1.silenceApresMs - JOUR_MS),
      },
    },
    take: 500,
    select: SELECT_CANDIDATURE_INVITATION,
  })) as CandidatureInvitation[];
  const faits = await lireFaitsInvitation(candidatures, (c) => c.invitationFormateurAt);
  const envois = await envoisS1(candidatures.map((c) => c.id));
  const sortie: FaitsCampagne[] = [];
  for (const c of candidatures) {
    const f = faits.get(c.id);
    if (!f || !c.invitationFormateurAt || !f.freelance) continue;
    const efface = f.destinataire === null;
    sortie.push({
      entityId: c.id,
      personneId: f.personneId,
      origineId: "f1",
      destinataire: f.destinataire ?? "",
      etat: {
        origine: c.invitationFormateurAt,
        envois: (envois.get(c.id) ?? []).filter((d) => d >= c.invitationFormateurAt!),
        efface,
        opposition: f.opposition,
        adresseMorte: f.adresseMorte,
        close: f.decidee || f.ficheOuverte || f.registreRouge,
        actionFaite: f.reserve,
        reponseHumaine: f.reponseHumaine,
      },
      payload: payloadInvitation(c.id, f.prenom),
    });
  }
  return sortie;
}

export const CAMPAGNE_S1: DeclarationCampagne<"j3" | "j7"> = {
  id: ID_CAMPAGNE_S1,
  gabarit: "formateur-invitation-relance",
  entityType: "JobApplication",
  classe: "A",
  regle: REGLE_S1,
  // La clé mère d'abord : couper l'invitation suspend ses rappels.
  interrupteurs: ["invitation_auto", "echange_ouvert", "textes_valides"],
  lireFaits: lireFaitsS1,
};

// ─── F55 : le rattrapage unique du stock (U7 b) ──────────────────────────────

export interface LigneRattrapage {
  readonly candidatureId: string;
  /** Prénom et initiale, pour l'aperçu de Will (console seulement). */
  readonly nom: string;
  readonly recueLe: Date;
}

export function empreinteRattrapage(ids: readonly string[]): string {
  return createHash("sha256")
    .update([...ids].sort().join("\n"))
    .digest("hex");
}

/**
 * La liste nominative du rattrapage : candidatures freelance reçues depuis le 09/10, plus
 * anciennes que la fenêtre du balayage (72 h), jamais invitées, jamais décidées, sans
 * réservation ni fiche — une ligne par personne (la plus récente).
 */
export async function listerRattrapage(
  maintenant: Date,
  allumeLe: () => Promise<Date | null> = allumeLeParDefaut,
): Promise<{
  lignes: LigneRattrapage[];
  destinataires: Map<string, { destinataire: string; prenom: string | null; personneId: string }>;
  empreinte: string;
}> {
  // Le stock = ce qui est arrivé AVANT l'allumage (le balayage prend la suite). Cohorte
  // figée : une candidature refusée par le balayage est close, elle n'y revient pas.
  const borne = await allumeLe();
  if (borne === null) {
    return { lignes: [], destinataires: new Map(), empreinte: empreinteRattrapage([]) };
  }
  void maintenant;
  const candidatures = (await prisma.jobApplication.findMany({
    where: {
      submittedAt: { gte: DEBUT_STOCK_RATTRAPAGE, lt: borne },
      status: "new",
      origine: "formulaire",
      invitationFormateurAt: null,
      rattrapageAt: null,
      clotureSansSuiteAt: null,
    },
    orderBy: { submittedAt: "desc" },
    take: 500,
    select: { ...SELECT_CANDIDATURE_INVITATION, lastName: true },
  })) as Array<CandidatureInvitation & { lastName: string }>;
  const faits = await lireFaitsInvitation(candidatures, () => null);
  const vues = new Set<string>();
  const lignes: LigneRattrapage[] = [];
  const destinataires = new Map<
    string,
    { destinataire: string; prenom: string | null; personneId: string }
  >();
  for (const c of candidatures) {
    const f = faits.get(c.id);
    if (!f || motifNePasInviter(f) || vues.has(f.personneId)) continue;
    vues.add(f.personneId);
    let initiale = "";
    try {
      const { decryptPii } = await import("@/lib/pii-crypto");
      initiale = decryptPii(c.lastName).trim().charAt(0);
    } catch {
      initiale = "";
    }
    lignes.push({
      candidatureId: c.id,
      nom: `${f.prenom ?? "?"}${initiale ? ` ${initiale}.` : ""}`,
      recueLe: c.submittedAt,
    });
    destinataires.set(c.id, {
      destinataire: f.destinataire!,
      prenom: f.prenom,
      personneId: f.personneId,
    });
  }
  return {
    lignes,
    destinataires,
    empreinte: empreinteRattrapage(lignes.map((l) => l.candidatureId)),
  };
}

export type ResultatRattrapage =
  | { ok: false; motif: "coupe" | "liste-changee" }
  | {
      ok: true;
      envoyes: number;
      refus: number;
      restants: number;
      empreinteAvant: string;
      nombreAvant: number;
    };

/**
 * Envoie F55 à la liste FIGÉE vue par Will : si la liste a changé depuis l'aperçu (son
 * empreinte), rien ne part. Au plus 30 par geste, `priority: 10`, une fois par personne.
 */
export async function envoyerRattrapage(
  maintenant: Date,
  empreinteVue: string,
  deps?: Partial<DependancesInvitation>,
): Promise<ResultatRattrapage> {
  const d = dependances(deps);
  if (!(await d.allume())) return { ok: false, motif: "coupe" };
  const liste = await listerRattrapage(maintenant, d.allumeLe);
  if (liste.empreinte !== empreinteVue) return { ok: false, motif: "liste-changee" };
  let envoyes = 0;
  let refus = 0;
  for (const l of liste.lignes) {
    if (envoyes + refus >= PLAFOND_INVITATIONS_PAR_PASSAGE) break;
    const dest = liste.destinataires.get(l.candidatureId)!;
    const r = await d.envoyer({
      gabarit: "formateur-invitation-rattrapage",
      destinataire: dest.destinataire,
      payload: payloadInvitation(l.candidatureId, dest.prenom),
      entityType: "JobApplication",
      entityId: l.candidatureId,
      jobId: `fi-rattrapage-${dest.personneId}`,
      priority: PRIORITE_RATTRAPAGE,
    });
    if (estPartie(r)) {
      await prisma.jobApplication.updateMany({
        where: { id: l.candidatureId, rattrapageAt: null },
        data: { rattrapageAt: maintenant },
      });
      envoyes += 1;
      continue;
    }
    refus += 1;
    if (estPassager(r)) break;
    // Refus définitif : close « sans suite », elle quitte la liste.
    await prisma.jobApplication.updateMany({
      where: { id: l.candidatureId, clotureSansSuiteAt: null },
      data: { clotureSansSuiteAt: maintenant },
    });
  }
  return {
    ok: true,
    envoyes,
    refus,
    restants: Math.max(0, liste.lignes.length - envoyes - refus),
    empreinteAvant: liste.empreinte,
    nombreAvant: liste.lignes.length,
  };
}
