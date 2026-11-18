// Audit présentiel (PR3) : l'écran « Audit » d'une fiche client. Composant SERVEUR (les îlots interactifs
// sont dans ActionsAudit). Aucun prix, aucune durée d'offre, aucun prénom : l'écran ne montre que des postes.

import Link from "next/link";

import { AdminBloc } from "@/components/admin/ui/AdminBloc";
import type { EcranAudit, RapportLu } from "@/server/audit-terrain/lecture";
import type { SessionLue } from "@/server/audit-terrain/vue";
import {
  CreerJeton,
  RafraichirAuto,
  RegenererJeton,
  RevoquerJeton,
  ValiderRapport,
} from "./ActionsAudit";

const TYPE: Record<string, string> = {
  session_ouverte: "Séance ouverte",
  etape_validee: "Étape validée",
  entretien_valide: "Entretien validé",
  audit_termine: "Audit terminé",
  rapport_brouillon: "Brouillon du rapport",
};
const JUSTIF: Record<string, string> = {
  facture: "facture vue",
  confirme: "confirmé",
  verifier: "à vérifier",
};
const REMPLACE: Record<string, string> = { oui: "oui", en_partie: "en partie", non: "non" };

const MOTIF_REFUS: Record<string, string> = {
  trop_gros: "trop_gros : contenu de plus de 64 Ko",
  limite_session: "limite_session : plafond d'événements de la séance atteint",
  source_inconnue: "source_inconnue : brouillon sans source valide",
};
/** Clés d'un brouillon qui peuvent nommer une personne : jamais affichées. */
const CLES_PERSONNELLES = new Set([
  "qui",
  "prenom",
  "prénom",
  "nom_personne",
  "email",
  "mail",
  "telephone",
  "tel",
]);
const fmt = (d: Date | null): string =>
  d === null
    ? "—"
    : d.toLocaleString("fr-FR", {
        timeZone: "Europe/Paris",
        dateStyle: "short",
        timeStyle: "medium",
      });
const heures = (h: number): string =>
  `${h.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} h/sem.`;

export function etatSession(
  s: SessionLue,
  termine: boolean,
  maintenant: Date,
): "revoquee" | "expiree" | "terminee" | "en_cours" {
  if (s.jetonRevoqueLe !== null) return "revoquee";
  if (termine) return "terminee";
  if (s.jetonExpireLe < maintenant) return "expiree";
  return "en_cours";
}
const LIBELLE_ETAT = {
  revoquee: "Jeton révoqué",
  expiree: "Jeton expiré",
  terminee: "Audit terminé",
  en_cours: "En cours",
} as const;

const th =
  "py-[var(--space-admin-1)] pr-[var(--space-admin-3)] text-left text-[length:var(--text-admin-xs)] font-semibold";
const td = "py-[var(--space-admin-1)] pr-[var(--space-admin-3)] align-top";

/** Rendu défensif du brouillon : du texte, jamais du HTML. Profondeur bornée. */
function Contenu({
  valeur,
  niveau = 0,
}: {
  valeur: unknown;
  niveau?: number;
}): React.ReactElement | null {
  if (valeur === null || valeur === undefined || niveau > 4) return null;
  if (typeof valeur === "string")
    return <p className="whitespace-pre-line">{valeur.slice(0, 20_000)}</p>;
  if (typeof valeur === "number" || typeof valeur === "boolean") return <p>{String(valeur)}</p>;
  if (Array.isArray(valeur)) {
    return (
      <ul className="list-disc pl-[var(--space-admin-5)]">
        {valeur.slice(0, 200).map((v, i) => (
          <li key={i}>
            <Contenu valeur={v} niveau={niveau + 1} />
          </li>
        ))}
      </ul>
    );
  }
  if (typeof valeur === "object") {
    return (
      <div className="space-y-[var(--space-admin-2)]">
        {Object.entries(valeur as Record<string, unknown>)
          .filter(([k]) => k !== "source" && !CLES_PERSONNELLES.has(k.toLowerCase()))
          .slice(0, 100)
          .map(([k, v]) => {
            const titre =
              typeof (v as { titre?: unknown } | null)?.titre === "string"
                ? undefined
                : k.replace(/[-_]+/g, " ");
            return (
              <div key={k}>
                {titre !== undefined ? <h4 className="font-medium">{titre}</h4> : null}
                <Contenu valeur={v} niveau={niveau + 1} />
              </div>
            );
          })}
      </div>
    );
  }
  return null;
}

