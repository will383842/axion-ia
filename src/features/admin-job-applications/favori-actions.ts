"use server";

// Favori d'une candidature vidéo (vue « Monteurs & vidéastes »).
//
// Un favori est une information COMMUNE à l'équipe, comme le statut : `favoriAt`
// (NULL = pas favori). Le formulaire envoie l'état VOULU (« 1 » / « 0 »), jamais
// l'inverse de l'état lu : deux clics ou deux onglets donnent le même résultat, et
// `updateMany` conditionnel n'écrit (et ne journalise) que s'il y a un changement.
// Hors de la frise du dossier : ce geste interne ne concerne pas le candidat et ne
// doit pas faire bouger `lastActivityAt`.

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/client-ip";
import { adminPath } from "@/lib/admin-path";
import { VIDEO_FREELANCE_OFFER_SLUGS } from "@/lib/careers/video-editor-offer";
import { requireAdminWrite } from "./session";

const Entree = z.object({
  id: z.string().uuid(),
  favori: z.enum(["0", "1"]),
});

export async function marquerFavoriAction(formData: FormData): Promise<void> {
  let acteurId: string;
  try {
    acteurId = (await requireAdminWrite()).userId;
  } catch {
    return;
  }
  const lu = Entree.safeParse({ id: formData.get("id"), favori: formData.get("favori") });
  if (!lu.success) return;
  const { id, favori } = lu.data;

  // Seules les candidatures des offres vidéo freelance : un appel direct à l'action
  // ne doit pas marquer le dossier d'une autre offre.
  const offre = { slug: { in: [...VIDEO_FREELANCE_OFFER_SLUGS] } };
  const { count } =
    favori === "1"
      ? await prisma.jobApplication.updateMany({
          where: { id, offer: offre, favoriAt: null },
          data: { favoriAt: new Date() },
        })
      : await prisma.jobApplication.updateMany({
          where: { id, offer: offre, favoriAt: { not: null } },
          data: { favoriAt: null },
        });

  if (count > 0) {
    try {
      await prisma.activityLog.create({
        data: {
          adminUserId: acteurId,
          action:
            favori === "1"
              ? "careers.candidature.favori.ajoute"
              : "careers.candidature.favori.retire",
          targetType: "JobApplication",
          targetId: id,
          ipAddress: await getClientIp(),
        },
      });
    } catch {
      // best-effort : un journal indisponible n'annule pas le favori.
    }
  }
  revalidatePath(adminPath("fr", "contacts/candidatures/video"));
}
