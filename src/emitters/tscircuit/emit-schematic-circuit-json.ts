import type {
  Point,
  SchematicDocument,
  SchematicNetLabel,
  SchematicOrientation,
  SchematicPinAnchor,
  SchematicSymbolInstance,
  SymbolSpec,
  TscircuitSymbolMapping,
  SchematicWire,
} from "../../schematic";
import { getSymbolSpecById, mapSymbolSpecToTscircuit } from "../../schematic";

export interface TscircuitPoint {
  x: number;
  y: number;
}

export interface TscircuitSourceProjectMetadata {
  type: "source_project_metadata";
  source_project_metadata_id: string;
  title?: string;
}

export interface TscircuitSourceComponent {
  type: "source_component";
  source_component_id: string;
  name: string;
  ftype?: string;
  resistance?: string;
  capacitance?: string;
  pin_count?: number;
  gender?: "male" | "female";
}

export interface TscircuitSourcePort {
  type: "source_port";
  source_port_id: string;
  source_component_id: string;
  name: string;
  pin_number?: number;
}

export interface TscircuitSourceNet {
  type: "source_net";
  source_net_id: string;
  name: string;
}

export interface TscircuitSourceTrace {
  type: "source_trace";
  source_trace_id: string;
  connected_source_port_ids: string[];
  connected_source_net_ids: string[];
}

export interface TscircuitSchematicComponent {
  type: "schematic_component";
  schematic_component_id: string;
  source_component_id: string;
  center: TscircuitPoint;
  size: {
    width: number;
    height: number;
  };
  rotation?: number;
  symbol_name?: string;
  symbol_display_value?: string;
  is_box_with_pins?: boolean;
}

export interface TscircuitSchematicPort {
  type: "schematic_port";
  schematic_port_id: string;
  schematic_component_id: string;
  source_port_id: string;
  center: TscircuitPoint;
  facing_direction: "left" | "right" | "up" | "down";
  distance_from_component_edge: number;
  side_of_component?: "left" | "right" | "top" | "bottom";
  pin_number?: number;
  display_pin_label?: string;
  is_connected: boolean;
}

export interface TscircuitSchematicText {
  type: "schematic_text";
  schematic_text_id: string;
  schematic_component_id: string;
  text: string;
  font_size?: number;
  position: TscircuitPoint;
  rotation?: number;
  anchor?:
    | "center"
    | "top_left"
    | "top_right"
    | "bottom_left"
    | "bottom_right"
    | "center_left"
    | "center_right"
    | "top_center"
    | "bottom_center"
    | "top"
    | "bottom"
    | "left"
    | "right";
  color?: string;
}

export interface TscircuitSchematicTrace {
  type: "schematic_trace";
  schematic_trace_id: string;
  source_trace_id: string;
  edges: Array<{
    from: TscircuitPoint;
    to: TscircuitPoint;
  }>;
  junctions: TscircuitPoint[];
}

export interface TscircuitSchematicNetLabel {
  type: "schematic_net_label";
  schematic_net_label_id: string;
  source_net_id: string;
  text: string;
  anchor_position: TscircuitPoint;
  center: TscircuitPoint;
  anchor_side: "left" | "right" | "top" | "bottom";
}

export type TscircuitSchematicCircuitJsonElement =
  | TscircuitSourceProjectMetadata
  | TscircuitSourceComponent
  | TscircuitSourcePort
  | TscircuitSourceNet
  | TscircuitSourceTrace
  | TscircuitSchematicComponent
  | TscircuitSchematicPort
  | TscircuitSchematicText
  | TscircuitSchematicTrace
  | TscircuitSchematicNetLabel;

interface EmitterContext {
  componentIdsByRef: Record<string, string>;
  netIdsByName: Record<string, string>;
  portInfoByPointKey: Record<string, PortInfo>;
  wireCountsByNet: Record<string, number>;
  junctionKeys: Set<string>;
}

