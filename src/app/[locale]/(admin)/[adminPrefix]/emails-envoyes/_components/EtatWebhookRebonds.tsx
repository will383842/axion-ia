// État du webhook de rebonds — le diagnostic, lisible sans SSH.
//
// ## Pourquoi cet écran existe
//
// Un rebond est un message ACCEPTÉ par notre relais puis refusé par le serveur
// du destinataire. Il est invisible du worker : il n'arrive que par un appel
// de ZeptoMail sur `/api/zeptomail/webhook`. Si cet appel n'arrive jamais, le
// compteur de rebonds vaut 0 — et ce zéro ne prouve rien. Une convocation de
// formation peut être refusée sans que personne ne l'apprenne.
//
// 🔑 Les deux battements ci-dessous existent parce qu'un seul ne suffisait pas.
// Jusqu'au 2026-09-07, seul l'appel AUTHENTIFIÉ était enregistré, et la route
// rend `200` sur signature invalide (délibérément : ZeptoMail sonde l'URL en
// POST non signé avant d'autoriser la création du webhook). Un appel refusé ne
// laissait donc aucune trace, et « JAMAIS » s'affichait aussi bien pour
// « personne ne nous appelle » que pour « on nous appelle et on refuse » —
// deux pannes qui demandent des gestes CONTRAIRES.
//
// Et rien ailleurs ne rattrapait : en production, Next ne journalise aucune
// requête HTTP. Ces deux lignes sont la seule trace.

import { AdminCard } from "@/components/admin/ui";

interface Props {
  /** Dernier appel REÇU sur la route, authentifié ou non. */
  recu: string | null;
  /** Dernier appel dont la signature a été validée. */
  authentifie: string | null;
}

function formater(iso: string | null): string {
  if (!iso) return "jamais";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "jamais";
  return d.toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" });
}

/** Lecture en français de la combinaison des deux battements. */
function diagnostic(
  recu: string | null,
  authentifie: string | null,
): {
  ton: "ok" | "attention" | "neutre";
  titre: string;
  quoiFaire: string;
} {
  if (authentifie) {
    return {
      ton: "ok",
      titre: "La chaîne est prouvée.",
      quoiFaire:
        "ZeptoMail nous appelle et la clé concorde. Un rebond sera enregistré et visible dans la liste ci-dessous.",
    };
  }
  if (recu) {
    return {
      ton: "attention",
      titre: "ZeptoMail nous appelle, mais nous refusons ses appels.",
      quoiFaire:
        "La signature ne passe pas : la clé d'authentification du webhook diffère entre la console ZeptoMail et la configuration du serveur. Regénérez-la d'un côté et reposez-la de l'autre — les rebonds sont perdus tant que l'écart dure.",
    };
  }
  return {
    ton: "neutre",
    titre: "Aucun appel n'a jamais été reçu.",
    quoiFaire:
      "Cela peut être normal : ZeptoMail n'appelle que lorsqu'un message rebondit, et rien n'a peut-être rebondi. Pour trancher, déclenchez un envoi de test depuis la console ZeptoMail (Webhooks → le webhook des rebonds → Test) : cette ligne doit alors porter une date. Si elle reste vide, l'abonnement n'existe pas de leur côté ou l'URL enregistrée est fausse.",
  };
}

export function EtatWebhookRebonds({ recu, authentifie }: Props): React.ReactElement {
  const d = diagnostic(recu, authentifie);
  const couleur =
    d.ton === "ok"
      ? "var(--color-admin-success)"
      : d.ton === "attention"
        ? "var(--color-admin-warning)"
        : "var(--color-admin-fg-muted)";

  return (
    <AdminCard className="mb-[var(--space-admin-6)]">
      <h2 className="admin-h2">Détection des rebonds</h2>
      <p className="admin-meta mb-[var(--space-admin-5)]">
        Un rebond est un e-mail accepté par notre relais puis refusé par le serveur du destinataire.
        Il n’est connu que par un appel de ZeptoMail : sans cet appel, un compteur de rebonds à zéro
        ne prouve rien.
      </p>

      <dl className="admin-dl mb-[var(--space-admin-5)]">
        <div className="flex flex-wrap items-baseline gap-[var(--space-admin-4)]">
          <dt className="admin-dt">Dernier appel reçu</dt>
          <dd className="admin-dd">{formater(recu)}</dd>
        </div>
        <div className="flex flex-wrap items-baseline gap-[var(--space-admin-4)]">
          <dt className="admin-dt">Dernier appel authentifié</dt>
          <dd className="admin-dd">{formater(authentifie)}</dd>
        </div>
      </dl>

      <p className="text-[length:var(--text-admin-sm)] font-semibold" style={{ color: couleur }}>
        {d.titre}
      </p>
      <p className="admin-meta-small">{d.quoiFaire}</p>
    </AdminCard>
  );
}
