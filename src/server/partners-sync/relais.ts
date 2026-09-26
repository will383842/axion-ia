/**
 * relais.ts — le relais de la file de sortie vers Axion Partners (INT-T02).
 *
 * Deux temps, dans cet ordre, à chaque passage :
 *
 *   1. NUMÉROTER (`numeroterEnAttente`). Les lignes validées et jamais prises reçoivent leur
 *      `sequence`, sous un verrou consultatif de transaction, dans l'ordre de création. La
 *      séquence est donc GLOBALE et d'ÉMISSION (décision de l'architecte, 2026-09-26) : dense, et
 *      croissante dans l'ordre où les lignes DEVIENNENT visibles. Une séquence posée dans la
 *      transaction métier suivrait l'ordre de création, pas celui de validation : deux
 *      transactions validées dans l'ordre inverse feraient apparaître le numéro 8 avant le 7, et un
 *      lecteur `after_sequence=8` perdrait le 7 pour toujours. Ici, une ligne invisible au moment
 *      du verrou est numérotée au passage suivant, APRÈS toutes celles déjà numérotées. Le test
 *      d'intégration le prouve contre un vrai Postgres.
 *
 *      Le corps est FIGÉ dans la même instruction (`finaliserCorps`) : c'est ce texte-là qui est
 *      signé, transmis, relu.
 *
 *   2. ENVOYER (`envoyerLigne`) les lignes numérotées et dues, par séquence croissante.
 *      Politique de REQ-INT-009 :
 *        · 2xx            → `sent` (le doublon `{duplicate:true}` du récepteur aussi) ;
 *        · 422            → `gave_up` IMMÉDIAT, alerte : rejouer ne rendra pas valide ;
 *        · 503            → `failed`, tentative NON comptée : Partners est indisponible, pas
 *                           fautif (sa base a refusé l'inscription, ou sa porte est fermée) ;
 *        · autre / réseau → tentative comptée ; la huitième abandonne, avec alerte.
 *      Après abandon, la ligne RESTE, visible, et `rejouerEvenement(eventId)` la réarme.
 *
 * INERTIE : chaque point d'entrée commence par `canalPartnersOuvert()`. Fermé, aucune requête,
 * aucun appel réseau — le client Prisma n'est même pas chargé (import dynamique).
 */
import { horodatageSignature, signerCorps } from "@/server/partners/enveloppe";

import {
  CLE_VERROU_SEQUENCE,
  PARTNERS_SYNC_DELAI_MS,
  PARTNERS_SYNC_LOT,
  PARTNERS_SYNC_LOT_NUMEROTATION,
  PARTNERS_SYNC_MAX_TENTATIVES,
  canalPartnersOuvert,
  delaiAvantNouvelleTentativeMs,
  secretPartners,
  urlPartners,
} from "./config";
import { finaliserCorps } from "./outbox";

export type StatutPartnersSync = "pending" | "sent" | "failed" | "gave_up";

export type LigneRelais = {
  id: string;
  eventId: string;
  eventType: string;
  subjectRef: string;
  sequence: bigint | null;
  corps: string;
  status: StatutPartnersSync;
  attempts: number;
};

type MiseAJour = Partial<{
  sequence: bigint;
  corps: string;
  status: StatutPartnersSync;
  attempts: number;
  lastError: string | null;
  lastAttemptAt: Date | null;
  nextAttemptAt: Date | null;
  sentAt: Date | null;
  responseStatus: number | null;
}>;

/**
 * Le sous-ensemble du client Prisma dont le relais a besoin. Structurel, pour que les tests
 * passent un faux ; méthodes (et non propriétés-fonctions) pour rester bivariant face aux
 * génériques de Prisma.
 */
export interface TablePartnersSync {
  findMany(args: {
    where: Record<string, unknown>;
    orderBy: unknown;
    take: number;
  }): PromiseLike<LigneRelais[]>;
  findUnique(args: {
    where: { id: string } | { eventId: string };
  }): PromiseLike<LigneRelais | null>;
  update(args: { where: { id: string }; data: MiseAJour }): PromiseLike<unknown>;
  aggregate(args: { _max: { sequence: true } }): PromiseLike<{ _max: { sequence: bigint | null } }>;
}

export interface TransactionRelais {
  partnersSyncOutbox: TablePartnersSync;
  $executeRaw(requete: TemplateStringsArray, ...valeurs: unknown[]): PromiseLike<number>;
}

export interface ClientRelais extends TransactionRelais {
  $transaction<T>(fn: (tx: TransactionRelais) => Promise<T>): Promise<T>;
}

export type AlerteAbandon = {
  eventId: string;
  eventType: string;
  subjectRef: string;
  sequence: string | null;
  raison: string;
  /** Vrai pour un 422 : la cause est dans le contenu, rejouer ne suffira pas. */
  definitif: boolean;
};

export type DependancesRelais = {
  prisma?: ClientRelais;
  fetch?: (url: string, init: RequestInit) => Promise<Response>;
  alerter?: (a: AlerteAbandon) => Promise<void>;
  maintenant?: () => Date;
};

