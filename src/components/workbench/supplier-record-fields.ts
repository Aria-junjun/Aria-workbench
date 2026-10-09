import type { SupplierBusinessKind } from '@/features/workbench/supplier-business';
export type RecordField = readonly [key: string, label: string, type?: 'date' | 'number' | 'textarea'];
export const recordNames: Record<SupplierBusinessKind, string> = { sample: '寄样记录', inspection: '核样记录', agreement: '合作约定', purchase: '采购履约', dropship_period: '代发周期履约' };
export const recordStatuses = { draft: '草稿', active: '进行中', completed: '已完成', cancelled: '已取消' };
export const recordGroups: Record<SupplierBusinessKind, Array<{ title: string; fields: RecordField[] }>> = {
  sample: [
    { title: '样品与规格', fields: [['specification', '规格 / 样品版本'], ['quantity', '寄样数量', 'number']] },
    { title: '寄送与签收', fields: [['sentDate', '寄样日期', 'date'], ['receivedDate', '收到日期', 'date']] },
  ],
  inspection: [{ title: '核验信息', fields: [['date', '核样日期', 'date'], ['specification', '规格 / 样品版本']] }],
  agreement: [
    { title: '价格与供货约定', fields: [['specification', '适用规格版本'], ['terms', '价格、税运与补货条件', 'textarea'], ['version', '最终价格 / 约定版本'], ['date', '约定生效日', 'date']] },
    { title: '责任与确认', fields: [['qualityResponsibility', '质量与售后责任', 'textarea'], ['paymentTerms', '账期 / 结算约定'], ['receipt', '供应商确认情况', 'textarea']] },
  ],
  purchase: [
    { title: '订单信息', fields: [['orderNo', '采购 / 订单号'], ['specification', '规格 / 版本'], ['quantity', '订单数量', 'number'], ['unitPrice', '单价', 'number'], ['orderAmount', '订单金额', 'number']] },
    { title: '发货与到货', fields: [['shipDate', '发货日期', 'date'], ['expectedArrivalDate', '预计到货日期', 'date'], ['shippedQuantity', '已发货数量', 'number'], ['receivedQuantity', '已收货数量', 'number'], ['receivingAddress', '收货地址'], ['receiver', '收货人'], ['receiverPhone', '收货人电话'], ['notes', '履约备注', 'textarea']] },
  ],
  dropship_period: [
    { title: '统计口径', fields: [['periodStart', '周期开始', 'date'], ['periodEnd', '周期结束', 'date'], ['platform', '平台 / 店铺'], ['dataSource', '数据来源 / 附件说明']] },
    { title: '规模与交付', fields: [['paidOrders', '支付订单量', 'number'], ['gmv', 'GMV', 'number'], ['pickup48Rate', '48小时揽收率（%）', 'number'], ['paymentToSignHours', '支签时长（小时）', 'number'], ['paymentToSignChangeHours', '支签变化（小时）', 'number']] },
    { title: '售后与服务', fields: [['refundRate', '退款率（%）', 'number'], ['rejectReturnRate', '拒退率（%）', 'number'], ['response3mRate', '3分钟响应率（%）', 'number'], ['afterSalesCount', '售后量', 'number'], ['afterSalesRate', '售后率（%）', 'number'], ['rejectedAfterSalesCount', '售后拒绝量', 'number'], ['rejectedAfterSalesRate', '售后拒绝率（%）', 'number'], ['averageRefundSeconds', '平均退款时长（秒）', 'number']] },
    { title: '平台评价', fields: [['lighthouseAfterSales', '灯塔售后分', 'number'], ['lighthouseQuality', '灯塔品质分', 'number'], ['lighthouseScore', '灯塔综合服务分', 'number']] },
    { title: '数据证据', fields: [['dataSource', '源文件 / 工作表'], ['evidenceNote', '数据依据 / 备注', 'textarea']] },
  ],
};
