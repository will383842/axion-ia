// Refonte admin mai 2026 — PR 10 (ADR 0028 IMPLEMENTATION-PLAN.md).
//
// Infra V2 — AdminPageShell + AdminPageHeader + grid de cards externes.

import Link from "next/link";
import { AdminPageShell, AdminPageHeader } from "@/components/admin/ui";

type Status = "ok" | "degraded" | "down" | "not-configured" | "unknown";

interface Card {
  name: string;
  role: string;
  externalUrl: string;
  status: Status;
  detail: string | null;
  paid: string;
}

interface Props {
  adminPrefix: string;
  cards: ReadonlyArray<Card>;
}

function statusPill(status: Status) {
  const labels: Record<Status, string> = {
    ok: "● UP",
    degraded: "● Dégradé",
    down: "● DOWN",
    "not-configured": "○ Non configuré",
    unknown: "? Inconnu",
  };
  return <span className={`admin-status-pill admin-status-${status}`}>{labels[status]}</span>;
}

function CardItem({ card }: { card: Card }) {
  return (
    <a
      href={card.externalUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="admin-card admin-infra-card"
    >
      <div className="admin-infra-card-head">
        <strong>{card.name}</strong>
        {statusPill(card.status)}
      </div>
      <p className="admin-meta-block">{card.role}</p>
      {card.detail && <p className="admin-meta">{card.detail}</p>}
      <p className="admin-meta">
        <em>{card.paid}</em>
      </p>
    </a>
  );
}

export function InfraV2({ adminPrefix, cards }: Props): React.ReactElement {
  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="Infrastructure & outils"
        description="Centralise les liens vers chaque outil tiers + statut live (best-effort). Pas d'action write depuis ici — chaque card pointe vers la console externe correspondante."
        actions={
          <Link href={`/fr/${adminPrefix}`} className="admin-link">
            ← Retour au tableau de bord
          </Link>
        }
      />

      <div className="admin-kpi-grid">
        {cards.map((card) => (
          <CardItem key={card.name} card={card} />
        ))}
      </div>
    </AdminPageShell>
  );
}
