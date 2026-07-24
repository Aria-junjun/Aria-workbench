import OpenAI from "openai";
import { DraftExtractionSchema, type DraftExtraction } from "./schemas";
import type { IntakeMode } from "./types";

export async function extractWorkbenchDraft(input: {
  mode: IntakeMode;
  rawText: string;
  sourceUrl?: string;
  images?: Array<{ dataUrl: string; mimeType: string }>;
}): Promise<DraftExtraction> {
  if (!process.env.OPENAI_API_KEY) {
    return buildFallbackExtraction(input.rawText, input.sourceUrl, input.images?.length ?? 0, "missing_key");
  }

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const model = process.env.OPENAI_EXTRACTION_MODEL ?? "gpt-4.1-mini";
    const response = await client.chat.completions.create({
      model,
      temperature: 0.1,
      messages: [
        {
          role: "system",
          content:
            "你是供应链工作台的信息整理助手。你只提取事实和用户明确表达的判断，不替用户做最终供应商决策。输出必须是 JSON。"
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: JSON.stringify({
                instruction:
                  "从输入文字和图片中提取供应商、沟通摘要、货盘、待办、知识卡和不确定信息。产品知识仅通过产品知识库的专用导入流程处理。没有的信息用空数组或省略可选字段。",
                mode: input.mode,
                sourceUrl: input.sourceUrl,
                rawText: input.rawText
              })
            },
            ...(input.images ?? []).map((image) => ({
              type: "image_url" as const,
              image_url: { url: image.dataUrl }
            }))
          ]
        }
      ],
      response_format: { type: "json_object" }
    });

    const content = response.choices[0]?.message.content;
    if (!content) throw new Error("AI extraction returned empty content");
    return DraftExtractionSchema.parse(JSON.parse(content));
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    const fallback = buildFallbackExtraction(input.rawText, input.sourceUrl, input.images?.length ?? 0, "ai_failed");
    return {
      ...fallback,
      uncertaintyNotes: [...fallback.uncertaintyNotes, `AI 调用失败，已使用本地兜底：${message.slice(0, 160)}`]
    };
  }
}

export function buildFallbackExtraction(
  rawText: string,
  sourceUrl?: string,
  imageCount = 0,
  reason: "missing_key" | "ai_failed" = "missing_key"
): DraftExtraction {
  const structured = parseStructuredChatGptOutput(rawText, sourceUrl);
  if (structured) {
    return DraftExtractionSchema.parse({
      ...structured,
      uncertaintyNotes: [
        ...structured.uncertaintyNotes,
        reason === "missing_key" ? "未配置 API，当前解析的是 ChatGPT Plus 整理后的文本。" : "AI API 未完成整理，当前解析的是粘贴文本。"
      ]
    });
  }

  const workbookQuote = parseWorkbookQuoteText(rawText);
  if (workbookQuote) {
    return DraftExtractionSchema.parse({
      ...workbookQuote,
      uncertaintyNotes: [
        ...workbookQuote.uncertaintyNotes,
        reason === "missing_key" ? "未配置 API，当前解析的是文件表格文本。" : "AI API 未完成整理，当前解析的是文件表格文本。"
      ]
    });
  }

  const comparisonTable = parseComparisonTable(rawText, sourceUrl);
  if (comparisonTable) {
    return DraftExtractionSchema.parse({
      ...comparisonTable,
      uncertaintyNotes: [
        ...comparisonTable.uncertaintyNotes,
        reason === "missing_key" ? "未配置 API，当前解析的是对比表格文本。" : "AI API 未完成整理，当前解析的是对比表格文本。"
      ]
    });
  }

  const safeText = rawText.trim() || (imageCount > 0 ? "用户上传了图片，等待人工整理和确认。" : "");
  const inlineBrief = parseInlineSupplierBrief(rawText);
  const supplierName = matchFirst(rawText, [/供应商[:：]\s*([^\n，,。]+)/, /厂家[:：]\s*([^\n，,。]+)/]);
  const price = matchFirst(rawText, [/(报价|价格)[:：]?\s*([0-9.]+ ?元?)/]);
  const moq = matchFirst(rawText, [/(MOQ|起订量)[:：]?\s*([0-9]+[^\n，,。]*)/i]);
  const leadTime = matchFirst(rawText, [/(交期)[:：]?\s*([0-9]+ ?天)/]);
  const plainQuote = parseUnlabeledSupplierQuote(rawText);
  const resolvedSupplierName = inlineBrief?.supplierName ?? supplierName ?? plainQuote?.supplierName;
  const resolvedPriceDetails = plainQuote?.priceDetails ?? price;
  const resolvedOfferName = plainQuote?.offerName ?? "待命名货盘";
  const inferredTasks = inferTasksFromChat(rawText);

  return DraftExtractionSchema.parse({
    supplier: resolvedSupplierName
      ? {
          name: resolvedSupplierName,
          sourceUrl,
          categories: inlineBrief?.categories ?? [],
          storeUrl: inlineBrief?.productUrl,
          sourcePlatform: inlineBrief?.productUrl?.includes("1688.com") ? "1688" : undefined,
          supplierType: "unknown",
          cooperationLevel: inlineBrief?.cooperationLevel,
          riskTags: inlineBrief?.riskTags ?? [],
          notes: inlineBrief?.supplierNotes
        }
      : undefined,
    communication: {
      summary: safeText,
      promises: leadTime ? [`交期 ${leadTime}`] : [],
      questions: [],
      risks: [],
      nextActions: rawText.includes("明天") || rawText.includes("跟进") ? ["继续跟进本次沟通事项"] : []
    },
    offers: inlineBrief
      ? [inlineBrief.offer]
      : plainQuote?.offers?.length
      ? plainQuote.offers
      : resolvedPriceDetails || moq || leadTime || plainQuote?.offerName
        ? [
            {
              name: resolvedOfferName,
              quotedPrice: resolvedPriceDetails,
              priceDetails: plainQuote?.priceDetails,
              moq: moq ?? plainQuote?.moq,
              leadTime: leadTime ?? plainQuote?.leadTime,
              notes: "本地兜底整理生成，需人工确认"
            }
          ]
        : [],
    productKnowledge: [],
    tasks: inferredTasks.length > 0
      ? inferredTasks
      : rawText.includes("明天") || rawText.includes("跟进")
        ? [
            {
              title: "跟进本次供应商沟通",
              dueText: rawText.includes("明天") ? "明天" : undefined,
              priority: "medium",
              type: "follow_up"
            }
          ]
        : [],
    knowledgeCards: [],
    uncertaintyNotes: [
      reason === "missing_key" ? "未配置 AI Key，当前为本地兜底整理结果。" : "AI 未完成整理，当前为本地兜底整理结果。",
      ...(imageCount > 0 ? [`已收到 ${imageCount} 张图片，但本地兜底模式不会识别图片内容。`] : [])
    ]
  });
}

