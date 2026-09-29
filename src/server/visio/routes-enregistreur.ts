/**
 * Les TRAITEMENTS des routes `/api/enregistreur/*` (PR 5). Les fichiers
 * `route.ts` ne font que la sortie `stub.invalid` et l'appel à l'une de ces
 * fonctions : tout ce qui décide est ici, testable sans serveur.
 *
 * Chaque traitement commence par `garderEnregistreur` (garde commune).
 */

import {
  BattementAppareil,
  BattementSession,
  CreerSession,
  DeclarerAccord,
  DeclarerRefus,
  ENTETES_MORCEAU,
  FinSession,
  FinTranche,
} from "@/lib/schemas/enregistreur";
import { enregistrerBattementAppareil } from "./battement-appareil";
import {
  dependancesParDefaut,
  garderEnregistreur,
  identifiantValide,
  introuvable,
  lireCorpsJson,
  lireOctets,
  repondre,
  repondreResultat,
  type DependancesGarde,
} from "./garde-route";
import { deposerMorceau } from "./morceaux";
import { listerRencontresDuJour } from "./liste-enregistreur";
import {
  battementSession,
  creerOuReprendreSession,
  declarerAccord,
  declarerRefus,
  terminerSession,
  terminerTranche,
} from "./sessions";
import { stockageR2, type StockageAudio } from "./stockage-audio";

export interface DependancesRoutes extends DependancesGarde {
  readonly stockage: StockageAudio;
}

export const dependancesRoutesParDefaut: DependancesRoutes = {
  ...dependancesParDefaut,
  stockage: stockageR2,
};

/** `GET rencontres-du-jour`. */
export async function traiterRencontresDuJour(
  req: Request,
  deps: DependancesRoutes = dependancesRoutesParDefaut,
): Promise<Response> {
  const g = await garderEnregistreur(req, "lecture", deps);
  if (!g.ok) return g.reponse;
  const rencontres = await listerRencontresDuJour(g.db, { maintenant: g.maintenant, mode: g.mode });
  return repondre(200, {
    mode: g.mode,
    serveurLe: g.maintenant.toISOString(),
    jetonExpireLe: g.appareil.expireLe.toISOString(),
    rencontres,
  });
}

/** `POST sessions`. */
export async function traiterCreerSession(
  req: Request,
  deps: DependancesRoutes = dependancesRoutesParDefaut,
): Promise<Response> {
  const g = await garderEnregistreur(req, "json", deps);
  if (!g.ok) return g.reponse;
  const corps = await lireCorpsJson(req, CreerSession);
  if (!corps.ok) return corps.reponse;
  return repondreResultat(
    await creerOuReprendreSession(g.db, {
      appareil: g.appareil,
      corps: corps.valeur,
      mode: g.mode,
      maintenant: g.maintenant,
    }),
  );
}

/** `POST sessions/[id]/accord`. */
export async function traiterAccord(
  req: Request,
  id: string,
  deps: DependancesRoutes = dependancesRoutesParDefaut,
): Promise<Response> {
  const g = await garderEnregistreur(req, "json", deps);
  if (!g.ok) return g.reponse;
  if (!identifiantValide(id)) return introuvable();
  const corps = await lireCorpsJson(req, DeclarerAccord);
  if (!corps.ok) return corps.reponse;
  return repondreResultat(
    await declarerAccord(g.db, {
      appareil: g.appareil,
      enregistrementId: id,
      corps: corps.valeur,
      maintenant: g.maintenant,
    }),
  );
}

/** `POST sessions/[id]/refus`. */
export async function traiterRefus(
  req: Request,
  id: string,
  deps: DependancesRoutes = dependancesRoutesParDefaut,
): Promise<Response> {
  const g = await garderEnregistreur(req, "json", deps);
  if (!g.ok) return g.reponse;
  if (!identifiantValide(id)) return introuvable();
  const corps = await lireCorpsJson(req, DeclarerRefus);
  if (!corps.ok) return corps.reponse;
  return repondreResultat(
    await declarerRefus(g.db, deps.stockage, {
      appareil: g.appareil,
      enregistrementId: id,
      refusLe: new Date(corps.valeur.refusLe),
      maintenant: g.maintenant,
    }),
  );
}

