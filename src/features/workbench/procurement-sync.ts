import { fulfillmentForQuote, normalizeLineItems, type ProcurementRecord } from './procurement';

const shared = (source: ProcurementRecord) => {
  const lines = normalizeLineItems(source);
  const first = lines[0];
  return { requester: source.requester, priority: source.priority, reason: source.reason, lineItems: lines, productName: first?.productName || '', sku: first?.sku, category: first?.category, specification: first?.specification, unit: first?.unit, quantity: first?.quantity, expectedDate: first?.expectedDate };
};

export function hasSharedProcurementChanges(before: ProcurementRecord, after: ProcurementRecord) {
  return before.title !== after.title || JSON.stringify(shared(before)) !== JSON.stringify(shared(after));
}

export function syncProcurementSourceUpdate(records: ProcurementRecord[], updated: ProcurementRecord) {
  let result = records.map(item => item.id === updated.id ? updated : item);
  const queue = [updated.id];
  while (queue.length) {
    const sourceId = queue.shift()!;
    const source = result.find(item => item.id === sourceId)!;
    result = result.map(item => {
      if (item.sourceId !== sourceId) return item;
      queue.push(item.id);
      if (item.section === 'fulfillment' && item.fulfillment) return item;
      if (item.section === 'quote' && fulfillmentForQuote(result, item)) return item;
      const title = item.section === 'quote' ? `${updated.title || '采购任务'} · 询价项目` : item.section === 'fulfillment' ? item.title : updated.title;
      return { ...item, ...shared(updated), title, ...(item.section === 'quote' ? { status: 'draft' as const, selectedSupplierIds: undefined, nextAction: '上游需求已变更，请复核报价' } : {}) };
    });
  }
  return result;
}

export function repairProcurementSourceSnapshots(records: ProcurementRecord[]) {
  return records.filter(item => !item.sourceId).reduce((current, root) => {
    const descendants: ProcurementRecord[] = [];
    const queue = [root.id];
    while (queue.length) {
      const id = queue.shift()!;
      current.filter(item => item.sourceId === id).forEach(item => { descendants.push(item); queue.push(item.id); });
    }
    const stale = descendants.some(item => {
      if (item.section === 'fulfillment' && item.fulfillment) return false;
      if (item.section === 'quote' && fulfillmentForQuote(current, item)) return false;
      const expectedTitle = item.section === 'quote' ? `${root.title || '采购任务'} · 询价项目` : item.section === 'fulfillment' ? item.title : root.title;
      return item.title !== expectedTitle || JSON.stringify(shared(item)) !== JSON.stringify(shared(root));
    });
    return stale ? syncProcurementSourceUpdate(current, current.find(item => item.id === root.id)!) : current;
  }, records);
}
