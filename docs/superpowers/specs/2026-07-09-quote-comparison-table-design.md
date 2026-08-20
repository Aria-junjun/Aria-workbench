# Quote Comparison Table Design

## Conclusion

Add a lightweight quote comparison workflow to the offer library. Users can select multiple offers, generate a standardized comparison table, and copy the table for use in WeChat, Feishu, Excel, or ChatGPT.

## Scope

This MVP includes:

- Checkbox selection in the offer library.
- A `生成对比表` action when at least one offer is selected.
- A `/quotes` page that reads selected offer ids from the URL.
- A standardized comparison table.
- A `复制表格` button that copies tab-separated rows.

This MVP does not include:

- Excel export.
- Customer-facing quotation documents.
- Profit, freight, tax, or currency calculations.
- Supplier score automation.

## Table Fields

The first version uses existing offer fields:

- 供应商
- 产品/货盘
- 品类
- 报价
- MOQ
- 交期
- 规格
- 包装
- 样品
- 优势
- 风险
- 备注

## Data Flow

The offer library keeps selected ids in page state. Clicking `生成对比表` navigates to `/quotes?offerIds=id1,id2`. The quote page loads local workbench data, filters matching offers, renders the table, and generates clipboard text from the same rows.

## Risks

- Existing offer data may be incomplete, so missing fields display `未记录`.
- URL-based selected ids are simple and local-first, but long selections can create long URLs. This is acceptable for MVP because quote comparisons should stay small.
- Copying to clipboard can fail in some browser permission states. The page shows a fallback message if copying fails.

## Success Criteria

- User can select offers from the offer library.
- User can generate a readable quote comparison table.
- User can copy the table content.
- Existing offer detail, search, pin, and filters remain working.
