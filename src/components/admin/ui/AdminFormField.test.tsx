import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AdminFormField } from "./AdminFormField";

describe("AdminFormField", () => {
  it("renders label associated to input via htmlFor/id", () => {
    render(<AdminFormField label="Email" name="email" type="email" />);
    const input = screen.getByLabelText("Email");
    expect(input).toBeDefined();
    expect((input as HTMLInputElement).name).toBe("email");
  });

  it("sets aria-required when required=true", () => {
    render(<AdminFormField label="Nom" name="name" type="text" required />);
    const input = screen.getByLabelText(/Nom/);
    expect(input.getAttribute("aria-required")).toBe("true");
  });

  it("sets aria-invalid + aria-errormessage when error provided", () => {
    render(<AdminFormField label="Email" name="email" type="email" error="Format invalide" />);
    const input = screen.getByLabelText("Email");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    const errMsg = screen.getByRole("alert");
    expect(errMsg.textContent).toBe("Format invalide");
    expect(input.getAttribute("aria-errormessage")).toBe(errMsg.id);
  });

  it("sets aria-describedby with hint id", () => {
    render(<AdminFormField label="Email" name="email" type="email" hint="Utilisé pour le login" />);
    const input = screen.getByLabelText("Email");
    const describedBy = input.getAttribute("aria-describedby");
    expect(describedBy).toBeDefined();
    expect(describedBy).toContain("admin-field-email-hint");
  });

  it("renders textarea when type=textarea", () => {
    render(<AdminFormField label="Notes" name="notes" type="textarea" rows={5} />);
    const ta = screen.getByLabelText("Notes") as HTMLTextAreaElement;
    expect(ta.tagName).toBe("TEXTAREA");
    expect(ta.rows).toBe(5);
  });

  it("renders select with options", () => {
    render(
      <AdminFormField
        label="Status"
        name="status"
        type="select"
        options={[
          { value: "a", label: "A" },
          { value: "b", label: "B" },
        ]}
      />,
    );
    const sel = screen.getByLabelText("Status") as HTMLSelectElement;
    expect(sel.tagName).toBe("SELECT");
    expect(sel.options.length).toBe(2);
  });
});