function Rapport({
  rapport,
  clientId,
}: {
  rapport: RapportLu | null;
  clientId: string;
}): React.ReactElement {
  if (rapport === null) {
    return (
      <AdminBloc teinte="gris" titre="Rapport" niveau={2}>
        <p>Pas encore de brouillon : il arrive après « Terminer l&apos;audit » sur le PC.</p>
      </AdminBloc>
    );
  }
  const aRelire = rapport.statut === "a_relire";
  return (
    <AdminBloc
      teinte={aRelire ? "terracotta" : "vert"}
      titre={aRelire ? "Rapport : brouillon à relire" : "Rapport : validé"}
      niveau={2}
    >
      <p className="mb-[var(--space-admin-2)] text-[length:var(--text-admin-sm)]">
        Version {rapport.version} · rédigée par{" "}
        {rapport.source === "claude_code_pc" ? "Claude Code sur le PC" : "le gabarit de secours"} ·
        reçue le {fmt(rapport.creeLe)}
        {rapport.valideLe !== null ? ` · validée le ${fmt(rapport.valideLe)}` : ""}
      </p>
      {rapport.lisible ? (
        <div
          data-bloc="rapport-contenu"
          className="mb-[var(--space-admin-3)] max-w-prose rounded-[var(--radius-admin-sm)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-3)]"
        >
          <Contenu valeur={rapport.contenu} />
        </div>
      ) : (
        <p role="alert" className="mb-[var(--space-admin-3)] text-[color:var(--color-admin-error)]">
          Le brouillon ne peut pas être lu (contenu illisible). Ne le validez pas ; renvoyez-le
          depuis le PC.
        </p>
      )}
      {aRelire && rapport.lisible ? (
        <ValiderRapport rapportId={rapport.id} clientId={clientId} />
      ) : null}
    </AdminBloc>
  );
}

