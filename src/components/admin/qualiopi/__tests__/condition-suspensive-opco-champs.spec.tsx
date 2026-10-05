/**
 * INT-T65-A : les champs de la condition suspensive OPCO, à
 * l'endroit où la console génère la convention (`DocumentsSection`).
 *
 * Posé AVANT l'implémentation (coordination Partners, issue
 * axion-apporteurs, issue 656, message du 2026-10-04 09:07 UTC) : il échoue tant que
 * `ConditionSuspensiveOpcoChamps` n'existe pas.
 *
 * Contrat fixé ici :
 *   - case NON cochée par défaut, et alors aucun seuil ni date ne part ;
 *   - cochée → seuil prérempli à 50 %, LU de la SSOT
 *     (`SEUIL_CONDITION_SUSPENSIVE_OPCO_BPS`), jamais écrit en dur ;
 *   - seuil modifiable, bascule pourcentage / montant en euros ; ce qui part
 *     est en points de base OU en centimes entiers, jamais les deux ;
 *   - date limite REQUISE quand la case est cochée ;
 *   - micro-copie au vouvoiement.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import {
  CONDITION_NON_POSEE,
  ConditionSuspensiveOpcoChamps,
  entreeConditionSuspensive,
} from "../ConditionSuspensiveOpcoChamps";
import { SEUIL_CONDITION_SUSPENSIVE_OPCO_BPS } from "@/server/qualiopi/config/financing";

afterEach(cleanup);

function caseACocher(): HTMLInputElement {
  return screen.getByRole("checkbox", {
    name: /sous condition de l'accord de prise en charge de l'OPCO/i,
  }) as HTMLInputElement;
}

/** Dernière valeur remontée au formulaire parent. */
function derniere(onChange: ReturnType<typeof vi.fn>): Record<string, unknown> {
  return onChange.mock.calls.at(-1)?.[0] as Record<string, unknown>;
}

