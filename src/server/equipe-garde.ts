/**
 * Garde des actions de la console « Collaborateurs » : rôle ADMINISTRATEUR seulement
 * (`super_admin` ou `admin`), revérifié dans CHAQUE action serveur. Jamais de lecture seule,
 * jamais `secretaire` ni `editor` : ces fiches publient des données personnelles.
 */
import { auth } from "@/auth";

export interface AdministrateurEquipe {
  readonly userId: string;
  readonly role: "super_admin" | "admin";
}

export async function exigerAdministrateur(): Promise<AdministrateurEquipe> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) throw new Error("unauthorized");
  const role = (session.user as { role?: string }).role;
  if (role !== "super_admin" && role !== "admin") throw new Error("forbidden");
  return { userId, role };
}
