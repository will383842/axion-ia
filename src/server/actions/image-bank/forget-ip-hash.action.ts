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

import { revalidateTag } from "next/cache";
import { z } from "zod";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const ForgetIpHashSchema = z.object({
  ipHash: z.string().regex(/^[a-f0-9]{64}$/i, "ipHash doit être un SHA-256 hex 64 chars"),
});

export type ForgetIpHashResult =
  | { success: true; deleted: { usageLogs: number; downloadLogs: number } }
  | { success: false; error: string };

export async function forgetIpHashAction(formData: FormData): Promise<ForgetIpHashResult> {
  const session = await auth();
  if (!session?.user?.role || session.user.role !== "admin") {
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

  const { ipHash } = parsed.data;

  try {
    const [usage, download] = await prisma.$transaction([
      prisma.imageUsageLog.deleteMany({ where: { ipHash } }),
      prisma.imageDownloadLog.deleteMany({ where: { ipHash } }),
    ]);

    await prisma.activityLog.create({
      data: {
        adminUserId: session.user.id ?? null,
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
