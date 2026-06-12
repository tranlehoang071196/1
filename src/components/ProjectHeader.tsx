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
                    className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-800 bg-white border border-[#0056b3]/80 focus:ring-4 focus:ring-[#0056b3]/10 rounded-xl outline-none transition-all w-full py-1.5 px-3 font-sans leading-tight sm:leading-snug"
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
                  className="group flex items-start gap-2.5 cursor-pointer rounded-xl hover:bg-slate-50/75 py-1.5 px-2 transition-all select-none w-full max-w-full"
                  onClick={() => setIsEditingName(true)}
                  title="Nhấp để sửa tên dự án"
                >
                  <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 font-sans leading-tight sm:leading-snug break-words whitespace-normal flex-1 py-0.5 min-w-0">
                    {project.name}
                  </h1>
                  <span className="p-1.5 text-slate-400 group-hover:text-[#0056b3] group-hover:bg-blue-50/80 rounded-lg transition-all shrink-0 mt-0.5 sm:mt-1">
                    <Pencil className="w-4 h-4" />
                  </span>
                </div>
              )
            ) : (
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 font-sans leading-tight sm:leading-snug break-words whitespace-normal w-full py-0.5">
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
