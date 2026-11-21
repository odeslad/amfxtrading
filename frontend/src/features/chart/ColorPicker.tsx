import { ColorPicker as BaseColorPicker } from '../../shared/ui';
import { PALETTE } from './movingAverages';

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  label?: string;
}

export function ColorPicker(props: ColorPickerProps) {
  return <BaseColorPicker palette={PALETTE} {...props} />;
}
