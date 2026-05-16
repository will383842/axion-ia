/**
 * Stub helper pour les sous-pages admin image-bank dont l'implémentation
 * complète arrive Sprint 2.x ou V1.5. Sert d'ancrage navigation/sidebar
 * sans bloquer le merge V1.
 */

import Link from "next/link";

export function AdminStubPage({
  title,
  description,
  back,
  sprint,
}: {
  title: string;
  description: string;
  back: string;
  sprint?: string;
}) {
  return (
    <main className="space-y-6 p-8">
      <Link href={back} className="text-fg-muted text-sm hover:underline">
        ← Retour image-bank overview
      </Link>
      <h1 className="text-3xl font-bold">{title}</h1>
      <p className="text-fg-muted">{description}</p>
      <p className="rounded border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        Cette section est prévue {sprint ?? "Sprint 2.x"}. L&apos;ancre route et la nav admin sont
        déjà câblées.
      </p>
    </main>
  );
}
