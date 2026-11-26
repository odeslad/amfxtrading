import styles from './GroupStar.module.css';

export interface GroupStarProps {
  color: string;
  label?: string;
}

// Spec 062: marks the entries of one mirror group; the colour comes from the backend palette.
export function GroupStar({ color, label = 'Mirror group' }: GroupStarProps) {
  return (
    <svg className={styles.star} viewBox="0 0 24 24" role="img" aria-label={label}>
      <path d="M12 2l3 6.6 7.2.8-5.4 4.9 1.5 7.1L12 17.8 5.7 21.4l1.5-7.1L1.8 9.4 9 8.6z" fill={color} />
    </svg>
  );
}
