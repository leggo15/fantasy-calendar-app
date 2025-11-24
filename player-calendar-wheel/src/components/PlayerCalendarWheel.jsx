/* PlayerCalendarWheel.jsx – calendar wheel with spinning sun–moon hub, day rollover, time display, and current-value markers */

import { useState, useMemo, useEffect, useRef, useId } from "react";
import { motion } from "framer-motion";

const MONTHS = [
  { name: "Silence", outer: "#323d5a", inner: "#6b717e" },
  { name: "Khord", outer: "#20757a", inner: "#406e95" },
  { name: "Blight", outer: "#47e05a", inner: "#86eec2" },
  { name: "Ortide", outer: "#68d9be", inner: "#649a99" },
  { name: "Verenin", outer: "#23a005", inner: "#65e047" },
  { name: "Song", outer: "#bcff5b", inner: "#679b1c" },
  { name: "Grishleaf", outer: "#f7ff00", inner: "#fffdd0" },
  { name: "Solian", outer: "#f2e02c", inner: "#ddeb00" },
  { name: "Marthos", outer: "#dfa500", inner: "#ffda7d" },
  { name: "Illumi", outer: "#d6c7ae", inner: "#f1cd90" },
  { name: "Restos", outer: "#cdcdcd", inner: "#faf6ee" },
  { name: "Veil", outer: "#cdcdcd", inner: "#faf6ee" },
];

const SEASONS = [
  { name: "Winter", outer: "#b9d2ff", inner: "#dee9ff" },
  { name: "Spring", outer: "#a9e6a0", inner: "#d6f7ce" },
  { name: "Summer", outer: "#ffe998", inner: "#fff5ce" },
  { name: "Fall", outer: "#ffb47a", inner: "#ffd9bf" },
];

const MAGIC_SEASONS = [
  { name: "Low", outer: "#9daca7", inner: "#b9d5cb" },
  { name: "Mid", outer: "#3d87a1", inner: "#7bc7ca" },
  { name: "High", outer: "#ff5335", inner: "#906b61" },
];

const FONT = "'Times New Roman', Serif";
const FONT_COLOUR = "#6d5837";
const GRID_COLOUR = "#a88a5a";
const GRID_BOLDNESS = 0.9;

const RING_GAP = 42;
const THICKNESS = RING_GAP * 0.8;

const DAYS_IN_WEEK = 7;
const DAYS_IN_MAGIC_SEASON = 59;
const STRAND_COUNT = 96;
const STRAND_VISIBLE = 15;
const STRAND_HALF_WINDOW = Math.floor(STRAND_VISIBLE / 2);
const STRAND_WINDOW_SHIFT = 8;
const STRAND_POINTER_SLOT =
  (STRAND_HALF_WINDOW + STRAND_WINDOW_SHIFT) % STRAND_VISIBLE;
const BASE_MONTH_LENGTHS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const POINTER_OFFSETS = {
  day: -34,
  strand: -34,
  month: -34,
  magic: -29,
  season: -29,
  year: -24,
};
const RING_DISTANCE_OFFSETS = {
  day: 10,
  strand: 5,
  month: 0,
  magic: -4,
  season: -3.5,
  year: -3,
};
const HUB_SCALE = 2.0;
const BACKDROP_SRC = "/background.png";
const BACKDROP_SCALE = 2.75; // multiplier relative to SVG width
const BACKDROP_OFFSET_X = -9.0;
const BACKDROP_OFFSET_Y = 37.0;
const WHEEL_LABELS = {
  day: { name: "Day", offsetX: 43, offsetY: 50 },
  strand: { name: "Strand", offsetX: 90.5, offsetY: 50 },
  month: { name: "Month", offsetX: 137.5, offsetY: 50 },
  magic: { name: "Weave", offsetX: 181.5, offsetY: 50 },
  season: { name: "Season", offsetX: 222.5, offsetY: 50 },
  year: { name: "Year", offsetX: 262, offsetY: 50 },
};
const WHEEL_LABEL_ORDER = ["day", "strand", "month", "magic", "season", "year"];
const LABEL_COLUMN_MARGIN = 18;
const LABEL_HORIZONTAL_OFFSET = 0;

