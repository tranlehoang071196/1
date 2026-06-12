import { doc, updateDoc, serverTimestamp, deleteDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db, OperationType, handleFirestoreError, auth } from './firebase';
import { toast } from 'sonner';
import { STEP_LABELS } from '../types';

export const addProjectActivity = async (projectId: string, newActivity: any) => {
  try {
    const projectRef = doc(db, 'projects', projectId);
    const activityWithId = {
      id: crypto.randomUUID(),
      ...newActivity
    };
    await updateDoc(projectRef, {
      activities: arrayUnion(activityWithId)
    });
  } catch (err) {
    console.error("Failed to add project activity", err);
  }
};

export const logProjectActivity = async (projectId: string, action: string, target?: string) => {
  const user = auth.currentUser;
  if (!user) return;
  try {
    const newActivity = {
      id: crypto.randomUUID(),
      userName: user.displayName || 'Thành viên',
      userEmail: user.email || '',
      action,
      target: target || '',
      timestamp: Date.now()
    };
    const projectRef = doc(db, 'projects', projectId);
    await updateDoc(projectRef, {
      activities: arrayUnion(newActivity)
    });
  } catch (error) {
    console.error('Failed to log activity', error);
  }
};

export const updateStepStatus = async (projectId: string, key: string, newStatus: any) => {
  try {
    const projectRef = doc(db, 'projects', projectId);
    const user = auth.currentUser;
    const stepName = STEP_LABELS[key] || 'công việc';
    
    const updates: any = {
      [`steps.${key}`]: newStatus,
      updatedAt: serverTimestamp()
    };

    if (user) {
      const newActivity = {
        id: crypto.randomUUID(),
        userName: user.displayName || 'Thành viên',
        userEmail: user.email || '',
        action: 'đã cập nhật',
        target: stepName,
        timestamp: Date.now()
      };
      updates.activities = arrayUnion(newActivity);
    }

    await updateDoc(projectRef, updates);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `projects/${projectId}`);
  }
};

export const updateProjectField = async (projectId: string, field: string, value: any, targetName?: string) => {
  try {
    const projectRef = doc(db, 'projects', projectId);
    const updates: any = {
      [field]: value,
      updatedAt: serverTimestamp()
    };

    if (targetName) {
      const user = auth.currentUser;
      if (user) {
        const newActivity = {
          id: crypto.randomUUID(),
          userName: user.displayName || 'Thành viên',
          userEmail: user.email || '',
          action: 'đã thay đổi',
          target: targetName,
          timestamp: Date.now()
        };
        updates.activities = arrayUnion(newActivity);
      }
    }

    await updateDoc(projectRef, updates);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `projects/${projectId}`);
  }
};

export const addRound = async (projectId: string, stepKey: string, currentStepData: any) => {
  try {
    const currentRounds = currentStepData.rounds || [];
    const roundName = `Đợt ${currentRounds.length + 1}`;
    const newRound = {
      id: crypto.randomUUID(),
      name: roundName,
      status: 'in_progress',
      date: '',
      links: [],
      plots: 0,
      households: 0,
      amount: 0,
      cost: 0
    };
    
    await updateStepStatus(projectId, stepKey, {
      ...currentStepData,
      rounds: [...currentRounds, newRound]
    });
    toast.success(`Đã thêm ${roundName}`);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `projects/${projectId}`);
  }
};

export const updateRound = async (projectId: string, stepKey: string, roundId: string, currentStepData: any, updates: any) => {
  try {
    const rounds = currentStepData.rounds || [];
    const newRounds = rounds.map((r: any) => r.id === roundId ? { ...r, ...updates } : r);
    
    // Recalculate totals if amount changed
    const totalAmount = newRounds.reduce((acc: number, curr: any) => acc + (Number(curr.amount) || 0), 0);
    const totalCost = newRounds.reduce((acc: number, curr: any) => acc + (Number(curr.cost) || 0), 0);
    
    await updateStepStatus(projectId, stepKey, {
      ...currentStepData,
      rounds: newRounds,
      amount: totalAmount,
      cost: totalCost
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `projects/${projectId}`);
  }
};

export const removeRound = async (projectId: string, stepKey: string, roundId: string, currentStepData: any) => {
  try {
    const rounds = currentStepData.rounds || [];
    const newRounds = rounds.filter((r: any) => r.id !== roundId);
    
    const totalAmount = newRounds.reduce((acc: number, curr: any) => acc + (Number(curr.amount) || 0), 0);
    const totalCost = newRounds.reduce((acc: number, curr: any) => acc + (Number(curr.cost) || 0), 0);
    
    await updateStepStatus(projectId, stepKey, {
      ...currentStepData,
      rounds: newRounds,
      amount: totalAmount,
      cost: totalCost
    });
    toast.success('Đã xoá đợt thực hiện');
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `projects/${projectId}`);
  }
};

