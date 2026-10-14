// Banc @formateurs (missions) — les GESTES récurrents des scénarios, par le chemin réel.
//
// Chaque geste appelle l'action de la console ou de l'espace formateur que l'écran
// appelle, avec son garde (administrateur du monde, ou formateur connecté). Les
// seules exceptions sont dites geste par geste.

import { expect } from "@playwright/test";

import { prisma } from "./base";
import type { Monde } from "./missions-donnees";
import type { Pilote } from "./missions-pilote";

export const M = {
  choix: "@/server/actions/qualiopi/choix-formateur",
  mission: "@/server/actions/qualiopi/mission-formateur",
  lettre: "@/server/actions/qualiopi/lettre-mission-signature",
  piece: "@/server/actions/qualiopi/piece-signature",
  serviceChoix: "@/server/qualiopi/formateurs-independants/choix-formateur-service",
  moteur: "@/server/qualiopi/formateurs-independants/moteur-mission",
  crochets: "@/server/qualiopi/documents/signature/crochets-mission",
  signature: "@/server/qualiopi/documents/signature/document-signature-service",
  apres: "@/server/qualiopi/documents/signature/apres-signature",
  relancesPropositions: "@/server/qualiopi/formateurs-independants/relances-propositions-horaires",
  campagnes: "@/server/relances/passer-campagnes",
} as const;

/** Une image PNG d'un pixel : le « scan » d'une signature papier du banc. */
export const SCAN_FICTIF =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

export type Resultat<T> = { data: T } | { error: string };

/** « Choisir » en cartes puis « Valider » (deux clics de la fiche session). */
export async function choisir(
  pilote: Pilote,
  monde: Monde,
  sessionId: string,
  rangs: ReadonlyArray<{ trainerId: string; forfait?: number | null }>,
): Promise<Resultat<{ missionProposee: boolean; avertissements: string[] }>> {
  return pilote.appeler(
    M.choix,
    "choisirFormateursSessionAction",
    [
      {
        sessionId,
        choix: rangs.map((r, i) => ({
          trainerId: r.trainerId,
          rang: i + 1,
          forfaitDeplacementParJourHtCents: r.forfait ?? null,
        })),
      },
    ],
    { admin: monde.admin },
  );
}

/** La dernière mission d'un formateur sur une session. */
export function derniereMission(sessionId: string, trainerId: string) {
  return prisma.missionFormateur.findFirstOrThrow({
    where: { sessionId, trainerId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      statut: true,
      lettreMissionId: true,
      lettreBlocageMotif: true,
      tarifHtCents: true,
      forfaitDeplacementParJourHtCents: true,
      echeanceReponseAt: true,
      reponduAt: true,
    },
  });
}

/** « J'accepte » ou « Je ne suis pas disponible », depuis l'espace connecté. */
export async function repondre(
  pilote: Pilote,
  trainerId: string,
  missionId: string,
  reponse: "acceptee" | "refusee",
  motif?: string,
): Promise<Resultat<{ statut: string }>> {
  return pilote.appeler(
    M.mission,
    "repondreMissionFormateurAction",
    [{ missionId, reponse, ...(motif !== undefined ? { motif } : {}) }],
    { formateurId: trainerId },
  );
}

/** Choisir un seul formateur et qu'il accepte : la mission a son accord. */
export async function missionAcceptee(
  pilote: Pilote,
  monde: Monde,
  sessionId: string,
  trainerId: string,
  forfait: number | null = null,
): Promise<string> {
  const c = await choisir(pilote, monde, sessionId, [{ trainerId, forfait }]);
  expect(c, JSON.stringify(c)).toEqual({
    data: expect.objectContaining({ missionProposee: true }),
  });
  const m = await derniereMission(sessionId, trainerId);
  const r = await repondre(pilote, trainerId, m.id, "acceptee");
  expect(r, JSON.stringify(r)).toEqual({ data: expect.objectContaining({ statut: "acceptee" }) });
  return m.id;
}

type ResultatSignature =
  | { ok: true; signatureId: string; statutSignature: "partielle" | "signee" }
  | { ok: false; raison: string; message: string };

