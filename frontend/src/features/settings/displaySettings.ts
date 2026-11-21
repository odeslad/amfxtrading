import type { PnlMode, SetupLevelKey } from '../journal/utils/position';
import type { TrendlineStyle } from '../chart/DrawingTools';
import type { EmaTradesSettings } from '../chart/emaTrades';
import type { QuickOrders } from '../../lib/quickOrders';

export interface DisplaySettingsForm {
  pnlMode: PnlMode;
  trendlineColor: string;
  trendlineStyle: TrendlineStyle;
  trendlineWidth: number;
  rectLabels: boolean;
  showSpread: boolean;
  setupLevels: SetupLevelKey[];
  fibLevels: number[];
  emaTrades: EmaTradesSettings;
  quickOrders: QuickOrders | null;
}

export interface DisplaySettingsProps {
  display: DisplaySettingsForm;
  onChange: (patch: Partial<DisplaySettingsForm>) => void;
}
