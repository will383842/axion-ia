/**
 * Admin — Qualiopi · Registre des signatures (phase 8).
 *
 * Répond, pièce par pièce, à la question qu'un contrôle pose réellement :
 * « cette pièce est-elle signée, par qui, et sa preuve tient-elle ? ».
 *
 * ## Server Component PUR — aucun JS client
 *
 * Le registre est de la lecture. Le rendre interactif tirerait un bundle sur une
 * page consultée trois fois par an, pour un gain nul : les filtres utiles
 * (session, statut, anomalies seules) sont des paramètres d'URL, que le serveur
 * sait lire sans une ligne de JavaScript.
 *
 * ## Ce que cet écran refuse de faire
 *
 * 🔴 Il ne RÉPARE rien. Ni un cache divergent, ni une chaîne rompue. Une anomalie
 * est un RÉSULTAT à présenter, pas une panne à masquer — c'est déjà la doctrine
 * de `verifierChaine`, qui ne lève jamais, et le registre s'y tient.
 *
 * 🔴 Il montre le statut RECALCULÉ et le statut CACHE **côte à côte**. Le cache
 * est ce que la base croit ; les lignes de signature sont ce qui est. N'afficher
 * que le cache reviendrait à présenter comme un audit ce qui n'est qu'une
 * relecture de la valeur qu'on cherche justement à contrôler.
 */

import type { Metadata } from "next";
import Link from "next/link";

import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import {
  listerRegistreSignatures,
  type RapportPieceSignature,
} from "@/server/qualiopi/documents/signature/registre-verification";
import { revoquerSignatureAction } from "@/server/actions/qualiopi/signature-revocation";
import { nomPartie } from "@/server/qualiopi/documents/signature/parties-labels";
import { LIBELLE_ANOMALIE_CHAINE } from "@/server/qualiopi/emargement/chaine-labels";
import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import { gardePage } from "@/server/auth/garde-page";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Qualiopi — Registre des signatures | Axion-IA Admin",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string }>;
  searchParams: Promise<{
    anomalies?: string;
    session?: string;
    revocation?: string;
    raison?: string;
  }>;
}

const LIBELLE_STATUT: Readonly<Record<string, string>> = {
  non_requise: "Non requise",
  en_attente: "En attente",
  partielle: "Partielle",
  signee: "Signée",
  refusee: "Refusée",
  expiree: "Expirée",
};

/**
 * Libellés des anomalies, en clair.
 *
 * ⚠️ Un code machine dans un dossier d'audit ne dit rien à qui le lit. Chaque
 * libellé énonce le FAIT constaté, pas le nom de la règle qui l'a détecté.
 */
const LIBELLE_ANOMALIE: Readonly<Record<string, string>> = {
  pdf_regenere_apres_signature:
    "Le PDF a été régénéré après signature : la signature ne porte plus sur la pièce servie aujourd'hui.",
  parties_sur_versions_differentes:
    "Les parties n'ont pas signé la même version du PDF : aucune version n'a été acceptée par toutes.",
  statut_cache_divergent:
    "Le statut enregistré sur la pièce ne correspond pas à ses lignes de signature.",
  signature_sur_piece_non_signable:
    "Une signature porte sur un type de pièce qu'aucun circuit ne déclare signable.",
  partie_hors_circuit: "Une partie a signé alors que le circuit de cette pièce ne l'attend pas.",
};

// Les six libellés vivent dans chaine-labels.ts : le registre AFEST les
// affichait bruts faute de les partager.
const LIBELLE_CHAINE = LIBELLE_ANOMALIE_CHAINE;

/**
 * 🔴 LE REGISTRE QUE LIT L'AUDITRICE DÉCRIVAIT SES SIGNATAIRES EN VALEURS
 * D'ENUM. Chaque ligne se lisait « sous_traitant · 03/08/2026 14:12 ·
 * confirmation_accessible · interne » — trois codes machine côte à côte, sur
 * la page dont dépend la preuve. Le fichier traduisait pourtant méticuleusement
 * les statuts, les anomalies et le chaînage juste au-dessus : ces trois-là
 * avaient simplement été oubliés.
 */
