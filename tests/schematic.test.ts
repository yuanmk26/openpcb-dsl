import { describe, expect, it } from "vitest";
import { createSchematicDocument, createSchematicSheet } from "../src/schematic";

describe("schematic helpers", () => {
  it("creates an empty schematic document", () => {
    expect(createSchematicDocument("doc-1", "Demo")).toEqual({
      id: "doc-1",
      title: "Demo",
      sheets: [],
    });
  });

  it("creates an empty schematic sheet", () => {
    expect(createSchematicSheet("sheet-1")).toEqual({
      id: "sheet-1",
      name: "Sheet 1",
      items: [],
    });
  });
});
