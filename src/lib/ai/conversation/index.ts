export {
  AI_CONVERSATIONS_DEFAULT_LIMIT,
  AI_CONVERSATIONS_MAX_LIMIT,
  AI_MESSAGES_DEFAULT_LIMIT,
  AI_MESSAGES_MAX_LIMIT,
  AI_TITLE_MAX,
  assistSlotKeySchema,
  conversationIdParamSchema,
  createConversationBodySchema,
  ensureAssistConversationBodySchema,
  listConversationsQuerySchema,
  listMessagesQuerySchema,
  patchConversationBodySchema,
  pinnedTargetSchema,
  rebindAssistConversationBodySchema,
} from "@/lib/ai/conversation/schemas";
export {
  serializeConversation,
  serializeMessage,
  type AiConversationDto,
  type AiMessageDto,
  type PaginationDto,
} from "@/lib/ai/conversation/serialize";
export {
  aiError,
  notFound,
  parseSearchParams,
  requireAiUser,
  unauthorized,
  type AiApiErrorCode,
} from "@/lib/ai/conversation/http";
export {
  assistSlotKeyForCareerEmployer,
  assistSlotKeyForCareerEmployerDraft,
  assistSlotKeyForCareerProject,
  assistSlotKeyForCareerProjectDraft,
  assistSlotKeyForProfile,
  assistSlotKeyForProfileModule,
  normalizeAssistSlotKey,
  parseAssistSlotKey,
  validateAssistRebindKeys,
  validateAssistSlotBinding,
} from "@/lib/ai/conversation/assist-slot";
export { ensureAssistConversation } from "@/lib/ai/conversation/ensure-assist";
export { rebindAssistConversations } from "@/lib/ai/conversation/rebind-assist";
