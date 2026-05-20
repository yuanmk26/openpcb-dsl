import { compileAstToIr } from "../compiler/ast-to-ir";
import type {
  ComponentDefAst,
  ComponentExprAst,
  DeviceDefAst,
  DiffEndpointAst,
  DiffPairAst,
  GroupDeclAst,
  ImportAst,
  InstanceAst,
  PackageDefAst,
  PinDeclAst,
  PinOperationAst,
  ProgramAst,
  PullDownOperationAst,
  PullUpOperationAst,
  SeriesOperationAst,
  ShuntOperationAst,
  DecoupleOperationAst,
  TapOperationAst,
  BridgeOperationAst,
} from "../ast/nodes";
import type { CircuitIR } from "../ir/circuit-ir";

type TokenKind =
  | "word"
  | "string"
  | "."
  | "("
  | ")"
  | ","
  | ";"
  | "="
  | "{"
  | "}"
  | ":"
  | "@"
  | "arrow"
  | "range"
  | "eof";

interface Token {
  kind: TokenKind;
  text: string;
  line: number;
  column: number;
}

const SINGLE_CHAR_PUNCTUATION = new Set<TokenKind>([".", "(", ")", ",", ";", "=", "{", "}", ":", "@"]);
const OPERATION_KIND_BY_NAME = {
  PullUp: "pullup",
  PullDown: "pulldown",
  Series: "series",
  Shunt: "shunt",
  Decouple: "decouple",
  Tap: "tap",
  Bridge: "bridge",
} as const;
const PIN_KINDS = new Set(["in", "out", "inout", "passive", "power_in", "power_out"]);
const CONSTRAINT_NAME_MAP = {
  differential_impedance: "differentialImpedance",
  intra_pair_length_match: "intraPairLengthMatch",
  inter_pair_skew: "interPairSkew",
  route_together: "routeTogether",
  polarity: "polarity",
} as const;

type SupportedOperationName = keyof typeof OPERATION_KIND_BY_NAME;

class OpenPcbParserError extends Error {
  constructor(message: string, token: Token) {
    super(`${message} at line ${token.line}, column ${token.column}`);
    this.name = "OpenPcbParserError";
  }
}

class Lexer {
  private index = 0;
  private line = 1;
  private column = 1;

  constructor(private readonly source: string) {}

  tokenize(): Token[] {
    const tokens: Token[] = [];

    while (!this.isAtEnd()) {
      this.skipIgnored();
      if (this.isAtEnd()) {
        break;
      }

      tokens.push(this.readToken());
    }

    tokens.push({
      kind: "eof",
      text: "",
      line: this.line,
      column: this.column,
    });

    return tokens;
  }

  private readToken(): Token {
    const line = this.line;
    const column = this.column;

    if (this.peek() === "-" && this.peek(1) === ">") {
      this.advance();
      this.advance();
      return { kind: "arrow", text: "->", line, column };
    }

    if (this.peek() === "." && this.peek(1) === ".") {
      this.advance();
      this.advance();
      return { kind: "range", text: "..", line, column };
    }

    const char = this.peek();
    if (char === "\"") {
      return {
        kind: "string",
        text: this.readString(),
        line,
        column,
      };
    }

    if (this.isPunctuation(char)) {
      this.advance();
      return {
        kind: char as TokenKind,
        text: char,
        line,
        column,
      };
    }

    const text = this.readWord();
    return {
      kind: "word",
      text,
      line,
      column,
    };
  }

  private readString(): string {
    let value = "";
    this.advance();

    while (!this.isAtEnd()) {
      const char = this.peek();
      if (char === "\"") {
        this.advance();
        return value;
      }

      if (char === "\\") {
        this.advance();
        const escaped = this.peek();
        if (!escaped) {
          break;
        }
        if (escaped === "\"" || escaped === "\\") {
          value += escaped;
        } else {
          value += escaped;
        }
        this.advance();
        continue;
      }

      value += char;
      this.advance();
    }

    throw new OpenPcbParserError("Unterminated string literal", {
      kind: "string",
      text: value,
      line: this.line,
      column: this.column,
    });
  }

