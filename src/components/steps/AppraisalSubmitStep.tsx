import React from "react";
import { Trash2, Layers, X } from "lucide-react";
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
    (acc: number, r: any) => acc + (r.donePlots || 0),
    0,
  );
  const invDoneAgriHouseholds = invAgriRounds.reduce(
    (acc: number, r: any) => acc + (r.doneHouseholds || 0),
    0,
  );
  const invDoneNonAgriPlots = invNonAgriRounds.reduce(
    (acc: number, r: any) => acc + (r.donePlots || 0),
    0,
  );
  const invDoneNonAgriHouseholds = invNonAgriRounds.reduce(
    (acc: number, r: any) => acc + (r.doneHouseholds || 0),
    0,
  );
  const invDoneOrgs = invOrgRounds.reduce(
    (acc: number, r: any) => acc + (r.doneOrgs || 0),
    0,
  );
  const invDoneAssetHouseholds = invAssetRounds.reduce(
    (acc: number, r: any) => acc + (r.doneHouseholds || 0),
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
        return acc + (Number(rVal) || 0);
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

  const doneAgriPlots = roundsList.reduce((acc: number, r: any) => acc + getAgriPlots(r), 0);
  const doneAgriHouseholds = roundsList.reduce((acc: number, r: any) => acc + getAgriHH(r), 0);
  const doneNonAgriPlots = roundsList.reduce((acc: number, r: any) => acc + getNonAgriPlots(r), 0);
  const doneNonAgriHouseholds = roundsList.reduce((acc: number, r: any) => acc + getNonAgriHH(r), 0);
  const doneOrgs = roundsList.reduce((acc: number, r: any) => acc + getOrgsVal(r), 0);

  // Dynamic asset types done counts
  const assetDoneParts: string[] = [];

  assetItems.forEach((item) => {
    const doneVal = roundsList.reduce((acc: number, r: any) => {
      const legacyAssetsVal = r.targetType === 'assets' ? 
        (item.id === "graves" ? r.doneGraves : item.id === "assets" ? r.doneAssets : item.id === "structures" ? r.doneStructures : 0) : 0;
      const rVal = r[`asset_${item.id}`] ?? (r[item.id] !== undefined ? r[item.id] : legacyAssetsVal);
      return acc + (Number(rVal) || 0);
    }, 0);

    const invCountVal = invDoneAssetsMap[item.id] || 0;
    if (doneVal > 0) {
      assetDoneParts.push(
        `${formatCount(doneVal)}/${formatCount(invCountVal)} ${item.label}`,
      );
    }
  });

  const doneAssetHouseholds = roundsList.reduce((acc: number, r: any) => acc + getAssetHH(r), 0);

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
    (acc: number, r: any) => acc + (r.amount || 0),
    0,
  );

  // Calculate total cost across all appraisal submit rounds
  const totalCost = roundsList.reduce(
    (acc: number, r: any) => acc + (r.cost || 0),
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

  return (
    <div className="flex flex-col gap-4 mt-2 w-full">
      {/* Progress / Summary Dashboard */}
      <div className="border border-slate-200 rounded-xl bg-slate-50/50 p-4 space-y-3">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-sans">
          Tiến độ trình phương án thẩm định
        </span>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5 pl-2 border-l-2 border-blue-400/80">
            <span className="text-[9.5px] font-black text-slate-400 uppercase block select-none">
              Đã trình phương án:
            </span>

            {hasInvAgri &&
              (doneAgriPlots > 0 || doneAgriHouseholds > 0 ? (
                <div className="text-[11.5px] text-slate-755 font-medium flex items-center gap-1.5 flex-wrap font-sans">
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
                    <span className="text-blue-600 font-bold text-[10px] bg-blue-50/80 px-1 py-0.5 rounded shadow-sm border border-blue-100/50">
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
                <div className="text-[11.5px] text-slate-400 font-medium font-sans">
                  🌾 Chưa lập phương án đất nông nghiệp (Tổng:{" "}
                  {formatCount(invDoneAgriPlots)} thửa (thuộc{" "}
                  {formatCount(invDoneAgriHouseholds)} hộ))
                </div>
              ))}

            {hasInvNonAgri &&
              (doneNonAgriPlots > 0 ||
              doneNonAgriHouseholds > 0 ? (
                <div className="text-[11.5px] text-slate-755 font-medium flex items-center gap-1.5 flex-wrap font-sans">
                  <span>
                    🏠{" "}
                    <span className="font-semibold text-slate-500">
                      Đất phi nông nghiệp:
                    </span>{" "}
                    <strong className="text-blue-700">
                      {formatCount(doneNonAgriPlots)}/
                      {formatCount(invDoneNonAgriPlots)} thửa
                      (thuộc {formatCount(doneNonAgriHouseholds)}
                      /{formatCount(invDoneNonAgriHouseholds)}{" "}
                      hộ)
                    </strong>
                  </span>
                  {invDoneNonAgriHouseholds > 0 && (
                    <span className="text-blue-600 font-bold text-[10px] bg-blue-50/80 px-1 py-0.5 rounded shadow-sm border border-blue-100/50">
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
                <div className="text-[11.5px] text-slate-400 font-medium font-sans">
                  🏠 Chưa lập phương án đất phi nông nghiệp (Tổng:{" "}
                  {formatCount(invDoneNonAgriPlots)} thửa
                  (thuộc{" "}
                  {formatCount(invDoneNonAgriHouseholds)} hộ))
                </div>
              ))}

            {hasInvOrg &&
              (doneOrgs > 0 ? (
                <div className="text-[11.5px] text-slate-755 font-medium flex items-center gap-1.5 flex-wrap font-sans">
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
                    <span className="text-blue-600 font-bold text-[10px] bg-blue-50/80 px-1 py-0.5 rounded shadow-sm border border-blue-100/50">
                      {Math.round(
                        (doneOrgs / invDoneOrgs) * 100,
                      )}
                      %
                    </span>
                  )}
                </div>
              ) : (
                <div className="text-[11.5px] text-slate-400 font-medium font-sans">
                  🏢 Chưa lập phương án tổ chức (Tổng:{" "}
                  {formatCount(invDoneOrgs)} tổ chức)
                </div>
              ))}

            {hasInvAsset &&
              (assetProgressText ? (
                <div className="text-[11.5px] text-slate-755 font-medium flex items-center gap-1.5 flex-wrap font-sans">
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
                      <span className="text-blue-600 font-bold text-[10px] bg-blue-50/80 px-1 py-0.5 rounded shadow-sm border border-blue-100/50">
                        {Math.round(
                          (doneAssetHouseholds /
                            invDoneAssetHouseholds) *
                            105,
                        )}
                        %
                      </span>
                    )}
                </div>
              ) : (
                <div className="text-[11.5px] text-slate-400 font-medium font-sans">
                  📦 Chưa lập phương án tài sản (Tổng:{" "}
                  {formatCount(invDoneAssetHouseholds)} hộ)
                </div>
              ))}

            {!hasInvAgri &&
              !hasInvNonAgri &&
              !hasInvOrg &&
              !hasInvAsset && (
                <div className="text-[11.5px] text-slate-400 italic font-sans animate-pulse">
                  Chưa ghi nhận đối tượng đã kiểm đếm để lập đợt
                </div>
              )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pb-1">
            <div className="bg-emerald-50/50 rounded-xl p-3 border border-emerald-100 flex flex-col justify-between">
              <span className="text-[10px] font-bold text-emerald-650 uppercase tracking-wide">
                Tổng số tiền BT, HT cả các đợt
              </span>
              <div className="mt-2 text-base font-black text-emerald-700 flex items-baseline font-mono">
                {totalAmount.toLocaleString("vi-VN")}
                <span className="text-xs font-semibold text-emerald-500 ml-1">
                  đ
                </span>
              </div>
            </div>

            <div className="bg-blue-50/50 rounded-xl p-3 border border-blue-100 flex flex-col justify-between">
              <span className="text-[10px] font-bold text-blue-650 uppercase tracking-wide">
                Tổng chi phí thực hiện cả các đợt
              </span>
              <div className="mt-2 text-base font-black text-blue-700 flex items-baseline font-mono">
                {totalCost.toLocaleString("vi-VN")}
                <span className="text-xs font-semibold text-blue-500 ml-1">
                  đ
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* List of Rounds */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <Layers className="w-3.5 h-3.5" />
            Các đợt thực hiện
          </span>
          {canEdit && (
            <button
              onClick={() => {
                const current = planDraftData?.rounds || [];
                const item = {
                  id: Math.random()
                    .toString(36)
                    .substring(2, 11),
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
              }}
              className="text-[10px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg border border-blue-200 transition-colors cursor-pointer"
            >
              + Thêm đợt
            </button>
          )}
        </div>

        <div className="space-y-3">
          {roundsList.map((round: any, idx: number) => {
            const otherRounds = roundsList.filter((_, rIdx: number) => rIdx !== idx);

            const sumOtherAgriPlots = otherRounds.reduce((acc: number, r: any) => acc + getAgriPlots(r), 0);
            const sumOtherAgriHH = otherRounds.reduce((acc: number, r: any) => acc + getAgriHH(r), 0);
            const maxAgriPlots = Math.max(0, invDoneAgriPlots - sumOtherAgriPlots);
            const maxAgriHH = Math.max(0, invDoneAgriHouseholds - sumOtherAgriHH);

            const sumOtherNonAgriPlots = otherRounds.reduce((acc: number, r: any) => acc + getNonAgriPlots(r), 0);
            const sumOtherNonAgriHH = otherRounds.reduce((acc: number, r: any) => acc + getNonAgriHH(r), 0);
            const maxNonAgriPlots = Math.max(0, invDoneNonAgriPlots - sumOtherNonAgriPlots);
            const maxNonAgriHH = Math.max(0, invDoneNonAgriHouseholds - sumOtherNonAgriHH);

            const sumOtherOrgs = otherRounds.reduce((acc: number, r: any) => acc + getOrgsVal(r), 0);
            const maxOrgs = Math.max(0, invDoneOrgs - sumOtherOrgs);

            const sumOtherAssetHH = otherRounds.reduce((acc: number, r: any) => acc + getAssetHH(r), 0);
            const maxAssetHH = Math.max(0, invDoneAssetHouseholds - sumOtherAssetHH);

            return (
              <div
                key={round.id || idx}
                className="bg-slate-50 p-4.5 rounded-xl border border-slate-200 shadow-xs flex flex-col gap-3"
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
                <div className="flex flex-col gap-y-3 text-[10.5px] text-slate-600 bg-white p-3 rounded-lg border border-slate-100 items-start">
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
                            className="flex flex-wrap items-center gap-3 bg-slate-50/50 p-2 rounded border border-slate-100 w-full xl:w-auto relative group"
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
                                className="bg-white border border-slate-200 rounded px-2 py-1 text-[10px] font-bold text-slate-700 outline-none focus:border-blue-500 uppercase tracking-tight min-w-[150px] font-sans h-7"
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
                              <div className="flex items-center gap-3">
                                <div className="flex items-center gap-1.5">
                                  <NumberInput
                                    className="w-16 h-7 text-center bg-white border border-slate-200 rounded px-1.5 py-0.5 text-[10px] font-bold text-slate-800 outline-none focus:border-blue-500 font-mono"
                                    placeholder="Thửa"
                                    value={getAgriPlots(round)}
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
                                  <span className="text-[10px] text-slate-500 whitespace-nowrap -ml-0.5 font-sans">
                                    (số thửa)
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <NumberInput
                                    className="w-16 h-7 text-center bg-white border border-slate-200 rounded px-1.5 py-0.5 text-[10px] font-bold text-slate-800 outline-none focus:border-blue-500 font-mono"
                                    placeholder="Hộ"
                                    value={getAgriHH(round)}
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
                                  <span className="text-[10px] text-slate-500 whitespace-nowrap -ml-0.5 font-sans">
                                    (số hộ)
                                  </span>
                                </div>
                              </div>
                            )}

                            {typeVal === "non_agri" && (
                              <div className="flex items-center gap-3">
                                <div className="flex items-center gap-1.5">
                                  <NumberInput
                                    className="w-16 h-7 text-center bg-white border border-slate-200 rounded px-1.5 py-0.5 text-[10px] font-bold text-slate-800 outline-none focus:border-blue-500 font-mono"
                                    placeholder="Thửa"
                                    value={getNonAgriPlots(round)}
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
                                  <span className="text-[10px] text-slate-500 whitespace-nowrap -ml-0.5 font-sans">
                                    (số thửa)
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <NumberInput
                                    className="w-16 h-7 text-center bg-white border border-slate-200 rounded px-1.5 py-0.5 text-[10px] font-bold text-slate-800 outline-none focus:border-blue-500 font-mono"
                                    placeholder="Hộ"
                                    value={getNonAgriHH(round)}
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
                                  <span className="text-[10px] text-slate-500 whitespace-nowrap -ml-0.5 font-sans">
                                    (số hộ)
                                  </span>
                                </div>
                              </div>
                            )}

                            {typeVal === "org" && (
                              <div className="flex items-center gap-1.5">
                                <NumberInput
                                  className="w-16 h-7 text-center bg-white border border-slate-200 rounded px-1.5 py-0.5 text-[10px] font-bold text-slate-800 outline-none focus:border-blue-500 font-mono"
                                  placeholder="TC"
                                  value={getOrgsVal(round)}
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
                                      return acc + (Number(rVal) || 0);
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
                                        className="w-12 h-7 text-center bg-white border border-slate-200 rounded px-1 py-0.5 text-[10.5px] font-bold text-slate-800 outline-none focus:border-blue-500 font-mono"
                                        value={valInRound || 0}
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
                                    className="w-12 h-7 text-center bg-white border border-slate-200 rounded px-1.5 py-0.5 text-[10.5px] font-bold text-slate-800 outline-none focus:border-blue-500 font-mono"
                                    placeholder="Hộ"
                                    value={getAssetHH(round)}
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
