/**
 * BlocMoyensSession — « Vérification des moyens » dans la section lieu de la
 * fiche session (chantier QNC, lot L07, NC7). Composant serveur : rend `null`
 * tant que `qualiopi.moyens.actif` n'agit pas sur CETTE session (éteint = la
 * fiche est exactement celle d'avant).
 */

import { prisma } from "@/lib/prisma";
import { VerificationMoyensForm } from "@/components/admin/qualiopi/VerificationMoyensForm";
import { lireEtatMoyensSession } from "@/server/qualiopi/moyens/etat-moyens-session";
import { estActifPour, lireInterrupteurQualiopi } from "@/server/qualiopi/socle/interrupteurs";

const fmt = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris",
  dateStyle: "short",
  timeStyle: "short",
});

const LIBELLE_CATEGORIE: Record<string, string> = {
  salle: "Salle",
  materiel: "Matériel",
  plateforme: "Plateforme",
  humain: "Moyen humain",
};

export async function BlocMoyensSession({
  sessionId,
}: {
  sessionId: string;
}): Promise<React.ReactElement | null> {
  const cible = await prisma.trainingSession.findUnique({
    where: { id: sessionId },
    select: { estTestInterne: true },
  });
  if (cible === null || !estActifPour(await lireInterrupteurQualiopi("moyens"), cible)) return null;
  const etat = await lireEtatMoyensSession(sessionId);
  if (etat === null) return null;

  return (
    <div className="mt-[var(--space-admin-6)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-5)]">
      <h3 className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-md)] font-semibold">
        Vérification des moyens
      </h3>

      {etat.lien !== "ok" && (
        <p
          role="alert"
          className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-warning)]"
        >
          {etat.lien === "manquant"
            ? "Distanciel : le lien de visioconférence (Zoom Pro) est obligatoire."
            : "Distanciel : le lien n'est pas un lien Zoom (outil retenu : Zoom Pro)."}
        </p>
      )}
      {etat.dernierTestLien && (
        <p className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-sm)]">
          Test du lien à J-1 : {etat.dernierTestLien.ok ? "réussi" : "ÉCHEC"} le{" "}
          {fmt.format(etat.dernierTestLien.creeLe)}.
        </p>
      )}
      {etat.piecesARemettre.length > 0 && (
        <p
          role="alert"
          className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-warning)]"
        >
          {etat.piecesARemettre.length} pièce(s) émise(s) avant un changement de modalité ou de lieu
          : à réémettre.
        </p>
      )}

      <h4 className="mb-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] font-semibold">
        Moyens adaptés à cette modalité ({etat.modalite})
      </h4>
      <ul className="mb-[var(--space-admin-4)] list-disc pl-[var(--space-admin-5)] text-[length:var(--text-admin-sm)]">
        {etat.moyens.length === 0 && <li>Aucun moyen actif pour cette modalité.</li>}
        {etat.moyens.map((m) => (
          <li key={m.id}>
            {LIBELLE_CATEGORIE[m.categorie] ?? m.categorie} — {m.libelle}
            {m.dateVerification
              ? ` (vérifié le ${fmt.format(m.dateVerification)})`
              : " (non vérifié)"}
          </li>
        ))}
      </ul>

      {etat.verifications.length > 0 && (
        <p className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-sm)]">
          Dernière vérification enregistrée le {fmt.format(etat.verifications[0]!.creeLe)} (
          {etat.verifications.length} au total).
        </p>
      )}
      {etat.changements.length > 0 && (
        <details className="mb-[var(--space-admin-4)] text-[length:var(--text-admin-sm)]">
          <summary className="cursor-pointer font-semibold">
            Changements de modalité et de lieu ({etat.changements.length})
          </summary>
          <ul className="mt-[var(--space-admin-2)] list-disc pl-[var(--space-admin-5)]">
            {etat.changements.map((c, i) => (
              <li key={i}>
                {c.nature === "modalite" ? "Modalité" : "Lieu"} — {fmt.format(c.creeLe)},{" "}
                {c.auteurNom} : {c.motif}
              </li>
            ))}
          </ul>
        </details>
      )}

      <VerificationMoyensForm sessionId={sessionId} chezEntreprise={etat.chezEntreprise} />
    </div>
  );
}
