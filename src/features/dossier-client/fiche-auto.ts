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
 * tout cas DOUTEUX. Pour un rendez-vous Calendly, Will a décidé que le geste
 * « Créer la fiche prospect » se fait seul — mais SEULEMENT quand la porte
 * unique l'accepte sans qu'il faille juger.
 *
 * ## Les trois issues, dans l'ordre
 *
 *   1. une proposition SÛRE existe (`email_calendly`, `contact_connu`,
 *      `demande_liee`, `report` : l'adresse ou la demande identifie la fiche) →
 *      la rencontre y est RANGÉE (`validerRattachement`). Le statut de la fiche
 *      n'est jamais touché : un client le reste, un prospect le reste ;
 *   2. aucune fiche ne ressemble → la fiche prospect est CRÉÉE par la porte
 *      unique (`creerProspectDepuisRencontre`) : raison sociale = « Nom de
 *      l'entreprise » déclaré dans Calendly, à défaut le nom de l'invité (type
 *      particulier). Jamais de SIREN : il ne se pose que d'un clic de Will ;
 *   3. un DOUTE → rien n'est écrit, la rencontre reste « à classer » et le
 *      passage la compte (bilan Telegram du balayage) :
 *        · `refuse_siren` / `motif_requis` de la porte ;
 *        · une proposition FAIBLE (`domaine_email`, `entreprise_declaree` : un
 *          collègue ou un homonyme n'est pas la même personne) ;
 *        · un domaine professionnel partagé par plusieurs fiches (ambigu) ;
 *        · aucun auteur automatique disponible.
 *
 * ## Qui signe
 *
 * Aucun identifiant « système » n'existe dans le code (les journaux acceptent
 * `null`, mais `creerProspectDepuisRencontre` exige un auteur). L'auteur est le
 * premier `super_admin` actif — la fiche porte la signature du propriétaire.
 *
 * ## Idempotence (cadence de 5 min, deux passages simultanés)
 *
 * Une rencontre déjà rangée n'est plus candidate. Deux passages en même temps :
 * la porte prend un verrou sur l'adresse du titulaire ; le second trouve la fiche
 * du premier, et la rencontre déjà rangée est relue AVANT de compter un refus.
 * Le même titulaire qui réserve deux fois retombe sur sa fiche (`email_calendly`).
 *
 * ## Interrupteur
 *
 * `DOSSIER_FICHE_AUTO` : absent = actif, `"false"` coupe. En test, coupé sauf
 * `"true"` explicite (un test qui l'oublie n'écrit aucune fiche).
 *
 * Module neutre (sans `server-only`, sans Next) : le balayage du worker l'importe.
 */

import { entrepriseDeclaree } from "@/features/admin-rendezvous/a-venir";
import { invitesSupplementaires } from "@/features/admin-rendezvous/visio";
import { domaineDe, natureAdresse } from "@/lib/email/nature-adresse";
import type { BaseTransactionnelle, Tx } from "./base";
import { creerProspectDepuisRencontre, ErreurCreerProspect } from "./creer-prospect";
import {
  chargerFichesPourRattachement,
  relancerApresRattachement,
  validerRattachement,
  type IndicesDeRattachement,
} from "./rattacher";

/** L'interrupteur d'arrêt (lu à l'exécution, jamais figé au build). */
export function ficheAutoActive(env: NodeJS.ProcessEnv = process.env): boolean {
  const brut = env["DOSSIER_FICHE_AUTO"];
  if (brut === "false") return false;
  if (env["NODE_ENV"] === "test" || env["VITEST"] !== undefined) return brut === "true";
  return true;
}

/** Les motifs qui IDENTIFIENT la fiche (l'adresse, la demande, le report). */
const MOTIFS_SURS: ReadonlySet<string> = new Set([
  "email_calendly",
  "contact_connu",
  "demande_liee",
  "report",
]);

export type IssueFicheAuto =
  | { readonly statut: "creee"; readonly clientId: string }
  | { readonly statut: "rattachee"; readonly clientId: string }
  | { readonly statut: "deja_rangee" }
  | { readonly statut: "ignoree" }
  | { readonly statut: "laissee_a_classer"; readonly raison: string };

export interface BilanFichesAuto {
  readonly creees: number;
  readonly rattachees: number;
  readonly laisseesAClasser: number;
  readonly relancesEnEchec: number;
}

export type BaseFicheAuto = Tx & BaseTransactionnelle;

export interface OptionsFicheAuto {
  /** Remplace `relancerApresRattachement` (tests). */
  readonly relancer?: (rencontreId: string) => Promise<unknown>;
}

/** Le premier super_admin actif : l'auteur des gestes automatiques. */
async function auteurAutomatique(db: Tx): Promise<string | null> {
  const a = await db.adminUser.findFirst({
    where: { role: "super_admin", status: "active" },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  return a?.id ?? null;
}

/** Raison sociale + type de la fiche à créer. PUR. */
export function identiteDeLaFiche(
  declaree: { nom: string | null; ville: string | null },
  invite: { nom: string | null; email: string | null },
): { raisonSociale: string; type: "entreprise" | "particulier"; ville: string | null } | null {
  const nom = (declaree.nom ?? "").trim();
  if (nom !== "") return { raisonSociale: nom, type: "entreprise", ville: declaree.ville };
  const personne = (invite.nom ?? "").trim() || (invite.email ?? "").split("@")[0]?.trim() || "";
  if (personne === "") return null;
  return { raisonSociale: personne, type: "particulier", ville: declaree.ville };
}

/** Traite UNE rencontre Calendly encore à classer. Voir l'en-tête. */
export async function assurerFicheProspectAuto(
  db: BaseFicheAuto,
  rencontreId: string,
  options: OptionsFicheAuto = {},
): Promise<IssueFicheAuto & { readonly relanceEnEchec?: boolean }> {
  const r = await db.rencontre.findUnique({
    where: { id: rencontreId },
    select: {
      id: true,
      source: true,
      clientId: true,
      rattachementStatut: true,
      clientProposeId: true,
      motifProposition: true,
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

  const ev = await db.calendlyEvent.findUnique({
    where: { id: r.calendlyEventId },
    select: { inviteeName: true, inviteeEmail: true, rawPayload: true },
  });
  if (ev === null) return { statut: "ignoree" };

  const auteur = await auteurAutomatique(db);
  if (auteur === null) return { statut: "laissee_a_classer", raison: "aucun_auteur" };

  // Le balayage passe le vrai client Prisma du worker (la relance en a besoin en entier).
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

  // 1. Proposition sûre → rattachement.
  if (r.clientProposeId !== null) {
    if (r.motifProposition === null || !MOTIFS_SURS.has(r.motifProposition)) {
      return { statut: "laissee_a_classer", raison: "proposition_faible" };
    }
    const clientId = r.clientProposeId;
    try {
      await db.$transaction((tx) =>
        validerRattachement(tx, { rencontreId, clientId, parAdminId: auteur }),
      );
    } catch {
      return await relireOuLaisser(db, rencontreId, "rattachement_refuse");
    }
    return { statut: "rattachee", clientId, relanceEnEchec: await apresRangement() };
  }

  // 2. Aucune proposition : une fiche proche mais ambiguë n'est jamais forcée.
  const invites = invitesSupplementaires(ev.rawPayload);
  const declaree = entrepriseDeclaree(ev.rawPayload);
  const indices: IndicesDeRattachement = {
    emailTitulaire: ev.inviteeEmail,
    emailsInvites: invites,
    entrepriseDeclaree: declaree.nom,
    clientDuReport: null,
    demandeLiee: null,
  };
  const domainesPro = new Set(
    [ev.inviteeEmail, ...invites]
      .filter((a): a is string => !!a && a.includes("@") && natureAdresse(a) === "pro")
      .map((a) => domaineDe(a.trim().toLowerCase())),
  );
  if (domainesPro.size > 0) {
    const fiches = await chargerFichesPourRattachement(db, indices);
    if (fiches.some((f) => f.domainesPro.some((d) => domainesPro.has(d)))) {
      return { statut: "laissee_a_classer", raison: "fiche_proche_ambigue" };
    }
  }

  // 3. Création par la porte unique.
  const identite = identiteDeLaFiche(declaree, { nom: ev.inviteeName, email: ev.inviteeEmail });
  if (identite === null) return { statut: "laissee_a_classer", raison: "sans_nom" };
  let cree;
  try {
    cree = await creerProspectDepuisRencontre(db, {
      rencontreId,
      raisonSociale: identite.raisonSociale,
      type: identite.type,
      ville: identite.ville,
      parAdminId: auteur,
    });
  } catch (e) {
    if (e instanceof ErreurCreerProspect) {
      return await relireOuLaisser(db, rencontreId, "creation_refusee");
    }
    throw e;
  }
  if (cree.statut !== "cree") {
    return await relireOuLaisser(db, rencontreId, cree.statut);
  }
  return { statut: "creee", clientId: cree.clientId, relanceEnEchec: await apresRangement() };
}

/**
 * Un refus peut venir d'un passage simultané qui vient de ranger la rencontre :
 * on relit avant de compter un doute.
 */
async function relireOuLaisser(
  db: Tx,
  rencontreId: string,
  raison: string,
): Promise<IssueFicheAuto> {
  const maintenant = await db.rencontre.findUnique({
    where: { id: rencontreId },
    select: { clientId: true },
  });
  if (maintenant?.clientId) return { statut: "deja_rangee" };
  return { statut: "laissee_a_classer", raison };
}

/** Le passage : toutes les rencontres Calendly encore à classer. */
export async function assurerLesFichesProspectAuto(
  db: BaseFicheAuto,
  options: OptionsFicheAuto & { readonly env?: NodeJS.ProcessEnv } = {},
): Promise<BilanFichesAuto> {
  const vide: BilanFichesAuto = {
    creees: 0,
    rattachees: 0,
    laisseesAClasser: 0,
    relancesEnEchec: 0,
  };
  if (!ficheAutoActive(options.env)) return vide;
  const candidates = await db.rencontre.findMany({
    where: {
      source: "calendly",
      clientId: null,
      rattachementStatut: { in: ["a_classer", "propose"] },
      repriseHistorique: false,
      estTestInterne: false,
      calendlyEventId: { not: null },
    },
    select: { id: true },
    orderBy: { createdAt: "asc" },
    take: 200,
  });
  let creees = 0;
  let rattachees = 0;
  let laisseesAClasser = 0;
  let relancesEnEchec = 0;
  for (const c of candidates) {
    const issue = await assurerFicheProspectAuto(db, c.id, options);
    if (issue.statut === "creee") creees += 1;
    else if (issue.statut === "rattachee") rattachees += 1;
    else if (issue.statut === "laissee_a_classer") laisseesAClasser += 1;
    if ("relanceEnEchec" in issue && issue.relanceEnEchec) relancesEnEchec += 1;
  }
  return { creees, rattachees, laisseesAClasser, relancesEnEchec };
}
