import React from "react";
import type {
  MarketOverview,
  CompetitiveLandscape,
  ProductBenchmark,
  UserInsights,
  ResearchTable,
  SupplyChainFindings
} from "@/features/workbench/product-knowledge";
import type { ProductKnowledgeV2 } from "@/features/workbench/product-knowledge";
import { randomId } from "@/lib/random-id";

export type ProductKnowledgeEditorIssue = {
  severity: "blocking" | "warning" | "conflict";
  message: string;
  section?: string;
  field?: string;
};

export function ProductKnowledgeEditor({
  value,
  onChange,
  issues
}: {
  value: ProductKnowledgeV2;
  onChange: (value: ProductKnowledgeV2) => void;
  issues: ProductKnowledgeEditorIssue[];
}) {
  return (
    <div className="divide-y divide-line">
      <EditorSection issues={issues} title="产品定位">
        <div className="grid gap-3 sm:grid-cols-2">
          <TextInput label="产品名称" onChange={(name) => onChange({ ...value, name })} value={value.name} />
          <TextInput label="产品品类" onChange={(category) => onChange({ ...value, category })} value={value.category} />
          <TextInput label="核心用途" onChange={(coreUse) => onChange({ ...value, coreUse })} value={value.coreUse} />
          <TextInput label="目标用户" onChange={(targetUsers) => onChange({ ...value, targetUsers })} value={value.targetUsers} />
          <ListInput label="使用场景" onChange={(useScenarios) => onChange({ ...value, useScenarios })} values={value.useScenarios} />
          <TextInput label="默认计量单位" onChange={(defaultUnit) => onChange({ ...value, defaultUnit })} value={value.defaultUnit} />
        </div>
      </EditorSection>

      <EditorSection issues={issues} title="关键规格">
        <div className="space-y-3">
          {value.specifications.map((specification, index) => (
            <div className="grid gap-3 rounded-md border border-line p-3 sm:grid-cols-[1fr_1fr_0.7fr_auto]" key={specification.id || `spec-${index}`}>
              <TextInput
                label="参数"
                onChange={(name) => onChange({
                  ...value,
                  specifications: value.specifications.map((item, itemIndex) => itemIndex === index ? { ...item, name } : item)
                })}
                value={specification.name}
              />
              <TextInput
                label="数值"
                onChange={(specificationValue) => onChange({
                  ...value,
                  specifications: value.specifications.map((item, itemIndex) => itemIndex === index ? { ...item, value: specificationValue } : item)
                })}
                value={specification.value}
              />
              <TextInput
                label="单位"
                onChange={(unit) => onChange({
                  ...value,
                  specifications: value.specifications.map((item, itemIndex) => itemIndex === index ? { ...item, unit } : item)
                })}
                value={specification.unit}
              />
              <RowDeleteButton
                label={`删除规格 ${index + 1}`}
                onClick={() => onChange({ ...value, specifications: value.specifications.filter((_, itemIndex) => itemIndex !== index) })}
              />
            </div>
          ))}
          <AddButton
            label="新增规格"
            onClick={() => onChange({
              ...value,
              specifications: [...value.specifications, { id: randomId(), name: "新规格", value: "", source: "manual" }]
            })}
          />
        </div>
      </EditorSection>

      <EditorSection issues={issues} title="1688采购参考">
        <div className="space-y-3">
          {value.procurementQuotes.map((quote, index) => (
            <div className="space-y-3 rounded-md border border-line p-3" key={`${quote.source}-${quote.specification}-${index}`}>
              <div className="flex justify-end">
                <RowDeleteButton label={`删除采购报价 ${index + 1}`} onClick={() => onChange({
                  ...value,
                  procurementQuotes: value.procurementQuotes.filter((_, itemIndex) => itemIndex !== index)
                })} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <TextInput label="来源" onChange={(source) => onChange({ ...value, procurementQuotes: patchRow(value.procurementQuotes, index, { source }) })} value={quote.source} />
                <TextInput label="供应商" onChange={(supplier) => onChange({ ...value, procurementQuotes: patchRow(value.procurementQuotes, index, { supplier }) })} value={quote.supplier} />
                <TextInput label="对应规格" onChange={(specification) => onChange({ ...value, procurementQuotes: patchRow(value.procurementQuotes, index, { specification }) })} value={quote.specification} />
                <TextInput label="批发报价" onChange={(price) => onChange({ ...value, procurementQuotes: patchRow(value.procurementQuotes, index, { price }) })} value={quote.price} />
                <TextInput label="MOQ" onChange={(moq) => onChange({ ...value, procurementQuotes: patchRow(value.procurementQuotes, index, { moq }) })} value={quote.moq} />
                <TextInput label="运费口径" onChange={(freight) => onChange({ ...value, procurementQuotes: patchRow(value.procurementQuotes, index, { freight }) })} value={quote.freight} />
                <TextInput label="报价时间" onChange={(quotedAt) => onChange({ ...value, procurementQuotes: patchRow(value.procurementQuotes, index, { quotedAt }) })} value={quote.quotedAt} />
                <TextInput label="链接" onChange={(sourceUrl) => onChange({ ...value, procurementQuotes: patchRow(value.procurementQuotes, index, { sourceUrl }) })} value={quote.sourceUrl} placeholder="https://..." />
              </div>
            </div>
          ))}
          <AddButton label="新增采购报价" onClick={() => onChange({
            ...value,
            procurementQuotes: [...value.procurementQuotes, { source: "1688", specification: "", price: "" }]
          })} />
        </div>
      </EditorSection>

      <EditorSection issues={issues} title="原料与结构">
        <div className="space-y-3">
          {value.materialStructures.map((material, index) => (
            <div className="space-y-3 rounded-md border border-line p-3" key={`${material.name}-${index}`}>
              <div className="flex justify-end">
                <RowDeleteButton label={`删除原料或结构 ${index + 1}`} onClick={() => onChange({
                  ...value,
                  materialStructures: value.materialStructures.filter((_, itemIndex) => itemIndex !== index)
                })} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <TextInput label="原料或结构" onChange={(name) => onChange({ ...value, materialStructures: patchRow(value.materialStructures, index, { name }) })} value={material.name} />
                <TextInput label="作用" onChange={(role) => onChange({ ...value, materialStructures: patchRow(value.materialStructures, index, { role }) })} value={material.role} />
                <TextArea label="关键参数" onChange={(keyParameters) => onChange({ ...value, materialStructures: patchRow(value.materialStructures, index, { keyParameters }) })} value={material.keyParameters} />
                <TextArea label="已知弊端" onChange={(weaknesses) => onChange({ ...value, materialStructures: patchRow(value.materialStructures, index, { weaknesses }) })} value={material.weaknesses} />
              </div>
            </div>
          ))}
          <AddButton label="新增原料或结构" onClick={() => onChange({
            ...value,
            materialStructures: [...value.materialStructures, { name: "新原料或结构" }]
          })} />
        </div>
      </EditorSection>

      <EditorSection issues={issues} title="生产流程与设备">
        <div className="grid gap-3 sm:grid-cols-2">
          <ListInput
            label="核心工艺"
            onChange={(processes) => onChange({ ...value, manufacturing: { ...value.manufacturing, processes } })}
            values={value.manufacturing.processes}
          />
          <TextInput
            label="生产周期"
            onChange={(leadTime) => onChange({ ...value, manufacturing: { ...value.manufacturing, leadTime } })}
            value={value.manufacturing.leadTime}
          />
          <TextInput
            label="最小起订量"
            onChange={(minimumOrderQuantity) => onChange({ ...value, manufacturing: { ...value.manufacturing, minimumOrderQuantity } })}
            value={value.manufacturing.minimumOrderQuantity}
          />
          <ListInput label="所需机器" onChange={(machinery) => onChange({ ...value, machinery })} values={value.machinery} />
          <ListInput label="质量控制点" onChange={(qualityControls) => onChange({ ...value, qualityControls })} values={value.qualityControls} />
          <ListInput label="主要产业带" onChange={(industryClusters) => onChange({ ...value, industryClusters })} values={value.industryClusters} />
          <TextArea
            label="生产难点与补充说明"
            onChange={(notes) => onChange({ ...value, manufacturing: { ...value.manufacturing, notes } })}
            value={value.manufacturing.notes}
          />
        </div>
      </EditorSection>

      <EditorSection issues={issues} title="成熟替代与优化">
        <div className="space-y-3">
          {value.optimizationOptions.map((option, index) => (
            <div className="space-y-3 rounded-md border border-line p-3" key={option.id || `option-${index}`}>
              <div className="flex justify-end">
                <RowDeleteButton
                  label={`删除替代项 ${index + 1}`}
                  onClick={() => onChange({ ...value, optimizationOptions: value.optimizationOptions.filter((_, itemIndex) => itemIndex !== index) })}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <TextInput
                  label="替代方案"
                  onChange={(name) => onChange({
                    ...value,
                    optimizationOptions: patchRow(value.optimizationOptions, index, { name })
                  })}
                  value={option.name}
                />
                <SelectInput
                  label="状态"
                  onChange={(status) => onChange({
                    ...value,
                    optimizationOptions: patchRow(value.optimizationOptions, index, { status: status as typeof option.status })
                  })}
                  options={[["candidate", "候选"], ["selected", "已选择"], ["rejected", "已排除"]]}
                  value={option.status}
                />
                <TextArea
                  label="替代对象、风险和打样建议"
                  onChange={(description) => onChange({
                    ...value,
                    optimizationOptions: patchRow(value.optimizationOptions, index, { description })
                  })}
                  value={option.description}
                />
                <TextArea
                  label="成本与质量影响"
                  onChange={(impact) => onChange({
                    ...value,
                    optimizationOptions: patchRow(value.optimizationOptions, index, { impact })
                  })}
                  value={option.impact}
                />
              </div>
            </div>
          ))}
          <AddButton
            label="新增替代项"
            onClick={() => onChange({
              ...value,
              optimizationOptions: [
                ...value.optimizationOptions,
                { id: randomId(), name: "新替代方案", status: "candidate" }
              ]
            })}
          />
        </div>
      </EditorSection>

      <EditorSection issues={issues} title="缺陷与风险">
        <div className="grid gap-3 sm:grid-cols-2">
          <ListInput label="质量与工艺风险" onChange={(quality) => onChange({ ...value, risks: { ...value.risks, quality } })} values={value.risks.quality} />
          <ListInput label="原材料与供应风险" onChange={(supply) => onChange({ ...value, risks: { ...value.risks, supply } })} values={value.risks.supply} />
          <ListInput label="合规风险" onChange={(compliance) => onChange({ ...value, risks: { ...value.risks, compliance } })} values={value.risks.compliance} />
          <ListInput label="使用与售后风险" onChange={(other) => onChange({ ...value, risks: { ...value.risks, other } })} values={value.risks.other} />
        </div>
      </EditorSection>

      <EditorSection issues={issues} title="采购与验证">
        <div className="grid gap-3 sm:grid-cols-2">
          <TextArea label="必须确认与关键变量" onChange={(summary) => onChange({ ...value, decision: { ...value.decision, summary } })} value={value.decision.summary} />
          <TextArea label="是否值得继续询价或打样" onChange={(recommendation) => onChange({ ...value, decision: { ...value.decision, recommendation } })} value={value.decision.recommendation} />
          <TextArea label="打样、验货与下一步行动" onChange={(rationale) => onChange({ ...value, decision: { ...value.decision, rationale } })} value={value.decision.rationale} />
          <SelectInput
            label="当前决策状态"
            onChange={(status) => onChange({ ...value, decision: { ...value.decision, status: status as ProductKnowledgeV2["decision"]["status"] } })}
            options={[["undecided", "待决定"], ["proceed", "继续"], ["hold", "暂缓"], ["reject", "终止"]]}
            value={value.decision.status}
          />
          <div className="sm:col-span-2">
            <TextArea label="旧版补充资料" onChange={(legacyNotes) => onChange({ ...value, legacyNotes })} value={value.legacyNotes} />
          </div>
        </div>
      </EditorSection>

      <EditorSection issues={issues} title="技术趋势（按需）">
        {value.technologyOutlook ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <ListInput label="当前主流技术路线" onChange={(mainstream) => onChange({ ...value, technologyOutlook: { ...value.technologyOutlook!, mainstream } })} values={value.technologyOutlook.mainstream} />
            <ListInput label="现有替代路线" onChange={(alternatives) => onChange({ ...value, technologyOutlook: { ...value.technologyOutlook!, alternatives } })} values={value.technologyOutlook.alternatives} />
            <ListInput label="正在进入市场的新材料与新技术" onChange={(emerging) => onChange({ ...value, technologyOutlook: { ...value.technologyOutlook!, emerging } })} values={value.technologyOutlook.emerging} />
            <ListInput label="被替代风险" onChange={(replacementRisks) => onChange({ ...value, technologyOutlook: { ...value.technologyOutlook!, replacementRisks } })} values={value.technologyOutlook.replacementRisks} />
            <ListInput label="观察信号" onChange={(watchSignals) => onChange({ ...value, technologyOutlook: { ...value.technologyOutlook!, watchSignals } })} values={value.technologyOutlook.watchSignals} />
            <div className="flex items-end">
              <RowDeleteButton label="删除技术趋势记录" onClick={() => onChange({ ...value, technologyOutlook: undefined })} />
            </div>
          </div>
        ) : (
          <AddButton label="启用技术趋势记录" onClick={() => onChange({
            ...value,
            technologyOutlook: { mainstream: [], alternatives: [], emerging: [], replacementRisks: [], watchSignals: [] }
          })} />
        )}
      </EditorSection>

      <CategoryResearchSection onChange={onChange} value={value} />
    </div>
  );
}