const TIME_TEXT_OFFSET_Y = -275;
const DATE_TEXT_OFFSET_Y = 10;
const BUTTON_OFFSET_Y = 10;
const BUTTON_GAP = 8;
const CENTER_LINE_EXTENSION = 20; // extra length added beyond wheel diameter
const METAL_BORDER_COLOR = "#3d4249";
const METAL_BORDER_WIDTH = 3;
const METAL_FRAME_GRADIENT =
  "linear-gradient(180deg, #7a818b 0%, #444950 52%, #2b2e33 100%)";
const METAL_FRAME_BG = "linear-gradient(180deg, #fffef9 0%, #f2ebdb 60%, #ece2c7 100%)";
const METAL_SHADOW =
  "inset 0 0 6px rgba(223, 219, 219, 0.25), inset 0 0 8px rgba(176, 176, 176, 0.45), 0 0px 0px rgba(180, 179, 172, 0.55)";
const BUTTON_FRAME_GRADIENT = METAL_FRAME_GRADIENT;
const BUTTON_TEXT_COLOR = "#f3f5f7";
const BUTTON_MIN_WIDTH = 96;
const LABEL_FRAME_WIDTH = 64;
const LABEL_FRAME_HEIGHT = 18;
const LABEL_TEXT_COLOR = "#333";
const LABEL_FRAME_VERTICAL_PADDING = 2;
const BUTTON_BASE_STYLE = {
  background: BUTTON_FRAME_GRADIENT,
  border: `${METAL_BORDER_WIDTH}px solid ${METAL_BORDER_COLOR}`,
  boxShadow: METAL_SHADOW,
  color: BUTTON_TEXT_COLOR,
  fontFamily: FONT,
  minWidth: BUTTON_MIN_WIDTH,
  borderRadius: 0,
};
const TEXT_FRAME_STYLE = {
  background: METAL_FRAME_BG,
  border: `${METAL_BORDER_WIDTH}px solid ${METAL_BORDER_COLOR}`,
  boxShadow: METAL_SHADOW,
  borderRadius: 0,
  padding: "8px 18px",
  display: "inline-block",
};
const INPUT_STYLE = {
  width: 28,
  padding: "2px 2px",
  border: `${METAL_BORDER_WIDTH}px solid ${METAL_BORDER_COLOR}`,
  borderRadius: 0,
  background: "#fefdf8",
  color: "#2f2a20",
  fontFamily: FONT,
  fontSize: 12,
  textAlign: "center",
};

const isLeap = (y) => y % 4 === 0;
const yearLength = (y) => (isLeap(y) ? 366 : 365);
const monthLens = (y) => {
  const m = [...BASE_MONTH_LENGTHS];
  if (isLeap(y)) m[1] = 29;
  return m;
};

const STORAGE_KEYS = {
  total: "wheelStep",
  hour: "wheelHour",
};

const readFromStorage = (key, fallback = 0) => {
  if (typeof window === "undefined") return fallback;
  const raw = window.localStorage.getItem(key);
  const parsed = raw != null ? parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
};

const writeToStorage = (key, value) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, String(value));
};

const arcXY = (r, deg) => {
  const rad = (deg * Math.PI) / 180;
  return [r * Math.cos(rad), r * Math.sin(rad)];
};

const ringSegmentPath = (outer, inner, startDeg, endDeg) => {
  const [x1, y1] = arcXY(outer, startDeg);
  const [x2, y2] = arcXY(outer, endDeg);
  const [x3, y3] = arcXY(inner, endDeg);
  const [x4, y4] = arcXY(inner, startDeg);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return `
    M ${x1} ${y1}
    A ${outer} ${outer} 0 ${largeArc} 1 ${x2} ${y2}
    L ${x3} ${y3}
    A ${inner} ${inner} 0 ${largeArc} 0 ${x4} ${y4}
    Z
  `;
};

function useStrands() {
  const [map, set] = useState({});
  useEffect(() => {
    fetch("/strands.json").then((r) => r.json()).then(set).catch(() => {});
  }, []);
  return map;
}
const strandName = (id, map) => {
  const o = map[String(id)] || {};
  return !o.Name || o.Hidden?.toLowerCase() === "yes" ? "No Strand" : o.Name;
};

