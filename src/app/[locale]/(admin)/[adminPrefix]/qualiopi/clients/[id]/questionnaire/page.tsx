/**
 * Admin — Envoyer le questionnaire à une fiche client, SANS rendez-vous (2026-10-25).
 *
 * Même carte que sur la page d'un rendez-vous (dépôt du fichier, essai, aperçu GRAND de l'e-mail
 * modifiable en entier, bouton « Envoyer ») : seul le rattachement change — le questionnaire vise
 * la fiche (`questionnaires_avant_audit.client_id`). L'envoi reste TOUJOURS un clic de Will, jamais
 * automatique. Garde de lecture AVANT toute lecture, comme la page d'un rendez-vous.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { QuestionnairePreaudit } from "@/components/admin/dossier-client/QuestionnairePreaudit";
import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { gardeLectureEchanges } from "@/features/dossier-client/acces";
import { lireMessageDeRetour } from "@/features/dossier-client/message-de-retour";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Envoyer le questionnaire | Axion-IA Admin",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string; id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EnvoyerQuestionnairePage({ params, searchParams }: PageProps) {
  const { locale, adminPrefix, id } = await params;
  // 🔴 Première instruction : la garde, AVANT toute lecture.
  const acces = await gardeLectureEchanges(`/${locale}/${adminPrefix}/login`);
  const clientsBase = `/${locale}/${adminPrefix}/qualiopi/clients`;
  if (!acces.autorise) return <AccesRefuse motif={acces.motif} retourHref={clientsBase} />;
  if (!UUID.test(id)) notFound();
  const sp = await searchParams;
  const erreur = lireMessageDeRetour(sp, "erreur");
  const message = lireMessageDeRetour(sp, "message");

  const client = await prisma.client.findUnique({
    where: { id },
    select: { id: true, raisonSociale: true, contactNom: true, contactEmail: true },
  });
  if (client === null) notFound();
  const retourFiche = `/${locale}/${adminPrefix}/qualiopi/clients/${id}`;
  const texte = (cle: string, max: number): string | undefined =>
    typeof sp[cle] === "string" ? sp[cle]!.slice(0, max) : undefined;

  return (
    <AdminPageShell width="wide">
      <div className="mb-[var(--space-admin-4)]">
        <Link
          href={retourFiche}
          className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-accent)] underline-offset-2 hover:underline"
        >
          ← {client.raisonSociale}
        </Link>
      </div>
      <AdminPageHeader title="Envoyer le questionnaire" />
      {erreur !== null ? (
        <p role="alert" className="mb-[var(--space-admin-4)] text-[color:var(--color-admin-error)]">
          {erreur}
        </p>
      ) : null}
      {message !== null ? (
        <p role="status" className="mb-[var(--space-admin-4)]">
          {message}
        </p>
      ) : null}
      <QuestionnairePreaudit
        clientId={client.id}
        peutDeposer={acces.role === "super_admin"}
        titulaire={{ nom: client.contactNom, email: client.contactEmail }}
        debutPrevu={null}
        societe={client.raisonSociale}
        apercu={
          typeof sp.pa_email === "string" && sp.pa_email.trim() !== ""
            ? {
                email: sp.pa_email.trim().slice(0, 200),
                prenom: (texte("pa_prenom", 60) ?? "").trim(),
                date: (texte("pa_date", 16) ?? "").trim(),
                lieu: (texte("pa_lieu", 80) ?? "").trim(),
                objet: texte("pa_objet", 200) ?? "",
                message: texte("pa_message", 1500) ?? "",
                corps: texte("pa_corps", 2500) ?? "",
              }
            : null
        }
      />
    </AdminPageShell>
  );
}
