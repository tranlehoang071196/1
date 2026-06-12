import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Calendar, X, ChevronDown } from 'lucide-react';
import { cn } from '../lib/utils';
import { toast } from 'sonner';

interface EditableInputProps {
  value: string;
  onSave: (val: string) => void;
  readOnly?: boolean;
  className?: string;
  placeholder?: string;
  autoFocus?: boolean;
  onFocus?: () => void;
}

export const EditableInput = ({ 
  value, 
  onSave, 
  readOnly,
  className,
  placeholder,
  autoFocus,
  onFocus
}: EditableInputProps) => {
  const [localValue, setLocalValue] = useState(value || '');
  const valueRef = React.useRef(value || '');
  const lastSavedValueRef = React.useRef<string | null>(null);

  useEffect(() => {
    setLocalValue(value || '');
    valueRef.current = value || '';
    lastSavedValueRef.current = null;
  }, [value]);

  const handleChange = (val: string) => {
    setLocalValue(val);
    valueRef.current = val;
  };

  const handleFinish = () => {
    const trimmedVal = valueRef.current.trim();
    const originalVal = (value || '').trim();
    if (trimmedVal !== originalVal && trimmedVal !== lastSavedValueRef.current) {
      lastSavedValueRef.current = trimmedVal;
      onSave(trimmedVal);
    }
  };

  return (
    <input
      autoFocus={autoFocus}
      readOnly={readOnly}
      className={className}
      placeholder={placeholder}
      value={localValue}
      onFocus={onFocus}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => handleChange(e.target.value)}
      onBlur={handleFinish}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          (e.target as HTMLInputElement).blur();
        } else if (e.key === 'Escape') {
          valueRef.current = value || '';
          setLocalValue(value || '');
          (e.target as HTMLInputElement).blur();
        }
      }}
    />
  );
};

interface CustomDatePickerProps {
  value: string;
  onChange: (val: string) => void;
  readOnly?: boolean;
}

