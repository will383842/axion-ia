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

import { createHash } from "node:crypto";
import JSZip from "jszip";
import { prisma } from "@/lib/prisma";
import { isR2Configured, getObjectBufferR2, documentPdfKey } from "@/lib/r2-storage";
import { verifierChaine } from "@/server/qualiopi/emargement/hash";
import {
  maillonDepuisLigne,
  verrouColonnes,
  verrouColonnesContresignature,
} from "@/server/qualiopi/emargement/reconstruction";
import { maillonContresignatureDepuisLigne } from "@/server/qualiopi/emargement/contresignature-hash";
import { construireFeuillePdf } from "@/server/qualiopi/emargement/feuille-pdf";

export interface DossierSessionResult {
  base64: string;
  filename: string;
  incomplet: boolean;
  nbDocuments: number;
  nbDocumentsJoints: number;
  /** Chaînes de signatures stagiaires dont la vérification a relevé une anomalie. */
  nbChainesAnormales: number;
  /**
   * Chaînes de CONTRESIGNATURES formateur anormales (M6). Exposé séparément :
   * une contresignature falsifiée est une signature « modifiée après coup » au
   * même titre qu'une signature stagiaire, et l'UI doit pouvoir déclencher
   * l'alerte ROUGE sur l'un OU l'autre compteur — pas la noyer dans le jaune.
   */
  nbChainesContresignAnormales: number;
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
        // 🔴 H3 — NE PAS filtrer les inscriptions sous droit à l'effacement.
        // `supprimerStagiaire` ANONYMISE le nom (« [supprime] ») mais CONSERVE
        // délibérément les colonnes de signature (art. 17 §3 b) pour justifier
        // les heures. Les écarter ici rendait ces preuves — intactes et retenues
        // exprès — invisibles et injustifiables : la faille que rgpd-service
        // ferme au niveau colonnes, rouverte au niveau dossier. Le nom étant déjà
        // anonymisé, les inclure ne divulgue aucune PII.
        orderBy: { trainee: { nom: "asc" } },
        select: {
          id: true,
          tauxPresencePct: true,
          trainee: { select: { nom: true, prenom: true, deletedAt: true } },
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
      // Contresignatures du formateur — leur chaîne (portée session × formateur)
      // se vérifie comme celle des stagiaires. Même ordre d'insertion.
      emargementContresignatures: {
        where: { revokedAt: null },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      },
    },
  });

  if (session === null) return null;

  const zip = new JSZip();
  const avertissements: string[] = [];
  const index: string[] = [`Dossier d'audit — session ${session.numero}`, session.titreSession, ""];

  // R2 requis dès la vérification d'intégrité (M2 confronte les octets d'image).
  const r2Ok = isR2Configured();

  // ── 1. Vérification d'intégrité des chaînes ──
  const rapports: Array<Record<string, unknown>> = [];
  let nbChainesAnormales = 0;
  let nbEffaces = 0;
  let nbImagesAlterees = 0;

  for (const inscription of session.enrollments) {
    // ⚠️ `verrouColonnes` plutôt qu'un `as unknown as` : la conversion est
    // vérifiée à la compilation, donc retirer une colonne du snapshot casse le
    // build au lieu de produire ici, silencieusement, un rapport d'intégrité faux.
    const res = verifierChaine(
      inscription.emargementSignatures.map((s) => maillonDepuisLigne(verrouColonnes(s))),
    );
    if (!res.valide) nbChainesAnormales += 1;

    const efface = inscription.trainee.deletedAt !== null;
    if (efface) nbEffaces += 1;

    // 🔴 M2 — le chaînage scelle le CONDENSAT de l'image, mais rien ne confrontait
    // ce condensat aux octets réels sur R2 : un objet PNG remplacé sans toucher la
    // colonne `signature_sha256` passait « OK ». On re-télécharge et on re-hache.
    const imagesAlterees: string[] = [];
    if (r2Ok) {
      for (const s of inscription.emargementSignatures) {
        if (s.signatureKey === null || s.signatureSha256 === null) continue;
        const buf = await getObjectBufferR2(s.signatureKey);
        if (buf === null) {
          imagesAlterees.push(`image absente sur R2 : ${s.signatureKey}`);
          nbImagesAlterees += 1;
          continue;
        }
        const shaReel = createHash("sha256").update(buf).digest("hex");
        if (shaReel !== s.signatureSha256) {
          imagesAlterees.push(`condensat divergent : ${s.signatureKey}`);
          nbImagesAlterees += 1;
        }
      }
    }

    rapports.push({
      // Nom déjà anonymisé (« [supprime] ») pour un effacé ; on l'étiquette
      // explicitement pour que l'auditeur sache pourquoi il est là.
      stagiaire: efface
        ? "[inscription sous droit à l'effacement — signatures conservées, art. 17 §3 b]"
        : `${inscription.trainee.prenom} ${inscription.trainee.nom}`.trim(),
      effaceRgpd: efface,
      tauxPresencePct: inscription.tauxPresencePct,
      nbSignatures: inscription.emargementSignatures.length,
      empreinteTete:
        inscription.emargementSignatures[inscription.emargementSignatures.length - 1]?.selfHash ??
        null,
      integrite: res.valide ? "OK" : "ANOMALIE",
      anomalies: res.anomalies,
      ...(imagesAlterees.length > 0 ? { imagesAlterees } : {}),
    });
  }

  // Chaînes de CONTRESIGNATURES, une par formateur (portée session × formateur).
  // Sans cette vérification, la machinerie anti-fork des contresignatures serait
  // écrite mais jamais contrôlée à l'audit — un registre dont personne ne lit le
  // sceau.
  const parFormateur = new Map<string, typeof session.emargementContresignatures>();
  for (const c of session.emargementContresignatures) {
    const lot = parFormateur.get(c.trainerId) ?? [];
    lot.push(c);
    parFormateur.set(c.trainerId, lot);
  }
  const rapportsContresignatures: Array<Record<string, unknown>> = [];
  let nbChainesContresignAnormales = 0;
  for (const [trainerId, lignes] of parFormateur) {
    const res = verifierChaine(
      lignes.map((c) => maillonContresignatureDepuisLigne(verrouColonnesContresignature(c))),
    );
    if (!res.valide) nbChainesContresignAnormales += 1;
    rapportsContresignatures.push({
      formateur: lignes[0]?.formateurNom ?? trainerId,
      nbContresignatures: lignes.length,
      empreinteTete: lignes[lignes.length - 1]?.selfHash ?? null,
      integrite: res.valide ? "OK" : "ANOMALIE",
      anomalies: res.anomalies,
    });
  }

  zip.file(
    "verification-integrite.json",
    JSON.stringify({ signatures: rapports, contresignatures: rapportsContresignatures }, null, 2),
  );
  index.push(
    `Intégrité des chaînes de signatures : ${session.enrollments.length - nbChainesAnormales}/${session.enrollments.length} conformes.`,
  );
  index.push(
    `Intégrité des chaînes de contresignatures : ${parFormateur.size - nbChainesContresignAnormales}/${parFormateur.size} conformes.`,
  );
  if (nbChainesAnormales > 0) {
    avertissements.push(
      `⚠️ ${nbChainesAnormales} chaîne(s) de signatures présentent une anomalie d'intégrité. Voir verification-integrite.json AVANT de produire ce dossier.`,
    );
  }
  if (nbChainesContresignAnormales > 0) {
    avertissements.push(
      `⚠️ ${nbChainesContresignAnormales} chaîne(s) de contresignatures présentent une anomalie d'intégrité. Voir verification-integrite.json AVANT de produire ce dossier.`,
    );
  }
  if (nbImagesAlterees > 0) {
    avertissements.push(
      `⚠️ ${nbImagesAlterees} image(s) de signature ne correspondent plus à leur condensat scellé (substitution ou absence sur R2). Voir « imagesAlterees » dans verification-integrite.json.`,
    );
  }
  if (nbEffaces > 0) {
    // Informationnel, PAS un avertissement : le dossier est COMPLET justement
    // parce qu'il inclut ces preuves conservées. On le dit à l'auditeur.
    index.push(
      `Dont ${nbEffaces} inscription(s) sous droit à l'effacement RGPD — signatures conservées et vérifiées (art. 17 §3 b).`,
    );
  }

  // ── 2. Feuille d'émargement telle qu'elle serait tirée ──
  // `inclureEffaces=true` : le dossier d'audit conserve les inscriptions effacées
  // (nom anonymisé, signatures retenues art. 17 §3 b), cohérent avec la vérif ci-dessus.
  const feuille = await construireFeuillePdf(sessionId, true);
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

  // ── 3. Documents générés de la session ── (`r2Ok` déjà calculé plus haut)
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
    const cle = documentPdfKey(doc);
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
    nbChainesContresignAnormales,
    avertissements,
  };
}