function CategoryResearchSection({
  value,
  onChange
}: {
  value: ProductKnowledgeV2;
  onChange: (value: ProductKnowledgeV2) => void;
}) {
  const hasResearch = value.researchDepth === "category"
    || Boolean(value.marketOverview)
    || Boolean(value.competitiveLandscape)
    || Boolean(value.productBenchmark)
    || Boolean(value.userInsights)
    || Boolean(value.supplyChainFindings);

  if (!hasResearch) {
    return (
      <section className="py-5">
        <h2 className="font-semibold">品类调研（按需）</h2>
        <p className="mt-2 text-sm text-slate-500">当前产品尚未关联品类调研数据。</p>
        <AddButton
          label="启用品类调研记录"
          onClick={() => onChange({ ...value, researchDepth: "category", marketOverview: {} })}
        />
      </section>
    );
  }

  return (
    <section className="py-5">
      <h2 className="font-semibold">品类调研</h2>
      <div className="mt-3 space-y-6">
        <MarketOverviewEditor
          value={value.marketOverview}
          onChange={(marketOverview) => onChange({ ...value, marketOverview })}
        />
        <CompetitiveLandscapeEditor
          value={value.competitiveLandscape}
          onChange={(competitiveLandscape) => onChange({ ...value, competitiveLandscape })}
        />
        <ProductBenchmarkEditor
          value={value.productBenchmark}
          onChange={(productBenchmark) => onChange({ ...value, productBenchmark })}
        />
        <UserInsightsEditor
          value={value.userInsights}
          onChange={(userInsights) => onChange({ ...value, userInsights })}
        />
        <SupplyChainFindingsEditor
          value={value.supplyChainFindings}
          onChange={(supplyChainFindings) => onChange({ ...value, supplyChainFindings })}
        />
      </div>
    </section>
  );
}

