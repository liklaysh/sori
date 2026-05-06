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
  minBitrate: number | null;
  packetLossTotal: number;
  packetLossSamples: number;
  avgPacketLoss: number | null;
  maxPacketLoss: number | null;
  jitterTotalMs: number;
  jitterSamples: number;
  avgJitterMs: number | null;
  maxJitterMs: number | null;
  rttTotalMs: number;
  rttSamples: number;
  avgRttMs: number | null;
  maxRttMs: number | null;
  qualityScoreTotal: number;
  qualityScoreSamples: number;
  qualityScore: number | null;
  connectionQuality: ConnectionQualityLabel;
  avgConnectionQuality: ConnectionQualityLabel;
  excellentSamples: number;
  goodSamples: number;
  poorSamples: number;
  lostSamples: number;
  participantCount: number;
  reconnectCount: number;
  updatedAt: number;
}

type CallRowUpdate = Partial<typeof calls.$inferInsert>;
export type CallTelemetryDegradationReason =
  | "stable"
  | "no_samples"
  | "packet_loss"
  | "jitter"
  | "rtt"
  | "low_bitrate"
  | "reconnects"
  | "lost_connection"
  | "poor_quality";

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

function qualityScoreToLabel(score: number | null): ConnectionQualityLabel {
  if (score === null) {
    return "unknown";
  }

  if (score >= 4.15) {
    return "excellent";
  }

  if (score >= 3.2) {
    return "good";
  }

  if (score >= 2.05) {
    return "poor";
  }

  return "lost";
}

export function createEmptyTelemetryAggregate(): CallTelemetryAggregate {
  return {
    sampleCount: 0,
    bitrateTotal: 0,
    bitrateSamples: 0,
    avgBitrate: null,
    minBitrate: null,
    packetLossTotal: 0,
    packetLossSamples: 0,
    avgPacketLoss: null,
    maxPacketLoss: null,
    jitterTotalMs: 0,
    jitterSamples: 0,
    avgJitterMs: null,
    maxJitterMs: null,
    rttTotalMs: 0,
    rttSamples: 0,
    avgRttMs: null,
    maxRttMs: null,
    qualityScoreTotal: 0,
    qualityScoreSamples: 0,
    qualityScore: null,
    connectionQuality: "unknown",
    avgConnectionQuality: "unknown",
    excellentSamples: 0,
    goodSamples: 0,
    poorSamples: 0,
    lostSamples: 0,
    participantCount: 0,
    reconnectCount: 0,
    updatedAt: Date.now(),
  };
}

export function hydrateTelemetryAggregate(
  aggregate: CallTelemetryAggregate | null | undefined,
): CallTelemetryAggregate | null {
  if (!aggregate) {
    return null;
  }

  const hydrated = { ...createEmptyTelemetryAggregate(), ...aggregate };
  if (hydrated.qualityScore !== null && hydrated.avgConnectionQuality === "unknown") {
    hydrated.avgConnectionQuality = qualityScoreToLabel(hydrated.qualityScore);
  }

  return hydrated;
}