export function PanneauAudit({
  clientId,
  ecran,
  ficheHref,
  maintenant,
}: {
  clientId: string;
  ecran: EcranAudit;
  ficheHref: string;
  maintenant: Date;
}): React.ReactElement {
  const { sessions, courante, vue, rapport } = ecran;
  const etat = courante && vue ? etatSession(courante, vue.termine, maintenant) : null;

  return (
    <div className="space-y-[var(--space-admin-4)]">
      <AdminBloc teinte="bleu" titre="Jeton d'audit" niveau={2} haut>
        <p className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-sm)]">
          Le jeton relie l&apos;outil du PC à cette fiche. Il est affiché une seule fois, à la
          création.
        </p>
        <CreerJeton clientId={clientId} />
        {sessions.length > 0 ? (
          <div className="mt-[var(--space-admin-3)] overflow-x-auto">
            <table className="w-full text-[length:var(--text-admin-sm)]">
              <caption className="sr-only">Séances d&apos;audit de cette fiche</caption>
              <thead>
                <tr>
                  <th scope="col" className={th}>
                    Créée le
                  </th>
                  <th scope="col" className={th}>
                    État
                  </th>
                  <th scope="col" className={th}>
                    Dernier envoi
                  </th>
                  <th scope="col" className={th}>
                    Jeton valable jusqu&apos;au
                  </th>
                  <th scope="col" className={th}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => {
                  const e = etatSession(
                    s,
                    s.id === courante?.id ? (vue?.termine ?? false) : s.statut === "terminee",
                    maintenant,
                  );
                  return (
                    <tr key={s.id}>
                      <td className={td}>{fmt(s.creeLe)}</td>
                      <td className={td}>
                        {LIBELLE_ETAT[e]}
                        {s.id === courante?.id ? " (affichée)" : ""}
                      </td>
                      <td className={td}>{fmt(s.dernierEnvoiLe)}</td>
                      <td className={td}>{fmt(s.jetonExpireLe)}</td>
                      <td className={td}>
                        <span className="inline-flex flex-wrap items-center gap-[var(--space-admin-2)]">
                          {s.id !== courante?.id ? (
                            <Link href={`${ficheHref}/audit?s=${s.id}`} className="admin-link">
                              Afficher
                            </Link>
                          ) : null}
                          {s.jetonRevoqueLe === null ? (
                            <RevoquerJeton clientId={clientId} sessionId={s.id} />
                          ) : null}
                          {s.statut === "ouverte" || s.statut === "revoquee" ? (
                            <RegenererJeton clientId={clientId} sessionId={s.id} />
                          ) : null}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </AdminBloc>

      {courante === null || vue === null || etat === null ? (
        <AdminBloc teinte="gris" titre="Audit" niveau={2}>
          <p>
            Aucun audit pour cette fiche. Créez le jeton ci-dessus, collez-le dans l&apos;outil du
            PC : l&apos;avancement apparaîtra ici dès la première étape validée.
          </p>
        </AdminBloc>
      ) : (
        <>
          <AdminBloc teinte="bleu" titre="Où en est l'audit" niveau={2}>
            <p
              className="text-[length:var(--text-admin-base)] font-semibold"
              data-testid="etape-courante"
            >
              {vue.termine
                ? "Audit terminé"
                : vue.etape === 0
                  ? "Pas encore commencé"
                  : `Étape ${vue.etape} sur ${vue.etapesTotal}`}
              {vue.nomEtape !== "" && !vue.termine ? ` : ${vue.nomEtape}` : ""}
            </p>
            <progress
              className="my-[var(--space-admin-2)] block h-3 w-full max-w-md"
              max={vue.etapesTotal}
              value={vue.termine ? vue.etapesTotal : vue.etape}
              aria-label="Avancement de l'audit"
            />
            <p className="text-[length:var(--text-admin-sm)]">
              {LIBELLE_ETAT[etat]} · dernière réception : {fmt(vue.derniereReception)} ·{" "}
              {vue.nombreEvenements} événement(s) reçu(s)
            </p>
            {vue.trous.length > 0 ? (
              <p
                role="alert"
                className="mt-[var(--space-admin-2)] text-[color:var(--color-admin-warning-fg)]"
              >
                Événements manquants (numéros {vue.trous.join(", ")}) : l&apos;outil du PC les
                renverra à la reconnexion.
              </p>
            ) : null}
            {vue.illisibles > 0 ? (
              <p
                role="alert"
                className="mt-[var(--space-admin-2)] text-[color:var(--color-admin-error)]"
              >
                {vue.illisibles} événement(s) illisible(s) : le détail correspondant n&apos;est pas
                affiché.
              </p>
            ) : null}
            <div className="mt-[var(--space-admin-3)]">
              <RafraichirAuto actif={etat === "en_cours"} />
            </div>
          </AdminBloc>

          <AdminBloc
            teinte="gris"
            titre={`Entretiens par poste (${vue.entretiensValides} validé(s) sur ${vue.postes.length})`}
            niveau={2}
          >
            {vue.postes.length === 0 ? (
              <p>Aucun poste reçu pour l&apos;instant.</p>
            ) : (
              <ul className="space-y-[var(--space-admin-3)]">
                {vue.postes.map((p) => (
                  <li key={p.pid}>
                    <p className="font-medium">
                      {p.poste || "Poste non précisé"} ·{" "}
                      {p.statut === "valide"
                        ? "entretien validé"
                        : p.statut === "absent"
                          ? "poste non couvert"
                          : "entretien en cours"}
                      {p.statut !== "absent" ? ` · ${heures(p.heuresSemaine)}` : ""}
                    </p>
                    {p.taches.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-[length:var(--text-admin-sm)]">
                          <caption className="sr-only">Tâches du poste {p.poste}</caption>
                          <thead>
                            <tr>
                              <th scope="col" className={th}>
                                Tâche
                              </th>
                              <th scope="col" className={th}>
                                Outil
                              </th>
                              <th scope="col" className={th}>
                                Temps déclaré
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {p.taches.map((t, i) => (
                              <tr key={i}>
                                <td className={td}>{t.nom || "—"}</td>
                                <td className={td}>{t.outil || "—"}</td>
                                <td className={td}>{heures(t.heuresSemaine)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </AdminBloc>

          <AdminBloc teinte="gris" titre="Priorités" niveau={2}>
            {vue.priorites.length === 0 ? (
              <p>
                Pas encore de priorité : elles apparaissent après l&apos;étape « Les chiffres ».
              </p>
            ) : (
              <ol className="list-decimal space-y-[var(--space-admin-1)] pl-[var(--space-admin-5)]">
                {vue.priorites.map((p) => (
                  <li key={p.rang}>
                    <span className="font-medium">{p.libelle}</span> ·{" "}
                    {heures(p.heuresRecuperables)} récupérables · postes :{" "}
                    {p.postes.join(", ") || "—"} · risque {p.risque} ·{" "}
                    {p.preuve === "vu" ? "vu sur place" : "dit en entretien"}
                  </li>
                ))}
              </ol>
            )}
          </AdminBloc>

          <AdminBloc teinte="gris" titre="Abonnements" niveau={2}>
            {vue.abonnements.length === 0 ? (
              <p>Aucun abonnement reçu pour l&apos;instant.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[length:var(--text-admin-sm)]">
                  <caption className="sr-only">Abonnements relevés chez le client</caption>
                  <thead>
                    <tr>
                      <th scope="col" className={th}>
                        Abonnement
                      </th>
                      <th scope="col" className={th}>
                        Sert à
                      </th>
                      <th scope="col" className={th}>
                        Usage
                      </th>
                      <th scope="col" className={th}>
                        Remplaçable
                      </th>
                      <th scope="col" className={th}>
                        Justificatif
                      </th>
                      <th scope="col" className={th}>
                        Dernier jour pour résilier
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {vue.abonnements.map((a, i) => (
                      <tr key={i}>
                        <td className={td}>{a.nom || "—"}</td>
                        <td className={td}>{a.sert || "—"}</td>
                        <td className={td}>
                          {a.usage || "—"}
                          {a.doublon ? ` · doublon : ${a.doublon}` : ""}
                        </td>
                        <td className={td}>{REMPLACE[a.remplace] ?? a.remplace}</td>
                        <td className={td}>{JUSTIF[a.justificatif] ?? a.justificatif}</td>
                        <td className={td}>{a.limiteResiliation || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </AdminBloc>

          <Rapport rapport={rapport} clientId={clientId} />

          <AdminBloc teinte="gris" titre="Journal de réception" niveau={2}>
            {ecran.refus.length > 0 ? (
              <div
                role="status"
                className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-sm)]"
              >
                <p className="font-medium">Événements refusés par la console</p>
                <ul className="list-disc pl-[var(--space-admin-5)]">
                  {ecran.refus.map((r, i) => (
                    <li key={i}>
                      {fmt(r.le)} : {r.rejetes} refusé(s)
                      {r.motifs.length > 0
                        ? ` (${r.motifs.map((m) => MOTIF_REFUS[m] ?? m).join(" ; ")})`
                        : " (motif non conservé)"}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {vue.journal.length === 0 ? (
              <p>Rien reçu pour l&apos;instant.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[length:var(--text-admin-sm)]">
                  <caption className="sr-only">
                    Derniers événements reçus, du plus récent au plus ancien
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col" className={th}>
                        N°
                      </th>
                      <th scope="col" className={th}>
                        Type
                      </th>
                      <th scope="col" className={th}>
                        Étape
                      </th>
                      <th scope="col" className={th}>
                        Heure sur le PC
                      </th>
                      <th scope="col" className={th}>
                        Reçu le
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {vue.journal.map((l) => (
                      <tr key={l.seq}>
                        <td className={td}>{l.seq}</td>
                        <td className={td}>
                          {TYPE[l.type] ?? l.type}
                          {l.illisible ? " (illisible)" : ""}
                        </td>
                        <td className={td}>{l.etape || "—"}</td>
                        <td className={td}>{fmt(l.heurePc)}</td>
                        <td className={td}>{fmt(l.recuLe)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </AdminBloc>
        </>
      )}
    </div>
  );
}