describe("ConditionSuspensiveOpcoChamps", () => {
  it("case NON cochée par défaut, sans seuil ni date limite affichés", () => {
    render(<ConditionSuspensiveOpcoChamps onChange={vi.fn()} />);
    expect(caseACocher().checked).toBe(false);
    expect(screen.queryByLabelText(/seuil/i)).toBeNull();
    expect(screen.queryByLabelText(/date limite/i)).toBeNull();
  });

  it("cochée → seuil prérempli à 50 %, lu de la SSOT, et date limite requise", () => {
    const onChange = vi.fn();
    render(<ConditionSuspensiveOpcoChamps onChange={onChange} />);
    fireEvent.click(caseACocher());

    expect(SEUIL_CONDITION_SUSPENSIVE_OPCO_BPS).toBe(5000);
    const seuil = screen.getByLabelText(/seuil de prise en charge \(%\)/i) as HTMLInputElement;
    expect(seuil.value).toBe(String(SEUIL_CONDITION_SUSPENSIVE_OPCO_BPS / 100));

    const date = screen.getByLabelText(/date limite/i) as HTMLInputElement;
    expect(date.type).toBe("date");
    expect(date.required).toBe(true);

    expect(derniere(onChange)).toMatchObject({
      conditionSuspensiveOpco: true,
      seuilType: "pourcentage",
      seuilBps: SEUIL_CONDITION_SUSPENSIVE_OPCO_BPS,
      seuilCents: null,
    });
  });

  it("le seuil en % est modifiable et part en points de base entiers", () => {
    const onChange = vi.fn();
    render(<ConditionSuspensiveOpcoChamps onChange={onChange} />);
    fireEvent.click(caseACocher());
    fireEvent.change(screen.getByLabelText(/seuil de prise en charge \(%\)/i), {
      target: { value: "62,5" },
    });
    fireEvent.change(screen.getByLabelText(/date limite/i), { target: { value: "2026-12-15" } });

    expect(derniere(onChange)).toMatchObject({
      conditionSuspensiveOpco: true,
      seuilType: "pourcentage",
      seuilBps: 6250,
      seuilCents: null,
      dateLimite: "2026-12-15",
    });
  });

  it("bascule en montant : le seuil part en centimes entiers, plus en points de base", () => {
    const onChange = vi.fn();
    render(<ConditionSuspensiveOpcoChamps onChange={onChange} />);
    fireEvent.click(caseACocher());
    fireEvent.click(screen.getByRole("radio", { name: /montant/i }));

    expect(screen.queryByLabelText(/seuil de prise en charge \(%\)/i)).toBeNull();
    fireEvent.change(screen.getByLabelText(/seuil de prise en charge \(€\)/i), {
      target: { value: "1 500,50" },
    });

    expect(derniere(onChange)).toMatchObject({
      conditionSuspensiveOpco: true,
      seuilType: "montant",
      seuilBps: null,
      seuilCents: 150_050,
    });

    fireEvent.click(screen.getByRole("radio", { name: /pourcentage/i }));
    expect(derniere(onChange)).toMatchObject({ seuilType: "pourcentage", seuilCents: null });
  });

  it("décochée : rien ne part, ni seuil ni date", () => {
    const onChange = vi.fn();
    render(<ConditionSuspensiveOpcoChamps onChange={onChange} />);
    fireEvent.click(caseACocher());
    fireEvent.click(caseACocher());

    expect(derniere(onChange)).toEqual({
      conditionSuspensiveOpco: false,
      seuilType: null,
      seuilBps: null,
      seuilCents: null,
      dateLimite: null,
    });
  });

  it("micro-copie au vouvoiement", () => {
    const { container } = render(<ConditionSuspensiveOpcoChamps onChange={vi.fn()} />);
    fireEvent.click(caseACocher());
    const texte = container.textContent ?? "";
    expect(texte).toMatch(/\b(vous|votre|vos)\b/i);
    expect(texte).not.toMatch(/\b(tu|toi|ton|ta|tes)\b/i);
  });

  it("décocher puis recocher ne réécrit pas un seuil déjà saisi", () => {
    const onChange = vi.fn();
    render(<ConditionSuspensiveOpcoChamps onChange={onChange} />);
    fireEvent.click(caseACocher());
    fireEvent.change(screen.getByLabelText(/seuil de prise en charge \(%\)/i), {
      target: { value: "70" },
    });
    fireEvent.click(caseACocher());
    fireEvent.click(caseACocher());
    expect(derniere(onChange)).toMatchObject({ seuilBps: 7000 });
  });
});

describe("entreeConditionSuspensive — ce qui part vers la server action", () => {
  it("case non cochée : rien", () => {
    expect(entreeConditionSuspensive(CONDITION_NON_POSEE)).toBeUndefined();
  });

  it("cochée : exactement un seuil ENTIER et la date", () => {
    expect(
      entreeConditionSuspensive({
        conditionSuspensiveOpco: true,
        seuilType: "montant",
        seuilBps: null,
        seuilCents: 150_050,
        dateLimite: "2026-12-15",
      }),
    ).toEqual({ seuilConditionBps: null, seuilConditionCents: 150_050, dateLimite: "2026-12-15" });
  });

  it("seuil illisible ou date absente : un message, au vouvoiement, et rien ne part", () => {
    const sansSeuil = entreeConditionSuspensive({
      conditionSuspensiveOpco: true,
      seuilType: "pourcentage",
      seuilBps: null,
      seuilCents: null,
      dateLimite: "2026-12-15",
    });
    expect(sansSeuil).toHaveProperty("erreur");
    const sansDate = entreeConditionSuspensive({
      conditionSuspensiveOpco: true,
      seuilType: "pourcentage",
      seuilBps: 5000,
      seuilCents: null,
      dateLimite: null,
    });
    expect(sansDate).toEqual({ erreur: "Indiquez la date limite de l'accord de l'OPCO." });
  });
});
