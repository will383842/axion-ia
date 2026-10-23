// Tableau de bord de pilotage — l'état du serveur (2026-10-23).
//
// Le 2026-10-10, un disque plein a mis la base du site en panne ; le
// 2026-10-23 il était de nouveau à 92 % sans que rien ne le montre. La tuile
// affiche le remplissage du disque du VPS et le dernier passage de l'élagueur
// du cache des pages (`src/server/cache/elagueur-cache-isr.ts`).
//
// Une TUILE, pas une alerte : même parti pris que « Lettre et guide ». Elle
// reste visible quand tout va bien, et le dit. L'alerte, elle, part sur
// Telegram (canal Système) au-delà de 85 %.

import { AdminCard, AdminBadge } from "@/components/admin/ui";
import { SEUIL_ALERTE_DISQUE_POURCENT, type EtatServeur } from "@/server/admin/etat-serveur";

interface Props {
  etat: EtatServeur;
}

const TON = { ok: "success", vigilance: "warning", alerte: "destructive" } as const;

const LIBELLE = {
  ok: "Place suffisante",
  vigilance: "À surveiller",
  alerte: "Disque presque plein : libérer de la place",
} as const;

function fmtHeure(iso: string): string {
  return new Date(iso).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  });
}

export function EtatServeurSection({ etat }: Props): React.ReactElement {
  const { disque, dernierElagage } = etat;
  return (
    <AdminCard className="mb-[var(--space-admin-6)]">
      <h2 className="mb-[var(--space-admin-4)] text-[length:var(--text-admin-lg)] font-semibold text-[color:var(--color-admin-fg)]">
        État du serveur
      </h2>
      {disque === null ? (
        <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
          Mesure du disque indisponible pour le moment.
        </p>
      ) : (
        <div className="flex flex-col gap-[var(--space-admin-4)]">
          <div className="flex flex-wrap items-baseline gap-[var(--space-admin-6)]">
            <div className="flex items-baseline gap-[var(--space-admin-3)]">
              <span className="text-[length:var(--text-admin-2xl)] font-semibold text-[color:var(--color-admin-fg)]">
                {disque.pourcent} %
              </span>
              <span className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
                du disque utilisé · {disque.libresGo} Go libres sur {disque.totalGo}
              </span>
            </div>
            <AdminBadge tone={TON[disque.niveau]} dot>
              {LIBELLE[disque.niveau]}
            </AdminBadge>
          </div>
          <div
            role="meter"
            aria-label="Remplissage du disque du serveur"
            aria-valuenow={disque.pourcent}
            aria-valuemin={0}
            aria-valuemax={100}
            className="h-2 w-full overflow-hidden rounded-full bg-[color:var(--color-admin-paper-alt)]"
          >
            <div
              className={
                disque.niveau === "ok"
                  ? "h-full bg-[color:var(--color-admin-success)]"
                  : disque.niveau === "vigilance"
                    ? "h-full bg-[color:var(--color-admin-warning)]"
                    : "h-full bg-[color:var(--color-admin-destructive)]"
              }
              style={{ width: `${Math.min(disque.pourcent, 100)}%` }}
            />
          </div>
          <p className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
            {dernierElagage === null
              ? "Nettoyage automatique du cache des pages : premier passage 5 minutes après la mise en ligne, puis toutes les 20 minutes."
              : `Dernier nettoyage automatique à ${fmtHeure(dernierElagage.a)} : ${
                  dernierElagage.entreesSupprimees === 0
                    ? "rien à retirer"
                    : `${dernierElagage.entreesSupprimees} pages retirées du cache (${(dernierElagage.octetsSupprimes / 1024 ** 3).toFixed(1)} Go)`
                }.`}{" "}
            Alerte Telegram au-delà de {SEUIL_ALERTE_DISQUE_POURCENT} %.
          </p>
        </div>
      )}
    </AdminCard>
  );
}