export const CustomDatePicker = ({ value, onChange, readOnly }: CustomDatePickerProps) => {
  const [inputValue, setInputValue] = useState(value || '');

  useEffect(() => {
    setInputValue(value || '');
  }, [value]);

  const maxDateYmd = useMemo(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  const ymdValue = useMemo(() => {
    if (!value || value.length !== 10) return '';
    const parts = value.split('/');
    if (parts.length !== 3) return '';
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }, [value]);

  const isFutureDate = (dStr: string, mStr: string, yStr: string) => {
    const d = parseInt(dStr, 10);
    const m = parseInt(mStr, 10);
    const y = parseInt(yStr, 10);
    const checkDate = new Date(y, m - 1, d, 23, 59, 59, 999);
    const today = new Date();
    return checkDate > today;
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let text = e.target.value;
    if (text === '') {
      setInputValue('');
      onChange('');
      return;
    }
    text = text.replace(/[^\d/]/g, '').slice(0, 10);
    setInputValue(text);

    if (text.length === 10) {
      const parts = text.split('/');
      if (parts.length === 3) {
        const d = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        const y = parseInt(parts[2], 10);
        const date = new Date(y, m - 1, d);
        if (!isNaN(date.getTime()) && date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d) {
          if (isFutureDate(parts[0], parts[1], parts[2])) {
            toast.error('Không thể chọn ngày trong tương lai');
            setInputValue('');
            onChange('');
            return;
          }
          onChange(text);
        }
      }
    }
  };

  return (
    <div className="relative inline-flex items-center group font-sans">
      <div className="relative flex items-center">
        <input
          type="text"
          placeholder="dd/mm/yyyy"
          value={inputValue}
          onChange={handleTextChange}
          readOnly={readOnly}
          className={cn(
            "w-24 px-1.5 py-0.5 border border-slate-200 rounded text-[10px] font-semibold outline-none transition-all placeholder:font-normal placeholder:text-slate-300 pr-5",
            inputValue ? "bg-slate-50 text-slate-700 border-slate-300/80" : "bg-white text-slate-900",
            readOnly && "cursor-not-allowed opacity-70"
          )}
        />
        {inputValue && !readOnly && (
          <button 
            type="button"
            onClick={() => {
              setInputValue('');
              onChange('');
            }}
            className="absolute right-1.5 text-slate-300 hover:text-slate-500 transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>
      <div className="relative ml-1 w-4 h-4 flex items-center justify-center">
        <input
          type="date"
          value={ymdValue}
          max={maxDateYmd}
          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10 disabled:cursor-default"
          onChange={(e) => {
            if (!e.target.value) {
              onChange('');
              return;
            }
            const date = new Date(e.target.value);
            if (!isNaN(date.getTime())) {
                const today = new Date();
                today.setHours(23, 59, 59, 999);
                if (date > today) {
                  toast.error('Không thể chọn ngày trong tương lai');
                  return;
                }
                const formatted = `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
                onChange(formatted);
            }
          }}
          disabled={readOnly}
        />
        <Calendar className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-500 transition-colors" />
      </div>
    </div>
  );
};

interface CurrencyInputProps {
  value: number;
  onChange: (val: number) => void;
  readOnly?: boolean;
  className?: string;
  placeholder?: string;
}

interface NumberInputProps {
  value: number;
  onChange: (val: number) => void;
  readOnly?: boolean;
  className?: string;
  placeholder?: string;
  min?: number;
  max?: number;
}

export const NumberInput = ({
  value,
  onChange,
  readOnly,
  className,
  placeholder,
  min = 0,
  max
}: NumberInputProps) => {
  const [localValue, setLocalValue] = useState(String(value || 0));

  useEffect(() => {
    setLocalValue(String(value || 0));
  }, [value]);

  const handleBlur = () => {
    let numVal = localValue === '' ? min : Number(localValue);
    if (!isNaN(numVal)) {
      if (max !== undefined) {
        numVal = Math.min(max, numVal);
      }
      numVal = Math.max(min, numVal);
      if (numVal !== value) {
        onChange(numVal);
      } else {
        setLocalValue(String(value || 0));
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      (e.target as HTMLInputElement).blur();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    if (text === '') {
      setLocalValue('');
      return;
    }
    const num = Number(text);
    if (!isNaN(num)) {
      if (max !== undefined && num > max) {
        setLocalValue(String(max));
        onChange(max);
      } else {
        setLocalValue(text);
      }
    }
  };

  return (
    <input
      type="number"
      readOnly={readOnly}
      className={className}
      placeholder={placeholder}
      value={localValue}
      min={min}
      max={max}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      onClick={(e) => e.stopPropagation()}
    />
  );
};

export const Combobox = ({ 
  options, 
  value, 
  onChange, 
  placeholder, 
  disabled,
  displayCodeOnly
}: { 
  options: { code: string; name: string }[]; 
  value: string; 
  onChange: (val: string) => void; 
  placeholder?: string; 
  disabled?: boolean;
  displayCodeOnly?: boolean
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [local, setLocal] = useState('');
  
  useEffect(() => {
    const opt = options.find((o) => o.code === value);
    setLocal(opt ? (displayCodeOnly ? opt.code : `${opt.name} (${opt.code})`) : value);
  }, [value, options, displayCodeOnly]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        // Sync local back to selected value if click outside
        const opt = options.find((o) => o.code === value);
        setLocal(opt ? (displayCodeOnly ? opt.code : `${opt.name} (${opt.code})`) : value);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [value, options, displayCodeOnly]);

  const filteredOptions = useMemo(() => {
    if (!local.trim()) return options;
    const search = local.toLowerCase().trim();
    // Try to check if the search term matches selected value fully
    const opt = options.find((o) => o.code === value);
    const selectedText = opt ? (displayCodeOnly ? opt.code : `${opt.name} (${opt.code})`) : value;
    if (search === selectedText.toLowerCase().trim()) {
      return options;
    }
    return options.filter(o => 
      o.code.toLowerCase().includes(search) || 
      o.name.toLowerCase().includes(search)
    );
  }, [options, local, value, displayCodeOnly]);

  const handleSelect = (code: string) => {
    onChange(code);
    setIsOpen(false);
  };

  return (
    <div className="relative w-full font-sans" ref={containerRef}>
      <div className="relative">
        <input 
          value={local}
          onChange={(e) => {
            setLocal(e.target.value);
            setIsOpen(true);
            const val = e.target.value.toLowerCase().trim();
            const match = options.find(o => 
              o.code.toLowerCase() === val || 
              o.name.toLowerCase() === val ||
              `${o.name} (${o.code})`.toLowerCase() === val
            );
            if (match) {
              onChange(match.code);
            } else if (e.target.value === '') {
              onChange('');
            }
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full bg-white border border-slate-200 rounded px-2 pr-6 py-1 text-xs font-semibold text-slate-700 outline-none focus:border-blue-500 cursor-pointer focus:ring-1 focus:ring-blue-500/20 transition-all disabled:bg-slate-50 disabled:cursor-not-allowed"
        />
        <div className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
          <ChevronDown className="w-3 h-3" />
        </div>
      </div>
      
      {isOpen && !disabled && (
        <div className="absolute left-0 right-0 z-50 mt-1 max-h-48 overflow-y-auto bg-white border border-slate-200 rounded shadow-md py-1">
          {filteredOptions.length === 0 ? (
            <div className="px-2.5 py-1.5 text-xs text-slate-400 italic">Không tìm thấy kết quả</div>
          ) : (
            filteredOptions.map((o) => {
              const isSelected = o.code === value;
              return (
                <button
                  key={o.code}
                  type="button"
                  onClick={() => handleSelect(o.code)}
                  className={cn(
                    "w-full text-left px-2.5 py-1.5 text-xs font-sans hover:bg-slate-50 transition-colors flex items-center justify-between cursor-pointer",
                    isSelected ? "bg-blue-50 text-blue-600 font-semibold" : "text-slate-600"
                  )}
                >
                  <span className="truncate pr-1.5">{o.name}</span>
                  <span className="text-[9px] font-mono font-bold text-slate-400 bg-slate-100 px-1 rounded uppercase shrink-0">{o.code}</span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

export const CurrencyInput = ({
  value,
  onChange,
  readOnly,
  className,
  placeholder
}: CurrencyInputProps) => {
  const [localValue, setLocalValue] = useState((value || 0).toLocaleString('vi-VN'));

  useEffect(() => {
    setLocalValue((value || 0).toLocaleString('vi-VN'));
  }, [value]);

  const handleBlur = () => {
    const rawVal = localValue.replace(/\D/g, '');
    const numVal = rawVal === '' ? 0 : parseInt(rawVal, 10);
    onChange(numVal);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      (e.target as HTMLInputElement).blur();
    }
  };

  return (
    <input
      type="text"
      readOnly={readOnly}
      className={className}
      placeholder={placeholder}
      value={localValue}
      onChange={(e) => {
        const rawVal = e.target.value.replace(/\D/g, '');
        const numVal = rawVal === '' ? 0 : parseInt(rawVal, 10);
        setLocalValue(numVal.toLocaleString('vi-VN'));
      }}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      onClick={(e) => e.stopPropagation()}
    />
  );
};
