import type { DraftExtraction } from "./schemas";
import { buildConfirmedRecords } from "./confirm-draft";
import { createServiceClient } from "./supabase";
import type { IntakeMode } from "./types";

export type DraftRecord = {
  id: string;
  user_id: string;
  mode: IntakeMode;
  raw_text: string | null;
  source_url: string | null;
  extraction: DraftExtraction;
  status: "draft" | "confirmed" | "discarded";
};

export async function createIntakeDraft(args: {
  userId: string;
  mode: IntakeMode;
  rawText: string;
  sourceUrl?: string;
  extraction: DraftExtraction;
}): Promise<{ id: string }> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("intake_drafts")
    .insert({
      user_id: args.userId,
      mode: args.mode,
      raw_text: args.rawText,
      source_url: args.sourceUrl,
      extraction: args.extraction,
      status: "draft"
    })
    .select("id")
    .single();

  if (error) throw error;
  return { id: data.id };
}

export async function confirmDraft(args: {
  userId: string;
  draftId: string;
  extraction: DraftExtraction;
}): Promise<{ supplierId?: string; communicationId: string }> {
  const supabase = createServiceClient();
  const batch = buildConfirmedRecords(args);

  let supplierId: string | undefined;
  if (batch.supplier) {
    const { data, error } = await supabase
      .from("suppliers")
      .insert({
        user_id: batch.supplier.userId,
        name: batch.supplier.name,
        source_url: batch.supplier.sourceUrl,
        categories: batch.supplier.categories,
        location: batch.supplier.location,
        contact_name: batch.supplier.contactName,
        contact_method: batch.supplier.contactMethod,
        supplier_type: batch.supplier.supplierType,
        cooperation_level: batch.supplier.cooperationLevel,
        price_level: batch.supplier.priceLevel,
        quality_judgement: batch.supplier.qualityJudgement,
        risk_tags: batch.supplier.riskTags,
        notes: batch.supplier.notes,
        last_contact_at: new Date().toISOString()
      })
      .select("id")
      .single();

    if (error) throw error;
    supplierId = data.id;
  }

  const { data: communication, error: communicationError } = await supabase
    .from("communications")
    .insert({
      user_id: batch.communication.userId,
      supplier_id: supplierId,
      draft_id: batch.communication.draftId,
      source_type: batch.communication.sourceType,
      summary: batch.communication.summary,
      promises: batch.communication.promises,
      questions: batch.communication.questions,
      risks: batch.communication.risks,
      next_actions: batch.communication.nextActions
    })
    .select("id")
    .single();

  if (communicationError) throw communicationError;

  if (batch.offers.length > 0) {
    const { error } = await supabase.from("offers").insert(
      batch.offers.map((offer) => ({
        user_id: offer.userId,
        supplier_id: supplierId,
        communication_id: communication.id,
        name: offer.name,
        category: offer.category,
        quoted_price: offer.quotedPrice,
        moq: offer.moq,
        lead_time: offer.leadTime,
        specs: offer.specs,
        packaging: offer.packaging,
        sample_status: offer.sampleStatus,
        channel_fit: offer.channelFit,
        advantages: offer.advantages,
        risks: offer.risks,
        notes: offer.notes
      }))
    );
    if (error) throw error;
  }

  if (batch.productKnowledge.length > 0) {
    const { error } = await supabase.from("product_knowledge").insert(
      batch.productKnowledge.map((item) => ({
        user_id: item.userId,
        name: item.name,
        materials: item.materials,
        process: item.process,
        cost_structure: item.costStructure,
        key_parameters: item.keyParameters,
        quality_risks: item.qualityRisks,
        common_pitfalls: item.commonPitfalls,
        alternatives: item.alternatives,
        judgement: item.judgement,
        source_communication_id: communication.id
      }))
    );
    if (error) throw error;
  }

  if (batch.tasks.length > 0) {
    const { error } = await supabase.from("tasks").insert(
      batch.tasks.map((task) => ({
        user_id: task.userId,
        supplier_id: supplierId,
        communication_id: communication.id,
        title: task.title,
        due_text: task.dueText,
        priority: task.priority,
        task_type: task.taskType,
        status: "open"
      }))
    );
    if (error) throw error;
  }

  const { error: draftError } = await supabase
    .from("intake_drafts")
    .update({ status: "confirmed", updated_at: new Date().toISOString() })
    .eq("user_id", args.userId)
    .eq("id", args.draftId);

  if (draftError) throw draftError;

  return { supplierId, communicationId: communication.id };
}
