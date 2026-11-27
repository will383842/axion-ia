import { gardePage, type ResultatAcces } from "@/server/auth/garde-page";

/** Garde des PAGES « Collaborateurs » : session + rôle administrateur (même exigence que les actions). */
export async function gardePageCollaborateurs(loginHref: string): Promise<ResultatAcces> {
  const acces = await gardePage("ecriture", loginHref);
  if (!acces.autorise) return acces;
  if (acces.role !== "super_admin" && acces.role !== "admin") {
    return {
      autorise: false,
      role: acces.role,
      motif: "Les fiches collaborateurs sont réservées aux administrateurs.",
    };
  }
  return acces;
}
