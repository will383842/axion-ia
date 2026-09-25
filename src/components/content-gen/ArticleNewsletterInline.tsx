import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { NewsletterForm } from "@/components/forms/NewsletterForm";
import type { Locale } from "@/i18n/routing";
import { GUIDE_IA_PAGES } from "@/content/guide-ia";
import { libellesFormulaireGuide, type SourceGuide } from "@/content/guide-ia-formulaire";

interface ArticleNewsletterInlineProps {
  readonly locale: Locale;
  /** Gabarit qui monte l'encart — la provenance enregistrée avec la demande. */
  readonly source: Extract<SourceGuide, `${string}-fin-article`>;
}

/**
 * Encart de fin d'article (refonte templates 2026-06-22, contrat changé au lot
 * L2 le 2026-09-24).
 *
 * 🔴 Lot L2 — l'encart ENVOIE DÉSORMAIS LE GUIDE. Il n'offrait que la lettre, et
 * affichait « Inscription confirmée — à bientôt. » avant toute confirmation. Il
 * partage maintenant le formulaire de la page du guide : l'adresse suffit pour
 * recevoir le guide par e-mail ; la lettre suit la nature de l'adresse
 * (amendement de Will du 24/09, voir `NewsletterForm.tsx`).
 * Le formulaire est un îlot client déjà présent sur la page du guide ; bloc
 * serveur, hauteur réservée (CLS = 0).
 *
 * ⛔ Textes PUBLICS : validés par Will avant mise en ligne (capture sur un article).
 */
export function ArticleNewsletterInline({ locale, source }: ArticleNewsletterInlineProps) {
  const isFr = locale === "fr";
  return (
    <Section spacing="compact">
      <Container className="max-w-3xl">
        <aside
          data-aeo="newsletter"
          className="bg-halo-warm border-border rounded-xl border p-6"
          aria-label={isFr ? "Recevoir le guide IA entreprise" : "Get the enterprise AI guide"}
        >
          <p className="text-fg text-lg font-semibold">
            {isFr
              ? `Le guide IA entreprise, ${GUIDE_IA_PAGES} pages, gratuit`
              : `The enterprise AI guide, ${GUIDE_IA_PAGES} pages, free`}
          </p>
          <p className="text-fg-soft mt-1 text-sm leading-relaxed">
            {isFr
              ? "Usages concrets, coûts réels, retour sur investissement et écueils à éviter. Envoyé tout de suite par e-mail."
              : "Concrete uses, real costs, return on investment and pitfalls to avoid. Sent to you straight away by email."}
          </p>
          <div className="mt-4">
            <NewsletterForm
              variant="inline"
              source={source}
              libelles={libellesFormulaireGuide("article", locale === "en" ? "en" : "fr")}
            />
          </div>
        </aside>
      </Container>
    </Section>
  );
}
