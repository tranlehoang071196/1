import React, { useState } from "react";
import {
  Plus,
  Trash2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Layers,
  ArrowUp,
  ArrowDown,
  GripVertical,
} from "lucide-react";
import { Project, STEP_LABELS, STEPS_WITH_ROUNDS } from "../../types";
import { cn } from "../../lib/utils";
import {
  CustomDatePicker,
  CurrencyInput,
  NumberInput,
  EditableInput,
} from "../ui-primitives";
import { DocumentLinkList } from "../DocumentLinkList";
import { motion, AnimatePresence } from "framer-motion";
import {
  updateStepStatus,
  addRound,
  updateRound,
  removeRound,
  updateCustomStep,
  deleteCustomStep,
  toggleDisabledStep,
} from "../../lib/projectService";

import {
  parseFormattedDate,
  isOverdue,
  getStepStatus,
  getCustomStepStatus,
  checkInventoryCompleted,
} from "./stepUtils";
import { formatDeadline } from "../../utils/dateUtils";

import { InventoryStep } from "./InventoryStep";
import { PlanDraftStep } from "./PlanDraftStep";
import { AppraisalSubmitStep } from "./AppraisalSubmitStep";
import { ApprovalStep } from "./ApprovalStep";
import { PaymentStep } from "./PaymentStep";
import { ConfirmationStep } from "./ConfirmationStep";
import { PlanPublicStep } from "./PlanPublicStep";
import { DecisionPublicStep } from "./DecisionPublicStep";

export { checkInventoryCompleted };

interface StepDetailProps {
  key?: string;
  project: Project;
  stepKey: string;
  canEdit: boolean;
  expandedRounds: Record<string, boolean>;
  setExpandedRounds: React.Dispatch<
    React.SetStateAction<Record<string, boolean>>
  >;
  isReorderingMode?: boolean;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  isDragOver?: boolean;
  defaultExpanded?: boolean;
  forceExpanded?: boolean;
}

interface CustomStepDetailProps {
  project: Project;
  step: any;
  canEdit: boolean;
  isReorderingMode?: boolean;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  isDragOver?: boolean;
  defaultExpanded?: boolean;
  forceExpanded?: boolean;
}

