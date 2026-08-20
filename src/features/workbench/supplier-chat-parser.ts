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
// 放宽：支持括号/别名/空格/换行里的各种说话人格式
const LINE_START_RE = /^(?:(\d{4}[-\/]\d{1,2}[-\/]\d{1,2}|\d{1,2}[\/\-\.]\d{1,2})\s+)?(\d{1,2}:\d{2}(?::\d{2})?)\s+([^:：\n]+?)[\s]*[:：]\s*(.*)$/s;
// 括号里的供应商名："王经理(文航家居)" / "(文航家居)王经理" / "王经理【厂家】" → 文航家居 / 厂家
const SUPPLIER_IN_PAREN_RE = /[(（\[【]([^)\）\]】]{1,30})[)\）\]】]/g;
// 说话人姓名清洗（去掉前缀头像ID/系统标签/表情等）
const SPEAKER_STRIP_RE = /^\s*[<【「\[]?[A-Za-z0-9_\-. ]{3,}[>】」\]]?\s*/;
// —— 扩展：更多企微常见说话人标识是供应商 ——
// 含"厂家/工厂/厂/供应商/仓库/档口/批发/客服/业务/经理"等关键词的，也视作供应商
const SUPPLIER_ROLE_KEYWORDS = /(厂家|工厂|供应商|仓库|档口|批发|客服|业务|经理|销售|对接|负责人|老板|老板娘)/;
// 我方/客户常见标识关键词
const CUSTOMER_ROLE_KEYWORDS = /(我方|我|我们|公司这边|老板这边|用户这边|甲方|采购|运营|小店|店铺|自己人|仓管|内勤)/;

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

function extractSupplierFromSpeaker(speaker: string): string | undefined {
  // 1) 括号/方括号/【】里取所有候选，排除明显不是的词
  SUPPLIER_IN_PAREN_RE.lastIndex = 0;
  const parens: string[] = [];
  let pm: RegExpExecArray | null;
  while ((pm = SUPPLIER_IN_PAREN_RE.exec(speaker)) !== null) {
    const v = pm[1].trim();
    // 排除明显的时间/状态标签，保留 2 字以上的名称
    if (v.length >= 2 && !/^(上午|下午|晚上|在线|离线|忙碌|请假|休息|今天|明天|本周)$/.test(v)) {
      parens.push(v);
    }
  }
  if (parens.length > 0) {
    // 取最长的那个（通常是厂名），其次取第一个（通常在括号最前面）
    return parens.sort((a, b) => b.length - a.length)[0];
  }
  // 2) 不含括号但含"供应商角色关键词"→ 用说话人本身作为 supplierGuess（去掉表情/符号）
  if (SUPPLIER_ROLE_KEYWORDS.test(speaker)) {
    const cleaned = speaker.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "").trim();
    if (cleaned.length >= 2) return cleaned;
  }
  return undefined;
}

