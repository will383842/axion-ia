// Coaching 1-to-1 — liste de toutes les séances (admin, tous formateurs).

import Link from "next/link";
import { listAllSessions } from "@/server/coaching-admin/queries";
import { coachingInterventionLabel, sessionStatutLabel } from "@/server/formateur/coaching-options";

const dateFmt = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short" });

export default async function CoachingSeancesPage({
  params,
}: {
  params: Promise<{ locale: string; adminPrefix: string }>;
}): Promise<React.ReactElement> {
  const { locale, adminPrefix } = await params;
  const base = `/${locale}/${adminPrefix}/coaching/seances`;
  const sessions = await listAllSessions();
  return (
    <div className="space-y-4">
      <h1 className="text-mocha text-xl font-semibold">Séances 1-to-1</h1>
      {sessions.length === 0 ? (
        <p className="text-fg-muted text-sm">Aucune séance enregistrée.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-border text-fg-muted border-b text-left text-xs">
              <th className="py-1.5">Date</th>
              <th>Prestation</th>
              <th>Formateur</th>
              <th>Bénéficiaire</th>
              <th>Statut</th>
              <th className="text-right">Contenu</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => (
              <tr key={s.id} className="border-sand hover:bg-cream border-b">
                <td className="py-1.5">{dateFmt.format(s.dateSeance)}</td>
                <td>
                  <Link href={`${base}/${s.id}`} className="text-terracotta hover:underline">
                    {coachingInterventionLabel(s.interventionSlug)}
                  </Link>
                </td>
                <td>
                  {s.trainer.prenom} {s.trainer.nom}
                </td>
                <td>
                  {s.beneficiaireNom ?? "—"}
                  {s.beneficiaireEntreprise ? ` (${s.beneficiaireEntreprise})` : ""}
                </td>
                <td>{sessionStatutLabel(s.statut)}</td>
                <td className="text-fg-muted text-right text-xs">
                  {s._count.optimisations} opt · {s._count.comptesRendus} CR · {s._count.journaux}{" "}
                  jrn
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
