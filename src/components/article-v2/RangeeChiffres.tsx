import type { ReactNode } from "react";

interface RangeeChiffresProps {
  readonly id: string;
  readonly titre: string;
  /** Source du relevé : sans elle, aucune mention n'est rendue (jamais de source inventée). */
  readonly source?: ReactNode;
  /** Des `ChiffreCle`. */
  readonly children: ReactNode;
}

/** Rangée de chiffres sur fond mocha (`.chiffres`), serveur, sans JavaScript. */
export function RangeeChiffres({ id, titre, source, children }: RangeeChiffresProps) {
  return (
    <section className="chiffres" aria-labelledby={id}>
      <p className="chiffres__titre" id={id}>
        {titre}
      </p>
      <ul className="chiffres__liste">{children}</ul>
      {source ? <p className="source">{source}</p> : null}
    </section>
  );
}
