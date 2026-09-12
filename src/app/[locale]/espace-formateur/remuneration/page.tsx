/**
 * Espace formateur — « Ma rémunération ».
 *
 * ## Le trou que cette page ferme
 *
 * 🔴 Le formateur n'avait AUCUN endroit où retrouver sa facture. Son espace
 * portait ses sessions, ses séances, ses missions et ses pièces à signer — ni
 * relevé, ni facture, ni ce qu'on lui doit. Or depuis l'autofacturation, c'est
 * l'organisme qui établit sa facture EN SON NOM : elle ne vivait que dans un
 * e-mail, et l'e-mail perdu, la pièce l'était aussi.
 *
 * C'est d'autant moins tenable qu'il dispose de HUIT JOURS pour la contester
 * (clause 4 bis du contrat de sous-traitance). Demander à quelqu'un de contester
 * un document qu'il ne peut pas relire n'est pas un droit, c'est une formalité.
 *
 * ## Ce que la page NE fait pas
 *
 * ⛔ Aucun bouton de contestation ici. La clause dit « en répondant » — et le
 * formateur répond à l'e-mail qui porte la pièce. Ajouter un second canal sans
 * que l'organisme sache où regarder créerait deux files de réclamations dont
 * une serait ignorée. La page DIT la date limite et dit comment contester ;
 * elle n'invente pas un circuit.
 *
 * Server Component : aucune ligne de JavaScript client.
 */

import type { Metadata } from "next";
import { Euro, FileText } from "lucide-react";

import { requireFormateur } from "@/server/formateur/guard";
import { listRelevesDuFormateur } from "@/server/qualiopi/remuneration/queries";
import { CoquilleFormateur } from "../_coquille";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Ma rémunération | Espace formateur Axion-IA",
  robots: { index: false, follow: false },
};

const MOIS = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
] as const;

const euros = (cents: number): string =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);

const jour = (d: Date): string => d.toLocaleDateString("fr-FR");

export default async function RemunerationFormateurPage() {
  const session = await requireFormateur();
  const releves = await listRelevesDuFormateur(session.trainerId);

  return (
    <CoquilleFormateur section="remuneration">
      <h1 className="text-2xl font-semibold">Ma rémunération</h1>
      <p className="mt-2 text-sm opacity-80">
        Vos relevés mensuels et les factures d&apos;honoraires établies en votre nom.
      </p>

      {releves.length === 0 ? (
        <p className="mt-8 text-sm opacity-70">
          Aucun relevé pour l&apos;instant. Ils apparaissent ici une fois le mois arrêté.
        </p>
      ) : (
        <ul className="mt-8 flex flex-col gap-4">
          {releves.map((r) => {
            /*
              🔑 On AFFICHE ce que le serveur a décidé. `contestable` est
              calculé dans la requête : lire l'horloge pendant un rendu viole la
              pureté du rendu, et donnerait une seconde réponse à une question
              dont le serveur a déjà l'autorité.
            */
            const paye = r.payeAt !== null;

            return (
              <li key={r.id} className="rounded-lg border p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <strong>
                    {MOIS[r.periodeMonth - 1]} {r.periodeYear}
                  </strong>
                  <span className="text-lg tabular-nums">
                    <Euro size={14} aria-hidden className="inline" /> {euros(r.totalTtcCents)} TTC
                  </span>
                </div>

                <p className="mt-1 text-sm opacity-80">
                  {euros(r.totalHtCents)} HT
                  {r.tvaCents > 0 && <> · TVA {euros(r.tvaCents)}</>}
                  {r.numeroFacture !== null && <> · facture {r.numeroFacture}</>}
                </p>

                {paye ? (
                  <p className="mt-2 text-sm">Payé le {jour(r.payeAt as Date)}.</p>
                ) : r.echeance !== null ? (
                  <p className="mt-2 text-sm">
                    Règlement prévu au plus tard le {jour(r.echeance)}.
                  </p>
                ) : (
                  // Pas de facture, donc pas d'échéance. On le DIT : une case
                  // vide se lirait « on ne sait pas », ce qui inquiète à tort.
                  <p className="mt-2 text-sm opacity-80">
                    La facture n&apos;est pas encore établie ; l&apos;échéance partira de son
                    émission.
                  </p>
                )}

                {r.contesteeAt !== null && (
                  <p className="mt-2 text-sm font-medium">
                    Vous avez signalé un désaccord le {jour(r.contesteeAt)}. Le règlement est
                    suspendu le temps qu&apos;il soit réglé.
                  </p>
                )}

                {r.contestable && r.contestationAvantAt !== null && (
                  /*
                    ⚠️ La date limite est ÉCRITE, jamais « sous huitaine ». C'est
                    lui qui subit le délai : le lui faire calculer, c'est le lui
                    faire rater.
                  */
                  <p className="mt-2 text-sm">
                    Si le détail ne correspond pas à ce que vous avez réalisé, répondez à
                    l&apos;e-mail qui porte cette facture avant le{" "}
                    <strong>{jour(r.contestationAvantAt)}</strong> inclus.
                  </p>
                )}

                {r.documentId !== null && (
                  <p className="mt-3">
                    <a
                      className="inline-flex items-center gap-2 underline"
                      href={`/api/espace-formateur/documents/${r.documentId}`}
                    >
                      <FileText size={16} aria-hidden />
                      Télécharger la facture (PDF)
                    </a>
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </CoquilleFormateur>
  );
}
