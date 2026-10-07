// ARCHIVAGE AUTOMATIQUE des apporteurs (2026-10-07, demande de Will).
//
// Une personne dont le contrat est CONTRESIGNÉ, ou dont l'issue de l'échange
// est « Non retenu », n'a plus rien à faire dans la liste « en cours » : ses
// lignes passent au statut « archivé » qui existe déjà. Rien n'est effacé,
// rien n'est purgé — l'onglet « Archivés » (ou « Tous ») les montre toujours,
// et « Désarchiver » les rouvre d'un clic.
//
// ── Deux appelants, une fonction ──────────────────────────────────────────
//   · le passage des invitations (worker, toutes les 5 minutes), avec une
//     FENÊTRE de 7 jours (`depuis`) : il range ce qui vient d'arriver ;
//   · le rattrapage manuel (`scripts/rattrapage-archivage-apporteurs.ts`),
//     sans fenêtre, à blanc par défaut : il range les fiches d'avant.
//
// ── Pourquoi pas dans le geste lui-même ───────────────────────────────────
// La contresignature s'écrit dans `apporteurs-reseau/verification.ts`, l'issue
// dans `admin-rendezvous/issue-apporteur-actions.ts` — deux fichiers en cours
// de modification par d'autres chantiers. Le passage DÉRIVE l'archivage de ce
// qui est enregistré, sans y toucher. (« Non retenu » archive déjà la fiche de
// l'échange, par « sans suite » ; le passage range les AUTRES lignes de la
// personne.)
//
// ── Idempotent, et respectueux d'un désarchivage ──────────────────────────
// L'écriture est conditionnée à `archivedAt: null` ; chaque ligne rangée porte
// la marque `MARQUE_ARCHIVAGE_AUTO`, que « Désarchiver » laisse en place. Une
// ligne qui la porte n'est plus jamais rangée automatiquement : si Will la
// rouvre, elle reste ouverte.
//
// 🔑 `details` est RELU dans la transaction qui écrit le statut, et seule la
// marque y est ajoutée : une clé posée entre la lecture du début du passage et
// l'écriture (webhook Calendly, geste de Will) n'est pas écrasée.
//
// ── Retour en arrière : « Non retenu » corrigé en « Retenu » ──────────────
// Si le passage a rangé une ligne pour « Non retenu » et que la dernière
// décision devient « Retenu », il DÉFAIT son propre archivage : statut d'avant
// (`MARQUE_ARCHIVAGE_AUTO_STATUT`), marques retirées, trace au journal. Jamais :
//   · une ligne rangée à la main par Will (pas de marque, ou `archivedAt` qui
//     n'est plus celui que le passage a posé — rouverte puis ré-archivée) ;
//   · une ligne rangée pour contrat contresigné, ni une personne dont le
//     contrat est contresigné (à n'importe quelle date).
// La fiche de l'échange classée « Sans suite » par le geste « Non retenu » est
// un geste de Will : elle reste où elle est.
//
// ⚠️ Tourne dans le worker : ni `server-only`, ni `revalidatePath`.

import { prisma } from "@/lib/prisma";
import { decryptPii } from "@/lib/pii-crypto";
import { estAppelApporteur } from "@/server/calendly/appel-apporteur";
import {
  decisionAffichee,
  type EchangeAvecPoint,
} from "@/features/admin-rendezvous/issue-apporteur";
import {
  doitArchiverAutomatiquement,
  MARQUE_ARCHIVAGE_AUTO,
  MARQUE_ARCHIVAGE_AUTO_MOTIF,
  MARQUE_ARCHIVAGE_AUTO_STATUT,
  type MotifArchivageAuto,
} from "@/lib/commercial-application/etape-suivi-apporteur";
import { annulerRelancesLeadApporteur } from "./relances-lead-apporteur";
import type { Prisma, SubmissionStatus } from "../../../prisma/generated/client";

export interface BilanArchivageAuto {
  /** Personnes dont le contrat est contresigné (dans la fenêtre). */
  readonly personnesContresignees: number;
  /** Personnes dont la dernière décision est « Non retenu » (dans la fenêtre). */
  readonly personnesNonRetenues: number;
  /** Lignes rangées (ou à ranger, à blanc). */
  readonly archivees: number;
  /** Lignes déjà rangées automatiquement puis rouvertes par Will : laissées telles quelles. */
  readonly laisseesOuvertes: number;
  /** Lignes rangées pour « Non retenu » puis rouvertes car la décision est devenue « Retenu ». */
  readonly desarchivees: number;
  /** Faux pour un essai à blanc. */
  readonly ecrit: boolean;
}

