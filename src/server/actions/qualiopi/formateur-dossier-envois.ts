// Dossier en ligne des formateurs indépendants — actions de la CONSOLE (lot L6).
//
// « Renvoyer le lien » (F8) et « Demander un complément » (F12). Rôles : ceux qui
// habilitent un formateur (`habiliter_formateur`). Livré ÉTEINT : interrupteur
// `dossier_en_ligne` absent = refus, rien d'écrit ; texte non validé = refus AVANT de
// révoquer les liens envoyés. Le retour se fait par un CODE d'une liste fermée
// (`?dossier=…`) : la page n'affiche jamais un texte venu de l'URL.

"use server";

import * as Sentry from "@sentry/nextjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { auth } from "@/auth";
import { adminPath } from "@/lib/admin-path";
import { peutEngager } from "@/server/auth/habilitations";
import {
  demanderComplement,
  estMotifComplement,
  renvoyerLienDossier,
  type ResultatDossier,
} from "@/server/qualiopi/formateurs-independants/envois-dossier";
import type { CodeRetourDossier } from "@/server/qualiopi/formateurs-independants/retour-dossier";

async function autorise(): Promise<{ userId: string } | CodeRetourDossier> {
  const session = await auth();
  if (!session?.user?.id) return "session";
  const role = (session.user as { role?: string }).role;
  if (!peutEngager(role, "habiliter_formateur")) return "droit";
  return { userId: session.user.id };
}

function codeDe(r: ResultatDossier, succes: CodeRetourDossier): CodeRetourDossier {
  if (!r.ok) return r.raison;
  if (r.envoi === "envoye") return succes;
  if (r.envoi === "en-validation") return "en_validation";
  return "envoi_echoue";
}

async function executer(
  formData: FormData,
  faire: (trainerId: string, userId: string) => Promise<CodeRetourDossier>,
): Promise<never> {
  const trainerId = String(formData.get("trainerId") ?? "");
  if (!z.string().uuid().safeParse(trainerId).success) {
    redirect(adminPath("fr", "qualiopi/formateurs"));
  }
  const fiche = adminPath("fr", `qualiopi/formateurs/${trainerId}`);
  let code: CodeRetourDossier;
  const a = await autorise();
  if (typeof a === "string") {
    code = a;
  } else {
    try {
      code = await faire(trainerId, a.userId);
    } catch (err) {
      Sentry.captureException(err, { tags: { action: "formateur-dossier-envois" } });
      code = "erreur";
    }
    revalidatePath(fiche);
  }
  redirect(`${fiche}?dossier=${code}#dossier-en-ligne`);
}

export async function renvoyerLienDossierFormAction(formData: FormData): Promise<void> {
  await executer(formData, async (trainerId, userId) =>
    codeDe(
      await renvoyerLienDossier({ trainerId, parId: userId, maintenant: new Date() }),
      "lien_envoye",
    ),
  );
}

export async function demanderComplementFormAction(formData: FormData): Promise<void> {
  await executer(formData, async (trainerId, userId) => {
    const motif = formData.get("motif");
    if (!estMotifComplement(motif)) return "motif";
    return codeDe(
      await demanderComplement({ trainerId, motif, parId: userId, maintenant: new Date() }),
      "complement_demande",
    );
  });
}
