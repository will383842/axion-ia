"use client";
// use-client: useFormStatus (état « en cours » du bouton, contre le double clic).

import { useFormStatus } from "react-dom";
import { Send } from "lucide-react";

import { AdminButton } from "@/components/admin/ui/AdminButton";

/** Bouton d'envoi du formulaire « Demander au dirigeant… » : désactivé pendant l'envoi. */
export function BoutonDemandeRelance({
  children,
}: {
  readonly children: React.ReactNode;
}): React.ReactElement {
  const { pending } = useFormStatus();
  return (
    <AdminButton type="submit" variant="secondary" icon={Send} loading={pending} disabled={pending}>
      {children}
    </AdminButton>
  );
}
