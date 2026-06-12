import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Layout, CheckCircle2, AlertCircle, TrendingUp, TrendingDown, Target, Map as MapIcon, Activity } from 'lucide-react';
import { Project } from '../types';
import { cn } from '../lib/utils';
import { isOverdue } from './steps/stepUtils';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';

interface DashboardViewProps {
  projects: Project[];
}

export function DashboardView({ projects }: DashboardViewProps) {

  const stats = useMemo(() => {
    let active = 0, completed = 0, overdue = 0;
    projects.forEach(p => {
      if (p.status === 'active') {
        active++;
        let pOverdue = false;
        if (p.deadline && isOverdue(p.deadline)) {
          pOverdue = true;
        } else {
          // Check if any custom step or general step has an overdue deadline
          if (p.customSteps) {
            pOverdue = p.customSteps.some(cs => cs.status !== 'completed' && cs.deadline && isOverdue(cs.deadline));
          }
          if (!pOverdue && p.steps) {
            pOverdue = Object.keys(p.steps).some(stepKey => {
              const stepVal = p.steps[stepKey];
              if (stepVal && typeof stepVal === 'object') {
                return stepVal.status !== 'completed' && stepVal.deadline && isOverdue(stepVal.deadline);
              }
              return false;
            });
          }
        }
        if (pOverdue) {
          overdue++;
        }
      } else if (p.status === 'completed') {
        completed++;
      }
    });
    return { 
      total: projects.length, 
      active, 
      completed,
      overdue,
      totalArea: '1,240' // Benchmark area ha for current phase
    };
  }, [projects]);

  // Aggregate project activities from projects
  const recentActivities = useMemo(() => {
    let allActivities: any[] = [];
    projects.forEach(p => {
      if (p.activities) {
        allActivities = [...allActivities, ...p.activities.map(a => ({...a, projectName: p.name}))];
      }
    });
    return allActivities.sort((a, b) => b.timestamp - a.timestamp).slice(0, 5);
  }, [projects]);

  const pieData = [
    { name: 'Đang thực hiện', value: stats.active, color: '#3b82f6' }, // blue-500
    { name: 'Hoàn thành', value: stats.completed, color: '#10b981' }, // emarald-500
    { name: 'Chậm tiến độ', value: stats.overdue, color: '#ef4444' }, // red-500
  ].filter(d => d.value > 0);

  const getTypeData = () => {
     const types = { 'agri': 0, 'resident': 0, 'both': 0 };
     projects.forEach(p => {
       if (p.projectType === 'agri') types['agri']++;
       else if (p.projectType === 'resident') types['resident']++;
       else types['both']++;
     });
     return [
       { name: 'Đất Nông nghiệp', count: types['agri'], color: '#f59e0b' },
       { name: 'Đất Đô thị (Ở)', count: types['resident'], color: '#06b6d4' },
       { name: 'Nông nghiệp & Đất Ở', count: types['both'], color: '#8b5cf6' },
     ];
  };

  const typeData = getTypeData();

  return (
    <div className="flex-1 p-6 md:p-8 w-full max-w-7xl mx-auto overflow-y-auto bg-slate-50">
      
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        <div className="bg-white border border-slate-200 p-5 rounded-xl text-left">
          <div className="flex items-center justify-between mb-4">
             <div className="p-2.5 rounded-lg bg-blue-50 text-blue-600">
               <Layout className="w-5 h-5" />
             </div>
             <div className="flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md text-xs font-bold">
               <TrendingUp className="w-3 h-3" />
               <span>+12%</span>
             </div>
          </div>
          <h3 className="text-slate-500 text-xs font-semibold mb-1 uppercase tracking-wider">Tổng số dự án</h3>
          <p className="text-3xl font-bold text-slate-800">{stats.total}</p>
        </div>

        <div className="bg-white border border-slate-200 p-5 rounded-xl text-left">
          <div className="flex items-center justify-between mb-4">
             <div className="p-2.5 rounded-lg bg-indigo-50 text-indigo-600">
               <Activity className="w-5 h-5" />
             </div>
          </div>
          <h3 className="text-slate-500 text-xs font-semibold mb-1 uppercase tracking-wider">Đang thực hiện</h3>
          <p className="text-3xl font-bold text-slate-800">{stats.active}</p>
        </div>

        <div className="bg-white border border-slate-200 p-5 rounded-xl text-left">
           <div className="flex items-center justify-between mb-4">
             <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-600">
               <CheckCircle2 className="w-5 h-5" />
             </div>
          </div>
          <h3 className="text-slate-500 text-xs font-semibold mb-1 uppercase tracking-wider">Đã hoàn thành</h3>
          <p className="text-3xl font-bold text-slate-800">{stats.completed}</p>
        </div>

        <div className="bg-white border border-slate-200 p-5 rounded-xl text-left">
           <div className="flex items-center justify-between mb-4">
             <div className="p-2.5 rounded-lg bg-amber-50 text-amber-600">
               <Target className="w-5 h-5" />
             </div>
          </div>
          <h3 className="text-slate-500 text-xs font-semibold mb-1 uppercase tracking-wider">Tổng diện tích GPMB</h3>
          <p className="text-3xl font-bold text-slate-800">{stats.totalArea} <span className="text-sm font-medium text-slate-500">ha</span></p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8 text-left">
        {/* Biểu đồ Trạng thái */}
        <div className="lg:col-span-1 bg-white border border-slate-200 rounded-xl p-6">
           <h3 className="text-sm font-bold text-slate-800 mb-6">Tỉ lệ trạng thái dự án</h3>
           {pieData.length > 0 ? (
             <div className="w-full h-[280px]">
               <ResponsiveContainer width="100%" height="100%">
                 <PieChart>
                   <Pie
                     data={pieData}
                     cx="50%"
                     cy="50%"
                     innerRadius={60}
                     outerRadius={95}
                     paddingAngle={3}
                     dataKey="value"
                   >
                     {pieData.map((entry, index) => (
                       <Cell key={`cell-${index}`} fill={entry.color} />
                     ))}
                   </Pie>
                   <Tooltip formatter={(value) => [value, 'Dự án']} />
                   <Legend verticalAlign="bottom" height={36} iconType="circle" />
                 </PieChart>
               </ResponsiveContainer>
             </div>
           ) : (
             <div className="h-[280px] flex items-center justify-center text-slate-400 text-sm font-medium">Chưa có dữ liệu</div>
           )}
        </div>

        {/* Biểu đồ Loại đất */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-6">
           <h3 className="text-sm font-bold text-slate-800 mb-6">Phân tích theo loại đất GPMB</h3>
           <div className="w-full h-[280px]">
             <ResponsiveContainer width="100%" height="100%">
               <BarChart data={typeData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                 <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} dy={10} />
                 <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} />
                 <Tooltip cursor={{fill: '#F1F5F9'}} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                 <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={60}>
                    {typeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                 </Bar>
               </BarChart>
             </ResponsiveContainer>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-left">
        {/* Timeline */}
        <div className="lg:col-span-1 bg-white border border-slate-200 rounded-xl p-6">
           <h3 className="text-sm font-bold text-slate-800 mb-6">Hoạt động gần đây</h3>
           <div className="space-y-6 relative before:absolute before:inset-0 before:ml-[15px] before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
              {recentActivities.length > 0 ? recentActivities.map((act, i) => (
                <div key={i} className="relative flex items-start gap-4">
                   <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0 z-10 ring-4 ring-white">
                      <Activity className="w-4 h-4 text-blue-600" />
                   </div>
                   <div className="flex-1 pb-1">
                      <p className="text-sm text-slate-600 leading-snug">
                        <span className="font-bold text-slate-900">{act.userName}</span> {act.action} <span className="font-medium text-slate-800">{act.target || act.projectName}</span>
                      </p>
                      <p className="text-xs text-slate-400 mt-1.5">{formatDistanceToNow(act.timestamp, { addSuffix: true, locale: vi })}</p>
                   </div>
                </div>
              )) : (
                 <div className="text-sm italic text-slate-400 py-4 text-center">Chưa có hoạt động nào</div>
              )}
           </div>
        </div>

         {/* Banners */}
         <div className="lg:col-span-2 flex flex-col gap-6">
            <div className="bg-gradient-to-r from-blue-600 border border-blue-700 to-indigo-600 rounded-xl p-6 text-white relative overflow-hidden flex-1 flex flex-col justify-center">
               <div className="absolute right-0 top-0 opacity-10 w-64 h-64 translate-x-10 -translate-y-10 rounded-full bg-white blur-3xl"></div>
               <h3 className="text-lg font-bold mb-2 relative z-10">Dự án tiêu điểm: Khu CN Tân Phú</h3>
               <p className="text-blue-100 text-sm max-w-md relative z-10">Dự án trọng điểm cần lưu ý đang ở bước chi trả bồi thường. Đề nghị các phòng ban tập trung giải quyết các vướng mắc tồn đọng.</p>
               <div className="mt-4 relative z-10">
                 <button className="bg-white text-blue-600 text-sm font-bold px-4 py-2 rounded-lg hover:bg-blue-50 transition-colors shadow-sm">Xem chi tiết</button>
               </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col sm:flex-row items-center gap-6 flex-1 relative overflow-hidden">
                <div className="bg-blue-50 w-20 h-20 rounded-full flex items-center justify-center shrink-0 border border-blue-100 relative">
                   <div className="absolute inset-2 border-2 border-blue-200 border-dashed rounded-full animate-spin-slow"></div>
                   <MapIcon className="w-8 h-8 text-blue-600" />
                </div>
                <div className="flex-1">
                   <h3 className="text-sm font-bold text-slate-800 mb-1">Dữ liệu bản đồ GPMB</h3>
                   <p className="text-sm text-slate-500 mb-3">Tích hợp dữ liệu trích lục bản đồ địa chính để theo dõi thực địa.</p>
                   <button className="text-blue-600 text-sm font-bold hover:underline">Mở công cụ bản đồ →</button>
                </div>
            </div>
         </div>
      </div>
    </div>
  );
}