const CustomStepDetail = ({
  project,
  step,
  canEdit: canEditProp,
  isReorderingMode = false,
  canMoveUp = false,
  canMoveDown = false,
  onMoveUp,
  onMoveDown,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDragEnd,
  onDrop,
  isDragOver = false,
  defaultExpanded = false,
  forceExpanded,
}: CustomStepDetailProps) => {
  const canEdit = canEditProp && !isReorderingMode;
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(step.name);
  const [isStepContentExpanded, setIsStepContentExpanded] = useState(defaultExpanded);
  const isContentCurrentlyExpanded = forceExpanded !== undefined ? forceExpanded : isStepContentExpanded;
  const computedStatus = getCustomStepStatus(step);

  const handleCardClick = (e: React.MouseEvent) => {
    if (isReorderingMode) return;
    const target = e.target as HTMLElement;
    if (
      target.closest("button") ||
      target.closest("input") ||
      target.closest("select") ||
      target.closest(".react-datepicker") ||
      target.closest("a")
    ) {
      return;
    }
    setIsStepContentExpanded((prev) => !prev);
  };

  return (
    <motion.div
      layout={isReorderingMode ? "position" : undefined}
      draggable={isReorderingMode}
      onDragStart={onDragStart as any}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDragEnd={onDragEnd as any}
      onDrop={onDrop}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
      onClick={handleCardClick}
      className={cn(
        "flex items-start gap-4 p-4.5 rounded-xl border border-slate-200/60 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.015)] transition-all group/step",
        isReorderingMode
          ? "cursor-grab active:cursor-grabbing hover:border-blue-300"
          : isContentCurrentlyExpanded
            ? "border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.015)]"
            : "hover:border-slate-300 hover:shadow-[0_4px_12px_rgba(0,0,0,0.02)] cursor-pointer",
        isDragOver &&
          "border-blue-500 bg-blue-50/10 scale-[1.01] shadow-md ring-2 ring-blue-500/10 border-2 border-dashed",
      )}
    >
      {canEdit && isReorderingMode ? (
        <div className="flex items-center gap-1.5 shrink-0 select-none -ml-1 mr-1">
          <div
            className="p-1 text-slate-300 cursor-grab active:cursor-grabbing hover:text-slate-600 transition-colors"
            title="Kéo để di chuyển"
          >
            <GripVertical className="w-4 h-4" />
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onMoveUp?.();
            }}
            disabled={!canMoveUp}
            className={cn(
              "p-1 rounded transition-colors cursor-pointer",
              canMoveUp
                ? "text-slate-500 hover:text-blue-600 hover:bg-slate-50"
                : "text-slate-200 cursor-not-allowed",
            )}
            title="Di chuyển lên"
          >
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onMoveDown?.();
            }}
            disabled={!canMoveDown}
            className={cn(
              "p-1 rounded transition-colors cursor-pointer",
              canMoveDown
                ? "text-slate-500 hover:text-blue-600 hover:bg-slate-50"
                : "text-slate-200 cursor-not-allowed",
            )}
            title="Di chuyển xuống"
          >
            <ArrowDown className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <div
          className={cn(
            "mt-1.5 w-2 h-2 rounded-full shrink-0",
            computedStatus === "completed"
              ? "bg-green-500"
              : computedStatus === "overdue"
                ? "bg-red-500 animate-pulse"
                : computedStatus === "not_applicable"
                  ? "bg-slate-300"
                  : "bg-slate-200",
          )}
        />
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center gap-2.5">
            <h4 className="font-bold text-sm text-slate-800 leading-tight truncate">
              {step.name}
            </h4>

            {(canEdit || step.deadline) && (() => {
              const dlStatus = formatDeadline(step.deadline, step.date, step.status === 'completed' || !!step.date);
              return (
                <div
                  className={cn(
                    "flex items-center gap-1.5 px-2 py-0.5 rounded-md border shrink-0 text-xs transition-colors cursor-pointer",
                    dlStatus.colorClass
                  )}
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="text-[9px] font-extrabold uppercase opacity-85">
                    Hạn:
                  </span>
                  <CustomDatePicker
                    value={step.deadline || ""}
                    onChange={(val) =>
                      updateCustomStep(
                        project.id,
                        project.customSteps || [],
                        step.id,
                        { deadline: val },
                      )
                    }
                    readOnly={!canEdit || isReorderingMode}
                  />
                  <span className="text-[10px] font-semibold opacity-90 ml-1">
                    {dlStatus.label}
                  </span>
                </div>
              );
            })()}
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {(computedStatus === "completed" ||
              computedStatus === "overdue") && (
              <div
                className={cn(
                  "text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded border whitespace-nowrap",
                  computedStatus === "completed"
                    ? "text-green-650 bg-green-50/80 border-green-200"
                    : "text-red-650 bg-red-50/80 border-red-200",
                )}
              >
                {computedStatus === "completed" ? "HOÀN THÀNH" : "QUÁ HẠN"}
              </div>
            )}

            {canEdit && isReorderingMode && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteCustomStep(
                    project.id,
                    project.customSteps || [],
                    step.id,
                  );
                }}
                className="p-1 px-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-all cursor-pointer mr-2"
                title="Xóa bước"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        <AnimatePresence initial={false}>
          {isContentCurrentlyExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden w-full border-t border-slate-100 mt-3 pt-3 cursor-default"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex flex-wrap gap-x-8 gap-y-4">
                <div className="flex items-center gap-2">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter w-24">
                    Ngày hoàn thành:
                  </div>
                  <CustomDatePicker
                    value={step.date || ""}
                    onChange={(val) => {
                      const updates: any = { date: val };
                      if (val) {
                        updates.status = "completed";
                      } else {
                        updates.status = "";
                      }
                      updateCustomStep(
                        project.id,
                        project.customSteps || [],
                        step.id,
                        updates,
                      );
                    }}
                    readOnly={!canEdit}
                  />
                </div>

                <div className="w-full mt-2">
                  <DocumentLinkList
                    links={step.links || []}
                    onChange={(newLinks) =>
                      updateCustomStep(
                        project.id,
                        project.customSteps || [],
                        step.id,
                        { links: newLinks },
                      )
                    }
                    labelTitle="Links hồ sơ công việc:"
                    readOnly={!canEdit}
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export const StepDetail = ({
  project,
  stepKey,
  canEdit: canEditProp,
  expandedRounds,
  setExpandedRounds,
  isReorderingMode = false,
  canMoveUp = false,
  canMoveDown = false,
  onMoveUp,
  onMoveDown,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDragEnd,
  onDrop,
  isDragOver = false,
  defaultExpanded = false,
  forceExpanded,
}: StepDetailProps) => {
  const canEdit = canEditProp && !isReorderingMode;
  const [roundDeletingId, setRoundDeletingId] = useState<string | null>(null);

  const stepData = project.steps[stepKey as keyof typeof project.steps];
  const isInventory = stepKey === "inventory";
  const isPayment = stepKey === "payment" || stepKey === "payment" || stepKey === "agri_payment" || stepKey === "res_payment";
  const isPlanDraft = stepKey === "plan_draft" || stepKey === "agri_plan_draft" || stepKey === "res_plan_draft";
  const isAppraisalSubmit = [
    "appraisal_submit",
    "agri_appraisal_submit",
    "res_appraisal_submit",
  ].includes(stepKey);

  const isApproval = [
    "approval",
    "agri_approval",
    "res_approval",
  ].includes(stepKey);

  const isConfirmation = [
    "confirmation_request",
    "agri_confirmation_request",
  ].includes(stepKey);

  const isPlanPublic = [
    "plan_public",
    "agri_plan_public",
    "res_plan_public",
  ].includes(stepKey);

  const isDecisionPublic = [
    "decision_public",
    "agri_decision_public",
    "res_decision_public",
  ].includes(stepKey);

  const isObject = typeof stepData === "object" && stepData !== null;

  const label =
    (isObject ? (stepData as any).name : null) ||
    STEP_LABELS[stepKey as keyof typeof STEP_LABELS] ||
    "Bước công việc";

  const hasAmount = isObject && "amount" in stepData && !isInventory;
  const currentLinks = isObject ? (stepData as any).links || [] : [];
  const rounds = isObject ? (stepData as any).rounds || [] : [];

  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(label);

  const [isStepContentExpanded, setIsStepContentExpanded] = useState(defaultExpanded);
  const isContentCurrentlyExpanded = forceExpanded !== undefined ? forceExpanded : isStepContentExpanded;

  React.useEffect(() => {
    setEditedName(label);
  }, [label]);

  if (stepKey.startsWith("custom_")) {
    const customStepId = stepKey.replace("custom_", "");
    const step = project.customSteps?.find((s) => s.id === customStepId);
    if (!step) return null;

    return (
      <CustomStepDetail
        project={project}
        step={step}
        canEdit={canEdit}
        isReorderingMode={isReorderingMode}
        canMoveUp={canMoveUp}
        canMoveDown={canMoveDown}
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDragEnd={onDragEnd}
        onDrop={onDrop}
        isDragOver={isDragOver}
        defaultExpanded={defaultExpanded}
        forceExpanded={forceExpanded}
      />
    );
  }

  const computedStatus = getStepStatus(stepKey, stepData, isObject, project);

  const handleCardClick = (e: React.MouseEvent) => {
    if (isReorderingMode) return;
    const target = e.target as HTMLElement;
    if (
      target.closest("button") ||
      target.closest("input") ||
      target.closest("select") ||
      target.closest(".react-datepicker") ||
      target.closest("a")
    ) {
      return;
    }
    setIsStepContentExpanded((p) => !p);
  };

  const takesRounds =
    STEPS_WITH_ROUNDS.includes(stepKey) &&
    !isInventory &&
    !isPlanDraft &&
    !isAppraisalSubmit &&
    !isApproval &&
    !isPayment &&
    !isConfirmation;

  const isDecisionPublicEnv = [
    "decision_public",
    "agri_decision_public",
    "res_decision_public",
  ].includes(stepKey);
  const isPlanPublicEnv = [
    "plan_public",
    "agri_plan_public",
    "res_plan_public",
  ].includes(stepKey);

  return (
    <motion.div
      layout={isReorderingMode ? "position" : undefined}
      draggable={isReorderingMode}
      onDragStart={onDragStart as any}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDragEnd={onDragEnd as any}
      onDrop={onDrop}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
      onClick={handleCardClick}
      className={cn(
        "flex items-start gap-4 p-4.5 rounded-xl border border-slate-200/60 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.015)] transition-all group/step",
        isReorderingMode
          ? "cursor-grab active:cursor-grabbing hover:border-blue-300"
          : isContentCurrentlyExpanded
            ? "border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.015)]"
            : "hover:border-slate-300 hover:shadow-[0_4px_12px_rgba(0,0,0,0.02)] cursor-pointer",
        isDragOver &&
          "border-blue-500 bg-blue-50/10 scale-[1.01] shadow-md ring-2 ring-blue-500/10 border-2 border-dashed",
      )}
    >
      {canEdit && isReorderingMode ? (
        <div className="flex items-center gap-1.5 shrink-0 select-none -ml-1 mr-1">
          <div
            className="p-1 text-slate-300 cursor-grab active:cursor-grabbing hover:text-slate-600 transition-colors"
            title="Kéo để di chuyển"
          >
            <GripVertical className="w-4 h-4" />
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onMoveUp?.();
            }}
            disabled={!canMoveUp}
            className={cn(
              "p-1 rounded transition-colors cursor-pointer",
              canMoveUp
                ? "text-slate-500 hover:text-blue-600 hover:bg-slate-50"
                : "text-slate-200 cursor-not-allowed",
            )}
            title="Di chuyển lên"
          >
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onMoveDown?.();
            }}
            disabled={!canMoveDown}
            className={cn(
              "p-1 rounded transition-colors cursor-pointer",
              canMoveDown
                ? "text-slate-500 hover:text-blue-600 hover:bg-slate-50"
                : "text-slate-200 cursor-not-allowed",
            )}
            title="Di chuyển xuống"
          >
            <ArrowDown className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <div
          className={cn(
            "mt-1.5 w-2 h-2 rounded-full shrink-0",
            computedStatus === "completed"
              ? "bg-green-500"
              : computedStatus === "overdue"
                ? "bg-red-500 animate-pulse"
                : computedStatus === "not_applicable"
                  ? "bg-slate-300"
                  : "bg-slate-200",
          )}
        />
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center gap-2.5">
            <h4 className="font-bold text-sm text-slate-800 leading-tight truncate">
              {label}
            </h4>

            {stepKey !== "confirmation_request" &&
              stepKey !== "agri_confirmation_request" &&
              (canEdit || (stepData as any)?.deadline) && (() => {
                const completedDate = isObject ? ((stepData as any)?.date || (stepData as any)?.invitationDate) : undefined;
                const isCompleted = computedStatus === "completed" || !!completedDate;
                const dlStatus = formatDeadline((stepData as any)?.deadline, completedDate, isCompleted);
                return (
                  <div
                    className={cn(
                      "flex items-center gap-1.5 px-2 py-0.5 rounded-md border shrink-0 text-xs transition-colors cursor-pointer",
                      dlStatus.colorClass
                    )}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span className="text-[9px] font-extrabold uppercase opacity-85">
                      Hạn:
                    </span>
                    <CustomDatePicker
                      value={(stepData as any)?.deadline || ""}
                      onChange={(val) =>
                        updateStepStatus(
                          project.id,
                          stepKey,
                          isObject
                            ? { ...(stepData as any), deadline: val }
                            : { status: stepData, deadline: val },
                        )
                      }
                      readOnly={!canEdit || isReorderingMode}
                    />
                    <span className="text-[10px] font-semibold opacity-90 ml-1">
                      {dlStatus.label}
                    </span>
                  </div>
                );
              })()}
          </div>

          <div className="flex items-center gap-3 ml-auto shrink-0">
            {(computedStatus === "completed" ||
              computedStatus === "overdue") && (
              <div
                className={cn(
                  "text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded border whitespace-nowrap",
                  computedStatus === "completed"
                    ? "text-green-650 bg-green-50/80 border-green-200"
                    : "text-red-650 bg-red-50/80 border-red-200",
                )}
              >
                {computedStatus === "completed" ? "HOÀN THÀNH" : "QUÁ HẠN"}
              </div>
            )}

            {canEdit && isReorderingMode && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleDisabledStep(
                    project.id,
                    stepKey,
                    project.disabledSteps || [],
                  );
                }}
                className="p-1 px-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-all cursor-pointer mr-2"
                title="Ẩn bước mặc định"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        <AnimatePresence initial={false}>
          {isContentCurrentlyExpanded && !isReorderingMode && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden w-full border-t border-slate-100 mt-3 pt-3 cursor-default"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex flex-wrap gap-4 w-full">
                {/* 1. Delegate InventoryStep */}
                {isInventory && (
                  <InventoryStep
                    project={project}
                    stepKey={stepKey}
                    stepData={stepData}
                    canEdit={canEdit}
                  />
                )}

                {/* 2. Delegate PlanDraftStep */}
                {isPlanDraft && (
                  <PlanDraftStep
                    project={project}
                    stepKey={stepKey}
                    stepData={stepData}
                    canEdit={canEdit}
                  />
                )}

                {/* 3. Delegate AppraisalSubmitStep */}
                {isAppraisalSubmit && (
                  <AppraisalSubmitStep
                    project={project}
                    stepKey={stepKey}
                    stepData={stepData}
                    canEdit={canEdit}
                  />
                )}

                {/* 4. Delegate ApprovalStep */}
                {isApproval && (
                  <ApprovalStep
                    project={project}
                    stepKey={stepKey}
                    stepData={stepData}
                    canEdit={canEdit}
                  />
                )}

                {/* 5. Delegate PaymentStep */}
                {isPayment && (
                  <PaymentStep
                    project={project}
                    stepKey={stepKey}
                    stepData={stepData}
                    canEdit={canEdit}
                  />
                )}

                {/* 6. Delegate ConfirmationStep */}
                {isConfirmation && (
                  <ConfirmationStep
                    project={project}
                    stepKey={stepKey}
                    stepData={stepData}
                    canEdit={canEdit}
                  />
                )}

                {/* 7. Delegate PlanPublicStep */}
                {isPlanPublic && (
                  <PlanPublicStep
                    project={project}
                    stepKey={stepKey}
                    stepData={stepData}
                    canEdit={canEdit}
                  />
                )}

                {/* 8. Delegate DecisionPublicStep */}
                {isDecisionPublic && (
                  <DecisionPublicStep
                    project={project}
                    stepKey={stepKey}
                    stepData={stepData}
                    canEdit={canEdit}
                  />
                )}

                {/* Standard Steps Fallback for Dates, Amounts and Rounds */}
                {!isInventory && !isPlanDraft && !isAppraisalSubmit && !isApproval && !isPayment && !isConfirmation && !isPlanPublic && !isDecisionPublic && (
                  <>
                    {/* Common Date Picker */}
                    <div className="flex items-center gap-2 pt-1 border-t border-slate-100/50 w-full mb-2">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter w-24">
                        {stepKey === "deployment_meeting"
                          ? "Ngày mời họp:"
                          : stepKey === "landmarks_handover"
                            ? "Ngày nhận bàn giao:"
                            : stepKey === "notice_request"
                              ? "Ngày gửi Văn bản:"
                              : "Ngày hoàn thành:"}
                      </div>
                      <CustomDatePicker
                        value={
                          isObject
                            ? (stepData as any).date ||
                              (stepData as any).invitationDate ||
                              ""
                            : ""
                        }
                        onChange={(val) => {
                          const newStatus = isObject
                            ? { ...(stepData as any), date: val }
                            : { status: stepData, date: val };
                          if (stepKey === "deployment_meeting")
                            (newStatus as any).invitationDate = val;

                          if (val) {
                            (newStatus as any).status = "completed";
                          } else {
                            (newStatus as any).status = "";
                          }
                          updateStepStatus(project.id, stepKey, newStatus);
                        }}
                        readOnly={!canEdit}
                      />
                    </div>

                    {/* Has Amount only */}
                    {hasAmount && !takesRounds && (
                      <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
                        <div className="flex items-center gap-2">
                          <div className="text-[10px] font-bold text-slate-400 uppercase w-20">
                            Số tiền:
                          </div>
                          <div className="flex items-center px-2 py-0.5 rounded border border-slate-200 bg-white shadow-sm">
                            <CurrencyInput
                              readOnly={!canEdit}
                              className="w-32 text-right outline-none text-[10px] font-bold text-emerald-700"
                              value={(stepData as any).amount || 0}
                              onChange={(val) => {
                                updateStepStatus(project.id, stepKey, {
                                  ...(stepData as any),
                                  amount: val,
                                });
                              }}
                            />
                            <span className="text-slate-400 ml-1.5 text-[10px]">
                              đ
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Generic standard rounds list */}
                    {takesRounds && (
                      <div className="w-full space-y-4">
                        <div className="w-full border-t border-slate-100 pt-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                              <Layers className="w-3.5 h-3.5" />
                              Các đợt thực hiện
                            </div>
                            {canEdit && (
                              <button
                                onClick={() =>
                                  addRound(project.id, stepKey, stepData)
                                }
                                className="text-[10px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                              >
                                {isDecisionPublicEnv
                                  ? "+ Thêm đợt công khai quyết định"
                                  : isPlanPublicEnv
                                    ? "+ Thêm đợt công khai phương án"
                                    : "+ Thêm đợt"}
                              </button>
                            )}
                          </div>
                          <div className="space-y-3">
                            {rounds.map((round: any, idx: number) => {
                              const roundId = `${stepKey}_${round.id}`;
                              const isExpanded = expandedRounds[roundId];
                              const isDecisionPublic = [
                                "decision_public",
                                "agri_decision_public",
                                "res_decision_public",
                              ].includes(stepKey);
                              const isPlanPublic = [
                                "plan_public",
                                "agri_plan_public",
                                "res_plan_public",
                              ].includes(stepKey);

                              const planDraftStep = (project.steps.plan_draft ||
                                project.steps.agri_plan_draft ||
                                project.steps.res_plan_draft) as any;
                              const draftRounds = planDraftStep?.rounds || [];
                              const approvalStepKey =
                                stepKey === "agri_decision_public"
                                  ? "agri_approval"
                                  : stepKey === "res_decision_public"
                                    ? "res_approval"
                                    : ["decision_public", "payment"].includes(stepKey)
                                      ? "approval"
                                      : null;
                              const approvalStep = approvalStepKey
                                ? (project.steps[
                                    approvalStepKey as keyof typeof project.steps
                                  ] as any)
                                : null;
                              const approvalRounds = approvalStep?.rounds || [];
                              const matchedApproval = approvalRounds.find(
                                (r: any) => r.id === round.approvalRoundId,
                              );

                              const handleDecisionNoChange = (val: string) => {
                                updateRound(
                                  project.id,
                                  stepKey,
                                  round.id,
                                  stepData,
                                  {
                                    decisionNo: val,
                                    name: val ? `QĐ số: ${val}` : `Đợt ${idx + 1}`,
                                  },
                                );
                              };

                              return (
                                <div
                                  key={round.id}
                                  className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm"
                                >
                                  <div
                                    className="p-3 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
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
                                          isPlanPublic
                                            ? (() => {
                                                const now = new Date();
                                                const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                                                const pDate = (dStr?: string) => {
                                                  if (!dStr) return null;
                                                  const p = parseFormattedDate(dStr);
                                                  if (!p) return null;
                                                  return new Date(parseInt(p.year, 10), parseInt(p.month, 10) - 1, parseInt(p.day, 10));
                                                };
                                                const eDate = pDate(round.endDate);
                                                if (eDate && today.getTime() > eDate.getTime()) return "bg-green-500";
                                                const sDate = pDate(round.startDate || round.date);
                                                if (sDate && eDate && today.getTime() >= sDate.getTime() && today.getTime() <= eDate.getTime()) return "bg-amber-500";
                                                return "bg-slate-300";
                                              })()
                                            : round.status === "completed"
                                              ? "bg-green-500"
                                              : "bg-blue-500",
                                        )}
                                      />
                                      {isPlanPublic ? (
                                        <div className="flex flex-col gap-0.5">
                                          <div className="text-[11px] font-semibold text-slate-755 leading-relaxed font-sans">
                                            {(() => {
                                              const draftMatch = draftRounds.find(
                                                (r: any) =>
                                                  r.id === round.draftRoundId,
                                              );
                                              if (draftMatch) {
                                                const getRoundLabel = (r: any) => {
                                                  const types = [];
                                                  if (r.agriPlots > 0 || r.agriHouseholds > 0) types.push("NN");
                                                  if (r.nonAgriPlots > 0 || r.nonAgriHouseholds > 0) types.push("Phi NN");
                                                  if (r.orgs > 0) types.push("TC");
                                                  if (r.assetHouseholds > 0 || r.asset_graves || r.asset_structures || r.asset_assets) types.push("Tài sản");
                                                  if (types.length > 0) return types.join(", ");
                                                  
                                                  if (r.targetType === "agri") return "Đất NN";
                                                  if (r.targetType === "non_agri") return "Đất phi NN";
                                                  if (r.targetType === "org") return "Tổ chức";
                                                  if (r.targetType === "assets") return "Tài sản";
                                                  return "Đợt PA";
                                                };
                                                const idxDraft = draftRounds.findIndex((r: any) => r.id === round.draftRoundId);
                                                return `Niêm yết công khai PA đợt ${idxDraft + 1} ${draftMatch.notes ? `(${draftMatch.notes})` : ""} - [${getRoundLabel(draftMatch)}]`;
                                              }
                                              return (
                                                round.name ||
                                                "Chưa chọn đợt lập phương án"
                                              );
                                            })()}
                                          </div>
                                          {(round.startDate ||
                                            round.date ||
                                            round.endDate) && (
                                            <div className="text-[10px] text-slate-400 font-normal">
                                              • Thời gian niêm yết:{" "}
                                              <span className="font-semibold text-slate-600">
                                                {round.startDate ||
                                                  round.date ||
                                                  "..."}
                                              </span>{" "}
                                              đến{" "}
                                              <span className="font-semibold text-slate-600">
                                                {round.endDate || "..."}
                                              </span>
                                            </div>
                                          )}
                                        </div>
                                      ) : isDecisionPublic ? (
                                        <div className="flex flex-col gap-0.5 font-sans">
                                          <div className="text-[11px] font-semibold text-slate-755 leading-relaxed font-sans">
                                            {(() => {
                                              const appMatch = approvalRounds.find(
                                                (r: any) =>
                                                  r.id === round.approvalRoundId,
                                              );
                                              if (appMatch) {
                                                const dateInfo = parseFormattedDate(
                                                  appMatch.approvalDate ||
                                                    appMatch.date,
                                                );
                                                const dayStr = dateInfo?.day || "...";
                                                const monthStr =
                                                  dateInfo?.month || "...";
                                                const yearStr =
                                                  dateInfo?.year || "...";

                                                const rawLocation =
                                                  appMatch.approvalArea || "";
                                                let finalLocation = "...";
                                                if (rawLocation) {
                                                  const lower =
                                                    rawLocation.toLowerCase();
                                                  const idxLoc =
                                                    lower.indexOf("ubnd");
                                                  if (idxLoc !== -1) {
                                                    finalLocation =
                                                      rawLocation
                                                        .substring(idxLoc)
                                                        .trim();
                                                  } else {
                                                    finalLocation = rawLocation;
                                                  }
                                                }
                                                const roundIdx = approvalRounds.findIndex(
                                                  (r: any) => r.id === round.approvalRoundId,
                                                );

                                                return `Niêm yết QĐ phê duyệt đợt ${roundIdx + 1} (${dayStr}/${monthStr}/${yearStr}) - tại ${finalLocation}`;
                                              }
                                              return (
                                                round.name ||
                                                "Chưa chọn QĐ phê duyệt tương ứng"
                                              );
                                            })()}
                                          </div>
                                          {(round.startDate ||
                                            round.date ||
                                            round.endDate) && (
                                            <div className="text-[10px] text-slate-400 font-normal">
                                              • Niêm yết từ:{" "}
                                              <span className="font-semibold text-slate-600">
                                                {round.startDate ||
                                                  round.date ||
                                                  "..."}
                                              </span>{" "}
                                              đến{" "}
                                              <span className="font-semibold text-slate-600">
                                                {round.endDate || "..."}
                                              </span>
                                            </div>
                                          )}
                                        </div>
                                      ) : (
                                        <span className="text-[11px] font-bold text-slate-700 font-sans">
                                          {round.name || `Đợt ${idx + 1}`}
                                        </span>
                                      )}
                                    </div>
                                    <ChevronUp
                                      className={cn(
                                        "w-3.5 h-3.5 text-slate-400 transition-transform",
                                        !isExpanded && "rotate-180",
                                      )}
                                    />
                                  </div>

                                  <AnimatePresence initial={false}>
                                    {isExpanded && (
                                      <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: "auto" }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="overflow-hidden border-t border-slate-100 bg-slate-50/40 p-4"
                                      >
                                        <div className="space-y-4 max-w-xl">
                                          {isPlanPublic && (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                              <div className="space-y-1.5">
                                                <label className="text-[9px] font-bold text-slate-400 uppercase">
                                                  Liên kết đợt Phương án
                                                </label>
                                                <select
                                                  value={round.draftRoundId || ""}
                                                  onChange={(e) => {
                                                    const val = e.target.value;
                                                    const matched = draftRounds.find(
                                                      (r: any) => r.id === val,
                                                    );
                                                    updateRound(
                                                      project.id,
                                                      stepKey,
                                                      round.id,
                                                      stepData,
                                                      {
                                                        draftRoundId: val,
                                                        name: matched
                                                          ? `Đợt PA: ${matched.notes || val}`
                                                          : `Đợt ${idx + 1}`,
                                                      },
                                                    );
                                                  }}
                                                  disabled={!canEdit}
                                                  className="w-full bg-white border border-slate-200 rounded-md px-2 py-1.5 text-[11px] font-medium text-slate-700 outline-none"
                                                >
                                                  <option value="">
                                                    -- Chọn đợt PA --
                                                  </option>
                                                  {draftRounds.map(
                                                    (draft: any, dIdx: number) => (
                                                      <option
                                                        key={draft.id}
                                                        value={draft.id}
                                                      >
                                                        Đợt {dIdx + 1}{" "}
                                                        {draft.notes
                                                          ? `(${draft.notes})`
                                                          : ""}
                                                      </option>
                                                    ),
                                                  )}
                                                </select>
                                              </div>
                                            </div>
                                          )}

                                          {isDecisionPublic && (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                              <div className="space-y-1.5">
                                                <label className="text-[9px] font-bold text-slate-400 uppercase">
                                                  Quyết định phê duyệt tương ứng
                                                </label>
                                                <select
                                                  value={round.approvalRoundId || ""}
                                                  onChange={(e) => {
                                                    const val = e.target.value;
                                                    const matched = approvalRounds.find(
                                                      (r: any) => r.id === val,
                                                    );
                                                    updateRound(
                                                      project.id,
                                                      stepKey,
                                                      round.id,
                                                      stepData,
                                                      {
                                                        approvalRoundId: val,
                                                        name: matched
                                                          ? `QĐ phê duyệt đợt: ${val}`
                                                          : `Đợt ${idx + 1}`,
                                                      },
                                                    );
                                                  }}
                                                  disabled={!canEdit}
                                                  className="w-full bg-white border border-slate-200 rounded-md px-2 py-1.5 text-[11px] font-medium text-slate-700 outline-none"
                                                >
                                                  <option value="">
                                                    -- Chọn Quyết định --
                                                  </option>
                                                  {approvalRounds.map(
                                                    (app: any, aIdx: number) => (
                                                      <option
                                                        key={app.id}
                                                        value={app.id}
                                                      >
                                                        QĐ đợt {aIdx + 1}{" "}
                                                        {app.decisionNo
                                                          ? `(Số: ${app.decisionNo})`
                                                          : ""}
                                                      </option>
                                                    ),
                                                  )}
                                                </select>
                                              </div>
                                            </div>
                                          )}

                                          {/* Simple Round/Date values */}
                                          <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-1.5">
                                              <label className="text-[9px] font-bold text-slate-400 uppercase">
                                                Từ ngày (Bắt đầu)
                                              </label>
                                              <CustomDatePicker
                                                value={
                                                  round.startDate ||
                                                  round.date ||
                                                  ""
                                                }
                                                onChange={(val) => {
                                                  updateRound(
                                                    project.id,
                                                    stepKey,
                                                    round.id,
                                                    stepData,
                                                    {
                                                      startDate: val,
                                                      date: val,
                                                    },
                                                  );
                                                }}
                                                readOnly={!canEdit}
                                              />
                                            </div>
                                            <div className="space-y-1.5">
                                              <label className="text-[9px] font-bold text-slate-400 uppercase">
                                                Đến ngày (Kết thúc)
                                              </label>
                                              <CustomDatePicker
                                                value={round.endDate || ""}
                                                onChange={(val) => {
                                                  updateRound(
                                                    project.id,
                                                    stepKey,
                                                    round.id,
                                                    stepData,
                                                    { endDate: val },
                                                  );
                                                }}
                                                readOnly={!canEdit}
                                              />
                                            </div>
                                          </div>

                                          {/* Documents links list of the round */}
                                          <div className="w-full border-t border-slate-100 pt-3">
                                            <DocumentLinkList
                                              links={round.links || []}
                                              onChange={(newLinks) =>
                                                updateRound(
                                                  project.id,
                                                  stepKey,
                                                  round.id,
                                                  stepData,
                                                  { links: newLinks },
                                                )
                                              }
                                              labelTitle="Hồ sơ công việc (Links) của đợt:"
                                              readOnly={!canEdit}
                                            />
                                          </div>

                                          {/* Common Delete Round */}
                                          {canEdit && (
                                            <div className="flex items-center justify-end pt-2 border-t border-slate-105 mt-2">
                                              {roundDeletingId === round.id ? (
                                                <div className="flex items-center gap-2 bg-red-50 p-1.5 rounded-lg border border-red-105">
                                                  <span className="text-[9px] font-bold text-red-700 uppercase px-1">
                                                    Xác nhận xoá đợt này?
                                                  </span>
                                                  <button
                                                    onClick={() =>
                                                      removeRound(
                                                        project.id,
                                                        stepKey,
                                                        round.id,
                                                        stepData,
                                                      )
                                                    }
                                                    className="px-2.5 py-1 bg-red-650 text-white text-[9px] font-bold rounded shadow-sm hover:bg-red-700 transition-colors uppercase cursor-pointer"
                                                  >
                                                    Có, Xoá
                                                  </button>
                                                  <button
                                                    onClick={() =>
                                                      setRoundDeletingId(null)
                                                    }
                                                    className="px-2.5 py-1 bg-white border border-slate-200 text-slate-600 text-[9px] font-bold rounded shadow-sm hover:bg-slate-50 transition-colors uppercase cursor-pointer"
                                                  >
                                                    Huỷ
                                                  </button>
                                                </div>
                                              ) : (
                                                <button
                                                  onClick={() =>
                                                    setRoundDeletingId(round.id)
                                                  }
                                                  className="flex items-center gap-1 text-[9px] font-bold text-red-500 hover:bg-red-50/50 hover:text-red-600 px-2.5 py-1.5 rounded-md uppercase transition-all cursor-pointer"
                                                >
                                                  <Trash2 className="w-3.5 h-3.5" />{" "}
                                                  Xoá đợt này
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
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* Common top-level document links */}
                {stepKey !== "landmarks_handover" &&
                  stepKey !== "inventory" &&
                  stepKey !== "plan_draft" &&
                  stepKey !== "agri_plan_draft" &&
                  stepKey !== "res_plan_draft" &&
                  stepKey !== "confirmation_request" &&
                  stepKey !== "agri_confirmation_request" &&
                  ![
                    "plan_public",
                    "agri_plan_public",
                    "res_plan_public",
                    "appraisal_submit",
                    "agri_appraisal_submit",
                    "res_appraisal_submit",
                    "approval",
                    "agri_approval",
                    "res_approval",
                    "decision_public",
                    "agri_decision_public",
                    "res_decision_public",
                  ].includes(stepKey) && (
                    <div className="w-full mt-2">
                      <DocumentLinkList
                        links={currentLinks}
                        onChange={(newLinks) =>
                          updateStepStatus(
                            project.id,
                            stepKey,
                            isObject
                              ? { ...(stepData as any), links: newLinks }
                              : { status: stepData, links: newLinks },
                          )
                        }
                        labelTitle="Hồ sơ công việc (Links):"
                        readOnly={!canEdit}
                      />
                    </div>
                  )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};
