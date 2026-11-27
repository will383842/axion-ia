// Lot 5 : la page des liens de l'e-mail de changement de compte (confirmer / bloquer).
//
// `/apporteur/dossier/compte/<idDemande>/<signature>` : HORS du chemin à jeton `[id]/[jeton]`
// (le segment statique `compte` l'emporte). Rendu à la demande, jamais au build (contrat
// `stub.invalid`). Afficher cette page n'écrit RIEN ; le bouton envoie un POST. Aucun IBAN
// entier, aucun lien personnel dans le rendu.

import type { Metadata } from "next";

import { lireLienCompte } from "@/features/apporteurs-reseau/changement-iban-espace-lecture";
import { dateReponseAuPlusTot } from "@/features/apporteurs-reseau/changement-iban-espace";

import { Coquille, EcranEtat } from "../../../[id]/[jeton]/Coquille";
import { TEXTES_COMPTE as T } from "../../../[id]/[jeton]/textes-compte";

import { bloquerLienAction, confirmerLienAction } from "./actions";
import { FormulaireLien } from "./FormulaireLien";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Compte bancaire — Axion-IA",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

const jour = (d: Date) =>
  d.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Paris",
  });

export default async function PageLienCompte({
  params,
}: {
  params: Promise<{ demande: string; signature: string }>;
}) {
  const { demande, signature } = await params;
  const lien = await lireLienCompte(demande, signature).catch(() => null);
  if (!lien) {
    return (
      <Coquille>
        <EcranEtat pastilleTexte="" titre={T.lienMort} ligne="" />
      </Coquille>
    );
  }
  if (lien.action === "confirmer") {
    const reponse = jour(dateReponseAuPlusTot(new Date()));
    return (
      <Coquille>
        <h1 className="font-display text-[28px]">{T.confirmerTitre}</h1>
        <p className="mt-3 text-[17px]">
          {T.confirmerLigne} <span aria-hidden="true">••••</span> {lien.fin4}
        </p>
        <div className="mt-6">
          <FormulaireLien
            action={confirmerLienAction}
            demande={demande}
            signature={signature}
            libelle={T.confirmerBouton}
            fait={`${T.confirmeTitre} ${T.confirmeLigne(reponse)}`}
          />
        </div>
      </Coquille>
    );
  }
  return (
    <Coquille>
      <h1 className="font-display text-[28px]">{T.bloquerTitre}</h1>
      <p className="mt-3 text-[17px]">{T.bloquerLigne}</p>
      <div className="mt-6">
        <FormulaireLien
          action={bloquerLienAction}
          demande={demande}
          signature={signature}
          libelle={T.bloquerBouton}
          fait={T.bloqueLigne}
        />
      </div>
    </Coquille>
  );
}
