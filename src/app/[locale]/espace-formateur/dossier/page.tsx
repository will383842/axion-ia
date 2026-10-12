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
import { lireMonDossier } from "@/server/qualiopi/formateurs-independants/mon-dossier";

import { CoquilleFormateur } from "../_coquille";
import { deposerMaPieceAction } from "./actions";
import { messageDuCode } from "./messages";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Mon dossier | Espace formateur Axion-IA",
  robots: { index: false, follow: false },
};

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
  if (vue === null) notFound();
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

      {vue.bloque && !session.lectureSeule && (
        <p className="mt-4 rounded-lg border p-3 text-sm">
          Votre attestation URSSAF n&apos;est pas valable aujourd&apos;hui : de nouvelles missions
          pourront vous être proposées dès que la nouvelle aura été vérifiée.
        </p>
      )}

      <ul className="mt-8 flex flex-col gap-4">
        {vue.pieces.map((p) => (
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
    </CoquilleFormateur>
  );
}
