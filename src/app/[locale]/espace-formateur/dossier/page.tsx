/**
 * Espace formateur — « Mon dossier » (lot E, M13 ; plan 08 §12.4, écrans F-13/F-14).
 *
 * Le formateur indépendant y voit l'état de ses pièces suivies et dépose celle qui est
 * à renouveler. C'est l'endroit vers lequel renvoient F40, F41 et F32 (« déposez-la
 * depuis votre espace »).
 *
 * 🔴 ÉTEINT : `formateurs.dossier_en_ligne` coupé, ou formateur salarié = page
 * introuvable (et pas d'entrée de menu). Server Component, formulaires natifs : aucune
 * ligne de JavaScript client.
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { requireFormateurLecture } from "@/server/formateur/guard";
import { lireDemandesEnCours } from "@/server/qualiopi/formateurs-independants/changements-coordonnees";
import { interrupteurAllume } from "@/server/qualiopi/formateurs-independants/interrupteur-allume";
import { lireMonDossier } from "@/server/qualiopi/formateurs-independants/mon-dossier";
import { numeroDeclarationAttendu } from "@/server/qualiopi/formateurs-independants/numero-declaration-espace";

import { CoquilleFormateur } from "../_coquille";
import {
  demanderChangementAdresseAction,
  demanderChangementIbanAction,
  deposerMaPieceAction,
  transmettreMonNumeroAction,
} from "./actions";
import { messageDuCode } from "./messages";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Mon dossier | Espace formateur Axion-IA",
  robots: { index: false, follow: false },
};

const JOUR_FR = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: "Europe/Paris" });

/** Le jour de délivrance compte pour ces pièces : leur durée de validité en part. */
const AVEC_DATE = new Set(["attestation_vigilance_urssaf", "cv"]);

