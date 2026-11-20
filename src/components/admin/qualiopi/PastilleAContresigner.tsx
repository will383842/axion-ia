import { AdminBadge } from "@/components/admin/ui/AdminBadge";
import { estDevisAContresigner } from "@/server/qualiopi/devis/a-contresigner";

/** Pastille « À contresigner » — MÊME règle que la liste des devis (`estDevisAContresigner`). */
export function PastilleAContresigner({
  devis,
  pieces,
}: {
  devis: { statut: string; documentGenereId?: string | null };
  pieces: ReadonlySet<string>;
}): React.ReactElement | null {
  if (!estDevisAContresigner(devis, pieces)) return null;
  return (
    <AdminBadge tone="warning" dot>
      À contresigner
    </AdminBadge>
  );
}
