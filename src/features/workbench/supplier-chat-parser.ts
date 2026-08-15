// 供应商聊天记录本地正则解析器
// 目标：把每月复制的企微/钉钉/微信聊天记录，拆成订单/质量/服务事件草稿，供人工复核后写入 QCDS 评估
// 设计原则：宁可漏报（标在 uncertaintyNotes 里）也不瞎猜；每条结果保留 sourceLineText 方便人工对齐。

import type {
  SupplierChatExtractionDraft,
  SupplierOrderRecordDraft,
  SupplierQualityIssueDraft,
  SupplierServiceEventDraft,
  SupplierCostReductionDraft
} from "./schemas";
import { SupplierChatExtractionDraftSchema } from "./schemas";

type ParseOpts = {
  referenceDate?: string; // YYYY-MM-DD，用于解析"本周三/明天/下周一"这类相对日期
};

// ---------- 行结构 ----------
type ChatLine = {
  raw: string;
  index: number;
  timestamp?: string; // ISO-like (YYYY-MM-DD HH:mm)
  dateStr?: string;   // YYYY-MM-DD
  speaker?: string;   // 说话人名称（含括号内组织）
  text: string;       // 纯文本
  supplierNameGuess?: string; // 从 (文航家居) 提取的供应商猜测
};

// ---------- 通用正则 ----------
// 匹配开头行：`2026-07-15 10:20 王经理(文航家居): ` 或 `7/15 10:20 王经理: `
const LINE_START_RE = /^(?:(\d{4}[-\/]\d{1,2}[-\/]\d{1,2}|\d{1,2}[\/\-\.]\d{1,2})\s+)?(\d{1,2}:\d{2}(?::\d{2})?)\s+([^:：]+?)[\s]*[:：]\s*(.*)$/s;
// 括号里的供应商名："王经理(文航家居)" → 文航家居
const SUPPLIER_IN_PAREN_RE = /[(（]([^)）]{1,30})[)）]/;
// 说话人姓名清洗
const SPEAKER_STRIP_RE = /^\s*[<【「\[]?[A-Za-z0-9_\-. ]{3,}[>】」\]]?\s*/;

// 数字 + 单位（订货数量）
const QTY_RE = /(\d+(?:\.\d+)?)\s*(个|套|件|箱|pcs|Pcs|PCS|只|卷|把|条|台|kg|KG|克|吨|米|平方米|平方)/g;
// 价格抽取 "从 3.2 调到 3.5" / "¥3.2 元" / "3.2元到3.5元" / "涨价 3 毛"
const PRICE_BEFORE_AFTER_RE_1 = /(\d+(?:\.\d+)?)\s*元?\s*(调(?:到)?|涨(?:到)?|降(?:到)?|改(?:为)?|变(?:为)?|(?:—+|→|->))\s*(\d+(?:\.\d+)?)/;
const PRICE_BEFORE_AFTER_RE_2 = /(?:从|原价|之前|原来是?)[^0-9]{0,5}(\d+(?:\.\d+)?)\s*元?[^0-9]{0,10}(\d+(?:\.\d+)?)\s*元?/;
const PRICE_UP_DOWN_NUM = /(涨|降|上调|下调|提价|降价)\s*(?:了)?\s*(\d+(?:\.\d+)?)\s*(%|元|块|毛)/;

// 明确日期形式：7月24号 / 7-24 / 07-24 / 2026-07-24 / 7.24
const EXPLICIT_DATE_RE = /(?:(\d{4})\s*[-\/\.年])?\s*(\d{1,2})\s*[-\/\.月]\s*(\d{1,2})\s*(?:日|号)?/;
// 相对日期：今天/明天/后天/本周X / 下周一 / 月底 / 下周初
const RELATIVE_DATE_RE = /(今天|明天|后天|大后天|月底|下周一|下周二|下周三|下周四|下周五|下周六|下周日|下星期[一二三四五六日天]|本周一|本周二|本周三|本周四|本周五|本周六|本周日|星期[一二三四五六日天])/;

// ---------- 日期解析 ----------
function pad(n: number) { return n < 10 ? "0" + n : "" + n; }

function parseExplicitDate(match: RegExpMatchArray, yearFallback: number): string | undefined {
  const year = match[1] ? parseInt(match[1], 10) : yearFallback;
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);
  if (month < 1 || month > 12 || day < 1 || day > 31) return undefined;
  return `${year}-${pad(month)}-${pad(day)}`;
}

