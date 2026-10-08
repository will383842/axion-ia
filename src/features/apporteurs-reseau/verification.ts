/**
 * Réseau d'apporteurs (démarrage manuel) — la VÉRIFICATION d'un dossier signé, par Williams.
 *
 * Décision du 2026-10-05 :
 * - chaque pièce est jugée « conforme » ou « à retransmettre » avec un motif ; la pièce
 *   d'identité est SUPPRIMÉE dès qu'elle est conforme (seule la date de vérification reste) ;
 * - trois issues :
 *   · oui : contresignature, puis envoi du contrat signé des deux parties ;
 *   · à compléter : e-mail prérempli avec les pièces à retransmettre et la note ;
 *   · non, définitif : e-mail courtois, lien révoqué.
 * - le contrat n'est conclu qu'à la contresignature (contrat v2, « Formation du contrat »).
 *
 * La contresignature reconstruit le texte signé à partir des valeurs enregistrées à la
 * signature et refuse si son empreinte diffère : la Société signe EXACTEMENT ce que
 * l'apporteur a signé.
 */

import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { prisma } from "@/lib/prisma";
import { decryptPii } from "@/lib/pii-crypto";
import { deleteFromR2, getObjectBufferR2, isR2Configured, uploadToR2 } from "@/lib/r2-storage";

import { empreinte, rendreContratPdf, texteDuContrat, type ValeursContrat } from "./contrat-pdf";
import { lireDossier, purgerContenuPieces } from "./donnees";
import {
  apercu,
  avecTexteLibre,
  envoyer,
  type EnvoiApporteur,
  type GabaritApporteur,
} from "./envois";
import { urlDossier } from "./jeton";
import { signalerErreurReseau } from "./signaler";
import { lireEntrepriseParSiren, lireRegistre } from "./annuaire";
import { LIBELLE_PIECE, MOTIFS_A_RETRANSMETTRE, sirenValide, type TypePiece } from "./regles";
import { retraitDe } from "./retrait";

const dossierUrlSi = (url: string | null): { dossierUrl?: string } =>
  url ? { dossierUrl: url } : {};

export type Decision = "contresigner" | "a_completer" | "refuser";

const SIGNATAIRE_SOCIETE = "Williams Jullin";

/** « 5 octobre 2026 à 14 h 02 », heure de Paris. */
export function dateHeureParis(d: Date): string {
  const jour = d.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Paris",
  });
  const heure = d
    .toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" })
    .replace(":", " h ");
  return `${jour} à ${heure}`;
}

// ── Pièces ───────────────────────────────────────────────────────────────

export async function jugerPiece(
  pieceId: string,
  verdict: "conforme" | "a_retransmettre",
  motif: string | null,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const p = await prisma.pieceApporteur.findUnique({
    where: { id: pieceId },
    select: { id: true, type: true, purgeeAt: true },
  });
  if (!p) return { ok: false, message: "Pièce introuvable." };
  if (verdict === "a_retransmettre" && !MOTIFS_A_RETRANSMETTRE.some((m) => m.valeur === motif)) {
    return { ok: false, message: "Choisissez un motif." };
  }
  const maintenant = new Date();
  await prisma.$transaction(
    async (tx) => {
      await tx.pieceApporteur.update({
        where: { id: pieceId },
        data: {
          statut: verdict,
          motif: verdict === "a_retransmettre" ? motif : null,
          verifieeAt: maintenant,
          // La pièce d'identité n'est gardée que le temps de la vérifier (REQ-JUR-029 de Partners).
          ...(verdict === "conforme" && p.type === "identite" ? { purgeeAt: maintenant } : {}),
        },
      });
      if (verdict === "conforme" && p.type === "identite") {
        await tx.pieceApporteurContenu.deleteMany({ where: { pieceId } });
      }
    },
    { timeout: 15_000 },
  );
  return { ok: true };
}

/** « RIB : illisible » pour chaque pièce courante à retransmettre. */
export async function piecesARetransmettre(apporteurId: string): Promise<string[]> {
  const pieces = await prisma.pieceApporteur.findMany({
    where: { apporteurId, remplaceeAt: null, statut: "a_retransmettre" },
    select: { type: true, motif: true },
  });
  return pieces.map((p) => {
    const motif =
      MOTIFS_A_RETRANSMETTRE.find((m) => m.valeur === p.motif)?.libelle ?? "à remplacer";
    return `${LIBELLE_PIECE[p.type as TypePiece]} : ${motif}`;
  });
}

