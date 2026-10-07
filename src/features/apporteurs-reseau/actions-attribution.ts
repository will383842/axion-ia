"use server";

// « Confirmer l'attribution maintenant » (décision de Will, 2026-10-07 ; contrat 2.2,
// art. 3.2 : l'attribution devient définitive aussi sur confirmation de la Société).
// Fichier À PART de `actions-presentations.ts` (d'autres sessions y travaillent). Réutilise
// `confirmerPresentation` — la même écriture que « L'entreprise a répondu le … », datée
// d'aujourd'hui —, réservée aux ADMINISTRATEURS et journalisée.

import { revalidatePath } from "next/cache";
import * as Sentry from "@sentry/nextjs";

import { auth } from "@/auth";
import { adminPath } from "@/lib/admin-path";
import { prisma } from "@/lib/prisma";
import { confirmerPresentation } from "./presentations";
import type { EtatAction } from "./actions-presentations";

const ROLES = new Set(["super_admin", "admin"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function confirmerAttributionMaintenantAction(
  _prev: EtatAction,
  fd: FormData,
): Promise<EtatAction> {
  const session = await auth();
  if (!session?.user?.id) return { etat: "erreur", message: "Session expirée : reconnectez-vous." };
  const role = (session.user as { role?: string }).role ?? "";
  if (!ROLES.has(role)) return { etat: "erreur", message: "Réservé aux administrateurs." };
  const brut = fd.get("id");
  const id = typeof brut === "string" ? brut.trim().toLowerCase() : "";
  if (!UUID.test(id)) return { etat: "erreur", message: "Identifiant invalide." };
  try {
    const r = await confirmerPresentation(id, new Date());
    if (!r.ok) return { etat: "erreur", message: r.message };
    await prisma.activityLog.create({
      data: {
        adminUserId: session.user.id,
        action: "presentation.attribution_confirmee_maintenant",
        targetType: "presentation_entreprise",
        targetId: id,
        changes: { statut: "confirmee", par: "confirmation de la Société" },
      },
    });
    revalidatePath(adminPath("fr", "apporteurs/entreprises"));
    return { etat: "ok", message: "Attribution confirmée : elle est définitive." };
  } catch (err) {
    Sentry.captureException(err, { tags: { action: "confirmer-attribution-maintenant" } });
    return { etat: "erreur", message: "La confirmation a échoué. Réessayez dans un instant." };
  }
}
