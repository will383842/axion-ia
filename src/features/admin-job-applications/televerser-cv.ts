/**
 * ATTACHER UN CV À UNE CANDIDATURE DÉJÀ ENREGISTRÉE.
 *
 * 🔴 POURQUOI CE FICHIER EXISTE (2026-09-24). La console savait TÉLÉCHARGER un
 *    CV (`/contacts/candidatures/[id]/cv`) mais aucun écran ne permettait d'en
 *    DÉPOSER un : les CV ne s'écrivaient que par le formulaire public. Toute
 *    candidature reçue autrement — par e-mail, par Indeed — arrivait donc dans
 *    la console amputée de sa pièce principale, et la pièce restait dans une
 *    boîte de messagerie que la console ne voit pas.
 *
 *    Mesuré le 2026-09-23 : 13 candidatures importées hors formulaire, dont
 *    8 annoncent un CV resté dans `contact@axion-ia.com`. Sans ce dépôt, elles
 *    restent des fiches sans dossier.
 *
 * 🔑 LES CONTRAINTES NE SONT PAS RECOPIÉES. Extensions, types MIME et plafond
 *    de taille viennent de `cv-storage.ts`, qui les déclare déjà pour le
 *    formulaire public. Deux listes auraient divergé au premier format ajouté,
 *    et l'écart se serait vu le jour où un candidat dépose un fichier que l'une
 *    accepte et l'autre refuse.
 *
 * 🔑 LA GARDE N'EST PAS RECOPIÉE : `requireAdminWrite()` de `session.ts`.
 *    Ce module dit en toutes lettres pourquoi les gardes de la zone y vivent —
 *    « deux copies d'une garde de rôle, c'est la mécanique exacte du constat
 *    T5 : le jour où l'une des deux gagne un rôle, l'autre ne le sait pas, et
 *    la divergence ne se voit sur aucun écran ». Déposer un CV, c'est écrire
 *    sur un dossier de candidat ; c'est donc exactement cette garde, et le
 *    rôle `editor` — qui ne peut pas ouvrir un dossier — ne peut pas non plus
 *    y déposer de pièce.
 */

"use server";

import { revalidatePath } from "next/cache";
import * as Sentry from "@sentry/nextjs";

import { prisma } from "@/lib/prisma";
import { adminPath } from "@/lib/admin-path";
import {
  CV_ALLOWED_EXTENSIONS,
  CV_ALLOWED_MIME,
  CV_MAX_BYTES,
  sanitizeCvFileName,
  storeCv,
} from "@/server/careers/cv-storage";
import { consignerEvenement } from "./journal";
import { requireAdminWrite, type SessionEcriture } from "./session";

export interface ResultatDepotCv {
  readonly ok: boolean;
  /** Phrase prête à afficher — jamais un code technique. */
  readonly message: string;
}

/** Vrai si le nom de fichier porte une extension acceptée. */
function extensionAcceptee(nom: string): boolean {
  const bas = nom.toLowerCase();
  return CV_ALLOWED_EXTENSIONS.some((e) => bas.endsWith(e));
}

export async function televerserCvAction(
  _etatPrecedent: ResultatDepotCv | null,
  formData: FormData,
): Promise<ResultatDepotCv> {
  // `requireAdminWrite` LÈVE (`unauthorized` / `forbidden`) ; cet écran rend
  // une phrase. On traduit ici, et ici seulement : le try ne couvre que la
  // garde, pour qu'une panne d'enregistrement ne puisse jamais se déguiser en
  // refus de droit.
  let session: SessionEcriture;
  try {
    session = await requireAdminWrite();
  } catch {
    return { ok: false, message: "Vous n'avez pas le droit de déposer une pièce sur ce dossier." };
  }

  const id = String(formData.get("applicationId") ?? "");
  const fichier = formData.get("cv");
  if (!id || !(fichier instanceof File) || fichier.size === 0) {
    return { ok: false, message: "Aucun fichier sélectionné." };
  }

  // 🔑 On valide AVANT de lire le fichier en mémoire : un refus doit coûter
  //    zéro octet, sinon le plafond de taille ne protège de rien.
  if (fichier.size > CV_MAX_BYTES) {
    const mo = Math.round(CV_MAX_BYTES / (1024 * 1024));
    return { ok: false, message: `Fichier trop lourd : ${mo} Mo au maximum.` };
  }
  if (!extensionAcceptee(fichier.name)) {
    return {
      ok: false,
      message: `Format refusé. Acceptés : ${CV_ALLOWED_EXTENSIONS.join(", ")}.`,
    };
  }
  // Le type déclaré par le navigateur se vérifie AUSSI : une extension seule se
  // renomme, et le formulaire public applique déjà les deux contrôles.
  if (fichier.type && !(CV_ALLOWED_MIME as ReadonlyArray<string>).includes(fichier.type)) {
    return { ok: false, message: "Type de fichier refusé." };
  }

  const dossier = await prisma.jobApplication.findUnique({
    where: { id },
    select: { id: true, cvStoragePath: true },
  });
  if (!dossier) return { ok: false, message: "Candidature introuvable." };
  // 🔴 On ne REMPLACE pas une pièce existante : écraser le CV déposé par le
  //    candidat lui-même serait une perte irréversible, et rien à l'écran ne le
  //    dirait. Le dépôt ne sert qu'à combler une absence.
  if (dossier.cvStoragePath) {
    return { ok: false, message: "Un CV est déjà attaché à cette candidature." };
  }

  try {
    const octets = Buffer.from(await fichier.arrayBuffer());
    const chemin = await storeCv(octets, fichier.name);
    await prisma.jobApplication.update({
      where: { id },
      data: {
        cvStoragePath: chemin,
        cvOriginalName: sanitizeCvFileName(fichier.name),
        cvMimeType: fichier.type || null,
        cvSizeBytes: octets.byteLength,
      },
    });
    // 🔑 `piece_recue` existe déjà dans le vocabulaire du journal — on ne crée
    //    pas un type de plus pour un fait qu'il sait déjà nommer. La frise du
    //    dossier affichera ce dépôt à sa date, entre les autres gestes.
    await consignerEvenement({
      applicationId: id,
      type: "piece_recue",
      authorId: session.userId,
      authorName: session.nom,
      summary: `CV attaché à la main (${sanitizeCvFileName(fichier.name)})`,
    });
    revalidatePath(adminPath("fr", `contacts/candidatures/${id}`));
    return { ok: true, message: "CV attaché." };
  } catch (e) {
    Sentry.captureException(e, {
      tags: { area: "recrutement", action: "televerserCvAction" },
    });
    return { ok: false, message: "L'enregistrement a échoué. Rien n'a été attaché." };
  }
}
