"use server";

/**
 * Photo d'un collaborateur depuis la console : fines enveloppes autour des fonctions serveur
 * réutilisables de `@/server/equipe/photo-collaborateur`. Rôle administrateur revérifié ici.
 */
import {
  PHOTO_MAX_OCTETS,
  deposerPhotoCollaborateur,
  retirerPhotoCollaborateur,
} from "@/server/equipe/photo-collaborateur";
import { exigerAdministrateur } from "@/server/equipe-garde";

import type { ResultatAction } from "./collaborateurs";

const ERREUR_ACCES = "Accès réservé aux administrateurs.";

async function acteur(): Promise<string | null> {
  try {
    return (await exigerAdministrateur()).userId;
  } catch {
    return null;
  }
}

export async function deposerPhotoAction(
  id: unknown,
  formData: unknown,
): Promise<ResultatAction<{ slug: string }>> {
  const admin = await acteur();
  if (!admin) return { ok: false, erreur: ERREUR_ACCES };
  if (!(formData instanceof FormData)) return { ok: false, erreur: "Demande invalide." };
  const fichier = formData.get("photo");
  if (!(fichier instanceof File) || fichier.size === 0) {
    return { ok: false, erreur: "Choisissez une photo." };
  }
  if (fichier.size > PHOTO_MAX_OCTETS) return { ok: false, erreur: "La photo dépasse 8 Mo." };
  const alt = formData.get("alt");
  const note = formData.get("note");
  try {
    return await deposerPhotoCollaborateur({
      memberId: typeof id === "string" ? id : "",
      octets: Buffer.from(await fichier.arrayBuffer()),
      acteur: admin,
      alt: typeof alt === "string" ? alt : null,
      ...(typeof note === "string" && note.trim() !== "" ? { consentementConsole: { note } } : {}),
    });
  } catch {
    return { ok: false, erreur: "Enregistrement impossible, réessayez dans un instant." };
  }
}

export async function retirerPhotoAction(id: unknown): Promise<ResultatAction<{ slug: string }>> {
  const admin = await acteur();
  if (!admin) return { ok: false, erreur: ERREUR_ACCES };
  try {
    return await retirerPhotoCollaborateur({
      memberId: typeof id === "string" ? id : "",
      acteur: admin,
    });
  } catch {
    return { ok: false, erreur: "Retrait impossible, réessayez dans un instant." };
  }
}
