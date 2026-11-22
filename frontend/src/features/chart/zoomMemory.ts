// Chart zoom remembered in this browser (spec 059): horizontal by timeframe, vertical by pair and timeframe.

interface ChartZoom {
  barSpacing: Partial<Record<string, number>>;
  priceHeight: Partial<Record<string, number>>;
}

const STORAGE_KEY = 'chart.zoom';
const MIN_BAR_SPACING = 0.5;
const MAX_BAR_SPACING = 100;

const priceKey = (symbol: string, timeframe: string): string => `${symbol}|${timeframe}`;

function readZoom(): ChartZoom {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    if (parsed && typeof parsed === 'object') {
      const zoom = parsed as Partial<ChartZoom>;
      return { barSpacing: zoom.barSpacing ?? {}, priceHeight: zoom.priceHeight ?? {} };
    }
  } catch {
    // corrupt or unavailable storage: start empty
  }
  return { barSpacing: {}, priceHeight: {} };
}

function writeZoom(zoom: ChartZoom): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(zoom));
  } catch {
    // storage full or unavailable: the chart keeps working without memory
  }
}

const validBarSpacing = (px: unknown): px is number =>
  typeof px === 'number' && Number.isFinite(px) && px >= MIN_BAR_SPACING && px <= MAX_BAR_SPACING;

const validHeight = (height: unknown): height is number =>
  typeof height === 'number' && Number.isFinite(height) && height > 0;

export function readBarSpacing(timeframe: string): number | null {
  const px = readZoom().barSpacing[timeframe];
  return validBarSpacing(px) ? px : null;
}

export function saveBarSpacing(timeframe: string, px: number): void {
  if (!validBarSpacing(px)) return;
  const zoom = readZoom();
  writeZoom({ ...zoom, barSpacing: { ...zoom.barSpacing, [timeframe]: px } });
}

export function readPriceHeight(symbol: string, timeframe: string): number | null {
  const height = readZoom().priceHeight[priceKey(symbol, timeframe)];
  return validHeight(height) ? height : null;
}

export function savePriceHeight(symbol: string, timeframe: string, height: number | null): void {
  const zoom = readZoom();
  const priceHeight = { ...zoom.priceHeight };
  if (height === null) delete priceHeight[priceKey(symbol, timeframe)];
  else if (validHeight(height)) priceHeight[priceKey(symbol, timeframe)] = height;
  else return;
  writeZoom({ ...zoom, priceHeight });
}