export function mergeTelemetryAggregate(
  current: CallTelemetryAggregate | null | undefined,
  sample: CallTelemetrySample,
): CallTelemetryAggregate {
  const base = hydrateTelemetryAggregate(current) ?? createEmptyTelemetryAggregate();
  const now = Date.now();

  base.sampleCount += 1;
  base.updatedAt = now;

  const bitrate = normalizeFiniteNumber(sample.bitrate);
  if (bitrate !== null && bitrate >= 0) {
    base.bitrateTotal += bitrate;
    base.bitrateSamples += 1;
    base.avgBitrate = Math.round(base.bitrateTotal / base.bitrateSamples);
    base.minBitrate = base.minBitrate === null ? Math.round(bitrate) : Math.min(base.minBitrate, Math.round(bitrate));
  }

  const packetLoss = normalizeFiniteNumber(sample.packetLoss);
  if (packetLoss !== null && packetLoss >= 0) {
    base.packetLossTotal += packetLoss;
    base.packetLossSamples += 1;
    base.avgPacketLoss = roundMetric(base.packetLossTotal / base.packetLossSamples);
    base.maxPacketLoss = base.maxPacketLoss === null ? roundMetric(packetLoss) : Math.max(base.maxPacketLoss, roundMetric(packetLoss) ?? 0);
  }

  const jitterMs = normalizeFiniteNumber(sample.jitterMs);
  if (jitterMs !== null && jitterMs >= 0) {
    base.jitterTotalMs += jitterMs;
    base.jitterSamples += 1;
    base.avgJitterMs = Math.round(base.jitterTotalMs / base.jitterSamples);
    base.maxJitterMs = base.maxJitterMs === null ? Math.round(jitterMs) : Math.max(base.maxJitterMs, Math.round(jitterMs));
  }

  const rttMs = normalizeFiniteNumber(sample.rttMs);
  if (rttMs !== null && rttMs >= 0) {
    base.rttTotalMs += rttMs;
    base.rttSamples += 1;
    base.avgRttMs = Math.round(base.rttTotalMs / base.rttSamples);
    base.maxRttMs = base.maxRttMs === null ? Math.round(rttMs) : Math.max(base.maxRttMs, Math.round(rttMs));
  }

  const quality = normalizeConnectionQuality(sample.connectionQuality);
  if (quality !== "unknown" && QUALITY_WEIGHT_MAP[quality] < QUALITY_WEIGHT_MAP[base.connectionQuality]) {
    base.connectionQuality = quality;
  } else if (base.connectionQuality === "unknown") {
    base.connectionQuality = quality;
  }

  if (quality === "excellent") {
    base.excellentSamples += 1;
  } else if (quality === "good") {
    base.goodSamples += 1;
  } else if (quality === "poor") {
    base.poorSamples += 1;
  } else if (quality === "lost") {
    base.lostSamples += 1;
  }

  const qualityScore = resolveQualityScore(sample, quality);
  if (qualityScore !== null) {
    base.qualityScoreTotal += qualityScore;
    base.qualityScoreSamples += 1;
    base.qualityScore = roundMetric(base.qualityScoreTotal / base.qualityScoreSamples);
    base.avgConnectionQuality = qualityScoreToLabel(base.qualityScore);
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
  const hydrated = hydrateTelemetryAggregate(aggregate);
  if (!hydrated) {
    return {};
  }

  return {
    mos: hydrated.qualityScore !== null ? hydrated.qualityScore.toFixed(1) : null,
    avgBitrate: hydrated.avgBitrate,
    minBitrate: hydrated.minBitrate,
    packetLoss: hydrated.avgPacketLoss !== null ? hydrated.avgPacketLoss.toFixed(1) : null,
    maxPacketLoss: hydrated.maxPacketLoss !== null ? hydrated.maxPacketLoss.toFixed(1) : null,
    avgJitterMs: hydrated.avgJitterMs,
    maxJitterMs: hydrated.maxJitterMs,
    avgRttMs: hydrated.avgRttMs,
    maxRttMs: hydrated.maxRttMs,
    reconnectCount: hydrated.reconnectCount,
    telemetrySamples: hydrated.sampleCount,
    connectionQuality: hydrated.connectionQuality === "unknown" ? null : hydrated.connectionQuality,
    avgConnectionQuality: hydrated.avgConnectionQuality === "unknown" ? null : hydrated.avgConnectionQuality,
    excellentSamples: hydrated.excellentSamples,
    goodSamples: hydrated.goodSamples,
    poorSamples: hydrated.poorSamples,
    lostSamples: hydrated.lostSamples,
  };
}

export function diagnoseTelemetryDegradation(
  telemetry: Partial<CallTelemetryAggregate> | null | undefined,
): CallTelemetryDegradationReason[] {
  if (!telemetry || !telemetry.sampleCount) {
    return ["no_samples"];
  }

  const reasons: CallTelemetryDegradationReason[] = [];

  if ((telemetry.reconnectCount ?? 0) > 0) {
    reasons.push("reconnects");
  }

  if ((telemetry.lostSamples ?? 0) > 0 || telemetry.connectionQuality === "lost") {
    reasons.push("lost_connection");
  }

  if ((telemetry.maxPacketLoss ?? 0) >= 5 || (telemetry.avgPacketLoss ?? 0) >= 2) {
    reasons.push("packet_loss");
  }

  if ((telemetry.maxJitterMs ?? 0) >= 40 || (telemetry.avgJitterMs ?? 0) >= 25) {
    reasons.push("jitter");
  }

  if ((telemetry.maxRttMs ?? 0) >= 300 || (telemetry.avgRttMs ?? 0) >= 180) {
    reasons.push("rtt");
  }

  if (telemetry.minBitrate !== null && telemetry.minBitrate !== undefined && telemetry.minBitrate > 0 && telemetry.minBitrate < 16000) {
    reasons.push("low_bitrate");
  }

  if ((telemetry.poorSamples ?? 0) > 0 || telemetry.connectionQuality === "poor" || telemetry.avgConnectionQuality === "poor") {
    reasons.push("poor_quality");
  }

  return reasons.length > 0 ? reasons : ["stable"];
}
