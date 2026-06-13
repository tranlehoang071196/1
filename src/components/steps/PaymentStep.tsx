import React, { useState } from "react";
import { Trash2, Layers, X, ChevronDown, ChevronUp, CircleDollarSign, Plus, ShieldAlert } from "lucide-react";
import { Project } from "../../types";
import { CustomDatePicker, NumberInput, CurrencyInput, EditableInput } from "../ui-primitives";
import { updateStepStatus, addRound, updateRound, removeRound } from "../../lib/projectService";
import { formatCount, getFlattenedRounds, parseFormattedDate } from "./stepUtils";
import { DocumentLinkList } from "../DocumentLinkList";
import { formatCurrency, cn } from "../../lib/utils";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

interface PaymentStepProps {
  project: Project;
  stepKey: string;
  stepData: any;
  canEdit: boolean;
}

export const PaymentStep: React.FC<PaymentStepProps> = ({
  project,
  stepKey,
  stepData,
  canEdit,
}) => {
  const paymentData = stepData as any;
  const rounds = paymentData?.rounds || [];

  // State to manage expanded/hover/deleting states localized inside this step
  const [expandedRounds, setExpandedRounds] = useState<Record<string, boolean>>({});
  const [roundDeletingId, setRoundDeletingId] = useState<string | null>(null);
  const [activeRoundId, setActiveRoundId] = useState<string | null>(null);

  // Reference inventory data to find original quantities
  const invStep = project.steps?.inventory as any;
  const invDoneAgriPlots = invStep?.agriPlots || 0;
  const invDoneAgriHouseholds = invStep?.agriHouseholds || 0;
  const invDoneNonAgriPlots = invStep?.nonAgriPlots || 0;
  const invDoneNonAgriHouseholds = invStep?.nonAgriHouseholds || 0;
  const invDoneOrgs = invStep?.orgs || 0;
  const invDoneAssetHouseholds = invStep?.assetHouseholds || 0;

  const assetItems = invStep?.assetItems || [
    { id: "graves", label: "Tài sản trên đất", value: invStep?.doneGraves || 0 },
    { id: "assets", label: "Tài sản khác (hộ)", value: invStep?.doneAssets || 0 },
    { id: "structures", label: "Vật kiến trúc (hộ)", value: invStep?.doneStructures || 0 },
  ];

  const hasInvAgri = invDoneAgriPlots > 0 || invDoneAgriHouseholds > 0;
  const hasInvNonAgri = invDoneNonAgriPlots > 0 || invDoneNonAgriHouseholds > 0;
  const hasInvOrg = invDoneOrgs > 0;
  const hasInvAsset = invDoneAssetHouseholds > 0 || assetItems.some((v: any) => v.value > 0);

  const availableTypes: { value: string; label: string }[] = [];
  if (hasInvAgri) availableTypes.push({ value: "agri", label: "🌾 Đất nông nghiệp" });
  if (hasInvNonAgri) availableTypes.push({ value: "non_agri", label: "🏠 Đất phi nông nghiệp" });
  if (hasInvOrg) availableTypes.push({ value: "org", label: "🏢 Tổ chức" });
  if (hasInvAsset) availableTypes.push({ value: "assets", label: "📦 Tài sản khác" });

  const defaultTargetType = availableTypes[0]?.value || "agri";

  const getAgriPlots = (r: any) => (r.agriPlots ?? (r.targetType === 'agri' ? r.donePlots : 0)) || 0;
  const getAgriHH = (r: any) => (r.agriHouseholds ?? (r.targetType === 'agri' ? r.doneHouseholds : 0)) || 0;
  const getNonAgriPlots = (r: any) => (r.nonAgriPlots ?? (r.targetType === 'non_agri' ? r.donePlots : 0)) || 0;
  const getNonAgriHH = (r: any) => (r.nonAgriHouseholds ?? (r.targetType === 'non_agri' ? r.doneHouseholds : 0)) || 0;
  const getOrgsVal = (r: any) => (r.orgs ?? (r.targetType === 'org' ? r.doneOrgs : 0)) || 0;
  const getAssetHH = (r: any) => (r.assetHouseholds ?? (r.targetType === 'assets' ? r.doneHouseholds : 0)) || 0;

  const getAssetItemVal = (r: any, itemId: string) => {
    const legacyAssetsVal = r.targetType === "assets"
      ? itemId === "graves"
        ? r.doneGraves
        : itemId === "assets"
          ? r.doneAssets
          : itemId === "structures"
            ? r.doneStructures
            : 0
      : 0;
    return (r[`asset_${itemId}`] ?? (r[itemId] !== undefined ? r[itemId] : legacyAssetsVal)) || 0;
  };

  const syncRoundTotals = (r: any) => {
    const p = (r.agriPlots || 0) + (r.nonAgriPlots || 0);
    const h = (r.agriHouseholds || 0) + (r.nonAgriHouseholds || 0) + (r.assetHouseholds || 0) + (r.orgs || 0);
    return {
      ...r,
      plots: p,
      households: h,
    };
  };

  // Find approval statistics
  const approvalStep = project.steps?.approval as any;
  const approvalRounds = approvalStep?.rounds || [];

  const totalApprovedAmount = approvalRounds.reduce((acc: number, r: any) => Number(acc) + Number(r.amount || 0), 0);
  const totalApprovedCost = approvalRounds.reduce((acc: number, r: any) => Number(acc) + Number(r.cost || 0), 0);
  const totalPaidAmount = rounds.reduce((acc: number, r: any) => Number(acc) + Number(r.amount || 0), 0);

  const doneAgriPlots = rounds.reduce((acc: number, r: any) => Number(acc) + Number(getAgriPlots(r)), 0);
  const doneAgriHH = rounds.reduce((acc: number, r: any) => Number(acc) + Number(getAgriHH(r)), 0);
  const doneNonAgriPlots = rounds.reduce((acc: number, r: any) => Number(acc) + Number(getNonAgriPlots(r)), 0);
  const doneNonAgriHH = rounds.reduce((acc: number, r: any) => Number(acc) + Number(getNonAgriHH(r)), 0);
  const doneOrgs = rounds.reduce((acc: number, r: any) => Number(acc) + Number(getOrgsVal(r)), 0);
  const doneAssetHH = rounds.reduce((acc: number, r: any) => Number(acc) + Number(getAssetHH(r)), 0);

  return (
    <div className="flex flex-col gap-4 mt-2 w-full font-sans">
      {/* KPI Dashboard for Payment Step */}
      <div className="border border-slate-200/90 rounded-2xl bg-slate-50/40 p-4.5 space-y-3 shadow-3xs">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block select-none">
          Tiến độ và ngân sách chi trả
        </span>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5 pl-2 border-l-2 border-emerald-500">
            <span className="text-[9.5px] font-black text-slate-400 uppercase block select-none">
              Tiến độ chi hoàn tất:
            </span>
            <div className="space-y-1 select-none">
              {hasInvAgri && (
                <div className="text-[11.5px] text-slate-755 font-medium flex items-center gap-1.5">
                  🌾 <span className="text-slate-500 font-sans">Đất nông nghiệp:</span>
                  <strong className="text-emerald-700">
                    {formatCount(doneAgriPlots)} thửa (thuộc {formatCount(doneAgriHH)} hộ)
                  </strong>
                </div>
              )}
              {hasInvNonAgri && (
                <div className="text-[11.5px] text-slate-755 font-medium flex items-center gap-1.5">
                  🏠 <span className="text-slate-500 font-sans">Đất phi nông nghiệp:</span>
                  <strong className="text-emerald-700">
                    {formatCount(doneNonAgriPlots)} thửa (thuộc {formatCount(doneNonAgriHH)} hộ)
                  </strong>
                </div>
              )}
              {hasInvOrg && (
                <div className="text-[11.5px] text-slate-755 font-medium flex items-center gap-1.5">
                  🏢 <span className="text-slate-500 font-sans">Tổ chức:</span>
                  <strong className="text-emerald-700">{formatCount(doneOrgs)} tổ chức</strong>
                </div>
              )}
              {hasInvAsset && (
                <div className="text-[11.5px] text-slate-755 font-medium flex items-center gap-1.5">
                  📦 <span className="text-slate-500 font-sans">Tài sản khác:</span>
                  <strong className="text-emerald-700">thuộc {formatCount(doneAssetHH)} hộ</strong>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2 pl-2 border-l-2 border-indigo-500 bg-white/40 p-2.5 rounded-lg border border-slate-100/50">
            <span className="text-[9.5px] font-black text-slate-400 uppercase flex items-center gap-1 select-none">
              <CircleDollarSign className="w-3.5 h-3.5 text-indigo-500" />
              Tỷ lệ giải ngân bồi thường:
            </span>
            <div className="flex flex-col gap-1">
              <div className="text-sm font-semibold text-slate-805 flex items-baseline gap-1 select-none">
                <span className="text-indigo-700 font-extrabold font-mono text-base">
                  {formatCurrency(totalPaidAmount).replace(" đồng", "")}
                </span>
                <span className="text-slate-400 text-xs">/</span>
                <span className="text-slate-500 text-xs font-mono">
                  {formatCurrency(totalApprovedAmount).replace(" đồng", "")} VNĐ
                </span>
              </div>
              
              {/* Progress bar */}
              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden mt-1 flex">
                <div
                  className="bg-indigo-600 h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${totalApprovedAmount > 0 ? Math.min(100, Math.round((totalPaidAmount / totalApprovedAmount) * 100)) : 0}%`,
                  }}
                />
              </div>

              <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold mt-0.5 select-none animate-in fade-in">
                <span>ĐÃ CHI TRẢ</span>
                <span>
                  {totalApprovedAmount > 0 ? Math.round((totalPaidAmount / totalApprovedAmount) * 100) : 0}%
                </span>
              </div>

              {totalPaidAmount > totalApprovedAmount && (
                <div className="bg-rose-50 border border-rose-200 rounded-lg p-2.5 mt-3.5 flex items-start gap-2 text-rose-800 text-[10.5px] leading-relaxed animate-in slide-in-from-top-1">
                  <ShieldAlert className="w-4 h-4 text-rose-500 shrink-0 mt-0.5 animate-bounce" />
                  <div>
                    <span className="font-bold block text-rose-955 select-none">⚡ Cảnh báo vượt hạn ngạch ngân sách:</span>
                    Tổng giá trị chi trả thực tế ({formatCurrency(totalPaidAmount).replace(" đồng", "")} VNĐ) hiện đã vượt quá tổng số ngân sách giải ngân được phê duyệt tối đa ({formatCurrency(totalApprovedAmount).replace(" đồng", "")} VNĐ).
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main List Management Container */}
      <div className="w-full space-y-4">
        <div className="w-full pt-1 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-650 uppercase tracking-wider select-none">
              <Layers className="w-4 h-4 text-emerald-500" />
              Các đợt chi trả tiền bồi thường
            </div>
            {canEdit && (
              <button
                onClick={() => {
                  const newRoundId = Math.random()
                    .toString(36)
                    .substring(2, 11);
                  const currentRounds = paymentData?.rounds || [];
                  const newItem = {
                    id: newRoundId,
                    targetType: defaultTargetType || "agri",
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
                    ...paymentData,
                    rounds: [...currentRounds, newItem],
                  });
                  setActiveRoundId(newRoundId);
                  setExpandedRounds((p) => ({ ...p, [`${stepKey}_${newRoundId}`]: true }));
                }}
                className="text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100/80 px-4 py-2 rounded-xl border border-emerald-200/65 transition-all cursor-pointer shadow-3xs hover:shadow-2xs active:scale-98 select-none h-9 flex items-center gap-1 font-sans"
              >
                + Thêm đợt chi trả
              </button>
            )}
          </div>

          {/* Premium Pill Switched Tabs */}
          {rounds.length > 0 && (
            <div className="p-1 rounded-2xl bg-slate-100 border border-slate-200 flex flex-wrap gap-1.5 mb-2 shadow-3xs">
              {rounds.map((r: any, rIdx: number) => {
                const isSelected = r.id === (activeRoundId || rounds[0]?.id);
                return (
                  <button
                    key={r.id || rIdx}
                    onClick={() => {
                      setActiveRoundId(r.id);
                      setExpandedRounds((p) => ({ ...p, [`${stepKey}_${r.id}`]: true }));
                    }}
                    type="button"
                    className={`flex items-center gap-2 px-4 py-1.5 rounded-xl text-xs font-bold tracking-wide transition-all duration-200 cursor-pointer select-none font-sans ${
                      isSelected
                        ? "bg-white text-emerald-700 shadow-sm border border-slate-200/80"
                        : "bg-transparent border border-transparent text-slate-500 hover:text-slate-900 hover:bg-white/50"
                    }`}
                  >
                    <span className={`relative flex h-2 w-2 rounded-full ${isSelected ? "bg-emerald-555" : "bg-slate-300"}`}>
                      {isSelected && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-65"></span>}
                    </span>
                    <span>CHI TRẢ ĐỢT {rIdx + 1}</span>
                    {r.amount > 0 && (
                      <span className={`text-[10px] font-semibold font-mono ${isSelected ? "text-emerald-600" : "text-emerald-500/70"}`}>
                        ({formatCurrency(r.amount).replace(" đồng", "")})
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          <div className="space-y-4">
            {rounds.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-400 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200/80 italic select-none">
                Chưa có đợt chi trả nào được tạo. Vui lòng bấm "+ Thêm đợt chi trả" để tạo mới.
              </div>
            ) : (
              rounds
                .filter((r: any) => r.id === (activeRoundId || rounds[0]?.id))
                .map((round: any) => {
                  const idx = rounds.indexOf(round);
                  const roundId = `${stepKey}_${round.id}`;
                  const isExpanded = expandedRounds[roundId] !== false; // Active đợt thì mặc định mở rộng

                  // Seek corresponding approval round
                  const matched = approvalRounds.find((r: any) => r.id === round.approvalRoundId);

                // Calculations of remaining values
                const otherRounds = rounds.filter((r: any) => r.id !== round.id);
                const otherRoundsOfSameDecision = otherRounds.filter(
                  (r: any) => r.approvalRoundId === round.approvalRoundId
                );

                const sumPaidAgriPlots = otherRoundsOfSameDecision.reduce((acc: number, r: any) => Number(acc) + Number(r.agriPlots || 0), 0);
                const sumPaidAgriHH = otherRoundsOfSameDecision.reduce((acc: number, r: any) => Number(acc) + Number(r.agriHouseholds || 0), 0);
                const sumPaidNonAgriPlots = otherRoundsOfSameDecision.reduce((acc: number, r: any) => Number(acc) + Number(r.nonAgriPlots || 0), 0);
                const sumPaidNonAgriHH = otherRoundsOfSameDecision.reduce((acc: number, r: any) => Number(acc) + Number(r.nonAgriHouseholds || 0), 0);
                const sumPaidOrgs = otherRoundsOfSameDecision.reduce((acc: number, r: any) => Number(acc) + Number(r.orgs || 0), 0);
                const sumPaidAssetHH = otherRoundsOfSameDecision.reduce((acc: number, r: any) => Number(acc) + Number(r.assetHouseholds || 0), 0);

                const maxAgriPlots = Math.max(0, matched ? getAgriPlots(matched) - sumPaidAgriPlots : 0);
                const maxAgriHH = Math.max(0, matched ? getAgriHH(matched) - sumPaidAgriHH : 0);
                const maxNonAgriPlots = Math.max(0, matched ? getNonAgriPlots(matched) - sumPaidNonAgriPlots : 0);
                const maxNonAgriHH = Math.max(0, matched ? getNonAgriHH(matched) - sumPaidNonAgriHH : 0);
                const maxOrgs = Math.max(0, matched ? getOrgsVal(matched) - sumPaidOrgs : 0);
                const maxAssetHH = Math.max(0, matched ? getAssetHH(matched) - sumPaidAssetHH : 0);

                const sumPaidAmount = otherRoundsOfSameDecision.reduce((acc: number, r: any) => Number(acc) + Number(r.amount || 0), 0);
                const maxAmountAllowed = matched ? Math.max(0, (matched.amount || 0) - sumPaidAmount) : Infinity;

                return (
                  <div
                    key={round.id}
                    className={cn(
                      "bg-white rounded-2xl border transition-all duration-300 shadow-xs overflow-hidden",
                      isExpanded
                        ? "border-slate-300 border-l-4 border-l-emerald-500 shadow-sm"
                        : "border-slate-200 hover:border-slate-300"
                    )}
                  >
                    {/* Header Row */}
                    <div
                      className="p-3.5 flex items-center justify-between cursor-pointer hover:bg-slate-50/50 transition-colors"
                      onClick={() =>
                        setExpandedRounds((prev) => ({
                          ...prev,
                          [roundId]: !prev[roundId],
                        }))
                      }
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            "w-1.5 h-1.5 rounded-full",
                            round.paymentDate || round.date ? "bg-emerald-500" : "bg-emerald-500"
                          )}
                        />
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 select-none">
                          <span className="text-[11.5px] font-bold text-slate-755 font-sans">
                            Đợt chi trả: <span className="text-emerald-700">Đợt {idx + 1}</span>
                          </span>
                          {(round.paymentDate || round.date) && (
                            <span className="text-[10px] text-slate-400 font-normal font-sans">
                              • Ngày chi trả:{" "}
                              <span className="font-semibold text-slate-600 font-mono">
                                {round.paymentDate || round.date}
                              </span>
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 select-none">
                        {round.amount > 0 && (
                          <div className="flex flex-col items-end text-right">
                            <span className="text-[10px] font-extrabold text-emerald-600 font-mono">
                              {formatCurrency(round.amount).replace(" đồng", "")}
                            </span>
                          </div>
                        )}
                        <div>
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-slate-400" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-slate-400" />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Expandable Section */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: "auto" }}
                          exit={{ height: 0 }}
                          className="overflow-hidden bg-slate-50/20 border-t border-slate-100"
                        >
                          <div className="p-4 space-y-4">
                            {/* Quyết định phê duyệt liên kết */}
                            <div className="p-4 bg-white border border-slate-200 rounded-2xl mb-4 shadow-3xs hover:border-slate-300 transition-all">
                              <div className="space-y-2">
                                <label className="text-[9.5px] font-bold text-slate-500 uppercase tracking-wider block font-sans select-none">
                                  Quyết định phê duyệt bồi thường, hỗ trợ, TĐC
                                </label>
                                <select
                                  disabled={!canEdit}
                                  className="w-full bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-705 outline-none font-sans transition-all h-9 cursor-pointer shadow-3xs"
                                  value={round.approvalRoundId || ""}
                                  onChange={(e) => {
                                    const selectedId = e.target.value;
                                    const matchedSel = approvalRounds.find(
                                      (r: any) => r.id === selectedId
                                    );
                                    const nameVal = matchedSel
                                      ? `QĐ số: ${matchedSel.decisionNo || "..."}`
                                      : `Đợt ${idx + 1}`;
                                    updateRound(
                                      project.id,
                                      stepKey,
                                      round.id,
                                      paymentData,
                                      {
                                        approvalRoundId: selectedId,
                                        name: nameVal,
                                      }
                                    );
                                  }}
                                >
                                  <option value="">
                                    -- Chọn quyết định phê duyệt --
                                  </option>
                                  {approvalRounds.map((r: any, rIdx: number) => {
                                    const dateInfo = parseFormattedDate(r.approvalDate || r.date);
                                    const dayStr = dateInfo?.day || "...";
                                    const monthStr = dateInfo?.month || "...";
                                    const yearStr = dateInfo?.year || "...";

                                    const rawLocation = r.approvalArea || "";
                                    let finalLocation = "...";
                                    if (rawLocation) {
                                      const lower = rawLocation.toLowerCase();
                                      const idxLoc = lower.indexOf("ubnd");
                                      if (idxLoc !== -1) {
                                        finalLocation = rawLocation.substring(idxLoc + 4).trim() || "...";
                                      } else {
                                        finalLocation = rawLocation;
                                      }
                                    }
                                    return (
                                      <option key={r.id || rIdx} value={r.id}>
                                        Số {r.decisionNo || "..."}/QĐ-UBND - {finalLocation}, ngày {dayStr} tháng {monthStr} năm {yearStr}
                                      </option>
                                    );
                                  })}
                                </select>

                                {round.approvalRoundId ? (
                                  matched ? (
                                    <div className="text-xs font-medium text-slate-700 mt-3 flex flex-col gap-2 bg-slate-50/50 p-4 rounded-xl border border-slate-250/20 font-sans shadow-3xs w-full">
                                      <div className="text-slate-400 text-[9.5px] font-bold uppercase tracking-wider select-none">
                                        Thông tin quyết định:
                                      </div>
                                      <span className="text-slate-700 text-[10.5px]">
                                        • Số QĐ:{" "}
                                        <strong className="text-blue-700 font-bold">
                                          {matched.decisionNo || "..."}/QĐ-UBND
                                        </strong>
                                      </span>
                                      <span className="text-[10.5px]">
                                        • Tiền bồi thường, hỗ trợ:{" "}
                                        <strong className="text-emerald-705 font-bold font-mono">
                                          {formatCurrency(matched.amount || 0)}
                                        </strong>
                                      </span>
                                      {!!matched.cost && matched.cost > 0 && (
                                        <span className="text-[10.5px]">
                                          • Chi phí thực hiện bồi thường:{" "}
                                          <strong className="text-blue-600 font-semibold font-mono">
                                            {formatCurrency(matched.cost)}
                                          </strong>
                                        </span>
                                      )}
                                      <span className="text-[10.5px]">
                                        • Quy mô:{" "}
                                        <strong className="text-slate-700 font-bold">
                                          {matched.plots || 0} thửa / {matched.households || 0} hộ
                                        </strong>
                                      </span>
                                      {matched.links && matched.links.length > 0 && (
                                        <div className="mt-1.5 border-t border-slate-100 pt-1.5 w-full">
                                          <div className="text-[9.5px] text-slate-455 font-bold uppercase mb-1.5 select-none">
                                            Hồ sơ đính kèm (QĐ):
                                          </div>
                                          <div className="space-y-1">
                                            {matched.links.map((lnk: any, lIdx: number) => (
                                              <a
                                                key={lIdx}
                                                href={lnk.url}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="text-[10px] text-emerald-600 hover:text-emerald-700 hover:underline flex items-center gap-1 font-semibold"
                                              >
                                                📎 {lnk.name || "Tải tài liệu"}
                                              </a>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-md text-[10.5px] text-amber-700 font-bold flex items-center gap-1.5 mt-2 font-sans select-none">
                                      <span>
                                        ⚠️ Quyết định phê duyệt tham chiếu đã bị xóa hoặc không còn tồn tại! Vui lòng chọn quyết định khác.
                                      </span>
                                    </div>
                                  )
                                ) : (
                                  <div className="text-[10px] text-slate-400 italic mt-1 font-sans">
                                    Vui lòng chọn quyết định để đối soát và tự động đồng bộ dữ liệu.
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Target Groups Section */}
                            <div className="space-y-2 pb-3.5 border-b border-slate-100 mb-3">
                              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block font-sans select-none">
                                Nhóm đối tượng chi trả đợt này
                              </div>

                              {(() => {
                                const activeTypes = (() => {
                                  if (round.activeTypes) return round.activeTypes as string[];
                                  const inferred = [];
                                  if (getAgriPlots(round) > 0 || getAgriHH(round) > 0) inferred.push("agri");
                                  if (getNonAgriPlots(round) > 0 || getNonAgriHH(round) > 0) inferred.push("non_agri");
                                  if (getOrgsVal(round) > 0) inferred.push("org");

                                  const hasAssetCount = assetItems.some((item: any) => {
                                    const valInRound = round[`asset_${item.id}`] ?? round[item.id] ?? 0;
                                    return valInRound > 0;
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
                                        className="flex flex-wrap items-center gap-3.5 bg-slate-50/60 p-3 rounded-2xl border border-slate-200/70 w-full xl:w-auto relative group shadow-3xs transition-all hover:bg-slate-50 hover:border-slate-350"
                                      >
                                        <div className="flex items-center gap-1.5 min-w-[170px]">
                                          <select
                                            disabled={!canEdit}
                                            value={typeVal}
                                            onChange={(e) => {
                                              const newType = e.target.value;
                                              const oldType = activeTypes[typeIdx];

                                              let roundCopy = { ...round };
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

                                              const oldActive = [...activeTypes];
                                              oldActive[typeIdx] = newType;
                                              roundCopy.activeTypes = oldActive;
                                              roundCopy = syncRoundTotals(roundCopy);
                                              updateRound(
                                                project.id,
                                                stepKey,
                                                round.id,
                                                paymentData,
                                                roundCopy
                                              );
                                            }}
                                            className="bg-white border border-slate-200 rounded-xl px-2.5 py-1 text-[10.5px] font-bold text-slate-700 outline-none focus:border-emerald-500 hover:border-slate-350 transition-all uppercase tracking-tight min-w-[160px] font-sans h-8 shadow-3xs cursor-pointer"
                                          >
                                            {availableTypes.map((t) => (
                                              <option
                                                key={t.value}
                                                value={t.value}
                                                disabled={activeTypes.includes(t.value) && t.value !== typeVal}
                                              >
                                                {t.label.toUpperCase()}
                                              </option>
                                            ))}
                                          </select>
                                        </div>

                                        {typeVal === "agri" && (
                                          <div className="flex items-center gap-3">
                                            <div className="flex items-center gap-1.5 font-sans">
                                              <NumberInput
                                                className="w-16 h-8 text-center bg-white border border-slate-200 hover:border-slate-350 focus:border-emerald-500 transition-colors rounded-xl px-1.5 py-0.5 text-[11px] font-bold text-slate-800 outline-none font-mono shadow-3xs"
                                                placeholder="Thửa"
                                                value={getAgriPlots(round)}
                                                tooltipText={`Còn lại ${matched ? getAgriPlots(matched) : 0} thửa`}
                                                onChange={(val) => {
                                                  if (matched && val > maxAgriPlots) {
                                                    toast.warning(
                                                      `Số thửa chi trả không được vượt quá số thửa chưa chi trả của quyết định (${maxAgriPlots})`
                                                    );
                                                    return;
                                                  }
                                                  const roundCopy = syncRoundTotals({
                                                    ...round,
                                                    agriPlots: val,
                                                  });
                                                  updateRound(project.id, stepKey, round.id, paymentData, roundCopy);
                                                }}
                                                readOnly={!canEdit}
                                              />
                                            </div>
                                            <div className="flex items-center gap-1.5 font-sans">
                                              <NumberInput
                                                className="w-16 h-8 text-center bg-white border border-slate-200 hover:border-slate-350 focus:border-emerald-500 transition-colors rounded-xl px-1.5 py-0.5 text-[11px] font-bold text-slate-800 outline-none font-mono shadow-3xs"
                                                placeholder="Hộ"
                                                value={getAgriHH(round)}
                                                tooltipText={`Còn lại ${matched ? getAgriHH(matched) : 0} hộ`}
                                                onChange={(val) => {
                                                  if (matched && val > maxAgriHH) {
                                                    toast.warning(
                                                      `Số hộ chi trả không được vượt quá số hộ chưa chi trả của quyết định (${maxAgriHH})`
                                                    );
                                                    return;
                                                  }
                                                  const roundCopy = syncRoundTotals({
                                                    ...round,
                                                    agriHouseholds: val,
                                                  });
                                                  updateRound(project.id, stepKey, round.id, paymentData, roundCopy);
                                                }}
                                                readOnly={!canEdit}
                                              />
                                            </div>
                                          </div>
                                        )}

                                        {typeVal === "non_agri" && (
                                          <div className="flex items-center gap-3">
                                            <div className="flex items-center gap-1.5 font-sans">
                                              <NumberInput
                                                className="w-16 h-8 text-center bg-white border border-slate-200 hover:border-slate-350 focus:border-emerald-500 transition-colors rounded-xl px-1.5 py-0.5 text-[11px] font-bold text-slate-800 outline-none font-mono shadow-3xs"
                                                placeholder="Thửa"
                                                value={getNonAgriPlots(round)}
                                                tooltipText={`Còn lại ${matched ? getNonAgriPlots(matched) : 0} thửa`}
                                                onChange={(val) => {
                                                  if (matched && val > maxNonAgriPlots) {
                                                    toast.warning(
                                                      `Số thửa chi trả không được vượt quá số thửa chưa chi trả của quyết định (${maxNonAgriPlots})`
                                                    );
                                                    return;
                                                  }
                                                  const roundCopy = syncRoundTotals({
                                                    ...round,
                                                    nonAgriPlots: val,
                                                  });
                                                  updateRound(project.id, stepKey, round.id, paymentData, roundCopy);
                                                }}
                                                readOnly={!canEdit}
                                              />
                                            </div>
                                            <div className="flex items-center gap-1.5 font-sans">
                                              <NumberInput
                                                className="w-16 h-8 text-center bg-white border border-slate-200 hover:border-slate-350 focus:border-emerald-505 transition-colors rounded-xl px-1.5 py-0.5 text-[11px] font-bold text-slate-800 outline-none font-mono shadow-3xs"
                                                placeholder="Hộ"
                                                value={getNonAgriHH(round)}
                                                tooltipText={`Còn lại ${matched ? getNonAgriHH(matched) : 0} hộ`}
                                                onChange={(val) => {
                                                  if (matched && val > maxNonAgriHH) {
                                                    toast.warning(
                                                      `Số hộ chi trả không được vượt quá số hộ chưa chi trả của quyết định (${maxNonAgriHH})`
                                                    );
                                                    return;
                                                  }
                                                  const roundCopy = syncRoundTotals({
                                                    ...round,
                                                    nonAgriHouseholds: val,
                                                  });
                                                  updateRound(project.id, stepKey, round.id, paymentData, roundCopy);
                                                }}
                                                readOnly={!canEdit}
                                              />
                                            </div>
                                          </div>
                                        )}

                                        {typeVal === "org" && (
                                          <div className="flex items-center gap-1.5 font-sans">
                                            <NumberInput
                                              className="w-16 h-8 text-center bg-white border border-slate-200 hover:border-slate-350 focus:border-emerald-500 transition-colors rounded-xl px-1.5 py-0.5 text-[11px] font-bold text-slate-800 outline-none font-mono shadow-3xs"
                                              placeholder="Tổ chức"
                                              value={getOrgsVal(round)}
                                              tooltipText={`Còn lại ${matched ? getOrgsVal(matched) : 0} tổ chức`}
                                              onChange={(val) => {
                                                if (matched && val > maxOrgs) {
                                                  toast.warning(
                                                    `Số tổ chức chi trả không được vượt quá số tổ chức chưa chi trả của quyết định (${maxOrgs})`
                                                  );
                                                  return;
                                                }
                                                const roundCopy = syncRoundTotals({
                                                  ...round,
                                                  orgs: val,
                                                });
                                                updateRound(project.id, stepKey, round.id, paymentData, roundCopy);
                                              }}
                                              readOnly={!canEdit}
                                            />
                                          </div>
                                        )}

                                        {typeVal === "assets" && (
                                          <div className="flex flex-col gap-2 w-full mt-1.5 border-t border-slate-100/70 pt-2 font-sans">
                                            <div className="flex items-center gap-3">
                                              <div className="flex items-center gap-1.5">
                                                <NumberInput
                                                  className="w-16 h-8 text-center bg-white border border-slate-200 hover:border-slate-350 focus:border-emerald-500 transition-colors rounded-xl px-1.5 py-0.5 text-[11px] font-bold text-slate-800 outline-none font-mono shadow-3xs"
                                                  placeholder="Hộ"
                                                  value={getAssetHH(round)}
                                                  tooltipText={`Còn lại ${matched ? getAssetHH(matched) : 0} hộ có tài sản`}
                                                  onChange={(val) => {
                                                    if (matched && val > maxAssetHH) {
                                                      toast.warning(
                                                        `Số hộ có tài sản chi trả không được vượt quá số hộ chưa chi trả của quyết định (${maxAssetHH})`
                                                      );
                                                      return;
                                                    }
                                                    const roundCopy = syncRoundTotals({
                                                      ...round,
                                                      assetHouseholds: val,
                                                    });
                                                    updateRound(project.id, stepKey, round.id, paymentData, roundCopy);
                                                  }}
                                                  readOnly={!canEdit}
                                                />
                                              </div>
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 bg-slate-100/50 p-2 rounded-xl border border-slate-200/40">
                                              {assetItems.map((item: any) => {
                                                const valInRound = getAssetItemVal(round, item.id);
                                                const maxValInMatched = matched ? getAssetItemVal(matched, item.id) : 0;
                                                const otherPaidOfItem = otherRoundsOfSameDecision.reduce(
                                                  (acc: number, r: any) => acc + getAssetItemVal(r, item.id),
                                                  0
                                                );
                                                const maxItemSum = Math.max(0, maxValInMatched - otherPaidOfItem);

                                                return (
                                                  <div
                                                    key={item.id}
                                                    className="flex items-center justify-between gap-1 bg-white p-1.5 rounded-xl border border-slate-200/50"
                                                  >
                                                    <span className="text-[9.5px] font-bold text-slate-500 truncate select-none">
                                                      {item.label}
                                                    </span>
                                                    <div className="flex items-center gap-1">
                                                      <NumberInput
                                                        className="w-12 h-6 text-center bg-slate-50 border border-slate-200 rounded text-[9.5px] font-bold text-slate-800 outline-none font-mono"
                                                        value={valInRound}
                                                        tooltipText={`Còn lại ${maxValInMatched}`}
                                                        onChange={(val) => {
                                                          if (matched && val > maxItemSum) {
                                                            toast.warning(
                                                              `Số lượng ${item.label} chi trả không được vượt quá số lượng chưa chi trả của quyết định (${maxItemSum})`
                                                            );
                                                            return;
                                                          }
                                                          const roundCopy = syncRoundTotals({
                                                            ...round,
                                                            [`asset_${item.id}`]: val,
                                                            [item.id]: val,
                                                          });
                                                          updateRound(
                                                            project.id,
                                                            stepKey,
                                                            round.id,
                                                            paymentData,
                                                            roundCopy
                                                          );
                                                        }}
                                                        readOnly={!canEdit}
                                                      />
                                                    </div>
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          </div>
                                        )}

                                        {/* Gỡ nhóm đối tượng */}
                                        {canEdit && activeTypes.length > 1 && (
                                          <button
                                            onClick={() => {
                                              let roundCopy = { ...round };
                                              const typeToRemove = typeVal;
                                              if (typeToRemove === "agri") {
                                                roundCopy.agriPlots = 0;
                                                roundCopy.agriHouseholds = 0;
                                              } else if (typeToRemove === "non_agri") {
                                                roundCopy.nonAgriPlots = 0;
                                                roundCopy.nonAgriHouseholds = 0;
                                              } else if (typeToRemove === "org") {
                                                roundCopy.orgs = 0;
                                              } else if (typeToRemove === "assets") {
                                                roundCopy.assetHouseholds = 0;
                                                assetItems.forEach((item: any) => {
                                                  roundCopy[`asset_${item.id}`] = 0;
                                                  roundCopy[item.id] = 0;
                                                });
                                              }

                                              const newActive = activeTypes.filter((t) => t !== typeToRemove);
                                              roundCopy.activeTypes = newActive;
                                              roundCopy = syncRoundTotals(roundCopy);
                                              updateRound(project.id, stepKey, round.id, paymentData, roundCopy);
                                            }}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-red-50 text-slate-350 hover:text-red-500 rounded-xl sm:opacity-0 group-hover:opacity-100 transition-all border border-transparent hover:border-red-100"
                                            title="Gỡ nhóm đối tượng này"
                                          >
                                            <X className="w-3.5 h-3.5" />
                                          </button>
                                        )}
                                      </div>
                                    ))}

                                    {/* Thêm nhóm đối tượng */}
                                    {canEdit && activeTypes.length < availableTypes.length && (
                                      <select
                                        disabled={!canEdit}
                                        value=""
                                        onChange={(e) => {
                                          const selectedType = e.target.value;
                                          if (selectedType) {
                                            const roundCopy = {
                                              ...round,
                                              activeTypes: [...activeTypes, selectedType],
                                            };
                                            updateRound(project.id, stepKey, round.id, paymentData, roundCopy);
                                          }
                                        }}
                                        className="text-[10.5px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-xl border border-indigo-200/50 transition-all h-8.5 mt-1 outline-none cursor-pointer shadow-3xs"
                                      >
                                        <option value="" disabled>
                                          + Thêm nhóm đối tượng
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
                            </div>

                            {/* Ngày chi trả & Số tiền chi trả */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3">
                              <div className="space-y-1.5">
                                <label className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider block font-sans select-none">
                                  Ngày chi trả tiền
                                </label>
                                <CustomDatePicker
                                  value={round.paymentDate || round.date || ""}
                                  onChange={(val) =>
                                    updateRound(project.id, stepKey, round.id, paymentData, {
                                      paymentDate: val,
                                      date: val,
                                    })
                                  }
                                  readOnly={!canEdit}
                                />
                              </div>
                              <div className="space-y-1.5">
                                <label className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider block font-sans select-none">
                                  Số tiền chi trả BT, HT
                                </label>
                                <CurrencyInput
                                  readOnly={!canEdit}
                                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-emerald-700 text-right font-sans hover:border-slate-350 focus:border-emerald-500 transition-all shadow-3xs h-9"
                                  value={round.amount || 0}
                                  onChange={(val) => {
                                    if (matched && val > maxAmountAllowed) {
                                      toast.warning(
                                        `Số tiền chi trả không được vượt quá số còn lại chưa chi trả của quyết định (${formatCurrency(maxAmountAllowed)})`
                                      );
                                      return;
                                    }
                                    updateRound(project.id, stepKey, round.id, paymentData, { amount: val });
                                  }}
                                />
                              </div>
                            </div>

                            {/* Links/Attachments Management */}
                            <div className="w-full border-t border-slate-200/60 pt-4">
                              <DocumentLinkList
                                links={round.links || []}
                                onChange={(newLinks) =>
                                  updateRound(project.id, stepKey, round.id, paymentData, { links: newLinks })
                                }
                                labelTitle="Hồ sơ công việc (Links) của đợt:"
                                readOnly={!canEdit}
                              />
                            </div>

                            {/* Delete Round Options */}
                            {canEdit && (
                              <div className="flex items-center justify-end pt-3 border-t border-slate-200/60 mt-4 select-none">
                                {roundDeletingId === round.id ? (
                                  <div className="flex items-center gap-2 bg-rose-50 p-2 rounded-xl border border-rose-100 animate-in fade-in zoom-in-95">
                                    <span className="text-[10px] font-bold text-rose-750 uppercase px-1">
                                      Xác nhận xoá đợt này?
                                    </span>
                                    <button
                                      onClick={() => {
                                        removeRound(project.id, stepKey, round.id, paymentData);
                                        toast.success("Đã xoá đợt thành công");
                                        setRoundDeletingId(null);
                                      }}
                                      className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-[10.5px] px-3.5 py-1.5 text-center cursor-pointer shadow-3xs transition-all"
                                    >
                                      XOÁ
                                    </button>
                                    <button
                                      onClick={() => setRoundDeletingId(null)}
                                      className="bg-slate-200 hover:bg-slate-300 text-slate-705 rounded-xl font-bold text-[10.5px] px-3 py-1.5 text-center cursor-pointer shadow-3xs transition-all"
                                    >
                                      HỦY
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => setRoundDeletingId(round.id)}
                                    className="text-xs font-bold text-slate-400 hover:text-red-500 flex items-center gap-1.5 hover:bg-red-50/50 px-3 py-1.5 rounded-xl transition-all cursor-pointer"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                    Xoá đợt chi trả này
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
