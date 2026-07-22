import type { DraftExtraction } from "./schemas";

export type ConfirmedRecordBatch = {
  supplier?: {
    userId: string;
    name: string;
    sourceUrl?: string;
    categories: string[];
    location?: string;
    contactName?: string;
    contactMethod?: string;
    supplierType: string;
    cooperationLevel?: string;
    priceLevel?: string;
    qualityJudgement?: string;
    riskTags: string[];
    notes?: string;
  };
  communication: {
    userId: string;
    draftId: string;
    sourceType: string;
    summary: string;
    promises: string[];
    questions: string[];
    risks: string[];
    nextActions: string[];
  };
  offers: Array<{
    userId: string;
    name: string;
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
  }>;
  productKnowledge: Array<{
    userId: string;
    name: string;
    materials?: string;
    process?: string;
    costStructure?: string;
    keyParameters?: string;
    qualityRisks?: string;
    commonPitfalls?: string;
    alternatives?: string;
    judgement?: string;
  }>;
  tasks: Array<{
    userId: string;
    title: string;
    dueText?: string;
    priority: string;
    taskType: string;
  }>;
  knowledgeCards: Array<{
    userId: string;
    title: string;
    source?: string;
    summary?: string;
    applicableScenarios: string[];
    steps: string[];
    scripts: string[];
    risks: string[];
    tags: string[];
  }>;
};

export function buildConfirmedRecords(input: {
  userId: string;
  draftId: string;
  extraction: DraftExtraction;
}): ConfirmedRecordBatch {
  const { userId, draftId, extraction } = input;

  return {
    supplier: extraction.supplier
      ? {
          userId,
          name: extraction.supplier.name,
          sourceUrl: extraction.supplier.sourceUrl,
          categories: extraction.supplier.categories,
          location: extraction.supplier.location,
          contactName: extraction.supplier.contactName,
          contactMethod: extraction.supplier.contactMethod,
          supplierType: extraction.supplier.supplierType,
          cooperationLevel: extraction.supplier.cooperationLevel,
          priceLevel: extraction.supplier.priceLevel,
          qualityJudgement: extraction.supplier.qualityJudgement,
          riskTags: extraction.supplier.riskTags,
          notes: extraction.supplier.notes
        }
      : undefined,
    communication: {
      userId,
      draftId,
      sourceType: "ai_intake",
      summary: extraction.communication.summary,
      promises: extraction.communication.promises,
      questions: extraction.communication.questions,
      risks: extraction.communication.risks,
      nextActions: extraction.communication.nextActions
    },
    offers: extraction.offers.map((offer) => ({
      userId,
      name: offer.name,
      category: offer.category,
      quotedPrice: offer.quotedPrice,
      moq: offer.moq,
      leadTime: offer.leadTime,
      specs: offer.specs,
      packaging: offer.packaging,
      sampleStatus: offer.sampleStatus,
      channelFit: offer.channelFit,
      advantages: offer.advantages,
      risks: offer.risks,
      notes: offer.notes
    })),
    productKnowledge: extraction.productKnowledge.map((item) => ({
      userId,
      name: item.name,
      materials: item.materials,
      process: item.process,
      costStructure: item.costStructure,
      keyParameters: item.keyParameters,
      qualityRisks: item.qualityRisks,
      commonPitfalls: item.commonPitfalls,
      alternatives: item.alternatives,
      judgement: item.judgement
    })),
    tasks: extraction.tasks.map((task) => ({
      userId,
      title: task.title,
      dueText: task.dueText,
      priority: task.priority,
      taskType: task.type
    })),
    knowledgeCards: extraction.knowledgeCards.map((card) => ({
      userId,
      title: card.title,
      source: card.source,
      summary: card.summary,
      applicableScenarios: card.applicableScenarios,
      steps: card.steps,
      scripts: card.scripts,
      risks: card.risks,
      tags: card.tags
    }))
  };
}
