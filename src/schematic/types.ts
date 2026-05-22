export interface Point {
  x: number;
  y: number;
}

export interface SchematicFrame {
  width: number;
  height: number;
  title?: string;
}

export interface SchematicTextLabel {
  text: string;
  position?: Point;
}

export type SchematicPinDirection =
  | "input"
  | "output"
  | "bidirectional"
  | "passive"
  | "power";

export type SchematicPinSide = "left" | "right" | "top" | "bottom";

export interface SchematicPinAnchor {
  id: string;
  name: string;
  direction?: SchematicPinDirection;
  side?: SchematicPinSide;
  offset?: Point;
  electricalType?: string;
}

export type SchematicPlacementSource = "manual" | "auto" | "template";

export interface SchematicSymbolInstance {
  kind: "symbol";
  id: string;
  sourceRef: string;
  symbolKind: string;
  symbolSpecId?: string;
  position?: Point;
  rotation?: number;
  pins: SchematicPinAnchor[];
  labels?: SchematicTextLabel[];
  properties?: Record<string, string>;
  placementSource?: SchematicPlacementSource;
}

export type SymbolTextAnchor = "left" | "center" | "right";

export interface SymbolTextPlacement {
  offset: Point;
  anchor?: SymbolTextAnchor;
}

export interface SymbolLabelSpec {
  ref?: SymbolTextPlacement;
  value?: SymbolTextPlacement;
}

export interface SymbolBodySpec {
  width: number;
  height: number;
  shape?: "rect" | "passive_resistor" | "passive_capacitor" | "custom";
}

export interface SymbolPinSpec {
  name: string;
  number?: number;
  side: SchematicPinSide;
  offset: Point;
  direction?: SchematicPinDirection;
  electricalType?: string;
}

export interface TscircuitSymbolMapping {
  symbolName?: string;
  ftype?: string;
  size?: {
    width: number;
    height: number;
  };
}

export interface SymbolSpec {
  id: string;
  kind: string;
  displayName?: string;
  body: SymbolBodySpec;
  pins: SymbolPinSpec[];
  labels?: SymbolLabelSpec;
  backendMappings?: {
    tscircuit?: TscircuitSymbolMapping;
  };
}

export type SchematicRoutingStyle = "direct" | "orthogonal";

export interface SchematicWire {
  kind: "wire";
  id: string;
  netName: string;
  points: Point[];
  routingStyle?: SchematicRoutingStyle;
}

export type SchematicOrientation = "left" | "right" | "up" | "down";

export interface SchematicNetLabel {
  kind: "net_label";
  id: string;
  netName: string;
  position: Point;
  orientation?: SchematicOrientation;
}

export interface SchematicJunction {
  kind: "junction";
  id: string;
  position: Point;
}

export interface SchematicPort {
  kind: "port";
  id: string;
  name: string;
  portType?: string;
  position: Point;
  orientation?: SchematicOrientation;
}

export interface SchematicGroup {
  kind: "group";
  id: string;
  name: string;
  itemIds: string[];
}

export type SchematicItem =
  | SchematicSymbolInstance
  | SchematicWire
  | SchematicNetLabel
  | SchematicJunction
  | SchematicPort
  | SchematicGroup;

export interface SchematicSheet {
  id: string;
  name: string;
  items: SchematicItem[];
  frame?: SchematicFrame;
}

export interface SchematicDocument {
  id: string;
  title?: string;
  sheets: SchematicSheet[];
  metadata?: Record<string, string>;
}

export function createSchematicSheet(id: string, name = "Sheet 1"): SchematicSheet {
  return {
    id,
    name,
    items: [],
  };
}

export function createSchematicDocument(id: string, title?: string): SchematicDocument {
  return {
    id,
    title,
    sheets: [],
  };
}
