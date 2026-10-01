/**
 * Le DÉPÔT D'UN MORCEAU de son (`PUT /api/enregistreur/sessions/[id]/morceaux`)
 * — la SEULE entrée d'audio du site (chantier visio, ADR 0054 ; PR 5).
 *
 *   1. l'empreinte annoncée (`x-empreinte`) est RECALCULÉE sur les octets reçus ;
 *   2. rien n'est accepté avant l'accord (409 en `accord_en_attente`), ni après
 *      un refus, un retrait ou une clôture ;
 *   3. la clé R2 est CALCULÉE ICI (`cleR2Morceau`), jamais fournie par
 *      l'extension ;
 *   4. le son est CHIFFRÉ avant d'atteindre R2 (`chiffrerOctets`, AES-256-GCM,
 *      clé `PII_ENCRYPTION_KEY`) ;
 *   5. idempotent : même (tranche, seq) et même empreinte = 200 sans rien
 *      réécrire ; empreinte différente = 409.
 *
 * Une écriture R2 qui échoue rend 503 : l'extension garde le morceau dans son
 * IndexedDB et réessaie.
 *
 * ## Un refus peut passer PENDANT le dépôt
 *
 * Le statut est lu au début ; le refus peut tomber entre cette lecture et
 * l'écriture de la ligne (l'extension a encore des PUT en vol quand Will
 * clique « Refus »). Le refus liste les morceaux UNE fois : le morceau écrit
 * juste après lui échapperait. D'où la relecture du statut APRÈS l'écriture :
 * `refuse` ou `abandonne` → l'objet R2 et la ligne sont supprimés, 409. Si
 * cette suppression échoue, la ligne reste, et `reprendrePurgesDesRefus` la
 * reprend (un enregistrement `refuse` qui a encore un morceau).
 * Test : `un-morceau-arrive-pendant-un-refus-est-supprime.spec.ts`.
 */

import { createHash } from "node:crypto";

import type { PrismaClient } from "../../../prisma/generated/client";
import { chiffrerOctets } from "@/lib/chiffrer-parole";
import { PISTES, TAILLE_MAX_MORCEAU_OCTETS } from "@/lib/schemas/enregistreur";
import { TAILLE_MAX_TRANCHE_OCTETS } from "./audio/constantes";
import { echec, ok, type Resultat } from "./resultat";
import { refusVersionDeSession } from "./version-extension";
import { cleR2Morceau, type StockageAudio } from "./stockage-audio";
import type { Appareil } from "./sessions";

/** États où un morceau est accepté (le son d'avant une `fin` peut arriver après elle). */
export const ETATS_ACCEPTANT_DU_SON = ["en_cours", "interrompu", "depose"] as const;

export interface EntetesMorceau {
  readonly piste: string | null;
  readonly tranche: string | null;
  readonly seq: string | null;
  readonly debutCaptureMs: string | null;
  readonly empreinte: string | null;
}

interface EntetesLues {
  readonly piste: "client" | "axion";
  readonly tranche: number;
  readonly seq: number;
  readonly debutCaptureMs: number | null;
  readonly empreinte: string;
}

function entier(v: string | null, max: number): number | null {
  if (v === null || !/^\d{1,15}$/.test(v)) return null;
  const n = Number(v);
  return Number.isSafeInteger(n) && n <= max ? n : null;
}

/** Valide les en-têtes du dépôt, ou rend `null`. */
export function lireEntetesMorceau(e: EntetesMorceau): EntetesLues | null {
  const piste = (PISTES as ReadonlyArray<string>).includes(e.piste ?? "")
    ? (e.piste as "client" | "axion")
    : null;
  const tranche = entier(e.tranche, 9999);
  const seq = entier(e.seq, 99_999);
  const empreinte = e.empreinte && /^[0-9a-f]{64}$/.test(e.empreinte) ? e.empreinte : null;
  const debutCaptureMs =
    e.debutCaptureMs === null ? null : entier(e.debutCaptureMs, Number.MAX_SAFE_INTEGER);
  if (piste === null || tranche === null || seq === null || empreinte === null) return null;
  if (e.debutCaptureMs !== null && debutCaptureMs === null) return null;
  return { piste, tranche, seq, empreinte, debutCaptureMs };
}

