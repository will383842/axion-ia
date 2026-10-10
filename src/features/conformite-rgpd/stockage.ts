// Conformité RGPD (console) — où vit le registre : le stockage PRIVÉ R2, jamais le dépôt.
//
// · `conformite/registre.json` — la version en cours, relue par la page ;
// · `conformite/historique/registre-<horodatage>.json` — une copie par import, jamais
//   effacée : c'est l'historique du registre.
//
// R2 absent (développement, build) : la page le dit et ne plante pas.

import { getObjectBufferR2, isR2Configured, uploadToR2 } from "@/lib/r2-storage";

import { validerRegistre, type Registre } from "./schema";

export const CLE_REGISTRE = "conformite/registre.json";
export const PREFIXE_HISTORIQUE = "conformite/historique/";
export const TAILLE_MAX_REGISTRE = 2 * 1024 * 1024;

/** L'enveloppe enregistrée : le contenu importé, tel quel, et sa date d'import. */
interface Enveloppe {
  importeLe: string;
  contenu: unknown;
}

export type LectureRegistre =
  | { etat: "non_configure" }
  | { etat: "absent" }
  | { etat: "illisible"; erreur: string }
  | { etat: "ok"; registre: Registre; importeLe: Date | null };

export function cleHistorique(maintenant: Date): string {
  return `${PREFIXE_HISTORIQUE}registre-${maintenant.toISOString().replace(/[:.]/g, "-")}.json`;
}

export async function lireRegistre(): Promise<LectureRegistre> {
  if (!isR2Configured()) return { etat: "non_configure" };
  const buffer = await getObjectBufferR2(CLE_REGISTRE);
  if (!buffer) return { etat: "absent" };
  let env: Partial<Enveloppe>;
  try {
    env = JSON.parse(buffer.toString("utf8")) as Partial<Enveloppe>;
  } catch {
    return { etat: "illisible", erreur: "Le registre enregistré n'est pas un JSON lisible." };
  }
  const v = validerRegistre(env.contenu);
  if (!v.ok) return { etat: "illisible", erreur: v.erreur };
  const date = typeof env.importeLe === "string" ? new Date(env.importeLe) : null;
  return {
    etat: "ok",
    registre: v.registre,
    importeLe: date && !Number.isNaN(date.getTime()) ? date : null,
  };
}

/** Enregistre la version en cours ET sa copie datée. Le contenu doit être déjà validé. */
export async function enregistrerRegistre(contenu: unknown, maintenant: Date): Promise<void> {
  const corps = Buffer.from(
    JSON.stringify({ importeLe: maintenant.toISOString(), contenu } satisfies Enveloppe),
    "utf8",
  );
  // La copie datée d'abord : si la seconde écriture échoue, l'historique est complet.
  await uploadToR2(cleHistorique(maintenant), corps, "application/json");
  await uploadToR2(CLE_REGISTRE, corps, "application/json");
}
