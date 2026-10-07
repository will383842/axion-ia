"use server";

// Retirer / remettre / supprimer définitivement un dossier d'apporteur (2026-10-07).
// Fichier À PART de `actions-apporteurs.ts` (une autre session y travaille) ; même garde :
// administrateurs seulement, contrôlée ICI et pas seulement à l'écran. Le métier et ses
// contrôles vivent dans `retrait.ts`.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as Sentry from "@sentry/nextjs";

import { auth } from "@/auth";
import { adminPath } from "@/lib/admin-path";
import {
  remettreDansLeReseau,
  retirerDuReseau,
  supprimerDefinitivement,
  type Issue,
} from "./retrait";

const ROLES = new Set(["super_admin", "admin"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function adminOuRefus(): Promise<{ id: string } | { refus: string }> {
  const session = await auth();
  if (!session?.user?.id) return { refus: "Session expirée : reconnectez-vous." };
  const role = (session.user as { role?: string }).role ?? "";
  if (!ROLES.has(role)) return { refus: "Réservé aux administrateurs." };
  return { id: session.user.id };
}

function rafraichir(apporteurId: string): void {
  revalidatePath("/[locale]/[adminPrefix]/apporteurs", "page");
  revalidatePath(`/[locale]/[adminPrefix]/apporteurs/${apporteurId}`, "page");
}

async function executer(
  apporteurId: unknown,
  geste: (id: string, adminId: string) => Promise<Issue>,
  etape: string,
): Promise<Issue> {
  const qui = await adminOuRefus();
  if ("refus" in qui) return { ok: false, message: qui.refus };
  if (typeof apporteurId !== "string" || !UUID.test(apporteurId)) {
    return { ok: false, message: "Identifiant invalide." };
  }
  const id = apporteurId.toLowerCase();
  try {
    const r = await geste(id, qui.id);
    if (r.ok) rafraichir(id);
    return r;
  } catch (err) {
    Sentry.captureException(err, { tags: { action: "apporteur-retrait", step: etape } });
    return { ok: false, message: "L'opération a échoué. Réessayez dans un instant." };
  }
}

export async function retirerDuReseauAction(input: { apporteurId: string }): Promise<Issue> {
  return executer(input?.apporteurId, retirerDuReseau, "retirer");
}

export async function remettreDansLeReseauAction(input: { apporteurId: string }): Promise<Issue> {
  return executer(input?.apporteurId, remettreDansLeReseau, "remettre");
}

export async function supprimerDefinitivementAction(input: {
  apporteurId: string;
  nomTape: string;
}): Promise<Issue> {
  const nomTape = typeof input?.nomTape === "string" ? input.nomTape.slice(0, 200) : "";
  return executer(
    input?.apporteurId,
    (id, adminId) => supprimerDefinitivement(id, adminId, nomTape),
    "supprimer",
  );
}

// ── Versions FORMULAIRE (sans JavaScript côté navigateur, 2026-10-07) ──────
// Le composant de la fiche est un composant SERVEUR : ses boutons sont des formulaires
// HTML qui appellent ces actions, puis reviennent sur la fiche avec le message
// (`?retrait=…` / `?retraitErreur=…`). Le cliquet de taille de la console était plein :
// zéro octet de JavaScript ajouté. Mêmes gardes et même métier que ci-dessus.

const champ = (fd: FormData, nom: string, max: number) => {
  const v = fd.get(nom);
  return typeof v === "string" ? v.slice(0, max) : "";
};

function retourFiche(apporteurId: string, r: Issue): never {
  const id = UUID.test(apporteurId) ? apporteurId.toLowerCase() : "";
  const cle = r.ok ? "retrait" : "retraitErreur";
  redirect(`${adminPath("fr", `apporteurs/${id}`)}?${cle}=${encodeURIComponent(r.message)}`);
}

export async function retirerDuReseauFormAction(fd: FormData): Promise<void> {
  const id = champ(fd, "apporteurId", 64);
  retourFiche(id, await retirerDuReseauAction({ apporteurId: id }));
}

export async function remettreDansLeReseauFormAction(fd: FormData): Promise<void> {
  const id = champ(fd, "apporteurId", 64);
  retourFiche(id, await remettreDansLeReseauAction({ apporteurId: id }));
}

export async function supprimerDefinitivementFormAction(fd: FormData): Promise<void> {
  const id = champ(fd, "apporteurId", 64);
  if (fd.get("compris") !== "oui") {
    retourFiche(id, {
      ok: false,
      message: "Cochez « Je comprends que la suppression est définitive ».",
    });
  }
  const r = await supprimerDefinitivementAction({
    apporteurId: id,
    nomTape: champ(fd, "nomTape", 200),
  });
  if (!r.ok) retourFiche(id, r);
  redirect(`${adminPath("fr", "apporteurs")}?retrait=${encodeURIComponent(r.message)}`);
}
