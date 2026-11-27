// Cartes de la page « Relevés » : repères de la dernière période close (lecture seule).
import { AdminStatCard } from "@/components/admin/ui";
import type { CartesStatistiques } from "@/features/apporteurs-reseau/releve-mensuel/statistiques";
import { eur, moisLisible } from "./format";

export function CartesReleves({ cartes }: { cartes: CartesStatistiques }) {
  const m = moisLisible(cartes.periode);
  const nonPrepare = cartes.source !== "releves";
  const meta = nonPrepare ? `${m} : non préparé (calcul direct, indicatif)` : m;
  return (
    <div className="grid gap-[var(--space-admin-3)] sm:grid-cols-2 lg:grid-cols-5">
      <AdminStatCard
        label="Apporteurs signés"
        value={cartes.apporteursSignes}
        meta={cartes.avecMouvement === null ? m : `${cartes.avecMouvement} avec mouvement en ${m}`}
      />
      <AdminStatCard label="Facturé HT" value={eur(cartes.facturesHtCents)} meta={meta} />
      <AdminStatCard
        label="Viré TTC"
        value={cartes.viresTtcCents === null ? "—" : eur(cartes.viresTtcCents)}
        meta={m}
      />
      <AdminStatCard
        label="En attente HT"
        value={cartes.enAttenteHtCents === null ? "—" : eur(cartes.enAttenteHtCents)}
        meta={m}
      />
      <AdminStatCard
        label="Cumul de l'année HT"
        value={cartes.cumulAnneeHtCents === null ? "—" : eur(cartes.cumulAnneeHtCents)}
        meta={m}
      />
    </div>
  );
}