// ── Décisions ────────────────────────────────────────────────────────────

interface SignatureLue {
  /** Version du contrat signé ; « 2 » pour les signatures d'avant son enregistrement. */
  version: string;
  nomTape: string;
  signeAt: string;
  ipHash: string | null;
  navigateur: string | null;
  acceptations: string[];
  declarations: string[];
  texteSha256: string;
  valeurs: ValeursContrat;
  /** Texte exact signé, archivé à la signature (absent des anciens dossiers). */
  texte: string | null;
}

function lireSignature(json: unknown): SignatureLue | null {
  if (!json || typeof json !== "object") return null;
  const j = json as Record<string, unknown>;
  const v = j.valeurs as Record<string, unknown> | undefined;
  const chaine = (x: unknown) => (typeof x === "string" ? x : null);
  if (!v || !chaine(j.nomTape) || !chaine(j.signeAt) || !chaine(j.texteSha256)) return null;
  const valeurs: ValeursContrat = {
    identite: chaine(v.identite) ?? "",
    statutJuridique: chaine(v.statutJuridique) ?? "",
    siren: chaine(v.siren) ?? "",
    siege: chaine(v.siege) ?? "",
    qualite: chaine(v.qualite) ?? "",
    grilleDate: chaine(v.grilleDate) ?? "",
  };
  const liste = (x: unknown) =>
    Array.isArray(x) ? x.filter((y): y is string => typeof y === "string") : [];
  return {
    version: chaine(j.version) ?? "2",
    nomTape: j.nomTape as string,
    signeAt: j.signeAt as string,
    ipHash: chaine(j.ipHash),
    navigateur: chaine(j.navigateur),
    acceptations: liste(j.acceptations),
    declarations: liste(j.declarations),
    texteSha256: j.texteSha256 as string,
    valeurs,
    texte: typeof j.texte === "string" && j.texte.length > 0 ? j.texte : null,
  };
}

/** Durée d'une réservation de contresignature : au-delà, un nouveau clic la reprend. */
const RESERVATION_CONTRESIGNATURE_MS = 10 * 60 * 1000;

/**
 * Ordre de Will (07/10) : aucun contrat contresigné sans SIREN valide et ACTIF au registre
 * (travail dissimulé, vigilance, solidarité financière, autofacture). Revérifié au moment de
 * contresigner ; registre muet, entreprise cessée ou introuvable → refus, sans contournement :
 * il suffit de recliquer quand le registre répond. Rend le message pour Williams, ou `null`.
 */
export async function sirenAContresigner(
  siren: string | null,
  siret: string | null = null,
): Promise<string | null> {
  if (!siren || !sirenValide(siren))
    return "SIREN à vérifier : absent ou invalide. Cliquez d'abord « À compléter » (avec une note qui demande le bon numéro) : l'apporteur le corrige à l'étape 2 de son dossier, puis signe à nouveau.";
  // Avec un SIRET (plusieurs activités) : c'est l'ÉTABLISSEMENT qui doit être actif.
  const r = siret ? await lireRegistre(siret) : await lireEntrepriseParSiren(siren);
  if (!r.ok) {
    return r.raison === "indisponible"
      ? "SIREN à vérifier : le registre public ne répond pas pour l'instant. Réessayez dans quelques minutes."
      : "SIREN à vérifier : introuvable au registre public, le contrat ne peut pas être contresigné. Une micro-entreprise toute neuve peut ne pas encore y être publiée : réessayez dans quelques jours.";
  }
  if (!r.entreprise.active)
    return siret
      ? "SIRET à vérifier : l'entreprise ou cet établissement est fermé au registre public. Le contrat ne peut pas être contresigné."
      : "SIREN à vérifier : l'entreprise est cessée au registre public. Le contrat ne peut pas être contresigné.";
  return null;
}

