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
  type MotifArchivageAuto,
} from "@/lib/commercial-application/etape-suivi-apporteur";
import { annulerRelancesLeadApporteur } from "./relances-lead-apporteur";
import type { Prisma } from "../../../prisma/generated/client";

export interface BilanArchivageAuto {
  /** Personnes dont le contrat est contresigné (dans la fenêtre). */
  readonly personnesContresignees: number;
  /** Personnes dont la dernière décision est « Non retenu » (dans la fenêtre). */
  readonly personnesNonRetenues: number;
  /** Lignes rangées (ou à ranger, à blanc). */
  readonly archivees: number;
  /** Lignes déjà rangées automatiquement puis rouvertes par Will : laissées telles quelles. */
  readonly laisseesOuvertes: number;
  /** Faux pour un essai à blanc. */
  readonly ecrit: boolean;
}

const MOTIF_RELANCES: Readonly<Record<MotifArchivageAuto, string>> = {
  "contrat-contresigne": "Envoi annulé : le contrat est contresigné, la fiche est archivée.",
  "non-retenu": "Envoi annulé : l'issue « Non retenu » est enregistrée, la fiche est archivée.",
};

const cle = (l: { id: string; contactEmailHash: string | null }) =>
  l.contactEmailHash ?? `id:${l.id}`;

export async function archiverApporteursTermines(opts: {
  /** Faux : on compte, on n'écrit rien. */
  readonly appliquer: boolean;
  /** Ne regarder que les contresignatures / décisions depuis cette date. `null` : tout. */
  readonly depuis: Date | null;
  readonly maintenant?: Date;
}): Promise<BilanArchivageAuto> {
  const maintenant = opts.maintenant ?? new Date();
  const depuis = opts.depuis;

  // 1. Les points de départ : contrats contresignés, décisions « Non retenu ».
  const [contresignes, nonRetenus] = await Promise.all([
    prisma.apporteurReseau.findMany({
      where: { signeParSocieteAt: depuis ? { gte: depuis } : { not: null } },
      select: { submissionId: true, emailHash: true },
    }),
    prisma.rendezVousSuivi.findMany({
      where: { decision: "non_retenu", ...(depuis ? { renseigneLe: { gte: depuis } } : {}) },
      select: { calendlyEvent: { select: { linkedSubmissionId: true } } },
    }),
  ]);
  const idsDepart = new Set<string>();
  const hashesDepart = new Set<string>();
  for (const d of contresignes) {
    if (d.submissionId) idsDepart.add(d.submissionId);
    hashesDepart.add(d.emailHash);
  }
  for (const n of nonRetenus) {
    const id = n.calendlyEvent.linkedSubmissionId;
    if (id) idsDepart.add(id);
  }
  const vide: BilanArchivageAuto = {
    personnesContresignees: 0,
    personnesNonRetenues: 0,
    archivees: 0,
    laisseesOuvertes: 0,
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
  const clesNonRetenus = new Set<string>();
  for (const n of nonRetenus) {
    const id = n.calendlyEvent.linkedSubmissionId;
    const l = id ? lignes.find((x) => x.id === id) : undefined;
    if (l) clesNonRetenus.add(cle(l));
  }
  let personnesNonRetenues = 0;
  if (clesNonRetenus.size > 0) {
    const lignesNonRetenus = lignes.filter((l) => clesNonRetenus.has(cle(l)));
    const evenements = await prisma.calendlyEvent.findMany({
      where: { linkedSubmissionId: { in: lignesNonRetenus.map((l) => l.id) } },
      select: {
        linkedSubmissionId: true,
        eventTypeName: true,
        status: true,
        startTime: true,
        suivi: { select: { issue: true, decision: true, renseigneLe: true } },
      },
    });
    const echangesPar = new Map<string, EchangeAvecPoint[]>();
    for (const ev of evenements) {
      if (!estAppelApporteur(ev.eventTypeName)) continue;
      const l = lignesNonRetenus.find((x) => x.id === ev.linkedSubmissionId);
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
    const details = {
      ...(l.details as Record<string, unknown>),
      [MARQUE_ARCHIVAGE_AUTO]: maintenant.toISOString(),
    } as Prisma.InputJsonObject;
    const ecrite = await prisma.$transaction(async (tx) => {
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

  return {
    personnesContresignees,
    personnesNonRetenues,
    archivees,
    laisseesOuvertes,
    ecrit: opts.appliquer,
  };
}
