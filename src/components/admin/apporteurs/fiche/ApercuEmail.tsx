"use client";

// L'aperçu EXACT d'un e-mail avant envoi (même motif que l'issue de l'échange apporteur).

export interface EmailApercu {
  sujet: string;
  html: string;
  destinataire: string;
}

export function ApercuEmail({
  email,
  libelleEnvoyer,
  occupe,
  onEnvoyer,
  onAnnuler,
}: {
  email: EmailApercu;
  libelleEnvoyer: string;
  occupe: boolean;
  onEnvoyer: () => void;
  onAnnuler: () => void;
}) {
  return (
    <section
      aria-label="Aperçu de l'e-mail"
      className="flex flex-col gap-[var(--space-admin-3)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] p-[var(--space-admin-3)]"
    >
      <p className="text-[length:var(--text-admin-sm)]">
        <span className="text-[color:var(--color-admin-fg-muted)]">À : </span>
        {email.destinataire}
        <br />
        <span className="text-[color:var(--color-admin-fg-muted)]">Objet : </span>
        <strong>{email.sujet}</strong>
      </p>
      <iframe
        title="Aperçu de l'e-mail"
        srcDoc={email.html}
        sandbox=""
        referrerPolicy="no-referrer"
        className="h-[60vh] w-full max-w-[680px] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-white"
      />
      <div className="flex flex-wrap items-center gap-[var(--space-admin-3)]">
        <button type="button" className="admin-button" disabled={occupe} onClick={onEnvoyer}>
          {occupe ? "Envoi…" : libelleEnvoyer}
        </button>
        <button
          type="button"
          className="admin-button-secondary"
          disabled={occupe}
          onClick={onAnnuler}
        >
          Annuler
        </button>
      </div>
    </section>
  );
}

export function MessageRetour({ retour }: { retour: { ok: boolean; message: string } | null }) {
  if (!retour) return null;
  return (
    <p
      role={retour.ok ? "status" : "alert"}
      className={
        retour.ok
          ? "text-[color:var(--color-admin-success)]"
          : "text-[color:var(--color-admin-destructive)]"
      }
    >
      {retour.message}
    </p>
  );
}