function parseInlineSupplierBrief(rawText: string) {
  const supplierName = rawText.match(/供应商名称\s*[:：]\s*(.+?)(?=\s+主营(?:产品)?\s*[:：]|\r?\n|$)/)?.[1]?.trim();
  const categoriesText = rawText.match(/(?:主营产品\s*[:：]\s*(?:主营\s*[:：]\s*)?|主营\s*[:：]\s*)(.+?)(?=\s+(?:供应商)?(?:店铺|商品)?链接\s*[:：]|\s+https?:\/\/|\r?\n|$)/)?.[1]?.trim();
  const productUrl = rawText.match(/https?:\/\/[^\s，,。]*1688\.com\/[^\s，,。]*/)?.[0];
  const detailedQuotes = [...rawText.matchAll(/(\d+(?:\.\d+)?)\s*米\s*[，,]?\s*(\d+(?:\.\d+)?)\s*元(?:一卷)?\s*\+\s*(?:邮费\s*)?(\d+(?:\.\d+)?)\s*元(?:邮费)?/g)]
    .map((match) => ({ length: match[1], price: match[2], freight: `${match[3]}元` }));
  const sharedFreight = rawText.match(/邮费[^0-9]{0,8}(\d+(?:\.\d+)?)\s*元(?:起)?/)?.[0]?.replace(/^邮费[^0-9]*/, "").replace(/\s+/g, "");
  const simpleQuotes = [...rawText.matchAll(/(\d+(?:\.\d+)?)\s*米\s*[，,]?\s*(\d+(?:\.\d+)?)\s*元/g)]
    .map((match) => ({ length: match[1], price: match[2], freight: sharedFreight }));
  const trialQuoteMatch = rawText.match(/(\d+(?:\.\d+)?)\s*厘米(?:宽度)?[^。\n]{0,16}?(\d+(?:\.\d+)?)\s*米(?:长度)?[^。\n]{0,16}?单价\s*(\d+(?:\.\d+)?)\s*(?:元)?\s*\+\s*(\d+(?:\.\d+)?)\s*(?:元)?邮费/);
  const trialQuotes = trialQuoteMatch ? [{ length: trialQuoteMatch[2], price: trialQuoteMatch[3], freight: `${trialQuoteMatch[4]}元` }] : [];
  const quotes = detailedQuotes.length > 0 ? detailedQuotes : simpleQuotes.length > 0 ? simpleQuotes : trialQuotes;
  if (!supplierName || !categoriesText || quotes.length === 0) return undefined;
  const categories = categoriesText.split(/[、，,；;]/).map((item) => item.trim()).filter(Boolean);
  const quotedPrice = quotes.map((quote) => `${quote.length}米：${quote.price}元${quote.freight ? `，邮费${quote.freight}` : ""}`).join("；");
  const riskTags = [
    rawText.includes("不处理退货退款") ? "不处理普通退货退款" : undefined,
    rawText.includes("无合格证") ? "无合格证" : undefined,
    rawText.includes("品质属于中下") ? "品质中下" : undefined
  ].filter((item): item is string => Boolean(item));
  const supplierNotes = [
    rawText.match(/快递[^，,。\n]*(?:，[^，,。\n]*){0,2}/)?.[0],
    rawText.includes("通用标识") ? "通用标识" : undefined,
    rawText.includes("简易包装") ? "简易包装" : undefined,
    rawText.includes("只处理商家原因的售后") ? "只处理商家原因的售后" : undefined
  ].filter(Boolean).join("；") || undefined;
  return {
    supplierName,
    categories,
    productUrl,
    riskTags,
    supplierNotes,
    cooperationLevel: rawText.includes("配合态度比较好") ? "比较好" : undefined,
    offer: {
      name: categories[0] || "待命名货盘",
      category: categories[0],
      productUrl,
      quotedPrice,
      priceDetails: quotedPrice,
      dimensions: quotes.map((quote) => `${quote.length}米`).join("、"),
      pricingUnit: rawText.includes("一卷") ? "元/卷" : "元/套",
      freightIncluded: sharedFreight ? `不含运费；邮费${sharedFreight}` : "不含运费；各规格邮费见报价明细",
      keySpecs: rawText.match(/(\d+(?:\.\d+)?)\s*厘米\s*[xX×*]\s*(\d+(?:\.\d+)?)\s*米/)?.slice(1).join("厘米×").replace(/厘米×([^厘米]+)$/, "厘米×$1米")
        ?? (trialQuoteMatch ? `${trialQuoteMatch[1]}厘米×${trialQuoteMatch[2]}米` : undefined),
      materialGrade: rawText.includes("专业纳米胶") ? "专业纳米胶；环保易清理" : undefined,
      priceAdjustmentRule: rawText.match(/(?:若|如)?后期未起量[，,]?[^。]*?上浮\s*\d+%/)?.[0],
      packaging: rawText.includes("简易包装") ? "简易包装" : undefined,
      sampleStatus: rawText.includes("处理售后退货退款") ? "支持售后退货退款" : undefined,
      risks: [riskTags.join("；"), rawText.includes("每单处理时效长") ? "售后每单处理时效长" : undefined].filter(Boolean).join("；") || undefined,
      notes: supplierNotes
    }
  };
}