export function empreinteSha256(octets: Buffer): string {
  return createHash("sha256").update(octets).digest("hex");
}

function estConflitUnique(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "P2002";
}

type Db = Pick<PrismaClient, "enregistrement" | "enregistrementTranche" | "enregistrementMorceau">;

/**
 * PR 7 — une DICTÉE, c'est Williams seul (base 6.1.f), sans accord ni preuve
 * d'accord : aucune piste « client » n'y est jamais reçue, quel que soit son
 * statut (morceau comme annonce de fin de tranche).
 */
export const CODE_PISTE_CLIENT_EN_DICTEE = "piste_client_en_dictee" as const;
export function refusPisteClientEnDictee(nature: string, piste: string): Resultat | null {
  if (nature !== "dictee" || piste !== "client") return null;
  return echec(
    409,
    CODE_PISTE_CLIENT_EN_DICTEE,
    "Une dictée ne reçoit que la voix de Williams : la piste du client est refusée.",
  );
}

/** Dépose un morceau chiffré. */
export async function deposerMorceau(
  db: Db,
  stockage: StockageAudio,
  entree: {
    readonly appareil: Appareil;
    readonly enregistrementId: string;
    readonly entetes: EntetesMorceau;
    readonly octets: Buffer;
    readonly maintenant: Date;
  },
): Promise<Resultat> {
  const e = lireEntetesMorceau(entree.entetes);
  if (!e) return echec(400, "entetes_invalides", "En-têtes du morceau absents ou invalides.");
  if (entree.octets.byteLength === 0) return echec(400, "morceau_vide", "Morceau vide.");
  if (entree.octets.byteLength > TAILLE_MAX_MORCEAU_OCTETS) {
    return echec(413, "morceau_trop_gros", "Morceau trop gros.");
  }
  if (empreinteSha256(entree.octets) !== e.empreinte) {
    return echec(
      400,
      "empreinte_fausse",
      "L'empreinte annoncée ne correspond pas au morceau reçu.",
    );
  }

  const enr = await db.enregistrement.findUnique({
    where: { id: entree.enregistrementId },
    select: { id: true, appareilId: true, statut: true, nature: true, versionExtension: true },
  });
  if (!enr || enr.appareilId !== entree.appareil.id) {
    return echec(404, "enregistrement_inconnu", "Enregistrement introuvable.");
  }
  // Relecture E1 — une session ouverte par une extension sans RGPD-01.
  const tropAncienne = refusVersionDeSession(enr);
  if (tropAncienne) return tropAncienne;
  const pisteRefusee = refusPisteClientEnDictee(enr.nature, e.piste);
  if (pisteRefusee) return pisteRefusee;
  if (enr.statut === "accord_en_attente") {
    return echec(
      409,
      "accord_en_attente",
      "Rien n'est reçu avant l'accord : gardez le son localement.",
    );
  }
  if (!(ETATS_ACCEPTANT_DU_SON as ReadonlyArray<string>).includes(enr.statut)) {
    return echec(409, "enregistrement_clos", "Cet enregistrement n'accepte plus de son.", {
      statut: enr.statut,
    });
  }

  // La tranche : créée au premier morceau reçu (l'annonce de fin peut suivre).
  let tranche = await db.enregistrementTranche.findUnique({
    where: {
      enregistrementId_piste_numero: {
        enregistrementId: enr.id,
        piste: e.piste,
        numero: e.tranche,
      },
    },
    select: { id: true, tailleOctets: true, nbMorceauxAnnonces: true, statut: true },
  });
  if (!tranche) {
    if (e.debutCaptureMs === null) {
      return echec(
        400,
        "entetes_invalides",
        "Premier morceau d'une tranche sans heure de début de capture.",
      );
    }
    try {
      tranche = await db.enregistrementTranche.create({
        data: {
          enregistrementId: enr.id,
          piste: e.piste,
          numero: e.tranche,
          debutCaptureEpochMs: BigInt(e.debutCaptureMs),
          motifDebut: e.tranche === 0 ? "demarrage" : "nouvelle_tranche",
          statut: "en_reception",
        },
        select: { id: true, tailleOctets: true, nbMorceauxAnnonces: true, statut: true },
      });
    } catch (err) {
      if (!estConflitUnique(err)) throw err;
      tranche = await db.enregistrementTranche.findUnique({
        where: {
          enregistrementId_piste_numero: {
            enregistrementId: enr.id,
            piste: e.piste,
            numero: e.tranche,
          },
        },
        select: { id: true, tailleOctets: true, nbMorceauxAnnonces: true, statut: true },
      });
      if (!tranche) throw err;
    }
  }

  // Idempotence.
  const existant = await db.enregistrementMorceau.findUnique({
    where: { trancheId_seq: { trancheId: tranche.id, seq: e.seq } },
    select: { empreinte: true },
  });
  if (existant) {
    return existant.empreinte === e.empreinte
      ? ok({ deja: true })
      : echec(409, "morceau_divergent", "Un autre morceau a déjà été reçu à cette place.");
  }
  if (tranche.tailleOctets + entree.octets.byteLength > TAILLE_MAX_TRANCHE_OCTETS) {
    return echec(413, "tranche_trop_grosse", "La tranche dépasse la taille maximale.");
  }

  // Chiffrer, PUIS déposer. La clé est calculée ici.
  const cle = cleR2Morceau(enr.id, e.piste, e.tranche, e.seq);
  let chiffre: Buffer;
  try {
    chiffre = chiffrerOctets(entree.octets);
  } catch {
    return echec(
      503,
      "cle_chiffrement_absente",
      "Le chiffrement est indisponible : nouvel essai plus tard.",
    );
  }
  try {
    await stockage.deposer(cle, chiffre);
  } catch {
    return echec(
      503,
      "stockage_indisponible",
      "Le stockage est indisponible : nouvel essai automatique.",
    );
  }

  try {
    await db.enregistrementMorceau.create({
      data: {
        trancheId: tranche.id,
        seq: e.seq,
        cleR2: cle,
        tailleOctets: entree.octets.byteLength,
        empreinte: e.empreinte,
      },
    });
  } catch (err) {
    if (!estConflitUnique(err)) throw err;
    // Deux envois simultanés du même morceau : le second relit le premier.
    const gagnant = await db.enregistrementMorceau.findUnique({
      where: { trancheId_seq: { trancheId: tranche.id, seq: e.seq } },
      select: { empreinte: true },
    });
    return gagnant?.empreinte === e.empreinte
      ? ok({ deja: true })
      : echec(409, "morceau_divergent", "Un autre morceau a déjà été reçu à cette place.");
  }

  // Le refus a pu passer pendant l'écriture : relire, et défaire si besoin.
  const apres = await db.enregistrement.findUnique({
    where: { id: enr.id },
    select: { statut: true },
  });
  if (!apres || apres.statut === "refuse" || apres.statut === "abandonne") {
    try {
      await stockage.supprimer(cle);
      await db.enregistrementMorceau.delete({
        where: { trancheId_seq: { trancheId: tranche.id, seq: e.seq } },
      });
    } catch (err) {
      // La ligne reste : la reprise des purges de refus la supprimera.
      console.error("[enregistreur] morceau arrivé pendant un refus, suppression reportée :", err);
    }
    return echec(409, "enregistrement_clos", "Un refus a été déclaré : ce morceau est supprimé.", {
      statut: apres?.statut ?? "refuse",
    });
  }

  const recus = await db.enregistrementMorceau.count({ where: { trancheId: tranche.id } });
  await db.enregistrementTranche.update({
    where: { id: tranche.id },
    data: {
      tailleOctets: { increment: entree.octets.byteLength },
      ...(tranche.nbMorceauxAnnonces !== null && recus >= tranche.nbMorceauxAnnonces
        ? { statut: "complete" as const }
        : {}),
    },
  });
  // Un morceau est un signe de vie : il rouvre un `interrompu`. Écriture
  // CONDITIONNÉE au statut : un refus tombé entre-temps n'est jamais écrasé
  // (un `update` nu remettait `en_cours` sur un enregistrement refusé).
  await db.enregistrement.updateMany({
    where: { id: enr.id, statut: { in: [...ETATS_ACCEPTANT_DU_SON] } },
    data: { updatedAt: entree.maintenant },
  });
  if (apres.statut === "interrompu") {
    await db.enregistrement.updateMany({
      where: { id: enr.id, statut: "interrompu" },
      data: { statut: "en_cours" },
    });
  }
  return ok({ recu: true });
}
