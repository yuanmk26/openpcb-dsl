# 语法设计

## 状态说明

本文档同时描述两部分内容：

- 当前 parser 已实现的 pin-centered DSL
- 尚未实现的 vNext 语法草案

阅读时请注意区分：

- “当前已实现语法”对应仓库里现在可被 `parseOpenPcbDsl()` 解析的文本 DSL
- “vNext grammar 草案”用于指导后续语法演进，不代表当前 parser、AST、IR 或 CLI 已支持这些写法

## 当前已实现语法

### Pin-Centered DSL

OpenPCB DSL 当前的设计出发点是：很多真实电路结构，都是从某个器件引脚出发，再描述这个引脚如何被连接、上拉、串联、并联或测试。

例如：

```opcb
U1 MCU(
  NRST.Node(RESET)
    .PullUp(R1 Resistor(value=10k), to=3V3)
    .Shunt(C1 Capacitor(value=100nF), to=GND)
);
```

在当前已实现语法里，元件实例使用空格分隔 `ref` 和 `type`，例如 `U1 MCU(...)`、`R1 Resistor(...)`，不使用 `:`。

### Parser 支持范围

当前文本 parser 已支持：

- `Ref Type(...)` 形式的顶层实例声明
- 以 `Pin.Node(net)` 开头的 pin 链式表达式
- `PullUp`、`PullDown`、`Series`、`Shunt`、`Decouple`、`Tap`
- `R1 Resistor(value=10k)` 这类内联辅助元件声明
- 空行、行尾逗号、`#` 注释和 `//` 注释

当前文本 parser 仍不支持：

- `diff_pair` 文本语法
- `Bridge` / `bridge` 文本解析
- `component / package / device / inst` 顶层定义语法

这段已实现语法的语义可以理解为：

1. 把 `NRST` 绑定到主节点 `RESET`
2. 在 `RESET` 和 `3V3` 之间添加上拉
3. 在 `RESET` 和 `GND` 之间添加并联电容

### 核心操作

#### `Node(name)`

把引脚绑定到它的主 node / net。当前设计里这是必须的，因为后续所有链式操作都需要一个稳定的“当前 net”作为展开起点。

#### `PullUp(component, to=VCC)`

在当前 node 与某个电源网络之间加入一个辅助元件，通常是电阻。IR 会同时保留底层连线信息和 `pullup` pattern。

#### `PullDown(component, to=GND)`

在当前 node 与某个参考网络之间加入一个下拉辅助元件，语义上与 `PullUp` 对称。

#### `Series(component, to=targetNet)`

在当前 node 和目标 net 之间加入一个串联的双端辅助元件。IR 会将其记录为 `series` pattern。

#### `Shunt(component, to=GND)`

在当前 node 和另一个参考网络之间加入双端辅助元件，常见场景是对地并联。IR 会将其记录为 `shunt` pattern。

#### `Decouple(component, to=GND)`

在基础连线语义上与 `Shunt` 相似，但 pattern 层会标记为 `decouple`，方便未来布局或约束逻辑区分去耦器件。

#### `Tap(component)`

在当前 net 上挂接一个单端或简单辅助器件，典型用途是测试点、探针点等。

### 为什么每个 pin 都必须先绑定主 node

要求先写 `Node()` 有几个明确好处：

- 链式操作拥有清晰的当前 net
- 校验逻辑可以围绕规范的 pin-to-net 关系工作
- emitter 能同时重建底层连通性和高层 pattern
- 后续变换不必反推一个 pin 最初属于哪个网络

### 为什么 diff pair 不应该被硬塞进单 pin 链式语法

差分对涉及正负两侧网络的耦合语义、端点局部规则、成对约束，以及有时跨 `p/n` 两侧的 `bridge` 元件。这些内容更适合专门的结构化语法，而不是过度复用单个 pin 的链式表达。

因此当前实现只先保留 `diff_pair` 的 AST / IR 占位结构，不急于把它压进现有单 pin 链式 parser。

## vNext 语法目标

vNext 的目标不是推翻当前 pin-centered 表达，而是在它上面补齐“元件定义层”。核心分层如下：

