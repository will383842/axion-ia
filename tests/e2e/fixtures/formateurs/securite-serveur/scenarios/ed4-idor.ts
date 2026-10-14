// E-D4 — IDOR : un formateur CONNECTÉ (A) vise le dossier, les pièces, les
// relevés et le bilan d'un AUTRE formateur (B), par l'URL ou par le formulaire.
//
// A se présente avec une VRAIE session de l'espace (signée par le code du
// dépôt, posée en cookie). Chaque tentative a son TÉMOIN : la même requête sur
// l'objet de A, pour prouver que la réponse « neutre » vient bien de la
// propriété et pas d'un autre refus.
//
// `passage_paiement` (que la console refuse d'allumer aujourd'hui) est posé
// directement : sans lui, le signalement d'un désaccord s'arrête AVANT le
// contrôle de propriété, qu'on veut éprouver.

import { signFormateurSession } from "@/lib/formateur-session";
import { enregistrerVousAction } from "@/app/formateur/dossier/[id]/[jeton]/actions";
import { GET as telechargerPiece } from "@/app/api/espace-formateur/documents/[id]/route";
import { GET as telechargerKit } from "@/app/api/espace-formateur/kit/[sessionId]/route";
import { evaluerStagiaireFormAction } from "@/server/actions/formateur/bilan-fin-formation.actions";
import { signalerDesaccordFormAction } from "@/server/actions/formateur/desaccord.actions";
import { FORMATEUR_COOKIE_NAME } from "@/server/formateur/routes";
import { lireDossierParLien } from "@/server/qualiopi/formateurs-independants/dossier";
import { jetonDossierFormateur } from "@/server/qualiopi/formateurs-independants/jeton-dossier";
import {
  empreinteSessionFormateur,
  versionSessionFormateur,
} from "@/server/qualiopi/formateurs-independants/version-session";

import {
  allumerParLaConsole,
  avecVerrouInterrupteurs,
  creerAdmin,
  creerIndependant,
  creerPieceASigner,
  creerSessionFormation,
  menage,
  noterReglage,
  prisma,
  type Independant,
} from "../donnees";
import { poserCookie } from "../faux-next-headers";

/** L'adresse d'une redirection Next (`redirect()` lève), ou la valeur rendue. */
async function issue(f: () => Promise<unknown>): Promise<string> {
  try {
    return JSON.stringify(await f());
  } catch (e) {
    const digest = (e as { digest?: string }).digest;
    if (typeof digest === "string" && digest.startsWith("NEXT_REDIRECT")) {
      return digest.split(";")[2] ?? digest;
    }
    throw e;
  }
}

async function reponse(r: Response): Promise<{ statut: number; corps: string }> {
  return { statut: r.status, corps: await r.text() };
}

function formulaire(champs: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(champs)) fd.set(k, v);
  return fd;
}

async function formateur(): Promise<Independant & { session: string; dossier: string }> {
  const t = await creerIndependant({ actif: true, dossierStatut: "a_completer" } as never);
  const session = await signFormateurSession(
    t.id,
    "formateur",
    undefined,
    versionSessionFormateur({ finCollaborationAt: null }),
    empreinteSessionFormateur(t.email) ?? undefined,
  );
  return { ...t, session, dossier: jetonDossierFormateur(t.id, 0, new Date()) ?? "" };
}

