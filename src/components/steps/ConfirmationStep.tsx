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
      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
          <FileText className="w-3.5 h-3.5 text-blue-500" />
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
            className="text-[10px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg border border-blue-200 transition-colors cursor-pointer"
          >
            + Thêm văn bản
          </button>
        )}
      </div>

      {docs.length === 0 ? (
        <div className="text-center py-6 text-xs text-slate-400 italic bg-slate-50 rounded-xl border border-dashed border-slate-200 font-sans">
          Chưa có văn bản đề nghị nào. Nhấn "+ Thêm văn bản" để bắt đầu.
        </div>
      ) : (
        <div className="space-y-3.5 font-sans">
          {docs.map((doc: any, dIdx: number) => {
            const docLinks = doc.links || [];
            return (
              <div
                key={doc.id || dIdx}
                className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col gap-3"
              >
                <div className="flex items-center justify-between gap-2.5 pb-2 border-b border-slate-100">
                  <div className="flex-grow max-w-md">
                    <EditableInput
                      placeholder="Tên văn bản (Ví dụ: Đề nghị xác nhận nhân khẩu xã...)"
                      className="w-full bg-white border border-slate-200 rounded px-2.5 py-1 text-[11px] text-slate-800 outline-none placeholder-slate-400 font-bold"
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
                      className="p-1 px-1.5 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded border border-transparent hover:border-red-100"
                      title="Xoá văn bản này"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase w-28 whitespace-nowrap">
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

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase w-28 whitespace-nowrap">
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
                <div className="mt-2 pt-2 border-t border-slate-100">
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
