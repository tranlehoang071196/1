import React from "react";
import { FileText, Trash2 } from "lucide-react";
import { Project } from "../../types";
import { CustomDatePicker, EditableInput } from "../ui-primitives";
import { DocumentLinkList } from "../DocumentLinkList";
import { updateStepStatus } from "../../lib/projectService";

interface ConfirmationStepProps {
  project: Project;
  stepKey: string;
  stepData: any;
  canEdit: boolean;
}

export const ConfirmationStep: React.FC<ConfirmationStepProps> = ({
  project,
  stepKey,
  stepData,
  canEdit,
}) => {
  const confData = stepData as any;
  const docs = confData?.docs || [];

  return (
    <div className="flex flex-col gap-4 mt-2 w-full">
      <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
        <span className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-2">
          <FileText className="w-4 h-4 text-emerald-500" />
          Danh sách văn bản đề nghị xác nhận
        </span>
        {canEdit && (
          <button
            onClick={() => {
              const current = confData?.docs || [];
              const newItem = {
                id: Math.random().toString(36).substring(2, 11),
                name: "",
                deadline: "",
                sentDate: "",
                links: [],
              };
              updateStepStatus(project.id, stepKey, {
                ...confData,
                docs: [...current, newItem],
              });
            }}
            className="text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100/80 px-4 py-2 rounded-xl border border-emerald-200/65 transition-all cursor-pointer shadow-3xs hover:shadow-2xs active:scale-98"
          >
            + Thêm văn bản
          </button>
        )}
      </div>

      {docs.length === 0 ? (
        <div className="text-center py-8 text-xs text-slate-400 italic bg-slate-50 rounded-2xl border border-dashed border-slate-200 font-sans shadow-3xs">
          Chưa có văn bản đề nghị nào. Nhấn "+ Thêm văn bản" để bắt đầu.
        </div>
      ) : (
        <div className="space-y-4 font-sans bg-slate-50/50 p-4 rounded-2xl border border-slate-200/60 shadow-3xs">
          {docs.map((doc: any, dIdx: number) => {
            const docLinks = doc.links || [];
            return (
              <div
                key={doc.id || dIdx}
                className="bg-white p-4 rounded-2xl border border-slate-200/85 hover:border-slate-300 transition-all flex flex-col gap-3.5 shadow-3xs"
              >
                <div className="flex items-center justify-between gap-3 pb-2.5 border-b border-slate-100">
                  <div className="flex-grow max-w-xl">
                    <EditableInput
                      placeholder="Tên văn bản (Ví dụ: Đề nghị xác nhận nhân khẩu xã...)"
                      className="w-full h-8 bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-xl px-3.5 text-xs text-slate-800 outline-none placeholder-slate-400 font-bold transition-all"
                      value={doc.name || ""}
                      onSave={(val) => {
                        const newDocs = [...docs];
                        newDocs[dIdx] = {
                          ...newDocs[dIdx],
                          name: val,
                        };
                        updateStepStatus(project.id, stepKey, {
                          ...confData,
                          docs: newDocs,
                        });
                      }}
                      readOnly={!canEdit}
                    />
                  </div>

                  {canEdit && (
                    <button
                      onClick={() => {
                        const newDocs = docs.filter((d: any) => d.id !== doc.id);
                        updateStepStatus(project.id, stepKey, {
                          ...confData,
                          docs: newDocs,
                        });
                      }}
                      className="p-1.5 text-slate-400 hover:text-red-500 bg-slate-50 hover:bg-red-55 rounded-xl border border-slate-200 hover:border-red-200 transition-all shadow-3xs cursor-pointer"
                      title="Xoá văn bản này"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-slate-500 uppercase w-36 whitespace-nowrap select-none">
                      Ngày gửi văn bản:
                    </span>
                    <CustomDatePicker
                      value={doc.sentDate || ""}
                      onChange={(val) => {
                        const newDocs = [...docs];
                        newDocs[dIdx] = {
                          ...newDocs[dIdx],
                          sentDate: val,
                        };
                        updateStepStatus(project.id, stepKey, {
                          ...confData,
                          docs: newDocs,
                        });
                      }}
                      readOnly={!canEdit}
                    />
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-slate-500 uppercase w-36 whitespace-nowrap select-none">
                      Hạn xử lý:
                    </span>
                    <CustomDatePicker
                      value={doc.deadline || ""}
                      onChange={(val) => {
                        const newDocs = [...docs];
                        newDocs[dIdx] = {
                          ...newDocs[dIdx],
                          deadline: val,
                        };
                        updateStepStatus(project.id, stepKey, {
                          ...confData,
                          docs: newDocs,
                        });
                      }}
                      readOnly={!canEdit}
                    />
                  </div>
                </div>

                {/* Individual Link list inside doc */}
                <div className="mt-2 pt-2.5 border-t border-slate-100">
                  <DocumentLinkList
                    links={docLinks}
                    onChange={(newLinks) => {
                      const newDocs = [...docs];
                      newDocs[dIdx] = {
                        ...newDocs[dIdx],
                        links: newLinks,
                      };
                      updateStepStatus(project.id, stepKey, {
                        ...confData,
                        docs: newDocs,
                      });
                    }}
                    labelTitle="Hồ sơ công việc (Links):"
                    readOnly={!canEdit}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
