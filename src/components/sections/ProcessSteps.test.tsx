import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProcessSteps } from "./ProcessSteps";

const steps = [
  { id: "discover", title: "Discover", description: "Explore goals." },
  { id: "build", title: "Build", description: "Ship the fix." },
];

describe("<ProcessSteps>", () => {
  it("numbers the steps starting at 01", () => {
    const { container } = render(<ProcessSteps steps={steps} />);
    const nums = Array.from(container.querySelectorAll("span[aria-hidden='true']")).map((n) =>
      n.textContent?.trim(),
    );
    expect(nums).toEqual(["01", "02"]);
  });

  it("renders titles + descriptions", () => {
    render(<ProcessSteps steps={steps} />);
    expect(screen.getByText("Discover")).toBeTruthy();
    expect(screen.getByText("Build")).toBeTruthy();
  });
});
