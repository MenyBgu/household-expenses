import { addMonths, endOfMonth, format, parseISO, startOfMonth, subMonths } from "date-fns";
import { he } from "date-fns/locale";

export function formatCurrency(amount: number, currency = "ILS") {
  return new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(value: string) {
  return format(parseISO(value), "dd.MM.yyyy", { locale: he });
}

export function monthLabel(date = new Date()) {
  return new Intl.DateTimeFormat("he-IL", {
    month: "long",
    year: "numeric",
  }).format(date);
}

export function isoMonth(date = new Date()) {
  return format(date, "yyyy-MM");
}

export function monthBounds(month: string) {
  const date = parseISO(`${month}-01`);
  const start = startOfMonth(date);
  const end = endOfMonth(start);
  return {
    from: format(start, "yyyy-MM-dd"),
    to: format(end, "yyyy-MM-dd"),
  };
}

export function previousIsoMonth(month: string) {
  return format(subMonths(parseISO(`${month}-01`), 1), "yyyy-MM");
}

export function nextIsoMonth(month: string) {
  return format(addMonths(parseISO(`${month}-01`), 1), "yyyy-MM");
}

export function monthTitle(month: string) {
  return new Intl.DateTimeFormat("he-IL", {
    month: "long",
    year: "numeric",
  }).format(parseISO(`${month}-01`));
}

export function percentChange(current: number, previous: number) {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}