const MOTIF_RELANCES: Readonly<Record<MotifArchivageAuto, string>> = {
  "contrat-contresigne": "Envoi annulé : le contrat est contresigné, la fiche est archivée.",
  "non-retenu": "Envoi annulé : l'issue « Non retenu » est enregistrée, la fiche est archivée.",
};

const cle = (l: { id: string; contactEmailHash: string | null }) =>
  l.contactEmailHash ?? `id:${l.id}`;

/** Les statuts qu'un retour en arrière peut rendre : tous, sauf « archivé ». */
const STATUTS_ACTIFS: ReadonlySet<string> = new Set<Exclude<SubmissionStatus, "archived">>([
  "new",
  "in_progress",
  "processed",
  "qualifying",
  "negotiating",
  "converted",
  "lost",
]);

/**
 * Cette ligne a-t-elle été rangée PAR LE PASSAGE pour « Non retenu », et l'est-elle
 * encore de ce fait ? `archivedAt` doit être exactement la date de la marque :
 * une ligne rouverte puis ré-archivée à la main porte encore l'ancienne marque,
 * mais plus cette date.
 */
function rangeeParLePassagePourNonRetenu(l: {
  readonly archivedAt: Date | null;
  readonly deletedAt: Date | null;
  readonly status: string;
  readonly details: unknown;
}): boolean {
  if (l.deletedAt !== null || l.archivedAt === null || l.status !== "archived") return false;
  const d = l.details as Record<string, unknown> | null;
  if (!d || typeof d !== "object") return false;
  return (
    d[MARQUE_ARCHIVAGE_AUTO_MOTIF] === "non-retenu" &&
    d[MARQUE_ARCHIVAGE_AUTO] === l.archivedAt.toISOString()
  );
}

