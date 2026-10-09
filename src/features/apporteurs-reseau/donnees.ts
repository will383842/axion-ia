/**
 * Réseau d'apporteurs (démarrage manuel) — lecture et écriture en base.
 *
 * Nom, e-mail, téléphone, IBAN de l'apporteur et coordonnées des personnes présentées
 * sont CHIFFRÉS (`encryptPii`) ; l'e-mail porte en plus son empreinte de recherche
 * (`hashEmailForLookup`), qui sert à l'export et à l'effacement RGPD.
 *
 * Node runtime (Prisma). Stub-aware : au build, le client Prisma factice rend des listes vides.
 */

import "server-only";

import { createHash } from "node:crypto";

import { prisma } from "@/lib/prisma";
import { decryptPii, encryptPii } from "@/lib/pii-crypto";
import { hashEmailForLookup } from "@/lib/security/email-hash";
import { analyserOctets, type VerdictAntivirus } from "@/server/careers/clamav";
import { formatDepuisNom, signatureConforme } from "@/features/dossier-client/documents/formats";
import type {
  ApporteurReseauStatut,
  RegimeTvaApporteur,
  StatutPieceApporteur,
  TypePieceApporteur,
} from "../../../prisma/generated/client";

import { alerterPieceVigilance } from "./alerte-vigilance";
import { chiffrerContenuPiece } from "./pieces-chiffrement";
import { jetonDossierValide, lienDossierBienForme } from "./jeton";
import { estStatutJuridique, ibanValide, PIECES_VIGILANCE, type TypePiece } from "./regles";
import { signalerErreurReseau } from "./signaler";
import { enregistrerSiret, siretDe } from "./siret-apporteur";
import { enregistrerQualite, lireQualite, type QualiteApporteur } from "./qualite-apporteur";
import { CLE_REGISTRE_INDISPONIBLE, etatDeLaPage, vigilanceDemandee } from "./signature-regles";
import { argentEnJeu, retraitDe } from "./retrait";

const FENETRE_ALERTE_ANTIVIRUS_MS = 15 * 60 * 1000;
let derniereAlerteAntivirus = 0;

/** Antivirus muet : une alerte Sentry par 15 minutes au plus (garde en mémoire), sans donnée personnelle. */
export function alerterAntivirusIndisponible(maintenant: number = Date.now()): boolean {
  if (maintenant - derniereAlerteAntivirus < FENETRE_ALERTE_ANTIVIRUS_MS) return false;
  derniereAlerteAntivirus = maintenant;
  signalerErreurReseau("antivirus indisponible", new Error("pièce refusée : antivirus muet"));
  return true;
}

/** Réservé aux tests : remet la garde à zéro. */
export function reinitialiserAlerteAntivirus(): void {
  derniereAlerteAntivirus = 0;
}

/** Taille maximale d'une pièce déposée (10 Mo : une photo de téléphone y tient). */
export const TAILLE_MAX_PIECE = 10 * 1024 * 1024;
const FORMATS_PIECE = new Set(["pdf", "png", "jpg"]);

const MIME: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
};

// ── Création ─────────────────────────────────────────────────────────────

function separerNom(complet: string): { prenom: string; nom: string } {
  const mots = complet.trim().split(/\s+/).filter(Boolean);
  if (mots.length <= 1) return { prenom: mots[0] ?? "", nom: "" };
  return { prenom: mots[0]!, nom: mots.slice(1).join(" ") };
}

/**
 * Ouvre (ou retrouve) le dossier d'un apporteur à partir de sa candidature.
 * Idempotent : une même adresse e-mail n'ouvre qu'un dossier.
 */
export async function ouvrirDossierDepuisCandidature(
  submissionId: string,
  options: { creer?: boolean } = {},
): Promise<
  | {
      ok: true;
      apporteurId: string;
      versionLien: number;
      email: string;
      prenom: string;
      /** Où en est le dossier (un dossier déjà signé ne reçoit plus « complétez… »). */
      statut: string;
    }
  | { ok: false; message: string; ferme?: true; refuseLe?: Date | null }
