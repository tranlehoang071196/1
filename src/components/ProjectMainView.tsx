import React, { useState, useEffect } from 'react';
import { Project, STEP_CATEGORIES, STEP_LABELS } from '../types';
import { cn } from '../lib/utils';
import { ChevronDown, ChevronUp, Plus, GripVertical, Trash2, X, Users, Clock, CheckCircle2, Activity, ExternalLink, AlertTriangle, CalendarDays, ChevronRight, Clock3 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ProjectHeader } from './ProjectHeader';
import { ObstaclesManager } from './ObstaclesManager';
import { StepDetail, checkInventoryCompleted } from './StepDetail';
import { addCustomStep, toggleDisabledStep, updateStepsOrder, deleteCustomStep, updateProjectField } from '../lib/projectService';
import { doc, updateDoc, serverTimestamp, collection, getDocs } from 'firebase/firestore';
import { db, OperationType, handleFirestoreError } from '../lib/firebase';
import { toast } from 'sonner';
import { CustomDatePicker, EditableInput } from './ui-primitives';
import { AppSelect } from './ui/AppSelect';
import { formatDistanceToNow, differenceInCalendarDays, startOfDay } from 'date-fns';
import { vi } from 'date-fns/locale';
import { parseDate, formatDate } from '../utils/dateUtils';
import { getCategoryStepsOrdered } from './steps/stepUtils';

interface ProjectMainViewProps {
  project: Project;
  isAdmin: boolean;
  canEdit: boolean;
  onProjectDeleted: () => void;
  globalAvailableUsers?: {id: string, email: string}[];
  globalUserRolesMap?: Record<string, string>;
  onRefreshGlobalUsers?: () => Promise<void>;
}