  private readWord(): string {
    const start = this.index;

    while (!this.isAtEnd()) {
      const char = this.peek();
      if (
        this.isWhitespace(char) ||
        this.isPunctuation(char) ||
        (char === "-" && this.peek(1) === ">") ||
        (char === "." && this.peek(1) === ".") ||
        this.startsComment()
      ) {
        break;
      }
      this.advance();
    }

    return this.source.slice(start, this.index);
  }

  private skipIgnored(): void {
    while (!this.isAtEnd()) {
      if (this.isWhitespace(this.peek())) {
        this.advance();
        continue;
      }

      if (this.startsComment()) {
        this.skipComment();
        continue;
      }

      return;
    }
  }

  private skipComment(): void {
    while (!this.isAtEnd() && this.peek() !== "\n") {
      this.advance();
    }
  }

  private startsComment(): boolean {
    return this.peek() === "#" || (this.peek() === "/" && this.peek(1) === "/");
  }

  private isPunctuation(char: string): boolean {
    return SINGLE_CHAR_PUNCTUATION.has(char as TokenKind);
  }

  private isWhitespace(char: string): boolean {
    return /\s/.test(char);
  }

  private peek(offset = 0): string {
    return this.source[this.index + offset] ?? "";
  }

  private advance(): void {
    const char = this.source[this.index] ?? "";
    this.index += 1;
    if (char === "\n") {
      this.line += 1;
      this.column = 1;
      return;
    }
    this.column += 1;
  }

  private isAtEnd(): boolean {
    return this.index >= this.source.length;
  }
}

class Parser {
  private index = 0;

  constructor(private readonly tokens: Token[]) {}

  parseProgram(): ProgramAst {
    const imports: ImportAst[] = [];
    const components: ComponentDefAst[] = [];
    const packages: PackageDefAst[] = [];
    const devices: DeviceDefAst[] = [];
    const instances: InstanceAst[] = [];
    const diffPairs: DiffPairAst[] = [];

    while (!this.isAtEnd()) {
      if (this.checkWord("import")) {
        imports.push(this.parseImport());
      } else if (this.checkWord("component")) {
        components.push(this.parseComponentDef());
      } else if (this.checkWord("package")) {
        packages.push(this.parsePackageDef());
      } else if (this.checkWord("device")) {
        devices.push(this.parseDeviceDef());
      } else if (this.checkWord("inst")) {
        instances.push(this.parseStructuredInstance());
      } else if (this.checkWord("diff_pair")) {
        diffPairs.push(this.parseDiffPair());
      } else {
        instances.push(this.parseLegacyInstance());
      }
      this.consumeSeparators();
    }

    return {
      kind: "program",
      imports,
      components,
      packages,
      devices,
      instances,
      diffPairs,
    };
  }

  private parseImport(): ImportAst {
    this.expectWordValue("import");
    const path = this.expectString("import path");
    return {
      kind: "import",
      path,
    };
  }

  private parseComponentDef(): ComponentDefAst {
    this.expectWordValue("component");
    const name = this.expectWord("component name");
    this.expect("{");

    const pins: PinDeclAst[] = [];
    const groups: GroupDeclAst[] = [];
    let attrs: Record<string, string> | undefined;

    while (!this.check("}")) {
      if (this.checkWord("pins")) {
        pins.push(...this.parsePinsSection());
      } else if (this.checkWord("groups")) {
        groups.push(...this.parseGroupsSection());
      } else if (this.checkWord("attrs")) {
        attrs = this.parseAttrSection();
      } else {
        throw this.error(this.current(), `Unsupported component section "${this.current().text}"`);
      }
      this.consumeSeparators();
    }

    this.expect("}");
    return {
      kind: "component_def",
      name,
      pins,
      groups: groups.length > 0 ? groups : undefined,
      attrs,
    };
  }

