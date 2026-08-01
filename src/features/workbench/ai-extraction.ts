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

  const quoteSheet = parseSingleSupplierQuoteSheet(rawText, sourceUrl);
  if (quoteSheet) {
    return DraftExtractionSchema.parse({
      ...quoteSheet,
      uncertaintyNotes: [
        ...quoteSheet.uncertaintyNotes,
        reason === "missing_key" ? "未配置 API，当前解析的是报价单表格文本。" : "AI API 未完成整理，当前解析的是报价单表格文本。"
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

  const ocrTable = parseOcrTable(rawText, sourceUrl);
  if (ocrTable) {
    return DraftExtractionSchema.parse({
      ...ocrTable,
      uncertaintyNotes: [
        ...ocrTable.uncertaintyNotes,
        reason === "missing_key" ? "未配置 API，当前解析的是 OCR 识别后的表格文本。" : "AI API 未完成整理，当前解析的是 OCR 识别后的表格文本。"
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
      ? [{ ...inlineBrief.offer, supplierName: resolvedSupplierName }]
      : plainQuote?.offers?.length
      ? plainQuote.offers.map((o) => ({ ...o, supplierName: o.supplierName ?? resolvedSupplierName }))
      : resolvedPriceDetails || moq || leadTime || plainQuote?.offerName
        ? [
            {
              name: resolvedOfferName,
              supplierName: resolvedSupplierName,
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
        supplierName: undefined as string | undefined,
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
        notes: note,
        skus: [],
        skuCount: 0
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

/* ---------- 单供应商报价单解析器 ---------- */
/* 处理"名称 | 规格 | 单价 | 单价（含税）"格式的报价单
   特点：单供应商、多产品、多规格，含未税和含税两列价格
   兼容：合并单元格（产品名只在首行出现）、OCR单空格分隔、制表符分隔 */

function parseSingleSupplierQuoteSheet(rawText: string, sourceUrl?: string): DraftExtraction | null {
  const lines = rawText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 4) return null;

  // 智能分割：制表符优先，其次2+空格，最后单空格
  const splitLine = (line: string): string[] => {
    if (line.includes("\t")) {
      return line.split(/\t+/).map((c) => c.trim()).filter(Boolean);
    }
    const twoSpace = line.split(/\s{2,}/).map((c) => c.trim()).filter(Boolean);
    if (twoSpace.length >= 3) return twoSpace;
    // 单空格分割：确保最后一列是数字
    const oneSpace = line.split(/\s+/).map((c) => c.trim()).filter(Boolean);
    return oneSpace;
  };

  // 寻找表头行：包含"名称/品名" + "规格" + "单价"
  let headerLineIndex = -1;
  let headerCells: string[] = [];
  for (let i = 0; i < Math.min(lines.length, 5); i++) {
    const cells = splitLine(lines[i]);
    const joined = cells.join(" ");
    if (/(?:名称|品名|产品名|商品名)/.test(joined) && /规格/.test(joined) && /单价/.test(joined)) {
      headerLineIndex = i;
      headerCells = cells;
      break;
    }
    // 也匹配没有"名称"但有"规格"+"单价"的情况
    if (/规格/.test(joined) && /单价/.test(joined) && /含税/.test(joined)) {
      headerLineIndex = i;
      headerCells = cells;
      break;
    }
  }

  // 如果没找到明确表头，尝试检测第一行是否像表头
  if (headerLineIndex < 0) {
    const firstCells = splitLine(lines[0]);
    if (firstCells.length >= 3 && /(?:名称|品名|规格|单价)/.test(firstCells.join(" "))) {
      headerLineIndex = 0;
      headerCells = firstCells;
    }
  }

  if (headerLineIndex < 0) return null;

  // 确定列索引：名称列、规格列、单价列、含税单价列
  let nameColIdx = -1;
  let specColIdx = -1;
  let priceColIdx = -1;
  let taxedPriceColIdx = -1;

  for (let i = 0; i < headerCells.length; i++) {
    const h = headerCells[i];
    if (/(?:名称|品名|产品名|商品名)/.test(h) && nameColIdx < 0) {
      nameColIdx = i;
    } else if (/规格/.test(h) && specColIdx < 0) {
      specColIdx = i;
    } else if (/含税/.test(h) && /单价|价格/.test(h) && taxedPriceColIdx < 0) {
      taxedPriceColIdx = i;
    } else if (/(?:单价|价格)/.test(h) && priceColIdx < 0) {
      priceColIdx = i;
    }
  }

  // 必须有规格列和至少一个价格列
  if (specColIdx < 0 || (priceColIdx < 0 && taxedPriceColIdx < 0)) return null;

  // 如果没有明确的名称列，默认第0列为名称
  if (nameColIdx < 0) nameColIdx = 0;

  // 解析数据行
  type ParsedRow = {
    productName: string;
    spec: string;
    unitPrice?: number;
    unitPriceStr?: string;
    taxedPrice?: number;
    taxedPriceStr?: string;
  };
  const dataRows: ParsedRow[] = [];
  let lastProductName = "";

  for (let i = headerLineIndex + 1; i < lines.length; i++) {
    let cells = splitLine(lines[i]);
    if (cells.length < 2) continue;

    // 跳过描述性文字行（非表格数据）
    const firstCell = cells[0] || "";
    // 如果第一列包含报价单/需要整理等描述文字，停止解析表格
    if (/报价单|需要整理|单价含|供应商|厂家/.test(firstCell) && cells.length < 3) break;

    // 合并单元格处理：如果行列数比表头少1，且第一列像规格（数字开头），说明名称列缺失
    const headerColCount = headerCells.length;
    if (cells.length === headerColCount - 1 && /^\d/.test(cells[0])) {
      // 在开头插入空字符串，模拟缺失的名称列
      cells = ["", ...cells];
    }

    // 提取产品名：如果名称列有内容则用之，否则继承上一行（合并单元格向下填充）
    let productName = cells[nameColIdx] || "";
    // 判断该格是否是产品名（而非规格或数字）
    if (productName && !/^\d/.test(productName) && !/^\d+\*\d+/.test(productName)) {
      lastProductName = productName;
    } else {
      productName = lastProductName;
    }

    // 提取规格
    let spec = cells[specColIdx] || "";

    // 规格应该像 "30*80*5" 或 "40-1" 这样的格式
    // 如果spec不像规格，跳过这行
    if (!spec || !/\d/.test(spec)) continue;

    // 提取价格
    let unitPrice: number | undefined;
    let unitPriceStr: string | undefined;
    let taxedPrice: number | undefined;
    let taxedPriceStr: string | undefined;

    if (priceColIdx >= 0 && cells[priceColIdx]) {
      const p = parseFloat(cells[priceColIdx]);
      if (!isNaN(p)) {
        unitPrice = p;
        unitPriceStr = `${cells[priceColIdx]}元`;
      }
    }
    if (taxedPriceColIdx >= 0 && cells[taxedPriceColIdx]) {
      const p = parseFloat(cells[taxedPriceColIdx]);
      if (!isNaN(p)) {
        taxedPrice = p;
        taxedPriceStr = `${cells[taxedPriceColIdx]}元`;
      }
    }

    // 如果没有明确的价格列索引，尝试从末尾列提取数字
    if (unitPrice == null && taxedPrice == null) {
      // 找最后两列数字
      const numCells = cells.map((c, idx) => ({ idx, val: parseFloat(c), raw: c }))
        .filter((c) => !isNaN(c.val) && /^\d+[.\d]*$/.test(c.raw));
      if (numCells.length >= 2) {
        // 倒数第二个是未税，最后一个是含税
        unitPrice = numCells[numCells.length - 2].val;
        unitPriceStr = `${numCells[numCells.length - 2].raw}元`;
        taxedPrice = numCells[numCells.length - 1].val;
        taxedPriceStr = `${numCells[numCells.length - 1].raw}元`;
      } else if (numCells.length === 1) {
        unitPrice = numCells[0].val;
        unitPriceStr = `${numCells[0].raw}元`;
      }
    }

    if (unitPrice == null && taxedPrice == null) continue;

    dataRows.push({ productName, spec, unitPrice, unitPriceStr, taxedPrice, taxedPriceStr });
  }

  if (dataRows.length === 0) return null;

  // 从描述文字提取补充信息（供应商名等）
  const descInfo = extractDescriptionInfo(rawText);
  const supplierName = descInfo.supplierName;

  // 按产品名分组
  const productGroups = new Map<string, ParsedRow[]>();
  for (const row of dataRows) {
    const name = row.productName || "未命名产品";
    if (!productGroups.has(name)) {
      productGroups.set(name, []);
    }
    productGroups.get(name)!.push(row);
  }

  const now = new Date().toISOString().split("T")[0];

  // 为每个产品生成一个货盘
  const offers = Array.from(productGroups.entries()).map(([productName, rows]) => {
    const skus = rows.map((row) => {
      const specName = row.spec;
      return {
        specName,
        specCode: extractSpecCode(specName) || undefined,
        width: extractDimensionsFromSpec(specName),
        thickness: extractThicknessFromSpec(specName),
        unitPrice: row.unitPrice ?? row.taxedPrice,
        unitPriceStr: row.unitPriceStr ?? row.taxedPriceStr,
        pricingUnit: "元",
        moq: undefined,
        notes: row.taxedPrice != null && row.unitPrice != null
          ? `含税价：${row.taxedPriceStr}`
          : undefined,
        priceHistory: [{ date: now, price: row.unitPrice ?? row.taxedPrice!, source: "报价单导入" }]
      };
    });

    const validPrices = skus.map((s) => s.unitPrice!).filter((p) => !isNaN(p));
    const minPrice = validPrices.length > 0 ? Math.min(...validPrices) : undefined;
    const maxPrice = validPrices.length > 0 ? Math.max(...validPrices) : undefined;
    const category = descInfo.category || inferCategoryFromProduct(productName);

    return {
      name: `${productName}`,
      supplierName,
      category,
      productUrl: sourceUrl || descInfo.sourceUrl,
      quotedPrice: validPrices.length > 0 ? `¥${minPrice?.toFixed(2)} - ¥${maxPrice?.toFixed(2)}` : undefined,
      priceDetails: rows.map((r) => `${r.spec}\t${r.unitPriceStr ?? "—"}\t${r.taxedPriceStr ?? "—"}`).join("\n"),
      skus,
      skuCount: skus.length,
      minPrice,
      maxPrice,
      untaxedUnitPrice: rows[0]?.unitPriceStr,
      taxedUnitPrice: rows[0]?.taxedPriceStr,
      taxFreightTerms: descInfo.freightTax ? "单价含税运" : undefined,
      keySpecs: rows.map((r) => r.spec).join("、"),
      dimensions: rows[0]?.spec,
      freightIncluded: descInfo.freightTax ? "单价含税运" : descInfo.freeShipping ? "包邮" : undefined,
      moq: descInfo.moq,
      leadTime: descInfo.leadTime,
      notes: [
        `共 ${skus.length} 个规格`,
        descInfo.thickness ? `产品厚度：${descInfo.thickness}` : undefined
      ].filter(Boolean).join("；") || undefined
    };
  });

  const allPrices = dataRows.map((r) => r.unitPrice ?? r.taxedPrice).filter((p): p is number => p != null && !isNaN(p));
  const productNames = Array.from(productGroups.keys());

  const supplier = supplierName
    ? {
        name: supplierName,
        sourceUrl: sourceUrl || descInfo.sourceUrl,
        categories: productNames.length > 0 ? [inferCategoryFromProduct(productNames[0])] : [],
        supplierType: "unknown" as const,
        riskTags: [],
        notes: `报价产品：${productNames.join("、")}`
      }
    : undefined;

  return {
    supplier,
    communication: {
      summary: supplierName
        ? `${supplierName} 报价单，共 ${productNames.length} 个产品、${dataRows.length} 个规格。${descInfo.freightTax ? "报价含税运。" : ""}`
        : `报价单，共 ${productNames.length} 个产品、${dataRows.length} 个规格。${descInfo.freightTax ? "报价含税运。" : ""}请补充供应商名称。`,
      promises: descInfo.freightTax ? ["报价含税运"] : descInfo.freeShipping ? ["包邮"] : [],
      questions: [],
      risks: [],
      nextActions: ["确认 MOQ 和交期", "确认样品情况", "核对各规格价格"]
    },
    offers,
    productKnowledge: [],
    tasks: [
      {
        title: supplierName
          ? `整理${supplierName}报价单，确认 MOQ 和交期`
          : `整理报价单，确认供应商名称、MOQ 和交期`,
        priority: "high",
        type: "confirm_quote"
      }
    ],
    knowledgeCards: [],
    uncertaintyNotes: [
      "报价单表格自动解析，供应商名称、MOQ、交期、样品情况需人工确认。",
      ...(supplierName ? [] : ["未识别到供应商名称，请在录入时补充说明。"]),
      ...(descInfo.freightTax || descInfo.freeShipping ? [] : ["运费和开票情况未明确，需确认。"])
    ]
  };
}

/** 从规格中提取尺寸信息，如 "30*80*5" → "30cm" */
function extractDimensionsFromSpec(spec: string): string | undefined {
  const match = spec.match(/(\d+)\s*[*×xX]\s*(\d+)\s*[*×xX]?\s*(\d+)?/);
  if (match) {
    return `${match[1]}×${match[2]}${match[3] ? `×${match[3]}` : ""}`;
  }
  return undefined;
}

/** 从规格中提取厚度，如 "30*80*5" → "5丝" */
function extractThicknessFromSpec(spec: string): string | undefined {
  const match = spec.match(/\d+\s*[*×xX]\s*\d+\s*[*×xX]\s*(\d+)/);
  if (match) {
    return `${match[1]}丝`;
  }
  // 也支持 "保护膜40-1" 中的 "1"
  const dashMatch = spec.match(/-(\d+)/);
  if (dashMatch) return `${dashMatch[1]}丝`;
  return undefined;
}

function parseComparisonTable(rawText: string, sourceUrl?: string): DraftExtraction | null {
  const lines = rawText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 3) return null;

  // 尝试用制表符分割，也兼容多个空格
  const splitLine = (line: string) => line.split(/\t+|\s{2,}/).map((cell) => cell.trim()).filter(Boolean);

  // 找到表格的结束位置（描述文字开始前）
  let tableEndIndex = lines.length;
  for (let i = 0; i < lines.length; i++) {
    if (/报价单|需要整理|单价含/.test(lines[i]) && !/\t/.test(lines[i]) && splitLine(lines[i]).length < 3) {
      tableEndIndex = i;
      break;
    }
  }
  const tableLines = lines.slice(0, tableEndIndex);
  if (tableLines.length < 3) return null;

  // 从表格后面的描述文字中提取额外信息
  const descLines = lines.slice(tableEndIndex);
  const descText = descLines.join(" ");
  const descInfo = extractDescriptionInfo(descText);

  const headerCells = splitLine(tableLines[0]);
  // 支持单列供应商（品名 + 供应商），也支持多列对比
  if (headerCells.length < 2) return null;

  // 第一列应该是品名/产品名/规格等
  const firstColHeader = headerCells[0];
  if (!/(?:品名|产品|规格|名称|型号|商品)/.test(firstColHeader) && !/(?:保护膜|贴|膜|纸|袋|盒)/.test(firstColHeader)) {
    // 如果第一列不是品名类，也尝试看看第二行是否像产品名
    if (tableLines.length < 2 || !/(?:保护膜|贴|膜|纸|袋|盒|标|胶)/.test(tableLines[1])) return null;
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

  // 支持单供应商（>=1 列）
  if (supplierColumns.length < 1) return null;

  // 解析数据行
  type RowData = { productName: string; prices: (string | undefined)[] };
  const dataRows: RowData[] = [];
  for (let i = 1; i < tableLines.length; i++) {
    const cells = splitLine(tableLines[i]);
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
  const category = descInfo.category || inferCategoryFromProduct(dataRows[0].productName);

  // 产品名称优先从描述文字提取，清理末尾的"报价单"
  const productName = descInfo.productName || category;
  const thickness = descInfo.thickness;
  const now = new Date().toISOString().split("T")[0];

  // 为每个供应商生成一个货盘（含结构化SKU）
  const offers = supplierColumns.map((col) => {
    const colIndex = supplierColumns.indexOf(col);
    const skus = dataRows
      .map((row) => {
        const priceStr = row.prices[colIndex];
        if (!priceStr) return null;
        const priceNum = parseFloat(priceStr);
        if (isNaN(priceNum)) return null;
        const specName = row.productName;
        const specCode = extractSpecCode(specName);
        return {
          specName,
          specCode: specCode || undefined,
          width: extractWidthFromSpec(specName),
          thickness: thickness || col.specNote,
          unitPrice: priceNum,
          unitPriceStr: `${priceStr}元`,
          pricingUnit: "元",
          moq: undefined,
          notes: undefined,
          priceHistory: [{ date: now, price: priceNum, source: "报价单导入" }]
        };
      })
      .filter((sku): sku is NonNullable<typeof sku> => sku !== null);

    const validPrices = skus.map((s) => s.unitPrice!);
    const minPrice = validPrices.length > 0 ? Math.min(...validPrices) : undefined;
    const maxPrice = validPrices.length > 0 ? Math.max(...validPrices) : undefined;

    return {
      name: supplierColumns.length === 1 ? `${productName} - ${col.name}` : `${col.name} - ${category}`,
      supplierName: col.name,
      category,
      productUrl: sourceUrl || descInfo.sourceUrl,
      quotedPrice: skus.length > 0 ? `¥${minPrice?.toFixed(2)} - ¥${maxPrice?.toFixed(2)}` : undefined,
      priceDetails: skus.length > 0
        ? dataRows.map((row) => {
            const price = row.prices[colIndex];
            return `${row.productName}\t${price || "—"}`;
          }).join("\n")
        : undefined,
      skus,
      skuCount: skus.length,
      minPrice,
      maxPrice,
      keySpecs: [col.specNote, thickness].filter(Boolean).join("；") || undefined,
      materialGrade: col.specNote,
      freightIncluded: descInfo.freightTax ? "单价含税运" : descInfo.freeShipping ? "包邮" : undefined,
      moq: descInfo.moq,
      leadTime: descInfo.leadTime,
      notes: [col.specNote ? `供应商规格：${col.specNote}` : undefined, thickness ? `产品厚度：${thickness}` : undefined].filter(Boolean).join("；") || undefined
    };
  });

  // 为每个供应商生成供应商条目（只取名称，不重复）
  const uniqueSuppliers = Array.from(new Set(supplierColumns.map((s) => s.name)));
  // 优先使用描述文字中提取的供应商名
  const resolvedSupplierName = descInfo.supplierName || uniqueSuppliers[0];
  const supplier = resolvedSupplierName
    ? {
        name: resolvedSupplierName,
        sourceUrl: sourceUrl || descInfo.sourceUrl,
        categories: [category],
        supplierType: "unknown" as const,
        riskTags: [],
        notes: uniqueSuppliers.length > 1 ? `对比供应商：${uniqueSuppliers.join("、")}` : undefined
      }
    : undefined;

  const isSingleSupplier = supplierColumns.length === 1;

  return {
    supplier,
    communication: {
      summary: isSingleSupplier
        ? `${resolvedSupplierName} ${productName}报价单，共 ${dataRows.length} 个规格。${descInfo.freightTax ? "报价含税运。" : ""}${rawText.includes("专票") ? "可开专票。" : ""}`
        : `${category}供应商报价对比，共 ${uniqueSuppliers.length} 家供应商、${dataRows.length} 个规格。${descInfo.freightTax ? "报价含税运。" : ""}${rawText.includes("专票") ? "可开专票。" : ""}`,
      promises: descInfo.freightTax ? ["报价含税运"] : descInfo.freeShipping ? ["包邮"] : [],
      questions: [],
      risks: [],
      nextActions: isSingleSupplier
        ? ["确认 MOQ 和交期", "确认样品情况", "核对各规格价格"]
        : ["确认各供应商 MOQ 和交期", "对比各规格最优价格", "确认样品情况"]
    },
    offers,
    productKnowledge: [],
    tasks: [
      {
        title: isSingleSupplier
          ? `整理${resolvedSupplierName} ${productName}报价，确认 MOQ 和交期`
          : `对比${category}的${uniqueSuppliers.length}家供应商报价，确认最优供应商`,
        priority: "high",
        type: "confirm_quote"
      }
    ],
    knowledgeCards: [],
    uncertaintyNotes: [
      isSingleSupplier ? "单供应商报价表自动解析，MOQ、交期、样品情况需人工补充。" : "对比表格自动解析，各供应商的 MOQ、交期、样品情况需人工补充。",
      ...(descInfo.freightTax || descInfo.freeShipping ? [] : ["运费和开票情况未明确，需确认。"])
    ]
  };
}

/* ---------- 通用描述信息提取器 ---------- */
/* 从任何输入文本中提取供应商、产品、规格等补充信息 */

type DescInfo = {
  supplierName?: string;
  productName?: string;
  category?: string;
  thickness?: string;
  freightTax?: boolean;
  freeShipping?: boolean;
  moq?: string;
  leadTime?: string;
  specNote?: string;
  platform?: string;
  sourceUrl?: string;
};

function extractDescriptionInfo(rawText: string): DescInfo {
  const info: DescInfo = {};

  // 供应商名称：多种常见写法
  const supplierPatterns = [
    // "温州域德/橙萤 透明静电墙贴报价单" → "温州域德/橙萤"
    /([\u4e00-\u9fa5]{2,8}(?:\/[\u4e00-\u9fa5]{2,8})?)\s+(?:透明|静电|防油|卡通|新款|断点式|撕拉线|白板)?[^，,。\n]{0,12}报价单/,
    // "这是温州域德的报价单" / "温州域德的报价单" → "温州域德"
    /(?:这是|这是供应商)?([\u4e00-\u9fa5]{2,8}(?:\/[\u4e00-\u9fa5]{2,8})?)的?报价单/,
    // "温州域德/橙萤 新款断点式白板贴报价单" → "温州域德/橙萤"
    /([\u4e00-\u9fa5]{2,4}(?:市|省)?[\u4e00-\u9fa5]{2,6}(?:\/[\u4e00-\u9fa5]{2,6})?)\s+/,
    /供应商[:：]\s*([^\n，,。]+)/,
    /厂家[:：]\s*([^\n，,。]+)/,
    /^([^\n]{2,20}?(?:有限公司|有限责任公司|包装厂|纸品厂|塑料厂|印刷厂|制品厂))/
  ];
  for (const pattern of supplierPatterns) {
    const match = rawText.match(pattern);
    if (match?.[1]) {
      info.supplierName = match[1].trim();
      break;
    }
  }

  // 产品名称：扩展更多产品类型
  const productPatterns = [
    // "新款断点式白板贴报价单" → "断点式白板贴"
    /(?:新款|老款|升级款|加强版)?((?:断点式|撕拉线|免打孔|可水洗|纳米)?(?:白板贴|白板膜|黑板贴|静电白板)[\u4e00-\u9fa5]{0,4})/,
    /((?:透明|静电|防油|卡通|无痕|强力|纳米|亚克力|撕拉线|断点式)[\u4e00-\u9fa5]{1,6}(?:墙贴|膜|贴|胶带|标识|门牌|标签|白板贴|黑板贴))/,
    /((?:保护膜|气泡膜|静电膜|防油贴|标识贴|门牌贴|卡通贴|白板贴|黑板贴|撕拉线)[\u4e00-\u9fa5]{0,4})/,
    /产品[:：]\s*([^\n，,。]+)/,
    /品名[:：]\s*([^\n，,。]+)/
  ];
  for (const pattern of productPatterns) {
    const match = rawText.match(pattern);
    if (match?.[1]) {
      info.productName = match[1].trim().replace(/报价单$/, "").trim();
      break;
    }
  }

  // 产品类别推断：扩展更多类别
  if (info.productName || rawText) {
    if (/白板贴|白板膜|黑板贴|断点式|撕拉线/.test(rawText)) info.category = "白板贴/静电白板";
    else if (/保护膜|静电|墙贴|贴膜/.test(rawText)) info.category = "保护膜/静电墙贴";
    else if (/防油贴|防油膜/.test(rawText)) info.category = "防油贴/厨房防油膜";
    else if (/袋|包装/.test(rawText)) info.category = "包装袋";
    else if (/盒/.test(rawText)) info.category = "包装盒";
    else if (/胶|胶带/.test(rawText)) info.category = "胶带/胶粘制品";
    else if (/门牌|标识|标牌/.test(rawText)) info.category = "门牌/标识/标牌";
    else if (/卡通|贴纸/.test(rawText)) info.category = "卡通贴纸/装饰贴";
  }

  // 厚度/规格
  const thicknessMatch = rawText.match(/厚度\s*[:：]?\s*(\d+\s*(?:丝|mm|厘米|μm|微米|g|克))/)
    ?? rawText.match(/(\d+\s*(?:丝|mm|厘米|μm|微米))\s*(?:厚度|厚)/);
  if (thicknessMatch) info.thickness = thicknessMatch[1].trim();

  // 规格备注（如"小纸管"）
  const specMatch = rawText.match(/[（(]([^）)]+(?:丝|mm|微米|g|克|小纸管|大纸管))\s*[）)]/);
  if (specMatch) info.specNote = specMatch[1].trim();

  // 含税运
  info.freightTax = /单价含?税运|含运含税|含税含运|含税运/.test(rawText);
  info.freeShipping = /包邮|包运费|免运费/.test(rawText);

  // MOQ
  const moqMatch = rawText.match(/(?:MOQ|起订量|起订|最少|最低)\s*[:：]?\s*(\d+[^\n，,。]*)/i);
  if (moqMatch) info.moq = moqMatch[1].trim();

  // 交期
  const leadMatch = rawText.match(/(?:交期|周期|发货时间)\s*[:：]?\s*(\d+\s*(?:天|个工作日|工作日))/);
  if (leadMatch) info.leadTime = leadMatch[1].trim();

  // 来源平台
  if (/1688\.com/.test(rawText)) info.platform = "1688";
  else if (/taobao\.com/.test(rawText)) info.platform = "淘宝";
  else if (/pdd\.com|pinduoduo/.test(rawText)) info.platform = "拼多多";

  // 链接
  const urlMatch = rawText.match(/https?:\/\/[^\s，,。]+/);
  if (urlMatch) info.sourceUrl = urlMatch[0];

  return info;
}

/* ---------- 智能表格结构检测 ---------- */
/* 尝试多种分割策略，找到最合理的列结构 */

type TableStructure = {
  splitFn: (line: string) => string[];
  dataLines: string[];
  headerCells: string[];
  hasHeader: boolean;
};

function detectTableStructure(lines: string[]): TableStructure | null {
  // 策略1: 2+空格分割
  const split2Plus = (line: string) => line.split(/\s{2,}/).map((c) => c.trim()).filter(Boolean);
  const struct2Plus = tryStructure(lines, split2Plus);
  if (struct2Plus) return struct2Plus;

  // 策略2: 单个空格分割（验证最后一列是数字价格）
  const split1Space = (line: string) => line.split(/\s+/).map((c) => c.trim()).filter(Boolean);
  const struct1Space = tryStructure(lines, split1Space, true);
  if (struct1Space) return struct1Space;

  return null;
}

function tryStructure(
  lines: string[],
  splitFn: (line: string) => string[],
  validatePrice = false
): TableStructure | null {
  // 计算每行的列数，找众数
  const colCounts = lines.map((line) => splitFn(line).length);
  const colCountFreq: Record<number, number> = {};
  for (const count of colCounts) {
    colCountFreq[count] = (colCountFreq[count] || 0) + 1;
  }
  const maxFreq = Math.max(...Object.values(colCountFreq));
  const commonColCount = Number(Object.entries(colCountFreq).find(([, freq]) => freq === maxFreq)?.[0]);

  // 至少需要2列（品名+价格），且至少3行数据
  if (!commonColCount || commonColCount < 2) return null;

  let dataLines = lines.filter((line) => splitFn(line).length === commonColCount);
  if (dataLines.length < 3) return null;

  // 如果启用价格验证，检查最后一列是否为数字（排除表头行）
  if (validatePrice) {
    const priceValidRows = dataLines.filter((line) => {
      const cells = splitFn(line);
      const lastCell = cells[cells.length - 1];
      // 表头行通常不以数字结尾，跳过
      if (/品名|产品|规格|名称|型号/.test(cells[0])) return true;
      return /^\d+[.\d]*$/.test(lastCell);
    });
    // 至少一半的行满足价格验证
    if (priceValidRows.length < dataLines.length * 0.5) return null;
  }

  // 判断第一行是否是表头
  const firstLine = dataLines[0];
  const firstCells = splitFn(firstLine);
  const hasHeader = /(?:品名|产品|规格|名称|型号|商品|序号)/.test(firstCells[0]);

  const headerCells = hasHeader ? firstCells : firstCells.map((_, i) => `列${i + 1}`);

  return { splitFn, dataLines, headerCells, hasHeader };
}

/* ---------- OCR/空格对齐表格解析 ---------- */
/* 处理微信截图 OCR 后的文本、PDF复制文本、单个空格分隔的表格 */

function parseOcrTable(rawText: string, sourceUrl?: string): DraftExtraction | null {
  const lines = rawText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 3) return null;

  // 检测是否像OCR文本：没有制表符
  const hasTabs = rawText.includes("\t");
  if (hasTabs) return null; // 有制表符的交给 parseComparisonTable

  // 智能分割：尝试多种策略，选择最合理的
  const tableStructure = detectTableStructure(lines);
  if (!tableStructure) return null;

  const { splitFn, dataLines, headerCells, hasHeader } = tableStructure;

  // 第一列是品名，后面是供应商/价格
  const supplierCols = headerCells.slice(1).map((header, idx) => {
    const nameMatch = header.match(/^([^\s（(]+)/);
    const specMatch = header.match(/[（(]([^）)]+)[）)]/);
    return {
      name: nameMatch ? nameMatch[1].trim() : (hasHeader ? header : `供应商${idx + 1}`),
      specNote: specMatch ? specMatch[1].trim() : undefined,
      header
    };
  });

  // 解析数据行
  type RowData = { productName: string; prices: (string | undefined)[] };
  const dataRows: RowData[] = [];
  const startRow = hasHeader ? 1 : 0;
  for (let i = startRow; i < dataLines.length; i++) {
    const cells = splitFn(dataLines[i]);
    if (cells.length < 2) continue;
    const productName = cells[0];
    const prices = supplierCols.map((_, colIdx) => cells[colIdx + 1]);
    if (prices.some((p) => p && /^\d+[.\d]*$/.test(p))) {
      dataRows.push({ productName, prices });
    }
  }

  if (dataRows.length === 0) return null;

  // 从描述文字提取补充信息
  const descInfo = extractDescriptionInfo(rawText);
  const category = descInfo.category || inferCategoryFromProduct(dataRows[0].productName);
  const productName = descInfo.productName || category;
  const isSingleSupplier = supplierCols.length === 1;
  const now = new Date().toISOString().split("T")[0];

  const offers = supplierCols.map((col) => {
    const colIndex = supplierCols.indexOf(col);
    const skus = dataRows
      .map((row) => {
        const priceStr = row.prices[colIndex];
        if (!priceStr) return null;
        const priceNum = parseFloat(priceStr);
        if (isNaN(priceNum)) return null;
        const specName = row.productName;
        const specCode = extractSpecCode(specName);
        return {
          specName,
          specCode: specCode || undefined,
          width: extractWidthFromSpec(specName),
          thickness: descInfo.thickness || col.specNote,
          unitPrice: priceNum,
          unitPriceStr: `${priceStr}元`,
          pricingUnit: "元",
          moq: undefined,
          notes: undefined,
          priceHistory: [{ date: now, price: priceNum, source: "报价单导入" }]
        };
      })
      .filter((sku): sku is NonNullable<typeof sku> => sku !== null);

    const validPrices = skus.map((s) => s.unitPrice!);
    const minPrice = validPrices.length > 0 ? Math.min(...validPrices) : undefined;
    const maxPrice = validPrices.length > 0 ? Math.max(...validPrices) : undefined;

    return {
      name: isSingleSupplier ? `${productName} - ${col.name}` : `${col.name} - ${category}`,
      supplierName: col.name,
      category,
      productUrl: sourceUrl || descInfo.sourceUrl,
      quotedPrice: skus.length > 0 ? `¥${minPrice?.toFixed(2)} - ¥${maxPrice?.toFixed(2)}` : undefined,
      priceDetails: skus.length > 0
        ? dataRows.map((row) => {
            const price = row.prices[colIndex];
            return `${row.productName}\t${price || "—"}`;
          }).join("\n")
        : undefined,
      skus,
      skuCount: skus.length,
      minPrice,
      maxPrice,
      keySpecs: [col.specNote, descInfo.thickness].filter(Boolean).join("；") || undefined,
      materialGrade: col.specNote,
      freightIncluded: descInfo.freightTax ? "单价含税运" : descInfo.freeShipping ? "包邮" : undefined,
      moq: descInfo.moq,
      leadTime: descInfo.leadTime,
      notes: [
        col.specNote ? `供应商规格：${col.specNote}` : undefined,
        descInfo.thickness ? `产品厚度：${descInfo.thickness}` : undefined
      ].filter(Boolean).join("；") || undefined
    };
  });

  const supplierName = descInfo.supplierName || supplierCols[0]?.name;
  const supplier = supplierName
    ? {
        name: supplierName,
        sourceUrl: sourceUrl || descInfo.sourceUrl,
        categories: [category],
        supplierType: "unknown" as const,
        riskTags: [],
        notes: undefined
      }
    : undefined;

  return {
    supplier,
    communication: {
      summary: isSingleSupplier
        ? `${supplierName || "某供应商"} ${productName}报价单，共 ${dataRows.length} 个规格。${descInfo.freightTax ? "报价含税运。" : ""}`
        : `${category}供应商报价对比，共 ${supplierCols.length} 家供应商、${dataRows.length} 个规格。`,
      promises: descInfo.freightTax ? ["报价含税运"] : descInfo.freeShipping ? ["包邮"] : [],
      questions: [],
      risks: [],
      nextActions: isSingleSupplier
        ? ["确认 MOQ 和交期", "确认样品情况", "核对各规格价格"]
        : ["确认各供应商 MOQ 和交期", "对比各规格最优价格", "确认样品情况"]
    },
    offers,
    productKnowledge: [],
    tasks: [
      {
        title: isSingleSupplier
          ? `整理${supplierName || ""} ${productName}报价，确认 MOQ 和交期`
          : `对比${category}的${supplierCols.length}家供应商报价，确认最优供应商`,
        priority: "high",
        type: "confirm_quote"
      }
    ],
    knowledgeCards: [],
    uncertaintyNotes: [
      isSingleSupplier ? "单供应商报价表自动解析，MOQ、交期、样品情况需人工补充。" : "对比表格自动解析，各供应商的 MOQ、交期、样品情况需人工补充。",
      ...(descInfo.freightTax || descInfo.freeShipping ? [] : ["运费和开票情况未明确，需确认。"])
    ]
  };
}

function inferCategoryFromProduct(productName: string): string {
  if (/白板|黑板|撕拉线|断点式/.test(productName)) return "白板贴/静电白板";
  if (/保护膜|静电|墙贴|贴膜/.test(productName)) return "保护膜/静电墙贴";
  if (/防油贴|防油膜/.test(productName)) return "防油贴/厨房防油膜";
  if (/袋|包装/.test(productName)) return "包装袋";
  if (/盒/.test(productName)) return "包装盒";
  if (/胶|胶带/.test(productName)) return "胶带/胶粘制品";
  if (/门牌|标识|标牌/.test(productName)) return "门牌/标识/标牌";
  if (/卡通|贴纸/.test(productName)) return "卡通贴纸/装饰贴";
  return "未分类";
}

/** 从规格名称中提取规格编码，如 "保护膜40-1（小纸管）" → "40-1" */
function extractSpecCode(specName: string): string | null {
  const match = specName.match(/(\d+-\d+)/);
  return match ? match[1] : null;
}

/** 从规格名称中提取宽度，如 "保护膜40-1" → "40cm" */
function extractWidthFromSpec(specName: string): string | undefined {
  const match = specName.match(/(\d+)\s*(?:-\d+)?/);
  return match ? `${match[1]}cm` : undefined;
}