> {
  const s = await prisma.submission.findUnique({
    where: { id: submissionId },
    select: { id: true, contactName: true, contactEmail: true, contactPhone: true },
  });
  if (!s) return { ok: false, message: "Candidature introuvable." };
  const email = decryptPii(s.contactEmail)?.trim() ?? "";
  const emailHash = hashEmailForLookup(email);
  if (!email || !emailHash)
    return { ok: false, message: "Cette candidature n'a pas d'adresse e-mail utilisable." };
  const existant = await prisma.apporteurReseau.findUnique({
    where: { emailHash },
    select: { id: true, versionLien: true, prenom: true, statut: true, refuseAt: true },
  });
  if (existant && existant.statut === "refuse" && options.creer !== false) {
    // Dossier refusé puis « Retenu » plus tard : on le rouvre PROPREMENT. Le lien envoyé au
    // refus est mort (`versionLien` incrémentée) ; on en ouvre un nouveau, et les pièces
    // purgées au refus doivent être redéposées.
    const maintenant = new Date();
    const rouvert = await prisma.$transaction(
      async (tx) => {
        await tx.pieceApporteur.updateMany({
          where: { apporteurId: existant.id, type: { in: ["identite", "rib"] }, remplaceeAt: null },
          data: { remplaceeAt: maintenant },
        });
        return tx.apporteurReseau.update({
          where: { id: existant.id },
          data: {
            statut: "dossier_en_cours",
            refuseAt: null,
            dernierMessage: null,
            versionLien: { increment: 1 },
          },
          select: { versionLien: true },
        });
      },
      { timeout: 15_000 },
    );
    return {
      ok: true,
      apporteurId: existant.id,
      versionLien: rouvert.versionLien,
      statut: "dossier_en_cours",
      email,
      prenom: decryptPii(existant.prenom) ?? "",
    };
  }
  // 🔴 Un lien vers un dossier que la page refuse (résilié : `etatDeLaPage` → neutre →
  // 404) ne doit JAMAIS partir (2026-10-07). Le rouvrir demanderait de défaire la
  // signature d'un contrat terminé : c'est une décision humaine, pas un effet de bord
  // de « Retenu ». L'e-mail part donc sans bouton, et la console le dit.
  // Refusé, en APERÇU (`creer: false`) : son ancien lien est mort, il ne sera rouvert
  // qu'à l'envoi — l'aperçu montre le lien d'exemple, pas l'ancien lien (404).
  if (existant && existant.statut === "refuse") {
    return {
      ok: false,
      message: "Dossier refusé : il sera rouvert à l'envoi.",
      refuseLe: existant.refuseAt ?? null,
    };
  }
  if (existant && etatDeLaPage(existant.statut) === "neutre") {
    return {
      ok: false,
      ferme: true,
      message:
        "Le dossier d'apporteur de cette personne est fermé (contrat résilié) : l'e-mail part sans lien de dossier. Un contrat résilié ne se rouvre pas depuis la console ; pour reprendre cette personne, écrivez-lui directement.",
    };
  }
  if (existant) {
    return {
      ok: true,
      apporteurId: existant.id,
      versionLien: existant.versionLien,
      statut: existant.statut,
      email,
      prenom: decryptPii(existant.prenom) ?? "",
    };
  }
  // `creer: false` (aperçu de la console) : on lit, on n'écrit rien.
  if (options.creer === false) return { ok: false, message: "Dossier pas encore ouvert." };
  const { prenom, nom } = separerNom(decryptPii(s.contactName) ?? "");
  const cree = await prisma.apporteurReseau.create({
    data: {
      submissionId: s.id,
      prenom: encryptPii(prenom),
      nom: encryptPii(nom),
      email: encryptPii(email),
      emailHash,
      telephone: s.contactPhone ? encryptPii(decryptPii(s.contactPhone) ?? null) : null,
    },
    select: { id: true, versionLien: true },
  });
  return {
    ok: true,
    apporteurId: cree.id,
    versionLien: cree.versionLien,
    email,
    prenom,
    statut: "dossier_en_cours",
  };
}