  private parsePinsSection(): PinDeclAst[] {
    this.expectWordValue("pins");
    this.expect("{");
    const pins: PinDeclAst[] = [];

    while (!this.check("}")) {
      const name = this.expectWord("pin name");
      let kind: PinDeclAst["kind"];
      if (this.match(":")) {
        const pinKind = this.expectWord("pin kind");
        if (!PIN_KINDS.has(pinKind)) {
          throw this.error(this.previous(), `Unsupported pin kind "${pinKind}"`);
        }
        kind = pinKind as PinDeclAst["kind"];
      }
      pins.push({ name, kind });
      this.consumeSeparators();
    }

    this.expect("}");
    return pins;
  }

  private parseGroupsSection(): GroupDeclAst[] {
    this.expectWordValue("groups");
    this.expect("{");
    const groups: GroupDeclAst[] = [];

    while (!this.check("}")) {
      const name = this.expectWord("group name");
      this.expect("{");
      const pins = this.parseIdentifierList();
      this.expect("}");
      groups.push({ name, pins });
      this.consumeSeparators();
    }

    this.expect("}");
    return groups;
  }

  private parsePackageDef(): PackageDefAst {
    this.expectWordValue("package");
    const name = this.expectWord("package name");
    this.expect("{");

    let pads: string[] = [];

    while (!this.check("}")) {
      if (!this.checkWord("pads")) {
        throw this.error(this.current(), `Unsupported package section "${this.current().text}"`);
      }
      pads = this.parsePadsSection();
      this.consumeSeparators();
    }

    this.expect("}");
    return {
      kind: "package_def",
      name,
      pads,
    };
  }

  private parsePadsSection(): string[] {
    this.expectWordValue("pads");
    this.expect("{");
    const pads: string[] = [];

    while (!this.check("}")) {
      const start = this.expectWord("pad spec");
      if (this.match("range")) {
        const end = this.expectWord("pad range end");
        const startValue = Number(start);
        const endValue = Number(end);
        if (!Number.isInteger(startValue) || !Number.isInteger(endValue) || endValue < startValue) {
          throw this.error(this.previous(), `Invalid pad range "${start}..${end}"`);
        }
        for (let value = startValue; value <= endValue; value += 1) {
          pads.push(String(value));
        }
      } else {
        pads.push(start);
      }
      this.consumeSeparators();
    }

    this.expect("}");
    return pads;
  }

  private parseDeviceDef(): DeviceDefAst {
    this.expectWordValue("device");
    const name = this.expectWord("device name");
    this.expect(":");
    const component = this.expectWord("component name");
    this.expect("@");
    const packageName = this.expectWord("package name");
    this.expect("{");

    let attrs: Record<string, string> | undefined;
    const pinmap: DeviceDefAst["pinmap"] = [];

    while (!this.check("}")) {
      if (this.checkWord("attrs")) {
        attrs = this.parseAttrSection();
      } else if (this.checkWord("pinmap")) {
        pinmap.push(...this.parsePinmapSection());
      } else {
        throw this.error(this.current(), `Unsupported device section "${this.current().text}"`);
      }
      this.consumeSeparators();
    }

    this.expect("}");
    return {
      kind: "device_def",
      name,
      component,
      package: packageName,
      attrs,
      pinmap,
    };
  }

  private parsePinmapSection(): DeviceDefAst["pinmap"] {
    this.expectWordValue("pinmap");
    this.expect("{");
    const pinmap: DeviceDefAst["pinmap"] = [];

    while (!this.check("}")) {
      const pin = this.expectWord("device pin");
      this.expect("arrow");
      const pad = this.expectWord("package pad");
      pinmap.push({ pin, pad });
      this.consumeSeparators();
    }

    this.expect("}");
    return pinmap;
  }