function inferTasksFromChat(rawText: string): DraftExtraction["tasks"] {
  const tasks: DraftExtraction["tasks"] = [];
  const shipment = rawText.match(/([A-Z]{2}\d{8,}|\d{10,})[^\n。]{0,16}(样品|样袋|样件|打样)[^\n。]{0,24}(?:查收|签收|物流|单号)/i)
    ?? rawText.match(/(样品|样袋|样件|打样)[^\n。]{0,16}(?:单号|快递|物流)[^\n。]{0,8}([A-Z]{2}\d{8,}|\d{10,})/i);
  if (shipment) {
    const trackingNumber = shipment[0].match(/(?:[A-Z]{2}\d{8,}|\d{10,})/i)?.[0];
    const sampleType = shipment[0].match(/样品|样袋|样件|打样/)?.[0] ?? "样品";
    tasks.push({
      title: `跟踪${sampleType}物流${trackingNumber ? ` ${trackingNumber}` : ""}，到件后查收验样`,
      priority: "medium",
      type: "follow_sample"
    });
  }
  const actionableLines = rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && /(?:需要)?(?:跟踪|跟进)|拿样测试|小批量入仓|到货情况|发货情况|付款情况|货源情况|找货|待找/.test(line));
  for (const line of actionableLines) {
    const title = line.replace(/[。；;]+$/, "");
    if (tasks.some((task) => task.title.includes(title) || title.includes(task.title.replace(/^跟踪/, "")))) continue;
    tasks.push({
      title,
      priority: "medium",
      type: /拿样|样品|样件|样袋|测试效果/.test(line) ? "follow_sample" : "follow_up"
    });
  }
  return tasks;
}

