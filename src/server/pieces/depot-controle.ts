/**
 * Le DÉPÔT CONTRÔLÉ d'une pièce — module commun (FAC-6, extrait de `deposerPiece` des
 * apporteurs).
 *
 * Une seule séquence, dans cet ordre, pour toute pièce déposée par une personne (dossier
 * apporteur aujourd'hui ; dossier formateur, « Mon dossier », dépôt de facture demain) :
 *   1. format (PDF, PNG, JPG) par l'extension ET les premiers octets ;
 *   2. taille (10 Mo au plus, jamais vide) ;
 *   3. antivirus, 60 s au plus : le verdict « sain » est OBLIGATOIRE — infecté = refusé,
 *      antivirus muet ou en erreur = refusé aussi (jamais de pièce gardée sans verdict), et
 *      l'alerte « antivirus muet » part au plus une fois par quart d'heure ;
 *   4. empreinte SHA-256 du CLAIR.
 * L'appelant garde SA transaction (tables, remplacement, purge) et chiffre au repos les
 * octets qu'il écrit (enveloppe binaire « AXB1 » de `pii-crypto`, `chiffrerPieceAuRepos`
 * ci-dessous — lève sans clé, jamais de repli en clair) : ce module n'écrit rien.
 *
 * Sans `server-only` : sûr pour le worker.
 */

import { createHash } from "node:crypto";

import { formatDepuisNom, signatureConforme } from "@/features/dossier-client/documents/formats";
import { chiffrerOctetsPii } from "@/lib/pii-crypto";
import { analyserOctets, type VerdictAntivirus } from "@/server/careers/clamav";

/** Taille maximale d'une pièce déposée (10 Mo : une photo de téléphone y tient). */
export const TAILLE_MAX_PIECE = 10 * 1024 * 1024;

const FORMATS_PIECE = new Set(["pdf", "png", "jpg"]);

const MIME: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
};

/** Les messages de refus, au caractère près (ils s'affichent tels quels à la personne). */
export const MESSAGES_DEPOT = {
  format: "Format accepté : PDF, ou photo (JPG, PNG).",
  taille: "Le fichier doit faire moins de 10 Mo.",
  infecte: "Ce fichier a été refusé par notre antivirus. Envoyez-en un autre.",
  antivirusMuet: "Le contrôle du fichier n'a pas pu se faire. Réessayez dans un instant.",
} as const;

export interface PieceControlee {
  readonly ok: true;
  readonly typeMime: string;
  readonly taille: number;
  /** Empreinte du CLAIR. */
  readonly sha256: string;
}

export type ResultatControle = PieceControlee | { readonly ok: false; readonly message: string };

const FENETRE_ALERTE_ANTIVIRUS_MS = 15 * 60 * 1000;

/**
 * Une alerte « antivirus muet » au plus par quart d'heure (garde en mémoire), sans donnée
 * personnelle. Chaque monde fabrique la sienne avec son canal d'alerte.
 */
export function alerteAntivirusLimitee(signaler: () => void): {
  alerter: (maintenant?: number) => boolean;
  reinitialiser: () => void;
} {
  let derniere = 0;
  return {
    alerter(maintenant = Date.now()) {
      if (maintenant - derniere < FENETRE_ALERTE_ANTIVIRUS_MS) return false;
      derniere = maintenant;
      signaler();
      return true;
    },
    reinitialiser() {
      derniere = 0;
    },
  };
}

export async function controlerPiece(
  nomFichier: string,
  octets: Uint8Array,
  options: { readonly alerterAntivirusIndisponible: () => unknown },
): Promise<ResultatControle> {
  const format = formatDepuisNom(nomFichier);
  if (!format || !FORMATS_PIECE.has(format) || !signatureConforme(format, octets)) {
    return { ok: false, message: MESSAGES_DEPOT.format };
  }
  if (octets.length === 0 || octets.length > TAILLE_MAX_PIECE) {
    return { ok: false, message: MESSAGES_DEPOT.taille };
  }
  let verdict: VerdictAntivirus;
  try {
    verdict = await analyserOctets(octets, 60_000);
  } catch {
    verdict = { issue: "indisponible", raison: "erreur" };
  }
  if (verdict.issue === "infecte") return { ok: false, message: MESSAGES_DEPOT.infecte };
  if (verdict.issue !== "sain") {
    options.alerterAntivirusIndisponible();
    return { ok: false, message: MESSAGES_DEPOT.antivirusMuet };
  }
  return {
    ok: true,
    typeMime: MIME[format] ?? "application/octet-stream",
    taille: octets.length,
    sha256: createHash("sha256").update(octets).digest("hex"),
  };
}

/** Les octets à écrire en base : chiffrés au repos (« AXB1 »). Lève si la clé manque. */
export function chiffrerPieceAuRepos(clair: Uint8Array): Buffer {
  return chiffrerOctetsPii(Buffer.from(clair));
}
