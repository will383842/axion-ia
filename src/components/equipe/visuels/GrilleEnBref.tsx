import { ExternalLink } from "lucide-react";
import { FOND_ICONE, iconeDe } from "./icones";

/** Texte de l'icône sur son fond clair (paires vérifiées par contraste-gabarit.spec.ts). */
const TEXTE_ICONE: Readonly<Record<string, string>> = {
  terracotta: "terracotta-deep",
  ochre: "ochre-deep",
  sage: "sage",
  plum: "plum-deep",
  mocha: "mocha",
};

const CARTE =
  "border-border bg-paper relative min-h-[4.5rem] rounded-2xl border p-4 pl-[4.5rem] sm:p-5 sm:pl-[5rem] motion-safe:transition motion-safe:hover:-translate-y-0.5 hover:shadow-sm";

/**
 * « En bref » : la fiche d'identité reste une `dl` (extraction), mise en grille de cartes à icônes.
 * `jeton` : jeton de couleur de catégorie (ex. `terracotta`, `sage`) pour la pastille d'icône.
 */
export function GrilleEnBref({
  lignes,
  jeton,
  lien,
}: {
  lignes: ReadonlyArray<{ terme: string; valeur: string; icone?: string }>;
  jeton: string;
  lien?: { href: string; libelle: string; rel: string };
}) {
  const fond = FOND_ICONE[jeton] ?? "terracotta-soft";
  const texte = TEXTE_ICONE[jeton] ?? "terracotta-deep";
  const styleIcone = {
    backgroundColor: `var(--color-${fond})`,
    color: `var(--color-${texte})`,
  };
  return (
    <div>
      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {lignes.map((l) => {
          const Icone = iconeDe(l.icone);
          return (
            <div key={l.terme} className={CARTE}>
              <dt className="text-fg-muted text-xs font-semibold tracking-[0.12em] uppercase">
                <span
                  aria-hidden="true"
                  style={styleIcone}
                  className="absolute top-4 left-4 flex h-10 w-10 items-center justify-center rounded-xl sm:top-5 sm:left-5"
                >
                  <Icone className="h-5 w-5" focusable="false" />
                </span>
                {l.terme}
              </dt>
              <dd className="text-fg mt-1 text-base leading-snug font-semibold">{l.valeur}</dd>
            </div>
          );
        })}
      </dl>
      {lien ? (
        <p className="mt-4">
          <a
            href={lien.href}
            rel={lien.rel}
            target="_blank"
            className="text-terracotta focus-visible:outline-terracotta inline-flex min-h-11 items-center gap-2 text-base font-semibold underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            {lien.libelle}
            <ExternalLink aria-hidden="true" focusable="false" className="h-4 w-4" />
            <span className="sr-only"> (nouvel onglet)</span>
          </a>
        </p>
      ) : null}
    </div>
  );
}
