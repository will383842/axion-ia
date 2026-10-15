// Banc @formateurs — ce que tout SCÉNARIO de vérification partage.
//
//   · un VERROU : les scénarios appellent les passages planifiés avec leur propre
//     `maintenant` (J+3, J+30…), et un passage traite TOUTE la base — celui d'un
//     scénario relancerait les candidatures d'un autre. Ils passent donc un par un
//     (verrou Redis), quel que soit le nombre de workers de Playwright ;
//   · un ADMINISTRATEUR du banc, réel en base (les actions de la console écrivent
//     son identifiant au journal), effacé avec son journal à la fin ;
//   · l'ALLUMAGE partagé (`allumage.ts`) ;
//   · le MÉNAGE : chaque scénario efface ce qu'il a écrit, personne par personne ;
//   · les INSTANTS : un passage de relance ne part qu'entre 8 h et 19 h à Paris.

import { randomUUID } from "node:crypto";

import { Redis } from "ioredis";

import { IDENTITE_LEGALE } from "@/lib/identite-legale-ssot";
import { hashEmailForLookup } from "@/lib/security/email-hash";

import { allumerLeBanc } from "./allumage";
import { prisma } from "./base";
import { lireJournalEnvois } from "./journal-envois";
import type { SessionBanc } from "./protocole";
import { messagesCaptes, viderPuitsPour } from "./puits-smtp";

/** Le worker tourne à part : on lui laisse le temps de prendre ses jobs. */
export const ATTENTE_WORKER = { timeout: 60_000, intervals: [500, 1_000, 2_000] };

const CLE_VERROU = "banc:formateurs:scenario";
const DUREE_VERROU_MS = 10 * 60_000;

export interface DecorScenario {
  readonly admin: SessionBanc;
  /** Rend une adresse fictive propre au scénario (domaine `example.test`). */
  adresse(role: string): string;
  /** Ce qui sera effacé à la fin (adresses et candidatures du scénario). */
  readonly adresses: Set<string>;
  liberer(): Promise<void>;
}