function parseUnlabeledSupplierQuote(rawText: string) {
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return undefined;

  const supplierName = lines
    .map((line) => line.match(/([\u4e00-\u9fa5A-Za-z0-9（）()·]{2,}(?:有限公司|有限责任公司|包装厂|纸品厂|塑料厂|印刷厂))/)?.[1])
    .find(Boolean);
  const offerIndex = lines.findIndex(
    (line) => /(?:袋|盒|箱|膜|纸|瓶|杯)/.test(line) && !/(合计|版费|起订|周期|包邮)/.test(line)
  );
  const priceLines = lines.filter((line) =>
    /(合计\s*[0-9.]+\s*元|[0-9.]+\s*元|[0-9.]+\s*一个|版费|报价)/.test(line)
  );
  const moqLine = lines.find((line) => /(?:最少|最低).{0,8}起订/.test(line));
  const leadTimeLine = lines.find((line) => /(?:后|交期).{0,8}\d+\s*天/.test(line));
  const globalMoqLine = lines.find((line) => /(?:起订量|至少).{0,12}\d+\s*个/.test(line));
  const globalMoq = globalMoqLine?.match(/至少(?:要)?\s*(\d+\s*个(?:左右)?)/)?.[1]
    ?? globalMoqLine?.match(/起订量.{0,8}?(\d+\s*个(?:左右)?)/)?.[1];
  const globalLeadTime = lines.find((line) => /(?:周期|交期)[^。\n]{0,30}\d+\s*天/.test(line))?.match(/\d+\s*天(?:左右)?/)?.[0];
  const offers = extractChatQuoteBlocks(lines)
    .map((block) => {
      const content = block.replace(/^.*?【订做[^】]*】\s*/, "").trim();
      const priceStart = content.search(/(?:未税价|含税价|报价)\s*/);
      const description = (priceStart >= 0 ? content.slice(0, priceStart) : content).replace(/[，,。]\s*$/, "");
      const untaxedUnitPrice = labeledUnitPrice(content, "未税价");
      const taxedUnitPrice = labeledUnitPrice(content, "含税价");
      const untaxedPlateFee = labeledPlateFee(content, "未税价");
      const taxedPlateFee = labeledPlateFee(content, "含税价");
      const prices = [untaxedUnitPrice && `未税价${untaxedUnitPrice}`, taxedUnitPrice && `含税价${taxedUnitPrice}`].filter(Boolean);
      const dimension = description.match(/\d+(?:\.\d+)?\s*[xX×*]\s*\d+(?:\.\d+)?\s*(?:cm|mm|厘米|毫米)/i)?.[0];
      const localMoq = content.match(/(?:数量|起订量|起订)?\s*(约)?\s*(\d+(?:\.\d+)?\s*万?\s*个)(?:左右)?/)?.[2]?.replace(/\s+/g, "");
      const name = description
        .replace(/^[（(][^）)]+[）)]\s*/, "")
        .split(/[，,]/)[0]
        .trim();
      return {
        name: name || "待命名货盘",
        quotedPrice: prices.join("；") || (priceStart >= 0 ? content.slice(priceStart) : undefined),
        priceDetails: content,
        untaxedUnitPrice,
        untaxedPlateFee,
        taxedUnitPrice,
        taxedPlateFee,
        taxFreightTerms: [content.match(/开[^，,。]*票/)?.[0], content.includes("包邮") ? "包邮" : undefined].filter(Boolean).join("；") || undefined,
        dimensions: dimension,
        moq: localMoq ?? globalMoq,
        leadTime: globalLeadTime,
        freightIncluded: content.includes("包邮") ? "包邮" : undefined,
        notes: "本地兜底整理生成，需人工确认"
      };
    });

  if (!supplierName && offerIndex < 0 && priceLines.length === 0) return undefined;

  return {
    supplierName,
    offerName: offerIndex >= 0 ? lines[offerIndex] : undefined,
    priceDetails: priceLines.length > 0 ? priceLines.join("\n") : undefined,
    moq: moqLine?.replace(/^.*?(最少|最低)\s*/, "").trim(),
    leadTime: leadTimeLine?.match(/\d+\s*天(?:左右)?/)?.[0],
    offers
  };
}

function extractChatQuoteBlocks(lines: string[]) {
  const blocks: string[] = [];
  let current: string[] | undefined;
  for (const line of lines) {
    if (/【订做[^】]*】/.test(line)) {
      if (current) blocks.push(current.join(" "));
      current = [line];
      continue;
    }
    if (!current) continue;
    if (/^[\u4e00-\u9fa5A-Za-z0-9（）()·]{2,}(?:有限公司|有限责任公司|包装厂|纸品厂|塑料厂|印刷厂).*\d{4}[-/.]\d{1,2}[-/.]\d{1,2}/.test(line)) continue;
    if (/^(?:wert\d+|已读)\b/i.test(line)) continue;
    if (/(?:未税价|含税价|版费|包邮|专票|普票)/.test(line)) current.push(line);
  }
  if (current) blocks.push(current.join(" "));
  return blocks;
}

function labeledUnitPrice(text: string, label: "未税价" | "含税价") {
  return text.match(new RegExp(`${label}\\s*([0-9.]+\\s*元\\s*\\/\\s*(?:个|只|件|支))`))?.[1].replace(/\s+/g, "");
}

function labeledPlateFee(text: string, label: "未税价" | "含税价") {
  const section = text.match(new RegExp(`${label}([\\s\\S]*?)(?=未税价|含税价|$)`))?.[1];
  return section?.match(/版费\s*[0-9.]+\s*元\s*\/\s*(?:色|支)(?:\s*[xX×*]\s*\d+\s*(?:色|支)?)?/)?.[0].replace(/\s+/g, "");
}

