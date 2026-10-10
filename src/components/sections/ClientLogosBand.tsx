// Server component — bandeau logos clients réutilisable (home, régions, villes).
// Wrapper léger autour de `LogosMarquee` + section frame. Pas de copy editorial
// (eyebrow/title) volontaire : juste les logos clients pour une preuve sociale silencieuse.

import { Container } from "@/components/layout/Container";
import { LogosMarquee } from "@/components/home/LogosMarquee";
import { CLIENT_LOGOS } from "@/content/home-data";
import { LOGOS_CLIENTS_AFFICHES } from "@/content/preuves-sociales";

interface ClientLogosBandProps {
  isFr: boolean;
}

export function ClientLogosBand({ isFr }: ClientLogosBandProps) {
  // Interrupteur unique (src/content/preuves-sociales.ts) — éteint le 2026-10-09.
  if (!LOGOS_CLIENTS_AFFICHES || CLIENT_LOGOS.length === 0) return null;

  return (
    <section
      aria-label={isFr ? "Nos clients" : "Our clients"}
      className="bg-bg border-border border-t border-b py-12 sm:py-16"
    >
      <Container>
        <LogosMarquee logos={CLIENT_LOGOS} />
      </Container>
    </section>
  );
}