function MarketOverviewEditor({
  value,
  onChange
}: {
  value?: MarketOverview;
  onChange: (value: MarketOverview | undefined) => void;
}) {
  const market = value ?? {};
  const hasContent = Boolean(market.marketSize || market.yoyGrowth || market.subCategoryTrend || market.pestel?.length || market.entryBarriers?.length || market.marketSizeTable || market.segmentStructure);
  if (!hasContent) {
    return (
      <div className="rounded-md border border-dashed border-line p-3">
        <div className="text-sm font-medium">行业概览</div>
        <p className="mt-1 text-xs text-slate-500">暂无行业概览数据。</p>
        <button className="mt-2 rounded-md border border-line px-3 py-1 text-xs" onClick={() => onChange({})} type="button">
          新建
        </button>
      </div>
    );
  }
  return (
    <div className="rounded-md border border-line p-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">行业概览</div>
        <button className="text-xs text-red-600" onClick={() => onChange(undefined)} type="button">删除</button>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <TextInput label="市场规模" onChange={(marketSize) => onChange({ ...market, marketSize })} value={market.marketSize} />
        <TextInput label="同比增长" onChange={(yoyGrowth) => onChange({ ...market, yoyGrowth })} value={market.yoyGrowth} />
        <TextInput label="细分趋势" onChange={(subCategoryTrend) => onChange({ ...market, subCategoryTrend })} value={market.subCategoryTrend} />
      </div>
      <TableEditor label="市场规模表" onChange={(marketSizeTable) => onChange({ ...market, marketSizeTable })} value={market.marketSizeTable} />
      <PestelEditor onChange={(pestel) => onChange({ ...market, pestel })} value={market.pestel} />
      <EntryBarriersEditor onChange={(entryBarriers) => onChange({ ...market, entryBarriers })} value={market.entryBarriers} />
      <TableEditor label="细分结构表" onChange={(segmentStructure) => onChange({ ...market, segmentStructure })} value={market.segmentStructure} />
    </div>
  );
}