function parseStructuredChatGptOutput(rawText: string, sourceUrl?: string): DraftExtraction | null {
  const looksLikeKnowledgeCard = ["知识名称", "核心观点", "适用场景", "操作步骤", "参考话术", "关联标签"].some((label) =>
    rawText.includes(`${label}：`) || rawText.includes(`${label}:`)
  );

  const hasStructuredSection =
    rawText.includes("【供应商】") ||
    rawText.includes("【沟通记录】") ||
    rawText.includes("【知识卡】") ||
    rawText.includes("【商业知识】") ||
    looksLikeKnowledgeCard;

  if (!hasStructuredSection) return null;

  const supplier = section(rawText, "供应商");
  const communication = section(rawText, "沟通记录");
  const offer = section(rawText, "货盘");
  const task = section(rawText, "待办");
  const uncertainty = section(rawText, "不确定项");
  const knowledgeBlocks = knowledgeSections(rawText, looksLikeKnowledgeCard);

  const supplierName = field(supplier, "供应商名称");
  const offerName = field(offer, "货盘名称");
  const taskTitle = field(task, "待办事项");
  const firstKnowledgeTitle = knowledgeBlocks[0] ? field(knowledgeBlocks[0], "知识名称") || field(knowledgeBlocks[0], "标题") : undefined;

  return DraftExtractionSchema.parse({
    supplier: supplierName
      ? {
          name: supplierName,
          sourceUrl,
          categories: splitList(field(supplier, "主营产品")),
          location: field(supplier, "地区"),
          contactName: field(supplier, "联系人/联系方式") || field(supplier, "联系方式"),
          contactMethod: field(supplier, "联系人/联系方式") || field(supplier, "联系方式"),
          storeUrl: field(supplier, "店铺链接"),
          sourcePlatform: field(supplier, "来源平台"),
          supplierType: parseSupplierType(field(supplier, "工厂/贸易商/未知")),
          cooperationLevel: field(supplier, "配合度"),
          riskTags: splitList(field(supplier, "风险标签")),
          notes: field(supplier, "备注")
        }
      : undefined,
    communication: {
      summary: field(communication, "沟通摘要") || (firstKnowledgeTitle ? `知识卡录入：${firstKnowledgeTitle}` : rawText),
      promises: splitList(field(communication, "供应商承诺")),
      questions: splitList(field(communication, "疑点")),
      risks: splitList(field(communication, "风险点")),
      nextActions: splitList(field(communication, "下一步动作"))
    },
    offers: offerName
      ? [
          {
            name: offerName,
            category: field(offer, "产品品类"),
            productUrl: field(offer, "商品链接"),
            resourceUrl: field(offer, "资料链接"),
            quotedPrice: field(offer, "报价"),
            priceDetails: field(offer, "报价明细"),
            untaxedUnitPrice: field(offer, "未税单价"),
            untaxedPlateFee: field(offer, "未税版费"),
            taxedUnitPrice: field(offer, "含税单价"),
            taxedPlateFee: field(offer, "含税版费"),
            taxFreightTerms: field(offer, "开票/运费"),
            comparisonBasis: field(offer, "统一比价口径"),
            normalizedPriceDetails: field(offer, "折算单价"),
            dimensions: field(offer, "尺寸"),
            pricingUnit: field(offer, "计价单位"),
            packageUnit: field(offer, "包装单位"),
            keySpecs: field(offer, "关键规格"),
            materialGrade: field(offer, "材质等级"),
            width: field(offer, "宽度"),
            rollLength: field(offer, "卷长"),
            gramWeightOptions: field(offer, "克重选项"),
            rollWeight: field(offer, "单卷重量"),
            freightIncluded: field(offer, "是否含运费"),
            priceAdjustmentRule: field(offer, "调价规则"),
            moq: field(offer, "MOQ"),
            leadTime: field(offer, "交期"),
            specs: field(offer, "规格参数"),
            packaging: field(offer, "包装信息"),
            sampleStatus: field(offer, "样品情况"),
            channelFit: field(offer, "适合渠道"),
            advantages: field(offer, "优势说明"),
            risks: field(offer, "风险或疑点"),
            notes: field(offer, "备注")
          }
        ]
      : [],
    productKnowledge: [],
    tasks: taskTitle
      ? [
          {
            title: taskTitle,
            dueText: field(task, "截止时间"),
            priority: parsePriority(field(task, "优先级")),
            type: parseTaskType(field(task, "类型"))
          }
        ]
      : [],
    knowledgeCards: knowledgeBlocks.map((block) => ({
      title: field(block, "知识名称") || field(block, "标题") || "未命名知识卡",
      source: field(block, "来源"),
      summary: field(block, "核心观点") || field(block, "摘要"),
      applicableScenarios: splitList(field(block, "适用场景")),
      steps: splitList(field(block, "操作步骤")),
      scripts: splitList(field(block, "参考话术")),
      risks: splitList(field(block, "风险提醒") || field(block, "不适用场景")),
      tags: splitList(field(block, "关联标签") || field(block, "标签"))
    })),
    uncertaintyNotes: splitList(uncertainty || field(uncertainty, "不确定项"))
  });
}

