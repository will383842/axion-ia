import type { ReactNode } from "react";

interface TableauDefilantProps {
  /** Identifiant unique : porte le nom accessible du conteneur défilant. */
  readonly id: string;
  /** Légende visible (`<caption>`), déjà traduite. */
  readonly legende: string;
  /** `<thead>` / `<tbody>` (avec `scope` sur les `<th>`). */
  readonly children: ReactNode;
}

/**
 * Tableau construit par un gabarit : `display: table` conservé (sémantique),
 * conteneur défilant `role="region"` focusable au clavier et nommé par la
 * `<caption>` (RGAA 4.1 / WCAG 2.1.1). Les tableaux du corps HTML sont
 * enveloppés par la PR S3 (`envelopperTableaux`), avec le même balisage.
 */
export function TableauDefilant({ id, legende, children }: TableauDefilantProps) {
  return (
    <div className="tableau">
      <div className="tableau__defilant" role="region" tabIndex={0} aria-labelledby={id}>
        <table>
          <caption id={id}>{legende}</caption>
          {children}
        </table>
      </div>
    </div>
  );
}