function parseTimestampAndSpeaker(raw: string, yearFallback: number): ChatLine | null {
  const trimmed = raw.trim();
  const m = trimmed.match(LINE_START_RE);
  if (m) {
    const [, maybeDate, time, speakerRaw, restRaw] = m;
    const dateStr = maybeDate ? normalizeDateStr(maybeDate, yearFallback) : undefined;
    const speaker = speakerRaw.replace(SPEAKER_STRIP_RE, "").trim();
    const supplierGuess = extractSupplierFromSpeaker(speaker);
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

    // --- 响应时长：我方问 → 供应商回（放宽规则：没括号名的当客户，有括号名/角色关键词的当供应商）---
    const isCustomerLine = !!(line.speaker && (
      // 含"我/我们/采购/运营/店铺/甲方"等明确客户标识
      CUSTOMER_ROLE_KEYWORDS.test(line.speaker) ||
      // 没有任何供应商标识（无括号厂名 + 不含供应商角色关键词）→ 默认视为客户（我方）
      (!line.supplierNameGuess && !SUPPLIER_ROLE_KEYWORDS.test(line.speaker))
    ));
    const isSupplierLine = !!(line.speaker && line.supplierNameGuess);
    if (isCustomerLine) {
      lastCustomerLine = line;
    } else if (isSupplierLine && lastCustomerLine && line.dateStr && lastCustomerLine.dateStr) {
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

    // --- 1) 订单（扩触发词：补货/寄样/断货/加单/返单 等企微常见表达）---
    // 原"下单/订了/采购" + 新补"补货/补单/加单/返单/寄样/打样/备点货/备库存/没货了/断货/调货/补货过来"
    const orderTriggered = /(下(?:个|单|了|订)?|订(?:货|购|了|单)?|采(?:购|了)?|发(?:货|出|了)?|做(?:货)?|安排(?:生产|发货)?|备货|PO|order|补(?:货|单)?|加(?:单|货)?|返(?:单|货)?|寄(?:样|品)?|打(?:样|版)?|备(?:点货|库存)?|调货|断货|没货)[^\n，。]{0,30}/.test(text);
    // 实际发货类关键词（视为同一条订单，但回填 actualDeliveryAt）+ 新增"单号/快递单/发出/寄出/顺丰/圆通/中通/申通"
    const shippedTriggered = /(已(?:经)?(?:发(?:出|货)?|寄(?:出)?)|发(?:出|货)了|今天发(?:出|货)|昨天发(?:出|货)|已经送到|到货了|签收了|已(?:经)?(?:揽|收|取)件|快递单号|单号[是为：:]|顺丰|圆通|中通|申通|韵达|极兔|德邦|京东快递)/.test(text);
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
          isPeak: false,
          supplierNameGuess: supplierName,
          productName,
          orderQuantity: orderQty,
          deliveredQuantity: shippedTriggered ? deliveredQty : undefined,
          promisedDeliveryAt: promised,
          actualDeliveryAt: actual,
          orderedAt: line.dateStr,
          status: actual ? "fulfilled" : "pending",
          note: orderTriggered && shippedTriggered ? "疑似同一行既下单又说明发货，待核对" : undefined,
          sourceLineText: lines[line.index]
        });
      }
    }

    // --- 2) 质量问题（扩触发词：含代发场景-客退/错发）---
    // 原触发 + 新补"客户退/退货/退残/退回来了/客户说/差评/投诉/少发/漏发/多发/发错/错款/错码/错颜色"
    const qualityTrigger = /(坏|破|损|裂|刮|脏|色差|不合格|残次品|瑕疵|压坏|摔坏|漏水|漏|发霉|气味大|毛刺|变形)[^\n，。]{0,30}/.test(text)
      || /(?:有|出现|发现).{0,15}(\d+).{0,20}(?:坏|破|损|裂|问题|不合格|瑕疵)/.test(text)
      || /(客户退|退货|退残|退回来|差评|投诉|少发|漏发|多发|发错|错(?:款|码|色|颜|版|号)|少了|漏了|不对版|和图片不一样|尺寸不对)[^\n，。]{0,30}/.test(text);
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
      const closed = /(补发|已经赔|已赔付|换|已解决|处理完|退(?:货|款)?已到|客户已(?:经)?收|已经(?:退|换)回)/.test(text);
      const isCustomerReturn = /(客户退|退货|退残|退回来|差评|投诉|用户反馈|客人说|买家退)/.test(text);
      const wrongShipIssue = /(少发|漏发|多发|发错|错(?:款|码|色|颜|版|号)|少了|漏了|不对版|和图片不一样|尺寸不对|少寄|漏寄|寄错)/.test(text);
      qualityIssues.push({
        supplierNameGuess: supplierName,
        issueCount,
        totalBatchSize,
        issueDescription: text.slice(0, 100),
        isClosed: closed,
        isCustomerReturn,       // 代发专属：客退
        wrongShipIssue,         // 代发专属：错发漏发
        repeated: /又(?:出现|来|坏|有)/.test(text) || /再次/.test(text) || /老问题/.test(text),
        sourceLineText: lines[line.index]
      });
    }

    // --- 3a-新增) 态度识别（attitude）：供应商每条回复的语气好坏 ——
    if (isSupplierLine) {
      let attScore: number | undefined;
      if ((/(没问题|好的|可以|行|马上|立即|立刻|放心|一定|保证|没问题|安排上|这就去|收到|明白|收到|收到了|谢谢|不好意思|抱歉|对不起|让您久等了)/.test(text) && !/(做不到|不行|没办法|不可能)/.test(text))) {
        attScore = 5; // 非常积极
      } else if (/(好的|可以|行|尽量|争取|我们看看|研究下|确认一下|问一下|问工厂|我问下)/.test(text)) {
        attScore = 4; // 配合
      } else if (/(嗯|哦|好|知道了|看下|查下|等下|稍等|等等|等通知|等消息)/.test(text)) {
        attScore = 3; // 一般/中性
      } else if (/(不行|做不到|没办法|不可能|不知道|不清楚|这不归我管|你找别人|你自己看|随便|爱怎么样怎么样|没法搞|搞不定)/.test(text)) {
        attScore = 2; // 不积极
      } else if (/(你什么意思|神经病|有病|凭什么|投诉你|拉黑|以后别找我|滚|垃圾)/.test(text)) {
        attScore = 1; // 极差
      }
      if (attScore !== undefined) {
        serviceEvents.push({
          supplierNameGuess: supplierName,
          type: "attitude",
          content: `态度${attScore}/5分：${text.slice(0, 60)}`,
          attitudeScore: attScore,
          sourceLineText: lines[line.index]
        });
      }
    }

    // --- 3b-新增) 方案提出/方案兑现（solution_proposal / solution_fulfilled）——
    //    我方先提问题/请求 → 对方给出解决方案 → 后续是否落地
    // 检测我方是否在"问问题/提请求"
    const customerQuestioning = isCustomerLine && /(怎么办|怎么处理|怎么解决|有什么办法|能不能|可以吗|行不行|有没有|货呢|什么时候|什么时候能|到底|请|麻烦|帮忙|能否|是否|为啥|为什么|什么情况|咋回事|出问题了|坏了|少了|错了|没到|没收到)/.test(text);
    if (customerQuestioning) {
      // 标记 solutionRequested=true 的一条事件（内容=我方问题），等后续供应商回复时补充 solutionProvided
      serviceEvents.push({
        supplierNameGuess: supplierName,
        type: "solution_proposal",
        content: `我方提问/请求：${text.slice(0, 80)}`,
        solutionRequested: true,
        solutionProvided: false,
        sourceLineText: lines[line.index]
      });
    }
    // 供应商回复里是否包含"解决方案性表达"（拆成多条短正则，避免单正则过长导致 SWC 解析错误）
    if (isSupplierLine) {
      const SOL_RE_A = /(?:我|我们|这边)(?:给你|帮你|马上|立刻)?(?:发|寄|换|补|退|赔|安排|重做|补发|换货|退货|退款|补偿)/;
      const SOL_RE_B = /(?:优惠|打折|降点|重新发|换一批|先发|先寄|给你确认|去催|催一下|跟工厂|跟仓库|查一下|马上跟进|当天发出)/;
      const SOL_RE_C = /(?:明天|后天|周五前|下周一|三天内|今天内|本周内)(?:给你|答复|发出|弄好|做好|搞定|处理)/;
      const SOL_RE_D = /(?:顺丰|空运|加急|加人|加班|优先|特权|特事)/;
      const hasSolution =
        SOL_RE_A.test(text) || SOL_RE_B.test(text) ||
        SOL_RE_C.test(text) || SOL_RE_D.test(text);
      if (hasSolution) {
        // 回找最近一条 solutionRequested=true 且 solutionProvided=false 的事件，标记为已给出方案
        let attached = false;
        for (let i = serviceEvents.length - 1; i >= 0; i--) {
          const se = serviceEvents[i];
          if (se.type === "solution_proposal" && se.solutionRequested === true && se.solutionProvided === false) {
            se.solutionProvided = true;
            se.content += ` → 对方方案：${text.slice(0, 60)}`;
            se.expectedAt = parseDateFromText(text, ref);
            attached = true;
            break;
          }
        }
        if (!attached) {
          serviceEvents.push({
            supplierNameGuess: supplierName,
            type: "solution_proposal",
            content: `供应商主动给出方案：${text.slice(0, 80)}`,
            solutionRequested: false,
            solutionProvided: true,
            expectedAt: parseDateFromText(text, ref),
            sourceLineText: lines[line.index]
          });
        }
        // 方案兑现：若句子里同时包含"已发/已寄/已换/已经解决/处理好了/已退"这类完成词，标记 solutionDelivered
        const delivered = /(已经(?:发|寄|换|补|退|赔|安排|弄好|解决)|已(?:发|寄|换|补|退|赔|安排)|处理(?:好|完)了|搞定了|完事了|弄好了|发出了|寄出了|换好了|退回去了|已收到|已经到了)/.test(text);
        if (delivered) {
          serviceEvents.push({
            supplierNameGuess: supplierName,
            type: "solution_fulfilled",
            content: `方案已兑现：${text.slice(0, 60)}`,
            solutionProvided: true,
            solutionDelivered: true,
            actualAt: line.dateStr,
            sourceLineText: lines[line.index]
          });
        }
      }
    }

    // --- 3c-新增) 推诿识别（evasion）："这不是我们的问题/不怪我们/你自己没说清/物流的问题/工厂那边的问题" ——
    if (isSupplierLine) {
      let severity = 0;
      if (/(这不是|不是我们|不关我们|不怪我们|跟我们没关系|跟我没关系|不是我这边|我们也没办法|你们自己|你方|你那边|客户的问题|物流的问题|快递的问题|工厂那边|厂家的问题|不可抗力|行情就这样|市场就这样)[^\n，。]{0,20}/.test(text)) {
        severity = 1; // 轻微推诿
      }
      if (severity > 0 && /(就是|明明|本来|谁让你|早说|你没|你不说|谁知道|鬼知道|我怎么知道|反正不是我|别找我)/.test(text)) {
        severity = 2; // 严重推诿
      }
      if (severity > 0) {
        serviceEvents.push({
          supplierNameGuess: supplierName,
          type: "evasion",
          content: `推诿（${severity === 2 ? "严重" : "轻微"}）：${text.slice(0, 80)}`,
          evasionSeverity: severity,
          sourceLineText: lines[line.index]
        });
      }
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
