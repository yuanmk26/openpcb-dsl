export type PinKind = "in" | "out" | "inout" | "passive" | "power_in" | "power_out";

export interface ProgramAst {
  kind: "program";
  imports: ImportAst[];
  components: ComponentDefAst[];
  packages: PackageDefAst[];
  devices: DeviceDefAst[];
  instances: InstanceAst[];
  diffPairs: DiffPairAst[];
}

export interface ImportAst {
  kind: "import";
  path: string;
}

export interface ComponentDefAst {
  kind: "component_def";
  name: string;
  pins: PinDeclAst[];
  groups?: GroupDeclAst[];
  attrs?: Record<string, string>;
}

export interface PinDeclAst {
  name: string;
  kind?: PinKind;
}

export interface GroupDeclAst {
  name: string;
  pins: string[];
}

export interface PackageDefAst {
  kind: "package_def";
  name: string;
  pads: string[];
}

export interface DeviceDefAst {
  kind: "device_def";
  name: string;
  component: string;
  package: string;
  attrs?: Record<string, string>;
  pinmap: PinmapDeclAst[];
}

export interface PinmapDeclAst {
  pin: string;
  pad: string;
}

export interface InstanceAst {
  kind: "instance";
  ref: string;
  target: string;
  targetKind: "legacy_component" | "device";
  componentType?: string;
  params?: Record<string, string>;
  attrs?: Record<string, string>;
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

export interface DiffEndpointBridgeAst {
  kind: "bridge";
  component: ComponentExprAst;
  legs: ["p", "n"];
}

export interface DiffEndpointAst {
  name: string;
  near?: string;
  bridges: DiffEndpointBridgeAst[];
}

export interface DiffPairAst {
  kind: "diff_pair";
  name: string;
  pNet: string;
  nNet: string;
  pPins: string[];
  nPins: string[];
  endpoints?: DiffEndpointAst[];
  constraints?: Record<string, string | boolean>;
}
