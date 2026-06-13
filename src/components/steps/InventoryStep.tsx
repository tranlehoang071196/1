import React, { useState } from "react";
import { 
  Trash2, 
  Layers, 
  ChevronDown, 
  ChevronUp, 
  Tractor, 
  Home, 
  Building2, 
  Church, 
  Link as LinkIcon, 
  AlertCircle, 
  Plus 
} from "lucide-react";
import { Project } from "../../types";
import { CustomDatePicker, NumberInput, Combobox, EditableInput } from "../ui-primitives";
import { updateStepStatus } from "../../lib/projectService";
import { AGRI_LAND_TYPES, NON_AGRI_LAND_TYPES } from "../../lib/landTypes";
import { formatCount, getFlattenedRounds } from "./stepUtils";
import { motion, AnimatePresence } from "framer-motion";

interface InventoryStepProps {
  project: Project;
  stepKey: string;
  stepData: any;
  canEdit: boolean;
}

export const InventoryStep: React.FC<InventoryStepProps> = ({
  project,
  stepKey,
  stepData,
  canEdit,
}) => {
  const inv = stepData as any;
  const roundsList = inv?.rounds || [];

  // Local state for UI expansion and active round filtering
  const [isTargetsExpanded, setIsTargetsExpanded] = useState(false);
  const [inventoryActiveRoundId, setInventoryActiveRoundId] = useState<string | null>(null);
  const [showSavedToast, setShowSavedToast] = useState(false);

  const assetItems: Array<{
    id: string;
    label: string;
    value: number;
  }> = inv?.assetItems || [
    {
      id: "graves",
      label: "Tài sản trên đất",
      value: inv?.graves !== undefined ? inv.graves : 0,
    },
    {
      id: "assets",
      label: "Tài sản khác",
      value: inv?.assets !== undefined ? inv.assets : 0,
    },
  ];

  const assetGroupTitle = "Tài sản khác";

  // Calculate dynamic done values from rounds
  const flatRoundsListForAgg = getFlattenedRounds(roundsList);
  const agriRounds = flatRoundsListForAgg.filter(
    (r: any) => r.targetType === "agri",
  );
  const nonAgriRounds = flatRoundsListForAgg.filter(
    (r: any) => r.targetType === "non_agri",
  );
  const orgRounds = flatRoundsListForAgg.filter(
    (r: any) => r.targetType === "org",
  );
  const assetRounds = flatRoundsListForAgg.filter(
    (r: any) => r.targetType === "assets",
  );

  const doneAgriPlots = agriRounds.reduce(
    (acc: number, r: any) => Number(acc) + Number(r.donePlots || 0),
    0,
  );
  const doneAgriHouseholds = agriRounds.reduce(
    (acc: number, r: any) => Number(acc) + Number(r.doneHouseholds || 0),
    0,
  );
  const doneNonAgriPlots = nonAgriRounds.reduce(
    (acc: number, r: any) => Number(acc) + Number(r.donePlots || 0),
    0,
  );
  const doneNonAgriHouseholds = nonAgriRounds.reduce(
    (acc: number, r: any) => Number(acc) + Number(r.doneHouseholds || 0),
    0,
  );
  const doneOrgs = orgRounds.reduce(
    (acc: number, r: any) => Number(acc) + Number(r.doneOrgs || 0),
    0,
  );

  // Dynamic asset types done counts
  const assetDoneParts: string[] = [];
  let hasAnyAssetDone = false;

  assetItems.forEach((item) => {
    const doneVal = assetRounds.reduce(
      (acc: number, r: any) => {
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
        return Number(acc) + Number(Number(rVal) || 0);
      },
      0,
    );

    if (doneVal > 0) {
      hasAnyAssetDone = true;
      assetDoneParts.push(`${formatCount(doneVal)} ${item.label}`);
    }
  });

  const doneAssetHouseholds = assetRounds.reduce(
    (acc: number, r: any) => Number(acc) + Number(r.doneHouseholds || 0),
    0,
  );

  let assetProgressText = "";
  if (assetDoneParts.length > 0) {
    assetProgressText = assetDoneParts.join(", ");
    if (doneAssetHouseholds > 0) {
      assetProgressText += ` thuộc ${formatCount(doneAssetHouseholds)} hộ`;
    }
  } else if (doneAssetHouseholds > 0) {
    assetProgressText = `tài sản thuộc ${formatCount(doneAssetHouseholds)} hộ`;
  }

  const doneGravesCount = assetRounds.reduce((acc: number, r: any) => {
    const rVal = r.graves !== undefined ? r.graves : (r.doneGraves || 0);
    return Number(acc) + Number(Number(rVal) || 0);
  }, 0);
  const graveTargetCount = inv?.graves !== undefined ? inv.graves : 0;

  // Targets
  const targetAgriPlots = inv?.agriPlots || 0;
  const targetAgriHH = inv?.agriHouseholds || 0;
  const targetAgriTypes = inv?.agriTypes || [];
  const displayAgriTypes =
    targetAgriTypes.length > 0
      ? targetAgriTypes
      : [{ code: "", plots: 0, households: 0 }];
  const targetNonAgriPlots = inv?.nonAgriPlots || 0;
  const targetNonAgriHH = inv?.nonAgriHouseholds || 0;
  const targetNonAgriTypes = inv?.nonAgriTypes || [];
  const displayNonAgriTypes =
    targetNonAgriTypes.length > 0
      ? targetNonAgriTypes
      : [{ code: "", plots: 0, households: 0 }];
  const targetOrgs = inv?.orgs || 0;
  const targetGraveHH = inv?.graveHouseholds || 0;

  const targetAssetParts: string[] = [];
  assetItems.forEach((item) => {
    if (item.value > 0) {
      targetAssetParts.push(`${formatCount(item.value)} ${item.label}`);
    }
  });

  let targetAssetProgressText = "";
  if (targetAssetParts.length > 0) {
    targetAssetProgressText = targetAssetParts.join(", ");
    if (targetGraveHH > 0) {
      targetAssetProgressText += ` thuộc ${formatCount(targetGraveHH)} hộ`;
    }
  } else if (targetGraveHH > 0) {
    targetAssetProgressText = `tài sản thuộc ${formatCount(targetGraveHH)} hộ`;
  }

  const hasTargetAgri = targetAgriPlots > 0 || targetAgriHH > 0;
  const hasTargetNonAgri = targetNonAgriPlots > 0 || targetNonAgriHH > 0;
  const hasTargetOrgs = targetOrgs > 0;
  const hasTargetAssets = targetAssetParts.length > 0 || targetGraveHH > 0;

  const availableInvTypes: {
    value: string;
    label: string;
  }[] = [];
  if (hasTargetAgri)
    availableInvTypes.push({
      value: "agri",
      label: "🌾 Đất nông nghiệp",
    });
  if (hasTargetNonAgri)
    availableInvTypes.push({
      value: "non_agri",
      label: "🏠 Đất phi nông nghiệp",
    });
  if (hasTargetOrgs)
    availableInvTypes.push({
      value: "org",
      label: "🏢 Tổ chức",
    });
  if (hasTargetAssets)
    availableInvTypes.push({
      value: "assets",
      label: `📦 ${assetGroupTitle}`,
    });

  const defaultInvType = availableInvTypes[0]?.value || "agri";

  return (
    <div className="flex flex-col gap-5 mt-2 w-full">
      {/* Targets Section */}
      <div className="border border-slate-200/80 rounded-2xl bg-white overflow-hidden shadow-xs hover:shadow-sm transition-all duration-300">
        {/* Section Header */}
        <div
          className="flex items-center justify-between cursor-pointer group px-5 py-4 bg-gradient-to-r from-slate-50 to-slate-100/50 border-b border-slate-100"
          onClick={() => setIsTargetsExpanded(!isTargetsExpanded)}
        >
          <span className="text-[12px] font-black tracking-wider text-slate-700 uppercase flex items-center gap-2 select-none">
            📊 Tổng số đối tượng bị ảnh hưởng (Chỉ tiêu dự án)
          </span>
          <div className="flex items-center gap-2.5 shrink-0">
            <span className="text-[11px] font-extrabold text-blue-600 flex items-center gap-1 hover:text-blue-700 transition-colors select-none">
              ✏️ {isTargetsExpanded ? "Ẩn bớt đi" : "Hiệu chỉnh Chỉ tiêu"}
            </span>
            {isTargetsExpanded ? (
              <ChevronUp className="w-4 h-4 text-slate-400 group-hover:text-blue-500 transition-transform" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-blue-500 transition-transform" />
            )}
          </div>
        </div>
        {/* 4 Cards Grid - Replicating Mockup with Premium Redesign */}
        <div className="p-5 bg-white grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Card 1: Agri Land */}
          <div className="relative bg-white border border-slate-200 rounded-2xl p-4.5 flex flex-col justify-between overflow-hidden transition-all duration-300 hover:shadow-md min-h-[145px]">
            <div>
              {/* Header: Title and Percentage */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-xl bg-red-50 text-red-500">
                    <Tractor className="w-4 h-4 shrink-0" />
                  </div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                    Đất nông nghiệp
                  </span>
                </div>
                <span className="text-[11px] font-extrabold text-red-600 font-mono">
                  {targetAgriPlots > 0 ? Math.min(100, Math.round((doneAgriPlots / targetAgriPlots) * 100)) : 0}%
                </span>
              </div>
              
              <div className="mt-3.5">
                <span className="text-[16px] font-black text-slate-900 leading-none">
                  {formatCount(targetAgriPlots)} thửa
                </span>
                <span className="text-xs font-semibold text-slate-400 ml-1.5">
                  ({formatCount(targetAgriHH)} hộ)
                </span>
              </div>

              {/* Subtitle list badges inside Card 1 */}
              {(() => {
                const typedRounds = flatRoundsListForAgg.filter(
                  (r: any) => r.targetType === "agri" && r.landType
                );
                const uniqueCodes = Array.from(
                  new Set(typedRounds.map((r: any) => r.landType))
                );

                if (uniqueCodes.length === 0) {
                  return (
                    <div className="text-[9.5px] font-bold text-slate-400 mt-2 font-mono uppercase">
                      LUK: 0/{targetAgriPlots}T
                    </div>
                  );
                }
                return (
                  <div className="flex flex-wrap gap-1 mt-2.5">
                    {uniqueCodes.map((code: any) => {
                      const codeRounds = typedRounds.filter(
                        (r: any) => r.landType === code
                      );
                      const cPlots = codeRounds.reduce(
                        (acc: number, r: any) => Number(acc) + Number(r.donePlots || 0),
                        0
                      );
                      const matchingTarget = targetAgriTypes.find(
                        (t: any) => (typeof t === "string" ? t : t.code) === code
                      );
                      const tPlots = matchingTarget && typeof matchingTarget !== "string"
                        ? matchingTarget.plots
                        : 0;

                      return (
                        <span
                          key={code}
                          className="text-[9.5px] font-bold text-slate-500 font-mono"
                        >
                          {code}: {cPlots}/{tPlots}T
                        </span>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
            
            <div className="mt-4 pt-1">
              <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-red-500 transition-all duration-500 rounded-full"
                  style={{ width: `${targetAgriPlots > 0 ? Math.min(100, Math.round((doneAgriPlots / targetAgriPlots) * 100)) : 0}%` }}
                />
              </div>
            </div>
          </div>

          {/* Card 2: Non-Agri Land */}
          <div className="relative bg-white border border-slate-200 rounded-2xl p-4.5 flex flex-col justify-between overflow-hidden transition-all duration-300 hover:shadow-md min-h-[145px]">
            <div>
              {/* Header: Title and Percentage */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-xl bg-green-50 text-green-500">
                    <Home className="w-4 h-4 shrink-0" />
                  </div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                    Đất phi nông nghiệp
                  </span>
                </div>
                <span className="text-[11px] font-extrabold text-green-600 font-mono">
                  {targetNonAgriPlots > 0 ? Math.min(100, Math.round((doneNonAgriPlots / targetNonAgriPlots) * 100)) : 0}%
                </span>
              </div>
              
              <div className="mt-3.5">
                <span className="text-[16px] font-black text-slate-900 leading-none">
                  {formatCount(targetNonAgriPlots)} thửa
                </span>
                <span className="text-xs font-semibold text-slate-400 ml-1.5">
                  ({formatCount(targetNonAgriHH)} hộ)
                </span>
              </div>

              {/* Subtitle list badges inside Card 2 */}
              {(() => {
                const typedRounds = flatRoundsListForAgg.filter(
                  (r: any) => r.targetType === "non_agri" && r.landType
                );
                const uniqueCodes = Array.from(
                  new Set(typedRounds.map((r: any) => r.landType))
                );

                if (uniqueCodes.length === 0) {
                  return (
                    <div className="text-[9.5px] font-bold text-slate-400 mt-2 font-mono uppercase">
                      ODT: 200/200T • OTC: 3/3T
                    </div>
                  );
                }
                return (
                  <div className="flex flex-wrap gap-1.5 mt-2.5">
                    {uniqueCodes.map((code: any, cidx) => {
                      const codeRounds = typedRounds.filter(
                        (r: any) => r.landType === code
                      );
                      const cPlots = codeRounds.reduce(
                        (acc: number, r: any) => Number(acc) + Number(r.donePlots || 0),
                        0
                      );
                      const matchingTarget = targetNonAgriTypes.find(
                        (t: any) => (typeof t === "string" ? t : t.code) === code
                      );
                      const tPlots = matchingTarget && typeof matchingTarget !== "string"
                        ? matchingTarget.plots
                        : 0;

                      return (
                        <span
                          key={code}
                          className="text-[9.5px] font-bold text-slate-500 font-mono"
                        >
                          {cidx > 0 && " • "}{code}: {cPlots}/{tPlots}T
                        </span>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
            
            <div className="mt-4 pt-1">
              <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-green-500 transition-all duration-500 rounded-full"
                  style={{ width: `${targetNonAgriPlots > 0 ? Math.min(100, Math.round((doneNonAgriPlots / targetNonAgriPlots) * 100)) : 0}%` }}
                />
              </div>
            </div>
          </div>

          {/* Card 3: Organizations */}
          <div className="relative bg-white border border-slate-200 rounded-2xl p-4.5 flex flex-col justify-between overflow-hidden transition-all duration-300 hover:shadow-md min-h-[145px]">
            <div>
              {/* Header: Title and Percentage */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-xl bg-purple-50 text-purple-500">
                    <Building2 className="w-4 h-4 shrink-0" />
                  </div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                    Tổ chức ảnh hưởng
                  </span>
                </div>
                <span className="text-[11px] font-extrabold text-purple-600 font-mono">
                  {targetOrgs > 0 ? Math.min(100, Math.round((doneOrgs / targetOrgs) * 100)) : 0}%
                </span>
              </div>
              
              <div className="mt-3.5">
                <span className="text-[16px] font-black text-slate-900 leading-none">
                  {formatCount(targetOrgs)} tổ chức
                </span>
              </div>

              <div className="mt-2.5">
                {targetOrgs > 0 && doneOrgs >= targetOrgs ? (
                  <span className="inline-flex items-center justify-center text-[9px] font-bold text-purple-600 bg-purple-50 border border-purple-100/50 px-2 py-0.5 rounded-md uppercase tracking-wider leading-none">
                    HOÀN THÀNH
                  </span>
                ) : targetOrgs > 0 ? (
                  <span className="text-[9.5px] font-bold text-slate-500 font-mono">
                    Tiến độ: {doneOrgs}/{targetOrgs}
                  </span>
                ) : (
                  <span className="text-[9px] font-bold text-slate-400 font-mono">
                    CHƯA CÓ CHỈ TIÊU
                  </span>
                )}
              </div>
            </div>
            
            <div className="mt-4 pt-1">
              <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-purple-600 transition-all duration-500 rounded-full"
                  style={{ width: `${targetOrgs > 0 ? Math.min(100, Math.round((doneOrgs / targetOrgs) * 100)) : 0}%` }}
                />
              </div>
            </div>
          </div>

          {/* Card 4: Other Assets */}
          <div className="relative bg-white border border-slate-200 rounded-2xl p-4.5 flex flex-col justify-between overflow-hidden transition-all duration-300 hover:shadow-md min-h-[145px]">
            <div>
              {/* Header: Title and Percentage */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-xl bg-blue-50 text-blue-500">
                    <Church className="w-4 h-4 shrink-0" />
                  </div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                    Tài sản khác
                  </span>
                </div>
                <span className="text-[11px] font-extrabold text-blue-600 font-mono">
                  {graveTargetCount > 0 ? Math.min(100, Math.round((doneGravesCount / graveTargetCount) * 100)) : 0}%
                </span>
              </div>
              
              <div className="mt-3.5">
                <span className="text-[16px] font-black text-slate-900 leading-none">
                  {formatCount(graveTargetCount)} tài sản
                </span>
                <span className="text-xs font-semibold text-slate-400 ml-1.5">
                  ({formatCount(targetGraveHH)} hộ)
                </span>
              </div>

              <div className="mt-2.5">
                {graveTargetCount > 0 && doneGravesCount >= graveTargetCount ? (
                  <span className="inline-flex items-center justify-center text-[9px] font-bold text-blue-600 bg-blue-50 border border-blue-100/50 px-2 py-0.5 rounded-md uppercase tracking-wider leading-none">
                    HOÀN THÀNH
                  </span>
                ) : graveTargetCount > 0 ? (
                  <span className="text-[9.5px] font-bold text-slate-500 font-mono">
                    Tiến độ: {doneGravesCount}/{graveTargetCount}
                  </span>
                ) : (
                  <span className="text-[9px] font-bold text-slate-400 font-mono">
                    CHƯA CÓ CHỈ TIÊU
                  </span>
                )}
              </div>
            </div>
            
            <div className="mt-4 pt-1">
              <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-slate-400 transition-all duration-500 rounded-full"
                  style={{ width: `${graveTargetCount > 0 ? Math.min(100, Math.round((doneGravesCount / graveTargetCount) * 105)) : 0}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Dynamic Fields Editor for Targets */}
        <AnimatePresence>
          {isTargetsExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="p-4 border-t border-slate-200/80 bg-slate-50/10 overflow-hidden"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Agri Targets Editor */}
                <div className="bg-white border border-slate-200 p-3 rounded-lg space-y-2 shadow-xs">
                  <div className="text-[10px] font-extrabold text-slate-700 tracking-wider uppercase border-b border-slate-100 pb-1 flex justify-between items-center bg-slate-50/60 -mx-3 -mt-3 p-2 rounded-t-lg">
                    <span>🌾 Đất nông nghiệp</span>
                  </div>

                  <div className="space-y-1 mt-2">
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[9px] font-bold text-slate-400 uppercase">
                        Loại đất chi tiết
                      </label>
                    </div>

                    {displayAgriTypes.length > 0 && (
                      <div className="flex items-center gap-1 px-0.5 text-[8.5px] font-bold text-slate-400 uppercase select-none">
                        <div className="w-20 shrink-0">Loại đất</div>
                        <div className="w-12 shrink-0 text-center">Thửa</div>
                        <div className="w-12 shrink-0 text-center">Hộ</div>
                        <div className="flex-1 min-w-[80px]">Địa bàn/TDP</div>
                        {canEdit && <div className="w-5 shrink-0 ml-0.5"></div>}
                      </div>
                    )}

                    <div className="flex flex-col gap-1.5 mt-0.5">
                      {displayAgriTypes.map((item: any, idx: number) => {
                        const code = typeof item === "string" ? item : item.code || "";
                        const plots = typeof item === "string" ? 0 : item.plots || 0;
                        const hh = typeof item === "string" ? 0 : item.households || 0;
                        const address = typeof item === "string" ? "" : item.address || "";

                        return (
                          <div key={idx} className="flex items-center gap-1">
                            <div className="w-20 shrink-0">
                              <Combobox
                                options={AGRI_LAND_TYPES}
                                value={code}
                                displayCodeOnly={true}
                                onChange={(c) => {
                                  const newArr = [...displayAgriTypes];
                                  newArr[idx] = { code: c, plots, households: hh, address };
                                  const sumPlots = newArr.reduce((sum: number, t: any) => Number(sum) + Number(t.plots || 0), 0);
                                  const sumHH = newArr.reduce((sum: number, t: any) => Number(sum) + Number(t.households || 0), 0);
                                  updateStepStatus(project.id, stepKey, {
                                    ...inv,
                                    agriTypes: newArr,
                                    agriPlots: sumPlots,
                                    agriHouseholds: sumHH,
                                  });
                                }}
                                disabled={!canEdit}
                                placeholder="Tìm loại đất..."
                              />
                            </div>
                            <div className="w-12 flex-shrink-0 relative">
                              <NumberInput
                                value={plots}
                                onChange={(v) => {
                                  const newArr = [...displayAgriTypes];
                                  newArr[idx] = { code, plots: v, households: hh, address };
                                  const sumPlots = newArr.reduce((sum: number, t: any) => Number(sum) + Number(t.plots || 0), 0);
                                  const sumHH = newArr.reduce((sum: number, t: any) => Number(sum) + Number(t.households || 0), 0);
                                  updateStepStatus(project.id, stepKey, {
                                    ...inv,
                                    agriTypes: newArr,
                                    agriPlots: sumPlots,
                                    agriHouseholds: sumHH,
                                  });
                                }}
                                placeholder="Thửa"
                                readOnly={!canEdit}
                                className="w-full bg-slate-50 border border-slate-200 rounded px-1 py-1 text-[11px] font-semibold text-slate-700 text-center outline-none focus:border-blue-500"
                              />
                            </div>
                            <div className="w-12 flex-shrink-0 relative">
                              <NumberInput
                                value={hh}
                                onChange={(v) => {
                                  const newArr = [...displayAgriTypes];
                                  newArr[idx] = { code, plots, households: v, address };
                                  const sumPlots = newArr.reduce((sum: number, t: any) => Number(sum) + Number(t.plots || 0), 0);
                                  const sumHH = newArr.reduce((sum: number, t: any) => Number(sum) + Number(t.households || 0), 0);
                                  updateStepStatus(project.id, stepKey, {
                                    ...inv,
                                    agriTypes: newArr,
                                    agriPlots: sumPlots,
                                    agriHouseholds: sumHH,
                                  });
                                }}
                                placeholder="Hộ"
                                readOnly={!canEdit}
                                className="w-full bg-slate-50 border border-slate-200 rounded px-1 py-1 text-[11px] font-semibold text-slate-700 text-center outline-none focus:border-blue-500"
                              />
                            </div>
                            <div className="flex-1 min-w-[80px] relative">
                              <EditableInput
                                value={address}
                                onSave={(val) => {
                                  const newArr = [...displayAgriTypes];
                                  newArr[idx] = { code, plots, households: hh, address: val };
                                  const sumPlots = newArr.reduce((sum: number, t: any) => Number(sum) + Number(t.plots || 0), 0);
                                  const sumHH = newArr.reduce((sum: number, t: any) => Number(sum) + Number(t.households || 0), 0);
                                  updateStepStatus(project.id, stepKey, {
                                    ...inv,
                                    agriTypes: newArr,
                                    agriPlots: sumPlots,
                                    agriHouseholds: sumHH,
                                  });
                                }}
                                placeholder="Địa bàn, TDP..."
                                readOnly={!canEdit}
                                className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-[11px] font-semibold text-slate-700 outline-none focus:border-blue-500"
                              />
                            </div>
                            {canEdit && (
                              <button
                                onClick={() => {
                                  const newArr = displayAgriTypes.filter((_: any, i: number) => i !== idx);
                                  const sumPlots = newArr.reduce((sum: number, t: any) => Number(sum) + Number(t.plots || 0), 0);
                                  const sumHH = newArr.reduce((sum: number, t: any) => Number(sum) + Number(t.households || 0), 0);
                                  updateStepStatus(project.id, stepKey, {
                                    ...inv,
                                    agriTypes: newArr,
                                    agriPlots: sumPlots,
                                    agriHouseholds: sumHH,
                                  });
                                }}
                                className="text-slate-400 hover:text-red-500 w-5 flex-shrink-0 flex items-center justify-center ml-0.5"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => {
                          const newArr = [
                            ...displayAgriTypes,
                            { code: "", plots: 0, households: 0, address: "" },
                          ];
                          const sumPlots = newArr.reduce((sum: number, t: any) => Number(sum) + Number(t.plots || 0), 0);
                          const sumHH = newArr.reduce((sum: number, t: any) => Number(sum) + Number(t.households || 0), 0);
                          updateStepStatus(project.id, stepKey, {
                            ...inv,
                            agriTypes: newArr,
                            agriPlots: sumPlots,
                            agriHouseholds: sumHH,
                          });
                        }}
                        className="w-full mt-2 py-1.5 border border-dashed border-blue-300 hover:border-blue-500 rounded bg-blue-50/20 hover:bg-blue-50 transition-colors text-[10px] font-bold text-blue-600 uppercase flex items-center justify-center gap-1 cursor-pointer select-none"
                      >
                        <Plus className="w-3 h-3" /> Thêm loại đất chi tiết
                      </button>
                    )}
                  </div>
                </div>

                {/* Non-Agri Targets Editor */}
                <div className="bg-white border border-slate-200 p-3 rounded-lg space-y-2 shadow-xs">
                  <div className="text-[10px] font-extrabold text-slate-700 tracking-wider uppercase border-b border-slate-100 pb-1 flex justify-between items-center bg-slate-50/60 -mx-3 -mt-3 p-2 rounded-t-lg">
                    <span>🏠 Đất phi nông nghiệp</span>
                  </div>

                  <div className="space-y-1 mt-2">
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[9px] font-bold text-slate-400 uppercase">
                        Loại đất chi tiết
                      </label>
                    </div>

                    {displayNonAgriTypes.length > 0 && (
                      <div className="flex items-center gap-1 px-0.5 text-[8.5px] font-bold text-slate-400 uppercase select-none">
                        <div className="w-20 shrink-0">Loại đất</div>
                        <div className="w-12 shrink-0 text-center">Thửa</div>
                        <div className="w-12 shrink-0 text-center">Hộ</div>
                        <div className="flex-1 min-w-[80px]">Địa bàn/TDP</div>
                        {canEdit && <div className="w-5 shrink-0 ml-0.5"></div>}
                      </div>
                    )}

                    <div className="flex flex-col gap-1.5 mt-0.5">
                      {displayNonAgriTypes.map((item: any, idx: number) => {
                        const code = typeof item === "string" ? item : item.code || "";
                        const plots = typeof item === "string" ? 0 : item.plots || 0;
                        const hh = typeof item === "string" ? 0 : item.households || 0;
                        const address = typeof item === "string" ? "" : item.address || "";

                        return (
                          <div key={idx} className="flex items-center gap-1">
                            <div className="w-20 shrink-0">
                              <Combobox
                                options={NON_AGRI_LAND_TYPES}
                                value={code}
                                displayCodeOnly={true}
                                onChange={(c) => {
                                  const newArr = [...displayNonAgriTypes];
                                  newArr[idx] = { code: c, plots, households: hh, address };
                                  const sumPlots = newArr.reduce((sum: number, t: any) => Number(sum) + Number(t.plots || 0), 0);
                                  const sumHH = newArr.reduce((sum: number, t: any) => Number(sum) + Number(t.households || 0), 0);
                                  updateStepStatus(project.id, stepKey, {
                                    ...inv,
                                    nonAgriTypes: newArr,
                                    nonAgriPlots: sumPlots,
                                    nonAgriHouseholds: sumHH,
                                  });
                                }}
                                disabled={!canEdit}
                                placeholder="Tìm loại đất..."
                              />
                            </div>
                            <div className="w-12 flex-shrink-0 relative">
                              <NumberInput
                                value={plots}
                                onChange={(v) => {
                                  const newArr = [...displayNonAgriTypes];
                                  newArr[idx] = { code, plots: v, households: hh, address };
                                  const sumPlots = newArr.reduce((sum: number, t: any) => Number(sum) + Number(t.plots || 0), 0);
                                  const sumHH = newArr.reduce((sum: number, t: any) => Number(sum) + Number(t.households || 0), 0);
                                  updateStepStatus(project.id, stepKey, {
                                    ...inv,
                                    nonAgriTypes: newArr,
                                    nonAgriPlots: sumPlots,
                                    nonAgriHouseholds: sumHH,
                                  });
                                }}
                                placeholder="Thửa"
                                readOnly={!canEdit}
                                className="w-full bg-slate-50 border border-slate-200 rounded px-1 py-1 text-[11px] font-semibold text-slate-700 text-center outline-none focus:border-blue-500"
                              />
                            </div>
                            <div className="w-12 flex-shrink-0 relative">
                              <NumberInput
                                value={hh}
                                onChange={(v) => {
                                  const newArr = [...displayNonAgriTypes];
                                  newArr[idx] = { code, plots, households: v, address };
                                  const sumPlots = newArr.reduce((sum: number, t: any) => Number(sum) + Number(t.plots || 0), 0);
                                  const sumHH = newArr.reduce((sum: number, t: any) => Number(sum) + Number(t.households || 0), 0);
                                  updateStepStatus(project.id, stepKey, {
                                    ...inv,
                                    nonAgriTypes: newArr,
                                    nonAgriPlots: sumPlots,
                                    nonAgriHouseholds: sumHH,
                                  });
                                }}
                                placeholder="Hộ"
                                readOnly={!canEdit}
                                className="w-full bg-slate-50 border border-slate-200 rounded px-1 py-1 text-[11px] font-semibold text-slate-700 text-center outline-none focus:border-blue-500"
                              />
                            </div>
                            <div className="flex-1 min-w-[80px] relative">
                              <EditableInput
                                value={address}
                                onSave={(val) => {
                                  const newArr = [...displayNonAgriTypes];
                                  newArr[idx] = { code, plots, households: hh, address: val };
                                  const sumPlots = newArr.reduce((sum: number, t: any) => Number(sum) + Number(t.plots || 0), 0);
                                  const sumHH = newArr.reduce((sum: number, t: any) => Number(sum) + Number(t.households || 0), 0);
                                  updateStepStatus(project.id, stepKey, {
                                    ...inv,
                                    nonAgriTypes: newArr,
                                    nonAgriPlots: sumPlots,
                                    nonAgriHouseholds: sumHH,
                                  });
                                }}
                                placeholder="Địa bàn, TDP..."
                                readOnly={!canEdit}
                                className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-[11px] font-semibold text-slate-700 outline-none focus:border-blue-500"
                              />
                            </div>
                            {canEdit && (
                              <button
                                onClick={() => {
                                  const newArr = displayNonAgriTypes.filter((_: any, i: number) => i !== idx);
                                  const sumPlots = newArr.reduce((sum: number, t: any) => Number(sum) + Number(t.plots || 0), 0);
                                  const sumHH = newArr.reduce((sum: number, t: any) => Number(sum) + Number(t.households || 0), 0);
                                  updateStepStatus(project.id, stepKey, {
                                    ...inv,
                                    nonAgriTypes: newArr,
                                    nonAgriPlots: sumPlots,
                                    nonAgriHouseholds: sumHH,
                                  });
                                }}
                                className="text-slate-400 hover:text-red-500 w-5 flex-shrink-0 flex items-center justify-center ml-0.5"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => {
                          const newArr = [
                            ...displayNonAgriTypes,
                            { code: "", plots: 0, households: 0, address: "" },
                          ];
                          const sumPlots = newArr.reduce((sum: number, t: any) => Number(sum) + Number(t.plots || 0), 0);
                          const sumHH = newArr.reduce((sum: number, t: any) => Number(sum) + Number(t.households || 0), 0);
                          updateStepStatus(project.id, stepKey, {
                            ...inv,
                            nonAgriTypes: newArr,
                            nonAgriPlots: sumPlots,
                            nonAgriHouseholds: sumHH,
                          });
                        }}
                        className="w-full mt-2 py-1.5 border border-dashed border-blue-300 hover:border-blue-500 rounded bg-blue-50/20 hover:bg-blue-50 transition-colors text-[10px] font-bold text-blue-600 uppercase flex items-center justify-center gap-1 cursor-pointer select-none"
                      >
                        <Plus className="w-3 h-3" /> Thêm loại đất chi tiết
                      </button>
                    )}
                  </div>
                </div>

                {/* Org Targets Editor */}
                <div className="bg-white border border-slate-200 p-3 rounded-lg space-y-2 shadow-xs">
                  <div className="text-[10px] font-extrabold text-slate-700 tracking-wider uppercase border-b border-slate-100 pb-1 flex justify-between items-center bg-slate-50/60 -mx-3 -mt-3 p-2 rounded-t-lg">
                    <span>🏢 Tổ chức ảnh hưởng</span>
                  </div>
                  <div className="space-y-1 mt-2">
                    <label className="text-[9px] font-bold text-slate-400 uppercase">
                      Số lượng tổ chức
                    </label>
                    <NumberInput
                      readOnly={!canEdit}
                      className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs font-bold text-slate-800 focus:border-blue-500 outline-none"
                      value={targetOrgs}
                      onChange={(val) =>
                        updateStepStatus(project.id, stepKey, { ...inv, orgs: val })
                      }
                    />
                  </div>
                </div>

                {/* Graves, Assets Targets Editor */}
                <div className="bg-white border border-slate-200 p-3 rounded-lg space-y-2 shadow-xs md:col-span-2">
                  <div className="text-[10px] font-extrabold text-slate-705 tracking-wider uppercase border-b border-slate-100 pb-1 flex justify-between items-center bg-slate-50/60 -mx-3 -mt-3 p-2 rounded-t-lg">
                    <span className="flex items-center gap-1">
                      📦 <span className="capitalize text-slate-700">{assetGroupTitle}</span>
                    </span>
                    {canEdit && (
                      <button
                        onClick={() => {
                          const newItem = {
                            id: `custom_${Math.random().toString(36).substring(2, 9)}`,
                            label: "Tài sản mới",
                            value: 0,
                          };
                          updateStepStatus(project.id, stepKey, {
                            ...inv,
                            assetItems: [...assetItems, newItem],
                          });
                        }}
                        className="text-[9px] font-bold text-blue-600 hover:text-blue-700 bg-blue-50/80 hover:bg-blue-100/80 px-2 py-0.5 rounded transition-colors flex items-center gap-0.5 border border-blue-150"
                      >
                        + Thêm mục
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-1">
                    {assetItems.map((item, idx) => (
                      <div
                        key={item.id}
                        className="space-y-1 border border-slate-100 p-2.5 rounded-lg bg-slate-50/30 relative group"
                      >
                        {canEdit && (
                          <button
                            onClick={() => {
                              const newItems = assetItems.filter((i) => i.id !== item.id);
                              updateStepStatus(project.id, stepKey, { ...inv, assetItems: newItems });
                            }}
                            className="absolute -top-1 -right-1 hidden group-hover:flex items-center justify-center bg-red-100 hover:bg-red-200 text-red-600 rounded-full w-4 h-4 text-[10px] font-bold"
                            title="Xóa mục này"
                          >
                            ×
                          </button>
                        )}
                        <div className="space-y-1">
                          <EditableInput
                            readOnly={!canEdit}
                            className="text-[10px] font-semibold text-slate-600 bg-transparent border-b border-transparent hover:border-slate-350 focus:border-blue-500 outline-none w-full pb-0.5 animate-none"
                            value={item.label}
                            onSave={(val) => {
                              if (val) {
                                const newItems = [...assetItems];
                                newItems[idx] = { ...newItems[idx], label: val };
                                updateStepStatus(project.id, stepKey, { ...inv, assetItems: newItems });
                              }
                            }}
                            placeholder="Tên loại tài sản..."
                          />
                          <NumberInput
                            readOnly={!canEdit}
                            className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs font-bold text-slate-800 outline-none focus:border-blue-500"
                            value={item.value}
                            onChange={(val) => {
                              const newItems = [...assetItems];
                              newItems[idx] = { ...newItems[idx], value: val };
                              const updated: any = { ...inv, assetItems: newItems };
                              if (item.id === "graves") updated.graves = val;
                              if (item.id === "assets") updated.assets = val;
                              updateStepStatus(project.id, stepKey, updated);
                            }}
                          />
                        </div>
                      </div>
                    ))}

                    <div className="space-y-1 border border-blue-100 p-2.5 rounded-lg bg-blue-50/20">
                      <label className="text-[9px] font-bold text-blue-500 uppercase tracking-wide block pb-0.5">
                        Thuộc số hộ ảnh hưởng
                      </label>
                      <NumberInput
                        readOnly={!canEdit}
                        className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs font-bold text-slate-800 outline-none focus:border-blue-500"
                        value={targetGraveHH}
                        onChange={(val) =>
                          updateStepStatus(project.id, stepKey, { ...inv, graveHouseholds: val })
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Detail inventory rounds */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 select-none">
            <Layers className="w-4 h-4 text-slate-400" /> Chi tiết từng đợt kiểm đếm thực tế
          </span>
          {canEdit && (
            <button
              onClick={() => {
                const current = inv?.rounds || [];
                const item = {
                  id: Math.random().toString(36).substring(2, 11),
                  targetType: defaultInvType,
                  date: "",
                  donePlots: 0,
                  doneHouseholds: 0,
                  doneOrgs: 0,
                  doneGraves: 0,
                  doneAssets: 0,
                  doneStructures: 0,
                  notes: "",
                  links: [],
                };
                updateStepStatus(project.id, stepKey, {
                  ...inv,
                  rounds: [...current, item],
                });
              }}
              className="text-[11px] font-bold text-blue-600 bg-blue-50/80 hover:bg-blue-100/90 px-3.5 py-1.5 rounded-xl border border-blue-200/60 shadow-2xs hover:shadow-xs transition-all duration-250 cursor-pointer select-none flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Thêm đợt kiểm đếm
            </button>
          )}
        </div>

        {/* Round Navigation Tabs - Premium Pillar with Badges matching mockup */}
        {roundsList.length > 0 && (
          <div className="flex items-center gap-1.5 border-b border-slate-100 mb-4 px-1 font-sans">
            {roundsList.map((r: any, rIdx: number) => {
              const active = inventoryActiveRoundId === r.id || (rIdx === 0 && !inventoryActiveRoundId);
              const itemsCount = r.items && r.items.length > 0 ? r.items.length : (r.targetType ? 1 : 0);
              return (
                <button
                  key={r.id || rIdx}
                  onClick={() => setInventoryActiveRoundId(r.id)}
                  type="button"
                  className={`flex items-center gap-2 pb-2 px-3 border-b-2 text-xs font-black transition-all duration-200 cursor-pointer select-none ${
                    active
                      ? "border-blue-650 text-blue-650 font-black"
                      : "border-transparent text-slate-400 hover:text-slate-700"
                  }`}
                >
                  <span className="uppercase whitespace-nowrap">Đợt {rIdx + 1}</span>
                  <span className={`inline-flex items-center justify-center min-w-[17px] h-4 text-[9.5px] rounded-full px-1.5 font-bold ${
                    active ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500"
                  }`}>
                    {itemsCount}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Selected Round Detail Panel */}
        <div className="space-y-3.5">
          {roundsList.map((round: any, idx: number) => {
            const isActive = inventoryActiveRoundId === round.id || (idx === 0 && !inventoryActiveRoundId);
            if (!isActive) return null;

            const targetAgriCodes = targetAgriTypes
              .map((t: any) => (typeof t === "string" ? t : t.code || ""))
              .filter(Boolean);

            const targetNonAgriCodes = targetNonAgriTypes
              .map((t: any) => (typeof t === "string" ? t : t.code || ""))
              .filter(Boolean);

            const roundItems =
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

            const flatRoundsList = getFlattenedRounds(roundsList);

            return (
              <div
                key={round.id || idx}
                className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col gap-4 animate-in fade-in duration-200"
              >
                {/* Round Controls */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 font-sans">
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-black text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg uppercase tracking-wider">
                      Đợt kiểm đếm {idx + 1}
                    </span>

                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Ngày thực hiện:
                      </span>
                      <CustomDatePicker
                        value={round.date || ""}
                        onChange={(val) => {
                          const newRounds = [...roundsList];
                          newRounds[idx] = { ...newRounds[idx], date: val };
                          updateStepStatus(project.id, stepKey, { ...inv, rounds: newRounds });
                        }}
                        readOnly={!canEdit}
                      />
                    </div>
                  </div>

                  {canEdit && (
                    <button
                      onClick={() => {
                        const newRounds = roundsList.filter((r: any) => r.id !== round.id);
                        updateStepStatus(project.id, stepKey, { ...inv, rounds: newRounds });
                      }}
                      className="text-xs font-bold text-slate-400 hover:text-red-500 transition-colors flex items-center gap-1 cursor-pointer select-none"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-slate-400" />
                      <span>Xóa đợt kiểm đếm</span>
                    </button>
                  )}
                </div>

                {/* List Objects in active round */}
                <div className="space-y-3 font-sans">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block select-none">
                    🏡 Đối tượng trong đợt kiểm đếm:
                  </span>

                  <div className="space-y-2.5">
                    {roundItems.map((item: any, itemIdx: number) => {
                      const otherItems = flatRoundsList.filter(
                        (fItem: any) => !(fItem.id === round.id && fItem.itemId === item.id)
                      );

                      const otherAgriItems = otherItems.filter((r: any) => r.targetType === "agri");
                      const otherAgriItemsSameType = otherAgriItems.filter((r: any) => {
                        const sameType = (r.landType || "") === (item.landType || "");
                        if (!sameType) return false;

                        const allOfLandType = targetAgriTypes.filter(
                          (t: any) => (typeof t === "string" ? t : t.code || "") === (item.landType || "")
                        );
                        const hasConfiguredAddresses = allOfLandType.some(
                          (t: any) => typeof t !== "string" && (t.address || "").trim() !== ""
                        );

                        if (hasConfiguredAddresses) {
                          return (r.address || "") === (item.address || "");
                        }
                        return true;
                      });

                      const sumOtherAgriPlots = otherAgriItemsSameType.reduce((acc: number, r: any) => Number(acc) + Number(r.donePlots || 0), 0);
                      const sumOtherAgriHH = otherAgriItemsSameType.reduce((acc: number, r: any) => Number(acc) + Number(r.doneHouseholds || 0), 0);

                      let agriLimitPlots = 0;
                      let agriLimitHH = 0;
                      if (targetAgriCodes.length > 0) {
                        const allOfLandType = targetAgriTypes.filter(
                          (t: any) => (typeof t === "string" ? t : t.code || "") === (item.landType || "")
                        );
                        const hasConfiguredAddresses = allOfLandType.some(
                          (t: any) => typeof t !== "string" && (t.address || "").trim() !== ""
                        );

                        const matchingAgriItems = targetAgriTypes.filter((t: any) => {
                          const itemCode = typeof t === "string" ? t : t.code || "";
                          const itemAddress = typeof t === "string" ? "" : t.address || "";
                          if (hasConfiguredAddresses) {
                            return itemCode === (item.landType || "") && itemAddress === (item.address || "");
                          } else {
                            return itemCode === (item.landType || "");
                          }
                        });

                        if (matchingAgriItems.length > 0) {
                          matchingAgriItems.forEach((t: any) => {
                            if (typeof t !== "string") {
                              agriLimitPlots += t.plots || 0;
                              agriLimitHH += t.households || 0;
                            } else {
                              agriLimitPlots = targetAgriPlots;
                              agriLimitHH = targetAgriHH;
                            }
                          });
                        } else {
                          agriLimitPlots = 0;
                          agriLimitHH = 0;
                        }
                      } else {
                        agriLimitPlots = targetAgriPlots;
                        agriLimitHH = targetAgriHH;
                      }

                      const maxAgriPlots = Math.max(0, agriLimitPlots - sumOtherAgriPlots);
                      const maxAgriHH = Math.max(0, agriLimitHH - sumOtherAgriHH);

                      // Non agri item bounds
                      const otherNonAgriItems = otherItems.filter((r: any) => r.targetType === "non_agri");
                      const otherNonAgriItemsSameType = otherNonAgriItems.filter((r: any) => {
                        const sameType = (r.landType || "") === (item.landType || "");
                        if (!sameType) return false;

                        const allOfLandType = targetNonAgriTypes.filter(
                          (t: any) => (typeof t === "string" ? t : t.code || "") === (item.landType || "")
                        );
                        const hasConfiguredAddresses = allOfLandType.some(
                          (t: any) => typeof t !== "string" && (t.address || "").trim() !== ""
                        );

                        if (hasConfiguredAddresses) {
                          return (r.address || "") === (item.address || "");
                        }
                        return true;
                      });

                      const sumOtherNonAgriPlots = otherNonAgriItemsSameType.reduce((acc: number, r: any) => Number(acc) + Number(r.donePlots || 0), 0);
                      const sumOtherNonAgriHH = otherNonAgriItemsSameType.reduce((acc: number, r: any) => Number(acc) + Number(r.doneHouseholds || 0), 0);

                      let nonAgriLimitPlots = 0;
                      let nonAgriLimitHH = 0;
                      if (targetNonAgriCodes.length > 0) {
                        const allOfLandType = targetNonAgriTypes.filter(
                          (t: any) => (typeof t === "string" ? t : t.code || "") === (item.landType || "")
                        );
                        const hasConfiguredAddresses = allOfLandType.some(
                          (t: any) => typeof t !== "string" && (t.address || "").trim() !== ""
                        );

                        const matchingNonAgriItems = targetNonAgriTypes.filter((t: any) => {
                          const itemCode = typeof t === "string" ? t : t.code || "";
                          const itemAddress = typeof t === "string" ? "" : t.address || "";
                          if (hasConfiguredAddresses) {
                            return itemCode === (item.landType || "") && itemAddress === (item.address || "");
                          } else {
                            return itemCode === (item.landType || "");
                          }
                        });

                        if (matchingNonAgriItems.length > 0) {
                          matchingNonAgriItems.forEach((t: any) => {
                            if (typeof t !== "string") {
                              nonAgriLimitPlots += t.plots || 0;
                              nonAgriLimitHH += t.households || 0;
                            } else {
                              nonAgriLimitPlots = targetNonAgriPlots;
                              nonAgriLimitHH = targetNonAgriHH;
                            }
                          });
                        } else {
                          nonAgriLimitPlots = 0;
                          nonAgriLimitHH = 0;
                        }
                      } else {
                        nonAgriLimitPlots = targetNonAgriPlots;
                        nonAgriLimitHH = targetNonAgriHH;
                      }

                      const maxNonAgriPlots = Math.max(0, nonAgriLimitPlots - sumOtherNonAgriPlots);
                      const maxNonAgriHH = Math.max(0, nonAgriLimitHH - sumOtherNonAgriHH);

                      // Org limits
                      const otherOrgItems = otherItems.filter((r: any) => r.targetType === "org");
                      const sumOtherOrgs = otherOrgItems.reduce((acc: number, r: any) => Number(acc) + Number(r.doneOrgs || 0), 0);
                      const maxOrgs = Math.max(0, targetOrgs - sumOtherOrgs);

                      // Asset limits
                      const otherAssetItems = otherItems.filter((r: any) => r.targetType === "assets");
                      const sumOtherAssetHH = otherAssetItems.reduce((acc: number, r: any) => Number(acc) + Number(r.doneHouseholds || 0), 0);
                      const maxAssetHH = Math.max(0, targetGraveHH - sumOtherAssetHH);

                      return (
                        <div
                          key={item.id || itemIdx}
                          className="bg-slate-50/45 hover:bg-slate-50/80 border border-slate-200/70 hover:border-slate-350 rounded-2xl p-4.5 shadow-2xs transition-all duration-200 flex flex-col gap-3.5"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-dashed border-slate-200/60">
                            <div className="flex flex-wrap items-center gap-4">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider whitespace-nowrap">
                                  Đối tượng:
                                </span>
                                <select
                                  disabled={!canEdit}
                                  value={item.targetType || "agri"}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    const nextItems = [...roundItems];
                                    nextItems[itemIdx] = {
                                      ...nextItems[itemIdx],
                                      targetType: val,
                                      landType: "",
                                      address: "",
                                      donePlots: 0,
                                      doneHouseholds: 0,
                                      doneOrgs: 0,
                                      doneGraves: 0,
                                      doneAssets: 0,
                                      doneStructures: 0,
                                    };
                                    const nextRounds = [...roundsList];
                                    nextRounds[idx] = { ...nextRounds[idx], items: nextItems };
                                    if (itemIdx === 0) {
                                      nextRounds[idx] = {
                                        ...nextRounds[idx],
                                        targetType: val,
                                        landType: "",
                                        address: "",
                                        donePlots: 0,
                                        doneHouseholds: 0,
                                        doneOrgs: 0,
                                        doneGraves: 0,
                                        doneAssets: 0,
                                        doneStructures: 0,
                                        items: nextItems,
                                      };
                                    }
                                    updateStepStatus(project.id, stepKey, { ...inv, rounds: nextRounds });
                                  }}
                                  className="bg-white border border-slate-200 hover:border-slate-300 focus:border-blue-500 rounded-xl px-2.5 py-1 text-xs font-extrabold text-slate-800 outline-none font-sans shadow-3xs cursor-pointer"
                                >
                                  {availableInvTypes.map((t) => (
                                    <option key={t.value} value={t.value}>
                                      {t.label}
                                    </option>
                                  ))}
                                  {availableInvTypes.length === 0 && (
                                    <option value="agri">🌾 Đất nông nghiệp</option>
                                  )}
                                </select>
                              </div>

                              {["agri", "non_agri"].includes(item.targetType || "agri") && (
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider whitespace-nowrap">
                                    Loại đất:
                                  </span>
                                  <Combobox
                                    options={
                                      item.targetType === "agri"
                                        ? targetAgriCodes.length > 0
                                          ? AGRI_LAND_TYPES.filter((opt) => targetAgriCodes.includes(opt.code))
                                          : AGRI_LAND_TYPES
                                        : targetNonAgriCodes.length > 0
                                          ? NON_AGRI_LAND_TYPES.filter((opt) => targetNonAgriCodes.includes(opt.code))
                                          : NON_AGRI_LAND_TYPES
                                    }
                                    value={item.landType || ""}
                                    displayCodeOnly={true}
                                    onChange={(c) => {
                                      const nextItems = [...roundItems];
                                      nextItems[itemIdx] = {
                                        ...nextItems[itemIdx],
                                        landType: c,
                                        donePlots: 0,
                                        doneHouseholds: 0,
                                        address: "",
                                      };
                                      const nextRounds = [...roundsList];
                                      nextRounds[idx] = { ...nextRounds[idx], items: nextItems };
                                      if (itemIdx === 0) {
                                        nextRounds[idx] = {
                                          ...nextRounds[idx],
                                          landType: c,
                                          donePlots: 0,
                                          doneHouseholds: 0,
                                          address: "",
                                          items: nextItems,
                                        };
                                      }
                                      updateStepStatus(project.id, stepKey, { ...inv, rounds: nextRounds });
                                    }}
                                    disabled={!canEdit}
                                  />
                                </div>
                              )}
                            </div>

                            {canEdit && roundItems.length > 1 && (
                              <button
                                onClick={() => {
                                  const nextItems = roundItems.filter((_: any, i: number) => i !== itemIdx);
                                  const nextRounds = [...roundsList];
                                  nextRounds[idx] = { ...nextRounds[idx], items: nextItems };
                                  updateStepStatus(project.id, stepKey, { ...inv, rounds: nextRounds });
                                }}
                                className="text-xs font-bold text-slate-400 hover:text-red-500 transition-colors flex items-center gap-1 cursor-pointer select-none"
                              >
                                <span>Gỡ đối tượng</span>
                              </button>
                            )}
                          </div>

                          {/* Specific target forms */}
                          <div className="flex flex-wrap items-center gap-3">
                            {item.targetType === "agri" && (
                              <>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[10px] text-slate-500 font-bold whitespace-nowrap">Số thửa:</span>
                                  <NumberInput
                                    readOnly={!canEdit}
                                    className="w-16 h-7 text-center bg-slate-50 border border-slate-200 rounded text-xs font-bold font-mono outline-none focus:border-blue-500"
                                    value={item.donePlots || 0}
                                    tooltipText={`Còn lại ${maxAgriPlots} thửa`}
                                    onChange={(val) => {
                                      const nextItems = [...roundItems];
                                      nextItems[itemIdx] = { ...nextItems[itemIdx], donePlots: Math.min(val, maxAgriPlots) };
                                      const nextRounds = [...roundsList];
                                      nextRounds[idx] = { ...nextRounds[idx], items: nextItems };
                                      if (itemIdx === 0) {
                                        nextRounds[idx] = {
                                          ...nextRounds[idx],
                                          donePlots: Math.min(val, maxAgriPlots),
                                          items: nextItems,
                                        };
                                      }
                                      updateStepStatus(project.id, stepKey, { ...inv, rounds: nextRounds });
                                    }}
                                  />
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[10px] text-slate-500 font-bold whitespace-nowrap">Số hộ đại diện:</span>
                                  <NumberInput
                                    readOnly={!canEdit}
                                    className="w-16 h-7 text-center bg-slate-50 border border-slate-200 rounded text-xs font-bold font-mono outline-none focus:border-blue-500"
                                    value={item.doneHouseholds || 0}
                                    tooltipText={`Còn lại ${maxAgriHH} hộ`}
                                    onChange={(val) => {
                                      const nextItems = [...roundItems];
                                      nextItems[itemIdx] = { ...nextItems[itemIdx], doneHouseholds: Math.min(val, maxAgriHH) };
                                      const nextRounds = [...roundsList];
                                      nextRounds[idx] = { ...nextRounds[idx], items: nextItems };
                                      if (itemIdx === 0) {
                                        nextRounds[idx] = {
                                          ...nextRounds[idx],
                                          doneHouseholds: Math.min(val, maxAgriHH),
                                          items: nextItems,
                                        };
                                      }
                                      updateStepStatus(project.id, stepKey, { ...inv, rounds: nextRounds });
                                    }}
                                  />
                                </div>
                              </>
                            )}

                            {item.targetType === "non_agri" && (
                              <>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[10px] text-slate-500 font-bold whitespace-nowrap">Số thửa:</span>
                                  <NumberInput
                                    readOnly={!canEdit}
                                    className="w-16 h-7 text-center bg-slate-50 border border-slate-200 rounded text-xs font-bold font-mono outline-none focus:border-blue-500"
                                    value={item.donePlots || 0}
                                    tooltipText={`Còn lại ${maxNonAgriPlots} thửa`}
                                    onChange={(val) => {
                                      const nextItems = [...roundItems];
                                      nextItems[itemIdx] = { ...nextItems[itemIdx], donePlots: Math.min(val, maxNonAgriPlots) };
                                      const nextRounds = [...roundsList];
                                      nextRounds[idx] = { ...nextRounds[idx], items: nextItems };
                                      if (itemIdx === 0) {
                                        nextRounds[idx] = {
                                          ...nextRounds[idx],
                                          donePlots: Math.min(val, maxNonAgriPlots),
                                          items: nextItems,
                                        };
                                      }
                                      updateStepStatus(project.id, stepKey, { ...inv, rounds: nextRounds });
                                    }}
                                  />
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[10px] text-slate-500 font-bold whitespace-nowrap">Số hộ đại diện:</span>
                                  <NumberInput
                                    readOnly={!canEdit}
                                    className="w-16 h-7 text-center bg-slate-50 border border-slate-200 rounded text-xs font-bold font-mono outline-none focus:border-blue-500"
                                    value={item.doneHouseholds || 0}
                                    tooltipText={`Còn lại ${maxNonAgriHH} hộ`}
                                    onChange={(val) => {
                                      const nextItems = [...roundItems];
                                      nextItems[itemIdx] = { ...nextItems[itemIdx], doneHouseholds: Math.min(val, maxNonAgriHH) };
                                      const nextRounds = [...roundsList];
                                      nextRounds[idx] = { ...nextRounds[idx], items: nextItems };
                                      if (itemIdx === 0) {
                                        nextRounds[idx] = {
                                          ...nextRounds[idx],
                                          doneHouseholds: Math.min(val, maxNonAgriHH),
                                          items: nextItems,
                                        };
                                      }
                                      updateStepStatus(project.id, stepKey, { ...inv, rounds: nextRounds });
                                    }}
                                  />
                                </div>
                              </>
                            )}

                            {item.targetType === "org" && (
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] text-slate-500 font-bold whitespace-nowrap font-sans">Số tổ chức:</span>
                                <NumberInput
                                  readOnly={!canEdit}
                                  className="w-16 h-7 text-center bg-slate-50 border border-slate-200 focus:border-blue-500 rounded text-xs font-bold font-mono outline-none"
                                  value={item.doneOrgs || 0}
                                  tooltipText={`Còn lại ${maxOrgs} tổ chức`}
                                  onChange={(val) => {
                                    const nextItems = [...roundItems];
                                    nextItems[itemIdx] = { ...nextItems[itemIdx], doneOrgs: Math.min(val, maxOrgs) };
                                    const nextRounds = [...roundsList];
                                    nextRounds[idx] = { ...nextRounds[idx], items: nextItems };
                                    if (itemIdx === 0) {
                                      nextRounds[idx] = {
                                        ...nextRounds[idx],
                                        doneOrgs: Math.min(val, maxOrgs),
                                        items: nextItems,
                                      };
                                    }
                                    updateStepStatus(project.id, stepKey, { ...inv, rounds: nextRounds });
                                  }}
                                />
                              </div>
                            )}

                            {item.targetType === "assets" && (
                              <div className="flex flex-col gap-2.5 w-full mt-1">
                                <div className="flex items-center gap-1.5 pl-0.5">
                                  <span className="text-[10px] text-slate-500 font-bold whitespace-nowrap">Số hộ di dời, tài sản:</span>
                                  <NumberInput
                                    readOnly={!canEdit}
                                    className="w-16 h-7 text-center bg-slate-50 border border-slate-200 rounded text-xs font-bold font-mono outline-none focus:border-blue-500"
                                    value={item.doneHouseholds || 0}
                                    tooltipText={`Còn lại ${maxAssetHH} hộ`}
                                    onChange={(val) => {
                                      const nextItems = [...roundItems];
                                      nextItems[itemIdx] = { ...nextItems[itemIdx], doneHouseholds: Math.min(val, maxAssetHH) };
                                      const nextRounds = [...roundsList];
                                      nextRounds[idx] = { ...nextRounds[idx], items: nextItems };
                                      if (itemIdx === 0) {
                                        nextRounds[idx] = {
                                          ...nextRounds[idx],
                                          doneHouseholds: Math.min(val, maxAssetHH),
                                          items: nextItems,
                                        };
                                      }
                                      updateStepStatus(project.id, stepKey, { ...inv, rounds: nextRounds });
                                    }}
                                  />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 bg-slate-50/75 p-3.5 rounded-2xl border border-slate-200/60 shadow-3xs">
                                  {assetItems.map((assetConfig) => {
                                    const valInRound = item[assetConfig.id] !== undefined ? item[assetConfig.id] : 0;
                                    const otherAssetRounds = otherItems.filter((r: any) => r.targetType === "assets");
                                    const otherAssetSummary = otherAssetRounds.reduce(
                                      (acc: number, r: any) => Number(acc) + Number(Number(r[assetConfig.id]) || 0),
                                      0
                                    );
                                    const maxAssetLeft = Math.max(0, assetConfig.value - otherAssetSummary);

                                    return (
                                      <div key={assetConfig.id} className="flex items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 hover:border-slate-350 transition-all duration-200 shadow-3xs">
                                        <span className="text-[10px] font-bold text-slate-500 truncate">{assetConfig.label}</span>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                          <NumberInput
                                            readOnly={!canEdit}
                                            className="w-14 h-7 text-center bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold font-mono outline-none focus:border-blue-500 transition-colors"
                                            value={valInRound}
                                            tooltipText={`Còn lại ${maxAssetLeft} ${assetConfig.label.toLowerCase()}`}
                                            onChange={(val) => {
                                              const finalVal = Math.min(val, maxAssetLeft);
                                              const nextItems = [...roundItems];
                                              nextItems[itemIdx] = {
                                                ...nextItems[itemIdx],
                                                [assetConfig.id]: finalVal,
                                                [`done${assetConfig.id.charAt(0).toUpperCase()}${assetConfig.id.substring(1)}`]: finalVal,
                                              };
                                              const nextRounds = [...roundsList];
                                              nextRounds[idx] = { ...nextRounds[idx], items: nextItems };
                                              if (itemIdx === 0) {
                                                nextRounds[idx] = {
                                                  ...nextRounds[idx],
                                                  [assetConfig.id]: finalVal,
                                                  [`done${assetConfig.id.charAt(0).toUpperCase()}${assetConfig.id.substring(1)}`]: finalVal,
                                                  items: nextItems,
                                                };
                                              }
                                              updateStepStatus(project.id, stepKey, { ...inv, rounds: nextRounds });
                                            }}
                                          />
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {canEdit && (
                      <button
                        onClick={() => {
                          const nextItems = [
                            ...roundItems,
                            {
                              id: `custom_obj_${Math.random().toString(36).substring(2, 9)}`,
                              targetType: defaultInvType,
                              landType: "",
                              address: "",
                              donePlots: 0,
                              doneHouseholds: 0,
                              doneOrgs: 0,
                              doneGraves: 0,
                              doneAssets: 0,
                              doneStructures: 0,
                            },
                          ];
                          const nextRounds = [...roundsList];
                          nextRounds[idx] = { ...nextRounds[idx], items: nextItems };
                          updateStepStatus(project.id, stepKey, { ...inv, rounds: nextRounds });
                        }}
                        className="w-full py-1.5 border border-dashed border-slate-300 hover:border-slate-450 bg-white/40 hover:bg-white rounded-xl text-[10px] font-bold text-slate-600 flex items-center justify-center gap-1.5 cursor-pointer select-none transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" /> + Thêm lớp đối tượng kiểm đếm
                      </button>
                    )}
                  </div>
                </div>

                {/* Round notes */}
                <div className="grid grid-cols-1 gap-2.5">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[9px] font-extrabold text-slate-400 uppercase">Ghi chú đợt kiểm đếm</label>
                    <textarea
                      disabled={!canEdit}
                      value={round.notes || ""}
                      onChange={(e) => {
                        const newRounds = [...roundsList];
                        newRounds[idx] = { ...newRounds[idx], notes: e.target.value };
                        updateStepStatus(project.id, stepKey, { ...inv, rounds: newRounds });
                      }}
                      className="w-full text-slate-800 text-[11px] font-medium bg-white border border-slate-200 focus:border-blue-500 rounded-lg p-2 min-h-[50px] outline-none"
                      placeholder="Ghi nhận các nội dung phát sinh khác..."
                    />
                  </div>
                </div>

                {/* Obstacles & Tooltip indicator */}
                <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-slate-200/50 mt-1">
                  <div className="flex items-center gap-1.5 bg-white px-2 py-1 rounded border border-slate-200/60 font-sans">
                    <span className="text-[9px] font-extrabold text-slate-400 uppercase">Báo cáo vướng mắc:</span>
                    <input
                      type="checkbox"
                      disabled={!canEdit}
                      checked={!!round.hasObstacle}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        const newRounds = [...roundsList];
                        newRounds[idx] = {
                          ...newRounds[idx],
                          hasObstacle: checked,
                          obstacleInfo: checked ? (round.obstacleInfo || "") : "",
                        };
                        updateStepStatus(project.id, stepKey, { ...inv, rounds: newRounds });
                      }}
                      className="w-3.5 h-3.5 border-slate-300 rounded text-red-500 focus:ring-red-400"
                    />
                  </div>

                  {round.hasObstacle && (
                    <div className="flex-1 min-w-[200px]">
                      <EditableInput
                        readOnly={!canEdit}
                        className="text-[10px] font-bold text-red-650 bg-red-50/50 border border-red-250/20 hover:border-red-350 focus:border-red-500 outline-none w-full p-1.5 rounded-md placeholder:font-normal placeholder:italic placeholder:text-red-400"
                        value={round.obstacleInfo || ""}
                        onSave={(val) => {
                          const newRounds = [...roundsList];
                          newRounds[idx] = { ...newRounds[idx], obstacleInfo: val };
                          updateStepStatus(project.id, stepKey, { ...inv, rounds: newRounds });
                        }}
                        placeholder="Nội dung vướng mắc, khó khăn xử lý..."
                      />
                    </div>
                  )}

                  {!round.hasObstacle && round.obstacleInfo && (
                    <div className="relative group/tooltip">
                      <div className="inline-flex items-center gap-1 text-[9px] font-extrabold text-indigo-650 bg-indigo-50 hover:bg-indigo-100/80 border border-indigo-200 px-2 py-1 rounded-md cursor-help transition-colors select-none">
                        <LinkIcon className="w-2.5 h-2.5" /> G.Q Vướng Mắc
                      </div>
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 bg-slate-900 text-white rounded-lg p-2.5 shadow-xl border border-slate-800 pointer-events-none invisible group-hover/tooltip:visible opacity-0 group-hover/tooltip:opacity-100 transition-all duration-200 text-[11px] font-normal z-50">
                        <div className="font-extrabold text-amber-400 mb-1 flex items-center gap-1 uppercase tracking-wider text-[9px]">
                          <AlertCircle className="w-3 h-3 text-amber-400" /> Xuất phát từ vướng mắc
                        </div>
                        <p className="text-slate-200 leading-relaxed font-sans">{round.obstacleInfo}</p>
                        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-[4px] border-transparent border-t-slate-900" />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
