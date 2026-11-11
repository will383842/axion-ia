// Bloc « Le point de départ que nous recommandons : La Journée IA » — posé en
// tête des pages qui se concurrençaient avec la landing `/journee-ia` (audit
// SEO/GEO du 11/11/2026). Composant serveur, sans JavaScript client, sans
// image : rien qui pèse sur le LCP ni sur le CLS.
//
// Tout le texte vient de `@/content/renvoi-journee-ia` (prix lu dans
// `pricing.ts`, garantie mot pour mot depuis `journee-ia-commun.ts`).

import { ArrowRight } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { Cta } from "@/components/marketing/Cta";
import {
  ANCRE_JOURNEE_IA,
  CHEMIN_JOURNEE_IA,
  CONDITION_RENVOI,
  DEROULE_JOURNEE_IA,
  GARANTIE_RENVOI,
  LIBELLE_RENDEZ_VOUS_RENVOI,
  RAPPORT_JOURNEE_IA,
  SURTITRE_RENVOI,
  TITRE_RENVOI,
  lienRendezVousJourneeIa,
  phrasePrixJourneeIa,
} from "@/content/renvoi-journee-ia";

interface Props {
  /** Emplacement mesuré du bouton de rendez-vous (`?depuis=`). */
  depuis: string;
  /** Une phrase propre à la page (ex. : ce qui, sur cette page, est sur devis écrit). */
  precision?: string;
}

export function RenvoiJourneeIa({ depuis, precision }: Props) {
  const idTitre = `renvoi-journee-ia-${depuis}`;
  return (
    <section aria-labelledby={idTitre} className="bg-canvas border-border border-b py-8 sm:py-10">
      <Container>
        <div className="border-terracotta/40 bg-paper rounded-2xl border-2 p-6 sm:p-8">
          <p className="text-terracotta-deep text-[13px] font-semibold tracking-[0.12em] uppercase">
            {SURTITRE_RENVOI}
          </p>
          <h2 id={idTitre} className="text-fg mt-2 text-2xl leading-tight font-semibold">
            {TITRE_RENVOI}
          </h2>
          <p className="text-fg-soft mt-3 max-w-3xl text-base leading-relaxed">
            {DEROULE_JOURNEE_IA} {phrasePrixJourneeIa()} {RAPPORT_JOURNEE_IA}
          </p>
          <p className="text-fg-soft mt-3 max-w-3xl text-sm leading-relaxed">
            {GARANTIE_RENVOI} {CONDITION_RENVOI}
          </p>
          {precision ? (
            <p className="text-fg-muted mt-3 max-w-3xl text-sm leading-relaxed">{precision}</p>
          ) : null}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Cta
              href={CHEMIN_JOURNEE_IA}
              variant="primary"
              shape="pill"
              size="md"
              track={`renvoi-journee-ia-${depuis}`}
            >
              {ANCRE_JOURNEE_IA}
              <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden="true" />
            </Cta>
            <Cta
              href={lienRendezVousJourneeIa(depuis)}
              variant="secondary"
              shape="pill"
              size="md"
              track={`renvoi-rendez-vous-${depuis}`}
            >
              {LIBELLE_RENDEZ_VOUS_RENVOI}
            </Cta>
          </div>
        </div>
      </Container>
    </section>
  );
}
