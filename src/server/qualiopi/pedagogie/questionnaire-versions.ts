/**
 * Lot L08 — pose la version des questions sur un questionnaire qui s'envoie.
 *
 * `questionnaire_versions` est en ajout seul (trigger du socle) : une ligne se
 * crée, ne se modifie jamais. Si une ligne (type, version) existe avec une autre
 * empreinte que le contenu du code, c'est que le code a réécrit une version
 * publiée : on refuse plutôt que d'envoyer des questions qui ne correspondent
 * plus à la version enregistrée.
 */

import { prisma } from "@/lib/prisma";
import { estActifPour } from "@/server/qualiopi/socle/interrupteurs";
import { lirePedagogie } from "./interrupteur";
import {
  contenuDeLaVersion,
  versionCourante,
  type TypeQuestionnaire,
} from "./questionnaire-contenu";
import { empreinteContenu } from "./questionnaire-empreinte";

const TYPES_VERSIONNES: ReadonlyArray<string> = [
  "positionnement",
  "satisfaction_chaud",
  "satisfaction_froid",
];

export function estTypeVersionne(type: string): type is TypeQuestionnaire {
  return TYPES_VERSIONNES.includes(type);
}

export async function assurerVersionQuestionnaire(
  type: TypeQuestionnaire,
  version: number = versionCourante(type),
): Promise<string> {
  const contenu = contenuDeLaVersion(type, version);
  if (contenu === null)
    throw new Error(`Questionnaire ${type} : la version ${version} n'existe pas.`);
  const empreinte = empreinteContenu(contenu);

  const lire = () =>
    prisma.questionnaireVersion.findUnique({ where: { type_version: { type, version } } });
  const verifier = (ligne: { id: string; empreinte: string }) => {
    if (ligne.empreinte !== empreinte) {
      throw new Error(
        `Questionnaire ${type} v${version} : une version publiée ne se réécrit jamais — ajoutez une version.`,
      );
    }
    return ligne.id;
  };

  const existante = await lire();
  if (existante !== null) return verifier(existante);
  try {
    const creee = await prisma.questionnaireVersion.create({
      data: { type, version, contenu: contenu as never, empreinte },
      select: { id: true },
    });
    return creee.id;
  } catch (e) {
    // Deux envois simultanés : l'unicité (type, version) a départagé, on relit.
    if ((e as { code?: string }).code !== "P2002") throw e;
    const gagnante = await lire();
    if (gagnante === null) throw e;
    return verifier(gagnante);
  }
}

/**
 * La version à poser sur un questionnaire que l'on crée, ou `null` : lot éteint,
 * hors banc d'essai en `essai`, type non versionné, ou panne. Ne lève jamais : la
 * création d'un questionnaire ne dépend pas du versionnage.
 */
export async function versionIdPourNouvelEnvoi(
  enrollmentId: string,
  type: string,
): Promise<string | null> {
  if (!estTypeVersionne(type)) return null;
  try {
    const etat = await lirePedagogie();
    if (etat === "eteint") return null;
    const inscription = await prisma.enrollment.findUnique({
      where: { id: enrollmentId },
      select: { estTestInterne: true, session: { select: { estTestInterne: true } } },
    });
    if (inscription === null) return null;
    const cible = {
      estTestInterne: inscription.estTestInterne || inscription.session.estTestInterne,
    };
    if (!estActifPour(etat, cible)) return null;
    return await assurerVersionQuestionnaire(type);
  } catch (e) {
    console.error("[questionnaires] version non posée :", e instanceof Error ? e.name : "erreur");
    return null;
  }
}
