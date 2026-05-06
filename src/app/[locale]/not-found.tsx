import { getTranslations } from "next-intl/server";
import { Container } from "@/components/layout/Container";
import { Link } from "@/i18n/navigation";

export default async function LocaleNotFound() {
  const t = await getTranslations("errors");
  return (
    <Container className="flex min-h-[60vh] flex-col justify-center py-16">
      <p className="text-primary text-sm font-semibold tracking-wide uppercase">404</p>
      <h1 className="mt-2 text-[clamp(2rem,5vw,3.5rem)] leading-[1.1] font-semibold tracking-tight">
        {t("notFoundTitle")}
      </h1>
      <p className="mt-4 max-w-xl text-base text-gray-700">{t("notFoundBody")}</p>
      <div className="mt-8">
        <Link
          href="/"
          className="bg-primary text-primary-fg cta-translate inline-flex items-center gap-2 rounded-sm px-5 py-3 text-base font-medium"
        >
          {t("notFoundCta")} →
        </Link>
      </div>
    </Container>
  );
}
