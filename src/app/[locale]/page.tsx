import { setRequestLocale, getTranslations } from "next-intl/server";
import { Container } from "@/components/layout/Container";
import { Eyebrow } from "@/components/typography/Eyebrow";
import { Link } from "@/i18n/navigation";

// Sprint 5 ships the conversion-grade home. This is a Sprint 2 placeholder
// that exercises i18n + layout + nav.
interface HomeProps {
  params: Promise<{ locale: string }>;
}

export default async function Home({ params }: HomeProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("home");

  return (
    <Container className="py-16 sm:py-20 lg:py-28">
      <Eyebrow variant="primary">Sprint 2 · {locale.toUpperCase()} · i18n + nav live</Eyebrow>
      <h1 className="mt-4 text-[clamp(2.5rem,6vw,5rem)] leading-[1.04] font-semibold tracking-tight">
        {t("title")}
      </h1>
      <p className="text-fg mt-4 max-w-xl text-lg leading-relaxed">{t("subtitle")}</p>
      <p className="mt-2 max-w-xl text-base leading-relaxed text-gray-700">{t("description")}</p>
      <div className="mt-10 flex flex-wrap gap-3">
        <Link
          href="/design"
          className="bg-primary text-primary-fg cta-translate inline-flex items-center gap-2 rounded-sm px-5 py-3 text-base font-medium"
        >
          {t("viewDesign")} →
        </Link>
      </div>
    </Container>
  );
}
