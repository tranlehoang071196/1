import React, { useState } from "react";
import { Trash2, Calendar, FileText, ChevronDown, ChevronUp, AlertCircle, CheckCircle2, Plus } from "lucide-react";
import { Project } from "../../types";
import { CustomDatePicker } from "../ui-primitives";
import { updateStepStatus, addRound, updateRound, removeRound } from "../../lib/projectService";
import { parseFormattedDate } from "./stepUtils";
import { DocumentLinkList } from "../DocumentLinkList";
import { cn } from "../../lib/utils";
import { toast } from "sonner";

interface DecisionPublicStepProps {
  project: Project;
  stepKey: string;
  stepData: any;
  canEdit: boolean;
}

export const DecisionPublicStep: React.FC<DecisionPublicStepProps> = ({
  project,
  stepKey,
  stepData,
  canEdit,
}) => {
  const decisionPublicData = stepData as any;
  const rounds = decisionPublicData?.rounds || [];
  const [roundDeletingId, setRoundDeletingId] = useState<string | null>(null);
  const [expandedRounds, setExpandedRounds] = useState<Record<string, boolean>>({});

  const approvalStepKey =
    stepKey === "agri_decision_public"
      ? "agri_approval"
      : stepKey === "res_decision_public"
        ? "res_approval"
        : ["decision_public", "payment"].includes(stepKey)
          ? "approval"
          : "approval";

  const approvalStep = (project.steps[approvalStepKey as keyof typeof project.steps] ||
    project.steps.approval ||
    project.steps.agri_approval ||
    project.steps.res_approval) as any;
  const approvalRounds = approvalStep?.rounds || [];

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
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  };

  const getStatusInfo = (startDateStr?: string, endDateStr?: string) => {
    const sDate = parseToDate(startDateStr);
    const eDate = parseToDate(endDateStr);
    if (!sDate || !eDate) return { text: "Chưa thiết lập ngày niêm yết", color: "text-slate-500 bg-slate-50 border-slate-200" };

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (today.getTime() > eDate.getTime()) {
      const days = getListingDays(startDateStr, endDateStr);
      return { text: `Đã hoàn thành niêm yết (${days} ngày)`, color: "text-green-700 bg-green-50 border-green-200" };
    } else if (today.getTime() >= sDate.getTime() && today.getTime() <= eDate.getTime()) {
      return { text: "Đang niêm yết công khai quyết định", color: "text-blue-700 bg-blue-50 border-blue-200" };
    } else {
      return { text: "Chưa bắt đầu thời hạn", color: "text-indigo-700 bg-indigo-50 border-indigo-200" };
    }
  };

  const handleAddRound = () => {
    addRound(project.id, stepKey, decisionPublicData);
  };

  const handleRemoveRound = (roundId: string) => {
    removeRound(project.id, stepKey, roundId, decisionPublicData);
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
        toast.warning("Lưu ý: Ngày bắt đầu niêm yết quyết định đang muộn hơn ngày kết thúc.");
      }
    }

    updateRound(
      project.id,
      stepKey,
      roundId,
      decisionPublicData,
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
            📢 Quản lý công khai quyết định phê duyệt phương án {rounds.length > 0 && `(${rounds.length})`}
          </div>
          {canEdit && (
            <button
              type="button"
              onClick={handleAddRound}
              className="text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100/80 px-4 py-2 rounded-xl border border-emerald-200/65 transition-all cursor-pointer shadow-3xs hover:shadow-2xs active:scale-98 select-none"
            >
              + Đợt công khai quyết định
            </button>
          )}
        </div>

        {rounds.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50/30">
            <AlertCircle className="w-8 h-8 text-slate-300 mb-3" />
            <p className="text-xs font-bold text-slate-650">Chưa có thông tin đợt niêm yết quyết định nào.</p>
            <p className="text-[10.5px] text-slate-400 mt-1.5 max-w-sm">Nên cập nhật thông tin niêm yết quyết định phê duyệt phương án để bảo đảm công khai thông tin pháp lý theo quy định của Luật Đất đai.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {rounds.map((round: any, idx: number) => {
              const rId = `${stepKey}_${round.id}`;
              const isExpanded = !!expandedRounds[rId];
              const appMatch = approvalRounds.find((r: any) => r.id === round.approvalRoundId);
              const status = getStatusInfo(round.startDate || round.date, round.endDate);
              const isCurrentActive = status.text.includes("Đang niêm yết");

              return (
                <div
                  key={round.id}
                  className={cn(
                    "bg-white rounded-2xl border overflow-hidden shadow-xs transition-all duration-300",
                    isCurrentActive
                      ? "border-emerald-300 ring-2 ring-emerald-50/40 bg-gradient-to-br from-white to-emerald-50/5"
                      : isExpanded
                        ? "border-slate-350 shadow-sm border-l-4 border-l-emerald-505"
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
                          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                        )}
                      </div>
                      <div className="space-y-1">
                        {appMatch ? (
                          <div className="text-[13px] font-bold text-slate-900 font-sans tracking-tight leading-snug">
                            Công khai Quyết định phê duyệt đợt {approvalRounds.indexOf(appMatch) + 1} {appMatch.decisionNo ? `(Số: ${appMatch.decisionNo})` : ""} <span className="font-semibold text-slate-400 text-[11px] ml-1">[{appMatch.approvalArea || "toàn dự án"}]</span>
                          </div>
                        ) : (
                          <div className="text-[13px] font-bold text-slate-550 font-sans italic">
                            {round.name || "Chưa chọn đợt phê duyệt tương ứng"}
                          </div>
                        )}
                        {(round.startDate || round.date || round.endDate) && (
                          <div className="text-[10.5px] text-slate-500 flex flex-wrap items-center gap-1.5 pt-0.5">
                            <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Thời hạn niêm yết:</span>
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
                            Quyết định phê duyệt tương ứng
                          </label>
                          <select
                            value={round.approvalRoundId || ""}
                            onChange={(e) => {
                              const val = e.target.value;
                              const matched = approvalRounds.find((r: any) => r.id === val);
                              updateRound(
                                project.id,
                                stepKey,
                                round.id,
                                decisionPublicData,
                                {
                                  approvalRoundId: val,
                                  name: matched
                                    ? `Niêm yết QĐ đợt: ${approvalRounds.indexOf(matched) + 1}`
                                    : `Đợt ${idx + 2}`,
                                }
                              );
                            }}
                            disabled={!canEdit}
                            className="w-full bg-white border border-slate-200 hover:border-slate-300 rounded-xl px-3.5 py-1.5 text-xs font-bold text-slate-700 outline-none focus:border-blue-500 transition-all font-sans h-9 shadow-3xs select-none cursor-pointer"
                          >
                            <option value="">-- Chọn quyết định phê duyệt --</option>
                            {approvalRounds.map((app: any, aIdx: number) => (
                              <option key={app.id} value={app.id}>
                                QĐ đợt {aIdx + 1} {app.decisionNo ? `(Số: ${app.decisionNo})` : ""} - {app.approvalArea || "Chung"}
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

                      <div className="w-full border-t border-slate-100 pt-4">
                        <DocumentLinkList
                          links={round.links || []}
                          onChange={(newLinks) =>
                            updateRound(
                              project.id,
                              stepKey,
                              round.id,
                              decisionPublicData,
                              { links: newLinks }
                            )
                          }
                          labelTitle="Hồ sơ công việc (Quyết định phê duyệt bồi thường, kế hoạch chi tiết đính kèm...):"
                          readOnly={!canEdit}
                        />
                      </div>

                      {canEdit && (
                        <div className="flex items-center justify-end pt-4 border-t border-slate-100">
                          {roundDeletingId === round.id ? (
                            <div className="flex items-center gap-1.5 bg-red-50 p-2 rounded-xl border border-red-100 shadow-2xs">
                              <span className="text-[9.5px] font-black text-red-700 uppercase px-1.5 font-sans">Xác nhận xoá?</span>
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
