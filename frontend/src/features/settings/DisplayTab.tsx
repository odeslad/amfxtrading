import { Hint } from '../../shared/ui';
import { MaTemplatesSection } from './MaTemplatesSection';
import { ChartSettings } from './ChartSettings';
import { CrossTradesSettings } from './CrossTradesSettings';
import { SetupLevelsSettings } from './SetupLevelsSettings';
import type { DisplaySettingsProps } from './displaySettings';
import styles from './DisplayTab.module.css';

export type { DisplaySettingsForm } from './displaySettings';

export function DisplayTab(props: DisplaySettingsProps) {
  return (
    <div className={styles.tab}>
      <Hint>How data is shown across the app.</Hint>
      <ChartSettings {...props} />
      <CrossTradesSettings {...props} />
      <SetupLevelsSettings {...props} />
      <MaTemplatesSection />
    </div>
  );
}
