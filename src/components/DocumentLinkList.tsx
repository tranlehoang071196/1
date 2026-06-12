import React, { useState } from 'react';
import { Plus, Link as LinkIcon, ExternalLink, Trash2, Edit2, Check, X } from 'lucide-react';
import { toast } from 'sonner';

export interface DocumentLinkItem {
  url: string;
  label?: string;
}

interface DocumentLinkListProps {
  links: any[];
  onChange?: (newLinks: any[]) => void;
  labelTitle?: string;
  readOnly?: boolean;
}

export function DocumentLinkList({ 
  links, 
  onChange, 
  labelTitle = "Hồ sơ công việc (Links):",
  readOnly = false
}: DocumentLinkListProps) {
  const currentLinks = links || [];

  const handleAddLink = () => {
    if (readOnly || !onChange) return;
    onChange([...currentLinks, { url: '', label: '' }]);
  };

  const handleUpdateLink = (idx: number, newVal: DocumentLinkItem) => {
    if (readOnly || !onChange) return;
    const newLinks = [...currentLinks];
    newLinks[idx] = newVal;
    onChange(newLinks);
  };

  const handleDeleteLink = (idx: number) => {
    if (readOnly || !onChange) return;
    const newLinks = currentLinks.filter((_, i) => i !== idx);
    onChange(newLinks);
  };

  return (
    <div className="w-full mt-2 space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{labelTitle}</div>
        {!readOnly && (
          <button 
            title="Thêm link"
            onClick={handleAddLink}
            className="text-[10px] font-bold text-blue-600 flex items-center gap-1 hover:text-blue-700"
          >
            <Plus className="w-3 h-3" /> Thêm link
          </button>
        )}
      </div>
      
      <div className="space-y-2">
        {currentLinks.map((linkItem: any, idx: number) => {
          let url = typeof linkItem === 'string' ? linkItem : linkItem?.url || '';
          let label = typeof linkItem === 'string' ? '' : linkItem?.label || '';
          
          return (
             <LinkRow 
               key={idx}
               url={url as string}
               label={label as string}
               readOnly={readOnly}
               onChange={(val) => handleUpdateLink(idx, val)}
               onDelete={() => handleDeleteLink(idx)}
             />
          );
        })}
      </div>
    </div>
  );
}

function LinkRow({ url, label, readOnly, onChange, onDelete }: { key?: React.Key; url: string; label: string; readOnly?: boolean; onChange: (v: DocumentLinkItem) => void; onDelete: () => void }) {
  const [isEditingUrl, setIsEditingUrl] = useState(!url);
  const [isPromptingNote, setIsPromptingNote] = useState(false);
  const [tempUrl, setTempUrl] = useState(url);
  const [tempLabel, setTempLabel] = useState(label);

  const handleUrlSubmit = () => {
    const trimmedUrl = tempUrl.trim();
    if (!trimmedUrl) return;

    let isValid = false;
    try {
      const parsedUrl = new URL(trimmedUrl);
      isValid = parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
    } catch (e) {
      isValid = false;
    }

    if (!isValid) {
      toast.error("URL không hợp lệ. Vui lòng nhập đúng định dạng (https://...)");
      return;
    }

    if (!tempLabel) {
      setIsPromptingNote(true);
      setIsEditingUrl(false);
    } else {
      setIsEditingUrl(false);
      onChange({ url: trimmedUrl, label: tempLabel });
    }
  };

  const handleNoteSubmit = () => {
    setIsPromptingNote(false);
    onChange({ url: tempUrl, label: tempLabel || tempUrl });
  };

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 flex items-center bg-slate-50 border border-slate-100 px-3 py-1 rounded-md min-w-0">
        <LinkIcon className="w-3 h-3 text-slate-400 shrink-0 mr-2" />
        
        {isEditingUrl && !readOnly ? (
          <div className="flex-1 flex items-center gap-2">
            <input
              type="text"
              autoFocus
              className="flex-1 text-[10px] bg-transparent outline-none font-sans"
              placeholder="Dán link hồ sơ..."
              value={tempUrl}
              onChange={(e) => setTempUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleUrlSubmit()}
            />
            <button 
              onClick={handleUrlSubmit}
              className="p-1 px-1.5 text-[9px] text-blue-600 bg-blue-100 hover:bg-blue-200 rounded transition-colors font-bold"
            >
              Lưu
            </button>
          </div>
        ) : isPromptingNote && !readOnly ? (
          <div className="flex-1 flex items-center gap-2">
            <span className="text-[10px] font-bold text-slate-500">Ghi chú:</span>
            <input
              type="text"
              autoFocus
              className="flex-1 text-[10px] bg-transparent outline-none font-sans"
              placeholder="Tên hoặc ghi chú cho link..."
              value={tempLabel}
              onChange={(e) => setTempLabel(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleNoteSubmit()}
            />
            <button 
              onClick={handleNoteSubmit}
              className="p-1 px-1.5 text-[9px] text-blue-600 bg-blue-100 hover:bg-blue-200 rounded transition-colors font-bold"
            >
              Lưu
            </button>
          </div>
        ) : (
          <div className="flex-1 flex items-center gap-3 overflow-hidden">
             <a 
               href={url} 
               target="_blank" 
               rel="noreferrer" 
               className="text-[10px] text-blue-600 hover:text-blue-700 hover:underline underline-offset-2 transition-colors font-sans truncate block"
               title={url}
             >
               {label || url}
             </a>
             {!readOnly && (
               <button
                 onClick={() => {
                   setIsEditingUrl(true);
                   setTempUrl(url);
                 }}
                 className="text-slate-400 hover:text-blue-600 transition-colors ml-auto shrink-0 flex items-center"
                 title="Sửa link/ghi chú"
               >
                 <Edit2 className="w-2.5 h-2.5" />
               </button>
             )}
          </div>
        )}

        {!isEditingUrl && !isPromptingNote && url && (
          <div className="flex items-center gap-1.5 ml-2 shrink-0">
            <a href={url} target="_blank" rel="noreferrer" className="text-blue-600 hover:text-blue-700 bg-white p-1 rounded border border-slate-200 shadow-sm transition-colors" title="Mở link">
              <ExternalLink className="w-3 h-3" />
            </a>
            <button 
              onClick={(e) => {
                e.preventDefault();
                navigator.clipboard.writeText(url);
                toast.success('Đã copy đường dẫn');
              }}
              className="text-slate-500 hover:text-blue-600 bg-white p-1 rounded border border-slate-200 shadow-sm transition-colors"
              title="Copy link"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
            </button>
          </div>
        )}
      </div>
        
      {!readOnly && (
        <button
          onClick={onDelete}
          className="text-slate-300 hover:text-red-500 transition-colors shrink-0"
          title="Xóa link"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