  private parseStructuredInstance(): InstanceAst {
    this.expectWordValue("inst");
    const ref = this.expectWord("instance ref");
    const target = this.expectWord("device name");
    this.expect("{");

    const pins = [];
    let attrs: Record<string, string> | undefined;

    while (!this.check("}")) {
      if (this.peekAttrAssignment()) {
        attrs ??= {};
        const key = this.expectWord("attribute name");
        this.expect("=");
        attrs[key] = this.expectWord("attribute value");
        this.consumeSeparators();
        continue;
      }

      pins.push(this.parsePinExpression());
      this.consumeSeparators();
    }

    this.expect("}");
    return {
      kind: "instance",
      ref,
      target,
      targetKind: "device",
      componentType: target,
      attrs,
      pins,
    };
  }

  private parseLegacyInstance(): InstanceAst {
    const ref = this.expectWord("instance ref");
    const componentType = this.expectWord("component type");
    this.expect("(");

    const pins = [];
    this.consumeSeparators();

    while (!this.check(")")) {
      if (this.isAtEnd()) {
        throw this.error(this.current(), 'Expected ")" but found "eof"');
      }
      pins.push(this.parsePinExpression());
      this.consumeSeparators();
    }

    this.expect(")");
    return {
      kind: "instance",
      ref,
      target: componentType,
      targetKind: "legacy_component",
      componentType,
      pins,
    };
  }

  private parseDiffPair(): DiffPairAst {
    this.expectWordValue("diff_pair");
    const name = this.expectWord("diff pair name");
    this.expect("{");

    let pNet = "";
    let nNet = "";
    let pPins: string[] = [];
    let nPins: string[] = [];
    const endpoints: DiffEndpointAst[] = [];
    let constraints: Record<string, string | boolean> | undefined;

    while (!this.check("}")) {
      if (this.checkWord("p") || this.checkWord("n")) {
        const leg = this.parseDiffLeg();
        if (leg.name === "p") {
          pNet = leg.net;
          pPins = leg.pins;
        } else {
          nNet = leg.net;
          nPins = leg.pins;
        }
      } else if (this.checkWord("endpoint")) {
        endpoints.push(this.parseDiffEndpoint());
      } else if (this.checkWord("constraint")) {
        constraints = this.parseConstraintBlock();
      } else {
        throw this.error(this.current(), `Unsupported diff_pair section "${this.current().text}"`);
      }
      this.consumeSeparators();
    }

    this.expect("}");
    return {
      kind: "diff_pair",
      name,
      pNet,
      nNet,
      pPins,
      nPins,
      endpoints: endpoints.length > 0 ? endpoints : undefined,
      constraints,
    };
  }

  private parseDiffLeg(): { name: "p" | "n"; net: string; pins: string[] } {
    const name = this.expectWord("diff leg");
    if (name !== "p" && name !== "n") {
      throw this.error(this.previous(), `Unsupported diff leg "${name}"`);
    }
    this.expect(":");
    const fromRef = this.parsePinRef();
    this.expect("arrow");
    this.expectWordValue("node");
    const net = this.expectWord("node name");
    this.expect("arrow");
    const toRef = this.parsePinRef();

    return {
      name,
      net,
      pins: [fromRef, toRef],
    };
  }

  private parseDiffEndpoint(): DiffEndpointAst {
    this.expectWordValue("endpoint");
    const name = this.expectWord("endpoint name");
    let near: string | undefined;
    if (this.checkWord("near")) {
      this.expectWordValue("near");
      near = this.expectWord("instance ref");
    }
    this.expect("{");

    const bridges: DiffEndpointAst["bridges"] = [];

    while (!this.check("}")) {
      this.expectWordValue("bridge");
      const component = this.parseInlineInstance();
      this.expectWordValue("between");
      const left = this.expectWord("diff leg");
      this.expect(",");
      const right = this.expectWord("diff leg");
      if (left !== "p" || right !== "n") {
        throw this.error(this.previous(), `Unsupported bridge leg pair "${left}, ${right}"`);
      }
      bridges.push({
        kind: "bridge",
        component,
        legs: ["p", "n"],
      });
      this.consumeSeparators();
    }

    this.expect("}");
    return {
      name,
      near,
      bridges,
    };
  }

