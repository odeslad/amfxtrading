import type { ButtonHTMLAttributes } from 'react';
import styles from './Button.module.css';

export type ButtonVariant =
  | 'primary'
  | 'buy'
  | 'sell'
  | 'outlined'
  | 'buyOutline'
  | 'edit'
  | 'danger'
  | 'ghost'
  | 'dashed';

export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function Button({ variant = 'outlined', size = 'md', type = 'button', className, ...rest }: ButtonProps) {
  const classes = [styles.button, styles[size], styles[variant], className].filter(Boolean).join(' ');
  return <button type={type} className={classes} {...rest} />;
}
