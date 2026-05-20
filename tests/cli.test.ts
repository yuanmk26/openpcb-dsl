import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

const workspaceRoot = resolve(import.meta.dirname, "..");
const cliPath = join(workspaceRoot, "dist", "cli", "index.js");

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
      components: [],
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
    const output = runCli(["compile", "examples/dsl/adc-lvds.opcb"]);
    const parsed = JSON.parse(output);

    expect(parsed.diffPairs.ADC_D0).toMatchObject({
      pNet: "ADC_D0_P",
      nNet: "ADC_D0_N",
    });
  });

  it("parses vNext files to AST JSON", () => {
    const output = runCli(["parse", "examples/dsl/vnext-device.opcb"]);
    const parsed = JSON.parse(output);

    expect(parsed).toMatchObject({
      components: [{ name: "MCU" }],
      devices: [{ name: "STM32F103C8T6" }],
      instances: [{ ref: "U1", targetKind: "device" }],
    });
  });

  it("expands imported definition files from the CLI entry file", () => {
    const output = runCli(["compile", "examples/dsl/imports/vnext-device-board.opcb"]);
    const parsed = JSON.parse(output);

    expect(parsed.deviceDefs.STM32F103C8T6).toMatchObject({
      component: "MCU",
      package: "LQFP48",
    });
    expect(parsed.components.U1).toMatchObject({
      device: "STM32F103C8T6",
      component: "MCU",
      package: "LQFP48",
    });
  });

  it("validates a vNext diff_pair file", () => {
    const output = runCli(["validate", "examples/dsl/vnext-diff-pair.opcb"]);
    const parsed = JSON.parse(output);

    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.find((item: { severity?: string }) => item.severity === "error")).toBeUndefined();
  });
});
