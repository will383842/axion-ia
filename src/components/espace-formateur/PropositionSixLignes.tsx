/**
 * La proposition de mission en SIX lignes (lot L11b-ux, écran F-8) : formation,
 * une ligne par journée, lieu, honoraires, déplacement, réponse avant. Le
 * montant est lu AVANT les boutons.
 *
 * Composant serveur, sans état : la page lui passe la proposition chiffrée
 * (`lirePropositionChiffree`), jamais un montant recalculé ici.
 */

import type { PropositionChiffree } from "@/server/qualiopi/formateurs-independants/proposition-chiffree";

const REPONSE_AVANT = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Europe/Paris",
});

export function PropositionSixLignes({
  proposition,
  echeance,
}: {
  proposition: PropositionChiffree;
  echeance: Date | null;
}): React.ReactElement {
  const ligne = (titre: string, valeur: React.ReactNode) => (
    <div className="grid grid-cols-[7rem_1fr] gap-3 py-2">
      <dt className="text-fg-muted text-sm">{titre}</dt>
      <dd className="text-mocha text-sm">{valeur}</dd>
    </div>
  );
  return (
    <dl className="border-border divide-border divide-y rounded-lg border px-4">
      {ligne("Formation", <strong>{proposition.intitule}</strong>)}
      {ligne(
        "Dates",
        <ul>
          {proposition.lignesJours.map((j) => (
            <li key={j}>{j}</li>
          ))}
        </ul>,
      )}
      {ligne("Lieu", proposition.lieu)}
      {ligne("Honoraires", <strong>{proposition.ligneHonoraires}</strong>)}
      {ligne("Déplacement", proposition.ligneDeplacement)}
      {echeance !== null && ligne("Réponse avant", REPONSE_AVANT.format(echeance))}
    </dl>
  );
}
