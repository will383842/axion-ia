/**
 * Portail stagiaire — Signature de la feuille d'émargement.
 *
 * URL : /{locale}/portail/emarger/{token}
 *
 * ⚠️ Logée sous `portail/` et NON sous `emargement/` : `emargement/` n'est pas
 * whitelisté par `qualiopi:isolation-check`, alors que `portail/` l'est.
 *
 * Accès : public, par jeton. `force-dynamic` + `noindex` — une feuille
 * d'émargement nominative ne doit jamais être mise en cache ni indexée. La route
 * n'est délibérément PAS déclarée dans `pathnames` : `sitemap.ts` l'y pousserait.
 *
 * Server Component. FR en dur, comme le reste du portail.
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { verifierToken } from "@/server/qualiopi/emargement/token-service";
import { lireFeuilleStagiaire } from "@/server/qualiopi/emargement/portail-queries";
import { etatsCreneaux } from "@/server/qualiopi/emargement/creneaux-signables";
import { mentionComplete } from "@/server/qualiopi/emargement/mentions";
import { getOrganismeIdentite } from "@/server/qualiopi/documents/organisme";
import { signerDepuisPortailAction } from "@/server/actions/qualiopi/emargement-public";
import { EmargementForm, type CreneauAffiche } from "@/components/portail/EmargementForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Feuille d'émargement",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ locale: string; token: string }>;
}

/** Message affiché quand le lien ne permet plus de signer. */
function LienInvalide({ titre, detail }: { titre: string; detail: string }) {
  return (
    <div className="mx-auto w-full max-w-md px-4 py-16">
      <h1 className="text-lg font-semibold text-gray-900">{titre}</h1>
      <p className="mt-2 text-sm text-gray-600">{detail}</p>
    </div>
  );
}

export default async function EmargerPage({ params }: PageProps) {
  const { token } = await params;

  // Le stub du build SSG ne couvre ni `findUniqueOrThrow` ni les chemins DB de
  // cette page : early-exit obligatoire (contrat ADR 0026).
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) notFound();

  const verif = await verifierToken(token);
  if (!verif.ok) {
    // Motifs différenciés : « votre lien a expiré » est actionnable pour le
    // stagiaire, et n'apprend rien à un attaquant — le jeton n'est pas
    // énumérable, et ces motifs ne sont atteignables qu'après validation du HMAC.
    const messages: Record<string, { titre: string; detail: string }> = {
      expire: {
        titre: "Ce lien a expiré",
        detail:
          "La période de signature de cette session est terminée. Contactez votre organisme de formation pour régulariser votre émargement.",
      },
      revoque: {
        titre: "Ce lien a été désactivé",
        detail:
          "La session a peut-être été annulée ou reportée. Contactez votre organisme de formation.",
      },
    };
    const m = messages[verif.raison] ?? {
      titre: "Lien invalide",
      detail: "Ce lien ne permet pas d'accéder à une feuille d'émargement.",
    };
    return <LienInvalide titre={m.titre} detail={m.detail} />;
  }

  if (verif.enrollmentId === null) {
    return (
      <LienInvalide
        titre="Lien invalide"
        detail="Ce lien ne correspond à aucune inscription à une formation collective."
      />
    );
  }

  const identite = await getOrganismeIdentite();
  const feuille = await lireFeuilleStagiaire(verif.enrollmentId, identite.raisonSociale);
  if (feuille === null) notFound();

  // L'instant est résolu ICI, une seule fois : deux appels à `new Date()` dans
  // le rendu pourraient tomber de part et d'autre d'une bascule de demi-journée.
  const maintenant = new Date();
  const etats = new Map(
    etatsCreneaux(feuille.creneaux, maintenant).map((e) => [
      e.id,
      e.signable ? ("signable" as const) : e.motif,
    ]),
  );

  const creneaux: CreneauAffiche[] = feuille.creneaux.map((c) => ({
    id: c.id,
    jourLisible: c.jourLisible,
    demiJourneeLisible: c.demiJourneeLisible,
    horaires: c.horaires,
    formateurNom: c.formateurNom,
    etat: etats.get(c.id) ?? "pas_encore_commence",
  }));

  // Les mentions sont construites à partir du PREMIER créneau signable : elles
  // ne varient que par la date et l'horaire, et le formulaire les réaffiche à
  // chaque ouverture. Une feuille sans créneau signable n'en a pas besoin.
  const reference = feuille.creneaux.find((c) => etats.get(c.id) === "signable");
  const mentions =
    reference === undefined
      ? []
      : mentionComplete({
          formationIntitule: feuille.formationIntitule,
          jourLisible: reference.jourLisible,
          demiJourneeLisible: reference.demiJourneeLisible,
          horaires: reference.horaires,
          organisme: feuille.organisme,
        });

  return (
    <EmargementForm
      token={token}
      stagiaireNom={feuille.stagiaireNom}
      formationIntitule={feuille.formationIntitule}
      organisme={feuille.organisme}
      creneaux={creneaux}
      mentions={mentions}
      signerAction={signerDepuisPortailAction}
    />
  );
}