function CompetitiveLandscapeEditor({
  value,
  onChange
}: {
  value?: CompetitiveLandscape;
  onChange: (value: CompetitiveLandscape | undefined) => void;
}) {
  const cl = value ?? {};
  const hasContent = Boolean(cl.cr5 || cl.strategyDifferences || cl.porterFiveForces?.length || cl.topBrandRanking || cl.brandRankingByCategory);
  if (!hasContent) {
    return (
      <div className="rounded-md border border-dashed border-line p-3">
        <div className="text-sm font-medium">竞争格局</div>
        <p className="mt-1 text-xs text-slate-500">暂无竞争格局数据。</p>
        <button className="mt-2 rounded-md border border-line px-3 py-1 text-xs" onClick={() => onChange({})} type="button">
          新建
        </button>
      </div>
    );
  }
  return (
    <div className="rounded-md border border-line p-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">竞争格局</div>
        <button className="text-xs text-red-600" onClick={() => onChange(undefined)} type="button">删除</button>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <TextInput label="CR5" onChange={(cr5) => onChange({ ...cl, cr5 })} value={cl.cr5} />
        <TextInput label="策略差异" onChange={(strategyDifferences) => onChange({ ...cl, strategyDifferences })} value={cl.strategyDifferences} />
      </div>
      <TableEditor label="头部品牌排名" onChange={(topBrandRanking) => onChange({ ...cl, topBrandRanking })} value={cl.topBrandRanking} />
      <TableEditor label="分类品牌排名" onChange={(brandRankingByCategory) => onChange({ ...cl, brandRankingByCategory })} value={cl.brandRankingByCategory} />
      <PorterFiveEditor onChange={(porterFiveForces) => onChange({ ...cl, porterFiveForces })} value={cl.porterFiveForces} />
    </div>
  );
}