function parseWorkbookQuoteText(rawText: string): DraftExtraction | null {
  if (!rawText.includes("【文件】") || !rawText.includes("采购报价单")) return null;

  const supplierName = looseField(rawText, ["供应商", "供应商名称"]);
  const productUrl = looseField(rawText, ["商品链接", "店铺链接"]);
  const title = looseField(rawText, ["商品标题"]);
  const offerName = extractOfferName(rawText);
  if (!supplierName || !offerName) return null;

  const material = looseField(rawText, ["材质"]);
  const bubbleSpec = looseField(rawText, ["气泡规格"]);
  const structureType = looseField(rawText, ["结构类型"]);
  const skuTable = extractSkuTable(rawText);
  const service = looseField(rawText, ["保障服务"]);
  const freight = looseField(rawText, ["运费说明"]);
  const note = looseField(rawText, ["备注"]);
  const quantityPrices = extractQuantityPrices(rawText);
  const normalizedPrices = normalizeSkuPrices(skuTable.rows);
  const supplierNotes = [looseField(rawText, ["入驻年限"]), looseField(rawText, ["厂房规模"])].filter(Boolean).join("；");
  const advantages = [looseField(rawText, ["近90天销量"]), looseField(rawText, ["定制服务"])].filter(Boolean).join("；");

  return {
    supplier: {
      name: supplierName,
      categories: title ? [title] : [],
      location: looseField(rawText, ["发货地址"]),
      storeUrl: productUrl,
      sourcePlatform: productUrl?.includes("1688.com") ? "1688" : undefined,
      supplierType: rawText.includes("实体工厂") ? "factory" : "unknown",
      riskTags: note ? ["运费口径需确认", "报价有效期需确认"] : [],
      notes: supplierNotes || undefined
    },
    communication: {
      summary: `从文件导入报价单：${offerName}`,
      promises: splitPipeList(service),
      questions: freight && note ? ["运费说明与实际到手价口径需要确认"] : [],
      risks: note ? [note] : [],
      nextActions: ["确认实际收货地址运费", "确认最终到手价", "确认是否含税开票"]
    },
    offers: [
      {
        name: offerName,
        category: inferOfferCategory(title || offerName),
        productUrl,
        quotedPrice: quantityPrices,
        priceDetails: skuTable.text,
        comparisonBasis: normalizedPrices ? "卷材优先按元/㎡折算；无法计算面积的定制项保留原报价。" : undefined,
        normalizedPriceDetails: normalizedPrices,
        pricingUnit: quantityPrices ? "元/件" : undefined,
        keySpecs: [bubbleSpec, structureType].filter(Boolean).join("；") || undefined,
        materialGrade: material,
        width: uniqueSkuValues(skuTable.rows, "width", "cm"),
        rollLength: uniqueSkuValues(skuTable.rows, "length", "M"),
        rollWeight: uniqueSkuValues(skuTable.rows, "weight", "斤"),
        freightIncluded: freight,
        moq: looseField(rawText, ["起批量"]),
        leadTime: service?.includes("48小时发货") ? "48小时发货" : undefined,
        specs: skuTable.text,
        channelFit: looseField(rawText, ["适用场景"]),
        advantages: advantages || undefined,
        risks: note,
        notes: note
      }
    ],
    productKnowledge: [],
    tasks: [
      {
        title: "确认文件报价单的最终到手价、运费和含税开票",
        priority: "high",
        type: "confirm_quote"
      }
    ],
    knowledgeCards: [],
    uncertaintyNotes: note ? [note] : []
  };
}

type SkuRow = {
  type: string;
  width?: number;
  length?: number;
  weight?: number;
  price?: number;
  price100?: number;
  price1000?: number;
  raw: string;
};

function looseField(text: string, labels: string[]) {
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    for (const label of labels) {
      const colonMatch = trimmed.match(new RegExp(`^${label}\\s*[:：]\\s*(.+)$`));
      if (colonMatch?.[1]) return colonMatch[1].trim();
      const parts = trimmed.split(/\t+/).map((part) => part.trim()).filter(Boolean);
      if (parts[0] === label && parts[1]) return parts.slice(1).join(" ").trim();
    }
  }
  return undefined;
}

function extractOfferName(text: string) {
  const line = text.split(/\r?\n/).find((item) => item.includes("采购报价单"));
  return line?.replace(/[·\s]+/g, "").trim();
}

function extractQuantityPrices(text: string) {
  const prices = text
    .split(/\r?\n/)
    .map((line) => {
      const match = line.trim().match(/^≥\s*([0-9]+)件\s+([0-9.]+)/);
      return match ? `≥${match[1]}件 ${match[2]}元/件` : undefined;
    })
    .filter(Boolean);
  return prices.length > 0 ? prices.join("；") : undefined;
}

function extractSkuTable(text: string) {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((line) => line.includes("序号\t结构类型") && line.includes("宽度"));
  if (start < 0) return { text: undefined, rows: [] as SkuRow[] };

  const tableLines = [lines[start].trim()];
  for (const line of lines.slice(start + 1)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (/^[一二三四五六七八九十]+、/.test(trimmed) || trimmed.startsWith("【工作表】")) break;
    if (/^\d+\t/.test(trimmed)) tableLines.push(trimmed);
  }

  const rows = tableLines.slice(1).map(parseSkuRow).filter((row): row is SkuRow => Boolean(row));
  return { text: tableLines.join("\n"), rows };
}

function parseSkuRow(line: string): SkuRow | undefined {
  const parts = line.split(/\t+/).map((part) => part.trim());
  if (parts.length < 2) return undefined;
  return {
    type: parts[1],
    width: toNumber(parts[2]),
    length: toNumber(parts[3]),
    weight: toNumber(parts[4]),
    price: toNumber(parts[5]),
    price100: toNumber(parts[6]),
    price1000: toNumber(parts[7]),
    raw: line
  };
}

function normalizeSkuPrices(rows: SkuRow[]) {
  const normalized = rows
    .filter((row) => row.width && row.length && row.price)
    .map((row) => {
      const area = (row.width! / 100) * row.length!;
      const base = `${row.type} ${row.width}cm×${row.length}M：${row.price}元/件=${formatNumber(row.price! / area)}元/㎡`;
      const price100 = row.price100 ? `；≥100件=${formatNumber(row.price100 / area)}元/㎡` : "";
      const price1000 = row.price1000 ? `；≥1000件=${formatNumber(row.price1000 / area)}元/㎡` : "";
      return `${base}${price100}${price1000}`;
    });
  return normalized.length > 0 ? normalized.join("\n") : undefined;
}

function uniqueSkuValues(rows: SkuRow[], key: "width" | "length" | "weight", unit: string) {
  const values = Array.from(new Set(rows.map((row) => row[key]).filter((value): value is number => typeof value === "number")));
  return values.length > 0 ? values.map((value) => `${formatNumber(value)}${unit}`).join("、") : undefined;
}

