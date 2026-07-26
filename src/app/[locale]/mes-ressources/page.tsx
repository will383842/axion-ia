// KB-9 — Surface client connectée `/mes-ressources/`.
//
// V1 minimal : authentification magic-token requise (cf. Booking V1).
// Liste les entries audience='public' + 'client' publiées.
// `noindex` (privé).

import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound, redirect } from "next/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { listClientResources } from "@/lib/knowledge/client-surface";
import { getKbTypeMeta } from "@/content/knowledge/types";
import { auth } from "@/auth";

interface Props {
  params: Promise<{ locale: string }>;
}

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Mes ressources · Axion-IA",
  robots: { index: false, follow: false },
};

export default async function MesRessourcesPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  // V1 : auth via NextAuth session (admin) OU magic-token (client booking).
  // Sprint KB-17 : raffinement magic-token client-only.
  const session = await auth();
  if (!session?.user) {
    // 🔴 Audit 2026-07-25 : cette redirection pointait vers `/${locale}/connexion`,
    // une route qui N'EXISTE PAS — tout visiteur non connecté atterrissait sur un 404
    // au lieu d'un écran de connexion. Constaté en production sur les 119 routes
    // publiques auditées. La page de connexion des ressources est
    // `/espace-ressources/connexion` (cf. `src/proxy.ts`, qui protège
    // `/espace-ressources/*` en laissant passer `/connexion`).
    redirect(`/${locale}/espace-ressources/connexion?next=/${locale}/mes-ressources`);
  }

  const loc = locale as Locale;
  const isFr = loc === "fr";
  const resources = await listClientResources(loc);
  const breadcrumbItems = [
    { href: "/mes-ressources", label: isFr ? "Mes ressources" : "My resources" },
  ];

  return (
    <>
      <Container className="border-border border-b py-3">
        <Breadcrumbs items={breadcrumbItems} />
      </Container>
      <Section
        titleAs="h1"
        eyebrow={isFr ? "Espace client" : "Client area"}
        title={isFr ? "Mes" : "My"}
        titleEm={isFr ? "ressources" : "resources"}
        description={
          isFr
            ? `${resources.length} ressources réservées aux clients Axion-IA.`
            : `${resources.length} Axion-IA client resources.`
        }
      >
        <Container className="max-w-3xl">
          <ul className="divide-border border-border divide-y border-y">
            {resources.length === 0 ? (
              <li className="text-fg-soft py-8 text-center">
                {isFr ? "Aucune ressource disponible." : "No resources available."}
              </li>
            ) : (
              resources.map((r) => (
                <li key={r.entryId} className="py-4">
                  <a href={`/${locale}${r.url}`} className="group block">
                    <div className="text-fg-soft mb-1 inline-flex items-center gap-2 text-xs tracking-wide uppercase">
                      <span>{getKbTypeMeta(r.type as never).labelFr}</span>
                      {r.audience === "client" ? (
                        <span className="bg-primary/10 text-primary rounded px-1.5 py-0.5">
                          {isFr ? "Réservé client" : "Client only"}
                        </span>
                      ) : null}
                    </div>
                    <h2 className="text-fg group-hover:text-primary text-lg font-semibold">
                      {r.title}
                    </h2>
                    {r.excerpt ? (
                      <p className="text-fg-soft mt-1 line-clamp-2 text-sm">{r.excerpt}</p>
                    ) : null}
                  </a>
                </li>
              ))
            )}
          </ul>
        </Container>
      </Section>
    </>
  );
}
