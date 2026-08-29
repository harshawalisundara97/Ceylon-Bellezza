export function formatCurrency(amount: number): string {
  const rounded = Math.round(amount);
  const withSeparators = rounded.toLocaleString("en-US");
  return `Rs. ${withSeparators}`;
}
