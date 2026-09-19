/**
 * Admin — Saisir un contact apporteur à la main.
 *
 * ## Le trou que cet écran bouche
 *
 * Six chemins créaient un contact, et tous les six étaient des formulaires
 * publics ou le chatbot. L'apporteur qui écrit par e-mail, celui rencontré sur
 * un salon, celui qui a répondu à notre annonce : aucun ne pouvait entrer dans
 * le système. On ne pouvait que lui envoyer un lien et espérer.
 *
 * ## Trois règles, portées par l'action serveur
 *
 * 1. **Aucun envoi automatique.** Ni confirmation, ni rappels : pour un
 *    apporteur, un rappel d'activité attendue est en outre un indice de
 *    requalification. Une seule chose peut partir, si l'administrateur coche la
 *    case : l'invitation à l'échange de 15 minutes (décision Will 2026-09-19).
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
import {
  ORIGINES_ACCORD_REQUIS,
  ORIGINES_SAISIE,
} from "@/lib/commercial-application/saisie-manuelle";
import { env } from "@/env";

// 🔴 RÉDUIT ICI, dans un composant SERVEUR. `saisie-manuelle.ts` porte le schéma
// Zod de l'écran : l'importer depuis le composant client créait une arête de
// module vers zod pour six libellés. Le parent réduit, l'île cliente reçoit une
// valeur déjà sérialisée — même motif que `FormulaireEnMasse` avec
// `STATUTS_CANDIDATURE`.
//
// ⚠️ Ce n'est PAS établi comme la cause du dépassement de `bundle:check`
// (700,49 Ko contre 700) : zod entre déjà dans le paquet du navigateur par les
// formulaires publics. Cf. le commentaire détaillé en tête de
// `FormulaireContactManuel.tsx`.
//
// 2026-09-19 — les origines MASQUÉES (adresse relevée sur l'annonce d'un tiers)
// ne sont plus proposées : l'action les refuse de toute façon.
const ORIGINES_PROPOSABLES = ORIGINES_SAISIE.filter((o) => !o.masquee).map((o) => ({
  id: o.id,
  libelle: o.libelle,
}));

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
        <FormulaireContactManuel
          lienFiche={adminPath("fr", "contacts/commercial")}
          origines={ORIGINES_PROPOSABLES}
          originesAccordRequis={ORIGINES_ACCORD_REQUIS}
          lienCalendlyParDefaut={env.CALENDLY_APPORTEUR_URL ?? ""}
        />
      </AdminCard>

      <AdminCard>
        <h2 className="admin-h2">Ce que cet écran ne fait pas</h2>
        <ul className="admin-help flex list-disc flex-col gap-1 pl-5">
          <li>
            <strong>Il n&apos;envoie aucun e-mail de lui-même.</strong> Ni confirmation, ni rappel «
            ton dossier t&apos;attend ». Seule l&apos;invitation à l&apos;échange de 15 minutes peut
            partir — et seulement si tu coches la case.
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
