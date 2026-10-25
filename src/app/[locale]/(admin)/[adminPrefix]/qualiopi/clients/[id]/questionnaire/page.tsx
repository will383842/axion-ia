/**
 * Admin — Fiche client · « Questionnaire » : envoyer le questionnaire avant audit SANS rendez-vous
 * (décision de Will du 25/10/2026). Même carte que sur la page d'un rendez-vous, rattachée à la
 * fiche par `client_id` : on dépose le HTML, on lit l'e-mail exact, on clique « Envoyer ».
 *
 * Régime REFUS : `gardeLectureEchanges` est la PREMIÈRE instruction, avant tout accès à la base.
 * Rien ne part sans le clic de Will sur « Envoyer » (action `envoyerQuestionnaireAction`).
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import { QuestionnairePreaudit } from "@/components/admin/dossier-client/QuestionnairePreaudit";
import { gardeLectureEchanges } from "@/features/dossier-client/acces";
import { lireMessageDeRetour } from "@/features/dossier-client/message-de-retour";
import { getClient } from "@/server/qualiopi/crm/clients";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Fiche client — Questionnaire | Axion-IA Admin",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string; id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

const lienCls = "text-[color:var(--color-admin-accent)] underline-offset-2 hover:underline";

export default async function QuestionnaireDeLaFichePage({ params, searchParams }: PageProps) {
  const { locale, adminPrefix, id } = await params;
  const acces = await gardeLectureEchanges(`/${locale}/${adminPrefix}/login`);
  const ficheHref = `/${locale}/${adminPrefix}/qualiopi/clients/${id}`;
  if (!acces.autorise) return <AccesRefuse motif={acces.motif} retourHref={ficheHref} />;
  const sp = (await searchParams) ?? {};
  const erreur = lireMessageDeRetour(sp, "erreur");
  const message = lireMessageDeRetour(sp, "message");

  const client = await getClient(id);
  if (client === null) notFound();
  const texte = (v: string | string[] | undefined, max: number): string =>
    typeof v === "string" ? v.slice(0, max) : "";

  return (
    <AdminPageShell width="wide">
      <div className="mb-[var(--space-admin-4)]">
        <Link href={ficheHref} className={`text-[length:var(--text-admin-xs)] ${lienCls}`}>
          ← {client.raisonSociale}
        </Link>
      </div>
      <AdminPageHeader
        title="Questionnaire avant audit"
        description={`${client.raisonSociale} — envoi sans rendez-vous`}
      />
      {erreur !== null ? (
        <p
          role="alert"
          className="mb-[var(--space-admin-4)] rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-danger)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)]"
        >
          {erreur}
        </p>
      ) : null}
      {message !== null ? (
        <p
          role="status"
          className="mb-[var(--space-admin-4)] rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-success-fg)]"
        >
          {message}
        </p>
      ) : null}
      <QuestionnairePreaudit
        cible={{ clientId: client.id }}
        peutDeposer={acces.role === "super_admin"}
        titulaire={{ nom: client.contactNom ?? null, email: client.contactEmail ?? null }}
        societe={client.raisonSociale}
        apercu={
          texte(sp.pa_email, 200).trim() !== ""
            ? {
                email: texte(sp.pa_email, 200).trim(),
                prenom: texte(sp.pa_prenom, 60).trim(),
                date: texte(sp.pa_date, 16).trim(),
                lieu: texte(sp.pa_lieu, 80).trim(),
                objet: texte(sp.pa_objet, 200),
                message: texte(sp.pa_message, 1500),
                corps: texte(sp.pa_corps, 2500),
              }
            : null
        }
      />
    </AdminPageShell>
  );
}
