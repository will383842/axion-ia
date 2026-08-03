"use client";

// Valeur de réglage dont les coordonnées bancaires (et autres secrets) sont
// masquées jusqu'à ce qu'on les demande. Voir `src/lib/admin/masquer-secrets.ts`
// pour le pourquoi et pour la limite : ce n'est pas une frontière de sécurité,
// c'est une protection contre l'exposition passive (capture, partage d'écran).

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

interface Props {
  /** JSON déjà masqué, calculé côté serveur. */
  masque: string;
  /** JSON complet — rendu uniquement après clic. */
  complet: string;
  /** Faux quand la valeur ne contient aucun secret : pas de bouton. */
  masquable: boolean;
}

export function AdminValeurSensible({ masque, complet, masquable }: Props): React.ReactElement {
  const [visible, setVisible] = useState(false);

  if (!masquable) {
    return <pre className="admin-json admin-json-cell">{complet}</pre>;
  }

  const Icone = visible ? EyeOff : Eye;
  return (
    <div className="flex items-start gap-[var(--space-admin-2)]">
      <pre className="admin-json admin-json-cell flex-1">{visible ? complet : masque}</pre>
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="admin-button-ghost shrink-0"
        aria-pressed={visible}
      >
        <Icone size={14} aria-hidden="true" />
        {visible ? "Masquer" : "Afficher"}
      </button>
    </div>
  );
}
