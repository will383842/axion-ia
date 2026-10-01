/**
 * Indicateur 21 ⭐ — les FICHIERS des pièces de compétence validées, dans le
 * dossier d'audit global.
 *
 * ## Le défaut que ce module ferme (audit initial, 2026-10-01)
 *
 * `formateurs/pieces.json` listait des ADRESSES. L'auditrice désigne un
 * intervenant et ouvre sa pièce : avec une adresse, elle doit sortir du dossier,
 * et la pièce peut avoir changé ou disparu depuis la remise. Le dossier porte
 * désormais le fichier lui-même, sous `formateurs/<intervenant>/`.
 *
 * ## D'où vient le fichier
 *
 * `TrainerDocument.fichierUrl` est une adresse saisie en console — il n'y a PAS
 * de téléversement R2 des pièces formateur. Deux cas :
 *
 *   - une adresse INTERNE vers une pièce du registre (`/api/qualiopi/documents/
 *     <id>`) : le PDF est lu dans R2, comme toutes les pièces du dossier ;
 *   - une adresse EXTERNE (https) : elle est récupérée par `ssrfSafeFetch`
 *     (adresses privées refusées, redirections revérifiées), avec un délai et
 *     une taille bornés, et seulement si la réponse est un FICHIER (PDF, image,
 *     document Word). Un lien de partage qui rend une page web n'est pas une
 *     pièce : il est dit tel quel.
 *
 * ⛔ Jamais d'échec silencieux : chaque pièce non rapatriée est écrite dans
 * l'index, dans les avertissements (le dossier devient INCOMPLET) et dans le
 * manifeste, sous l'indicateur 21.
 */

import type JSZip from "jszip";
import { prisma } from "@/lib/prisma";
import { documentPdfKey, getObjectBufferR2 } from "@/lib/r2-storage";
import { ssrfSafeFetch } from "@/lib/ssrf-safe-fetch";
import { estPieceCompetenceProbante } from "@/server/qualiopi/trainers/piece-competence";
import { originePublique } from "./liens-site-public";
import { pieceAdmissibleAuDossier } from "./piece-admissible";
import { documentJointAuDossierAudit } from "./hors-dossier-audit";

/** Délai de récupération d'un fichier externe. */
const DELAI_RECUPERATION_MS = 15_000;
/** Taille maximale d'une pièce rapatriée. */
const TAILLE_MAX_OCTETS = 20 * 1024 * 1024;
/** Récupérations simultanées. */
const LOT = 4;

const EXTENSION_PAR_TYPE_MIME: Readonly<Record<string, string>> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
};

const LIBELLE_TYPE_PIECE: Readonly<Record<string, string>> = {
  cv: "CV",
  diplome: "diplôme",
  certification: "certification",
};

export type RecuperationPiece =
  | { readonly ok: true; readonly buffer: Buffer; readonly extension: string }
  | { readonly ok: false; readonly motif: string };

const MOTIF_ID_DOCUMENT = /^\/api\/qualiopi\/documents\/([0-9a-f-]{36})\/?$/i;

