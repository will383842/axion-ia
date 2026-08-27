/**
 * Admin — Qualiopi · Registre des signatures d'ÉMARGEMENT.
 *
 * ## Pourquoi cet écran existe
 *
 * 🔴 `D3-3-05` (2026-08-21). Le mode auditeur portait un registre complet des
 * signatures de PIÈCES — qui a signé, quand, la chaîne tient-elle, et un
 * formulaire de révocation. Les signatures d'émargement, qui sont pourtant LA
 * preuve de présence qu'un contrôle vient chercher, n'avaient aucune surface.
 *
 * Conséquence : `revoquerSignatureEmargementAction`, écrite la veille avec son
 * service, son habilitation et ses tests, n'était appelable de nulle part. Une
 * signature apposée sur le mauvais nom restait définitive faute d'écran.
 *
 * ## Server Component PUR — aucun JS client
 *
 * Le registre est de la lecture, et les filtres utiles (session, anomalies
 * seules) sont des paramètres d'URL que le serveur sait lire. Un écran consulté
 * trois fois par an ne justifie pas un bundle.
 *
 * ## Ce que cet écran refuse de faire
 *
 * 🔴 Il ne RÉPARE rien. Une chaîne rompue est un résultat à présenter, pas une
 * panne à masquer — c'est la doctrine de `verifierChaine`, qui ne lève jamais.
 *
 * 🔴 Il regroupe par INSCRIPTION, jamais par session : la chaîne de hachage est
 * chaînée par inscription. Mélanger deux chaînes produirait des ruptures
 * fantômes, c'est-à-dire de faux verdicts de falsification.
 */

import type { Metadata } from "next";
import Link from "next/link";

import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import {
  listerRegistreEmargement,
  PLAFOND_REGISTRE,
  type RapportInscription,
} from "@/server/qualiopi/emargement/registre-emargement";
import { revoquerSignatureEmargementFormAction } from "@/server/actions/qualiopi/emargement-revocation";
import { libelleAnomalieChaine } from "@/server/qualiopi/emargement/chaine-labels";
import { MOTIF_MIN } from "@/server/qualiopi/emargement/revocation-service";
import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import { gardePage } from "@/server/auth/garde-page";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Qualiopi — Registre d'émargement | Axion-IA Admin",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string }>;
  searchParams: Promise<{
    anomalies?: string;
    session?: string;
    revocation?: string;
    raison?: string;
    retombe?: string;
  }>;
}

/**
 * Horodatage en heure de PARIS, jamais UTC.
 *
 * Un auditeur recoupe ce registre avec des feuilles papier et des agendas
 * français : lui présenter une heure UTC lui ferait constater un décalage de
 * deux heures en été, sur des signatures parfaitement régulières.
 */
const horodatageParis = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Europe/Paris",
});
const jourParis = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "short",
  timeZone: "Europe/Paris",
});

/**
 * Retour de la révocation, traduit d'un CODE.
 *
 * ⚠️ Jamais le message brut de l'URL. La page traduit, elle ne recopie pas.
 */
const DETAIL_REFUS: Readonly<Record<string, string>> = {
  introuvable: "Cette signature est introuvable.",
  deja_revoquee: "Cette signature a déjà été révoquée.",
  motif_insuffisant: `Le motif doit faire au moins ${MOTIF_MIN} caractères : c'est lui que l'auditeur lira pour comprendre pourquoi la preuve a été retirée.`,
  maillon_interne:
    "Cette signature n'est pas la dernière apposée pour cette inscription : la révoquer romprait le chaînage et ferait apparaître la feuille comme falsifiée au contrôle. Révoquez d'abord les signatures postérieures, puis re-signez dans l'ordre.",
  demande_invalide: "Demande invalide.",
};

