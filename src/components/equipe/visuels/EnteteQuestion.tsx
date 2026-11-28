/**
 * En-tête de section : sur-titre, H2 formulé en question, réponse directe.
 * La réponse porte `data-reponse-section` (et PAS `data-answer` : seul le héros est `speakable`).
 * Le `id` fournit l'ancre ; le H2 a l'id `${id}-titre` (cible de `aria-labelledby`).
 */
export function EnteteQuestion({
  id,
  surTitre,
  question,
  reponse,
  ton = "clair",
}: {
  id: string;
  surTitre: string;
  question: string;
  reponse?: string;
  ton?: "clair" | "fonce";
}) {
  const fonce = ton === "fonce";
  return (
    <div>
      {surTitre ? (
        <p
          className={`text-xs font-semibold tracking-[0.14em] uppercase ${fonce ? "text-mocha-fg" : "text-terracotta"}`}
        >
          {surTitre}
        </p>
      ) : null}
      <h2
        id={`${id}-titre`}
        className={`${surTitre ? "mt-3" : ""} max-w-3xl font-serif text-[clamp(1.75rem,3.2vw,2.5rem)] leading-tight tracking-tight ${fonce ? "text-mocha-fg" : "text-fg"}`}
      >
        {question}
      </h2>
      {reponse ? (
        <p
          data-reponse-section=""
          className={`mt-4 max-w-3xl text-lg leading-relaxed sm:text-xl ${fonce ? "text-mocha-fg" : "text-fg-soft"}`}
        >
          {reponse}
        </p>
      ) : null}
    </div>
  );
}
