/**
 * Which pipeline stages count as open, and the funnel in full.
 *
 * Deliberately free of any UI import. The data sources need these sets, and
 * `@/lib/labels` pulls in `ChipTone` from the component barrel — importing the
 * sets from there would make the data layer depend on the component tree and
 * close a require cycle. Labels re-exports them, so screens can keep using the
 * one import they already have.
 */
import type { DealStageValue } from "@greatsales/shared";

/**
 * The stages a deal is still live in — the pipeline's default view.
 *
 * "Trial Problem" is open: the deal is stuck, not finished.
 */
export const OPEN_STAGES: DealStageValue[] = [
  "NewEnquiries",
  "NeedsAnalysis",
  "TrialsAndSampleTests",
  "ProposalsAndPriceQuote",
  "NegotiationOralConfirmation",
  "TrialProblem",
];

/** The funnel in full, in funnel order — open stages, then the closed ones. */
export const ALL_STAGES: DealStageValue[] = [
  ...OPEN_STAGES,
  "ClosedWon",
  "ClosedLost",
  "NoRequirementOrCold",
];

/** How each stage is written to a person. Nothing renders the raw enum. */
export const DEAL_STAGE_LABELS: Record<DealStageValue, string> = {
  NewEnquiries: "New Enquiry",
  NeedsAnalysis: "Discovery",
  TrialsAndSampleTests: "Trial",
  ProposalsAndPriceQuote: "Proposal Sent",
  NegotiationOralConfirmation: "Negotiation",
  ClosedWon: "Closed Won",
  ClosedLost: "Closed Lost",
  NoRequirementOrCold: "No Requirement",
  TrialProblem: "Trial Problem",
};

export function isOpenStage(stage: DealStageValue): boolean {
  return OPEN_STAGES.includes(stage);
}
