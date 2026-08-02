// Planning unifié — vue « CHARGE FORMATEUR ».
//
// Pour un mois donné : combien de JOURS chaque formateur est mobilisé, et son
// taux d'occupation vs une capacité cible (jours ouvrés du mois par défaut).
// Sert au pilotage : repérer les sous-charges (à remplir) et les surcharges (à
// arbitrer : report, renfort, sous-traitance).
//
// 0 JS client : navigation mensuelle et réglage de capacité par querystring
// (liens + formulaire GET natif). La barre de charge est du CSS pur (largeur en
// %). Aucune lib → respecte le budget Web Vitals de la console.

import Link from "next/link";
import { getChargeMois } from "@/features/admin-planning/charge-queries";
import {
  joursOuvresDuMois,
  niveauCharge,
  type ChargeFormateur,
  type NiveauCharge,
} from "@/features/admin-planning/charge";
import { AdminPageHeader, AdminBadge, AdminButton } from "@/components/admin/ui";
import { ArrowLeft, ArrowRight } from "lucide-react";

export const dynamic = "force-dynamic";

const MONTHS = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

function parseMonth(v: string | undefined, fallback: number): number {
  const n = v !== undefined ? Number.parseInt(v, 10) : NaN;
  return Number.isInteger(n) && n >= 1 && n <= 12 ? n : fallback;
}
function parseYear(v: string | undefined, fallback: number): number {
  const n = v !== undefined ? Number.parseInt(v, 10) : NaN;
  return Number.isInteger(n) && n >= 2000 && n <= 2100 ? n : fallback;
}

/** Capacité entre 1 et 31, sinon la valeur par défaut (jours ouvrés). */
function parseCapacite(v: string | undefined, fallback: number): number {
  const n = v !== undefined ? Number.parseInt(v, 10) : NaN;
  return Number.isInteger(n) && n >= 1 && n <= 31 ? n : fallback;
}

/** Niveau de charge → ton de badge / couleur de barre. */
const NIVEAU_TONE: Record<NiveauCharge, "success" | "warning" | "destructive"> = {
  sain: "success",
  tension: "warning",
  surcharge: "destructive",
};
const NIVEAU_LABEL: Record<NiveauCharge, string> = {
  sain: "Sain",
  tension: "Tension",
  surcharge: "Surcharge",
};
const NIVEAU_BAR_COLOR: Record<NiveauCharge, string> = {
  sain: "var(--color-admin-success)",
  tension: "var(--color-admin-warning)",
  surcharge: "var(--color-admin-destructive)",
};

/** Une ligne du tableau : nom, jours, barre de charge, badge de niveau. */
function LigneCharge({ c }: { c: ChargeFormateur }): React.ReactElement {
  const niveau = niveauCharge(c.tauxPct);
  // La barre visuelle est bornée à 100 % pour ne pas déborder de sa piste ; le
  // pourcentage chiffré (potentiellement > 100 %) reste affiché à côté.
  const largeur = Math.min(c.tauxPct, 100);
  return (
    <tr className="border-t border-[color:var(--color-admin-border)]">
      <td className="py-[var(--space-admin-3)] pr-[var(--space-admin-4)] font-medium">{c.nom}</td>
      <td className="py-[var(--space-admin-3)] pr-[var(--space-admin-4)] whitespace-nowrap text-[color:var(--color-admin-fg-muted)]">
        {c.joursMobilises} / {c.capaciteJours} j
      </td>
      <td className="w-full py-[var(--space-admin-3)] pr-[var(--space-admin-4)]">
        <div
          className="h-[10px] w-full overflow-hidden rounded-full bg-[color:var(--color-admin-surface-hover)]"
          role="img"
          aria-label={`Charge ${c.tauxPct}%`}
        >
          <div
            className="h-full rounded-full"
            style={{ width: `${largeur}%`, backgroundColor: NIVEAU_BAR_COLOR[niveau] }}
          />
        </div>
      </td>
      <td className="py-[var(--space-admin-3)] pr-[var(--space-admin-4)] text-right font-semibold tabular-nums">
        {c.tauxPct}%
      </td>
      <td className="py-[var(--space-admin-3)] text-right">
        <AdminBadge tone={NIVEAU_TONE[niveau]}>{NIVEAU_LABEL[niveau]}</AdminBadge>
      </td>
    </tr>
  );
}

