import { Project, STEP_LABELS, STEPS_WITH_ROUNDS, STEP_CATEGORIES } from "../../types";

export const getCategoryStepsOrdered = (project: Project, categoryId: string): string[] => {
  const defaultSteps = STEP_CATEGORIES.find(c => c.id === categoryId)?.steps || [];
  const customSteps = (project.customSteps || [])
    .filter(cs => cs.categoryId === categoryId)
    .map(cs => `custom_${cs.id}`);

  const activeDefaultSteps = defaultSteps.filter(k => !project.disabledSteps?.includes(k));
  
  const savedOrder = project.stepsOrder?.[categoryId];
  if (!savedOrder || savedOrder.length === 0) {
    return [...activeDefaultSteps, ...customSteps];
  }

  const allActiveKeys = new Set([...activeDefaultSteps, ...customSteps]);

  // Keep only active keys that are in savedOrder
  const ordered = savedOrder.filter(key => allActiveKeys.has(key));

  // If there are standard/custom steps newly active/added and missing from savedOrder, append them
  const orderedSet = new Set(ordered);
  const remaining = [...activeDefaultSteps, ...customSteps].filter(key => !orderedSet.has(key));

  return [...ordered, ...remaining];
};

export const parseFormattedDate = (dateStr?: string) => {
  if (!dateStr) return null;
  // Try to match DD/MM/YYYY or D/M/YYYY
  const slashMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    return {
      day: parseInt(slashMatch[1], 10).toString(),
      month: parseInt(slashMatch[2], 10).toString(),
      year: slashMatch[3],
    };
  }

  // Try to match YYYY-MM-DD
  const dashMatch = dateStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (dashMatch) {
    return {
      day: parseInt(dashMatch[3], 10).toString(),
      month: parseInt(dashMatch[2], 10).toString(),
      year: dashMatch[1],
    };
  }

  // If we couldn't parse it nicely, just split by dividers if there are 3 parts
  const parts = dateStr.split(/[-/.]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      // YYYY divider MM divider DD
      return {
        day: parseInt(parts[2], 10).toString(),
        month: parseInt(parts[1], 10).toString(),
        year: parts[0],
      };
    } else if (parts[2].length === 4) {
      // DD divider MM divider YYYY
      return {
        day: parseInt(parts[0], 10).toString(),
        month: parseInt(parts[1], 10).toString(),
        year: parts[2],
      };
    }
  }

  return null;
};

export const isOverdue = (deadlineStr?: string) => {
  if (!deadlineStr) return false;
  const parsed = parseFormattedDate(deadlineStr);
  if (!parsed) return false;

  const { day, month, year } = parsed;
  const deadlineDate = new Date(
    parseInt(year, 10),
    parseInt(month, 10) - 1,
    parseInt(day, 10),
    0,
    0,
    0
  );

  const now = new Date();
  const today = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    0,
    0,
    0
  );

  return deadlineDate.getTime() <= today.getTime();
};