- `component`：定义电气 pin 接口
- `package`：定义物理 pad 集合
- `device`：绑定 `component + package + pinmap + attrs`
- `inst`：在设计中实例化具体器件并描述连接
- `diff_pair`：作为独立顶层结构存在

这样分层的主要原因：

- 抽象 `component` 负责表达电气接口，而不是具体可制造器件
- 物理封装不应主要在实例化时临时传参决定
- 具体器件需要稳定的 `pin -> pad` 映射
- 工程实例应引用具体 `device`，而不是仅引用抽象类型

### 为什么封装应进入定义层

如果把 `footprint` 或 `package` 主要留到实例阶段再传，例如：

```opcb
inst U1: MCU {
  footprint = LQFP48
}
```

会带来几个问题：

- `MCU` 仍然只是抽象类型，没有落到真实器件
- `pin -> pad` 映射无法稳定建模
- 器件可制造性、BOM 信息和版图约束缺少确定落点
- 同一抽象类型可以被随意换成不兼容封装，语义边界不清晰

因此 vNext 推荐把封装与引脚映射前置到 `device` 定义层，而不是让实例承担主要器件选型职责。

## vNext Grammar 草案

下面这版 grammar 是语法设计草案，不代表当前 parser 已实现。

```ebnf
Program            ::= Statement*

Statement          ::= ComponentDef
                     | PackageDef
                     | DeviceDef
                     | InstanceDef
                     | DiffPairDef

ComponentDef       ::= "component" Identifier "{" ComponentBody "}"
ComponentBody      ::= (PinsSection | GroupsSection | AttrsSection)*

PinsSection        ::= "pins" "{" PinDecl* "}"
PinDecl            ::= Identifier [ ":" PinKind ] [ "," ]
PinKind            ::= "in" | "out" | "inout" | "passive" | "power_in" | "power_out"

GroupsSection      ::= "groups" "{" GroupDecl* "}"
GroupDecl          ::= Identifier "{" IdentifierList "}" [ "," ]

AttrsSection       ::= "attrs" "{" AttrDecl* "}"
AttrDecl           ::= Identifier "=" Scalar [ "," ]

PackageDef         ::= "package" Identifier "{" PackageBody "}"
PackageBody        ::= PadsSection

PadsSection        ::= "pads" "{" PadSpecList "}"
PadSpecList        ::= PadSpec ( "," PadSpec )*
PadSpec            ::= Integer
                     | Integer ".." Integer
                     | Identifier

DeviceDef          ::= "device" Identifier ":" Identifier "@" Identifier "{"
                       DeviceBody
                       "}"
DeviceBody         ::= (AttrsSection | PinmapSection)*

PinmapSection      ::= "pinmap" "{" PinmapDecl* "}"
PinmapDecl         ::= Identifier "->" PadRef [ "," ]
PadRef             ::= Integer | Identifier

InstanceDef        ::= "inst" Identifier ":" Identifier "{"
                       InstanceBody
                       "}"
InstanceBody       ::= (InstanceAttrDecl | PinExpr | DiffEndpointBlock)*
InstanceAttrDecl   ::= Identifier "=" Scalar [ "," ]

PinExpr            ::= Identifier "." "Node" "(" Identifier ")" PinOpChain*
PinOpChain         ::= "." PinOp

PinOp              ::= PullUpOp
                     | PullDownOp
                     | SeriesOp
                     | ShuntOp
                     | DecoupleOp
                     | TapOp
                     | BridgeOp

PullUpOp           ::= "PullUp" "(" InlineInstance "," "to" "=" Identifier ")"
PullDownOp         ::= "PullDown" "(" InlineInstance "," "to" "=" Identifier ")"
SeriesOp           ::= "Series" "(" InlineInstance "," "to" "=" Identifier ")"
ShuntOp            ::= "Shunt" "(" InlineInstance "," "to" "=" Identifier ")"
DecoupleOp         ::= "Decouple" "(" InlineInstance "," "to" "=" Identifier ")"
TapOp              ::= "Tap" "(" InlineInstance ")"
BridgeOp           ::= "Bridge" "(" InlineInstance "," "to" "=" Identifier ")"

InlineInstance     ::= Identifier ":" Identifier
                     | Identifier ":" InlineDeviceExpr

InlineDeviceExpr   ::= Identifier "(" NamedArgList? ")"

NamedArgList       ::= NamedArg ( "," NamedArg )*
NamedArg           ::= Identifier "=" Scalar

DiffPairDef        ::= "diff_pair" Identifier "{"
                       DiffPairBody
                       "}"
DiffPairBody       ::= DiffLegDecl+
                       DiffEndpointBlock*
                       ConstraintBlock?

DiffLegDecl        ::= ("p" | "n") ":" PinRef "->" "node" Identifier "->" PinRef
PinRef             ::= Identifier "." Identifier

DiffEndpointBlock  ::= "endpoint" Identifier [ "near" Identifier ] "{"
                       EndpointStmt*
                       "}"
EndpointStmt       ::= "bridge" InlineInstance "between" "p" "," "n"

ConstraintBlock    ::= "constraint" "{"
                       ConstraintStmt*
                       "}"
ConstraintStmt     ::= Identifier Scalar
                     | Identifier Boolean

Identifier         ::= /[A-Za-z_][A-Za-z0-9_]*/
Integer            ::= /[0-9]+/
Scalar             ::= Identifier | Integer | StringLike
Boolean            ::= "true" | "false"
StringLike         ::= 不含结构分隔符的词法值
IdentifierList     ::= Identifier ( "," Identifier )*
```

