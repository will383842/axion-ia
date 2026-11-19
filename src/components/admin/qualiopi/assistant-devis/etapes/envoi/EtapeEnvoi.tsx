"use client";
// use-client: appel unique de l aperçu serveur à l entrée de l étape, état local du chargement.

/**
 * Étape 4 assemblée (fiche E16) : à l'entrée, UN appel à l'aperçu serveur (C4, simulé par la
 * prop `preparer`) dans un cadre de hauteur fixe avec squelette (CLS = 0) ; puis l'aperçu
 * rendu depuis la `VueApercuDevis`, et l'e-mail. Rien n'est envoyé tant que l'on ne clique pas.
 * Les actions (C4, C5) sont injectées : la page les branche en E17.
 */
import { ChevronLeft } from "lucide-react";
import { lazy, Suspense, useEffect, useRef, useState } from "react";

import { AdminButton } from "@/components/admin/ui/AdminButton";

import type { Etape } from "../../types";
import type { VueApercuDevis } from "./ApercuDevis";
import { EmailEnvoi, type EmailAEnvoyer } from "./EmailEnvoi";

// Chargé à la demande : l'aperçu n'existe qu'après la réponse du serveur.
const ApercuDevis = lazy(() => import("./ApercuDevis").then((m) => ({ default: m.ApercuDevis })));

export type ResultatAction<T> = { data: T } | { error: string };

export interface ApercuPrepare {
  devisId: string;
  numero: string;
  majLe: string;
  apercuPdfUrl: string;
  vue: VueApercuDevis;
}

export interface PropsEtapeEnvoi {
  etape: Etape;
  preparer: () => Promise<ResultatAction<ApercuPrepare>>;
  envoyer: (
    devisId: string,
    majLe: string,
    email: EmailAEnvoyer,
  ) => Promise<ResultatAction<{ enCorbeille: boolean; note?: string }>>;
  destinataire: string;
  salutation?: string | undefined;
  onModifier?: (() => void) | undefined;
}

type Chargement =
  | { etat: "attente" }
  | { etat: "erreur"; message: string }
  | { etat: "pret"; prepare: ApercuPrepare };

export function EtapeEnvoi({
  preparer,
  envoyer,
  destinataire,
  salutation,
  onModifier,
}: PropsEtapeEnvoi) {
  const [chargement, setChargement] = useState<Chargement>({ etat: "attente" });
  const lance = useRef(false);
  // Verrou anti double clic de « Réessayer » : un seul appel à la fois.
  const enVol = useRef(false);

  async function charger() {
    if (enVol.current) return;
    enVol.current = true;
    setChargement({ etat: "attente" });
    try {
      const r = await preparer();
      setChargement(
        "error" in r ? { etat: "erreur", message: r.error } : { etat: "pret", prepare: r.data },
      );
    } finally {
      enVol.current = false;
    }
  }

  useEffect(() => {
    // Un seul appel à l'entrée, même si l'effet est rejoué par le mode strict.
    if (lance.current) return;
    lance.current = true;
    void charger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const prete = chargement.etat === "pret" ? chargement.prepare : null;

  return (
    <div className="grid gap-[var(--space-admin-8)] lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
      <div
        data-testid="cadre-apercu"
        aria-busy={chargement.etat === "attente"}
        className="h-[440px] overflow-auto rounded-[var(--radius-admin-lg)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-surface-sunken)]"
      >
        {chargement.etat === "attente" ? (
          <div className="p-[var(--space-admin-5)]" aria-hidden="true">
            <div className="mb-2 h-6 w-1/2 rounded bg-[color:var(--color-admin-border)]" />
            <div className="mb-2 h-4 w-full rounded bg-[color:var(--color-admin-border)]" />
            <div className="h-4 w-3/4 rounded bg-[color:var(--color-admin-border)]" />
          </div>
        ) : null}
        {chargement.etat === "erreur" ? (
          <div role="alert" className="p-[var(--space-admin-5)]">
            <p className="mb-[var(--space-admin-3)]">{chargement.message}</p>
            <AdminButton variant="secondary" size="lg" onClick={() => void charger()}>
              Réessayer
            </AdminButton>
          </div>
        ) : null}
        {prete ? (
          <Suspense
            fallback={<p className="p-[var(--space-admin-5)]">Chargement de l&apos;aperçu…</p>}
          >
            <ApercuDevis vue={prete.vue} urlPdf={prete.apercuPdfUrl} />
          </Suspense>
        ) : null}
      </div>
      <div className="flex min-w-0 flex-col gap-[var(--space-admin-6)] lg:min-h-[440px]">
        {prete ? (
          <EmailEnvoi
            destinataire={destinataire}
            salutation={salutation}
            envoyer={(email) => envoyer(prete.devisId, prete.majLe, email)}
          />
        ) : null}
        {onModifier ? (
          <div>
            <AdminButton variant="secondary" size="lg" icon={ChevronLeft} onClick={onModifier}>
              Modifier le devis
            </AdminButton>
          </div>
        ) : null}
      </div>
    </div>
  );
}
