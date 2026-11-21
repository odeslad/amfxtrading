import { SETUP_LEVEL_KEYS, type SetupLevelKey } from '../journal/utils/position';
import { Card, Section, Toggle } from '../../shared/ui';
import type { DisplaySettingsProps } from './displaySettings';
import styles from './displaySettings.module.css';

const LEVEL_MEANING: Record<SetupLevelKey, string> = {
  ECC: 'Cross candle close',
  EMA: 'EMA cross price',
  EVL: 'Fast EMA extreme',
  MHL: 'Window high / low',
};

// Settings › Trading › New trade: the setup levels listed in the New Trade panel.
export function SetupLevelsSettings({ display, onChange }: DisplaySettingsProps) {
  const toggleLevel = (key: SetupLevelKey, on: boolean) => {
    const next = SETUP_LEVEL_KEYS.filter(k => (k === key ? on : display.setupLevels.includes(k)));
    onChange({ setupLevels: next });
  };

  return (
    <Section title="New trade · setup levels" description="Levels listed in the New Trade panel. All off hides the panel.">
      <div className={`${styles.cardGrid} ${styles.groupBody}`}>
        {SETUP_LEVEL_KEYS.map(key => (
          <Card
            key={key}
            title={key}
            meta={LEVEL_MEANING[key]}
            actions={<Toggle checked={display.setupLevels.includes(key)} onChange={on => toggleLevel(key, on)} label={key} />}
          />
        ))}
      </div>
    </Section>
  );
}