/** L'e-mail que la décision fera partir, prêt pour l'aperçu puis l'envoi. */
export async function preparerDecision(
  apporteurId: string,
  decision: Decision,
  note: string | null,
  texte?: string,
): Promise<{ ok: true; envoi: EnvoiApporteur } | { ok: false; message: string }> {
  const d = await lireDossier(apporteurId);
  if (!d) return { ok: false, message: "Apporteur introuvable." };
  if (d.statut !== "a_verifier")
    return { ok: false, message: "Ce dossier n'attend pas de vérification." };
  const base = { destinataire: d.email, entityType: "ApporteurReseau" as const, entityId: d.id };
  const mot = note?.trim() || null;
  if (decision === "contresigner") {
    const blocage = await sirenAContresigner(d.siren, d.siret);
    if (blocage) return { ok: false, message: blocage };
    const nonConformes = d.pieces.filter((p) => p.statut !== "conforme" && p.type !== "rc_pro");
    if (nonConformes.length > 0) {
      return {
        ok: false,
        message:
          "Toutes les pièces obligatoires doivent être marquées conformes avant de contresigner.",
      };
    }
    const gabarit: GabaritApporteur = "apporteur-contrat-signe";
    return {
      ok: true,
      envoi: {
        ...base,
        gabarit,
        // Le lien du dossier porte le formulaire « Déclarer une entreprise » (bouton de l'e-mail).
        payload: avecTexteLibre(
          { contactName: d.prenom, ...dossierUrlSi(urlDossier(d.id, d.versionLien)) },
          texte,
        ),
      },
    };
  }
  if (decision === "a_completer") {
    const pieces = await piecesARetransmettre(apporteurId);
    if (pieces.length === 0 && !mot) {
      return {
        ok: false,
        message: "Indiquez ce qui manque : une pièce à retransmettre ou une note.",
      };
    }
    const nouvelleVersion = d.versionLien;
    return {
      ok: true,
      envoi: {
        ...base,
        gabarit: "apporteur-dossier-a-completer",
        payload: avecTexteLibre(
          {
            contactName: d.prenom,
            piecesARetransmettre: pieces,
            ...(mot ? { motPersonnel: mot } : {}),
            dossierUrl: urlDossier(d.id, nouvelleVersion) ?? "",
          },
          texte,
        ),
      },
    };
  }
  return {
    ok: true,
    envoi: {
      ...base,
      gabarit: "apporteur-dossier-refuse",
      payload: avecTexteLibre(
        { contactName: d.prenom, ...(mot ? { motPersonnel: mot } : {}) },
        texte,
      ),
    },
  };
}

export async function apercuDecision(
  apporteurId: string,
  decision: Decision,
  note: string | null,
  texte?: string,
) {
  const prep = await preparerDecision(apporteurId, decision, note, texte);
  if (!prep.ok) return prep;
  return { ok: true as const, email: await apercu(prep.envoi) };
}

/**
 * Applique la décision : écrit, puis envoie. La contresignature rend et stocke le
 * contrat signé des deux parties avant d'écrire quoi que ce soit.
 */
