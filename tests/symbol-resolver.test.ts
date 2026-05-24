import { describe, expect, it } from "vitest";
import type { ComponentIR } from "../src/ir/circuit-ir";
import {
  createPinAnchorsFromSpec,
  inferSymbolKind,
  resolveSymbolSpec,
} from "../src/schematic";

describe("symbol resolver", () => {
  it("keeps resistor and capacitor on dedicated symbol kinds", () => {
    expect(inferSymbolKind({ ref: "R1", type: "Resistor" })).toBe("passive_resistor");
    expect(inferSymbolKind({ ref: "C1", type: "Capacitor" })).toBe("passive_capacitor");
  });

  it("recognizes the connector header 1x4 example type", () => {
    expect(inferSymbolKind({ ref: "J1", type: "CONNECTOR_HEADER_1X4", component: "Header1x4" })).toBe(
      "connector_header_1x4",
    );
  });

  it("falls back to generic kinds for unmatched components", () => {
    expect(inferSymbolKind({ ref: "U1", type: "STM32", component: "MCU", device: "STM32F103C8T6" })).toBe(
      "generic_ic",
    );
    expect(inferSymbolKind({ ref: "X1", type: "MysteryPart" })).toBe("generic_component");
  });

  it("resolves the connector header 1x4 spec", () => {
    const component: ComponentIR = {
      ref: "J1",
      type: "CONNECTOR_HEADER_1X4",
      component: "Header1x4",
      device: "CONNECTOR_HEADER_1X4",
      package: "PinHeader1x4",
    };

    const spec = resolveSymbolSpec("connector_header_1x4", component);

    expect(spec.id).toBe("connector_header_1x4");
    expect(spec.backendMappings?.tscircuit).toMatchObject({
      ftype: "simple_pin_header",
    });
  });

  it("builds anchors from the resolved spec", () => {
    const spec = resolveSymbolSpec("connector_header_1x4", {
      ref: "J1",
      type: "CONNECTOR_HEADER_1X4",
    });
    const anchors = createPinAnchorsFromSpec("J1", ["1", "2", "3", "4"], spec);

    expect(anchors).toEqual([
      expect.objectContaining({ name: "1", side: "left", offset: { x: -24, y: -18 } }),
      expect.objectContaining({ name: "2", side: "left", offset: { x: -24, y: -6 } }),
      expect.objectContaining({ name: "3", side: "left", offset: { x: -24, y: 6 } }),
      expect.objectContaining({ name: "4", side: "left", offset: { x: -24, y: 18 } }),
    ]);
  });
});
