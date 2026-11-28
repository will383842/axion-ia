/**
 * DÉPÔT D'UN DOCUMENT JOINT AUX E-MAILS DES APPORTEURS — un PDF local vers sa clé R2 fixe.
 *
 * Les documents annexes (fiche des commissions, livret, guide de démarrage) partent avec l'e-mail « contrat signé »
 * dès qu'ils existent sur R2. Ils ne sont pas dans le dépôt : ce script les dépose, APRÈS
 * relecture par le dirigeant.
 *
 * DÉPOSER = ENREGISTRER UNE NOUVELLE VERSION. Avec `--appliquer`, le script appelle
 * `deposerVersionAnnexe` (`src/features/apporteurs-reseau/annexes-versions.ts`) : le PDF est écrit
 * sous une clé versionnée dérivée de son sha256, une ligne est insérée dans
 * `documents_annexes_versions` (registre append-only), et l'ancienne clé fixe est aussi réécrite
 * (fenêtre app/worker). Redéposer le fichier actuellement en ligne est le moyen d'enregistrer sa
 * première version : rien n'est court-circuité sur « même sha256 », la fonction est idempotente.
 * La version remplacée est d'abord copiée sous `documents-apporteurs/archives/` (clé datée).
 * Le journal de chaque e-mail « contrat signé » note les 16 premiers caractères du sha256 de
 * chaque annexe jointe, et la remise est tracée (`ApporteurDocumentRemis`).
 *
 * 🔒 Ces PDF portent des montants et le dépôt GitHub est PUBLIC : ils ne sont PAS dans le dépôt
 * (garde : `garde-pdf-apporteurs.spec.ts`). Le stockage R2 est leur SEULE source : l'application
 * ne les dépose jamais elle-même. Absent de R2 : les routes de l'espace rendent 404 et les
 * e-mails partent sans la pièce, avec une alerte.
 *
 * Usage :
 *   pnpm tsx scripts/apporteurs/deposer-document-joint.ts                 # liste les documents et leur état
 *   pnpm tsx scripts/apporteurs/deposer-document-joint.ts fiche-commissions ./fiche.pdf            # essai à blanc
 *   pnpm tsx scripts/apporteurs/deposer-document-joint.ts fiche-commissions ./fiche.pdf --appliquer
 *   pnpm tsx scripts/apporteurs/deposer-document-joint.ts livret ./livret.pdf --appliquer
 *
 * Sans `--appliquer` (essai à blanc), RIEN n'est écrit et il n'y a aucun accès à la base ni à R2.
 * Avec `--appliquer` : `DATABASE_URL` et les variables R2 de l'application (`R2_ACCOUNT_ID`,
 * `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, compartiment). Se lance depuis un clone du dépôt, pas depuis le conteneur de production
 * (l'image n'embarque pas `scripts/`).
 *
 * Pour RETIRER un document : supprimer l'objet R2 ne retire RIEN dès qu'une version est
 * enregistrée, car `versionCourante` sert la clé versionnée. La procédure correcte est de marquer
 * la ligne de la version : `UPDATE documents_annexes_versions SET retiree_at = now() WHERE
 * document_id = '<id>' AND sha256 = '<sha>'` (le déclencheur n'autorise que NULL → date ; une
 * version retirée ne peut pas être redéposée telle quelle). Ce script ne retire rien. Un e-mail
 * déjà en file part alors sans ce document (pièce facultative : journalisé et signalé).
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

import { deposerVersionAnnexe } from "@/features/apporteurs-reseau/annexes-versions";
import {
  DOCUMENTS_ANNEXES,
  PREFIXE_DOCUMENTS_APPORTEURS,
  TAILLE_MAX_PIECES_OCTETS,
} from "@/features/apporteurs-reseau/documents-joints";
import { enteteObjetR2, getObjectBufferR2, isR2Configured, uploadToR2 } from "@/lib/r2-storage";

/** Place laissée au contrat lui-même (quelques centaines de Ko) dans le plafond de l'e-mail. */
const RESERVE_CONTRAT_OCTETS = 1_048_576;

const mo = (n: number): string => `${(n / 1_048_576).toFixed(2)} Mo`;

