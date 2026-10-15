/**
 * Console — un écran du chantier « formateurs freelance » encore éteint (V2-N-16).
 *
 * « Cet écran n'est pas encore ouvert. » seul ne disait ni POURQUOI ni COMMENT l'ouvrir.
 * L'écran nomme désormais l'interrupteur qui l'allume, et mène à l'écran Interrupteurs.
 * Il n'allume rien : le geste reste celui de l'écran Interrupteurs, avec ses préalables.
 */

import Link from "next/link";

import { AdminCard } from "@/components/admin/ui/AdminCard";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";

export interface EcranPasEncoreOuvertProps {
  readonly titre: string;
  /** Les libellés des interrupteurs, tels que l'écran Interrupteurs les affiche. */
  readonly interrupteurs: readonly string[];
  /** `tous` : il faut chacun d'eux ; `un` : l'un d'eux suffit. */
  readonly faut?: "tous" | "un";
  /** `/<locale>/<adminPrefix>` */
  readonly base: string;
}

function enumerer(libelles: readonly string[], conjonction: string): string {
  const cites = libelles.map((l) => `« ${l} »`);
  return cites.length <= 1
    ? (cites[0] ?? "")
    : `${cites.slice(0, -1).join(", ")} ${conjonction} ${cites.at(-1)}`;
}

export function EcranPasEncoreOuvert({
  titre,
  interrupteurs,
  faut = "tous",
  base,
}: EcranPasEncoreOuvertProps) {
  const pluriel = interrupteurs.length > 1;
  const quoi =
    faut === "un" && pluriel
      ? `l'un des interrupteurs ${enumerer(interrupteurs, "ou")}`
      : `${pluriel ? "les interrupteurs" : "l'interrupteur"} ${enumerer(interrupteurs, "et")}`;
  return (
    <AdminPageShell>
      <AdminPageHeader title={titre} />
      <AdminCard>
        <p>Cet écran n&apos;est pas encore ouvert.</p>
        <p className="admin-meta-small">
          Il s&apos;allume avec {quoi}, dans{" "}
          <Link href={`${base}/qualiopi/formateurs/interrupteurs`}>l&apos;écran Interrupteurs</Link>
          .
        </p>
      </AdminCard>
    </AdminPageShell>
  );
}
