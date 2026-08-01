"use server";

// Server Action — RGPD art. 17 (droit à l'effacement) pour image-bank.
//
// Supprime toutes les traces (ImageUsageLog + ImageDownloadLog) associées à un
// ipHash SHA-256. Auditable via ActivityLog (action `rgpd.image_bank.forget_ip_hash`).
//
// Doctrine Axion-IA :
//   - "use server" en tête
//   - Auth role check (admin uniquement)
//   - Zod aux frontières (ipHash 64 hex)
//   - Returns serializable { success, deleted } pour client useFormState
//   - revalidateTag pour invalidation cache Next 16
//   - ActivityLog audit trail (qui a fait quoi quand)
//
// Correctif P0 audit UX 2026-08 : le formulaire RGPD exigeait de coller un
// ipHash SHA-256 (64 hex) — un dirigeant non-technicien ne peut jamais produire
// cette valeur. `forgetIpAction` ci-dessous accepte une ADRESSE IP en clair et
// calcule le hash côté serveur via `hashImageBankIp` (même fonction que celle
// qui peuple `ImageUsageLog.ipHash`/`ImageDownloadLog.ipHash`, extraite de
// `telecharger/route.ts`). `forgetIpHashAction` (legacy, hash déjà connu) reste
// intacte pour ne pas casser sa couverture de test — les deux délèguent à la
// même suppression transactionnelle (`deleteImageBankIpTraces`).

import { revalidateTag } from "next/cache";
import { z } from "zod";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hashImageBankIp } from "@/server/image-bank/utils/ip-hash";

export type ForgetIpHashResult =
  | { success: true; deleted: { usageLogs: number; downloadLogs: number } }
  | { success: false; error: string };

/** Transaction de suppression partagée par les deux actions ci-dessous. */
async function deleteImageBankIpTraces(
  ipHash: string,
  adminUserId: string | null,
): Promise<ForgetIpHashResult> {
  try {
    const [usage, download] = await prisma.$transaction([
      prisma.imageUsageLog.deleteMany({ where: { ipHash } }),
      prisma.imageDownloadLog.deleteMany({ where: { ipHash } }),
    ]);

    await prisma.activityLog.create({
      data: {
        adminUserId,
        action: "rgpd.image_bank.forget_ip_hash",
        targetType: "ipHash",
        changes: {
          ipHash,
          deleted: {
            usageLogs: usage.count,
            downloadLogs: download.count,
          },
          art: "17",
        },
      },
    });

    revalidateTag("image-bank", "default");

    return {
      success: true,
      deleted: {
        usageLogs: usage.count,
        downloadLogs: download.count,
      },
    };
  } catch (err) {
    console.error("[forgetIpHashAction]", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "unknown",
    };
  }
}

const ForgetIpHashSchema = z.object({
  ipHash: z.string().regex(/^[a-f0-9]{64}$/i, "ipHash doit être un SHA-256 hex 64 chars"),
});

/** Legacy — accepte directement un ipHash déjà calculé. Conservée telle quelle
 * (couverture de test existante) ; l'UI RGPD n'appelle plus que `forgetIpAction`. */
export async function forgetIpHashAction(formData: FormData): Promise<ForgetIpHashResult> {
  const session = await auth();
  if (
    !session?.user?.role ||
    (session.user.role !== "admin" && session.user.role !== "super_admin")
  ) {
    return { success: false, error: "forbidden" };
  }

  const parsed = ForgetIpHashSchema.safeParse({
    ipHash: formData.get("ipHash"),
  });
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message ?? "invalid input",
    };
  }

  return deleteImageBankIpTraces(parsed.data.ipHash, session.user.id ?? null);
}

const ForgetIpSchema = z.object({
  ip: z.string().ip({ message: "Adresse IP invalide (IPv4 ou IPv6)." }),
});

/** UI RGPD — accepte une adresse IP en clair, hache côté serveur puis délègue
 * à la même suppression transactionnelle. C'est l'action que « Demandes
 * d'effacement (RGPD) » appelle désormais : un dirigeant colle l'IP que le
 * demandeur lui a communiquée, jamais un hash. */
export async function forgetIpAction(formData: FormData): Promise<ForgetIpHashResult> {
  const session = await auth();
  if (
    !session?.user?.role ||
    (session.user.role !== "admin" && session.user.role !== "super_admin")
  ) {
    return { success: false, error: "forbidden" };
  }

  const parsed = ForgetIpSchema.safeParse({ ip: formData.get("ip") });
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message ?? "invalid input",
    };
  }

  const ipHash = hashImageBankIp(parsed.data.ip);
  return deleteImageBankIpTraces(ipHash, session.user.id ?? null);
}
