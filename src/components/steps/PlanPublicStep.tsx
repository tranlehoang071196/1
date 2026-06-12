import React, { useState } from "react";
import { Trash2, Layers, Calendar, FileText, ChevronDown, ChevronUp, AlertCircle, CheckCircle2 } from "lucide-react";
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
          color: "text-amber-700 bg-amber-50 border-amber-200",
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
    <div className="w-full space-y-4">
      <div className="w-full border-t border-slate-100 pt-3 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9.5a2.5 2.5 0 00-2.5-2.5H15" />
            </svg>
            Quản lý các đợt niêm yết công khai phương án {rounds.length > 0 && `(${rounds.length})`}
          </div>
          {canEdit && (
            <button
              type="button"
              onClick={handleAddRound}
              className="text-[10px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
            >
              + Thêm đợt niêm yết mới
            </button>
          )}
        </div>

        {rounds.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-6 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
            <AlertCircle className="w-6 h-6 text-slate-300 mb-2" />
            <p className="text-xs font-semibold text-slate-500">Chưa thiết lập đợt niêm yết nào.</p>
            <p className="text-[10px] text-slate-400 mt-1">Niêm yết tối thiểu 20 ngày theo Điều 48 Luật Đất Đai để đủ điều kiện quyết định phê duyệt.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {rounds.map((round: any, idx: number) => {
              const rId = `${stepKey}_${round.id}`;
              const isExpanded = !!expandedRounds[rId];
              const draftMatch = draftRounds.find((r: any) => r.id === round.draftRoundId);
              const status = getStatusInfo(round.startDate || round.date, round.endDate);

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
                  className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm"
                >
                  <div
                    className="p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 cursor-pointer hover:bg-slate-50/60 transition-colors"
                    onClick={() =>
                      setExpandedRounds((prev) => ({
                        ...prev,
                        [rId]: !prev[rId],
                      }))
                    }
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-1 shrink-0">
                        <CheckCircle2 className={cn("w-4 h-4", status.warning ? "text-amber-500" : "text-green-500")} />
                      </div>
                      <div>
                        {draftMatch ? (
                          <div className="text-[11px] font-bold text-slate-750 font-sans tracking-tight leading-snug">
                            Niêm yết phương án đợt {draftRounds.indexOf(draftMatch) + 1} {draftMatch.notes ? `- ${draftMatch.notes}` : ""} [{getRoundLabel(draftMatch)}]
                          </div>
                        ) : (
                          <div className="text-[11px] font-bold text-slate-500 font-sans italic">
                            {round.name || "Chưa chọn đợt lập phương án tương ứng"}
                          </div>
                        )}
                        {(round.startDate || round.date || round.endDate) && (
                          <div className="text-[10px] text-slate-400 mt-1 flex flex-wrap items-center gap-x-2">
                            <span>Thời hạn niêm yết:</span>
                            <span className="font-semibold text-slate-600 font-mono">{round.startDate || round.date || "..."}</span>
                            <span>đến</span>
                            <span className="font-semibold text-slate-600 font-mono">{round.endDate || "..."}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 ml-7 md:ml-auto shrink-0">
                      <span className={cn("text-[9px] font-bold uppercase px-2.5 py-0.5 rounded border whitespace-nowrap", status.color)}>
                        {status.text}
                      </span>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-slate-100 bg-slate-50/40 p-4 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5Col">
                          <label className="text-[9px] font-bold text-slate-400 uppercase">
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
                            className="w-full bg-white border border-slate-200 rounded-md px-2.5 py-1.5 text-[11px] font-medium text-slate-700 outline-none shadow-sm focus:border-blue-400 focus:ring-1 focus:ring-blue-400/20"
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
                            <label className="text-[9px] font-bold text-slate-400 uppercase">
                              Từ ngày (Bắt đầu)
                            </label>
                            <CustomDatePicker
                              value={round.startDate || round.date || ""}
                              onChange={(val) => handleDateChange(round.id, "startDate", val)}
                              readOnly={!canEdit}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[9px] font-bold text-slate-400 uppercase">
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
                        <div className="p-3 rounded-lg border border-amber-200 bg-amber-50/50 flex items-start gap-2 text-[10px] text-amber-700 font-medium">
                          <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                          <span>Thời hạn niêm yết ít hơn 20 ngày làm việc. Quý ban cần rà soát luật hoặc cập nhật lại biên bản niêm yết để tránh các khiếu nại tranh chấp về mặt pháp lý sau này.</span>
                        </div>
                      )}

                      <div className="w-full border-t border-slate-100 pt-3">
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
                        <div className="flex items-center justify-end pt-3 border-t border-slate-100">
                          {roundDeletingId === round.id ? (
                            <div className="flex items-center gap-1.5 bg-red-50 p-1.5 rounded-lg border border-red-100">
                              <span className="text-[9px] font-bold text-red-700 uppercase px-1">Xác nhận xoá?</span>
                              <button
                                type="button"
                                onClick={() => handleRemoveRound(round.id)}
                                className="px-2.5 py-1 bg-red-650 text-white text-[9px] font-bold rounded shadow-sm hover:bg-red-700 transition-colors uppercase cursor-pointer"
                              >
                                Xoá
                              </button>
                              <button
                                type="button"
                                onClick={() => setRoundDeletingId(null)}
                                className="px-2.5 py-1 bg-white border border-slate-200 text-slate-600 text-[9px] font-bold rounded shadow-sm hover:bg-slate-50 transition-colors uppercase cursor-pointer"
                              >
                                Huỷ
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setRoundDeletingId(round.id)}
                              className="flex items-center gap-1.5 text-[9px] font-extrabold text-red-500 hover:bg-red-50 hover:text-red-600 px-3 py-1.5 rounded-lg uppercase transition-all cursor-pointer"
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