export async function appliquerDecision(
  apporteurId: string,
  decision: Decision,
  note: string | null,
  texte?: string,
): Promise<{ ok: true; message: string } | { ok: false; message: string }> {
  const prep = await preparerDecision(apporteurId, decision, note, texte);
  if (!prep.ok) return prep;
  const maintenant = new Date();

  if (decision === "contresigner") {
    const a = await prisma.apporteurReseau.findUnique({
      where: { id: apporteurId },
      select: { signatureApporteur: true, contratSha256: true },
    });
    const sig = lireSignature(a?.signatureApporteur);
    if (!sig)
      return {
        ok: false,
        message: "La signature de l'apporteur est illisible : demandez-lui de signer à nouveau.",
      };
    // Texte archivé à la signature (empreinte revérifiée) ; sinon, ancien dossier : on
    // reconstruit depuis le contrat courant et on compare.
    const texte = sig.texte ?? texteDuContrat(sig.valeurs);
    if (empreinte(texte) !== sig.texteSha256) {
      return {
        ok: false,
        message: "Le texte signé ne correspond plus : demande à l'apporteur de signer à nouveau.",
      };
    }
    if (!isR2Configured())
      return { ok: false, message: "Le stockage des documents n'est pas configuré." };
    // Double clic, deux onglets : une seule contresignature. Le dossier est RÉSERVÉ par un champ
    // DÉDIÉ, qui expire (un conteneur redémarré pendant le PDF ne bloque rien au-delà) ;
    // `signeParSocieteAt` n'est posé qu'à la toute fin, avec le PDF référencé.
    const jusqua = new Date(maintenant.getTime() + RESERVATION_CONTRESIGNATURE_MS);
    const reserve = await prisma.apporteurReseau.updateMany({
      where: {
        id: apporteurId,
        statut: "a_verifier",
        signeParSocieteAt: null,
        OR: [
          { contresignatureReserveeJusqua: null },
          { contresignatureReserveeJusqua: { lt: maintenant } },
        ],
      },
      data: { contresignatureReserveeJusqua: jusqua },
    });
    if (reserve.count === 0) {
      return {
        ok: false,
        message: "Ce contrat est déjà contresigné, ou sa contresignature est en cours.",
      };
    }
    const liberer = async () => {
      try {
        await prisma.apporteurReseau.updateMany({
          where: { id: apporteurId, contresignatureReserveeJusqua: jusqua },
          data: { contresignatureReserveeJusqua: null },
        });
      } catch (err) {
        // La réservation expire d'elle-même : jamais de blocage définitif.
        signalerErreurReseau("contresignature : réservation non levée", err);
      }
    };
    let pdf: Buffer;
    try {
      pdf = await rendreContratPdf({
        version: sig.version,
        texte,
        apporteur: {
          nomTape: sig.nomTape,
          signeAt: dateHeureParis(new Date(sig.signeAt)),
          ipHash: sig.ipHash,
          navigateur: sig.navigateur,
          acceptations: sig.acceptations,
          declarations: sig.declarations,
        },
        societe: { nom: SIGNATAIRE_SOCIETE, signeAt: dateHeureParis(maintenant) },
      });
    } catch (err) {
      await liberer();
      throw err;
    }
    const sha = createHash("sha256").update(pdf).digest("hex");
    // Clé PROPRE à cette tentative (suffixée par sa réservation) : une tentative n'efface
    // jamais le PDF d'une autre.
    const cle = `apporteurs/${apporteurId}/contrat-v2-signe-${sig.texteSha256.slice(0, 8)}-${jusqua.getTime()}-${randomBytes(4).toString("hex")}.pdf`;
    try {
      await uploadToR2(cle, pdf, "application/pdf");
    } catch (err) {
      await liberer();
      throw err;
    }
    // Écriture finale CONDITIONNÉE à NOTRE réservation, et vérifiée : sans elle, le PDF déposé
    // serait un orphelin jamais effacé (RGPD) — on le retire, et aucun e-mail ne part.
    let ecrit = 0;
    try {
      const r = await prisma.apporteurReseau.updateMany({
        where: { id: apporteurId, statut: "a_verifier", contresignatureReserveeJusqua: jusqua },
        data: {
          statut: "signe",
          contratSigneCle: cle,
          contratSigneSha256: sha,
          signeParSocieteAt: maintenant,
          contresignatureReserveeJusqua: null,
          dernierMessage: null,
        },
      });
      ecrit = r.count;
    } catch (err) {
      signalerErreurReseau("contresignature : écriture finale", err);
    }
    if (ecrit !== 1) {
      // L'écriture a pu réussir sans que la réponse arrive (connexion coupée) : on RELIT la base,
      // et l'on n'efface que si elle ne référence pas ce PDF.
      let reference: string | null | undefined;
      try {
        const relu = await prisma.apporteurReseau.findUnique({
          where: { id: apporteurId },
          select: { contratSigneCle: true },
        });
        reference = relu?.contratSigneCle ?? null;
      } catch (err) {
        signalerErreurReseau("contresignature : relecture après écriture", err);
        reference = undefined;
      }
      if (reference === cle) {
        // Contresigné pour de bon : on poursuit comme si la réponse était arrivée.
        ecrit = 1;
      } else if (reference !== undefined) {
        try {
          await deleteFromR2(cle);
        } catch (err) {
          signalerErreurReseau("contresignature : PDF orphelin non retiré de R2", err);
        }
      }
    }
    if (ecrit !== 1) {
      await liberer();
      return {
        ok: false,
        message:
          "La contresignature n'a pas pu être enregistrée : rien n'est parti. Réessayez dans un instant.",
      };
    }
    const r = await envoyer({
      ...prep.envoi,
      jobId: `apporteur-contrat-signe-${apporteurId}`,
      attachments: [
        { filename: "Contrat-apporteur-Axion-IA.pdf", r2Key: cle, contentType: "application/pdf" },
      ],
    });
    return {
      ok: true,
      message:
        r === "envoye" ? "Contrat contresigné et envoyé." : `Contrat contresigné (e-mail : ${r}).`,
    };
  }

  if (decision === "a_completer") {
    await prisma.apporteurReseau.update({
      where: { id: apporteurId },
      data: { statut: "a_completer", dernierMessage: note?.trim() || null },
    });
    const r = await envoyer({
      ...prep.envoi,
      jobId: `apporteur-dossier-a-completer-${apporteurId}-${maintenant.getTime()}`,
    });
    return {
      ok: true,
      message:
        r === "envoye" ? "Demande de complément envoyée." : `Dossier rouvert (e-mail : ${r}).`,
    };
  }

  await prisma.$transaction(
    async (tx) => {
      await tx.apporteurReseau.update({
        where: { id: apporteurId },
        data: {
          statut: "refuse",
          refuseAt: maintenant,
          dernierMessage: note?.trim() || null,
          versionLien: { increment: 1 },
          // Refus définitif : l'IBAN (chiffré) n'a plus de raison d'être gardé non plus.
          iban: null,
        },
      });
      // Refus définitif : plus aucune raison de garder la pièce d'identité ni le RIB.
      await purgerContenuPieces(tx, { apporteurId, types: ["identite", "rib"] });
    },
    { timeout: 15_000 },
  );
  const r = await envoyer({ ...prep.envoi, jobId: `apporteur-dossier-refuse-${apporteurId}` });
  return {
    ok: true,
    message: r === "envoye" ? "Refus envoyé." : `Dossier refusé (e-mail : ${r}).`,
  };
}