export async function archiverApporteursTermines(opts: {
  /** Faux : on compte, on n'écrit rien. */
  readonly appliquer: boolean;
  /** Ne regarder que les contresignatures / décisions depuis cette date. `null` : tout. */
  readonly depuis: Date | null;
  readonly maintenant?: Date;
}): Promise<BilanArchivageAuto> {
  const maintenant = opts.maintenant ?? new Date();
  const depuis = opts.depuis;

  // 1. Les points de départ : contrats contresignés, décisions « Non retenu »
  //    (à ranger) et « Retenu » (à rouvrir, si le passage les avait rangées).
  const [contresignes, decisions] = await Promise.all([
    prisma.apporteurReseau.findMany({
      where: { signeParSocieteAt: depuis ? { gte: depuis } : { not: null } },
      select: { submissionId: true, emailHash: true },
    }),
    prisma.rendezVousSuivi.findMany({
      where: {
        decision: { in: ["non_retenu", "retenu"] },
        ...(depuis ? { renseigneLe: { gte: depuis } } : {}),
      },
      select: { decision: true, calendlyEvent: { select: { linkedSubmissionId: true } } },
    }),
  ]);
  const nonRetenus = decisions.filter((d) => d.decision === "non_retenu");
  const retenus = decisions.filter((d) => d.decision === "retenu");
  const idsDepart = new Set<string>();
  const hashesDepart = new Set<string>();
  for (const d of contresignes) {
    if (d.submissionId) idsDepart.add(d.submissionId);
    hashesDepart.add(d.emailHash);
  }
  for (const n of decisions) {
    const id = n.calendlyEvent.linkedSubmissionId;
    if (id) idsDepart.add(id);
  }
  const vide: BilanArchivageAuto = {
    personnesContresignees: 0,
    personnesNonRetenues: 0,
    archivees: 0,
    laisseesOuvertes: 0,
    desarchivees: 0,
    ecrit: opts.appliquer,
  };
  if (idsDepart.size === 0 && hashesDepart.size === 0) return vide;

  // 2. Les fiches de départ donnent l'empreinte de la personne…
  const departs = idsDepart.size
    ? await prisma.submission.findMany({
        where: { id: { in: [...idsDepart] } },
        select: { id: true, contactEmailHash: true },
      })
    : [];
  const hashes = new Set(hashesDepart);
  for (const l of departs) if (l.contactEmailHash) hashes.add(l.contactEmailHash);

  // 3. … et l'empreinte, toutes ses lignes (hors corbeille).
  const lignes = await prisma.submission.findMany({
    where: {
      OR: [{ id: { in: [...idsDepart] } }, { contactEmailHash: { in: [...hashes] } }],
      deletedAt: null,
    },
    select: {
      id: true,
      contactEmailHash: true,
      contactEmail: true,
      details: true,
      archivedAt: true,
      deletedAt: true,
      status: true,
    },
  });

  // 4. Quelle personne est concernée, et pourquoi.
  const motifPar = new Map<string, MotifArchivageAuto>();
  for (const d of contresignes) motifPar.set(d.emailHash, "contrat-contresigne");
  for (const d of contresignes) {
    const l = d.submissionId ? lignes.find((x) => x.id === d.submissionId) : undefined;
    if (l) motifPar.set(cle(l), "contrat-contresigne");
  }
  const personnesContresignees = contresignes.length;

  // « Non retenu » : seulement si c'est bien la DERNIÈRE décision définitive de
  // la personne — un « Retenu » plus récent l'emporte (même règle que la liste).
  const clesDe = (liste: typeof decisions) => {
    const cles = new Set<string>();
    for (const n of liste) {
      const id = n.calendlyEvent.linkedSubmissionId;
      const l = id ? lignes.find((x) => x.id === id) : undefined;
      if (l) cles.add(cle(l));
    }
    return cles;
  };
  const clesNonRetenus = clesDe(nonRetenus);
  const clesRetenus = clesDe(retenus);
  let personnesNonRetenues = 0;
  const echangesPar = new Map<string, EchangeAvecPoint[]>();
  if (clesNonRetenus.size > 0 || clesRetenus.size > 0) {
    const lignesDecidees = lignes.filter(
      (l) => clesNonRetenus.has(cle(l)) || clesRetenus.has(cle(l)),
    );
    const evenements = await prisma.calendlyEvent.findMany({
      where: { linkedSubmissionId: { in: lignesDecidees.map((l) => l.id) } },
      select: {
        linkedSubmissionId: true,
        eventTypeName: true,
        status: true,
        startTime: true,
        suivi: { select: { issue: true, decision: true, renseigneLe: true } },
      },
    });
    for (const ev of evenements) {
      if (!estAppelApporteur(ev.eventTypeName)) continue;
      const l = lignesDecidees.find((x) => x.id === ev.linkedSubmissionId);
      if (!l) continue;
      const k = cle(l);
      echangesPar.set(k, [
        ...(echangesPar.get(k) ?? []),
        { debut: ev.startTime, annule: ev.status === "canceled", point: ev.suivi ?? null },
      ]);
    }
    for (const k of clesNonRetenus) {
      if (motifPar.has(k)) continue; // contresigné : le contrat prime
      if (decisionAffichee(echangesPar.get(k) ?? [])?.type !== "non-retenu") continue;
      motifPar.set(k, "non-retenu");
      personnesNonRetenues += 1;
    }
  }

  // 5. Ranger.
  let archivees = 0;
  let laisseesOuvertes = 0;
  for (const l of lignes) {
    const motif = motifPar.get(cle(l));
    if (!motif) continue;
    if (!doitArchiverAutomatiquement(l)) {
      const d = l.details as Record<string, unknown> | null;
      if (
        l.archivedAt === null &&
        l.status !== "archived" &&
        d?.[MARQUE_ARCHIVAGE_AUTO] !== undefined
      ) {
        laisseesOuvertes += 1;
      }
      continue;
    }
    if (!opts.appliquer) {
      archivees += 1;
      continue;
    }
    const ecrite = await prisma.$transaction(async (tx) => {
      // 🔑 `details` relu ICI, pas repris de la lecture du début du passage :
      // une clé posée entre-temps (webhook Calendly, geste de Will) survit.
      const fraiche = await tx.submission.findUnique({
        where: { id: l.id },
        select: { details: true, archivedAt: true, deletedAt: true, status: true },
      });
      if (!fraiche || !doitArchiverAutomatiquement(fraiche)) return false;
      const details = {
        ...(fraiche.details as Record<string, unknown>),
        [MARQUE_ARCHIVAGE_AUTO]: maintenant.toISOString(),
        [MARQUE_ARCHIVAGE_AUTO_MOTIF]: motif,
        [MARQUE_ARCHIVAGE_AUTO_STATUT]: fraiche.status,
      } as Prisma.InputJsonObject;
      // 🔑 Conditionnée à `archivedAt: null` : deux passages simultanés, ou un
      // geste de Will au même instant, ne rangent pas deux fois.
      const r = await tx.submission.updateMany({
        where: { id: l.id, archivedAt: null, deletedAt: null },
        data: { status: "archived", archivedAt: maintenant, needsAttention: false, details },
      });
      if (r.count === 0) return false;
      await tx.activityLog.create({
        data: {
          adminUserId: null,
          action: "submission.archivage_auto",
          targetType: "submission",
          targetId: l.id,
          // Aucune donnée personnelle au journal : l'identifiant suffit.
          changes: { motif },
        },
      });
      return true;
    });
    if (!ecrite) continue;
    archivees += 1;
    // Les relances encore en file s'arrêtent, comme pour un archivage à la main.
    // Leur échec ne défait rien : la fiche EST rangée.
    const adresse = decryptPii(l.contactEmail);
    if (adresse) {
      try {
        await annulerRelancesLeadApporteur(adresse, MOTIF_RELANCES[motif]);
      } catch {
        /* la fiche est archivée ; les relances vérifient aussi la fiche close */
      }
    }
  }

  // 6. Retour en arrière : « Non retenu » corrigé en « Retenu ».
  const desarchivees = await desarchiverLesRetenus({
    lignes,
    clesRetenus,
    echangesPar,
    motifPar,
    appliquer: opts.appliquer,
  });

  return {
    personnesContresignees,
    personnesNonRetenues,
    archivees,
    laisseesOuvertes,
    desarchivees,
    ecrit: opts.appliquer,
  };
}

