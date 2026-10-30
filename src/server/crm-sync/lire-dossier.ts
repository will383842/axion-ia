/**
 * LECTURE du dossier d'un client pour la synchro (console ↔ CRM, 25/10/2026).
 * Module de lecture seul, SANS file d'attente ni émission : le retour du CRM
 * (`retour-dossier.ts`) l'importe sans tirer BullMQ dans sa route.
 *
 * Colonnes en clair seulement. Les réponses des questionnaires ne sont ni
 * sélectionnées ni déchiffrées : on ne compte que des lignes.
 */

import { prisma } from "@/lib/prisma";
import { hashEmailForLookup } from "@/lib/security/email-hash";
import { sirenTransmis } from "@/server/partners-sync/producteurs/client";

import { santeDuCompte } from "@/features/dossier-client/fiche/sante-du-compte";
import { estFactureOuverte } from "@/server/qualiopi/financements/statuts-facture";

import { adressesOpposees } from "./oppositions-par-lot";
import type {
  ContactPourCrm,
  EntreeInstantaneCrm,
  EtapeCrm,
  FicheCompletePourCrm,
  RoleDecisionCrm,
} from "./instantane-dossier";

/**
 * Une lecture de la fiche complète : une panne rend `undefined` (la clé est OMISE),
 * elle n'arrête jamais l'envoi du reste du dossier.
 */
async function proteger<T>(lecture: () => Promise<T>): Promise<T | undefined> {
  try {
    return await lecture();
  } catch {
    return undefined;
  }
}

/** Minuit (UTC) du jour civil de Paris : `echeance_le` est une colonne DATE. */
function aujourdhuiParis(maintenant: Date): Date {
  const s = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(maintenant);
  return new Date(`${s}T00:00:00.000Z`);
}

const ETAPE_DU_STATUT: Readonly<Record<string, EtapeCrm | undefined>> = {
  prospect: "prospect",
  devis_envoye: "devis_envoye",
  client_actif: "client",
  client_inactif: "client",
  // « perdu » n'a pas d'équivalent côté CRM : la clé est omise, pas inventée.
};

/** Du plus décisif au moins décisif : un contact a UN rôle envoyé, toujours le même. */
const ORDRE_ROLES: readonly RoleDecisionCrm[] = [
  "decideur",
  "financeur",
  "influenceur",
  "bloqueur",
  "referent",
  "utilisateur",
  "autre",
];

function roleDuCrm(role: string): RoleDecisionCrm {
  return (ORDRE_ROLES as readonly string[]).includes(role) ? (role as RoleDecisionCrm) : "autre";
}

/** Rôle de chaque personne (le plus décisif de ses prestations) ; `undefined` si illisible. */
async function lireRoles(
  ids: readonly string[],
): Promise<Map<string, RoleDecisionCrm> | undefined> {
  return proteger(async () => {
    const lignes = await prisma.projetContact.findMany({
      where: { clientId: { in: [...ids] } },
      select: { contactId: true, role: true },
    });
    const roles = new Map<string, RoleDecisionCrm>();
    for (const l of lignes) {
      const r = roleDuCrm(l.role);
      const actuel = roles.get(l.contactId);
      if (actuel === undefined || ORDRE_ROLES.indexOf(r) < ORDRE_ROLES.indexOf(actuel)) {
        roles.set(l.contactId, r);
      }
    }
    return roles;
  });
}

/**
 * Les clés de la fiche complète (lot C1). Chaque lecture est PROTÉGÉE
 * séparément : en panne, sa clé manque et le reste part. Rien de textuel n'est
 * sélectionné (ni intitulé, ni note, ni étiquette, ni responsable, ni montant).
 */