function inferOfferCategory(value: string) {
  if (value.includes("气泡膜") || value.includes("泡泡纸")) return "气泡膜 / 泡泡纸 / 快递防震包装材料";
  return undefined;
}

function splitPipeList(value?: string) {
  return value ? value.split("|").map((item) => item.trim()).filter(Boolean) : [];
}

function toNumber(value?: string) {
  if (!value) return undefined;
  const parsed = Number(value.replace(/[^\d.]/g, ""));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/g, "").replace(/\.$/, "");
}

function knowledgeSections(text: string, looksLikeKnowledgeCard: boolean) {
  const titled = [...text.matchAll(/【(?:知识卡|商业知识)】([\s\S]*?)(?=\n?【(?:知识卡|商业知识|不确定项|供应商|沟通记录|货盘|产品知识|待办)】|$)/g)].map(
    (match) => match[1].trim()
  );
  if (titled.length > 0) return splitKnowledgeBlocks(titled.join("\n\n"));
  return looksLikeKnowledgeCard ? splitKnowledgeBlocks(text) : [];
}

function splitKnowledgeBlocks(text: string) {
  const blocks = text
    .split(/(?=知识名称\s*[:：])/)
    .map((block) => block.trim())
    .filter((block) => block.includes("知识名称") || block.includes("核心观点"));
  return blocks.length > 0 ? blocks : text.trim() ? [text.trim()] : [];
}

function section(text: string, name: string) {
  const match = text.match(new RegExp(`【${name}】([\\s\\S]*?)(?=\\n?【|$)`));
  return match?.[1]?.trim() ?? "";
}

function field(text: string, label: string) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const boundary = fieldBoundaryLabels
    .filter((item) => item !== label)
    .sort((a, b) => b.length - a.length)
    .map((item) => item.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");
  const match = text.match(new RegExp(`${escaped}\\s*[:：]\\s*([\\s\\S]*?)(?=(?:\\s+(?:${boundary})\\s*[:：])|\\n\\s*【|$)`));
  const value = match?.[1]?.trim();
  if (!value || ["无", "无。", "未知", "未提及", "待确认"].includes(value)) return undefined;
  return value.replace(/\n{3,}/g, "\n\n");
}

const fieldBoundaryLabels = [
  "供应商名称",
  "主营产品",
  "地区",
  "店铺链接",
  "来源平台",
  "联系方式",
  "工厂/贸易商/未知",
  "联系人/联系方式",
  "配合度",
  "风险标签",
  "备注",
  "沟通摘要",
  "报价变化",
  "供应商承诺",
  "疑点",
  "风险点",
  "下一步动作",
  "货盘名称",
  "产品品类",
  "商品链接",
  "资料链接",
  "报价明细",
  "未税单价",
  "未税版费",
  "含税单价",
  "含税版费",
  "开票/运费",
  "报价",
  "统一比价口径",
  "折算单价",
  "尺寸",
  "计价单位",
  "包装单位",
  "关键规格",
  "材质等级",
  "宽度",
  "卷长",
  "克重选项",
  "单卷重量",
  "是否含运费",
  "调价规则",
  "MOQ",
  "交期",
  "规格参数",
  "包装信息",
  "样品情况",
  "适合渠道",
  "优势说明",
  "风险或疑点",
  "产品/品类名称",
  "产品名称",
  "原材料",
  "工艺流程",
  "成本构成",
  "关键参数",
  "质量风险",
  "常见坑点",
  "替代方案",
  "判断",
  "待办事项",
  "截止时间",
  "优先级",
  "类型",
  "知识名称",
  "标题",
  "来源",
  "核心观点",
  "摘要",
  "适用场景",
  "操作步骤",
  "参考话术",
  "风险提醒",
  "不适用场景",
  "关联标签",
  "标签"
];