/** `PUT sessions/[id]/morceaux` — la SEULE route qui accepte du son. */
export async function traiterMorceau(
  req: Request,
  id: string,
  deps: DependancesRoutes = dependancesRoutesParDefaut,
): Promise<Response> {
  const g = await garderEnregistreur(req, "morceaux", deps);
  if (!g.ok) return g.reponse;
  if (!identifiantValide(id)) return introuvable();
  if (!deps.stockage.disponible()) {
    return repondre(503, { erreur: "stockage_indisponible", message: "Stockage non configuré." });
  }
  const lu = await lireOctets(req);
  if (!lu.ok) return lu.reponse;
  const h = req.headers;
  return repondreResultat(
    await deposerMorceau(g.db, deps.stockage, {
      appareil: g.appareil,
      enregistrementId: id,
      octets: lu.octets,
      maintenant: g.maintenant,
      entetes: {
        piste: h.get(ENTETES_MORCEAU.piste),
        tranche: h.get(ENTETES_MORCEAU.tranche),
        seq: h.get(ENTETES_MORCEAU.seq),
        debutCaptureMs: h.get(ENTETES_MORCEAU.debutCaptureMs),
        empreinte: h.get(ENTETES_MORCEAU.empreinte),
      },
    }),
  );
}

/** `POST sessions/[id]/battement`. */
export async function traiterBattementSession(
  req: Request,
  id: string,
  deps: DependancesRoutes = dependancesRoutesParDefaut,
): Promise<Response> {
  const g = await garderEnregistreur(req, "json", deps);
  if (!g.ok) return g.reponse;
  if (!identifiantValide(id)) return introuvable();
  const corps = await lireCorpsJson(req, BattementSession);
  if (!corps.ok) return corps.reponse;
  return repondreResultat(
    await battementSession(g.db, {
      appareil: g.appareil,
      enregistrementId: id,
      maintenant: g.maintenant,
    }),
  );
}

/** `POST sessions/[id]/tranches`. */
export async function traiterFinTranche(
  req: Request,
  id: string,
  deps: DependancesRoutes = dependancesRoutesParDefaut,
): Promise<Response> {
  const g = await garderEnregistreur(req, "json", deps);
  if (!g.ok) return g.reponse;
  if (!identifiantValide(id)) return introuvable();
  const corps = await lireCorpsJson(req, FinTranche);
  if (!corps.ok) return corps.reponse;
  return repondreResultat(
    await terminerTranche(g.db, {
      appareil: g.appareil,
      enregistrementId: id,
      corps: corps.valeur,
      maintenant: g.maintenant,
    }),
  );
}

/** `POST sessions/[id]/fin`. */
export async function traiterFin(
  req: Request,
  id: string,
  deps: DependancesRoutes = dependancesRoutesParDefaut,
): Promise<Response> {
  const g = await garderEnregistreur(req, "json", deps);
  if (!g.ok) return g.reponse;
  if (!identifiantValide(id)) return introuvable();
  const corps = await lireCorpsJson(req, FinSession);
  if (!corps.ok) return corps.reponse;
  return repondreResultat(
    await terminerSession(g.db, {
      appareil: g.appareil,
      enregistrementId: id,
      corps: corps.valeur,
      maintenant: g.maintenant,
    }),
  );
}

/** `POST appareil/battement`. */
export async function traiterBattementAppareil(
  req: Request,
  deps: DependancesRoutes = dependancesRoutesParDefaut,
): Promise<Response> {
  const g = await garderEnregistreur(req, "json", deps);
  if (!g.ok) return g.reponse;
  const corps = await lireCorpsJson(req, BattementAppareil);
  if (!corps.ok) return corps.reponse;
  const r = await enregistrerBattementAppareil(g.db, {
    appareil: g.appareil,
    corps: corps.valeur,
    maintenant: g.maintenant,
  });
  return repondre(r.statut, { ...r.corps, jetonExpireLe: g.appareil.expireLe.toISOString() });
}