const pointerAngle = -90;
const pointerShape = (radius, thickness, offset = 0) => {
  const anchor = radius + offset;
  const tip = arcXY(anchor + thickness * 0.4, pointerAngle);
  const baseCenter = arcXY(anchor, pointerAngle);
  const perpRad = ((pointerAngle + 90) * Math.PI) / 180;
  const halfWidth = Math.min(16, thickness * 0.7) / 2;
  const offsetX = Math.cos(perpRad) * halfWidth;
  const offsetY = Math.sin(perpRad) * halfWidth;
  const baseLeft = [baseCenter[0] + offsetX, baseCenter[1] + offsetY];
  const baseRight = [baseCenter[0] - offsetX, baseCenter[1] - offsetY];
  return `${tip[0]},${tip[1]} ${baseLeft[0]},${baseLeft[1]} ${baseRight[0]},${baseRight[1]}`;
};

const textOrientationFor = (angle) => {
  let rotation = angle + 90;
  const normalized = ((rotation % 360) + 360) % 360;
  if (normalized > 90 && normalized < 270) {
    rotation += 180;
  }
  return rotation;
};

const shortestDiff = (next, prev, mod) => {
  let diff = next - prev;
  if (diff > mod / 2) diff -= mod;
  if (diff < -mod / 2) diff += mod;
  return diff;
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const dateToAbsolute = (year, month1, day1) => {
  let total = 0;
  for (let y = 0; y < year; y += 1) {
    total += yearLength(y);
  }
  const ml = monthLens(year);
  for (let m = 1; m < month1; m += 1) {
    total += ml[m - 1];
  }
  return total + (day1 - 1);
};

const initialTotalDays = () => {
  if (typeof window === "undefined") return 0;
  const params = new URLSearchParams(window.location.search);
  const y = parseInt(params.get("year") || "", 10);
  const mo = parseInt(params.get("month") || "", 10);
  const d = parseInt(params.get("day") || "", 10);
  if (Number.isFinite(y) && Number.isFinite(mo) && Number.isFinite(d)) {
    return Math.max(0, dateToAbsolute(y, Math.max(1, mo), Math.max(1, d)));
  }
  const totalParam = parseInt(params.get("total") || "", 10);
  if (Number.isFinite(totalParam)) {
    return Math.max(0, totalParam);
  }
  return readFromStorage(STORAGE_KEYS.total, 0);
};

const initialHour = () => {
  if (typeof window === "undefined") return 0;
  const params = new URLSearchParams(window.location.search);
  const hourParam = parseInt(params.get("hour") || "", 10);
  if (Number.isFinite(hourParam)) {
    return ((hourParam % 24) + 24) % 24;
  }
  return readFromStorage(STORAGE_KEYS.hour, 0) % 24;
};

export default function PlayerCalendarWheel({
  size = 720,
  showDesignGrid = false,
}) {
  const [total, setTotal] = useState(initialTotalDays);
  const [hour, setHour] = useState(initialHour);
  const [rotation, setRotation] = useState(0);
  const prevHourRef = useRef(hour);
  const strands = useStrands();
  const prevStrandRef = useRef(null);
  const clipId = useId();
  const clipPathId = `${clipId}-upper-half`;
  const [jumpYear, setJumpYear] = useState("");
  const [jumpMonth, setJumpMonth] = useState("");
  const [jumpDay, setJumpDay] = useState("");
  const applyManualJump = () => {
    const y = parseInt(jumpYear, 10);
    const m = parseInt(jumpMonth, 10);
    const d = parseInt(jumpDay, 10);
    if (![y, m, d].every((v) => Number.isFinite(v))) {
      alert("Please enter numeric Year, Month, and Day.");
      return;
    }
    const safeYear = Math.max(0, y);
    const safeMonth = clamp(m, 1, 12);
    const monthDays = monthLens(safeYear)[safeMonth - 1];
    const safeDay = clamp(d, 1, monthDays);
    const newTotal = dateToAbsolute(safeYear, safeMonth, safeDay);
    setTotal(newTotal);
  };

  useEffect(() => {
    const prev = prevHourRef.current;
    if (prev === 23 && hour === 0) {
      setTotal((t) => t + 1);
    }
    if (prev === 0 && hour === 23) {
      setTotal((t) => t - 1);
    }
    prevHourRef.current = hour;
  }, [hour]);

  const bumpDay = (n) => setTotal((t) => t + n);
  const bumpHour = (n) => {
    setHour((h) => (h + n + 24) % 24);
    setRotation((r) => r + n * 15);
  };

  const decompose = (abs) => {
    let d = abs;
    let y = 0;
    while (d >= yearLength(y)) {
      d -= yearLength(y);
      y++;
    }
    const ml = monthLens(y);
    let m = 0;
    while (d >= ml[m]) {
      d -= ml[m];
      m++;
    }
    return {
      year: y,
      month: m,
      day: d + 1,
      season: Math.floor(m / 3),
      magic: Math.floor(abs / DAYS_IN_MAGIC_SEASON) % 3,
      strand: Math.floor(abs / DAYS_IN_WEEK) % STRAND_COUNT,
    };
  };
  const date = useMemo(() => decompose(total), [total]);

  if (prevStrandRef.current === null) {
    prevStrandRef.current = date.strand;
  }

  useEffect(() => {
    prevStrandRef.current = date.strand;
  }, [date.strand]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    params.set("total", String(total));
    params.set("hour", String(hour));
    params.set("year", String(date.year));
    params.set("month", String(date.month + 1));
    params.set("day", String(date.day));
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState(null, "", newUrl);
  }, [total, hour, date]);


  useEffect(() => {
    writeToStorage(STORAGE_KEYS.total, total);
  }, [total]);

  useEffect(() => {
    writeToStorage(STORAGE_KEYS.hour, hour);
  }, [hour]);

  const centre = size / 2;
  const outer = centre - 55;
  const ringCount = 6;
  const radii = Array.from({ length: ringCount }, (_, i) => outer - i * RING_GAP);
  const strokeW = showDesignGrid ? GRID_BOLDNESS * 1.5 : GRID_BOLDNESS;

  const backdropSize = size * BACKDROP_SCALE;
  const backdropX = centre - backdropSize / 2 + BACKDROP_OFFSET_X;
  const backdropY = centre - backdropSize / 2 + BACKDROP_OFFSET_Y;

  const radiusWithOffset = (key, idx) =>
    radii[idx] + (RING_DISTANCE_OFFSETS[key] ?? 0);

  const rings = useMemo(() => {
    const ml = monthLens(date.year)[date.month];
    const yearRingSlots = 12;
    const yearMid = Math.floor(yearRingSlots / 2);
    return [
      {
        key: "day",
        label: "Day",
        radius: radiusWithOffset("day", 0),
        thickness: THICKNESS,
        currentIndex: date.day - 1,
        segments: Array.from({ length: ml }, (_, i) => ({
          name: `${i + 1}`,
        })),
      },
      {
        key: "strand",
        label: "Strand",
        radius: radiusWithOffset("strand", 1),
        thickness: THICKNESS,
        currentIndex: STRAND_POINTER_SLOT,
        segments: Array.from({ length: STRAND_VISIBLE }, (_, i) => {
          const normalized =
            (i - STRAND_POINTER_SLOT + STRAND_VISIBLE) % STRAND_VISIBLE;
          const offset =
            normalized <= STRAND_HALF_WINDOW
              ? normalized
              : normalized - STRAND_VISIBLE;
          const idx = (date.strand + offset + STRAND_COUNT) % STRAND_COUNT;
          const id = idx + 1;
          const meta = strands[String(id)] || {};
          return {
            name: strandName(id, strands),
            number: id,
            isFocus: normalized === 0,
            outer: meta.outer_color || (idx % 2 ? "#fef4df" : "#ebdbbe"),
            inner: meta.inner_color || (idx % 2 ? "#f5e2bf" : "#dbcaa3"),
          };
        }),
      },
      {
        key: "month",
        label: "Month",
        radius: radiusWithOffset("month", 2),
        thickness: THICKNESS,
        currentIndex: date.month,
        segments: MONTHS,
      },
      {
        key: "magic",
        label: "Magic Season",
        radius: radiusWithOffset("magic", 3),
        thickness: THICKNESS * 0.85,
        currentIndex: date.magic,
        segments: MAGIC_SEASONS,
      },
      {
        key: "season",
        label: "Season",
        radius: radiusWithOffset("season", 4),
        thickness: THICKNESS * 0.85,
        currentIndex: date.season,
        segments: SEASONS,
      },
      {
        key: "year",
        label: "Year",
        radius: radiusWithOffset("year", 5),
        thickness: THICKNESS * 0.7,
        currentIndex: yearMid,
        segments: Array.from({ length: yearRingSlots }, (_, i) => ({
          name: `${date.year + (i - yearMid)}`,
        })),
      },
    ];
  }, [date, radii, strands]);

  const makeRotation = (ring) => {
    const step = 360 / ring.segments.length;
    return -(ring.currentIndex * step);
  };

  const renderRing = (ring) => {
    const step = 360 / ring.segments.length;
    const startAngle = pointerAngle - step / 2;
    const rawRotation = makeRotation(ring);
    const innerRadius = ring.radius - ring.thickness;
    const isStrand = ring.key === "strand";
    const prevStrand = prevStrandRef.current;
    const strandDelta = isStrand
      ? shortestDiff(date.strand, prevStrand, STRAND_COUNT)
      : 0;
    const strandStep = 360 / STRAND_VISIBLE;
    const strandInitial = strandDelta * strandStep;
    const motionKey = isStrand ? `strand-${date.strand}` : ring.key;
    const targetRotation = isStrand ? 0 : rawRotation;
    return (
      <g key={ring.key} transform={`translate(${centre} ${centre})`}>
        <motion.g
          key={motionKey}
          initial={isStrand ? { rotate: strandInitial } : undefined}
          animate={{ rotate: targetRotation }}
          transition={{ type: "spring", stiffness: 120, damping: 15 }}
        >
          {ring.segments.map((seg, idx) => {
            const a0 = startAngle + idx * step;
            const a1 = a0 + step;
            const mid = a0 + step / 2;
            const [tx, ty] = arcXY(innerRadius + ring.thickness / 2, mid);
            const gradId = `grad-${ring.key}-${idx}`;
            const hasGradient = seg.outer && seg.inner;
            const fill = hasGradient
              ? `url(#${gradId})`
              : ring.key === "strand" && seg.isFocus
              ? "rgba(255,255,255,0.6)"
              : "rgba(255,255,255,0.12)";
            const absoluteMid = mid + (isStrand ? 0 : targetRotation);
            const textRot =
              textOrientationFor(absoluteMid) - (isStrand ? 0 : targetRotation);
            return (
              <g key={`${ring.key}-${idx}`}>
                {hasGradient && (
                  <defs>
                    <linearGradient
                      id={gradId}
                      gradientUnits="userSpaceOnUse"
                      x1={arcXY(ring.radius, absoluteMid)[0]}
                      y1={arcXY(ring.radius, absoluteMid)[1]}
                      x2={arcXY(innerRadius, absoluteMid)[0]}
                      y2={arcXY(innerRadius, absoluteMid)[1]}
                    >
                      <stop offset="0%" stopColor={seg.outer} />
                      <stop offset="100%" stopColor={seg.inner} />
                    </linearGradient>
                  </defs>
                )}
                <path
                  d={ringSegmentPath(ring.radius, innerRadius, a0, a1)}
                  fill={fill}
                  stroke={GRID_COLOUR}
                  strokeWidth={strokeW}
                  opacity={ring.key === "day" ? 0.9 : 1}
                />
                <text
                  x={tx}
                  y={ty}
                  transform={`rotate(${textRot} ${tx} ${ty})`}
                  fill={FONT_COLOUR}
                  fontSize={Math.max(10, ring.thickness * 0.45)}
                  textAnchor="middle"
                  alignmentBaseline="middle"
                >
                  {seg.name}
                </text>
              </g>
            );
          })}
        </motion.g>

        <polygon
          points={pointerShape(
            ring.radius,
            ring.thickness,
            POINTER_OFFSETS[ring.key] ?? 0
          )}
          fill={FONT_COLOUR}
          opacity={0.75}
        />
      </g>
    );
  };

  const hubR = THICKNESS * HUB_SCALE;

  const getOrdinal = (n) => {
    if (10 <= n % 100 && n % 100 <= 20) return "th";
    switch (n % 10) {
      case 1:
        return "st";
      case 2:
        return "nd";
      case 3:
        return "rd";
      default:
        return "th";
    }
  };

  return (
    <div
      className="relative w-full flex flex-col items-center gap-6 pb-16"
      style={{ fontFamily: FONT, color: FONT_COLOUR }}
    >
      <svg
        viewBox={`0 0 ${size} ${size}`}
        width={size}
        height={size * 0.85}
        className="mx-auto select-none overflow-visible"
      >
        <image
          href={BACKDROP_SRC}
          x={backdropX}
          y={backdropY}
          width={backdropSize}
          height={backdropSize}
          preserveAspectRatio="xMidYMid meet"
          style={{ pointerEvents: "none" }}
        />
        <defs>
          <clipPath id={clipPathId}>
            <rect x="0" y="0" width={size} height={centre} />
          </clipPath>
          <linearGradient id="labelFrameGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#888f99" />
            <stop offset="45%" stopColor="#5a626b" />
            <stop offset="100%" stopColor="#2d3036" />
          </linearGradient>
          <linearGradient id="labelParchmentGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#fffef9" />
            <stop offset="55%" stopColor="#f3ecd9" />
            <stop offset="100%" stopColor="#e7ddc1" />
          </linearGradient>
        </defs>

        <g clipPath={`url(#${clipPathId})`}>
          <circle
            cx={centre}
            cy={centre}
            r={outer + THICKNESS * 0.6}
            fill="#f9f5ef"
            stroke={GRID_COLOUR}
            strokeWidth={strokeW}
          />

          {rings.map((ring) => renderRing(ring))}

          <g transform={`translate(${centre} ${centre})`}>
            <motion.g
              animate={{ rotate: -rotation }}
              transition={{ type: "spring", stiffness: 120, damping: 12 }}
            >
              <image
                href="/sunmoon.png"
                x={-hubR}
                y={-hubR}
                width={hubR * 2}
                height={hubR * 2}
                preserveAspectRatio="xMidYMid slice"
              />
            </motion.g>
            <text
              y={hubR * 0.75}
              textAnchor="middle"
              fontSize={hubR * 0.35}
              fill={FONT_COLOUR}
              style={{ userSelect: "none" }}
            >
              {hour}
            </text>
          </g>
        </g>
        <line
          x1={centre - outer - CENTER_LINE_EXTENSION}
          y1={centre}
          x2={centre + outer + CENTER_LINE_EXTENSION}
          y2={centre}
          stroke={GRID_COLOUR}
          strokeWidth={strokeW * 1.2}
        />
        {["left", "right"].map((side) => {
          const isLeft = side === "left";
          return (
            <g key={`labels-${side}`}>
              {WHEEL_LABEL_ORDER.map((key) => {
                const cfg = WHEEL_LABELS[key];
                const baseX = isLeft
                  ? LABEL_COLUMN_MARGIN
                  : size - LABEL_COLUMN_MARGIN;
                const x =
                  baseX +
                  (cfg.offsetX ?? 0) * (isLeft ? 1 : -1) +
                  (isLeft ? -LABEL_HORIZONTAL_OFFSET : LABEL_HORIZONTAL_OFFSET);
                const y = centre + (cfg.offsetY ?? 0);
                const rot = isLeft ? -90 : 90;
                const frameHeight =
                  LABEL_FRAME_HEIGHT + LABEL_FRAME_VERTICAL_PADDING * 2;
                return (
                  <g
                    key={`${side}-${key}`}
                    transform={`rotate(${rot} ${x} ${y})`}
                  >
                    <rect
                      x={x - LABEL_FRAME_WIDTH / 2}
                      y={y - frameHeight / 2}
                      width={LABEL_FRAME_WIDTH}
                      height={frameHeight}
                      fill="url(#labelParchmentGradient)"
                      stroke={METAL_BORDER_COLOR}
                      strokeWidth={METAL_BORDER_WIDTH}
                      rx={0}
                      ry={0}
                      opacity={1}
                    />
                    <text
                      x={x}
                      y={y}
                      fill={LABEL_TEXT_COLOR}
                      fontSize={12}
                      opacity={0.9}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      style={{ padding: "4px 4px" }}
                    >
                      {cfg.name}
                    </text>
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>

      <div
        className="text-center text-xl font-semibold"
        style={{ ...TEXT_FRAME_STYLE, marginTop: TIME_TEXT_OFFSET_Y }}
      >
        {`${String(hour).padStart(2, "0")}:00`}
      </div>

      {(() => {
        const strandLabel = strandName(date.strand + 1, strands) || "No Strand";
        const strandLine =
          strandLabel === "No Strand" ? (
            <>No Strand · Year {date.year}</>
          ) : (
            <>
              Strand of <span className="font-semibold">{strandLabel}</span>
              {` · Year ${date.year}`}
            </>
          );
        return (
          <div
            className="text-center text-base"
            style={{
              ...TEXT_FRAME_STYLE,
              color: FONT_COLOUR,
              marginTop: DATE_TEXT_OFFSET_Y,
            }}
          >
            <div>
              {`${MONTHS[date.month].name} ${date.day}${getOrdinal(
                date.day
              )}, ${MAGIC_SEASONS[date.magic].name} ${SEASONS[date.season].name}`}
            </div>
            <div>{strandLine}</div>
          </div>
        );
      })()}

      <div
        className="text-center text-base"
        style={{ marginTop: BUTTON_OFFSET_Y }}
      >
        <div
          className="flex"
          style={{
            gap: BUTTON_GAP,
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          <button
            onClick={() => bumpHour(-1)}
            className="px-4 py-1 rounded"
            style={BUTTON_BASE_STYLE}
          >
            ⏮ Hour
          </button>
          <button
            onClick={() => bumpHour(1)}
            className="px-4 py-1 rounded"
            style={BUTTON_BASE_STYLE}
          >
            Hour ⏭
          </button>
        </div>
        <div
          className="flex"
          style={{
            gap: BUTTON_GAP,
            justifyContent: "center",
            flexWrap: "wrap",
            marginTop: BUTTON_GAP / 2,
          }}
        >
          <button
            onClick={() => bumpDay(-1)}
            className="px-4 py-1 rounded"
            style={BUTTON_BASE_STYLE}
          >
            ◀ Day
          </button>
          <button
            onClick={() => bumpDay(1)}
            className="px-4 py-1 rounded"
            style={BUTTON_BASE_STYLE}
          >
            Day ▶
          </button>
        </div>
      </div>

      <div
        className="flex flex-wrap items-end justify-center"
        style={{ marginTop: BUTTON_GAP, gap: BUTTON_GAP }}
      >
        <input
          type="number"
          placeholder="Year"
          aria-label="Jump year"
          value={jumpYear}
          onChange={(e) => setJumpYear(e.target.value)}
          style={{ ...INPUT_STYLE, width: 45 }}
        />
        <input
          type="number"
          placeholder="Month"
          aria-label="Jump month"
          min={1}
          max={12}
          value={jumpMonth}
          onChange={(e) => setJumpMonth(e.target.value)}
          style={{ ...INPUT_STYLE, width: 45 }}
        />
        <input
          type="number"
          placeholder="Day"
          aria-label="Jump day"
          min={1}
          max={31}
          value={jumpDay}
          onChange={(e) => setJumpDay(e.target.value)}
          style={{ ...INPUT_STYLE, width: 45 }}
        />
        <button
          style={{
            ...BUTTON_BASE_STYLE,
            minWidth: 55,
            height: 24,
            padding: "0 4px",
            fontSize: 12,
          }}
          onClick={applyManualJump}
        >
          Go
        </button>
      </div>
    </div>
  );
}
