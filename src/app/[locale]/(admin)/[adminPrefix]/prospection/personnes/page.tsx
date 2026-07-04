import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { AdminEmptyState } from "@/components/admin/ui/AdminEmptyState";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function PersonnesPage() {
  const total = await prisma.prospectionPerson.count({ where: { optOut: false } });
  return (
    <AdminPageShell>
      <AdminPageHeader
        title="Personnes (responsables)"
        description="Dirigeants et responsables de secteur capturés. Une même personne présente dans 2 entreprises = 2 lignes reliées par personKey (jamais fusionnées)."
      />
      <p className="admin-muted">
        {total.toLocaleString("fr-FR")} personnes en base (non opposées).
      </p>
      <AdminEmptyState
        title="Détail par personne"
        description="Accédez au détail d'une personne via /prospection/personnes/[personKey] (depuis une fiche entreprise). L'opt-out par personne y est transverse aux entreprises."
      />
    </AdminPageShell>
  );
}
