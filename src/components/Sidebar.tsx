import React, { useState, useMemo } from 'react';
import { Search, Plus, LogOut, Layout, ArrowUpDown } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '../lib/utils';
import { Project } from '../types';
import { formatRelative } from '../utils/dateUtils';

interface SidebarProps {
  projects: Project[];
  selectedProject: Project | null;
  setSelectedProject: (p: Project | null) => void;
  isAdmin: boolean;
  setIsAddModalOpen: (open: boolean) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  projectFilter: 'all' | 'active' | 'completed';
  setProjectFilter: (f: 'all' | 'active' | 'completed') => void;
  user: any;
  signOut: () => void;
}

export const Sidebar = ({
  projects,
  selectedProject,
  setSelectedProject,
  isAdmin,
  setIsAddModalOpen,
  searchQuery,
  setSearchQuery,
  projectFilter,
  setProjectFilter,
  user,
  signOut
}: SidebarProps) => {
  const [sortBy, setSortBy] = useState<'name' | 'date'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const filteredAndSortedProjects = useMemo(() => {
    let result = projects.filter(p => 
      p.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
    
    if (projectFilter === 'active') {
      result = result.filter(p => p.status === 'active');
    } else if (projectFilter === 'completed') {
      result = result.filter(p => p.status === 'completed' || p.status === 'archived');
    }
    
    result.sort((a, b) => {
      if (sortBy === 'name') {
        return sortOrder === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
      } else {
        const timeA = a.createdAt?.toMillis?.() || 0;
        const timeB = b.createdAt?.toMillis?.() || 0;
        return sortOrder === 'asc' ? timeA - timeB : timeB - timeA;
      }
    });

    return result;
  }, [projects, searchQuery, projectFilter, sortBy, sortOrder]);

  return (
    <aside className={cn(
      "border-r border-slate-200 bg-[#fafaf9] flex flex-col transition-all duration-300 absolute inset-y-0 left-0 z-20 md:static md:w-[320px] md:z-auto w-full",
      selectedProject ? "-translate-x-full md:translate-x-0" : "translate-x-0"
    )}>
      <div className="p-5 pb-3">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Danh sách dự án</h2>
          {isAdmin && (
            <button 
              onClick={() => setIsAddModalOpen(true)}
              className="w-7 h-7 bg-slate-900 text-white rounded-md flex items-center justify-center hover:bg-slate-800 transition-colors cursor-pointer shadow-sm"
            >
              <Plus className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="relative group mb-3.5">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input 
            type="text" 
            placeholder="Tìm kiếm dự án..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 h-9 bg-slate-200/50 border border-transparent rounded-lg text-xs placeholder-slate-400 focus:bg-white focus:border-slate-250 outline-none transition-all"
          />
        </div>
        <div className="grid grid-cols-3 bg-slate-200/50 p-1 rounded-lg mb-2.5 relative">
          {(['all', 'active', 'completed'] as const).map(f => {
            const isActive = projectFilter === f;
            return (
              <button
                key={f}
                onClick={() => setProjectFilter(f)}
                className={cn(
                  "relative text-[9.5px] xl:text-[11px] tracking-tight font-semibold py-2 text-center rounded-md transition-all duration-200 capitalize cursor-pointer px-0.5 whitespace-nowrap outline-none select-none flex items-center justify-center",
                  isActive 
                    ? "text-slate-900 font-bold" 
                    : "text-slate-500 hover:text-slate-900"
                )}
              >
                {/* Sliding White Active Pill */}
                {isActive && (
                  <motion.div
                    layoutId="activeFilterTab"
                    className="absolute inset-0 bg-white rounded-md shadow-sm border border-slate-200/30"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    style={{ originY: "0px" }}
                  />
                )}
                
                {/* Subtle Hover background highlight for inactive tabs */}
                {!isActive && (
                  <div className="absolute inset-0 rounded-md opacity-0 hover:opacity-100 bg-white/40 transition-opacity duration-200" />
                )}
                
                <span className="relative z-10 transition-transform duration-100 active:scale-95">
                  {f === 'all' ? 'Tất cả' : f === 'active' ? 'Đang thực hiện' : 'Hoàn thành'}
                </span>
              </button>
            );
          })}
        </div>
        <div className="flex items-center justify-between px-1 mb-2">
           <div className="flex items-center gap-1.5 flex-wrap">
              <button onClick={() => setSortBy('date')} className={cn("text-xs uppercase font-semibold tracking-wider transition-colors cursor-pointer", sortBy === 'date' ? "text-slate-800" : "text-slate-400 hover:text-slate-600")}>Ngày</button>
              <span className="text-slate-300 text-xs">•</span>
              <button onClick={() => setSortBy('name')} className={cn("text-xs uppercase font-semibold tracking-wider transition-colors cursor-pointer", sortBy === 'name' ? "text-slate-800" : "text-slate-400 hover:text-slate-600")}>Tên</button>
           </div>
           <button onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')} className="text-slate-400 hover:text-slate-800 p-0.5 rounded transition-colors hover:bg-slate-150 cursor-pointer">
             <ArrowUpDown className="w-3.5 h-3.5" />
           </button>
         </div>
      </div>
      
      <div className="flex-1 overflow-y-auto px-2.5 pb-4 space-y-1">
        {filteredAndSortedProjects.map((proj) => (
          <motion.button
            layout
            key={proj.id}
            onClick={() => setSelectedProject(proj)}
            className={cn(
              "w-full text-left px-3 py-2.5 rounded-lg transition-all relative border flex flex-col gap-1 cursor-pointer",
              selectedProject?.id === proj.id 
                ? "bg-slate-200/55 border border-slate-350/10 text-slate-900 shadow-xs animate-none" 
                : "bg-transparent border border-transparent text-slate-600 hover:bg-slate-200/20 hover:text-slate-900"
            )}
          >
            <div className="flex justify-between items-start gap-2 w-full">
              <h3 className={cn(
                "font-semibold text-xs truncate flex-1 leading-normal",
                selectedProject?.id === proj.id ? "text-slate-950 font-bold" : "text-slate-700"
              )}>{proj.name}</h3>
              <div className={cn(
                "text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider font-semibold shrink-0 border",
                proj.status === 'active' 
                  ? "bg-blue-55 text-blue-600 border-blue-100" 
                  : "bg-emerald-55 text-emerald-600 border-emerald-100"
              )}>
                {proj.status === 'active' ? 'Đang thực hiện' : 'Hoàn thành'}
              </div>
            </div>
            <div className="text-[11px] text-slate-400 font-normal">
              Cập nhật {proj.updatedAt ? formatRelative(proj.updatedAt) : '---'}
            </div>
          </motion.button>
        ))}
        {filteredAndSortedProjects.length === 0 && (
          <div className="text-center py-12 px-6 flex flex-col items-center justify-center">
             <div className="w-12 h-12 bg-slate-50 flex items-center justify-center rounded-xl mb-3 border border-slate-150 shadow-xs">
                <Layout className="w-5 h-5 text-slate-300" />
              </div>
              <p className="text-slate-700 text-xs font-semibold mb-1">Chưa có dự án nào</p>
              <p className="text-slate-400 text-xs mb-4 text-center leading-relaxed">
                {isAdmin ? 'Hãy bắt đầu tạo dự án của bạn.' : 'Bạn chưa được phân quyền cho dự án nào.'}
              </p>
              {isAdmin && (
                <button 
                  onClick={() => setIsAddModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white rounded-md text-xs font-medium hover:bg-slate-800 transition-colors shadow-xs hover:cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Tạo dự án mới
                </button>
              )}
          </div>
        )}
      </div>
      <div className="p-4 border-t border-slate-200 mt-auto bg-[#fafaf9]">
         <div className="flex items-center gap-3 px-1 py-1">
            <div className="w-8 h-8 rounded-md bg-slate-200 border border-slate-350/10 flex items-center justify-center text-slate-750 font-bold text-xs shadow-xs">
               {user?.email?.[0].toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
               <p className="text-xs font-semibold text-slate-800 truncate leading-none mb-1">{user?.email}</p>
               <p className="text-[10px] text-slate-400 font-normal leading-none">{isAdmin ? 'Quản trị viên' : 'Người xem'}</p>
            </div>
            <button 
              onClick={signOut}
              className="p-2 h-9 w-9 flex items-center justify-center text-slate-450 hover:text-slate-800 hover:bg-slate-200/50 rounded-md transition-all cursor-pointer border border-transparent hover:border-slate-250/20 shadow-none animate-none"
            >
              <LogOut className="w-4 h-4" />
            </button>
         </div>
      </div>
    </aside>
  );
};
