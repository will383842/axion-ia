// Pièces jointes d'un e-mail : résolution clé R2 → fichier, commune au WORKER (envoi) et à
// l'APERÇU de la console (`pieces-jointes-apercu.ts`). Une seule fonction décide ce qui
// part : l'aperçu ne recopie aucune règle. (Extrait de `queue/workers/email-worker.ts`, qui
// ré-exporte ces noms.)

import { createHash } from "node:crypto";

import type { SendEmailParams } from "@/lib/email/client";
import { getObjectBufferR2, isR2Configured } from "@/lib/r2-storage";
import { captureWorkerError } from "@/server/queue/lib/sentry-worker";
import type { EmailJobData } from "@/server/queue/types";

/**
 * Plafond cumulé des pièces jointes, en octets bruts (avant encodage base64).
 * Exporté pour que la garde soit testable — une borne qu'aucun test ne lit se
 * fait relever d'un facteur dix le jour où un envoi coince.
 */
export const TAILLE_MAX_PJ_OCTETS = 10 * 1_048_576;

/** Une pièce facultative que l'e-mail n'a pas emportée, et pourquoi. Jamais de clé R2 ici. */
export interface PieceOmise {
  filename: string;
  motif: "introuvable" | "trop lourde";
}

export interface PiecesResolues {
  pieces: NonNullable<SendEmailParams["attachments"]>;
  /** Pièces FACULTATIVES non jointes (l'e-mail part quand même). */
  omises: PieceOmise[];
  /** Empreinte de chaque pièce FACULTATIVE jointe : quelle version du fichier est partie. */
  empreintes: Array<{ filename: string; sha256: string }>;
}

/**
 * Une pièce facultative ne part pas : journal et Sentry, SANS la clé R2 (celle d'un contrat
 * porte l'identifiant du dossier) — le nom du fichier montré au destinataire suffit.
 */
function signalerPieceOmise(
  filename: string,
  motif: PieceOmise["motif"],
  silencieux = false,
): void {
  // Aperçu console : rien n'est envoyé, donc ni journal ni alerte « worker ».
  if (silencieux) return;
  const message = `[email-worker] pièce facultative non jointe (${motif}) : ${filename} — l'e-mail part sans elle`;
  console.warn(message);
  captureWorkerError("email", "emails", undefined, new Error(message));
}

/**
 * Hub facturation — résout les pièces jointes d'un job (clé R2 → Buffer).
 * FAIL-HARD (revue M8) : les templates affirment « le document est joint » —
 * envoyer sans la PJ serait un mensonge au client. PJ irrécupérable → throw
 * → retry BullMQ (backoff), puis job `failed` visible (Sentry + logs).
 *
 * 2026-11-25 (relecture de la PR #2255, I2) — sauf pour une pièce marquée `facultative`,
 * que le gabarit ne promet pas (annexes de l'e-mail « contrat signé » d'un apporteur) :
 * introuvable, illisible, ou trop lourde pour le plafond, elle est OMISE, journalisée et
 * signalée, et l'e-mail part avec le reste. Une annexe retirée ou remplacée entre la mise en
 * file et l'envoi ne retient plus le contrat.
 */