export default async function MonDossierPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Lecture seule après une fin de collaboration (M14) : l'état, sans dépôt.
  const session = await requireFormateurLecture();
  const vue = await lireMonDossier(session.trainerId, new Date());
  // Lot E (M12) — demande de changement de compte ou d'adresse (indépendant, accès complet).
  const changement =
    !session.lectureSeule && (await interrupteurAllume("changement_coordonnees"))
      ? await lireDemandesEnCours(session.trainerId)
      : null;
  // V1-A-10 — signé avec un numéro « en cours » : F21 renvoie ici pour le transmettre.
  const ndaAttendu = !session.lectureSeule && (await numeroDeclarationAttendu(session.trainerId));
  if (vue === null && changement === null && !ndaAttendu) notFound();
  const enCours = (nature: string) => changement?.find((d) => d.nature === nature) ?? null;
  const issue = messageDuCode((await searchParams).issue);

  return (
    <CoquilleFormateur section="dossier">
      <h1 className="text-2xl font-semibold">Mon dossier</h1>
      <p className="mt-2 text-sm opacity-80">
        Les pièces qui permettent de vous confier des missions. Quand l&apos;une arrive à échéance,
        déposez la nouvelle ici : nous la vérifions, puis elle remplace l&apos;ancienne.
      </p>

      {issue && (
        <p role="status" className="mt-4 rounded-lg border p-3 text-sm">
          {issue.texte}
        </p>
      )}

      {vue?.bloque && !session.lectureSeule && (
        <p className="mt-4 rounded-lg border p-3 text-sm">
          Votre attestation URSSAF n&apos;est pas valable aujourd&apos;hui : de nouvelles missions
          pourront vous être proposées dès que la nouvelle aura été vérifiée.
        </p>
      )}

      {ndaAttendu && (
        <section id="nda" className="mt-8 rounded-lg border p-4">
          <h2 className="font-semibold">Numéro de déclaration d&apos;activité</h2>
          <p className="mt-1 text-sm">
            Vous avez signé avec un numéro « en cours ». Dès que la préfecture vous l&apos;a
            attribué, indiquez-le ici : il est nécessaire pour vous confier une mission.
          </p>
          <form action={transmettreMonNumeroAction} className="mt-3 flex flex-col gap-2 text-sm">
            <label className="flex flex-col gap-1">
              <span>Numéro (11 chiffres, sur le récépissé)</span>
              <input
                type="text"
                name="nda"
                required
                inputMode="numeric"
                autoComplete="off"
                maxLength={20}
                className="rounded-md border px-2 py-1"
              />
            </label>
            <button type="submit" className="w-fit rounded-md border px-3 py-1.5 font-medium">
              Transmettre mon numéro
            </button>
          </form>
        </section>
      )}

      <ul className="mt-8 flex flex-col gap-4">
        {(vue?.pieces ?? []).map((p) => (
          <li key={p.type} id={p.type} className="rounded-lg border p-4">
            <h2 className="font-semibold">{p.libelleType}</h2>
            <p className="mt-1 text-sm">{p.libelle}</p>
            {!session.lectureSeule && (
              <form action={deposerMaPieceAction} className="mt-3 flex flex-col gap-2 text-sm">
                <input type="hidden" name="type" value={p.type} />
                <label className="flex flex-col gap-1">
                  <span>Fichier (PDF, JPG ou PNG, 10 Mo au plus)</span>
                  <input
                    type="file"
                    name="fichier"
                    required
                    accept="application/pdf,image/jpeg,image/png"
                  />
                </label>
                {AVEC_DATE.has(p.type) && (
                  <label className="flex flex-col gap-1">
                    <span>
                      {p.type === "cv" ? "Date de mise à jour du CV" : "Date de délivrance"}
                    </span>
                    <input type="date" name="dateEmission" required className="w-fit" />
                  </label>
                )}
                <button type="submit" className="w-fit rounded-md border px-3 py-1.5 font-medium">
                  {p.geste ? "Déposer la nouvelle pièce" : "Déposer une pièce plus récente"}
                </button>
              </form>
            )}
          </li>
        ))}
      </ul>

      {changement !== null && (
        <section className="mt-10">
          <h2 className="text-lg font-semibold">Compte bancaire et adresse</h2>
          <p className="mt-2 text-sm opacity-80">
            Une modification est vérifiée par notre équipe avant d&apos;être prise en compte, au
            plus tôt 48 heures après votre demande. Pendant cette vérification, un changement de
            compte bancaire met vos virements en attente ; ils sont ensuite versés sur le nouveau
            compte. Un e-mail vous confirme chaque demande de changement de compte.
          </p>
          <div className="mt-4 flex flex-col gap-4">
            <div className="rounded-lg border p-4">
              <h3 className="font-semibold">Compte bancaire</h3>
              {enCours("iban") ? (
                <p className="mt-1 text-sm">
                  Demande du {JOUR_FR.format(enCours("iban")!.createdAt)} en cours de vérification.
                </p>
              ) : (
                <form
                  action={demanderChangementIbanAction}
                  className="mt-3 flex flex-col gap-2 text-sm"
                >
                  <label className="flex flex-col gap-1">
                    <span>Nouvel IBAN</span>
                    <input
                      type="text"
                      name="iban"
                      required
                      maxLength={50}
                      autoComplete="off"
                      spellCheck={false}
                      className="rounded-md border px-2 py-1"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span>RIB du nouveau compte (PDF ou photo)</span>
                    <input
                      type="file"
                      name="rib"
                      required
                      accept="application/pdf,image/jpeg,image/png"
                    />
                  </label>
                  <button type="submit" className="w-fit rounded-md border px-3 py-1.5 font-medium">
                    Demander le changement
                  </button>
                </form>
              )}
            </div>
            <div className="rounded-lg border p-4">
              <h3 className="font-semibold">Adresse professionnelle</h3>
              {enCours("adresse") ? (
                <p className="mt-1 text-sm">
                  Demande du {JOUR_FR.format(enCours("adresse")!.createdAt)} en cours de
                  vérification.
                </p>
              ) : (
                <form
                  action={demanderChangementAdresseAction}
                  className="mt-3 flex flex-col gap-2 text-sm"
                >
                  <label className="flex flex-col gap-1">
                    <span>Nouvelle adresse</span>
                    <textarea
                      name="adresse"
                      required
                      maxLength={500}
                      rows={2}
                      className="rounded-md border px-2 py-1"
                    />
                  </label>
                  <button type="submit" className="w-fit rounded-md border px-3 py-1.5 font-medium">
                    Demander le changement
                  </button>
                </form>
              )}
            </div>
          </div>
        </section>
      )}
    </CoquilleFormateur>
  );
}
