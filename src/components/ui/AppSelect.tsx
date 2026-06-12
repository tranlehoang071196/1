import React from 'react';
import Select, { Props as SelectProps, GroupBase } from 'react-select';

export interface SelectOption {
  value: string;
  label: string;
}

interface AppSelectProps extends Omit<SelectProps<SelectOption, any, GroupBase<SelectOption>>, 'theme' | 'styles'> {
  className?: string;
  label?: string;
}

export function AppSelect({
  options,
  value,
  onChange,
  isMulti = false,
  placeholder = 'Chọn...',
  isDisabled = false,
  className = '',
  label,
  ...props
}: AppSelectProps) {
  return (
    <div className={`w-full ${className}`}>
      {label && (
        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 px-0.5">
          {label}
        </label>
      )}
      <Select<SelectOption, any, GroupBase<SelectOption>>
        options={options}
        value={value}
        onChange={onChange}
        isMulti={isMulti}
        placeholder={placeholder}
        isDisabled={isDisabled}
        unstyled
        classNames={{
          control: ({ isFocused, isDisabled }) => `
            flex items-center min-h-[38px] px-3 py-1 bg-slate-50 border rounded-xl cursor-pointer transition-all duration-200
            ${isDisabled ? 'opacity-50 cursor-not-allowed bg-slate-100' : 'hover:bg-white'}
            ${isFocused 
              ? 'border-blue-600 bg-white ring-2 ring-blue-600/15 shadow-sm' 
              : 'border-slate-200 hover:border-slate-350'
            }
          `,
          valueContainer: () => 'flex flex-wrap gap-1 items-center py-0.5',
          placeholder: () => 'text-slate-400 text-xs font-semibold',
          singleValue: () => 'text-slate-800 text-xs font-bold leading-none',
          input: () => 'text-xs text-slate-800 focus:outline-none',
          menu: () => 'absolute z-50 w-full bg-white border border-slate-200 rounded-xl shadow-xl mt-1.5 py-1 text-slate-700',
          menuList: () => 'max-h-60 overflow-y-auto',
          option: ({ isFocused, isSelected }) => `
            px-3.5 py-2.5 text-xs font-bold transition-all duration-150 cursor-pointer flex items-center justify-between
            ${isSelected 
              ? 'bg-blue-50 text-blue-700 font-extrabold' 
              : isFocused 
                ? 'bg-slate-50 text-slate-900' 
                : 'text-slate-600 hover:bg-slate-50/50'
            }
          `,
          multiValue: () => 'bg-blue-50 border border-blue-100 rounded-lg pl-2 pr-1 py-1 mr-1 my-0.5 flex items-center text-[10px] font-black text-blue-700 select-none uppercase tracking-wide shrink-0',
          multiValueLabel: () => 'mr-1 leading-none',
          multiValueRemove: () => 'text-blue-500 hover:text-blue-700 hover:bg-blue-150/40 rounded-md p-0.5 transition-all duration-150',
          indicatorsContainer: () => 'flex items-center gap-1.5 shrink-0 ml-auto pl-1',
          dropdownIndicator: () => 'text-slate-450 hover:text-slate-600 transition-colors p-0.5',
          clearIndicator: () => 'text-slate-450 hover:text-slate-600 transition-colors p-0.5',
          noOptionsMessage: () => 'p-4 text-center text-xs text-slate-400 font-semibold',
        }}
        {...props}
      />
    </div>
  );
}