export async function resoudrePiecesJointes(
  attachments: EmailJobData["attachments"],
  options: { silencieux?: boolean } = {},
): Promise<PiecesResolues> {
  const silencieux = options.silencieux === true;
  const omises: PieceOmise[] = [];
  const empreintes: PiecesResolues["empreintes"] = [];
  if (!attachments || attachments.length === 0) return { pieces: [], omises, empreintes };
  if (!isR2Configured()) {
    throw new Error(
      "[email-worker] pièces jointes demandées mais R2 non configuré — envoi refusé (le template promet un document joint)",
    );
  }
  let octetsTotal = 0;
  // Les pièces EXIGÉES d'abord : une facultative ne prend jamais la place d'une exigée dans le
  // plafond. Chaque résultat garde son rang, l'ordre d'origine est rétabli à la fin.
  const ordonnees = attachments
    .map((att, rang) => ({ att, rang }))
    .sort((a, b) => Number(a.att.facultative === true) - Number(b.att.facultative === true));
  const jointes: Array<{ rang: number; piece: PiecesResolues["pieces"][number] }> = [];
  const nonJointes: Array<{ rang: number; omise: PieceOmise }> = [];
  const hachees: Array<{ rang: number; empreinte: PiecesResolues["empreintes"][number] }> = [];
  for (const { att, rang } of ordonnees) {
    const facultative = att.facultative === true;
    const buffer = await getObjectBufferR2(att.r2Key).catch(() => null);
    if (buffer === null) {
      if (facultative) {
        nonJointes.push({ rang, omise: { filename: att.filename, motif: "introuvable" } });
        signalerPieceOmise(att.filename, "introuvable", silencieux);
        continue;
      }
      throw new Error(
        `[email-worker] PJ introuvable sur R2 (${att.r2Key}) — envoi refusé, retry BullMQ`,
      );
    }
    if (facultative && octetsTotal + buffer.byteLength > TAILLE_MAX_PJ_OCTETS) {
      nonJointes.push({ rang, omise: { filename: att.filename, motif: "trop lourde" } });
      signalerPieceOmise(att.filename, "trop lourde", silencieux);
      continue;
    }
    octetsTotal += buffer.byteLength;
    if (facultative) {
      const sha256 = createHash("sha256").update(buffer).digest("hex").slice(0, 16);
      hachees.push({ rang, empreinte: { filename: att.filename, sha256 } });
    }
    jointes.push({
      rang,
      piece: {
        filename: att.filename,
        content: buffer,
        contentType: att.contentType ?? "application/pdf",
      },
    });
  }
  const parRang = (a: { rang: number }, b: { rang: number }): number => a.rang - b.rang;
  const resolved = jointes.sort(parRang).map((j) => j.piece);
  omises.push(...nonJointes.sort(parRang).map((n) => n.omise));
  empreintes.push(...hachees.sort(parRang).map((h) => h.empreinte));

  // 🔴 Audit du 2026-08-16 — AUCUNE garde de taille n'existait.
  //
  // On tirait de R2 des tampons de taille arbitraire et on les confiait au
  // relais. Le refus arrivait donc de Zoho, après transfert, sous la forme d'un
  // rejet SMTP opaque — puis cinq fois de suite, le temps que BullMQ épuise ses
  // tentatives à repousser les mêmes mégaoctets.
  //
  // Le seuil porte sur les octets BRUTS alors que le plafond des relais porte
  // sur le message encodé : le base64 gonfle d'environ un tiers, et s'ajoutent
  // le corps HTML et les en-têtes. 10 Mo bruts ≈ 13,7 Mo transmis, ce qui reste
  // sous les plafonds usuels (~15 Mo ZeptoMail, ~20 Mo Zoho Mail) avec de la
  // marge. Repère : le catalogue imprimable, la plus grosse PJ du dépôt, pèse
  // 7,8 Mo — rien d'existant ne bute sur ce seuil aujourd'hui.
  if (octetsTotal > TAILLE_MAX_PJ_OCTETS) {
    const mo = (n: number): string => (n / 1_048_576).toFixed(1);
    throw new Error(
      `[email-worker] pièces jointes trop lourdes : ${mo(octetsTotal)} Mo bruts pour ` +
        `${resolved.length} fichier(s), plafond ${mo(TAILLE_MAX_PJ_OCTETS)} Mo. Le relais ` +
        `rejetterait le message après transfert — on refuse ici, avec un motif lisible. ` +
        `Alléger le document ou le remplacer par un lien de téléchargement.`,
    );
  }
  return { pieces: resolved, omises, empreintes };
}

/** Les pièces seules, ou `undefined` s'il n'y en a aucune (forme attendue par le relais). */
export async function resolveAttachments(
  attachments: EmailJobData["attachments"],
): Promise<SendEmailParams["attachments"]> {
  const { pieces } = await resoudrePiecesJointes(attachments);
  return pieces.length > 0 ? pieces : undefined;
}

/**
 * Note du journal « envoyé » pour un e-mail à pièces FACULTATIVES (I3, I4) : l'empreinte de
 * chaque pièce jointe (quelle version est partie) et le nom de chaque pièce non jointe.
 * `undefined` quand le job n'en porte aucune : les autres e-mails ne changent pas.
 */
export function notePiecesFacultatives(r: PiecesResolues): string | undefined {
  const phrases = [
    ...r.empreintes.map((e) => `Pièce jointe : ${e.filename} (sha256 ${e.sha256}).`),
    ...r.omises.map((o) => `Pièce non jointe : ${o.filename} (${o.motif}).`),
  ];
  return phrases.length > 0 ? phrases.join(" ") : undefined;
}
