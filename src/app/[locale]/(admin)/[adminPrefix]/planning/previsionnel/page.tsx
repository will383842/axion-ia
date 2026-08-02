// Planning unifié — vue « PRÉVISIONNEL FINANCIER ».
//
// Répond à « combien vais-je encaisser, et QUAND ? » sur une fenêtre de N mois à
// partir de janvier de l'année choisie. Chaque ligne = un mois, cinq colonnes :
//   CA planifié · CA réalisé · encaissements attendus · reste à facturer · impayés.
// Une ligne de totaux clôt le tableau.
//
// 0 JS client : navigation annuelle et réglage de l'horizon par querystring
// (liens + formulaire GET natif). Aucune lib → respecte le budget Web Vitals.

import Link from "next/link";
import { getPrevisionnel } from "@/server/qualiopi/previsionnel/queries";
import { ligneVide, totaux, type LignePrevisionnel } from "@/server/qualiopi/previsionnel/calcul";
import { AdminPageHeader, AdminButton } from "@/components/admin/ui";
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

/** Formatage euros — division par 100 ICI seulement (après agrégation centimes). */
const EUR = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
function euros(cents: number): string {
  return EUR.format(cents / 100);
}

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

function parseYear(v: string | undefined, fallback: number): number {
  const n = v !== undefined ? Number.parseInt(v, 10) : NaN;
  return Number.isInteger(n) && n >= 2000 && n <= 2100 ? n : fallback;
}

/** Horizon en mois : entre 1 et 24, défaut 12 (année pleine). */
function parseNbMois(v: string | undefined, fallback: number): number {
  const n = v !== undefined ? Number.parseInt(v, 10) : NaN;
  return Number.isInteger(n) && n >= 1 && n <= 24 ? n : fallback;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Suite des clés mois « YYYY-MM » de la fenêtre, à partir de janvier `annee`. */
function moisFenetre(annee: number, nbMois: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < nbMois; i += 1) {
    const d = new Date(Date.UTC(annee, i, 1));
    out.push(`${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}`);
  }
  return out;
}

/** Libellé « juillet 2026 » à partir d'une clé « YYYY-MM ». */
function libelleMois(mois: string): string {
  const [y, m] = mois.split("-").map((s) => Number.parseInt(s, 10));
  const idx = (m ?? 1) - 1;
  return `${MONTHS[idx] ?? mois} ${y ?? ""}`.trim();
}

/** Cellule montant : alignée à droite, tabulaire ; ton discret si 0. */
function Montant({
  cents,
  alerte = false,
}: {
  cents: number;
  alerte?: boolean;
}): React.ReactElement {
  const muted = cents === 0;
  return (
    <td
      className={`py-[var(--space-admin-3)] pr-[var(--space-admin-4)] text-right tabular-nums ${
        alerte && cents > 0 ? "font-semibold text-[color:var(--color-admin-destructive)]" : ""
      } ${muted ? "text-[color:var(--color-admin-fg-muted)]" : ""}`.trim()}
    >
      {euros(cents)}
    </td>
  );
}