export const ProjectMainView = ({ 
  project, 
  isAdmin, 
  canEdit, 
  onProjectDeleted,
  globalAvailableUsers = [],
  globalUserRolesMap = {},
  onRefreshGlobalUsers
}: ProjectMainViewProps) => {
  const [activeCategoryId, setActiveCategoryId] = useState<string>('overview');
  const [activeStepKey, setActiveStepKey] = useState<string | null>('overview');
  const [configCategoryId, setConfigCategoryId] = useState<string>('preparation');

  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    'preparation': false,
    'execution_detail': false
  });
  
  const [expandedRounds, setExpandedRounds] = useState<Record<string, boolean>>({});
  const [isReorderingMode, setIsReorderingMode] = useState(false);
  const [deleteConfirmState, setDeleteConfirmState] = useState<{
    isOpen: boolean;
    type: 'delete' | 'hide';
    stepKey: string;
    label: string;
  } | null>(null);
  
  // Drag and drop states
  const [draggedItem, setDraggedItem] = useState<{ categoryId: string; index: number } | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<{ categoryId: string; index: number } | null>(null);

  // States for general information (Project membership)
  const [showEmailInput, setShowEmailInput] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [availableUsers, setAvailableUsers] = useState<{id: string, email: string}[]>(globalAvailableUsers);
  const [userRolesMap, setUserRolesMap] = useState<Record<string, string>>(globalUserRolesMap);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  useEffect(() => {
    if (globalAvailableUsers && globalAvailableUsers.length > 0) {
      setAvailableUsers(globalAvailableUsers);
    }
  }, [globalAvailableUsers]);

  useEffect(() => {
    if (globalUserRolesMap && Object.keys(globalUserRolesMap).length > 0) {
      setUserRolesMap(globalUserRolesMap);
    }
  }, [globalUserRolesMap]);

  const openAddEmail = async () => {
    setShowEmailInput(true);
    if ((availableUsers.length === 0 || Object.keys(userRolesMap).length === 0) && onRefreshGlobalUsers) {
      setIsLoadingUsers(true);
      try {
        await onRefreshGlobalUsers();
      } catch (error) {
        toast.error('Không thể lấy danh sách người dùng');
      } finally {
        setIsLoadingUsers(false);
      }
    }
  };

  const handleAddEmail = async () => {
    const email = newEmail.trim().toLowerCase();
    if (email && email.includes('@')) {
      const current = project.authorizedEmails || [];
      if (!current.includes(email)) {
        try {
          await updateProjectField(project.id, 'authorizedEmails', [...current, email], 'thành viên dự án');
          setNewEmail('');
          setShowEmailInput(false);
          toast.success(`Đã thêm ${email} vào dự án`);
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, `projects/${project.id}`);
        }
      } else {
        toast.error('Email này đã có trong danh sách');
      }
    }
  };

  const handleRemoveEmail = async (email: string) => {
    const updated = project.authorizedEmails?.filter(e => e !== email) || [];
    try {
      await updateProjectField(project.id, 'authorizedEmails', updated, 'thành viên dự án');
      toast.success('Đã gỡ quyền thành viên');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `projects/${project.id}`);
    }
  };

  // reset all states when project id changes
  useEffect(() => {
    setActiveCategoryId('overview');
    setActiveStepKey('overview');
    setExpandedCategories({
      'preparation': false,
      'execution_detail': false
    });
    setExpandedRounds({});
    setIsReorderingMode(false);
    setDraggedItem(null);
    setDragOverIndex(null);
    setShowEmailInput(false);
    setNewEmail('');
  }, [project.id]);

  // Synchronize activeStepKey when activeCategoryId or progress/steps order changes
  useEffect(() => {
    if (activeCategoryId === 'overview' && activeStepKey === 'overview') {
      return;
    }
    const steps = getCategoryStepsOrdered(project, activeCategoryId);
    if (steps.length > 0) {
      if (!activeStepKey || !steps.includes(activeStepKey)) {
        setActiveStepKey(steps[0]);
      }
    } else {
      setActiveStepKey(null);
    }
  }, [activeCategoryId, project.stepsOrder, project.customSteps, project.id]);

  // Listen for custom events to select steps change from Sidebar
  useEffect(() => {
    const handleSelectStepEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ categoryId: string; stepKey: string }>;
      if (customEvent && customEvent.detail) {
        const { categoryId, stepKey } = customEvent.detail;
        setActiveCategoryId(categoryId);
        setActiveStepKey(stepKey);
      }
    };
    window.addEventListener('app:select-step', handleSelectStepEvent);
    return () => {
      window.removeEventListener('app:select-step', handleSelectStepEvent);
    };
  }, []);

  // Dispatch custom event to notify parent App when active step/category changes
  useEffect(() => {
    if (activeStepKey) {
      window.dispatchEvent(new CustomEvent('app:step-changed', {
        detail: { categoryId: activeCategoryId, stepKey: activeStepKey }
      }));
      
      // Scroll main container to top when changing steps
      const scrollContainer = document.getElementById('main-scroll-container');
      if (scrollContainer) {
        scrollContainer.scrollTo({ top: 0, behavior: 'instant' });
      }
    }
  }, [activeStepKey, activeCategoryId]);

  const toggleCategory = (id: string) => {
    setExpandedCategories(prev => {
      const isAlreadyExpanded = prev[id];
      return {
        'preparation': id === 'preparation' ? !isAlreadyExpanded : false,
        'execution_detail': id === 'execution_detail' ? !isAlreadyExpanded : false
      };
    });
  };

  // Scroll to expanded category (used in Reordering Mode)
  useEffect(() => {
    const expandedId = Object.entries(expandedCategories).find(([_, expanded]) => expanded)?.[0];
    if (expandedId && isReorderingMode) {
      const timer = setTimeout(() => {
        const element = document.getElementById(`category-${expandedId}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [expandedCategories, isReorderingMode]);

  const isCategoryVisible = (catId: string) => {
    if (project.disabledCategories?.includes(catId)) return false;
    return true;
  };

  const getVisibleSteps = (steps: string[]) => {
    return steps.filter(k => !project.disabledSteps?.includes(k));
  };

  const getCompletedCount = (steps: string[]) => {
    const visibleSteps = getVisibleSteps(steps);
    return visibleSteps.filter(k => {
      const s = project.steps[k as keyof typeof project.steps];
      if (k === 'inventory') {
        return s && (s.status === 'completed' || checkInventoryCompleted(s));
      }
      return (typeof s === 'object' && s !== null ? (s as any).status : s) === 'completed';
    }).length;
  };

  const getStepInfo = (stepKey: string) => {
    if (stepKey.startsWith('custom_')) {
      const customId = stepKey.replace('custom_', '');
      const step = project.customSteps?.find(cs => cs.id === customId);
      return {
        label: step?.name || 'Mục công việc mới',
        status: step?.status || 'pending',
        isCustom: true
      };
    }

    const s = project.steps[stepKey as keyof typeof project.steps];
    let status = 'pending';
    if (stepKey === 'inventory') {
      const isCompleted = s && (s.status === 'completed' || checkInventoryCompleted(s));
      status = isCompleted ? 'completed' : ((s && s.status) || 'pending');
    } else if (s) {
      status = (typeof s === 'object' && s !== null ? s.status : s) || 'pending';
    }

    return {
      label: STEP_LABELS[stepKey] || stepKey,
      status: status as any,
      isCustom: false
    };
  };

  const getDueTasks = () => {
    const overdueList: Array<{
      id: string;
      name: string;
      categoryId: string;
      stepKey: string;
      days: number;
      deadlineStr: string;
      status: string;
    }> = [];

    const upcomingList: Array<{
      id: string;
      name: string;
      categoryId: string;
      stepKey: string;
      days: number;
      deadlineStr: string;
      status: string;
    }> = [];

    const today = startOfDay(new Date());

    STEP_CATEGORIES.forEach(cat => {
      // If category is disabled, skip all its steps
      if (project.disabledCategories?.includes(cat.id)) {
        return;
      }

      const activeSteps = getCategoryStepsOrdered(project, cat.id);

      activeSteps.forEach(stepKey => {
        // Skip default steps if they are disabled
        if (!stepKey.startsWith('custom_') && project.disabledSteps?.includes(stepKey)) {
          return;
        }

        const stepInfo = getStepInfo(stepKey);
        // We only list tasks that are NOT completed and NOT not_applicable
        if (stepInfo.status === 'completed' || stepInfo.status === 'not_applicable') {
          return;
        }

        let deadlineValue: any = undefined;

        if (stepKey.startsWith('custom_')) {
          const customId = stepKey.replace('custom_', '');
          const cs = project.customSteps?.find(x => x.id === customId);
          if (cs) {
            deadlineValue = cs.deadline;
          }
        } else {
          const s = project.steps[stepKey as keyof typeof project.steps];
          if (s && typeof s === 'object' && s !== null) {
            deadlineValue = (s as any).deadline;
          }
        }

        if (deadlineValue) {
          const dDate = parseDate(deadlineValue);
          if (dDate) {
            const targetDay = startOfDay(dDate);
            const diffDays = differenceInCalendarDays(targetDay, today);
            
            if (diffDays < 0) {
              overdueList.push({
                id: stepKey,
                name: stepInfo.label,
                categoryId: cat.id,
                stepKey: stepKey,
                days: Math.abs(diffDays),
                deadlineStr: formatDate(dDate),
                status: stepInfo.status
              });
            } else {
              upcomingList.push({
                id: stepKey,
                name: stepInfo.label,
                categoryId: cat.id,
                stepKey: stepKey,
                days: diffDays,
                deadlineStr: formatDate(dDate),
                status: stepInfo.status
              });
            }
          }
        }
      });
    });

    // Sort: overdue descending (most overdue first i.e. highest number of days of delay gets listed first)
    overdueList.sort((a, b) => b.days - a.days);

    // Sort: upcoming ascending (closest upcoming first i.e. 0, 1, 2, 3...)
    upcomingList.sort((a, b) => a.days - b.days);

    return { overdueList, upcomingList };
  };

  const handleDragStart = (e: React.DragEvent, categoryId: string, index: number) => {
    setDraggedItem({ categoryId, index });
    e.dataTransfer.effectAllowed = 'move';
    const target = e.currentTarget as HTMLElement;
    target.style.opacity = '0.4';
  };

  const handleDragOver = (e: React.DragEvent, categoryId: string, index: number) => {
    e.preventDefault();
    if (draggedItem && draggedItem.categoryId === categoryId && draggedItem.index !== index) {
      setDragOverIndex({ categoryId, index });
    }
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    const target = e.currentTarget as HTMLElement;
    target.style.opacity = '1';
    setDraggedItem(null);
    setDragOverIndex(null);
  };

  const handleDrop = async (e: React.DragEvent, categoryId: string, index: number) => {
    e.preventDefault();
    setDragOverIndex(null);
    if (!draggedItem) return;
    if (draggedItem.categoryId !== categoryId) return;

    const sourceIndex = draggedItem.index;
    const targetIndex = index;
    if (sourceIndex === targetIndex) return;

    const orderedSteps = getCategoryStepsOrdered(project, categoryId);
    const newStepsOrder = [...orderedSteps];
    const [removed] = newStepsOrder.splice(sourceIndex, 1);
    newStepsOrder.splice(targetIndex, 0, removed);

    setDraggedItem(null);
    await updateStepsOrder(project.id, categoryId, newStepsOrder);
  };

  const handleMoveStep = async (categoryId: string, index: number, direction: 'up' | 'down') => {
    const orderedSteps = getCategoryStepsOrdered(project, categoryId);
    let targetIndex = -1;
    if (direction === 'up' && index > 0) {
      targetIndex = index - 1;
    } else if (direction === 'down' && index < orderedSteps.length - 1) {
      targetIndex = index + 1;
    }

    if (targetIndex === -1) return;

    const newStepsOrder = [...orderedSteps];
    const temp = newStepsOrder[index];
    newStepsOrder[index] = newStepsOrder[targetIndex];
    newStepsOrder[targetIndex] = temp;

    await updateStepsOrder(project.id, categoryId, newStepsOrder);
  };

  return (
    <motion.div
      key={project.id}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="max-w-[1240px] w-full mx-auto"
    >
      <div className="bg-white rounded-xl p-5 md:p-8 border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.015)]">
        <ProjectHeader 
          project={project} 
          isAdmin={isAdmin} 
          canEdit={canEdit}
          onProjectDeleted={onProjectDeleted} 
        />

        {activeStepKey === 'overview' ? (
          <div className="mt-6 font-sans">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Cột trái (70%) */}
              <div className="lg:col-span-2 space-y-6">
                
                {/* 1. Phần thông tin chung */}
                <div className="bg-white rounded-lg p-5 border border-slate-200 shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-[#0056b3]"></div>
                  <h3 className="text-sm font-bold text-slate-800 mb-4 tracking-tight">Thông tin chung</h3>
                  
                  <div className="space-y-0 text-sm">
                    {/* Trạng thái dự án */}
                    <div className="flex items-center justify-between py-3 border-b border-slate-100">
                      <span className="font-semibold text-slate-500 whitespace-nowrap">Trạng thái:</span>
                      <div className="w-48">
                        {canEdit ? (
                          <AppSelect
                            options={[
                              { value: 'active', label: 'Đang thực hiện' },
                              { value: 'completed', label: 'Hoàn thành' }
                            ]}
                            value={{
                              value: project.status === 'archived' ? 'completed' : project.status,
                              label: (project.status === 'archived' || project.status === 'completed') ? 'Hoàn thành' : 'Đang thực hiện'
                            }}
                            onChange={async (opt) => {
                              const val = (opt as any)?.value;
                              if (val) {
                                try {
                                  await updateProjectField(project.id, 'status', val, 'trạng thái dự án');
                                  toast.success('Đã cập nhật trạng thái');
                                } catch (err) {
                                  handleFirestoreError(err, OperationType.UPDATE, `projects/${project.id}`);
                                }
                              }
                            }}
                          />
                        ) : (
                          <div className={cn(
                            "text-xs font-bold uppercase tracking-wider border px-3 py-1.5 rounded-lg text-center",
                            project.status === 'active' ? "bg-amber-50 text-amber-600 border-amber-200" :
                            "bg-emerald-50 text-emerald-600 border-emerald-200"
                          )}>
                            {project.status === 'active' ? 'Đang thực hiện' : 'Hoàn thành'}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Loại hình đất GPMB */}
                    <div className="flex items-center justify-between py-3 border-b border-slate-100">
                      <span className="font-semibold text-slate-500 whitespace-nowrap">Loại hình đất:</span>
                      <div className="w-56">
                        {canEdit ? (
                          <AppSelect
                            options={[
                              { value: 'agri', label: 'Đất nông nghiệp' },
                              { value: 'resident', label: 'Đất phi nông nghiệp' },
                              { value: 'both', label: 'Nông nghiệp & Phi nông nghiệp' }
                            ]}
                            value={{
                              value: project.projectType || 'both',
                              label: project.projectType === 'agri' ? 'Đất nông nghiệp' : project.projectType === 'resident' ? 'Đất phi nông nghiệp' : 'Nông nghiệp & Phi nông nghiệp'
                            }}
                            onChange={async (opt) => {
                              const val = (opt as any)?.value;
                              if (val) {
                                try {
                                  await updateProjectField(project.id, 'projectType', val, 'loại hình dự án');
                                  toast.success('Đã cập nhật loại hình đất');
                                } catch (err) {
                                  handleFirestoreError(err, OperationType.UPDATE, `projects/${project.id}`);
                                }
                              }
                            }}
                          />
                        ) : (
                          <div className="text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg text-center">
                            {project.projectType === 'agri' ? 'Đất nông nghiệp' : project.projectType === 'resident' ? 'Đất phi nông nghiệp' : 'Nông nghiệp & Phi nông nghiệp'}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Hạn hoàn thành */}
                    <div className="flex items-center justify-between py-3 border-b border-slate-100">
                      <span className="font-semibold text-slate-500 whitespace-nowrap">Hạn hoàn thành:</span>
                      <div className="w-32 shrink-0">
                        <CustomDatePicker 
                          value={project.deadline || ''} 
                          onChange={async (val) => {
                            if (canEdit) {
                              try {
                                await updateProjectField(project.id, 'deadline', val, 'hạn hoàn thành');
                                toast.success('Đã cập nhật hạn hoàn thành');
                              } catch (err) {
                                handleFirestoreError(err, OperationType.UPDATE, `projects/${project.id}`);
                              }
                            }
                          }}
                          readOnly={!canEdit}
                        />
                      </div>
                    </div>

                    {/* Chủ đầu tư */}
                    <div className="flex items-center justify-between py-3 border-b border-slate-100">
                      <span className="font-semibold text-slate-500 whitespace-nowrap">Chủ đầu tư:</span>
                      <div className="w-1/2 text-right">
                        <EditableInput 
                          value={project.investor || ''}
                          placeholder="Nhập chủ đầu tư..."
                          className="text-sm font-semibold text-slate-800 text-right bg-transparent focus:bg-white border border-transparent focus:border-[#0056b3] focus:ring-2 focus:ring-[#0056b3]/20 rounded-md outline-none transition-all w-full px-2 py-1"
                          onSave={async (val) => {
                            if (canEdit) {
                              try {
                                await updateProjectField(project.id, 'investor', val, 'chủ đầu tư');
                                toast.success('Đã cập nhật chủ đầu tư');
                              } catch (err) {
                                handleFirestoreError(err, OperationType.UPDATE, `projects/${project.id}`);
                              }
                            }
                          }}
                          readOnly={!canEdit}
                        />
                      </div>
                    </div>

                    {/* Địa điểm thực hiện */}
                    <div className="flex items-center justify-between py-3 border-b border-slate-100">
                      <span className="font-semibold text-slate-500 whitespace-nowrap">Địa điểm thực hiện:</span>
                      <div className="w-1/2 text-right">
                        <EditableInput 
                          value={project.location || ''}
                          placeholder="Nhập địa điểm..."
                          className="text-sm font-semibold text-slate-800 text-right bg-transparent focus:bg-white border border-transparent focus:border-[#0056b3] focus:ring-2 focus:ring-[#0056b3]/20 rounded-md outline-none transition-all w-full px-2 py-1"
                          onSave={async (val) => {
                            if (canEdit) {
                              try {
                                await updateProjectField(project.id, 'location', val, 'địa điểm thực hiện');
                                toast.success('Đã cập nhật địa điểm thực hiện');
                              } catch (err) {
                                handleFirestoreError(err, OperationType.UPDATE, `projects/${project.id}`);
                              }
                            }
                          }}
                          readOnly={!canEdit}
                        />
                      </div>
                    </div>

                    {/* Hồ sơ liên quan */}
                    <div className="flex items-center justify-between py-3">
                      <span className="font-semibold text-slate-500 whitespace-nowrap flex items-center gap-1.5">
                        <span>Hồ sơ liên quan:</span>
                        {project.documentLink && (project.documentLink.startsWith('http://') || project.documentLink.startsWith('https://')) && (
                          <a 
                            href={project.documentLink} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-[#0056b3] hover:text-[#003d82] inline-flex items-center gap-1 transition-all cursor-pointer bg-blue-50 hover:bg-blue-100 px-1.5 py-0.5 rounded text-[10px] font-bold"
                            title="Mở liên kết tài liệu"
                          >
                            <ExternalLink className="w-3 h-3" />
                            <span>Mở link</span>
                          </a>
                        )}
                      </span>
                      <div className="w-1/2 text-right">
                        <EditableInput 
                          value={project.documentLink || ''}
                          placeholder={canEdit ? "Dán link Google Drive..." : "Chưa có liên kết"}
                          className="text-sm font-semibold text-slate-800 text-right bg-transparent focus:bg-white border border-transparent focus:border-[#0056b3] focus:ring-2 focus:ring-[#0056b3]/20 rounded-md outline-none transition-all w-full px-2 py-1"
                          onSave={async (val) => {
                            if (canEdit) {
                              try {
                                await updateProjectField(project.id, 'documentLink', val, 'hồ sơ liên quan');
                                toast.success('Đã cập nhật hồ sơ liên quan');
                              } catch (err) {
                                handleFirestoreError(err, OperationType.UPDATE, `projects/${project.id}`);
                              }
                            }
                          }}
                          readOnly={!canEdit}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 1.1. Theo dõi hạn thực hiện công việc */}
                {(() => {
                  const { overdueList, upcomingList } = getDueTasks();
                  return (
                    <div className="bg-white rounded-lg p-5 border border-slate-200 shadow-sm relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-full h-1 bg-[#0056b3]"></div>
                      
                      <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                          <CalendarDays className="w-4 h-4 text-slate-500" />
                          <h3 className="text-sm font-bold text-slate-800 tracking-tight">Theo dõi hạn công việc</h3>
                        </div>
                        <span className="text-[10px] text-slate-400 font-semibold bg-slate-50 border border-slate-100 rounded-full px-2.5 py-0.5 select-none">
                          Tự động cập nhật
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Cột 1: Đầu việc đã quá hạn */}
                        <div className="flex flex-col">
                          <div className="flex items-center gap-1.5 mb-3">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0 inline-block"></span>
                            <span className="text-xs font-bold uppercase tracking-wider text-red-600 flex items-center gap-1">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              Đầu việc đã quá hạn ({overdueList.length})
                            </span>
                          </div>

                          {overdueList.length === 0 ? (
                            <div className="flex flex-col items-center justify-center p-6 bg-emerald-50/40 border border-emerald-100 rounded-lg text-center select-none">
                              <CheckCircle2 className="w-6 h-6 text-emerald-500 mb-1.5 shrink-0" />
                              <p className="text-xs font-bold text-emerald-700">Tất cả đều đúng tiến độ</p>
                              <p className="text-[10px] text-emerald-500 mt-0.5">Không có đầu việc quá hạn cần xử lý</p>
                            </div>
                          ) : (
                            <div className="flex flex-col gap-2 max-h-[350px] overflow-y-auto pr-1 no-scrollbar">
                              {overdueList.map((task) => (
                                <div 
                                  key={task.id}
                                  onClick={() => {
                                    setActiveCategoryId(task.categoryId);
                                    setActiveStepKey(task.stepKey);
                                  }}
                                  className="group flex items-center justify-between gap-3 p-3 bg-red-50/30 hover:bg-red-50 border border-red-100 hover:border-red-200 rounded-lg cursor-pointer transition-all duration-150 active:scale-[0.98] select-none"
                                >
                                  <div className="min-w-0 flex-1">
                                    <h4 className="text-xs font-bold text-slate-800 group-hover:text-red-700 transition-colors line-clamp-2 leading-snug">
                                      {task.name}
                                    </h4>
                                    <div className="flex items-center gap-2 mt-1.5 text-[10px] font-semibold text-slate-400">
                                      <span>Hạn chót: {task.deadlineStr}</span>
                                    </div>
                                  </div>
                                  <div className="shrink-0 flex items-center gap-1.5 text-right">
                                    <span className="text-[11px] font-extrabold text-red-600 bg-red-100/50 border border-red-200/40 px-2 py-0.5 rounded-md min-w-[75px] text-center shrink-0">
                                      Quá {task.days} ngày
                                    </span>
                                    <ChevronRight className="w-3.5 h-3.5 text-red-400 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all shrink-0" />
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Cột 2: Đầu việc sắp đến hạn */}
                        <div className="flex flex-col">
                          <div className="flex items-center gap-1.5 mb-3">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0 inline-block"></span>
                            <span className="text-xs font-bold uppercase tracking-wider text-amber-600 flex items-center gap-1">
                              <Clock3 className="w-3.5 h-3.5" />
                              Đầu việc sắp đến hạn ({upcomingList.length})
                            </span>
                          </div>

                          {upcomingList.length === 0 ? (
                            <div className="flex flex-col items-center justify-center p-6 bg-slate-50 border border-slate-150 rounded-lg text-center select-none">
                              <CalendarDays className="w-6 h-6 text-slate-350 mb-1.5 shrink-0" />
                              <p className="text-xs font-bold text-slate-500">Chưa xếp hạn tiếp theo</p>
                              <p className="text-[10px] text-slate-400 mt-0.5">Không tìm thấy đầu việc nào sắp đến hạn</p>
                            </div>
                          ) : (
                            <div className="flex flex-col gap-2 max-h-[350px] overflow-y-auto pr-1 no-scrollbar">
                              {upcomingList.map((task) => (
                                <div 
                                  key={task.id}
                                  onClick={() => {
                                    setActiveCategoryId(task.categoryId);
                                    setActiveStepKey(task.stepKey);
                                  }}
                                  className="group flex items-center justify-between gap-3 p-3 bg-amber-50/20 hover:bg-amber-50/60 border border-amber-100 hover:border-amber-200 rounded-lg cursor-pointer transition-all duration-150 active:scale-[0.98] select-none"
                                >
                                  <div className="min-w-0 flex-1">
                                    <h4 className="text-xs font-bold text-slate-800 group-hover:text-amber-700 transition-colors line-clamp-2 leading-snug">
                                      {task.name}
                                    </h4>
                                    <div className="flex items-center gap-2 mt-1.5 text-[10px] font-semibold text-slate-400">
                                      <span>Hạn chót: {task.deadlineStr}</span>
                                    </div>
                                  </div>
                                  <div className="shrink-0 flex items-center gap-1.5 text-right">
                                    <span className={cn(
                                      "text-[11px] font-extrabold px-2 py-0.5 rounded-md min-w-[75px] text-center shrink-0 border",
                                      task.days === 0 
                                        ? "text-rose-600 bg-rose-50 border-rose-200" 
                                        : task.days <= 3 
                                          ? "text-orange-600 bg-orange-50 border-orange-200" 
                                          : "text-slate-600 bg-slate-50 border-slate-200"
                                    )}>
                                      {task.days === 0 ? 'Hạn hôm nay' : `Còn ${task.days} ngày`}
                                    </span>
                                    <ChevronRight className="w-3.5 h-3.5 text-amber-400 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all shrink-0" />
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                  );
                })()}


              </div>

              {/* Cột phải (30%) */}
              <div className="lg:col-span-1 space-y-6">
                
                {/* 2. Thành viên tham gia */}
                <div className="bg-white rounded-lg p-5 border border-slate-200 shadow-sm">
                  <h3 className="text-sm font-bold text-slate-800 mb-4 tracking-tight">Thành viên dự án ({project.authorizedEmails?.length || 0})</h3>
                  
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-2 shrink-0 flex-wrap">
                      {/* Avatar Stack */}
                      <div className="flex items-center -space-x-2 py-0.5">
                        {(project.authorizedEmails || []).slice(0, 5).map((email, idx) => {
                          const letter = email.charAt(0).toUpperCase();
                          const colors = ["bg-[#0056b3]", "bg-indigo-600", "bg-purple-600", "bg-orange-600", "bg-emerald-600", "bg-cyan-600"];
                          const colorClass = colors[email.length % colors.length];
                          return (
                            <div 
                              key={email}
                              className={cn(
                                "w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-xs font-bold text-white shadow-sm shrink-0 select-none relative",
                                colorClass
                              )}
                              style={{ zIndex: 10 - idx }}
                              title={email}
                            >
                              {letter}
                            </div>
                          );
                        })}
                        {(project.authorizedEmails || []).length > 5 && (
                          <div className="w-8 h-8 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-600 shadow-sm shrink-0 select-none relative z-0">
                            +{(project.authorizedEmails || []).length - 5}
                          </div>
                        )}
                        {(project.authorizedEmails || []).length === 0 && (
                          <div className="w-8 h-8 rounded-full border-2 border-dashed border-slate-300 flex items-center justify-center text-slate-400 select-none">
                            <Users className="w-3.5 h-3.5" />
                          </div>
                        )}
                      </div>

                      {isAdmin && (
                        <div className="ml-auto">
                          {showEmailInput ? (
                            <div className="relative z-20">
                              <div className="flex items-center gap-1 bg-white rounded-md border border-slate-200 pr-1 py-0.5 transition-all shadow-sm">
                                <input 
                                  autoFocus
                                  type="email"
                                  placeholder="Nhập email..."
                                  className="px-2 py-1 text-xs font-medium outline-none w-[140px] bg-transparent focus:ring-0"
                                  value={newEmail}
                                  onChange={(e) => setNewEmail(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleAddEmail();
                                    else if (e.key === 'Escape') { setShowEmailInput(false); setNewEmail(''); }
                                  }}
                                />
                                <div className="flex items-center gap-0.5 shrink-0">
                                  <button onClick={handleAddEmail} className="p-1 text-[#0056b3] hover:bg-blue-50 rounded cursor-pointer">
                                    <CheckCircle2 className="w-4 h-4" />
                                  </button>
                                  <button onClick={() => { setShowEmailInput(false); setNewEmail(''); }} className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded cursor-pointer">
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                              {/* Auto suggest dropdown menu */}
                              <div className="absolute right-0 top-full mt-1 w-full min-w-[200px] bg-white border border-slate-200 shadow-lg rounded-md z-30 max-h-40 overflow-y-auto">
                                {isLoadingUsers ? (
                                  <div className="px-3 py-2 text-xs text-slate-500 font-medium">Đang tải...</div>
                                ) : (
                                  availableUsers
                                    .filter(u => !(project.authorizedEmails || []).includes(u.email))
                                    .filter(u => u.email.toLowerCase().includes(newEmail.toLowerCase()))
                                    .map(u => (
                                      <button
                                        key={u.id}
                                        onClick={async () => {
                                          const email = u.email;
                                          const current = project.authorizedEmails || [];
                                          if (!current.includes(email)) {
                                            try {
                                              await updateDoc(doc(db, 'projects', project.id), {
                                                authorizedEmails: [...current, email],
                                                updatedAt: serverTimestamp()
                                              });
                                              setNewEmail('');
                                              setShowEmailInput(false);
                                              toast.success(`Đã thêm ${email} vào dự án`);
                                            } catch (error) {
                                              handleFirestoreError(error, OperationType.UPDATE, `projects/${project.id}`);
                                            }
                                          }
                                        }}
                                        className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-[#0056b3] transition-colors border-b border-slate-100 last:border-none cursor-pointer"
                                      >
                                        {u.email}
                                      </button>
                                    ))
                                )}
                              </div>
                            </div>
                          ) : (
                            <button 
                              onClick={openAddEmail}
                              className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-50 text-[#0056b3] border border-slate-200 hover:bg-[#0056b3]/10 hover:border-[#0056b3]/30 rounded-md text-xs font-bold transition-all cursor-pointer shadow-sm"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Thêm TV</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Member List */}
                    <div className="flex flex-col gap-1 mt-1 max-h-[280px] overflow-y-auto pr-1">
                       {project.authorizedEmails?.map((email) => (
                          <div 
                            key={email} 
                            className="flex items-center justify-between gap-3 p-2 rounded-lg hover:bg-slate-50 border border-transparent transition-all group opacity-85 hover:opacity-100"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                               <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-[10px] font-extrabold shrink-0">
                                  {email.charAt(0).toUpperCase()}
                               </div>
                               <div className="flex flex-col min-w-0">
                                 <span className="text-xs font-bold text-slate-700 truncate" title={email}>{email}</span>
                                 {userRolesMap[email.toLowerCase()] && (
                                   <span className={cn(
                                     "text-[7px] font-black tracking-wider uppercase px-1 py-0.5 rounded leading-none w-max scale-90 origin-left mt-0.5",
                                     userRolesMap[email.toLowerCase()] === 'admin' ? "bg-emerald-50 text-emerald-700 border border-emerald-250/20" :
                                     userRolesMap[email.toLowerCase()] === 'editor' ? "bg-blue-50 text-blue-700 border border-blue-250/20" :
                                     "bg-slate-100 text-slate-500 border border-slate-200"
                                   )}>
                                     {userRolesMap[email.toLowerCase()] === 'admin' ? 'Quản trị viên' : userRolesMap[email.toLowerCase()] === 'editor' ? 'Chuyên môn' : 'Xem (Sở ngành)'}
                                   </span>
                                 )}
                               </div>
                            </div>
                            {isAdmin && (
                              <button 
                                onClick={() => handleRemoveEmail(email)}
                                className="text-slate-400 hover:text-red-500 rounded p-1.5 hover:bg-red-50 transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
                                title="Gỡ thành viên"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        ))}
                    </div>

                  </div>
                </div>

                {/* Hoạt động gần đây */}
                <div className="bg-white rounded-lg p-5 border border-slate-200 shadow-sm relative overflow-hidden">
                  <h3 className="text-sm font-bold text-slate-800 mb-5 tracking-tight">Hoạt động gần đây</h3>
                  <div className="space-y-5 relative pl-2">
                    <div className="absolute top-2 bottom-5 left-[23px] w-[2px] bg-slate-100 z-0"></div>
                    
                    {(() => {
                      const recentActs = project.activities || [];
                      if (recentActs.length === 0) {
                        return <div className="text-xs text-slate-400 italic pl-10 relative z-10">Chưa có hoạt động nào</div>;
                      }
                      return [...recentActs].sort((a, b) => b.timestamp - a.timestamp).slice(0, 5).map((activity) => (
                        <div key={activity.id} className="flex gap-4 relative z-10 w-full">
                          <div className="w-8 h-8 rounded-full bg-[#0056b3]/10 text-[#0056b3] ring-4 ring-white flex items-center justify-center shrink-0">
                            <Activity className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0 pt-1">
                            <p className="text-xs text-slate-600 leading-snug">
                              <span className="font-bold text-slate-900">{activity.userName}</span>{' '}
                              {activity.action} {activity.target ? <span className="font-semibold text-slate-800">{activity.target}</span> : ''}
                            </p>
                            <p className="text-[10px] font-bold text-slate-400 mt-1">
                              {formatDistanceToNow(activity.timestamp, { addSuffix: true, locale: vi })}
                            </p>
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                </div>

              </div>

            </div>
          </div>
        ) : (
          /* SECTION 2: OTHER WORKSPACE STEPS */
          <div className="space-y-6 mt-6">
            {activeStepKey ? (
              <div id="step-detail-container" className="scroll-mt-20">
                <StepDetail 
                  key={activeStepKey}
                  project={project}
                  stepKey={activeStepKey}
                  canEdit={canEdit}
                  expandedRounds={expandedRounds}
                  setExpandedRounds={setExpandedRounds}
                  isReorderingMode={false}
                  defaultExpanded={true}
                  forceExpanded={true}
                />
              </div>
            ) : (
              <div className="p-12 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/50 text-slate-400 text-xs font-medium">
                Không có quy trình công việc nào trong danh mục này.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modern, Safe Confirm Dialog Pop-up inside Iframe */}
      <AnimatePresence>
        {deleteConfirmState && deleteConfirmState.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-[2px] p-4 select-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-sm bg-white rounded-xl shadow-xl border border-slate-150 p-5 flex flex-col gap-4"
            >
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-full bg-red-50 flex items-center justify-center shrink-0 border border-red-100 text-red-500">
                  <X className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h4 className="font-bold text-slate-900 text-[14px]">
                    {deleteConfirmState.type === 'delete' ? 'Xóa hoàn toàn bước tự tạo?' : 'Ẩn bước công việc?'}
                  </h4>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    {deleteConfirmState.type === 'delete' 
                      ? `Bạn có chắc chắn muốn xóa hoàn toàn bước công việc tự tạo "${deleteConfirmState.label}" không? Hành động này không thể hoàn tác.`
                      : `Bạn có chắc chắn muốn ẩn bước công việc "${deleteConfirmState.label}" khỏi quy trình không? Bạn vẫn có thể hiện lại trong danh sách ẩn ở phía dưới.`}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center justify-end gap-2.5 pt-1.5 border-t border-slate-100">
                <button
                  onClick={() => setDeleteConfirmState(null)}
                  className="px-3 py-1.5 hover:bg-slate-100 active:bg-slate-200 text-slate-500 rounded-lg text-xs font-bold cursor-pointer transition-colors"
                >
                  Hủy bỏ
                </button>
                <button
                  onClick={async () => {
                    const { type, stepKey } = deleteConfirmState;
                    setDeleteConfirmState(null);
                    const currentCategory = activeStepKey === 'overview' ? configCategoryId : activeCategoryId;
                    if (type === 'delete') {
                      await deleteCustomStep(project.id, project.customSteps || [], stepKey.replace('custom_', ''));
                      const remainingSteps = getCategoryStepsOrdered(project, currentCategory).filter(k => k !== stepKey);
                      if (remainingSteps.length > 0) {
                        if (activeStepKey !== 'overview') setActiveStepKey(remainingSteps[0]);
                      } else {
                        if (activeStepKey !== 'overview') setActiveStepKey(null);
                      }
                    } else {
                      await toggleDisabledStep(project.id, stepKey, project.disabledSteps || []);
                      const remainingSteps = getCategoryStepsOrdered(project, currentCategory).filter(k => k !== stepKey);
                      if (remainingSteps.length > 0) {
                        if (activeStepKey === stepKey) {
                          setActiveStepKey(remainingSteps[0]);
                        }
                      } else {
                        if (activeStepKey !== 'overview') setActiveStepKey(null);
                      }
                    }
                  }}
                  className="px-3.5 py-1.5 bg-red-550 hover:bg-red-600 active:scale-98 text-white rounded-lg text-xs font-bold cursor-pointer shadow-xs transition-all border border-transparent"
                >
                  {deleteConfirmState.type === 'delete' ? 'Xóa' : 'Ẩn bước'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