interface PortInfo {
  sourcePortId: string;
  schematicPortId: string;
  schematicComponentId: string;
  originalCenter: Point;
  center: TscircuitPoint;
  pinName: string;
  pinNumber?: number;
  facingDirection: "left" | "right" | "up" | "down";
}

const SCHEMATIC_SCALE = 1 / 80;
const DISTANCE_FROM_COMPONENT_EDGE = 0.4;
const LABEL_OFFSET = 0.12;
const LABEL_TO_PORT_THRESHOLD = 0.18;

export function emitSchematicCircuitJson(
  schematic: SchematicDocument,
): TscircuitSchematicCircuitJsonElement[] {
  const elements: TscircuitSchematicCircuitJsonElement[] = [];
  const sheet = schematic.sheets[0];

  if (!sheet) {
    return [
      {
        type: "source_project_metadata",
        source_project_metadata_id: "source_project_metadata:0",
        title: schematic.title,
      },
    ];
  }

  const symbols = sheet.items.filter((item): item is SchematicSymbolInstance => item.kind === "symbol");
  const labels = sheet.items.filter((item): item is SchematicNetLabel => item.kind === "net_label");
  const wires = sheet.items.filter((item): item is SchematicWire => item.kind === "wire");
  const junctionKeys = new Set(
    sheet.items
      .filter((item) => item.kind === "junction")
      .map((item) => pointKey(item.position)),
  );

  const context = createEmitterContext(symbols, labels, wires, junctionKeys);

  for (const wire of wires) {
    context.netIdsByName[wire.netName] ??= makeSourceNetId(wire.netName);
  }

  elements.push({
    type: "source_project_metadata",
    source_project_metadata_id: "source_project_metadata:0",
    title: schematic.title,
  });

  elements.push(...symbols.flatMap((symbol) => emitSymbolElements(symbol, context)));
  elements.push(
    ...Object.keys(context.netIdsByName)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
      .map((netName) => ({
        type: "source_net" as const,
        source_net_id: context.netIdsByName[netName],
        name: netName,
      })),
  );
  elements.push(...wires.flatMap((wire) => emitWireElements(wire, context)));
  elements.push(...emitSyntheticLabelTraces(labels, context));
  elements.push(...labels.map((label) => emitNetLabel(label, context)));

  finalizePortConnectivity(elements, context);

  return elements;
}

function emitSymbolElements(
  symbol: SchematicSymbolInstance,
  context: EmitterContext,
): TscircuitSchematicCircuitJsonElement[] {
  const source_component_id = context.componentIdsByRef[symbol.sourceRef];
  const schematic_component_id = schematicComponentId(symbol.sourceRef);
  const symbolSpec = resolveSymbolSpec(symbol);
  const renderAsRectBox = shouldRenderAsRectBox(symbolSpec);
  const [sourceComponent] = createSourceComponent(symbol, source_component_id);
  const schematicComponent: TscircuitSchematicComponent = {
    type: "schematic_component",
    schematic_component_id,
    source_component_id,
    center: scalePoint(symbol.position ?? { x: 0, y: 0 }),
    size: inferSymbolSize(symbol, symbolSpec),
    rotation: symbol.rotation,
    symbol_name: renderAsRectBox ? undefined : inferSymbolName(symbol, symbolSpec),
    symbol_display_value: symbol.properties?.value,
    ...(renderAsRectBox ? { is_box_with_pins: true } : {}),
  };

  const ports = symbol.pins.map((pin, index) => {
    const originalCenter = addPoints(symbol.position ?? { x: 0, y: 0 }, pin.offset ?? { x: 0, y: 0 });
    const center = scalePoint(originalCenter);
    const sourcePortId = makeSourcePortId(symbol.sourceRef, pin.name);
    const schematicPortId = makeSchematicPortId(symbol.sourceRef, pin.name);
    const pinNumber = inferPinNumber(pin, index);
    const facingDirection = inferFacingDirection(pin);

    context.portInfoByPointKey[pointKey(originalCenter)] = {
      sourcePortId,
      schematicPortId,
      schematicComponentId: schematic_component_id,
      originalCenter,
      center,
      pinName: pin.name,
      pinNumber,
      facingDirection,
    };

    const sourcePort: TscircuitSourcePort = {
      type: "source_port",
      source_port_id: sourcePortId,
      source_component_id,
      name: pin.name,
      pin_number: pinNumber,
    };

    const schematicPort: TscircuitSchematicPort = {
      type: "schematic_port",
      schematic_port_id: schematicPortId,
      schematic_component_id,
      source_port_id: sourcePortId,
      center,
      facing_direction: facingDirection,
      distance_from_component_edge: DISTANCE_FROM_COMPONENT_EDGE,
      side_of_component: pin.side,
      pin_number: pinNumber,
      display_pin_label: pin.name,
      is_connected: false,
    };

    return [sourcePort, schematicPort];
  });

  const texts = renderAsRectBox ? emitRectSymbolTexts(symbol, schematic_component_id, symbolSpec) : [];

  return [sourceComponent, schematicComponent, ...ports.flat(), ...texts];
}

