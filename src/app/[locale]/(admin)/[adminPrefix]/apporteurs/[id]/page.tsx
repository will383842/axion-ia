// Réseau d'apporteurs (démarrage manuel, 2026-10-05) — la FICHE d'un apporteur :
// son dossier, ses pièces à vérifier, la décision (oui / à compléter / non), son contrat,
// les entreprises qu'il a présentées (avec la date d'ajout), ses commissions, son parrain.

import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminCard, AdminPageHeader } from "@/components/admin/ui";
import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import { EnvoiLienDossier, ParrainEtNote } from "@/components/admin/apporteurs/fiche/BlocsFiche";
import { CorrigerNom } from "@/components/admin/apporteurs/fiche/CorrigerNom";
import { DecisionDossier } from "@/components/admin/apporteurs/fiche/DecisionDossier";
import { RetraitDuReseau } from "@/components/admin/apporteurs/fiche/RetraitDuReseau";
import { etatSuppression, refusSuppression, retraitDe } from "@/features/apporteurs-reseau/retrait";
import { dateFr } from "@/features/apporteurs-reseau/autofacture-donnees";
import {
  enPreavis,
  lireResiliation,
  preavisEchu,
  preavisJours,
  versionDuContrat,
} from "@/features/apporteurs-reseau/preavis";
import {
  CumulVigilance,
  FinDeVie,
  SoldeNegatifFiche,
} from "@/components/admin/apporteurs/fiche/FinDeVieEtVigilance";
import { lireSoldeNegatif } from "@/features/apporteurs-reseau/solde-negatif";
import { siretDe } from "@/features/apporteurs-reseau/siret-apporteur";
import {
  PiecesVerification,
  type PieceAffichee,
} from "@/components/admin/apporteurs/fiche/PiecesVerification";
import {
  LIBELLE_STATUT_APPORTEUR,
  lireFicheApporteur,
} from "@/features/apporteurs-reseau/requetes-console";
import { STATUTS_JURIDIQUES, euros } from "@/features/apporteurs-reseau/regles";
import { CLE_REGISTRE_INDISPONIBLE } from "@/features/apporteurs-reseau/signature-regles";
import { gardePage } from "@/server/auth/garde-page";
import { peutOuvrirDossierApporteur } from "@/server/auth/habilitations";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string; id: string }>;
  searchParams: Promise<{
    retour?: string;
    erreur?: string;
    retrait?: string;
    retraitErreur?: string;
  }>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const jour = (d: Date) =>
  d.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Europe/Paris",
  });
const jourHeure = (d: Date) =>
  `${jour(d)} à ${d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" })}`;

const LIBELLE_PRESENTATION: Record<string, string> = {
  reservee: "Réservée, en attente de réponse",
  confirmee: "Protégée",
  deja_connue: "Déjà connue",
  hors_champ: "Hors champ",
  dementie: "Démentie par l'entreprise",
  terminee: "Terminée",
};

const LIBELLE_COMMISSION: Record<string, string> = {
  a_qualifier: "À qualifier",
  due: "À verser",
  en_attente_vigilance: "En attente des pièces URSSAF",
  versee: "Versée",
  reprise: "Reprise",
  annulee: "Annulée",
  retenue: "Retenue (manquement, avoir émis)",
};

function Ligne({ libelle, valeur }: { libelle: string; valeur: React.ReactNode }) {
  return (
    <div className="flex flex-wrap justify-between gap-[var(--space-admin-2)] border-b border-[color:var(--color-admin-border)] py-[var(--space-admin-2)] last:border-b-0">
      <span className="text-[color:var(--color-admin-fg-muted)]">{libelle}</span>
      <span className="text-right font-medium">{valeur ?? "—"}</span>
    </div>
  );
}

