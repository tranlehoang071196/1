import React, { useState, useEffect } from 'react';
import { Clock, Users, X, Plus, CheckCircle2, Trash2, Pencil } from 'lucide-react';
import { doc, updateDoc, serverTimestamp, deleteDoc, collection, getDocs } from 'firebase/firestore';
import { db, OperationType, handleFirestoreError } from '../lib/firebase';
import { Project } from '../types';
import { cn } from '../lib/utils';
import { CustomDatePicker, EditableInput } from './ui-primitives';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { updateProjectField } from '../lib/projectService';

interface ProjectHeaderProps {
  project: Project;
  isAdmin: boolean;
  canEdit: boolean;
  onProjectDeleted: () => void;
}

export const ProjectHeader = ({ project, isAdmin, canEdit, onProjectDeleted }: ProjectHeaderProps) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(project.name);

  useEffect(() => {
    setTempName(project.name);
  }, [project.name]);

  return (
    <div className="flex flex-col md:flex-row items-start justify-between mb-8 pb-6 border-b border-slate-200 gap-4">
      <div className="flex-1 min-w-0 w-full">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-3">
            {canEdit ? (
              isEditingName ? (
                <div className="w-full">
                  <input 
                    type="text"
                    value={tempName}
                    placeholder="Nhập tên dự án..."
                    autoFocus
                    className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 bg-white border border-[#0056b3] focus:ring-2 focus:ring-[#0056b3]/20 rounded-lg outline-none transition-all w-full py-1 px-2 font-sans"
                    onChange={(e) => setTempName(e.target.value)}
                    onBlur={async () => {
                      setIsEditingName(false);
                      const trimmed = tempName.trim();
                      if (trimmed === '') {
                        setTempName(project.name);
                        toast.error('Tên dự án không được để trống');
                        return;
                      }
                      if (trimmed !== project.name) {
                        try {
                          await updateProjectField(project.id, 'name', trimmed, 'tên dự án');
                          toast.success('Đã cập nhật tên dự án');
                        } catch (err) {
                          setTempName(project.name);
                          handleFirestoreError(err, OperationType.UPDATE, `projects/${project.id}`);
                        }
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        (e.target as HTMLInputElement).blur();
                      } else if (e.key === 'Escape') {
                        setTempName(project.name);
                        setIsEditingName(false);
                      }
                    }}
                  />
                </div>
              ) : (
                <div 
                  className="group flex items-center gap-2 cursor-pointer rounded-lg hover:bg-slate-50/75 py-1 px-1.5 transition-all select-none w-full md:w-auto"
                  onClick={() => setIsEditingName(true)}
                  title="Nhấp để sửa tên dự án"
                >
                  <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-909 font-sans leading-none truncate max-w-full">
                    {project.name}
                  </h1>
                  <span className="p-1 px-1.5 text-slate-400 group-hover:text-[#0056b3] group-hover:bg-blue-50 rounded transition-all shrink-0">
                    <Pencil className="w-4 h-4" />
                  </span>
                </div>
              )
            ) : (
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 truncate flex-1 min-w-0 font-sans px-2">
                {project.name}
              </h1>
            )}
          </div>
        </div>
      </div>

      {isAdmin && (
        <div className="flex items-center gap-2 self-start md:self-center">
          <AnimatePresence>
            {isDeleting && (
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="flex items-center gap-2"
              >
                <button 
                  onClick={async () => {
                    if (!confirm("Bạn có chắc chắn muốn xóa dự án này? Hành động này không thể hoàn tác.")) return;
                    try {
                      await deleteDoc(doc(db, 'projects', project.id));
                      onProjectDeleted();
                      toast.success('Đã xoá dự án');
                    } catch (error) {
                      handleFirestoreError(error, OperationType.DELETE, `projects/${project.id}`);
                    }
                  }}
                  className="px-3.5 py-2 bg-red-650 text-white text-xs font-semibold rounded-lg shadow-sm hover:bg-red-700 transition-all cursor-pointer"
                >
                  Xác nhận xoá
                </button>
                <button 
                  onClick={() => setIsDeleting(false)}
                  className="px-3.5 py-2 bg-slate-100 text-slate-600 text-xs font-semibold rounded-lg hover:bg-slate-200 transition-all cursor-pointer"
                >
                  Huỷ
                </button>
              </motion.div>
            )}
          </AnimatePresence>
          {!isDeleting && (
            <button 
              onClick={() => setIsDeleting(true)}
              className="p-2 text-slate-400 hover:text-red-505 hover:bg-red-50 rounded-lg transition-all ml-1 cursor-pointer"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};
