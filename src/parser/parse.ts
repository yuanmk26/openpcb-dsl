import { compileAstToIr } from "../compiler/ast-to-ir";
import type {
  ComponentExprAst,
  PinOperationAst,
  ProgramAst,
  PullDownOperationAst,
  PullUpOperationAst,
  SeriesOperationAst,
  ShuntOperationAst,
  DecoupleOperationAst,
  TapOperationAst,
} from "../ast/nodes";
import type { CircuitIR } from "../ir/circuit-ir";

type TokenKind = "word" | "." | "(" | ")" | "," | ";" | "=" | "eof";

interface Token {
  kind: TokenKind;
  text: string;
  line: number;
  column: number;
}

const PUNCTUATION = new Set<TokenKind>([".", "(", ")", ",", ";", "="]);
const OPERATION_KIND_BY_NAME = {
  PullUp: "pullup",
  PullDown: "pulldown",
  Series: "series",
  Shunt: "shunt",
  Decouple: "decouple",
  Tap: "tap",
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

      const token = this.readToken();
      tokens.push(token);
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
    const char = this.peek();

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

  private readWord(): string {
    const start = this.index;

    while (!this.isAtEnd()) {
      const char = this.peek();
      if (this.isWhitespace(char) || this.isPunctuation(char) || this.startsComment()) {
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
    return PUNCTUATION.has(char as TokenKind);
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
    const instances = [];

    while (!this.isAtEnd()) {
      if (this.checkWord("diff_pair")) {
        throw this.error(this.current(), 'diff_pair parsing is not supported in the first parser version.');
      }

      instances.push(this.parseInstance());
      this.consumeOptionalSemicolons();
    }

    return {
      kind: "program",
      instances,
      diffPairs: [],
    };
  }

  private parseInstance(): ProgramAst["instances"][number] {
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
      componentType,
      pins,
    };
  }

  private parsePinExpression(): ProgramAst["instances"][number]["pins"][number] {
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
    if (operationToken.text === "Bridge" || operationToken.text === "bridge") {
      throw this.error(operationToken, "bridge operations are not supported in the first parser version");
    }

    const operationName = operationToken.text as SupportedOperationName;
    if (!(operationName in OPERATION_KIND_BY_NAME)) {
      throw this.error(operationToken, `Unsupported operation "${operationToken.text}"`);
    }

    this.expect("(");
    const component = this.parseComponent();

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
  ): PullUpOperationAst | PullDownOperationAst | SeriesOperationAst | ShuntOperationAst | DecoupleOperationAst {
    const kind = OPERATION_KIND_BY_NAME[operationName];
    return {
      kind,
      component,
      to,
    };
  }

  private parseComponent(): ComponentExprAst {
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
    };
  }

  private consumeSeparators(): void {
    while (this.match(",") || this.match(";")) {
      continue;
    }
  }

  private consumeOptionalSemicolons(): void {
    while (this.match(";")) {
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

  private expectToken(kind: TokenKind, label: string): Token {
    const token = this.current();
    if (token.kind !== kind) {
      throw this.error(token, `Expected ${label} but found "${token.text || token.kind}"`);
    }
    this.index += 1;
    return token;
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
