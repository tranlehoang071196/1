import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Project, Obstacle } from '../types';
import { NumberInput } from './ui-primitives';
import { Check, X, HelpCircle, Layers, Users } from 'lucide-react';

interface ResolutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  obstacle: Obstacle | null;
  project: Project;
  onConfirm: (data: {
    createTally: boolean;
    stepKey: string;
    donePlots: number;
    doneHouseholds: number;
    resolvedHHToAdd: number;
    markAsFullyResolved: boolean;
  }) => Promise<void>;
}

export const ResolutionModal = ({
  isOpen,
  onClose,
  obstacle,
  project,
  onConfirm
}: ResolutionModalProps) => {
  const [createTally, setCreateTally] = useState(true);
  const [stepKey, setStepKey] = useState<string>('inventory_agri');
  
  // Single household states
  const [donePlots, setDonePlots] = useState<number>(1);
  const [doneHouseholds, setDoneHouseholds] = useState<number>(1);

  // Group multiple households states
  const [resolvedHHToAdd, setResolvedHHToAdd] = useState<number>(1);
  const [donePlotsMulti, setDonePlotsMulti] = useState<number>(1);

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (obstacle) {
      if (obstacle.obstacleScope === 'multi') {
        const remaining = (obstacle.totalHouseholds || 0) - (obstacle.resolvedHouseholds || 0);
        setResolvedHHToAdd(remaining > 0 ? remaining : 1);
        setDonePlotsMulti(remaining > 0 ? remaining : 1);
      } else {
        setDonePlots(1);
        setDoneHouseholds(1);
      }
      
      // Auto-switch stepKey based on projectType and obstacle type
      if (obstacle.type === 'public') {
        if (project.projectType === 'resident') {
          setStepKey('res_appraisal_submit');
        } else {
          setStepKey('agri_appraisal_submit');
        }
      } else if (obstacle.type === 'payment') {
        if (project.projectType === 'resident') {
          setStepKey('res_payment');
        } else {
          setStepKey('agri_payment');
        }
      } else {
        if (project.projectType === 'resident') {
          setStepKey('inventory_resident');
        } else {
          setStepKey('inventory_agri');
        }
      }
    }
  }, [obstacle, project.projectType]);

  if (!obstacle) return null;

  const isMulti = obstacle.obstacleScope === 'multi';
  const total = obstacle.totalHouseholds || 0;
  const currentResolved = obstacle.resolvedHouseholds || 0;
  const remaining = Math.max(0, total - currentResolved);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const hhToAdd = isMulti ? resolvedHHToAdd : doneHouseholds;
      const plots = isMulti ? donePlotsMulti : donePlots;
      
      // Check if this action fully resolves the multi-household obstacle
      const markAsFullyResolved = !isMulti || (currentResolved + hhToAdd >= total);

      await onConfirm({
        createTally,
        stepKey,
        donePlots: plots,
        doneHouseholds: hhToAdd,
        resolvedHHToAdd: hhToAdd,
        markAsFullyResolved
      });
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Dialog Body */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: 'spring', duration: 0.35 }}
            className="bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-md relative z-10 overflow-hidden"
          >
            <div className="p-6">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-5">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Check className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">Giải quyết vướng mắc</h3>
                  <p className="text-xs text-slate-500 font-medium truncate max-w-xs">{obstacle.ownerName}</p>
                </div>
                <button
                  onClick={onClose}
                  className="ml-auto w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 flex items-center justify-center transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {isMulti ? (
                  <div className="bg-slate-50/70 rounded-xl p-3 border border-slate-100">
                    <div className="flex items-center justify-between text-xs text-slate-600 mb-1 font-medium">
                      <span>Vướng mắc chung:</span>
                      <span className="font-bold text-slate-800">{currentResolved} / {total} hộ xong</span>
                    </div>
                    {/* Progress bar */}
                    <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                      <div 
                        className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                        style={{ width: `${(currentResolved / total) * 100}%` }}
                      />
                    </div>
                    <div className="mt-3.5 space-y-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-tighter mb-1.5 flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-blue-500" />
                          Số hộ hoàn thành thêm đợt này <span className="text-red-500">*</span>
                        </label>
                        <div className="flex items-center gap-2">
                          <NumberInput
                            value={resolvedHHToAdd}
                            onChange={(val) => {
                              const v = Math.min(remaining, Math.max(1, val));
                              setResolvedHHToAdd(v);
                              // Auto-sync plot count to match household count by default
                              setDonePlotsMulti(v);
                            }}
                            className="w-24 bg-white border border-slate-250 rounded-lg px-2.5 py-1.5 text-xs font-bold text-center"
                          />
                          <span className="text-xs text-slate-500">hộ (còn lại {remaining} hộ vướng)</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-slate-50/50 rounded-xl border border-slate-100 flex items-start gap-2.5 text-xs text-slate-600">
                    <HelpCircle className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                    <div>
                      Hộ này đang vướng mắc phần <span className="font-bold text-slate-800 uppercase text-[10px]">
                        {obstacle.type === 'inventory' ? 'Kiểm đếm' : obstacle.type === 'public' ? 'Công khai (Thẩm định)' : 'Chi trả'}
                      </span>. Bạn muốn xác nhận giải quyết xong và {
                        obstacle.type === 'inventory' 
                          ? 'tạo đợt kiểm đếm tự động hay không?' 
                          : obstacle.type === 'public'
                            ? 'tạo đợt trình phương án thẩm định tự động hay không?'
                            : 'tạo đợt chi trả tiền tự động hay không?'
                      }
                    </div>
                  </div>
                )}

                {/* Option to create a Tally round */}
                <div className="border border-slate-200/80 rounded-xl p-4 space-y-3">
                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={createTally}
                      onChange={(e) => setCreateTally(e.target.checked)}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500/20"
                    />
                    <span className="text-xs font-bold text-slate-800">
                      {
                        obstacle.type === 'inventory'
                          ? 'Tự động thêm vào đợt kiểm đếm'
                          : obstacle.type === 'public'
                            ? 'Tự động thêm vào Trình phương án thẩm định'
                            : 'Tự động thêm vào đợt chi trả tiền'
                      }
                    </span>
                  </label>

                  {createTally && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="pl-6 pt-1 space-y-3 border-l border-slate-100"
                    >
                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1.5">Đất áp dụng</label>
                        <div className="flex gap-2">
                          {project.projectType !== 'resident' && (
                            <button
                              type="button"
                              onClick={() => {
                                if (obstacle.type === 'public') {
                                  setStepKey('agri_appraisal_submit');
                                } else if (obstacle.type === 'payment') {
                                  setStepKey('agri_payment');
                                } else {
                                  setStepKey('inventory_agri');
                                }
                              }}
                              className={`px-3 py-1.5 text-xs rounded-lg font-bold border transition-all ${
                                stepKey.startsWith('agri_') || stepKey === 'inventory_agri'
                                  ? 'bg-blue-50 text-blue-600 border-blue-200'
                                  : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                              }`}
                            >
                              Đất nông nghiệp
                            </button>
                          )}
                          {project.projectType !== 'agri' && (
                            <button
                              type="button"
                              onClick={() => {
                                if (obstacle.type === 'public') {
                                  setStepKey('res_appraisal_submit');
                                } else if (obstacle.type === 'payment') {
                                  setStepKey('res_payment');
                                } else {
                                  setStepKey('inventory_resident');
                                }
                              }}
                              className={`px-3 py-1.5 text-xs rounded-lg font-bold border transition-all ${
                                stepKey.startsWith('res_') || stepKey === 'inventory_resident'
                                  ? 'bg-blue-50 text-blue-600 border-blue-200'
                                  : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                              }`}
                            >
                              Đất ở
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 pt-1">
                        <div>
                          <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1 flex items-center gap-1">
                            <Layers className="w-3 h-3 text-emerald-500" /> Số thửa đất
                          </label>
                          <NumberInput
                            value={isMulti ? donePlotsMulti : donePlots}
                            onChange={(val) => {
                              const v = Math.max(0, val);
                              if (isMulti) setDonePlotsMulti(v);
                              else setDonePlots(v);
                            }}
                            className="w-full bg-white border border-slate-250 rounded-lg px-2 py-1.5 text-xs font-bold text-center"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1 flex items-center gap-1">
                            <Users className="w-3 h-3 text-blue-500" /> Số hộ
                          </label>
                          <div className="w-full bg-slate-100 text-slate-700 border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold text-center select-none">
                            {isMulti ? resolvedHHToAdd : doneHouseholds}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 h-10 text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-all min-w-[80px]"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 h-10 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all shadow-sm min-w-[100px] flex items-center justify-center gap-1.5"
                  >
                    {isSubmitting ? (
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      'Xác nhận'
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