const LIBELLE_METHODE: Readonly<Record<string, string>> = {
  trace: "Signature tracée",
  papier_scanne: "Papier signé puis numérisé",
  confirmation_accessible: "Confirmation accessible",
};

const LIBELLE_PROVIDER: Readonly<Record<string, string>> = {
  docuseal: "DocuSeal",
  manual_upload: "Dépôt manuel",
  physical_signed: "Signature physique",
  interne: "Signature interne",
};

const LIBELLE_TYPE_PIECE: Readonly<Record<string, string>> = {
  convention_formation: "Convention de formation",
  convention_tripartite: "Convention tripartite",
  contrat_formation: "Contrat de formation",
  attestation_assiduite: "Attestation d'assiduité",
  attestation_fin_formation: "Attestation de fin de formation",
  certificat_realisation: "Certificat de réalisation",
  feuille_emargement: "Feuille d'émargement",
  protocole_afest: "Protocole AFEST",
  lettre_mission: "Lettre de mission",
  devis: "Devis",
};

/**
 * Horodatage en heure de PARIS, jamais UTC.
 *
 * Un auditeur recoupe ce registre avec des pièces papier et des agendas
 * français : lui présenter une heure UTC lui ferait constater un décalage de
 * deux heures en été, sur des signatures parfaitement régulières.
 */
const horodatageParis = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Europe/Paris",
});

function Compteur({
  valeur,
  libelle,
  alerte,
}: {
  valeur: number;
  libelle: string;
  alerte?: boolean;
}): React.ReactElement {
  return (
    <div className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-4)]">
      <p
        className={
          alerte === true && valeur > 0
            ? "text-[length:var(--text-admin-2xl)] font-semibold text-[color:var(--color-admin-danger)]"
            : "text-[length:var(--text-admin-2xl)] font-semibold text-[color:var(--color-admin-fg)]"
        }
      >
        {valeur}
      </p>
      <p className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
        {libelle}
      </p>
    </div>
  );
}

/**
 * Retour de la révocation, traduit d'un CODE.
 *
 * ⚠️ Jamais le message brut de l'URL : un texte libre repris d'un paramètre et
 * réaffiché est une injection en puissance. La page traduit, elle ne recopie pas.
 */
const MESSAGE_REVOCATION: Readonly<Record<string, string>> = {
  ok: "Signature révoquée. La ligne reste en base avec son empreinte : une preuve retirée du décompte n'est pas une preuve effacée.",
  role_insuffisant:
    "Révoquer une signature engage l'organisme : seuls un administrateur ou le dirigeant peuvent le faire.",
  demande_invalide:
    "Le motif de révocation est obligatoire : sans lui, le registre ne dit rien à l'auditeur.",
  refus_service: "Révocation refusée.",
};

const DETAIL_REFUS: Readonly<Record<string, string>> = {
  revocation_maillon_interne_interdite:
    "Cette signature n'est pas la dernière apposée sur la pièce : la révoquer romprait le chaînage et ferait apparaître le registre comme falsifié. Révoquez d'abord les signatures postérieures, puis re-signez dans l'ordre.",
  deja_revoquee: "Cette signature est déjà révoquée.",
  signature_introuvable: "Signature introuvable.",
  motif_requis: "Le motif est obligatoire.",
  porteur_non_autorise: "Vous n'êtes pas habilité à révoquer une signature.",
};

