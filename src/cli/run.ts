import { validateCircuitIr } from "../ir/validate";
import { compileOpenPcbDslFile, parseOpenPcbDslFile } from "../parser";

export type CommandName = "parse" | "compile" | "validate";

export const USAGE = `openpcb-dsl <command> <file> [--pretty]

Commands:
  parse      解析 .opcb 文件并输出 AST JSON
  compile    编译 .opcb 文件并输出 IR JSON
  validate   校验 .opcb 文件并输出 diagnostics JSON

Options:
  --pretty   使用格式化 JSON 输出
`;

export function main(argv: string[]): number {
  try {
    const { command, filePath, pretty } = parseArgs(argv);
    const result = runCommand(command, filePath);
    process.stdout.write(`${JSON.stringify(result, null, pretty ? 2 : 0)}\n`);
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    return 1;
  }
}

export function parseArgs(argv: string[]): { command: CommandName; filePath: string; pretty: boolean } {
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
  for (const arg of rest) {
    if (arg === "--pretty") {
      pretty = true;
      continue;
    }
    throw new Error(`未知参数 "${arg}"\n\n${USAGE}`);
  }

  return {
    command: commandToken,
    filePath,
    pretty,
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
    default: {
      const exhaustiveCheck: never = command;
      throw new Error(`Unsupported command: ${String(exhaustiveCheck)}`);
    }
  }
}

function isCommand(value: string): value is CommandName {
  return value === "parse" || value === "compile" || value === "validate";
}
