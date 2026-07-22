import { describe, expect, it } from "vitest";
import { buildFallbackExtraction } from "@/features/workbench/ai-extraction";

describe("buildFallbackExtraction", () => {
  it("parses ChatGPT assisted structured supplier notes", () => {
    const text = `【供应商】
供应商名称：义乌某包装厂
主营产品：包装盒、纸袋
地区：浙江义乌
工厂/贸易商/未知：工厂
联系人/联系方式：王经理 微信
配合度：中
风险标签：交期待确认、包装方式待确认
备注：价格有优势

【沟通记录】
沟通摘要：报价 12.5 元，MOQ 1000，交期 7 天。
报价变化：首次报价
供应商承诺：7 天交货
疑点：包装方式未确认
风险点：交期需要复核
下一步动作：明天确认包装方式

【货盘】
货盘名称：白卡纸包装盒
产品品类：包装盒
报价：12.5 元
MOQ：1000
交期：7 天
规格参数：白卡纸 350g
包装信息：未确认
样品情况：可寄样
适合渠道：电商
优势说明：价格低
风险或疑点：包装方式未确认
备注：先拿样

【产品知识】
产品/品类名称：包装盒
原材料：白卡纸
工艺流程：印刷、覆膜、模切、糊盒
成本构成：纸张、印刷、人工、损耗
关键参数：克重、尺寸、覆膜方式
质量风险：压痕、色差、爆边
常见坑点：只看单价不看损耗
替代方案：灰板盒
判断：需要拿样确认挺度

【待办】
待办事项：确认包装方式
截止时间：明天
优先级：中
类型：确认报价

【不确定项】
供应商真实产能需要确认`;

    const result = buildFallbackExtraction(text, "https://example.1688.com", 0, "missing_key");

    expect(result.supplier?.name).toBe("义乌某包装厂");
    expect(result.supplier?.supplierType).toBe("factory");
    expect(result.offers[0].quotedPrice).toBe("12.5 元");
    expect(result.productKnowledge).toEqual([]);
    expect(result.tasks[0].title).toBe("确认包装方式");
    expect(result.tasks[0].type).toBe("confirm_quote");
  });

  it("parses structured business knowledge cards", () => {
    const text = `【知识卡】
知识名称：优势谈判：更高权威
来源：《优势谈判》
核心观点：不要当场接受对方条件，把决定权转移给更高权威，争取更多谈判空间。
适用场景：供应商报价坚决、MOQ 不愿降低、样品费谈判
操作步骤：先肯定对方方案、说明需要内部确认、提出可交换条件
参考话术：这个价格我理解，但我需要和合伙人确认；如果 MOQ 能低一点，我可以更快推进样品。
风险提醒：不要滥用，否则显得没有决策权。
关联标签：谈判、报价、MOQ、样品费`;

    const result = buildFallbackExtraction(text, undefined, 0, "missing_key");

    expect(result.knowledgeCards[0].title).toBe("优势谈判：更高权威");
    expect(result.knowledgeCards[0].tags).toContain("MOQ");
  });

  it("parses knowledge cards without section headers", () => {
    const text = `知识名称：开出高于预期的条件 Ask for More Than You Expect to Get
来源：《优势谈判》罗杰·道森
核心观点：开局报价要高于自己真正想达成的目标，为后续让步留下空间。
适用场景：报价、谈薪、采购压价、销售成交、合作分成
操作步骤：先确定目标价和底线；开出高于目标但仍可解释的条件；等待对方反应；通过让步换取对方让步。
参考话术：如果按我们的完整方案执行，价格是 X。
风险提醒：报价过高会降低可信度，必须有理由支撑。
关联标签：开局策略、报价、锚定效应、让步空间`;

    const result = buildFallbackExtraction(text, undefined, 0, "missing_key");

    expect(result.communication.summary).not.toContain("知识名称");
    expect(result.knowledgeCards[0].title).toContain("开出高于预期");
    expect(result.knowledgeCards[0].tags).toContain("报价");
  });

  it("parses multiple knowledge cards in one paste", () => {
    const text = `知识名称：开出高于预期的条件
来源：《优势谈判》
核心观点：开局报价要高于目标。
适用场景：报价、采购压价
操作步骤：先报高；再让步
参考话术：完整方案价格是 X。
风险提醒：报价过高会失真。
关联标签：报价、锚定

知识名称：永远不要接受第一次报价
来源：《优势谈判》
核心观点：立刻接受会让对方后悔。
适用场景：首次报价、合作条件
操作步骤：听完停顿；表达需要评估；提出追加条件
参考话术：我需要看一下整体条件。
风险提醒：拖延过度会流失机会。
关联标签：首次报价、谈判`;

    const result = buildFallbackExtraction(text, undefined, 0, "missing_key");

    expect(result.knowledgeCards).toHaveLength(2);
    expect(result.knowledgeCards[0].title).toBe("开出高于预期的条件");
    expect(result.knowledgeCards[1].title).toBe("永远不要接受第一次报价");
  });

  it("parses detailed roll quote fields from structured offer notes", () => {
    const text = `【供应商】
供应商名称：凯帝塑料包装
主营产品：泡泡膜、气泡膜复合包装材料

【沟通记录】
沟通摘要：供应商提供一面泡泡一面平膜包装卷材报价，报价含运费。

【货盘】
货盘名称：一面泡泡一面平膜包装卷材
产品品类：泡泡膜 / 气泡膜复合包装材料
报价明细：全新料：40克 91元/卷；70克 159元/卷；100克 227元/卷。半新料：40克 72元/卷；70克 125元/卷；100克 179元/卷。
材质等级：全新料 / 半新料
报价：全新料 91-227元/卷；半新料 72-179元/卷
MOQ：最少30卷起
交期：未确认
宽度：1.6米
卷长：100米/卷
克重选项：40克 / 70克 / 100克
单卷重量：未确认
是否含运费：含运费
调价规则：泡泡在中间、两边平膜结构，原报价基础上加3元/卷
规格参数：1.6米宽，100米/卷，40克、70克、100克
风险或疑点：厚度、实际重量、材质标准未确认`;

    const result = buildFallbackExtraction(text, undefined, 0, "missing_key");
    const offer = result.offers[0];

    expect(offer.priceDetails).toContain("全新料：40克 91元/卷");
    expect(offer.materialGrade).toBe("全新料 / 半新料");
    expect(offer.width).toBe("1.6米");
    expect(offer.rollLength).toBe("100米/卷");
    expect(offer.gramWeightOptions).toBe("40克 / 70克 / 100克");
    expect(offer.freightIncluded).toBe("含运费");
    expect(offer.priceAdjustmentRule).toContain("加3元/卷");
  });

  it("preserves multiline quote tables and normalized comparison fields", () => {
    const text = `【供应商】
供应商名称：武汉晟誉包装制品有限公司

【沟通记录】
沟通摘要：供应商提供气泡膜卷装报价。

【货盘】
货盘名称：加厚气泡膜卷装采购报价单
产品品类：气泡膜 / 泡泡纸 / 快递防震包装材料
报价：≥1件 47元/件；≥100件 46元/件；≥1000件 42元/件
报价明细：

| 序号 | 结构类型 | 宽度(cm) | 长度(M) | 重量(斤) | 单价 | ≥100件价 | ≥1000件价 |
|---:|---|---:|---:|---:|---:|---:|---:|
| 1 | 单层加厚 | 100 | 50 | 6 | 47 | 46 | 42 |
| 2 | 单层加厚 | 80 | 70 | 6 | 47 | 46 | 42 |
| 28 | 单层15×20cm气泡袋 |  |  |  | 另可定做 |  |  |

统一比价口径：优先按平方米折算；无法折算时按件/卷保留原报价。
折算单价：单层加厚 100cm×50M：47元/50㎡=0.94元/㎡；≥1000件价 42元/50㎡=0.84元/㎡。
计价单位：元/件
关键规格：直径10mm，高度5mm，中泡类型
宽度：10cm、15cm、20cm、25cm、30cm、40cm、50cm、60cm、70cm、80cm、100cm
卷长：40M-660M，按结构和宽度不同变化
单卷重量：5.6斤或6斤
MOQ：1件起批`;

    const result = buildFallbackExtraction(text, undefined, 0, "missing_key");
    const offer = result.offers[0];

    expect(offer.priceDetails).toContain("| 1 | 单层加厚 | 100 | 50 | 6 | 47 | 46 | 42 |");
    expect(offer.priceDetails).toContain("| 28 | 单层15×20cm气泡袋");
    expect(offer.comparisonBasis).toContain("平方米");
    expect(offer.normalizedPriceDetails).toContain("0.94元/㎡");
  });

  it("parses tabular quote text extracted from workbook files", () => {
    const text = `【文件】气泡膜报价单.xlsx

【工作表】气泡膜报价单
加厚气泡膜卷装 · 采购报价单
一、商品基本信息
商品标题		100 80 60cm加厚气泡膜卷装 快递包装防震泡沫垫打包泡泡纸袋批发
商品链接		https://detail.1688.com/offer/609837958870.html
供应商		武汉晟誉包装制品有限公司
发货地址		湖北武汉
材质		环保PE材质，全新料，无毒无味，透明度高
气泡规格		直径10mm，高度5mm（中泡类型）
起批量		1件起批
二、阶梯报价（不含运费到手价）
采购数量			单价（元/件）		备注
≥ 1件			47		零售/小批量价
≥ 100件			46		批发价
≥ 1000件			42		大客户量价
三、SKU规格明细报价（1件起批价 ¥47.00/件）
序号	结构类型	宽度(cm)	长度(M)	重量(斤)	单价(元)	≥100件价	≥1000件价	备注
1	单层加厚	100	50	6	47	46	42
2	单层加厚	80	70	6	47	46	42
20	双层加厚	100	40	6	47	46	42
四、服务与店铺信息
保障服务		7天无理由退货 | 退货包运费 | 48小时发货
运费说明		发至湖北省武汉市洪山区运费 ¥0（包邮）
备注：以上价格均为不含运费到手价，实际运费以收货地址为准。`;

    const result = buildFallbackExtraction(text, undefined, 0, "missing_key");
    const offer = result.offers[0];

    expect(result.supplier?.name).toBe("武汉晟誉包装制品有限公司");
    expect(result.supplier?.storeUrl).toBe("https://detail.1688.com/offer/609837958870.html");
    expect(offer.name).toBe("加厚气泡膜卷装采购报价单");
    expect(offer.quotedPrice).toBe("≥1件 47元/件；≥100件 46元/件；≥1000件 42元/件");
    expect(offer.priceDetails).toContain("单层加厚\t100\t50\t6\t47\t46\t42");
    expect(offer.comparisonBasis).toContain("元/㎡");
    expect(offer.normalizedPriceDetails).toContain("单层加厚 100cm×50M");
  });

  it("parses generic dimension and unit fields for ordinary products", () => {
    const text = `【供应商】
供应商名称：义乌包装厂

【沟通记录】
沟通摘要：供应商提供纸盒报价。

【货盘】
货盘名称：白卡纸天地盖礼盒
产品品类：包装盒
报价：3.8元/个
报价明细：500个起 3.8元/个；1000个起 3.2元/个
尺寸：长20cm x 宽15cm x 高8cm
计价单位：元/个
包装单位：100个/箱
关键规格：350g白卡纸，覆哑膜，四色印刷
MOQ：500个
规格参数：20x15x8cm，350g白卡纸，覆哑膜`;

    const result = buildFallbackExtraction(text, undefined, 0, "missing_key");
    const offer = result.offers[0];

    expect(offer.dimensions).toBe("长20cm x 宽15cm x 高8cm");
    expect(offer.pricingUnit).toBe("元/个");
    expect(offer.packageUnit).toBe("100个/箱");
    expect(offer.keySpecs).toContain("350g白卡纸");
  });

  it("parses supplier and offer links", () => {
    const text = `【供应商】
供应商名称：义乌包装厂
主营产品：包装盒
店铺链接：https://shop.example.com
来源平台：1688
联系方式：旺旺：abc123

【沟通记录】
沟通摘要：供应商提供包装盒报价和商品链接。

【货盘】
货盘名称：白卡纸包装盒
产品品类：包装盒
商品链接：https://detail.1688.com/offer/123.html
资料链接：https://docs.example.com/spec.pdf
报价：3.8元/个`;

    const result = buildFallbackExtraction(text, undefined, 0, "missing_key");

    expect(result.supplier?.storeUrl).toBe("https://shop.example.com");
    expect(result.supplier?.sourcePlatform).toBe("1688");
    expect(result.supplier?.contactMethod).toBe("旺旺：abc123");
    expect(result.offers[0].productUrl).toBe("https://detail.1688.com/offer/123.html");
    expect(result.offers[0].resourceUrl).toBe("https://docs.example.com/spec.pdf");
  });

  it("infers supplier and quote details from unlabeled chat text", () => {
    const text = `东阳市语西包装有限公司
2026-07-10 15:10:30
12丝透明拉链袋 单面双色印刷
18*20 1万个 0.18一个 版费400 合计2200元
3万个 0.145一个 版费400 合计4750元
大货周期确认图稿后7天左右
以上报价都是包邮  普票免费开 专票另加10个点
最少1万个起订`;

    const result = buildFallbackExtraction(text, undefined, 0, "missing_key");

    expect(result.supplier?.name).toBe("东阳市语西包装有限公司");
    expect(result.offers).toHaveLength(1);
    expect(result.offers[0].name).toContain("12丝透明拉链袋");
    expect(result.offers[0].priceDetails).toContain("18*20 1万个 0.18一个");
    expect(result.offers[0].priceDetails).toContain("3万个 0.145一个");
    expect(result.offers[0].moq).toContain("1万个");
    expect(result.offers[0].leadTime).toContain("7天");
  });

  it("splits multiple product quotes and extracts supplier from exported chat metadata", () => {
    const text = `深圳市雄鹰达胶袋有限公司:达达2026-7-10 16:48:26
【订做】（哑光）双面珠光膜三边封复合骨袋，不要挂孔，18.5*20.5cm，双面14丝，两色印刷（蓝，白），数量3万个，未税价0.185元/个+版费310元/色*2色，含税价0.2035元/个+版费341元/色*2色，开13%的专票，湖北包邮。
wert1986 2026-7-10 16:51:36
1万个，或者是5千价格差异有多大呢
深圳市雄鹰达胶袋有限公司:达达2026-7-10 16:52:43
【订做，半透明磨砂】CPE拉链袋 17*19cm，双面16丝，两色一面印刷（蓝，白，只印刷一面，背面不用印刷），3万个，未税价0.19元/个+版费305元/色*2色，含税价0.209元/个+版费335元/色*2色，开13%的专票，湖北包邮。
深圳市雄鹰达胶袋有限公司:达达2026-7-10 16:54:18
5000个做不了，太少了，起订量至少要12000个左右，单价要高好多哦
大货周期12天左右`;

    const result = buildFallbackExtraction(text, undefined, 0, "missing_key");

    expect(result.supplier?.name).toBe("深圳市雄鹰达胶袋有限公司");
    expect(result.offers).toHaveLength(2);
    expect(result.offers[0].name).toContain("双面珠光膜三边封复合骨袋");
    expect(result.offers[0].quotedPrice).toContain("0.185元/个");
    expect(result.offers[0].untaxedUnitPrice).toBe("0.185元/个");
    expect(result.offers[0].untaxedPlateFee).toContain("310元/色");
    expect(result.offers[0].taxedUnitPrice).toBe("0.2035元/个");
    expect(result.offers[0].taxedPlateFee).toContain("341元/色");
    expect(result.offers[1].name).toContain("CPE拉链袋");
    expect(result.offers[1].quotedPrice).toContain("0.19元/个");
    expect(result.offers[1].dimensions).toContain("17*19cm");
    expect(result.offers[0].moq).toBe("3万个");
    expect(result.offers[1].moq).toBe("3万个");
    expect(result.offers[0].leadTime).toBe("12天左右");
  });

  it("creates a sample tracking task from a shipping notice", () => {
    const text = `东阳市语西包装有限公司2026-7-10 18:16:54
SF1563806919997样袋单号 届时请注意查收
wert1986 2026-7-11 10:13:41
好的`;

    const result = buildFallbackExtraction(text, undefined, 0, "missing_key");

    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0].title).toContain("SF1563806919997");
    expect(result.tasks[0].title).toContain("样袋");
    expect(result.tasks[0].type).toBe("follow_sample");
    expect(result.tasks[0].priority).toBe("medium");
  });

  it("turns a spoken procurement checklist into separate tasks", () => {
    const text = `YT7632156770762 雨伞定制100个物流单号，需要跟踪仓库到货情况
吊卡和不干胶贴纸，需要跟踪发货情况
白板贴已经发货，需要跟进付款情况
京东店铺防撞贴跟进货源情况，可拿样测试效果对比之前样品
白板贴新款三个跟进，是否需要小批量入仓`;

    const result = buildFallbackExtraction(text, undefined, 0, "missing_key");

    expect(result.tasks).toHaveLength(5);
    expect(result.tasks[0].title).toContain("YT7632156770762");
    expect(result.tasks[1].title).toContain("跟踪发货");
    expect(result.tasks[2].title).toContain("跟进付款");
    expect(result.tasks[3].type).toBe("follow_sample");
    expect(result.tasks[4].title).toContain("小批量入仓");
  });

  it("parses a single-supplier spoken brief with tiered lengths and freight", () => {
    const text = `供应商名称：东莞市木小森供应链管理有限公司 主营：防撞条、双面胶、手把套、墙贴 https://detail.1688.com/offer/903616430319.html?spm=test
2米，3.5元+邮费2元
5米，8.75元一卷+2.2元邮费
10米，17.5元一卷+2.5元邮费 快递圆通，申通，邮政随机，不处理退货退款，只处理商家原因的售后，通用标识，无合格证，简易包装产品品质属于中下`;

    const result = buildFallbackExtraction(text, undefined, 0, "missing_key");

    expect(result.supplier?.name).toBe("东莞市木小森供应链管理有限公司");
    expect(result.supplier?.categories).toEqual(["防撞条", "双面胶", "手把套", "墙贴"]);
    expect(result.supplier?.storeUrl).toContain("903616430319.html");
    expect(result.supplier?.riskTags).toContain("不处理普通退货退款");
    expect(result.offers).toHaveLength(1);
    expect(result.offers[0].name).toBe("防撞条");
    expect(result.offers[0].quotedPrice).toContain("2米：3.5元，邮费2元");
    expect(result.offers[0].quotedPrice).toContain("10米：17.5元，邮费2.5元");
    expect(result.offers[0].productUrl).toContain("903616430319.html");
    expect(result.offers[0].risks).toContain("无合格证");
  });

  it("parses compact length prices with one shared freight rule", () => {
    const text = `供应商名称：台州市黄岩好诺塑料加工厂 主营：防撞条、防撞角、工业产品胶带 供应商店铺链接：https://detail.1688.com/offer/563768987712.html?_t=1
这个基本上单价就是锁死了8厘米*2米的长度，单价是3.5一套，常规尺寸有2米3.5元，5米8.75元，10米17.5元，邮费基本上都是2元起，可以处理售后退货退款，发邮政快递，包裹有品牌标识，合格证，配合态度比较好，产品品质中。`;

    const result = buildFallbackExtraction(text, undefined, 0, "missing_key");

    expect(result.supplier?.name).toBe("台州市黄岩好诺塑料加工厂");
    expect(result.supplier?.categories).toEqual(["防撞条", "防撞角", "工业产品胶带"]);
    expect(result.supplier?.cooperationLevel).toBe("比较好");
    expect(result.offers).toHaveLength(1);
    expect(result.offers[0].name).toBe("防撞条");
    expect(result.offers[0].quotedPrice).toContain("2米：3.5元，邮费2元起");
    expect(result.offers[0].quotedPrice).toContain("10米：17.5元，邮费2元起");
    expect(result.offers[0].keySpecs).toContain("8厘米×2米");
    expect(result.offers[0].sampleStatus).toContain("支持售后退货退款");
  });

  it("parses a factory-page supplier brief with compact trial pricing", () => {
    const text = `供应商名称：台州市黄岩奥纳家居有限公司 主营产品：主营:防撞条、防撞角、地垫 供应商链接：https://www.1688.com/factory/b2b-2200779801726a8ae1.html
这家单价前期测款一月试行可以8厘米宽度，2米长度，单价3.5+2.5邮费，处理售后退货退款（每单处理时效长），用专业纳米胶，环保易清理，若后期未起量，代发成本上浮10%，产品品质中上。`;

    const result = buildFallbackExtraction(text, undefined, 0, "missing_key");

    expect(result.supplier?.name).toBe("台州市黄岩奥纳家居有限公司");
    expect(result.supplier?.categories).toEqual(["防撞条", "防撞角", "地垫"]);
    expect(result.supplier?.storeUrl).toContain("b2b-2200779801726a8ae1.html");
    expect(result.offers).toHaveLength(1);
    expect(result.offers[0].quotedPrice).toContain("2米：3.5元，邮费2.5元");
    expect(result.offers[0].keySpecs).toContain("8厘米×2米");
    expect(result.offers[0].materialGrade).toContain("专业纳米胶");
    expect(result.offers[0].priceAdjustmentRule).toContain("上浮10%");
    expect(result.offers[0].risks).toContain("每单处理时效长");
  });
});
