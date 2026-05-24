import type { ComponentIR } from "../ir/circuit-ir";
import { getSymbolSpecById } from "./symbol-registry";
import type { SymbolSpec } from "./types";

export function inferSymbolKind(component: ComponentIR): string {
  const typeCandidates = [
    component.type,
    component.component,
    component.device,
    component.params?.symbol,
    component.params?.type,
  ]
    .filter((value): value is string => Boolean(value))
    .map(normalizeSymbolToken);

  if (typeCandidates.some((value) => value === "resistor")) {
    return "passive_resistor";
  }

  if (typeCandidates.some((value) => value === "capacitor")) {
    return "passive_capacitor";
  }

  if (typeCandidates.some(isConnectorHeader1x4)) {
    return "connector_header_1x4";
  }

  if (typeCandidates.some(isConnectorHeader2x4)) {
    return "connector_header_2x4";
  }

  if (component.device || component.component) {
    return "generic_ic";
  }

  return "generic_component";
}

export function resolveSymbolSpec(symbolKind: string, _component: ComponentIR): SymbolSpec {
  const spec = getSymbolSpecById(symbolKind);
  if (spec) {
    return spec;
  }

  const fallback = getSymbolSpecById("generic_component");
  if (!fallback) {
    throw new Error(`Missing generic symbol spec fallback for "${symbolKind}".`);
  }

  return fallback;
}

function normalizeSymbolToken(value: string): string {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function isConnectorHeader1x4(value: string): boolean {
  return [
    "connector_header_1x4",
    "header_1x4",
    "pinheader_1x4",
    "pin_header_1x4",
    "conn_header_1x4",
  ].includes(value);
}

function isConnectorHeader2x4(value: string): boolean {
  return [
    "connector_header_2x4",
    "header_2x4",
    "pinheader_2x4",
    "pin_header_2x4",
    "conn_header_2x4",
  ].includes(value);
}