/**
 * Rejoue l'e-mail « contrat signé » (avec le contrat des deux parties en pièce jointe),
 * SANS refaire la signature : pour le cas où le premier envoi n'est jamais arrivé
 * (file en panne, adresse retenue, pièce introuvable). La clé d'idempotence est distincte
 * à chaque renvoi.
 */
export async function renvoyerContratSigne(
  apporteurId: string,
  maintenant: Date = new Date(),
): Promise<{ ok: true; message: string } | { ok: false; message: string }> {
  const d = await lireDossier(apporteurId);
  if (!d) return { ok: false, message: "Apporteur introuvable." };
  if (d.statut !== "signe")
    return { ok: false, message: "Ce contrat n'est pas encore contresigné." };
  const a = await prisma.apporteurReseau.findUnique({
    where: { id: apporteurId },
    select: { contratSigneCle: true },
  });
  if (!a?.contratSigneCle) return { ok: false, message: "Le contrat signé est introuvable." };
  const r = await envoyer({
    destinataire: d.email,
    entityType: "ApporteurReseau",
    entityId: d.id,
    gabarit: "apporteur-contrat-signe",
    payload: { contactName: d.prenom, ...dossierUrlSi(urlDossier(d.id, d.versionLien)) },
    jobId: `apporteur-contrat-signe-${apporteurId}-renvoi-${maintenant.getTime()}`,
    attachments: [
      {
        filename: "Contrat-apporteur-Axion-IA.pdf",
        r2Key: a.contratSigneCle,
        contentType: "application/pdf",
      },
    ],
  });
  return {
    ok: true,
    message: r === "envoye" ? "Contrat signé renvoyé." : `Renvoi préparé (e-mail : ${r}).`,
  };
}

// ── Lien du dossier ──────────────────────────────────────────────────────