function createSourceComponent(
  symbol: SchematicSymbolInstance,
  source_component_id: string,
): [TscircuitSourceComponent] {
  const typeName = symbol.properties?.type ?? symbol.symbolKind;
  const mapping = resolveTscircuitMapping(symbol);

  if (symbol.symbolKind === "passive_resistor") {
    return [
      {
        type: "source_component",
        source_component_id,
        name: symbol.sourceRef,
        ftype: mapping?.ftype ?? "simple_resistor",
        resistance: symbol.properties?.value,
      },
    ];
  }

  if (symbol.symbolKind === "passive_capacitor") {
    return [
      {
        type: "source_component",
        source_component_id,
        name: symbol.sourceRef,
        ftype: mapping?.ftype ?? "simple_capacitor",
        capacitance: symbol.properties?.value,
      },
    ];
  }

  if (typeName.toLowerCase() === "testpoint" || typeName.toLowerCase() === "test_point") {
    return [
      {
        type: "source_component",
        source_component_id,
        name: symbol.sourceRef,
        ftype: mapping?.ftype ?? "simple_test_point",
      },
    ];
  }

  if (symbol.symbolKind === "connector_header_1x4") {
    return [
      {
        type: "source_component",
        source_component_id,
        name: symbol.sourceRef,
        ftype: mapping?.ftype ?? "simple_pin_header",
        pin_count: 4,
        gender: "male",
      },
    ];
  }

  return [
    {
      type: "source_component",
      source_component_id,
      name: symbol.sourceRef,
      ftype: mapping?.ftype ?? "simple_chip",
    },
  ];
}

function emitWireElements(
  wire: SchematicWire,
  context: EmitterContext,
): TscircuitSchematicCircuitJsonElement[] {
  const source_trace_id = makeSourceTraceId(wire.id);
  const portIds = collectPortIdsForWire(wire, context);
  const netId = context.netIdsByName[wire.netName] ?? makeSourceNetId(wire.netName);
  const sourceTrace: TscircuitSourceTrace = {
    type: "source_trace",
    source_trace_id,
    connected_source_port_ids: portIds,
    connected_source_net_ids: [netId],
  };

  const junctions = wire.points
    .filter((point) => context.junctionKeys.has(pointKey(point)))
    .map(scalePoint);

  const schematicTrace: TscircuitSchematicTrace = {
    type: "schematic_trace",
    schematic_trace_id: makeSchematicTraceId(wire.id),
    source_trace_id,
    edges: toEdges(wire.points),
    junctions,
  };

  markPortsConnected(portIds, context);

  return [sourceTrace, schematicTrace];
}

