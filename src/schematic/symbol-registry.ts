import type { SymbolSpec } from "./types";

const SYMBOL_SPEC_REGISTRY: Record<string, SymbolSpec> = {
  passive_resistor: {
    id: "passive_resistor",
    kind: "passive_resistor",
    displayName: "电阻",
    body: {
      width: 24,
      height: 10,
      shape: "passive_resistor",
    },
    pins: [
      {
        name: "1",
        number: 1,
        side: "left",
        offset: { x: -12, y: 0 },
        direction: "passive",
        electricalType: "passive",
      },
      {
        name: "2",
        number: 2,
        side: "right",
        offset: { x: 12, y: 0 },
        direction: "passive",
        electricalType: "passive",
      },
    ],
    labels: {
      ref: {
        offset: { x: 0, y: -12 },
        anchor: "center",
      },
      value: {
        offset: { x: 0, y: 12 },
        anchor: "center",
      },
    },
    backendMappings: {
      tscircuit: {
        symbolName: "boxresistor_right",
        ftype: "simple_resistor",
        size: {
          width: 1.05,
          height: 0.4,
        },
      },
    },
  },
  passive_capacitor: {
    id: "passive_capacitor",
    kind: "passive_capacitor",
    displayName: "电容",
    body: {
      width: 24,
      height: 20,
      shape: "passive_capacitor",
    },
    pins: [
      {
        name: "1",
        number: 1,
        side: "left",
        offset: { x: -12, y: 0 },
        direction: "passive",
        electricalType: "passive",
      },
      {
        name: "2",
        number: 2,
        side: "right",
        offset: { x: 12, y: 0 },
        direction: "passive",
        electricalType: "passive",
      },
    ],
    labels: {
      ref: {
        offset: { x: 0, y: -16 },
        anchor: "center",
      },
      value: {
        offset: { x: 0, y: 16 },
        anchor: "center",
      },
    },
    backendMappings: {
      tscircuit: {
        symbolName: "capacitor_right",
        ftype: "simple_capacitor",
        size: {
          width: 1.05,
          height: 0.84,
        },
      },
    },
  },
  connector_header_1x4: {
    id: "connector_header_1x4",
    kind: "connector_header_1x4",
    displayName: "排针 1x4",
    body: {
      width: 32,
      height: 48,
      shape: "rect",
    },
    pins: [
      { name: "1", number: 1, side: "left", offset: { x: -16, y: -18 }, direction: "passive", electricalType: "passive" },
      { name: "2", number: 2, side: "left", offset: { x: -16, y: -6 }, direction: "passive", electricalType: "passive" },
      { name: "3", number: 3, side: "left", offset: { x: -16, y: 6 }, direction: "passive", electricalType: "passive" },
      { name: "4", number: 4, side: "left", offset: { x: -16, y: 18 }, direction: "passive", electricalType: "passive" },
    ],
    labels: {
      ref: {
        offset: { x: 0, y: -28 },
        anchor: "center",
      },
      value: {
        offset: { x: 0, y: 28 },
        anchor: "center",
      },
    },
    backendMappings: {
      tscircuit: {
        ftype: "simple_pin_header",
      },
    },
  },
  connector_header_2x4: {
    id: "connector_header_2x4",
    kind: "connector_header_2x4",
    displayName: "排针 2x4",
    body: {
      width: 40,
      height: 56,
      shape: "rect",
    },
    pins: [],
    labels: {
      ref: {
        offset: { x: 0, y: -32 },
        anchor: "center",
      },
      value: {
        offset: { x: 0, y: 32 },
        anchor: "center",
      },
    },
    backendMappings: {
      tscircuit: {
        ftype: "simple_pin_header",
      },
    },
  },
  generic_ic: {
    id: "generic_ic",
    kind: "generic_ic",
    displayName: "通用集成电路",
    body: {
      width: 32,
      height: 32,
      shape: "rect",
    },
    pins: [],
    labels: {
      ref: {
        offset: { x: 0, y: -22 },
        anchor: "center",
      },
      value: {
        offset: { x: 0, y: 22 },
        anchor: "center",
      },
    },
    backendMappings: {
      tscircuit: {
        ftype: "simple_chip",
      },
    },
  },
  generic_component: {
    id: "generic_component",
    kind: "generic_component",
    displayName: "通用元件",
    body: {
      width: 28,
      height: 24,
      shape: "rect",
    },
    pins: [],
    labels: {
      ref: {
        offset: { x: 0, y: -18 },
        anchor: "center",
      },
      value: {
        offset: { x: 0, y: 18 },
        anchor: "center",
      },
    },
    backendMappings: {
      tscircuit: {
        ftype: "simple_chip",
      },
    },
  },
};

export function listSymbolSpecs(): SymbolSpec[] {
  return Object.values(SYMBOL_SPEC_REGISTRY);
}

export function getSymbolSpecById(id: string): SymbolSpec | undefined {
  return SYMBOL_SPEC_REGISTRY[id];
}
