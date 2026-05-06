import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Alert, AlertTitle, AlertDescription } from "./alert";

describe("<Alert>", () => {
  it("renders with role=alert by default", () => {
    render(<Alert>Watch out</Alert>);
    expect(screen.getByRole("alert").textContent).toBe("Watch out");
  });

  it("supports title + description composition", () => {
    render(
      <Alert variant="warning">
        <AlertTitle>Heads up</AlertTitle>
        <AlertDescription>Read this first.</AlertDescription>
      </Alert>,
    );
    expect(screen.getByText("Heads up").tagName).toBe("H3");
    expect(screen.getByText("Read this first.")).toBeTruthy();
  });

});
