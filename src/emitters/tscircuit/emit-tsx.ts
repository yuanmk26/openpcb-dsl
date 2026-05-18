import type { CircuitIR, ComponentIR } from "../../ir/circuit-ir";

export function emitTscircuitTsx(ir: CircuitIR): string {
  const lines: string[] = [
    "export default () => (",
    "  <board>",
    "    {/* TODO: map OpenPCB IR to confirmed tscircuit API once the target surface is finalized. */}",
  ];

  for (const component of Object.values(ir.components)) {
    lines.push(`    ${emitComponentLine(component)}`);
  }

  for (const net of Object.values(ir.nets)) {
    lines.push(`    {/* net ${net.name}: ${net.pins.join(", ")} */}`);
  }

  if (ir.patterns.length > 0) {
    lines.push("    {/* patterns */}");
    for (const pattern of ir.patterns) {
      lines.push(
        `    {/* ${pattern.kind} ${pattern.component ?? "unknown"} ${pattern.fromNet ?? "?"} -> ${pattern.toNet ?? "?"} */}`,
      );
    }
  }

  lines.push("  </board>");
  lines.push(");");

  return lines.join("\n");
}

function emitComponentLine(component: ComponentIR): string {
  const name = component.ref;
  const type = component.type.toLowerCase();
  const value = component.value ?? component.params?.value;

  if (type === "resistor") {
    return `<resistor name="${name}" resistance="${value ?? "TODO"}" />`;
  }

  if (type === "capacitor") {
    return `<capacitor name="${name}" capacitance="${value ?? "TODO"}" />`;
  }

  if (type === "testpoint" || type === "test_point") {
    return `<testpoint name="${name}" />`;
  }

  return `{/* TODO: map component ${name} of type ${component.type} */}`;
}
