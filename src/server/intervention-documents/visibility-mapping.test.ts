import { describe, it, expect } from "vitest";
import {
  targetRoles,
  visibilitesForRole,
  VISIBILITES,
  type EquipeRole,
} from "./visibility-mapping";

const ROLES: EquipeRole[] = ["formateur", "commercial"];

describe("visibility-mapping", () => {
  it("commercial → commerciaux + formateurs ; formateur → formateurs", () => {
    expect(targetRoles("commercial").sort()).toEqual(["commercial", "formateur"]);
    expect(targetRoles("formateur")).toEqual(["formateur"]);
  });

  it("stagiaire / interne → personne (ni notif ni portail)", () => {
    expect(targetRoles("stagiaire")).toEqual([]);
    expect(targetRoles("interne")).toEqual([]);
  });

  it("un commercial ne voit que les docs 'commercial'", () => {
    expect(visibilitesForRole("commercial")).toEqual(["commercial"]);
  });

  it("un formateur voit 'formateur' + 'commercial'", () => {
    expect(visibilitesForRole("formateur").sort()).toEqual(["commercial", "formateur"]);
  });

  // INVARIANT CŒUR : notification ⟺ visibilité portail.
  // Empêche le bug « e-mail de notif vers un doc invisible au portail ».
  it("invariant inverse : R ∈ targetRoles(V) ⟺ V ∈ visibilitesForRole(R)", () => {
    for (const v of VISIBILITES) {
      for (const r of ROLES) {
        const notified = targetRoles(v).includes(r);
        const visible = visibilitesForRole(r).includes(v);
        expect(notified, `visibilité=${v} rôle=${r}`).toBe(visible);
      }
    }
  });
});
