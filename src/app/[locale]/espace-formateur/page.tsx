/**
 * Espace formateur — accueil : ce que le formateur a à faire.
 *
 * ## Ce qui change
 *
 * Cette page était le tableau de bord du COACHING : son titre annonçait « Mes
 * séances 1-to-1 », et la liste des formations de groupe — le cas majoritaire —
 * tenait dans une carte coincée au-dessus. Les lettres de mission à signer, elles,
 * se noyaient au milieu.
 *
 * Elle s'ouvre désormais sur les **signatures en attente**, et sur rien d'autre.
 * Les deux activités (collectif, individuel) ont chacune leur destination dans
 * la barre latérale.
 *
 * La lettre de mission est le contrat qui CONFIE la session : elle se signe donc
 * AVANT que cette session n'entre dans le quotidien du formateur. La chercher
 * session par session serait le meilleur moyen qu'elle ne soit jamais signée —
 * c'est exactement ce qui s'est passé jusqu'ici.
 */

import { CircleCheckBig } from "lucide-react";
import Link from "next/link";

import { requireFormateur } from "@/server/formateur/guard";
import { SignatureDocument } from "@/components/espace-formateur/SignatureDocument";
import { signerLettreMissionFormateurAction } from "@/server/actions/qualiopi/lettre-mission-signature";
import { lireLettresMissionDuFormateur } from "@/server/qualiopi/documents/signature/lettre-mission-queries";
import { FORMATEUR_BASE_PATH } from "@/server/formateur/routes";
import { FORMATEUR_SESSIONS_PATH } from "@/server/formateur/collectif-labels";

import { CoquilleFormateur } from "./_coquille";

export const dynamic = "force-dynamic";

export default async function EspaceFormateurAccueilPage(): Promise<React.ReactElement> {
  const { trainerId } = await requireFormateur();

  // Lu APRÈS la garde d'authentification : la lecture ne connaît que
  // `trainerId`, elle n'a aucun moyen de vérifier elle-même que l'appelant est
  // bien ce formateur-là.
  const lettres = await lireLettresMissionDuFormateur(trainerId);

  // 🔴 On compte celles où le formateur peut AGIR, pas toutes les lettres :
  // les lettres déjà signées restent affichées (c'est sa preuve), mais elles
  // n'ont rien à réclamer et ne doivent pas gonfler la pastille.
  const aSigner = lettres.filter((l) => l.peutAgir).length;

  return (
    <CoquilleFormateur section="accueil" aSigner={aSigner}>
      <header className="mb-8">
        <h1 className="text-mocha font-serif text-2xl font-semibold sm:text-3xl">À faire</h1>
        <p className="text-fg-soft mt-2 text-sm">
          {aSigner === 0
            ? "Aucun document ne vous attend."
            : aSigner === 1
              ? "Un document attend votre signature."
              : `${aSigner} documents attendent votre signature.`}
        </p>
      </header>

      {lettres.length === 0 ? (
        <RienASigner />
      ) : (
        <section className="space-y-4">
          <h2 className="text-fg-muted text-xs font-semibold tracking-wide uppercase">
            Lettres de mission
          </h2>
          <p className="text-fg-soft text-sm leading-relaxed">
            La lettre de mission fixe le périmètre de votre intervention, votre rémunération et vos
            engagements de confidentialité. Elle porte deux signatures : la vôtre et celle de
            l&apos;organisme.
          </p>
          {lettres.map((lettre) => (
            <div key={lettre.documentGenereId} className="space-y-1">
              <p className="text-fg-muted text-xs">
                {/* Une lettre-CADRE ne se rattache pas à une session : elle
                    s'annonce par sa période, sinon le formateur signerait un
                    mandat sans savoir ce qu'il couvre. */}
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
                mentions={lettre.mentions}
                plafondProbant={lettre.plafondProbant}
                libelleBouton="Signer la lettre de mission"
                labelSignature="Signature du formateur"
                signerAction={signerLettreMissionFormateurAction}
              />
            </div>
          ))}
        </section>
      )}

      {/* Les deux activités, nommées pour ce qu'elles sont. */}
      <section className="mt-10 grid gap-4 sm:grid-cols-2">
        <CarteActivite
          href={FORMATEUR_SESSIONS_PATH}
          titre="Mes formations"
          detail="Les formations de groupe auxquelles vous êtes affecté : journées et feuilles d’émargement."
        />
        <CarteActivite
          href={`${FORMATEUR_BASE_PATH}/seances`}
          titre="Accompagnements individuels"
          detail="Le suivi une personne à la fois, séance après séance. Sans rapport avec les formations de groupe."
        />
      </section>
    </CoquilleFormateur>
  );
}

function CarteActivite({ href, titre, detail }: { href: string; titre: string; detail: string }) {
  return (
    <Link
      href={href}
      className="border-border bg-paper hover:border-terracotta group block rounded-xl border p-5 transition-colors"
    >
      <p className="text-mocha font-serif text-base font-semibold">{titre}</p>
      <p className="text-fg-soft mt-2 text-sm leading-relaxed">{detail}</p>
      <p className="text-terracotta mt-3 text-sm group-hover:underline">Ouvrir</p>
    </Link>
  );
}

function RienASigner() {
  return (
    <div className="border-border bg-paper rounded-xl border p-8 text-center">
      <span className="bg-sage-soft text-sage mx-auto mb-4 flex size-12 items-center justify-center rounded-full">
        <CircleCheckBig className="size-6" strokeWidth={1.8} aria-hidden="true" />
      </span>
      <p className="text-mocha font-serif text-lg font-semibold">Rien à signer</p>
      <p className="text-fg-soft mx-auto mt-2 max-w-sm text-sm leading-relaxed">
        Aucune lettre de mission ne vous attend. C’est le cas normal si vous êtes salarié permanent
        : les lettres ne nomment que les intervenants missionnés.
      </p>
    </div>
  );
}