function emitSyntheticLabelTraces(
  labels: SchematicNetLabel[],
  context: EmitterContext,
): TscircuitSchematicCircuitJsonElement[] {
  const traces: TscircuitSchematicCircuitJsonElement[] = [];

  for (const label of labels) {
    if ((context.wireCountsByNet[label.netName] ?? 0) > 0) {
      continue;
    }

    const nearestPort = findNearestPort(label.position, context);
    if (!nearestPort || distance(scalePoint(label.position), nearestPort.center) > LABEL_TO_PORT_THRESHOLD) {
      continue;
    }

  const source_trace_id = makeSourceTraceId(`label:${label.id}`);
    const anchor = scalePoint(label.position);
    traces.push({
      type: "source_trace",
      source_trace_id,
      connected_source_port_ids: [nearestPort.sourcePortId],
      connected_source_net_ids: [context.netIdsByName[label.netName] ?? makeSourceNetId(label.netName)],
    });
    traces.push({
      type: "schematic_trace",
      schematic_trace_id: makeSchematicTraceId(`label:${label.id}`),
      source_trace_id,
      edges: [{ from: nearestPort.center, to: anchor }],
      junctions: [],
    });
    markPortsConnected([nearestPort.sourcePortId], context);
  }

  return traces;
}

function emitNetLabel(
  label: SchematicNetLabel,
  context: EmitterContext,
): TscircuitSchematicNetLabel {
  return {
    type: "schematic_net_label",
    schematic_net_label_id: `schematic_net_label:${label.id}`,
    source_net_id: context.netIdsByName[label.netName] ?? makeSourceNetId(label.netName),
    text: label.netName,
    anchor_position: scalePoint(label.position),
    center: shiftLabelCenter(scalePoint(label.position), label.orientation ?? "right"),
    anchor_side: orientationToAnchorSide(label.orientation ?? "right"),
  };
}

function toEdges(points: Point[]): Array<{ from: TscircuitPoint; to: TscircuitPoint }> {
  const edges: Array<{ from: TscircuitPoint; to: TscircuitPoint }> = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    edges.push({
      from: scalePoint(points[i]),
      to: scalePoint(points[i + 1]),
    });
  }
  return edges;
}

function collectPortIdsForWire(wire: SchematicWire, context: EmitterContext): string[] {
  const ids = new Set<string>();
  for (const point of [wire.points[0], wire.points[wire.points.length - 1]]) {
    const port = context.portInfoByPointKey[pointKey(point)];
    if (port) {
      ids.add(port.sourcePortId);
    }
  }
  return [...ids];
}

function inferSymbolName(symbol: SchematicSymbolInstance, symbolSpec?: SymbolSpec): string {
  const mapping = resolveTscircuitMapping(symbol);
  if (mapping?.symbolName) {
    return mapping.symbolName;
  }

  if (symbolSpec?.body.shape === "rect") {
    return "boxresistor_right";
  }

  switch (symbol.symbolKind) {
    case "passive_resistor":
      return "boxresistor_right";
    case "passive_capacitor":
      return "capacitor_right";
    default:
      return "boxresistor_right";
  }
}

function inferSymbolSize(
  symbol: SchematicSymbolInstance,
  symbolSpec?: SymbolSpec,
): { width: number; height: number } {
  const mapping = resolveTscircuitMapping(symbol);
  if (mapping?.size) {
    return mapping.size;
  }

  if (symbolSpec?.body) {
    return {
      width: round(symbolSpec.body.width * SCHEMATIC_SCALE),
      height: round(symbolSpec.body.height * SCHEMATIC_SCALE),
    };
  }

  switch (symbol.symbolKind) {
    case "passive_resistor":
      return { width: 1.05, height: 0.4 };
    case "passive_capacitor":
      return { width: 1.05, height: 0.84 };
    default:
      return {
        width: 1.4,
        height: Math.max(0.8, symbol.pins.length * 0.28),
      };
  }
}