export default async function ed4(): Promise<unknown> {
  try {
    return await avecVerrouInterrupteurs(async () => {
      const direction = await creerAdmin("super_admin");
      await allumerParLaConsole(direction, [
        "textes_valides",
        "dossier_en_ligne",
        "bilan_fin_formation",
      ]);
      await noterReglage("formateurs.passage_paiement");
      await prisma.setting.upsert({
        where: { key: "formateurs.passage_paiement" },
        create: { key: "formateurs.passage_paiement", value: { date: "2026-01-01" } },
        update: { value: { date: "2026-01-01" } },
      });

      const a = await formateur();
      const b = await formateur();
      const telephoneB = (await prisma.trainer.findUniqueOrThrow({ where: { id: b.id } }))
        .telephone;

      // Pièces : une autofacture de chacun.
      const pieceA = await creerPieceASigner(a.id, "contrat_sous_traitance", "signee");
      const pieceB = await creerPieceASigner(b.id, "contrat_sous_traitance", "signee");
      // Relevés : un relevé de chacun (paiement par mission, payé : non contestable).
      const releve = (trainerId: string) =>
        prisma.trainerStatement.create({
          data: {
            trainerId,
            periodeYear: 2026,
            periodeMonth: 9,
            tvaRegime: "franchise_293b",
            origine: "passage_mission",
            statut: "paye",
            payeAt: new Date(),
          } as never,
          select: { id: true },
        });
      const releveA = await releve(a.id);
      const releveB = await releve(b.id);
      // Bilan : une session animée par chacun.
      const debut = new Date(Date.now() - 10 * 86_400_000);
      const sessionA = await creerSessionFormation(debut);
      const sessionB = await creerSessionFormation(debut);
      await prisma.trainingSession.update({
        where: { id: sessionA.id },
        data: { formateurPrincipalId: a.id },
      });
      await prisma.trainingSession.update({
        where: { id: sessionB.id },
        data: { formateurPrincipalId: b.id },
      });

      // ── A est connecté ─────────────────────────────────────────────────
      poserCookie(FORMATEUR_COOKIE_NAME, a.session);
      const r: Record<string, { cible: unknown; temoin: unknown }> = {};

      // Dossier par l'URL : le jeton de A sur l'identifiant de B.
      r["dossier_url"] = {
        cible: (await lireDossierParLien(b.id, a.dossier)) !== null,
        temoin: (await lireDossierParLien(a.id, a.dossier)) !== null,
      };
      // Dossier par le formulaire : écrire le téléphone de B.
      const ecrire = (id: string) =>
        issue(() =>
          enregistrerVousAction(
            formulaire({ id, jeton: a.dossier, telephone: "0611111111", codePostal: "69000" }),
          ),
        );
      r["dossier_formulaire"] = { cible: await ecrire(b.id), temoin: await ecrire(a.id) };

      // Pièces par l'URL.
      const piece = async (id: string) =>
        reponse(
          await telechargerPiece(new Request("http://localhost/x") as never, {
            params: Promise.resolve({ id }),
          }),
        );
      r["piece"] = { cible: await piece(pieceB.id), temoin: await piece(pieceA.id) };
      r["piece_inexistante"] = {
        cible: await piece("00000000-0000-4000-8000-000000000000"),
        temoin: null,
      };
      const kit = async (sessionId: string) =>
        reponse(
          await telechargerKit(new Request("http://localhost/x") as never, {
            params: Promise.resolve({ sessionId }),
          }),
        );
      r["kit"] = { cible: await kit(sessionB.id), temoin: await kit(sessionA.id) };

      // Relevés par le formulaire.
      const desaccord = (id: string) =>
        issue(() =>
          signalerDesaccordFormAction(formulaire({ statementId: id, texte: "Banc : désaccord." })),
        );
      r["releve"] = { cible: await desaccord(releveB.id), temoin: await desaccord(releveA.id) };

      // Bilan par le formulaire.
      const bilan = (sessionId: string) =>
        issue(() =>
          evaluerStagiaireFormAction(
            formulaire({
              sessionId,
              enrollmentId: "00000000-0000-4000-8000-000000000001",
              "note-0": "3",
            }),
          ),
        );
      r["bilan"] = { cible: await bilan(sessionB.id), temoin: await bilan(sessionA.id) };

      poserCookie(FORMATEUR_COOKIE_NAME, null);
      const bApres = await prisma.trainer.findUniqueOrThrow({
        where: { id: b.id },
        select: { telephone: true, codePostalPro: true },
      });
      const releveBApres = await prisma.trainerStatement.findUniqueOrThrow({
        where: { id: releveB.id },
        select: { contesteeAt: true },
      });
      return { r, telephoneB, bApres, releveBApres };
    });
  } finally {
    await menage();
  }
}
