import React, { useState } from 'react';
import { Project, InventoryIssue, IssueReason } from '../types';
import { motion } from 'framer-motion';
import { X, Plus, AlertCircle, Trash2, CheckCircle2 } from 'lucide-react';
import { updateProjectField } from '../lib/projectService';
import { db } from '../lib/firebase';
import { toast } from 'sonner';
import { formatDate } from '../utils/dateUtils';

interface IssuesModalProps {
  project: Project;
  landType: 'agri' | 'resident';
  onClose: () => void;
  canEdit: boolean;
}

export default function IssuesModal({ project, landType, onClose, canEdit }: IssuesModalProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newHouseholdName, setNewHouseholdName] = useState('');
  const [newReason, setNewReason] = useState<IssueReason>('khac');
  const [newNotes, setNewNotes] = useState('');
  
  const issues = (project.inventoryIssues || []).filter(i => i.landType === landType);
  const issueTypes: Record<IssueReason, string> = {
    'tranh_chap': 'Tranh chấp',
    'vang_chu': 'Vắng chủ',
    'khong_dong_y_gia': 'Không đồng ý giá',
    'khac': 'Lý do khác'
  };

  const handleCreateIssue = async () => {
    if (!newHouseholdName.trim()) {
      toast.error('Vui lòng nhập tên hộ');
      return;
    }
    
    const issue: InventoryIssue = {
      id: Math.random().toString(36).substr(2, 9),
      householdName: newHouseholdName.trim(),
      landType,
      reason: newReason,
      notes: newNotes,
      status: 'pending',
      createdAt: new Date().toISOString()
    };
    
    const updatedIssues = [...(project.inventoryIssues || []), issue];
    
    try {
      await updateProjectField(project.id, 'inventoryIssues', updatedIssues, 'vướng mắc kiểm đếm đất');
      toast.success('Thêm vướng mắc thành công');
      setIsAdding(false);
      setNewHouseholdName('');
      setNewReason('khac');
      setNewNotes('');
    } catch (err) {
      toast.error('Lỗi khi thêm vướng mắc');
      console.error(err);
    }
  };
  
  const handleDeleteIssue = async (issueId: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa vướng mắc này?')) return;
    
    const updatedIssues = (project.inventoryIssues || []).filter(i => i.id !== issueId);
    
    try {
      await updateProjectField(project.id, 'inventoryIssues', updatedIssues, 'vướng mắc kiểm đếm đất');
      toast.success('Xóa vướng mắc thành công');
    } catch (err) {
      toast.error('Lỗi khi xóa vướng mắc');
      console.error(err);
    }
  };
  
  const handleToggleStatus = async (issueId: string, currentStatus: 'pending' | 'resolved') => {
    const newStatus = currentStatus === 'pending' ? 'resolved' : 'pending';
    const updatedIssues = (project.inventoryIssues || []).map(i => {
      if (i.id === issueId) {
        return {
          ...i,
          status: newStatus,
          resolvedAt: newStatus === 'resolved' ? new Date().toISOString() : undefined
        };
      }
      return i;
    });
    
    try {
      await updateProjectField(project.id, 'inventoryIssues', updatedIssues, 'vướng mắc kiểm đếm đất');
      toast.success(newStatus === 'resolved' ? 'Đã đánh dấu giải quyết' : 'Đã mở lại');
    } catch (err) {
      toast.error('Lỗi cập nhật trạng thái');
      console.error(err);
    }
  };

  const diffPlots = landType === 'agri' ? 
    Math.max(0, (project.steps.inventory_agri?.totalPlots || 0) - (project.steps.inventory_agri?.donePlots || 0)) :
    Math.max(0, (project.steps.inventory_resident?.totalPlots || 0) - (project.steps.inventory_resident?.donePlots || 0));

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 sm:p-6"
    >
      <motion.div 
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl"
      >
        <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Quản lý Vướng mắc</h2>
            <p className="text-sm text-slate-500 mt-1">
              {landType === 'agri' ? 'Đất nông nghiệp' : 'Đất ở'} • Tồn đọng {diffPlots} thửa chưa kiểm đếm
            </p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100/80 rounded-xl transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30">
          <div className="mb-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
            {Object.entries(issueTypes).map(([key, label]) => {
              const count = issues.filter(i => i.reason === key && i.status === 'pending').length;
              return (
                <div key={key} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                  <div className="text-xs font-medium text-slate-500 mb-1">{label}</div>
                  <div className="text-2xl font-bold text-slate-800">{count}</div>
                </div>
              );
            })}
          </div>

          <div className="flex h-12 mb-4">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">Danh sách vướng mắc</h3>
            {canEdit && !isAdding && (
              <button 
                onClick={() => setIsAdding(true)}
                className="ml-auto text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-xl transition-colors flex items-center gap-2 shadow-sm"
              >
                <Plus className="w-4 h-4" /> Thêm hộ
              </button>
            )}
          </div>
          
          {isAdding && (
            <div className="bg-white p-5 rounded-2xl border border-blue-100 shadow-sm mb-6 animate-in fade-in slide-in-from-top-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">Thêm mới vướng mắc</h4>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Tên chủ hộ</label>
                    <input 
                      type="text" 
                      value={newHouseholdName}
                      onChange={(e) => setNewHouseholdName(e.target.value)}
                      placeholder="Nguyễn Văn A..."
                      className="w-full text-sm placeholder:text-slate-300 border border-slate-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Phân loại lý do</label>
                    <select 
                      value={newReason}
                      onChange={(e) => setNewReason(e.target.value as IssueReason)}
                      className="w-full text-sm border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all bg-white"
                    >
                      {Object.entries(issueTypes).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Ghi chú chi tiết</label>
                  <textarea 
                    value={newNotes}
                    onChange={(e) => setNewNotes(e.target.value)}
                    placeholder="Sự cố cụ thể là gì? Đang gặp vướng ở bước nào..."
                    rows={2}
                    className="w-full text-sm placeholder:text-slate-300 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all resize-none"
                  />
                </div>
                <div className="flex items-center gap-3 justify-end pt-2">
                  <button 
                    onClick={() => setIsAdding(false)}
                    className="text-xs font-semibold px-4 py-2 text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                  >
                    Hủy
                  </button>
                  <button 
                    onClick={handleCreateIssue}
                    className="text-xs font-semibold px-5 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors focus:ring-2 focus:ring-offset-2 focus:ring-blue-600"
                  >
                    Lưu
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {issues.length === 0 ? (
              <div className="text-center py-10 bg-white rounded-2xl border border-slate-100 border-dashed">
                <AlertCircle className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                <p className="text-sm font-medium text-slate-500">Chưa có hộ nào được ghi nhận vướng mắc.</p>
              </div>
            ) : (
              issues.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map(issue => (
                <div key={issue.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col md:flex-row group transition-all hover:border-blue-100 hover:shadow-md">
                  <div className={`w-1.5 shrink-0 ${issue.status === 'resolved' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                  <div className="p-4 flex-1">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div className="flex items-center gap-3">
                        <h4 className={`text-base font-bold ${issue.status === 'resolved' ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                          {issue.householdName}
                        </h4>
                        <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                          issue.status === 'resolved' 
                            ? 'bg-emerald-50 text-emerald-600 border border-emerald-100/50' 
                            : 'bg-amber-50 text-amber-700 border border-amber-200/50'
                        }`}>
                          {issue.status === 'resolved' ? 'Đã giải quyết' : 'Đang xử lý'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                        {canEdit && (
                          <>
                            <button
                              onClick={() => handleToggleStatus(issue.id, issue.status)}
                              className={`p-1.5 rounded-lg transition-colors ${
                                issue.status === 'resolved' ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50' : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                              }`}
                              title={issue.status === 'resolved' ? 'Mở lại' : 'Đánh dấu đã giải quyết'}
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteIssue(issue.id)}
                              className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-[11px] text-slate-500">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-slate-400">Lý do:</span> 
                        <span className="font-semibold text-slate-700">{issueTypes[issue.reason as IssueReason] || 'Lý do khác'}</span>
                      </div>
                      <div className="w-1 h-1 rounded-full bg-slate-200" />
                      <div>Ngày ghi nhận: {formatDate(issue.createdAt)}</div>
                    </div>
                    {issue.notes && (
                      <div className={`mt-3 text-sm ${issue.status === 'resolved' ? 'text-slate-400' : 'text-slate-600'} bg-slate-50/50 p-3 rounded-lg border border-slate-100/50`}>
                        {issue.notes}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
