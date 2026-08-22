export type MonthlyInboundMeasure = {
  receivedQuantity?: number;
  actualStock?: number;
  availableStock?: number;
  inTransitQuantity?: number;
};

export type MonthlyInboundSummary = {
  receivedQuantity: number;
  actualStock?: number;
  availableStock?: number;
  inventoryGap?: number;
  inTransitQuantity?: number;
};

function sumDefined(values: Array<number | undefined>): number | undefined {
  const defined = values.filter((value): value is number => value !== undefined && Number.isFinite(value));
  return defined.length ? defined.reduce((total, value) => total + value, 0) : undefined;
}

export function aggregateMonthlyInbound(rows: MonthlyInboundMeasure[]): MonthlyInboundSummary {
  const actualStock = sumDefined(rows.map((row) => row.actualStock));
  const availableStock = sumDefined(rows.map((row) => row.availableStock));
  return {
    receivedQuantity: sumDefined(rows.map((row) => row.receivedQuantity)) ?? 0,
    actualStock,
    availableStock,
    inventoryGap: actualStock !== undefined && availableStock !== undefined
      ? actualStock - availableStock
      : undefined,
    inTransitQuantity: sumDefined(rows.map((row) => row.inTransitQuantity))
  };
}
