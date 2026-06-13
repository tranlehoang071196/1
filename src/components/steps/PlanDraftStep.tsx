import React, { useState, useRef, useEffect } from "react";
import { Trash2, Layers, X, ChevronDown, Plus } from "lucide-react";
import { Project } from "../../types";
import { CustomDatePicker, NumberInput, CurrencyInput, EditableInput, Combobox } from "../ui-primitives";
import { updateStepStatus } from "../../lib/projectService";
import { formatCount, getFlattenedRounds } from "./stepUtils";
import { AGRI_LAND_TYPES, NON_AGRI_LAND_TYPES } from "../../lib/landTypes";

interface PlanDraftStepProps {
  project: Project;
  stepKey: string;
  stepData: any;
  canEdit: boolean;
}

export const PlanDraftStep: React.FC<PlanDraftStepProps> = ({
  project,
  stepKey,
  stepData,
  canEdit,
}) => {
  const planDraftData = stepData as any;
  const roundsList = planDraftData?.rounds || [];
  
  const [planActiveRoundId, setPlanActiveRoundId] = useState<string>("");

  const invStep = project.steps?.inventory as any;
  const invRoundsRaw = invStep?.rounds || [];
  const flatRoundsListForAgg = getFlattenedRounds(invRoundsRaw);

  // Helper to extract flattened items list from plan draft rounds
  const getFlattenedPlanDraftRounds = (rounds: any[]) => {
    const list: any[] = [];
    rounds.forEach((r: any) => {
      const parentDate = r.date || "";
      const parentId = r.id || "";
      const parentAmount = r.amount || 0;
      const parentNotes = r.notes || "";
      const parentLinks = r.links || [];
      
      const itemsList = r.items && r.items.length > 0 ? r.items : [
        {
          id: "legacy",
          targetType: r.targetType || ( (r.agriPlots || r.agriHouseholds) ? "agri" : (r.nonAgriPlots || r.nonAgriHouseholds) ? "non_agri" : r.orgs ? "org" : "assets" ),
          landType: r.targetType === "agri" ? (r.selectedAgriLandType || (r.selectedAgriLandTypes && r.selectedAgriLandTypes[0]) || "") : (r.targetType === "non_agri" ? (r.selectedNonAgriLandType || (r.selectedNonAgriLandTypes && r.selectedNonAgriLandTypes[0]) || "") : ""),
          donePlots: r.targetType === "agri" ? r.agriPlots : (r.targetType === "non_agri" ? r.nonAgriPlots : 0),
          doneHouseholds: r.targetType === "agri" ? r.agriHouseholds : (r.targetType === "non_agri" ? r.nonAgriHouseholds : (r.targetType === "assets" ? r.assetHouseholds : 0)),
          doneOrgs: r.targetType === "org" ? r.orgs : 0,
          doneGraves: r[`asset_graves`] ?? r.graves ?? (r.targetType === "assets" ? r.doneGraves : 0),
          doneAssets: r[`asset_assets`] ?? r.assets ?? (r.targetType === "assets" ? r.doneAssets : 0),
          doneStructures: r[`asset_structures`] ?? r.structures ?? (r.targetType === "assets" ? r.doneStructures : 0),
        }
      ];

      itemsList.forEach((item: any) => {
        list.push({
          parentRoundId: parentId,
          date: parentDate,
          amount: parentAmount,
          notes: parentNotes,
          links: parentLinks,
          ...item,
          itemId: item.id
        });
      });
    });
    return list;
  };

  // Calculate ACTUAL DONE (inventoried/completed) numbers from inventory step rounds
  const invAgriRounds = flatRoundsListForAgg.filter(
    (r: any) => r.targetType === "agri",
  );
  const invNonAgriRounds = flatRoundsListForAgg.filter(
    (r: any) => r.targetType === "non_agri",
  );
  const invOrgRounds = flatRoundsListForAgg.filter(
    (r: any) => r.targetType === "org",
  );
  const invAssetRounds = flatRoundsListForAgg.filter(
    (r: any) => r.targetType === "assets",
  );

  const invDoneAgriPlots = invAgriRounds.reduce(
    (acc: number, r: any) => Number(acc) + Number(r.donePlots || 0),
    0,
  );
  const invDoneAgriHouseholds = invAgriRounds.reduce(
    (acc: number, r: any) => Number(acc) + Number(r.doneHouseholds || 0),
    0,
  );
  const invDoneNonAgriPlots = invNonAgriRounds.reduce(
    (acc: number, r: any) => Number(acc) + Number(r.donePlots || 0),
    0,
  );
  const invDoneNonAgriHouseholds = invNonAgriRounds.reduce(
    (acc: number, r: any) => Number(acc) + Number(r.doneHouseholds || 0),
    0,
  );
  const invDoneOrgs = invOrgRounds.reduce(
    (acc: number, r: any) => Number(acc) + Number(r.doneOrgs || 0),
    0,
  );
  const invDoneAssetHouseholds = invAssetRounds.reduce(
    (acc: number, r: any) => Number(acc) + Number(r.doneHouseholds || 0),
    0,
  );

  const assetItems = invStep?.assetItems || [
    {
      id: "graves",
      label: "ngôi mộ di dời",
      value:
        invStep?.graves !== undefined ? invStep.graves : 0,
    },
    {
      id: "assets",
      label: "Tài sản khác",
      value:
        invStep?.assets !== undefined ? invStep.assets : 0,
    },
  ];

  // Get total done counts for each asset item in inventory
  const invDoneAssetsMap: Record<string, number> = {};
  assetItems.forEach((item: any) => {
    const doneVal = invAssetRounds.reduce(
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
    invDoneAssetsMap[item.id] = doneVal;
  });

  const hasInvAgri =
    invDoneAgriPlots > 0 || invDoneAgriHouseholds > 0;
  const hasInvNonAgri =
    invDoneNonAgriPlots > 0 || invDoneNonAgriHouseholds > 0;
  const hasInvOrg = invDoneOrgs > 0;
  const hasInvAsset =
    invDoneAssetHouseholds > 0 ||
    Object.values(invDoneAssetsMap).some((v) => v > 0);

  const availableTypes: { value: string; label: string }[] =
    [];
  if (hasInvAgri)
    availableTypes.push({
      value: "agri",
      label: "🌾 Đất nông nghiệp",
    });
  if (hasInvNonAgri)
    availableTypes.push({
      value: "non_agri",
      label: "🏠 Đất phi nông nghiệp",
    });
  if (hasInvOrg)
    availableTypes.push({
      value: "org",
      label: "🏢 Tổ chức",
    });
  if (hasInvAsset)
    availableTypes.push({
      value: "assets",
      label: "📦 Tài sản khác",
    });

  const defaultTargetType =
    availableTypes[0]?.value || "agri";

  const configuredAgriCodes: string[] = (invStep?.agriTypes || [])
    .map((t: any) => (typeof t === "string" ? t : t.code || ""))
    .filter(Boolean);

  const agriOptions = AGRI_LAND_TYPES
    .filter((opt) => configuredAgriCodes.length === 0 || configuredAgriCodes.includes(opt.code))
    .map((opt) => ({
      value: opt.code,
      label: `${opt.code} - ${opt.name}`,
    }));

  const configuredNonAgriCodes: string[] = (invStep?.nonAgriTypes || [])
    .map((t: any) => (typeof t === "string" ? t : t.code || ""))
    .filter(Boolean);

  const nonAgriOptions = NON_AGRI_LAND_TYPES
    .filter((opt) => configuredNonAgriCodes.length === 0 || configuredNonAgriCodes.includes(opt.code))
    .map((opt) => ({
      value: opt.code,
      label: `${opt.code} - ${opt.name}`,
    }));

  // Calculate dynamic done values from plan_draft rounds using fallback to legacy targetType
  const getAgriPlots = (r: any) => {
    if (r.items && r.items.length > 0) {
      return r.items.filter((item: any) => item.targetType === "agri").reduce((sum: number, item: any) => Number(sum) + Number(item.donePlots || 0), 0);
    }
    return (r.agriPlots ?? (r.targetType === 'agri' ? r.donePlots : 0)) || 0;
  };
  const getAgriHH = (r: any) => {
    if (r.items && r.items.length > 0) {
      return r.items.filter((item: any) => item.targetType === "agri").reduce((sum: number, item: any) => Number(sum) + Number(item.doneHouseholds || 0), 0);
    }
    return (r.agriHouseholds ?? (r.targetType === 'agri' ? r.doneHouseholds : 0)) || 0;
  };
  const getNonAgriPlots = (r: any) => {
    if (r.items && r.items.length > 0) {
      return r.items.filter((item: any) => item.targetType === "non_agri").reduce((sum: number, item: any) => Number(sum) + Number(item.donePlots || 0), 0);
    }
    return (r.nonAgriPlots ?? (r.targetType === 'non_agri' ? r.donePlots : 0)) || 0;
  };
  const getNonAgriHH = (r: any) => {
    if (r.items && r.items.length > 0) {
      return r.items.filter((item: any) => item.targetType === "non_agri").reduce((sum: number, item: any) => Number(sum) + Number(item.doneHouseholds || 0), 0);
    }
    return (r.nonAgriHouseholds ?? (r.targetType === 'non_agri' ? r.doneHouseholds : 0)) || 0;
  };
  const getOrgsVal = (r: any) => {
    if (r.items && r.items.length > 0) {
      return r.items.filter((item: any) => item.targetType === "org").reduce((sum: number, item: any) => Number(sum) + Number(item.doneOrgs || 0), 0);
    }
    return (r.orgs ?? (r.targetType === 'org' ? r.doneOrgs : 0)) || 0;
  };
  const getAssetHH = (r: any) => {
    if (r.items && r.items.length > 0) {
      return r.items.filter((item: any) => item.targetType === "assets").reduce((sum: number, item: any) => Number(sum) + Number(item.doneHouseholds || 0), 0);
    }
    return (r.assetHouseholds ?? (r.targetType === 'assets' ? r.doneHouseholds : 0)) || 0;
  };

  const getInvAgriCompleted = (code: string) => {
    const matching = flatRoundsListForAgg.filter((it: any) => it.targetType === "agri" && it.landType === code);
    const plots = matching.reduce((sum: number, it: any) => Number(sum) + Number(it.donePlots || 0), 0);
    const households = matching.reduce((sum: number, it: any) => Number(sum) + Number(it.doneHouseholds || 0), 0);
    return { plots, households };
  };

  const getInvNonAgriCompleted = (code: string) => {
    const matching = flatRoundsListForAgg.filter((it: any) => it.targetType === "non_agri" && it.landType === code);
    const plots = matching.reduce((sum: number, it: any) => Number(sum) + Number(it.donePlots || 0), 0);
    const households = matching.reduce((sum: number, it: any) => Number(sum) + Number(it.doneHouseholds || 0), 0);
    return { plots, households };
  };

  const doneAgriPlots = roundsList.reduce((acc: number, r: any) => Number(acc) + Number(getAgriPlots(r)), 0);
  const doneAgriHouseholds = roundsList.reduce((acc: number, r: any) => Number(acc) + Number(getAgriHH(r)), 0);
  const doneNonAgriPlots = roundsList.reduce((acc: number, r: any) => Number(acc) + Number(getNonAgriPlots(r)), 0);
  const doneNonAgriHouseholds = roundsList.reduce((acc: number, r: any) => Number(acc) + Number(getNonAgriHH(r)), 0);
  const doneOrgs = roundsList.reduce((acc: number, r: any) => Number(acc) + Number(getOrgsVal(r)), 0);

  // Dynamic asset types done counts
  const assetDoneParts: string[] = [];

  assetItems.forEach((item) => {
    const doneVal = roundsList.reduce((acc: number, r: any) => {
      if (r.items && r.items.length > 0) {
        return acc + r.items.filter((it: any) => it.targetType === "assets").reduce((asSum: number, it: any) => Number(asSum) + Number(Number(it[item.id]) || Number(it[`done${item.id.charAt(0).toUpperCase()}${item.id.substring(1)}`]) || 0), 0);
      }
      const legacyAssetsVal = r.targetType === 'assets' ? 
        (item.id === "graves" ? r.doneGraves : item.id === "assets" ? r.doneAssets : item.id === "structures" ? r.doneStructures : 0) : 0;
      const rVal = r[`asset_${item.id}`] ?? (r[item.id] !== undefined ? r[item.id] : legacyAssetsVal);
      return Number(acc) + Number(Number(rVal) || 0);
    }, 0);

    const invCountVal = invDoneAssetsMap[item.id] || 0;
    if (doneVal > 0) {
      assetDoneParts.push(
        `${formatCount(doneVal)}/${formatCount(invCountVal)} ${item.label}`,
      );
    }
  });

  const doneAssetHouseholds = roundsList.reduce((acc: number, r: any) => Number(acc) + Number(getAssetHH(r)), 0);

  let assetProgressText = "";
  if (assetDoneParts.length > 0) {
    assetProgressText = assetDoneParts.join(", ");
    if (doneAssetHouseholds > 0) {
      assetProgressText += ` thuộc ${formatCount(doneAssetHouseholds)}/${formatCount(invDoneAssetHouseholds)} hộ`;
    }
  } else if (doneAssetHouseholds > 0) {
    assetProgressText = `tài sản thuộc ${formatCount(doneAssetHouseholds)}/${formatCount(invDoneAssetHouseholds)} hộ`;
  }

  // Calculate total compensation amount across all plan_draft rounds
  const totalAmount = roundsList.reduce(
    (acc: number, r: any) => Number(acc) + Number(r.amount || 0),
    0,
  );

  return (
    <div className="flex flex-col gap-5 mt-2 w-full">
      {/* Progress / Summary Dashboard similar to Inventory */}
      <div className="border border-slate-200/80 rounded-2xl bg-white overflow-hidden shadow-xs hover:shadow-sm transition-all duration-300">
        <div className="px-5 py-4 bg-gradient-to-r from-slate-50 to-slate-100/50 border-b border-slate-100">
          <span className="text-[12px] font-black text-slate-705 uppercase tracking-wider block font-sans">
            📊 Tổng quan tiến độ lập phương án bồi thường
          </span>
        </div>

        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-2 pl-3 border-l-2 border-blue-500 bg-blue-50/5 p-3 rounded-r-xl">
            <span className="text-[10px] font-black text-slate-400 uppercase block select-none tracking-wider mb-2">
              TIẾN ĐỘ THỰC HIỆN THEO ĐẤT KIỂM ĐẾM:
            </span>

            {hasInvAgri &&
              (doneAgriPlots > 0 || doneAgriHouseholds > 0 ? (
                <div className="text-[12px] text-slate-750 font-medium flex items-center gap-2 flex-wrap font-sans">
                  <span>
                    🌾{" "}
                    <span className="font-semibold text-slate-500">
                      Đất nông nghiệp:
                    </span>{" "}
                    <strong className="text-blue-700">
                      {formatCount(doneAgriPlots)}/
                      {formatCount(invDoneAgriPlots)} thửa
                      (thuộc {formatCount(doneAgriHouseholds)}
                      /{formatCount(invDoneAgriHouseholds)}{" "}
                      hộ)
                    </strong>
                  </span>
                  {invDoneAgriHouseholds > 0 && (
                    <span className="text-blue-600 font-bold text-[10px] bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                      {Math.round(
                        (doneAgriHouseholds /
                          invDoneAgriHouseholds) *
                          100,
                      )}
                      %
                    </span>
                  )}
                </div>
              ) : (
                <div className="text-[12px] text-slate-400 font-medium font-sans">
                  🌾 Chưa lập đợt đất nông nghiệp (Tổng:{" "}
                  {formatCount(invDoneAgriPlots)} thửa (thuộc{" "}
                  {formatCount(invDoneAgriHouseholds)} hộ))
                </div>
              ))}

            {hasInvNonAgri &&
              (doneNonAgriPlots > 0 ||
              doneNonAgriHouseholds > 0 ? (
                <div className="text-[12px] text-slate-755 font-medium flex items-center gap-2 flex-wrap font-sans">
                  <span>
                    🏠{" "}
                    <span className="font-semibold text-slate-500">
                      Đất phi nông nghiệp:
                    </span>{" "}
                    <strong className="text-blue-700">
                      {formatCount(doneNonAgriPlots)}/
                      {formatCount(invDoneNonAgriPlots)} thửa
                      (thuộc{" "}
                      {formatCount(doneNonAgriHouseholds)}/
                      {formatCount(invDoneNonAgriHouseholds)}{" "}
                      hộ)
                    </strong>
                  </span>
                  {invDoneNonAgriHouseholds > 0 && (
                    <span className="text-blue-600 font-bold text-[10px] bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                      {Math.round(
                        (doneNonAgriHouseholds /
                          invDoneNonAgriHouseholds) *
                          100,
                      )}
                      %
                    </span>
                  )}
                </div>
              ) : (
                <div className="text-[12px] text-slate-400 font-medium font-sans">
                  🏠 Chưa lập đợt đất phi nông nghiệp (Tổng:{" "}
                  {formatCount(invDoneNonAgriPlots)} thửa
                  (thuộc{" "}
                  {formatCount(invDoneNonAgriHouseholds)} hộ))
                </div>
              ))}

            {hasInvOrg &&
              (doneOrgs > 0 ? (
                <div className="text-[12px] text-slate-755 font-medium flex items-center gap-2 flex-wrap font-sans">
                  <span>
                    🏢{" "}
                    <span className="font-semibold text-slate-500">
                      Tổ chức:
                    </span>{" "}
                    <strong className="text-blue-700">
                      {formatCount(doneOrgs)}/
                      {formatCount(invDoneOrgs)} tổ chức
                    </strong>
                  </span>
                  {invDoneOrgs > 0 && (
                    <span className="text-blue-600 font-bold text-[10px] bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                      {Math.round(
                        (doneOrgs / invDoneOrgs) * 100,
                      )}
                      %
                    </span>
                  )}
                </div>
              ) : (
                <div className="text-[12px] text-slate-400 font-medium font-sans">
                  🏢 Chưa lập đợt tổ chức (Tổng:{" "}
                  {formatCount(invDoneOrgs)} tổ chức)
                </div>
              ))}

            {hasInvAsset &&
              (assetProgressText ? (
                <div className="text-[12px] text-slate-755 font-medium flex items-center gap-2 flex-wrap font-sans">
                  <span>
                    📦{" "}
                    <span className="font-semibold text-slate-500">
                      Tài sản khác:
                    </span>{" "}
                    <strong className="text-blue-700">
                      {assetProgressText}
                    </strong>
                  </span>
                  {invDoneAssetHouseholds > 0 &&
                    doneAssetHouseholds > 0 && (
                      <span className="text-blue-600 font-bold text-[10px] bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                        {Math.round(
                          (doneAssetHouseholds /
                            invDoneAssetHouseholds) *
                            100,
                        )}
                        %
                      </span>
                    )}
                </div>
              ) : (
                <div className="text-[12px] text-slate-400 font-medium font-sans">
                  📦 Chưa lập đợt tài sản (Tổng:{" "}
                  {formatCount(invDoneAssetHouseholds)} hộ)
                </div>
              ))}

            {!hasInvAgri &&
              !hasInvNonAgri &&
              !hasInvOrg &&
              !hasInvAsset && (
                <div className="text-[12px] text-slate-400 italic font-sans animate-pulse">
                  Chưa ghi nhận đối tượng đã kiểm đếm để lập
                  phương án
                </div>
              )}
          </div>

          {/* Premium Financial Box styled like mockup */}
          <div className="bg-gradient-to-br from-emerald-500/10 via-emerald-50/10 to-teal-500/5 rounded-2xl p-5 border border-emerald-150 shadow-2xs hover:shadow-xs transition-all duration-300 flex flex-col justify-between">
            <span className="text-[10px] font-black text-emerald-650 uppercase tracking-widest block mb-2 select-none">
              💰 TỔNG KINH PHÍ BỒI THƯỜNG DỰ KIẾN (TẤT CẢ CÁC ĐỢT)
            </span>
            <div className="mt-2 text-2xl font-black text-emerald-700 flex items-baseline font-mono tracking-tight">
              {totalAmount.toLocaleString("vi-VN")}
              <span className="text-xs font-semibold text-emerald-500 ml-1.5">
                VND
              </span>
            </div>
            <div className="text-[9.5px] font-medium text-emerald-555 mt-2.5 bg-emerald-500/5 border border-emerald-500/10 py-1 px-2.5 rounded-lg">
              Số liệu tự động hệ thống hóa từ tất cả các quyết định bồi thường thực tế.
            </div>
          </div>
        </div>
      </div>

      {/* Sub-Rounds lists with uniform navigation tabs */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 select-none">
            <Layers className="w-4 h-4 text-slate-400" /> Chi tiết các đợt lập phương án thực tế
          </span>
          {canEdit && (
            <button
              onClick={() => {
                const current = planDraftData?.rounds || [];
                const newRoundId = Math.random().toString(36).substring(2, 11);
                const item = {
                  id: newRoundId,
                  date: "",
                  amount: 0,
                  notes: "",
                  items: [
                    {
                      id: `obj_${Math.random().toString(36).substring(2, 9)}`,
                      targetType: defaultTargetType,
                      landType: "",
                      donePlots: 0,
                      doneHouseholds: 0,
                      doneOrgs: 0,
                      doneGraves: 0,
                      doneAssets: 0,
                      doneStructures: 0,
                    }
                  ]
                };
                updateStepStatus(project.id, stepKey, {
                  ...planDraftData,
                  rounds: [...current, item],
                });
                setPlanActiveRoundId(newRoundId);
              }}
              className="text-[11px] font-bold text-blue-600 bg-blue-50/85 hover:bg-blue-100/95 px-3.5 py-1.5 rounded-xl border border-blue-200/60 shadow-2xs hover:shadow-xs transition-all duration-250 cursor-pointer select-none flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Thêm đợt lập phương án
            </button>
          )}
        </div>

        {/* Round Navigation Tabs matching InventoryStep - Premium Pill Container */}
        {roundsList.length > 0 && (
          <div className="p-1 rounded-2xl bg-slate-100/80 border border-slate-200/50 flex flex-wrap gap-1.5 mb-2 shadow-2xs">
            {roundsList.map((r: any, rIdx: number) => {
              const active = planActiveRoundId === r.id || (rIdx === 0 && !planActiveRoundId);
              return (
                <button
                  key={r.id || rIdx}
                  onClick={() => setPlanActiveRoundId(r.id)}
                  type="button"
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-bold tracking-wide transition-all duration-250 pointer cursor-pointer select-none ${
                    active
                      ? "bg-white text-blue-600 shadow-sm border border-slate-200/60 ring-1 ring-slate-100"
                      : "bg-transparent border border-transparent text-slate-500 hover:text-slate-800 hover:bg-white/50"
                  }`}
                >
                  <span className={`relative flex h-2 w-2 rounded-full ${active ? "bg-blue-500" : "bg-slate-300"}`}>
                    {active && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-60"></span>}
                  </span>
                  <span>ĐỢT {rIdx + 1}</span>
                  {r.date && (
                    <span className={`text-[9.5px] font-medium font-mono ${active ? "text-blue-500" : "text-slate-400"}`}>
                      ({r.date})
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        <div className="space-y-3.5 font-sans">
          {roundsList.map((round: any, idx: number) => {
            const isActive = planActiveRoundId === round.id || (idx === 0 && !planActiveRoundId);
            if (!isActive) return null;

            const otherRounds = roundsList.filter((_, rIdx: number) => rIdx !== idx);

            // Dynamically transform legacy format to structural row items inside active round
            const roundItems =
              round.items && round.items.length > 0
                ? round.items
                : (() => {
                    const list = [];
                    const activeTypesVal = Array.isArray(round.activeTypes) 
                      ? round.activeTypes 
                      : (() => {
                          const inferred: string[] = [];
                          const legacyAgriPlots = (round.agriPlots ?? (round.targetType === 'agri' ? round.donePlots : 0)) || 0;
                          const legacyAgriHH = (round.agriHouseholds ?? (round.targetType === 'agri' ? round.doneHouseholds : 0)) || 0;
                          if (legacyAgriPlots > 0 || legacyAgriHH > 0) inferred.push("agri");
                          
                          const legacyNonAgriPlots = (round.nonAgriPlots ?? (round.targetType === 'non_agri' ? round.donePlots : 0)) || 0;
                          const legacyNonAgriHH = (round.nonAgriHouseholds ?? (round.targetType === 'non_agri' ? round.doneHouseholds : 0)) || 0;
                          if (legacyNonAgriPlots > 0 || legacyNonAgriHH > 0) inferred.push("non_agri");
                          
                          const legacyOrgs = (round.orgs ?? (round.targetType === 'org' ? round.doneOrgs : 0)) || 0;
                          if (legacyOrgs > 0) inferred.push("org");
                          
                          const legacyAssetHH = (round.assetHouseholds ?? (round.targetType === 'assets' ? round.doneHouseholds : 0)) || 0;
                          const hasAssetCount = assetItems.some((item: any) => {
                            const legacyAssetsVal = round.targetType === 'assets' ? (item.id === "graves" ? round.doneGraves : item.id === "assets" ? round.doneAssets : item.id === "structures" ? round.doneStructures : 0) : 0;
                            const valInRound = round[`asset_${item.id}`] ?? (round[item.id] !== undefined ? round[item.id] : legacyAssetsVal);
                            return (valInRound || 0) > 0;
                          });
                          if (legacyAssetHH > 0 || hasAssetCount) inferred.push("assets");
                          
                          if (inferred.length === 0) inferred.push(defaultTargetType);
                          return inferred;
                        })();

                    activeTypesVal.forEach((typeVal: string) => {
                      if (typeVal === "agri") {
                        list.push({
                          id: `legacy_agri_${Math.random().toString(36).substring(2, 9)}`,
                          targetType: "agri",
                          landType: round.selectedAgriLandType || (round.selectedAgriLandTypes && round.selectedAgriLandTypes[0]) || "",
                          donePlots: (round.agriPlots ?? (round.targetType === 'agri' ? round.donePlots : 0)) || 0,
                          doneHouseholds: (round.agriHouseholds ?? (round.targetType === 'agri' ? round.doneHouseholds : 0)) || 0,
                        });
                      } else if (typeVal === "non_agri") {
                        list.push({
                          id: `legacy_nonagri_${Math.random().toString(36).substring(2, 9)}`,
                          targetType: "non_agri",
                          landType: round.selectedNonAgriLandType || (round.selectedNonAgriLandTypes && round.selectedNonAgriLandTypes[0]) || "",
                          donePlots: (round.nonAgriPlots ?? (round.targetType === 'non_agri' ? round.donePlots : 0)) || 0,
                          doneHouseholds: (round.nonAgriHouseholds ?? (round.targetType === 'non_agri' ? round.doneHouseholds : 0)) || 0,
                        });
                      } else if (typeVal === "org") {
                        list.push({
                          id: `legacy_org_${Math.random().toString(36).substring(2, 9)}`,
                          targetType: "org",
                          doneOrgs: (round.orgs ?? (round.targetType === 'org' ? round.doneOrgs : 0)) || 0,
                        });
                      } else if (typeVal === "assets") {
                        const itemObj: any = {
                          id: `legacy_assets_${Math.random().toString(36).substring(2, 9)}`,
                          targetType: "assets",
                          doneHouseholds: (round.assetHouseholds ?? (round.targetType === 'assets' ? round.doneHouseholds : 0)) || 0,
                        };
                        assetItems.forEach((it: any) => {
                          const legacyAssetsVal = round.targetType === 'assets' ? (it.id === "graves" ? round.doneGraves : it.id === "assets" ? round.doneAssets : it.id === "structures" ? round.doneStructures : 0) : 0;
                          const valInRound = round[`asset_${it.id}`] ?? round[it.id] ?? legacyAssetsVal ?? 0;
                          itemObj[it.id] = valInRound;
                        });
                        list.push(itemObj);
                      }
                    });
                    
                    if (list.length === 0) {
                      list.push({
                        id: `default_${Math.random().toString(36).substring(2, 9)}`,
                        targetType: defaultTargetType,
                        landType: "",
                        donePlots: 0,
                        doneHouseholds: 0,
                      });
                    }
                    return list;
                  })();

            return (
              <div
                key={round.id || idx}
                className="bg-white p-5 rounded-2xl border border-slate-200/80 border-l-4 border-l-blue-500 shadow-xs flex flex-col gap-4 animate-in fade-in duration-200"
              >
                {/* Header of Round Controls with exact visual styling */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-slate-200/60 font-sans">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-black text-blue-700 uppercase px-2 py-0.5 bg-blue-50 rounded border border-blue-100 shadow-2xs">
                      🎯 Đợt {formatCount(idx + 1)}
                    </span>
                    <span className="text-[11px] font-medium text-slate-550 font-sans">
                      {(() => {
                        const parts = [];
                        const ap = getAgriPlots(round); const ah = getAgriHH(round);
                        if (ap > 0 || ah > 0) {
                          const detailedTags = roundItems && roundItems.length > 0
                            ? roundItems.filter((it: any) => it.targetType === "agri" && it.landType).map((it: any) => it.landType)
                            : (round.selectedAgriLandTypes || (round.selectedAgriLandType ? [round.selectedAgriLandType] : []));
                          const detailedStr = detailedTags.length > 0 ? ` [${detailedTags.join(',')}]` : '';
                          parts.push(`NN: ${ap} thửa, ${ah} hộ${detailedStr}`);
                        }
                        const np = getNonAgriPlots(round); const nh = getNonAgriHH(round);
                        if (np > 0 || nh > 0) {
                          const detailedTags = roundItems && roundItems.length > 0
                            ? roundItems.filter((it: any) => it.targetType === "non_agri" && it.landType).map((it: any) => it.landType)
                            : (round.selectedNonAgriLandTypes || (round.selectedNonAgriLandType ? [round.selectedNonAgriLandType] : []));
                          const detailedStr = detailedTags.length > 0 ? ` [${detailedTags.join(',')}]` : '';
                          parts.push(`Phi NN: ${np} thửa, ${nh} hộ${detailedStr}`);
                        }
                        const o = getOrgsVal(round);
                        if (o > 0) parts.push(`TC: ${o}`);
                        const ash = getAssetHH(round);
                        if (ash > 0) parts.push(`Tài sản: ${ash} hộ`);
                        return parts.length > 0 ? `(${parts.join(' - ')})` : '';
                      })()}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-tighter">Ngày lập:</span>
                    <CustomDatePicker
                      value={round.date || ""}
                      onChange={(val) => {
                        const newRounds = [...roundsList];
                        newRounds[idx] = {
                          ...newRounds[idx],
                          date: val,
                        };
                        updateStepStatus(project.id, stepKey, {
                          ...planDraftData,
                          rounds: newRounds,
                        });
                      }}
                      readOnly={!canEdit}
                    />
                    {canEdit && (
                      <button
                        onClick={() => {
                          const newRounds = roundsList.filter(
                            (r: any) => r.id !== round.id,
                          );
                          updateStepStatus(project.id, stepKey, {
                            ...planDraftData,
                            rounds: newRounds,
                          });
                          if (newRounds.length > 0) {
                            setPlanActiveRoundId(newRounds[0].id);
                          }
                        }}
                        className="p-1 px-1.5 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded border border-transparent hover:border-red-100 cursor-pointer"
                        title="Xoá đợt này"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* List Objects in active round */}
                <div className="space-y-3 font-sans w-full">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block select-none">
                    🏡 Đối tượng trong đợt lập phương án:
                  </span>

                  <div className="space-y-2.5 w-full">
                    {roundItems.map((item: any, itemIdx: number) => {
                      const otherItems = roundItems.filter((_: any, i: number) => i !== itemIdx);
                      return (
                        <div
                          key={item.id || itemIdx}
                          className="bg-slate-50/45 hover:bg-slate-50/80 border border-slate-200/70 hover:border-slate-350 rounded-2xl p-4.5 shadow-2xs transition-all duration-200 flex flex-col gap-3.5"
                        >
                          {/* Subitem header element */}
                          <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-dashed border-slate-200/60">
                            <div className="flex flex-wrap items-center gap-4">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider whitespace-nowrap">
                                  Đối tượng:
                                </span>

                                {/* Class selection dropdown */}
                                <select
                                  disabled={!canEdit}
                                  value={item.targetType || "agri"}
                                  onChange={(e) => {
                                    const nextType = e.target.value;
                                    const nextItems = [...roundItems];
                                    nextItems[itemIdx] = {
                                      ...nextItems[itemIdx],
                                      targetType: nextType,
                                      landType: "",
                                      donePlots: 0,
                                      doneHouseholds: 0,
                                      doneOrgs: 0,
                                      doneGraves: 0,
                                      doneAssets: 0,
                                      doneStructures: 0,
                                    };
                                    const nextRounds = [...roundsList];
                                    nextRounds[idx] = { ...nextRounds[idx], items: nextItems };
                                    updateStepStatus(project.id, stepKey, { ...planDraftData, rounds: nextRounds });
                                  }}
                                  className="bg-white border border-slate-200 hover:border-slate-300 focus:border-blue-500 rounded-xl px-2.5 py-1 text-xs font-extrabold text-slate-800 outline-none font-sans shadow-3xs cursor-pointer"
                                >
                                  {availableTypes.map((t) => (
                                    <option key={t.value} value={t.value}>
                                      {t.label}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              {/* Land Type search picker */}
                              {(item.targetType === "agri" || item.targetType === "non_agri") && (
                                <div className="flex items-center gap-2 font-sans">
                                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider whitespace-nowrap">
                                    Loại đất:
                                  </span>
                                  <Combobox
                                    options={
                                      item.targetType === "agri"
                                        ? (configuredAgriCodes.length > 0
                                          ? AGRI_LAND_TYPES.filter((opt) => configuredAgriCodes.includes(opt.code))
                                          : AGRI_LAND_TYPES)
                                        : (configuredNonAgriCodes.length > 0
                                          ? NON_AGRI_LAND_TYPES.filter((opt) => configuredNonAgriCodes.includes(opt.code))
                                          : NON_AGRI_LAND_TYPES)
                                    }
                                    value={item.landType || ""}
                                    displayCodeOnly={true}
                                    disabled={!canEdit}
                                    placeholder="Tìm loại đất..."
                                    onChange={(c) => {
                                      const nextItems = [...roundItems];
                                      nextItems[itemIdx] = {
                                        ...nextItems[itemIdx],
                                        landType: c
                                      };
                                      const nextRounds = [...roundsList];
                                      nextRounds[idx] = { ...nextRounds[idx], items: nextItems };
                                      updateStepStatus(project.id, stepKey, { ...planDraftData, rounds: nextRounds });
                                    }}
                                  />
                                </div>
                              )}
                            </div>

                            {/* Remove action for a single item row */}
                            {canEdit && roundItems.length > 1 && (
                              <button
                                onClick={() => {
                                  const nextItems = roundItems.filter((_: any, i: number) => i !== itemIdx);
                                  const nextRounds = [...roundsList];
                                  nextRounds[idx] = { ...nextRounds[idx], items: nextItems };
                                  updateStepStatus(project.id, stepKey, { ...planDraftData, rounds: nextRounds });
                                }}
                                className="text-xs font-bold text-slate-400 hover:text-red-500 transition-colors flex items-center gap-1 cursor-pointer select-none"
                              >
                                <span>Gỡ đối tượng</span>
                              </button>
                            )}
                          </div>

                          {/* Specific target forms */}
                          <div className="flex flex-wrap items-center gap-3">
                            {item.targetType === "agri" && (() => {
                              const codeComp = getInvAgriCompleted(item.landType);
                              const limitAgriPlots = codeComp.plots > 0 ? codeComp.plots : invDoneAgriPlots;
                              const limitAgriHH = codeComp.households > 0 ? codeComp.households : invDoneAgriHouseholds;

                              const otherItemsList = getFlattenedPlanDraftRounds(otherRounds).concat(
                                otherItems.map((ot: any) => ({ ...ot, parentRoundId: round.id }))
                              );
                              const matchingOther = otherItemsList.filter((it: any) => it.targetType === "agri" && it.landType === item.landType);
                              const sumOtherPlots = matchingOther.reduce((sum: number, it: any) => Number(sum) + Number(it.donePlots || 0), 0);
                              const sumOtherHH = matchingOther.reduce((sum: number, it: any) => Number(sum) + Number(it.doneHouseholds || 0), 0);

                              const maxAgriPlotsLeft = Math.max(0, limitAgriPlots - sumOtherPlots);
                              const maxAgriHHLeft = Math.max(0, limitAgriHH - sumOtherHH);

                              return (
                                <>
                                  <div className="flex items-center gap-1.5 font-sans">
                                    <span className="text-[10px] text-slate-500 font-bold whitespace-nowrap">Số thửa:</span>
                                    <NumberInput
                                      readOnly={!canEdit}
                                      className="w-16 h-7 text-center bg-slate-50 border border-slate-200 rounded text-xs font-bold font-mono outline-none focus:border-blue-500"
                                      value={item.donePlots || 0}
                                      tooltipText={`Còn lại ${maxAgriPlotsLeft} thửa`}
                                      onChange={(val) => {
                                        const nextItems = [...roundItems];
                                        nextItems[itemIdx] = { ...nextItems[itemIdx], donePlots: Math.min(val, maxAgriPlotsLeft) };
                                        const nextRounds = [...roundsList];
                                        nextRounds[idx] = { ...nextRounds[idx], items: nextItems };
                                        updateStepStatus(project.id, stepKey, { ...planDraftData, rounds: nextRounds });
                                      }}
                                    />
                                  </div>
                                  <div className="flex items-center gap-1.5 font-sans">
                                    <span className="text-[10px] text-slate-500 font-bold whitespace-nowrap">Số hộ đại diện:</span>
                                    <NumberInput
                                      readOnly={!canEdit}
                                      className="w-16 h-7 text-center bg-slate-50 border border-slate-200 rounded text-xs font-bold font-mono outline-none focus:border-blue-500"
                                      value={item.doneHouseholds || 0}
                                      tooltipText={`Còn lại ${maxAgriHHLeft} hộ`}
                                      onChange={(val) => {
                                        const nextItems = [...roundItems];
                                        nextItems[itemIdx] = { ...nextItems[itemIdx], doneHouseholds: Math.min(val, maxAgriHHLeft) };
                                        const nextRounds = [...roundsList];
                                        nextRounds[idx] = { ...nextRounds[idx], items: nextItems };
                                        updateStepStatus(project.id, stepKey, { ...planDraftData, rounds: nextRounds });
                                      }}
                                    />
                                  </div>
                                </>
                              );
                            })()}

                            {item.targetType === "non_agri" && (() => {
                              const codeCompNon = getInvNonAgriCompleted(item.landType);
                              const limitNonAgriPlots = codeCompNon.plots > 0 ? codeCompNon.plots : invDoneNonAgriPlots;
                              const limitNonAgriHH = codeCompNon.households > 0 ? codeCompNon.households : invDoneNonAgriHouseholds;

                              const otherItemsList = getFlattenedPlanDraftRounds(otherRounds).concat(
                                otherItems.map((ot: any) => ({ ...ot, parentRoundId: round.id }))
                              );
                              const matchingOther = otherItemsList.filter((it: any) => it.targetType === "non_agri" && it.landType === item.landType);
                              const sumOtherPlots = matchingOther.reduce((sum: number, it: any) => Number(sum) + Number(it.donePlots || 0), 0);
                              const sumOtherHH = matchingOther.reduce((sum: number, it: any) => Number(sum) + Number(it.doneHouseholds || 0), 0);

                              const maxNonAgriPlotsLeft = Math.max(0, limitNonAgriPlots - sumOtherPlots);
                              const maxNonAgriHHLeft = Math.max(0, limitNonAgriHH - sumOtherHH);

                              return (
                                <>
                                  <div className="flex items-center gap-1.5 font-sans">
                                    <span className="text-[10px] text-slate-500 font-bold whitespace-nowrap">Số thửa:</span>
                                    <NumberInput
                                      readOnly={!canEdit}
                                      className="w-16 h-7 text-center bg-slate-50 border border-slate-200 rounded text-xs font-bold font-mono outline-none focus:border-blue-500"
                                      value={item.donePlots || 0}
                                      tooltipText={`Còn lại ${maxNonAgriPlotsLeft} thửa`}
                                      onChange={(val) => {
                                        const nextItems = [...roundItems];
                                        nextItems[itemIdx] = { ...nextItems[itemIdx], donePlots: Math.min(val, maxNonAgriPlotsLeft) };
                                        const nextRounds = [...roundsList];
                                        nextRounds[idx] = { ...nextRounds[idx], items: nextItems };
                                        updateStepStatus(project.id, stepKey, { ...planDraftData, rounds: nextRounds });
                                      }}
                                    />
                                  </div>
                                  <div className="flex items-center gap-1.5 font-sans">
                                    <span className="text-[10px] text-slate-500 font-bold whitespace-nowrap">Số hộ đại diện:</span>
                                    <NumberInput
                                      readOnly={!canEdit}
                                      className="w-16 h-7 text-center bg-slate-50 border border-slate-200 rounded text-xs font-bold font-mono outline-none focus:border-blue-500"
                                      value={item.doneHouseholds || 0}
                                      tooltipText={`Còn lại ${maxNonAgriHHLeft} hộ`}
                                      onChange={(val) => {
                                        const nextItems = [...roundItems];
                                        nextItems[itemIdx] = { ...nextItems[itemIdx], doneHouseholds: Math.min(val, maxNonAgriHHLeft) };
                                        const nextRounds = [...roundsList];
                                        nextRounds[idx] = { ...nextRounds[idx], items: nextItems };
                                        updateStepStatus(project.id, stepKey, { ...planDraftData, rounds: nextRounds });
                                      }}
                                    />
                                  </div>
                                </>
                              );
                            })()}

                            {item.targetType === "org" && (() => {
                              const otherItemsList = getFlattenedPlanDraftRounds(otherRounds).concat(
                                otherItems.map((ot: any) => ({ ...ot, parentRoundId: round.id }))
                              );
                              const sumOther = otherItemsList.filter((it: any) => it.targetType === "org").reduce((sum: number, it: any) => Number(sum) + Number(it.doneOrgs || 0), 0);
                              const maxOrgsLeft = Math.max(0, invDoneOrgs - sumOther);

                              return (
                                <div className="flex items-center gap-1.5 font-sans">
                                  <span className="text-[10px] text-slate-500 font-bold whitespace-nowrap">Số tổ chức:</span>
                                  <NumberInput
                                    readOnly={!canEdit}
                                    className="w-16 h-7 text-center bg-slate-50 border border-slate-200 rounded text-xs font-bold font-mono outline-none"
                                    value={item.doneOrgs || 0}
                                    tooltipText={`Còn lại ${maxOrgsLeft} tổ chức`}
                                    onChange={(val) => {
                                      const nextItems = [...roundItems];
                                      nextItems[itemIdx] = { ...nextItems[itemIdx], doneOrgs: Math.min(val, maxOrgsLeft) };
                                      const nextRounds = [...roundsList];
                                      nextRounds[idx] = { ...nextRounds[idx], items: nextItems };
                                      updateStepStatus(project.id, stepKey, { ...planDraftData, rounds: nextRounds });
                                    }}
                                  />
                                </div>
                              );
                            })()}

                            {item.targetType === "assets" && (() => {
                              const otherItemsList = getFlattenedPlanDraftRounds(otherRounds).concat(
                                otherItems.map((ot: any) => ({ ...ot, parentRoundId: round.id }))
                              );
                              const sumOtherHH = otherItemsList.filter((it: any) => it.targetType === "assets").reduce((sum: number, it: any) => Number(sum) + Number(it.doneHouseholds || 0), 0);
                              const maxAssetHHLeft = Math.max(0, invDoneAssetHouseholds - sumOtherHH);

                              return (
                                <div className="flex flex-col gap-2.5 w-full mt-1">
                                  <div className="flex items-center gap-1.5 pl-0.5 font-sans">
                                    <span className="text-[10px] text-slate-500 font-bold whitespace-nowrap">Số hộ chi trả tài sản:</span>
                                    <NumberInput
                                      readOnly={!canEdit}
                                      className="w-16 h-7 text-center bg-slate-50 border border-slate-200 rounded text-xs font-bold font-mono outline-none focus:border-blue-500"
                                      value={item.doneHouseholds || 0}
                                      tooltipText={`Còn lại ${maxAssetHHLeft} hộ`}
                                      onChange={(val) => {
                                        const nextItems = [...roundItems];
                                        nextItems[itemIdx] = { ...nextItems[itemIdx], doneHouseholds: Math.min(val, maxAssetHHLeft) };
                                        const nextRounds = [...roundsList];
                                        nextRounds[idx] = { ...nextRounds[idx], items: nextItems };
                                        updateStepStatus(project.id, stepKey, { ...planDraftData, rounds: nextRounds });
                                      }}
                                    />
                                  </div>

                                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 bg-slate-50/75 p-3.5 rounded-2xl border border-slate-200/60 shadow-3xs">
                                    {assetItems.map((assetConfig) => {
                                      const valInRound = item[assetConfig.id] !== undefined ? item[assetConfig.id] : 0;
                                      const otherAssetRounds = otherItemsList.filter((it: any) => it.targetType === "assets");
                                      const otherAssetSummary = otherAssetRounds.reduce(
                                        (asSum: number, it: any) => Number(asSum) + Number(Number(it[assetConfig.id]) || Number(it[`done${assetConfig.id.charAt(0).toUpperCase()}${assetConfig.id.substring(1)}`]) || 0),
                                        0
                                      );
                                      const maxAssetLeft = Math.max(0, (invDoneAssetsMap[assetConfig.id] || 0) - otherAssetSummary);

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
                                                updateStepStatus(project.id, stepKey, { ...planDraftData, rounds: nextRounds });
                                              }}
                                            />
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })()}
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
                              targetType: defaultTargetType,
                              landType: "",
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
                          updateStepStatus(project.id, stepKey, { ...planDraftData, rounds: nextRounds });
                        }}
                        className="w-full py-1.5 border border-dashed border-slate-300 hover:border-slate-450 bg-white/40 hover:bg-white rounded-xl text-[10px] font-bold text-slate-600 flex items-center justify-center gap-1.5 cursor-pointer select-none transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" /> + Thêm lớp đối tượng lập phương án
                      </button>
                    )}
                  </div>

                  {/* General Compensation Cost & Notes within active round */}
                  <div className="w-full flex flex-col md:flex-row md:items-center gap-3 border-t border-slate-200/50 pt-3.5 mt-2.5 font-sans">
                    <div className="flex items-center gap-2">
                      <span className="text-[9.5px] text-slate-400 font-extrabold uppercase whitespace-nowrap">
                        Tổng số tiền BT, HT đợt này:
                      </span>
                      <div className="flex items-center px-2 py-0.5 rounded border border-slate-200 bg-white max-w-xs shadow-xs h-8">
                        <CurrencyInput
                          readOnly={!canEdit}
                          className="w-28 text-right bg-transparent outline-none text-[10.5px] font-bold text-emerald-700 font-mono"
                          value={round.amount || 0}
                          onChange={(val) => {
                            const newRounds = [...roundsList];
                            newRounds[idx] = {
                              ...newRounds[idx],
                              amount: val,
                            };
                            updateStepStatus(project.id, stepKey, {
                              ...planDraftData,
                              rounds: newRounds,
                            });
                          }}
                        />
                        <span className="text-slate-400 ml-1 text-[9.5px]">đ</span>
                      </div>
                    </div>

                    <div className="flex-grow">
                      <EditableInput
                        placeholder="Ghi chú đợt lập phương án (xóm, tổ dân phố, hạng mục...)"
                        className="w-full bg-white border border-slate-200 rounded px-2.5 py-1.5 text-[10px] text-slate-705 outline-none placeholder-slate-400 font-semibold h-8"
                        value={round.notes || ""}
                        onSave={(val) => {
                          const newRounds = [...roundsList];
                          newRounds[idx] = {
                            ...newRounds[idx],
                            notes: val,
                          };
                          updateStepStatus(project.id, stepKey, {
                            ...planDraftData,
                            rounds: newRounds,
                          });
                        }}
                        readOnly={!canEdit}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};