function Inscription({
  rapport,
  cheminRetour,
}: {
  rapport: RapportInscription;
  cheminRetour: string;
}): React.ReactElement {
  return (
    <li className="border-b border-[color:var(--color-admin-border)] py-[var(--space-admin-4)] last:border-b-0">
      <p className="font-medium">
        {rapport.stagiaire}
        <span className="text-[color:var(--color-admin-fg-muted)]">
          {` · session ${rapport.sessionNumero} — ${rapport.sessionTitre}`}
        </span>
      </p>

      {rapport.chaineValide ? (
        <p className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
          {`Chaîne vérifiée — ${rapport.signatures.length} signature${rapport.signatures.length > 1 ? "s" : ""}.`}
        </p>
      ) : (
        <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-danger)]">
          {/* 🔑 On NOMME l'anomalie, on ne dit pas « erreur ». C'est ce libellé
              que l'auditrice recopie dans son rapport. */}
          {`Chaîne altérée : ${rapport.anomalies.map((a) => libelleAnomalieChaine(a.type)).join(" · ")}`}
        </p>
      )}

      <ul className="mt-[var(--space-admin-3)] space-y-[var(--space-admin-3)]">
        {rapport.signatures.map((s, index) => {
          // ⚠️ L'écart entre `signeAt` et `createdAt` révèle une insertion
          // tardive — une signature enregistrée bien après l'heure déclarée.
          const ecartMs = s.createdAt.getTime() - s.signeAt.getTime();
          const insertionTardive = Math.abs(ecartMs) > 60_000;
          // Seule la DERNIÈRE de la chaîne est révocable : le service refuse un
          // maillon interne. L'écran le dit AVANT le clic plutôt que de laisser
          // découvrir le refus après coup.
          const estTerminale = index === rapport.signatures.length - 1;
          return (
            <li key={s.signatureId} className="text-[length:var(--text-admin-xs)]">
              <span className="font-medium">{s.signataireNom}</span>
              <span className="block text-[color:var(--color-admin-fg-muted)]">
                {`${jourParis.format(s.date)} ${s.demiJournee} · ${s.heureDebut}–${s.heureFin} · signée le ${horodatageParis.format(s.signeAt)}`}
              </span>
              {s.recueilliParFormateur ? (
                <span className="block text-[color:var(--color-admin-fg-muted)]">
                  {/* Ce n'est pas un détail : dans ce cas c'est le formateur qui
                      porte l'identification du signataire, comme avec une
                      feuille papier qu'il fait circuler. */}
                  Recueillie par le formateur sur son poste.
                </span>
              ) : null}
              {insertionTardive ? (
                <span className="block text-[color:var(--color-admin-danger)]">
                  {`Enregistrée le ${horodatageParis.format(s.createdAt)} — écart avec l'heure de signature déclarée.`}
                </span>
              ) : null}

              {estTerminale ? (
                <form action={revoquerSignatureEmargementFormAction} className="mt-1 flex gap-1">
                  <input type="hidden" name="signatureId" value={s.signatureId} />
                  <input type="hidden" name="retour" value={cheminRetour} />
                  <input
                    type="text"
                    name="motif"
                    required
                    minLength={MOTIF_MIN}
                    maxLength={2000}
                    placeholder={`Motif de révocation (${MOTIF_MIN} caractères minimum)`}
                    aria-label={`Motif de révocation de la signature de ${s.signataireNom}`}
                    className="flex-1 rounded border border-[color:var(--color-admin-border)] px-1 py-0.5 text-[length:var(--text-admin-xs)]"
                  />
                  <button
                    type="submit"
                    className="rounded border border-[color:var(--color-admin-danger)] px-2 py-0.5 text-[color:var(--color-admin-danger)]"
                  >
                    Révoquer
                  </button>
                </form>
              ) : (
                <span className="mt-1 block text-[color:var(--color-admin-fg-muted)]">
                  Non révocable : d&apos;autres signatures ont été apposées après celle-ci.
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </li>
  );
}

export default async function RegistreEmargementPage({
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
  const { rapports, tronque } = await listerRegistreEmargement({
    seulementAnomalies,
    ...(filtres.session !== undefined ? { sessionId: filtres.session } : {}),
  });

  const base = `/${locale}/${adminPrefix}/qualiopi/mode-auditeur`;
  const cheminRetour = `${base}/emargement`;
  const retour = filtres.revocation;
  const chainesAlterees = rapports.filter((r) => !r.chaineValide).length;

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="Registre des signatures d'émargement"
        description="Inscription par inscription : qui a signé, quand, et si la chaîne tient. Aucune anomalie n'est corrigée depuis cet écran."
      />

      {retour !== undefined ? (
        <p
          role="status"
          className={
            retour === "ok"
              ? "mb-[var(--space-admin-4)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-success)] p-[var(--space-admin-4)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-success)]"
              : "mb-[var(--space-admin-4)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-danger)] p-[var(--space-admin-4)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-danger)]"
          }
        >
          {retour === "ok"
            ? "Signature révoquée. La ligne reste en base avec son empreinte : une preuve retirée du décompte n'est pas une preuve effacée."
            : (DETAIL_REFUS[filtres.raison ?? ""] ?? "Révocation refusée.")}
          {retour === "ok" && filtres.retombe === "1" ? (
            <span className="mt-1 block font-medium">
              {/* La conséquence, dite AU MOMENT du geste. */}
              Cette inscription n&apos;a plus aucune signature vivante : elle n&apos;est plus
              considérée comme émargée, et le certificat de réalisation ne peut plus
              l&apos;affirmer.
            </span>
          ) : null}
        </p>
      ) : null}

      <p className="mb-[var(--space-admin-4)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
        {`${rapports.length} inscription${rapports.length > 1 ? "s" : ""} · ${chainesAlterees} chaîne${chainesAlterees > 1 ? "s" : ""} altérée${chainesAlterees > 1 ? "s" : ""}.`}{" "}
        <Link href={seulementAnomalies ? cheminRetour : `${cheminRetour}?anomalies=1`}>
          {seulementAnomalies ? "Voir tout" : "Anomalies seules"}
        </Link>
      </p>

      {tronque ? (
        <p className="mb-[var(--space-admin-4)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-danger)]">
          {/* 🔑 Un plafond tu ferait lire « tout est régulier » là où l'on n'a
              montré qu'une partie. Il se dit, et l'écran indique quoi faire. */}
          {`Affichage limité à ${PLAFOND_REGISTRE} inscriptions — d'autres existent. Restreignez à une session (paramètre « session » dans l'URL) pour un registre complet.`}
        </p>
      ) : null}

      {rapports.length === 0 ? (
        <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
          {seulementAnomalies
            ? "Aucune chaîne altérée."
            : "Aucune signature d'émargement enregistrée. Une session sans émargement se constate dans les alertes, pas ici."}
        </p>
      ) : (
        <ul>
          {rapports.map((r) => (
            <Inscription key={r.enrollmentId} rapport={r} cheminRetour={cheminRetour} />
          ))}
        </ul>
      )}
    </AdminPageShell>
  );
}
