import { Container } from "@/components/layout/Container";
import { Eyebrow } from "@/components/typography/Eyebrow";

// Minimal Sprint 1 home page. Sprint 2 introduces the locale-aware [locale]/
// layout and the real Header/Footer; Sprint 5 ships the conversion-grade home.
export default function Home() {
  return (
    <main id="main" className="bg-bg text-fg flex min-h-screen flex-col justify-center">
      <Container className="py-16">
        <Eyebrow variant="primary">Sprint 1 · Webflow tokens live</Eyebrow>
        <h1 className="mt-4 text-[clamp(2.5rem,6vw,5rem)] leading-[1.04] font-semibold tracking-tight">
          AxionIA
        </h1>
        <p className="mt-4 max-w-xl text-lg leading-relaxed text-gray-700">
          Cabinet IA opérationnel · interventions, audit et implémentation IA pour entreprises.
        </p>
        <p className="mt-6 max-w-xl text-sm text-gray-600">
          Sprint 1 livré — palette Webflow, Manrope, radius 4-8, 5-layer shadows, hover{" "}
          <code className="font-mono text-xs">translate-x-[6px]</code>. Voir la page de référence{" "}
          <a href="/_design" className="text-primary underline-offset-2 hover:underline">
            /_design
          </a>
          . Module-color mapping : Module 2 = orange, Module 3 = purple, Cas concrets = green.
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
          <a
            href="/_design"
            className="bg-primary text-primary-fg cta-translate inline-flex items-center gap-2 rounded-sm px-5 py-3 text-base font-medium"
          >
            Voir les tokens →
          </a>
          <a
            href="https://github.com/will383842/axion-ia"
            className="text-fg cta-translate ring-border inline-flex items-center gap-2 rounded-sm px-5 py-3 text-base font-medium ring-1"
          >
            Repo GitHub →
          </a>
        </div>
      </Container>
    </main>
  );
}