async function lireFicheComplete(
  clientId: string,
  ids: readonly string[],
  statutClient: string,
  maintenant: Date,
  facturesFormation:
    | ReadonlyArray<{ statut: string; avoirDeId: string | null; echeanceAt: Date | null }>
    | undefined,
  rendezVousTenus: Date | null | undefined,
): Promise<FicheCompletePourCrm> {
  const aujourdhui = aujourdhuiParis(maintenant);
  const ouvertes = { clientId, faiteLe: null } as const;

  const [
    profil,
    prochaine,
    nbOuvertes,
    nbEnRetard,
    nbEmails,
    nbNotes,
    dernierEmail,
    cloture,
    questionnaire,
  ] = await Promise.all([
    proteger(() =>
      prisma.clientProfil.findUnique({ where: { clientId }, select: { archiveLe: true } }),
    ),
    proteger(() =>
      prisma.clientTache.findFirst({
        where: ouvertes,
        orderBy: [{ echeanceLe: "asc" }, { createdAt: "asc" }],
        // L'origine (relance, manuelle…) : jamais l'intitulé.
        select: { origine: true, echeanceLe: true },
      }),
    ),
    proteger(() => prisma.clientTache.count({ where: ouvertes })),
    proteger(() =>
      prisma.clientTache.count({ where: { ...ouvertes, echeanceLe: { lt: aujourdhui } } }),
    ),
    proteger(() => prisma.emailOutbox.count({ where: { clientId, statut: "envoye" } })),
    proteger(() => prisma.clientNote.count({ where: { clientId } })),
    proteger(() =>
      prisma.emailOutbox.findFirst({
        where: { clientId, statut: "envoye", envoyeAt: { not: null, lte: maintenant } },
        orderBy: { envoyeAt: "desc" },
        select: { envoyeAt: true },
      }),
    ),
    proteger(() =>
      prisma.projetSuivi.findFirst({
        where: {
          cloturePrevueLe: { not: null },
          projet: { clientId: { in: [...ids] }, statut: { in: ["ouvert", "gagne"] } },
        },
        orderBy: { cloturePrevueLe: "asc" },
        select: { cloturePrevueLe: true },
      }),
    ),
    proteger(() =>
      prisma.questionnaireAvantAudit.findFirst({
        where: {
          envoyeLe: { not: null },
          expireLe: { not: null },
          OR: [{ clientId: { in: [...ids] } }, { rencontre: { clientId: { in: [...ids] } } }],
        },
        orderBy: { envoyeLe: "desc" },
        // Une date : jamais `donnees` ni `html`.
        select: { expireLe: true },
      }),
    ),
  ]);

  const fiche: { -readonly [K in keyof FicheCompletePourCrm]: FicheCompletePourCrm[K] } = {};

  // Étape : « archive » gagne sur le statut ; profil illisible ⇒ clé omise (pas de devinette).
  if (profil !== undefined) {
    fiche.etape = profil?.archiveLe ? "archive" : (ETAPE_DU_STATUT[statutClient] ?? null);
  }
  if (cloture !== undefined) fiche.cloturePrevue = cloture?.cloturePrevueLe ?? null;
  if (prochaine !== undefined) {
    fiche.prochaineTache =
      prochaine === null ? null : { origine: prochaine.origine, echeanceLe: prochaine.echeanceLe };
  }
  // Une tâche ouverte sans nombre, ou l'inverse, serait incohérent : 0 tâche ⇒ clé omise.
  if (nbOuvertes !== undefined && nbOuvertes > 0) fiche.nbTachesOuvertes = nbOuvertes;
  if (nbEmails !== undefined) fiche.nbEmailsConsole = nbEmails;
  if (nbNotes !== undefined) fiche.nbNotesConsole = nbNotes;
  if (questionnaire !== undefined) fiche.questionnaireDateLimite = questionnaire?.expireLe ?? null;

  // Santé : seulement si TOUTES ses entrées sont lues (une entrée manquante ne vaut pas « bonne »).
  if (
    nbEnRetard !== undefined &&
    dernierEmail !== undefined &&
    facturesFormation !== undefined &&
    rendezVousTenus !== undefined
  ) {
    const dates = [rendezVousTenus, dernierEmail?.envoyeAt ?? null].filter(
      (d): d is Date => d instanceof Date,
    );
    const nbFacturesEnRetard = facturesFormation.filter(
      (f) =>
        f.avoirDeId === null &&
        estFactureOuverte(f.statut) &&
        (f.statut === "en_retard" ||
          (f.echeanceAt !== null &&
            aujourdhuiParis(f.echeanceAt).getTime() < aujourdhui.getTime())),
    ).length;
    fiche.sante = santeDuCompte({
      maintenant,
      dernierEchangeLe:
        dates.length === 0 ? null : new Date(Math.max(...dates.map((d) => d.getTime()))),
      nbFacturesEnRetard,
      nbTachesEnRetard: nbEnRetard,
    }).niveau;
  }
  return fiche;
}

