/**
 * La FICHE DES COMMISSIONS, le LIVRET D'ACCUEIL et le GUIDE DE DÉMARRAGE de l'apporteur.
 *
 * 🔒 Le dépôt GitHub est PUBLIC et ces PDF portent des montants : ils ne sont PLUS dans le dépôt.
 * Ils vivent UNIQUEMENT sur le stockage privé R2 (clés `documents-apporteurs/…`), déposés à la
 * main par `scripts/apporteurs/deposer-document-joint.ts`. Ils sortent par DEUX chemins :
 *   · les routes `…/[jeton]/fiche-commissions`, `…/livret` et `…/guide`, qui vérifient le lien
 *     personnel de l'apporteur (avant comme après signature) ;
 *   · l'e-mail « contrat signé » (annexes déclarées avec les autres pièces jointes).
 *
 * Repli : objet absent, vide, pas un PDF ou R2 en panne → `null`, jamais d'exception. Les routes
 * rendent alors leur 404 neutre, les e-mails partent SANS la pièce, et une alerte est
 * journalisée (console + Sentry). Aucune page 500.
 *
 * Garde anti-retour : `__tests__/garde-pdf-apporteurs.spec.ts`.
 *
 * ⚠️ Aucun `server-only` : le script de dépôt (tsx, hors Next) et le worker importent ce module.
 */

import { getObjectBufferR2, isR2Configured } from "@/lib/r2-storage";

import { versionCourante } from "./annexes-versions";
import { signalerErreurReseau } from "./signaler";

// ⚠️ Pas d'import de `./signature-regles` (même `import type`) : il importe `contrat-pdf`
// (`server-only`), et ce module est désormais atteint par le CRON des apporteurs (relances du
// dossier, via la liste des annexes) qui tourne hors de Next. Le type est donc redéclaré ici ; s'il
// divergeait de celui de `signature-regles`, l'appelant ne compilerait plus.
type EtatPage = "modifiable" | "a_verifier" | "signe" | "neutre";

export const PREFIXE_DOCUMENTS_APPORTEURS = "documents-apporteurs/";

export const CLE_R2_FICHE_COMMISSIONS = `${PREFIXE_DOCUMENTS_APPORTEURS}fiche-des-commissions.pdf`;
export const NOM_FICHIER_FICHE_COMMISSIONS = "Fiche-des-commissions-Axion-IA.pdf";
export const CLE_R2_LIVRET = `${PREFIXE_DOCUMENTS_APPORTEURS}livret-apporteur.pdf`;
export const NOM_FICHIER_LIVRET = "Livret-apporteur-Axion-IA.pdf";
export const CLE_R2_GUIDE = `${PREFIXE_DOCUMENTS_APPORTEURS}guide-demarrage-apporteur.pdf`;

/**
 * Lit un PDF d'apporteur sur le stockage privé : `null` s'il est absent, vide, pas un PDF, ou si
 * R2 est indisponible. Ne lève jamais ; l'absence est journalisée (alerte, sans donnée perso).
 */
export async function lirePdfPrive(cle: string, libelle: string): Promise<Buffer | null> {
  try {
    if (!isR2Configured()) {
      console.warn(`[apporteurs-documents] ${libelle} : R2 non configuré, document indisponible`);
      return null;
    }
    const buf = await getObjectBufferR2(cle);
    if (!buf || buf.byteLength === 0 || buf.subarray(0, 5).toString("latin1") !== "%PDF-") {
      console.warn(`[apporteurs-documents] ${libelle} : absent, vide ou illisible sur R2`);
      signalerErreurReseau(
        "documents apporteurs : PDF absent de R2",
        new Error(`${libelle} introuvable sur le stockage privé`),
      );
      return null;
    }
    return buf;
  } catch (err) {
    console.warn(`[apporteurs-documents] ${libelle} : lecture R2 impossible`);
    signalerErreurReseau(`documents apporteurs : lecture de ${libelle}`, err);
    return null;
  }
}

/** Le PDF de la fiche des commissions, ou `null`. Ne lève jamais. */
export async function lireFicheCommissions(): Promise<Buffer | null> {
  const v = await versionCourante("fiche-commissions");
  return lirePdfPrive(v?.cleR2 ?? CLE_R2_FICHE_COMMISSIONS, "fiche des commissions");
}

/** Le PDF du livret d'accueil, ou `null`. Ne lève jamais. */
export async function lireLivret(): Promise<Buffer | null> {
  const v = await versionCourante("livret");
  return lirePdfPrive(v?.cleR2 ?? CLE_R2_LIVRET, "livret");
}

/**
 * États de la page où les documents remis (fiche, livret, guide) sont ouverts par le lien
 * personnel : avant la signature (modifiable, à vérifier) comme après. Tout autre état — refusé,
 * résilié, fiche retirée — reste en 404 neutre.
 */
export function documentsOuvertsPour(etat: EtatPage): boolean {
  return etat === "modifiable" || etat === "a_verifier" || etat === "signe";
}