function ProductBenchmarkEditor({
  value,
  onChange
}: {
  value?: ProductBenchmark;
  onChange: (value: ProductBenchmark | undefined) => void;
}) {
  const pb = value ?? {};
  const hasContent = Boolean(pb.keyFindings || pb.tmallProtectiveFilm || pb.tmallHangingBoard || pb.formComparison || pb.priceTiers);
  if (!hasContent) {
    return (
      <div className="rounded-md border border-dashed border-line p-3">
        <div className="text-sm font-medium">产品对标</div>
        <p className="mt-1 text-xs text-slate-500">暂无产品对标数据。</p>
        <button className="mt-2 rounded-md border border-line px-3 py-1 text-xs" onClick={() => onChange({})} type="button">
          新建
        </button>
      </div>
    );
  }
  return (
    <div className="rounded-md border border-line p-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">产品对标</div>
        <button className="text-xs text-red-600" onClick={() => onChange(undefined)} type="button">删除</button>
      </div>
      <div className="mt-3">
        <TextArea label="关键发现" onChange={(keyFindings) => onChange({ ...pb, keyFindings })} value={pb.keyFindings} />
      </div>
      <TableEditor label="天猫保护膜对标" onChange={(tmallProtectiveFilm) => onChange({ ...pb, tmallProtectiveFilm })} value={pb.tmallProtectiveFilm} />
      <TableEditor label="天猫挂板对标" onChange={(tmallHangingBoard) => onChange({ ...pb, tmallHangingBoard })} value={pb.tmallHangingBoard} />
      <TableEditor label="形态对比" onChange={(formComparison) => onChange({ ...pb, formComparison })} value={pb.formComparison} />
      <TableEditor label="价格分层" onChange={(priceTiers) => onChange({ ...pb, priceTiers })} value={pb.priceTiers} />
    </div>
  );
}

