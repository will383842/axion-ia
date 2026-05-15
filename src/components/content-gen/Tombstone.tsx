/**
 * Tombstone — page "Cette ressource a été retirée" (soft-410).
 *
 * Audit indexation 2026-05-15 P0-7. Cf. `server/content-gen/tombstone.ts` pour
 * la doctrine et la limite Next 16 (status 200 + signals noindex). Le pendant
 * IndexNow ping `URL_DELETED` est envoyé côté serveur action lifecycle.
 *
 * Cible : pages `/fr/blog/[slug]` + `/fr/actualites/[slug]` quand l'Article est
 * passé en `status='archived'` ou `status='draft'` (rollback). Le rendu est
 * volontairement minimal (composants existants, zero JS supplémentaire) pour
 * ne pas dégrader le bundle First Load JS sur une page de désindexation.
 */

import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { Cta } from "@/components/marketing/Cta";

export interface TombstoneProps {
  readonly title: string;
  readonly reason: "archived" | "rolled_back";
  readonly backHref: string;
  readonly backLabel: string;
}

export function Tombstone({ title, reason, backHref, backLabel }: TombstoneProps) {
  const message =
    reason === "archived"
      ? "Cette ressource a été archivée et n'est plus disponible publiquement."
      : "Cette ressource a été retirée temporairement par notre équipe éditoriale.";
  return (
    <>
      {/* React 19 hoist auto vers <head>. Signal noindex,nofollow équivalent à
          un 410 Gone (Google déréférence en ~24h vs ~6 mois en 404 silent). */}
      <meta name="robots" content="noindex, nofollow" />
      <meta httpEquiv="X-Robots-Tag" content="noindex, nofollow" />
      <Section titleAs="h1" eyebrow="Ressource indisponible" title={title} description={message}>
        <Container className="mt-8 max-w-2xl">
          <p className="text-fg-muted text-base leading-relaxed">
            Le lien que vous avez suivi pointe vers un contenu que nous ne maintenons plus. Cette
            URL sera retirée des résultats des moteurs de recherche prochainement.
          </p>
          <div className="mt-6">
            <Cta href={backHref} size="lg">
              {backLabel} →
            </Cta>
          </div>
        </Container>
      </Section>
    </>
  );
}