// ── Lecture du dossier par l'apporteur (lien personnel) ──────────────────

export interface PieceVue {
  id: string;
  type: TypePiece;
  statut: StatutPieceApporteur;
  motif: string | null;
  nomFichier: string;
  deposeeAt: Date;
}

export interface DossierVue {
  /**
   * Apporteur RETIRÉ du réseau avec de l'argent encore en jeu (2026-10-07) : la page ne
   * propose que le dépôt des attestations de vigilance ; signature, déclarations et
   * dossier sont refusés (page ET actions).
   */
  restreint?: true;
  id: string;
  statut: ApporteurReseauStatut;
  versionLien: number;
  prenom: string;
  nom: string;
  email: string;
  telephone: string | null;
  siren: string | null;
  /** SIRET de l'établissement (plusieurs activités), sinon `null` (absent : pas encore lu). */
  siret?: string | null;
  denomination: string | null;
  adresse: string | null;
  codeNaf: string | null;
  statutJuridique: string | null;
  /** Contrat 2.7, art. 14 (absents : pas encore lus, ou pas encore déclarés). */
  siegeAdresse?: string | null;
  fonctionSignataire?: string | null;
  immatriculeRcs?: boolean | null;
  regimeTva: RegimeTvaApporteur | null;
  numeroTva: string | null;
  ibanMasque: string | null;
  ibanSaisi: boolean;
  declarations: Record<string, string>;
  dernierMessage: string | null;
  signeParApporteurAt: Date | null;
  signeParSocieteAt: Date | null;
  /** Le contrat signé des deux parties existe (téléchargeable par l'apporteur). */
  aContratSigne: boolean;
  pieces: PieceVue[];
}

function masquerIban(iban: string | null): string | null {
  if (!iban) return null;
  const s = iban.replace(/\s+/g, "");
  return `${s.slice(0, 4)} •••• •••• ${s.slice(-4)}`;
}

export async function lireDossier(apporteurId: string): Promise<DossierVue | null> {
  const a = await prisma.apporteurReseau.findUnique({
    where: { id: apporteurId },
    include: {
      pieces: {
        where: { remplaceeAt: null },
        orderBy: { deposeeAt: "asc" },
        select: {
          id: true,
          type: true,
          statut: true,
          motif: true,
          nomFichier: true,
          deposeeAt: true,
        },
      },
    },
  });
  if (!a) return null;
  const iban = decryptPii(a.iban);
  const qualite = await lireQualite(a.id);
  return {
    id: a.id,
    statut: a.statut,
    versionLien: a.versionLien,
    prenom: decryptPii(a.prenom) ?? "",
    nom: decryptPii(a.nom) ?? "",
    email: decryptPii(a.email) ?? "",
    telephone: decryptPii(a.telephone),
    siren: a.siren,
    siret: await siretDe(a.id),
    denomination: a.denomination,
    adresse: a.adresse,
    codeNaf: a.codeNaf,
    statutJuridique: a.statutJuridique,
    siegeAdresse: qualite?.siegeAdresse ?? null,
    fonctionSignataire: qualite?.fonctionSignataire ?? null,
    immatriculeRcs: qualite?.immatriculeRcs ?? null,
    regimeTva: a.regimeTva,
    numeroTva: a.numeroTva,
    ibanMasque: masquerIban(iban),
    ibanSaisi: !!iban,
    declarations: (a.declarations as Record<string, string> | null) ?? {},
    dernierMessage: a.dernierMessage,
    signeParApporteurAt: a.signeParApporteurAt,
    signeParSocieteAt: a.signeParSocieteAt,
    aContratSigne: !!a.contratSigneCle,
    pieces: a.pieces.map((p) => ({ ...p, type: p.type as TypePiece })),
  };
}