/** Récupère le fichier d'une pièce. Ne lève jamais : un échec rend son motif. */
export async function recupererFichierPiece(adresse: string): Promise<RecuperationPiece> {
  const url = adresse.trim();
  let chemin: string | null = null;
  if (url.startsWith("/")) {
    chemin = url.split(/[?#]/)[0] ?? url;
  } else {
    try {
      const parsee = new URL(url);
      if (parsee.origin === new URL(originePublique()).origin) chemin = parsee.pathname;
    } catch {
      return { ok: false, motif: "adresse illisible" };
    }
  }

  // ── Pièce du registre : lue dans R2, comme les autres pièces du dossier ──
  if (chemin !== null) {
    const id = MOTIF_ID_DOCUMENT.exec(chemin)?.[1];
    if (id === undefined) {
      return { ok: false, motif: "adresse interne qui ne désigne pas une pièce du registre" };
    }
    try {
      // Même prédicat que toutes les pièces du dossier : une pièce annulée, ou
      // d'une session annulée ou reportée, ne prouve rien.
      const doc = await prisma.documentGenere.findFirst({
        where: { id, ...pieceAdmissibleAuDossier() },
        select: { type: true, numero: true, createdAt: true },
      });
      if (doc === null) {
        return {
          ok: false,
          motif: "pièce du registre introuvable, annulée ou rattachée à une session annulée",
        };
      }
      // 🔴 Règle X-mode-auditeur-05 — la MÊME que pour `preuves/` : un contrat
      // de travail, une autofacture, une facture, un devis ou un avoir ne
      // sortent jamais dans le dossier d'audit, même par une adresse saisie
      // sur une pièce formateur.
      if (!documentJointAuDossierAudit(doc.type)) {
        return { ok: false, motif: "non joint (type exclu du dossier d'audit)" };
      }
      const buffer = await getObjectBufferR2(documentPdfKey(doc));
      if (buffer === null) return { ok: false, motif: "PDF absent du stockage R2" };
      return { ok: true, buffer, extension: "pdf" };
    } catch {
      return { ok: false, motif: "lecture impossible" };
    }
  }

  // ── Adresse externe : récupération bornée, par `ssrfSafeFetch` ────────────
  // ⚠️ La garde de `ssrfSafeFetch` résout le nom AVANT la requête : une
  // réponse DNS qui change entre les deux (rebinding) n'est pas couverte. Reste
  // préexistant, hors de ce module.
  try {
    const reponse = await ssrfSafeFetch(url, {
      signal: AbortSignal.timeout(DELAI_RECUPERATION_MS),
      headers: { Accept: "application/pdf,image/*,application/msword,*/*;q=0.1" },
    });
    if (!reponse.ok) return { ok: false, motif: `le lien répond ${reponse.status}` };
    const longueur = Number(reponse.headers.get("content-length") ?? "0");
    if (longueur > TAILLE_MAX_OCTETS) {
      await reponse.body?.cancel().catch(() => undefined);
      return { ok: false, motif: MOTIF_TROP_VOLUMINEUX };
    }
    const typeMime = (reponse.headers.get("content-type") ?? "").split(";")[0]?.trim() ?? "";
    // Le plafond se tient EN FLUX : un serveur qui n'annonce pas sa taille (ou
    // ment) ne fait jamais monter plus de 20 Mo en mémoire.
    const buffer = await lireAvecPlafond(reponse, TAILLE_MAX_OCTETS);
    if (buffer === null) return { ok: false, motif: MOTIF_TROP_VOLUMINEUX };
    const estPdf = buffer.subarray(0, 5).toString("latin1") === "%PDF-";
    const extension = estPdf ? "pdf" : EXTENSION_PAR_TYPE_MIME[typeMime.toLowerCase()];
    if (extension === undefined) {
      return {
        ok: false,
        motif:
          typeMime.toLowerCase() === "text/html"
            ? "le lien mène à une page web, pas au fichier (lien de partage à rendre direct, ou pièce à déposer)"
            : "type non pris en charge",
      };
    }
    return { ok: true, buffer, extension };
  } catch (err) {
    return { ok: false, motif: motifEchecRecuperation(err) };
  }
}

const MOTIF_TROP_VOLUMINEUX = "trop volumineux (plus de 20 Mo)";

/**
 * Lit le corps en comptant les octets, et ANNULE la lecture dès que le plafond
 * est franchi. `null` = trop volumineux.
 */
export async function lireAvecPlafond(reponse: Response, plafond: number): Promise<Buffer | null> {
  const corps = reponse.body;
  if (corps === null) return Buffer.alloc(0);
  const lecteur = corps.getReader();
  const morceaux: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await lecteur.read();
    if (done) break;
    total += value.byteLength;
    if (total > plafond) {
      await lecteur.cancel().catch(() => undefined);
      return null;
    }
    morceaux.push(value);
  }
  return Buffer.concat(morceaux);
}

/**
 * Motif GÉNÉRIQUE d'un échec de récupération. Le message brut (qui peut porter
 * l'IP résolue, un nom d'hôte interne, une pile) n'est jamais écrit dans
 * l'index ni dans le manifeste remis au certificateur.
 */
function motifEchecRecuperation(err: unknown): string {
  const nom = err instanceof Error ? err.name : "";
  const message = err instanceof Error ? err.message : "";
  if (nom === "TimeoutError" || nom === "AbortError") return "délai dépassé";
  if (message.startsWith("ssrf-safe-fetch:")) return "adresse refusée";
  return "récupération impossible";
}

/** Nom de dossier lisible, sans accents ni séparateurs. */
export function dossierIntervenant(nom: string): string {
  const slug = nom
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug === "" ? "intervenant" : slug;
}

export interface PieceFormateurZip {
  readonly trainerId: string;
  readonly formateur: string;
  readonly type: string;
  readonly statutValidation: string;
  readonly fichierUrl: string | null;
  readonly dateExpiration: Date | null;
}

export interface ResultatPiecesCompetence {
  readonly nbInclus: number;
  readonly nbOmis: number;
  /** Lignes à porter sous l'indicateur 21 du manifeste. */
  readonly lignesManifeste: string[];
}

/**
 * Joint au ZIP le fichier de chaque pièce de compétence PROBANTE (même
 * prédicat que le moteur), écrit l'index, les avertissements, et rend les
 * lignes du manifeste.
 */
export async function joindreFichiersPiecesCompetence(
  zip: JSZip,
  indexLines: string[],
  avertissements: string[],
  pieces: readonly PieceFormateurZip[],
  maintenant: Date,
): Promise<ResultatPiecesCompetence> {
  const probantes = pieces.filter((p) => estPieceCompetenceProbante(p, maintenant));
  indexLines.push(
    "",
    `Pièces de compétence validées (ind. 21) : ${probantes.length} → formateurs/<intervenant>/`,
  );
  if (probantes.length === 0) {
    indexLines.push("  Aucune pièce de compétence validée, avec fichier et non expirée.");
    return {
      nbInclus: 0,
      nbOmis: 0,
      lignesManifeste: [
        "Aucune pièce de compétence validée à joindre au dossier (CV, diplôme ou certification avec fichier, non expirée)",
      ],
    };
  }

  // Un dossier par intervenant ; deux homonymes ne se mélangent pas.
  const dossierParFormateur = new Map<string, string>();
  const dossiersPris = new Set<string>();
  for (const p of probantes) {
    if (dossierParFormateur.has(p.trainerId)) continue;
    let dossier = dossierIntervenant(p.formateur);
    if (dossiersPris.has(dossier)) dossier = `${dossier}-${p.trainerId.slice(0, 8)}`;
    dossiersPris.add(dossier);
    dossierParFormateur.set(p.trainerId, dossier);
  }

  const cheminsPris = new Set<string>();
  const echecs: string[] = [];
  let nbInclus = 0;
  for (let i = 0; i < probantes.length; i += LOT) {
    const lot = probantes.slice(i, i + LOT);
    const resultats = await Promise.all(
      lot.map(async (p) => ({ p, r: await recupererFichierPiece(p.fichierUrl ?? "") })),
    );
    for (const { p, r } of resultats) {
      const libelle = LIBELLE_TYPE_PIECE[p.type] ?? p.type;
      if (!r.ok) {
        indexLines.push(`[OMIS] formateurs — ${p.formateur} — ${libelle} : ${r.motif}`);
        echecs.push(`${p.formateur} — ${libelle} : ${r.motif}`);
        continue;
      }
      const base = `formateurs/${dossierParFormateur.get(p.trainerId) ?? "intervenant"}/${p.type}`;
      let chemin = `${base}.${r.extension}`;
      for (let n = 2; cheminsPris.has(chemin); n++) chemin = `${base}-${n}.${r.extension}`;
      cheminsPris.add(chemin);
      zip.file(chemin, r.buffer);
      indexLines.push(`[OK]  ${chemin}  (${r.buffer.byteLength} octets)`);
      nbInclus++;
    }
  }

  if (echecs.length > 0) {
    avertissements.push(
      `⚠️ ${echecs.length} pièce${echecs.length > 1 ? "s" : ""} de compétence validée${echecs.length > 1 ? "s" : ""} non jointe${echecs.length > 1 ? "s" : ""} au dossier (fichier inaccessible) — indicateur 21. Détail dans index.txt et dans le manifeste.`,
    );
  }

  return {
    nbInclus,
    nbOmis: echecs.length,
    lignesManifeste: [
      `${nbInclus}/${probantes.length} pièce${probantes.length > 1 ? "s" : ""} de compétence validée${probantes.length > 1 ? "s" : ""} jointe${nbInclus > 1 ? "s" : ""} au dossier, sous formateurs/<intervenant>/`,
      ...echecs.map((e) => `Pièce non jointe — fichier inaccessible : ${e}`),
    ],
  };
}
