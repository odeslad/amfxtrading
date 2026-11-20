// Spec 055: a colour filter holds several colours as "orange,blue" ('' = every colour), so the
// stored filters keep their shape and a single colour saved before still works.
export const parseColorFilter = (value: string): string[] => value.split(',').filter(Boolean);

export const matchesColorFilter = (value: string, color: string | undefined): boolean =>
  value === '' || parseColorFilter(value).includes(color ?? '');

export const toggleColorFilter = (value: string, color: string): string => {
  const colors = parseColorFilter(value);
  return (colors.includes(color) ? colors.filter(c => c !== color) : [...colors, color]).join(',');
};
