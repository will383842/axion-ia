// Lieu d'exercice des formateurs — Server Actions (lot L15a, ADR 0066).
//
// Rôles : ceux qui habilitent un formateur (`habiliter_formateur`). Livré
// ÉTEINT : interrupteur `formateurs.proches_bloc` absent = refus, rien d'écrit.
// Le retour se fait par un CODE d'une liste fermée (`?lieu=…`) : la page
// n'affiche jamais un texte venu de l'URL.

"use server";

import * as Sentry from "@sentry/nextjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { auth } from "@/auth";
import { adminPath } from "@/lib/admin-path";
import { peutEngager } from "@/server/auth/habilitations";
import { envoiAllume } from "@/server/qualiopi/formateurs-independants/interrupteurs-envoi";
import {
  enregistrerLieuFormateur,
  rattraperLieuxFormateurs,
} from "@/server/qualiopi/formateurs-proches/lieu-formateur-service";

import type { CodeRetourLieu } from "@/server/qualiopi/formateurs-proches/retour-lieu";

async function autorise(): Promise<{ userId: string } | CodeRetourLieu> {
  const session = await auth();
  if (!session?.user?.id) return "session";
  const role = (session.user as { role?: string }).role;
  if (!peutEngager(role, "habiliter_formateur")) return "droit";
  if (!(await envoiAllume("proches_bloc"))) return "eteint";
  return { userId: session.user.id };
}

export async function enregistrerLieuFormateurFormAction(formData: FormData): Promise<void> {
  const trainerId = String(formData.get("trainerId") ?? "");
  if (!z.string().uuid().safeParse(trainerId).success) {
    redirect(adminPath("fr", "qualiopi/formateurs"));
  }
  const fiche = adminPath("fr", `qualiopi/formateurs/${trainerId}`);
  let code: CodeRetourLieu;
  const a = await autorise();
  if (typeof a === "string") {
    code = a;
  } else {
    try {
      const ville = formData.get("ville");
      code = await enregistrerLieuFormateur(
        trainerId,
        String(formData.get("codePostal") ?? ""),
        typeof ville === "string" ? ville.slice(0, 120) : null,
        a.userId,
        new Date(),
      );
    } catch (err) {
      Sentry.captureException(err, { tags: { action: "enregistrerLieuFormateur" } });
      code = "erreur";
    }
    revalidatePath(fiche);
  }
  redirect(`${fiche}?lieu=${code}#lieu-exercice`);
}

export async function rattraperLieuxFormateursFormAction(): Promise<void> {
  const page = adminPath("fr", "qualiopi/formateurs/lieux");
  let code: CodeRetourLieu;
  const a = await autorise();
  if (typeof a === "string") {
    code = a;
  } else {
    try {
      const b = await rattraperLieuxFormateurs(a.userId, new Date());
      code = b.trouvees > 0 ? "rattrapage_fait" : "rattrapage_vide";
    } catch (err) {
      Sentry.captureException(err, { tags: { action: "rattraperLieuxFormateurs" } });
      code = "erreur";
    }
    revalidatePath(page);
  }
  redirect(`${page}?lieu=${code}`);
}
