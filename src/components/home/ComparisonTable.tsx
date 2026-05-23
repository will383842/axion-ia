import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ComparisonRow {
  /** Label de la ligne (ex: "Implémentation opérationnelle"). */
  label: string;
  /** Valeur côté Axion (mise en avant typo + couleur). */
  axion: string;
  /** Valeur côté alternative 1. */
  freelance: string;
  /** Valeur côté alternative 2. */
  cabinet: string;
  /** Valeur côté alternative 3. */
  training: string;
}

interface ComparisonTableProps {
  rows: ComparisonRow[];
  cols: {
    axion: string;
    freelance: string;
    cabinet: string;
    training: string;
  };
}

// Détecte si la valeur exprime une présence positive (oui/yes), une absence
// (non/no) ou un état neutre/qualifié → choix d'icône.
function valueGlyph(v: string): React.ReactNode {
  const norm = v.toLowerCase().trim();
  const isPositive =
    /^(oui|yes|«yes»)\b/.test(norm) || norm.startsWith("oui,") || norm.startsWith("yes,");
  const isNegative = norm === "non" || norm === "no";
  if (isPositive) {
    return <Check className="text-sage h-4 w-4 shrink-0" aria-hidden="true" />;
  }
  if (isNegative) {
    return <Minus className="text-fg-muted h-4 w-4 shrink-0" aria-hidden="true" />;
  }
  return null;
}

export function ComparisonTable({ rows, cols }: ComparisonTableProps) {
  return (
    <>
      {/* Desktop : table sémantique full-width */}
      <table className="hidden w-full border-collapse text-left text-sm lg:table">
        <caption className="sr-only">Tableau comparatif Axion-IA vs alternatives</caption>
        <thead>
          <tr className="border-border-strong border-b">
            <th
              scope="col"
              className="text-fg-muted pr-6 pb-5 text-[12px] font-semibold tracking-[0.16em] uppercase"
            >
              {/* Première colonne = labels lignes, pas de header texte */}
            </th>
            <th
              scope="col"
              className="text-fg-muted pr-6 pb-5 text-[12px] font-semibold tracking-[0.16em] uppercase"
            >
              {cols.freelance}
            </th>
            <th
              scope="col"
              className="text-fg-muted pr-6 pb-5 text-[12px] font-semibold tracking-[0.16em] uppercase"
            >
              {cols.cabinet}
            </th>
            <th
              scope="col"
              className="text-fg-muted pr-6 pb-5 text-[12px] font-semibold tracking-[0.16em] uppercase"
            >
              {cols.training}
            </th>
            <th
              scope="col"
              className="text-terracotta pr-2 pb-5 text-[12px] font-bold tracking-[0.16em] uppercase"
            >
              {cols.axion}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={idx} className="border-border border-b last:border-b-0">
              <th scope="row" className="text-fg py-5 pr-6 text-base font-medium">
                {row.label}
              </th>
              <td className="text-fg-soft py-5 pr-6">
                <span className="inline-flex items-center gap-2">
                  {valueGlyph(row.freelance)}
                  {row.freelance}
                </span>
              </td>
              <td className="text-fg-soft py-5 pr-6">
                <span className="inline-flex items-center gap-2">
                  {valueGlyph(row.cabinet)}
                  {row.cabinet}
                </span>
              </td>
              <td className="text-fg-soft py-5 pr-6">
                <span className="inline-flex items-center gap-2">
                  {valueGlyph(row.training)}
                  {row.training}
                </span>
              </td>
              <td
                className={cn(
                  "bg-terracotta-soft text-terracotta-deep py-5 pr-2 pl-4 text-base font-semibold",
                  "first:rounded-tl-xl last:rounded-tr-xl",
                )}
              >
                <span className="inline-flex items-center gap-2">
                  {valueGlyph(row.axion)}
                  {row.axion}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Mobile / tablet : 1 carte = 1 ligne du tableau, valeur Axion mise en avant */}
      <ul className="grid gap-4 lg:hidden">
        {rows.map((row, idx) => (
          <li key={idx} className="bg-paper border-border rounded-2xl border p-5">
            <p className="text-fg text-base font-semibold">{row.label}</p>
            <div className="border-border mt-4 grid grid-cols-2 gap-3 border-t pt-4 text-sm">
              <div>
                <p className="text-fg-muted text-[11px] font-semibold tracking-wider uppercase">
                  {cols.freelance}
                </p>
                <p className="text-fg-soft mt-1">{row.freelance}</p>
              </div>
              <div>
                <p className="text-fg-muted text-[11px] font-semibold tracking-wider uppercase">
                  {cols.cabinet}
                </p>
                <p className="text-fg-soft mt-1">{row.cabinet}</p>
              </div>
              <div>
                <p className="text-fg-muted text-[11px] font-semibold tracking-wider uppercase">
                  {cols.training}
                </p>
                <p className="text-fg-soft mt-1">{row.training}</p>
              </div>
              <div className="bg-terracotta-soft -m-2 rounded-lg p-2">
                <p className="text-terracotta text-[11px] font-bold tracking-wider uppercase">
                  {cols.axion}
                </p>
                <p className="text-terracotta-deep mt-1 font-semibold">{row.axion}</p>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