export const getStepStatus = (
  stepKey: string,
  stepData: any,
  isObject: boolean,
  project?: Project
) => {
  const statusStr = isObject
    ? (stepData as any).status || ""
    : (stepData as string);
  if (statusStr === "not_applicable") {
    return "not_applicable";
  }

  if (stepKey === "inventory" && isObject) {
    if (checkInventoryCompleted(stepData)) {
      return "completed";
    }
  } else if (
    [
      "appraisal_submit",
      "agri_appraisal_submit",
      "res_appraisal_submit",
    ].includes(stepKey) &&
    isObject &&
    project
  ) {
    let totalPlots = 0;
    let totalHH = 0;

    if (stepKey === "appraisal_submit") {
      const invData = (project.steps.inventory as any) || {};
      totalPlots = (invData.agriPlots || 0) + (invData.nonAgriPlots || 0);
      totalHH =
        (invData.agriHouseholds || 0) + (invData.nonAgriHouseholds || 0);
    } else {
      const isAgri = stepKey === "agri_appraisal_submit";
      const invKey = isAgri ? "inventory_agri" : "inventory_resident";
      const invData = project.steps[invKey as keyof typeof project.steps] || {};
      totalPlots = (invData as any).totalPlots || 0;
      totalHH = (invData as any).totalHouseholds || 0;
    }

    // submitted from this step
    const roundsList = (stepData as any).rounds || [];
    const submittedPlots = roundsList.length > 0 
      ? roundsList.reduce((acc: number, r: any) => acc + (r.plots || 0), 0)
      : ((stepData as any).plots || 0);
    const submittedHH = roundsList.length > 0
      ? roundsList.reduce((acc: number, r: any) => acc + (r.households || 0), 0)
      : ((stepData as any).households || 0);

    // Hoàn thành khi đã trình đủ/bằng chỉ tiêu tổng thể (hoặc tổng số liệu bị ảnh hưởng ban đầu)
    if (
      (totalPlots > 0 && submittedPlots >= totalPlots) ||
      (totalHH > 0 && submittedHH >= totalHH)
    ) {
      return "completed";
    }

    // Fallback normal logic if the conditions aren't met yet but someone set status/date
    const dateVal =
      (stepData as any).date || (stepData as any).invitationDate || "";
    if (dateVal && dateVal.trim() !== "") return "completed";
  } else {
    const dateVal = isObject
      ? (stepData as any).date || (stepData as any).invitationDate || ""
      : "";
    if (dateVal && dateVal.trim() !== "") {
      return "completed";
    }
  }

  const deadline = isObject ? (stepData as any).deadline : "";
  if (deadline && deadline.trim() !== "") {
    if (isOverdue(deadline)) {
      return "overdue";
    }
  }

  return "";
};

export const getCustomStepStatus = (step: any) => {
  if (step.status === "not_applicable") {
    return "not_applicable";
  }
  if (step.date && step.date.trim() !== "") {
    return "completed";
  }
  if (step.deadline && step.deadline.trim() !== "") {
    if (isOverdue(step.deadline)) {
      return "overdue";
    }
  }
  return "";
};

export const getFlattenedRounds = (rounds: any[]) => {
  const list: any[] = [];
  if (!rounds) return list;
  rounds.forEach((round) => {
    const items =
      round.items && round.items.length > 0
        ? round.items
        : [
            {
              id: "legacy",
              targetType: round.targetType || "agri",
              landType: round.landType || "",
              address: round.address || "",
              donePlots: round.donePlots || 0,
              doneHouseholds: round.doneHouseholds || 0,
              doneOrgs: round.doneOrgs || 0,
              doneGraves: round.doneGraves || 0,
              doneAssets: round.doneAssets || 0,
              doneStructures: round.doneStructures || 0,
            },
          ];
    items.forEach((item: any) => {
      list.push({
        ...round,
        ...item,
        id: round.id, // Keep the parent round's ID for tracking
        itemId: item.id,
      });
    });
  });
  return list;
};

