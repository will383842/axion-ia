import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "./card";

describe("<Card>", () => {
  it("composes header, title, description, content", () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Title</CardTitle>
          <CardDescription>Description</CardDescription>
        </CardHeader>
        <CardContent>Body</CardContent>
      </Card>,
    );
    expect(screen.getByText("Title").tagName).toBe("H3");
    expect(screen.getByText("Description")).toBeTruthy();
    expect(screen.getByText("Body")).toBeTruthy();
  });

  it("applies hover-shadow transition", () => {
    const { container } = render(<Card>x</Card>);
    expect(container.firstChild).toHaveProperty("className");
    expect((container.firstChild as HTMLElement).className).toContain("hover:shadow-card");
  });

});