/** Le dossier, si le lien est valide. `null` pour tout lien faux, révoqué ou inconnu. */
export async function lireDossierParLien(
  apporteurId: string,
  jeton: string,
): Promise<DossierVue | null> {
  if (process.env.DATABASE_URL?.includes("stub.invalid")) return null;
  // Lien tronqué ou mal formé : page neutre, SANS requête (un id non UUID ferait lever
  // Prisma sur la colonne `@db.Uuid`).
  if (!lienDossierBienForme(apporteurId, jeton)) return null;
  const id = apporteurId.toLowerCase();
  const a = await prisma.apporteurReseau.findUnique({
    where: { id },
    select: { versionLien: true },
  });
  if (!a || !jetonDossierValide(id, a.versionLien, jeton)) return null;
  // Retiré du réseau (2026-10-07) : page neutre, QUEL QUE SOIT le lien — même un lien
  // recalculé sur la version courante n'ouvre pas un dossier retiré… sauf s'il reste de
  // l'ARGENT en jeu : la page s'ouvre alors en MODE RESTREINT (dépôt des attestations de
  // vigilance seulement), pour qu'aucune commission ne soit confisquée de fait.
  if (await retraitDe(id)) {
    if (!(await argentEnJeu(id))) return null;
    const vue = await lireDossier(id);
    return vue ? { ...vue, restreint: true } : null;
  }
  return lireDossier(id);
}

/** Faut-il demander les pièces de vigilance à cet apporteur (page « signé ») ? */
export async function vigilanceDemandeeA(apporteurId: string): Promise<boolean> {
  const [cumul, enAttente] = await Promise.all([
    prisma.commissionApporteur.aggregate({
      where: { apporteurId, statut: { in: ["due", "versee", "en_attente_vigilance"] } },
      _sum: { montantCents: true },
    }),
    prisma.commissionApporteur.count({ where: { apporteurId, statut: "en_attente_vigilance" } }),
  ]);
  const deposees = await prisma.pieceApporteur.count({
    where: { apporteurId, remplaceeAt: null, type: { in: ["vigilance", "immatriculation"] } },
  });
  return vigilanceDemandee({
    cumulCents: cumul._sum.montantCents ?? 0,
    enAttente: enAttente > 0,
    piecesDeposees: deposees,
  });
}

/** Le dossier peut-il encore être modifié par l'apporteur ? */
export function dossierModifiable(statut: ApporteurReseauStatut): boolean {
  return statut === "dossier_en_cours" || statut === "a_completer";
}

// ── Écriture par l'apporteur ─────────────────────────────────────────────

export interface SaisieActivite {
  telephone?: string | null;
  /** Nom de famille, accepté SEULEMENT si le dossier n'en a pas (nom d'un seul mot). */
  nom?: string | null;
  /** Le registre n'a pas répondu : l'admission n'a pas été jugée (à contrôler en console). */
  registreIndisponible?: boolean;
  siren: string;
  /** SIRET de l'établissement (plusieurs activités), ou `null` : seul le SIREN est connu. */
  siret?: string | null;
  denomination: string;
  adresse: string;
  codeNaf: string | null;
  statutJuridique: string;
  regimeTva: RegimeTvaApporteur;
  numeroTva: string | null;
  iban: string | null;
  /** Contrat 2.7, art. 14 : absent (ancien appelant) = rien n'y touche. */
  qualite?: QualiteApporteur;
}

/**
 * Étape 1 (07/10) : nom (complété seulement s'il manquait) et téléphone enregistrés dès
 * « Continuer » — la page promet que le dossier reste enregistré.
 */
export async function enregistrerCoordonnees(
  apporteurId: string,
  s: { nom?: string; telephone: string | null },
): Promise<{ ok: true }> {
  await prisma.apporteurReseau.update({
    where: { id: apporteurId },
    data: {
      ...(s.nom ? { nom: encryptPii(s.nom) } : {}),
      telephone: s.telephone ? encryptPii(s.telephone) : null,
    },
  });
  return { ok: true };
}