export const addCustomStep = async (projectId: string, categoryId: string) => {
  try {
    const newStep = {
      id: crypto.randomUUID(),
      categoryId,
      name: 'Bước mới',
      status: 'in_progress',
      date: '',
      links: []
    };
    await updateDoc(doc(db, 'projects', projectId), {
      customSteps: arrayUnion(newStep),
      updatedAt: serverTimestamp()
    });
    toast.success('Đã thêm bước công việc mới');
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `projects/${projectId}`);
  }
};

export const updateCustomStep = async (projectId: string, customSteps: any[], stepId: string, updates: any) => {
  try {
    const newSteps = customSteps.map(s => s.id === stepId ? { ...s, ...updates } : s);
    await updateDoc(doc(db, 'projects', projectId), {
      customSteps: newSteps,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `projects/${projectId}`);
  }
};

export const moveCustomStep = async (projectId: string, customSteps: any[], stepId: string, direction: 'up' | 'down') => {
  try {
    const stepIndex = customSteps.findIndex(s => s.id === stepId);
    if (stepIndex === -1) return;
    const currentStep = customSteps[stepIndex];
    const categoryId = currentStep.categoryId;

    const categorySteps = customSteps.filter(s => s.categoryId === categoryId);
    const indexInCategory = categorySteps.findIndex(s => s.id === stepId);

    let targetIndexInCategory = -1;
    if (direction === 'up' && indexInCategory > 0) {
      targetIndexInCategory = indexInCategory - 1;
    } else if (direction === 'down' && indexInCategory < categorySteps.length - 1) {
      targetIndexInCategory = indexInCategory + 1;
    }

    if (targetIndexInCategory === -1) return;

    const targetStep = categorySteps[targetIndexInCategory];
    const targetStepIndexInGlobal = customSteps.findIndex(s => s.id === targetStep.id);

    const newCustomSteps = [...customSteps];
    newCustomSteps[stepIndex] = targetStep;
    newCustomSteps[targetStepIndexInGlobal] = currentStep;

    await updateDoc(doc(db, 'projects', projectId), {
      customSteps: newCustomSteps,
      updatedAt: serverTimestamp()
    });
    toast.success(direction === 'up' ? 'Đã di chuyển lên' : 'Đã di chuyển xuống');
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `projects/${projectId}`);
  }
};

export const deleteCustomStep = async (projectId: string, customSteps: any[], stepId: string) => {
  try {
    const newSteps = customSteps.filter(s => s.id !== stepId);
    await updateDoc(doc(db, 'projects', projectId), {
      customSteps: newSteps,
      updatedAt: serverTimestamp()
    });
    toast.success('Đã xoá bước công việc');
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `projects/${projectId}`);
  }
};

export const toggleDisabledStep = async (projectId: string, stepKey: string, currentDisabledSteps: string[] = []) => {
  try {
    const isCurrentlyDisabled = currentDisabledSteps.includes(stepKey);
    const newDisabledSteps = isCurrentlyDisabled 
      ? currentDisabledSteps.filter(s => s !== stepKey)
      : [...currentDisabledSteps, stepKey];
      
    await updateDoc(doc(db, 'projects', projectId), {
      disabledSteps: newDisabledSteps,
      updatedAt: serverTimestamp()
    });
    
    toast.success(isCurrentlyDisabled ? 'Đã khôi phục bước mặc định' : 'Đã ẩn bước mặc định');
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `projects/${projectId}`);
  }
};

