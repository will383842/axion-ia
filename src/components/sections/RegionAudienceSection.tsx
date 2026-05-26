// Server component — section « Nous accompagnons toutes les tailles » pour
// la page hub région (Will 2026-05-26). Pattern dérivé du home audience
// (cf. `[locale]/page.tsx` Audience section) mais avec :
//   - H2 régionalisé (« en {region} »)
//   - Paragraphe lead hand-crafted par région (`region.audienceLocalFr`)
//   - 4 cards TPE/PME/ETI/Grandes réutilisées via i18n home (clés audience{N}{Title,Lead,Detail})
//
// Anti-duplicate-content : chaque région a un paragraphe lead unique
// mentionnant son tissu B2B local (cf. regions.ts champs `audienceLocalFr`).

import { getTranslations } from "next-intl/server";

import { Container } from "@/components/layout/Container";
import { FadeInOnView } from "@/components/motion/FadeInOnView";
import type { Region } from "@/content/regions";

interface RegionAudienceSectionProps {
  region: Region;
  isFr: boolean;
}

export async function RegionAudienceSection({ region, isFr }: RegionAudienceSectionProps) {
  const t = await getTranslations("home");

  const segments = [
    { title: t("audience1Title"), lead: t("audience1Lead"), detail: t("audience1Detail") },
    { title: t("audience2Title"), lead: t("audience2Lead"), detail: t("audience2Detail") },
    { title: t("audience3Title"), lead: t("audience3Lead"), detail: t("audience3Detail") },
    { title: t("audience4Title"), lead: t("audience4Lead"), detail: t("audience4Detail") },
  ] as const;

  return (
    <section aria-labelledby="region-audience-heading" className="bg-bg py-20 sm:py-24 lg:py-28">
      <Container>
        <FadeInOnView>
          <div className="mb-12 max-w-3xl">
            <p className="text-fg-muted mb-5 text-[13px] font-medium tracking-[0.16em] uppercase">
              <span
                aria-hidden="true"
                className="bg-terracotta mr-3 inline-block h-1.5 w-1.5 rounded-full align-middle"
              />
              {isFr ? "Pour qui" : "For whom"}
            </p>
            <h2
              id="region-audience-heading"
              className="text-fg text-[clamp(2.25rem,4.5vw,4rem)] leading-[1.04] font-semibold tracking-tight"
            >
              {isFr
                ? "Nous accompagnons toutes les tailles d'entreprise"
                : "We support every business size"}{" "}
              <span
                className="italic-editorial text-terracotta"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                {isFr ? `en ${region.nameFr}` : `in ${region.nameEn ?? region.nameFr}`}
              </span>
              .
            </h2>
            <p className="text-fg-soft mt-6 max-w-3xl text-lg leading-relaxed">
              {isFr ? region.audienceLocalFr : (region.audienceLocalEn ?? region.audienceLocalFr)}
            </p>
          </div>
        </FadeInOnView>
        <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {segments.map((seg, idx) => (
            <li
              key={idx}
              className="bg-paper border-border hover:border-border-strong flex h-full flex-col gap-4 rounded-2xl border p-7 transition"
            >
              <FadeInOnView delay={idx * 70}>
                <h3 className="text-fg text-xl leading-tight font-semibold tracking-tight">
                  {seg.title}
                </h3>
                <p
                  className="text-terracotta text-base leading-snug italic"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  {seg.lead}
                </p>
                <p className="text-fg-soft text-sm leading-relaxed">{seg.detail}</p>
              </FadeInOnView>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
