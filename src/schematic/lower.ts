import type {
  CircuitIR,
  ComponentIR,
  PinDefIR,
  ComponentDefIR,
  NetIR,
} from "../ir/circuit-ir";
import {
  createSchematicDocument,
  createSchematicSheet,
  type Point,
  type SchematicPinAnchor,
  type SchematicPinDirection,
  type SchematicPinSide,
  type SchematicDocument,
  type SchematicSheet,
  type SchematicSymbolInstance,
  type SymbolPinSpec,
  type SymbolSpec,
} from "./types";
import { inferSymbolKind, resolveSymbolSpec } from "./symbol-resolver";

interface SymbolPlacement {
  symbol: SchematicSymbolInstance;
  anchorsByName: Record<string, SchematicPinAnchor>;
}

const SYMBOL_SPACING_X = 80;
const SYMBOL_SPACING_Y = 40;
const PASSIVE_PIN_OFFSET = 12;
const GENERIC_PIN_STEP_Y = 10;
const GENERIC_PIN_OFFSET_X = 20;

export function lowerCircuitIrToSchematic(ir: CircuitIR, title = "OpenPCB Schematic"): SchematicDocument {
  const document = createSchematicDocument("schematic-1", title);
  const sheet = createSchematicSheet("sheet-1");
  document.sheets.push(sheet);

  const placements = createSymbolPlacements(ir);
  const sortedRefs = Object.keys(placements).sort(compareComponentRefs);

  for (const ref of sortedRefs) {
    sheet.items.push(placements[ref].symbol);
  }

  appendNetGraphics(sheet, ir, placements);

  return document;
}

function createSymbolPlacements(ir: CircuitIR): Record<string, SymbolPlacement> {
  const pinNamesByRef = collectPinNamesByRef(ir);
  const refs = Object.keys(ir.components).sort(compareComponentRefs);
  const placements: Record<string, SymbolPlacement> = {};

  refs.forEach((ref, index) => {
    const component = ir.components[ref];
    const pinNames = pinNamesByRef[ref] ?? inferDefaultPinNames(component);
    const symbolKind = inferSymbolKind(component);
    const symbolSpec = resolveSymbolSpec(symbolKind, component);
    const anchors = createPinAnchors(
      component,
      pinNames,
      symbolSpec,
      ir.componentDefs[component.component ?? component.type],
    );
    const position = {
      x: (index % 4) * SYMBOL_SPACING_X,
      y: Math.floor(index / 4) * SYMBOL_SPACING_Y,
    };

    const symbol: SchematicSymbolInstance = {
      kind: "symbol",
      id: `symbol:${ref}`,
      sourceRef: ref,
      symbolKind,
      symbolSpecId: symbolSpec.id,
      position,
      rotation: 0,
      pins: anchors,
      labels: [{ text: ref }],
      properties: createSymbolProperties(component),
      placementSource: "auto",
    };

    placements[ref] = {
      symbol,
      anchorsByName: Object.fromEntries(anchors.map((anchor) => [anchor.name, anchor])),
    };
  });

  return placements;
}

function appendNetGraphics(
  sheet: SchematicSheet,
  ir: CircuitIR,
  placements: Record<string, SymbolPlacement>,
): void {
  const nets = Object.values(ir.nets).sort((a, b) => a.name.localeCompare(b.name));

  for (const net of nets) {
    const anchorPoints = net.pins
      .map((pinRef) => resolvePinPoint(pinRef, placements))
      .filter((point): point is Point => point !== undefined);

    if (anchorPoints.length === 0) {
      continue;
    }

    if (anchorPoints.length === 1) {
      sheet.items.push({
        kind: "net_label",
        id: `net-label:${net.name}`,
        netName: net.name,
        position: { x: anchorPoints[0].x + 10, y: anchorPoints[0].y },
        orientation: "right",
      });
      continue;
    }

    if (anchorPoints.length === 2) {
      sheet.items.push({
        kind: "wire",
        id: `wire:${net.name}:0`,
        netName: net.name,
        points: orthogonalPath(anchorPoints[0], anchorPoints[1]),
        routingStyle: "orthogonal",
      });
      sheet.items.push({
        kind: "net_label",
        id: `net-label:${net.name}`,
        netName: net.name,
        position: midpoint(anchorPoints[0], anchorPoints[1]),
        orientation: "up",
      });
      continue;
    }

    const junction = computeNetJunction(net, anchorPoints);
    sheet.items.push({
      kind: "junction",
      id: `junction:${net.name}`,
      position: junction,
    });

    anchorPoints.forEach((point, index) => {
      sheet.items.push({
        kind: "wire",
        id: `wire:${net.name}:${index}`,
        netName: net.name,
        points: orthogonalPath(point, junction),
        routingStyle: "orthogonal",
      });
    });

    sheet.items.push({
      kind: "net_label",
      id: `net-label:${net.name}`,
      netName: net.name,
      position: { x: junction.x + 8, y: junction.y - 4 },
      orientation: "right",
    });
  }
}

function collectPinNamesByRef(ir: CircuitIR): Record<string, string[]> {
  const pinsByRef = new Map<string, Set<string>>();

  for (const net of Object.values(ir.nets)) {
    for (const pinRef of net.pins) {
      const [ref, pin] = splitPinRef(pinRef);
      if (!pinsByRef.has(ref)) {
        pinsByRef.set(ref, new Set());
      }
      pinsByRef.get(ref)?.add(pin);
    }
  }

  return Object.fromEntries(
    [...pinsByRef.entries()].map(([ref, pins]) => [ref, [...pins].sort(comparePinNames)]),
  );
}