export const updateStepsOrder = async (projectId: string, categoryId: string, newOrder: string[]) => {
  try {
    const projectRef = doc(db, 'projects', projectId);
    await updateDoc(projectRef, {
      [`stepsOrder.${categoryId}`]: newOrder,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `projects/${projectId}`);
  }
};

/**
 * Normalizes project data to ensure all required fields and steps exist.
 * This ensures that when new features or steps are added to the code, 
 * they apply to all existing projects automatically.
 */
export const normalizeProject = (data: any, id: string): any => {
  const normalized = {
    ...data,
    id,
    projectType: data.projectType || 'both',
    disabledCategories: data.disabledCategories || [],
    disabledSteps: data.disabledSteps || [],
    authorizedEmails: data.authorizedEmails || [],
    inventoryIssues: data.inventoryIssues || [],
    customSteps: data.customSteps || [],
    stepsOrder: data.stepsOrder || {},
    steps: data.steps || {},
    location: data.location || '',
    investor: data.investor || ''
  };

  // Modernized single-flow standard steps
  const standardStepKeys = [
    'landmarks_handover', 'acquisition_plan', 'deployment_meeting', 'notice_request', 'budget_estimate',
    'inventory', 'confirmation_request', 'plan_draft', 'plan_public', 'appraisal_submit', 
    'approval', 'decision_public', 'payment'
  ];

  // Smart backward compatibility - migrate land-specific steps into the unified space if needed
  if (normalized.steps.inventory === undefined) {
    const prevAgri = normalized.steps.inventory_agri || {};
    const prevRes = normalized.steps.inventory_resident || {};
    normalized.steps.inventory = {
      status: 'in_progress',
      agriPlots: prevAgri.totalPlots || 0,
      agriHouseholds: prevAgri.totalHouseholds || 0,
      nonAgriPlots: prevRes.totalPlots || 0,
      nonAgriHouseholds: prevRes.totalHouseholds || 0,
      orgs: 0,
      graves: 0,
      assets: 0,
      structures: 0,
      graveHouseholds: 0,
      rounds: [],
      deadline: ''
    };
  }

  // Helper migration function for simple values/objects
  const migrateOrCreate = (key: string, prevKeys: string[], defaultVal: any) => {
    if (normalized.steps[key] === undefined) {
      let migrated: any = null;
      for (const pKey of prevKeys) {
        if (normalized.steps[pKey] !== undefined) {
          migrated = normalized.steps[pKey];
          break;
        }
      }
      normalized.steps[key] = migrated !== null ? migrated : defaultVal;
    }
  };

  migrateOrCreate('confirmation_request', ['agri_confirmation_request'], 'in_progress');
  migrateOrCreate('plan_draft', ['agri_plan_draft', 'res_plan_draft'], 'in_progress');
  migrateOrCreate('plan_public', ['agri_plan_public', 'res_plan_public'], { status: 'in_progress', links: [], rounds: [] });
  migrateOrCreate('appraisal_submit', ['agri_appraisal_submit', 'res_appraisal_submit'], { status: 'in_progress', amount: 0, cost: 0, plots: 0, households: 0, links: [], rounds: [] });
  migrateOrCreate('approval', ['agri_approval', 'res_approval'], { status: 'in_progress', amount: 0, cost: 0, plots: 0, households: 0, links: [], rounds: [] });
  migrateOrCreate('decision_public', ['agri_decision_public', 'res_decision_public'], { status: 'in_progress', links: [], rounds: [] });
  migrateOrCreate('payment', ['agri_payment', 'res_payment'], { status: 'in_progress', amount: 0, donePlots: 0, totalPlots: 0, doneHouseholds: 0, totalHouseholds: 0, rounds: [] });

  standardStepKeys.forEach(key => {
    if (normalized.steps[key] === undefined) {
      if (key === 'inventory') {
        normalized.steps[key] = { 
          status: 'in_progress', 
          agriPlots: 0, agriHouseholds: 0, 
          nonAgriPlots: 0, nonAgriHouseholds: 0, 
          orgs: 0, graves: 0, assets: 0, 
          structures: 0, graveHouseholds: 0, rounds: [], deadline: '' 
        };
      } else if (['appraisal_submit', 'approval'].includes(key)) {
        normalized.steps[key] = { status: 'in_progress', amount: 0, cost: 0, plots: 0, households: 0, links: [], rounds: [] };
      } else if (['plan_public', 'decision_public'].includes(key)) {
        normalized.steps[key] = { status: 'in_progress', links: [], rounds: [] };
      } else if (key === 'payment') {
        normalized.steps[key] = { status: 'in_progress', amount: 0, donePlots: 0, totalPlots: 0, doneHouseholds: 0, totalHouseholds: 0, rounds: [] };
      } else {
        normalized.steps[key] = 'in_progress';
      }
    }
  });

  return normalized;
};
