// Adaptateurs `<form action={…}>` (signature (FormData)) délégant aux Server
// Actions de modération (signature (prev, FormData)). Chaque action recharge la
// liste via revalidatePath(adminPath) côté feature.

"use server";

import {
  publishReviewAction,
  hideReviewAction,
  rejectReviewAction,
  replyReviewAction,
  toggleVerifiedReviewAction,
  toggleFeaturedReviewAction,
  deleteReviewAction,
} from "@/features/admin-reviews/actions";

const EMPTY = { ok: false as const, error: "" };

export async function publishForm(fd: FormData): Promise<void> {
  await publishReviewAction(EMPTY, fd);
}
export async function hideForm(fd: FormData): Promise<void> {
  await hideReviewAction(EMPTY, fd);
}
export async function rejectForm(fd: FormData): Promise<void> {
  await rejectReviewAction(EMPTY, fd);
}
export async function replyForm(fd: FormData): Promise<void> {
  await replyReviewAction(EMPTY, fd);
}
export async function verifyForm(fd: FormData): Promise<void> {
  await toggleVerifiedReviewAction(EMPTY, fd);
}
export async function featureForm(fd: FormData): Promise<void> {
  await toggleFeaturedReviewAction(EMPTY, fd);
}
export async function deleteForm(fd: FormData): Promise<void> {
  await deleteReviewAction(EMPTY, fd);
}