function resolveTscircuitMapping(symbol: SchematicSymbolInstance): TscircuitSymbolMapping | undefined {
  const symbolSpec = resolveSymbolSpec(symbol);
  return symbolSpec ? mapSymbolSpecToTscircuit(symbolSpec) : undefined;
}

function resolveSymbolSpec(symbol: SchematicSymbolInstance): SymbolSpec | undefined {
  if (!symbol.symbolSpecId) {
    return undefined;
  }

  return getSymbolSpecById(symbol.symbolSpecId);
}

function shouldRenderAsRectBox(symbolSpec?: SymbolSpec): boolean {
  return symbolSpec?.body.shape === "rect";
}

function emitRectSymbolTexts(
  symbol: SchematicSymbolInstance,
  schematic_component_id: string,
  symbolSpec?: SymbolSpec,
): TscircuitSchematicText[] {
  if (!symbolSpec?.labels || !symbol.position) {
    return [];
  }

  const texts: TscircuitSchematicText[] = [];
  const refPlacement = symbolSpec.labels.ref;
  if (refPlacement) {
    texts.push({
      type: "schematic_text",
      schematic_text_id: `schematic_text:${symbol.sourceRef}:ref`,
      schematic_component_id,
      text: symbol.sourceRef,
      position: scalePoint(addPoints(symbol.position, refPlacement.offset)),
      anchor: mapTextAnchor(refPlacement.anchor, refPlacement.offset.y),
      rotation: 0,
    });
  }

  const valuePlacement = symbolSpec.labels.value;
  const valueText = symbol.properties?.value;
  if (valuePlacement && valueText) {
    texts.push({
      type: "schematic_text",
      schematic_text_id: `schematic_text:${symbol.sourceRef}:value`,
      schematic_component_id,
      text: valueText,
      position: scalePoint(addPoints(symbol.position, valuePlacement.offset)),
      anchor: mapTextAnchor(valuePlacement.anchor, valuePlacement.offset.y),
      rotation: 0,
    });
  }

  return texts;
}

function mapTextAnchor(
  anchor: "left" | "center" | "right" | undefined,
  offsetY: number,
): TscircuitSchematicText["anchor"] {
  const vertical = offsetY < 0 ? "bottom" : offsetY > 0 ? "top" : "middle";

  if (anchor === "left") {
    return vertical === "bottom"
      ? "bottom_left"
      : vertical === "top"
        ? "top_left"
        : "center_left";
  }

  if (anchor === "right") {
    return vertical === "bottom"
      ? "bottom_right"
      : vertical === "top"
        ? "top_right"
        : "center_right";
  }

  return vertical === "bottom"
    ? "bottom_center"
    : vertical === "top"
      ? "top_center"
      : "center";
}

function inferPinNumber(pin: SchematicPinAnchor, index: number): number | undefined {
  const parsed = Number(pin.name);
  if (Number.isInteger(parsed)) {
    return parsed;
  }
  return index + 1;
}

function inferFacingDirection(pin: SchematicPinAnchor): "left" | "right" | "up" | "down" {
  switch (pin.side) {
    case "left":
    case "right":
      return pin.side;
    case "top":
      return "up";
    case "bottom":
      return "down";
    default:
      return "right";
  }
}

function scalePoint(point: Point): TscircuitPoint {
  return {
    x: round(point.x * SCHEMATIC_SCALE),
    y: round(point.y * SCHEMATIC_SCALE),
  };
}

function shiftLabelCenter(point: TscircuitPoint, orientation: SchematicOrientation): TscircuitPoint {
  switch (orientation) {
    case "left":
      return { x: round(point.x - LABEL_OFFSET), y: point.y };
    case "right":
      return { x: round(point.x + LABEL_OFFSET), y: point.y };
    case "up":
      return { x: point.x, y: round(point.y + LABEL_OFFSET) };
    case "down":
      return { x: point.x, y: round(point.y - LABEL_OFFSET) };
  }
}