async function desarchiverLesRetenus(p: {
  readonly lignes: ReadonlyArray<{
    id: string;
    contactEmailHash: string | null;
    details: unknown;
    archivedAt: Date | null;
    deletedAt: Date | null;
    status: string;
  }>;
  readonly clesRetenus: ReadonlySet<string>;
  readonly echangesPar: ReadonlyMap<string, EchangeAvecPoint[]>;
  readonly motifPar: ReadonlyMap<string, MotifArchivageAuto>;
  readonly appliquer: boolean;
}): Promise<number> {
  const candidates = p.lignes.filter(
    (l) =>
      p.clesRetenus.has(cle(l)) &&
      !p.motifPar.has(cle(l)) &&
      rangeeParLePassagePourNonRetenu(l) &&
      decisionAffichee(p.echangesPar.get(cle(l)) ?? [])?.type === "retenu",
  );
  if (candidates.length === 0) return 0;

  // Un contrat contresigné, À N'IMPORTE QUELLE DATE (la fenêtre du passage ne
  // vaut pas ici), garde la personne rangée.
  const hashes = [
    ...new Set(candidates.map((l) => l.contactEmailHash).filter((h): h is string => !!h)),
  ];
  const signes = await prisma.apporteurReseau.findMany({
    where: {
      signeParSocieteAt: { not: null },
      OR: [{ emailHash: { in: hashes } }, { submissionId: { in: candidates.map((l) => l.id) } }],
    },
    select: { submissionId: true, emailHash: true },
  });
  const clesSignees = new Set<string>();
  for (const s of signes) {
    clesSignees.add(s.emailHash);
    const l = s.submissionId ? p.lignes.find((x) => x.id === s.submissionId) : undefined;
    if (l) clesSignees.add(cle(l));
  }

  let desarchivees = 0;
  for (const l of candidates) {
    if (clesSignees.has(cle(l))) continue;
    if (!p.appliquer) {
      desarchivees += 1;
      continue;
    }
    const ecrite = await prisma.$transaction(async (tx) => {
      const fraiche = await tx.submission.findUnique({
        where: { id: l.id },
        select: { details: true, archivedAt: true, deletedAt: true, status: true },
      });
      if (!fraiche || !rangeeParLePassagePourNonRetenu(fraiche)) return false;
      const {
        [MARQUE_ARCHIVAGE_AUTO]: _date,
        [MARQUE_ARCHIVAGE_AUTO_MOTIF]: _motif,
        [MARQUE_ARCHIVAGE_AUTO_STATUT]: statutAvant,
        ...reste
      } = fraiche.details as Record<string, unknown>;
      const statut =
        typeof statutAvant === "string" && STATUTS_ACTIFS.has(statutAvant)
          ? statutAvant
          : "in_progress";
      // 🔑 Conditionnée à l'archivage QUE LE PASSAGE A POSÉ : si Will a touché la
      // fiche entre-temps, rien n'est écrit.
      const r = await tx.submission.updateMany({
        where: { id: l.id, archivedAt: fraiche.archivedAt, status: "archived", deletedAt: null },
        data: {
          status: statut as SubmissionStatus,
          archivedAt: null,
          details: reste as Prisma.InputJsonObject,
        },
      });
      if (r.count === 0) return false;
      await tx.activityLog.create({
        data: {
          adminUserId: null,
          action: "submission.desarchivage_auto",
          targetType: "submission",
          targetId: l.id,
          changes: { motif: "non-retenu-corrige-en-retenu", statut },
        },
      });
      return true;
    });
    // Les relances retirées à l'archivage ne repartent pas (comme « Désarchiver »).
    if (ecrite) desarchivees += 1;
  }
  return desarchivees;
}