export async function preparerLien(apporteurId: string, mot: string | null, texte?: string) {
  const d = await lireDossier(apporteurId);
  if (!d) return { ok: false as const, message: "Apporteur introuvable." };
  if (d.statut === "refuse" || d.statut === "resilie")
    return { ok: false as const, message: "Ce dossier est fermé." };
  // Un dossier signé (à vérifier ou contresigné) n'a plus de lien à compléter (07/10).
  if (d.statut === "a_verifier" || d.statut === "signe")
    return {
      ok: false as const,
      message: "Ce dossier est déjà signé : il n'y a plus de lien à lui envoyer.",
    };
  // Retiré du réseau (2026-10-07) : pas de lien de dossier (aperçu comme envoi).
  if (await retraitDe(d.id))
    return {
      ok: false as const,
      message:
        "Cette fiche est retirée du réseau : son lien de dossier est désactivé. Remettez-la dans le réseau d'abord.",
    };
  const url = urlDossier(d.id, d.versionLien);
  if (!url)
    return { ok: false as const, message: "Impossible de fabriquer le lien (secret absent)." };
  const envoi: EnvoiApporteur = {
    gabarit: "apporteur-dossier-lien",
    destinataire: d.email,
    payload: avecTexteLibre(
      {
        contactName: d.prenom,
        dossierUrl: url,
        ...(mot?.trim() ? { motPersonnel: mot.trim() } : {}),
      },
      texte,
    ),
    entityType: "ApporteurReseau",
    entityId: d.id,
  };
  const dejaEnvoyeLe = await dernierLienEnvoyeLe(d.id);
  return { ok: true as const, envoi, url, dejaEnvoyeLe };
}

/** « Nouvel apporteur » sur une adresse déjà connue : statut du dossier et dernier lien envoyé. */
export async function etatDuDossier(
  apporteurId: string,
): Promise<{ statut: string; dernierLienLe: string | null }> {
  const { LIBELLE_STATUT_APPORTEUR } = await import("./requetes-console");
  const a = await prisma.apporteurReseau.findUnique({
    where: { id: apporteurId },
    select: { statut: true },
  });
  return {
    statut: a ? LIBELLE_STATUT_APPORTEUR[a.statut] : "inconnu",
    dernierLienLe: await dernierLienEnvoyeLe(apporteurId),
  };
}

/**
 * Date du dernier lien envoyé (lien, rappel, ou « Retenu » qui porte le lien), « 6 octobre »,
 * ou `null`. Sert à « déjà envoyé le … » (fiche) et à « Nouvel apporteur ».
 */
