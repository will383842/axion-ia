// Corps visuel du détail d'un e-mail envoyé (2026-09-27).
//
// Ne dépend que de ses propriétés — aucune session, aucune base — pour rester
// vérifiable dans un navigateur et dans un test, sans identifiants.
//
// ## 🔴 L'iframe `sandbox=""` — et pourquoi rien d'autre
//
// Le HTML d'un e-mail porte ses styles en ligne et en `<style>` : injecté dans
// la page, il déborderait sur la console. L'iframe `srcDoc` l'isole, comme une
// boîte mail. `sandbox` SANS AUCUN jeton : ni script, ni formulaire, ni
// fenêtre surgissante, ni accès à la page parente. Le contenu vient de nos
// gabarits, mais une copie n'a aucune raison de pouvoir agir.
//
// Onglets HTML / texte par lien (`?vue=texte`) : zéro JavaScript client, donc
// rien à peser dans le budget de la console.

import Link from "next/link";
import { AdminPageHeader, AdminCard, AdminBadge } from "@/components/admin/ui";
import { libelleStatutLigne, TON_STATUT_EMAIL } from "@/features/admin-emails/statut-libelles";
import type { DetailEmail, RaisonSansCopie } from "@/features/admin-emails/detail";
import type { ApercuReconstitue } from "@/features/admin-emails/reconstitution-invitation";

const quand = (d: Date | null): string =>
  d
    ? new Date(d).toLocaleString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/Paris",
      })
    : "—";

function Ligne({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-[2px] sm:flex-row sm:gap-[var(--space-admin-2)]">
      <dt className="min-w-[9rem] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
        {label}
      </dt>
      <dd className="text-[length:var(--text-admin-sm)] break-all text-[color:var(--color-admin-fg)]">
        {children}
      </dd>
    </div>
  );
}

/** Le rendu : onglets HTML / texte, objet, iframe isolée. */
function Rendu({
  titre,
  subject,
  html,
  text,
  vue,
  hrefHtml,
  hrefTexte,
}: {
  titre: string;
  subject: string;
  html: string;
  text: string;
  vue: "html" | "texte";
  hrefHtml: string;
  hrefTexte: string;
}): React.ReactElement {
  return (
    <>
      <nav aria-label="Version affichée" className="flex flex-wrap gap-[var(--space-admin-2)]">
        <Link
          href={hrefHtml}
          className={vue === "html" ? "admin-button admin-button-sm" : "admin-button-ghost"}
          aria-current={vue === "html" ? "page" : undefined}
        >
          Rendu HTML
        </Link>
        <Link
          href={hrefTexte}
          className={vue === "texte" ? "admin-button admin-button-sm" : "admin-button-ghost"}
          aria-current={vue === "texte" ? "page" : undefined}
        >
          Version texte
        </Link>
      </nav>
      <div className="mt-[var(--space-admin-3)] rounded-lg border border-[color:var(--color-admin-border)] px-4 py-3">
        <p className="text-[11px] font-medium tracking-wide text-[color:var(--color-admin-fg-muted)] uppercase">
          Objet
        </p>
        <p className="mt-1 text-sm leading-snug font-semibold text-[color:var(--color-admin-fg)]">
          {subject}
        </p>
      </div>
      <div className="mt-[var(--space-admin-3)] rounded-lg border border-[color:var(--color-admin-border)] p-3 sm:p-6">
        {vue === "html" ? (
          // Cadré à 680 px : la largeur à laquelle une boîte mail rend un e-mail.
          <iframe
            title={titre}
            srcDoc={html}
            sandbox=""
            referrerPolicy="no-referrer"
            className="bg-paper mx-auto block h-[70vh] w-full max-w-[680px] rounded-lg border border-[color:var(--color-admin-border)]"
          />
        ) : (
          <pre className="max-h-[70vh] overflow-auto text-xs leading-relaxed whitespace-pre-wrap text-[color:var(--color-admin-fg)]">
            {text}
          </pre>
        )}
      </div>
    </>
  );
}

