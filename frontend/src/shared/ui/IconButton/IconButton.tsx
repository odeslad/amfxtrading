import type { ButtonHTMLAttributes, ReactNode } from 'react';
import styles from './IconButton.module.css';

export type IconButtonVariant = 'bordered' | 'bare';
export type IconButtonTone = 'neutral' | 'active' | 'danger';
export type IconButtonSize = 'sm' | 'md';

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label' | 'children'> {
  icon: ReactNode;
  label: string;
  variant?: IconButtonVariant;
  tone?: IconButtonTone;
  size?: IconButtonSize;
}

export function IconButton({
  icon,
  label,
  variant = 'bordered',
  tone = 'neutral',
  size = 'sm',
  type = 'button',
  className,
  ...rest
}: IconButtonProps) {
  const classes = [styles.iconButton, styles[variant], styles[tone], variant === 'bordered' ? styles[size] : '', className].filter(Boolean).join(' ');
  return (
    <button type={type} aria-label={label} title={label} className={classes} {...rest}>
      {icon}
    </button>
  );
}
