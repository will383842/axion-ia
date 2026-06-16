import { cn } from "@/lib/utils";

interface Option {
  readonly value: string;
  readonly label: string;
}

interface ObservatoireFiltersProps {
  /** Valeurs actuellement sélectionnées (depuis searchParams). */
  readonly current: { size: string | null; sector: string | null; region: string | null };
  readonly sizeOptions: ReadonlyArray<Option>;
  readonly sectorOptions: ReadonlyArray<Option>;
  readonly regionOptions: ReadonlyArray<Option>;
  readonly labels: {
    title: string;
    size: string;
    sector: string;
    region: string;
    all: string;
    apply: string;
    reset: string;
  };
  /** Chemin de la page (action du form GET, sans préfixe locale géré par next). */
  readonly action: string;
}

/**
 * Filtres SSR sans JS : un `<form method="get">` natif + `<select>`. La
 * soumission recharge la page avec ?size=&sector=&region= → ré-agrégation
 * runtime côté serveur. Accessible (labels liés), zéro coût First Load JS.
 */
export function ObservatoireFilters({
  current,
  sizeOptions,
  sectorOptions,
  regionOptions,
  labels,
  action,
}: ObservatoireFiltersProps) {
  const selectClass =
    "border-border bg-canvas text-fg focus:border-terracotta w-full rounded-md border px-3 py-2 text-sm";
  const field = (
    name: string,
    label: string,
    options: ReadonlyArray<Option>,
    selected: string | null,
  ) => (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={`f-${name}`} className="text-fg-soft text-xs font-medium">
        {label}
      </label>
      <select id={`f-${name}`} name={name} defaultValue={selected ?? ""} className={selectClass}>
        <option value="">{labels.all}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );

  const hasFilter = Boolean(current.size || current.sector || current.region);

  return (
    <form
      method="get"
      action={action}
      className={cn("border-border bg-paper rounded-lg border p-5")}
      aria-label={labels.title}
    >
      <p className="text-fg mb-4 text-sm font-semibold">{labels.title}</p>
      <div className="grid gap-4 sm:grid-cols-3">
        {field("size", labels.size, sizeOptions, current.size)}
        {field("sector", labels.sector, sectorOptions, current.sector)}
        {field("region", labels.region, regionOptions, current.region)}
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="submit"
          className="bg-terracotta inline-flex items-center rounded-full px-5 py-2 text-sm font-medium text-white"
        >
          {labels.apply}
        </button>
        {hasFilter ? (
          <a
            href={action}
            className="border-border text-fg-soft inline-flex items-center rounded-full border px-5 py-2 text-sm font-medium"
          >
            {labels.reset}
          </a>
        ) : null}
      </div>
    </form>
  );
}
