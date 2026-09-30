/**
 * Admin — Dossier client · « Préparer » le prochain échange (chantier visio,
 * PR 3, plan §3.13).
 *
 * Douze blocs, dans l'ordre de `preparer()` : ce qu'il faut avoir en tête avant
 * d'appeler le client — ce qui a été promis, ce qui reste en question, ce qui
 * est à trancher, qui décide sans avoir été rencontré. Rien d'un autre projet
 * (seulement leurs titres).
 *
 * Régime REFUS (décision A2) : `gardeLectureEchanges` est la PREMIÈRE
 * instruction, avant tout accès à la base. Lien de retour vers la fiche client.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { AdminBadge } from "@/components/admin/ui/AdminBadge";
import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import { LigneValeur } from "@/components/admin/dossier-client/Onglets";
import { gardeLectureEchanges } from "@/features/dossier-client/acces";
import {
  LIBELLE_RUBRIQUE,
  LIBELLE_STATUT_PROJET,
  LIBELLE_SUITE,
  LIBELLE_TYPE_FAIT,
  valeurLisible,
} from "@/features/dossier-client/libelles";
import { preparer } from "@/features/dossier-client/preparer";
import type { FaitAConsolider } from "@/features/dossier-client/consolider-faits";
import {
  lireComptesRendusNonValides,
  lireDernierSuivi,
  lireEnregistrementsRefuses,
  lireFaitsDuClient,
  lirePersonnesDuClient,
  lireProjetsDuClient,
  lireQuestionsSansReponse,
} from "@/features/dossier-client/queries";
import { getClient } from "@/server/qualiopi/crm/clients";
import { formatDateFrShort } from "@/lib/format-date-fr";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Dossier client — Préparer | Axion-IA Admin",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string; id: string }>;
  searchParams?: Promise<{ projet?: string; erreur?: string }>;
}

const carteCls =
  "mb-[var(--space-admin-4)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-5)]";
const titreCls =
  "mb-[var(--space-admin-3)] text-[length:var(--text-admin-base)] font-semibold text-[color:var(--color-admin-fg)]";
const mutedCls = "text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]";
const listeCls = "space-y-[var(--space-admin-2)] text-[length:var(--text-admin-sm)]";
const lienCls = "text-[color:var(--color-admin-accent)] underline-offset-2 hover:underline";
const rougeCls = "text-[color:var(--color-admin-error)]";

function Bloc({
  numero,
  titre,
  children,
}: {
  numero: number;
  titre: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <section className={carteCls} data-bloc={numero}>
      <h2 className={titreCls}>
        {numero}. {titre}
      </h2>
      {children}
    </section>
  );
}

function ListeFaits({
  faits,
  vide,
  maintenant,
}: {
  faits: ReadonlyArray<FaitAConsolider>;
  vide: string;
  maintenant: Date;
}): React.ReactElement {
  if (faits.length === 0) return <p className={mutedCls}>{vide}</p>;
  return (
    <ul className={listeCls}>
      {faits.map((f) => {
        const depasse = f.dateCible !== null && f.dateCible.getTime() < maintenant.getTime();
        return (
          <li key={f.id}>
            {valeurLisible(f)}{" "}
            <span className="text-[color:var(--color-admin-fg-muted)]">
              (dit le {formatDateFrShort(f.constateLe)}
              {f.dateCible !== null ? `, pour le ${formatDateFrShort(f.dateCible)}` : ""})
            </span>
            {depasse ? <span className={rougeCls}> dépassé</span> : null}
          </li>
        );
      })}
    </ul>
  );
}

export default async function PreparerPage({ params, searchParams }: PageProps) {
  const { locale, adminPrefix, id } = await params;
  // 🔴 Première instruction : la garde, AVANT toute lecture.
  const acces = await gardeLectureEchanges(`/${locale}/${adminPrefix}/login`);
  const ficheHref = `/${locale}/${adminPrefix}/qualiopi/clients/${id}`;
  if (!acces.autorise) {
    return <AccesRefuse motif={acces.motif} retourHref={ficheHref} />;
  }
  const sp = (await searchParams) ?? {};

  const [client, projets, faits, personnes, questions, comptesRendus, refus] = await Promise.all([
    getClient(id),
    lireProjetsDuClient(id),
    lireFaitsDuClient(id),
    lirePersonnesDuClient(id),
    lireQuestionsSansReponse(id),
    lireComptesRendusNonValides(id),
    lireEnregistrementsRefuses(id),
  ]);
  if (!client) notFound();
  const projetId =
    typeof sp.projet === "string" && projets.some((p) => p.id === sp.projet) ? sp.projet : null;
  const dernierSuivi = await lireDernierSuivi(id, projetId);
  const maintenant = new Date();

  const p = preparer({
    client: { id: client.id, numero: client.numero, raisonSociale: client.raisonSociale },
    projetId,
    projets,
    faits,
    dernierSuivi,
    questionsSansReponse: questions,
    personnes,
    comptesRendusNonValides: comptesRendus,
    enregistrementsRefusesLe: refus,
    maintenant,
  });

  return (
    <AdminPageShell>
      <div className="mb-[var(--space-admin-4)]">
        <Link href={ficheHref} className={`text-[length:var(--text-admin-xs)] ${lienCls}`}>
          ← {client.raisonSociale}
        </Link>
      </div>

      <AdminPageHeader
        title="Préparer le prochain échange"
        meta={<AdminBadge tone="neutral">{client.numero}</AdminBadge>}
      />
      {typeof sp.erreur === "string" && sp.erreur !== "" ? (
        <p className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-error)]">
          {sp.erreur.slice(0, 300)}
        </p>
      ) : null}

      {/* 1 — le client, le projet, la dernière suite convenue */}
      <Bloc
        numero={1}
        titre={p.entete.projet !== null ? p.entete.projet.titre : "Projet non choisi"}
      >
        {p.entete.projet === null ? (
          <p className={mutedCls}>
            Projet non choisi : seules les informations sur l&apos;entreprise sont montrées.
          </p>
        ) : (
          <p className={mutedCls}>
            {p.entete.projet.numero} · {LIBELLE_STATUT_PROJET[p.entete.projet.statut]}
          </p>
        )}
        {p.entete.dernierSuivi !== null ? (
          <p
            className={`mt-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] ${p.entete.suiteDepassee ? rougeCls : ""}`}
          >
            Dernière suite convenue ({p.entete.dernierSuivi.rencontreTitre}) :{" "}
            {p.entete.dernierSuivi.suite !== null
              ? LIBELLE_SUITE[p.entete.dernierSuivi.suite]
              : "—"}
            {p.entete.dernierSuivi.suiteLe !== null
              ? `, pour le ${formatDateFrShort(p.entete.dernierSuivi.suiteLe)}`
              : ""}
            {p.entete.suiteDepassee ? " — dépassée" : ""}
          </p>
        ) : (
          <p className={`mt-[var(--space-admin-2)] ${mutedCls}`}>
            Aucune suite convenue enregistrée.
          </p>
        )}
        {p.entete.autresProjets.length > 0 ? (
          <p className={`mt-[var(--space-admin-2)] ${mutedCls}`}>
            Autres projets :{" "}
            {p.entete.autresProjets.map((o, i) => (
              <span key={o.id}>
                {i > 0 ? " · " : ""}
                <Link href={`${ficheHref}/preparer?projet=${o.id}`} className={lienCls}>
                  {o.titre}
                </Link>{" "}
                ({LIBELLE_STATUT_PROJET[o.statut]})
              </span>
            ))}
          </p>
        ) : null}
      </Bloc>

      <Bloc numero={2} titre="Ce que Williams a promis">
        <ListeFaits
          faits={p.engagementsAxion}
          vide="Aucun engagement en cours."
          maintenant={maintenant}
        />
      </Bloc>

      <Bloc numero={3} titre="Ce que le client a promis">
        <ListeFaits
          faits={p.engagementsClient}
          vide="Aucun engagement en cours."
          maintenant={maintenant}
        />
      </Bloc>

      <Bloc numero={4} titre="Questions restées ouvertes">
        <ListeFaits
          faits={p.questionsOuvertes.faits}
          vide="Aucune question ouverte."
          maintenant={maintenant}
        />
        {p.questionsOuvertes.questionnaire.length > 0 ? (
          <>
            <p className="mt-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] font-medium">
              Envoyées dans un questionnaire, sans réponse :
            </p>
            <ul className={listeCls}>
              {p.questionsOuvertes.questionnaire.map((q) => (
                <li key={q.id}>{q.texte}</li>
              ))}
            </ul>
          </>
        ) : null}
      </Bloc>

      <Bloc numero={5} titre="Objections pas encore levées">
        <ListeFaits
          faits={p.objections}
          vide="Aucune objection en cours."
          maintenant={maintenant}
        />
      </Bloc>

      <Bloc numero={6} titre="À trancher ou à reconfirmer">
        {p.aTrancherOuReconfirmer.length === 0 ? (
          <p className={mutedCls}>Rien à trancher.</p>
        ) : (
          <ul className={listeCls}>
            {p.aTrancherOuReconfirmer.map((v) => (
              <LigneValeur
                key={`${v.type}:${v.cle}`}
                v={v}
                retour={`${ficheHref}/preparer${projetId ? `?projet=${projetId}` : ""}`}
              />
            ))}
          </ul>
        )}
      </Bloc>

      <Bloc numero={7} titre="Décideurs jamais rencontrés">
        {p.decideursJamaisRencontres.length === 0 ? (
          <p className={mutedCls}>Aucun.</p>
        ) : (
          <ul className={listeCls}>
            {p.decideursJamaisRencontres.map((d) => (
              <li key={d.id}>
                {d.nom}
                {d.fonction ? ` (${d.fonction})` : ""}
              </li>
            ))}
          </ul>
        )}
      </Bloc>

      <Bloc numero={8} titre="Jamais abordé">
        {p.rubriquesJamaisAbordees.length === 0 ? (
          <p className={mutedCls}>Toutes les rubriques ont été abordées.</p>
        ) : (
          <p className="text-[length:var(--text-admin-sm)]">
            {p.rubriquesJamaisAbordees
              .map((r) => LIBELLE_RUBRIQUE[r] ?? `rubrique ${r}`)
              .join(", ")}
            .
          </p>
        )}
      </Bloc>

      <Bloc numero={9} titre="Échéance et financement OPCO">
        {p.echeanceProcheAvecOpco === null ? (
          <p className={mutedCls}>Rien à signaler.</p>
        ) : (
          <p className={`text-[length:var(--text-admin-sm)] ${rougeCls}`}>
            Échéance le {formatDateFrShort(p.echeanceProcheAvecOpco.echeance)}, dans{" "}
            {p.echeanceProcheAvecOpco.joursRestants} jours, avec un financement OPCO annoncé : un
            dossier OPCO demande en général plus de {p.echeanceProcheAvecOpco.seuilJours} jours. À
            aborder tout de suite.
          </p>
        )}
      </Bloc>

      <Bloc numero={10} titre="Comptes rendus pas encore validés">
        {p.comptesRendusNonValides.length === 0 ? (
          <p className={mutedCls}>Aucun.</p>
        ) : (
          <ul className={listeCls}>
            {p.comptesRendusNonValides.map((c) => (
              <li key={c.rencontreId}>
                <Link
                  href={`/${locale}/${adminPrefix}/rendez-vous/rencontres/${c.rencontreId}`}
                  className={lienCls}
                >
                  {c.rencontreTitre}
                </Link>{" "}
                <span className="text-[color:var(--color-admin-fg-muted)]">
                  (depuis le {formatDateFrShort(c.depuis)})
                </span>
              </li>
            ))}
          </ul>
        )}
      </Bloc>

      <Bloc numero={11} titre="Enregistrement refusé">
        {p.enregistrementsRefusesLe.length === 0 ? (
          <p className={mutedCls}>Aucun refus connu.</p>
        ) : (
          <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-warning)]">
            Enregistrement refusé le{" "}
            {p.enregistrementsRefusesLe.map((d) => formatDateFrShort(d)).join(", le ")} : ne pas
            proposer d&apos;enregistrer sans le redemander.
          </p>
        )}
      </Bloc>

      <Bloc numero={12} titre="Mise en relation">
        {p.misesEnRelation.length === 0 ? (
          <p className={mutedCls}>Aucune mise en relation annoncée.</p>
        ) : (
          <ul className={listeCls}>
            {p.misesEnRelation.map((f) => (
              <li key={f.id}>
                {LIBELLE_TYPE_FAIT[f.type]} {valeurLisible(f)} — à confirmer de vive voix.
              </li>
            ))}
          </ul>
        )}
      </Bloc>
    </AdminPageShell>
  );
}
