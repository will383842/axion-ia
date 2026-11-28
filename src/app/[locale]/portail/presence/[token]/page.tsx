/**
 * Portail stagiaire — confirmation de présence avant la formation (QNC NC6, P-12 étape 3).
 *
 * URL : /fr/portail/presence/{token}
 *
 * Le GET n'ÉCRIT RIEN : un antivirus de messagerie ouvre les liens des e-mails, et une réponse
 * enregistrée à l'ouverture serait une réponse que personne n'a donnée. La réponse n'est
 * enregistrée que par le POST d'un bouton (action serveur `repondrePresenceAction`).
 *
 * Logée sous `portail/` (whitelistée par `qualiopi:isolation-check`). Public, par jeton :
 * `force-dynamic` + `noindex`. Route volontairement absente de `pathnames` (le sitemap l'y
 * pousserait). Composant SERVEUR avec un `<form action>` simple, sans JS client : le poids
 * du site public ne bouge pas. FR en dur, comme le reste du portail.
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { lireEtatPresence } from "@/server/qualiopi/confirmation-presence/reponse";
import { repondrePresenceAction } from "@/server/actions/qualiopi/presence-public";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Confirmer ma présence",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ locale: string; token: string }>;
  searchParams?: Promise<{ e?: string }>;
}

function Cadre({ titre, children }: { titre: string; children?: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-md px-4 py-16">
      <h1 className="text-lg font-semibold text-gray-900">{titre}</h1>
      {children}
    </div>
  );
}

const MESSAGES_REFUS: Record<string, { titre: string; detail: string }> = {
  session_commencee: {
    titre: "La formation a commencé",
    detail:
      "Il n'est plus possible de répondre depuis ce lien. Contactez votre organisme de formation.",
  },
  inscription_sortie: {
    titre: "Ce lien n'est plus actif",
    detail: "Votre inscription ne permet plus de répondre. Contactez votre organisme de formation.",
  },
};

export default async function PresencePage({ params, searchParams }: PageProps) {
  const { token } = await params;
  const sp = searchParams === undefined ? {} : await searchParams;

  // Contrat ADR 0026 : le build SSG n'a pas de base.
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) notFound();

  const etat = await lireEtatPresence(token);
  if (!etat.ok) {
    const m = MESSAGES_REFUS[etat.raison] ?? {
      titre: "Lien invalide ou expiré",
      detail:
        "Ce lien ne permet plus de confirmer une présence. Contactez votre organisme de formation.",
    };
    return (
      <Cadre titre={m.titre}>
        <p className="mt-2 text-sm text-gray-600">{m.detail}</p>
      </Cadre>
    );
  }

  return (
    <Cadre titre="Serez-vous présent(e) ?">
      <p className="mt-2 text-sm text-gray-600">
        {etat.titreFormation} — début le {etat.dateDebutFormation}.
      </p>
      {sp.e === "trop_de_tentatives" ? (
        <p role="alert" className="mt-3 text-sm text-red-700">
          Trop de tentatives. Patientez une minute avant de réessayer.
        </p>
      ) : null}
      {sp.e === "aucune_demande" ? (
        <p role="alert" className="mt-3 text-sm text-red-700">
          Votre réponse n&apos;a pas pu être enregistrée : la demande de confirmation n&apos;est pas
          retrouvée. Réessayez dans quelques minutes, ou contactez votre organisme de formation.
        </p>
      ) : null}
      {etat.derniereReponse !== null ? (
        <p role="status" className="mt-3 text-sm font-medium text-gray-900">
          {etat.derniereReponse === "oui"
            ? "Votre réponse : vous serez présent(e). Vous pouvez la modifier ci-dessous."
            : "Votre réponse : vous ne pourrez pas venir. Vous pouvez la modifier ci-dessous."}
        </p>
      ) : null}
      <form action={repondrePresenceAction} className="mt-6 flex flex-col gap-3">
        <input type="hidden" name="token" value={token} />
        <button
          type="submit"
          name="choix"
          value="oui"
          className="rounded-md bg-gray-900 px-4 py-3 text-sm font-semibold text-white"
        >
          Je serai présent(e)
        </button>
        <button
          type="submit"
          name="choix"
          value="non"
          className="rounded-md border border-gray-300 px-4 py-3 text-sm font-semibold text-gray-900"
        >
          Je ne pourrai pas venir
        </button>
      </form>
    </Cadre>
  );
}
