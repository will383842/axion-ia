/**
 * Formateurs indépendants — les relances SANS déclencheur jusqu'ici (lot C, M16),
 * déclarées au registre des campagnes (CAMP-3) comme S3 et S6 :
 *
 *   · F18 — le contrat-cadre pas encore signé : J+3 puis J+7 après F16 ;
 *   · F45 — la nouvelle version du contrat : J+7 puis J+21 après l'envoi ;
 *   · F27 — la lettre de mission pas encore signée : une 1re relance 2 jours après
 *     F26, puis une seconde 3 jours avant le début. Rien après le début ;
 *   · F21 — le numéro de déclaration d'activité « en cours » : 30 puis 60 jours après
 *     la contresignature, et une ALERTE interne à 90 jours.
 *
 * Aucune règle de relance propre : le moteur commun décide (`lib/relances/campagne.ts`),
 * le passage horaire envoie (8 h - 19 h, une par personne et par jour).
 *
 * 🔴 ÉTEINT : F18 et F45 ne partent qu'avec `dossier_en_ligne` ET `relances_auto` allumés ;
 * F27 avec `lettre_auto` ; F21 comme F18. Texte validé exigé par l'adaptateur d'envoi.
 *
 * 🔑 Le lien de signature d'un contrat est émis AU MOMENT de l'envoi (`completerPayload`),
 * et seulement si le texte est validé : émettre un lien révoque le précédent, on ne le
 * fait donc jamais pour une relance qui ne part pas.
 *
 * Module neutre (ni `server-only`, ni Next) : le passage tourne dans le worker.
 */

import type { EtapeCampagne, EtatCampagne, RegleCampagne } from "@/lib/relances/campagne";
import { FENETRE_ENVOI_PAR_DEFAUT } from "@/lib/relances/campagne";
import { prisma } from "@/lib/prisma";
import { hashEmailForLookup } from "@/lib/security/email-hash";
import { sendTelegram } from "@/lib/telegram";
import { normaliserAdresse } from "@/server/email/opposition-jeton";
import { journaliser } from "@/server/journal/journaliser";
import type { DeclarationCampagne, FaitsCampagne } from "@/server/relances/registre-campagnes";
import { FORMATEUR_BASE_PATH } from "@/server/formateur/routes";

import { lireDrapeauEnvoi } from "./interrupteurs";
import { lireEtatsInterrupteurs } from "./interrupteurs-etat";

const JOUR_MS = 86_400_000;
const PLAFOND_LIGNES = 500;

const estEffacee = (adresse: string): boolean =>
  adresse.endsWith("@erased.local") || adresse === "[erased-rgpd-art17]";

