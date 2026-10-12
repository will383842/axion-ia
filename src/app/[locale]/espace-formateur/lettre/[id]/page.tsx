/**
 * Espace formateur — UNE lettre de mission à signer (lot C, M18).
 *
 * Le bouton de l'e-mail F26 mène ici, et non à l'accueil : la personne voit la
 * lettre qu'on vient de lui adresser, pas la liste de tout ce qu'elle a à faire.
 * Les lectures sont celles de l'accueil (`lireLettresMissionDuFormateur`), donc
 * le même mandat : une lettre qui n'est pas la sienne ne s'affiche pas.
 */

import Link from "next/link";
import { notFound } from "next/navigation";

import { requireFormateur } from "@/server/formateur/guard";
import { SignatureDocument } from "@/components/espace-formateur/SignatureDocument";
import { signerLettreMissionFormateurAction } from "@/server/actions/qualiopi/lettre-mission-signature";
import { lireLettresMissionDuFormateur } from "@/server/qualiopi/documents/signature/lettre-mission-queries";
import { FORMATEUR_BASE_PATH } from "@/server/formateur/routes";

import { CoquilleFormateur } from "../../_coquille";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function LettreAFaireSignerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.ReactElement> {
  const { trainerId } = await requireFormateur();
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const lettre = (await lireLettresMissionDuFormateur(trainerId)).find(
    (l) => l.documentGenereId === id,
  );
  if (lettre === undefined) notFound();
  return (
    <CoquilleFormateur section="accueil">
      <div className="space-y-4">
        <h1 className="text-mocha font-serif text-2xl font-semibold">Votre lettre de mission</h1>
        <p className="text-fg-muted text-xs">
          {lettre.estCadre
            ? `Lettre-cadre — ${lettre.periodeLisible ?? "période non renseignée"}`
            : `${lettre.sessionTitre} · ${lettre.sessionNumero}`}
        </p>
        <SignatureDocument
          documentGenereId={lettre.documentGenereId}
          titrePiece="Lettre de mission"
          numero={lettre.numero}
          parties={lettre.parties}
          peutAgir={lettre.peutAgir}
          motifBlocage={lettre.motifBlocage}
          urlPiece={`/api/formateur/lettre-mission/${lettre.documentGenereId}`}
          mentions={lettre.mentions}
          plafondProbant={lettre.plafondProbant}
          libelleBouton="Signer la lettre de mission"
          labelSignature="Signature du formateur"
          signerAction={signerLettreMissionFormateurAction}
        />
        <Link href={FORMATEUR_BASE_PATH} className="text-terracotta text-sm hover:underline">
          Retour à mon espace
        </Link>
      </div>
    </CoquilleFormateur>
  );
}
