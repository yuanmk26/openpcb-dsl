import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

const workspaceRoot = resolve(import.meta.dirname, "..");
const cliPath = join(workspaceRoot, "dist", "cli.js");

function runCli(args: string[]): string {
  return execFileSync(process.execPath, [cliPath, ...args], {
    cwd: workspaceRoot,
    encoding: "utf8",
  });
}

function runCliExpectError(args: string[]): string {
  try {
    execFileSync(process.execPath, [cliPath, ...args], {
      cwd: workspaceRoot,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    throw new Error("Expected CLI to fail");
  } catch (error) {
    if (!(error instanceof Error) || !("stderr" in error)) {
      throw error;
    }
    return String((error as Error & { stderr?: string }).stderr ?? "");
  }
}

describe("openpcb-dsl cli", () => {
  beforeAll(() => {
    expect(existsSync(cliPath)).toBe(true);
  });

  it("parses a DSL file to AST JSON", () => {
    const output = runCli(["parse", "examples/dsl/mcu-reset.opcb"]);
    const parsed = JSON.parse(output);

    expect(parsed).toMatchObject({
      kind: "program",
      instances: [
        {
          ref: "U1",
          componentType: "MCU",
        },
      ],
    });
  });

  it("compiles a DSL file to IR JSON", () => {
    const output = runCli(["compile", "examples/dsl/simple-pin-ops.opcb"]);
    const parsed = JSON.parse(output);

    expect(parsed.components.Inst_U1).toMatchObject({
      ref: "Inst_U1",
      type: "U1",
    });
    expect(parsed.nets.node1.pins).toEqual(
      expect.arrayContaining(["Inst_U1.P1", "Inst_U1.P2", "R1.1"]),
    );
  });

  it("validates a DSL file and returns diagnostics JSON", () => {
    const output = runCli(["validate", "examples/dsl/mcu-reset.opcb"]);
    const parsed = JSON.parse(output);

    expect(Array.isArray(parsed)).toBe(true);
  });

  it("supports pretty JSON output", () => {
    const output = runCli(["parse", "examples/dsl/mcu-reset.opcb", "--pretty"]);

    expect(output).toContain('\n  "kind": "program"');
  });

  it("fails when no command is provided", () => {
    const errorOutput = runCliExpectError([]);

    expect(errorOutput).toContain("openpcb-dsl <command> <file> [--pretty]");
  });

  it("fails when the file path is missing", () => {
    const errorOutput = runCliExpectError(["parse"]);

    expect(errorOutput).toContain("缺少输入文件路径");
  });

  it("fails on unknown commands", () => {
    const errorOutput = runCliExpectError(["unknown", "examples/dsl/mcu-reset.opcb"]);

    expect(errorOutput).toContain('未知命令 "unknown"');
  });

  it("fails when the input file does not exist", () => {
    const errorOutput = runCliExpectError(["parse", "examples/dsl/missing.opcb"]);

    expect(errorOutput).toContain("ENOENT");
  });

  it("surfaces parser errors from unsupported diff_pair input", () => {
    const errorOutput = runCliExpectError(["compile", "examples/dsl/adc-lvds.opcb"]);

    expect(errorOutput).toContain("diff_pair parsing is not supported");
  });
});
