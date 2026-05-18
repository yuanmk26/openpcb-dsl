import type { CircuitIR } from "../../ir/circuit-ir";

export interface CircuitJsonComponentRecord {
  kind: "source_component";
  ref: string;
  componentType: string;
  value?: string;
  params?: Record<string, string>;
}

export interface CircuitJsonNetRecord {
  kind: "source_net";
  name: string;
  pins: string[];
}

export interface CircuitJsonPatternRecord {
  kind: "source_pattern";
  patternKind: string;
  fromNet?: string;
  toNet?: string;
  component?: string;
}

export type CircuitJsonDraftRecord =
  | CircuitJsonComponentRecord
  | CircuitJsonNetRecord
  | CircuitJsonPatternRecord;

export function emitCircuitJson(ir: CircuitIR): CircuitJsonDraftRecord[] {
  const components: CircuitJsonComponentRecord[] = Object.values(ir.components).map((component) => ({
    kind: "source_component",
    ref: component.ref,
    componentType: component.type,
    value: component.value,
    params: component.params,
  }));

  const nets: CircuitJsonNetRecord[] = Object.values(ir.nets).map((net) => ({
    kind: "source_net",
    name: net.name,
    pins: [...net.pins],
  }));

  const patterns: CircuitJsonPatternRecord[] = ir.patterns.map((pattern) => ({
    kind: "source_pattern",
    patternKind: pattern.kind,
    fromNet: pattern.fromNet,
    toNet: pattern.toNet,
    component: pattern.component,
  }));

  return [...components, ...nets, ...patterns];
}
