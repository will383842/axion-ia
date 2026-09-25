// Statistiques de la lettre et du guide (lot L3, 2026-09-24).
//
// Composant SERVEUR, zéro JavaScript client : des taux, une courbe mensuelle
// (SVG serveur, `BarresMensuelles`) et deux répartitions par provenance.
//
// 🔑 Chaque taux dit son dénominateur. « 12 % de désabonnement » sans « sur 25 »
// est un chiffre qui a l'air précis et ne dit rien : sur trois abonnés, un seul
// départ fait 33 %.

import { AdminCard, AdminStatCard } from "@/components/admin/ui";
import { BarresMensuelles, BarreRepartition } from "@/components/admin/ui/charts";
import { libelleSource, type StatistiquesLettre } from "@/server/newsletter/console";
import { labelMoisCle } from "../../_v2/pilotage/format";

function taux(v: number | null): string {
  return v === null ? "—" : `${v.toLocaleString("fr-FR")} %`;
}

function Repartition({
  titre,
  lignes,
}: {
  titre: string;
  lignes: ReadonlyArray<{ source: string | null; n: number }>;
}): React.ReactElement {
  const max = Math.max(0, ...lignes.map((l) => l.n));
  return (
    <div className="flex flex-col gap-[var(--space-admin-3)]">
      <h3 className="text-[length:var(--text-admin-sm)] font-semibold text-[color:var(--color-admin-fg)]">
        {titre}
      </h3>
      {lignes.length === 0 ? (
        <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
          Aucune donnée.
        </p>
      ) : (
        lignes.map((l) => (
          <BarreRepartition
            key={l.source ?? "inconnue"}
            label={libelleSource(l.source)}
            value={l.n}
            max={max}
          />
        ))
      )}
    </div>
  );
}

export function StatistiquesLettreSection({
  stats,
}: {
  stats: StatistiquesLettre;
}): React.ReactElement {
  const dernier = stats.parMois.length - 1;
  const serie = (cle: "inscriptions" | "desabonnements" | "demandesGuide") =>
    stats.parMois.map((p, i) => ({
      label: labelMoisCle(p.mois).slice(0, 1),
      value: p[cle],
      title: `${labelMoisCle(p.mois)} : ${p[cle]}`,
      courant: i === dernier,
    }));

  return (
    <section
      aria-label="Statistiques de la lettre et du guide"
      className="mb-[var(--space-admin-6)]"
    >
      <div className="mb-[var(--space-admin-5)] grid grid-cols-1 gap-[var(--space-admin-4)] sm:grid-cols-2 lg:grid-cols-4">
        <AdminStatCard
          label="Taux de désabonnement"
          value={taux(stats.tauxDesabonnement)}
          meta={`${stats.desabonnes} sur ${stats.confirmes + stats.desabonnes} abonnés confirmés un jour`}
        />
        <AdminStatCard
          label="Taux de rejet"
          value={taux(stats.tauxRejet)}
          meta={`${stats.rejetes} adresse${stats.rejetes > 1 ? "s" : ""} en rebond définitif`}
        />
        <AdminStatCard
          label="Guides envoyés"
          value={stats.demandesEnvoyees}
          meta={`sur ${stats.demandes} demande${stats.demandes > 1 ? "s" : ""}`}
        />
        <AdminStatCard
          label="Taux de clic sur le guide"
          value={taux(stats.tauxClic)}
          meta={`${stats.demandesCliquees} clic${stats.demandesCliquees > 1 ? "s" : ""} (bouton) · ${stats.demandesVues} lien${stats.demandesVues > 1 ? "s" : ""} ouvert${stats.demandesVues > 1 ? "s" : ""}`}
        />
      </div>

      <AdminCard className="mb-[var(--space-admin-5)]">
        <h2 className="mb-[var(--space-admin-4)] text-[length:var(--text-admin-lg)] font-semibold text-[color:var(--color-admin-fg)]">
          Mois par mois (12 derniers mois)
        </h2>
        <div className="grid grid-cols-1 gap-[var(--space-admin-6)] lg:grid-cols-3">
          <div>
            <p className="mb-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-soft)]">
              Inscriptions à la lettre
            </p>
            <BarresMensuelles barres={serie("inscriptions")} />
          </div>
          <div>
            <p className="mb-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-soft)]">
              Désabonnements
            </p>
            <BarresMensuelles barres={serie("desabonnements")} />
          </div>
          <div>
            <p className="mb-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-soft)]">
              Demandes du guide
            </p>
            <BarresMensuelles barres={serie("demandesGuide")} />
          </div>
        </div>
        <p className="mt-[var(--space-admin-4)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
          Un lien « ouvert » peut venir d&apos;un antivirus de messagerie ; seul le clic sur le
          bouton de la page du guide compte comme un geste humain.
        </p>
      </AdminCard>

      <AdminCard>
        <h2 className="mb-[var(--space-admin-4)] text-[length:var(--text-admin-lg)] font-semibold text-[color:var(--color-admin-fg)]">
          Par provenance
        </h2>
        <div className="grid grid-cols-1 gap-[var(--space-admin-6)] lg:grid-cols-2">
          <Repartition titre="Abonnés confirmés" lignes={stats.abonnesParSource} />
          <Repartition titre="Demandes du guide" lignes={stats.demandesParSource} />
        </div>
      </AdminCard>
    </section>
  );
}
