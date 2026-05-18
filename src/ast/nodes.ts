export interface ProgramAst {
  kind: "program";
  instances: InstanceAst[];
  diffPairs: DiffPairAst[];
}

export interface InstanceAst {
  kind: "instance";
  ref: string;
  componentType: string;
  params?: Record<string, string>;
  pins: PinExprAst[];
}

export interface PinExprAst {
  kind: "pin_expr";
  pin: string;
  node: string;
  operations: PinOperationAst[];
}

export interface ComponentExprAst {
  ref: string;
  type: string;
  value?: string;
  footprint?: string;
  params?: Record<string, string>;
}

interface BasePinOperationAst {
  component?: ComponentExprAst;
  metadata?: Record<string, string>;
}

export interface PullUpOperationAst extends BasePinOperationAst {
  kind: "pullup";
  component: ComponentExprAst;
  to: string;
}

export interface PullDownOperationAst extends BasePinOperationAst {
  kind: "pulldown";
  component: ComponentExprAst;
  to: string;
}

export interface SeriesOperationAst extends BasePinOperationAst {
  kind: "series";
  component: ComponentExprAst;
  to: string;
}

export interface ShuntOperationAst extends BasePinOperationAst {
  kind: "shunt";
  component: ComponentExprAst;
  to: string;
}

export interface DecoupleOperationAst extends BasePinOperationAst {
  kind: "decouple";
  component: ComponentExprAst;
  to: string;
}

export interface TapOperationAst extends BasePinOperationAst {
  kind: "tap";
  component: ComponentExprAst;
}

export interface BridgeOperationAst extends BasePinOperationAst {
  kind: "bridge";
  component: ComponentExprAst;
  to: string;
}

export type PinOperationAst =
  | PullUpOperationAst
  | PullDownOperationAst
  | SeriesOperationAst
  | ShuntOperationAst
  | DecoupleOperationAst
  | TapOperationAst
  | BridgeOperationAst;

export interface DiffPairAst {
  kind: "diff_pair";
  name: string;
  pNet: string;
  nNet: string;
  pPins: string[];
  nPins: string[];
  operations?: PinOperationAst[];
  constraints?: Record<string, string | boolean>;
}
