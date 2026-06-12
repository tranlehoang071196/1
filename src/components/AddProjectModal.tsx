import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Layout } from 'lucide-react';

interface AddProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  isSubmitting?: boolean;
}

export const AddProjectModal = ({ isOpen, onClose, onSubmit, isSubmitting }: AddProjectModalProps) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={!isSubmitting ? onClose : undefined}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" 
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-white w-full max-w-md rounded-2xl shadow-2xl relative z-10 overflow-hidden"
          >
            <div className="p-8">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white shadow-lg shadow-blue-600/20">
                    <Layout className="w-4 h-4" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">Dự án mới</h3>
                </div>
                <button 
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400 hover:text-slate-600 disabled:opacity-50"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={onSubmit} className="space-y-6">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-1">Tên dự án</label>
                  <input 
                    name="name"
                    required
                    autoFocus
                    disabled={isSubmitting}
                    placeholder="VD: ADB 1.3 - Đoạn qua TP. Tam Kỳ"
                    className="w-full px-4 h-12 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium focus:border-blue-600 focus:bg-white outline-none transition-all placeholder:text-slate-300 disabled:opacity-50"
                  />
                </div>
                
                <input type="hidden" name="projectType" value="both" />

                <div className="pt-4">
                  <button 
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full h-12 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-600/20 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Đang khởi tạo...
                      </>
                    ) : (
                      'Khởi tạo dự án'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