function parseRelativeDate(token: string, ref: Date): string | undefined {
  const d = new Date(ref);
  const weekdayOfRef = d.getDay(); // 0=Sun, 1=Mon ... 6=Sat
  // 归一化：下周X / 本周X / 星期X → 周序号 + 偏移
  if (token === "今天") return format(d);
  if (token === "明天") { d.setDate(d.getDate() + 1); return format(d); }
  if (token === "后天") { d.setDate(d.getDate() + 2); return format(d); }
  if (token === "大后天") { d.setDate(d.getDate() + 3); return format(d); }
  if (token === "月底") { d.setMonth(d.getMonth() + 1, 0); return format(d); }

  const weekdayMap: Record<string, number> = { "一": 1, "二": 2, "三": 3, "四": 4, "五": 5, "六": 6, "日": 0, "天": 0 };
  const m = token.match(/(下星期|下周一|下周|本周|星期)([一二三四五六日天])/);
  if (!m) return undefined;
  const scope = m[1]; // 本周 / 下周 / 下周一 / 星期
  const day = weekdayMap[m[2]];
  // 基础偏移
  let delta = (day - weekdayOfRef + 7) % 7;
  if (scope === "下周" || scope === "下星期") delta += 7;
  d.setDate(d.getDate() + delta);
  return format(d);

  function format(date: Date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }
}

function parseDateFromText(text: string, ref: Date): string | undefined {
  // 优先明确日期
  const em = text.match(EXPLICIT_DATE_RE);
  if (em) {
    const r = parseExplicitDate(em, ref.getFullYear());
    if (r) return r;
  }
  const rm = text.match(RELATIVE_DATE_RE);
  if (rm) return parseRelativeDate(rm[1], ref);
  return undefined;
}

// ---------- 行解析 ----------
function normalizeDateStr(dateLike: string, yearFallback: number): string {
  // 支持 `2026-07-15` / `7/15` / `07.15`
  const s = dateLike.replace(/\./g, "-").replace(/\//g, "-");
  if (/^\d{1,2}-\d{1,2}$/.test(s)) return `${yearFallback}-${s.split("-").map((v) => pad(parseInt(v, 10))).join("-")}`;
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(s)) {
    const [y, m, d] = s.split("-");
    return `${y}-${pad(parseInt(m, 10))}-${pad(parseInt(d, 10))}`;
  }
  return s;
}

function parseTimestampAndSpeaker(raw: string, yearFallback: number): ChatLine | null {
  const trimmed = raw.trim();
  const m = trimmed.match(LINE_START_RE);
  if (m) {
    const [, maybeDate, time, speakerRaw, restRaw] = m;
    const dateStr = maybeDate ? normalizeDateStr(maybeDate, yearFallback) : undefined;
    const speaker = speakerRaw.replace(SPEAKER_STRIP_RE, "").trim();
    const supplierGuess = speaker.match(SUPPLIER_IN_PAREN_RE)?.[1]?.trim() ?? undefined;
    return {
      raw, index: -1, timestamp: dateStr ? `${dateStr} ${time}` : time,
      dateStr, speaker, text: restRaw, supplierNameGuess: supplierGuess
    };
  }
  // 无说话人行：继续归属到上一条文本
  if (trimmed.length === 0) return null;
  return { raw, index: -1, text: trimmed };
}

