import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { ComponentDefAst, DeviceDefAst, DiffPairAst, InstanceAst, PackageDefAst, ProgramAst } from "../ast/nodes";
import { compileAstToIr } from "../compiler/ast-to-ir";
import type { CircuitIR } from "../ir/circuit-ir";
import { parseOpenPcbDsl } from "./parse";

interface LoadedProgram {
  path: string;
  ast: ProgramAst;
}

export function parseOpenPcbDslFile(entryFilePath: string): ProgramAst {
  const programs = loadPrograms(resolve(entryFilePath));
  return mergePrograms(programs);
}

export function compileOpenPcbDslFile(entryFilePath: string): CircuitIR {
  return compileAstToIr(parseOpenPcbDslFile(entryFilePath));
}

function loadPrograms(entryFilePath: string): LoadedProgram[] {
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const orderedPrograms: LoadedProgram[] = [];

  function visit(filePath: string, ancestry: string[]): void {
    if (visited.has(filePath)) {
      return;
    }

    if (visiting.has(filePath)) {
      const cycle = [...ancestry, filePath].join(" -> ");
      throw new Error(`Detected circular import: ${cycle}`);
    }

    visiting.add(filePath);

    let source: string;
    try {
      source = readFileSync(filePath, "utf8");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to read imported file "${filePath}": ${message}`);
    }

    let ast: ProgramAst;
    try {
      ast = parseOpenPcbDsl(source);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to parse "${filePath}": ${message}`);
    }
    for (const imported of ast.imports) {
      visit(resolve(dirname(filePath), imported.path), [...ancestry, filePath]);
    }

    visiting.delete(filePath);
    visited.add(filePath);
    orderedPrograms.push({ path: filePath, ast });
  }

  visit(entryFilePath, []);
  enforceImportedFileShape(orderedPrograms, entryFilePath);
  return orderedPrograms;
}

function enforceImportedFileShape(programs: LoadedProgram[], entryFilePath: string): void {
  for (const program of programs) {
    if (program.path === entryFilePath) {
      continue;
    }

    if (program.ast.instances.length > 0 || program.ast.diffPairs.length > 0) {
      throw new Error(
        `Imported file "${program.path}" may only contain import/component/package/device declarations.`,
      );
    }
  }
}

function mergePrograms(programs: LoadedProgram[]): ProgramAst {
  const components: ComponentDefAst[] = [];
  const packages: PackageDefAst[] = [];
  const devices: DeviceDefAst[] = [];
  const instances: InstanceAst[] = [];
  const diffPairs: DiffPairAst[] = [];

  const componentOrigins = new Map<string, string>();
  const packageOrigins = new Map<string, string>();
  const deviceOrigins = new Map<string, string>();

  for (const program of programs) {
    for (const component of program.ast.components) {
      assertUniqueDefinition("component", component.name, program.path, componentOrigins);
      components.push(component);
    }

    for (const packageDef of program.ast.packages) {
      assertUniqueDefinition("package", packageDef.name, program.path, packageOrigins);
      packages.push(packageDef);
    }

    for (const device of program.ast.devices) {
      assertUniqueDefinition("device", device.name, program.path, deviceOrigins);
      devices.push(device);
    }

    instances.push(...program.ast.instances);
    diffPairs.push(...program.ast.diffPairs);
  }

  return {
    kind: "program",
    imports: [],
    components,
    packages,
    devices,
    instances,
    diffPairs,
  };
}

function assertUniqueDefinition(
  kind: "component" | "package" | "device",
  name: string,
  currentPath: string,
  origins: Map<string, string>,
): void {
  const existingPath = origins.get(name);
  if (existingPath) {
    throw new Error(
      `Duplicate ${kind} definition "${name}" in "${currentPath}", first defined in "${existingPath}".`,
    );
  }
  origins.set(name, currentPath);
}
