import type { calls } from "../db/schema.js";

export type ConnectionQualityLabel = "excellent" | "good" | "poor" | "lost" | "unknown";

export interface CallTelemetrySample {
  bitrate?: number | null;
  packetLoss?: number | null;
  jitterMs?: number | null;
  rttMs?: number | null;
  connectionQuality?: string | null;
  qualityScore?: number | null;
  participantCount?: number | null;
  reconnectCount?: number | null;
}

export interface CallTelemetryAggregate {
  sampleCount: number;
  bitrateTotal: number;
  bitrateSamples: number;
  avgBitrate: number | null;
  packetLossTotal: number;
  packetLossSamples: number;
  avgPacketLoss: number | null;
  jitterTotalMs: number;
  jitterSamples: number;
  avgJitterMs: number | null;
  rttTotalMs: number;
  rttSamples: number;
  avgRttMs: number | null;
  qualityScoreTotal: number;
  qualityScoreSamples: number;
  qualityScore: number | null;
  connectionQuality: ConnectionQualityLabel;
  participantCount: number;
  reconnectCount: number;
  updatedAt: number;
}

type CallRowUpdate = Partial<typeof calls.$inferInsert>;

const QUALITY_SCORE_MAP: Record<ConnectionQualityLabel, number | null> = {
  excellent: 4.5,
  good: 3.8,
  poor: 2.6,
  lost: 1.5,
  unknown: null,
};

const QUALITY_WEIGHT_MAP: Record<ConnectionQualityLabel, number> = {
  excellent: 5,
  good: 4,
  poor: 3,
  lost: 2,
  unknown: 1,
};

function normalizeFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

export function normalizeConnectionQuality(value: unknown): ConnectionQualityLabel {
  if (typeof value !== "string") {
    return "unknown";
  }

  const normalized = value.toLowerCase();
  if (normalized === "excellent" || normalized === "good" || normalized === "poor" || normalized === "lost") {
    return normalized;
  }

  return "unknown";
}

function resolveQualityScore(sample: CallTelemetrySample, quality: ConnectionQualityLabel): number | null {
  const explicitScore = normalizeFiniteNumber(sample.qualityScore);
  if (explicitScore !== null) {
    return explicitScore;
  }

  return QUALITY_SCORE_MAP[quality];
}

function roundMetric(value: number | null, digits = 1): number | null {
  if (value === null || !Number.isFinite(value)) {
    return null;
  }

  const multiplier = 10 ** digits;
  return Math.round(value * multiplier) / multiplier;
}

export function createEmptyTelemetryAggregate(): CallTelemetryAggregate {
  return {
    sampleCount: 0,
    bitrateTotal: 0,
    bitrateSamples: 0,
    avgBitrate: null,
    packetLossTotal: 0,
    packetLossSamples: 0,
    avgPacketLoss: null,
    jitterTotalMs: 0,
    jitterSamples: 0,
    avgJitterMs: null,
    rttTotalMs: 0,
    rttSamples: 0,
    avgRttMs: null,
    qualityScoreTotal: 0,
    qualityScoreSamples: 0,
    qualityScore: null,
    connectionQuality: "unknown",
    participantCount: 0,
    reconnectCount: 0,
    updatedAt: Date.now(),
  };
}

export function mergeTelemetryAggregate(
  current: CallTelemetryAggregate | null | undefined,
  sample: CallTelemetrySample,
): CallTelemetryAggregate {
  const base = current ? { ...current } : createEmptyTelemetryAggregate();
  const now = Date.now();

  base.sampleCount += 1;
  base.updatedAt = now;

  const bitrate = normalizeFiniteNumber(sample.bitrate);
  if (bitrate !== null && bitrate >= 0) {
    base.bitrateTotal += bitrate;
    base.bitrateSamples += 1;
    base.avgBitrate = Math.round(base.bitrateTotal / base.bitrateSamples);
  }

  const packetLoss = normalizeFiniteNumber(sample.packetLoss);
  if (packetLoss !== null && packetLoss >= 0) {
    base.packetLossTotal += packetLoss;
    base.packetLossSamples += 1;
    base.avgPacketLoss = roundMetric(base.packetLossTotal / base.packetLossSamples);
  }

  const jitterMs = normalizeFiniteNumber(sample.jitterMs);
  if (jitterMs !== null && jitterMs >= 0) {
    base.jitterTotalMs += jitterMs;
    base.jitterSamples += 1;
    base.avgJitterMs = Math.round(base.jitterTotalMs / base.jitterSamples);
  }

  const rttMs = normalizeFiniteNumber(sample.rttMs);
  if (rttMs !== null && rttMs >= 0) {
    base.rttTotalMs += rttMs;
    base.rttSamples += 1;
    base.avgRttMs = Math.round(base.rttTotalMs / base.rttSamples);
  }

  const quality = normalizeConnectionQuality(sample.connectionQuality);
  if (quality !== "unknown" && QUALITY_WEIGHT_MAP[quality] < QUALITY_WEIGHT_MAP[base.connectionQuality]) {
    base.connectionQuality = quality;
  } else if (base.connectionQuality === "unknown") {
    base.connectionQuality = quality;
  }

  const qualityScore = resolveQualityScore(sample, quality);
  if (qualityScore !== null) {
    base.qualityScoreTotal += qualityScore;
    base.qualityScoreSamples += 1;
    base.qualityScore = roundMetric(base.qualityScoreTotal / base.qualityScoreSamples);
  }

  const participantCount = normalizeFiniteNumber(sample.participantCount);
  if (participantCount !== null) {
    base.participantCount = Math.max(base.participantCount, Math.round(participantCount));
  }

  const reconnectCount = normalizeFiniteNumber(sample.reconnectCount);
  if (reconnectCount !== null) {
    base.reconnectCount = Math.max(base.reconnectCount, Math.round(reconnectCount));
  }

  return base;
}

export function telemetryAggregateToCallUpdate(aggregate: CallTelemetryAggregate | null | undefined): CallRowUpdate {
  if (!aggregate) {
    return {};
  }

  return {
    mos: aggregate.qualityScore !== null ? aggregate.qualityScore.toFixed(1) : null,
    avgBitrate: aggregate.avgBitrate,
    packetLoss: aggregate.avgPacketLoss !== null ? aggregate.avgPacketLoss.toFixed(1) : null,
    avgJitterMs: aggregate.avgJitterMs,
    avgRttMs: aggregate.avgRttMs,
    reconnectCount: aggregate.reconnectCount,
    telemetrySamples: aggregate.sampleCount,
    connectionQuality: aggregate.connectionQuality === "unknown" ? null : aggregate.connectionQuality,
  };
}
