/**
 * Admin — la page d'un RENDEZ-VOUS et de son compte rendu (chantier visio,
 * PR 4 ; plan §3.13, vérifications V1-C1 et V5-C1).
 *
 * La note manuelle validée, les faits du rendez-vous, le suivi, et le
 * COMPTE RENDU DE L'ENREGISTREMENT (PR 6, `VueCompteRendu`) : Will le lit, dit
 * qui a parlé, confirme un accord non retrouvé, le valide ou retire l'accord —
 * sur CETTE page, la même que celle où mènent les alertes du circuit. Plus
 * « Après l'appel », « Préparer » et « Déplacer ».
 *
 * Texte BRUT partout : aucun HTML venant d'une donnée n'est interprété.
 * Régime REFUS (décision A2) : `gardeLectureEchanges` est la PREMIÈRE
 * instruction, avant toute lecture.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { AdminBadge } from "@/components/admin/ui/AdminBadge";
import { PastilleTypeRdv } from "@/components/admin/contacts/PastilleTypeRdv";
import { AdminButton } from "@/components/admin/ui/AdminButton";
import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import { ApresLAppelVue } from "@/components/admin/dossier-client/ApresLAppelVue";
import { gardeLectureEchanges } from "@/features/dossier-client/acces";
import { deplacerRencontreAction } from "@/features/dossier-client/actions-rencontres";
import {
  LIBELLE_ISSUE,
  LIBELLE_STATUT_RENCONTRE,
  LIBELLE_SUITE,
  LIBELLE_TYPE_FAIT,
} from "@/features/dossier-client/libelles";
import {
  lireFichesVivantes,
  lireRencontreDetaillee,
} from "@/features/dossier-client/queries-rencontres";
import { VueCompteRendu } from "@/components/admin/visio/VueCompteRendu";
import { lireCircuitDeLaRencontre, lireCompteRendu } from "@/features/dossier-client/compte-rendu";
import { compteRenduEnregistre } from "@/features/dossier-client/compte-rendu-en-preparation";
import { lireMessageDeRetour } from "@/features/dossier-client/message-de-retour";
import { prisma } from "@/lib/prisma";
import { formatDateFrShort } from "@/lib/format-date-fr";
import { timeInParis } from "@/lib/calendar-grid";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Rendez-vous et compte rendu | Axion-IA Admin",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string; rencontreId: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

const carteCls =
  "mb-[var(--space-admin-5)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-5)]";
const titreCls =
  "mb-[var(--space-admin-3)] text-[length:var(--text-admin-base)] font-semibold text-[color:var(--color-admin-fg)]";
const mutedCls = "text-[color:var(--color-admin-fg-muted)]";
const listeCls = "space-y-[var(--space-admin-2)] text-[length:var(--text-admin-sm)]";
const lienCls = "text-[color:var(--color-admin-accent)] underline-offset-2 hover:underline";
const inputCls =
  "w-full rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)]";

const LIBELLE_ORIGINE: Readonly<Record<string, string>> = {
  manuel: "Note manuelle",
  ia: "Compte rendu rédigé depuis l'enregistrement",
  dictee: "Dictée",
};
const LIBELLE_STATUT_CR: Readonly<Record<string, string>> = {
  brouillon: "en cours",
  a_valider: "à valider",
  valide: "validé",
  remplace: "remplacé",
  rejete: "rejeté",
  a_regenerer: "à réécrire",
};

export default async function RencontrePage({ params, searchParams }: PageProps) {
  const { locale, adminPrefix, rencontreId } = await params;
  // 🔴 Première instruction : la garde, AVANT toute lecture.
  const acces = await gardeLectureEchanges(`/${locale}/${adminPrefix}/login`);
  const rdvBase = `/${locale}/${adminPrefix}/rendez-vous`;
  if (!acces.autorise) {
    return <AccesRefuse motif={acces.motif} retourHref={rdvBase} />;
  }
  const sp = await searchParams;
  // N1 : seuls les messages scellés par nos actions s'affichent (un lien forgé, rien).
  const erreur = lireMessageDeRetour(sp, "erreur");
  const message = lireMessageDeRetour(sp, "message");

  const r = await lireRencontreDetaillee(rencontreId);
  if (r === null) notFound();
  // « Après l'appel » est une VUE de cette page (pas une page de plus :
  // cliquet de poids de la console, ADR 0058). Même garde, déjà posée.
  if (sp.vue === "apres-l-appel") {
    return (
      <ApresLAppelVue
        r={r}
        locale={locale}
        adminPrefix={adminPrefix}
        erreur={erreur}
        compteRendu={await compteRenduEnregistre(prisma, r.id)}
      />
    );
  }
  const fiches = r.client ? (await lireFichesVivantes()).filter((f) => f.id !== r.client?.id) : [];
  const ficheHref = r.client ? `/${locale}/${adminPrefix}/qualiopi/clients/${r.client.id}` : null;
  const valide = r.comptesRendus.find((c) => c.statut === "valide") ?? null;
  // Le compte rendu de l'enregistrement s'affiche dès qu'un ENREGISTREMENT existe
  // (pendant le traitement, après un échec, quand Will est attendu) : c'est là que
  // se trouvent « Le client retire son accord » et la réponse aux enregistrements courts.
  const circuit = await lireCircuitDeLaRencontre(prisma, r.id);
  // PR 7 — une dictée donne aussi un compte rendu (origine `dictee`).
  const redige = r.comptesRendus.some((c) => c.origine === "ia" || c.origine === "dictee");
  const avecEnregistrement = circuit.aOuvrir || redige;
  const vueEnregistrement = avecEnregistrement ? await lireCompteRendu(prisma, r.id) : null;
  const faitsValides = r.faits.filter((f) => f.statut === "valide");

  return (
    <AdminPageShell width="wide">
      <div className="mb-[var(--space-admin-4)]">
        <Link
          href={ficheHref ? `${ficheHref}?onglet=echanges` : `${rdvBase}?vue=a-classer`}
          className={`text-[length:var(--text-admin-xs)] ${lienCls}`}
        >
          ← {r.client ? r.client.raisonSociale : "À classer"}
        </Link>
      </div>

      <AdminPageHeader
        title={r.titre}
        description={
          r.debutPrevu
            ? `${formatDateFrShort(r.debutPrevu)} à ${timeInParis(r.debutPrevu)}`
            : "Date inconnue"
        }
        meta={
          <>
            {r.typeRendezVous ? <PastilleTypeRdv type={r.typeRendezVous} /> : null}
            {r.statut !== null ? (
              <AdminBadge tone="outline">{LIBELLE_STATUT_RENCONTRE[r.statut]}</AdminBadge>
            ) : null}
            {r.estTestInterne ? <AdminBadge tone="warning">test interne</AdminBadge> : null}
            {valide === null ? (
              <AdminBadge tone="warning">sans compte rendu validé</AdminBadge>
            ) : null}
          </>
        }
        actions={
          <>
            <AdminButton href={`${rdvBase}/rencontres/${r.id}?vue=apres-l-appel`}>
              Après l&apos;appel
            </AdminButton>
            {ficheHref ? (
              <AdminButton variant="secondary" href={`${ficheHref}/preparer`}>
                Préparer le prochain échange
              </AdminButton>
            ) : null}
          </>
        }
      />

      {erreur !== null ? (
        <p
          role="alert"
          className="mb-[var(--space-admin-4)] rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-danger)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)]"
        >
          {erreur}
        </p>
      ) : null}
      {message !== null ? (
        <p
          role="status"
          className="mb-[var(--space-admin-4)] rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-success-fg)]"
        >
          {message}
        </p>
      ) : null}

      <section className={carteCls}>
        <h2 className={titreCls}>Compte rendu</h2>
        {valide !== null ? (
          <>
            <p
              className={`mb-[var(--space-admin-2)] text-[length:var(--text-admin-xs)] ${mutedCls}`}
            >
              {LIBELLE_ORIGINE[valide.origine] ?? valide.origine} — version {valide.version}, validé
              {valide.valideLe ? ` le ${formatDateFrShort(valide.valideLe)}` : ""}
            </p>
            <ul className={listeCls}>
              {valide.champs.map((c, i) => (
                <li key={i} className="whitespace-pre-line">
                  <span className="font-medium">
                    {LIBELLE_TYPE_FAIT[c.type as keyof typeof LIBELLE_TYPE_FAIT] ?? c.type} :
                  </span>{" "}
                  {c.enonce}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className={`text-[length:var(--text-admin-sm)] ${mutedCls}`}>
            Aucun compte rendu validé. Ouvrez « Après l&apos;appel » pour écrire la note.
          </p>
        )}
        {circuit.reponseAttendue ? (
          <p
            role="status"
            className="mt-[var(--space-admin-3)] rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-warning)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)]"
          >
            <AdminBadge tone="warning">votre réponse est attendue</AdminBadge> Enregistrement très
            court ou session interrompue avant la fin : répondez plus bas, dans « Compte rendu de
            l&apos;enregistrement ».
          </p>
        ) : null}
        {vueEnregistrement === null ? (
          <p className={`mt-[var(--space-admin-3)] text-[length:var(--text-admin-xs)] ${mutedCls}`}>
            Aucun enregistrement de ce rendez-vous n&apos;a encore donné de compte rendu.
          </p>
        ) : (
          <p className={`mt-[var(--space-admin-3)] text-[length:var(--text-admin-xs)] ${mutedCls}`}>
            Le compte rendu de l&apos;enregistrement est plus bas sur cette page.
          </p>
        )}
        <p className="mt-[var(--space-admin-2)] text-[length:var(--text-admin-sm)]">
          <Link href={`${rdvBase}?emailSuivi=${r.id}`} className={lienCls}>
            E-mail de suivi au client
          </Link>{" "}
          <span className={mutedCls}>
            — préparé depuis les faits validés, il attend votre validation avant de partir.
          </span>
        </p>
        {r.comptesRendus.length > 1 ? (
          <details className="mt-[var(--space-admin-3)] text-[length:var(--text-admin-sm)]">
            <summary className="cursor-pointer">Versions ({r.comptesRendus.length})</summary>
            <ul className={listeCls}>
              {r.comptesRendus.map((c) => (
                <li key={c.id}>
                  Version {c.version} — {LIBELLE_ORIGINE[c.origine] ?? c.origine},{" "}
                  {LIBELLE_STATUT_CR[c.statut] ?? c.statut}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </section>

      {vueEnregistrement !== null ? (
        <VueCompteRendu
          vue={vueEnregistrement}
          rencontreId={r.id}
          retour={`${rdvBase}/rencontres/${r.id}`}
        />
      ) : null}

      <section className={carteCls}>
        <h2 className={titreCls}>Ce qui a été retenu</h2>
        {faitsValides.length === 0 ? (
          <p className={`text-[length:var(--text-admin-sm)] ${mutedCls}`}>Aucun fait validé.</p>
        ) : (
          <ul className={listeCls}>
            {faitsValides.map((f) => (
              <li key={f.id}>
                <span className="font-medium">{LIBELLE_TYPE_FAIT[f.type]}</span> : {f.enonce}
                {f.portee === "entreprise" ? (
                  <span className={mutedCls}> (toute l&apos;entreprise)</span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={carteCls}>
        <h2 className={titreCls}>Suite</h2>
        {r.suivi ? (
          <p className="text-[length:var(--text-admin-sm)]">
            {LIBELLE_ISSUE[r.suivi.issue]}
            {r.suivi.suite ? ` · ${LIBELLE_SUITE[r.suivi.suite]}` : ""}
            {r.suivi.suiteLe ? ` · pour le ${formatDateFrShort(r.suivi.suiteLe)}` : ""}
          </p>
        ) : (
          <p className={`text-[length:var(--text-admin-sm)] ${mutedCls}`}>Point pas encore fait.</p>
        )}
      </section>

      {r.client && fiches.length > 0 ? (
        <section className={carteCls}>
          <h2 className={titreCls}>Rangé chez le mauvais client ?</h2>
          <form
            action={deplacerRencontreAction}
            className="flex flex-wrap items-end gap-[var(--space-admin-3)]"
          >
            <input type="hidden" name="rencontreId" value={r.id} />
            <label className="flex flex-col gap-1 text-[length:var(--text-admin-sm)]">
              Déplacer ce rendez-vous, ce qui y a été dit et les personnes présentes vers
              <select name="versClientId" defaultValue="" className={inputCls}>
                <option value="" disabled>
                  Choisir la fiche…
                </option>
                {fiches.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.raisonSociale} ({f.numero})
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="admin-button-ghost">
              Déplacer
            </button>
          </form>
        </section>
      ) : null}
    </AdminPageShell>
  );
}
