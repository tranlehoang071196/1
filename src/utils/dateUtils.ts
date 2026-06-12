import { differenceInCalendarDays, formatDistanceToNow, startOfDay, isValid, parseISO, format } from 'date-fns';
import { vi } from 'date-fns/locale';

export function parseDate(date: any): Date | null {
  if (!date) return null;
  
  // If firestore timestamp (has toDate method)
  if (typeof date.toDate === 'function') {
    return date.toDate();
  }
  
  // If firestore timestamp with seconds
  if (typeof date.seconds === 'number') {
    return new Date(date.seconds * 1000 + (date.nanoseconds || 0) / 1000000);
  }
  
  // Generic Date instance
  if (date instanceof Date) {
    return isValid(date) ? date : null;
  }
  
  // Number
  if (typeof date === 'number') {
    const d = new Date(date);
    return isValid(d) ? d : null;
  }
  
  // String
  if (typeof date === 'string') {
    const trimmed = date.trim();
    if (trimmed === '') return null;
    
    // Check if the string matches DD/MM/YYYY or D/M/YYYY
    const parts = trimmed.split('/');
    if (parts.length === 3) {
      const d = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      const y = parseInt(parts[2], 10);
      if (!isNaN(d) && !isNaN(m) && !isNaN(y)) {
        // Correctly construct Date: new Date(year, monthIndex, day)
        const parsedDate = new Date(y, m - 1, d);
        if (isValid(parsedDate)) {
          return parsedDate;
        }
      }
    }
    
    // Check if the string matches YYYY-MM-DD
    const dashParts = trimmed.split('-');
    if (dashParts.length === 3 && dashParts[0].length === 4) {
      const y = parseInt(dashParts[0], 10);
      const m = parseInt(dashParts[1], 10);
      const d = parseInt(dashParts[2], 10);
      if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
        const parsedDate = new Date(y, m - 1, d);
        if (isValid(parsedDate)) {
          return parsedDate;
        }
      }
    }

    const d = parseISO(trimmed);
    if (isValid(d)) return d;
    const dp = new Date(trimmed);
    return isValid(dp) ? dp : null;
  }
  
  return null;
}

export function formatRelative(dateVal: any): string {
  const date = parseDate(dateVal);
  if (!date) return '---';
  
  const today = startOfDay(new Date());
  const targetDay = startOfDay(date);
  const diffDays = differenceInCalendarDays(today, targetDay);
  
  if (diffDays === 0) {
    return 'Hôm nay';
  }
  
  return formatDist(date);
}

// Helper to avoid duplicate logic or formatDistanceToNow directly
function formatDist(date: Date) {
  return formatDistanceToNow(date, { addSuffix: true, locale: vi });
}

export interface DeadlineStatus {
  label: string;
  colorClass: string;
  isOverdue: boolean;
  isUpcoming: boolean;
  daysRemainingOrOverdue: number;
}

export function formatDeadline(dateVal: any, completedDateVal?: any, isCompleted?: boolean): DeadlineStatus {
  const deadlineDate = parseDate(dateVal);
  const defaultStatus = {
    label: 'Không có hạn',
    colorClass: 'text-slate-500 bg-slate-100 border-slate-200',
    isOverdue: false,
    isUpcoming: false,
    daysRemainingOrOverdue: 0
  };
  if (!deadlineDate) return defaultStatus;
  
  const formattedString = formatDate(deadlineDate);
  
  if (isCompleted || completedDateVal) {
    const completedDate = parseDate(completedDateVal);
    if (completedDate) {
      const completedDay = startOfDay(completedDate);
      const targetDay = startOfDay(deadlineDate);
      const diffDays = differenceInCalendarDays(completedDay, targetDay); // positive if completed after deadline
      
      if (diffDays > 0) {
        return {
          label: `Đã hoàn thành (Quá hạn ${diffDays} ngày) (${formattedString})`,
          colorClass: 'text-red-700 bg-red-50 border-red-200',
          isOverdue: true,
          isUpcoming: false,
          daysRemainingOrOverdue: diffDays
        };
      } else {
        return {
          label: `Hoàn thành đúng hạn (${formattedString})`,
          colorClass: 'text-emerald-700 bg-emerald-50 border-emerald-200',
          isOverdue: false,
          isUpcoming: false,
          daysRemainingOrOverdue: 0
        };
      }
    } else {
      return {
        label: `Đã hoàn thành (${formattedString})`,
        colorClass: 'text-emerald-700 bg-emerald-50 border-emerald-200',
        isOverdue: false,
        isUpcoming: false,
        daysRemainingOrOverdue: 0
      };
    }
  }
  
  const today = startOfDay(new Date());
  const targetDay = startOfDay(deadlineDate);
  const diffDays = differenceInCalendarDays(targetDay, today); // positive if in future, negative if in past
  
  if (diffDays < 0) {
    const overdueDays = Math.abs(diffDays);
    return {
      label: `Đã quá hạn ${overdueDays} ngày (${formattedString})`,
      colorClass: 'text-red-700 bg-red-50 border-red-200',
      isOverdue: true,
      isUpcoming: false,
      daysRemainingOrOverdue: overdueDays
    };
  } else if (diffDays === 0) {
    return {
      label: `Hạn chót Hôm nay (${formattedString})`,
      colorClass: 'text-amber-700 bg-amber-50 border-amber-200',
      isOverdue: false,
      isUpcoming: true,
      daysRemainingOrOverdue: 0
    };
  } else if (diffDays <= 3) {
    return {
      label: `Sắp đến hạn - Còn ${diffDays} ngày (${formattedString})`,
      colorClass: 'text-orange-700 bg-orange-50 border-orange-200',
      isOverdue: false,
      isUpcoming: true,
      daysRemainingOrOverdue: diffDays
    };
  } else {
    return {
      label: `Còn ${diffDays} ngày (${formattedString})`,
      colorClass: 'text-slate-600 bg-slate-50 border-slate-200',
      isOverdue: false,
      isUpcoming: false,
      daysRemainingOrOverdue: diffDays
    };
  }
}

export function formatDate(dateVal: any): string {
  const date = parseDate(dateVal);
  if (!date) return '---';
  return format(date, 'dd/MM/yyyy');
}