export default async function PlanningChargePage({
  params,
  searchParams,
}: PageProps): Promise<React.ReactElement> {
  const { adminPrefix } = await params;
  const sp = await searchParams;

  const now = new Date();
  const year = parseYear(sp["year"], now.getFullYear());
  const month = parseMonth(sp["month"], now.getMonth() + 1);
  const capaciteDefaut = joursOuvresDuMois(year, month);
  const capacite = parseCapacite(sp["capacite"], capaciteDefaut);

  const charge = await getChargeMois(year, month, capacite);

  const base = `/fr/${adminPrefix}/planning/charge`;
  // On conserve la capacité choisie lors de la navigation mensuelle.
  const capaciteQs = capacite !== capaciteDefaut ? `&capacite=${capacite}` : "";
  const prev = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 };
  const next = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };

  // Synthèse d'en-tête : combien de formateurs en tension / surcharge.
  const enTension = charge.filter((c) => niveauCharge(c.tauxPct) === "tension").length;
  const enSurcharge = charge.filter((c) => niveauCharge(c.tauxPct) === "surcharge").length;

  return (
    <>
      <AdminPageHeader
        title="Charge formateurs"
        description={`${MONTHS[month - 1]} ${year} · capacité ${capacite} j/formateur · ${enSurcharge} en surcharge, ${enTension} en tension`}
      />

      <div className="mb-[var(--space-admin-4)] flex flex-wrap items-center gap-2">
        <AdminButton
          href={`${base}?year=${prev.y}&month=${prev.m}${capaciteQs}`}
          variant="ghost"
          size="sm"
          icon={ArrowLeft}
        >
          {MONTHS[prev.m - 1]}
        </AdminButton>
        <AdminButton href={base} variant="ghost" size="sm">
          Ce mois-ci
        </AdminButton>
        <AdminButton
          href={`${base}?year=${next.y}&month=${next.m}${capaciteQs}`}
          variant="ghost"
          size="sm"
          iconAfter={ArrowRight}
        >
          {MONTHS[next.m - 1]}
        </AdminButton>
      </div>

      {/* Réglage de la capacité cible — formulaire GET natif, zéro JS client. */}
      <form
        method="get"
        action={base}
        className="mb-[var(--space-admin-5)] flex flex-wrap items-end gap-2"
      >
        <input type="hidden" name="year" value={year} />
        <input type="hidden" name="month" value={month} />
        <label className="flex flex-col gap-1 text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
          Capacité (jours ouvrables / formateur)
          <input
            type="number"
            name="capacite"
            min={1}
            max={31}
            defaultValue={capacite}
            className="admin-input admin-input-w-md"
            aria-label="Capacité en jours ouvrables par formateur"
          />
        </label>
        <button type="submit" className="admin-button-secondary">
          Appliquer
        </button>
        {capacite !== capaciteDefaut && (
          <Link href={`${base}?year=${year}&month=${month}`} className="admin-button-ghost">
            Défaut ({capaciteDefaut} j)
          </Link>
        )}
      </form>

      <div className="admin-card overflow-x-auto">
        {charge.length === 0 ? (
          <p className="text-[color:var(--color-admin-fg-muted)]">
            Aucun formateur actif. La charge apparaîtra dès qu&apos;un formateur sera enregistré.
          </p>
        ) : (
          <table className="w-full border-collapse text-[length:var(--text-admin-sm)]">
            <thead>
              <tr className="text-left text-[color:var(--color-admin-fg-muted)]">
                <th className="pr-[var(--space-admin-4)] pb-[var(--space-admin-2)] font-medium">
                  Formateur
                </th>
                <th className="pr-[var(--space-admin-4)] pb-[var(--space-admin-2)] font-medium">
                  Jours
                </th>
                <th className="pr-[var(--space-admin-4)] pb-[var(--space-admin-2)] font-medium">
                  Charge
                </th>
                <th className="pr-[var(--space-admin-4)] pb-[var(--space-admin-2)] text-right font-medium">
                  Taux
                </th>
                <th className="pb-[var(--space-admin-2)] text-right font-medium">Niveau</th>
              </tr>
            </thead>
            <tbody>
              {charge.map((c) => (
                <LigneCharge key={c.trainerId} c={c} />
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="admin-meta mt-[var(--space-admin-4)]">
        Le taux compare les jours mobilisés (prestations planifiées, en cours ou réalisées ; les
        annulées/reportées sont exclues) à la capacité cible. Une formation multi-jours compte
        chaque jour. Seuils : &lt; 70 % sain, 70–95 % tension, &gt; 95 % surcharge.
      </p>
    </>
  );
}
