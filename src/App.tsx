/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';
import { auth, signInWithGoogle, handleFirestoreError, OperationType } from './lib/firebase';
import { LogOut, Layout, Plus, ChevronDown, BarChart2, FolderKanban, Users, Search, ChevronLeft, ChevronRight, ArrowLeft, Check, Bell, HelpCircle, Download, Calendar, Filter, Settings, ListFilter } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from './lib/firebase';
import { Project, STEP_CATEGORIES, STEP_LABELS } from './types';
import { cn } from './lib/utils';
import { formatRelative } from './utils/dateUtils';
import { isOverdue, getOverdueText, getCategoryStepsOrdered } from './components/steps/stepUtils';
import { AddProjectModal } from './components/AddProjectModal';
import { ProjectMainView } from './components/ProjectMainView';
import { UserManagementView } from './components/UserManagementView';

import { DashboardView } from './components/DashboardView';

import { normalizeProject } from './lib/projectService';
import { toast, Toaster } from 'sonner';

import { useDebounce } from './lib/hooks';
import { useFuseSearch } from './hooks/useFuseSearch';
import { collection, query, onSnapshot, addDoc, serverTimestamp, orderBy, doc, getDoc, limit } from 'firebase/firestore';

const checkInventoryCompleted = (invStep: any) => {
  if (!invStep) return false;
  if (invStep.status === 'completed') return true;
  const r = invStep.rounds || [];
  if (r.length === 0) return false;
  return r.every((round: any) => round.status === 'completed');
};


const getStepInfo = (project: Project, stepKey: string) => {
  if (stepKey.startsWith('custom_')) {
    const customId = stepKey.replace('custom_', '');
    const step = project.customSteps?.find(cs => cs.id === customId);
    return {
      label: step?.name || 'Mục công việc mới',
      status: step?.status || 'pending',
      deadline: step?.deadline || '',
      isCustom: true
    };
  }

  const s = project.steps[stepKey as keyof typeof project.steps];
  let status = 'pending';
  let deadline = '';
  if (stepKey === 'inventory') {
    const isCompleted = s && (s.status === 'completed' || checkInventoryCompleted(s));
    status = isCompleted ? 'completed' : ((s && s.status) || 'pending');
    deadline = s?.deadline || '';
  } else if (s) {
    status = (typeof s === 'object' && s !== null ? s.status : s) || 'pending';
    deadline = (typeof s === 'object' && s !== null ? s.deadline : '') || '';
  }

  return {
    label: STEP_LABELS[stepKey] || stepKey,
    status: status as any,
    deadline,
    isCustom: false
  };
};