type Resolues = Required<DependancesRelais>;

async function clientParDefaut(): Promise<ClientRelais> {
  // Import DYNAMIQUE : fermé, le relais ne charge pas même le client Prisma.
  const { prisma } = await import("@/lib/prisma");
  return prisma as unknown as ClientRelais;
}

async function alerterParDefaut(a: AlerteAbandon): Promise<void> {
  try {
    const { notify } = await import("@/server/notifications");
    await notify({
      category: "MONITORING_ALERT",
      severity: "critical",
      payload: {
        kind: "partners_abandon",
        details: {
          legacyBody:
            "Un événement n'atteindra PAS Axion Partners sans intervention.\n\n" +
            `Type     : ${a.eventType}\n` +
            `Sujet    : ${a.subjectRef}\n` +
            `event_id : ${a.eventId}\n` +
            `Séquence : ${a.sequence ?? "—"}\n` +
            `Raison   : ${a.raison}\n\n` +
            (a.definitif
              ? "Refus DÉFINITIF (422) : le contenu est hors contrat. Corriger la cause, puis rejouer par event_id."
              : "Huit tentatives en échec. Vérifier Partners, puis rejouer par event_id."),
        },
      },
      dedupKey: `partners-abandon:${a.eventId}`,
      dedupTtlSec: 7 * 24 * 3600,
    });
  } catch (e) {
    // Une alerte qui échoue ne défait pas l'abandon, déjà écrit en base.
    console.warn(
      `[partners-sync] alerte d'abandon impossible : ${e instanceof Error ? e.name : typeof e}`,
    );
  }
}

async function resoudre(d: DependancesRelais): Promise<Resolues> {
  return {
    prisma: d.prisma ?? (await clientParDefaut()),
    fetch: d.fetch ?? ((url, init) => fetch(url, init)),
    alerter: d.alerter ?? alerterParDefaut,
    maintenant: d.maintenant ?? (() => new Date()),
  };
}

function tronquer(message: string): string {
  return message.length > 480 ? `${message.slice(0, 480)}…` : message;
}

/**
 * Pose `sequence` et fige `corps` sur les lignes validées jamais prises. Rend le nombre de lignes
 * numérotées. Le verrou est de TRANSACTION (`pg_advisory_xact_lock`) : il tombe au commit, et le
 * relais suivant relit le maximum APRÈS l'avoir obtenu — donc après ce commit.
 */
