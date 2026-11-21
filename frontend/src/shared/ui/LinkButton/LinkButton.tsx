import type { ButtonHTMLAttributes } from 'react';
import styles from './LinkButton.module.css';

export type LinkTone = 'orange' | 'blue' | 'red';

export interface LinkButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: LinkTone;
  truncate?: boolean;
}

export function LinkButton({ tone = 'orange', truncate = false, type = 'button', className, ...rest }: LinkButtonProps) {
  const classes = [styles.link, styles[tone], truncate ? styles.truncate : '', className].filter(Boolean).join(' ');
  return <button type={type} className={classes} {...rest} />;
}