export default async function FicheApporteurPage({ params, searchParams }: PageProps) {
  const { adminPrefix, id } = await params;
  const { retour, erreur, retrait, retraitErreur } = await searchParams;
  const acces = await gardePage("consultation", `/fr/${adminPrefix}/login`);
  if (!acces.autorise) return <AccesRefuse motif={acces.motif} retourHref={`/fr/${adminPrefix}`} />;
  if (!UUID.test(id)) notFound();
  const fiche = await lireFicheApporteur(id.toLowerCase());
  if (!fiche) notFound();
  const { dossier: d } = fiche;
  const base = `/fr/${adminPrefix}/apporteurs`;
  const aVerifier = d.statut === "a_verifier";
  // Retirer / supprimer (2026-10-07) : l'état se relit ici, les contrôles se refont au serveur.
  const [retireAt, etatSuppr, solde, siret, resiliation] = await Promise.all([
    retraitDe(d.id),
    etatSuppression(d.id),
    lireSoldeNegatif(d.id),
    siretDe(d.id),
    lireResiliation(d.id),
  ]);
  // Contrat 2.7, art. 11.1 : résiliation en cours de préavis, et préavis d'une résiliation par la
  // Société notifiée aujourd'hui (selon la version signée et l'ancienneté).
  const maintenant = new Date();
  const preavis = enPreavis(resiliation)
    ? {
        par: resiliation.par,
        notifieeLe: dateFr(resiliation.notifieeAt),
        finLe: dateFr(resiliation.finAt),
        preavisJours: resiliation.preavisJours,
        echu: preavisEchu(resiliation.finAt, maintenant),
      }
    : null;
  const preavisSociete = preavisJours({
    par: "societe",
    version: versionDuContrat(fiche.signature),
    priseEffet: d.signeParSocieteAt,
    notifieeLe: maintenant,
  });
  const refusSuppr = etatSuppr ? refusSuppression(etatSuppr) : "Dossier introuvable.";
  // Un compte de consultation (`reader`) ne lit pas les données personnelles de l'apporteur.
  const voitPii = peutOuvrirDossierApporteur(acces.role);
  const MASQUE = "Réservé aux rôles autorisés";
  const purgees = new Set(fiche.piecesPurgeesIds);
  const pieces: PieceAffichee[] = d.pieces.map((p) => ({
    id: p.id,
    type: p.type,
    statut: p.statut,
    motif: p.motif,
    nomFichier: p.nomFichier,
    deposeeLe: jour(p.deposeeAt),
    purgee: purgees.has(p.id),
    lienOuvrir: `${base}/${d.id}/pieces/${p.id}`,
  }));
  const statut =
    STATUTS_JURIDIQUES.find((s) => s.valeur === d.statutJuridique)?.libelle ?? d.statutJuridique;
  const totalVerse = fiche.commissions
    .filter((c) => c.statut === "versee")
    .reduce((s, c) => s + (c.montantCents ?? 0), 0);
  const totalDu = fiche.commissions
    .filter((c) => c.statut === "due" || c.statut === "en_attente_vigilance")
    .reduce((s, c) => s + (c.montantCents ?? 0), 0);

  return (
    <div className="flex flex-col gap-[var(--space-admin-5)]">
      <AdminPageHeader
        title={`${d.prenom} ${d.nom}`.trim() || "Apporteur"}
        {...(d.denomination ? { description: d.denomination } : {})}
        meta={<span className="font-semibold">{LIBELLE_STATUT_APPORTEUR[d.statut]}</span>}
        actions={
          <Link href={base} className="admin-button-secondary">
            Tous les apporteurs
          </Link>
        }
      />

      {aVerifier ? (
        <AdminCard as="section" elevation={2}>
          <h2 className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-lg)] font-semibold">
            Dossier signé : à vérifier
          </h2>
          <p className="mb-[var(--space-admin-3)] text-[color:var(--color-admin-fg-muted)]">
            Vérifiez chaque pièce, relisez le contrat signé, puis choisissez.
          </p>
          <DecisionDossier apporteurId={d.id} />
        </AdminCard>
      ) : null}

      {d.statut === "a_completer" && d.dernierMessage ? (
        <AdminCard as="section">
          <strong>Complément demandé :</strong> {d.dernierMessage}
        </AdminCard>
      ) : null}

      <div className="grid gap-[var(--space-admin-4)] lg:grid-cols-2">
        <AdminCard as="section">
          <h2 className="mb-[var(--space-admin-2)] font-semibold">Identité et activité</h2>
          <Ligne libelle="E-mail" valeur={voitPii ? d.email : MASQUE} />
          <Ligne libelle="Téléphone" valeur={voitPii ? d.telephone : MASQUE} />
          <Ligne libelle="SIREN" valeur={d.siren} />
          {siret ? <Ligne libelle="SIRET de l'établissement" valeur={siret} /> : null}
          <Ligne libelle="Entreprise" valeur={d.denomination} />
          <Ligne libelle="Adresse" valeur={voitPii ? d.adresse : MASQUE} />
          <Ligne libelle="Statut" valeur={statut} />
          {/* Contrat 2.7, art. 14 : la qualité déclarée au dossier. */}
          {d.siegeAdresse ? (
            <Ligne libelle="Adresse du siège" valeur={voitPii ? d.siegeAdresse : MASQUE} />
          ) : null}
          {d.fonctionSignataire ? (
            <Ligne libelle="Fonction du signataire" valeur={d.fonctionSignataire} />
          ) : null}
          {d.immatriculeRcs != null ? (
            <Ligne
              libelle="Immatriculé au RCS"
              valeur={d.immatriculeRcs ? "Oui (commerçant)" : "Non (non commerçant)"}
            />
          ) : null}
          <Ligne libelle="Code NAF" valeur={d.codeNaf} />
          {/* Correction du nom (2026-10-08) : tant que le contrat n'est pas signé ; droit
              « contresigner » et contrat signé revérifiés côté serveur. */}
          {voitPii && !d.signeParApporteurAt ? (
            <CorrigerNom apporteurId={d.id} prenom={d.prenom} nom={d.nom} />
          ) : null}
          {CLE_REGISTRE_INDISPONIBLE in d.declarations ? (
            <Ligne
              libelle="À contrôler"
              valeur={
                <span className="rounded-[var(--radius-admin-md)] bg-[color:var(--color-admin-warning-soft)] px-[var(--space-admin-2)] font-semibold text-[color:var(--color-admin-warning-fg)]">
                  Registre indisponible : vérifier le SIREN, l&apos;activité et le NAF à la main
                </span>
              }
            />
          ) : null}
          <Ligne
            libelle="TVA"
            valeur={
              d.regimeTva === "assujetti"
                ? `Facture la TVA (${d.numeroTva ?? "numéro manquant"})`
                : d.regimeTva
                  ? "Ne facture pas la TVA (293 B)"
                  : null
            }
          />
          <Ligne
            libelle="IBAN"
            valeur={voitPii ? d.ibanMasque : d.ibanMasque ? "•••• •••• ••••" : null}
          />
        </AdminCard>

        <AdminCard as="section">
          <h2 className="mb-[var(--space-admin-2)] font-semibold">Pièces</h2>
          {voitPii ? (
            <PiecesVerification
              apporteurId={d.id}
              pieces={pieces}
              modifiable={aVerifier || d.statut === "signe"}
            />
          ) : (
            <p className="text-[color:var(--color-admin-fg-muted)]">
              {pieces.length} pièce(s) au dossier. L&apos;accès aux pièces est réservé aux rôles
              autorisés.
            </p>
          )}
        </AdminCard>

        <AdminCard as="section">
          <h2 className="mb-[var(--space-admin-2)] font-semibold">Contrat</h2>
          <Ligne
            libelle="Signé par l'apporteur"
            valeur={d.signeParApporteurAt ? jourHeure(d.signeParApporteurAt) : null}
          />
          <Ligne
            libelle="Contresigné"
            valeur={d.signeParSocieteAt ? jourHeure(d.signeParSocieteAt) : null}
          />
          {/* Relecture de a1 (08/10) : la version du texte RÉELLEMENT signé par cet apporteur,
              lue dans sa signature archivée — pas la dernière version publiée. */}
          <Ligne
            libelle="Version signée"
            valeur={
              typeof fiche.signature?.["version"] === "string"
                ? `Contrat ${fiche.signature["version"]}`
                : null
            }
          />
          <div className="mt-[var(--space-admin-3)] flex flex-wrap gap-[var(--space-admin-2)]">
            {voitPii && fiche.aContratApporteur ? (
              <a
                className="admin-button-secondary"
                href={`${base}/${d.id}/contrat?quel=apporteur`}
                target="_blank"
                rel="noreferrer"
              >
                Contrat signé par l&apos;apporteur
              </a>
            ) : null}
            {voitPii && fiche.aContratSigne ? (
              <a
                className="admin-button-secondary"
                href={`${base}/${d.id}/contrat?quel=signe`}
                target="_blank"
                rel="noreferrer"
              >
                Contrat signé des deux parties
              </a>
            ) : null}
          </div>
          {d.statut === "dossier_en_cours" || d.statut === "a_completer" || d.statut === "signe" ? (
            <div className="mt-[var(--space-admin-4)]">
              <EnvoiLienDossier
                apporteurId={d.id}
                contratSigne={d.statut === "signe" && fiche.aContratSigne}
                lienPossible={d.statut !== "signe"}
              />
            </div>
          ) : null}
        </AdminCard>

        <AdminCard as="section">
          <h2 className="mb-[var(--space-admin-2)] font-semibold">Parrainage et note</h2>
          {fiche.filleuls.length > 0 ? (
            <p className="mb-[var(--space-admin-2)] text-[length:var(--text-admin-sm)]">
              Filleuls :{" "}
              {fiche.filleuls.map((f, i) => (
                <span key={f.id}>
                  {i > 0 ? ", " : ""}
                  <Link href={`${base}/${f.id}`} className="underline">
                    {f.nom}
                  </Link>
                </span>
              ))}
            </p>
          ) : null}
          <ParrainEtNote
            apporteurId={d.id}
            parrainId={fiche.parrainId}
            parrainsPossibles={fiche.parrainsPossibles}
            note={fiche.noteInterne}
          />
        </AdminCard>
      </div>

      <AdminCard as="section">
        <div className="mb-[var(--space-admin-3)] flex flex-wrap items-center justify-between gap-[var(--space-admin-2)]">
          <h2 className="font-semibold">Entreprises présentées ({fiche.entreprises.length})</h2>
          <Link href={`${base}/entreprises`} className="admin-button-secondary">
            Ajouter une entreprise présentée
          </Link>
        </div>
        {fiche.entreprises.length === 0 ? (
          <p className="text-[color:var(--color-admin-fg-muted)]">
            Aucune entreprise présentée pour l&apos;instant.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[length:var(--text-admin-sm)]">
              <thead>
                <tr className="text-[color:var(--color-admin-fg-muted)]">
                  <th className="py-[var(--space-admin-2)] pr-[var(--space-admin-3)]">
                    Ajoutée le
                  </th>
                  <th className="py-[var(--space-admin-2)] pr-[var(--space-admin-3)]">
                    Entreprise
                  </th>
                  <th className="py-[var(--space-admin-2)] pr-[var(--space-admin-3)]">État</th>
                  <th className="py-[var(--space-admin-2)]">Protégée jusqu&apos;au</th>
                </tr>
              </thead>
              <tbody>
                {fiche.entreprises.map((e) => (
                  <tr key={e.id} className="border-t border-[color:var(--color-admin-border)]">
                    <td className="py-[var(--space-admin-2)] pr-[var(--space-admin-3)]">
                      {jourHeure(e.recueAt)}
                    </td>
                    <td className="py-[var(--space-admin-2)] pr-[var(--space-admin-3)]">
                      <strong>{e.denomination}</strong>
                      <div className="text-[color:var(--color-admin-fg-muted)]">{e.siren}</div>
                    </td>
                    <td className="py-[var(--space-admin-2)] pr-[var(--space-admin-3)]">
                      {LIBELLE_PRESENTATION[e.statut] ?? e.statut}
                      {e.prolongeeAt ? " (prolongée)" : ""}
                    </td>
                    <td className="py-[var(--space-admin-2)]">
                      {e.protegeeJusquAt ? jour(e.protegeeJusquAt) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminCard>

      <div className="grid gap-[var(--space-admin-4)] lg:grid-cols-2">
        <CumulVigilance v={fiche.vigilance} />
        {solde ? <SoldeNegatifFiche s={solde} /> : null}
        <FinDeVie
          apporteurId={d.id}
          signe={d.statut === "signe"}
          preavis={preavis}
          preavisSociete={preavisSociete}
          retour={retour?.slice(0, 400)}
          erreur={erreur?.slice(0, 400)}
          versees={fiche.commissions
            .filter((c) => c.statut === "versee" && (c.montantCents ?? 0) > 0)
            .map((c) => ({
              id: c.id,
              libelle: `${c.verseeAt ? jour(c.verseeAt) : jour(c.creeAt)} · ${c.parrainage ? "Parrainage" : c.activite}`,
              montantCents: c.montantCents ?? 0,
            }))}
        />
      </div>

      <RetraitDuReseau
        apporteurId={d.id}
        nomComplet={`${d.prenom} ${d.nom}`.trim()}
        signe={d.statut === "signe"}
        retireLe={retireAt ? jour(retireAt) : null}
        refusSuppression={refusSuppr}
        retour={
          retrait
            ? { ok: true, message: retrait.slice(0, 400) }
            : retraitErreur
              ? { ok: false, message: retraitErreur.slice(0, 400) }
              : null
        }
      />

      <AdminCard as="section">
        <div className="mb-[var(--space-admin-3)] flex flex-wrap items-center justify-between gap-[var(--space-admin-2)]">
          <h2 className="font-semibold">
            Commissions · à verser {euros(totalDu)} · versé {euros(totalVerse)}
          </h2>
          <Link href={`${base}/commissions`} className="admin-button-secondary">
            Toutes les commissions
          </Link>
        </div>
        {fiche.commissions.length === 0 ? (
          <p className="text-[color:var(--color-admin-fg-muted)]">
            Aucune commission pour l&apos;instant.
          </p>
        ) : (
          <ul className="flex flex-col gap-[var(--space-admin-1)] text-[length:var(--text-admin-sm)]">
            {fiche.commissions.map((c) => (
              <li key={c.id} className="flex flex-wrap justify-between gap-[var(--space-admin-2)]">
                <span>
                  {jour(c.creeAt)} · {c.parrainage ? "Parrainage" : c.activite}
                  {c.palier ? ` (${c.palier})` : ""} · facture {euros(c.factureHtCents)} HT
                </span>
                <span className="font-semibold">
                  {c.montantCents !== null ? euros(c.montantCents) : "—"} ·{" "}
                  {LIBELLE_COMMISSION[c.statut] ?? c.statut}
                </span>
                {c.statut === "due" && c.autofactureAttenteMotif ? (
                  <span className="w-full" style={{ color: "var(--color-admin-warning)" }}>
                    Autofacture en attente : il manque {c.autofactureAttenteMotif}. Elle partira
                    d&apos;elle-même dans l&apos;heure une fois la fiche complétée.
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </AdminCard>
    </div>
  );
}
