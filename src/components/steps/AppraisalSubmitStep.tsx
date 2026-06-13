import React, { useState } from "react";
import { Trash2, Layers, X, Plus } from "lucide-react";
import { Project } from "../../types";
import { CustomDatePicker, NumberInput, CurrencyInput, EditableInput } from "../ui-primitives";
import { updateStepStatus } from "../../lib/projectService";
import { formatCount, getFlattenedRounds } from "./stepUtils";
import { DocumentLinkList } from "../DocumentLinkList";
import { toast } from "sonner";

interface AppraisalSubmitStepProps {
  project: Project;
  stepKey: string;
  stepData: any;
  canEdit: boolean;
}

export const AppraisalSubmitStep: React.FC<AppraisalSubmitStepProps> = ({
  project,
  stepKey,
  stepData,
  canEdit,
}) => {
  const planDraftData = stepData as any;
  const roundsList = planDraftData?.rounds || [];
  const [activeRoundId, setActiveRoundId] = useState<string | null>(null);

  const invStep = project.steps?.inventory as any;
  const invRoundsRaw = invStep?.rounds || [];
  const invRounds = getFlattenedRounds(invRoundsRaw);

  // Calculate ACTUAL DONE (inventoried/completed) numbers from inventory step rounds
  const invAgriRounds = invRounds.filter(
    (r: any) => r.targetType === "agri",
  );
  const invNonAgriRounds = invRounds.filter(
    (r: any) => r.targetType === "non_agri",
  );
  const invOrgRounds = invRounds.filter(
    (r: any) => r.targetType === "org",
  );
  const invAssetRounds = invRounds.filter(
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

  // Calculate dynamic done values from rounds using fallback to legacy targetType
  const getAgriPlots = (r: any) => (r.agriPlots ?? (r.targetType === 'agri' ? r.donePlots : 0)) || 0;
  const getAgriHH = (r: any) => (r.agriHouseholds ?? (r.targetType === 'agri' ? r.doneHouseholds : 0)) || 0;
  const getNonAgriPlots = (r: any) => (r.nonAgriPlots ?? (r.targetType === 'non_agri' ? r.donePlots : 0)) || 0;
  const getNonAgriHH = (r: any) => (r.nonAgriHouseholds ?? (r.targetType === 'non_agri' ? r.doneHouseholds : 0)) || 0;
  const getOrgsVal = (r: any) => (r.orgs ?? (r.targetType === 'org' ? r.doneOrgs : 0)) || 0;
  const getAssetHH = (r: any) => (r.assetHouseholds ?? (r.targetType === 'assets' ? r.doneHouseholds : 0)) || 0;

  const doneAgriPlots = roundsList.reduce((acc: number, r: any) => Number(acc) + Number(getAgriPlots(r)), 0);
  const doneAgriHouseholds = roundsList.reduce((acc: number, r: any) => Number(acc) + Number(getAgriHH(r)), 0);
  const doneNonAgriPlots = roundsList.reduce((acc: number, r: any) => Number(acc) + Number(getNonAgriPlots(r)), 0);
  const doneNonAgriHouseholds = roundsList.reduce((acc: number, r: any) => Number(acc) + Number(getNonAgriHH(r)), 0);
  const doneOrgs = roundsList.reduce((acc: number, r: any) => Number(acc) + Number(getOrgsVal(r)), 0);

  // Dynamic asset types done counts
  const assetDoneParts: string[] = [];

  assetItems.forEach((item) => {
    const doneVal = roundsList.reduce((acc: number, r: any) => {
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

  // Calculate total compensation amount across all appraisal submit rounds
  const totalAmount = roundsList.reduce(
    (acc: number, r: any) => Number(acc) + Number(r.amount || 0),
    0,
  );

  // Calculate total cost across all appraisal submit rounds
  const totalCost = roundsList.reduce(
    (acc: number, r: any) => Number(acc) + Number(r.cost || 0),
    0,
  );

  const syncRoundTotals = (r: any) => {
    const p = (r.agriPlots || 0) + (r.nonAgriPlots || 0);
    const h =
      (r.agriHouseholds || 0) +
      (r.nonAgriHouseholds || 0) +
      (r.assetHouseholds || 0) +
      (r.orgs || 0);
    return {
      ...r,
      plots: p,
      households: h,
    };
  };

  const selectedRoundIndex = roundsList.findIndex((r: any) => r.id === activeRoundId);
  const currentActiveId = activeRoundId || roundsList[0]?.id;

  return (
    <div className="flex flex-col gap-5 mt-2 w-full">
      {/* Progress / Summary Dashboard */}
      <div className="border border-slate-200/80 rounded-2xl bg-white overflow-hidden shadow-xs hover:shadow-sm transition-all duration-300">
        <div className="px-5 py-4 bg-gradient-to-r from-slate-50 to-slate-100/50 border-b border-slate-100">
          <span className="text-[12px] font-black text-slate-705 uppercase tracking-wider block font-sans">
            📊 Tổng quan tiến độ trình thẩm định phương án bồi thường
          </span>
        </div>

        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-2 pl-3 border-l-2 border-indigo-500 bg-indigo-50/5 p-3 rounded-r-xl">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-2 select-none">
              ĐÃ TRÌNH THẨM ĐỊNH THEO CHỈ TIÊU:
            </span>

            {hasInvAgri &&
              (doneAgriPlots > 0 || doneAgriHouseholds > 0 ? (
                <div className="text-[12px] text-slate-755 font-medium flex items-center gap-2 flex-wrap font-sans">
                  <span>
                    🌾{" "}
                    <span className="font-semibold text-slate-500">
                      Đất nông nghiệp:
                    </span>{" "}
                    <strong className="text-indigo-700">
                      {formatCount(doneAgriPlots)}/
                      {formatCount(invDoneAgriPlots)} thửa
                      (thuộc {formatCount(doneAgriHouseholds)}
                      /{formatCount(invDoneAgriHouseholds)}{" "}
                      hộ)
                    </strong>
                  </span>
                  {invDoneAgriHouseholds > 0 && (
                    <span className="text-indigo-650 font-bold text-[10px] bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
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
                  🌾 Chưa lập phương án đất nông nghiệp (Tổng:{" "}
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
                    <strong className="text-indigo-700">
                      {formatCount(doneNonAgriPlots)}/
                      {formatCount(invDoneNonAgriPlots)} thửa
                      (thuộc {formatCount(doneNonAgriHouseholds)}
                      /{formatCount(invDoneNonAgriHouseholds)}{" "}
                      hộ)
                    </strong>
                  </span>
                  {invDoneNonAgriHouseholds > 0 && (
                    <span className="text-indigo-650 font-bold text-[10px] bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
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
                  🏠 Chưa lập phương án đất phi nông nghiệp (Tổng:{" "}
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
                    <strong className="text-indigo-700">
                      {formatCount(doneOrgs)}/
                      {formatCount(invDoneOrgs)} tổ chức
                    </strong>
                  </span>
                  {invDoneOrgs > 0 && (
                    <span className="text-indigo-650 font-bold text-[10px] bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                      {Math.round(
                        (doneOrgs / invDoneOrgs) * 100,
                      )}
                      %
                    </span>
                  )}
                </div>
              ) : (
                <div className="text-[12px] text-slate-400 font-medium font-sans">
                  🏢 Chưa lập phương án tổ chức (Tổng:{" "}
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
                    <strong className="text-indigo-700">
                      {assetProgressText}
                    </strong>
                  </span>
                  {invDoneAssetHouseholds > 0 &&
                    doneAssetHouseholds > 0 && (
                      <span className="text-indigo-650 font-bold text-[10px] bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
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
                  📦 Chưa lập phương án tài sản (Tổng:{" "}
                  {formatCount(invDoneAssetHouseholds)} hộ)
                </div>
              ))}

            {!hasInvAgri &&
              !hasInvNonAgri &&
              !hasInvOrg &&
              !hasInvAsset && (
                <div className="text-[12px] text-slate-400 italic font-sans animate-pulse">
                  Chưa ghi nhận đối tượng đã kiểm đếm để lập đợt
                </div>
              )}
          </div>

          <div className="grid grid-cols-2 gap-4 pb-1">
            {/* Box 1 */}
            <div className="bg-gradient-to-br from-emerald-500/10 via-emerald-50/10 to-teal-500/5 rounded-2xl p-4 border border-emerald-150 shadow-3xs flex flex-col justify-between">
              <span className="text-[9px] font-black text-emerald-650 uppercase tracking-wider select-none leading-tight">
                💰 Kinh phí bồi thường
              </span>
              <div className="mt-2 text-[17px] font-black text-emerald-700 flex items-baseline font-mono tracking-tight shrink-0">
                {totalAmount.toLocaleString("vi-VN")}
                <span className="text-[9px] font-semibold text-emerald-500 ml-1">
                  VND
                </span>
              </div>
            </div>

            {/* Box 2 */}
            <div className="bg-gradient-to-br from-blue-500/10 via-blue-50/10 to-indigo-55/5 rounded-2xl p-4 border border-blue-150 shadow-3xs flex flex-col justify-between">
              <span className="text-[9px] font-black text-blue-650 uppercase tracking-wider select-none leading-tight">
                📊 Chi phí thẩm định (2%)
              </span>
              <div className="mt-2 text-[17px] font-black text-blue-700 flex items-baseline font-mono tracking-tight shrink-0">
                {totalCost.toLocaleString("vi-VN")}
                <span className="text-[9px] font-semibold text-blue-500 ml-1">
                  VND
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* List of Rounds */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <span className="text-[11px] font-black text-slate-505 uppercase tracking-widest flex items-center gap-2 select-none">
            <Layers className="w-4 h-4 text-slate-400" /> Các đợt trình thẩm định phương án thực tế
          </span>
          {canEdit && (
            <button
              onClick={() => {
                const current = planDraftData?.rounds || [];
                const newRoundId = Math.random()
                  .toString(36)
                  .substring(2, 11);
                const item = {
                  id: newRoundId,
                  targetType: defaultTargetType,
                  date: "",
                  donePlots: 0,
                  doneHouseholds: 0,
                  doneOrgs: 0,
                  doneGraves: 0,
                  doneAssets: 0,
                  doneStructures: 0,
                  amount: 0,
                  cost: 0,
                  notes: "",
                  links: [],
                  plots: 0,
                  households: 0,
                };
                updateStepStatus(project.id, stepKey, {
                  ...planDraftData,
                  rounds: [...current, item],
                });
                setActiveRoundId(newRoundId);
              }}
              className="text-[11px] font-bold text-blue-600 bg-blue-50/85 hover:bg-blue-100/95 px-3.5 py-1.5 rounded-xl border border-blue-200/60 shadow-2xs hover:shadow-xs transition-all duration-250 cursor-pointer select-none flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Thêm đợt trình thẩm định
            </button>
          )}
        </div>

        {/* Premium Pill Container for switching between Submitted Appraisal Rounds */}
        {roundsList.length > 0 && (
          <div className="p-1 rounded-2xl bg-slate-100/80 border border-slate-200/50 flex flex-wrap gap-1.5 mb-2 shadow-2xs">
            {roundsList.map((r: any, rIdx: number) => {
              const active = r.id === currentActiveId;
              return (
                <button
                  key={r.id || rIdx}
                  onClick={() => setActiveRoundId(r.id)}
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

        <div className="space-y-4 animate-in fade-in duration-300">
          {roundsList
            .filter((round: any) => round.id === currentActiveId)
            .map((round: any) => {
              const idx = roundsList.indexOf(round);
              const otherRounds = roundsList.filter((_, rIdx: number) => rIdx !== idx);

              const sumOtherAgriPlots = otherRounds.reduce((acc: number, r: any) => Number(acc) + Number(getAgriPlots(r)), 0);
              const sumOtherAgriHH = otherRounds.reduce((acc: number, r: any) => Number(acc) + Number(getAgriHH(r)), 0);
              const maxAgriPlots = Math.max(0, invDoneAgriPlots - sumOtherAgriPlots);
              const maxAgriHH = Math.max(0, invDoneAgriHouseholds - sumOtherAgriHH);

              const sumOtherNonAgriPlots = otherRounds.reduce((acc: number, r: any) => Number(acc) + Number(getNonAgriPlots(r)), 0);
              const sumOtherNonAgriHH = otherRounds.reduce((acc: number, r: any) => Number(acc) + Number(getNonAgriHH(r)), 0);
              const maxNonAgriPlots = Math.max(0, invDoneNonAgriPlots - sumOtherNonAgriPlots);
              const maxNonAgriHH = Math.max(0, invDoneNonAgriHouseholds - sumOtherNonAgriHH);

              const sumOtherOrgs = otherRounds.reduce((acc: number, r: any) => Number(acc) + Number(getOrgsVal(r)), 0);
              const maxOrgs = Math.max(0, invDoneOrgs - sumOtherOrgs);

              const sumOtherAssetHH = otherRounds.reduce((acc: number, r: any) => Number(acc) + Number(getAssetHH(r)), 0);
              const maxAssetHH = Math.max(0, invDoneAssetHouseholds - sumOtherAssetHH);

              return (
                <div
                  key={round.id || idx}
                  className="bg-white p-5 rounded-2xl border border-slate-200/80 border-l-4 border-l-blue-500 shadow-xs flex flex-col gap-4 transition-all hover:shadow-sm"
                >
                {/* Header of Round */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-slate-100 font-sans">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-black text-slate-455 uppercase">
                      Đợt {formatCount(idx + 1)}
                    </span>
                    <span className="text-[11px] font-medium text-slate-500">
                      {(() => {
                        const parts = [];
                        const ap = getAgriPlots(round); const ah = getAgriHH(round);
                        if (ap > 0 || ah > 0) parts.push(`NN: ${ap} thửa, ${ah} hộ`);
                        const np = getNonAgriPlots(round); const nh = getNonAgriHH(round);
                        if (np > 0 || nh > 0) parts.push(`Phi NN: ${np} thửa, ${nh} hộ`);
                        const o = getOrgsVal(round); if (o > 0) parts.push(`TC: ${o}`);
                        const ash = getAssetHH(round); if (ash > 0) parts.push(`Tài sản: ${ash} hộ`);
                        return parts.length > 0 ? `(${parts.join(" - ")})` : "";
                      })()}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-tighter">
                      Ngày gửi phương án:
                    </span>
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
                        }}
                        className="p-1 px-1.5 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded border border-transparent hover:border-red-100"
                        title="Xoá đợt này"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Inputs list based on available inventory */}
                <div className="w-full space-y-3 bg-slate-50/75 p-3.5 rounded-2xl border border-slate-200/65 shadow-3xs">
                  {(() => {
                    const activeTypes = (() => {
                      if (Array.isArray(round.activeTypes)) {
                        return round.activeTypes;
                      }
                      const inferred: string[] = [];
                      if (getAgriPlots(round) > 0 || getAgriHH(round) > 0) inferred.push("agri");
                      if (getNonAgriPlots(round) > 0 || getNonAgriHH(round) > 0) inferred.push("non_agri");
                      if (getOrgsVal(round) > 0) inferred.push("org");

                      const hasAssetCount = assetItems.some((item: any) => {
                        const legacyAssetsVal = round.targetType === 'assets' ? (item.id === "graves" ? round.doneGraves : item.id === "assets" ? round.doneAssets : item.id === "structures" ? round.doneStructures : 0) : 0;
                        const valInRound = round[`asset_${item.id}`] ?? (round[item.id] !== undefined ? round[item.id] : legacyAssetsVal);
                        return (valInRound || 0) > 0;
                      });
                      if (getAssetHH(round) > 0 || hasAssetCount) inferred.push("assets");

                      if (inferred.length === 0 && availableTypes.length > 0) {
                        inferred.push(availableTypes[0].value);
                      }
                      return inferred;
                    })();

                    return (
                      <>
                        {activeTypes.map((typeVal, typeIdx) => (
                          <div
                            key={`${typeVal}-${typeIdx}`}
                            className="flex flex-wrap items-center gap-3.5 bg-white p-3 rounded-2xl border border-slate-200 hover:border-slate-300 transition-all duration-200 shadow-3xs w-full relative group"
                          >
                            <div className="flex items-center gap-1.5 min-w-[170px]">
                              <select
                                disabled={!canEdit}
                                value={typeVal}
                                onChange={(e) => {
                                  const newType = e.target.value;
                                  const newRounds = [...roundsList];
                                  const oldActive = [...activeTypes];
                                  const oldType = oldActive[typeIdx];

                                  let roundCopy = { ...newRounds[idx] };
                                  if (oldType === "agri") {
                                    roundCopy.agriPlots = 0;
                                    roundCopy.agriHouseholds = 0;
                                  } else if (oldType === "non_agri") {
                                    roundCopy.nonAgriPlots = 0;
                                    roundCopy.nonAgriHouseholds = 0;
                                  } else if (oldType === "org") {
                                    roundCopy.orgs = 0;
                                  } else if (oldType === "assets") {
                                    roundCopy.assetHouseholds = 0;
                                    assetItems.forEach((item: any) => {
                                      roundCopy[`asset_${item.id}`] = 0;
                                      roundCopy[item.id] = 0;
                                    });
                                  }

                                  oldActive[typeIdx] = newType;
                                  roundCopy.activeTypes = oldActive;
                                  roundCopy = syncRoundTotals(roundCopy);
                                  newRounds[idx] = roundCopy;
                                  updateStepStatus(project.id, stepKey, {
                                    ...planDraftData,
                                    rounds: newRounds,
                                  });
                                }}
                                className="bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700 outline-none focus:border-blue-500 hover:bg-slate-100/50 uppercase tracking-tight min-w-[150px] font-sans h-8 cursor-pointer transition-all"
                              >
                                {availableTypes.map((t) => (
                                  <option
                                    key={t.value}
                                    value={t.value}
                                    disabled={
                                      activeTypes.includes(t.value) &&
                                      t.value !== typeVal
                                    }
                                  >
                                    {t.label.toUpperCase()}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {typeVal === "agri" && (
                              <div className="flex items-center gap-3.5">
                                <div className="flex items-center gap-1.5">
                                  <NumberInput
                                    className="w-16 h-8 text-center bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-blue-500 rounded-xl px-1.5 py-0.5 text-xs font-bold text-slate-800 outline-none focus:ring-4 focus:ring-blue-500/10 transition-all font-mono shadow-3xs"
                                    placeholder="Thửa"
                                    value={getAgriPlots(round)}
                                    tooltipText={`Còn lại ${maxAgriPlots} thửa`}
                                    onChange={(val) => {
                                      if (val > maxAgriPlots) {
                                        toast.warning(`Số thửa đất nông nghiệp trình thẩm định vượt quá số lượng đã kiểm đếm còn lại (${maxAgriPlots} thửa).`);
                                      }
                                      const clamped = Math.min(val, maxAgriPlots);
                                      const newRounds = [...roundsList];
                                      let roundCopy = { ...newRounds[idx], agriPlots: clamped };
                                      roundCopy = syncRoundTotals(roundCopy);
                                      newRounds[idx] = roundCopy;
                                      updateStepStatus(project.id, stepKey, {
                                        ...planDraftData,
                                        rounds: newRounds,
                                      });
                                    }}
                                    readOnly={!canEdit}
                                  />
                                  <span className="text-[10px] text-slate-500 whitespace-nowrap font-bold">
                                    (số thửa)
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <NumberInput
                                    className="w-16 h-8 text-center bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-blue-500 rounded-xl px-1.5 py-0.5 text-xs font-bold text-slate-800 outline-none focus:ring-4 focus:ring-blue-500/10 transition-all font-mono shadow-3xs"
                                    placeholder="Hộ"
                                    value={getAgriHH(round)}
                                    tooltipText={`Còn lại ${maxAgriHH} hộ`}
                                    onChange={(val) => {
                                      if (val > maxAgriHH) {
                                        toast.warning(`Số hộ đất nông nghiệp trình thẩm định vượt quá số lượng đã kiểm đếm còn lại (${maxAgriHH} hộ).`);
                                      }
                                      const clamped = Math.min(val, maxAgriHH);
                                      const newRounds = [...roundsList];
                                      let roundCopy = { ...newRounds[idx], agriHouseholds: clamped };
                                      roundCopy = syncRoundTotals(roundCopy);
                                      newRounds[idx] = roundCopy;
                                      updateStepStatus(project.id, stepKey, {
                                        ...planDraftData,
                                        rounds: newRounds,
                                      });
                                    }}
                                    readOnly={!canEdit}
                                  />
                                  <span className="text-[10px] text-slate-500 whitespace-nowrap font-bold">
                                    (số hộ)
                                  </span>
                                </div>
                              </div>
                            )}

                            {typeVal === "non_agri" && (
                              <div className="flex items-center gap-3.5">
                                <div className="flex items-center gap-1.5">
                                  <NumberInput
                                    className="w-16 h-8 text-center bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-blue-500 rounded-xl px-1.5 py-0.5 text-xs font-bold text-slate-800 outline-none focus:ring-4 focus:ring-blue-500/10 transition-all font-mono shadow-3xs"
                                    placeholder="Thửa"
                                    value={getNonAgriPlots(round)}
                                    tooltipText={`Còn lại ${maxNonAgriPlots} thửa`}
                                    onChange={(val) => {
                                      if (val > maxNonAgriPlots) {
                                        toast.warning(`Số thửa đất phi nông nghiệp trình thẩm định vượt quá số lượng đã kiểm đếm còn lại (${maxNonAgriPlots} thửa).`);
                                      }
                                      const clamped = Math.min(
                                        val,
                                        maxNonAgriPlots,
                                      );
                                      const newRounds = [...roundsList];
                                      let roundCopy = { ...newRounds[idx], nonAgriPlots: clamped };
                                      roundCopy = syncRoundTotals(roundCopy);
                                      newRounds[idx] = roundCopy;
                                      updateStepStatus(project.id, stepKey, {
                                        ...planDraftData,
                                        rounds: newRounds,
                                      });
                                    }}
                                    readOnly={!canEdit}
                                  />
                                  <span className="text-[10px] text-slate-500 whitespace-nowrap font-bold">
                                    (số thửa)
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <NumberInput
                                    className="w-16 h-8 text-center bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-blue-500 rounded-xl px-1.5 py-0.5 text-xs font-bold text-slate-800 outline-none focus:ring-4 focus:ring-blue-500/10 transition-all font-mono shadow-3xs"
                                    placeholder="Hộ"
                                    value={getNonAgriHH(round)}
                                    tooltipText={`Còn lại ${maxNonAgriHH} hộ`}
                                    onChange={(val) => {
                                      if (val > maxNonAgriHH) {
                                        toast.warning(`Số hộ đất phi nông nghiệp trình thẩm định vượt quá số lượng đã kiểm đếm còn lại (${maxNonAgriHH} hộ).`);
                                      }
                                      const clamped = Math.min(val, maxNonAgriHH);
                                      const newRounds = [...roundsList];
                                      let roundCopy = { ...newRounds[idx], nonAgriHouseholds: clamped };
                                      roundCopy = syncRoundTotals(roundCopy);
                                      newRounds[idx] = roundCopy;
                                      updateStepStatus(project.id, stepKey, {
                                        ...planDraftData,
                                        rounds: newRounds,
                                      });
                                    }}
                                    readOnly={!canEdit}
                                  />
                                  <span className="text-[10px] text-slate-500 whitespace-nowrap font-bold">
                                    (số hộ)
                                  </span>
                                </div>
                              </div>
                            )}

                            {typeVal === "org" && (
                              <div className="flex items-center gap-1.5">
                                <NumberInput
                                  className="w-16 h-8 text-center bg-slate-50 border border-slate-200 rounded-xl px-1.5 py-0.5 text-xs font-bold text-slate-800 outline-none focus:border-blue-500 hover:border-slate-300 focus:ring-4 focus:ring-blue-500/10 transition-all font-mono shadow-3xs"
                                  placeholder="TC"
                                  value={getOrgsVal(round)}
                                  tooltipText={`Còn lại ${maxOrgs} tổ chức`}
                                  onChange={(val) => {
                                    if (val > maxOrgs) {
                                      toast.warning(`Số tổ chức trình thẩm định vượt quá số lượng đã kiểm đếm còn lại (${maxOrgs} tổ chức).`);
                                    }
                                    const clamped = Math.min(val, maxOrgs);
                                    const newRounds = [...roundsList];
                                    let roundCopy = { ...newRounds[idx], orgs: clamped };
                                    roundCopy = syncRoundTotals(roundCopy);
                                    newRounds[idx] = roundCopy;
                                    updateStepStatus(project.id, stepKey, {
                                      ...planDraftData,
                                      rounds: newRounds,
                                    });
                                  }}
                                  readOnly={!canEdit}
                                />
                                <span className="text-[10px] text-slate-500 whitespace-nowrap -ml-0.5 font-sans">
                                  (số tổ chức)
                                </span>
                              </div>
                            )}

                            {typeVal === "assets" && (
                              <div className="flex flex-wrap items-center gap-3">
                                {assetItems.map((item: any) => {
                                  const legacyAssetsVal = round.targetType === 'assets' ? (item.id === "graves" ? round.doneGraves : item.id === "assets" ? round.doneAssets : item.id === "structures" ? round.doneStructures : 0) : 0;
                                  const valInRound = round[`asset_${item.id}`] ?? (round[item.id] !== undefined ? round[item.id] : legacyAssetsVal);
                                  const sumOtherAssetItems = otherRounds.reduce(
                                    (acc: number, r: any) => {
                                      const lVal = r.targetType === 'assets' ? (item.id === "graves" ? r.doneGraves : item.id === "assets" ? r.doneAssets : item.id === "structures" ? r.doneStructures : 0) : 0;
                                      const rVal = r[`asset_${item.id}`] ?? (r[item.id] !== undefined ? r[item.id] : lVal);
                                      return Number(acc) + Number(Number(rVal) || 0);
                                    },
                                    0,
                                  );
                                  const maxAssetItem = Math.max(
                                    0,
                                    (invDoneAssetsMap[item.id] || 0) -
                                      sumOtherAssetItems,
                                  );

                                  return (
                                    <div
                                      key={item.id}
                                      className="flex items-center gap-1.5 font-sans"
                                    >
                                      <NumberInput
                                        className="w-14 h-8 text-center bg-slate-50 border border-slate-200 rounded-xl px-1.5 py-0.5 text-xs font-bold text-slate-800 outline-none focus:border-blue-500 hover:border-slate-300 focus:ring-4 focus:ring-blue-500/10 transition-all font-mono shadow-3xs"
                                        value={valInRound || 0}
                                        tooltipText={`Còn lại ${maxAssetItem} ${item.label.toLowerCase()}`}
                                        onChange={(val) => {
                                          if (val > maxAssetItem) {
                                            toast.warning(`Số lượng ${item.label.toLowerCase()} trình thẩm định vượt quá số đã kiểm đếm còn lại (${maxAssetItem}).`);
                                          }
                                          const clamped = Math.min(
                                            val,
                                            maxAssetItem,
                                          );
                                          const newRounds = [...roundsList];
                                          let roundCopy = {
                                            ...newRounds[idx],
                                            [`asset_${item.id}`]: clamped,
                                            [item.id]: clamped,
                                          };
                                          roundCopy =
                                            syncRoundTotals(roundCopy);
                                          newRounds[idx] = roundCopy;
                                          updateStepStatus(
                                            project.id,
                                            stepKey,
                                            {
                                              ...planDraftData,
                                              rounds: newRounds,
                                            },
                                          );
                                        }}
                                        readOnly={!canEdit}
                                      />
                                      <span className="text-[10px] text-slate-500 whitespace-nowrap -ml-0.5">
                                        (số {item.label.toLowerCase()})
                                      </span>
                                    </div>
                                  );
                                })}
                                <div className="flex items-center gap-1.5 font-sans">
                                  <NumberInput
                                    className="w-14 h-8 text-center bg-slate-50 border border-slate-200 rounded-xl px-1.5 py-0.5 text-xs font-bold text-slate-800 outline-none focus:border-blue-500 hover:border-slate-300 focus:ring-4 focus:ring-blue-500/10 transition-all font-mono shadow-3xs"
                                    placeholder="Hộ"
                                    value={getAssetHH(round)}
                                    tooltipText={`Còn lại ${maxAssetHH} hộ`}
                                    onChange={(val) => {
                                      if (val > maxAssetHH) {
                                        toast.warning(`Số hộ ảnh hưởng tài sản khác vượt quá số đã kiểm đếm còn lại (${maxAssetHH} hộ).`);
                                      }
                                      const clamped = Math.min(val, maxAssetHH);
                                      const newRounds = [...roundsList];
                                      let roundCopy = {
                                        ...newRounds[idx],
                                        assetHouseholds: clamped,
                                      };
                                      roundCopy = syncRoundTotals(roundCopy);
                                      newRounds[idx] = roundCopy;
                                      updateStepStatus(project.id, stepKey, {
                                        ...planDraftData,
                                        rounds: newRounds,
                                      });
                                    }}
                                    readOnly={!canEdit}
                                  />
                                  <span className="text-[10px] text-slate-500 whitespace-nowrap -ml-0.5">
                                    (số hộ)
                                  </span>
                                </div>
                              </div>
                            )}

                            {canEdit && activeTypes.length > 1 && (
                              <button
                                onClick={() => {
                                  const newRounds = [...roundsList];
                                  const oldActive = [...activeTypes];
                                  const removedType = oldActive[typeIdx];

                                  let roundCopy = { ...newRounds[idx] };
                                  if (removedType === "agri") {
                                    roundCopy.agriPlots = 0;
                                    roundCopy.agriHouseholds = 0;
                                  } else if (removedType === "non_agri") {
                                    roundCopy.nonAgriPlots = 0;
                                    roundCopy.nonAgriHouseholds = 0;
                                  } else if (removedType === "org") {
                                    roundCopy.orgs = 0;
                                  } else if (removedType === "assets") {
                                    roundCopy.assetHouseholds = 0;
                                    assetItems.forEach((item: any) => {
                                      roundCopy[`asset_${item.id}`] = 0;
                                      roundCopy[item.id] = 0;
                                    });
                                  }

                                  oldActive.splice(typeIdx, 1);
                                  roundCopy.activeTypes = oldActive;
                                  roundCopy = syncRoundTotals(roundCopy);
                                  newRounds[idx] = roundCopy;
                                  updateStepStatus(project.id, stepKey, {
                                    ...planDraftData,
                                    rounds: newRounds,
                                  });
                                }}
                                className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-all cursor-pointer h-7 w-7 flex items-center justify-center border border-transparent hover:border-red-100"
                                title="Xoá đối tượng này"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        ))}

                        {canEdit &&
                          activeTypes.length < availableTypes.length && (
                            <select
                              disabled={!canEdit}
                              value=""
                              onChange={(e) => {
                                const selectedType = e.target.value;
                                if (selectedType) {
                                  const newRounds = [...roundsList];
                                  newRounds[idx] = {
                                    ...newRounds[idx],
                                    activeTypes: [
                                      ...activeTypes,
                                      selectedType,
                                    ],
                                  };
                                  updateStepStatus(project.id, stepKey, {
                                    ...planDraftData,
                                    rounds: newRounds,
                                  });
                                }
                              }}
                              className="text-[10px] font-bold text-blue-600 bg-blue-50/50 hover:bg-blue-100 px-2.5 py-1.5 rounded border border-blue-150 transition-colors shrink-0 font-sans mt-1 cursor-pointer outline-none h-[28px]"
                            >
                              <option value="" disabled>
                                + Thêm đối tượng
                              </option>
                              {availableTypes
                                .filter((t) => !activeTypes.includes(t.value))
                                .map((t) => (
                                  <option key={t.value} value={t.value}>
                                    {t.label}
                                  </option>
                                ))}
                            </select>
                          )}
                      </>
                    );
                  })()}

                  <div className="w-full flex flex-col md:flex-row md:items-center gap-3 border-t border-slate-100 pt-2 mt-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-[9.5px] text-slate-400 font-extrabold uppercase whitespace-nowrap font-sans">
                          Tổng số tiền BT, HT:
                        </span>
                        <div className="flex items-center px-2 py-0.5 rounded border border-slate-200 bg-slate-50 max-w-xs shadow-xs">
                          <CurrencyInput
                            readOnly={!canEdit}
                            className="w-24 text-right bg-transparent outline-none text-[10.5px] font-bold text-emerald-700 font-mono"
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
                          <span className="text-slate-400 ml-1 text-[9.5px] font-sans">
                            đ
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[9.5px] text-slate-400 font-extrabold uppercase whitespace-nowrap font-sans">
                          Chi phí thực hiện (nếu có):
                        </span>
                        <div className="flex items-center px-2 py-0.5 rounded border border-slate-200 bg-slate-50 max-w-xs shadow-xs">
                          <CurrencyInput
                            readOnly={!canEdit}
                            className="w-24 text-right bg-transparent outline-none text-[10.5px] font-bold text-emerald-700 font-mono"
                            value={round.cost || 0}
                            onChange={(val) => {
                              const newRounds = [...roundsList];
                              newRounds[idx] = {
                                ...newRounds[idx],
                                cost: val,
                              };
                              updateStepStatus(project.id, stepKey, {
                                ...planDraftData,
                                rounds: newRounds,
                              });
                            }}
                          />
                          <span className="text-slate-400 ml-1 text-[9.5px] font-sans">
                            đ
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex-grow">
                      <EditableInput
                        placeholder="Ghi chú đợt trình phương án (xóm, tổ dân phố, hạng mục...)"
                        className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1 text-[10px] text-slate-700 outline-none placeholder-slate-400 font-semibold"
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

                  {/* Work document links section for the round */}
                  <div className="w-full pt-1.5 border-t border-slate-100 mt-1">
                    <DocumentLinkList
                      links={round.links || []}
                      onChange={(newLinks) => {
                        const newRounds = [...roundsList];
                        newRounds[idx] = {
                          ...newRounds[idx],
                          links: newLinks,
                        };
                        updateStepStatus(project.id, stepKey, {
                          ...planDraftData,
                          rounds: newRounds,
                        });
                      }}
                      labelTitle="Hồ sơ công việc (Links):"
                      readOnly={!canEdit}
                    />
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
