import type { ProductKnowledgeV2 } from "@/features/workbench/product-knowledge";

export function buildProductTechnologyPrompt(product: ProductKnowledgeV2): string {
  const specifications = product.specifications.map((item) => `${item.name}：${item.value}${item.unit || ""}`).join("；") || "未记录";
  const materials = product.materialStructures.map((item) => `${item.name}${item.role ? `（${item.role}）` : ""}`).join("；") || "未记录";
  const processes = product.manufacturing.processes.join("；") || "未记录";
  const machinery = product.machinery.join("；") || "未记录";

  return `你正在为产品“${product.name}”补充技术趋势与替代风险分析。

现有事实：
- 关键规格：${specifications}
- 原料与结构：${materials}
- 当前工艺：${processes}
- 当前设备：${machinery}

请联网核查，并只回答与该产品生产端直接相关的内容：
1. 当前主流技术路线及被采用的原因。
2. 现阶段其他厂家正在使用的替代材料、结构、设备或工艺，以及成熟程度。
3. 正在进入市场的新材料、新结构、新设备和新工艺，目前处于实验、打样、小批量还是规模应用阶段。
4. 当前产品、原料或工艺可能被替代的条件、影响范围和采用门槛。
5. 后续值得观察的市场和供应链信号。

必须区分已验证事实、公开行业动向和推断；无法确认时直接说明。不要重复基础产品介绍，不要输出空泛趋势，不要估算理论成本。

按以下格式输出：
## 当前主流技术路线
- 
## 现有替代路线
- 
## 正在进入市场的新材料与新技术
- 
## 被替代风险
- 
## 观察信号
- `;
}
