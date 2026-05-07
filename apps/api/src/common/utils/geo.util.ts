export const COORDINATE_CACHE_DECIMALS = 4;

export const normalizeCoordinate = (
	value: number,
	decimals: number = COORDINATE_CACHE_DECIMALS,
): number => Number(value.toFixed(decimals));