function UserInsightsEditor({
  value,
  onChange
}: {
  value?: UserInsights;
  onChange: (value: UserInsights | undefined) => void;
}) {
  const ui = value ?? {};
  const hasContent = Boolean(ui.purchasePriorities?.length || ui.praisePoints?.length || ui.personas || ui.coreMetrics || ui.complaints);
  if (!hasContent) {
    return (
      <div className="rounded-md border border-dashed border-line p-3">
        <div className="text-sm font-medium">用户洞察</div>
        <p className="mt-1 text-xs text-slate-500">暂无用户洞察数据。</p>
        <button className="mt-2 rounded-md border border-line px-3 py-1 text-xs" onClick={() => onChange({})} type="button">
          新建
        </button>
      </div>
    );
  }
  return (
    <div className="rounded-md border border-line p-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">用户洞察</div>
        <button className="text-xs text-red-600" onClick={() => onChange(undefined)} type="button">删除</button>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <ListInput label="购买决策因素" onChange={(purchasePriorities) => onChange({ ...ui, purchasePriorities })} values={ui.purchasePriorities ?? []} />
        <ListInput label="好评卖点" onChange={(praisePoints) => onChange({ ...ui, praisePoints })} values={ui.praisePoints ?? []} />
      </div>
      <TableEditor label="用户画像" onChange={(personas) => onChange({ ...ui, personas })} value={ui.personas} />
      <TableEditor label="核心指标" onChange={(coreMetrics) => onChange({ ...ui, coreMetrics })} value={ui.coreMetrics} />
      <TableEditor label="差评与投诉" onChange={(complaints) => onChange({ ...ui, complaints })} value={ui.complaints} />
    </div>
  );
}