export async function dernierLienEnvoyeLe(apporteurId: string): Promise<string | null> {
  const lie = await prisma.apporteurReseau.findUnique({
    where: { id: apporteurId },
    select: { submissionId: true },
  });
  const dernier = await prisma.emailLog.findFirst({
    where: {
      status: { in: ["pending", "sent"] },
      OR: [
        {
          template: "apporteur-dossier-lien",
          entityType: "ApporteurReseau",
          entityId: apporteurId,
        },
        ...(lie?.submissionId
          ? [
              {
                template: "apporteur-issue-retenu",
                entityType: "Submission",
                entityId: lie.submissionId,
              },
            ]
          : []),
      ],
    },
    select: { createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  return dernier
    ? dernier.createdAt.toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "long",
        timeZone: "Europe/Paris",
      })
    : null;
}

export async function envoyerLien(
  apporteurId: string,
  mot: string | null,
  texte?: string,
  confirmerRenvoi = false,
) {
  const prep = await preparerLien(apporteurId, mot, texte);
  if (!prep.ok) return prep;
  if (prep.dejaEnvoyeLe && !confirmerRenvoi) {
    return {
      ok: false as const,
      message: `Lien déjà envoyé le ${prep.dejaEnvoyeLe} : ouvrez l'aperçu et confirmez pour le renvoyer.`,
    };
  }
  const r = await envoyer({
    ...prep.envoi,
    jobId: `apporteur-dossier-lien-${apporteurId}-${Date.now()}`,
  });
  return {
    ok: true as const,
    message: r === "envoye" ? "Lien envoyé." : `Lien préparé (e-mail : ${r}).`,
  };
}

// ── Documents pour la console ────────────────────────────────────────────

export async function lireContratPdf(
  apporteurId: string,
  quel: "apporteur" | "signe",
): Promise<Buffer | null> {
  const a = await prisma.apporteurReseau.findUnique({
    where: { id: apporteurId },
    select: { contratCle: true, contratSigneCle: true },
  });
  const cle = quel === "signe" ? a?.contratSigneCle : a?.contratCle;
  if (!cle) return null;
  return getObjectBufferR2(cle);
}

/** Nom affiché d'un apporteur (console). */
export async function nomApporteur(apporteurId: string): Promise<string> {
  const a = await prisma.apporteurReseau.findUnique({
    where: { id: apporteurId },
    select: { prenom: true, nom: true },
  });
  return a ? `${decryptPii(a.prenom) ?? ""} ${decryptPii(a.nom) ?? ""}`.trim() : "";
}

// ── Dossier ouvert à la main (une personne rencontrée hors du tunnel) ────

export async function ouvrirDossierManuel(e: {
  prenom: string;
  nom: string;
  email: string;
  telephone: string | null;
  /** Fiche candidat choisie dans la recherche de « Nouvel apporteur » (07/10). */
  submissionId?: string | null;
}): Promise<
  | { ok: true; apporteurId: string; existait?: true }
  | { ok: false; message: string; dejaRelieA?: string }
> {
  const { encryptPii } = await import("@/lib/pii-crypto");
  const { hashEmailForLookup } = await import("@/lib/security/email-hash");
  const email = e.email.trim();
  const hash = hashEmailForLookup(email);
  if (!e.prenom.trim() || !e.nom.trim() || !hash)
    return { ok: false, message: "Prénom, nom et e-mail sont nécessaires." };
  const existant = await prisma.apporteurReseau.findUnique({
    where: { emailHash: hash },
    select: { id: true },
  });
  if (existant) return { ok: true, apporteurId: existant.id, existait: true };
  // La fiche candidat choisie dans la recherche, sinon celle de la même adresse, s'il y en a une : le dossier y est relié
  // (07/10), comme quand il naît de « Retenu ».
  const { estApporteur, FILTRE_APPORTEUR_PRISMA } =
    await import("@/lib/commercial-application/est-apporteur");
  const candidatures = await prisma.submission.findMany({
    where: {
      // Fiche choisie : reliée SEULEMENT si son adresse est celle saisie (07/10, a1).
      ...(e.submissionId ? { id: e.submissionId } : {}),
      contactEmailHash: hash,
      deletedAt: null,
      ...FILTRE_APPORTEUR_PRISMA,
    },
    orderBy: { submittedAt: "desc" },
    take: 5,
    select: { id: true, details: true },
  });
  const trouvee = candidatures.find((c) => estApporteur(c.details));
  // Lien unique : une fiche déjà reliée à un autre dossier ne l'est pas une seconde fois.
  const relie = trouvee
    ? await prisma.apporteurReseau.findUnique({
        where: { submissionId: trouvee.id },
        select: { id: true, prenom: true, nom: true },
      })
    : null;
  if (relie && e.submissionId) {
    const qui = [decryptPii(relie.prenom), decryptPii(relie.nom)].filter(Boolean).join(" ");
    return {
      ok: false,
      message: `Cette fiche est déjà reliée au dossier de ${qui || "un autre apporteur"}.`,
      dejaRelieA: relie.id,
    };
  }
  const candidature = trouvee && !relie ? trouvee : null;
  let a: { id: string };
  try {
    a = await prisma.apporteurReseau.create({
      data: {
        ...(candidature ? { submissionId: candidature.id } : {}),
        prenom: encryptPii(e.prenom.trim()),
        nom: encryptPii(e.nom.trim()),
        email: encryptPii(email),
        emailHash: hash,
        telephone: e.telephone?.trim() ? encryptPii(e.telephone.trim()) : null,
      },
      select: { id: true },
    });
  } catch (err) {
    // Deux clics, deux onglets : l'adresse vient d'être prise (unicité de `emailHash`).
    const doublon = await prisma.apporteurReseau.findUnique({
      where: { emailHash: hash },
      select: { id: true },
    });
    if (doublon) return { ok: true, apporteurId: doublon.id, existait: true };
    throw err;
  }
  return { ok: true, apporteurId: a.id };
}