function splitPinRef(pinRef: string): [string, string] {
  const separatorIndex = pinRef.indexOf(".");
  if (separatorIndex < 0) {
    return [pinRef, pinRef];
  }

  return [pinRef.slice(0, separatorIndex), pinRef.slice(separatorIndex + 1)];
}

function inferDefaultPinNames(component: ComponentIR): string[] {
  const symbolKind = inferSymbolKind(component);
  if (symbolKind === "passive_resistor" || symbolKind === "passive_capacitor") {
    return ["1", "2"];
  }
  if (symbolKind === "connector_header_1x4") {
    return ["1", "2", "3", "4"];
  }
  const normalizedType = component.type.toLowerCase();
  if (normalizedType === "testpoint" || normalizedType === "test_point") {
    return ["1"];
  }
  return ["1"];
}

function createPinAnchors(
  component: ComponentIR,
  pinNames: string[],
  symbolSpec: SymbolSpec,
  componentDef?: ComponentDefIR,
): SchematicPinAnchor[] {
  const anchorsFromSpec = createPinAnchorsFromSpec(component.ref, pinNames, symbolSpec);
  if (anchorsFromSpec) {
    return anchorsFromSpec;
  }

  if (pinNames.length === 1) {
    return [
      {
        id: `pin:${component.ref}:${pinNames[0]}`,
        name: pinNames[0],
        direction: "passive",
        side: "right",
        offset: { x: PASSIVE_PIN_OFFSET, y: 0 },
      },
    ];
  }

  const leftCount = Math.ceil(pinNames.length / 2);
  const rightCount = pinNames.length - leftCount;

  return pinNames.map((name, index) => {
    const isLeft = index < leftCount;
    const slot = isLeft ? index : index - leftCount;
    const totalOnSide = isLeft ? leftCount : rightCount;
    const centeredY = (slot - (totalOnSide - 1) / 2) * GENERIC_PIN_STEP_Y;
    const pinDef = componentDef?.pins[name];

    return {
      id: `pin:${component.ref}:${name}`,
      name,
      direction: mapPinKindToDirection(pinDef),
      side: isLeft ? "left" : "right",
      offset: {
        x: isLeft ? -GENERIC_PIN_OFFSET_X : GENERIC_PIN_OFFSET_X,
        y: centeredY,
      },
      electricalType: pinDef?.kind,
    };
  });
}

export function createPinAnchorsFromSpec(
  ref: string,
  pinNames: string[],
  symbolSpec: SymbolSpec,
): SchematicPinAnchor[] | undefined {
  if (symbolSpec.pins.length === 0) {
    return undefined;
  }

  const pinsByName = new Map(symbolSpec.pins.map((pin) => [pin.name, pin]));
  if (!pinNames.every((pinName) => pinsByName.has(pinName))) {
    return undefined;
  }

  return pinNames.map((pinName) => createAnchorFromSymbolPinSpec(ref, pinsByName.get(pinName)!));
}

function createAnchorFromSymbolPinSpec(ref: string, pin: SymbolPinSpec): SchematicPinAnchor {
  return {
    id: `pin:${ref}:${pin.name}`,
    name: pin.name,
    direction: pin.direction,
    side: pin.side,
    offset: pin.offset,
    electricalType: pin.electricalType,
  };
}

function mapPinKindToDirection(pinDef?: PinDefIR): SchematicPinDirection | undefined {
  switch (pinDef?.kind) {
    case "in":
      return "input";
    case "out":
      return "output";
    case "inout":
      return "bidirectional";
    case "passive":
      return "passive";
    case "power_in":
    case "power_out":
      return "power";
    default:
      return undefined;
  }
}

function createSymbolProperties(component: ComponentIR): Record<string, string> {
  const properties: Record<string, string> = {
    type: component.type,
  };

  if (component.value) {
    properties.value = component.value;
  }

  if (component.device) {
    properties.device = component.device;
  }

  if (component.component) {
    properties.component = component.component;
  }

  return properties;
}

function resolvePinPoint(pinRef: string, placements: Record<string, SymbolPlacement>): Point | undefined {
  const [ref, pin] = splitPinRef(pinRef);
  const placement = placements[ref];
  if (!placement?.symbol.position) {
    return undefined;
  }

  const anchor = placement.anchorsByName[pin];
  if (!anchor?.offset) {
    return placement.symbol.position;
  }

  return {
    x: placement.symbol.position.x + anchor.offset.x,
    y: placement.symbol.position.y + anchor.offset.y,
  };
}

function computeNetJunction(net: NetIR, points: Point[]): Point {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);

  return {
    x: Math.round((Math.min(...xs) + Math.max(...xs)) / 2),
    y: Math.round((Math.min(...ys) + Math.max(...ys)) / 2 + computeNetYOffset(net.name)),
  };
}

function computeNetYOffset(netName: string): number {
  const hash = [...netName].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return (hash % 3) * 6 - 6;
}

function orthogonalPath(from: Point, to: Point): Point[] {
  if (from.x === to.x || from.y === to.y) {
    return [from, to];
  }

  return [from, { x: to.x, y: from.y }, to];
}

function midpoint(a: Point, b: Point): Point {
  return {
    x: Math.round((a.x + b.x) / 2),
    y: Math.round((a.y + b.y) / 2),
  };
}

function compareComponentRefs(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true });
}

function comparePinNames(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true });
}
