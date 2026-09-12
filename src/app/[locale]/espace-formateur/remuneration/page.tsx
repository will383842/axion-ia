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
 * ## 🔴 Et le SALARIÉ, qui n'aura jamais de relevé
 *
 * Cette page ne savait lire que des relevés. Un salarié n'en a jamais — sa
 * rémunération passe par la paie. Il ouvrait donc « Ma rémunération » et lisait
 * « Aucun relevé pour l'instant, ils apparaissent ici une fois le mois arrêté ».
 *
 * Vraie pour un indépendant, cette phrase est FAUSSE pour lui : elle promet une
 * chose qui n'arrivera pas, sur l'écran même où il cherche ce qu'on lui doit. Un
 * état vide qui ment est pire qu'un état vide — il fait attendre.
 *
 * ⚠️ Ce que la page lui montre n'est PAS son salaire, et elle le dit : l'outil
 * calcule ce qu'il faut porter EN PLUS sur sa paie. C'est le bulletin qui fait
 * foi. Laisser croire l'inverse ferait contester un bulletin sur la base d'un
 * écran.
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
import { lireRemunerationDuFormateur } from "@/server/qualiopi/remuneration/pilotage-formateurs";
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
  const [releves, moi] = await Promise.all([
    listRelevesDuFormateur(session.trainerId),
    lireRemunerationDuFormateur(session.trainerId),
  ]);

  /*
    ⚠️ On teste « PAS sous-traitant » plutôt que « salarié », et l'écart compte :
    un DIRIGEANT qui anime des formations est dans la même situation qu'un
    salarié — un fixe, des commissions qui s'y imputent, aucune facture. Tester
    l'appartenance positive l'aurait oublié, exactement comme le panneau du fixe
    récupérable côté console a failli le faire.

    `moi === null` (formateur introuvable, base absente au build) retombe sur le
    comportement historique : on ne devine pas un statut.
  */
  const surPaie = moi !== null && moi.statut !== "sous_traitant";

  return (
    <CoquilleFormateur section="remuneration">
      <h1 className="text-2xl font-semibold">Ma rémunération</h1>
      <p className="mt-2 text-sm opacity-80">
        {surPaie
          ? "Ce que vos formations ajoutent à votre paie, mois par mois."
          : "Vos relevés mensuels et les factures d'honoraires établies en votre nom."}
      </p>

      {/*
        ── Le bloc du SALARIÉ (et du dirigeant) ────────────────────────────────

        🔑 Il vient AVANT la liste des relevés, parce que pour lui c'est la seule
        section qui portera jamais quelque chose. Le reléguer en dessous d'une
        liste vide reproduirait le défaut qu'on corrige.
      */}
      {surPaie && (
        <section className="mt-8 rounded-lg border p-4">
          <h2 className="font-semibold">Complément à porter sur votre paie</h2>

          {moi.situation === null ? (
            <p className="mt-2 text-sm opacity-80">
              Aucune formation n&apos;a encore été commissionnée. Dès qu&apos;une session vous sera
              rattachée, le calcul apparaîtra ici.
            </p>
          ) : (
            <>
              <p className="mt-2 text-sm">
                <strong>{moi.situation.moisLabel}</strong> —{" "}
                {moi.situation.complementDuMoisCents > 0 ? (
                  <>
                    complément dû :{" "}
                    <strong className="tabular-nums">
                      {euros(moi.situation.complementDuMoisCents)}
                    </strong>
                  </>
                ) : (
                  <>aucun complément ce mois-ci</>
                )}
              </p>

              {/*
                🔴 « Zéro complément » trois mois d'affilée se lit « je n'ai rien
                gagné en plus » et cache qu'un report est en cours de rattrapage.
                Quelqu'un qui ne comprend pas sa rémunération finit par la
                contester — et il aurait raison de demander.
              */}
              {moi.situation.detteCents > 0 && (
                <p className="mt-2 text-sm">
                  Vos commissions rattrapent actuellement un report de{" "}
                  <strong className="tabular-nums">{euros(moi.situation.detteCents)}</strong>. Votre
                  fixe reste versé en totalité : il est un{" "}
                  <strong>minimum garanti, jamais repris</strong>, et aucune somme ne vous sera
                  réclamée à ce titre.
                </p>
              )}
            </>
          )}

          {moi.fixeMensuelBrutCents !== null && (
            <p className="mt-2 text-sm opacity-80">
              Fixe mensuel brut de référence : {euros(moi.fixeMensuelBrutCents)}.
            </p>
          )}

          {/*
            ⛔ LA RÉSERVE EST OBLIGATOIRE, et elle n'est pas une formule de
            prudence : cet écran calcule, il ne verse pas. Le bulletin de paie
            fait foi. Sans cette phrase, un écart entre les deux se lirait comme
            une erreur de l'employeur plutôt que comme une question à poser.
          */}
          <p className="mt-3 text-xs opacity-70">
            Ce montant n&apos;est pas votre salaire : c&apos;est ce qui s&apos;ajoute à votre fixe.
            Seul votre bulletin de paie fait foi — en cas d&apos;écart, signalez-le.
          </p>
        </section>
      )}

      {releves.length === 0 ? (
        /*
          🔴 DEUX ÉTATS VIDES, PARCE QU'ILS NE DISENT PAS LA MÊME CHOSE.

          « Ils apparaissent ici une fois le mois arrêté » est une ATTENTE
          légitime pour un indépendant. Pour un salarié, c'est une promesse qui
          ne sera jamais tenue : il n'aura jamais de relevé, par construction.
          Un seul texte pour les deux faisait patienter la moitié des lecteurs
          devant un écran qui ne changerait jamais.
        */
        surPaie ? (
          <p className="mt-8 text-sm opacity-70">
            Vous êtes rémunéré par la paie : vous n&apos;avez pas de relevé d&apos;honoraires ni de
            facture. Ce que vos formations ajoutent à votre salaire est indiqué ci-dessus.
          </p>
        ) : (
          <p className="mt-8 text-sm opacity-70">
            Aucun relevé pour l&apos;instant. Ils apparaissent ici une fois le mois arrêté.
          </p>
        )
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