export async function numeroterEnAttente(prisma: ClientRelais, maintenant: Date): Promise<number> {
  if (!canalPartnersOuvert()) return 0;

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${CLE_VERROU_SEQUENCE})`;

    const { _max } = await tx.partnersSyncOutbox.aggregate({ _max: { sequence: true } });
    let courante = _max.sequence ?? 0n;

    const aPrendre = await tx.partnersSyncOutbox.findMany({
      where: { sequence: null, status: "pending" },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: PARTNERS_SYNC_LOT_NUMEROTATION,
    });

    for (const ligne of aPrendre) {
      courante += 1n;
      await tx.partnersSyncOutbox.update({
        where: { id: ligne.id },
        data: { sequence: courante, corps: finaliserCorps(ligne.corps, courante, maintenant) },
      });
    }
    return aPrendre.length;
  });
}

export type ResultatEnvoi = "sent" | "failed" | "gave_up" | "ignore";

/**
 * Envoie UNE ligne numérotée. Ne lève pas pour une réponse de Partners ni pour une panne réseau :
 * tout est écrit sur la ligne.
 */
export async function envoyerLigne(
  id: string,
  dependances: DependancesRelais = {},
): Promise<ResultatEnvoi> {
  if (!canalPartnersOuvert()) return "ignore";
  const url = urlPartners();
  const secret = secretPartners();
  if (url === null || secret === null) return "ignore";

  const d = await resoudre(dependances);
  const ligne = await d.prisma.partnersSyncOutbox.findUnique({ where: { id } });
  if (ligne === null || ligne.sequence === null) return "ignore";
  if (ligne.status === "sent" || ligne.status === "gave_up") return "ignore";

  const maintenant = d.maintenant();
  const horodatage = horodatageSignature(maintenant);

  let statutHttp: number | undefined;
  try {
    const reponse = await d.fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Axionia-Timestamp": horodatage,
        "X-Axionia-Signature": signerCorps(secret, horodatage, ligne.corps),
      },
      // LE TEXTE STOCKÉ, tel quel : c'est sur lui que porte la signature.
      body: ligne.corps,
      signal: AbortSignal.timeout(PARTNERS_SYNC_DELAI_MS),
      redirect: "error",
    });
    statutHttp = reponse.status;
    // Le corps de réponse n'est jamais lu au-delà du nécessaire : il ne décide de rien.
    await reponse.body?.cancel().catch(() => undefined);

    if (reponse.ok) {
      await d.prisma.partnersSyncOutbox.update({
        where: { id },
        data: {
          status: "sent",
          attempts: ligne.attempts + 1,
          lastAttemptAt: maintenant,
          nextAttemptAt: null,
          sentAt: maintenant,
          responseStatus: statutHttp,
          lastError: null,
        },
      });
      return "sent";
    }

    if (statutHttp === 422) {
      await d.prisma.partnersSyncOutbox.update({
        where: { id },
        data: {
          status: "gave_up",
          attempts: ligne.attempts + 1,
          lastAttemptAt: maintenant,
          nextAttemptAt: null,
          responseStatus: statutHttp,
          lastError: "422 : refus définitif de Partners (hors schéma ou frontière)",
        },
      });
      await d.alerter(alerte(ligne, "HTTP 422", true));
      return "gave_up";
    }

    return await echec(d, ligne, maintenant, `HTTP ${statutHttp}`, statutHttp !== 503, statutHttp);
  } catch (erreur) {
    const nom = erreur instanceof Error ? erreur.name : typeof erreur;
    return await echec(d, ligne, maintenant, `réseau : ${nom}`, true, statutHttp);
  }
}

function alerte(ligne: LigneRelais, raison: string, definitif: boolean): AlerteAbandon {
  return {
    eventId: ligne.eventId,
    eventType: ligne.eventType,
    subjectRef: ligne.subjectRef,
    sequence: ligne.sequence === null ? null : ligne.sequence.toString(),
    raison,
    definitif,
  };
}

async function echec(
  d: Resolues,
  ligne: LigneRelais,
  maintenant: Date,
  raison: string,
  compte: boolean,
  statutHttp: number | undefined,
): Promise<ResultatEnvoi> {
  const tentatives = compte ? ligne.attempts + 1 : ligne.attempts;
  const epuise = compte && tentatives >= PARTNERS_SYNC_MAX_TENTATIVES;
  await d.prisma.partnersSyncOutbox.update({
    where: { id: ligne.id },
    data: {
      status: epuise ? "gave_up" : "failed",
      attempts: tentatives,
      lastAttemptAt: maintenant,
      nextAttemptAt: epuise
        ? null
        : new Date(maintenant.getTime() + delaiAvantNouvelleTentativeMs(Math.max(1, tentatives))),
      responseStatus: statutHttp ?? null,
      lastError: tronquer(raison),
    },
  });
  if (epuise) {
    await d.alerter(alerte(ligne, raison, false));
    return "gave_up";
  }
  return "failed";
}

export type BilanRelais = {
  inerte: boolean;
  numerotees: number;
  envoyees: number;
  abandonnees: number;
};

/** Un passage complet du relais : numéroter, puis envoyer ce qui est dû. */
export async function relayer(dependances: DependancesRelais = {}): Promise<BilanRelais> {
  if (!canalPartnersOuvert()) return { inerte: true, numerotees: 0, envoyees: 0, abandonnees: 0 };
  // Sans destination ni secret, on ne PREND aucune ligne : la numérotation a lieu « au premier
  // envoi », et il n'y en aura pas.
  if (urlPartners() === null || secretPartners() === null) {
    return { inerte: false, numerotees: 0, envoyees: 0, abandonnees: 0 };
  }

  const d = await resoudre(dependances);
  const numerotees = await numeroterEnAttente(d.prisma, d.maintenant());

  const dues = await d.prisma.partnersSyncOutbox.findMany({
    where: {
      sequence: { not: null },
      status: { in: ["pending", "failed"] },
      OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: d.maintenant() } }],
    },
    orderBy: { sequence: "asc" },
    take: PARTNERS_SYNC_LOT,
  });

  let envoyees = 0;
  let abandonnees = 0;
  for (const ligne of dues) {
    const r = await envoyerLigne(ligne.id, d);
    if (r === "sent") envoyees += 1;
    if (r === "gave_up") abandonnees += 1;
  }
  return { inerte: false, numerotees, envoyees, abandonnees };
}

export type ResultatRejeu = "rearme" | "deja_envoye" | "introuvable" | "inerte";

/**
 * Rejoue À LA MAIN une ligne abandonnée ou en échec, par `event_id` (REQ-INT-009). La séquence et
 * le corps ne bougent pas : Partners reçoit l'octet déjà promis, et son `event_id` le dédoublonne.
 */
export async function rejouerEvenement(
  eventId: string,
  prisma?: ClientRelais,
): Promise<ResultatRejeu> {
  if (!canalPartnersOuvert()) return "inerte";
  const client = prisma ?? (await clientParDefaut());
  const ligne = await client.partnersSyncOutbox.findUnique({ where: { eventId } });
  if (ligne === null) return "introuvable";
  if (ligne.status === "sent") return "deja_envoye";
  await client.partnersSyncOutbox.update({
    where: { id: ligne.id },
    data: { status: "pending", attempts: 0, nextAttemptAt: null, lastError: null },
  });
  return "rearme";
}