function SupplyChainFindingsEditor({
  value,
  onChange
}: {
  value?: SupplyChainFindings;
  onChange: (value: SupplyChainFindings | undefined) => void;
}) {
  const sc = value ?? {};
  const hasContent = Boolean(sc.comboSupply || sc.sourcingPathSteps?.length || sc.coreMetrics || sc.filmSuppliers || sc.boardSuppliers || sc.priceGradientFilm || sc.priceGradientBoard || sc.sourcingAdvice);
  if (!hasContent) {
    return (
      <div className="rounded-md border border-dashed border-line p-3">
        <div className="text-sm font-medium">供应链寻源</div>
        <p className="mt-1 text-xs text-slate-500">暂无供应链寻源数据。</p>
        <button className="mt-2 rounded-md border border-line px-3 py-1 text-xs" onClick={() => onChange({})} type="button">
          新建
        </button>
      </div>
    );
  }
  return (
    <div className="rounded-md border border-line p-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">供应链寻源</div>
        <button className="text-xs text-red-600" onClick={() => onChange(undefined)} type="button">删除</button>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <TextInput label="三合一供应说明" onChange={(comboSupply) => onChange({ ...sc, comboSupply })} value={sc.comboSupply} />
        <ListInput label="寻源执行路径" onChange={(sourcingPathSteps) => onChange({ ...sc, sourcingPathSteps })} values={sc.sourcingPathSteps ?? []} />
      </div>
      <TableEditor label="核心指标" onChange={(coreMetrics) => onChange({ ...sc, coreMetrics })} value={sc.coreMetrics} />
      <TableEditor label="贴膜供应商" onChange={(filmSuppliers) => onChange({ ...sc, filmSuppliers })} value={sc.filmSuppliers} />
      <TableEditor label="挂板供应商" onChange={(boardSuppliers) => onChange({ ...sc, boardSuppliers })} value={sc.boardSuppliers} />
      <TableEditor label="贴膜价格梯度" onChange={(priceGradientFilm) => onChange({ ...sc, priceGradientFilm })} value={sc.priceGradientFilm} />
      <TableEditor label="挂板价格梯度" onChange={(priceGradientBoard) => onChange({ ...sc, priceGradientBoard })} value={sc.priceGradientBoard} />
      <TableEditor label="寻源建议" onChange={(sourcingAdvice) => onChange({ ...sc, sourcingAdvice })} value={sc.sourcingAdvice} />
    </div>
  );
}

