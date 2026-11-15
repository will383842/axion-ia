/**
 * TÉLÉCHARGEMENT PAR VERSION (G4, 2026-11-15) — pour un chemin `guides-reseau/gde-…/v<n>.pdf`.
 *
 * Le seul cas nouveau : le chemin a la forme versionnée ET son code est celui du guide résolu. Tout autre chemin
 * garde l'ancien code (`public/`), inchangé. Rend l'adresse vers laquelle rediriger (303), ou `null` pour
 * « indisponible » (page neutre, 200) : interrupteur éteint, ligne (code, version, « pret ») absente, stockage
 * non configuré, fichier absent, OU toute exception. Ne lève jamais. L'URL signée R2 (600 s) n'est jamais journalisée.
 * Imports lourds chargés à l'appel.
 */
import { SITE_URL } from "@/lib/site-url";
import { cleObjet, cibleGuidesR2, fabriqueActive, secretFichierGuide } from "./fabrique-config";
import { signerLienFichier } from "./lien-fichier-guide";

export const RE_CHEMIN_VERSIONNE = /^guides-reseau\/(gde-[a-z0-9-]{6,24})\/v(\d{1,6})\.pdf$/;
export const VALIDITE_LECTURE_R2_S = 600;

export function lireCheminVersionne(
  chemin: string,
  codeDuGuide: string,
): { code: string; version: number } | null {
  const m = RE_CHEMIN_VERSIONNE.exec(chemin);
  if (m === null || m[1] !== codeDuGuide) return null;
  const version = Number(m[2]);
  return version >= 1 && version <= 100000 ? { code: m[1]!, version } : null;
}

export async function urlDeLaVersion(
  code: string,
  version: number,
  env: Readonly<Record<string, string | undefined>> = process.env,
): Promise<string | null> {
  try {
    if (!fabriqueActive(env)) return null;
    const { prisma } = await import("@/lib/prisma");
    const ligne = await prisma.guideReseauVersion.findUnique({
      where: { code_version: { code, version } },
      select: { statut: true, stockage: true, cleObjet: true },
    });
    const cle = cleObjet(code, version);
    if (ligne === null || ligne.statut !== "pret" || ligne.cleObjet !== cle) return null;
    if (ligne.stockage === "r2") {
      const cible = cibleGuidesR2(env);
      if (cible === null) return null;
      const { signerLectureR2, tailleObjetR2 } = await import("@/lib/r2-storage");
      if (((await tailleObjetR2(cible, cle)) ?? 0) <= 0) return null;
      return await signerLectureR2(cible, cle, VALIDITE_LECTURE_R2_S, {
        nom: `${code}.pdf`,
        disposition: "inline",
      });
    }
    if (ligne.stockage === "volume") {
      const secret = secretFichierGuide(env);
      if (secret === null) return null;
      const { stat } = await import("node:fs/promises");
      const { cheminLisibleVolume } = await import("./stockage-guides");
      const fichier = await cheminLisibleVolume(cle, env);
      if (fichier === null) return null;
      const info = await stat(fichier);
      if (!info.isFile() || info.size <= 0) return null;
      const { e, s } = signerLienFichier(secret, code, version);
      return `${SITE_URL}/api/guides-reseau/fichier?c=${code}&v=${version}&e=${e}&s=${s}`;
    }
    return null;
  } catch {
    return null;
  }
}
