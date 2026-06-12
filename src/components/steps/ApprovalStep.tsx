import React from "react";
import { Trash2, Layers, X } from "lucide-react";
import { Project } from "../../types";
import { CustomDatePicker, NumberInput, CurrencyInput, EditableInput } from "../ui-primitives";
import { updateStepStatus } from "../../lib/projectService";
import { formatCount, getFlattenedRounds, parseFormattedDate } from "./stepUtils";
import { DocumentLinkList } from "../DocumentLinkList";
import { toast } from "sonner";

interface ApprovalStepProps {
  project: Project;
  stepKey: string;
  stepData: any;
  canEdit: boolean;
}

export const ApprovalStep: React.FC<ApprovalStepProps> = ({
  project,
  stepKey,
  stepData,
  canEdit,
}) => {
  const approvalData = stepData as any;
  const roundsList = approvalData?.rounds || [];

  const formatDecisionTitle = (r: any, rIdx: number) => {
    const decisionNo = (r.decisionNo || "").trim();
    const rawArea = (r.approvalArea || "").trim();
    
    let cleanArea = "";
    if (rawArea) {
      const lowerArea = rawArea.toLowerCase();
      const ubndIdx = lowerArea.indexOf("ubnd");
      if (ubndIdx !== -1) {
        cleanArea = rawArea.substring(ubndIdx + 4).trim();
      } else {
        cleanArea = rawArea;
      }
    }

    const dateStr = r.approvalDate || r.date || "";
    const dateInfo = parseFormattedDate(dateStr);
    const day = dateInfo?.day;
    const month = dateInfo?.month;
    const year = dateInfo?.year;
    const hasDate = !!(day && month && year && !isNaN(Number(day)) && !isNaN(Number(month)) && !isNaN(Number(year)));

    if (!decisionNo && !cleanArea && !hasDate) {
      return "Quyết định mới";
    }

    let titleParts = [];
    if (decisionNo) {
      titleParts.push(`Số ${decisionNo}/QĐ-UBND`);
    }
    
    let titleStr = titleParts.join("");
    
    if (cleanArea) {
      if (decisionNo) {
        titleStr += `     ${cleanArea}`;
      } else {
        titleStr = `Quyết định ${cleanArea}`;
      }
    } else if (!decisionNo) {
      titleStr = "Quyết định";
    }

    if (hasDate) {
      const parsedDay = day.padStart(2, '0');
      const parsedMonth = month.padStart(2, '0');
      titleStr += `, ngày ${parsedDay} tháng ${parsedMonth} năm ${year}`;
    }

    return titleStr;
  };

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

  // Calculate total compensation amount across all approval rounds
  const totalAmount = roundsList.reduce(
    (acc: number, r: any) => acc + (r.amount || 0),
    0,
  );

  // Calculate total cost across all approval rounds
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
          Tiến độ phê duyệt phương án
        </span>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5 pl-2 border-l-2 border-emerald-500">
            <span className="text-[9.5px] font-black text-slate-400 uppercase block select-none">
              Đã phê duyệt phương án:
            </span>

            {hasInvAgri &&
              (doneAgriPlots > 0 || doneAgriHouseholds > 0 ? (
                <div className="text-[11.5px] text-slate-755 font-medium flex items-center gap-1.5 flex-wrap font-sans">
                  <span>
                    🌾{" "}
                    <span className="font-semibold text-slate-500">
                      Đất nông nghiệp:
                    </span>{" "}
                    <strong className="text-emerald-700">
                      {formatCount(doneAgriPlots)}/
                      {formatCount(invDoneAgriPlots)} thửa
                      (thuộc {formatCount(doneAgriHouseholds)}
                      /{formatCount(invDoneAgriHouseholds)}{" "}
                      hộ)
                    </strong>
                  </span>
                  {invDoneAgriHouseholds > 0 && (
                    <span className="text-emerald-600 font-bold text-[10px] bg-emerald-50 px-1 py-0.5 rounded shadow-sm border border-emerald-100">
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
                  🌾 Chưa phê duyệt phương án đất nông nghiệp (Tổng:{" "}
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
                    <strong className="text-emerald-700">
                      {formatCount(doneNonAgriPlots)}/
                      {formatCount(invDoneNonAgriPlots)} thửa
                      (thuộc {formatCount(doneNonAgriHouseholds)}
                      /{formatCount(invDoneNonAgriHouseholds)}{" "}
                      hộ)
                    </strong>
                  </span>
                  {invDoneNonAgriHouseholds > 0 && (
                    <span className="text-emerald-600 font-bold text-[10px] bg-emerald-50 px-1 py-0.5 rounded shadow-sm border border-emerald-100 font-sans">
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
                  🏠 Chưa phê duyệt phương án đất phi nông nghiệp (Tổng:{" "}
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
                    <strong className="text-emerald-700">
                      {formatCount(doneOrgs)}/
                      {formatCount(invDoneOrgs)} tổ chức
                    </strong>
                  </span>
                  {invDoneOrgs > 0 && (
                    <span className="text-emerald-600 font-bold text-[10px] bg-emerald-50 px-1 py-0.5 rounded shadow-sm border border-emerald-100">
                      {Math.round(
                        (doneOrgs / invDoneOrgs) * 100,
                      )}
                      %
                    </span>
                  )}
                </div>
              ) : (
                <div className="text-[11.5px] text-slate-400 font-medium font-sans">
                  🏢 Chưa phê duyệt phương án tổ chức (Tổng:{" "}
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
                    <strong className="text-emerald-700">
                      {assetProgressText}
                    </strong>
                  </span>
                  {invDoneAssetHouseholds > 0 &&
                    doneAssetHouseholds > 0 && (
                      <span className="text-emerald-600 font-bold text-[10px] bg-emerald-55 px-1 py-0.5 rounded shadow-sm border border-emerald-100">
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
                <div className="text-[11.5px] text-slate-400 font-medium font-sans">
                  📦 Chưa phê duyệt phương án tài sản (Tổng:{" "}
                  {formatCount(invDoneAssetHouseholds)} hộ)
                </div>
              ))}

            {!hasInvAgri &&
              !hasInvNonAgri &&
              !hasInvOrg &&
              !hasInvAsset && (
                <div className="text-[11.5px] text-slate-400 italic font-sans animate-pulse">
                  Chưa ghi nhận đối tượng đã kiểm đếm để phê duyệt đợt
                </div>
              )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pb-1">
            <div className="bg-emerald-50/50 rounded-xl p-3 border border-emerald-100 flex flex-col justify-between">
              <span className="text-[10px] font-bold text-emerald-650 uppercase tracking-wide">
                Tổng số tiền BT, HT cả các QĐ
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
                Tổng chi phí thực hiện cả các QĐ
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

      {/* List of Decisions */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <Layers className="w-3.5 h-3.5" />
            Các quyết định phê duyệt
          </span>
          {canEdit && (
            <button
              onClick={() => {
                const current = approvalData?.rounds || [];
                const item = {
                  id: Math.random()
                    .toString(36)
                    .substring(2, 11),
                  targetType: defaultTargetType,
                  decisionNo: "",
                  approvalDate: "",
                  approvalArea: "UBND ",
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
                  ...approvalData,
                  rounds: [...current, item],
                });
              }}
              className="text-[10px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg border border-blue-200 transition-colors cursor-pointer"
            >
              + Thêm quyết định phê duyệt
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
                    <span className="text-[11px] font-black text-slate-700">
                      {formatDecisionTitle(round, idx)}
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
                    {canEdit && (
                      <button
                        onClick={() => {
                          const newRounds = roundsList.filter(
                            (r: any) => r.id !== round.id,
                          );
                          updateStepStatus(project.id, stepKey, {
                            ...approvalData,
                            rounds: newRounds,
                          });
                        }}
                        className="p-1 px-1.5 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded border border-transparent hover:border-red-100"
                        title="Xoá quyết định này"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Thông tin quyết định section */}
                <div className="bg-white p-3 rounded-lg border border-slate-200/50 grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                  <div className="md:col-span-3 space-y-1">
                    <label className="text-[9.5px] font-extrabold text-slate-400 uppercase tracking-wide block">
                      Số QĐ phê duyệt:
                    </label>
                    <EditableInput
                      readOnly={!canEdit}
                      placeholder="Chưa nhập số quyết định..."
                      className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1 text-[11px] font-bold text-slate-800 outline-none placeholder-slate-400"
                      value={round.decisionNo || ""}
                      onSave={(val) => {
                        const newRounds = [...roundsList];
                        newRounds[idx] = {
                          ...newRounds[idx],
                          decisionNo: val,
                          name: val
                            ? `QĐ số: ${val}`
                            : `Quyết định ${idx + 1}`,
                        };
                        updateStepStatus(project.id, stepKey, {
                          ...approvalData,
                          rounds: newRounds,
                        });
                      }}
                    />
                  </div>
                  <div className="md:col-span-5 space-y-1">
                    <label className="text-[9.5px] font-extrabold text-slate-400 uppercase tracking-wide block">
                      Đơn vị phê duyệt:
                    </label>
                    <EditableInput
                      readOnly={!canEdit}
                      placeholder="Nhập đơn vị phê duyệt..."
                      onFocus={() => {
                        if (canEdit && !round.approvalArea) {
                          const newRounds = [...roundsList];
                          newRounds[idx] = {
                            ...newRounds[idx],
                            approvalArea: "UBND ",
                          };
                          updateStepStatus(project.id, stepKey, {
                            ...approvalData,
                            rounds: newRounds,
                          });
                        }
                      }}
                      className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1 text-[11px] font-bold text-slate-800 outline-none placeholder-slate-400"
                      value={round.approvalArea || ""}
                      onSave={(val) => {
                        const newRounds = [...roundsList];
                        newRounds[idx] = {
                          ...newRounds[idx],
                          approvalArea: val,
                        };
                        updateStepStatus(project.id, stepKey, {
                          ...approvalData,
                          rounds: newRounds,
                        });
                      }}
                    />
                  </div>
                  <div className="md:col-span-4 space-y-1">
                    <label className="text-[9.5px] font-extrabold text-slate-400 uppercase tracking-wide block">
                      Ngày QĐ phê duyệt:
                    </label>
                    <div className="h-[26px] flex items-center">
                      <CustomDatePicker
                        value={
                          round.approvalDate ||
                          round.date ||
                          ""
                        }
                        onChange={(val) => {
                          const newRounds = [...roundsList];
                          newRounds[idx] = {
                            ...newRounds[idx],
                            approvalDate: val,
                            date: val,
                          };
                          updateStepStatus(project.id, stepKey, {
                            ...approvalData,
                            rounds: newRounds,
                          });
                        }}
                        readOnly={!canEdit}
                      />
                    </div>
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
                      if (
                        getAgriPlots(round) > 0 ||
                        getAgriHH(round) > 0
                      )
                        inferred.push("agri");
                      if (
                        getNonAgriPlots(round) > 0 ||
                        getNonAgriHH(round) > 0
                      )
                        inferred.push("non_agri");
                      if (getOrgsVal(round) > 0)
                        inferred.push("org");

                      const hasAssetCount = assetItems.some(
                        (item) => {
                          const legacyAssetsVal =
                            round.targetType === "assets"
                              ? item.id === "graves"
                                ? round.doneGraves
                                : item.id === "assets"
                                  ? round.doneAssets
                                  : item.id === "structures"
                                    ? round.doneStructures
                                    : 0
                              : 0;
                          const valInRound =
                            round[`asset_${item.id}`] ??
                            (round[item.id] !== undefined
                              ? round[item.id]
                              : legacyAssetsVal);
                          return (valInRound || 0) > 0;
                        },
                      );
                      if (
                        getAssetHH(round) > 0 ||
                        hasAssetCount
                      )
                        inferred.push("assets");

                      if (
                        inferred.length === 0 &&
                        availableTypes.length > 0
                      ) {
                        inferred.push(
                          availableTypes[0].value,
                        );
                      }
                      return inferred;
                    })();

                    return (
                      <>
                        {activeTypes.map(
                          (typeVal, typeIdx) => (
                            <div
                              key={`${typeVal}-${typeIdx}`}
                              className="flex flex-wrap items-center gap-3 bg-slate-50/50 p-2 rounded border border-slate-100 w-full xl:w-auto relative group"
                            >
                              <div className="flex items-center gap-1.5 min-w-[170px]">
                                <select
                                  disabled={!canEdit}
                                  value={typeVal}
                                  onChange={(e) => {
                                    const newType =
                                      e.target.value;
                                    const newRounds = [
                                      ...roundsList,
                                    ];
                                    const oldActive = [
                                      ...activeTypes,
                                    ];
                                    const oldType =
                                      oldActive[typeIdx];

                                    let roundCopy = {
                                      ...newRounds[idx],
                                    };
                                    if (oldType === "agri") {
                                      roundCopy.agriPlots = 0;
                                      roundCopy.agriHouseholds = 0;
                                    } else if (
                                      oldType === "non_agri"
                                    ) {
                                      roundCopy.nonAgriPlots = 0;
                                      roundCopy.nonAgriHouseholds = 0;
                                    } else if (
                                      oldType === "org"
                                    ) {
                                      roundCopy.orgs = 0;
                                    } else if (
                                      oldType === "assets"
                                    ) {
                                      roundCopy.assetHouseholds = 0;
                                      assetItems.forEach(
                                        (item) => {
                                          roundCopy[
                                            `asset_${item.id}`
                                          ] = 0;
                                          roundCopy[
                                            item.id
                                          ] = 0;
                                        },
                                      );
                                    }

                                    oldActive[typeIdx] =
                                      newType;
                                    roundCopy.activeTypes =
                                      oldActive;
                                    roundCopy =
                                      syncRoundTotals(
                                        roundCopy,
                                      );
                                    newRounds[idx] =
                                      roundCopy;
                                    updateStepStatus(
                                      project.id,
                                      stepKey,
                                      {
                                        ...approvalData,
                                        rounds: newRounds,
                                      },
                                    );
                                  }}
                                  className="bg-transparent text-[11px] font-bold text-slate-700 outline-none cursor-pointer py-1 max-w-[175px]"
                                >
                                  {availableTypes.map(
                                    (opt) => (
                                      <option
                                        key={opt.value}
                                        value={opt.value}
                                        disabled={
                                          activeTypes.includes(
                                            opt.value,
                                          ) &&
                                          opt.value !==
                                            typeVal
                                        }
                                      >
                                        {opt.label}
                                      </option>
                                    ),
                                  )}
                                </select>
                              </div>

                              <div className="h-4 w-[1px] bg-slate-200 hidden sm:block" />

                              {/* Fields inside target row */}
                              {typeVal === "agri" && (
                                <div className="flex items-center gap-3">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-slate-400 font-semibold select-none">
                                      Số thửa:
                                    </span>
                                    <div className="flex items-center px-2 py-0.5 rounded border border-slate-200 bg-white shadow-xs">
                                      <NumberInput
                                        readOnly={!canEdit}
                                        className="w-12 text-center outline-none text-[10.5px] font-bold text-slate-700"
                                        value={getAgriPlots(
                                          round,
                                        )}
                                        onChange={(val) => {
                                          const maxAllowed = maxAgriPlots + getAgriPlots(round);
                                          if (val > maxAllowed) {
                                            toast.warning(`Số thửa đất nông nghiệp phê duyệt vượt quá giới hạn thẩm định còn lại (${maxAllowed} thửa).`);
                                          }
                                          const newRounds = [
                                            ...roundsList,
                                          ];
                                          let rCopy = {
                                            ...newRounds[idx],
                                            agriPlots: Math.min(
                                              val,
                                              maxAllowed,
                                            ),
                                          };
                                          rCopy =
                                            syncRoundTotals(
                                              rCopy,
                                            );
                                          newRounds[idx] =
                                            rCopy;
                                          updateStepStatus(
                                            project.id,
                                            stepKey,
                                            {
                                              ...approvalData,
                                              rounds:
                                                newRounds,
                                            },
                                          );
                                        }}
                                      />
                                    </div>
                                    <span className="text-[10px] text-slate-400 font-normal select-none">
                                      / {maxAgriPlots}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-1.5">
                                    <span className="text-slate-400 font-semibold select-none">
                                      Số hộ:
                                    </span>
                                    <div className="flex items-center px-2 py-0.5 rounded border border-slate-200 bg-white shadow-xs">
                                      <NumberInput
                                        readOnly={!canEdit}
                                        className="w-12 text-center outline-none text-[10.5px] font-bold text-slate-700"
                                        value={getAgriHH(
                                          round,
                                        )}
                                        onChange={(val) => {
                                          const maxAllowed = maxAgriHH + getAgriHH(round);
                                          if (val > maxAllowed) {
                                            toast.warning(`Số hộ đất nông nghiệp phê duyệt vượt quá giới hạn thẩm định còn lại (${maxAllowed} hộ).`);
                                          }
                                          const newRounds = [
                                            ...roundsList,
                                          ];
                                          let rCopy = {
                                            ...newRounds[idx],
                                            agriHouseholds:
                                              Math.min(
                                                val,
                                                maxAllowed,
                                              ),
                                          };
                                          rCopy =
                                            syncRoundTotals(
                                              rCopy,
                                            );
                                          newRounds[idx] =
                                            rCopy;
                                          updateStepStatus(
                                            project.id,
                                            stepKey,
                                            {
                                              ...approvalData,
                                              rounds:
                                                newRounds,
                                            },
                                          );
                                        }}
                                      />
                                    </div>
                                    <span className="text-[10px] text-slate-400 font-normal select-none">
                                      / {maxAgriHH}
                                    </span>
                                  </div>
                                </div>
                              )}

                              {typeVal === "non_agri" && (
                                <div className="flex items-center gap-3">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-slate-400 font-semibold select-none">
                                      Số thửa:
                                    </span>
                                    <div className="flex items-center px-2 py-0.5 rounded border border-slate-200 bg-white shadow-xs">
                                      <NumberInput
                                        readOnly={!canEdit}
                                        className="w-12 text-center outline-none text-[10.5px] font-bold text-slate-700"
                                        value={getNonAgriPlots(
                                          round,
                                        )}
                                        onChange={(val) => {
                                          const maxAllowed = maxNonAgriPlots + getNonAgriPlots(round);
                                          if (val > maxAllowed) {
                                            toast.warning(`Số thửa đất phi nông nghiệp phê duyệt vượt quá giới hạn thẩm định còn lại (${maxAllowed} thửa).`);
                                          }
                                          const newRounds = [
                                            ...roundsList,
                                          ];
                                          let rCopy = {
                                            ...newRounds[idx],
                                            nonAgriPlots:
                                              Math.min(
                                                val,
                                                maxAllowed,
                                              ),
                                          };
                                          rCopy =
                                            syncRoundTotals(
                                              rCopy,
                                            );
                                          newRounds[idx] =
                                            rCopy;
                                          updateStepStatus(
                                            project.id,
                                            stepKey,
                                            {
                                              ...approvalData,
                                              rounds:
                                                newRounds,
                                            },
                                          );
                                        }}
                                      />
                                    </div>
                                    <span className="text-[10px] text-slate-400 font-normal select-none">
                                      / {maxNonAgriPlots}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-1.5">
                                    <span className="text-slate-400 font-semibold select-none">
                                      Số hộ:
                                    </span>
                                    <div className="flex items-center px-2 py-0.5 rounded border border-slate-200 bg-white shadow-xs">
                                      <NumberInput
                                        readOnly={!canEdit}
                                        className="w-12 text-center outline-none text-[10.5px] font-bold text-slate-700"
                                        value={getNonAgriHH(
                                          round,
                                        )}
                                        onChange={(val) => {
                                          const maxAllowed = maxNonAgriHH + getNonAgriHH(round);
                                          if (val > maxAllowed) {
                                            toast.warning(`Số hộ đất phi nông nghiệp phê duyệt vượt quá giới hạn thẩm định còn lại (${maxAllowed} hộ).`);
                                          }
                                          const newRounds = [
                                            ...roundsList,
                                          ];
                                          let rCopy = {
                                            ...newRounds[idx],
                                            nonAgriHouseholds:
                                              Math.min(
                                                val,
                                                maxAllowed,
                                              ),
                                          };
                                          rCopy =
                                            syncRoundTotals(
                                              rCopy,
                                            );
                                          newRounds[idx] =
                                            rCopy;
                                          updateStepStatus(
                                            project.id,
                                            stepKey,
                                            {
                                              ...approvalData,
                                              rounds:
                                                newRounds,
                                            },
                                          );
                                        }}
                                      />
                                    </div>
                                    <span className="text-[10px] text-slate-400 font-normal select-none">
                                      / {maxNonAgriHH}
                                    </span>
                                  </div>
                                </div>
                              )}

                              {typeVal === "org" && (
                                <div className="flex items-center gap-3">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-slate-400 font-semibold select-none">
                                      Số tổ chức:
                                    </span>
                                    <div className="flex items-center px-2 py-0.5 rounded border border-slate-200 bg-white shadow-xs">
                                      <NumberInput
                                        readOnly={!canEdit}
                                        className="w-12 text-center outline-none text-[10.5px] font-bold text-slate-700"
                                        value={getOrgsVal(
                                          round,
                                        )}
                                        onChange={(val) => {
                                          const maxAllowed = maxOrgs + getOrgsVal(round);
                                          if (val > maxAllowed) {
                                            toast.warning(`Số tổ chức phê duyệt vượt quá giới hạn thẩm định còn lại (${maxAllowed} tổ chức).`);
                                          }
                                          const newRounds = [
                                            ...roundsList,
                                          ];
                                          let rCopy = {
                                            ...newRounds[idx],
                                            orgs: Math.min(
                                              val,
                                              maxAllowed,
                                            ),
                                          };
                                          rCopy =
                                            syncRoundTotals(
                                              rCopy,
                                            );
                                          newRounds[idx] =
                                            rCopy;
                                          updateStepStatus(
                                            project.id,
                                            stepKey,
                                            {
                                              ...approvalData,
                                              rounds:
                                                newRounds,
                                            },
                                          );
                                        }}
                                      />
                                    </div>
                                    <span className="text-[10px] text-slate-400 font-normal select-none">
                                      / {maxOrgs}
                                    </span>
                                  </div>
                                </div>
                              )}

                              {typeVal === "assets" && (
                                <div className="flex flex-wrap items-center gap-3 select-none">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-slate-400 font-semibold">
                                      Số hộ:
                                    </span>
                                    <div className="flex items-center px-2 py-0.5 rounded border border-slate-200 bg-white shadow-xs">
                                      <NumberInput
                                        readOnly={!canEdit}
                                        className="w-12 text-center outline-none text-[10.5px] font-bold text-slate-700"
                                        value={getAssetHH(
                                          round,
                                        )}
                                        onChange={(val) => {
                                          const maxAllowed = maxAssetHH + getAssetHH(round);
                                          if (val > maxAllowed) {
                                            toast.warning(`Số hộ ảnh hưởng tài sản phê duyệt vượt quá giới hạn thẩm định còn lại (${maxAllowed} hộ).`);
                                          }
                                          const newRounds = [
                                            ...roundsList,
                                          ];
                                          let rCopy = {
                                            ...newRounds[idx],
                                            assetHouseholds:
                                              Math.min(
                                                val,
                                                maxAllowed,
                                              ),
                                          };
                                          rCopy =
                                            syncRoundTotals(
                                              rCopy,
                                            );
                                          newRounds[idx] =
                                            rCopy;
                                          updateStepStatus(
                                            project.id,
                                            stepKey,
                                            {
                                              ...approvalData,
                                              rounds:
                                                newRounds,
                                            },
                                          );
                                        }}
                                      />
                                    </div>
                                    <span className="text-[10px] text-slate-400 font-normal">
                                      / {maxAssetHH}
                                    </span>
                                  </div>

                                  {assetItems.map((item) => {
                                    const currentVal =
                                      round[
                                        `asset_${item.id}`
                                      ] ??
                                      (round[item.id] !==
                                      undefined
                                        ? round[item.id]
                                        : 0);

                                    const sumOtherAssets =
                                      otherRounds.reduce(
                                        (
                                          acc: number,
                                          r: any,
                                        ) => {
                                          const rVal =
                                            r[
                                              `asset_${item.id}`
                                            ] ??
                                            (r[item.id] !==
                                            undefined
                                              ? r[item.id]
                                              : 0);
                                          return (
                                            acc +
                                            (Number(rVal) ||
                                              0)
                                          );
                                        },
                                        0,
                                      );

                                    const totalLimit =
                                      invDoneAssetsMap[
                                        item.id
                                      ] || 0;
                                    const maxItemVal =
                                      Math.max(
                                        0,
                                        totalLimit -
                                          sumOtherAssets,
                                      );

                                    return (
                                      <div
                                        key={item.id}
                                        className="flex items-center gap-1.5"
                                      >
                                        <span className="text-slate-400 font-semibold capitalize font-sans">
                                          {item.label}:
                                        </span>
                                        <div className="flex items-center px-2 py-0.5 rounded border border-slate-200 bg-white shadow-xs">
                                          <NumberInput
                                            readOnly={
                                              !canEdit
                                            }
                                            className="w-12 text-center outline-none text-[10.5px] font-bold text-slate-700"
                                            value={currentVal}
                                            onChange={(
                                              val,
                                            ) => {
                                              const maxAllowed = maxItemVal + currentVal;
                                              if (val > maxAllowed) {
                                                toast.warning(`Số lượng ${item.label.toLowerCase()} phê duyệt vượt quá giới hạn thẩm định còn lại (${maxAllowed}).`);
                                              }
                                              const newRounds =
                                                [
                                                  ...roundsList,
                                                ];
                                              newRounds[
                                                idx
                                              ] = {
                                                ...newRounds[
                                                  idx
                                                ],
                                                [`asset_${item.id}`]:
                                                  Math.min(
                                                    val,
                                                    maxAllowed,
                                                  ),
                                              };
                                              updateStepStatus(
                                                project.id,
                                                stepKey,
                                                {
                                                  ...approvalData,
                                                  rounds:
                                                    newRounds,
                                                },
                                              );
                                            }}
                                          />
                                        </div>
                                        <span className="text-[10px] text-slate-400 font-normal select-none">
                                          / {maxItemVal}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}

                              {/* Delete target type button */}
                              {canEdit &&
                                activeTypes.length > 1 && (
                                  <button
                                    onClick={() => {
                                      const newRounds = [
                                        ...roundsList,
                                      ];
                                      const oldActive = [
                                        ...activeTypes,
                                      ];
                                      const oldType =
                                        oldActive[typeIdx];

                                      let rCopy = {
                                        ...newRounds[idx],
                                      };
                                      if (oldType === "agri") {
                                        rCopy.agriPlots = 0;
                                        rCopy.agriHouseholds = 0;
                                      } else if (
                                        oldType === "non_agri"
                                      ) {
                                        rCopy.nonAgriPlots = 0;
                                        rCopy.nonAgriHouseholds = 0;
                                      } else if (
                                        oldType === "org"
                                      ) {
                                        rCopy.orgs = 0;
                                      } else if (
                                        oldType === "assets"
                                      ) {
                                        rCopy.assetHouseholds = 0;
                                        assetItems.forEach(
                                          (item) => {
                                            rCopy[
                                              `asset_${item.id}`
                                            ] = 0;
                                            rCopy[item.id] = 0;
                                          },
                                        );
                                      }

                                      const nextActive =
                                        oldActive.filter(
                                          (_, aIdx) =>
                                            aIdx !== typeIdx,
                                        );
                                      rCopy.activeTypes =
                                        nextActive;
                                      rCopy =
                                        syncRoundTotals(
                                          rCopy,
                                        );
                                      newRounds[idx] = rCopy;

                                      updateStepStatus(
                                        project.id,
                                        stepKey,
                                        {
                                          ...approvalData,
                                          rounds: newRounds,
                                        },
                                      );
                                    }}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-red-50 text-slate-300 hover:text-red-500 rounded sm:opacity-0 group-hover:opacity-100 transition-all border border-transparent hover:border-red-100 cursor-pointer h-7 w-7 flex items-center justify-center"
                                    title="Gỡ nhóm đối tượng này"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                )}
                            </div>
                          ),
                        )}

                        {/* Plus button to add more target types inside round */}
                        {canEdit &&
                          activeTypes.length <
                            availableTypes.length && (
                            <select
                              disabled={!canEdit}
                              value=""
                              onChange={(e) => {
                                const selectedType = e.target.value;
                                if (selectedType) {
                                  const newRounds = [
                                    ...roundsList,
                                  ];
                                  newRounds[idx] = {
                                    ...newRounds[idx],
                                    activeTypes: [
                                      ...activeTypes,
                                      selectedType,
                                    ],
                                  };
                                  updateStepStatus(
                                    project.id,
                                    stepKey,
                                    {
                                      ...approvalData,
                                      rounds: newRounds,
                                    },
                                  );
                                }
                              }}
                              className="text-[10px] font-bold text-indigo-600 bg-indigo-50/75 hover:bg-indigo-100 px-2.5 py-1.5 rounded border border-indigo-100/30 transition-all h-[28px] outline-none cursor-pointer font-sans"
                            >
                              <option value="" disabled>
                                + Thêm nhóm đối tượng
                              </option>
                              {availableTypes
                                .filter(
                                  (t) =>
                                    !activeTypes.includes(
                                      t.value,
                                    ),
                                )
                                .map((t) => (
                                  <option
                                    key={t.value}
                                    value={t.value}
                                  >
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
                                ...approvalData,
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
                                ...approvalData,
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
                        placeholder="Ghi chú quyết định phê duyệt (xóm, tổ dân phố, hạng mục...)"
                        className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1 text-[10px] text-slate-700 outline-none placeholder-slate-400 font-semibold"
                        value={round.notes || ""}
                        onSave={(val) => {
                          const newRounds = [...roundsList];
                          newRounds[idx] = {
                            ...newRounds[idx],
                            notes: val,
                          };
                          updateStepStatus(project.id, stepKey, {
                            ...approvalData,
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
                          ...approvalData,
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
