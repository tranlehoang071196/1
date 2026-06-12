import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const formatCurrency = (amount: number) => {
  if (!amount || isNaN(amount)) return '0 đồng';
  return amount.toLocaleString('vi-VN') + ' đồng';
};
