/**
 * Qualiopi — Dossier d'audit d'UNE session (oubli M2 du plan).
 *
 * ## Le problème que ça règle
 *
 * `genererDossierAuditZip` fait un `findMany` SANS `where` et range les PDF en
 * `preuves/<type>/<numero>.pdf` — groupés par TYPE, jamais par session. Devant
 * un auditeur qui demande « montrez-moi le dossier de la session de juin »,
 * reconstituer l'ensemble revenait à ouvrir les PDF un par un pour lire de quelle
 * session ils relèvent.
 *
 * Une preuve qu'on ne peut pas retrouver n'est pas une preuve.
 *
 * ## Ce que le dossier contient
 *
 * Les documents générés de la session, rangés par TYPE dans un dossier qui porte
 * son numéro · la feuille d'émargement telle qu'elle serait tirée aujourd'hui,
 * en JSON, avec les écarts de signature et l'ancrage de chaîne · le résultat de
 * la VÉRIFICATION D'INTÉGRITÉ de chaque chaîne de signatures · et un index
 * lisible qui dit ce qui manque, plutôt que de le taire.
 *
 * ⚠️ Un dossier incomplet est signalé comme tel. Livrer un ZIP silencieusement
 * amputé à un auditeur est pire que de ne rien livrer : il aurait l'air complet.
 *
 * Stub-safe.
 */

import JSZip from "jszip";
import { prisma } from "@/lib/prisma";
import { isR2Configured, getObjectBufferR2 } from "@/lib/r2-storage";
import { verifierChaine } from "@/server/qualiopi/emargement/hash";
import {
  maillonDepuisLigne,
  type LigneSignature,
} from "@/server/qualiopi/emargement/reconstruction";
import { construireFeuillePdf } from "@/server/qualiopi/emargement/feuille-pdf";

export interface DossierSessionResult {
  base64: string;
  filename: string;
  incomplet: boolean;
  nbDocuments: number;
  nbDocumentsJoints: number;
  /** Chaînes de signatures dont la vérification a relevé une anomalie. */
  nbChainesAnormales: number;
  avertissements: string[];
}

/**
 * Produit le ZIP d'audit d'une session.
 *
 * @param sessionId Session concernée.
 */
export async function genererDossierSessionZip(
  sessionId: string,
): Promise<DossierSessionResult | null> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) return null;

  const session = await prisma.trainingSession.findUnique({
    where: { id: sessionId },
    select: {
      numero: true,
      titreSession: true,
      dateDebut: true,
      dateFin: true,
      documents: {
        select: { id: true, type: true, numero: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      },
      enrollments: {
        where: { trainee: { deletedAt: null } },
        orderBy: { trainee: { nom: "asc" } },
        select: {
          id: true,
          tauxPresencePct: true,
          trainee: { select: { nom: true, prenom: true } },
          emargementSignatures: {
            where: { revokedAt: null },
            // ⚠️ Ordre d'INSERTION, jamais `signeAt` : ce dernier est figé avant
            // l'écriture de l'image, et trier dessus produirait une rupture de
            // chaînage FANTÔME — un faux verdict de corruption, dans un dossier
            // d'audit.
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          },
        },
      },
    },
  });

  if (session === null) return null;

  const zip = new JSZip();
  const avertissements: string[] = [];
  const index: string[] = [`Dossier d'audit — session ${session.numero}`, session.titreSession, ""];

  // ── 1. Vérification d'intégrité des chaînes ──
  const rapports: Array<Record<string, unknown>> = [];
  let nbChainesAnormales = 0;

  for (const inscription of session.enrollments) {
    const res = verifierChaine(
      inscription.emargementSignatures.map((s) =>
        maillonDepuisLigne(s as unknown as LigneSignature),
      ),
    );
    if (!res.valide) nbChainesAnormales += 1;

    rapports.push({
      stagiaire: `${inscription.trainee.prenom} ${inscription.trainee.nom}`.trim(),
      tauxPresencePct: inscription.tauxPresencePct,
      nbSignatures: inscription.emargementSignatures.length,
      empreinteTete:
        inscription.emargementSignatures[inscription.emargementSignatures.length - 1]?.selfHash ??
        null,
      integrite: res.valide ? "OK" : "ANOMALIE",
      anomalies: res.anomalies,
    });
  }

  zip.file("verification-integrite.json", JSON.stringify(rapports, null, 2));
  index.push(
    `Intégrité des chaînes de signatures : ${session.enrollments.length - nbChainesAnormales}/${session.enrollments.length} conformes.`,
  );
  if (nbChainesAnormales > 0) {
    avertissements.push(
      `⚠️ ${nbChainesAnormales} chaîne(s) de signatures présentent une anomalie d'intégrité. Voir verification-integrite.json AVANT de produire ce dossier.`,
    );
  }

  // ── 2. Feuille d'émargement telle qu'elle serait tirée ──
  const feuille = await construireFeuillePdf(sessionId);
  if (feuille === null || feuille.journees.length === 0) {
    avertissements.push(
      "⚠️ Les journées de cette session ne sont pas déclarées : aucune feuille d'émargement conforme ne peut être produite (horaires réels manquants).",
    );
    index.push("Feuille d'émargement : IMPOSSIBLE — journées non déclarées.");
  } else {
    zip.file("feuille-emargement.json", JSON.stringify(feuille, null, 2));
    index.push(
      `Feuille d'émargement : ${feuille.journees.length} journée(s), ${feuille.totalSignatures} signature(s).`,
    );
  }

  // ── 3. Documents générés de la session ──
  const r2Ok = isR2Configured();
  if (!r2Ok) {
    avertissements.push(
      "⚠️ Stockage R2 non configuré : aucun PDF n'est restituable. Le dossier ne contient que les registres.",
    );
  }

  let joints = 0;
  index.push("", `Documents (${session.documents.length}) :`);
  for (const doc of session.documents) {
    // Clé alignée sur l'écriture (`documents-service.ts` utilise l'année locale
    // au moment de la génération).
    const cle = `documents/${doc.createdAt.getFullYear()}/${doc.type}/${doc.numero}.pdf`;
    const buffer = r2Ok ? await getObjectBufferR2(cle) : null;
    if (buffer === null) {
      index.push(`  [ABSENT] ${doc.type}/${doc.numero}.pdf`);
      continue;
    }
    zip.file(`documents/${doc.type}/${doc.numero}.pdf`, buffer);
    index.push(`  [OK]     ${doc.type}/${doc.numero}.pdf (${buffer.byteLength} octets)`);
    joints += 1;
  }

  if (session.documents.length > 0 && joints === 0) {
    avertissements.push(
      `⚠️ ${session.documents.length} document(s) en base mais AUCUN PDF joint — vérifiez le stockage R2.`,
    );
  }

  const incomplet = avertissements.length > 0;
  if (incomplet) {
    index.push("", "AVERTISSEMENTS :", ...avertissements.map((a) => `  ${a}`));
  }
  zip.file("index.txt", index.join("\n"));

  const base64 = await zip.generateAsync({ type: "base64", compression: "DEFLATE" });
  return {
    base64,
    // Le numéro de session dans le nom du fichier : c'est tout l'objet de ce
    // dossier, qu'on puisse le retrouver sans l'ouvrir.
    filename: `dossier-session-${session.numero}`,
    incomplet,
    nbDocuments: session.documents.length,
    nbDocumentsJoints: joints,
    nbChainesAnormales,
    avertissements,
  };
}
