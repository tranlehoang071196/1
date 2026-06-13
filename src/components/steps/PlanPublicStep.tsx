import React, { useState } from "react";
import { Trash2, Layers, Calendar, FileText, ChevronDown, ChevronUp, AlertCircle, CheckCircle2, Plus } from "lucide-react";
import { Project } from "../../types";
import { CustomDatePicker } from "../ui-primitives";
import { updateStepStatus, addRound, updateRound, removeRound } from "../../lib/projectService";
import { parseFormattedDate } from "./stepUtils";
import { DocumentLinkList } from "../DocumentLinkList";
import { cn } from "../../lib/utils";
import { toast } from "sonner";

interface PlanPublicStepProps {
  project: Project;
  stepKey: string;
  stepData: any;
  canEdit: boolean;
}

export const PlanPublicStep: React.FC<PlanPublicStepProps> = ({
  project,
  stepKey,
  stepData,
  canEdit,
}) => {
  const planPublicData = stepData as any;
  const rounds = planPublicData?.rounds || [];
  const [roundDeletingId, setRoundDeletingId] = useState<string | null>(null);
  const [expandedRounds, setExpandedRounds] = useState<Record<string, boolean>>({});

  const planDraftStep = (project.steps.plan_draft ||
    project.steps.agri_plan_draft ||
    project.steps.res_plan_draft) as any;
  const draftRounds = planDraftStep?.rounds || [];

  const parseToDate = (dStr?: string) => {
    if (!dStr) return null;
    const p = parseFormattedDate(dStr);
    if (!p) return null;
    return new Date(parseInt(p.year, 10), parseInt(p.month, 10) - 1, parseInt(p.day, 10));
  };

  const getListingDays = (startDateStr?: string, endDateStr?: string) => {
    const sDate = parseToDate(startDateStr);
    const eDate = parseToDate(endDateStr);
    if (!sDate || !eDate) return 0;
    const diffTime = eDate.getTime() - sDate.getTime();
    if (diffTime < 0) return 0;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // Inclusive of both days
  };

  const getStatusInfo = (startDateStr?: string, endDateStr?: string) => {
    const sDate = parseToDate(startDateStr);
    const eDate = parseToDate(endDateStr);
    if (!sDate || !eDate) return { text: "Chưa thiết lập liên kết ngày", color: "text-slate-500 bg-slate-50 border-slate-200" };

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (today.getTime() > eDate.getTime()) {
      const days = getListingDays(startDateStr, endDateStr);
      if (days < 20) {
        return {
          text: `Đã hoàn thành niêm yết (${days} ngày - Cảnh báo: Ít hơn 20 ngày)`,
          color: "text-amber-700 bg-amber-50 border-cyan-100",
          warning: true
        };
      }
      return { text: `Đã hoàn thành niêm yết (${days} ngày)`, color: "text-green-700 bg-green-50 border-green-200" };
    } else if (today.getTime() >= sDate.getTime() && today.getTime() <= eDate.getTime()) {
      return { text: "Đang niêm yết công khai tại địa bàn", color: "text-blue-700 bg-blue-50 border-blue-200 animate-pulse" };
    } else {
      return { text: "Chưa đến thời hạn công bố", color: "text-indigo-700 bg-indigo-50 border-indigo-200" };
    }
  };

  const handleAddRound = () => {
    addRound(project.id, stepKey, planPublicData);
  };

  const handleRemoveRound = (roundId: string) => {
    removeRound(project.id, stepKey, roundId, planPublicData);
    setRoundDeletingId(null);
  };

  const handleDateChange = (roundId: string, field: "startDate" | "endDate", val: string) => {
    const round = rounds.find((r: any) => r.id === roundId);
    if (!round) return;

    const proposedDates = {
      startDate: field === "startDate" ? val : (round.startDate || round.date || ""),
      endDate: field === "endDate" ? val : (round.endDate || "")
    };

    if (proposedDates.startDate && proposedDates.endDate) {
      const sDate = parseToDate(proposedDates.startDate);
      const eDate = parseToDate(proposedDates.endDate);
      if (sDate && eDate && sDate.getTime() > eDate.getTime()) {
        toast.warning("Lưu ý: Ngày bắt đầu niêm yết đang muộn hơn ngày kết thúc.");
      }
    }

    updateRound(
      project.id,
      stepKey,
      roundId,
      planPublicData,
      {
        [field]: val,
        ...(field === "startDate" ? { date: val } : {})
      }
    );
  };

  return (
    <div className="w-full space-y-5">
      <div className="w-full border-t border-slate-100 pt-1 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-600 uppercase tracking-wider leading-none select-none">
            📢 Quản lý các đợt niêm yết công khai phương án {rounds.length > 0 && `(${rounds.length})`}
          </div>
          {canEdit && (
            <button
              type="button"
              onClick={handleAddRound}
              className="text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100/80 px-4 py-2 rounded-xl border border-emerald-200/65 transition-all cursor-pointer shadow-3xs hover:shadow-2xs active:scale-98 select-none"
            >
              + Thêm đợt niêm yết mới
            </button>
          )}
        </div>

        {rounds.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50/30">
            <AlertCircle className="w-8 h-8 text-slate-300 mb-3" />
            <p className="text-xs font-bold text-slate-650">Chưa thiết lập đợt niêm yết nào.</p>
            <p className="text-[10.5px] text-slate-400 mt-1.5 max-w-sm">Niêm yết tối thiểu 20 ngày theo Điều 48 Luật Đất Đai để đủ điều kiện ra quyết định phê duyệt chính thức.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {rounds.map((round: any, idx: number) => {
              const rId = `${stepKey}_${round.id}`;
              const isExpanded = !!expandedRounds[rId];
              const draftMatch = draftRounds.find((r: any) => r.id === round.draftRoundId);
              const status = getStatusInfo(round.startDate || round.date, round.endDate);
              const isCurrentActive = status.text.includes("Đang niêm yết");

              const getRoundLabel = (r: any) => {
                const types = [];
                if (r.agriPlots > 0 || r.agriHouseholds > 0) types.push("NN");
                if (r.nonAgriPlots > 0 || r.nonAgriHouseholds > 0) types.push("Phi NN");
                if (r.orgs > 0) types.push("Tổ chức");
                if (r.assetHouseholds > 0 || r.asset_graves || r.asset_structures || r.asset_assets) types.push("Tài sản");
                if (types.length > 0) return types.join(", ");
                return `Phương án đợt ${draftRounds.indexOf(r) + 1}`;
              };

              return (
                <div
                  key={round.id}
                  className={cn(
                    "bg-white rounded-2xl border overflow-hidden shadow-xs transition-all duration-300",
                    isCurrentActive
                      ? "border-emerald-300 ring-2 ring-emerald-50/40 bg-gradient-to-br from-white to-emerald-50/5"
                      : isExpanded
                        ? "border-slate-300 shadow-sm border-l-4 border-l-emerald-555"
                        : "border-slate-200 hover:border-slate-300 hover:shadow-xs"
                  )}
                >
                  <div
                    className={cn(
                      "p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer transition-colors select-none",
                      isCurrentActive ? "hover:bg-emerald-50/10" : "hover:bg-slate-50/50"
                    )}
                    onClick={() =>
                      setExpandedRounds((prev) => ({
                        ...prev,
                        [rId]: !prev[rId],
                      }))
                    }
                  >
                    <div className="flex items-start gap-4">
                      <div className="mt-1 shrink-0">
                        {isCurrentActive ? (
                          <span className="relative flex h-5 w-5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-5 w-5 bg-emerald-600 flex items-center justify-center text-[10px] text-white font-bold leading-none animate-bounce">📢</span>
                          </span>
                        ) : (
                          <CheckCircle2 className={cn("w-5 h-5", status.warning ? "text-amber-500 animate-pulse" : "text-emerald-500")} />
                        )}
                      </div>
                      <div className="space-y-1">
                        {draftMatch ? (
                          <div className="text-[13px] font-bold text-slate-900 font-sans tracking-tight leading-snug">
                            Niêm yết phương án đợt {draftRounds.indexOf(draftMatch) + 1} {draftMatch.notes ? `- ${draftMatch.notes}` : ""} <span className="font-semibold text-slate-400 text-[11px] ml-1">[{getRoundLabel(draftMatch)}]</span>
                          </div>
                        ) : (
                          <div className="text-[13px] font-bold text-slate-550 font-sans italic">
                            {round.name || "Chưa chọn đợt lập phương án tương ứng"}
                          </div>
                        )}
                        {(round.startDate || round.date || round.endDate) && (
                          <div className="text-[10.5px] text-slate-500 flex flex-wrap items-center gap-1.5 pt-0.5">
                            <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Thời hạn:</span>
                            <span className="font-bold text-slate-705 bg-slate-100 px-2 py-0.5 rounded-md font-mono text-[10px]">{round.startDate || round.date || "..."}</span>
                            <span className="text-slate-400">đến</span>
                            <span className="font-bold text-slate-705 bg-slate-100 px-2 py-0.5 rounded-md font-mono text-[10px]">{round.endDate || "..."}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 ml-8 md:ml-auto shrink-0">
                      <span className={cn(
                        "text-[9.5px] font-extrabold uppercase px-2.5 py-1 rounded-full border tracking-wide whitespace-nowrap shadow-3xs",
                        status.color
                      )}>
                        {status.text}
                      </span>
                      {isExpanded ? <ChevronUp className="w-4.5 h-4.5 text-slate-400" /> : <ChevronDown className="w-4.5 h-4.5 text-slate-400" />}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-slate-100 bg-slate-50/30 p-5 space-y-4 animate-in fade-in duration-200">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[9.5px] font-black text-slate-400 uppercase tracking-wider block select-none">
                            Liên kết đợt lập phương án tương ứng
                          </label>
                          <select
                            value={round.draftRoundId || ""}
                            onChange={(e) => {
                              const val = e.target.value;
                              const matched = draftRounds.find((r: any) => r.id === val);
                              updateRound(
                                project.id,
                                stepKey,
                                round.id,
                                planPublicData,
                                {
                                  draftRoundId: val,
                                  name: matched
                                    ? `Niêm yết PA đợt: ${draftRounds.indexOf(matched) + 1}`
                                    : `Đợt ${idx + 1}`,
                                }
                              );
                            }}
                            disabled={!canEdit}
                            className="w-full bg-white border border-slate-200 hover:border-slate-300 rounded-xl px-3.5 py-1.5 text-xs font-bold text-slate-700 outline-none focus:border-blue-500 transition-all font-sans h-9 shadow-3xs select-none cursor-pointer"
                          >
                            <option value="">-- Chọn đợt PA --</option>
                            {draftRounds.map((draft: any, dIdx: number) => (
                              <option key={draft.id} value={draft.id}>
                                Đợt {dIdx + 1} {draft.notes ? `(${draft.notes})` : ""} - [{getRoundLabel(draft)}]
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <label className="text-[9.5px] font-black text-slate-400 uppercase tracking-wider block">
                              Từ ngày (Bắt đầu)
                            </label>
                            <CustomDatePicker
                              value={round.startDate || round.date || ""}
                              onChange={(val) => handleDateChange(round.id, "startDate", val)}
                              readOnly={!canEdit}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[9.5px] font-black text-slate-400 uppercase tracking-wider block">
                              Đến ngày (Kết thúc)
                            </label>
                            <CustomDatePicker
                              value={round.endDate || ""}
                              onChange={(val) => handleDateChange(round.id, "endDate", val)}
                              readOnly={!canEdit}
                            />
                          </div>
                        </div>
                      </div>

                      {status.warning && (
                        <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/50 flex items-start gap-2.5 text-[11px] text-amber-800 font-medium font-sans">
                          <AlertCircle className="w-5 h-5 text-amber-550 shrink-0 mt-0.5" />
                          <span>🚨 <strong>Cảnh báo pháp lý:</strong> Thời hạn niêm yết ít hơn 20 ngày làm việc. Quý ban cần rà soát lại quy định hoặc cập nhật chính xác Biên bản niêm yết để tránh các rủi ro khiếu nại, tranh chấp hoặc bồi thường chậm trễ sau này.</span>
                        </div>
                      )}

                      <div className="w-full border-t border-slate-100 pt-4">
                        <DocumentLinkList
                          links={round.links || []}
                          onChange={(newLinks) =>
                            updateRound(
                              project.id,
                              stepKey,
                              round.id,
                              planPublicData,
                              { links: newLinks }
                            )
                          }
                          labelTitle="Hồ sơ công việc (Biên bản niêm yết, Báo cáo kết thúc...):"
                          readOnly={!canEdit}
                        />
                      </div>

                      {canEdit && (
                        <div className="flex items-center justify-end pt-4 border-t border-slate-100">
                          {roundDeletingId === round.id ? (
                            <div className="flex items-center gap-1.5 bg-red-50 p-2 rounded-xl border border-red-100 shadow-2xs">
                              <span className="text-[9.5px] font-black text-red-700 uppercase px-1.5">Xác nhận xoá?</span>
                              <button
                                type="button"
                                onClick={() => handleRemoveRound(round.id)}
                                className="px-3 py-1.5 bg-red-650 text-white text-[9.5px] font-black rounded-lg shadow-sm hover:bg-red-700 hover:scale-103 active:scale-97 transition-all uppercase cursor-pointer"
                              >
                                Xoá
                              </button>
                              <button
                                type="button"
                                onClick={() => setRoundDeletingId(null)}
                                className="px-3 py-1.5 bg-white border border-slate-200 text-slate-650 text-[9.5px] font-bold rounded-lg shadow-sm hover:bg-slate-50 hover:scale-103 active:scale-97 transition-all uppercase cursor-pointer"
                              >
                                Huỷ
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setRoundDeletingId(round.id)}
                              className="flex items-center gap-1.5 text-[9.5px] font-extrabold text-red-505 hover:bg-red-50/80 hover:text-red-600 px-3.5 py-1.5 rounded-xl uppercase transition-all cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Xoá đợt niêm yết
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
