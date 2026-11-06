// « Demandes reçues » (onglet Résumé de la fiche) : le message du formulaire de contact, l'accusé de
// réception automatique et les réponses de l'équipe. Composant SERVEUR, sans JavaScript client.
// Tout texte de personne est rendu en TEXTE (React l'échappe) : jamais de HTML, jamais d'adresse.

import Link from "next/link";

import { AdminBadge } from "@/components/admin/ui/AdminBadge";
import type { ContexteFiche } from "./contexte";
import {
  LIBELLE_ETAT_ACCUSE,
  lireDemandesDeLaFiche,
  PLAFOND_DEMANDES,
  type DemandeDeLaFiche,
  type DemandesLues,
} from "@/features/dossier-client/demandes-de-la-fiche";

const jourHeure = (d: Date): string =>
  new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);

const SOUS_TITRE =
  "mt-[var(--space-admin-2)] text-[length:var(--text-admin-xs)] font-semibold text-[color:var(--color-admin-fg-muted)]";
const TEXTE = "whitespace-pre-wrap break-words text-[length:var(--text-admin-sm)]";

function Panne({ quoi }: { quoi: string }): React.ReactElement {
  return (
    <p role="alert" className="admin-alert admin-alert-warning mb-[var(--space-admin-3)]">
      <span>{quoi} : lecture impossible. Rechargez la page.</span>
    </p>
  );
}

function Demande({
  d,
  pannes,
  adminPrefix,
}: {
  d: DemandeDeLaFiche;
  pannes: DemandesLues["pannes"];
  adminPrefix: string;
}): React.ReactElement {
  const a = d.accuse;
  return (
    <li className="border-t border-[color:var(--color-admin-border)] pt-[var(--space-admin-3)] first:border-t-0 first:pt-0">
      <p className="flex flex-wrap items-center gap-x-[var(--space-admin-3)] text-[length:var(--text-admin-sm)]">
        <span className="text-[color:var(--color-admin-fg-muted)] tabular-nums">
          {jourHeure(d.date)}
        </span>
        <AdminBadge tone="outline">{d.typeLibelle}</AdminBadge>
        <Link
          href={`/fr/${adminPrefix}/submissions/${d.id}`}
          className="admin-link inline-flex min-h-[44px] items-center"
        >
          Ouvrir le message
        </Link>
      </p>
      <p className={SOUS_TITRE}>Message reçu</p>
      <p className={TEXTE}>{d.message ?? "(aucun texte dans ce message)"}</p>

      <p className={SOUS_TITRE}>Accusé de réception automatique</p>
      {pannes.accuses ? (
        <p className={TEXTE}>Accusé : lecture impossible.</p>
      ) : a === null || a.etat === "absent" ? (
        <p className={TEXTE}>{a?.absenceVoulue ?? "Aucun accusé trouvé pour ce message."}</p>
      ) : (
        <>
          <p className={TEXTE}>
            {LIBELLE_ETAT_ACCUSE[a.etat]}
            {a.date ? ` · ${jourHeure(a.date)}` : ""}
            {a.motif ? ` · ${a.motif}` : ""}
          </p>
          {a.texte !== null ? (
            <p className={`${TEXTE} text-[color:var(--color-admin-fg-muted)]`}>{a.texte}</p>
          ) : a.raisonSansCopie !== null ? (
            <p className={`${TEXTE} text-[color:var(--color-admin-fg-muted)]`}>
              {a.raisonSansCopie}
            </p>
          ) : null}
        </>
      )}

      <p className={SOUS_TITRE}>Réponses de l&apos;équipe</p>
      {pannes.reponses ? (
        <p className={TEXTE}>Réponses : lecture impossible.</p>
      ) : d.reponses.length === 0 ? (
        <p className={TEXTE}>Aucune réponse envoyée.</p>
      ) : (
        <ul className="space-y-[var(--space-admin-2)]">
          {d.reponses.map((r) => (
            <li key={r.id}>
              <p className={TEXTE}>
                <span className="tabular-nums">{jourHeure(r.date)}</span> · {r.auteur} · {r.etat}
              </p>
              <p className={`${TEXTE} font-semibold`}>{r.sujet}</p>
              {r.texte !== null ? <p className={TEXTE}>{r.texte}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

export function CarteDemandesRecues({
  lu,
  adminPrefix,
}: {
  lu: DemandesLues;
  adminPrefix: string;
}): React.ReactElement | null {
  const { demandes, pannes } = lu;
  if (demandes.length === 0 && !pannes.messages) return null;
  return (
    <section aria-labelledby="demandes-recues" className="admin-carte">
      <h2 id="demandes-recues" className="admin-carte-titre mb-[var(--space-admin-3)]">
        Demandes reçues
      </h2>
      {pannes.messages ? <Panne quoi="Messages" /> : null}
      {demandes.length > 0 ? (
        <ul className="space-y-[var(--space-admin-4)]">
          {demandes.map((d) => (
            <Demande key={d.id} d={d} pannes={pannes} adminPrefix={adminPrefix} />
          ))}
        </ul>
      ) : null}
      {pannes.accuses ? <Panne quoi="Accusés de réception" /> : null}
      {pannes.reponses ? <Panne quoi="Réponses de l'équipe" /> : null}
      {lu.plafondAtteint ? (
        <p className="mt-[var(--space-admin-3)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
          Les {PLAFOND_DEMANDES} demandes les plus récentes sont affichées.
        </p>
      ) : null}
    </section>
  );
}

/**
 * L'emplacement du Résumé : sans le droit sur les échanges, RIEN n'est lu (le rôle est jugé avant
 * toute requête, ici puis dans `lireDemandesDeLaFiche`). Une lecture qui lève devient « lecture
 * impossible », jamais une page cassée.
 */
export async function resumeDemandesRecues(ctx: ContexteFiche): Promise<React.ReactElement | null> {
  if (!ctx.voitEchanges) return null;
  const lu = await lireDemandesDeLaFiche(ctx.clientId, ctx.role).catch((): DemandesLues => ({
    demandes: [],
    plafondAtteint: false,
    pannes: { messages: true, accuses: true, reponses: true },
  }));
  return <CarteDemandesRecues lu={lu} adminPrefix={ctx.adminPrefix} />;
}
