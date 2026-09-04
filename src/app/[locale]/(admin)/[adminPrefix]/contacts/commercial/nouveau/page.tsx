/**
 * Admin — Saisir un contact apporteur à la main.
 *
 * ## Le trou que cet écran bouche
 *
 * Six chemins créaient un contact, et tous les six étaient des formulaires
 * publics ou le chatbot. L'apporteur qui écrit par e-mail, celui rencontré sur
 * un salon, celui repéré sur un site d'annonces : aucun ne pouvait entrer dans
 * le système. On ne pouvait que lui envoyer un lien et espérer.
 *
 * ## Trois règles, portées par l'action serveur
 *
 * 1. **Aucun envoi.** Cette personne n'a rien demandé : ni confirmation, ni
 *    rappels. Pour un apporteur, un rappel d'activité attendue est en outre un
 *    indice de requalification.
 * 2. **Le consentement n'est pas simulé.** La ligne porte le fait — « aucun,
 *    contact saisi par un administrateur » — plutôt qu'un `optin` fabriqué.
 * 3. **Le doublon se traite avant l'écriture.** Après, il faudrait fusionner,
 *    et la fusion n'existe pas.
 */

import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { AdminCard } from "@/components/admin/ui/AdminCard";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { FormulaireContactManuel } from "@/components/admin/campagnes/FormulaireContactManuel";
import { adminPath } from "@/lib/admin-path";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Nouveau contact apporteur | Axion-IA Admin",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
}

export default async function NouveauContactPage({ params }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  return (
    <AdminPageShell>
      <AdminPageHeader
        title="Nouveau contact apporteur"
        description="Pour quelqu'un qui a écrit, appelé, ou qu'on a rencontré — et qui n'est passé par aucun formulaire."
      />

      <AdminCard>
        <h2 className="admin-h2">Ses coordonnées</h2>
        <p className="admin-help mb-[var(--space-admin-3)]">
          Le prénom et l&apos;e-mail suffisent. L&apos;adresse est ce qui reliera cette personne à
          ses autres traces sur le site — c&apos;est le seul champ qui compte vraiment.
        </p>
        <FormulaireContactManuel lienFiche={adminPath("fr", "contacts/commercial")} />
      </AdminCard>

      <AdminCard>
        <h2 className="admin-h2">Ce que cet écran ne fait pas</h2>
        <ul className="admin-help flex list-disc flex-col gap-1 pl-5">
          <li>
            <strong>Il n&apos;envoie aucun e-mail.</strong> Ni confirmation, ni rappel « ton dossier
            t&apos;attend ». Cette personne n&apos;a rien demandé, et lui écrire serait un message
            non sollicité.
          </li>
          <li>
            <strong>Il n&apos;invente pas de consentement.</strong> La fiche indiquera « aucun —
            contact saisi par un administrateur ». Un accord fabriqué vaudrait moins que pas
            d&apos;accord du tout.
          </li>
          <li>
            <strong>Il ne fusionne pas les doublons.</strong> Il les détecte avant d&apos;écrire et
            demande confirmation — c&apos;est le seul moment où éviter une seconde ligne ne coûte
            rien.
          </li>
        </ul>
      </AdminCard>
    </AdminPageShell>
  );
}
