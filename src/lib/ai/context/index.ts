export type {
  AiConversationRef,
  AiContextFragment,
  AiContextResolveInput,
  AiContextSource,
  AiPageContext,
  AiTargetContext,
  ProfileTargetSection,
  ResolvedAiContext,
} from "@/lib/ai/context/types";
export {
  MY_CAREER_DENIED_PROFILE_FIELDS,
  MY_CAREER_PROFILE_WHITELIST,
  collectObjectKeys,
  containsDeniedProfileField,
  dateToYm,
  jaLocalized,
  pickFields,
} from "@/lib/ai/context/sensitive";
export {
  applyPageNavigation,
  targetsEqual,
  type NavigationState,
} from "@/lib/ai/context/navigation";
export {
  createAiContextRegistry,
  getDefaultAiContextSources,
} from "@/lib/ai/context/registry";
export {
  createMyCareerContextSource,
  MY_CAREER_SOURCE_ID,
} from "@/lib/ai/context/sources/my-career";
export { trimContextFragments } from "@/lib/ai/context/trim";
export {
  resolveAiContext,
  type ResolveAiContextOptions,
} from "@/lib/ai/context/resolve";
