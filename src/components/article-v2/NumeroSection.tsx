/** Numéro décoratif d'une section (`aria-hidden`) : le titre porte le sens, pas le numéro. */
export function NumeroSection({ numero }: { readonly numero: number }) {
  return (
    <span className="numero-section" aria-hidden="true">
      {String(numero).padStart(2, "0")}
    </span>
  );
}
