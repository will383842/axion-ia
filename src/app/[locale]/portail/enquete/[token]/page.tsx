/**
 * Portail — Enquête de satisfaction ENTREPRISE (contact client).
 *
 * URL : /{locale}/portail/enquete/{token}
 *
 * ⚠️ Logée sous `portail/` comme l'émargement public : `portail/` est
 * whitelisté par `qualiopi:isolation-check`.
 *
 * Accès : public, par jeton (64 caractères, stocké en base — même modèle de
 * confiance que l'émargement). `force-dynamic` + `noindex` : une enquête
 * nominative ne se met pas en cache et ne s'indexe pas. Pas d'entrée
 * `pathnames` — `sitemap.ts` l'y pousserait.
 *
 * 🔴 Destinataire = le CONTACT CLIENT, pas le stagiaire. C'est la 2ᵉ source
 * d'appréciation que l'indicateur 30 exige ; la réponse est versée
 * automatiquement au registre (source « entreprise ») par le service.
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hacherToken } from "@/server/qualiopi/tokens/hacher-token";
import { EnqueteEntrepriseForm } from "@/components/portail/EnqueteEntrepriseForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Votre avis d'entreprise cliente",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ locale: string; token: string }>;
}

export default async function EnqueteEntreprisePage({ params }: PageProps) {
  const { token } = await params;

  // Contrat ADR 0026 : le stub du build SSG ne couvre pas ces chemins DB.
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) notFound();

  // Jeton inconnu ou d'un AUTRE type de questionnaire → 404, sans détail :
  // un jeton stagiaire ne doit jamais ouvrir le formulaire entreprise.
  const questionnaire = await prisma.questionnaire.findUnique({
    where: { tokenHash: hacherToken(token) },
    select: {
      type: true,
      reponduAt: true,
      enrollment: {
        select: {
          session: {
            select: {
              titreSession: true,
              dateFin: true,
              client: { select: { raisonSociale: true } },
            },
          },
        },
      },
    },
  });
  if (questionnaire === null || questionnaire.type !== "satisfaction_entreprise") notFound();

  const { session } = questionnaire.enrollment;
  const dejaRepondu = questionnaire.reponduAt !== null;

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-12">
      <p className="text-xs font-semibold tracking-wide text-gray-500 uppercase">
        Axion IA — démarche qualité
      </p>
      <h1 className="mt-1 text-xl font-semibold text-gray-900">
        Votre avis d&apos;entreprise cliente
      </h1>
      <p className="mt-2 text-sm text-gray-600">
        Formation <strong>{session.titreSession}</strong>
        {session.client ? (
          <>
            {" "}
            — pour <strong>{session.client.raisonSociale}</strong>
          </>
        ) : null}
        , achevée le{" "}
        {session.dateFin.toLocaleDateString("fr-FR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        })}
        .
      </p>

      <div className="mt-8">
        {dejaRepondu ? (
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-gray-900">Déjà renseignée — merci !</h2>
            <p className="mt-2 text-sm text-gray-600">
              Cette enquête a déjà reçu une réponse. Si vous souhaitez la compléter, écrivez-nous à
              contact@axion-ia.com.
            </p>
          </div>
        ) : (
          <EnqueteEntrepriseForm token={token} />
        )}
      </div>
    </div>
  );
}
