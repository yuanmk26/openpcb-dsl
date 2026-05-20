import type { PinKind } from "../ast/nodes";

export type NetKind = "signal" | "power" | "ground" | "analog" | "clock";

export interface CircuitIR {
  componentDefs: Record<string, ComponentDefIR>;
  packageDefs: Record<string, PackageDefIR>;
  deviceDefs: Record<string, DeviceDefIR>;
  components: Record<string, ComponentIR>;
  nets: Record<string, NetIR>;
  patterns: PatternIR[];
  diffPairs: Record<string, DiffPairIR>;
  constraints: ConstraintIR[];
}

export interface ComponentDefIR {
  name: string;
  pins: Record<string, PinDefIR>;
  groups?: Record<string, string[]>;
  attrs?: Record<string, string>;
}

export interface PinDefIR {
  kind?: PinKind;
}

export interface PackageDefIR {
  name: string;
  pads: string[];
}

export interface DeviceDefIR {
  name: string;
  component: string;
  package: string;
  attrs?: Record<string, string>;
  pinmap: Record<string, string>;
}

export interface ComponentIR {
  ref: string;
  type: string;
  value?: string;
  footprint?: string;
  params?: Record<string, string>;
  device?: string;
  component?: string;
  package?: string;
  attrs?: Record<string, string>;
}

export interface NetIR {
  name: string;
  pins: string[];
  kind?: NetKind;
}

export type PatternKind =
  | "pullup"
  | "pulldown"
  | "series"
  | "shunt"
  | "decouple"
  | "tap"
  | "bridge";

export interface PatternIR {
  kind: PatternKind;
  fromNet?: string;
  toNet?: string;
  component?: string;
  metadata?: Record<string, string>;
}

export interface DiffPairConstraints {
  differentialImpedance?: string;
  intraPairLengthMatch?: string;
  interPairSkew?: string;
  routeTogether?: boolean;
  polarity?: "fixed" | "swappable";
}

export interface DiffEndpointBridgeIR {
  component: string;
  legs: ["p", "n"];
}

export interface DiffEndpointIR {
  name: string;
  near?: string;
  bridges: DiffEndpointBridgeIR[];
}

export interface DiffPairIR {
  name: string;
  pNet: string;
  nNet: string;
  pPins: string[];
  nPins: string[];
  endpoints?: DiffEndpointIR[];
  constraints?: DiffPairConstraints;
}

export interface ConstraintIR {
  kind: string;
  target?: string;
  params?: Record<string, string | number | boolean>;
}

export function createEmptyCircuitIr(): CircuitIR {
  return {
    componentDefs: {},
    packageDefs: {},
    deviceDefs: {},
    components: {},
    nets: {},
    patterns: [],
    diffPairs: {},
    constraints: [],
  };
}

export function addPinToNet(ir: CircuitIR, netName: string, pinRef: string): void {
  const existingNet = ir.nets[netName];
  if (!existingNet) {
    ir.nets[netName] = {
      name: netName,
      pins: [pinRef],
    };
    return;
  }

  if (!existingNet.pins.includes(pinRef)) {
    existingNet.pins.push(pinRef);
  }
}

export function addComponent(ir: CircuitIR, component: ComponentIR): void {
  const existing = ir.components[component.ref];
  if (existing && haveComponentDefinitionsConflicted(existing, component)) {
    ir.constraints.push({
      kind: "component_conflict",
      target: component.ref,
      params: {
        existingType: existing.type,
        incomingType: component.type,
      },
    });
    return;
  }

  ir.components[component.ref] = component;
}

function haveComponentDefinitionsConflicted(a: ComponentIR, b: ComponentIR): boolean {
  return JSON.stringify(normalizeComponentSignature(a)) !== JSON.stringify(normalizeComponentSignature(b));
}

function normalizeComponentSignature(component: ComponentIR) {
  return {
    type: component.type,
    value: component.value,
    footprint: component.footprint,
    params: component.params ?? {},
    device: component.device,
    component: component.component,
    package: component.package,
    attrs: component.attrs ?? {},
  };
}