async function etat(): Promise<{ id: string; taille: number | null }[]> {
  const lignes: { id: string; taille: number | null }[] = [];
  for (const d of DOCUMENTS_ANNEXES) {
    const entete = await enteteObjetR2(d.cleR2);
    lignes.push({ id: d.id, taille: entete?.taille ?? null });
  }
  return lignes;
}

function exigerR2(): void {
  if (!isR2Configured()) {
    console.error("R2 n'est pas configuré (variables R2_* absentes) : rien n'est fait.");
    process.exit(1);
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const appliquer = args.includes("--appliquer");
  const [id, chemin] = args.filter((a) => !a.startsWith("--"));

  if (!id) {
    exigerR2();
    for (const d of DOCUMENTS_ANNEXES) {
      const entete = await enteteObjetR2(d.cleR2);
      console.log(
        `${d.id.padEnd(20)} ${d.cleR2.padEnd(55)} ${entete ? `déposé (${mo(entete.taille)})` : "absent (non joint)"}`,
      );
    }
    return;
  }

  const doc = DOCUMENTS_ANNEXES.find((d) => d.id === id);
  if (!doc) {
    console.error(
      `Document inconnu : « ${id} ». Connus : ${DOCUMENTS_ANNEXES.map((d) => d.id).join(", ")}.`,
    );
    process.exit(1);
  }
  if (!chemin || !existsSync(chemin)) {
    console.error(`Fichier introuvable : ${chemin ?? "(aucun chemin donné)"}.`);
    process.exit(1);
  }
  const pdf = readFileSync(chemin);
  if (pdf.subarray(0, 5).toString("latin1") !== "%PDF-") {
    console.error("Ce fichier n'est pas un PDF (il ne commence pas par « %PDF- ») : refusé.");
    process.exit(1);
  }

  const sha256 = createHash("sha256").update(pdf).digest("hex");
  console.log(`Document  : ${doc.id} (montré comme « ${doc.nomFichier} »)`);
  console.log(`Clé R2    : ${doc.cleR2}`);
  console.log(`Fichier   : ${chemin} — ${mo(pdf.byteLength)} — sha256 ${sha256}`);
  if (!appliquer) {
    console.log("Essai à blanc : rien n'est écrit. Ajoutez --appliquer pour déposer.");
    return;
  }
  exigerR2();
  // Le worker refuse TOUT l'e-mail au-delà de son plafond : on vérifie le cumul avant de déposer.
  const autres = (await etat()).filter((l) => l.id !== doc.id);
  const cumul = autres.reduce((s, l) => s + (l.taille ?? 0), pdf.byteLength);
  if (cumul + RESERVE_CONTRAT_OCTETS > TAILLE_MAX_PIECES_OCTETS) {
    console.error(
      `Trop lourd : ${mo(cumul)} pour l'ensemble des documents, plafond ${mo(TAILLE_MAX_PIECES_OCTETS - RESERVE_CONTRAT_OCTETS)} ` +
        "(le contrat doit tenir dans le même e-mail). Allégez le PDF.",
    );
    process.exit(1);
  }

  // La version en place est gardée sous une clé datée AVANT d'être remplacée.
  const ancien = await getObjectBufferR2(doc.cleR2);
  if (ancien && ancien.byteLength > 0) {
    const shaAncien = createHash("sha256").update(ancien).digest("hex");
    if (shaAncien !== sha256) {
      const cleArchive = `${PREFIXE_DOCUMENTS_APPORTEURS}archives/${doc.id}-${new Date().toISOString().replace(/[:.]/g, "-")}-${shaAncien.slice(0, 16)}.pdf`;
      await uploadToR2(cleArchive, ancien, "application/pdf", { sha256: shaAncien });
      console.log(`Version remplacée gardée : ${cleArchive} (sha256 ${shaAncien})`);
    }
  }
  // Pas de retour anticipé « même sha256 » : redéposer le document en ligne enregistre sa première version.
  const depot = await deposerVersionAnnexe(doc, pdf, {
    deposePar: "script-deposer-document-joint",
  });
  console.log(`Clé versionnée : ${depot.cleR2} (sha256 ${depot.sha256})`);
  if (depot.dejaDeposee) {
    console.log("Cette version était déjà enregistrée : rien de nouveau n'a été écrit.");
    return;
  }
  console.log(
    "Version enregistrée et clé fixe réécrite. Elle partira avec le prochain e-mail « contrat signé ».",
  );
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