export async function enregistrerActivite(
  apporteurId: string,
  s: SaisieActivite,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!estStatutJuridique(s.statutJuridique))
    return { ok: false, message: "Choisissez votre statut." };
  if (
    s.regimeTva === "assujetti" &&
    !/^FR[0-9A-Z]{2}\d{9}$/.test((s.numeroTva ?? "").replace(/\s+/g, "").toUpperCase())
  ) {
    return { ok: false, message: "Indiquez votre numéro de TVA (FR suivi de 11 caractères)." };
  }
  if (s.iban !== null && s.iban !== "" && !ibanValide(s.iban)) {
    return { ok: false, message: "Cet IBAN n'est pas valide : vérifiez-le." };
  }
  let declarations: Record<string, string> | undefined;
  if (s.registreIndisponible !== undefined) {
    // Sans migration : le marqueur vit dans le JSON `declarations`, à côté des cases cochées.
    const lu = await prisma.apporteurReseau.findUnique({
      where: { id: apporteurId },
      select: { declarations: true },
    });
    declarations = { ...((lu?.declarations as Record<string, string> | null) ?? {}) };
    if (s.registreIndisponible) declarations[CLE_REGISTRE_INDISPONIBLE] = new Date().toISOString();
    else delete declarations[CLE_REGISTRE_INDISPONIBLE];
  }
  // SIREN et SIRET dans UNE transaction : un nouveau SIREN ne reste jamais à côté d'un ancien
  // SIRET (2026-10-08).
  await prisma.$transaction(async (tx) => {
    await tx.apporteurReseau.update({
      where: { id: apporteurId },
      data: {
        ...(declarations ? { declarations } : {}),
        ...(s.nom ? { nom: encryptPii(s.nom) } : {}),
        ...(s.telephone !== undefined
          ? { telephone: s.telephone ? encryptPii(s.telephone) : null }
          : {}),
        siren: s.siren,
        denomination: s.denomination.slice(0, 250),
        adresse: s.adresse,
        codeNaf: s.codeNaf,
        statutJuridique: s.statutJuridique,
        regimeTva: s.regimeTva,
        numeroTva:
          s.regimeTva === "assujetti"
            ? (s.numeroTva ?? "").replace(/\s+/g, "").toUpperCase()
            : null,
        ...(s.iban ? { iban: encryptPii(s.iban.replace(/\s+/g, "").toUpperCase()) } : {}),
      },
    });
    // SIRET de l'établissement : posé, remplacé, ou retiré si l'apporteur revient au seul SIREN.
    // `undefined` (ancien appelant) : rien n'y touche.
    if (s.siret !== undefined) await enregistrerSiret(apporteurId, s.siret, tx);
  });
  // Hors transaction : table séparée (fenêtre app/worker) ; absente, le contrat garde le texte
  // d'avant la 2.7, et le dossier n'est jamais bloqué pour autant.
  if (s.qualite) await enregistrerQualite(apporteurId, s.qualite);
  return { ok: true };
}

/**
 * Dépose une pièce. Contrôles : format (PDF, PNG, JPG) par l'extension ET les premiers
 * octets, taille, antivirus (le verdict « sain » est OBLIGATOIRE : un fichier infecté est
 * refusé, et si l'antivirus ne répond pas la pièce est refusée aussi — jamais de pièce
 * gardée sans verdict). Un nouveau dépôt remplace la pièce courante du même type ; une
 * pièce d'identité remplacée voit son contenu purgé.
 */
