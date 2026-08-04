// Adaptateurs `<form action={…}>` (signature (FormData)) délégant aux Server
// Actions de modération (signature (prev, FormData)). Chaque action recharge la
// liste via revalidatePath(adminPath) côté feature.

"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";

import {
  publishReviewAction,
  hideReviewAction,
  rejectReviewAction,
  replyReviewAction,
  toggleVerifiedReviewAction,
  toggleFeaturedReviewAction,
  deleteReviewAction,
  uploadReviewPhotoAction,
  removeReviewPhotoAction,
} from "@/features/admin-reviews/actions";

const EMPTY = { ok: false as const, error: "" };

/**
 * 🔴 LES NEUF BOUTONS DE MODÉRATION AVALAIENT LEURS ERREURS.
 *
 * Chaque adaptateur faisait `await action(EMPTY, fd)` et rendait `void` :
 * l'état `{ ok, error }` que l'action prend soin de construire partait à la
 * poubelle. Quand la modération échouait — droits insuffisants, avis
 * entre-temps supprimé, photo trop lourde — l'écran ne bougeait pas d'un pixel.
 * L'administrateur voyait exactement ce qu'il aurait vu en cas de succès :
 * rien. Sur des avis clients publiés au nom de l'organisme, croire avoir
 * publié quand on n'a pas publié est la pire des deux issues.
 *
 * L'erreur repart désormais dans l'URL de la page appelante, lue par les deux
 * écrans concernés. On passe par l'en-tête `referer` parce que ces adaptateurs
 * servent à la fois la liste et la fiche : coder la destination en dur
 * renverrait la moitié des échecs sur le mauvais écran.
 */
async function executer(travail: () => Promise<{ ok: boolean; error?: string }>): Promise<void> {
  const resultat = await travail();
  if (resultat.ok) return;

  const referer = (await headers()).get("referer");
  const message = resultat.error?.trim() || "L'opération a échoué.";
  if (referer === null) {
    // Sans page d'origine connue, se taire serait retomber exactement dans le
    // défaut qu'on corrige : on laisse remonter, la frontière d'erreur affiche.
    throw new Error(message);
  }
  const url = new URL(referer);
  url.searchParams.set("erreur", message);
  redirect(`${url.pathname}${url.search}`);
}

export async function publishForm(fd: FormData): Promise<void> {
  await executer(() => publishReviewAction(EMPTY, fd));
}
export async function hideForm(fd: FormData): Promise<void> {
  await executer(() => hideReviewAction(EMPTY, fd));
}
export async function rejectForm(fd: FormData): Promise<void> {
  await executer(() => rejectReviewAction(EMPTY, fd));
}
export async function replyForm(fd: FormData): Promise<void> {
  await executer(() => replyReviewAction(EMPTY, fd));
}
export async function verifyForm(fd: FormData): Promise<void> {
  await executer(() => toggleVerifiedReviewAction(EMPTY, fd));
}
export async function featureForm(fd: FormData): Promise<void> {
  await executer(() => toggleFeaturedReviewAction(EMPTY, fd));
}
export async function deleteForm(fd: FormData): Promise<void> {
  await executer(() => deleteReviewAction(EMPTY, fd));
}
export async function uploadPhotoForm(fd: FormData): Promise<void> {
  await executer(() => uploadReviewPhotoAction(EMPTY, fd));
}
export async function removePhotoForm(fd: FormData): Promise<void> {
  await executer(() => removeReviewPhotoAction(EMPTY, fd));
}
