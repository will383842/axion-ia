/**
 * Admin — Formateurs › Lieux à compléter (lot L15a, ADR 0066 ; W6 C4).
 *
 * Les formateurs actifs dont la commune d'exercice n'est pas connue, et le
 * rattrapage (code postal déjà saisi, sinon celui de l'adresse
 * professionnelle). Livré ÉTEINT : interrupteur `formateurs.proches_bloc`
 * absent = la page le dit et ne lit rien.
 */

import type { Metadata } from "next";
import Link from "next/link";

import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { AdminButton } from "@/components/admin/ui/AdminButton";
import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import { gardePage } from "@/server/auth/garde-page";
import { peutEngager } from "@/server/auth/habilitations";
import { rattraperLieuxFormateursFormAction } from "@/server/actions/qualiopi/formateur-lieu";
import { INTERRUPTEURS } from "@/server/qualiopi/formateurs-independants/interrupteurs";
import { envoiAllume } from "@/server/qualiopi/formateurs-independants/interrupteurs-envoi";
import { lireLieuxACompleter } from "@/server/qualiopi/formateurs-proches/lieu-formateur-service";
import { messageRetourLieu } from "@/server/qualiopi/formateurs-proches/retour-lieu";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Formateurs — Lieux à compléter | Axion-IA Admin",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function LieuxFormateursPage({ params, searchParams }: PageProps) {
  const { locale, adminPrefix } = await params;
  const acces = await gardePage("consultation", `/${locale}/${adminPrefix}/login`);
  if (!acces.autorise) {
    return <AccesRefuse motif={acces.motif} retourHref={`/${locale}/${adminPrefix}`} />;
  }
  if (!peutEngager(acces.role, "habiliter_formateur")) {
    return (
      <AccesRefuse
        motif="Cette page est réservée à la direction et à la responsable qualité."
        retourHref={`/${locale}/${adminPrefix}`}
      />
    );
  }
  const base = `/${locale}/${adminPrefix}/qualiopi/formateurs`;
  const allume = await envoiAllume("proches_bloc");
  const fiches = allume ? await lireLieuxACompleter().catch(() => null) : [];
  const message = messageRetourLieu(((await searchParams) ?? {})["lieu"]);

  return (
    <AdminPageShell>
      <AdminPageHeader
        title="Lieux d'exercice à compléter"
        description="Formateurs actifs dont la commune n'est pas connue : ils apparaissent en fin de liste dans « Formateurs proches »."
      />
      {message ? (
        <p
          role="status"
          className={`admin-alert ${message.ton === "ok" ? "admin-alert-success" : "admin-alert-warning"} mb-[var(--space-admin-5)]`}
        >
          {message.texte}
        </p>
      ) : null}
      {!allume ? (
        <p className="admin-alert admin-alert-info">
          Cet écran n&apos;est pas encore ouvert : il s&apos;allume avec l&apos;interrupteur « {INTERRUPTEURS.proches_bloc.libelle} », dans{" "}
          <Link href={`${base}/interrupteurs`}>l&apos;écran Interrupteurs</Link>.
        </p>
      ) : fiches === null ? (
        <p className="admin-alert admin-alert-warning">Liste indisponible pour le moment.</p>
      ) : (
        <>
          <form action={rattraperLieuxFormateursFormAction} className="mb-[var(--space-admin-5)]">
            <AdminButton type="submit">Retrouver les communes depuis les adresses</AdminButton>
          </form>
          {fiches.length === 0 ? (
            <p className="admin-card">
              Tous les formateurs actifs ont une commune d&apos;exercice.
            </p>
          ) : (
            <ul className="admin-card">
              {fiches.map((f) => (
                <li key={f.id} className="py-1">
                  <Link href={`${base}/${f.id}#lieu-exercice`} className="underline">
                    {f.prenom} {f.nom}
                  </Link>
                  {f.codePostalPro
                    ? ` — code postal ${f.codePostalPro}, commune à retrouver`
                    : " — lieu à compléter"}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </AdminPageShell>
  );
}
