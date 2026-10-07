// Saisie et suppression d'une dépense publicitaire — Server Actions simples,
// appelées par un `<form action>` de la page « Tunnel apporteurs » (aucun
// composant client : la page est rendue côté serveur seulement).
//
// Garde : une session de console ET un rôle qui peut écrire (`peutEcrire`, le
// SSOT des habilitations) ; le rôle lecteur consulte, il ne saisit pas. La
// validation (montant 0-100 000 €, date ≤ aujourd'hui, canal fermé) est refaite
// ICI, côté serveur : le formulaire HTML n'est qu'une commodité.
//
// Retour : une redirection vers la page avec `?depense=` (ok / supprimee) ou
// `?erreur=` (le message) — pas d'état client à porter.

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as Sentry from "@sentry/nextjs";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { adminPath } from "@/lib/admin-path";
import { peutEcrire } from "@/server/auth/habilitations";
import { validerDepense } from "./depenses";

const PAGE = (): string => adminPath("fr", "tunnels/apporteurs");

/** Date du jour à Paris, `AAAA-MM-JJ`. */
function aujourdhuiParis(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

async function sessionEcriture(): Promise<{ email: string | null }> {
  const session = await auth();
  if (!session?.user) redirect(adminPath("fr", "login"));
  const role = (session.user as { role?: string }).role;
  if (!peutEcrire(role)) {
    redirect(
      `${PAGE()}?erreur=${encodeURIComponent("Votre rôle ne permet pas de saisir une dépense.")}`,
    );
  }
  return { email: session.user.email ?? null };
}

function champ(f: FormData, nom: string): string {
  const v = f.get(nom);
  return typeof v === "string" ? v : "";
}

export async function ajouterDepenseAction(formData: FormData): Promise<void> {
  const { email } = await sessionEcriture();
  const r = validerDepense(
    {
      spentOn: champ(formData, "spentOn"),
      canal: champ(formData, "canal"),
      campagne: champ(formData, "campagne"),
      montantEuros: champ(formData, "montantEuros"),
      note: champ(formData, "note"),
    },
    aujourdhuiParis(),
  );
  if (!r.ok) redirect(`${PAGE()}?erreur=${encodeURIComponent(r.erreur)}`);

  try {
    await prisma.acquisitionSpend.create({
      data: {
        spentOn: r.valeur.spentOn,
        canal: r.valeur.canal,
        campagne: r.valeur.campagne,
        montantCentimes: r.valeur.montantCentimes,
        note: r.valeur.note,
        createdByEmail: email,
      },
    });
  } catch (err) {
    Sentry.captureException(err, { tags: { action: "ajouterDepenseAction" } });
    redirect(`${PAGE()}?erreur=${encodeURIComponent("Enregistrement impossible, réessayez.")}`);
  }
  revalidatePath(PAGE());
  redirect(`${PAGE()}?depense=ok`);
}

export async function supprimerDepenseAction(formData: FormData): Promise<void> {
  await sessionEcriture();
  const id = champ(formData, "id");
  if (!/^[0-9a-f-]{36}$/i.test(id))
    redirect(`${PAGE()}?erreur=${encodeURIComponent("Ligne inconnue.")}`);
  try {
    await prisma.acquisitionSpend.deleteMany({ where: { id } });
  } catch (err) {
    Sentry.captureException(err, { tags: { action: "supprimerDepenseAction" } });
    redirect(`${PAGE()}?erreur=${encodeURIComponent("Suppression impossible, réessayez.")}`);
  }
  revalidatePath(PAGE());
  redirect(`${PAGE()}?depense=supprimee`);
}
