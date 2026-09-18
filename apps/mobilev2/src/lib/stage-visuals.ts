/**
 * The tile each pipeline stage wears — its icon and its two colours.
 *
 * Taken from the Penpot boards "03.2 All Stages" and "03.5 Move Stage", which
 * draw the same tile for the same stage. Kept here rather than in either
 * screen so the two cannot drift apart.
 */
import {
  CircleX,
  FileText,
  Phone,
  Plus,
  Trophy,
  Users,
} from "lucide-react-native";
import type { DealStageValue } from "@greatsales/shared";

import { color } from "@/design/tokens";

export interface StageVisual {
  Icon: typeof Plus;
  bg: string;
  fg: string;
}

export const STAGE_VISUALS: Record<DealStageValue, StageVisual> = {
  NewEnquiries: { Icon: Plus, bg: "#EAF2FC", fg: color.steel },
  NeedsAnalysis: { Icon: Phone, bg: color.mintSurface, fg: color.primaryDark },
  TrialsAndSampleTests: { Icon: Users, bg: color.steelSoft, fg: color.steel },
  ProposalsAndPriceQuote: { Icon: FileText, bg: color.amberSoft, fg: color.amber },
  NegotiationOralConfirmation: { Icon: Users, bg: color.steelSoft, fg: color.steel },
  ClosedWon: { Icon: Trophy, bg: color.mintSurface, fg: color.primaryDark },
  ClosedLost: { Icon: CircleX, bg: color.redSoft, fg: color.red },
  NoRequirementOrCold: { Icon: CircleX, bg: color.lineSoft, fg: color.muted },
  TrialProblem: { Icon: CircleX, bg: color.redSoft, fg: color.red },
};

/** Falls back rather than crashing if the API grows a stage this app predates. */
export function stageVisual(stage: DealStageValue): StageVisual {
  return STAGE_VISUALS[stage] ?? STAGE_VISUALS.NewEnquiries;
}
