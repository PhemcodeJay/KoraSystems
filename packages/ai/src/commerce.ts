export type CreditFactor = {
  name: string;
  weight: number;
  score: number;
  note: string;
};

export type CreditScoreResult = {
  score: number;
  risk: "LOW" | "MEDIUM" | "HIGH" | "VERY_HIGH";
  factors: CreditFactor[];
};

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

/** Explainable weighted score for human-reviewed SME credit applications. */
export function scoreCredit(factors: readonly CreditFactor[]): CreditScoreResult {
  const normalized = factors.map((factor) => ({
    ...factor,
    score: Math.round(clamp(factor.score, 0, 100)),
  }));
  const totalWeight = normalized.reduce(
    (total, factor) => total + Math.max(0, factor.weight),
    0,
  );
  if (totalWeight <= 0) throw new Error("Credit score requires positive factor weights.");

  const weighted = normalized.reduce(
    (total, factor) => total + factor.score * Math.max(0, factor.weight),
    0,
  ) / totalWeight;
  const score = Math.round(clamp(weighted * 10, 120, 940));
  const risk =
    score >= 750 ? "LOW" :
    score >= 580 ? "MEDIUM" :
    score >= 420 ? "HIGH" : "VERY_HIGH";

  return { score, risk, factors: normalized };
}

export type DemandObservation = {
  date: Date | string;
  quantity: number;
};

export type DemandForecast = {
  forecast7d: number;
  forecast30d: number;
  forecast90d: number;
  averageDailyDemand: number;
  daysUntilStockout: number | null;
  recommendedOrder: number;
  confidence: "LOW" | "MEDIUM" | "HIGH";
  model: "seasonal-naive-v1";
};

/**
 * A transparent weekly seasonal-naive forecast with a bounded recent trend.
 * Fewer than 14 distinct calendar days is treated as insufficient signal.
 */
export function forecastDemand(
  observations: readonly DemandObservation[],
  currentStock: number,
  reorderLevel: number,
  asOf = new Date(),
): DemandForecast {
  const byDay = new Map<string, number>();
  for (const observation of observations) {
    const date = new Date(observation.date);
    if (!Number.isFinite(date.getTime()) || !Number.isFinite(observation.quantity)) continue;
    const key = date.toISOString().slice(0, 10);
    byDay.set(key, (byDay.get(key) ?? 0) + Math.max(0, observation.quantity));
  }

  const days = [...byDay.entries()]
    .map(([key, quantity]) => ({ date: new Date(`${key}T00:00:00.000Z`), quantity }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
  if (days.length < 14) {
    return {
      forecast7d: 0,
      forecast30d: 0,
      forecast90d: 0,
      averageDailyDemand: 0,
      daysUntilStockout: null,
      recommendedOrder: 0,
      confidence: "LOW",
      model: "seasonal-naive-v1",
    };
  }

  const recent = days.slice(-28);
  const previous = days.slice(-56, -28);
  const mean = (values: readonly { quantity: number }[]) =>
    values.reduce((sum, value) => sum + value.quantity, 0) / values.length;
  const recentMean = mean(recent);
  const previousMean = previous.length ? mean(previous) : recentMean;
  const trend = previousMean > 0
    ? clamp((recentMean - previousMean) / previousMean, -0.5, 0.5)
    : 0;
  const seasonalWindow = days.slice(-56);
  const forecastDays: number[] = [];
  for (let offset = 1; offset <= 90; offset++) {
    const target = new Date(asOf.getTime() + offset * 86_400_000);
    const weekday = target.getUTCDay();
    const sameWeekday = seasonalWindow.filter((day) => day.date.getUTCDay() === weekday);
    const seasonalMean = sameWeekday.length ? mean(sameWeekday) : recentMean;
    const trendMultiplier = 1 + trend * Math.min(offset / 30, 1);
    forecastDays.push(Math.max(0, seasonalMean * trendMultiplier));
  }

  const demand = forecastDays.reduce((sum, quantity) => sum + quantity, 0);
  let remaining = Math.max(0, currentStock);
  let daysUntilStockout: number | null = null;
  for (let i = 0; i < forecastDays.length; i++) {
    remaining -= forecastDays[i];
    if (remaining <= 0 && forecastDays[i] > 0) {
      daysUntilStockout = i + 1;
      break;
    }
  }
  const forecast7d = forecastDays.slice(0, 7).reduce((sum, value) => sum + value, 0);
  const forecast30d = forecastDays.slice(0, 30).reduce((sum, value) => sum + value, 0);
  const averageDailyDemand = demand / forecastDays.length;
  const coefficientOfVariation = recentMean > 0
    ? Math.sqrt(
        recent.reduce((sum, day) => sum + (day.quantity - recentMean) ** 2, 0) /
          recent.length,
      ) / recentMean
    : 0;
  const confidence =
    days.length >= 56 && coefficientOfVariation < 1 ? "HIGH" :
    days.length >= 28 ? "MEDIUM" : "LOW";
  const targetStock = Math.max(reorderLevel, forecast30d);

  return {
    forecast7d: Math.round(forecast7d * 100) / 100,
    forecast30d: Math.round(forecast30d * 100) / 100,
    forecast90d: Math.round(demand * 100) / 100,
    averageDailyDemand: Math.round(averageDailyDemand * 100) / 100,
    daysUntilStockout,
    recommendedOrder: Math.max(0, Math.ceil(targetStock - Math.max(0, currentStock))),
    confidence,
    model: "seasonal-naive-v1",
  };
}
