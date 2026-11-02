/**
 * HISTORIQUE `origines` d'une personne (ADR contrat v3, §2 et I4/I6).
 *
 * Union SANS RETRAIT, dédoublonnée sur (post_ref, canal, date à la seconde) — `null` traité
 * comme une valeur (M2). Plafond : 50 entrées ACTIVES par personne ; au-delà, la plus ancienne
 * est ARCHIVÉE (`archivee_le` posée, lecture seule). AUCUNE ligne n'est supprimée. L'écriture et
 * l'archivage se font dans UNE transaction, sous verrou consultatif propre à la personne.
 * Alerte (journal + Sentry, sans donnée de personne) si l'archive d'une personne dépasse 200.
 *
 * `commentaire_ref` n'est gardé qu'en HMAC à clé serveur, jamais brut (I6). Aucun pseudo, aucun
 * texte : le contrat les refuse déjà.
 */
import { createHash, createHmac } from "node:crypto";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/prisma";
import type { DemandeGuideReseau } from "./contrat";

export const PLAFOND_ORIGINES = 50;
export const SEUIL_ALERTE_ARCHIVE = 200;

const DOMAINE_COMMENTAIRE = "guides-reseau-commentaire-ref-v1";
const CLE_DEV = "axion-ia-dev-only-do-not-use-in-prod";

/** HMAC du jeton de commentaire. Clé dérivée de `PII_ENCRYPTION_KEY` par séparation de domaine. */
export function hmacCommentaireRef(ref: string): string {
  const configuree = process.env.PII_ENCRYPTION_KEY?.trim();
  const cle = configuree && configuree.length > 0 ? configuree : CLE_DEV;
  if (cle === CLE_DEV && process.env.NODE_ENV === "production") {
    throw new Error("PII_ENCRYPTION_KEY manquant en production (origine des guides réseau).");
  }
  return createHmac("sha256", cle).update(`${DOMAINE_COMMENTAIRE}:${ref}`).digest("hex");
}

export interface OrigineAEcrire {
  readonly mot: string;
  readonly reseau: string;
  readonly guide: string;
  readonly postRef: string | null;
  readonly postUrl: string | null;
  readonly canal: string | null;
  readonly famille: string | null;
  readonly detail: string | null;
  readonly compte: string | null;
  readonly versionTexte: string | null;
  readonly utmCampagne: string | null;
  readonly commentaireRefHmac: string | null;
  /** Date de l'origine, tronquée à la seconde. */
  readonly occurredAt: Date;
}

export function construireOrigine(d: DemandeGuideReseau, quand: Date): OrigineAEcrire {
  const v3 = d.schemaVersion === 3 ? d : null;
  return {
    mot: d.mot,
    reseau: d.reseau,
    guide: d.guide,
    postRef: v3?.post_ref ?? null,
    postUrl: v3?.post_url ?? null,
    canal: v3?.canal ?? null,
    famille: v3?.famille ?? null,
    detail: v3?.detail ?? null,
    compte: v3?.compte ?? null,
    versionTexte: v3?.version_texte ?? null,
    utmCampagne: v3?.utm_campaign ?? null,
    commentaireRefHmac: v3?.commentaire_ref ? hmacCommentaireRef(v3.commentaire_ref) : null,
    occurredAt: new Date(Math.floor(quand.getTime() / 1000) * 1000),
  };
}

/** Clé de dédoublonnage : (mot, réseau, guide, post_ref, canal, date à la seconde). */
export function cleDedoublonnage(o: OrigineAEcrire): string {
  return createHash("sha256")
    .update(
      JSON.stringify([o.mot, o.reseau, o.guide, o.postRef, o.canal, o.occurredAt.toISOString()]),
    )
    .digest("hex");
}

export async function enregistrerOrigine(
  emailKey: string,
  o: OrigineAEcrire,
): Promise<{ creee: boolean; archivees: number }> {
  const resultat = await prisma.$transaction(async (tx) => {
    // Verrou consultatif de la personne : deux demandes simultanées ne dépassent jamais le plafond.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"origines:" + emailKey}))`;
    const { count } = await tx.guideReseauOrigine.createMany({
      data: { emailKey, cleDedoublonnage: cleDedoublonnage(o), ...o },
      skipDuplicates: true,
    });
    const actives = await tx.guideReseauOrigine.findMany({
      where: { emailKey, archiveeLe: null },
      orderBy: { occurredAt: "asc" },
      select: { id: true },
    });
    const trop = actives.length - PLAFOND_ORIGINES;
    let archivees = 0;
    if (trop > 0) {
      const ids = actives.slice(0, trop).map((l) => l.id);
      await tx.guideReseauOrigine.updateMany({
        where: { id: { in: ids } },
        data: { archiveeLe: new Date() },
      });
      archivees = ids.length;
    }
    const total = await tx.guideReseauOrigine.count({
      where: { emailKey, archiveeLe: { not: null } },
    });
    return { creee: count > 0, archivees, total };
  });
  if (resultat.total > SEUIL_ALERTE_ARCHIVE) {
    console.warn(
      JSON.stringify({ event: "guides_reseau_archive_depasse", seuil: SEUIL_ALERTE_ARCHIVE }),
    );
    try {
      Sentry.captureMessage("guides-reseau : archive d'origines au-delà de 200 pour une personne", {
        level: "warning",
        tags: { area: "guides-reseau", action: "archive-origines" },
      });
    } catch {
      /* l'observabilité ne casse jamais la réponse */
    }
  }
  return { creee: resultat.creee, archivees: resultat.archivees };
}
