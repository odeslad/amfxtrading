import { DateField, IsoDateField } from '../DateField';
import { controlClasses, type ControlSize } from '../Input/controlClasses';
import type { DateMode } from '../../../lib/dateField';

interface DateInputBaseProps {
  id?: string;
  required?: boolean;
  invalid?: boolean;
  size?: ControlSize;
  'aria-label'?: string;
}

export interface DateInputProps extends DateInputBaseProps {
  mode: DateMode;
  value: string;
  onChange: (text: string) => void;
}

export function DateInput({ size = 'md', ...rest }: DateInputProps) {
  return <DateField className={controlClasses(size)} {...rest} />;
}

export interface IsoDateInputProps extends DateInputBaseProps {
  value: string;
  onChange: (isoDate: string) => void;
}

export function IsoDateInput({ size = 'md', ...rest }: IsoDateInputProps) {
  return <IsoDateField className={controlClasses(size)} {...rest} />;
}
