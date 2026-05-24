// Sprint v7 Phase 15 (F5) — server action wrapper pour MarkAsRealForm.
//
// Le helper de bas niveau `markAsRealTestimonial` (cf.
// `src/server/actions/content-gen/real-testimonials.ts`) prend un payload
// typé. Ici on bridge FormData → payload + on retourne un `useActionState`
// compatible state object.

"use server";

import { z } from "zod";
import { markAsRealTestimonial } from "@/server/actions/content-gen/real-testimonials";

export type MarkAsRealState = { ok: true } | { ok: false; error: string };

const FormSchema = z.object({
  testimonialId: z.string().uuid(),
  source: z.string().url().max(500),
  // input[type=date] → "YYYY-MM-DD" ; on convertit en ISO 8601 datetime UTC.
  consentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  verifiedBy: z.string().trim().min(2).max(120).optional().or(z.literal("")),
});

export async function markAsRealTestimonialFormAction(
  _prev: MarkAsRealState,
  formData: FormData,
): Promise<MarkAsRealState> {
  const parsed = FormSchema.safeParse({
    testimonialId: formData.get("testimonialId"),
    source: formData.get("source"),
    consentDate: formData.get("consentDate"),
    verifiedBy: formData.get("verifiedBy") || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Champs invalides." };
  }

  try {
    const verifiedBy =
      parsed.data.verifiedBy && parsed.data.verifiedBy.length > 0
        ? parsed.data.verifiedBy
        : undefined;
    await markAsRealTestimonial(parsed.data.testimonialId, {
      source: parsed.data.source,
      // YYYY-MM-DD → ISO 8601 (midnight UTC) pour passer le z.string().datetime()
      // côté helper bas niveau.
      consentDate: new Date(`${parsed.data.consentDate}T00:00:00.000Z`).toISOString(),
      ...(verifiedBy ? { verifiedBy } : {}),
    });
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "internal";
    if (msg === "unauthorized" || msg === "forbidden") {
      return { ok: false, error: "Permission insuffisante." };
    }
    if (msg.startsWith("rate_limited")) {
      return { ok: false, error: "Trop de requêtes — réessayez dans quelques secondes." };
    }
    if (msg === "testimonial_not_found") {
      return { ok: false, error: "Témoignage introuvable." };
    }
    return { ok: false, error: "Erreur interne." };
  }
}
