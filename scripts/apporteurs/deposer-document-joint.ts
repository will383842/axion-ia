/**
 * DÉPÔT D'UN DOCUMENT JOINT AUX E-MAILS DES APPORTEURS — un PDF local vers sa clé R2 fixe.
 *
 * Les documents annexes (fiche des commissions, livret) partent avec l'e-mail « contrat signé »
 * dès qu'ils existent sur R2, à la clé déclarée dans
 * `src/features/apporteurs-reseau/documents-joints.ts`. Ils ne sont pas dans le dépôt : ce
 * script les dépose, APRÈS relecture par le dirigeant. Déposer à nouveau remplace le document.
 *
 * Usage :
 *   pnpm tsx scripts/apporteurs/deposer-document-joint.ts                 # liste les documents et leur état
 *   pnpm tsx scripts/apporteurs/deposer-document-joint.ts fiche-commissions ./fiche.pdf            # essai à blanc
 *   pnpm tsx scripts/apporteurs/deposer-document-joint.ts fiche-commissions ./fiche.pdf --appliquer
 *   pnpm tsx scripts/apporteurs/deposer-document-joint.ts livret ./livret.pdf --appliquer
 *
 * Sans `--appliquer`, rien n'est écrit. Variables R2 requises (les mêmes que l'application) :
 * `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, et le compartiment de
 * l'application. Se lance depuis un clone du dépôt, pas depuis le conteneur de production
 * (l'image n'embarque pas `scripts/`).
 *
 * Pour RETIRER un document (il cesse d'être joint au prochain envoi), supprimer l'objet à sa
 * clé depuis le tableau de bord R2 : ce script ne supprime rien.
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

import {
  DOCUMENTS_ANNEXES,
  TAILLE_MAX_PIECES_OCTETS,
} from "@/features/apporteurs-reseau/documents-joints";
import { enteteObjetR2, isR2Configured, uploadToR2 } from "@/lib/r2-storage";

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

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const appliquer = args.includes("--appliquer");
  const [id, chemin] = args.filter((a) => !a.startsWith("--"));

  if (!isR2Configured()) {
    console.error("R2 n'est pas configuré (variables R2_* absentes) : rien n'est fait.");
    process.exit(1);
  }

  if (!id) {
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

  const sha256 = createHash("sha256").update(pdf).digest("hex");
  console.log(`Document  : ${doc.id} (montré comme « ${doc.nomFichier} »)`);
  console.log(`Clé R2    : ${doc.cleR2}`);
  console.log(`Fichier   : ${chemin} — ${mo(pdf.byteLength)} — sha256 ${sha256}`);
  if (!appliquer) {
    console.log("Essai à blanc : rien n'est écrit. Ajoutez --appliquer pour déposer.");
    return;
  }
  await uploadToR2(doc.cleR2, pdf, "application/pdf", { sha256 });
  const relu = await enteteObjetR2(doc.cleR2);
  if (!relu || relu.taille !== pdf.byteLength) {
    console.error("Dépôt non confirmé : l'objet relu n'a pas la taille attendue.");
    process.exit(1);
  }
  console.log("Déposé et relu. Il partira avec le prochain e-mail « contrat signé ».");
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
