"use client";
// use-client: hook (minuterie, état, useRouter) de sauvegarde automatique.

/**
 * Assistant de devis — sauvegarde automatique du brouillon (fiche E07).
 *
 *  - en continu : 3 s après la dernière modification, dans `startTransition` (la saisie n'est
 *    jamais bloquée) ;
 *  - au changement d'étape : `sauvegarderMaintenant` ATTEND la réponse (E06 reste sur place en
 *    cas d'échec) ;
 *  - première sauvegarde : `router.replace` vers `?brouillon=<id>` (un rechargement reprend
 *    au bon endroit) ;
 *  - conflit (deux onglets) : chaque envoi porte `attenduMajLe` ; sur conflit on s'arrête, on
 *    n'écrase JAMAIS, on ne réessaie pas.
 * L'action serveur (contrat C2) est injectée : ce fichier n'importe aucun module serveur.
 */
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, startTransition } from "react";

import type { ResultatSauvegarde } from "./AssistantDevis";
import type { Etape, EtatAssistant, EtatSerialise } from "./types";

export interface EntreeSauvegarde {
  id?: string;
  attenduMajLe?: string;
  donnees: EtatSerialise;
  origine?: { projetId?: string; rencontreId?: string };
}

/** Contrat C2. */
export type ReponseSauvegarde =
  { data: { id: string; majLe: string } } | { error: string; conflit?: true };

export type StatutBrouillon = "inactif" | "enCours" | "enregistre" | "erreur" | "conflit";

export interface ParamsBrouillonAuto {
  etat: EtatAssistant;
  etape: Etape;
  /** URL complète de la page de l'assistant (ex. `/fr/adm/qualiopi/devis/new`), sans requête. */
  urlAssistant: string;
  sauverBrouillon: (i: EntreeSauvegarde) => Promise<ReponseSauvegarde>;
  brouillonInitial?: { id: string; majLe: string } | undefined;
  /**
   * Le brouillon repris n'a pas pu être lu : l'assistant est reparti d'un état vide. Son id n'est
   * alors JAMAIS réutilisé (ni id ni `attenduMajLe` à l'envoi) : la première sauvegarde crée un
   * nouveau brouillon, et le brouillon illisible reste tel quel.
   */
  brouillonIllisible?: boolean | undefined;
  origine?: { projetId?: string; rencontreId?: string } | undefined;
  delaiMs?: number | undefined;
}

const DELAI_PAR_DEFAUT_MS = 3000;
const cle = (etat: EtatAssistant, etape: Etape) => JSON.stringify({ etat, etape });

export function useBrouillonAuto(p: ParamsBrouillonAuto) {
  const router = useRouter();
  const [statut, setStatut] = useState<StatutBrouillon>("inactif");
  const [erreur, setErreur] = useState<string | null>(null);
  const [enregistreA, setEnregistreA] = useState<number | null>(null);
  const [nonEnregistre, setNonEnregistre] = useState(false);

  const repris = p.brouillonIllisible ? undefined : p.brouillonInitial;
  const id = useRef<string | null>(repris?.id ?? null);
  const majLe = useRef<string | null>(repris?.majLe ?? null);
  const enConflit = useRef(false);
  const derniereCle = useRef(cle(p.etat, p.etape));
  const file = useRef<Promise<unknown>>(Promise.resolve());
  const sauverRef = useRef(p.sauverBrouillon);
  useEffect(() => {
    sauverRef.current = p.sauverBrouillon;
  });

  const executer = useCallback(
    async (s: EtatSerialise): Promise<ResultatSauvegarde> => {
      if (enConflit.current) {
        return {
          ok: false,
          erreur: "Ce brouillon a été modifié ailleurs : rechargez la dernière version.",
        };
      }
      setStatut("enCours");
      let r: ReponseSauvegarde;
      try {
        r = await sauverRef.current({
          ...(id.current !== null ? { id: id.current } : {}),
          ...(majLe.current !== null ? { attenduMajLe: majLe.current } : {}),
          donnees: s,
          ...(p.origine ? { origine: p.origine } : {}),
        });
      } catch {
        r = { error: "L'enregistrement du brouillon a échoué. Réessayez." };
      }
      if ("data" in r) {
        const premiere = id.current === null;
        id.current = r.data.id;
        majLe.current = r.data.majLe;
        derniereCle.current = cle(s.etat, s.etape);
        setStatut("enregistre");
        setErreur(null);
        setEnregistreA(Date.now());
        setNonEnregistre(false);
        if (premiere) router.replace(`${p.urlAssistant}?brouillon=${r.data.id}`, { scroll: false });
        return { ok: true };
      }
      if (r.conflit) {
        enConflit.current = true;
        setStatut("conflit");
        return { ok: false, erreur: r.error };
      }
      setStatut("erreur");
      setErreur(r.error);
      return { ok: false, erreur: r.error };
    },
    [p.urlAssistant, p.origine, router],
  );

  /** Sauvegarde en file : chaque envoi part avec le `majLe` rendu par le précédent. */
  const sauvegarderMaintenant = useCallback(
    (s: EtatSerialise): Promise<ResultatSauvegarde> => {
      const suite = file.current.then(() => executer(s));
      file.current = suite.catch(() => undefined);
      return suite;
    },
    [executer],
  );

  useEffect(() => {
    const courante = cle(p.etat, p.etape);
    if (courante === derniereCle.current) {
      setNonEnregistre(false);
      return;
    }
    setNonEnregistre(true);
    if (enConflit.current) return;
    const t = setTimeout(() => {
      startTransition(() => {
        void sauvegarderMaintenant({ v: 1, etape: p.etape, etat: p.etat });
      });
    }, p.delaiMs ?? DELAI_PAR_DEFAUT_MS);
    return () => clearTimeout(t);
  }, [p.etat, p.etape, p.delaiMs, sauvegarderMaintenant]);

  return { statut, erreur, enregistreA, nonEnregistre, sauvegarderMaintenant };
}
