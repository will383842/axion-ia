import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { NewsletterForm } from "@/components/forms/NewsletterForm";
import type { Locale } from "@/i18n/routing";

interface ArticleNewsletterInlineProps {
  readonly locale: Locale;
}

/**
 * Bloc newsletter inline pour les articles (refonte templates 2026-06-22).
 * Réutilise le `NewsletterForm` existant (même action `subscribeNewsletterAction`
 * que le footer, anti-bot Turnstile + double opt-in) → aucun nouveau provider.
 * Le formulaire est un îlot client minimal déjà présent ailleurs sur le site
 * (pas de surcoût JS nouveau). Bloc serveur, hauteur réservée (CLS = 0).
 */
export function ArticleNewsletterInline({ locale }: ArticleNewsletterInlineProps) {
  const isFr = locale === "fr";
  return (
    <Section>
      <Container className="max-w-3xl">
        <aside
          data-aeo="newsletter"
          className="bg-halo-warm border-border rounded-xl border p-6"
          aria-label={isFr ? "Inscription à la lettre IA" : "Subscribe to the AI letter"}
        >
          <p className="text-fg text-lg font-semibold">
            {isFr ? "La lettre IA d'Axion-IA" : "Axion-IA's AI letter"}
          </p>
          <p className="text-fg-soft mt-1 text-sm leading-relaxed">
            {isFr
              ? "Cas concrets, méthodes et veille IA pour TPE, PME et ETI. Un e-mail utile, jamais de spam, désinscription en 1 clic."
              : "Real cases, methods and AI watch for SMEs. One useful email, no spam, one-click unsubscribe."}
          </p>
          <div className="mt-4">
            <NewsletterForm
              variant="inline"
              labels={{
                email: isFr ? "Votre e-mail professionnel" : "Your work email",
                consent: isFr
                  ? "J'accepte de recevoir la lettre IA d'Axion-IA (désinscription à tout moment)."
                  : "I agree to receive Axion-IA's AI letter (unsubscribe anytime).",
                submit: isFr ? "S'inscrire" : "Subscribe",
                sending: isFr ? "Envoi…" : "Sending…",
                success: isFr ? "Inscription confirmée — à bientôt." : "Subscribed — see you soon.",
                failure: isFr
                  ? "Une erreur est survenue. Réessayez."
                  : "Something went wrong. Try again.",
              }}
            />
          </div>
        </aside>
      </Container>
    </Section>
  );
}