const getStepDotColor = (project: Project, stepKey: string, status: string) => {
  const hasPendingInventoryIssues = stepKey === 'inventory' && 
    (project.inventoryIssues || []).some(i => i.status === 'pending');

  if (hasPendingInventoryIssues || status === 'overdue') {
    return '#BA7517'; // Yellow: có vướng mắc hoặc cần chú ý
  }
  if (status === 'completed') {
    return '#3B6D11'; // Green: hoàn thành
  }
  if (status === 'in_progress') {
    return '#185FA5'; // Blue: đang thực hiện
  }
  return '#94a3b8'; // Gray: chưa bắt đầu / pending / not_applicable
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [currentView, setCurrentView] = useState<'projects' | 'users' | 'dashboard'>('projects');
  const [userRole, setUserRole] = useState<'admin' | 'editor' | 'viewer' | null>(null);
  const [userStatus, setUserStatus] = useState<'approved' | 'pending' | 'rejected' | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [projectFilter, setProjectFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'agri' | 'resident' | 'both'>('all');
  const [sortOrder, setSortOrder] = useState<'recently_updated' | 'newest' | 'oldest'>('recently_updated');
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [activeCategoryId, setActiveCategoryId] = useState<string>('preparation');
  const [activeStepKey, setActiveStepKey] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [copiedDomain, setCopiedDomain] = useState(false);

  const [globalAvailableUsers, setGlobalAvailableUsers] = useState<{id: string, email: string}[]>([]);
  const [globalUserRolesMap, setGlobalUserRolesMap] = useState<Record<string, string>>({});

  const fetchGlobalUsers = async () => {
    try {
      const { getDocs, collection } = await import('firebase/firestore');
      const snapshot = await getDocs(collection(db, 'authorized_emails'));
      const roles: Record<string, string> = {};
      const list: any[] = [];
      snapshot.docs.forEach(doc => {
        const email = (doc.data().email || doc.id).toLowerCase();
        const r = doc.data().role || 'viewer';
        roles[email] = r;
        list.push({ id: doc.id, email });
      });
      setGlobalUserRolesMap(roles);
      setGlobalAvailableUsers(list);
    } catch (err) {
      console.error("Error loading global users map", err);
    }
  };

  useEffect(() => {
    if (user) {
      fetchGlobalUsers();
    } else {
      setGlobalAvailableUsers([]);
      setGlobalUserRolesMap({});
    }
  }, [user]);

  const handleGoogleSignIn = async () => {
    setAuthError(false as any); // Reset to null or empty
    setAuthError(null);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      console.error("Sign-in error: ", err);
      const msg = err?.message || String(err);
      if (err?.code === 'auth/unauthorized-domain' || msg.includes('auth/unauthorized-domain') || msg.includes('unauthorized-domain')) {
        setAuthError('unauthorized-domain');
      } else {
        setAuthError(msg || 'Đã xảy ra lỗi khi đăng nhập.');
      }
    }
  };

  // Sync with active step events from ProjectMainView
  useEffect(() => {
    const handleStepChanged = (e: Event) => {
      const customEvent = e as CustomEvent<{ categoryId: string; stepKey: string }>;
      if (customEvent && customEvent.detail) {
        setActiveCategoryId(customEvent.detail.categoryId);
        setActiveStepKey(customEvent.detail.stepKey);
      }
    };
    window.addEventListener('app:step-changed', handleStepChanged);
    return () => {
      window.removeEventListener('app:step-changed', handleStepChanged);
    };
  }, []);

  const handleSelectStep = (categoryId: string, stepKey: string) => {
    setActiveCategoryId(categoryId);
    setActiveStepKey(stepKey);
    window.dispatchEvent(new CustomEvent('app:select-step', {
      detail: { categoryId, stepKey }
    }));
  };

  const IS_DEV = !!import.meta.env.DEV;
  if (IS_DEV) console.warn('⚠️ DEV mode: auto-editor enabled. Ensure this is not production!');

  const isAdmin = userRole === 'admin' && userStatus === 'approved';
  const isApproved = userStatus === 'approved';
  const isProjectMember = (user?.email && (
    selectedProject?.authorizedEmails?.includes(user.email.toLowerCase()) ||
    selectedProject?.ownerId === user?.uid
  )) ?? false;
  const canEdit = isProjectMember && (isAdmin || userRole === 'editor');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setIsAuthorizing(true);
        const email = firebaseUser.email?.toLowerCase();
        setUser(firebaseUser);
        
        const adminEmail = import.meta.env.VITE_ADMIN_EMAIL;
        const isMasterAdmin = email === 'kingofhero241@gmail.com' || email === 'tranlehoang.071196@gmail.com' || (adminEmail && email === adminEmail.toLowerCase());
        if (isMasterAdmin) {
          try {
            const { setDoc } = await import('firebase/firestore');
            const userDocRef = doc(db, 'authorized_emails', email);
            const userDoc = await getDoc(userDocRef);
            if (!userDoc.exists() || userDoc.data()?.role !== 'admin' || userDoc.data()?.status !== 'approved') {
               await setDoc(userDocRef, { email, role: 'admin', status: 'approved' }, { merge: true });
            }
          } catch (err) {
            console.error('Developer admin bootstrap error:', err);
          }
          setUserRole('admin');
          setUserStatus('approved');
        } else if (IS_DEV) {
          try {
            const { setDoc } = await import('firebase/firestore');
            const userDocRef = doc(db, 'authorized_emails', email || '');
            const userDoc = await getDoc(userDocRef);
            if (!userDoc.exists()) {
              // DEV ONLY — remove before production deploy
              await setDoc(userDocRef, { email, role: 'editor', status: 'approved' });
              setUserRole('editor');
              setUserStatus('approved');
            } else {
              const data = userDoc.data();
              setUserRole(data?.role || 'viewer');
              setUserStatus(data?.status || 'approved');
            }
          } catch (err) {
            console.error('DEV auth bootstrap error:', err);
            setUserRole('viewer');
            setUserStatus('pending');
          }
        } else {
          try {
            const { setDoc } = await import('firebase/firestore');
            const userDocRef = doc(db, 'authorized_emails', email || '');
            const userDoc = await getDoc(userDocRef);
            
            if (userDoc.exists()) {
              const data = userDoc.data();
              setUserRole(data?.role || 'viewer');
              setUserStatus(data?.status || 'approved');
            } else {
              // First time login - check if pending request exists
              const pendingDocRef = doc(db, 'pending_users', email || '');
              const pendingDoc = await getDoc(pendingDocRef);
              
              setUserRole('viewer');
              setUserStatus('pending');
              
              if (!pendingDoc.exists()) {
                 try {
                   await setDoc(pendingDocRef, { 
                      email: email,
                      displayName: firebaseUser.displayName || '',
                      photoURL: firebaseUser.photoURL || '',
                      status: 'pending',
                      requestedAt: serverTimestamp()
                   });
                 } catch (err) {
                   console.error('Failed to create pending request:', err);
                 }
               }
            }
          } catch (error) {
            console.error('Role fetch error:', error);
            setUserRole('viewer');
            setUserStatus('pending');
          }
        }
        setIsAuthorizing(false);
      } else {
        setUser(null);
        setUserRole(null);
        setUserStatus(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // useEffect 1: Lắng nghe danh sách projects (dependency: [user, isApproved])
  useEffect(() => {
    if (!user || !isApproved) {
      setProjects([]);
      return;
    }

    const q = query(
      collection(db, 'projects'),
      orderBy('updatedAt', 'desc'),
      limit(50) // Reduced read bandwidth by limiting initial load
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const projs = snapshot.docs.map((doc) => normalizeProject(doc.data(), doc.id)) as Project[];
      setProjects(projs);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'projects');
    });

    return unsubscribe;
  }, [user, isApproved]);

  // useEffect 2: Đồng bộ selectedProject từ danh sách projects khi selectedProjectId hoặc projects thay đổi
  useEffect(() => {
    if (selectedProjectId) {
      const updated = projects.find(p => p.id === selectedProjectId);
      if (updated) {
        setSelectedProject(updated);
      } else {
        setSelectedProject(null);
        setSelectedProjectId(null);
      }
    } else {
      setSelectedProject(null);
    }
  }, [selectedProjectId, projects]);

  const handleSelectProject = (project: Project | null) => {
    setSelectedProject(project);
    setSelectedProjectId(project?.id || null);
    if (!project) {
      setActiveStepKey(null);
      setActiveCategoryId('preparation');
    } else {
      setActiveStepKey('overview');
      setActiveCategoryId('overview');
    }
    
    // Scroll container to top when entering or leaving a project
    setTimeout(() => {
      const scrollContainer = document.getElementById('main-scroll-container');
      if (scrollContainer) {
        scrollContainer.scrollTo({ top: 0, behavior: 'instant' });
      }
    }, 10);
  };

  const handleAddProject = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user || isCreating) return;
    
    setIsCreating(true);
    const formData = new FormData(e.currentTarget);
    const name = formData.get('name') as string;
    const projectType = formData.get('projectType') as 'agri' | 'resident' | 'both';
    
    const newProject = {
      name,
      description: '',
      status: 'active' as const,
      projectType,
      ownerId: user.uid,
      authorizedEmails: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      steps: {
        landmarks_handover: { status: 'in_progress', date: '' },
        acquisition_plan: { status: 'in_progress', links: [] },
        deployment_meeting: { status: 'in_progress', links: [], invitationDate: '' },
        notice_request: 'in_progress',
        budget_estimate: 'in_progress',
        inventory: { 
          status: 'in_progress', 
          agriPlots: 0, agriHouseholds: 0, 
          nonAgriPlots: 0, nonAgriHouseholds: 0, 
          orgs: 0, graves: 0, assets: 0, 
          structures: 0, graveHouseholds: 0, rounds: [], deadline: '' 
        },
        confirmation_request: { status: 'in_progress', date: '', links: [] },
        plan_draft: { status: 'in_progress', date: '', deadline: '' },
        plan_public: 'in_progress',
        appraisal_submit: { status: 'in_progress', amount: 0, cost: 0, plots: 0, households: 0, links: [] },
        approval: { status: 'in_progress', amount: 0, cost: 0, plots: 0, households: 0, links: [] },
        decision_public: 'in_progress',
        payment: { status: 'in_progress', amount: 0, donePlots: 0, totalPlots: 0, doneHouseholds: 0, totalHouseholds: 0 },
      }
    };

    try {
      const docRef = await addDoc(collection(db, 'projects'), newProject);
      setIsAddModalOpen(false);
      toast.success('Dự án đã được tạo thành công');
      // The onSnapshot will pick up the new project and update the list.
      // We can optionally select it here once it's in the projects list, 
      // but the snapshot might take a sec.
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'projects');
      toast.error('Không thể tạo dự án. Vui lòng thử lại.');
    } finally {
      setIsCreating(false);
    }
  };

   const filteredProjects = useFuseSearch<Project>(
     projects,
     ['name', 'id', 'location'],
     debouncedSearchQuery
   );
 
   const filteredAndSortedProjects = useMemo(() => {
     let result = [...filteredProjects];
     
     if (projectFilter === 'active') {
       result = result.filter(p => p.status === 'active');
     } else if (projectFilter === 'completed') {
       result = result.filter(p => p.status === 'completed' || p.status === 'archived');
     }
 
     if (typeFilter !== 'all') {
       result = result.filter(p => p.projectType === typeFilter);
     }
     
     result.sort((a, b) => {
       if (sortOrder === 'newest') {
         const timeA = a.createdAt?.toMillis() || 0;
         const timeB = b.createdAt?.toMillis() || 0;
         return timeB - timeA;
       } else if (sortOrder === 'oldest') {
         const timeA = a.createdAt?.toMillis() || 0;
         const timeB = b.createdAt?.toMillis() || 0;
         return timeA - timeB;
       } else if (sortOrder === 'recently_updated') {
         const timeA = Math.max(a.updatedAt?.toMillis() || 0, a.createdAt?.toMillis() || 0);
         const timeB = Math.max(b.updatedAt?.toMillis() || 0, b.createdAt?.toMillis() || 0);
         return timeB - timeA;
       }
       return 0;
     });
     
     return result;
   }, [filteredProjects, projectFilter, typeFilter, sortOrder]);

  if (loading || isAuthorizing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-full h-screen flex flex-col bg-slate-50">
          <div className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-4 md:px-8">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-slate-200 rounded-lg animate-pulse" />
              <div className="w-32 h-5 bg-slate-200 rounded animate-pulse" />
            </div>
            <div className="w-8 h-8 rounded-full bg-slate-200 animate-pulse" />
          </div>
          <div className="flex-1 flex overflow-hidden">
            <div className="w-full md:w-80 border-r border-slate-200 bg-white p-4 hidden md:flex flex-col gap-4">
              <div className="w-full h-10 bg-slate-100 rounded-lg animate-pulse mb-4" />
              {[1, 2, 3, 4, 5].map(i => (
                 <div key={i} className="w-full h-20 bg-slate-50 rounded-xl mb-3 animate-pulse border border-slate-100" />
              ))}
            </div>
            <div className="flex-1 p-8 flex flex-col gap-6">
              <div className="w-1/3 h-8 bg-slate-200 rounded-lg animate-pulse" />
              <div className="w-full h-64 bg-slate-50 border border-slate-200 rounded-xl animate-pulse" />
              <div className="flex gap-4">
                 <div className="w-1/2 h-40 bg-slate-50 border border-slate-200 rounded-xl animate-pulse" />
                 <div className="w-1/2 h-40 bg-slate-50 border border-slate-200 rounded-xl animate-pulse" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen w-full relative flex items-center justify-center p-4 md:p-8 bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 overflow-hidden font-sans select-none">
        {/* Background decorative blurry circles (Stripe/Clerk slow floating effects) */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
          <motion.div
            animate={{
              x: [0, 60, -30, 0],
              y: [0, -80, 40, 0],
              scale: [1, 1.25, 0.9, 1],
            }}
            transition={{
              duration: 22,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="absolute -top-[10%] -left-[10%] md:-top-[20%] md:-left-[20%] w-[70vw] h-[70vw] md:w-[50vw] md:h-[50vw] rounded-full bg-gradient-to-br from-blue-600/15 to-indigo-500/5 blur-[80px] md:blur-[120px]"
          />
          <motion.div
            animate={{
              x: [0, -50, 40, 0],
              y: [0, 70, -60, 0],
              scale: [1, 1.15, 1.05, 1],
            }}
            transition={{
              duration: 25,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="absolute -bottom-[15%] -right-[15%] w-[80vw] h-[80vw] md:w-[60vw] md:h-[60vw] rounded-full bg-gradient-to-tr from-violet-600/10 to-blue-500/10 blur-[90px] md:blur-[140px]"
          />
          <motion.div
            animate={{
              scale: [0.9, 1.1, 0.9],
              opacity: [0.1, 0.18, 0.1],
            }}
            transition={{
              duration: 15,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="absolute top-1/2 left-1/3 transform -translate-x-1/2 -translate-y-1/2 w-[30vw] h-[30vw] rounded-full bg-indigo-500/10 blur-[100px]"
          />
        </div>

        {/* Central interactive Card */}
        <div className="relative z-10 w-full max-w-[420px] mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ 
              duration: 0.7, 
              ease: [0.16, 1, 0.3, 1] // Elegant easeOutQuart 
            }}
            className="w-full bg-white/[0.04] backdrop-blur-2xl border border-white/10 rounded-3xl p-8 md:p-12 shadow-[0_24px_60px_rgba(0,0,0,0.4)] relative overflow-hidden"
          >
            {/* Subtle gloss ray inside card */}
            <div className="absolute inset-0 bg-gradient-to-b from-white/[0.05] to-transparent pointer-events-none" />

            <div className="flex flex-col items-center relative z-10">
              {/* App logo overlay with smooth ring glow */}
              <div className="relative group mb-6">
                <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-500 opacity-30 group-hover:opacity-50 blur p-0.5 transition-opacity" />
                <div className="relative w-12 h-12 bg-gradient-to-tr from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-blue-500/20">
                  <Layout className="w-6 h-6" />
                </div>
              </div>

              {/* App titles with tracking-tight text and soft tagline */}
              <h1 className="text-2xl font-bold tracking-tight text-white mb-2 text-center select-none font-sans">
                Project Tracker Pro
              </h1>
              <p className="text-sm font-medium text-slate-400 text-center leading-relaxed">
                Quản lý tiến độ GPMB chuyên nghiệp & hiệu quả
              </p>

              {/* Minimal Divider */}
              <div className="w-full h-px bg-white/10 mt-6 mb-7" />

              {/* Sign In Button with subtle glow container */}
              <div className="w-full group/btn relative">
                <button
                  onClick={handleGoogleSignIn}
                  className="w-full h-12 md:h-13 bg-white hover:bg-slate-50 text-slate-900 border border-white/10 rounded-xl flex items-center justify-center gap-3.5 transition-all font-semibold shadow-sm hover:shadow-[0_0_24px_rgba(255,255,255,0.12)] cursor-pointer active:scale-[0.99] duration-200"
                >
                  <img
                    src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                    alt="Google icon"
                    className="w-5 h-5"
                  />
                  <span>Tiếp tục với Google</span>
                </button>
              </div>

              {/* Gracefully styled Help Card for Unauthorized Domain */}
              {authError === 'unauthorized-domain' && (
                <div className="mt-6 w-full p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-left">
                  <div className="flex items-start gap-2 mb-2 text-amber-400">
                    <HelpCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <h3 className="text-xs font-semibold select-none leading-tight">Yêu cầu cấu hình Firebase</h3>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed mb-3">
                    Đăng nhập thất bại do tên miền chưa được ủy quyền. Hãy đăng ký tên miền của ứng dụng này trong Firebase Console của bạn.
                  </p>
                  
                  <div className="space-y-2 text-[11px] text-slate-400 leading-normal">
                    <p className="font-semibold text-slate-300">Cách khắc phục:</p>
                    <ol className="list-decimal pl-4 space-y-1.5">
                      <li>
                        Truy cập <a href="https://console.firebase.google.com/" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Firebase Console</a> của dự án <code className="bg-slate-850 px-1 py-0.5 rounded text-[10px] text-slate-300">theo-doi-du-an</code>
                      </li>
                      <li>
                        Chọn mục <strong className="text-slate-300">Authentication</strong> &rarr; cấu hình <strong className="text-slate-300">Settings</strong> &rarr; <strong className="text-slate-300">Authorized domains</strong>
                      </li>
                      <li>
                        Nhấn nút <strong className="text-slate-300">Add domain</strong> rồi nhập tên miền này vào:
                        <div className="flex items-center gap-1.5 mt-1 bg-slate-900 rounded-lg px-2 py-1.5 border border-white/5 font-mono text-[10px] break-all justify-between text-slate-300">
                          <span>{window.location.hostname}</span>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(window.location.hostname);
                              setCopiedDomain(true);
                              setTimeout(() => setCopiedDomain(false), 2000);
                            }}
                            className="bg-slate-800 hover:bg-slate-700 text-blue-400 hover:text-blue-300 px-1.5 py-0.5 rounded text-[9px] transition-all font-sans font-semibold shrink-0 cursor-pointer"
                          >
                            {copiedDomain ? 'Đã sao chép' : 'Sao chép'}
                          </button>
                        </div>
                      </li>
                      <li>Tải lại trang ứng dụng hiện tại và bấm đăng nhập lại.</li>
                    </ol>
                  </div>
                </div>
              )}

              {authError && authError !== 'unauthorized-domain' && (
                <div className="mt-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-300 w-full text-center font-medium leading-relaxed">
                  Lỗi: {authError}
                </div>
              )}

              {/* Information footer footnote for permissions warning */}
              <p className="text-[11px] font-semibold text-slate-500 text-center leading-relaxed mt-7 select-none">
                Chỉ tài khoản được cấp phép mới có thể đăng nhập
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  if (!isApproved) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 max-w-md w-full text-center"
        >
          <div className="w-20 h-20 bg-amber-50 text-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-inner shadow-amber-500/10">
            <Layout className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-3 tracking-tight">Chờ cấp quyền</h2>
          {userStatus === 'rejected' ? (
            <p className="text-slate-500 mb-8 leading-relaxed">
              Tài khoản của bạn đã bị từ chối truy cập. Vui lòng liên hệ Quản trị viên để biết thêm chi tiết.
            </p>
          ) : (
            <p className="text-slate-500 mb-8 leading-relaxed">
              Tài khoản <span className="font-semibold text-slate-700">{user?.email}</span> của bạn đang chờ được Quản trị viên phê duyệt. Vui lòng quay lại sau.
            </p>
          )}
          <button 
            onClick={() => signOut(auth)}
            className="w-full h-12 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-colors flex items-center justify-center gap-2"
          >
            <LogOut className="w-5 h-5" />
            Đăng xuất
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f5f5] font-sans text-slate-900 overflow-hidden flex flex-col">
      <Toaster position="bottom-right" richColors />
      {/* Fixed Header of height 56px */}
      {!selectedProject && (
        <header className="h-[56px] fixed top-0 left-0 right-0 bg-white border-b border-slate-200 px-4 md:px-6 flex items-center justify-between z-40 select-none">
          <div className="flex items-center gap-2.5">
            <div className="w-[30px] h-[30px] bg-blue-600 rounded-lg flex items-center justify-center text-white shadow-md shadow-blue-600/20">
              <FolderKanban className="w-4 h-4" />
            </div>
            <span className="text-sm font-extrabold tracking-tight text-slate-800">Project Tracker Pro</span>
          </div>
          
          {/* Search bar inside header (only visible if current view is projects or generally) */}
          <div className="hidden md:flex items-center relative w-full max-w-lg mx-6 group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
            <input 
              type="text" 
              placeholder="Tìm kiếm dự án..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 h-[34px] bg-slate-100 border border-transparent rounded-lg text-xs placeholder-slate-450 focus:bg-white focus:border-slate-300 outline-none transition-all text-slate-700 font-medium"
            />
          </div>

          <div className="flex items-center gap-4">
            <button className="text-slate-400 hover:text-slate-600 relative mx-1">
              <Bell className="w-[18px] h-[18px]" />
              <span className="absolute top-0 right-0 w-1.5 h-1.5 bg-red-500 rounded-full ring-2 ring-white"></span>
            </button>
            <button className="text-slate-400 hover:text-slate-600 hidden md:block mx-1">
              <HelpCircle className="w-[18px] h-[18px]" />
            </button>
            <div className="hidden md:flex flex-col items-end ml-2 border-l border-slate-200 pl-4 min-h-8 justify-center gap-0.5">
              <span className="text-xs font-bold text-slate-700 leading-tight">{user.displayName || user.email?.split('@')[0]}</span>
              <span className={cn(
                "text-[7.5px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded leading-none scale-90 origin-right transition-all",
                userRole === 'admin' ? "bg-emerald-50 text-emerald-700 border border-emerald-250/20" :
                userRole === 'editor' ? "bg-blue-50 text-blue-700 border border-blue-250/20" :
                "bg-slate-100 text-slate-500 border border-slate-200"
              )}>
                {userRole === 'admin' ? 'Quản trị viên' : userRole === 'editor' ? 'Chuyên môn' : 'Xem (Sở ngành)'}
              </span>
            </div>
            <div className="group relative">
              <img src={user.photoURL || 'https://www.gravatar.com/avatar?d=mp'} alt="" referrerPolicy="no-referrer" className="w-[28px] h-[28px] rounded-full border border-slate-200 cursor-pointer object-cover" />
              <button 
                onClick={() => signOut(auth)}
                className="absolute right-0 top-full mt-2 bg-white border border-slate-200 shadow-lg rounded-lg py-1.5 px-3 hidden group-hover:flex items-center gap-2 text-xs font-bold text-red-600 whitespace-nowrap"
              >
                <LogOut className="w-3.5 h-3.5" />
                Đăng xuất
              </button>
            </div>
          </div>
        </header>
      )}

      {/* Main body: includes sidebar + content area */}
      <div className={cn(
        "flex-1 flex overflow-hidden relative pb-16 md:pb-0",
        !selectedProject ? "pt-[56px]" : "pt-0"
      )}>
        {/* FOX-ERP Style Navigation rail - 220px expanded by default, can be toggled to 56px collapsed */}
        <aside 
          className={cn(
            "hidden md:flex flex-col fixed left-0 bottom-0 bg-white border-r border-slate-200/80 z-30 transition-all duration-300 overflow-x-hidden select-none",
            !selectedProject ? "top-[56px]" : "top-0",
            isSidebarCollapsed ? "w-[56px]" : "w-[220px]"
          )}
        >
          <AnimatePresence mode="wait">
            {!selectedProject ? (
              <motion.div
                key="main-navigation"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.15 }}
                className="flex-1 flex flex-col h-full overflow-hidden"
              >
                {/* Top segment for Collapse Button & User Name */}
                <div className={cn(
                  "flex items-center justify-between px-3.5 py-4 border-b border-slate-100 h-14 shrink-0 transition-all overflow-hidden",
                  isSidebarCollapsed ? "justify-center px-2" : "justify-between"
                )}>
                  {!isSidebarCollapsed && (
                    <span className="text-xs font-bold text-slate-705 truncate select-none pl-0.5">
                      {user.displayName || user.email?.split('@')[0] || 'Thành viên'}
                    </span>
                  )}
                  <button
                    onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                    className="p-1.5 hover:bg-slate-50 text-slate-400 rounded-lg border border-slate-150 hover:text-slate-700 hover:border-slate-300 transition-all active:scale-95 cursor-pointer flex items-center justify-center shrink-0 shadow-xs"
                    title={isSidebarCollapsed ? "Mở rộng" : "Thu gọn"}
                  >
                    <ChevronLeft className={cn("w-3.5 h-3.5 transition-transform duration-300", isSidebarCollapsed ? "rotate-180" : "")} />
                  </button>
                </div>

                <div className="flex-1 py-4 space-y-1.5 px-2">
                  {/* Nav: Tổng quan (Dashboard) */}
                  <button
                    onClick={() => {
                      setCurrentView('dashboard');
                      handleSelectProject(null);
                    }}
                    className={cn(
                      "w-full h-10 rounded-lg flex items-center transition-all relative cursor-pointer outline-none border border-transparent",
                      isSidebarCollapsed ? "justify-center px-0" : "px-3.5 gap-3.5",
                      currentView === 'dashboard' 
                        ? "bg-blue-600/10 text-blue-600 font-bold border-blue-600/10" 
                        : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                    )}
                    title="Tổng quan"
                  >
                    <BarChart2 className="w-[18px] h-[18px] shrink-0" />
                    {!isSidebarCollapsed && (
                      <span className="text-xs font-bold whitespace-nowrap opacity-100 transition-all duration-200">
                        Tổng quan
                      </span>
                    )}
                  </button>

                  {/* Nav: Dự án (Projects) */}
                  <button
                    onClick={() => {
                      setCurrentView('projects');
                      handleSelectProject(null);
                    }}
                    className={cn(
                      "w-full h-10 rounded-lg flex items-center transition-all relative cursor-pointer outline-none border border-transparent",
                      isSidebarCollapsed ? "justify-center px-0" : "px-3.5 gap-3.5",
                      currentView === 'projects' 
                        ? "bg-blue-600/10 text-blue-600 font-bold border-blue-600/10" 
                        : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                    )}
                    title="Dự án"
                  >
                    <FolderKanban className="w-[18px] h-[18px] shrink-0" />
                    {!isSidebarCollapsed && (
                      <span className="text-xs font-bold whitespace-nowrap opacity-100 transition-all duration-200">
                        Dự án
                      </span>
                    )}
                  </button>

                  {/* Nav: Phân quyền (Users) - admin only */}
                  {isAdmin && (
                    <button
                      onClick={() => {
                        setCurrentView('users');
                        handleSelectProject(null);
                      }}
                      className={cn(
                        "w-full h-10 rounded-lg flex items-center transition-all relative cursor-pointer outline-none border border-transparent",
                        isSidebarCollapsed ? "justify-center px-0" : "px-3.5 gap-3.5",
                        currentView === 'users' 
                          ? "bg-blue-600/10 text-blue-600 font-bold border-blue-600/10" 
                          : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                      )}
                      title="Phân quyền"
                    >
                      <Users className="w-[18px] h-[18px] shrink-0" />
                      {!isSidebarCollapsed && (
                        <span className="text-xs font-bold whitespace-nowrap opacity-100 transition-all duration-200">
                          Phân quyền
                        </span>
                      )}
                    </button>
                  )}
                </div>

                {/* User badge at the bottom of the sidebar */}
                <div className="p-2.5 border-t border-slate-100 bg-slate-50/50 shrink-0">
                  <div className={cn(
                    "flex items-center h-9 overflow-hidden transition-all duration-300",
                    isSidebarCollapsed ? "justify-center px-0" : "gap-3 px-1"
                  )}>
                    <div className="relative shrink-0">
                      <img src={user.photoURL || 'https://www.gravatar.com/avatar?d=mp'} alt="" referrerPolicy="no-referrer" className="w-[22px] h-[22px] rounded-full border border-slate-200" />
                      <div className={cn(
                        "absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full ring-1 ring-white",
                        userStatus === 'approved' ? "bg-emerald-500" : "bg-amber-500"
                      )} />
                    </div>
                    {!isSidebarCollapsed && (
                      <div className="flex-1 min-w-0 text-left transition-all duration-200">
                        <p className="text-[10.5px] font-bold text-slate-800 truncate leading-none mb-1">{user.displayName || user.email?.split('@')[0] || 'Thành viên'}</p>
                        <div className="flex items-center gap-1 flex-wrap">
                          <span className={cn(
                            "text-[8px] font-bold px-1 py-0.5 rounded border leading-none scale-90 origin-left uppercase font-mono",
                            userRole === 'admin' ? "bg-emerald-50 hover:bg-emerald-100 text-emerald-855 border-emerald-250/20" :
                            userRole === 'editor' ? "bg-blue-50 hover:bg-blue-100 text-blue-800 border-blue-250/20" :
                            "bg-slate-100 text-slate-700 border-slate-200"
                          )}>
                            {userRole === 'admin' ? 'Quản trị viên' : userRole === 'editor' ? 'Editor' : 'Viewer'}
                          </span>
                          
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="step-navigation"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.15 }}
                className="flex-1 flex flex-col h-full overflow-hidden"
              >
                {/* Back button and Toggle Collapse button */}
                <div className={cn(
                  "flex items-center justify-between px-3.5 py-4 border-b border-slate-100 h-14 shrink-0 transition-all overflow-hidden",
                  isSidebarCollapsed ? "justify-center px-2" : "justify-between"
                )}>
                  {!isSidebarCollapsed ? (
                    <button
                      onClick={() => handleSelectProject(null)}
                      className="flex items-center gap-1.5 py-1 px-2.5 hover:bg-slate-50 text-slate-500 hover:text-blue-600 transition-colors rounded-lg border border-slate-200 text-[11px] font-bold active:scale-95 cursor-pointer max-w-[130px] truncate"
                      title="Quay lại danh sách dự án"
                    >
                      <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
                      <span>← Dự án</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleSelectProject(null)}
                      className="p-1.5 hover:bg-slate-50 text-slate-500 hover:text-blue-600 rounded-lg border border-slate-150 transition-all active:scale-95 cursor-pointer flex items-center justify-center shrink-0 shadow-xs"
                      title="Quay lại danh sách dự án"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                    </button>
                  )}
                  
                  <button
                    onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                    className="p-1.5 hover:bg-slate-50 text-slate-400 rounded-lg border border-slate-150 hover:text-slate-700 hover:border-slate-300 transition-all active:scale-95 cursor-pointer flex items-center justify-center shrink-0 shadow-xs"
                    title={isSidebarCollapsed ? "Mở rộng" : "Thu gọn"}
                  >
                    <ChevronLeft className={cn("w-3.5 h-3.5 transition-transform duration-300", isSidebarCollapsed ? "rotate-180" : "")} />
                  </button>
                </div>

                {/* Steps Scrollable list */}
                <div className="flex-1 overflow-y-auto px-1 py-4 space-y-5 no-scrollbar select-none">
                  {/* Item: Tổng quan dự án */}
                  <div className="space-y-1">
                    <button
                      onClick={() => handleSelectStep('overview', 'overview')}
                      className={cn(
                        "w-full text-left flex items-center transition-all duration-150 cursor-pointer outline-none rounded-lg",
                        isSidebarCollapsed ? "justify-center px-0 h-9" : "px-3 gap-2.5 py-1.5",
                        activeStepKey === 'overview' 
                          ? "bg-white border-l-2 border-blue-600 shadow-xs font-bold text-slate-900" 
                          : "border-l-2 border-transparent text-slate-500 hover:bg-slate-50/70 hover:text-slate-800"
                      )}
                      title="Tổng quan dự án"
                    >
                      <Layout className="w-4 h-4 text-slate-450 shrink-0" />
                      {!isSidebarCollapsed && (
                        <span className="text-[11.5px] leading-snug line-clamp-2">
                          Tổng quan dự án
                        </span>
                      )}
                    </button>
                  </div>

                  {/* Category: CÔNG TÁC CHUẨN BỊ */}
                  <div className="space-y-1">
                    {!isSidebarCollapsed ? (
                      <h4 className="text-[10px] font-extrabold text-[#0056b3] tracking-wider uppercase pl-3 mb-3 mt-1">
                        CÔNG TÁC CHUẨN BỊ
                      </h4>
                    ) : (
                      <div className="px-3">
                        <div className="w-full border-b border-slate-100 my-1.5" />
                      </div>
                    )}
                    <div className={cn("relative", !isSidebarCollapsed ? "ml-4 border-l border-slate-200 space-y-1 py-1" : "space-y-1")}>
                      {getCategoryStepsOrdered(selectedProject, 'preparation').map((stepKey) => {
                        const { label, status, deadline } = getStepInfo(selectedProject, stepKey);
                        const isActive = activeStepKey === stepKey;
                        const isCompleted = status === 'completed';
                        
                        return (
                          <div key={stepKey} className={cn("relative group", !isSidebarCollapsed && "pl-4 pr-2")}>
                            {!isSidebarCollapsed && (
                              <div className={cn(
                                "absolute -left-[5px] top-[14px] w-2.5 h-2.5 rounded-full flex items-center justify-center border bg-white transition-all z-10",
                                isCompleted ? "border-emerald-500 bg-emerald-500" :
                                isActive ? "border-[#0056b3] w-3 h-3 -left-[6px] top-[13px] ring-4 ring-[#0056b3]/10" : "border-slate-300"
                              )}>
                                {isCompleted ? (
                                  <Check className="w-1.5 h-1.5 text-white flex-shrink-0" strokeWidth={4} />
                                ) : isActive ? (
                                  <div className="w-1.5 h-1.5 rounded-full bg-[#0056b3]" />
                                ) : null}
                              </div>
                            )}
                            <button
                              onClick={() => handleSelectStep('preparation', stepKey)}
                              className={cn(
                                "w-full text-left flex items-center transition-all duration-150 cursor-pointer outline-none rounded-lg",
                                isSidebarCollapsed ? "justify-center px-0 h-9" : "px-3 py-2",
                                isActive && !isSidebarCollapsed ? "bg-blue-50/50" : "hover:bg-slate-50/70"
                              )}
                              title={label}
                            >
                              {isSidebarCollapsed && (
                                <div className={cn(
                                  "w-6 h-6 rounded-full flex items-center justify-center border bg-white transition-all",
                                  isCompleted ? "border-emerald-500 bg-emerald-500" :
                                  isActive ? "border-[#0056b3] border-2 ring-2 ring-[#0056b3]/20" : "border-slate-300"
                                )}>
                                  {isCompleted ? (
                                    <Check className="w-3.5 h-3.5 text-white flex-shrink-0" strokeWidth={3} />
                                  ) : isActive ? (
                                    <div className="w-2.5 h-2.5 rounded-full bg-[#0056b3]" />
                                  ) : null}
                                </div>
                              )}
                              {!isSidebarCollapsed && (
                                <div className="flex items-center justify-between w-full gap-1.5">
                                  <span className={cn(
                                    "text-[11.5px] leading-snug line-clamp-2 transition-colors flex-1", 
                                    isActive ? "font-bold text-[#0056b3]" : "font-medium text-slate-600 group-hover:text-slate-900"
                                  )}>
                                    {label}
                                  </span>
                                  {!isCompleted && getOverdueText(deadline) && (
                                    <span className="shrink-0 bg-red-50 text-red-600 border border-red-200 text-[8.5px] font-bold px-1.5 py-0.5 rounded select-none leading-none scale-90 origin-right">
                                      {getOverdueText(deadline)}
                                    </span>
                                  )}
                                </div>
                              )}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Category: QUÁ TRÌNH THỰC HIỆN */}
                  <div className="space-y-1">
                    {!isSidebarCollapsed ? (
                      <h4 className="text-[10px] font-extrabold text-[#0056b3] tracking-wider uppercase pl-3 mb-3 mt-6">
                        QUÁ TRÌNH THỰC HIỆN
                      </h4>
                    ) : (
                      <div className="px-3">
                        <div className="w-full border-b border-slate-100 my-1.5" />
                      </div>
                    )}
                    <div className={cn("relative", !isSidebarCollapsed ? "ml-4 border-l border-slate-200 space-y-1 py-1" : "space-y-1")}>
                      {getCategoryStepsOrdered(selectedProject, 'execution_detail').map((stepKey) => {
                        const { label, status, deadline } = getStepInfo(selectedProject, stepKey);
                        const isActive = activeStepKey === stepKey;
                        const isCompleted = status === 'completed';
                        
                        return (
                          <div key={stepKey} className={cn("relative group", !isSidebarCollapsed && "pl-4 pr-2")}>
                            {!isSidebarCollapsed && (
                              <div className={cn(
                                "absolute -left-[5px] top-[14px] w-2.5 h-2.5 rounded-full flex items-center justify-center border bg-white transition-all z-10",
                                isCompleted ? "border-emerald-500 bg-emerald-500" :
                                isActive ? "border-[#0056b3] w-3 h-3 -left-[6px] top-[13px] ring-4 ring-[#0056b3]/10" : "border-slate-300"
                              )}>
                                {isCompleted ? (
                                  <Check className="w-1.5 h-1.5 text-white flex-shrink-0" strokeWidth={4} />
                                ) : isActive ? (
                                  <div className="w-1.5 h-1.5 rounded-full bg-[#0056b3]" />
                                ) : null}
                              </div>
                            )}
                            <button
                              onClick={() => handleSelectStep('execution_detail', stepKey)}
                              className={cn(
                                "w-full text-left flex items-center transition-all duration-150 cursor-pointer outline-none rounded-lg",
                                isSidebarCollapsed ? "justify-center px-0 h-9" : "px-3 py-2",
                                isActive && !isSidebarCollapsed ? "bg-blue-50/50" : "hover:bg-slate-50/70"
                              )}
                              title={label}
                            >
                              {isSidebarCollapsed && (
                                <div className={cn(
                                  "w-6 h-6 rounded-full flex items-center justify-center border bg-white transition-all",
                                  isCompleted ? "border-emerald-500 bg-emerald-500" :
                                  isActive ? "border-[#0056b3] border-2 ring-2 ring-[#0056b3]/20" : "border-slate-300"
                                )}>
                                  {isCompleted ? (
                                    <Check className="w-3.5 h-3.5 text-white flex-shrink-0" strokeWidth={3} />
                                  ) : isActive ? (
                                    <div className="w-2.5 h-2.5 rounded-full bg-[#0056b3]" />
                                  ) : null}
                                </div>
                              )}
                              {!isSidebarCollapsed && (
                                <div className="flex items-center justify-between w-full gap-1.5">
                                  <span className={cn(
                                    "text-[11.5px] leading-snug line-clamp-2 transition-colors flex-1", 
                                    isActive ? "font-bold text-[#0056b3]" : "font-medium text-slate-600 group-hover:text-slate-900"
                                  )}>
                                    {label}
                                  </span>
                                  {!isCompleted && getOverdueText(deadline) && (
                                    <span className="shrink-0 bg-red-50 text-red-600 border border-red-200 text-[8.5px] font-bold px-1.5 py-0.5 rounded select-none leading-none scale-90 origin-right">
                                      {getOverdueText(deadline)}
                                    </span>
                                  )}
                                </div>
                              )}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* User badge at the bottom of the sidebar */}
                <div className="p-2.5 border-t border-slate-100 bg-slate-50/50 shrink-0 mt-auto">
                  <div className={cn(
                    "flex items-center h-9 overflow-hidden transition-all duration-300",
                    isSidebarCollapsed ? "justify-center px-0" : "gap-3 px-1"
                  )}>
                    <div className="relative shrink-0">
                      <img src={user.photoURL || 'https://www.gravatar.com/avatar?d=mp'} alt="" referrerPolicy="no-referrer" className="w-[22px] h-[22px] rounded-full border border-slate-200" />
                      <div className={cn(
                        "absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full ring-1 ring-white",
                        userStatus === 'approved' ? "bg-emerald-500" : "bg-amber-500"
                      )} />
                    </div>
                    {!isSidebarCollapsed && (
                      <div className="flex-1 min-w-0 text-left transition-all duration-200">
                        <p className="text-[10.5px] font-bold text-slate-800 truncate leading-none mb-1">{user.displayName || user.email?.split('@')[0] || 'Thành viên'}</p>
                        <div className="flex items-center gap-1 flex-wrap">
                          <span className={cn(
                            "text-[8px] font-bold px-1 py-0.5 rounded border leading-none scale-90 origin-left uppercase font-mono",
                            userRole === 'admin' ? "bg-emerald-50 hover:bg-emerald-100 text-emerald-855 border-emerald-250/20" :
                            userRole === 'editor' ? "bg-blue-50 hover:bg-blue-100 text-blue-800 border-blue-250/20" :
                            "bg-slate-100 text-slate-700 border-slate-200"
                          )}>
                            {userRole === 'admin' ? 'Quản trị viên' : userRole === 'editor' ? 'Editor' : 'Viewer'}
                          </span>
                          
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </aside>

        {/* Content area: Offset on desktop dynamically based on sidebar collapse state */}
        <div 
          id="main-scroll-container"
          className={cn(
          "flex-1 flex flex-col overflow-y-auto bg-[#f5f5f5] transition-all duration-300",
          isSidebarCollapsed ? "md:pl-[56px]" : "md:pl-[220px]"
        )}>
          {currentView === 'projects' ? (
            <main className="flex-1 p-3.5 md:p-6 transition-all duration-300 relative">
              {selectedProject && (
                <button
                  onClick={() => handleSelectProject(null)}
                  className="md:hidden flex items-center gap-2 text-xs font-bold text-slate-500 mb-3 px-2 py-1 bg-white border border-slate-200 rounded-lg shadow-xs"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Quay lại danh sách</span>
                </button>
              )}

              <AnimatePresence mode="wait">
                {selectedProject ? (
                  <motion.div
                    key={selectedProject.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="flex flex-col gap-4 w-full"
                  >
                    {/* Breadcrumbs styled header */}
                    <div className="flex items-center justify-between bg-white px-4 md:px-5 py-3 border border-slate-200/80 rounded-xl shadow-xs gap-4">
                      <div className="flex items-center gap-3 text-xs select-none">
                        <button
                          onClick={() => handleSelectProject(null)}
                          className="flex items-center gap-1.5 font-bold text-slate-500 hover:text-blue-600 transition-colors bg-slate-50 hover:bg-slate-100 py-1.5 px-3 rounded-lg border border-slate-150 active:scale-95"
                        >
                          <ChevronLeft className="w-4 h-4" />
                          <span>Quay lại</span>
                        </button>
                        <div className="h-4 w-px bg-slate-200 mx-1 hidden sm:block" />
                        <div className="hidden sm:flex items-center gap-2 text-slate-400 font-bold">
                          <span>Dự án</span>
                          <span className="text-slate-300 font-normal">&gt;</span>
                          <span className="font-extrabold text-slate-700 line-clamp-1">{selectedProject.name}</span>
                        </div>
                      </div>
                      
                      <span className="sm:hidden font-bold text-xs text-slate-800 line-clamp-1">{selectedProject.name}</span>
                    </div>

                    <ProjectMainView 
                      project={selectedProject}
                      isAdmin={isAdmin}
                      canEdit={canEdit}
                      onProjectDeleted={() => handleSelectProject(null)}
                      globalAvailableUsers={globalAvailableUsers}
                      globalUserRolesMap={globalUserRolesMap}
                      onRefreshGlobalUsers={fetchGlobalUsers}
                    />
                  </motion.div>
                ) : (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="flex flex-col gap-6 max-w-7xl mx-auto w-full"
                  >
                    {/* Header */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 px-2">
                      <div>
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mb-2">
                          <span className="hover:text-blue-600 cursor-pointer transition-colors" onClick={() => setCurrentView('dashboard')}>Dashboard</span>
                          <span className="text-slate-300 font-normal">&gt;</span>
                          <span className="text-slate-800 font-bold">Danh sách dự án</span>
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Danh sách dự án</h1>
                      </div>
                      
                      {isAdmin && (
                        <button
                          onClick={() => setIsAddModalOpen(true)}
                          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold transition-all shadow-sm hover:shadow active:scale-95 whitespace-nowrap"
                        >
                          <Plus className="w-4 h-4 shrink-0" /> 
                          <span>Tạo dự án mới</span>
                        </button>
                      )}
                    </div>

                    {/* Danh sách tất cả dự án (Table) */}
                    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
                      {/* Filter Bar */}
                      <div className="p-4 md:px-6 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg w-fit select-none">
                          {(['all', 'active', 'completed'] as const).map(f => {
                            const isActive = projectFilter === f;
                            return (
                              <button
                                key={f}
                                onClick={() => setProjectFilter(f)}
                                className={cn(
                                  "text-xs font-bold py-2 px-4 rounded-md transition-all duration-200 cursor-pointer whitespace-nowrap border border-transparent",
                                  isActive 
                                    ? "bg-white text-slate-900 shadow-sm border-slate-200" 
                                    : "text-slate-500 hover:text-slate-700"
                                )}
                              >
                                {f === 'all' ? 'Tất cả' : f === 'active' ? 'Đang thực hiện' : 'Hoàn thành'}
                              </button>
                            );
                          })}
                        </div>

                        <div className="flex items-center gap-3 flex-wrap">
                          {/* Filter: Loại đất */}
                          <div className="relative group">
                            <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2 cursor-pointer hover:bg-slate-50 transition-colors">
                              <span className="text-xs font-bold text-slate-600 flex items-center gap-2">
                                <Filter className="w-3.5 h-3.5 text-slate-400" /> 
                                {typeFilter === 'all' ? 'Loại đất GPMB' : typeFilter === 'agri' ? 'Đất nông nghiệp' : typeFilter === 'resident' ? 'Đất phi nông nghiệp' : 'Nông nghiệp & Phi nông nghiệp'}
                              </span>
                              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                            </div>
                            <div className="absolute top-full right-0 lg:left-0 mt-1.5 w-48 bg-white border border-slate-200 rounded-lg shadow-lg z-50 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all flex flex-col py-1">
                              {(['all', 'agri', 'resident', 'both'] as const).map(t => (
                                <button key={t} onClick={() => setTypeFilter(t)} className={cn("text-left px-3 py-2 text-xs font-bold hover:bg-slate-50 transition-colors", typeFilter === t ? "text-blue-600 bg-blue-50/50" : "text-slate-600")}>
                                  {t === 'all' ? 'Tất cả loại đất' : t === 'agri' ? 'Đất nông nghiệp' : t === 'resident' ? 'Đất phi nông nghiệp' : 'Nông nghiệp & Phi nông nghiệp'}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Filter: Thời gian/Sắp xếp */}
                          <div className="relative group">
                            <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2 cursor-pointer hover:bg-slate-50 transition-colors">
                              <span className="text-xs font-bold text-slate-600 flex items-center gap-2">
                                <Calendar className="w-3.5 h-3.5 text-slate-400" /> 
                                {sortOrder === 'recently_updated' ? 'Cập nhật gần đây' : sortOrder === 'newest' ? 'Mới tạo nhất' : 'Cũ nhất'}
                              </span>
                              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                            </div>
                            <div className="absolute top-full right-0 mt-1.5 w-44 bg-white border border-slate-200 rounded-lg shadow-lg z-50 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all flex flex-col py-1">
                              {(['recently_updated', 'newest', 'oldest'] as const).map(t => (
                                <button key={t} onClick={() => setSortOrder(t)} className={cn("text-left px-3 py-2 text-xs font-bold hover:bg-slate-50 transition-colors", sortOrder === t ? "text-blue-600 bg-blue-50/50" : "text-slate-600")}>
                                  {t === 'recently_updated' ? 'Cập nhật gần đây' : t === 'newest' ? 'Mới tạo nhất' : 'Cũ nhất'}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="w-px h-6 bg-slate-200 mx-1 hidden sm:block"></div>
                          <button className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-500 transition-colors" title="Tuỳ biến cột">
                            <ListFilter className="w-4 h-4" />
                          </button>
                          <button className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-500 transition-colors" title="Xuất file">
                            <Download className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Projects interactive list row */}
                      <div className="overflow-x-auto w-full">
                        <table className="w-full min-w-[800px] text-left border-collapse select-none">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 tracking-wider uppercase">
                              <th className="py-4 px-4 md:px-6 font-semibold">Tên dự án</th>
                              <th className="py-4 px-4 font-semibold w-[20%] text-center">Loại đất GPMB</th>
                              <th className="py-4 px-4 w-32 font-semibold text-center">Trạng thái</th>
                              <th className="py-4 px-4 w-[15%] font-semibold text-center">Tiến độ</th>
                              <th className="py-4 px-4 md:px-6 font-semibold w-[15%] text-right">Cập nhật</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredAndSortedProjects.map((proj) => {
                              const typeLabel = proj.projectType === 'agri' ? 'Đất nông nghiệp' : proj.projectType === 'resident' ? 'Đất phi nông nghiệp' : 'Nông nghiệp & Phi nông nghiệp';
                              const statusActive = proj.status === 'active';
                              const statusLabel = proj.status === 'active' ? 'Đang thực hiện' : (proj.status === 'completed' ? 'Hoàn thành' : 'Chậm tiến độ'); // mock fallback status

                              // Calculate progress
                              let totalSteps = 0; let completedSteps = 0;
                              if (proj.steps) {
                                Object.values(proj.steps).forEach(s => {
                                  if (typeof s === 'string') {
                                    if (s === 'completed') completedSteps++;
                                    totalSteps++;
                                  } else if (s && typeof s === 'object' && ('status' in s)) {
                                    if ((s as any).status === 'completed') completedSteps++;
                                    totalSteps++;
                                  } else if (s && typeof s === 'object' && ('donePlots' in s)) {
                                    if ((s as any).donePlots > 0 && (s as any).donePlots === (s as any).totalPlots) completedSteps++;
                                    totalSteps++;
                                  }
                                });
                              }
                              const progress = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;
                              // mock status colors
                              const isOverdue = proj.status === 'active' && progress < 30; // mock overdue rule
                              const finalStatusLabel = isOverdue ? 'Chậm tiến độ' : statusLabel;

                              return (
                                <tr
                                  key={proj.id}
                                  onClick={() => handleSelectProject(proj)}
                                  className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer group transition-colors"
                                >
                                  <td className="py-4 px-4 md:px-6">
                                    <div className="flex items-center gap-4">
                                      <div className={cn(
                                        "w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0",
                                        proj.projectType === 'agri' ? "bg-blue-50 text-blue-700" : proj.projectType === 'resident' ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700" // mock brand colors
                                      )}>
                                        {proj.name.charAt(0).toUpperCase()}
                                      </div>
                                      <span className="text-sm font-bold text-slate-800 group-hover:text-blue-600 transition-colors line-clamp-1">
                                        {proj.name}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="py-4 px-4 text-xs font-semibold text-slate-600 whitespace-nowrap text-center">
                                    {typeLabel}
                                  </td>
                                  <td className="py-4 px-4 text-center whitespace-nowrap">
                                    <span className={cn(
                                      "text-[10px] px-2.5 py-1 rounded-md font-extrabold uppercase tracking-widest shrink-0 inline-block",
                                      isOverdue ? "bg-rose-100 text-rose-700" : (
                                      statusActive 
                                        ? "bg-blue-600 text-white shadow-sm" 
                                        : "bg-emerald-100 text-emerald-700"
                                      )
                                    )}>
                                      {finalStatusLabel}
                                    </span>
                                  </td>
                                  <td className="py-4 px-4 text-center">
                                     <div className="flex flex-col gap-1 items-center justify-center">
                                        <span className="text-[10px] font-bold text-slate-600">{progress}%</span>
                                        <div className="w-14 h-1.5 bg-slate-200 rounded-full overflow-hidden shrink-0">
                                           <div className={cn("h-full rounded-full transition-all", isOverdue ? "bg-rose-500" : (statusActive ? "bg-blue-600" : "bg-emerald-500"))} style={{ width: `${progress}%` }}></div>
                                        </div>
                                     </div>
                                  </td>
                                  <td className="py-4 px-4 md:px-6 text-right text-[11px] font-medium text-slate-500 italic whitespace-nowrap">
                                    {proj.updatedAt ? formatRelative(proj.updatedAt) : '---'}
                                  </td>
                                </tr>
                              );
                            })}
                            
                            {filteredAndSortedProjects.length === 0 && (
                              <tr>
                                <td colSpan={5} className="text-center py-16 px-4">
                                  <div className="flex flex-col items-center justify-center gap-2">
                                    <FolderKanban className="w-8 h-8 text-slate-300" />
                                    <p className="text-sm font-bold text-slate-500">Không tìm thấy dự án nào</p>
                                    <p className="text-xs text-slate-400">Thay đổi bộ lọc hoặc từ khóa tìm kiếm</p>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>

                      {/* Pagination Footer */}
                      <div className="px-4 md:px-6 py-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50/50">
                         <span className="text-xs font-medium text-slate-500">Hiển thị {filteredAndSortedProjects.length > 0 ? '1 - ' + filteredAndSortedProjects.length : 0} của {projects.length} dự án</span>
                         <div className="flex items-center gap-1.5">
                            <button className="w-7 h-7 flex items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-50 disabled:opacity-50" disabled>
                              <ChevronLeft className="w-4 h-4" />
                            </button>
                            <button className="w-7 h-7 flex items-center justify-center rounded-lg bg-blue-600 text-white font-bold text-xs" >1</button>
                            <button className="w-7 h-7 flex items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 cursor-pointer">2</button>
                            <button className="w-7 h-7 flex items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 cursor-pointer">3</button>
                            <button className="w-7 h-7 flex items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-slate-800 hover:bg-slate-50 text-xs cursor-pointer">
                              <ChevronRight className="w-4 h-4" />
                            </button>
                         </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </main>
          ) : currentView === 'users' ? (
            <main className="flex-1 p-3.5 md:p-6 transition-all duration-300 relative">
              <UserManagementView />
            </main>
          ) : (
            <main className="flex-1 p-3.5 md:p-6 transition-all duration-300 relative">
              <DashboardView projects={projects} />
            </main>
          )}
        </div>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-slate-200 flex items-center justify-around z-40 px-2 safe-area-pb">
          <button 
            type="button"
            onClick={() => {
              setCurrentView('dashboard');
              handleSelectProject(null);
            }}
            className={cn("flex flex-col items-center justify-center w-full h-full gap-1 cursor-pointer", currentView === 'dashboard' ? "text-blue-600 font-bold" : "text-slate-400")}
          >
            <BarChart2 className="w-5 h-5" />
            <span className="text-[10px] font-bold">Tổng quan</span>
          </button>
          <button 
            type="button"
            onClick={() => {
              setCurrentView('projects');
              handleSelectProject(null);
            }}
            className={cn("flex flex-col items-center justify-center w-full h-full gap-1 cursor-pointer", currentView === 'projects' ? "text-blue-600 font-bold" : "text-slate-400")}
          >
            <FolderKanban className="w-5 h-5" />
            <span className="text-[10px] font-bold">Dự án</span>
          </button>
          {isAdmin && (
            <button 
              type="button"
              onClick={() => {
                setCurrentView('users');
                handleSelectProject(null);
              }}
              className={cn("flex flex-col items-center justify-center w-full h-full gap-1 cursor-pointer", currentView === 'users' ? "text-blue-600 font-bold" : "text-slate-400")}
            >
              <Users className="w-5 h-5" />
              <span className="text-[10px] font-bold">Phân quyền</span>
            </button>
          )}
      </div>

      <AddProjectModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSubmit={handleAddProject}
        isSubmitting={isCreating}
      />
    </div>
  );
}
