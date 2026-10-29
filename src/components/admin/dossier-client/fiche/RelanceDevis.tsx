/**
 * Emplacement du lot B9 : « Préparer une relance » pour chaque devis envoyé.
 * Composant SYNCHRONE, sans lecture en base : l'existence d'un brouillon se vérifie dans l'action,
 * qui revient avec un message scellé. Le clic gare un brouillon « à valider » ; rien n'est envoyé.
 */

import Link from "next/link";
import { Mail } from "lucide-react";

import { AdminButton } from "@/components/admin/ui/AdminButton";
import { preparerRelanceDevisAction } from "@/features/dossier-client/fiche/actions-relance-devis";
import type { ContexteFiche } from "./contexte";

export function RelanceDevis(props: {
  ctx: ContexteFiche;
  devis: ReadonlyArray<{
    id: string;
    numero: string;
    statut: string;
    montantTotalHtCents: number;
    createdAt: Date;
  }>;
}): React.ReactElement | null {
  const { ctx } = props;
  const envoyes = props.devis.filter((d) => d.statut === "envoye");
  if (!ctx.voitEchanges || !ctx.peutEcrire || envoyes.length === 0) return null;

  return (
    <div className="mb-3 rounded-lg border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-surface-sunken)] p-3 text-[length:var(--text-admin-sm)]">
      <h3 className="mb-2 flex items-center gap-2 font-medium">
        <Mail className="h-4 w-4" aria-hidden="true" />
        Relancer un devis envoyé
      </h3>
      <ul className="space-y-2">
        {envoyes.map((d) => (
          <li key={d.id} className="flex flex-wrap items-center gap-3">
            <span className="font-mono">{d.numero}</span>
            <form action={preparerRelanceDevisAction}>
              <input type="hidden" name="clientId" value={ctx.clientId} />
              <input type="hidden" name="devisId" value={d.id} />
              <AdminButton type="submit" variant="secondary" size="md">
                Préparer une relance
              </AdminButton>
            </form>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
        La relance est préparée en brouillon : rien ne part sans votre validation.{" "}
        <Link href={`${ctx.qBase}/emails`} className="underline">
          Relire la relance prête
        </Link>
      </p>
    </div>
  );
}