  private parseConstraintBlock(): Record<string, string | boolean> {
    this.expectWordValue("constraint");
    this.expect("{");
    const constraints: Record<string, string | boolean> = {};

    while (!this.check("}")) {
      const rawKey = this.expectWord("constraint name");
      const key = CONSTRAINT_NAME_MAP[rawKey as keyof typeof CONSTRAINT_NAME_MAP] ?? rawKey;
      const valueText = this.readConstraintValue();
      constraints[key] = valueText === "true" ? true : valueText === "false" ? false : valueText;
      this.consumeSeparators();
    }

    this.expect("}");
    return constraints;
  }

  private parsePinExpression(): InstanceAst["pins"][number] {
    const pin = this.expectWord("pin name");
    this.expect(".");

    const binding = this.expectWord("pin binding");
    if (binding !== "Node") {
      throw this.error(this.previous(), `Pin "${pin}" must start with Node(...)`);
    }

    this.expect("(");
    const node = this.expectWord("node name");
    this.expect(")");

    const operations: PinOperationAst[] = [];
    while (this.match(".")) {
      operations.push(this.parseOperation());
      this.consumeSeparators();
    }

    return {
      kind: "pin_expr",
      pin,
      node,
      operations,
    };
  }

  private parseOperation(): PinOperationAst {
    const operationToken = this.expectToken("word", "operation name");
    const operationName = operationToken.text as SupportedOperationName;
    if (!(operationName in OPERATION_KIND_BY_NAME)) {
      throw this.error(operationToken, `Unsupported operation "${operationToken.text}"`);
    }

    this.expect("(");
    const component = this.parseInlineInstance();

    if (operationName === "Tap") {
      if (this.match(",")) {
        this.consumeSeparators();
      }
      this.expect(")");
      return {
        kind: "tap",
        component,
      } satisfies TapOperationAst;
    }

    this.expect(",");
    const argNameToken = this.expectToken("word", "named argument");
    if (argNameToken.text !== "to") {
      throw this.error(argNameToken, `Unsupported named argument "${argNameToken.text}"`);
    }

    this.expect("=");
    const to = this.expectWord("target net");

    if (this.match(",")) {
      this.consumeSeparators();
    }

    this.expect(")");
    return this.createTwoTerminalOperation(operationName, component, to);
  }

  private createTwoTerminalOperation(
    operationName: Exclude<SupportedOperationName, "Tap">,
    component: ComponentExprAst,
    to: string,
  ):
    | PullUpOperationAst
    | PullDownOperationAst
    | SeriesOperationAst
    | ShuntOperationAst
    | DecoupleOperationAst
    | BridgeOperationAst {
    const kind = OPERATION_KIND_BY_NAME[operationName];
    return {
      kind,
      component,
      to,
    };
  }

  private parseInlineInstance(): ComponentExprAst {
    const ref = this.expectWord("component ref");
    const type = this.expectWord("component type");
    this.expect("(");

    const params: Record<string, string> = {};
    this.consumeSeparators();

    while (!this.check(")")) {
      if (this.isAtEnd()) {
        throw this.error(this.current(), 'Expected ")" but found "eof"');
      }
      const key = this.expectWord("parameter name");
      this.expect("=");
      const value = this.expectWord("parameter value");
      params[key] = value;

      if (!this.match(",")) {
        break;
      }
      this.consumeSeparators();
    }

    this.expect(")");

    const hasParams = Object.keys(params).length > 0;
    return {
      ref,
      type,
      params: hasParams ? params : undefined,
      ...(params.value ? { value: params.value } : {}),
      ...(params.package ?? params.footprint ? { footprint: params.package ?? params.footprint } : {}),
    };
  }

