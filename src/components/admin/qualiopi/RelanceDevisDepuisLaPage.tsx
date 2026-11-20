import Link from "next/link";
import { Mail } from "lucide-react";

import { AdminButton } from "@/components/admin/ui/AdminButton";
import { preparerRelanceDevisAction } from "@/features/dossier-client/fiche/actions-relance-devis";

/**
 * « Préparer une relance » depuis la page du devis : MÊME action que la fiche client (elle gare un
 * brouillon « à valider », rien ne part). `retourDevis` ramène le résultat sur cette page.
 */
export function RelanceDevisDepuisLaPage(props: {
  clientId: string;
  devisId: string;
  emailsHref: string;
  message?: string | null;
  erreur?: string | null;
}): React.ReactElement {
  return (
    <div className="mt-[var(--space-admin-4)]">
      <form action={preparerRelanceDevisAction}>
        <input type="hidden" name="clientId" value={props.clientId} />
        <input type="hidden" name="devisId" value={props.devisId} />
        <input type="hidden" name="retourDevis" value={props.devisId} />
        <AdminButton type="submit" variant="secondary" icon={Mail}>
          Préparer une relance
        </AdminButton>
      </form>
      <p className="mt-[var(--space-admin-2)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
        La relance est préparée en brouillon : rien ne part sans votre validation.{" "}
        <Link href={props.emailsHref} className="admin-link">
          Voir les e-mails à valider
        </Link>
      </p>
      {props.message ? (
        <p role="status" className="mt-[var(--space-admin-2)] text-[length:var(--text-admin-sm)]">
          {props.message}
        </p>
      ) : null}
      {props.erreur ? (
        <p
          role="alert"
          className="mt-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-destructive-fg)]"
        >
          {props.erreur}
        </p>
      ) : null}
    </div>
  );
}