function plusRecent(dates: ReadonlyArray<Date | null | undefined>, repli: Date): Date {
  let max = 0;
  for (const d of dates) if (d instanceof Date && d.getTime() > max) max = d.getTime();
  return new Date(max === 0 ? repli.getTime() : Math.min(max, repli.getTime()));
}

/**
 * Case « Facture établie hors console » (`client_factures_hors_console`, PR
 * #1684). La table peut ne pas exister encore (la migration atterrit avant le
 * code, mais pas forcément avant celui-ci) : absente ⇒ « non », jamais une
 * erreur. Lecture seule, une colonne (l'existence de la ligne).
 */
async function factureHorsConsole(clientIds: readonly string[]): Promise<boolean> {
  const lignes = await prisma.$queryRaw<Array<{ ok: boolean }>>`
    SELECT CASE WHEN to_regclass('client_factures_hors_console') IS NULL THEN false
           ELSE EXISTS (SELECT 1 FROM client_factures_hors_console WHERE client_id = ANY(${clientIds as string[]}::uuid[]))
           END AS ok`;
  return lignes[0]?.ok === true;
}

/** Lit un client et en fait l'entrée de la photo. `null` : à ne pas synchroniser. */
export async function lireEntreeDossier(
  clientId: string,
  maintenant: Date,
): Promise<{ entree: EntreeInstantaneCrm; dernierChangement: Date } | null> {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: {
      id: true,
      numero: true,
      type: true,
      raisonSociale: true,
      siren: true,
      siret: true,
      adresseRue: true,
      adresseCodePostal: true,
      adresseVille: true,
      effectif: true,
      statut: true,
      updatedAt: true,
      // Fusion non défaite : cette fiche est absorbée (rien n'est émis) ou absorbante
      // (elle lit aussi les pièces des fiches qu'elle a absorbées).
      fusionsAbsorbee: { where: { defaiteLe: null }, select: { id: true } },
      fusionsAbsorbante: { where: { defaiteLe: null }, select: { absorbeId: true } },
      contacts: {
        select: {
          id: true,
          nom: true,
          fonction: true,
          telephone: true,
          statut: true,
          origine: true,
          partiLe: true,
          updatedAt: true,
          adresses: {
            select: { email: true, nature: true, ajouteeLe: true },
            orderBy: { ajouteeLe: "asc" },
          },
        },
      },
    },
  });
  if (client === null || client.type !== "entreprise") return null;
  // Une fiche absorbée est un doublon fusionné : elle ne part pas comme dossier à part.
  if (client.fusionsAbsorbee.length > 0) return null;
  // Factures, case hors console et questionnaires : la fiche ET ses fiches absorbées.
  const ids = [clientId, ...client.fusionsAbsorbante.map((f) => f.absorbeId)];

  const [factures, horsConsole, questionnaires] = await Promise.all([
    prisma.factureFormation.findMany({
      where: {
        clientId: { in: ids },
        statut: { notIn: ["brouillon", "annulee"] },
        emiseAt: { not: null },
      },
      select: { emiseAt: true },
    }),
    factureHorsConsole(ids),
    prisma.questionnaireAvantAudit.findMany({
      where: { OR: [{ clientId: { in: ids } }, { rencontre: { clientId: { in: ids } } }] },
      select: {
        envoyeLe: true,
        // Des dates et des modes : jamais `donnees`.
        envois: { where: { ecarteLe: null }, select: { mode: true, recuLe: true } },
      },
    }),
  ]);

  const envoyes = questionnaires.flatMap((q) => (q.envoyeLe ? [q.envoyeLe] : []));
  const recus = questionnaires.flatMap((q) => q.envois.map((e) => e.recuLe));
  const equipe = questionnaires.reduce(
    (n, q) => n + q.envois.filter((e) => e.mode === "emp").length,
    0,
  );

  // L'opposition gagne : registre `email_oppositions`, sur TOUTES les adresses de
  // chaque contact (une personne opposée l'est quelle que soit l'adresse).
  const opposees = await adressesOpposees(
    client.contacts.flatMap((c) => c.adresses.map((a) => a.email)),
  );

  // Fiche complète : lectures PROTÉGÉES, une panne omet sa clé sans arrêter l'envoi.
  const [facturesFormation, rendezVousTenus, roles] = await Promise.all([
    proteger(() =>
      prisma.factureFormation.findMany({
        where: { clientId: { in: ids } },
        select: { statut: true, avoirDeId: true, echeanceAt: true },
      }),
    ),
    proteger(async () => {
      const r = await prisma.rencontre.findFirst({
        where: {
          clientId: { in: ids },
          statut: "tenu",
          debutPrevu: { not: null, lte: maintenant },
        },
        orderBy: { debutPrevu: "desc" },
        select: { debutPrevu: true },
      });
      return r?.debutPrevu ?? null;
    }),
    lireRoles(ids),
  ]);
  const fiche = await lireFicheComplete(
    clientId,
    ids,
    client.statut,
    maintenant,
    facturesFormation,
    rendezVousTenus,
  );

  const contacts: ContactPourCrm[] = client.contacts.map((c) => {
    // Pro d'abord ; une adresse non pro est repérée comme telle et ne part pas.
    const choisie = c.adresses.find((a) => a.nature === "pro") ?? c.adresses[0] ?? null;
    const email = choisie?.email ?? null;
    return {
      id: c.id,
      nom: c.nom,
      fonction: c.fonction,
      telephone: c.telephone,
      email,
      emailType: choisie === null ? null : choisie.nature === "pro" ? "pro" : "perso",
      origine: c.origine,
      emailHash: email === null ? null : hashEmailForLookup(email),
      oppose: c.adresses.some((a) => opposees.has(a.email.trim().toLowerCase())),
      parti: c.statut !== "actif" || c.partiLe !== null,
      roleDecision: roles?.get(c.id) ?? null,
    };
  });

  const entree: EntreeInstantaneCrm = {
    clientId: client.id,
    numero: client.numero,
    type: "entreprise",
    raisonSociale: client.raisonSociale,
    siren: sirenTransmis({ siren: client.siren, siret: client.siret }).siren,
    adresseRue: client.adresseRue,
    adresseCodePostal: client.adresseCodePostal,
    adresseVille: client.adresseVille,
    telephone: null,
    effectif: client.effectif,
    factureEmise: factures.length > 0,
    factureHorsConsole: horsConsole,
    questionnaire:
      questionnaires.length === 0
        ? null
        : {
            envoyeLe: envoyes.length
              ? new Date(Math.max(...envoyes.map((d) => d.getTime())))
              : null,
            recuLe: recus.length ? new Date(Math.max(...recus.map((d) => d.getTime()))) : null,
            nbReponsesEquipe: equipe,
          },
    contacts,
    fiche,
  };

  const dernierChangement = plusRecent(
    [
      client.updatedAt,
      ...client.contacts.map((c) => c.updatedAt),
      ...factures.map((f) => f.emiseAt),
      ...envoyes,
      ...recus,
    ],
    maintenant,
  );
  return { entree, dernierChangement };
}