function lienEspace(suite = ""): string | null {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  return site ? `${site}${FORMATEUR_BASE_PATH}${suite}` : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Les règles
// ─────────────────────────────────────────────────────────────────────────────

const regle = <E extends string>(
  etapes: readonly EtapeCampagne<E>[],
  ecartMinJours: number,
  silenceJours: number,
): RegleCampagne<E> => ({
  etapes,
  ecartMinMs: ecartMinJours * JOUR_MS,
  silenceApresMs: silenceJours * JOUR_MS,
  max: etapes.length,
  unParJour: true,
  fenetre: FENETRE_ENVOI_PAR_DEFAUT,
});

/** F18 : 3 puis 7 jours après F16 ; rien après 14 jours. */
export const REGLE_CONTRAT = regle(
  [
    { id: "j3", delaiMs: 3 * JOUR_MS },
    { id: "j7", delaiMs: 7 * JOUR_MS },
  ],
  2,
  14,
);

/** F45 : 7 puis 21 jours après l'envoi ; le délai de signature est de 30 jours. */
export const DELAI_NOUVELLE_VERSION_JOURS = 30;
export const REGLE_NOUVELLE_VERSION = regle(
  [
    { id: "j7", delaiMs: 7 * JOUR_MS },
    { id: "j21", delaiMs: 21 * JOUR_MS },
  ],
  7,
  DELAI_NOUVELLE_VERSION_JOURS,
);

/** F27, 1re relance : 2 jours après F26. */
export const REGLE_LETTRE_1RE = regle([{ id: "1re", delaiMs: 2 * JOUR_MS }], 1, 60);
/** F27, seconde : l'origine EST « 3 jours avant le début » ; elle meurt au début. */
export const REGLE_LETTRE_J3 = regle([{ id: "j-3", delaiMs: 0 }], 1, 3);

/** F21 : 30 puis 60 jours après la contresignature. */
export const REGLE_NDA = regle(
  [
    { id: "j30", delaiMs: 30 * JOUR_MS },
    { id: "j60", delaiMs: 60 * JOUR_MS },
  ],
  15,
  90,
);
export const ALERTE_NDA_JOURS = 90;

// ─────────────────────────────────────────────────────────────────────────────
// Contrat-cadre : F18 et F45
// ─────────────────────────────────────────────────────────────────────────────

const F16 = "formateur-contrat-a-signer";
const F18 = "formateur-contrat-relance";
const F45 = "formateur-contrat-nouvelle-version";
/** Les relances de F45 ont leur propre préfixe de clé : l'envoi de départ n'en porte pas. */
export const ID_CAMPAGNE_VERSION = "contrat-version-relance";
export const ID_CAMPAGNE_CONTRAT = "contrat-relance";
const PREFIXE_RELANCES_VERSION = `fi-${ID_CAMPAGNE_VERSION}-`;

export interface LigneContrat {
  readonly trainerId: string;
  readonly email: string;
  readonly prenom: string;
  readonly documentId: string;
  readonly fermee: boolean;
  /** Dernier envoi du lien du contrat (F16 ou F45), parti ou en file. */
  readonly origine: {
    readonly id: string;
    readonly at: Date;
    readonly gabarit: typeof F16 | typeof F45;
  } | null;
  /** Relances déjà tentées depuis cette origine, par campagne. */
  readonly relances: readonly Date[];
  readonly adresseMorte: boolean;
  readonly opposition: boolean;
}

/** Texte validé ? Importé à la demande : l'adaptateur d'envoi tire la file d'e-mails. */
async function texteEstValide(gabarit: string): Promise<boolean> {
  const { texteValide } = await import("./envois");
  return texteValide(gabarit as Parameters<typeof texteValide>[0]);
}

function etatDe(l: LigneContrat, origine: Date): EtatCampagne {
  return {
    origine,
    envois: l.relances,
    efface: estEffacee(l.email),
    opposition: l.opposition,
    adresseMorte: l.adresseMorte,
    close: l.fermee,
    actionFaite: false,
    reponseHumaine: false,
  };
}

/** Les faits de F18 (`gabarit` F16) ou de F45 (`gabarit` F45) ; `null` si la ligne est d'une autre campagne. */
export function faitsContrat(
  l: LigneContrat,
  campagne: "contrat" | "version",
  maintenant: Date,
): FaitsCampagne | null {
  if (l.origine === null) return null;
  if (campagne === "contrat" && l.origine.gabarit !== F16) return null;
  if (campagne === "version" && l.origine.gabarit !== F45) return null;
  const gabarit = campagne === "contrat" ? F18 : F45;
  const origine = l.origine;
  return {
    entityId: l.trainerId,
    personneId: l.trainerId,
    origineId: origine.id,
    destinataire: l.email,
    etat: etatDe(l, origine.at),
    payload: { ...(l.prenom.trim() ? { prenom: l.prenom.trim() } : {}) },
    completerPayload: async (payload) => {
      if (!(await texteEstValide(gabarit))) return null;
      const { emettreLienSignatureSystem } =
        await import("@/server/qualiopi/documents/signature/emettre-lien-signature");
      const lien = await emettreLienSignatureSystem(l.documentId, "sous_traitant");
      if ("error" in lien) return null;
      const restant = Math.max(
        0,
        Math.ceil(
          (DELAI_NOUVELLE_VERSION_JOURS * JOUR_MS - (maintenant.getTime() - origine.at.getTime())) /
            JOUR_MS,
        ),
      );
      return {
        ...payload,
        lien: lien.data.url,
        ...(campagne === "version" ? { valeurs: { N: String(restant) } } : {}),
      };
    },
  };
}

async function lireLignesContrat(maintenant: Date): Promise<LigneContrat[]> {
  const depuis = new Date(maintenant.getTime() - 40 * JOUR_MS);
  const docs = await prisma.documentGenere.findMany({
    where: {
      type: "contrat_sous_traitance",
      annuleeAt: null,
      sousTraitantId: null,
      trainerId: { not: null },
      statutSignature: { in: ["en_attente", "partielle"] },
      createdAt: { gte: depuis },
      trainer: { is: { statut: "sous_traitant", organismeSousTraitantId: null } },
    },
    orderBy: { createdAt: "desc" },
    take: PLAFOND_LIGNES,
    select: {
      id: true,
      trainerId: true,
      createdAt: true,
      signatures: { where: { revokedAt: null }, select: { partie: true } },
      trainer: { select: { email: true, prenom: true, finCollaborationAt: true } },
    },
  });
  // Un seul contrat par formateur : le plus récent, et seulement s'il n'est pas signé par lui.
  const parFormateur = new Map<string, (typeof docs)[number]>();
  for (const d of docs) {
    if (d.trainerId !== null && !parFormateur.has(d.trainerId)) parFormateur.set(d.trainerId, d);
  }
  const aRelancer = [...parFormateur.values()].filter(
    (d) => d.trainer !== null && !d.signatures.some((s) => s.partie === "sous_traitant"),
  );
  if (aRelancer.length === 0) return [];
  const ids = aRelancer.map((d) => d.trainerId as string);
  const [journal, oppositions] = await Promise.all([
    prisma.emailLog.findMany({
      where: {
        entityType: "Trainer",
        entityId: { in: ids },
        template: { in: [F16, F18, F45] },
        status: { not: "failed" },
        createdAt: { gte: depuis },
      },
      select: {
        id: true,
        entityId: true,
        template: true,
        jobId: true,
        status: true,
        createdAt: true,
        bounceType: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.emailOpposition.findMany({
      where: {
        emailHash: {
          in: aRelancer
            .map((d) => hashEmailForLookup(normaliserAdresse(d.trainer?.email ?? "")))
            .filter((h): h is string => h !== null),
        },
      },
      select: { emailHash: true },
    }),
  ]);
  const opposes = new Set(oppositions.map((o) => o.emailHash));
  return aRelancer.flatMap((d): LigneContrat[] => {
    const t = d.trainer;
    if (t === null) return [];
    const lignes = journal.filter((j) => j.entityId === d.trainerId);
    const estRelanceVersion = (j: (typeof lignes)[number]) =>
      (j.jobId ?? "").startsWith(PREFIXE_RELANCES_VERSION);
    // Une origine est un lien PARTI ou en file, envoyé APRÈS la préparation de cette pièce.
    const origines = lignes.filter(
      (j) =>
        (j.template === F16 || (j.template === F45 && !estRelanceVersion(j))) &&
        (j.status === "pending" || j.status === "sent") &&
        j.createdAt >= d.createdAt,
    );
    const derniere = origines.at(-1) ?? null;
    const empreinte = hashEmailForLookup(normaliserAdresse(t.email));
    return [
      {
        trainerId: d.trainerId as string,
        email: t.email,
        prenom: t.prenom,
        documentId: d.id,
        fermee: t.finCollaborationAt !== null,
        origine: derniere
          ? {
              id: derniere.id,
              at: derniere.createdAt,
              gabarit: derniere.template === F16 ? F16 : F45,
            }
          : null,
        relances: derniere
          ? lignes
              .filter(
                (j) =>
                  j.createdAt > derniere.createdAt &&
                  (derniere.template === F16 ? j.template === F18 : estRelanceVersion(j)),
              )
              .map((j) => j.createdAt)
          : [],
        adresseMorte: lignes.some((j) => j.bounceType === "hard"),
        opposition: empreinte !== null && opposes.has(empreinte),
      },
    ];
  });
}

export const CAMPAGNE_CONTRAT: DeclarationCampagne<"j3" | "j7"> = {
  id: ID_CAMPAGNE_CONTRAT,
  gabarit: F18,
  entityType: "Trainer",
  classe: "B",
  regle: REGLE_CONTRAT,
  interrupteurs: ["dossier_en_ligne", "relances_auto"],
  lireFaits: async (maintenant) =>
    (await lireLignesContrat(maintenant)).flatMap((l) => {
      const f = faitsContrat(l, "contrat", maintenant);
      return f === null ? [] : [f];
    }),
};

export const CAMPAGNE_NOUVELLE_VERSION: DeclarationCampagne<"j7" | "j21"> = {
  id: ID_CAMPAGNE_VERSION,
  gabarit: F45,
  entityType: "Trainer",
  classe: "B",
  regle: REGLE_NOUVELLE_VERSION,
  // F45 relance : variante 2 (J+7) puis 3 (J+21) du gabarit ; la variante 1 est l'envoi de départ.
  variante: (etape) => (etape === "j7" ? 2 : 3),
  interrupteurs: ["dossier_en_ligne", "relances_auto"],
  lireFaits: async (maintenant) =>
    (await lireLignesContrat(maintenant)).flatMap((l) => {
      const f = faitsContrat(l, "version", maintenant);
      return f === null ? [] : [f];
    }),
};

// ─────────────────────────────────────────────────────────────────────────────
// Lettre de mission : F27
// ─────────────────────────────────────────────────────────────────────────────

const F26 = "formateur-lettre-a-signer";
const F27 = "formateur-lettre-relance";
export const ID_CAMPAGNE_LETTRE_1RE = "lettre-1re";
export const ID_CAMPAGNE_LETTRE_J3 = "lettre-j3";

export interface LigneLettre {
  readonly trainerId: string;
  readonly email: string;
  readonly prenom: string;
  readonly documentId: string;
  readonly intitule: string;
  readonly debutSession: Date;
  readonly fermee: boolean;
  /** F26 : le dernier envoi de la lettre. */
  readonly envoyeeAt: Date | null;
  readonly origineLogId: string | null;
  /** Relances F27 de chaque campagne déjà tentées. */
  readonly relances1re: readonly Date[];
  readonly relancesJ3: readonly Date[];
  readonly adresseMorte: boolean;
  readonly opposition: boolean;
}

/**
 * Les faits d'une relance de lettre ; `null` si elle n'a pas lieu d'être.
 *   - « 1re » : 2 jours après F26, seulement si elle laisse un jour avant la seconde ;
 *   - « j-3 » : 3 jours avant le début, seulement si F26 est parti au moins un jour avant.
 * Rien après le début de la mission.
 */
export function faitsLettre(
  l: LigneLettre,
  quelle: "1re" | "j3",
  maintenant: Date,
): FaitsCampagne | null {
  const lien = lienEspace(`?lettre=${l.documentId}`);
  if (l.envoyeeAt === null || l.origineLogId === null || lien === null) return null;
  if (l.debutSession.getTime() <= maintenant.getTime()) return null;
  const j3 = new Date(l.debutSession.getTime() - 3 * JOUR_MS);
  let origine: Date;
  if (quelle === "1re") {
    origine = l.envoyeeAt;
    if (origine.getTime() + 2 * JOUR_MS > j3.getTime() - JOUR_MS) return null;
  } else {
    origine = j3;
    if (l.envoyeeAt.getTime() + JOUR_MS > j3.getTime()) return null;
  }
  return {
    entityId: l.trainerId,
    personneId: l.trainerId,
    origineId: l.documentId,
    destinataire: l.email,
    etat: {
      origine,
      envois: quelle === "1re" ? l.relances1re : l.relancesJ3,
      efface: estEffacee(l.email),
      opposition: l.opposition,
      adresseMorte: l.adresseMorte,
      close: l.fermee,
      actionFaite: false,
      reponseHumaine: false,
    },
    payload: {
      ...(l.prenom.trim() ? { prenom: l.prenom.trim() } : {}),
      lien,
      valeurs: { intitulé: l.intitule },
    },
  };
}

async function lireLignesLettre(maintenant: Date): Promise<LigneLettre[]> {
  const { STATUTS_ACCORD_DONNE } = await import("@/server/qualiopi/trainers/mission-formateur");
  const missions = await prisma.missionFormateur.findMany({
    where: {
      role: "principal",
      statut: { in: [...STATUTS_ACCORD_DONNE] },
      lettreMissionId: { not: null },
      trainer: { is: { statut: "sous_traitant", organismeSousTraitantId: null } },
      session: { is: { statut: "planifiee", dateDebut: { gt: maintenant } } },
      lettreMission: { is: { annuleeAt: null } },
    },
    orderBy: { id: "asc" },
    take: PLAFOND_LIGNES,
    select: {
      lettreMissionId: true,
      trainerId: true,
      trainer: { select: { email: true, prenom: true, finCollaborationAt: true } },
      session: { select: { titreSession: true, dateDebut: true } },
      lettreMission: {
        select: { signatures: { where: { revokedAt: null }, select: { partie: true } } },
      },
    },
  });
  const aRelancer = missions.filter(
    (m) =>
      m.lettreMissionId !== null &&
      m.lettreMission !== null &&
      !m.lettreMission.signatures.some((s) => s.partie === "formateur"),
  );
  if (aRelancer.length === 0) return [];
  const ids = [...new Set(aRelancer.map((m) => m.trainerId))];
  const depuis = new Date(maintenant.getTime() - 120 * JOUR_MS);
  const [journal, oppositions] = await Promise.all([
    prisma.emailLog.findMany({
      where: {
        entityType: "Trainer",
        entityId: { in: ids },
        template: { in: [F26, F27] },
        status: { not: "failed" },
        createdAt: { gte: depuis },
      },
      select: {
        id: true,
        entityId: true,
        template: true,
        jobId: true,
        status: true,
        createdAt: true,
        bounceType: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.emailOpposition.findMany({
      where: {
        emailHash: {
          in: aRelancer
            .map((m) => hashEmailForLookup(normaliserAdresse(m.trainer.email)))
            .filter((h): h is string => h !== null),
        },
      },
      select: { emailHash: true },
    }),
  ]);
  const opposes = new Set(oppositions.map((o) => o.emailHash));
  return aRelancer.map((m): LigneLettre => {
    const doc = m.lettreMissionId as string;
    const lignes = journal.filter((j) => j.entityId === m.trainerId);
    const envoi = lignes
      .filter(
        (j) =>
          j.template === F26 &&
          j.jobId === `${F26}-${doc}` &&
          (j.status === "pending" || j.status === "sent"),
      )
      .at(-1);
    const de = (id: string) =>
      lignes
        .filter(
          (j) =>
            j.template === F27 && (j.jobId ?? "").startsWith(`fi-${id}-${m.trainerId}-${doc}-`),
        )
        .map((j) => j.createdAt);
    const empreinte = hashEmailForLookup(normaliserAdresse(m.trainer.email));
    return {
      trainerId: m.trainerId,
      email: m.trainer.email,
      prenom: m.trainer.prenom,
      documentId: doc,
      intitule: m.session.titreSession,
      debutSession: m.session.dateDebut,
      fermee: m.trainer.finCollaborationAt !== null,
      envoyeeAt: envoi?.createdAt ?? null,
      origineLogId: envoi?.id ?? null,
      relances1re: de(ID_CAMPAGNE_LETTRE_1RE),
      relancesJ3: de(ID_CAMPAGNE_LETTRE_J3),
      adresseMorte: lignes.some((j) => j.bounceType === "hard"),
      opposition: empreinte !== null && opposes.has(empreinte),
    };
  });
}

const lettre = (quelle: "1re" | "j3") => async (maintenant: Date) =>
  (await lireLignesLettre(maintenant)).flatMap((l) => {
    const f = faitsLettre(l, quelle, maintenant);
    return f === null ? [] : [f];
  });

export const CAMPAGNE_LETTRE_1RE: DeclarationCampagne<"1re"> = {
  id: ID_CAMPAGNE_LETTRE_1RE,
  gabarit: F27,
  entityType: "Trainer",
  classe: "B",
  regle: REGLE_LETTRE_1RE,
  variante: () => 1,
  interrupteurs: ["lettre_auto"],
  lireFaits: lettre("1re"),
};

export const CAMPAGNE_LETTRE_J3: DeclarationCampagne<"j-3"> = {
  id: ID_CAMPAGNE_LETTRE_J3,
  gabarit: F27,
  entityType: "Trainer",
  classe: "B",
  regle: REGLE_LETTRE_J3,
  variante: () => 2,
  interrupteurs: ["lettre_auto"],
  lireFaits: lettre("j3"),
};

// ─────────────────────────────────────────────────────────────────────────────
// Numéro de déclaration d'activité « en cours » : F21 et l'alerte à 90 jours
// ─────────────────────────────────────────────────────────────────────────────

export const ID_CAMPAGNE_NDA = "nda-a-transmettre";

export interface LigneNda {
  readonly trainerId: string;
  readonly email: string;
  readonly prenom: string;
  readonly fermee: boolean;
  /** La contresignature du contrat-cadre. */
  readonly contresigneAt: Date;
  readonly relances: readonly Date[];
  readonly adresseMorte: boolean;
  readonly opposition: boolean;
}

/** Le numéro saisi dit-il « en cours » ? (même lecture que le contrôle du registre) */
export const ndaEstEnCours = (brut: string | null): boolean =>
  typeof brut === "string" && /en\s*cours/i.test(brut);

export function faitsNda(l: LigneNda): FaitsCampagne | null {
  const lien = lienEspace();
  if (lien === null) return null;
  return {
    entityId: l.trainerId,
    personneId: l.trainerId,
    origineId: l.contresigneAt.toISOString().slice(0, 10).replace(/-/g, ""),
    destinataire: l.email,
    etat: {
      origine: l.contresigneAt,
      envois: l.relances,
      efface: estEffacee(l.email),
      opposition: l.opposition,
      adresseMorte: l.adresseMorte,
      close: l.fermee,
      actionFaite: false,
      reponseHumaine: false,
    },
    payload: { ...(l.prenom.trim() ? { prenom: l.prenom.trim() } : {}), lien },
  };
}

async function lireLignesNda(_maintenant: Date): Promise<LigneNda[]> {
  const trainers = await prisma.trainer.findMany({
    where: {
      statut: "sous_traitant",
      organismeSousTraitantId: null,
      finCollaborationAt: null,
      actif: true,
      sousTraitantNda: { contains: "cours", mode: "insensitive" },
    },
    orderBy: { id: "asc" },
    take: PLAFOND_LIGNES,
    select: {
      id: true,
      email: true,
      prenom: true,
      sousTraitantNda: true,
      finCollaborationAt: true,
    },
  });
  const enCours = trainers.filter((t) => ndaEstEnCours(t.sousTraitantNda));
  if (enCours.length === 0) return [];
  const ids = enCours.map((t) => t.id);
  const [signatures, journal, oppositions] = await Promise.all([
    prisma.documentSignature.findMany({
      where: {
        partie: "axionia",
        revokedAt: null,
        documentGenere: {
          is: { type: "contrat_sous_traitance", annuleeAt: null, trainerId: { in: ids } },
        },
      },
      orderBy: { signeAt: "asc" },
      select: { signeAt: true, documentGenere: { select: { trainerId: true } } },
    }),
    prisma.emailLog.findMany({
      where: {
        entityType: "Trainer",
        entityId: { in: ids },
        template: "formateur-nda-a-transmettre",
        status: { not: "failed" },
      },
      select: { entityId: true, jobId: true, createdAt: true, bounceType: true },
    }),
    prisma.emailOpposition.findMany({
      where: {
        emailHash: {
          in: enCours
            .map((t) => hashEmailForLookup(normaliserAdresse(t.email)))
            .filter((h): h is string => h !== null),
        },
      },
      select: { emailHash: true },
    }),
  ]);
  const opposes = new Set(oppositions.map((o) => o.emailHash));
  return enCours.flatMap((t): LigneNda[] => {
    // La contresignature du contrat EN VIGUEUR : la plus ancienne (elle date l'activation).
    const premiere = signatures.find((s) => s.documentGenere?.trainerId === t.id);
    if (premiere === undefined) return [];
    const lignes = journal.filter((j) => j.entityId === t.id);
    const empreinte = hashEmailForLookup(normaliserAdresse(t.email));
    return [
      {
        trainerId: t.id,
        email: t.email,
        prenom: t.prenom,
        fermee: t.finCollaborationAt !== null,
        contresigneAt: premiere.signeAt,
        relances: lignes.map((j) => j.createdAt),
        adresseMorte: lignes.some((j) => j.bounceType === "hard"),
        opposition: empreinte !== null && opposes.has(empreinte),
      },
    ];
  });
}

export const CAMPAGNE_NDA: DeclarationCampagne<"j30" | "j60"> = {
  id: ID_CAMPAGNE_NDA,
  gabarit: "formateur-nda-a-transmettre",
  entityType: "Trainer",
  classe: "B",
  regle: REGLE_NDA,
  // Un seul texte (F21), sans variante par étape.
  variante: () => 1,
  interrupteurs: ["dossier_en_ligne", "relances_auto"],
  lireFaits: async (maintenant) =>
    (await lireLignesNda(maintenant)).flatMap((l) => {
      const f = faitsNda(l);
      return f === null ? [] : [f];
    }),
};

export const ACTION_ALERTE_NDA = "qualiopi.formateur.nda_alerte_90j";

/** Les formateurs à signaler : contresignés depuis 90 jours ou plus, numéro toujours « en cours ». */
export function ndaAAlerter(lignes: readonly LigneNda[], maintenant: Date): LigneNda[] {
  return lignes.filter(
    (l) =>
      !l.fermee && maintenant.getTime() - l.contresigneAt.getTime() >= ALERTE_NDA_JOURS * JOUR_MS,
  );
}

/**
 * Alerte INTERNE (Telegram, sans nom) : une fois par formateur, tracée au journal. Appelée
 * par le passage horaire, sous les interrupteurs de F21. Ne lève jamais.
 */
export async function alerterNdaNonTransmis(maintenant: Date): Promise<number> {
  try {
    const dues = ndaAAlerter(await lireLignesNda(maintenant), maintenant);
    if (dues.length === 0) return 0;
    const deja = await prisma.activityLog.findMany({
      where: { action: ACTION_ALERTE_NDA, targetId: { in: dues.map((l) => l.trainerId) } },
      select: { targetId: true },
    });
    const dejaFaits = new Set(deja.map((a) => a.targetId));
    let n = 0;
    for (const l of dues) {
      if (dejaFaits.has(l.trainerId)) continue;
      const ecrit = await journaliser(prisma, {
        action: ACTION_ALERTE_NDA,
        targetType: "Trainer",
        targetId: l.trainerId,
        changes: { joursDepuisContresignature: ALERTE_NDA_JOURS },
        session: null,
      });
      if (!ecrit) continue; // sans trace, pas d'alerte : elle se répéterait à chaque passage
      await sendTelegram({
        tag: "AUTO",
        body: `📌 Un formateur indépendant n'a toujours pas transmis son numéro de déclaration d'activité, ${ALERTE_NDA_JOURS} jours après la contresignature. Fiche : ${l.trainerId}`,
      }).catch(() => false);
      n++;
    }
    return n;
  } catch {
    return 0;
  }
}

/**
 * Le passage horaire de l'alerte : sous les interrupteurs de F21 (`dossier_en_ligne` ET
 * `relances_auto`), de 8 h à 19 h (Paris). Éteint : rien n'est lu au-delà d'eux.
 */
export async function passerAlerteNda(maintenant: Date): Promise<number> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) return 0;
  const heure = Number(
    new Intl.DateTimeFormat("fr-FR", { hour: "numeric", hour12: false, timeZone: "Europe/Paris" })
      .formatToParts(maintenant)
      .find((p) => p.type === "hour")?.value ?? "0",
  );
  if (heure < 8 || heure >= 19) return 0;
  try {
    const etats = await lireEtatsInterrupteurs();
    if (!lireDrapeauEnvoi(etats, "dossier_en_ligne") || !lireDrapeauEnvoi(etats, "relances_auto")) {
      return 0;
    }
  } catch {
    return 0;
  }
  return alerterNdaNonTransmis(maintenant);
}
