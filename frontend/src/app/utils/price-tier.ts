export type PriceTier = 'cheap' | 'moderate' | 'expensive' | 'very-expensive';

export function priceTier(outputPerMillion: number): PriceTier {
  if (outputPerMillion <= 2) return 'cheap';
  if (outputPerMillion <= 10) return 'moderate';
  if (outputPerMillion <= 15) return 'expensive';
  return 'very-expensive';
}