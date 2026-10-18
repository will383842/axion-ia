import { Container } from "@/components/layout/Container";

/**
 * Remplace le calendrier de l'échange formateur tant que
 * `formateurs.echange_ouvert` est éteint. Composant serveur, aucun JS client,
 * aucun lien externe ; la hauteur est réservée (CLS 0).
 */
export function EchangeFormateurFerme({ retour }: { retour: string }) {
  return (
    <div className="bg-canvas pt-6 pb-16 sm:pt-10">
      <Container>
        <div className="mx-auto flex min-h-64 max-w-xl flex-col items-center justify-center text-center">
          <h1
            className="text-fg text-[clamp(1.5rem,4vw,2rem)] leading-tight font-semibold tracking-tight"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            Les échanges avec les formateurs ne sont pas encore ouverts.
          </h1>
          <a
            href={retour}
            className="text-fg-soft hover:text-terracotta-deep mt-4 inline-flex min-h-11 items-center text-sm underline underline-offset-2"
          >
            Retour à la réservation d&apos;un appel
          </a>
        </div>
      </Container>
    </div>
  );
}
