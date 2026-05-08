// Layout admin (Sprint 15 step 5 / M9 init).
//
// Pattern : URL secrete configurable via ADMIN_URL_PREFIX env. Le segment
// dynamique [adminPrefix] est valide runtime contre l'env — toute valeur
// differente → 404. Cela evite de hardcoder un nom de dossier sensible
// dans le repo public.
//
// Doctrine CLAUDE.md §14 : interface admin FR uniquement. Si le user
// arrive sur /en/<prefix>/* on redirige vers /fr/<prefix>/*.

import { redirect, notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";

export const dynamic = "force-dynamic";

interface AdminLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string; adminPrefix: string }>;
}

export default async function AdminLayout({ children, params }: AdminLayoutProps) {
  const { locale, adminPrefix } = await params;
  const expectedPrefix = process.env.ADMIN_URL_PREFIX ?? "admin-dev-x7k2n9";

  // 1. Valide segment URL contre env (404 silencieux sinon — pas de fingerprint)
  if (adminPrefix !== expectedPrefix) {
    notFound();
  }

  // 2. Force FR (CLAUDE.md §14 admin doctrine FR uniquement)
  if (locale !== "fr") {
    redirect(`/fr/${expectedPrefix}`);
  }

  setRequestLocale(locale as Locale);

  return (
    <div className="admin-layout">
      <header className="admin-header">
        <div className="admin-header-inner">
          <strong className="admin-brand">Axion-IA · Admin</strong>
          <span className="admin-tagline">Sprint 15 — V1 minimal · M9 console étendue à venir</span>
        </div>
      </header>
      <main className="admin-main">{children}</main>
    </div>
  );
}
