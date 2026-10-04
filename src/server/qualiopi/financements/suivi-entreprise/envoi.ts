/**
 * Lot OPCO A8 — envoi du dossier prêt à déposer à l'ENTREPRISE, et relances.
 *
 * Deux appelants : le passage quotidien du worker (`mode: "auto"`) et le bouton
 * « Envoyer le dossier à l'entreprise » de la console (`mode: "manuel"`). Les
 * deux font la même chose :
 *
 *   1. vérifier que le dossier est PRÊT (`eligibiliteEnvoi` : convention signée
 *      constatée au stockage — même vérification que le lot A6 —, contact
 *      entreprise avec e-mail, OPCO dont l'entreprise dépose elle-même) ;
 *   2. émettre le kit OPCO (`produireKitOpco`) et composer le ZIP du lot A6,
 *      déposé au stockage : il se télécharge par un LIEN qui expire, jamais en
 *      pièce jointe (le kit nomme les stagiaires) ;
 *   3. écrire le suivi et le message AVANT de mettre l'e-mail en file : la clé
 *      unique (suivi, étape, rang) rend l'envoi automatique idempotent même si
 *      deux passages se croisent ;
 *   4. mettre l'e-mail en file par le canal transactionnel du dépôt
 *      (`enqueueEmail`) ; file indisponible → le message est retiré, le passage
 *      suivant réessaiera ;
 *   5. journaliser (`ActivityLog`), sans adresse ni nom.
 *
 * ⚠️ Atteint par le WORKER : aucun import Next ni Server Action.
 */

import { prisma } from "@/lib/prisma";
import { isR2Configured, uploadToR2 } from "@/lib/r2-storage";
import { enqueueEmail } from "@/server/queue/queues";
import { produireKitOpco } from "@/server/qualiopi/documents/production/producteurs";
import { assertDossierOuvertSiRegeneration } from "@/server/qualiopi/sessions/verrou-dossier-garde";
import type { PayloadSuiviOpco } from "@/lib/email/templates/opco-suivi-entreprise";
import { chargerDossierPretADeposer } from "../dossier-pret-a-deposer-lecture";
import { construireZipPretADeposer } from "../dossier-pret-a-deposer-zip";
import { suiviEntrepriseActif } from "./drapeau";
import { nouveauJeton } from "./jeton";
import { lireContexteSuivi, type ContexteSuivi } from "./lecture";
import {
  DUREE_JETON_JOURS,
  eligibiliteEnvoi,
  jourDeDate,
  jourFr,
  jourParis,
  type EtapeMessage,
  type QuestionMessage,
  type RelancePrevue,
} from "./planning";

export type ResultatEnvoi =
  | { ok: true; messageId: string; garePourValidation: boolean }
  | { ok: false; motif: string; message: string };

const JOUR_MS = 24 * 60 * 60 * 1000;

function baseUrl(): string {
  return (process.env["NEXT_PUBLIC_SITE_URL"] ?? "https://axion-ia.com").replace(/\/+$/, "");
}

/** Adresse publique de la page de réponse d'un jeton. */
export function lienReponse(jeton: string, reponse?: string): string {
  const url = `${baseUrl()}/api/qualiopi/suivi-opco/${jeton}`;
  return reponse ? `${url}?reponse=${reponse}` : url;
}

/** Adresse publique du téléchargement du dossier (redirection vers une URL signée courte). */
export function lienDossier(jeton: string): string {
  return `${baseUrl()}/api/qualiopi/suivi-opco/${jeton}/dossier`;
}

async function journal(
  action: string,
  dossierId: string,
  changes: Record<string, unknown>,
  adminUserId: string | null,
): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        adminUserId,
        action,
        targetType: "DossierFinancement",
        targetId: dossierId,
        changes: changes as never,
      },
    });
  } catch (err) {
    console.error(
      `[suivi-entreprise-opco] journal « ${action} » non écrit pour ${dossierId}:`,
      err instanceof Error ? err.message : String(err),
    );
  }
}

/** Kit OPCO à remettre : émis maintenant, ou le dernier en vigueur si le dossier est verrouillé. */
async function kitPourEnvoi(
  sessionId: string,
): Promise<{ type: "kit_opco"; numero: string; createdAt: Date } | null> {
  const verrou = await assertDossierOuvertSiRegeneration({ sessionId }, "kit_opco");
  if (verrou.ok) {
    const r = await produireKitOpco(sessionId, { metadata: { genereParSuiviEntreprise: true } });
    if (!r.ok) return null;
    const doc = await prisma.documentGenere.findUnique({
      where: { id: r.documentId },
      select: { numero: true, createdAt: true },
    });
    return doc ? { type: "kit_opco", ...doc } : null;
  }
  const dernier = await prisma.documentGenere.findFirst({
    where: { sessionId, type: "kit_opco", annuleeAt: null },
    orderBy: { createdAt: "desc" },
    select: { numero: true, createdAt: true },
  });
  return dernier ? { type: "kit_opco", ...dernier } : null;
}

