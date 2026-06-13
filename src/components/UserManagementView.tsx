import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, Shield, Mail, CheckCircle2, XCircle, Clock, Search } from 'lucide-react';
import { collection, setDoc, deleteDoc, doc, serverTimestamp, query, getDocs, updateDoc, where, arrayRemove } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { toast } from 'sonner';
import { cn } from '../lib/utils';

const safeToMillis = (ts: any): number => {
  if (!ts) return 0;
  if (typeof ts.toMillis === 'function') {
    return ts.toMillis();
  }
  if (typeof ts.toDate === 'function') {
    return ts.toDate().getTime();
  }
  if (ts instanceof Date) {
    return ts.getTime();
  }
  if (typeof ts === 'number') {
    return ts;
  }
  if (typeof ts === 'string') {
    const parsed = Date.parse(ts);
    return isNaN(parsed) ? 0 : parsed;
  }
  if (ts.seconds !== undefined) {
    return ts.seconds * 1000 + (ts.nanoseconds || 0) / 1000000;
  }
  return 0;
};

interface AuthorizedUser {
  id: string;
  email: string;
  role: 'admin' | 'editor' | 'viewer';
  status?: 'approved' | 'rejected' | 'pending';
  addedAt: any;
}

interface PendingUser {
  id: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  requestedAt: any;
  status: 'pending';
}