function TableEditor({
  label,
  value,
  onChange
}: {
  label: string;
  value?: ResearchTable;
  onChange: (value: ResearchTable | undefined) => void;
}) {
  if (!value || value.rows.length === 0) {
    return (
      <div className="mt-3">
        <div className="text-xs text-slate-500">{label}</div>
        <p className="mt-1 text-xs text-slate-400">暂无数据</p>
      </div>
    );
  }
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between">
        <div className="text-xs text-slate-500">{label}（{value.rows.length} 行）</div>
        <button className="text-xs text-red-600" onClick={() => onChange(undefined)} type="button">清空</button>
      </div>
      <div className="mt-1 overflow-x-auto">
        <table className="min-w-full text-left text-xs">
          <thead>
            <tr className="border-b border-line">
              {value.headers.map((header, index) => (
                <th className="py-1 pr-3" key={index}>{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {value.rows.map((row, rowIndex) => (
              <tr className="border-b border-line" key={rowIndex}>
                {value.headers.map((header, colIndex) => (
                  <td className="py-1 pr-3" key={colIndex}>{row[header] ?? "—"}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PestelEditor({
  value,
  onChange
}: {
  value?: MarketOverview["pestel"];
  onChange: (value: MarketOverview["pestel"]) => void;
}) {
  if (!value || value.length === 0) return null;
  return (
    <div className="mt-3">
      <div className="text-xs text-slate-500">PESTEL 分析</div>
      <table className="mt-1 min-w-full text-left text-xs">
        <thead>
          <tr className="border-b border-line">
            <th className="py-1 pr-3">维度</th>
            <th className="py-1 pr-3">关键因素</th>
            <th className="py-1 pr-3">影响</th>
          </tr>
        </thead>
        <tbody>
          {value.map((item, index) => (
            <tr className="border-b border-line" key={index}>
              <td className="py-1 pr-3">{item.dimension}</td>
              <td className="py-1 pr-3">{item.factor}</td>
              <td className="py-1 pr-3">{item.impact}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PorterFiveEditor({
  value,
  onChange
}: {
  value?: CompetitiveLandscape["porterFiveForces"];
  onChange: (value: CompetitiveLandscape["porterFiveForces"]) => void;
}) {
  if (!value || value.length === 0) return null;
  return (
    <div className="mt-3">
      <div className="text-xs text-slate-500">波特五力</div>
      <table className="mt-1 min-w-full text-left text-xs">
        <thead>
          <tr className="border-b border-line">
            <th className="py-1 pr-3">竞争力量</th>
            <th className="py-1 pr-3">强度</th>
            <th className="py-1 pr-3">关键依据</th>
          </tr>
        </thead>
        <tbody>
          {value.map((item, index) => (
            <tr className="border-b border-line" key={index}>
              <td className="py-1 pr-3">{item.force}</td>
              <td className="py-1 pr-3">{item.strength}</td>
              <td className="py-1 pr-3">{item.basis}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EntryBarriersEditor({
  value,
  onChange
}: {
  value?: MarketOverview["entryBarriers"];
  onChange: (value: MarketOverview["entryBarriers"]) => void;
}) {
  if (!value || value.length === 0) return null;
  return (
    <div className="mt-3">
      <div className="text-xs text-slate-500">进入门槛</div>
      <table className="mt-1 min-w-full text-left text-xs">
        <thead>
          <tr className="border-b border-line">
            <th className="py-1 pr-3">门槛维度</th>
            <th className="py-1 pr-3">高低</th>
            <th className="py-1 pr-3">分析</th>
          </tr>
        </thead>
        <tbody>
          {value.map((item, index) => (
            <tr className="border-b border-line" key={index}>
              <td className="py-1 pr-3">{item.name}</td>
              <td className="py-1 pr-3">{item.level}</td>
              <td className="py-1 pr-3">{item.analysis}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EditorSection({
  title,
  issues,
  children
}: {
  title: string;
  issues: ProductKnowledgeEditorIssue[];
  children: React.ReactNode;
}) {
  const sectionIssues = issues.filter((issue) => issue.section === title || issue.field === title);
  return (
    <section className="py-5 first:pt-0 last:pb-0">
      <h2 className="font-semibold">{title}</h2>
      {sectionIssues.length > 0 ? (
        <ul className="mt-2 space-y-1 text-sm">
          {sectionIssues.map((issue, index) => (
            <li className={issueTextClass(issue.severity)} key={`${issue.severity}-${issue.message}-${index}`}>
              {issue.message}
            </li>
          ))}
        </ul>
      ) : null}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function TextInput({ label, value, onChange, placeholder }: { label: string; value?: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <label className="block">
      <span className="text-xs text-slate-500">{label}</span>
      <input
        className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm"
        onChange={(event) => onChange(event.target.value)}
        value={value || ""}
        placeholder={placeholder}
      />
    </label>
  );
}

function TextArea({ label, value, onChange }: { label: string; value?: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="text-xs text-slate-500">{label}</span>
      <textarea
        className="mt-1 min-h-24 w-full rounded-md border border-line px-3 py-2 text-sm"
        onChange={(event) => onChange(event.target.value)}
        value={value || ""}
      />
    </label>
  );
}

function ListInput({ label, values, onChange }: { label: string; values: string[]; onChange: (values: string[]) => void }) {
  return (
    <TextArea
      label={`${label}（每行一项）`}
      onChange={(text) => onChange(text.split(/\r?\n/).map((item) => item.trim()).filter(Boolean))}
      value={values.join("\n")}
    />
  );
}

function SelectInput({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: string;
  options: Array<[string, string]>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs text-slate-500">{label}</span>
      <select
        className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        {options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}
      </select>
    </label>
  );
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button className="whitespace-nowrap rounded-md border border-action px-3 py-2 text-sm text-action" onClick={onClick} type="button">
      {label}
    </button>
  );
}

function RowDeleteButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      aria-label={label}
      className="self-end whitespace-nowrap rounded-md border border-red-200 px-3 py-2 text-sm text-red-700"
      onClick={onClick}
      type="button"
    >
      删除
    </button>
  );
}

function patchRow<T>(rows: T[], index: number, patch: Partial<T>): T[] {
  return rows.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row);
}

function issueTextClass(severity: ProductKnowledgeEditorIssue["severity"]): string {
  if (severity === "blocking") return "text-red-700";
  if (severity === "conflict") return "text-amber-800";
  return "text-slate-600";
}