function LignePiece({
  piece,
  cheminRetour,
}: {
  piece: RapportPieceSignature;
  cheminRetour: string;
}): React.ReactElement {
  const anomaliesChaine = piece.chaine.anomalies;
  return (
    <tr className="border-b border-[color:var(--color-admin-border)] align-top last:border-b-0">
      <td className="p-[var(--space-admin-3)]">
        {/* 🔴 Le numéro était un `span` : l'auditrice ne pouvait ouvrir AUCUNE
            pièce depuis le registre. L'identifiant était pourtant là — il servait
            de clé React, et de rien d'autre.
            La page conseille elle-même de restreindre le registre à une session
            « pour obtenir une vue exhaustive » ; encore faut-il pouvoir regarder
            les pièces qu'elle liste. */}
        <a
          href={`/api/qualiopi/documents/${piece.documentGenereId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-accent)] underline underline-offset-2 hover:opacity-80"
          aria-label={`Ouvrir la pièce ${piece.numero}`}
        >
          {piece.numero}
        </a>
        <span className="block text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
          {LIBELLE_TYPE_PIECE[piece.type] ?? piece.type}
        </span>
        {/* 🔴 Une pièce annulée RESTE au registre : la signature a eu lieu, et
            l'effacer masquerait qu'on a signé puis annulé — exactement ce qu'un
            auditeur veut voir. Mais elle doit le DIRE : sans ce marquage, elle
            se présente comme une pièce signée valable, « preuve intacte » à
            l'appui, alors qu'on l'a déclarée sans valeur. La preuve, elle, EST
            intacte : les deux questions sont distinctes. */}
        {piece.annuleeAt !== null ? (
          <>
            <span className="mt-[var(--space-admin-1)] inline-block rounded-[var(--radius-admin-sm)] bg-[color:var(--color-admin-destructive-soft)] px-[var(--space-admin-2)] py-[2px] text-[length:var(--text-admin-xs)] font-semibold tracking-wide text-[color:var(--color-admin-destructive-fg)] uppercase">
              Annulée
            </span>
            <span className="block text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
              {`Annulée le ${new Date(piece.annuleeAt).toLocaleDateString("fr-FR")}`}
              {piece.annuleeMotif ? ` — ${piece.annuleeMotif}` : ""}
            </span>
          </>
        ) : null}
      </td>
      <td className="p-[var(--space-admin-3)] text-[length:var(--text-admin-xs)]">
        {/* Recalculé d'abord : c'est lui qui dit la vérité. */}
        <span className="font-semibold">
          {LIBELLE_STATUT[piece.statutRecalcule] ?? piece.statutRecalcule}
        </span>
        {piece.statutRecalcule !== piece.statutCache ? (
          <span className="block text-[color:var(--color-admin-danger)]">
            {`enregistré : ${LIBELLE_STATUT[piece.statutCache] ?? piece.statutCache}`}
          </span>
        ) : null}
      </td>
      <td className="p-[var(--space-admin-3)] text-[length:var(--text-admin-xs)]">
        {piece.signataires.length === 0 ? (
          <span className="text-[color:var(--color-admin-fg-muted)]">Aucune signature</span>
        ) : (
          <ul className="space-y-2">
            {piece.signataires.map((s) => {
              // 🔴 L'écart `signeAt` ↔ `createdAt` est la SEULE trace d'une
              // signature insérée tardivement. Le registre expose les deux
              // horodatages précisément pour cela ; n'en afficher qu'un rendrait
              // l'exposition inutile. Seuil d'une minute : en deçà c'est le temps
              // d'écriture de l'image sur R2, au-delà c'est une information.
              const ecartMs = s.createdAt.getTime() - s.signeAt.getTime();
              const insertionTardive = Math.abs(ecartMs) > 60_000;
              return (
                <li key={s.signatureId}>
                  {/* Jamais « signé » tout court : qui, à quel titre, quand, comment. */}
                  <span className="font-medium">{s.signataireNom}</span>
                  {s.signataireQualite !== null ? ` (${s.signataireQualite})` : ""}
                  <span className="block text-[color:var(--color-admin-fg-muted)]">
                    {`${nomPartie(s.partie)} · ${horodatageParis.format(s.signeAt)} · ${LIBELLE_METHODE[s.methode] ?? s.methode} · ${LIBELLE_PROVIDER[s.provider] ?? s.provider}`}
                  </span>
                  {insertionTardive ? (
                    <span className="block text-[color:var(--color-admin-danger)]">
                      {`Enregistrée le ${horodatageParis.format(s.createdAt)} — écart avec la date de signature déclarée.`}
                    </span>
                  ) : null}
                  {!s.porteSurLePdfCourant ? (
                    <span className="block text-[color:var(--color-admin-danger)]">
                      Ne porte plus sur le PDF servi aujourd&apos;hui.
                    </span>
                  ) : null}
                  {/*
                    La révocation est la SEULE correction possible sur un
                    registre append-only. Sans cette surface, une signature
                    posée par erreur était définitive, et l'index unique partiel
                    `WHERE revoked_at IS NULL` — celui qui autorise à re-signer —
                    ne pouvait jamais servir.

                    ⚠️ `<form action>` sans « use client » : zéro JavaScript.
                    Le service refuse de lui-même un maillon non terminal, un
                    motif vide et un compte non habilité — cet écran ne relâche
                    rien, il rend seulement ces règles atteignables.
                  */}
                  <form action={revoquerSignatureAction} className="mt-1 flex gap-1">
                    <input type="hidden" name="signatureId" value={s.signatureId} />
                    <input type="hidden" name="retour" value={cheminRetour} />
                    <input
                      type="text"
                      name="motif"
                      required
                      maxLength={500}
                      placeholder="Motif de révocation (obligatoire)"
                      aria-label={`Motif de révocation de la signature de ${s.signataireNom}`}
                      className="flex-1 rounded border border-[color:var(--color-admin-border)] px-1 py-0.5 text-[length:var(--text-admin-xs)]"
                    />
                    <button
                      type="submit"
                      className="rounded border border-[color:var(--color-admin-danger)] px-2 py-0.5 text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-danger)]"
                    >
                      Révoquer
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
        {piece.partiesManquantes.length > 0 ? (
          <span className="block text-[color:var(--color-admin-fg-muted)]">
            {`Manque : ${piece.partiesManquantes.map((p) => nomPartie(p)).join(", ")}`}
          </span>
        ) : null}
      </td>
      <td className="p-[var(--space-admin-3)] text-[length:var(--text-admin-xs)]">
        {piece.preuveIntacte ? (
          <span className="text-[color:var(--color-admin-success)]">Preuve intacte</span>
        ) : (
          <ul className="text-[color:var(--color-admin-danger)]">
            {anomaliesChaine.map((a, i) => (
              <li key={`c${i}`}>{LIBELLE_CHAINE[a.type] ?? a.type}</li>
            ))}
            {piece.anomaliesPiece.map((a, i) => (
              <li key={`p${i}`}>{LIBELLE_ANOMALIE[a.type] ?? a.type}</li>
            ))}
          </ul>
        )}
        {piece.empreinteTete !== null ? (
          <span className="mt-1 block font-mono text-[length:var(--text-admin-xs)] break-all text-[color:var(--color-admin-fg-muted)]">
            {`Ancrage : ${piece.empreinteTete}`}
          </span>
        ) : null}
      </td>
    </tr>
  );
}

export default async function RegistreSignaturesPage({
  params,
  searchParams,
}: PageProps): Promise<React.ReactElement> {
  const { locale, adminPrefix } = await params;
  const acces = await gardePage("consultation", `/${locale}/${adminPrefix}/login`);
  if (!acces.autorise) {
    return <AccesRefuse motif={acces.motif} retourHref={`/${locale}/${adminPrefix}`} />;
  }

  const filtres = await searchParams;
  const seulementAnomalies = filtres.anomalies === "1";
  const registre = await listerRegistreSignatures({
    seulementAnomalies,
    ...(filtres.session !== undefined ? { sessionId: filtres.session } : {}),
  });

  const base = `/${locale}/${adminPrefix}/qualiopi/mode-auditeur`;
  const cheminRetour = `${base}/signatures`;
  const retourRevocation = filtres.revocation;

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="Registre des signatures"
        description="Pièce par pièce : qui a signé, quand, et si la preuve tient. Lecture seule — aucune anomalie n'est corrigée depuis cet écran."
      />

      {retourRevocation !== undefined ? (
        <p
          role="status"
          className={
            retourRevocation === "ok"
              ? "mb-[var(--space-admin-4)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-success)] p-[var(--space-admin-4)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-success)]"
              : "mb-[var(--space-admin-4)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-danger)] p-[var(--space-admin-4)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-danger)]"
          }
        >
          {MESSAGE_REVOCATION[retourRevocation] ?? "Retour inconnu."}
          {filtres.raison !== undefined && DETAIL_REFUS[filtres.raison] !== undefined
            ? ` ${DETAIL_REFUS[filtres.raison]}`
            : ""}
        </p>
      ) : null}

      {/* Un registre tronqué en silence est PIRE qu'un registre absent : il a
          l'air exhaustif. On le dit avant tout le reste. */}
      {registre.tronque ? (
        <p className="mb-[var(--space-admin-4)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-danger)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-4)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-danger)]">
          Ce registre est PARTIEL : la limite de lignes a été atteinte. Ne le présentez pas comme un
          inventaire complet — restreignez-le à une session pour obtenir une vue exhaustive.
        </p>
      ) : null}

      {/* Dérive entre le SSOT des circuits et l'enum du schéma. Silencieuse par
          nature : un circuit désignerait un type de pièce qui n'existe pas, et
          ses pièces n'apparaîtraient jamais dans ce registre. */}
      {registre.typesSignablesInconnusDuSchema.length > 0 ? (
        <p className="mb-[var(--space-admin-4)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-danger)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-4)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-danger)]">
          {`Incohérence de configuration : ${registre.typesSignablesInconnusDuSchema.join(", ")} — un circuit de signature désigne un type de pièce absent du schéma. Les pièces concernées n'apparaissent pas ici.`}
        </p>
      ) : null}

      <div className="mb-[var(--space-admin-6)] grid grid-cols-2 gap-[var(--space-admin-4)] sm:grid-cols-5">
        <Compteur valeur={registre.nbPieces} libelle="Pièces suivies" />
        <Compteur valeur={registre.nbPreuvesIntactes} libelle="Preuves intactes" />
        <Compteur valeur={registre.nbChainesAnormales} libelle="Chaînes anormales" alerte />
        <Compteur valeur={registre.nbPdfRegeneres} libelle="PDF régénérés après signature" alerte />
        <Compteur
          valeur={registre.nbStatutsCacheDivergents}
          libelle="Statuts enregistrés divergents"
          alerte
        />
      </div>

      <p className="mb-[var(--space-admin-4)] text-[length:var(--text-admin-sm)]">
        <Link
          href={seulementAnomalies ? `${base}/signatures` : `${base}/signatures?anomalies=1`}
          className="underline"
        >
          {seulementAnomalies
            ? "Afficher toutes les pièces"
            : "N'afficher que les pièces dont la preuve n'est pas intacte"}
        </Link>
      </p>

      {registre.pieces.length === 0 ? (
        <p className="rounded-[var(--radius-admin-md)] border border-dashed border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-6)] text-center text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
          {seulementAnomalies
            ? "Aucune anomalie relevée."
            : "Aucune pièce signable n'a encore été émise."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)]">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-[color:var(--color-admin-border)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)] uppercase">
                <th className="p-[var(--space-admin-3)] font-medium">Pièce</th>
                <th className="p-[var(--space-admin-3)] font-medium">Statut</th>
                <th className="p-[var(--space-admin-3)] font-medium">Signataires</th>
                <th className="p-[var(--space-admin-3)] font-medium">Vérification</th>
              </tr>
            </thead>
            <tbody>
              {registre.pieces.map((p) => (
                <LignePiece key={p.documentGenereId} piece={p} cheminRetour={cheminRetour} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminPageShell>
  );
}
