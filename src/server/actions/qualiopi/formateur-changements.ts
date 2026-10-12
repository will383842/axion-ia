// Changement de compte bancaire et d'adresse d'un formateur indépendant — Server Actions
// de l'écran W-7 (lot E, M12).
//
// Rôles : ceux qui rémunèrent un formateur (`remunerer_formateur`) — l'IBAN décide où part
// un virement. Livré ÉTEINT : interrupteur `formateurs.changement_coordonnees` coupé =
// refus, rien d'écrit. Validation au plus tôt 48 h après la demande (le service le
// revérifie). L'issue revient par un code fermé dans l'adresse ; aucun IBAN, aucune
// adresse dans les journaux ni dans Sentry.

"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { adminPath } from "@/lib/admin-path";
import { requireHabilitation } from "@/server/actions/qualiopi/_guards";
import {
  refuserDemandeChangement,
  validerDemandeChangement,
} from "@/server/qualiopi/formateurs-independants/changements-coordonnees";

const chemin = (issue: string) =>
  `${adminPath("fr", "qualiopi/formateurs/changements")}?issue=${issue}`;

const schema = z.object({
  demandeId: z.string().uuid(),
  motif: z.string().max(500).optional(),
});

async function habilitation(): Promise<{ userId: string } | null> {
  try {
    return await requireHabilitation("remunerer_formateur");
  } catch {
    return null;
  }
}

export async function validerChangementAction(fd: FormData): Promise<void> {
  const session = await habilitation();
  if (!session) redirect(chemin("refuse"));
  const v = schema.safeParse({ demandeId: fd.get("demandeId") });
  if (!v.success) redirect(chemin("introuvable"));
  const r = await validerDemandeChangement({
    demandeId: v.data.demandeId,
    adminId: session.userId,
    maintenant: new Date(),
  });
  redirect(chemin(r.ok ? "valide" : r.raison));
}

export async function refuserChangementAction(fd: FormData): Promise<void> {
  const session = await habilitation();
  if (!session) redirect(chemin("refuse"));
  const v = schema.safeParse({
    demandeId: fd.get("demandeId"),
    motif: String(fd.get("motif") ?? "").slice(0, 500),
  });
  if (!v.success) redirect(chemin("introuvable"));
  const r = await refuserDemandeChangement({
    demandeId: v.data.demandeId,
    adminId: session.userId,
    motif: v.data.motif ?? "",
    maintenant: new Date(),
  });
  redirect(chemin(r.ok ? "refusee" : r.raison));
}
