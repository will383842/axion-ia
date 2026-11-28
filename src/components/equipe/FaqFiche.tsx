import { Plus } from "lucide-react";

export interface QuestionFaqFiche {
  id: string;
  question: string;
  answer: string;
}

/**
 * FAQ de la fiche : `details/summary`, zéro JavaScript, fermés par défaut (Google lit leur contenu).
 * Le texte de chaque réponse est celui du `FAQPage` du `@graph` (la route l'émet, ce composant
 * non). Questions en H3 ; l'`id` de la question est l'ancre du `details`. `data-faq-q` et
 * `data-faq-a` sont lus par le `speakable` du `FAQPage` ; pas de `data-answer` (réservé au héros).
 */
export function FaqFiche({ items }: { items: ReadonlyArray<QuestionFaqFiche> }) {
  if (items.length === 0) return null;
  return (
    <ul role="list" className="grid gap-3">
      {items.map((item) => (
        <li key={item.id}>
          <details id={item.id} className="group border-border bg-paper rounded-2xl border">
            <summary className="text-fg focus-visible:outline-terracotta flex min-h-11 cursor-pointer list-none items-start justify-between gap-4 rounded-2xl px-5 py-4 text-left focus-visible:outline-2 focus-visible:outline-offset-2">
              <h3 data-faq-q className="flex-1 text-base leading-snug font-semibold">
                {item.question}
              </h3>
              <Plus
                aria-hidden="true"
                focusable="false"
                className="text-terracotta mt-0.5 h-5 w-5 shrink-0 group-open:rotate-45 motion-safe:transition-transform"
              />
            </summary>
            <div className="px-5 pb-5">
              <p data-faq-a className="text-fg-soft text-base leading-relaxed">
                {item.answer}
              </p>
            </div>
          </details>
        </li>
      ))}
    </ul>
  );
}
