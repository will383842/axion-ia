// Server Action — « Envoyer l'invitation » depuis la fiche d'un contact
// apporteur (Contacts › Commercial › fiche), 2026-09-19.
//
// Formulaire SANS JavaScript client : l'action rend la main par une
// redirection vers la fiche, qui lit `?invitation=<résultat>` et affiche le
// bandeau. La console admin a un cliquet de poids (Gate B) : un bouton qui
// n'a besoin que d'un aller-retour serveur n'a pas à embarquer une île.
//
// La logique vit dans `invitation-apporteur.ts`, partagée avec la saisie
// manuelle.

"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/auth";
import { adminPath } from "@/lib/admin-path";
import { envoyerInvitationApporteur } from "./invitation-apporteur";

/** Rôles autorisés à écrire dans la console. Même liste que la saisie manuelle. */
const ROLES_ECRITURE = ["super_admin", "admin", "editor"] as const;

async function adminAutorise(): Promise<string | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  const role = (session.user as { role?: string }).role;
  return ROLES_ECRITURE.includes(role as (typeof ROLES_ECRITURE)[number]) ? session.user.id : null;
}

const schema = z.object({
  submissionId: z.string().uuid(),
  calendlyUrl: z.string().trim().max(500),
  /** « Renvoyer quand même » — case HTML : `on` si cochée, absente sinon. */
  renvoyer: z.enum(["on"]).optional(),
  /** « La personne a accepté d'être contactée » (recommandation, autre). */
  accordContact: z.enum(["on"]).optional(),
});

/** Une case HTML décochée n'est pas envoyée : `null` devient « absente ». */
function caseCochee(formData: FormData, nom: string): string | undefined {
  const v = formData.get(nom);
  return typeof v === "string" ? v : undefined;
}

export async function envoyerInvitationDepuisFicheAction(formData: FormData): Promise<void> {
  // 🔴 2026-09-19 — UNE PERSONNE À LA FOIS, vérifié AVANT toute lecture.
  // `formData.get` ne lit que la première valeur : un formulaire qui porterait
  // plusieurs fiches (forgé, ou un futur écran de sélection) en inviterait une
  // seule en laissant croire à l'administrateur qu'il les a toutes invitées.
  const ids = formData.getAll("submissionId");
  if (ids.length !== 1) {
    const premier = ids[0];
    const ficheOuListe =
      typeof premier === "string" && z.string().uuid().safeParse(premier).success
        ? adminPath("fr", `contacts/commercial/${premier}`)
        : adminPath("fr", "contacts/commercial");
    redirect(`${ficheOuListe}?invitation=une-seule-personne#invitation`);
  }

  const parsed = schema.safeParse({
    submissionId: formData.get("submissionId"),
    calendlyUrl: formData.get("calendlyUrl") ?? "",
    renvoyer: caseCochee(formData, "renvoyer"),
    accordContact: caseCochee(formData, "accordContact"),
  });
  // Sans identifiant valide, il n'y a pas de fiche où revenir : retour à la liste.
  if (!parsed.success) redirect(adminPath("fr", "contacts/commercial"));

  const fiche = adminPath("fr", `contacts/commercial/${parsed.data.submissionId}`);
  const adminId = await adminAutorise();
  // ⚠️ `redirect` lève : il reste HORS de tout try/catch.
  if (!adminId) redirect(`${fiche}?invitation=non-autorise`);

  const resultat = await envoyerInvitationApporteur({
    submissionId: parsed.data.submissionId,
    calendlyUrl: parsed.data.calendlyUrl,
    adminId,
    renvoyer: parsed.data.renvoyer === "on",
    accordContact: parsed.data.accordContact === "on",
  });

  const code = resultat.ok
    ? resultat.enValidation
      ? "en-validation"
      : "envoyee"
    : resultat.erreur;
  revalidatePath(fiche);
  redirect(`${fiche}?invitation=${code}#invitation`);
}