export function UserManagementView() {
  const [users, setUsers] = useState<AuthorizedUser[]>([]);
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'viewer'>('viewer');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedRoleForApproval, setSelectedRoleForApproval] = useState<Record<string, 'admin' | 'viewer'>>({});
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'editor' | 'viewer'>('all');

  useEffect(() => {
    let active = true;
    const qAuth = query(collection(db, 'authorized_emails'));
    const qPending = query(collection(db, 'pending_users'));

    const loadAllData = async () => {
      setLoading(true);
      try {
        const [snapshotAuth, snapshotPending] = await Promise.all([
          getDocs(qAuth),
          getDocs(qPending)
        ]);

        if (!active) return;

        const u = snapshotAuth.docs.map(doc => ({
          id: doc.id,
          email: doc.data().email || doc.id,
          ...doc.data()
        })) as AuthorizedUser[];
        u.sort((a, b) => a.email.localeCompare(b.email));
        setUsers(u);

        const pu = snapshotPending.docs.map(doc => ({
           id: doc.id,
           email: doc.data().email || doc.id,
           ...doc.data()
        })) as PendingUser[];
        
        pu.sort((a, b) => {
          const timeA = safeToMillis(a.requestedAt);
           const timeB = safeToMillis(b.requestedAt);
          return timeB - timeA;
        });
        setPendingUsers(pu);
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'authorized_emails');
      } finally {
        if (active) setLoading(false);
      }
    };

    loadAllData();

    return () => {
      active = false;
    };
  }, [refreshKey]);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim()) return;

    setIsSubmitting(true);
    const email = newEmail.trim().toLowerCase();
    
    try {
      await setDoc(doc(db, 'authorized_emails', email), {
        email,
        role: newRole,
        status: 'approved',
        addedAt: serverTimestamp()
      });
      setNewEmail('');
      toast.success(`Đã thêm ${email} vào danh sách cho phép`);
      setRefreshKey(prev => prev + 1);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'authorized_emails');
      toast.error('Có lỗi xảy ra');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApprovePending = async (email: string) => {
    const roleToAssign = selectedRoleForApproval[email] || 'viewer';
    try {
      // 1. Add to authorized_emails
      await setDoc(doc(db, 'authorized_emails', email.toLowerCase()), {
        email: email.toLowerCase(),
        role: roleToAssign,
        status: 'approved',
        addedAt: serverTimestamp()
      }, { merge: true });
      // 2. Delete from pending_users
      await deleteDoc(doc(db, 'pending_users', email.toLowerCase()));
      toast.success(`Đã cấp quyền cho ${email}`);
      setRefreshKey(prev => prev + 1);
    } catch (error) {
       console.error("Approve error", error);
       toast.error('Có lỗi xảy ra khi cấp quyền');
    }
  };

  const handleRejectPending = async (email: string) => {
      if (!confirm(`Bạn có chắc chắn muốn từ chối yêu cầu truy cập của ${email}?`)) return;
      try {
        await deleteDoc(doc(db, 'pending_users', email.toLowerCase()));
        await deleteDoc(doc(db, 'authorized_emails', email.toLowerCase()));
        toast.success(`Đã từ chối ${email}`);
        setRefreshKey(prev => prev + 1);
      } catch (error) {
        console.error("Reject error", error);
        toast.error('Có lỗi xảy ra khi từ chối');
      }
  };

  const handleRemoveUser = async (email: string) => {
    const isSystemAdmin = (e: string) => ['kingofhero241@gmail.com', 'tranlehoang.071196@gmail.com'].includes(e.toLowerCase());
    if (isSystemAdmin(email)) {
      toast.error('Không thể xóa tài khoản Admin gốc!');
      return;
    }
    if (!confirm(`Bạn có chắc chắn muốn xóa quyền truy cập của ${email}? Xóa tài khoản này cũng sẽ gỡ họ khỏi tất cả các dự án.`)) return;

    try {
      const targetEmail = email.toLowerCase();
      await deleteDoc(doc(db, 'authorized_emails', targetEmail));
      
      // Khảo sát các dự án có chứa email này trong danh sách thành viên để gỡ ra bằng arrayRemove và where query
      const qProjectsWithEmail = query(
        collection(db, 'projects'),
        where('authorizedEmails', 'array-contains', targetEmail)
      );
      const projectsSnapshot = await getDocs(qProjectsWithEmail);
      
      const updatePromises = projectsSnapshot.docs.map((projectDoc) => {
        const projectRef = doc(db, 'projects', projectDoc.id);
        return updateDoc(projectRef, {
          authorizedEmails: arrayRemove(targetEmail)
        });
      });
      
      await Promise.all(updatePromises);
      
      toast.success('Đã xóa quyền truy cập và gỡ khỏi các dự án');
      setRefreshKey(prev => prev + 1);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'authorized_emails');
    }
  };

  const handleUpdateRole = async (email: string, role: string) => {
    const isSystemAdmin = (e: string) => ['kingofhero241@gmail.com', 'tranlehoang.071196@gmail.com'].includes(e.toLowerCase());
    if (isSystemAdmin(email)) {
      toast.error('Không thể thay đổi quyền của tài khoản Admin gốc!');
      setRefreshKey(prev => prev + 1);
      return;
    }
    try {
      await setDoc(doc(db, 'authorized_emails', email.toLowerCase()), { role, status: 'approved' }, { merge: true });
      toast.success(`Đã cập nhật quyền của ${email}`);
      setRefreshKey(prev => prev + 1);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'authorized_emails');
    }
  };

  const approvedUsers = users.filter((u: any) => u.status !== 'pending');
  const filteredApprovedUsers = useMemo(() => {
    return approvedUsers.filter(u => {
      const emailMatch = u.email.toLowerCase().includes(searchTerm.toLowerCase().trim());
      const roleMatch = roleFilter === 'all' || u.role === roleFilter;
      return emailMatch && roleMatch;
    });
  }, [approvedUsers, searchTerm, roleFilter]);

  const legacyPendingUsers = users.filter((u: any) => u.status === 'pending').map(u => ({
    id: u.id,
    email: u.email,
    status: 'pending' as const,
    requestedAt: u.addedAt,
    photoURL: undefined as string | undefined,
    displayName: undefined as string | undefined
  }));

  const allPendingUsers = [...pendingUsers, ...legacyPendingUsers].sort((a, b) => {
    const timeA = safeToMillis(a.requestedAt);
    const timeB = safeToMillis(b.requestedAt);
    return timeB - timeA;
  });

  if (loading) {
    return (
      <div className="h-full flex flex-col bg-slate-50 w-full overflow-hidden">
        <div className="p-8 pb-0">
          <div className="h-8 bg-slate-200/80 rounded w-1/4 animate-pulse" />
          <div className="h-4 bg-slate-200/50 rounded w-1/3 mt-2 animate-pulse" />
        </div>
        <div className="flex-1 overflow-y-auto p-8 space-y-10">
          <section>
            <div className="h-4 bg-slate-200 rounded w-1/6 animate-pulse mb-4" />
            <div className="grid gap-4">
              <div className="bg-white border border-slate-200/60 rounded-xl p-6 h-20 animate-pulse" />
              <div className="bg-white border border-slate-200/60 rounded-xl p-6 h-20 animate-pulse" />
            </div>
          </section>
          <section>
            <div className="flex items-end justify-between mb-4 gap-4 flex-wrap">
              <div className="h-4 bg-slate-200 rounded w-1/5 animate-pulse" />
              <div className="h-10 bg-slate-200 rounded w-1/3 animate-pulse" />
            </div>
            <div className="bg-white border border-slate-200/60 rounded-xl h-48 animate-pulse" />
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-slate-50/50 w-full overflow-hidden">
        <div className="p-6 md:p-8 pb-3">
          <h2 className="text-2xl font-bold text-slate-950 tracking-tight font-sans">Quản lý người dùng</h2>
          <p className="text-xs text-slate-500 mt-1">Duyệt yêu cầu truy cập và quản lý phân quyền hệ thống</p>
        </div>

        <div className="flex-1 overflow-y-auto p-6 md:p-8 pt-2 space-y-8">
          {/* Pending Users Section */}
          <section>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              Danh sách chờ duyệt 
              {allPendingUsers.length > 0 && (
                <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full text-xs border border-amber-200/40 font-medium">{allPendingUsers.length}</span>
              )}
            </h3>

            {allPendingUsers.length === 0 ? (
               <div className="p-8 bg-white rounded-xl border border-dashed border-slate-200 flex flex-col items-center justify-center">
                  <div className="w-10 h-10 bg-slate-50 flex items-center justify-center rounded-full mb-3 border border-slate-100">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500/80" />
                  </div>
                  <p className="text-xs font-semibold text-slate-700">Đã duyệt tất cả</p>
                  <p className="text-xs text-slate-400 mt-1">Không có yêu cầu truy cập nào đang chờ</p>
               </div>
            ) : (
               <div className="grid gap-3">
                 {allPendingUsers.map(pu => (
                    <div key={pu.id} className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-[0_1px_2px_rgba(0,0,0,0.01)] text-left">
                       <div className="flex items-center gap-3">
                          {pu.photoURL ? (
                             <img src={pu.photoURL} alt="" className="w-9 h-9 rounded-full border border-slate-150" />
                          ) : (
                             <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200/50">
                                <Mail className="w-4 h-4 text-slate-400" />
                             </div>
                          )}
                          <div>
                             <p className="text-xs font-semibold text-slate-900">{pu.displayName || pu.email}</p>
                             <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-1">
                               <span>{pu.email}</span>
                               <span className="w-1 h-1 rounded-full bg-slate-200"></span>
                               {pu.requestedAt ? (
                                 <span className="flex items-center gap-1">
                                    <Clock className="w-3.5 h-3.5" />
                                    {typeof pu.requestedAt.toDate === 'function' ? new Date(pu.requestedAt.toDate()).toLocaleDateString('vi-VN') : 'Vừa cập nhật'}
                                 </span>
                               ) : (
                                 <span>Vừa yêu cầu</span>
                               )}
                             </div>
                          </div>
                       </div>
                       <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
                          <select 
                             value={selectedRoleForApproval[pu.email] || 'viewer'}
                             onChange={(e) => setSelectedRoleForApproval({...selectedRoleForApproval, [pu.email]: e.target.value as any})}
                             className="text-xs px-2.5 h-9 border border-slate-200 rounded-lg outline-none cursor-pointer focus:border-slate-300 bg-white font-medium"
                          >
                             <option value="viewer">Người xem</option>
                             <option value="admin">Quản trị viên</option>
                          </select>
                          <button
                            onClick={() => handleApprovePending(pu.email)}
                            className="h-9 px-3.5 bg-blue-600 text-white rounded-lg text-xs font-semibold shadow-sm hover:bg-blue-700 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" /> Duyệt
                          </button>
                          <button
                            onClick={() => handleRejectPending(pu.email)}
                            className="h-9 px-3.5 bg-white border border-slate-200 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-50 hover:text-slate-900 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                             <XCircle className="w-3.5 h-3.5" /> Từ chối
                           </button>
                        </div>
                     </div>
                  ))}
                </div>
             )}
          </section>

          {/* Authorized Users Section */}
          <section>
            <div className="flex items-end justify-between mb-4 gap-4 flex-wrap">
               <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                 Tài khoản đã phân quyền
                 <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-xs font-medium border border-slate-200/60">{approvedUsers.length}</span>
               </h3>

               <form onSubmit={handleAddUser} className="flex flex-col sm:flex-row gap-2 w-full sm:max-w-md">
                  <div className="flex-1 relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="email"
                      placeholder="Thêm email trực tiếp..."
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      required
                      className="w-full pl-9 pr-3 h-9 bg-white border border-slate-200 rounded-lg text-xs font-medium outline-none focus:border-slate-300 transition-all font-sans placeholder-slate-400"
                    />
                  </div>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as any)}
                    className="h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs font-medium outline-none focus:border-slate-350 transition-all font-sans cursor-pointer"
                  >
                    <option value="viewer">Người xem</option>
                    <option value="editor">Cán bộ chuyên môn</option>
                    <option value="admin">Quản trị viên</option>
                  </select>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="h-9 px-4 bg-slate-950 hover:bg-slate-900 text-white rounded-lg font-semibold text-xs transition-all shadow-sm flex flex-shrink-0 items-center justify-center disabled:opacity-50 cursor-pointer"
                  >
                    Thêm
                  </button>
               </form>
            </div>

            {approvedUsers.length > 0 && (
              <div className="flex flex-col sm:flex-row gap-2.5 w-full bg-white border border-slate-200/70 p-3 rounded-xl mb-3 shadow-[0_1px_2px_rgba(0,0,0,0.01)] items-center">
                <div className="relative flex-1 w-full">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Tìm kiếm tài khoản bằng email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3 h-9 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold outline-none focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500/20 transition-all placeholder:font-normal placeholder-slate-400 font-sans"
                  />
                </div>
                <div className="flex items-center gap-1.5 w-full sm:w-auto shrink-0 self-stretch sm:self-auto">
                  <select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value as any)}
                    className="h-9 px-3 w-full sm:w-36 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all font-sans cursor-pointer"
                  >
                    <option value="all">Tất cả vai trò</option>
                    <option value="admin">Quản trị viên</option>
                    <option value="editor">Cán bộ chuyên môn</option>
                    <option value="viewer">Người xem</option>
                  </select>
                </div>
              </div>
            )}

            <div className="bg-white border flex flex-col border-slate-250 rounded-xl shadow-[0_1px_2px_rgba(0,0,0,0.01)] overflow-hidden">
               {approvedUsers.length === 0 ? (
                   <div className="text-center py-16 flex flex-col items-center justify-center bg-slate-50/50">
                     <div className="w-14 h-14 bg-white border border-slate-200 flex items-center justify-center rounded-xl mb-4 shadow-sm">
                       <Shield className="w-6 h-6 text-slate-400" />
                     </div>
                     <p className="text-xs font-semibold text-slate-700 mb-1">Chưa có thành viên nào</p>
                     <p className="text-xs text-slate-400">Hãy thêm email cụ thể tại ô bên trên để cấp quyền.</p>
                   </div>
               ) : filteredApprovedUsers.length === 0 ? (
                   <div className="text-center py-12 flex flex-col items-center justify-center bg-slate-50/50">
                     <div className="w-10 h-10 bg-white border border-slate-200 flex items-center justify-center rounded-lg mb-3 shadow-sm text-slate-450 flex items-center justify-center">
                       <Search className="w-4 h-4 text-slate-400" />
                     </div>
                     <p className="text-xs font-semibold text-slate-700 mb-1">Không tìm thấy tài khoản</p>
                     <p className="text-xs text-slate-400">Thay đổi từ khóa hoặc bộ lọc vai trò để tìm kiếm.</p>
                   </div>
               ) : (
                  <div className="divide-y divide-slate-100">
                    {filteredApprovedUsers.map((u) => (
                      <div key={u.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-white hover:bg-slate-50 transition-colors group gap-4 text-left">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full flex items-center justify-center border bg-slate-50 border-slate-200">
                            <Mail className="w-5 h-5 text-slate-400" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold text-slate-950">{u.email}</p>
                              {u.status === 'pending' && (
                                <span className="px-2 py-0.5 rounded text-xs font-semibold tracking-wide bg-amber-50 text-amber-700 border border-amber-200/50">Chờ duyệt</span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 mt-1.5">
                              <Shield className="w-3.5 h-3.5 text-slate-400" />
                              <div className={cn(
                                'inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border leading-none scale-95 origin-left',
                                (['kingofhero241@gmail.com', 'tranlehoang.071196@gmail.com'].includes(u.email.toLowerCase()) || (u.role || 'viewer') === 'admin')
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-250/20'
                                  : (u.role || 'viewer') === 'editor'
                                    ? 'bg-blue-50 text-blue-800 border-blue-250/20'
                                    : 'bg-slate-100 text-slate-600 border-slate-200'
                              )}>
                                <select 
                                  value={['kingofhero241@gmail.com', 'tranlehoang.071196@gmail.com'].includes(u.email.toLowerCase()) ? 'admin' : (u.role || 'viewer')} 
                                  disabled={['kingofhero241@gmail.com', 'tranlehoang.071196@gmail.com'].includes(u.email.toLowerCase())}
                                  onChange={(e) => handleUpdateRole(u.email || u.id, e.target.value)}
                                  className="bg-transparent border-none outline-none p-0 text-[10px] font-extrabold uppercase focus:ring-0 leading-none cursor-pointer disabled:cursor-not-allowed text-inherit pr-6"
                                >
                                  <option value="admin" className="text-slate-800">Quản trị viên</option>
                                  <option value="editor" className="text-slate-800">Cán bộ chuyên môn</option>
                                  <option value="viewer" className="text-slate-800">Người xem</option>
                                </select>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 pr-2">
                          {u.status === 'pending' && (
                            <button
                              onClick={() => handleUpdateRole(u.email || u.id, u.role || 'viewer')}
                              className="px-3 h-9 bg-blue-600 text-white hover:bg-blue-700 rounded-lg text-xs font-semibold shadow-sm transition-all flex items-center justify-center cursor-pointer"
                            >
                              Duyệt ngay
                            </button>
                          )}
                          {!['kingofhero241@gmail.com', 'tranlehoang.071196@gmail.com'].includes(u.email.toLowerCase()) && (
                            <button
                              onClick={() => handleRemoveUser(u.email || u.id)}
                              className="p-2 h-9 w-9 flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all border border-slate-100 sm:border-transparent cursor-pointer"
                              title="Xóa khỏi danh sách"
                            >
                              <span className="sr-only">Xóa</span>
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
               )}
            </div>
          </section>
        </div>
    </div>
  );
}
