// Conformité RGPD (console) — la garde des gestes : rôle administrateur, revérifié
// CÔTÉ SERVEUR à chaque action. Une action serveur se joint par un simple POST : un
// bouton masqué n'est pas une garde.

import { auth } from "@/auth";

import type { Auteur } from "./base";
import { peutImporterRegistre } from "./regles";

export type ResultatGarde = { ok: true; auteur: Auteur } | { ok: false; erreur: string };

export async function exigerAdministrateur(): Promise<ResultatGarde> {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string; name?: string | null } | undefined;
  if (!user?.id) return { ok: false, erreur: "Session expirée : reconnectez-vous." };
  if (!peutImporterRegistre(user.role)) {
    return { ok: false, erreur: "Réservé aux administrateurs." };
  }
  const nom = user.name?.trim() ? user.name.trim().slice(0, 200) : "Administrateur";
  return { ok: true, auteur: { id: user.id, nom } };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Un identifiant de ligne lu dans un formulaire : un UUID, sinon `null`. */
export function lireUuid(formData: FormData, champ: string): string | null {
  const v = formData.get(champ);
  return typeof v === "string" && UUID.test(v) ? v : null;
}
