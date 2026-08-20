export type IntakeMode = "screenshot" | "chat" | "summary";

export type Priority = "low" | "medium" | "high";

export type SupplierType = "factory" | "trader" | "unknown";

export type DraftStatus = "draft" | "confirmed" | "discarded";

export type SupplierDraft = {
  name: string;
  sourceUrl?: string;
  categories: string[];
  location?: string;
  contactName?: string;
  contactMethod?: string;
  supplierType: SupplierType;
  cooperationLevel?: string;
  priceLevel?: string;
  qualityJudgement?: string;
  riskTags: string[];
  notes?: string;
};

export type CommunicationDraft = {
  summary: string;
  promises: string[];
  questions: string[];
  risks: string[];
  nextActions: string[];
};

export type OfferDraft = {
  name: string;
  supplierName?: string;
  category?: string;
  quotedPrice?: string;
  moq?: string;
  leadTime?: string;
  specs?: string;
  packaging?: string;
  sampleStatus?: string;
  channelFit?: string;
  advantages?: string;
  risks?: string;
  notes?: string;
};

export type ProductKnowledgeDraft = {
  name: string;
  materials?: string;
  process?: string;
  costStructure?: string;
  keyParameters?: string;
  qualityRisks?: string;
  commonPitfalls?: string;
  alternatives?: string;
  judgement?: string;
};

export type TaskDraft = {
  title: string;
  dueText?: string;
  priority: Priority;
  type:
    | "confirm_quote"
    | "follow_sample"
    | "confirm_moq"
    | "confirm_lead_time"
    | "supplement_product_knowledge"
    | "review_supplier"
    | "follow_up";
};