function payloadDe(
  c: ContexteSuivi,
  variante: PayloadSuiviOpco["variante"],
  jeton: string,
  question: QuestionMessage,
  avecDossier: boolean,
  portailUrl: string | null,
): PayloadSuiviOpco {
  return {
    variante,
    contactNom: c.entreprise?.contactNom ?? null,
    raisonSociale: c.entreprise?.raisonSociale ?? "",
    intituleFormation: c.intituleFormation,
    numeroSession: c.numeroSession,
    dateDebutSession: jourFr(jourParis(c.dateDebutSession)),
    nomOpco: c.nomOpco,
    portailUrl,
    dateLimiteDepot: c.dateLimiteDepot ? jourFr(jourParis(c.dateLimiteDepot)) : null,
    depotFaitLe: c.dossier.depotFaitLe ? jourFr(jourDeDate(c.dossier.depotFaitLe)) : null,
    lienDossier: avecDossier ? lienDossier(jeton) : null,
    liens:
      question === "depot"
        ? { oui: lienReponse(jeton, "oui"), pasEncore: lienReponse(jeton, "pas_encore") }
        : {
            accord: lienReponse(jeton, "accord"),
            refus: lienReponse(jeton, "refus"),
            pasEncore: lienReponse(jeton, "pas_encore"),
          },
  };
}

/**
 * Écrit le message (idempotence par la clé unique), puis met l'e-mail en file.
 * `null` si la clé existe déjà (un autre passage l'a envoyé).
 */
async function poserEtEnfiler(input: {
  c: ContexteSuivi;
  suiviId: string;
  etape: EtapeMessage;
  rang: number;
  question: QuestionMessage;
  variante: PayloadSuiviOpco["variante"];
  avecDossier: boolean;
  portailUrl: string | null;
  now: Date;
}): Promise<{ messageId: string; garePourValidation: boolean } | "deja" | "file_indisponible"> {
  const { c, now } = input;
  const jeton = nouveauJeton();
  let messageId: string;
  try {
    const m = await prisma.opcoSuiviMessage.create({
      data: {
        suiviId: input.suiviId,
        etape: input.etape,
        rang: input.rang,
        question: input.question,
        envoyeLe: now,
        jourParis: jourParis(now),
        jetonHash: jeton.hash,
        jetonExpireLe: new Date(now.getTime() + DUREE_JETON_JOURS * JOUR_MS),
      },
      select: { id: true },
    });
    messageId = m.id;
  } catch (err) {
    if ((err as { code?: string }).code === "P2002") return "deja";
    throw err;
  }

  const payload = payloadDe(
    c,
    input.variante,
    jeton.clair,
    input.question,
    input.avecDossier,
    input.portailUrl,
  );
  let r: Awaited<ReturnType<typeof enqueueEmail>>;
  try {
    r = await enqueueEmail(
      "opco-suivi-entreprise",
      (c.entreprise?.contactEmail ?? "").trim(),
      "fr",
      payload as unknown as Record<string, unknown>,
      {
        jobId: `opco-suivi-entreprise-${messageId}`,
        entityType: "DossierFinancement",
        entityId: c.brut.id,
        clientId: c.entreprise?.id ?? null,
      },
    );
  } catch (err) {
    console.error(
      "[suivi-entreprise-opco] mise en file impossible :",
      err instanceof Error ? err.message : String(err),
    );
    r = { enqueued: false };
  }
  // Ni partie, ni garée en validation, ni retenue par la liste de suppression :
  // la file n'a rien pris. On retire le message pour que le passage suivant
  // réessaie, au lieu de compter une relance qui n'a jamais existé.
  if (!r.enqueued && r.garePourValidation !== true && r.retenu === undefined) {
    await prisma.opcoSuiviMessage.delete({ where: { id: messageId } }).catch(() => undefined);
    return "file_indisponible";
  }
  return { messageId, garePourValidation: r.garePourValidation === true };
}

