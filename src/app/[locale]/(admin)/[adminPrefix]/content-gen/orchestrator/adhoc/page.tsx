import type { Metadata } from "next";
import { AdHocDispatchV2 } from "./_v2/AdHocDispatchV2";
import { gardePage } from "@/server/auth/garde-page";

export const metadata: Metadata = { robots: { index: false, follow: false } };

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
}

export default async function AdHocPage({ params }: PageProps) {
  const { adminPrefix } = await params;
  // 🔑 On appelle la garde pour son EFFET : sans session, elle redirige vers la
  // connexion. C'est ce que cette page doit garantir par elle-même — le proxy
  // ne peut pas être la seule couche (contournement du 2026-09-05).
  //
  // ⚠️ Pas de `<AccesRefuse>` ici, et ce n'est pas un oubli : en consultation,
  //    le seul refus possible est « rôle non reconnu », que le layout admin
  //    intercepte DÉJÀ avant de rendre ses enfants. La branche serait morte, et
  //    elle coûtait 1,64 kB gz au cliquet de bundle sur les 29 pages de ce lot
  //    (mesuré par Gate B) — `AccesRefuse` tire `next/link` et une icône.
  await gardePage("consultation", `/fr/${adminPrefix}/login`);

  return <AdHocDispatchV2 adminPrefix={adminPrefix} />;
}