  private parseAttrSection(): Record<string, string> {
    this.expectWordValue("attrs");
    this.expect("{");
    const attrs: Record<string, string> = {};

    while (!this.check("}")) {
      const key = this.expectWord("attribute name");
      this.expect("=");
      attrs[key] = this.expectWord("attribute value");
      this.consumeSeparators();
    }

    this.expect("}");
    return attrs;
  }

  private parseIdentifierList(): string[] {
    const identifiers = [this.expectWord("identifier")];
    while (this.match(",")) {
      identifiers.push(this.expectWord("identifier"));
    }
    return identifiers;
  }

  private parsePinRef(): string {
    const ref = this.expectWord("instance ref");
    this.expect(".");
    const pin = this.expectWord("pin name");
    return `${ref}.${pin}`;
  }

  private readConstraintValue(): string {
    let value = "";

    while (!this.check(",") && !this.check(";") && !this.check("}") && !this.isAtEnd()) {
      const token = this.current();
      if (value && token.kind === "word" && this.isConstraintName(token.text)) {
        break;
      }
      if (token.kind === ".") {
        value += ".";
      } else if (value.length === 0 || value.endsWith(".")) {
        value += token.text;
      } else {
        value += ` ${token.text}`;
      }
      this.index += 1;
    }

    if (!value) {
      throw this.error(this.current(), "Expected constraint value");
    }

    return value.trim();
  }

  private isConstraintName(value: string): boolean {
    return value in CONSTRAINT_NAME_MAP;
  }

  private peekAttrAssignment(): boolean {
    const current = this.current();
    const next = this.tokens[this.index + 1];
    return current.kind === "word" && next?.kind === "=";
  }

  private consumeSeparators(): void {
    while (this.match(",") || this.match(";")) {
      continue;
    }
  }

  private expect(kind: Exclude<TokenKind, "word" | "eof">): void {
    const token = this.current();
    if (token.kind !== kind) {
      throw this.error(token, `Expected "${kind}" but found "${token.text || token.kind}"`);
    }
    this.index += 1;
  }

  private expectWord(label: string): string {
    return this.expectToken("word", label).text;
  }

  private expectWordValue(value: string): void {
    const token = this.expectToken("word", `"${value}"`);
    if (token.text !== value) {
      throw this.error(token, `Expected "${value}" but found "${token.text}"`);
    }
  }

  private expectToken(kind: TokenKind, label: string): Token {
    const token = this.current();
    if (token.kind !== kind) {
      throw this.error(token, `Expected ${label} but found "${token.text || token.kind}"`);
    }
    this.index += 1;
    return token;
  }

  private expectString(label: string): string {
    return this.expectToken("string", label).text;
  }

  private match(kind: Exclude<TokenKind, "word" | "eof">): boolean {
    if (!this.check(kind)) {
      return false;
    }
    this.index += 1;
    return true;
  }

  private check(kind: TokenKind): boolean {
    return this.current().kind === kind;
  }

  private checkWord(text: string): boolean {
    const token = this.current();
    return token.kind === "word" && token.text === text;
  }

  private current(): Token {
    return this.tokens[this.index];
  }

  private previous(): Token {
    return this.tokens[this.index - 1] ?? this.tokens[0];
  }

  private isAtEnd(): boolean {
    return this.current().kind === "eof";
  }

  private error(token: Token, message: string): OpenPcbParserError {
    return new OpenPcbParserError(message, token);
  }
}

export function parseOpenPcbDsl(source: string): ProgramAst {
  const tokens = new Lexer(source).tokenize();
  return new Parser(tokens).parseProgram();
}

export function compileOpenPcbDsl(source: string): CircuitIR {
  return compileAstToIr(parseOpenPcbDsl(source));
}