function orientationToAnchorSide(
  orientation: SchematicOrientation,
): "left" | "right" | "top" | "bottom" {
  switch (orientation) {
    case "left":
      return "right";
    case "right":
      return "left";
    case "up":
      return "bottom";
    case "down":
      return "top";
  }
}

function findNearestPort(point: Point, context: EmitterContext): PortInfo | undefined {
  let bestMatch: PortInfo | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const port of Object.values(context.portInfoByPointKey)) {
    const currentDistance = distance(scalePoint(point), port.center);
    if (currentDistance < bestDistance) {
      bestMatch = port;
      bestDistance = currentDistance;
    }
  }

  return bestMatch;
}

function markPortsConnected(sourcePortIds: string[], context: EmitterContext): void {
  const portIdSet = new Set(sourcePortIds);
  for (const port of Object.values(context.portInfoByPointKey)) {
    if (portIdSet.has(port.sourcePortId)) {
      // Mutate through shared reference on the emitted object list by looking up when built later.
      // The actual is_connected value is patched in finalizePortConnectivity.
      (port as PortInfo & { isConnected?: boolean }).isConnected = true;
    }
  }
}

function finalizePortConnectivity(
  elements: TscircuitSchematicCircuitJsonElement[],
  context: EmitterContext,
): void {
  const connectedPortIds = new Set(
    Object.values(context.portInfoByPointKey)
      .filter((port) => (port as PortInfo & { isConnected?: boolean }).isConnected)
      .map((port) => port.sourcePortId),
  );

  for (const element of elements) {
    if (element.type === "schematic_port") {
      element.is_connected = connectedPortIds.has(element.source_port_id);
    }
  }
}

function countBy<T>(items: T[], keyFn: (item: T) => string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    const key = keyFn(item);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function addPoints(a: Point, b: Point): Point {
  return {
    x: a.x + b.x,
    y: a.y + b.y,
  };
}

function pointKey(point: Point): string {
  return `${point.x},${point.y}`;
}

function createEmitterContext(
  symbols: SchematicSymbolInstance[],
  labels: SchematicNetLabel[],
  wires: SchematicWire[],
  junctionKeys: Set<string>,
): EmitterContext {
  const context: EmitterContext = {
    componentIdsByRef: Object.fromEntries(
      symbols.map((symbol) => [symbol.sourceRef, makeSourceComponentId(symbol.sourceRef)]),
    ),
    netIdsByName: Object.fromEntries(labels.map((label) => [label.netName, makeSourceNetId(label.netName)])),
    portInfoByPointKey: {},
    wireCountsByNet: countBy(wires, (wire) => wire.netName),
    junctionKeys,
  };

  for (const wire of wires) {
    context.netIdsByName[wire.netName] ??= makeSourceNetId(wire.netName);
  }

  return context;
}

function makeSourceComponentId(sourceRef: string): string {
  return `source_component:${sourceRef}`;
}

function makeSourcePortId(sourceRef: string, pinName: string): string {
  return `source_port:${sourceRef}:${pinName}`;
}

function makeSourceNetId(netName: string): string {
  return `source_net:${netName}`;
}

function makeSourceTraceId(id: string): string {
  return `source_trace:${id}`;
}

function schematicComponentId(sourceRef: string): string {
  return `schematic_component:${sourceRef}`;
}

function makeSchematicPortId(sourceRef: string, pinName: string): string {
  return `schematic_port:${sourceRef}:${pinName}`;
}

function makeSchematicTraceId(id: string): string {
  return `schematic_trace:${id}`;
}

function round(value: number): number {
  return Math.round(value * 1000000) / 1000000;
}

function distance(a: TscircuitPoint, b: TscircuitPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function emitTscircuitSchematicCircuitJson(
  schematic: SchematicDocument,
): TscircuitSchematicCircuitJsonElement[] {
  return emitSchematicCircuitJson(schematic);
}
