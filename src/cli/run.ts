import { mkdirSync, writeFileSync } from "node:fs";
import { basename, dirname, extname } from "node:path";
import type { AnyCircuitElement } from "circuit-json";
import { convertCircuitJsonToSchematicSvg } from "circuit-to-svg";
import { emitTscircuitSchematicCircuitJson } from "../emitters/tscircuit/emit-schematic-circuit-json";
import { validateCircuitIr } from "../ir/validate";
import { compileOpenPcbDslFile, parseOpenPcbDslFile } from "../parser";
import { lowerCircuitIrToSchematic } from "../schematic/lower";

export type CommandName =
  | "parse"
  | "compile"
  | "validate"
  | "emit-schematic-json"
  | "emit-schematic-svg";

export const USAGE = `openpcb-dsl <command> <file> [--pretty] [--out <file>]

Commands:
  parse                解析 .opcb 文件并输出 AST JSON
  compile              编译 .opcb 文件并输出 IR JSON
  validate             校验 .opcb 文件并输出 diagnostics JSON
  emit-schematic-json  导出 tscircuit schematic Circuit JSON
  emit-schematic-svg   导出 schematic SVG

Options:
  --pretty             使用格式化 JSON 输出
  --out <file>         写入指定输出文件
`;

export function main(argv: string[]): number {
  try {
    const { command, filePath, pretty, outFile } = parseArgs(argv);
    const result = runCommand(command, filePath);
    const output = serializeCommandResult(command, result, pretty);

    if (outFile) {
      writeOutputFile(outFile, output);
    } else {
      process.stdout.write(`${output}\n`);
    }

    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    return 1;
  }
}

export function parseArgs(argv: string[]): {
  command: CommandName;
  filePath: string;
  pretty: boolean;
  outFile?: string;
} {
  if (argv.length === 0) {
    throw new Error(USAGE);
  }

  const [commandToken, filePath, ...rest] = argv;
  if (!isCommand(commandToken)) {
    throw new Error(`未知命令 "${commandToken}"\n\n${USAGE}`);
  }

  if (!filePath) {
    throw new Error(`缺少输入文件路径\n\n${USAGE}`);
  }

  let pretty = false;
  let outFile: string | undefined;

  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];

    if (arg === "--pretty") {
      pretty = true;
      continue;
    }

    if (arg === "--out") {
      const value = rest[index + 1];
      if (!value) {
        throw new Error(`缺少 --out 的输出文件路径\n\n${USAGE}`);
      }
      outFile = value;
      index += 1;
      continue;
    }

    throw new Error(`未知参数 "${arg}"\n\n${USAGE}`);
  }

  return {
    command: commandToken,
    filePath,
    pretty,
    outFile,
  };
}

export function runCommand(command: CommandName, filePath: string): unknown {
  switch (command) {
    case "parse":
      return parseOpenPcbDslFile(filePath);
    case "compile":
      return compileOpenPcbDslFile(filePath);
    case "validate":
      return validateCircuitIr(compileOpenPcbDslFile(filePath));
    case "emit-schematic-json": {
      const ir = compileOpenPcbDslFile(filePath);
      const schematic = lowerCircuitIrToSchematic(ir, inferDocumentTitle(filePath));
      return emitTscircuitSchematicCircuitJson(schematic);
    }
    case "emit-schematic-svg": {
      const ir = compileOpenPcbDslFile(filePath);
      const schematic = lowerCircuitIrToSchematic(ir, inferDocumentTitle(filePath));
      const circuitJson = emitTscircuitSchematicCircuitJson(schematic);
      return convertCircuitJsonToSchematicSvg(circuitJson as AnyCircuitElement[], {
        includeVersion: true,
      });
    }
    default: {
      const exhaustiveCheck: never = command;
      throw new Error(`Unsupported command: ${String(exhaustiveCheck)}`);
    }
  }
}

function isCommand(value: string): value is CommandName {
  return (
    value === "parse" ||
    value === "compile" ||
    value === "validate" ||
    value === "emit-schematic-json" ||
    value === "emit-schematic-svg"
  );
}

function serializeCommandResult(command: CommandName, result: unknown, pretty: boolean): string {
  if (command === "emit-schematic-svg") {
    return String(result);
  }

  return JSON.stringify(result, null, pretty ? 2 : 0);
}

function writeOutputFile(outFile: string, contents: string): void {
  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, contents.endsWith("\n") ? contents : `${contents}\n`, "utf8");
}

function inferDocumentTitle(filePath: string): string {
  const extension = extname(filePath);
  return basename(filePath, extension) || filePath;
}
