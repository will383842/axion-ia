"use client";
// use-client: Next.js requires error boundaries to be Client Components.

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Container } from "@/components/layout/Container";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function LocaleError({ error, reset }: ErrorProps) {
  const t = useTranslations("errors");

  useEffect(() => {
    // Sprint 21 wires Sentry capture here. For now we log to the browser.
    console.error("[locale/error]", error);
  }, [error]);

  return (
    <Container className="flex min-h-[60vh] flex-col justify-center py-16">
      <p className="text-accent-red text-sm font-semibold tracking-wide uppercase">500</p>
      <h1 className="mt-2 text-[clamp(2rem,5vw,3.5rem)] leading-[1.1] font-semibold tracking-tight">
        {t("internalTitle")}
      </h1>
      <p className="mt-4 max-w-xl text-base text-gray-700">{t("internalBody")}</p>
      <div className="mt-8">
        <button
          type="button"
          onClick={reset}
          className="bg-primary text-primary-fg cta-translate inline-flex items-center gap-2 rounded-sm px-5 py-3 text-base font-medium"
        >
          {t("retry")} →
        </button>
      </div>
    </Container>
  );
}