export default async function PlanningPrevisionnelPage({
  params,
  searchParams,
}: PageProps): Promise<React.ReactElement> {
  const { adminPrefix } = await params;
  const sp = await searchParams;

  const now = new Date();
  const year = parseYear(sp["year"], now.getFullYear());
  const nbMois = parseNbMois(sp["nbMois"], 12);

  const lignesTrouvees = await getPrevisionnel(year, nbMois, now);

  // La page décide des mois à afficher : on complète les mois sans donnée par une
  // ligne à zéro pour un tableau régulier (12 lignes pour une année pleine).
  const parMois = new Map<string, LignePrevisionnel>(lignesTrouvees.map((l) => [l.mois, l]));
  const lignes = moisFenetre(year, nbMois).map((m) => parMois.get(m) ?? ligneVide(m));
  const t = totaux(lignes);

  const base = `/fr/${adminPrefix}/planning/previsionnel`;
  // On conserve l'horizon choisi lors de la navigation annuelle.
  const nbMoisQs = nbMois !== 12 ? `&nbMois=${nbMois}` : "";
  const prev = year - 1;
  const next = year + 1;

  return (
    <>
      <AdminPageHeader
        title="Prévisionnel financier"
        description={`${year} · ${nbMois} mois · encaissements attendus ${euros(
          t.encaissementsAttendusCents,
        )} · impayés ${euros(t.impayesCents)}`}
      />

      <div className="mb-[var(--space-admin-4)] flex flex-wrap items-center gap-2">
        <AdminButton
          href={`${base}?year=${prev}${nbMoisQs}`}
          variant="ghost"
          size="sm"
          icon={ArrowLeft}
        >
          {prev}
        </AdminButton>
        <AdminButton href={base} variant="ghost" size="sm">
          Cette année
        </AdminButton>
        <AdminButton
          href={`${base}?year=${next}${nbMoisQs}`}
          variant="ghost"
          size="sm"
          iconAfter={ArrowRight}
        >
          {next}
        </AdminButton>
      </div>

      {/* Réglage de l'horizon — formulaire GET natif, zéro JS client. */}
      <form
        method="get"
        action={base}
        className="mb-[var(--space-admin-5)] flex flex-wrap items-end gap-2"
      >
        <input type="hidden" name="year" value={year} />
        <label className="flex flex-col gap-1 text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
          Horizon (nombre de mois)
          <input
            type="number"
            name="nbMois"
            min={1}
            max={24}
            defaultValue={nbMois}
            className="admin-input admin-input-w-md"
            aria-label="Nombre de mois affichés"
          />
        </label>
        <button type="submit" className="admin-button">
          Appliquer
        </button>
        {nbMois !== 12 && (
          <Link href={`${base}?year=${year}`} className="admin-button-ghost">
            Défaut (12 mois)
          </Link>
        )}
      </form>

      <div className="admin-card overflow-x-auto">
        <table className="w-full border-collapse text-[length:var(--text-admin-sm)]">
          <thead>
            <tr className="text-left text-[color:var(--color-admin-fg-muted)]">
              <th className="pr-[var(--space-admin-4)] pb-[var(--space-admin-2)] font-medium">
                Mois
              </th>
              <th className="pr-[var(--space-admin-4)] pb-[var(--space-admin-2)] text-right font-medium">
                CA planifié
              </th>
              <th className="pr-[var(--space-admin-4)] pb-[var(--space-admin-2)] text-right font-medium">
                CA réalisé
              </th>
              <th className="pr-[var(--space-admin-4)] pb-[var(--space-admin-2)] text-right font-medium">
                Encaissements attendus
              </th>
              <th className="pr-[var(--space-admin-4)] pb-[var(--space-admin-2)] text-right font-medium">
                Reste à facturer
              </th>
              <th className="pb-[var(--space-admin-2)] text-right font-medium">Impayés</th>
            </tr>
          </thead>
          <tbody>
            {lignes.map((l) => (
              <tr key={l.mois} className="border-t border-[color:var(--color-admin-border)]">
                <td className="py-[var(--space-admin-3)] pr-[var(--space-admin-4)] font-medium whitespace-nowrap">
                  {libelleMois(l.mois)}
                </td>
                <Montant cents={l.caPlanifieCents} />
                <Montant cents={l.caRealiseCents} />
                <Montant cents={l.encaissementsAttendusCents} />
                <Montant cents={l.resteAFacturerCents} />
                <Montant cents={l.impayesCents} alerte />
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-[color:var(--color-admin-border)] font-semibold">
              <td className="py-[var(--space-admin-3)] pr-[var(--space-admin-4)]">Total</td>
              <Montant cents={t.caPlanifieCents} />
              <Montant cents={t.caRealiseCents} />
              <Montant cents={t.encaissementsAttendusCents} />
              <Montant cents={t.resteAFacturerCents} />
              <Montant cents={t.impayesCents} alerte />
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="admin-meta mt-[var(--space-admin-4)]">
        Montants HT. Le <strong>CA planifié</strong> agrège les sessions planifiées et en cours (par
        date de début) ; le <strong>CA réalisé</strong>, les sessions réalisées. Les
        <strong> encaissements attendus</strong> rangent les factures émises non payées au mois de
        leur échéance. Le <strong>reste à facturer</strong> = sessions réalisées sans facture émise
        ni payée. Les <strong>impayés</strong> (sous-ensemble des encaissements attendus) sont les
        factures émises dont l&apos;échéance est déjà passée. Les sessions annulées ou reportées
        comptent 0.
      </p>
    </>
  );
}
