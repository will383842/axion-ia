// « Rendez-vous par origine » — la vue (2026-10-05).
//
// D'où viennent ceux qui réservent : un bloc « tous types » (part de chaque
// origine), un bloc par type, la semaine par semaine, et le croisement avec
// les liens des pubs (UTM). Composant SERVEUR, aucun JavaScript ajouté.

import { PastilleTypeRdv } from "@/components/admin/contacts/PastilleTypeRdv";
import {
  LIBELLE_SOURCE,
  SOURCES,
  part,
  total,
  type BilanOrigine,
  type Compteurs,
  type Origine,
} from "@/features/admin-rendezvous/origine-rendez-vous";

const carteCls =
  "rounded-[var(--radius-admin-lg)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-4)]";
const mutedCls = "text-[color:var(--color-admin-fg-muted)]";
const thCls =
  "px-[var(--space-admin-2)] py-[var(--space-admin-1)] text-right text-[length:var(--text-admin-xs)] font-medium text-[color:var(--color-admin-fg-muted)]";
const tdCls = "px-[var(--space-admin-2)] py-[var(--space-admin-1)] text-right tabular-nums";

const ORDRE: readonly Origine[] = [...SOURCES, "sans_reponse"];

/** Les origines du plus au moins cité, celles à zéro écartées. */
function classees(c: Compteurs): Array<{ o: Origine; n: number }> {
  return ORDRE.map((o) => ({ o, n: c[o] }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n);
}

/** Barres sobres : une ligne par origine, sa part et son nombre. */
function Barres({ c }: { c: Compteurs }) {
  const t = total(c);
  const lignes = classees(c);
  if (t === 0) {
    return (
      <p className={`text-[length:var(--text-admin-sm)] ${mutedCls}`}>
        Aucune réservation sur la période.
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-[var(--space-admin-2)]">
      {lignes.map(({ o, n }) => (
        <li key={o} className="text-[length:var(--text-admin-sm)]">
          <div className="flex items-baseline justify-between gap-2">
            <span className={o === "sans_reponse" || o === "autre" ? mutedCls : undefined}>
              {LIBELLE_SOURCE[o]}
            </span>
            <span className="tabular-nums">
              <strong>{n}</strong>
              <span className={mutedCls}> · {part(n, t)} %</span>
            </span>
          </div>
          <div
            aria-hidden="true"
            className="mt-1 h-1.5 rounded-full bg-[color:var(--color-admin-border)]"
          >
            <div
              className="h-1.5 rounded-full"
              style={{
                width: `${part(n, t)}%`,
                background:
                  o === "sans_reponse" || o === "autre"
                    ? "var(--color-admin-fg-muted)"
                    : "var(--color-admin-accent)",
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function jourCourt(lundi: string): string {
  const [, m, j] = lundi.split("-");
  return `${j}/${m}`;
}

function resumeOrigines(c: Compteurs): string {
  return (
    classees(c)
      .slice(0, 3)
      .map(({ o, n }) => `${LIBELLE_SOURCE[o]} ${n}`)
      .join(" · ") || "—"
  );
}

export function OrigineRendezVousVue({
  bilan,
  jours,
}: {
  bilan: BilanOrigine;
  jours: number;
}): React.ReactElement {
  const t = total(bilan.total);
  const sans = bilan.total.sans_reponse;
  const semaines = [...bilan.semaines].reverse();
  return (
    <div className="mt-[var(--space-admin-6)] flex flex-col gap-[var(--space-admin-4)]">
      <h2 className="text-[length:var(--text-admin-lg)] font-semibold">Rendez-vous par origine</h2>

      <section className={carteCls} aria-label="Tous les rendez-vous">
        <div className="mb-[var(--space-admin-3)] flex items-baseline justify-between gap-2">
          <span className="font-medium">Tous types</span>
          <span className={`text-[length:var(--text-admin-xs)] ${mutedCls}`}>
            {t} rendez-vous · {jours} jours
          </span>
        </div>
        <Barres c={bilan.total} />
        {sans > 0 ? (
          <p className={`mt-[var(--space-admin-3)] text-[length:var(--text-admin-xs)] ${mutedCls}`}>
            « Sans réponse » : réservations d&apos;avant la question obligatoire.
          </p>
        ) : null}
      </section>

      <div className="grid gap-[var(--space-admin-4)] md:grid-cols-2">
        {bilan.parType.map(({ type, compteurs }) => (
          <section key={type} className={carteCls}>
            <div className="mb-[var(--space-admin-3)] flex items-center justify-between gap-2">
              <PastilleTypeRdv type={type} />
              <span className={`text-[length:var(--text-admin-xs)] ${mutedCls}`}>
                {total(compteurs)}
              </span>
            </div>
            <Barres c={compteurs} />
          </section>
        ))}
      </div>

      <section className={carteCls} aria-label="Semaine par semaine">
        <p className="mb-[var(--space-admin-3)] font-medium">Semaine par semaine</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[28rem] text-[length:var(--text-admin-sm)]">
            <thead>
              <tr className="border-b border-[color:var(--color-admin-border)]">
                <th className={`${thCls} text-left`}>Semaine du</th>
                <th className={thCls}>Total</th>
                <th className={`${thCls} text-left`}>Origines les plus citées</th>
              </tr>
            </thead>
            <tbody>
              {semaines.map((s) => (
                <tr
                  key={s.lundi}
                  className="border-b border-[color:var(--color-admin-border)] last:border-0"
                >
                  <td className="px-[var(--space-admin-2)] py-[var(--space-admin-1)]">
                    {jourCourt(s.lundi)}
                  </td>
                  <td className={tdCls}>{total(s.compteurs)}</td>
                  <td className="px-[var(--space-admin-2)] py-[var(--space-admin-1)]">
                    {resumeOrigines(s.compteurs)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={carteCls} aria-label="Liens des publicités">
        <p className="mb-[var(--space-admin-3)] font-medium">Liens des publicités</p>
        {bilan.utm.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[32rem] text-[length:var(--text-admin-sm)]">
              <thead>
                <tr className="border-b border-[color:var(--color-admin-border)]">
                  <th className={`${thCls} text-left`}>Source</th>
                  <th className={`${thCls} text-left`}>Support</th>
                  <th className={`${thCls} text-left`}>Campagne</th>
                  <th className={thCls}>Rendez-vous</th>
                  <th className={`${thCls} text-left`}>Ce qu&apos;ils ont répondu</th>
                </tr>
              </thead>
              <tbody>
                {bilan.utm.map((u) => (
                  <tr
                    key={`${u.source}|${u.medium}|${u.campagne}`}
                    className="border-b border-[color:var(--color-admin-border)] last:border-0"
                  >
                    <td className="px-[var(--space-admin-2)] py-[var(--space-admin-1)]">
                      {u.source || "—"}
                    </td>
                    <td className="px-[var(--space-admin-2)] py-[var(--space-admin-1)]">
                      {u.medium || "—"}
                    </td>
                    <td className="px-[var(--space-admin-2)] py-[var(--space-admin-1)]">
                      {u.campagne || "—"}
                    </td>
                    <td className={tdCls}>{u.n}</td>
                    <td className="px-[var(--space-admin-2)] py-[var(--space-admin-1)]">
                      {resumeOrigines(u.origines)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className={`text-[length:var(--text-admin-sm)] ${mutedCls}`}>
            Aucune réservation avec un lien suivi sur la période.
          </p>
        )}
        <p className={`mt-[var(--space-admin-3)] text-[length:var(--text-admin-xs)] ${mutedCls}`}>
          {bilan.sansUtm} réservation{bilan.sansUtm > 1 ? "s" : ""} sans lien suivi.
        </p>
      </section>

      {bilan.annules > 0 ? (
        <p className={`text-[length:var(--text-admin-xs)] ${mutedCls}`}>
          {bilan.annules} rendez-vous annulé{bilan.annules > 1 ? "s" : ""} non compté
          {bilan.annules > 1 ? "s" : ""}.
        </p>
      ) : null}
    </div>
  );
}
