/** חישובים כספיים נעשים באגורות שלמות כדי למנוע שגיאות נקודה צפה. */
export function toAgorot(value: number | string): number {
  const text = String(value).replace(/,/g, "").trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) return 0;
  const [whole, fraction = ""] = text.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

export function fromAgorot(value: number): number {
  return value / 100;
}

export function sumMoney(values: Array<number | string>): number {
  return fromAgorot(values.reduce<number>((total, value) => total + toAgorot(value), 0));
}

/** מחלק סכום לתשלומים באגורות, כך שסכום התשלומים תמיד נשאר מדויק. */
export function splitMoney(total: number | string, months: number): number[] {
  if (!Number.isInteger(months) || months < 1) return [];
  const totalAgorot = toAgorot(total);
  const base = Math.floor(totalAgorot / months);
  const remainder = totalAgorot % months;
  return Array.from({ length: months }, (_, index) => fromAgorot(base + (index < remainder ? 1 : 0)));
}
