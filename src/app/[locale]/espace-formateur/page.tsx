/**
 * Espace formateur — tableau de bord (2026-06-13).
 *
 * Trois blocs, dans cet ordre : lettres de mission à signer · formations
 * COLLECTIVES · séances individuelles 1-to-1. L'ordre a été inversé le
 * 2026-08-01 — le collectif est le cas majoritaire, il passe donc devant.
 *
 * Porte aussi les LETTRES DE MISSION à signer. Le plan unifié situe cet écran
 * ici et non sur la page d'une session, pour une raison de séquence : la lettre
 * de mission est le contrat qui CONFIE la session, elle se signe donc avant que
 * cette session ne fasse partie du quotidien du formateur. La chercher session
 * par session serait le meilleur moyen qu'elle ne soit jamais signée — c'est
 * exactement ce qui s'est passé jusqu'ici, où les deux cadres au stylo du modèle
 * restaient vides faute d'écran.
 */

import Link from "next/link";
import { requireFormateur } from "@/server/formateur/guard";
import { listMySessions } from "@/server/formateur/queries";
import { NewSessionForm } from "@/components/espace-formateur/NewSessionForm";
import { SignatureDocument } from "@/components/espace-formateur/SignatureDocument";
import { signerLettreMissionFormateurAction } from "@/server/actions/qualiopi/lettre-mission-signature";
import { lireLettresMissionDuFormateur } from "@/server/qualiopi/documents/signature/lettre-mission-queries";
import { coachingInterventionLabel, sessionStatutLabel } from "@/server/formateur/coaching-options";
import { FORMATEUR_SESSIONS_PATH } from "@/server/formateur/collectif-labels";

const dateFmt = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" });

const STATUT_CLASS: Record<string, string> = {
  planifiee: "bg-sand text-fg-muted",
  realisee: "bg-sage-soft text-success",
  annulee: "bg-error/10 text-error",
};

export default async function DashboardPage(): Promise<React.ReactElement> {
  const { trainerId } = await requireFormateur();
  const sessions = await listMySessions(trainerId);
  // Lu APRÈS la garde d'authentification, comme tout le reste de cette page :
  // la lecture ne connaît que `trainerId`, elle n'a aucun moyen de vérifier
  // elle-même que l'appelant est bien ce formateur-là.
  const lettresMission = await lireLettresMissionDuFormateur(trainerId);

  return (
    <div className="space-y-8">
      {/*
        Titre de page — ajouté le 2026-08-01.

        🔴 Deux défauts corrigés d'un coup, signalés par Will : « Mes séances
        1-to-1 je ne comprends pas du tout ».

        1. Le `h1` de la page était « Mes séances 1-to-1 » — le nom du service de
           COACHING INDIVIDUEL. Un formateur qui n'anime que des formations de
           groupe ouvrait donc son tableau de bord sur le titre d'un produit qui
           ne le concerne pas, tandis que ses formations collectives tenaient
           dans une carte posée AU-DESSUS de ce titre.
        2. Ce `h1` arrivait APRÈS le `h2` des lettres de mission. L'ordre des
           titres était donc inversé pour un lecteur d'écran.

        La page s'appelle désormais par ce qu'elle est, et chaque bloc devient
        une section de même rang : à signer · collectif · individuel.
      */}
      <header className="space-y-1">
        <h1 className="text-mocha font-serif text-2xl font-semibold">Mon espace formateur</h1>
        <p className="text-fg-muted text-sm">
          Vos formations, vos séances d&apos;accompagnement individuel et les documents que vous
          avez à signer.
        </p>
      </header>

      {/*
        Lettres de mission — EN TÊTE de page, avant les séances.

        ⚠️ Rendu seulement s'il y en a : une liste vide se lirait comme une pièce
        manquante alors que le cas normal, pour un formateur salarié permanent,
        est qu'aucune lettre ne le nomme.

        🔴 Les lettres déjà signées RESTENT affichées. Elles portent le nom du
        signataire, l'horodatage en heure de Paris et l'empreinte : c'est le seul
        endroit où le formateur peut constater ce qu'il a signé. Les masquer une
        fois signées lui retirerait sa preuve.
      */}
      {lettresMission.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-espresso font-serif text-xl">Lettres de mission</h2>
          <p className="text-mocha text-sm">
            La lettre de mission fixe le périmètre de votre intervention, votre rémunération et vos
            engagements de confidentialité. Elle porte deux signatures : la vôtre et celle de
            l&apos;organisme de formation.
          </p>
          {lettresMission.map((lettre) => (
            <div key={lettre.documentGenereId} className="space-y-1">
              <p className="text-fg-muted text-xs">
                {lettre.sessionTitre} · {lettre.sessionNumero}
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

      {/*
        Collectif AVANT individuel — c'est le cas majoritaire, et c'était
        l'inverse jusqu'au 2026-08-01 (une carte coincée entre deux titres).
      */}
      <section className="space-y-3">
        <h2 className="text-espresso font-serif text-xl">Mes formations collectives</h2>
        <p className="text-mocha text-sm">
          Les formations de groupe auxquelles vous êtes affecté : le détail des journées et les
          feuilles d&apos;émargement à contresigner.
        </p>
        <Link
          href={FORMATEUR_SESSIONS_PATH}
          className="border-border hover:border-terracotta block rounded-lg border p-4 transition-colors"
        >
          <span className="text-mocha font-serif font-semibold">
            Voir mes formations collectives
          </span>
        </Link>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-espresso font-serif text-xl">Mes séances 1-to-1</h2>
          <NewSessionForm />
        </div>
        {/*
          Cette phrase existe parce que le libellé seul n'a parlé à personne :
          « 1-to-1 » est le nom commercial du service de coaching individuel, il
          ne dit pas de quoi il s'agit à qui ouvre la page.
        */}
        <p className="text-mocha text-sm">
          L&apos;accompagnement individuel (Coaching IA 1-to-1) : une personne, un parcours suivi
          séance après séance. Sans rapport avec les formations de groupe ci-dessus.
        </p>
        {sessions.length === 0 ? (
          <p className="text-fg-muted text-sm">
            Aucune séance d&apos;accompagnement individuel. Si vous n&apos;animez que des formations
            de groupe, c&apos;est normal : tout se passe dans la section ci-dessus.
          </p>
        ) : (
          <ul className="space-y-2">
            {sessions.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/fr/espace-formateur/seances/${s.id}`}
                  className="border-border bg-sand hover:border-terracotta block rounded-lg border p-4 transition-colors"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-mocha font-medium">
                      {coachingInterventionLabel(s.interventionSlug)}
                    </span>
                    <span
                      className={`rounded px-2 py-0.5 text-xs ${STATUT_CLASS[s.statut] ?? "bg-sand"}`}
                    >
                      {sessionStatutLabel(s.statut)}
                    </span>
                  </div>
                  <div className="text-fg-muted mt-1 text-sm">
                    {dateFmt.format(s.dateSeance)}
                    {s.beneficiaireNom ? ` · ${s.beneficiaireNom}` : ""}
                    {s.beneficiaireEntreprise ? ` (${s.beneficiaireEntreprise})` : ""}
                  </div>
                  <div className="text-fg-muted mt-1 text-xs">
                    {s._count.optimisations} optimisation(s) · {s._count.comptesRendus} CR ·{" "}
                    {s._count.journaux} entrée(s) de journal
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