/** Envoi du dossier prêt à déposer (automatique ou depuis la console). */
export async function envoyerDossierEntreprise(input: {
  dossierId: string;
  mode: "auto" | "manuel";
  adminUserId?: string | null;
  now?: Date;
}): Promise<ResultatEnvoi> {
  const now = input.now ?? new Date();
  if (!suiviEntrepriseActif()) {
    return { ok: false, motif: "drapeau", message: "Le suivi des entreprises OPCO est coupé." };
  }
  const c = await lireContexteSuivi(input.dossierId);
  if (!c) return { ok: false, motif: "introuvable", message: "Dossier introuvable." };

  const pret = await chargerDossierPretADeposer(c.sessionId);
  if (!pret) return { ok: false, motif: "introuvable", message: "Session introuvable." };
  const convention = pret.pieces.find((p) => p.cle === "convention");
  const elig = eligibiliteEnvoi(
    {
      type: c.brut.type,
      statut: c.brut.statut,
      depotFaitLe: c.brut.depotFaitLe,
      accordEcritLe: c.brut.accordEcritLe,
      opco: c.opco,
      conventionSignee: convention?.presente === true,
      contactEmail: c.entreprise?.contactEmail ?? null,
      dateDebutSession: c.dateDebutSession,
      dejaEnvoye: c.suivi !== null,
    },
    input.mode,
    now,
  );
  if (!elig.ok) return elig;
  if (!isR2Configured()) {
    return { ok: false, motif: "stockage", message: "Stockage indisponible : dossier non déposé." };
  }

  const kit = await kitPourEnvoi(c.sessionId);
  if (!kit) return { ok: false, motif: "kit", message: "Le kit OPCO n'a pas pu être émis." };
  // Relu APRÈS l'émission du kit : le ZIP et le kit disent la même chose.
  const dossierZip = (await chargerDossierPretADeposer(c.sessionId)) ?? pret;
  const zip = await construireZipPretADeposer({ kit, dossier: dossierZip });
  const zipKey = `opco-suivi/${c.brut.id}/${now.getTime()}.zip`;
  await uploadToR2(zipKey, Buffer.from(zip.base64, "base64"), "application/zip");

  // Le suivi : créé au premier envoi (clé unique sur le dossier), le ZIP
  // remplacé à chaque envoi manuel.
  let suiviId: string;
  if (c.suivi) {
    suiviId = c.suivi.id;
    await prisma.opcoSuiviEntreprise.update({
      where: { id: suiviId },
      data: { zipKey, zipNom: zip.filename },
    });
  } else {
    try {
      const cree = await prisma.opcoSuiviEntreprise.create({
        data: {
          dossierId: c.brut.id,
          envoyeLe: now,
          envoiAutomatique: input.mode === "auto",
          zipKey,
          zipNom: zip.filename,
        },
        select: { id: true },
      });
      suiviId = cree.id;
    } catch (err) {
      if ((err as { code?: string }).code === "P2002") {
        return { ok: false, motif: "deja_envoye", message: "Dossier déjà envoyé à l'entreprise." };
      }
      throw err;
    }
  }

  const rang = c.suivi ? c.suivi.messages.filter((m) => m.etape === "envoi").length : 0;
  const portailUrl = pret.encart.portailUrl;
  const pose = await poserEtEnfiler({
    c,
    suiviId,
    etape: "envoi",
    rang,
    question: "depot",
    variante: "envoi",
    avecDossier: true,
    portailUrl,
    now,
  });
  if (pose === "deja") {
    return { ok: false, motif: "deja_envoye", message: "Dossier déjà envoyé à l'entreprise." };
  }
  if (pose === "file_indisponible") {
    // Premier envoi : on retire aussi le suivi, sinon l'envoi automatique ne
    // repasserait jamais (il ne part que sur un dossier sans suivi).
    if (!c.suivi) {
      await prisma.opcoSuiviEntreprise.delete({ where: { id: suiviId } }).catch(() => undefined);
    }
    return {
      ok: false,
      motif: "file",
      message: "File d'envoi indisponible : réessayez plus tard.",
    };
  }
  await journal(
    "qualiopi.opco.suivi_entreprise.dossier_envoye",
    c.brut.id,
    {
      mode: input.mode,
      rang,
      kitNumero: kit.numero,
      joints: zip.joints,
      manquantes: zip.manquantes,
      garePourValidation: pose.garePourValidation,
    },
    input.adminUserId ?? null,
  );
  return { ok: true, messageId: pose.messageId, garePourValidation: pose.garePourValidation };
}

/** Une relance, déjà décidée par `prochaineRelance`. */
export async function envoyerRelance(
  c: ContexteSuivi,
  relance: RelancePrevue,
  now: Date,
): Promise<"envoyee" | "deja" | "file_indisponible" | "sans_contact"> {
  if (!c.suivi) return "deja";
  if (!suiviEntrepriseActif()) return "deja";
  const email = c.entreprise?.contactEmail?.trim();
  if (!email) return "sans_contact";
  const question: QuestionMessage = relance.etape === "relance_depot" ? "depot" : "reponse";
  const pose = await poserEtEnfiler({
    c,
    suiviId: c.suivi.id,
    etape: relance.etape,
    rang: relance.rang,
    question,
    variante: relance.etape,
    // Le dossier reste téléchargeable tant que le dépôt n'est pas fait.
    avecDossier: relance.etape === "relance_depot" && c.brut.suiviEntreprise?.zipKey != null,
    portailUrl: null,
    now,
  });
  if (pose === "deja" || pose === "file_indisponible") return pose;
  await journal(
    "qualiopi.opco.suivi_entreprise.relance_envoyee",
    c.brut.id,
    { etape: relance.etape, rang: relance.rang, garePourValidation: pose.garePourValidation },
    null,
  );
  return "envoyee";
}
