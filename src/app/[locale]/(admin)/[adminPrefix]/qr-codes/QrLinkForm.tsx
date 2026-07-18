// Formulaire partagé création / édition d'un QR dynamique.
// Server component : <form action={serverAction}> + primitives admin.

import { AdminFormField, AdminSubmitButton } from "@/components/admin/ui";

interface QrLinkFormProps {
  action: (formData: FormData) => void | Promise<void>;
  submitLabel: string;
  defaults?: {
    id?: string;
    slug?: string;
    destinationUrl?: string;
    label?: string;
    active?: boolean;
  };
}

export function QrLinkForm({ action, submitLabel, defaults }: QrLinkFormProps) {
  const isEdit = Boolean(defaults?.id);
  return (
    <form action={action} className="flex max-w-2xl flex-col gap-6">
      {defaults?.id ? <input type="hidden" name="id" value={defaults.id} /> : null}

      <AdminFormField
        type="text"
        name="label"
        label="Libellé (usage interne)"
        required
        defaultValue={defaults?.label}
        placeholder="Interview — Entreprise X"
        hint="Pour vous y retrouver dans la liste. N'apparaît nulle part publiquement."
      />

      <AdminFormField
        type="text"
        name="slug"
        label="Slug — l'URL imprimée sur le QR : /qr/…"
        required
        defaultValue={defaults?.slug}
        placeholder="interview-entreprise-x"
        hint="Minuscules, chiffres et tirets. ⚠️ Ne le changez plus une fois le catalogue imprimé (le QR pointe dessus)."
      />

      <AdminFormField
        type="text"
        name="destinationUrl"
        label="Destination — modifiable à tout moment"
        required
        defaultValue={defaults?.destinationUrl}
        placeholder="https://axion-ia.com/fr/entreprise/x  (ou lien vidéo)"
        hint="Vers où le QR redirige. Mettez une page « à venir » maintenant, puis le lien vidéo une fois le tournage fait — sans réimprimer."
      />

      <label className="flex items-center gap-3 text-[length:var(--text-admin-base)] text-[color:var(--color-admin-fg)]">
        <input
          type="checkbox"
          name="active"
          defaultChecked={defaults?.active ?? true}
          className="h-4 w-4"
        />
        Actif <span className="text-[color:var(--color-admin-fg-muted)]">(si désactivé, le QR renvoie une 404)</span>
      </label>

      <div className="flex gap-3">
        <AdminSubmitButton>{submitLabel}</AdminSubmitButton>
        {isEdit ? null : null}
      </div>
    </form>
  );
}
