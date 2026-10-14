// Banc @formateurs, équipe sécurité — `next/cache` hors d'une requête Next.
//
// Hors du serveur Next, `revalidatePath` lève « static generation store
// missing » : il n'y a aucune page à invalider dans le banc. Tout le reste du
// module est le vrai.

export * from "next/cache";

export function revalidatePath(): void {}
export function revalidateTag(): void {}
export function updateTag(): void {}