async function prendreVerrou(redis: Redis, jeton: string): Promise<void> {
  // Les scénarios s'enchaînent (~16 min au total) : le dernier peut attendre presque tout le banc.
  const limite = Date.now() + 40 * 60_000;
  while (Date.now() < limite) {
    const pris = await redis.set(CLE_VERROU, jeton, "PX", DUREE_VERROU_MS, "NX");
    if (pris === "OK") return;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("banc @formateurs : verrou des scénarios non obtenu en 40 min");
}

/** Ouvre un scénario : verrou, allumage, administrateur. */
export async function ouvrirScenario(
  nom: string,
  options: {
    /** Le scénario va jusqu'au contrat-cadre : l'identité de l'organisme est posée. */
    readonly organisme?: boolean;
  } = {},
): Promise<DecorScenario> {
  const redis = new Redis(process.env["REDIS_URL"] ?? "redis://localhost:6379", {
    maxRetriesPerRequest: 2,
  });
  const jeton = `${nom}:${randomUUID()}`;
  await prendreVerrou(redis, jeton);
  // Le worker de production bride les e-mails à 40 par heure (`email-worker.ts`,
  // `limiter`) pour protéger la boîte réelle. Devant un puits, ce bridage n'a pas
  // d'objet, et un banc complet dépasse 40 envois : sans remise à zéro, les
  // derniers scénarios attendraient une heure. Le compteur du limiteur (clé BullMQ
  // de la file `emails`) est donc remis à zéro au début de chaque scénario — chacun
  // reste très en dessous de 40 envois.
  await redis.del("bull:emails:limiter");
  const eteindre = await allumerLeBanc(jeton);
  const cle = randomUUID().slice(0, 8);
  const emailAdmin = `admin.${nom}.${cle}@example.test`;
  const admin = await prisma.adminUser.create({
    data: {
      name: `Direction banc ${nom}`,
      email: emailAdmin,
      // Jamais utilisé pour se connecter : la session est déclarée par le spec.
      passwordHash: "banc-formateurs-aucun-mot-de-passe",
      role: "super_admin",
    },
    select: { id: true },
  });
  const adresses = new Set<string>();
  const session: SessionBanc = {
    id: admin.id,
    email: emailAdmin,
    role: "super_admin",
    name: "Direction banc",
  };
  const remettreOrganisme = options.organisme ? await configurerOrganisme(session) : null;
  return {
    admin: session,
    adresses,
    adresse(role) {
      const a = `${role}.${nom}.${cle}.${adresses.size}@example.test`.toLowerCase();
      adresses.add(a);
      return a;
    },
    async liberer() {
      try {
        if (remettreOrganisme) await remettreOrganisme();
        for (const a of adresses) await effacerPersonne(a);
        await prisma.activityLog.deleteMany({ where: { adminUserId: admin.id } });
        // Une contresignature (W-4) garde la personne qui l'a recueillie, en
        // `onDelete: Restrict` : la preuve ne perd jamais son signataire. L'admin du
        // banc reste alors en base (adresse tirée au hasard, aucune collision).
        const recueillies = await prisma.documentSignature.count({
          where: { recueilliParAdminId: admin.id },
        });
        if (recueillies === 0) await prisma.adminUser.deleteMany({ where: { id: admin.id } });
      } finally {
        try {
          await eteindre();
        } finally {
          if ((await redis.get(CLE_VERROU)) === jeton) await redis.del(CLE_VERROU);
          redis.disconnect();
        }
      }
    },
  };
}

/** Les candidatures d'une adresse (par l'empreinte, comme le code les regroupe). */
export async function candidaturesDe(adresse: string) {
  const empreinte = hashEmailForLookup(adresse);
  return prisma.jobApplication.findMany({
    where: { emailHash: empreinte ?? "∅" },
    orderBy: { submittedAt: "asc" },
  });
}

/** Efface tout ce qu'une personne du banc a laissé : candidatures, échanges, fiche, envois. */
export async function effacerPersonne(adresse: string): Promise<void> {
  const empreinte = hashEmailForLookup(adresse) ?? "∅";
  const rdvs = await prisma.calendlyEvent.findMany({
    where: { inviteeEmail: adresse },
    select: { id: true, linkedSubmissionId: true },
  });
  const candidatures = await prisma.jobApplication.findMany({
    where: {
      OR: [{ emailHash: empreinte }, { id: { in: await idsCandidaturesSansEmpreinte(adresse) } }],
    },
    select: { id: true },
  });
  const idsCand = candidatures.map((c) => c.id);
  const fiches = await prisma.trainer.findMany({
    where: { OR: [{ email: adresse }, { candidatureId: { in: idsCand } }] },
    select: { id: true },
  });
  const idsFiches = fiches.map((f) => f.id);
  const idsRdv = rdvs.map((r) => r.id);
  const lies = await prisma.calendlyEvent.findMany({
    where: { linkedJobApplicationId: { in: idsCand } },
    select: { id: true },
  });
  idsRdv.push(...lies.map((l) => l.id).filter((id) => !idsRdv.includes(id)));

  await prisma.rendezVousSuivi.deleteMany({ where: { calendlyEventId: { in: idsRdv } } });
  await prisma.crmSyncOutbox.deleteMany({
    where: { subjectRef: { in: idsRdv.map((id) => `site:calendly_event:${id}`) } },
  });
  const submissions = await prisma.submission.findMany({
    where: {
      OR: [
        { contactEmailHash: empreinte },
        { id: { in: rdvs.map((r) => r.linkedSubmissionId).filter((x): x is string => !!x) } },
      ],
    },
    select: { id: true },
  });
  const idsSub = submissions.map((s) => s.id);
  await prisma.calendlyEvent.deleteMany({ where: { id: { in: idsRdv } } });
  await prisma.activityLog.deleteMany({
    where: { targetId: { in: [...idsCand, ...idsFiches, ...idsSub] } },
  });
  await prisma.jobApplication.updateMany({
    where: { id: { in: idsCand } },
    data: { trainerId: null },
  });
  for (const id of idsFiches) await effacerFiche(id);
  await prisma.jobApplicationInboundReply.deleteMany({
    where: { applicationId: { in: idsCand } },
  });
  await prisma.jobApplicationEvent.deleteMany({ where: { applicationId: { in: idsCand } } });
  await prisma.jobApplication.deleteMany({ where: { id: { in: idsCand } } });
  await prisma.submission.deleteMany({ where: { id: { in: idsSub } } });
  await prisma.consentEvent.deleteMany({ where: { personKey: empreinte } });
  // Une opposition prévient aussi le CRM (ligne d'outbox) : les deux s'effacent.
  const oppositions = await prisma.emailOpposition.findMany({
    where: { emailHash: empreinte },
    select: { id: true },
  });
  await prisma.crmSyncOutbox.deleteMany({
    where: { subjectRef: { in: oppositions.map((o) => `site:email_opposition:${o.id}`) } },
  });
  await prisma.emailOpposition.deleteMany({ where: { emailHash: empreinte } });
  await prisma.emailOutbox.deleteMany({ where: { recipient: adresse } });
  await prisma.emailLog.deleteMany({ where: { recipient: adresse } });
  await viderPuitsPour(adresse);
}

/** Candidatures saisies en console avec une adresse relais (sans empreinte). */
async function idsCandidaturesSansEmpreinte(adresse: string): Promise<string[]> {
  const logs = await prisma.emailLog.findMany({
    where: { recipient: adresse, entityType: "JobApplication" },
    select: { entityId: true },
  });
  return logs.map((l) => l.entityId).filter((x): x is string => !!x);
}

/** Efface une fiche formateur du banc et ce qui y est accroché. */
export async function effacerFiche(trainerId: string): Promise<void> {
  // Les tables accrochées à une fiche sont nombreuses ; on efface ce que les
  // scénarios d'entrée écrivent, puis la fiche. Une table de PREUVE (ajout seul :
  // contrôles du registre, signatures) refuse l'effacement — c'est voulu : la fiche
  // est alors désactivée, close, et son adresse remplacée par une adresse du banc.
  await prisma.activityLog.deleteMany({ where: { targetId: trainerId } });
  try {
    await prisma.trainer.delete({ where: { id: trainerId } });
  } catch {
    await prisma.trainer.updateMany({
      where: { id: trainerId },
      data: { actif: false, email: `efface.${trainerId}@example.test` },
    });
  }
}

// ── Les envois ───────────────────────────────────────────────────────────────

/** Les gabarits partis (ou en file) vers une adresse, dans l'ordre. */
export async function gabaritsVers(adresse: string): Promise<string[]> {
  return (await lireJournalEnvois({ destinataire: adresse })).map((l) => l.template);
}

/** Attend que toutes les lignes du journal d'une adresse soient closes par le worker. */
export async function attendreLeWorker(
  adresse: string,
  /** Gabarits volontairement laissés en file (un retard BullMQ posé par le scénario). */
  sauf: readonly string[] = [],
): Promise<void> {
  const limite = Date.now() + ATTENTE_WORKER.timeout;
  for (;;) {
    const lignes = (await lireJournalEnvois({ destinataire: adresse })).filter(
      (l) => !sauf.includes(l.template),
    );
    if (lignes.every((l) => l.status !== "pending")) return;
    if (Date.now() > limite) {
      throw new Error(
        `banc @formateurs : le worker n'a pas clos les envois vers ${adresse} : ${JSON.stringify(lignes)}`,
      );
    }
    await new Promise((r) => setTimeout(r, 500));
  }
}

/** Les sujets captés par le puits SMTP pour une adresse. */
export async function sujetsCaptes(adresse: string): Promise<string[]> {
  return (await messagesCaptes(adresse)).map((m) => m.sujet);
}

// ── Les instants ─────────────────────────────────────────────────────────────

const HEURE_MS = 3_600_000;

/** L'heure de Paris d'un instant (0-23). */
function heureParis(d: Date): number {
  return Number(
    new Intl.DateTimeFormat("fr-FR", { hour: "numeric", hour12: false, timeZone: "Europe/Paris" })
      .format(d)
      .replace(/\D/g, ""),
  );
}

/**
 * `depart` + `jours`, avancé si besoin jusqu'à la prochaine heure ouvrée de
 * Paris (10 h) : les relances ne partent qu'entre 8 h et 19 h. L'écart avec
 * `depart` reste dans [jours, jours + 1[ — la même étape de relance.
 */
export function jourOuvre(depart: Date, jours: number): Date {
  let t = new Date(depart.getTime() + jours * 24 * HEURE_MS);
  for (let i = 0; i < 24 && (heureParis(t) < 9 || heureParis(t) >= 18); i++) {
    t = new Date(t.getTime() + HEURE_MS);
  }
  return t;
}

export function plus(d: Date, duree: { jours?: number; heures?: number; minutes?: number }): Date {
  const { jours = 0, heures = 0, minutes = 0 } = duree;
  return new Date(d.getTime() + ((jours * 24 + heures) * 60 + minutes) * 60_000);
}

// ── L'organisme, tel que le contrat-cadre l'imprime ──────────────────────────

/** Ce que la console tient en production et que la base du banc n'a pas. */
const IDENTITE_QUALIOPI_BANC: Readonly<Record<string, string>> = {
  adresse_siege: "1 rue du Banc d'Essai, 38000 Grenoble",
  nda_region: "Auvergne-Rhône-Alpes",
  adresse_formateurs: "formateurs.banc@example.test",
};

/**
 * Pose l'identité de l'organisme (configuration Qualiopi par le service de la
 * console, identité légale par sa ligne `legal_overrides`) ; rend la fonction qui
 * remet l'état d'avant. Valeurs du banc : capital et adresses fictifs, SIREN de la
 * table d'identité légale du dépôt (publique).
 */
export async function configurerOrganisme(admin: SessionBanc): Promise<() => Promise<void>> {
  const cles = [
    ...Object.keys(IDENTITE_QUALIOPI_BANC).map((k) => `qualiopi.${k}`),
    "legal_overrides",
  ];
  const avant = await prisma.siteSetting.findMany({ where: { key: { in: cles } } });
  const { etape } = await import("./etapes");
  await etape({
    etape: "configurer-organisme",
    args: { valeurs: IDENTITE_QUALIOPI_BANC },
    session: admin,
  });
  const legal = avant.find((r) => r.key === "legal_overrides")?.value;
  const base = legal && typeof legal === "object" && !Array.isArray(legal) ? legal : {};
  await prisma.siteSetting.upsert({
    where: { key: "legal_overrides" },
    create: {
      key: "legal_overrides",
      value: {
        ...base,
        capitalSocial: "1 000 €",
        rcsVille: "Grenoble",
        siren: IDENTITE_LEGALE.siren,
      },
    },
    update: {
      value: {
        ...base,
        capitalSocial: "1 000 €",
        rcsVille: "Grenoble",
        siren: IDENTITE_LEGALE.siren,
      },
    },
  });
  return async () => {
    for (const key of cles) {
      const ligne = avant.find((r) => r.key === key);
      if (ligne === undefined) await prisma.siteSetting.deleteMany({ where: { key } });
      else
        await prisma.siteSetting.update({
          where: { key },
          data: { value: ligne.value as never, updatedByAdminId: ligne.updatedByAdminId },
        });
    }
  };
}