export const checkInventoryCompleted = (inv: any) => {
  if (!inv) return false;
  const statusStr = inv.status || "";
  if (statusStr === "not_applicable") {
    return false;
  }
  const roundsList = inv.rounds || [];
  const flatRoundsListForAgg = getFlattenedRounds(roundsList);

  const agriRounds = flatRoundsListForAgg.filter(
    (r: any) => r.targetType === "agri"
  );
  const nonAgriRounds = flatRoundsListForAgg.filter(
    (r: any) => r.targetType === "non_agri"
  );
  const orgRounds = flatRoundsListForAgg.filter(
    (r: any) => r.targetType === "org"
  );
  const assetRounds = flatRoundsListForAgg.filter(
    (r: any) => r.targetType === "assets"
  );

  const doneAgriPlots = agriRounds.reduce(
    (acc: number, r: any) => acc + (r.donePlots || 0),
    0
  );
  const doneAgriHouseholds = agriRounds.reduce(
    (acc: number, r: any) => acc + (r.doneHouseholds || 0),
    0
  );
  const doneNonAgriPlots = nonAgriRounds.reduce(
    (acc: number, r: any) => acc + (r.donePlots || 0),
    0
  );
  const doneNonAgriHouseholds = nonAgriRounds.reduce(
    (acc: number, r: any) => acc + (r.doneHouseholds || 0),
    0
  );
  const doneOrgs = orgRounds.reduce(
    (acc: number, r: any) => acc + (r.doneOrgs || 0),
    0
  );

  const targetAgriPlots = inv.agriPlots || 0;
  const targetAgriHH = inv.agriHouseholds || 0;
  const targetNonAgriPlots = inv.nonAgriPlots || 0;
  const targetNonAgriHH = inv.nonAgriHouseholds || 0;
  const targetOrgs = inv.orgs || 0;

  const assetItems: Array<{ id: string; label: string; value: number }> =
    inv.assetItems || [
      {
        id: "graves",
        label: "Tài sản trên đất",
        value: inv.graves !== undefined ? inv.graves : 0,
      },
      {
        id: "assets",
        label: "Tài sản khác",
        value: inv.assets !== undefined ? inv.assets : 0,
      },
    ];

  let assetTargetsMet = true;
  assetItems.forEach((item) => {
    if (item.value > 0) {
      const doneVal = assetRounds.reduce((acc: number, r: any) => {
        const rVal =
          r[item.id] !== undefined
            ? r[item.id]
            : item.id === "graves"
              ? r.doneGraves
              : item.id === "assets"
                ? r.doneAssets
                : item.id === "structures"
                  ? r.doneStructures
                  : 0;
        return acc + (Number(rVal) || 0);
      }, 0);
      if (doneVal < item.value) {
        assetTargetsMet = false;
      }
    }
  });

  const targetGraveHH = inv.graveHouseholds || 0;
  const doneAssetHouseholds = assetRounds.reduce(
    (acc: number, r: any) => acc + (r.doneHouseholds || 0),
    0
  );
  if (targetGraveHH > 0 && doneAssetHouseholds < targetGraveHH) {
    assetTargetsMet = false;
  }

  const hasAnyTarget =
    targetAgriPlots > 0 ||
    targetAgriHH > 0 ||
    targetNonAgriPlots > 0 ||
    targetNonAgriHH > 0 ||
    targetOrgs > 0 ||
    targetGraveHH > 0 ||
    assetItems.some((i) => i.value > 0);
  if (!hasAnyTarget) return false;

  if (targetAgriPlots > 0 && doneAgriPlots < targetAgriPlots) return false;
  if (targetAgriHH > 0 && doneAgriHouseholds < targetAgriHH) return false;

  if (targetNonAgriPlots > 0 && doneNonAgriPlots < targetNonAgriPlots)
    return false;
  if (targetNonAgriHH > 0 && doneNonAgriHouseholds < targetNonAgriHH)
    return false;

  if (targetOrgs > 0 && doneOrgs < targetOrgs) return false;

  if (!assetTargetsMet) return false;

  return true;
};

export const formatCount = (num: number) => {
  return num === undefined || num === null || isNaN(num) ? 0 : num;
};

export const getOverdueText = (deadlineStr?: string) => {
  if (!deadlineStr) return '';
  const parsed = parseFormattedDate(deadlineStr);
  if (!parsed) return '';

  const { day, month, year } = parsed;
  const deadlineDate = new Date(
    parseInt(year, 10),
    parseInt(month, 10) - 1,
    parseInt(day, 10),
    0,
    0,
    0
  );

  const now = new Date();
  const today = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    0,
    0,
    0
  );

  const diffTime = today.getTime() - deadlineDate.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays <= 0) return '';
  return `Trễ ${diffDays} ngày`;
};