// ---------- 主入口 ----------
export function parseSupplierChat(rawText: string, opts: ParseOpts = {}): SupplierChatExtractionDraft {
  const lines = (rawText || "").split(/\r?\n/);
  const refDate = opts.referenceDate ? new Date(opts.referenceDate) : new Date();
  const yearFallback = refDate.getFullYear();

  // 1. 行切分 + 合并换行文本到最近一条说话人行
  const parsedLines: ChatLine[] = [];
  for (let i = 0; i < lines.length; i++) {
    const p = parseTimestampAndSpeaker(lines[i], yearFallback);
    if (!p) continue;
    p.index = i;
    if (p.speaker) {
      parsedLines.push(p);
    } else {
      // 延续行：拼接到上一条的 text
      const prev = parsedLines[parsedLines.length - 1];
      if (prev) prev.text = `${prev.text}\n${p.text}`;
      else parsedLines.push(p);
    }
  }

  // 2. 聚合上下文
  const orders: SupplierOrderRecordDraft[] = [];
  const qualityIssues: SupplierQualityIssueDraft[] = [];
  const serviceEvents: SupplierServiceEventDraft[] = [];
  const costReductions: SupplierCostReductionDraft[] = [];
  const suppliersMentioned = new Set<string>();
  const uncertaintyNotes: string[] = [];
  let lastSupplierGuess: string | undefined;
  // 记录"上一次客户说话"用于计算响应时长
  let lastCustomerLine: ChatLine | undefined;

  for (const line of parsedLines) {
    const supplierName = line.supplierNameGuess || lastSupplierGuess;
    if (supplierName) suppliersMentioned.add(supplierName);
    if (line.supplierNameGuess) lastSupplierGuess = line.supplierNameGuess;

    const ref = line.dateStr ? new Date(`${line.dateStr}T00:00:00`) : refDate;
    const text = line.text;

    // --- 响应时长：我方问 → 供应商回 ---
    const isCustomerLine = line.speaker && !line.supplierNameGuess &&
      /我方|我|我们|公司这边|老板这边|用户这边|甲方|采购/.test(line.speaker);
    if (isCustomerLine) {
      lastCustomerLine = line;
    } else if (line.speaker && lastCustomerLine && line.dateStr && lastCustomerLine.dateStr) {
      const startTs = new Date(`${lastCustomerLine.dateStr}T${lastCustomerLine.timestamp?.split(" ")[1] || "00:00"}:00`);
      const endTs = new Date(`${line.dateStr}T${line.timestamp?.split(" ")[1] || "00:00"}:00`);
      if (!isNaN(startTs.getTime()) && !isNaN(endTs.getTime()) && endTs.getTime() >= startTs.getTime()) {
        const hours = Math.round(((endTs.getTime() - startTs.getTime()) / 3600000) * 1000) / 1000;
        if (hours < 7 * 24) { // 超过 7 天就不算
          serviceEvents.push({
            supplierNameGuess: supplierName,
            type: "response",
            content: `${lastCustomerLine.speaker ?? "客户"}提问 → ${line.speaker}回复`,
            responseHours: hours,
            sourceLineText: lines[line.index]
          });
        }
      }
      lastCustomerLine = undefined;
    }

    // --- 1) 订单 ---
    // 判断：文本里有没有"下单/订了/帮我订/采购/发/做/安排生产/安排"这样的触发词
    const orderTriggered = /(下(?:个|单|了|订)?|订(?:货|购|了|单)?|采(?:购|了)?|发(?:货|出|了)?|做(?:货)?|安排(?:生产|发货)?|备货|PO|order)[^\n，。]{0,30}/.test(text);
    // 实际发货类关键词（视为同一条订单，但回填 actualDeliveryAt）
    const shippedTriggered = /(已(?:经)?(?:发(?:出|货)?|寄(?:出)?)|发(?:出|货)了|今天发(?:出|货)|昨天发(?:出|货)|已经送到|到货了|签收了)/.test(text);
    if (orderTriggered || shippedTriggered) {
      // 抽所有数量段，取第一个作为订货量
      const qtyMatches = [...text.matchAll(QTY_RE)];
      const orderQty = qtyMatches[0] ? parseFloat(qtyMatches[0][1]) : undefined;
      const deliveredQty = shippedTriggered
        ? (qtyMatches[0] ? parseFloat(qtyMatches[0][1]) : undefined)
        : undefined;
      const productNameMatch = text.match(/([\u4e00-\u9fffA-Za-z0-9_\-]{2,30}?(?:收纳箱|收纳盒|气泡膜|纸箱|礼盒|袋|包装|杯|壶|桶|盒|架|篮|衣架|挂钩|玩具|文具|饰品|配件))/);
      const productName = productNameMatch?.[1] ?? text.slice(0, 30);

      // 找交期（承诺日期）：优先明确日期 X月X号 > 相对日期（本周三 / 月底）
      let promised: string | undefined;
      let actual: string | undefined;

      // 1) 先抓「X月X号前」「X月X号交」「交期 X-X」这种最明确的写法
      const explicitPromiseMatch = text.match(/(\d{1,2})\s*月\s*(\d{1,2})\s*(?:日|号)?\s*(?:前|之前|以内|交|交货|发出|到货|到|给你|做好|出完|发完)/);
      if (explicitPromiseMatch) {
        const m = parseInt(explicitPromiseMatch[1], 10);
        const d = parseInt(explicitPromiseMatch[2], 10);
        if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
          promised = `${ref.getFullYear()}-${pad(m)}-${pad(d)}`;
        }
      }
      if (!promised) {
        const promisePatterns = [
          /(?:交(?:期)?|承诺|约定|说好|保证|预计(?:发货|到达)?|(?:要|能)在)\s*[:：]?\s*([^，。\n]{1,30})/,
          /(.{1,25}?)(?:前发出|前出|前交|前给|前到货|前到|之内|以内|做好|出完|发完|交货|交)/
        ];
        for (const re of promisePatterns) {
          const m2 = text.match(re);
          if (m2) {
            const candidate = m2[1];
            const d2 = parseDateFromText(candidate, ref);
            if (d2) { promised = d2; break; }
          }
        }
      }
      if (!promised && !shippedTriggered) promised = parseDateFromText(text, ref);

      if (shippedTriggered) {
        actual = line.dateStr ?? parseDateFromText(text, ref);
      }

      if (orderQty || deliveredQty || promised || actual) {
        orders.push({
          supplierNameGuess: supplierName,
          productName,
          orderQuantity: orderQty,
          deliveredQuantity: shippedTriggered ? deliveredQty : undefined,
          promisedDeliveryAt: promised,
          actualDeliveryAt: actual,
          status: actual ? "fulfilled" : "pending",
          note: orderTriggered && shippedTriggered ? "疑似同一行既下单又说明发货，待核对" : undefined,
          sourceLineText: lines[line.index]
        });
      }
    }

    // --- 2) 质量问题 ---
    // 触发词：坏/破/损/裂/脏/色差/不合格/瑕疵/压坏/摔坏/漏水/漏 + 数量；或者 "发现X个问题"
    const qualityTrigger = /(坏|破|损|裂|刮|脏|色差|不合格|残次品|瑕疵|压坏|摔坏|漏水|漏|发霉|气味大|毛刺|变形)[^\n，。]{0,30}/.test(text)
      || /(?:有|出现|发现).{0,15}(\d+).{0,20}(?:坏|破|损|裂|问题|不合格|瑕疵)/.test(text);
    if (qualityTrigger) {
      const qtyMatches = [...text.matchAll(QTY_RE)];
      // 启发式：如果能找到"X 箱 / X 批次 / X 件 里" → 那是 totalBatchSize，后面紧跟的"X 个坏"作为 issueCount
      let issueCount: number = 1;
      let totalBatchSize: number | undefined;
      if (qtyMatches.length >= 2) {
        // "20 箱里发现 12 个压坏" → [0]=20箱 (batch), [1]=12个 (issue)
        totalBatchSize = parseFloat(qtyMatches[0][1]);
        issueCount = parseFloat(qtyMatches[1][1]);
      } else if (qtyMatches.length === 1) {
        issueCount = parseFloat(qtyMatches[0][1]);
      }
      // 语义检查：如果说 "发现 X 个 Y"，而且数量在句子里紧跟着"发现/出现/有"，那么它才是 issueCount；上面的启发式通常已经做到
      const closed = /(补发|已经赔|已赔付|换|已解决|处理完|退(?:货|款)?已到)/.test(text);
      qualityIssues.push({
        supplierNameGuess: supplierName,
        issueCount,
        totalBatchSize,
        issueDescription: text.slice(0, 100),
        isClosed: closed,
        repeated: /又(?:出现|来|坏|有)/.test(text) || /再次/.test(text) || /老问题/.test(text),
        sourceLineText: lines[line.index]
      });
    }

    // --- 3a) 承诺兑现 ---
    const promiseTrigger = /(保证|承诺|答应|确认|说好|一定|肯定|必).{0,40}/;
    const pm = text.match(promiseTrigger);
    if (pm) {
      const expected = parseDateFromText(text, ref);
      serviceEvents.push({
        supplierNameGuess: supplierName,
        type: "promise",
        content: text.slice(0, 120),
        promisedAt: line.dateStr,
        expectedAt: expected,
        sourceLineText: lines[line.index]
      });
    }

    // --- 3b) 价格变动 ---
    const priceChangeTrigger = /(涨(?:价|了)?|降(?:价|了)?|上(?:调|涨)|下(?:调|跌)|提价|调价)/;
    if (priceChangeTrigger.test(text)) {
      let priceBefore: number | undefined;
      let priceAfter: number | undefined;
      const ba1 = text.match(PRICE_BEFORE_AFTER_RE_1);
      const ba2 = text.match(PRICE_BEFORE_AFTER_RE_2);
      if (ba1) {
        priceBefore = parseFloat(ba1[1]);
        priceAfter = parseFloat(ba1[3]);
      } else if (ba2) {
        priceBefore = parseFloat(ba2[1]);
        priceAfter = parseFloat(ba2[2]);
      } else {
        // 涨了 0.3 元 / 降了 5%  / 涨 3 毛 — 这种单段变化暂时只记录
        const ud = text.match(PRICE_UP_DOWN_NUM);
        if (ud) {
          const direction = /降|下/.test(ud[1]) ? -1 : 1;
          const delta = parseFloat(ud[2]);
          const unit = ud[3];
          // 如果能从句子里找到基准价，试着找一下
          const basePriceMatch = text.match(/(?:现(?:在|款)?价|原本|原来|之前|原价)[^0-9]{0,10}(\d+(?:\.\d+)?)/);
          if (basePriceMatch) {
            const base = parseFloat(basePriceMatch[1]);
            priceBefore = base;
            if (unit === "%" || unit === "毛" || unit === "块" || unit === "元") {
              let deltaVal = delta;
              if (unit === "%") deltaVal = base * delta / 100;
              if (unit === "毛") deltaVal = delta / 10;
              priceAfter = Math.round((base + direction * deltaVal) * 1000) / 1000;
            }
          }
        }
      }
      if (priceBefore !== undefined || priceAfter !== undefined) {
        serviceEvents.push({
          supplierNameGuess: supplierName,
          type: "price_change",
          content: text.slice(0, 120),
          priceBefore,
          priceAfter,
          marketPriceChangedAt: line.dateStr,
          sourceLineText: lines[line.index]
        });
      } else {
        uncertaintyNotes.push(`疑似报价变动，但没解析出前后价格：${text.slice(0, 40)}`);
      }
    }

    // --- 3c) 配合度打分 ---
    const coopTrigger = /配合度|配合.{0,10}分|态度.{0,10}(好|差|一般|积极|不积极|灵活)/;
    const coopMatch = text.match(coopTrigger);
    if (coopMatch) {
      const scoreNum = text.match(/(\d(?:\.\d)?)\s*分/);
      if (scoreNum) {
        const score = parseFloat(scoreNum[1]);
        if (!isNaN(score) && score >= 0 && score <= 5) {
          serviceEvents.push({
            supplierNameGuess: supplierName,
            type: "cooperation_rating",
            content: text.slice(0, 120),
            cooperationScore: score,
            sourceLineText: lines[line.index]
          });
        }
      } else {
        // 语义化映射
        let score: number | undefined;
        if (/(很好|非常积极|特别配合|超赞|极好|满分)/.test(text)) score = 5;
        else if (/(灵活|配合|积极|态度好|不错)/.test(text)) score = 4;
        else if (/(一般|还行|凑活|中等)/.test(text)) score = 3;
        else if (/(比较差|不算配合|回复慢|不灵活|不太配合)/.test(text)) score = 2;
        else if (/(极差|恶劣|不配合|态度差|拉黑)/.test(text)) score = 1;
        if (score !== undefined) {
          serviceEvents.push({
            supplierNameGuess: supplierName,
            type: "cooperation_rating",
            content: text.slice(0, 120),
            cooperationScore: score,
            sourceLineText: lines[line.index]
          });
        }
      }
    }
  }

  // 3. 承诺兑现补充：对每条 promise，往后查找 fulfillment 行（实际兑现）
  for (let i = 0; i < serviceEvents.length; i++) {
    const ev = serviceEvents[i];
    if (ev.type !== "promise" || ev.fulfilled !== undefined) continue;
    const dateOK = ev.expectedAt && (orders.some((o) => o.actualDeliveryAt && o.actualDeliveryAt <= ev.expectedAt!));
    if (dateOK) ev.fulfilled = true;
  }

  // 4. 供应商名兜底：聊天后段才出现"王经理(厂家)"时，补回到前面的 orders/issues/events
  const supplierGuessed = Array.from(suppliersMentioned)[0];
  if (supplierGuessed) {
    for (const o of orders) if (!o.supplierNameGuess) o.supplierNameGuess = supplierGuessed;
    for (const q of qualityIssues) if (!q.supplierNameGuess) q.supplierNameGuess = supplierGuessed;
    for (const e of serviceEvents) if (!e.supplierNameGuess) e.supplierNameGuess = supplierGuessed;
  }

  return SupplierChatExtractionDraftSchema.parse({
    orders,
    qualityIssues,
    serviceEvents,
    costReductions,
    suppliersMentioned: Array.from(suppliersMentioned),
    uncertaintyNotes
  });
}