/**
 * La convention signée par le client puis contresignée par Axion, et le crochet
 * d'après-signature de la dernière signature (`apresSignature`), comme le fait
 * l'action de contresignature.
 *
 * ⚠️ Le client signe ici par REVERSEMENT PAPIER (canal réel de la console) : le
 * lien à jeton du client relève du parcours client, hors du sujet mission.
 */
export async function signerConvention(
  pilote: Pilote,
  monde: Monde,
  conventionId: string,
): Promise<void> {
  const piece = await prisma.documentGenere.findUniqueOrThrow({
    where: { id: conventionId },
    select: { numero: true, type: true },
  });
  const client = await pilote.appeler<ResultatSignature>(M.signature, "signerDocument", [
    {
      documentGenereId: conventionId,
      porteur: {
        type: "reversement_papier",
        adminId: monde.admin.id,
        provider: "physical_signed",
        partie: "client",
        signataire: { nom: "Contact Banc", qualite: "Gérant" },
      },
      methode: "papier_scanne",
      // Le scan versé : une image minuscule, stockée dans le dossier du banc.
      imageDataUrl: SCAN_FICTIF,
      partiesRequises: ["client", "axionia"],
    },
  ]);
  expect(client, JSON.stringify(client)).toMatchObject({ ok: true, statutSignature: "partielle" });
  const axion = await pilote.appeler<ResultatSignature>(M.signature, "signerDocument", [
    {
      documentGenereId: conventionId,
      porteur: { type: "organisme_authentifie", adminId: monde.admin.id, partie: "axionia" },
      methode: "confirmation_accessible",
      partiesRequises: ["client", "axionia"],
    },
  ]);
  expect(axion, JSON.stringify(axion)).toMatchObject({ ok: true, statutSignature: "signee" });
  await pilote.appeler(M.apres, "apresSignature", [
    {
      documentGenereId: conventionId,
      type: piece.type,
      numero: piece.numero,
      statutSignature: "signee",
      partie: "axionia",
      acteur: {
        type: "administrateur",
        session: { userId: monde.admin.id, role: monde.admin.role },
      },
    },
  ]);
}

/** « Signer ma lettre », depuis l'espace connecté (signature accessible, sans tracé). */
export async function signerMaLettre(
  pilote: Pilote,
  trainerId: string,
  lettreId: string,
): Promise<ResultatSignature> {
  return pilote.appeler(
    M.lettre,
    "signerLettreMissionFormateurAction",
    [{ documentGenereId: lettreId, methode: "confirmation_accessible" }],
    { formateurId: trainerId },
  );
}

/** « Contresigner » une lettre depuis la console (une pièce). */
export async function contresignerLettre(
  pilote: Pilote,
  monde: Monde,
  lettreId: string,
): Promise<ResultatSignature> {
  return pilote.appeler(
    M.lettre,
    "contresignerLettreMissionAction",
    [{ documentGenereId: lettreId, methode: "confirmation_accessible" }],
    { admin: monde.admin },
  );
}

/** Les lettres de mission VIVANTES (non annulées) d'un formateur sur une session. */
export function lettresVivantes(sessionId: string, trainerId: string) {
  return prisma.documentGenere.findMany({
    where: { type: "lettre_mission", sessionId, trainerId, annuleeAt: null },
    orderBy: { createdAt: "asc" },
    select: { id: true, numero: true, statutSignature: true, metadata: true, createdAt: true },
  });
}

/** L'e-mail EN FILE de ce job, rendu comme le worker le rendra (cf. `missions-aides-serveur.ts`). */
export async function envoiRendu(
  pilote: Pilote,
  jobId: string,
): Promise<{ template: string; to: string; sujet: string; texte: string }> {
  const r = await pilote.appeler<{
    template: string;
    to: string;
    sujet: string;
    texte: string;
  } | null>("./missions-aides-serveur.ts", "rendreEnvoiEnFile", [jobId]);
  if (r === null) throw new Error(`aucun job « ${jobId} » dans la file d'e-mails`);
  return r;
}
