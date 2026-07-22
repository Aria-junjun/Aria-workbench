export function parseQuantity(value?: string) {
  if (!value) return undefined;
  const match = value.match(/([0-9]+(?:\.[0-9]+)?)\s*(万)?/);
  if (!match) return undefined;
  const number = Number(match[1]) * (match[2] ? 10000 : 1);
  return Number.isFinite(number) ? number : undefined;
}

export function parseMoneyAmount(value?: string) {
  if (!value) return undefined;
  const match = value.match(/([0-9]+(?:\.[0-9]+)?)\s*元/);
  const number = match ? Number(match[1]) : undefined;
  return Number.isFinite(number) ? number : undefined;
}

export function parseFeeAmount(value?: string) {
  if (!value) return 0;
  const explicitTotal = value.match(/[=＝]\s*([0-9]+(?:\.[0-9]+)?)\s*元/);
  if (explicitTotal) return Number(explicitTotal[1]);
  const base = parseMoneyAmount(value);
  if (base === undefined) return undefined;
  const multiplier = value.match(/[xX×*]\s*([0-9]+(?:\.[0-9]+)?)/)?.[1];
  return base * (multiplier ? Number(multiplier) : 1);
}

export function calculateQuoteCosts(input: {
  quantity?: number;
  untaxedUnitPrice?: string;
  untaxedPlateFee?: string;
  taxedUnitPrice?: string;
  taxedPlateFee?: string;
}) {
  const quantity = input.quantity;
  const untaxedPrice = parseMoneyAmount(input.untaxedUnitPrice);
  const taxedPrice = parseMoneyAmount(input.taxedUnitPrice);
  const untaxedFee = parseFeeAmount(input.untaxedPlateFee);
  const taxedFee = parseFeeAmount(input.taxedPlateFee);
  const untaxedGoods = quantity !== undefined && untaxedPrice !== undefined ? quantity * untaxedPrice : undefined;
  const taxedGoods = quantity !== undefined && taxedPrice !== undefined ? quantity * taxedPrice : undefined;
  return {
    untaxedGoods,
    untaxedTotal: untaxedGoods !== undefined && untaxedFee !== undefined ? untaxedGoods + untaxedFee : undefined,
    taxedGoods,
    taxedTotal: taxedGoods !== undefined && taxedFee !== undefined ? taxedGoods + taxedFee : undefined
  };
}
