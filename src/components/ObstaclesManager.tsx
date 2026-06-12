import React, { useState, useEffect } from 'react';
import { Project, Obstacle, STEP_LABELS } from '../types';
import { collection, doc, setDoc, deleteDoc, getDocs, updateDoc, serverTimestamp, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Plus, Trash2, CheckCircle2, ChevronDown, ChevronUp, AlertCircle, Link } from 'lucide-react';
import { auth } from '../lib/firebase';
import { cn } from '../lib/utils';
import { ResolutionModal } from './ResolutionModal';
import { updateStepStatus } from '../lib/projectService';

interface ObstaclesManagerProps {
  project: Project;
  canEdit: boolean;
}

type TabType = 'inventory' | 'public' | 'payment';

export const ObstaclesManager = ({ project, canEdit }: ObstaclesManagerProps) => {
  const [activeTab, setActiveTab] = useState<TabType>('inventory');
  const [obstacles, setObstacles] = useState<Obstacle[]>([]);
  const [obstaclesCache, setObstaclesCache] = useState<Record<string, Obstacle[]>>({});
  const [isLoading, setIsLoading] = useState(false);
  
  // States for adding/editing
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Obstacle>>({});

  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'resolved'>('all');
  const [isExpanded, setIsExpanded] = useState(false); // To toggle the whole section

  // Resolution modal states
  const [isResolutionOpen, setIsResolutionOpen] = useState(false);
  const [selectedObstacle, setSelectedObstacle] = useState<Obstacle | null>(null);

  const getTotal = (step: any, field: 'plots' | 'households' | 'donePlots' | 'doneHouseholds' | 'totalPlots' | 'totalHouseholds') => {
    if (!step) return 0;
    if (step.rounds && step.rounds.length > 0) {
      return step.rounds.reduce((acc: number, r: any) => acc + (r[field] || 0), 0);
    }
    return step[field] || 0;
  };

  const getAffected = () => {
    let p = 0;
    if (project.projectType === 'agri' || project.projectType === 'both') {
      p += project.steps.inventory_agri?.totalPlots || project.steps.inventory_agri?.totalHouseholds || 0;
    }
    if (project.projectType === 'resident' || project.projectType === 'both') {
      p += project.steps.inventory_resident?.totalPlots || project.steps.inventory_resident?.totalHouseholds || 0;
    }
    return p;
  };

  const getInventoried = () => {
    let p = 0;
    if (project.projectType === 'agri' || project.projectType === 'both') {
      p += project.steps.inventory_agri?.donePlots || project.steps.inventory_agri?.doneHouseholds || 0;
    }
    if (project.projectType === 'resident' || project.projectType === 'both') {
      p += project.steps.inventory_resident?.donePlots || project.steps.inventory_resident?.doneHouseholds || 0;
    }
    return p;
  };

  const getAppraisalSubmitted = () => {
    let p = 0;
    if (project.projectType === 'agri' || project.projectType === 'both') {
      p += getTotal(project.steps.agri_appraisal_submit, 'plots') || getTotal(project.steps.agri_appraisal_submit, 'households') || 0;
    }
    if (project.projectType === 'resident' || project.projectType === 'both') {
      p += getTotal(project.steps.res_appraisal_submit, 'plots') || getTotal(project.steps.res_appraisal_submit, 'households') || 0;
    }
    return p;
  };

  const getApproved = () => {
    let p = 0;
    if (project.projectType === 'agri' || project.projectType === 'both') {
      p += getTotal(project.steps.agri_approval, 'plots') || getTotal(project.steps.agri_approval, 'households') || 0;
    }
    if (project.projectType === 'resident' || project.projectType === 'both') {
      p += getTotal(project.steps.res_approval, 'plots') || getTotal(project.steps.res_approval, 'households') || 0;
    }
    return p;
  };

  const getPaid = () => {
    let p = 0;
    if (project.projectType === 'agri' || project.projectType === 'both') {
      p += getTotal(project.steps.agri_payment, 'plots') || getTotal(project.steps.agri_payment, 'donePlots') || getTotal(project.steps.agri_payment, 'households') || getTotal(project.steps.agri_payment, 'doneHouseholds') || 0;
    }
    if (project.projectType === 'resident' || project.projectType === 'both') {
      p += getTotal(project.steps.res_payment, 'plots') || getTotal(project.steps.res_payment, 'donePlots') || getTotal(project.steps.res_payment, 'households') || getTotal(project.steps.res_payment, 'doneHouseholds') || 0;
    }
    return p;
  };

  const affected = getAffected();
  const inventoried = getInventoried();
  const appraisalSubmitted = getAppraisalSubmitted();
  const approved = getApproved();
  const paid = getPaid();

  const inventoryDiff = Math.max(0, affected - inventoried);
  const publicDiff = Math.max(0, inventoried - appraisalSubmitted);
  const paymentDiff = Math.max(0, approved - paid);

  const showInventory = inventoryDiff > 0;
  const showPublic = publicDiff > 0;
  const showPayment = paymentDiff > 0;

  const shouldShowSection = showInventory || showPublic || showPayment;

  const getAllowableCapacity = (type: 'inventory' | 'public' | 'payment', landType: 'agri' | 'resident'): number => {
    if (landType === 'agri') {
      if (type === 'inventory') {
        const total = project.steps.inventory_agri?.totalHouseholds || 0;
        const done = project.steps.inventory_agri?.doneHouseholds || 0;
        return Math.max(0, total - done);
      } else if (type === 'public') {
        const inventoried = project.steps.inventory_agri?.doneHouseholds || 0;
        const appraisal = getTotal(project.steps.agri_appraisal_submit, 'households') || 0;
        return Math.max(0, inventoried - appraisal);
      } else if (type === 'payment') {
        const approved = getTotal(project.steps.agri_approval, 'households') || 0;
        const paid = getTotal(project.steps.agri_payment, 'households') || getTotal(project.steps.agri_payment, 'doneHouseholds') || 0;
        return Math.max(0, approved - paid);
      }
    } else {
      if (type === 'inventory') {
        const total = project.steps.inventory_resident?.totalHouseholds || 0;
        const done = project.steps.inventory_resident?.doneHouseholds || 0;
        return Math.max(0, total - done);
      } else if (type === 'public') {
        const inventoried = project.steps.inventory_resident?.doneHouseholds || 0;
        const appraisal = getTotal(project.steps.res_appraisal_submit, 'households') || 0;
        return Math.max(0, inventoried - appraisal);
      } else if (type === 'payment') {
        const approved = getTotal(project.steps.res_approval, 'households') || 0;
        const paid = getTotal(project.steps.res_payment, 'households') || getTotal(project.steps.res_payment, 'doneHouseholds') || 0;
        return Math.max(0, approved - paid);
      }
    }
    return 0;
  };

  const getObstacleLandType = (o: Obstacle) => o.landType || (project.projectType === 'resident' ? 'resident' : 'agri');

  useEffect(() => {
    setObstaclesCache({});
  }, [project.id]);

  useEffect(() => {
    if (shouldShowSection && isExpanded) {
      if (!obstaclesCache[activeTab]) {
        loadObstacles();
      } else {
        setObstacles(obstaclesCache[activeTab]);
      }
    }
  }, [project.id, activeTab, isExpanded]);

  const loadObstacles = async () => {
    try {
      setIsLoading(true);
      const querySnapshot = await getDocs(
        query(
          collection(db, `projects/${project.id}/obstacles`),
          where('type', '==', activeTab)
        )
      );
      const data: Obstacle[] = [];
      querySnapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() } as Obstacle);
      });
      setObstacles(data);
      setObstaclesCache(prev => ({ ...prev, [activeTab]: data }));
    } catch (err) {
      console.error(err);
      toast.error('Lỗi khi tải danh sách vướng mắc');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    const isMulti = formData.obstacleScope === 'multi';

    if (!formData.ownerName?.trim() || !formData.issue?.trim()) {
      toast.error(isMulti ? 'Vui lòng nhập tên danh mục vướng mắc và nội dung!' : 'Vui lòng nhập tên chủ sử dụng và nội dung vướng mắc!');
      return;
    }

    if (isMulti && (!formData.totalHouseholds || Number(formData.totalHouseholds) <= 0)) {
      toast.error('Vui lòng nhập tổng số hộ vướng mắc lớn hơn 0!');
      return;
    }

    // Determine target land type and check actual limit of outstanding households
    const selectedLandType = (formData.landType || (project.projectType === 'resident' ? 'resident' : 'agri')) as 'agri' | 'resident';
    const capacity = getAllowableCapacity(activeTab, selectedLandType);
    
    // Sum of OTHER pending households of the same type and landType
    const otherPendingSum = obstacles
      .filter(o => o.type === activeTab && getObstacleLandType(o) === selectedLandType && o.status === 'pending' && o.id !== editingId)
      .reduce((sum, o) => {
        if (o.obstacleScope === 'multi') {
          const remainingPending = (o.totalHouseholds || 0) - (o.resolvedHouseholds || 0);
          return sum + Math.max(0, remainingPending);
        }
        return sum + 1;
      }, 0);

    const limit = Math.max(0, capacity - otherPendingSum);
    const requestedHH = isMulti ? Number(formData.totalHouseholds) : 1;

    // Only enforce if the obstacle status is pending (since resolved ones are already completed in the process)
    if ((formData.status || 'pending') === 'pending' && requestedHH > limit) {
      toast.error(`Số lượng hộ vướng mắc (${requestedHH} hộ) vượt quá khả năng cho phép (Tối đa: ${limit} hộ cho ${selectedLandType === 'agri' ? 'Đất nông nghiệp' : 'Đất ở'}). Vui lòng kiểm tra lại số liệu thực hiện dự án.`);
      return;
    }

    try {
      if (editingId) {
        await updateDoc(doc(db, `projects/${project.id}/obstacles`, editingId), {
          ...formData,
          landType: selectedLandType,
          totalHouseholds: isMulti ? Number(formData.totalHouseholds) : 1,
          resolvedHouseholds: isMulti ? Number(formData.resolvedHouseholds || 0) : 0,
          updatedAt: new Date().toISOString()
        });
        toast.success('Cập nhật thành công');
      } else {
        const newId = Math.random().toString(36).substr(2, 9);
        const obstacle: Obstacle = {
          id: newId,
          type: activeTab,
          landType: selectedLandType,
          ownerName: formData.ownerName?.trim() || '',
          address: isMulti ? '' : (formData.address || ''),
          phone: isMulti ? '' : (formData.phone || ''),
          issue: formData.issue?.trim() || '',
          resolution: formData.resolution || '',
          result: formData.result || '',
          status: formData.status || 'pending',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: auth.currentUser?.uid || '',
          obstacleScope: formData.obstacleScope || 'single',
          totalHouseholds: isMulti ? Number(formData.totalHouseholds) : 1,
          resolvedHouseholds: isMulti ? Number(formData.resolvedHouseholds || 0) : 0,
          landPlot: isMulti ? '' : (formData.landPlot || '')
        };
        await setDoc(doc(db, `projects/${project.id}/obstacles`, newId), obstacle);
        toast.success('Đã ghi nhận vướng mắc');
      }
      setIsAdding(false);
      setEditingId(null);
      setFormData({});
      loadObstacles();
    } catch (err) {
      console.error(err);
      toast.error('Lỗi khi lưu dữ liệu');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bạn có chắc chắn muốn xoá vướng mắc này?')) return;
    try {
      await deleteDoc(doc(db, `projects/${project.id}/obstacles`, id));
      toast.success('Đã xoá thành công');
      loadObstacles();
    } catch (err) {
      console.error(err);
      toast.error('Lỗi khi xoá');
    }
  };

  const toggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'pending' ? 'resolved' : 'pending';
    try {
      const obstacleToUpdate = obstacles.find(o => o.id === id);
      const updates: any = {
        status: newStatus,
        updatedAt: new Date().toISOString()
      };
      
      if (obstacleToUpdate?.obstacleScope === 'multi' && newStatus === 'pending') {
        updates.resolvedHouseholds = 0;
      } else if (obstacleToUpdate?.obstacleScope === 'multi' && newStatus === 'resolved') {
        updates.resolvedHouseholds = obstacleToUpdate.totalHouseholds || 0;
      }

      await updateDoc(doc(db, `projects/${project.id}/obstacles`, id), updates);
      toast.success(newStatus === 'resolved' ? 'Đã đánh dấu xử lý xong' : 'Đã chuyển về chưa xử lý');
      loadObstacles();
    } catch (err) {
      console.error(err);
      toast.error('Lỗi cập nhật trạng thái');
    }
  };

  const handleConfirmResolution = async (data: {
    createTally: boolean;
    stepKey: string;
    donePlots: number;
    doneHouseholds: number;
    resolvedHHToAdd: number;
    markAsFullyResolved: boolean;
  }) => {
    if (!selectedObstacle) return;

    try {
      const isMulti = selectedObstacle.obstacleScope === 'multi';
      let newStatus: 'pending' | 'resolved' = 'pending';
      let nextResolvedCount = selectedObstacle.resolvedHouseholds || 0;

      if (isMulti) {
        nextResolvedCount = Math.min(
          selectedObstacle.totalHouseholds || 0,
          nextResolvedCount + data.resolvedHHToAdd
        );
        newStatus = nextResolvedCount >= (selectedObstacle.totalHouseholds || 0) ? 'resolved' : 'pending';
      } else {
        newStatus = 'resolved';
      }

      // 1. Cập nhật dữ liệu vướng mắc trong DB
      const obsUpdates: any = {
        status: newStatus,
        updatedAt: new Date().toISOString()
      };
      if (isMulti) {
        obsUpdates.resolvedHouseholds = nextResolvedCount;
      }
      await updateDoc(doc(db, `projects/${project.id}/obstacles`, selectedObstacle.id), obsUpdates);

      // 2. Tạo đợt tự động
      if (data.createTally) {
        const stepKey = data.stepKey;
        const stepData = project.steps[stepKey] as any;
        const rounds = stepData?.rounds || [];

        const newRound: any = {
          id: Date.now().toString() + '_' + Math.random().toString(36).substr(2, 5),
          name: isMulti
            ? `Giải quyết VM chung: ${selectedObstacle.ownerName} (+${data.resolvedHHToAdd} hộ)`
            : `Giải quyết VM hộ: ${selectedObstacle.ownerName}`,
          status: 'completed',
          date: new Date().toISOString().split('T')[0],
          // Support both donePlots/doneHouseholds and plots/households keys
          donePlots: data.donePlots,
          doneHouseholds: data.doneHouseholds,
          plots: data.donePlots,
          households: data.doneHouseholds,
          obstacleId: selectedObstacle.id,
          obstacleInfo: isMulti
            ? `VM chung "${selectedObstacle.ownerName}" - đợt ${data.resolvedHHToAdd} hộ`
            : `Hộ "${selectedObstacle.ownerName}"` + (selectedObstacle.landPlot ? ` - Thửa: ${selectedObstacle.landPlot}` : '')
        };

        const newRounds = [...rounds, newRound];
        const totalDonePlots = newRounds.reduce((sum, r) => sum + (Number(r.plots || r.donePlots || 0)), 0);
        const totalDoneHouseholds = newRounds.reduce((sum, r) => sum + (Number(r.households || r.doneHouseholds || 0)), 0);
        const totalAmount = newRounds.reduce((sum, r) => sum + (Number(r.amount || 0)), 0);
        const totalCost = newRounds.reduce((sum, r) => sum + (Number(r.cost || 0)), 0);

        await updateStepStatus(project.id, stepKey, {
          ...stepData,
          rounds: newRounds,
          donePlots: totalDonePlots,
          doneHouseholds: totalDoneHouseholds,
          plots: totalDonePlots,
          households: totalDoneHouseholds,
          amount: totalAmount,
          cost: totalCost
        });

        const stepLabel = STEP_LABELS[stepKey] || 'đợt thực hiện';
        toast.success(
          isMulti
            ? `Đã cập nhật giải quyết vướng mắc (${nextResolvedCount}/${selectedObstacle.totalHouseholds} hộ) và tự động ghi nhận ${stepLabel} thành công!`
            : `Đã hoàn thành vướng mắc và tự động ghi nhận ${stepLabel} thành công!`
        );
      } else {
        toast.success(
          isMulti
            ? `Đã cập nhật giải quyết vướng mắc (${nextResolvedCount}/${selectedObstacle.totalHouseholds} hộ)!`
            : `Đã hoàn thành vướng mắc!`
        );
      }

      setIsResolutionOpen(false);
      setSelectedObstacle(null);
      loadObstacles();
    } catch (err) {
      console.error(err);
      toast.error('Gặp lỗi khi ghi nhận giải quyết vướng mắc');
    }
  };

  if (!shouldShowSection) return null;

  const currentTabObstacles = obstacles.filter(o => o.type === activeTab && (filterStatus === 'all' || o.status === filterStatus));
  const pendingTabCount = obstacles.filter(o => o.type === activeTab && o.status === 'pending').length;

  return (
    <div className="bg-white rounded-2xl border border-red-200 shadow-sm overflow-hidden mt-8 mb-8">
      <div 
        className="p-5 flex items-center justify-between cursor-pointer bg-red-50 hover:bg-red-100/50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3 text-red-700">
          <AlertCircle className="w-5 h-5" />
          <h3 className="text-sm font-bold uppercase tracking-wider">Quản lý Vướng mắc</h3>
          <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded-lg font-semibold border border-red-200">
            {inventoryDiff + publicDiff + paymentDiff} trường hợp
          </span>
        </div>
        {isExpanded ? <ChevronUp className="w-5 h-5 text-red-400" /> : <ChevronDown className="w-5 h-5 text-red-400" />}
      </div>

      {isExpanded && (
        <div className="p-6 border-t border-red-100">
          <div className="flex gap-4 border-b border-slate-100 pb-px mb-6 overflow-x-auto no-scrollbar whitespace-nowrap scroll-smooth">
            <button
              onClick={() => setActiveTab('inventory')}
              className={cn(
                "pb-3 text-sm font-bold transition-all relative flex-shrink-0",
                activeTab === 'inventory' ? "text-blue-600" : "text-slate-400 hover:text-slate-600"
              )}
            >
              Kiểm đếm
              <span className="ml-2 text-xs bg-slate-150/80 text-slate-600 px-2 py-0.5 rounded-full font-semibold">{inventoryDiff}</span>
              {activeTab === 'inventory' && <motion.div layoutId="obstacles-tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />}
            </button>
            <button
               onClick={() => setActiveTab('public')}
              className={cn(
                "pb-3 text-sm font-bold transition-all relative flex-shrink-0",
                activeTab === 'public' ? "text-blue-600" : "text-slate-400 hover:text-slate-600"
              )}
            >
              Công khai (Thẩm định)
              <span className="ml-2 text-xs bg-slate-150/80 text-slate-600 px-2 py-0.5 rounded-full font-semibold">{publicDiff}</span>
              {activeTab === 'public' && <motion.div layoutId="obstacles-tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />}
            </button>
            <button
               onClick={() => setActiveTab('payment')}
              className={cn(
                "pb-3 text-sm font-bold transition-all relative flex-shrink-0",
                activeTab === 'payment' ? "text-blue-600" : "text-slate-400 hover:text-slate-600"
              )}
            >
              Chi trả
              <span className="ml-2 text-xs bg-slate-150/80 text-slate-600 px-2 py-0.5 rounded-full font-semibold">{paymentDiff}</span>
              {activeTab === 'payment' && <motion.div layoutId="obstacles-tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />}
            </button>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <div className="flex bg-slate-100 p-1 rounded-lg w-full sm:w-auto overflow-x-auto no-scrollbar">
              <button 
                onClick={() => setFilterStatus('all')}
                className={cn("flex-1 sm:flex-none px-3 py-2 text-xs font-bold rounded-md transition-all whitespace-nowrap min-h-[40px] flex items-center justify-center", filterStatus === 'all' ? "bg-white text-slate-800 shadow-sm" : "text-slate-500")}
              >
                Tất cả
              </button>
              <button 
                onClick={() => setFilterStatus('pending')}
                className={cn("flex-1 sm:flex-none px-3 py-2 text-xs font-bold rounded-md transition-all whitespace-nowrap min-h-[40px] flex items-center justify-center", filterStatus === 'pending' ? "bg-white text-amber-600 shadow-sm" : "text-slate-500")}
              >
                Chưa xử lý
              </button>
              <button 
                onClick={() => setFilterStatus('resolved')}
                className={cn("flex-1 sm:flex-none px-3 py-2 text-xs font-bold rounded-md transition-all whitespace-nowrap min-h-[40px] flex items-center justify-center", filterStatus === 'resolved' ? "bg-white text-emerald-600 shadow-sm" : "text-slate-500")}
              >
                Đã xử lý
              </button>
            </div>

            {canEdit && !isAdding && (
              <button 
                onClick={() => {
                  const defaultLandType = project.projectType === 'resident' ? 'resident' : 'agri';
                  setFormData({ 
                    status: 'pending',
                    obstacleScope: 'single',
                    landType: defaultLandType
                  });
                  setEditingId(null);
                  setIsAdding(true);
                }}
                className="text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 px-4 h-11 md:h-10 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm w-full sm:w-auto"
              >
                <Plus className="w-4 h-4" /> Thêm vướng mắc
              </button>
            )}
          </div>

          {isAdding && (
            <div className="bg-blue-50/50 p-5 rounded-xl border border-blue-100 mb-6 font-sans">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Hình thức vướng mắc</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setFormData({ 
                          ...formData, 
                          obstacleScope: 'single',
                          totalHouseholds: 1,
                          resolvedHouseholds: 0
                        });
                      }}
                      className={cn(
                        "flex-1 px-3 py-2 text-xs rounded-xl font-bold border transition-all text-center",
                        (formData.obstacleScope || 'single') === 'single'
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-55'
                      )}
                    >
                      Hộ đơn lẻ
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFormData({ 
                          ...formData, 
                          obstacleScope: 'multi', 
                          totalHouseholds: formData.totalHouseholds || 5,
                          resolvedHouseholds: formData.resolvedHouseholds || 0
                        });
                      }}
                      className={cn(
                        "flex-1 px-3 py-2 text-xs rounded-xl font-bold border transition-all text-center",
                        formData.obstacleScope === 'multi'
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-55'
                      )}
                    >
                      Mục VM (nhiều hộ)
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Loại đất áp dụng</label>
                  <div className="flex gap-2">
                    {project.projectType !== 'resident' && (
                      <button
                        type="button"
                        onClick={() => {
                          setFormData({ 
                            ...formData, 
                            landType: 'agri'
                          });
                        }}
                        className={cn(
                          "flex-1 px-3 py-2 text-xs rounded-xl font-bold border transition-all text-center",
                          (formData.landType || (project.projectType as string === 'resident' ? 'resident' : 'agri')) === 'agri'
                            ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-55'
                        )}
                      >
                        🚜 Đất nông nghiệp
                      </button>
                    )}
                    {project.projectType !== 'agri' && (
                      <button
                        type="button"
                        onClick={() => {
                          setFormData({ 
                            ...formData, 
                            landType: 'resident'
                          });
                        }}
                        className={cn(
                          "flex-1 px-3 py-2 text-xs rounded-xl font-bold border transition-all text-center",
                          (formData.landType || (project.projectType as string === 'resident' ? 'resident' : 'agri')) === 'resident'
                            ? 'bg-red-600 text-white border-red-600 shadow-sm'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-55'
                        )}
                      >
                        🏠 Đất ở
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Limits informative panel */}
              {(() => {
                const selectedLandType = (formData.landType || (project.projectType === 'resident' ? 'resident' : 'agri')) as 'agri' | 'resident';
                const capacity = getAllowableCapacity(activeTab, selectedLandType);
                const otherPendingSum = obstacles
                  .filter(o => o.type === activeTab && getObstacleLandType(o) === selectedLandType && o.status === 'pending' && o.id !== editingId)
                  .reduce((sum, o) => {
                    if (o.obstacleScope === 'multi') {
                      const remainingPending = (o.totalHouseholds || 0) - (o.resolvedHouseholds || 0);
                      return sum + Math.max(0, remainingPending);
                    }
                    return sum + 1;
                  }, 0);
                const limit = Math.max(0, capacity - otherPendingSum);

                return (
                  <div className="mb-4 text-xs font-semibold text-slate-600 bg-white/75 p-3 rounded-xl border border-slate-100 flex items-center justify-between shadow-xs">
                    <span>
                      Giới hạn vướng mắc chưa xử lý có thể lập cho <span className="text-blue-600 font-extrabold">{selectedLandType === 'agri' ? 'Đất nông nghiệp' : 'Đất ở'}</span>:
                    </span>
                    <span className="font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-100 font-mono">
                      Tối đa {limit} hộ
                    </span>
                  </div>
                );
              })()}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className={cn("col-span-1", (formData.obstacleScope || 'single') === 'multi' ? "md:col-span-2" : "md:col-span-1")}>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    {formData.obstacleScope === 'multi' ? 'Tên danh mục vướng mắc' : 'Tên chủ sử dụng'} <span className="text-red-500">*</span>
                  </label>
                  <input 
                    type="text" 
                    placeholder={formData.obstacleScope === 'multi' ? 'Ví dụ: Đo đạc sai lệch ranh giới đồi đê, Đường điện chưa giải tỏa...' : 'Ví dụ: Hộ gia đình ông Nguyễn Văn A'}
                    value={formData.ownerName || ''}
                    onChange={e => setFormData({...formData, ownerName: e.target.value})}
                    className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-blue-500 bg-white"
                  />
                </div>

                {formData.obstacleScope === 'multi' ? (
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 font-sans">Tổng số hộ vướng mắc <span className="text-red-500">*</span></label>
                    <input 
                      type="number" 
                      min={1}
                      value={formData.totalHouseholds || ''}
                      onChange={e => setFormData({...formData, totalHouseholds: Math.max(1, Number(e.target.value))})}
                      className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-blue-500 bg-white font-bold"
                    />
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Thửa đất / Mã thửa</label>
                      <input 
                        type="text" 
                        placeholder="Ví dụ: Thửa 124, Tờ 04"
                        value={formData.landPlot || ''}
                        onChange={e => setFormData({...formData, landPlot: e.target.value})}
                        className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-blue-500 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 font-sans">SĐT</label>
                      <input 
                        type="text" 
                        value={formData.phone || ''}
                        onChange={e => setFormData({...formData, phone: e.target.value})}
                        className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-blue-500 bg-white"
                      />
                    </div>
                  </>
                )}

                {(formData.obstacleScope || 'single') === 'single' && (
                  <div className="col-span-full">
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Địa chỉ</label>
                    <input 
                      type="text" 
                      value={formData.address || ''}
                      onChange={e => setFormData({...formData, address: e.target.value})}
                      className="w-full text-xs border border-slate-250 rounded-lg px-3 py-2 outline-none focus:border-blue-500 bg-white"
                    />
                  </div>
                )}
              </div>
              <div className="mb-4">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Nội dung vướng mắc <span className="text-red-500">*</span></label>
                <textarea 
                  value={formData.issue || ''}
                  onChange={e => setFormData({...formData, issue: e.target.value})}
                  className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-blue-500 min-h-[60px] bg-white"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Hướng xử lý</label>
                  <textarea 
                    value={formData.resolution || ''}
                    onChange={e => setFormData({...formData, resolution: e.target.value})}
                    className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-blue-500 min-h-[60px] bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Kết quả xử lý</label>
                  <textarea 
                    value={formData.result || ''}
                    onChange={e => setFormData({...formData, result: e.target.value})}
                    className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-blue-500 min-h-[60px] bg-white"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <button 
                  onClick={() => setIsAdding(false)}
                  className="px-4 h-11 md:h-10 text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg min-w-[80px]"
                >
                  Hủy
                </button>
                <button 
                  onClick={handleSave}
                  className="px-4 h-11 md:h-10 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm min-w-[80px]"
                >
                  {editingId ? 'Cập nhật' : 'Lưu lại'}
                </button>
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="text-center py-12 text-slate-400 text-sm">Đang tải dữ liệu...</div>
          ) : currentTabObstacles.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 rounded-2xl border border-slate-100 border-dashed">
              <CheckCircle2 className="w-8 h-8 text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-slate-500">
                {(activeTab === 'inventory' && !showInventory) || 
                 (activeTab === 'public' && !showPublic) || 
                 (activeTab === 'payment' && !showPayment) 
                  ? "Không có vướng mắc." 
                  : "Chưa ghi nhận vướng mắc nào."}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {currentTabObstacles.map((obstacle) => (
                <div key={obstacle.id} className="bg-white border text-sm border-slate-200 rounded-xl p-4 shadow-sm relative group hover:border-blue-200 transition-colors">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1 min-w-0 pr-12">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h4 className={cn("font-bold text-base", obstacle.status === 'resolved' ? "text-slate-500 line-through" : "text-slate-800")}>{obstacle.ownerName}</h4>
                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-[10px] font-bold border whitespace-nowrap",
                          obstacle.obstacleScope === 'multi' 
                            ? "bg-purple-50 text-purple-700 border-purple-200" 
                            : "bg-blue-50 text-blue-700 border-blue-200"
                        )}>
                          {obstacle.obstacleScope === 'multi' ? 'Danh mục vướng mắc' : 'Hộ vướng mắc'}
                        </span>
                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-[10px] font-bold border whitespace-nowrap",
                          getObstacleLandType(obstacle) === 'resident'
                            ? "bg-red-50 text-red-700 border-red-200" 
                            : "bg-amber-50 text-amber-700 border-amber-200"
                        )}>
                          {getObstacleLandType(obstacle) === 'resident' ? '🏠 Đất ở' : '🚜 Đất nông nghiệp'}
                        </span>
                      </div>
                      
                      {obstacle.obstacleScope === 'multi' ? (
                        <div className="mt-2 mb-2 max-w-sm">
                          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                            <span className="font-semibold text-slate-600">Tiến độ giải quyết:</span>
                            <span className="font-bold text-slate-800 font-mono">
                              {obstacle.resolvedHouseholds || 0} / {obstacle.totalHouseholds || 0} hộ
                            </span>
                          </div>
                          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden border border-slate-200/50">
                            <div 
                              className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                              style={{ width: `${Math.min(100, (((obstacle.resolvedHouseholds || 0) / (obstacle.totalHouseholds || 1)) * 100))}%` }}
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="text-slate-500 text-xs mt-1 flex flex-wrap gap-x-4 gap-y-1">
                          {obstacle.phone && <span>📞 {obstacle.phone}</span>}
                          {obstacle.address && <span>📍 {obstacle.address}</span>}
                          {obstacle.landPlot && <span className="text-blue-600 font-semibold bg-blue-50/50 px-1.5 py-0.5 rounded border border-blue-100/50">🗺️ Thửa: {obstacle.landPlot}</span>}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 items-center flex-shrink-0">
                      <span className={cn(
                        "px-2.5 py-1 rounded-lg text-xs font-semibold uppercase tracking-wider border",
                        obstacle.status === 'resolved' ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"
                      )}>
                        {obstacle.status === 'resolved' ? 'Đã xử lý' : 'Chưa xử lý'}
                      </span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-slate-100">
                    <div>
                      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">Vướng mắc</span>
                      <p className="text-slate-700">{obstacle.issue}</p>
                    </div>
                    {obstacle.resolution && (
                      <div>
                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">Hướng xử lý</span>
                        <p className="text-slate-600">{obstacle.resolution}</p>
                      </div>
                    )}
                    {obstacle.result && (
                      <div className="col-span-full">
                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">Kết quả</span>
                        <p className="text-slate-600 bg-slate-50/80 p-3 rounded-lg border border-slate-100">{obstacle.result}</p>
                      </div>
                    )}
                  </div>
 
                   {canEdit && (
                    <div className="md:absolute md:top-4 md:right-4 flex md:opacity-0 md:group-hover:opacity-100 transition-opacity gap-2 bg-slate-50/50 md:bg-white p-2.5 rounded-lg border border-slate-100 md:border-0 md:p-0 select-none justify-end mt-4 md:mt-0">
                       <button
                         onClick={() => {
                           if (obstacle.status === 'pending') {
                             setSelectedObstacle(obstacle);
                             setIsResolutionOpen(true);
                           } else {
                             toggleStatus(obstacle.id, obstacle.status);
                           }
                         }}
                         className={cn("p-2 rounded-lg transition-colors border md:border-0 h-10 w-10 flex items-center justify-center", obstacle.status === 'resolved' ? "text-amber-500 bg-amber-50 hover:bg-amber-100" : "text-emerald-500 bg-emerald-50 hover:bg-emerald-100")}
                         title={obstacle.status === 'resolved' ? "Chuyển về chưa xử lý" : "Giải quyết vướng mắc / Cập nhật tiến độ"}
                       >
                         <CheckCircle2 className="w-4 h-4" />
                       </button>
                       <button
                         onClick={() => {
                           setFormData(obstacle);
                           setEditingId(obstacle.id);
                           setIsAdding(true);
                         }}
                         className="h-10 text-blue-500 bg-blue-50/70 hover:bg-blue-100/80 rounded-lg transition-colors text-xs font-bold px-4 flex items-center justify-center border border-blue-100 md:border-0"
                       >
                         Sửa
                       </button>
                       <button
                         onClick={() => handleDelete(obstacle.id)}
                         className="p-2 text-red-500 bg-red-50 hover:bg-red-100 rounded-lg transition-colors border border-red-100 md:border-0 h-10 w-10 flex items-center justify-center"
                       >
                         <Trash2 className="w-4 h-4" />
                       </button>
                    </div>
                  )}
 
                   <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-400 font-normal">
                      <span>Cập nhật: {new Date(obstacle.updatedAt).toLocaleString('vi-VN')}</span>
                   </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <ResolutionModal
        isOpen={isResolutionOpen}
        onClose={() => {
          setIsResolutionOpen(false);
          setSelectedObstacle(null);
        }}
        obstacle={selectedObstacle}
        project={project}
        onConfirm={handleConfirmResolution}
      />
    </div>
  );
}