export function VueDetailEmail({
  email,
  vue,
  raison,
  apercu,
  base,
  adminPrefix,
}: {
  email: DetailEmail;
  vue: "html" | "texte";
  /** Pourquoi il n'y a pas de copie — `null` quand la copie existe. */
  raison: RaisonSansCopie | null;
  /** Aperçu reconstitué (invitation apporteur sans copie) — `null` sinon. */
  apercu: ApercuReconstitue | null;
  /** `/fr/<prefixe>/emails-envoyes` */
  base: string;
  adminPrefix: string;
}): React.ReactElement {
  const ici = `${base}/${email.id}`;
  const hrefHtml = ici;
  const hrefTexte = `${ici}?vue=texte`;

  return (
    <>
      <AdminPageHeader
        title={email.copie?.subject ?? email.template}
        description={`Envoyé à ${email.recipient}`}
        meta={
          <>
            <AdminBadge tone={TON_STATUT_EMAIL[email.status]} dot>
              {libelleStatutLigne(email)}
            </AdminBadge>
            <AdminBadge tone="neutral">{email.template}</AdminBadge>
          </>
        }
        actions={
          <Link href={base} className="admin-link">
            ← E-mails envoyés
          </Link>
        }
      />

      <div className="grid gap-[var(--space-admin-5)] lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <AdminCard>
          {email.copie !== null ? (
            <>
              <p className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
                Copie exacte de l&apos;e-mail parti, enregistrée au moment de l&apos;envoi.
                {email.copie.secretsMasques > 0
                  ? ` ${email.copie.secretsMasques} lien(s) personnel(s) (signature, connexion, désinscription…) sont masqués : la console ne doit pas pouvoir les rejouer.`
                  : ""}
              </p>
              <Rendu
                titre={`E-mail « ${email.template} » envoyé à ${email.recipient}`}
                subject={email.copie.subject}
                html={email.copie.html}
                text={email.copie.text}
                vue={vue}
                hrefHtml={hrefHtml}
                hrefTexte={hrefTexte}
              />
            </>
          ) : (
            <>
              <p className="admin-alert admin-alert-info">
                <span>{raison?.phrase ?? "Copie non conservée."}</span>
              </p>
              {apercu !== null ? (
                apercu.ok ? (
                  <div className="mt-[var(--space-admin-4)]">
                    {/* 🔴 LE BANDEAU. Un aperçu reconstitué pris pour la copie
                        d'origine serait pire que pas d'aperçu : on relirait
                        comme « envoyé » un texte qui n'a peut-être jamais
                        existé sous cette forme. */}
                    <div
                      role="note"
                      data-testid="bandeau-reconstitue"
                      className="admin-alert admin-alert-warning"
                    >
                      <div>
                        <p>
                          <strong>Reconstitué — ce n&apos;est pas la copie d&apos;origine.</strong>{" "}
                          Le gabarit a été rendu à nouveau avec les données de la fiche, selon les
                          règles en vigueur au moment de l&apos;envoi (
                          {apercu.regles.signature ? "avec" : "sans"} signature).
                        </p>
                        {apercu.regles.incertain ? (
                          <p>
                            ⚠️ Envoi très proche d&apos;un changement du gabarit : la version
                            réellement partie peut différer de celle-ci.
                          </p>
                        ) : null}
                        {apercu.hypotheses.map((h) => (
                          <p key={h} className="admin-meta-small">
                            {h}
                          </p>
                        ))}
                      </div>
                    </div>
                    <div className="mt-[var(--space-admin-4)]">
                      <Rendu
                        titre={`Aperçu reconstitué de l'invitation envoyée à ${email.recipient}`}
                        subject={apercu.subject}
                        html={apercu.html}
                        text={apercu.text}
                        vue={vue}
                        hrefHtml={hrefHtml}
                        hrefTexte={hrefTexte}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="mt-[var(--space-admin-3)]">
                    <p className="admin-meta-small">{apercu.motif}</p>
                  </div>
                )
              ) : null}
            </>
          )}
        </AdminCard>

        <AdminCard>
          <h2 className="mb-[var(--space-admin-3)] text-sm font-semibold text-[color:var(--color-admin-fg)]">
            L&apos;envoi
          </h2>
          <dl className="flex flex-col gap-[var(--space-admin-2)]">
            <Ligne label="Destinataire">{email.recipient}</Ligne>
            <Ligne label="Statut">
              {libelleStatutLigne(email)}
              {email.attempts > 1 ? ` (${email.attempts} essais)` : ""}
            </Ligne>
            <Ligne label="Gabarit">
              <Link
                href={`/fr/${adminPrefix}/emails/gabarits/${email.template}`}
                className="admin-link"
              >
                {email.template}
              </Link>
            </Ligne>
            <Ligne label="Mis en file le">{quand(email.createdAt)}</Ligne>
            {email.dueAt ? <Ligne label="Échéance">{quand(email.dueAt)}</Ligne> : null}
            <Ligne label="Envoyé le">{quand(email.sentAt)}</Ligne>
            {email.failedAt ? <Ligne label="Échec le">{quand(email.failedAt)}</Ligne> : null}
            {email.bouncedAt ? <Ligne label="Rebond le">{quand(email.bouncedAt)}</Ligne> : null}
            {email.error ? <Ligne label="Motif">{email.error}</Ligne> : null}
            {email.bounceReason ? (
              <Ligne label="Motif du rebond">{email.bounceReason}</Ligne>
            ) : null}
            <Ligne label="Langue">{email.locale.toUpperCase()}</Ligne>
            <Ligne label="Nature">{email.marketing ? "Marketing" : "Transactionnel"}</Ligne>
            {email.entityType ? (
              <Ligne label="Rattaché à">
                {email.entityType}
                {email.entityId ? ` · ${email.entityId}` : ""}
              </Ligne>
            ) : null}
            {email.copie && email.copie.attachmentNames.length > 0 ? (
              <Ligne label="Pièces jointes">
                {email.copie.attachmentNames.join(", ")}
                <span className="admin-meta-small"> (non conservées dans la copie)</span>
              </Ligne>
            ) : null}
            {email.providerMessageId ? (
              <Ligne label="Identifiant relais">{email.providerMessageId}</Ligne>
            ) : null}
          </dl>
        </AdminCard>
      </div>
    </>
  );
}
