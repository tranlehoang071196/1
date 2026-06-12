export interface CustomStep {
  id: string;
  categoryId: string;
  name: string;
  status: StepStatus;
  date?: string;
  deadline?: string;
  links?: string[];
}

export type IssueReason = 'tranh_chap' | 'vang_chu' | 'khong_dong_y_gia' | 'khac';

export interface InventoryIssue {
  id: string;
  householdName: string;
  landType: 'agri' | 'resident';
  reason: string;
  notes: string;
  status: 'pending' | 'resolved';
  createdAt: string;
  resolvedAt?: string;
  history?: {
    id: string;
    date: string;
    action: string;
    note: string;
  }[];
}

export interface Obstacle {
  id: string;
  type: 'inventory' | 'public' | 'payment';
  ownerName: string;
  address: string;
  phone: string;
  issue: string;
  resolution: string;
  result: string;
  status: 'pending' | 'resolved';
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  obstacleScope?: 'single' | 'multi';
  totalHouseholds?: number;
  resolvedHouseholds?: number;
  landPlot?: string;
  landType?: 'agri' | 'resident';
}

export interface ProjectActivity {
  id: string;
  userName: string;
  userEmail: string;
  action: string;
  target?: string;
  timestamp: any;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'completed' | 'archived';
  projectType?: 'agri' | 'resident' | 'both';
  disabledCategories?: string[];
  disabledSteps?: string[];
  ownerId: string;
  createdAt: any;
  updatedAt: any;
  deadline?: any;
  inventoryIssues?: InventoryIssue[];
  steps: ProjectSteps;
  customSteps?: CustomStep[];
  stepsOrder?: Record<string, string[]>;
  authorizedEmails?: string[];
  location?: string;
  investor?: string;
  documentLink?: string;
  activities?: ProjectActivity[];
}

export type StepStatus = 'pending' | 'in_progress' | 'completed' | 'not_applicable';

export interface StepRound {
  id: string;
  name: string;
  status: StepStatus;
  date?: string;
  amount?: number;
  cost?: number;
  links?: any[];
  plots?: number;
  households?: number;
}

export interface ProjectSteps {
  [key: string]: any;
  landmarks_handover: StepStatus | { status: StepStatus; date?: string; name?: string; deadline?: string };
  acquisition_plan: StepStatus | { status: StepStatus; date?: string; links?: string[]; name?: string; deadline?: string };
  deployment_meeting: StepStatus | { status: StepStatus; date?: string; links?: string[]; invitationDate?: string; name?: string; deadline?: string };
  notice_request: StepStatus | { status: StepStatus; date?: string; links?: string[]; name?: string; deadline?: string };
  budget_estimate: StepStatus | { status: StepStatus; date?: string; name?: string; deadline?: string };
  inventory: { 
    status: StepStatus;
    deadline?: string;
    agriPlots?: number;
    agriHouseholds?: number;
    nonAgriPlots?: number;
    nonAgriHouseholds?: number;
    agriTypes?: any[];
    nonAgriTypes?: any[];
    orgs?: number;
    graves?: number;
    assets?: number;
    structures?: number;
    graveHouseholds?: number;
    rounds?: any[];
  };
  confirmation_request: StepStatus | { status: StepStatus; date?: string; links?: string[]; name?: string; deadline?: string };
  plan_draft: StepStatus | { status: StepStatus; date?: string; name?: string; deadline?: string };
  plan_public: StepStatus | { status: StepStatus; links?: string[]; rounds?: StepRound[]; name?: string; deadline?: string };
  appraisal_submit: StepStatus | { 
    status: StepStatus; 
    amount?: number; 
    cost?: number; 
    links?: string[];
    plots?: number;
    households?: number;
    rounds?: StepRound[];
    name?: string;
    deadline?: string;
  };
  approval: StepStatus | { 
    status: StepStatus; 
    amount?: number; 
    cost?: number; 
    links?: string[];
    plots?: number;
    households?: number;
    rounds?: StepRound[];
    name?: string;
    deadline?: string;
  };
  decision_public: StepStatus | { status: StepStatus; links?: string[]; rounds?: StepRound[]; name?: string; deadline?: string };
  payment: StepStatus | { 
    status: StepStatus; 
    amount?: number;
    donePlots?: number;
    totalPlots?: number;
    doneHouseholds?: number;
    totalHouseholds?: number;
    links?: any[];
    rounds?: StepRound[];
    name?: string;
    deadline?: string;
  };
}

export const STEP_LABELS: Record<string, string> = {
  landmarks_handover: 'Nhận bàn giao mốc GPMB tại thực địa',
  acquisition_plan: 'Xây dựng kế hoạch thu hồi đất',
  deployment_meeting: 'Họp triển khai',
  notice_request: 'Đề nghị ban hành thông báo thu hồi đất',
  budget_estimate: 'Lập dự toán chi phí tổ chức thực hiện',
  
  inventory: 'Kiểm đếm đất',
  confirmation_request: 'Gửi VB đề nghị xác nhận nhân khẩu, tổng giao, nguồn gốc đất, nguồn gốc tài sản,...',
  plan_draft: 'Lập phương án bồi thường, hỗ trợ, tái định cư',
  plan_public: 'Niêm yết công khai phương án bồi thường',
  appraisal_submit: 'Trình phương án thẩm định',
  approval: 'Phê duyệt phương án',
  decision_public: 'Niêm yết công khai quyết định phê duyệt phương án',
  payment: 'Chi trả tiền',
};

export const STEPS_WITH_ROUNDS = [
  'inventory',
  'plan_public',
  'appraisal_submit',
  'approval',
  'decision_public',
  'payment'
];

export const STEP_CATEGORIES = [
  {
    id: 'preparation',
    name: 'Công tác chuẩn bị',
    steps: ['landmarks_handover', 'acquisition_plan', 'deployment_meeting', 'notice_request', 'budget_estimate']
  },
  {
    id: 'execution_detail',
    name: 'Chi tiết quá trình thực hiện',
    steps: ['inventory', 'confirmation_request', 'plan_draft', 'plan_public', 'appraisal_submit', 'approval', 'decision_public', 'payment']
  }
];