## vNext 最小示例

### `component / package / device / inst`

```opcb
component MCU {
  pins {
    NRST: in
    PA0: inout
    VDD: power_in
    GND: power_in
  }
}

package LQFP48 {
  pads { 1..48 }
}

device STM32F103C8T6 : MCU @ LQFP48 {
  attrs {
    mfr = ST
    mpn = STM32F103C8T6
  }

  pinmap {
    NRST -> 7
    PA0  -> 10
    VDD  -> 24
    GND  -> 23
  }
}

inst U1: STM32F103C8T6 {
  NRST.Node(RESET)
    .PullUp(R1: Resistor(value=10k, package=R_0402), to=3V3)

  PA0.Node(ADC_IN)
}
```

上面的例子体现了几层语义边界：

- `MCU` 是电气接口定义
- `LQFP48` 是物理封装定义
- `STM32F103C8T6` 是具体器件定义
- `U1` 是项目中的实际实例

### `diff_pair`

```opcb
diff_pair ADC_D0 {
  p: U_ADC.DOUT0_P -> node ADC_D0_P -> U_FPGA.ADC_D0_P
  n: U_ADC.DOUT0_N -> node ADC_D0_N -> U_FPGA.ADC_D0_N

  endpoint rx near U_FPGA {
    bridge RT0: Resistor(value=100R, package=R_0402) between p, n
  }

  constraint {
    differential_impedance 100ohm
    intra_pair_length_match within_0p2mm
    route_together true
  }
}
```

这个写法把差分对视为独立结构，而不是把 `p`、`n` 两条路径拆成两段不相关的单 pin 链。

## 兼容与迁移说明

当前 DSL 与 vNext 之间建议这样理解：

- 当前 `U1 MCU(...)` 仍然是已实现、可用的写法
- vNext 推荐改为 `inst U1: SomeDevice { ... }`
- 当前内联辅助元件 `R1 Resistor(value=10k)` 的表达方式，在 vNext 中可继续保留为语法糖
- 该语法糖在语义上应被归一到某个 `device`，而不是长期停留在“实例时临时拼装器件”的层面

建议的迁移方向：

1. 先保留当前 pin-centered 实例语法，保证已有样例和 parser 不受影响
2. 新增 `component / package / device / inst` 顶层结构
3. 让实例层逐步从“引用抽象类型”过渡到“引用具体器件”
4. 再逐步把封装、pinmap、器件属性校验接入 AST 和 IR

## 当前与 vNext 的关系

为了避免误解，可以用下面的方式理解当前仓库状态：

- 当前仓库已经实现了一个可运行的 pin-centered DSL parser
- 当前仓库还没有实现 vNext grammar
- 本文中的 vNext grammar 草案主要用于指导后续 parser、AST、IR 和校验规则的演进