function splitList(value?: string) {
  if (!value) return [];
  return value
    .split(/[、,，；;。\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseSupplierType(value?: string) {
  if (value?.includes("工厂")) return "factory" as const;
  if (value?.includes("贸易")) return "trader" as const;
  return "unknown" as const;
}

function parsePriority(value?: string) {
  if (value?.includes("高")) return "high" as const;
  if (value?.includes("低")) return "low" as const;
  return "medium" as const;
}

function parseTaskType(value?: string) {
  if (value?.includes("样品")) return "follow_sample" as const;
  if (value?.includes("MOQ")) return "confirm_moq" as const;
  if (value?.includes("交期")) return "confirm_lead_time" as const;
  if (value?.includes("产品知识")) return "supplement_product_knowledge" as const;
  if (value?.includes("复盘")) return "review_supplier" as const;
  if (value?.includes("报价")) return "confirm_quote" as const;
  return "follow_up" as const;
}

function matchFirst(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[2]) return match[2].trim();
    if (match?.[1]) return match[1].trim();
  }
  return undefined;
}

/* ---------- 对比表格解析 ---------- */
/* 支持 Excel 粘贴的制表符分隔对比表，例如：
 * 品名\t域德（5丝）\t华韶（5丝）\t聚赢（4丝）
 * 保护膜30-10 (小纸管)\t0.61\t\t0.65
 * 保护膜45-10 (小纸管)\t0.72\t0.75\t0.78
 */

function parseComparisonTable(rawText: string, sourceUrl?: string): DraftExtraction | null {
  const lines = rawText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 3) return null;

  // 尝试用制表符分割，也兼容多个空格
  const splitLine = (line: string) => line.split(/\t+|\s{2,}/).map((cell) => cell.trim()).filter(Boolean);

  const headerCells = splitLine(lines[0]);
  if (headerCells.length < 3) return null;

  // 第一列应该是品名/产品名/规格等
  const firstColHeader = headerCells[0];
  if (!/(?:品名|产品|规格|名称|型号|商品)/.test(firstColHeader) && !/(?:保护膜|贴|膜|纸|袋|盒)/.test(firstColHeader)) {
    // 如果第一列不是品名类，也尝试看看第二行是否像产品名
    if (!/(?:保护膜|贴|膜|纸|袋|盒|标|胶)/.test(lines[1])) return null;
  }

  // 提取供应商名称（从第2列开始），去掉括号里的规格说明
  const supplierColumns = headerCells.slice(1).map((header) => {
    // "域德（5丝）" → 供应商名 "域德", 规格备注 "5丝"
    const nameMatch = header.match(/^([^\s（(]+)/);
    const specMatch = header.match(/[（(]([^）)]+)[）)]/);
    return {
      name: nameMatch ? nameMatch[1].trim() : header,
      specNote: specMatch ? specMatch[1].trim() : undefined,
      header
    };
  });

  // 至少要有2个供应商列才算对比表
  if (supplierColumns.length < 2) return null;

  // 解析数据行
  type RowData = { productName: string; prices: (string | undefined)[] };
  const dataRows: RowData[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitLine(lines[i]);
    if (cells.length < 2) continue;
    // 第一列是品名，后面是价格
    const productName = cells[0];
    // 按 header 列数对齐价格
    const prices = headerCells.slice(1).map((_, colIndex) => cells[colIndex + 1]);
    // 至少有一个价格
    if (prices.some((p) => p && /^\d+[.\d]*$/.test(p))) {
      dataRows.push({ productName, prices });
    }
  }

  if (dataRows.length === 0) return null;

  // 推断产品类别
  const sampleProduct = dataRows[0].productName;
  let category = "未分类";
  if (/保护膜|静电|墙贴|贴膜/.test(sampleProduct)) category = "保护膜/静电墙贴";
  else if (/袋|包装/.test(sampleProduct)) category = "包装袋";
  else if (/盒/.test(sampleProduct)) category = "包装盒";
  else if (/胶|胶带/.test(sampleProduct)) category = "胶带/胶粘制品";

  // 为每个供应商生成一个货盘
  const offers = supplierColumns.map((col) => {
    const supplierPrices = dataRows
      .map((row) => {
        const priceIndex = supplierColumns.indexOf(col);
        const price = row.prices[priceIndex];
        return price ? `${row.productName}：${price}元` : null;
      })
      .filter(Boolean);

    return {
      name: `${col.name} - ${category}`,
      category,
      productUrl: sourceUrl,
      quotedPrice: supplierPrices.length > 0 ? supplierPrices.join("；") : undefined,
      priceDetails: supplierPrices.length > 0
        ? dataRows.map((row) => {
            const priceIndex = supplierColumns.indexOf(col);
            const price = row.prices[priceIndex];
            return `${row.productName}\t${price || "—"}`;
          }).join("\n")
        : undefined,
      keySpecs: col.specNote,
      materialGrade: col.specNote,
      notes: col.specNote ? `供应商规格：${col.specNote}` : undefined
    };
  });

  // 为每个供应商生成供应商条目（只取名称，不重复）
  const uniqueSuppliers = Array.from(new Set(supplierColumns.map((s) => s.name)));
  const supplier = uniqueSuppliers.length > 0
    ? {
        name: uniqueSuppliers[0],
        sourceUrl,
        categories: [category],
        supplierType: "unknown" as const,
        riskTags: [],
        notes: uniqueSuppliers.length > 1 ? `对比供应商：${uniqueSuppliers.join("、")}` : undefined
      }
    : undefined;

  return {
    supplier,
    communication: {
      summary: `${category}供应商报价对比，共 ${uniqueSuppliers.length} 家供应商、${dataRows.length} 个规格。${rawText.includes("含运含税") ? "报价含运含税。" : ""}${rawText.includes("专票") ? "可开专票。" : ""}`,
      promises: rawText.includes("含运含税") ? ["报价含运含税"] : [],
      questions: [],
      risks: [],
      nextActions: ["确认各供应商 MOQ 和交期", "对比各规格最优价格", "确认样品情况"]
    },
    offers,
    productKnowledge: [],
    tasks: [
      {
        title: `对比${category}的${uniqueSuppliers.length}家供应商报价，确认最优供应商`,
        priority: "high",
        type: "confirm_quote"
      }
    ],
    knowledgeCards: [],
    uncertaintyNotes: [
      "对比表格自动解析，各供应商的 MOQ、交期、样品情况需人工补充。",
      ...(rawText.includes("含运含税") ? [] : ["运费和开票情况未明确，需确认。"])
    ]
  };
}