export async function deposerPiece(
  apporteurId: string,
  type: TypePieceApporteur,
  nomFichier: string,
  octets: Uint8Array,
  expireAt: Date | null = null,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const format = formatDepuisNom(nomFichier);
  if (!format || !FORMATS_PIECE.has(format) || !signatureConforme(format, octets)) {
    return { ok: false, message: "Format accepté : PDF, ou photo (JPG, PNG)." };
  }
  if (octets.length === 0 || octets.length > TAILLE_MAX_PIECE) {
    return { ok: false, message: "Le fichier doit faire moins de 10 Mo." };
  }
  let verdict: VerdictAntivirus;
  try {
    verdict = await analyserOctets(octets, 60_000);
  } catch {
    verdict = { issue: "indisponible", raison: "erreur" };
  }
  if (verdict.issue === "infecte") {
    return {
      ok: false,
      message: "Ce fichier a été refusé par notre antivirus. Envoyez-en un autre.",
    };
  }
  if (verdict.issue !== "sain") {
    alerterAntivirusIndisponible();
    return {
      ok: false,
      message: "Le contrôle du fichier n'a pas pu se faire. Réessayez dans un instant.",
    };
  }
  const sha256 = createHash("sha256").update(octets).digest("hex");
  const maintenant = new Date();
  let pieceId = "";
  await prisma.$transaction(
    async (tx) => {
      // La pièce d'identité ou le RIB remplacés n'ont plus de raison d'être gardés : contenu purgé.
      if (type === "identite" || type === "rib") {
        await purgerContenuPieces(tx, {
          apporteurId,
          types: [type],
          courantesSeulement: true,
        });
      }
      await tx.pieceApporteur.updateMany({
        where: { apporteurId, type, remplaceeAt: null },
        data: { remplaceeAt: maintenant },
      });
      const p = await tx.pieceApporteur.create({
        data: {
          apporteurId,
          type,
          nomFichier: nomFichier.slice(0, 200),
          typeMime: MIME[format] ?? "application/octet-stream",
          taille: octets.length,
          sha256,
          expireAt,
        },
        select: { id: true },
      });
      pieceId = p.id;
      await tx.pieceApporteurContenu.create({
        // Chiffrées au repos (07/10), comme l'IBAN : l'empreinte `sha256` reste celle du clair.
        data: { pieceId: p.id, octets: chiffrerContenuPiece(octets) },
      });
    },
    { timeout: 15_000 },
  );
  // Attestation URSSAF ou immatriculation : Williams est alerté tout de suite (une seule fois par
  // pièce). Une panne d'envoi ne doit jamais faire échouer le dépôt de l'apporteur.
  if (pieceId && (PIECES_VIGILANCE as readonly string[]).includes(type)) {
    try {
      await alerterPieceVigilance(pieceId);
    } catch {
      // le passage quotidien rattrape l'alerte
    }
  }
  return { ok: true };
}

/**
 * Supprime les OCTETS des pièces (la ligne reste, marquée `purgeeAt`) : pièce d'identité
 * jugée conforme, remplacée, ou dossier refusé. Ne touche jamais aux autres types.
 */
export async function purgerContenuPieces(
  tx: Pick<typeof prisma, "pieceApporteur" | "pieceApporteurContenu">,
  f: { apporteurId: string; types: readonly TypePieceApporteur[]; courantesSeulement?: boolean },
): Promise<number> {
  const pieces = await tx.pieceApporteur.findMany({
    where: {
      apporteurId: f.apporteurId,
      type: { in: [...f.types] },
      ...(f.courantesSeulement ? { remplaceeAt: null } : {}),
    },
    select: { id: true },
  });
  if (pieces.length === 0) return 0;
  const ids = pieces.map((p) => p.id);
  await tx.pieceApporteurContenu.deleteMany({ where: { pieceId: { in: ids } } });
  await tx.pieceApporteur.updateMany({
    where: { id: { in: ids }, purgeeAt: null },
    data: { purgeeAt: new Date() },
  });
  return ids.length;
}

export async function enregistrerDeclarations(
  apporteurId: string,
  cles: readonly string[],
): Promise<void> {
  const maintenant = new Date().toISOString();
  // Le marqueur « registre indisponible » (D10) survit à la signature.
  const lu = await prisma.apporteurReseau.findUnique({
    where: { id: apporteurId },
    select: { declarations: true },
  });
  const marqueur = (lu?.declarations as Record<string, string> | null)?.[CLE_REGISTRE_INDISPONIBLE];
  await prisma.apporteurReseau.update({
    where: { id: apporteurId },
    data: {
      declarations: {
        ...Object.fromEntries(cles.map((c) => [c, maintenant])),
        ...(marqueur ? { [CLE_REGISTRE_INDISPONIBLE]: marqueur } : {}),
      },
    },
  });
}

/** IBAN en clair, pour le relevé et le virement (console seulement). */
export async function lireIban(apporteurId: string): Promise<string | null> {
  const a = await prisma.apporteurReseau.findUnique({
    where: { id: apporteurId },
    select: { iban: true },
  });
  return decryptPii(a?.iban ?? null);
}
