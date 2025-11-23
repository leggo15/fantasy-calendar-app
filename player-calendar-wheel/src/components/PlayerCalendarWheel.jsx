/* PlayerCalendarWheel.jsx – calendar wheel with spinning sun–moon hub, day rollover, time display, and current-value markers */

import { useState, useMemo, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

const MONTHS = [
  { name: "Silence",      outer: "#323d5a", inner: "#6b717e" },
  { name: "Khord",     outer: "#20757a", inner: "#406e95" },
  { name: "Maiden's Blight",   outer: "#47e05a", inner: "#86eec2" },
  { name: "Ortide",  outer: "#68d9be", inner: "#649a99" },
  { name: "Verenin",    outer: "#23a005", inner: "#65e047" },
  { name: "Song",     outer: "#bcff5b", inner: "#679b1c" },
  { name: "Grishleaf",     outer: "#f7ff00", inner: "#fffdd0" },
  { name: "Solian",     outer: "#f2e02c", inner: "#ddeb00" },
  { name: "Marthos", outer: "#dfa500", inner: "#ffda7d" },
  { name: "Illumi",     outer: "#d6c7ae", inner: "#f1cd90" },
  { name: "Restos",    outer: "#cdcdcd", inner: "#faf6ee" },
  { name: "Veil",    outer: "#cdcdcd", inner: "#faf6ee" },
];

const SEASONS = [
  { name: "Winter", outer: "#b9d2ff", inner: "#dee9ff" },
  { name: "Spring", outer: "#a9e6a0", inner: "#d6f7ce" },
  { name: "Summer", outer: "#ffe998", inner: "#fff5ce" },
  { name: "Fall",   outer: "#ffb47a", inner: "#ffd9bf" },
];

const MAGIC_SEASONS = [
  { name: "Low",  outer: "#9daca7", inner: "#b9d5cb" },
  { name: "Mid",  outer: "#3d87a1", inner: "#7bc7ca" },
  { name: "High", outer: "#ff5335", inner: "#906b61" },
];

const WEAVE_LENGTH = MAGIC_SEASONS.length;

const FONT          = "'Times New Roman', Serif";
const FONT_COLOUR   = "#6d5837";
const GRID_COLOUR   = "#a88a5a";
const GRID_BOLDNESS = 1;
const BLURINESS     = 0;

const RING_GAP  = 34;
const THICKNESS = RING_GAP * 0.75;

const DAYS_IN_WEEK         = 7;
const DAYS_IN_MAGIC_SEASON = 59;
const STRAND_COUNT         = 96;
const BASE_MONTH_LENGTHS   = [31,28,31,30,31,30,31,31,30,31,30,31];

const isLeap     = (y) => y % 4 === 0;
const yearLength = (y) => (isLeap(y) ? 366 : 365);
const monthLens  = (y) => {
  const m = [...BASE_MONTH_LENGTHS];
  if (isLeap(y)) m[1] = 29;
  return m;
};

const loadStep = async () => {
  try {
    const txt = await fetch("/current_date.txt").then((r) => r.text());
    return parseInt(txt, 10) || 0;
  } catch {
    return parseInt(localStorage.getItem("wheelStep") || "0", 10);
  }
};
const saveStep = (n) =>
  fetch("/current_date.txt", { method: "POST", body: String(n) }).catch(() =>
    localStorage.setItem("wheelStep", String(n))
  );

const loadHour = async () => {
  try {
    const txt = await fetch("/current_hour.txt").then((r) => r.text());
    return parseInt(txt, 10) || 0;
  } catch {
    return parseInt(localStorage.getItem("wheelHour") || "0", 10);
  }
};
const saveHour = (n) =>
  fetch("/current_hour.txt", { method: "POST", body: String(n) }).catch(() =>
    localStorage.setItem("wheelHour", String(n))
  );

const arcXY = (r, deg) => {
  const rad = (deg * Math.PI) / 180;
  return [r * Math.cos(rad), -r * Math.sin(rad)];
};
const ringPath = (r) => `M${-r} 0 A${r} ${r} 0 0 1 ${r} 0`;
const cellPath = (rOut, rIn, a0, a1) => {
  const [x1, y1] = arcXY(rOut, a0);
  const [x2, y2] = arcXY(rOut, a1);
  const [x3, y3] = arcXY(rIn,  a1);
  const [x4, y4] = arcXY(rIn,  a0);
  return `M${x1} ${y1} A${rOut} ${rOut} 0 0 0 ${x2} ${y2}
          L${x3} ${y3} A${rIn} ${rIn} 0 0 1 ${x4} ${y4}Z`;
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

export default function PlayerCalendarWheel({
  size = 720,
  showDesignGrid = false,
  showCellMidLines = false,
}) {
  const [total, setTotal]       = useState(0);
  const [hour, setHour]         = useState(0);
  const [rotation, setRotation] = useState(0);
  const prevHourRef             = useRef(hour);
  const strands                 = useStrands();

  useEffect(() => { loadStep().then(setTotal); }, []);
  useEffect(() => {
    loadHour().then((h) => {
      setHour(h);
      setRotation(h * 15);
      prevHourRef.current = h;
    });
  }, []);
  useEffect(() => { saveStep(total); }, [total]);
  useEffect(() => { saveHour(hour);  }, [hour]);

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
    let d = abs, y = 0;
    while (d >= yearLength(y)) { d -= yearLength(y); y++; }
    const ml = monthLens(y);
    let m = 0;
    while (d >= ml[m]) { d -= ml[m]; m++; }
    return {
      year:   y,
      month:  m,
      day:    d + 1,
      season: Math.floor(m / 3),
      magic:  Math.floor(abs / DAYS_IN_MAGIC_SEASON) % 3,
      strand: Math.floor(abs / DAYS_IN_WEEK) % STRAND_COUNT,
    };
  };
  const date = useMemo(() => decompose(total), [total]);

  const getOrdinal = (n) => {
    if (10 <= n % 100 && n % 100 <= 20) return "th";
    switch (n % 10) {
      case 1:  return "st";
      case 2:  return "nd";
      case 3:  return "rd";
      default: return "th";
    }
  };
  const displayDay = `${date.day}${getOrdinal(date.day)}`;

  const halfH  = size / 2;
  const centre = size / 2;
  const outer  = centre - 50;
  const radii  = Array.from({ length: 6 }, (_, i) => outer - i * RING_GAP);
  const strokeW = showDesignGrid ? GRID_BOLDNESS * 1.5 : GRID_BOLDNESS;

  const hubR  = THICKNESS * 4;
  const HUB_Y = halfH - hubR + 103;

  const rings = [
    {
      key: "day",
      radius: radii[0],
      cls: "text-xs",
      values: Array.from({ length: 19 }, (_, i) => {
        const off = i - 9;
        const ml  = monthLens(date.year)[date.month];
        let v = date.day + off;
        while (v < 1) v += ml;
        while (v > ml) v -= ml;
        return { name: v };
      }),
      current: 14,
    },
    {
      key: "strand",
      radius: radii[1],
      cls: "text-xs",
      values: Array.from({ length: 11 }, (_, i) => {
        const id = ((date.strand - 5 + i + STRAND_COUNT) % STRAND_COUNT) + 1;
        const s  = strands[String(id)] || {};
        return {
          name: strandName(id, strands),
          outer: s.outer_color,
          inner: s.inner_color,
        };
      }),
      current: 4,
    },
    {
      key: "month",
      radius: radii[2],
      cls: "text-sm font-semibold",
      values: Array.from({ length: 7 }, (_, i) =>
        MONTHS[(date.month - 3 + i + 12) % 12]
      ),
      current: 5,
    },
    {
      key: "weave",
      radius: radii[3],
      cls: "text-xs uppercase tracking-wider",
      values: Array.from({ length: 5 }, (_, i) => {
        const centerOffset = Math.floor(WEAVE_LENGTH / 2);
        return MAGIC_SEASONS[
          (date.magic - centerOffset + i + WEAVE_LENGTH) % WEAVE_LENGTH
        ];
      }),
      current: Math.floor(WEAVE_LENGTH / 2),
    },
    {
      key: "season",
      radius: radii[4],
      cls: "text-sm font-semibold uppercase tracking-wider",
      values: Array.from({ length: 3 }, (_, i) => {
        const centerOffset = 1;
        return SEASONS[
          (date.season - centerOffset + i + SEASONS.length) % SEASONS.length
        ];
      }),
      current: 1,
    },
    {
      key: "year",
      radius: radii[5],
      cls: "text-sm",
      values: Array.from({ length: 3 }, (_, i) => ({
        name: date.year - 1 + i,
      })),
      current: 4,
    },
  ];

  return (
    <div
      className="relative w-full flex flex-col items-center gap-4 pb-24"
      style={{ fontFamily: FONT, color: FONT_COLOUR, filter: `blur(${BLURINESS}px)` }}
    >
      <svg
        viewBox={`0 0 ${size} ${halfH}`}
        width={size}
        height={halfH}
        className="mx-auto select-none relative z-10"
      >
        <path
          d={`M0 ${halfH} H${size}`}
          style={{ stroke: GRID_COLOUR, strokeWidth: strokeW }}
        />

        {rings.map((ring, ri) => {
          const seg = 180 / (ring.values.length - 1);
          const midR = ring.radius - THICKNESS / 1.5;
          const pathId = `curve-${ri}`;

          // Angle for current-value marker
          const [mx, my] = arcXY(midR-4.5, 90);
          const markerSize = 4; // radius of marker circle

          return (
            <g key={ring.key} transform={`translate(${centre} ${halfH})`}>
              <defs>
                <path id={pathId} d={ringPath(midR)} fill="none" />
              </defs>

              {/* cells */}
              {ring.values.map((v, i) => {
                const a0 = Math.max(0, 180 - (i + 0.5) * seg);
                const a1 = Math.min(180, 180 - (i - 0.5) * seg);
                const id = `${ri}-${i}`;
                const gradId = `grad-${id}`;

                const leap =
                  ring.key === "day" &&
                  date.month === 2 &&
                  v.name === 29 &&
                  isLeap(date.year);

                let gradDef = null;
                if (v.outer && v.inner) {
                  const [gx1, gy1] = arcXY(ring.radius, a0);
                  const [gx2, gy2] = arcXY(ring.radius, a1);
                  gradDef = (
                    <linearGradient
                      id={gradId}
                      key={gradId}
                      gradientUnits="userSpaceOnUse"
                      x1={gx1}
                      y1={gy1}
                      x2={gx2}
                      y2={gy2}
                    >
                      <stop offset="0%" stopColor={v.outer} />
                      <stop offset="100%" stopColor={v.inner} />
                    </linearGradient>
                  );
                }

                return (
                  <g key={`g-${id}`}>
                    {gradDef && <defs>{gradDef}</defs>}
                    <path
                      d={cellPath(
                        ring.radius,
                        ring.radius - THICKNESS,
                        a0,
                        a1
                      )}
                      stroke={GRID_COLOUR}
                      strokeWidth={strokeW}
                      fill={
                        leap
                          ? "#ff0000"
                          : v.outer && v.inner
                          ? `url(#${gradId})`
                          : "none"
                      }
                    />
                  </g>
                );
              })}

              {/* optional mid-lines */}
              {showDesignGrid &&
                showCellMidLines &&
                ring.values.length > 1 &&
                ring.values.slice(0, -1).map((_, i) => {
                  const angle = i * seg;
                  const [x1, y1] = arcXY(ring.radius - THICKNESS, angle);
                  const [x2, y2] = arcXY(ring.radius, angle);
                  return (
                    <path
                      key={`line-${ri}-${i}`}
                      d={`M${x1} ${y1} L${x2} ${y2}`}
                      stroke={GRID_COLOUR}
                      strokeWidth={strokeW * 0.7}
                      opacity={0.7}
                    />
                  );
                })}

              {/* labels */}
              {ring.values.map((v, i) => (
                <AnimatePresence key={i}>
                  <motion.text
                    initial={{ opacity: 0, scale: 0.6 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.6 }}
                    transition={{ duration: 0.2 }}
                    className={`${ring.cls} ${
                      i === ring.current ? "font-bold" : ""
                    }`}
                    style={{ fill: FONT_COLOUR }}
                  >
                    <textPath
                      href={`#${pathId}`}
                      startOffset={`${(i / (ring.values.length - 1)) * 100}%`}
                      textAnchor="middle"
                    >
                      {v.name ?? v}
                    </textPath>
                  </motion.text>
                </AnimatePresence>
              ))}

              {/* current-value marker */}
              <polygon
                points={`
                  ${mx},${my - markerSize}
                  ${mx - markerSize},${my + markerSize}
                  ${mx + markerSize},${my + markerSize}
                `}
                fill={FONT_COLOUR}
                stroke={GRID_COLOUR}
              />
            </g>
          );
        })}

        {/* HUB (spinning PNG) */}
        <g transform={`translate(${centre} ${HUB_Y})`}>
          <motion.g
            animate={{ rotate: rotation }}
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
            y={hubR * 0.7}
            textAnchor="middle"
            fontSize={hubR * 0.35}
            fill={FONT_COLOUR}
            style={{ userSelect: "none" }}
          >
            {hour}
          </text>
        </g>
      </svg>
‎ {/* Do not remove, its a spacer */ }
      {/* TIME DISPLAY */}
      <div className="mt-2 mb-2 text-center text-lg font-semibold">
        {`${String(hour).padStart(2, "0")}:00`}
      </div>
‎ {/* Do not remove, its a spacer */ }
      {/* human-readable date */}
      <div className="text-center text-sm" style={{ color: FONT_COLOUR }}>
        {`${MONTHS[date.month].name} ${displayDay}, ${MAGIC_SEASONS[date.magic].name} ${SEASONS[date.season].name}, `}
        <span className="font-semibold">{strandName(date.strand + 1, strands)}</span>
        {`, Year ${date.year}`}
      </div>
‎ {/* Do not remove, its a spacer */ }
      {/* controls */}
      <div className="flex flex-col items-center gap-4 mt-6">
        <div className="flex gap-4">
          <button
            onClick={() => bumpDay(-1)}
            className="px-3 py-1 rounded"
            style={{ background: GRID_COLOUR, color: FONT_COLOUR, fontFamily: FONT }}
          >
            ◀◀◀
          </button>
          <button
            onClick={() => bumpDay(1)}
            className="px-3 py-1 rounded"
            style={{ background: GRID_COLOUR, color: FONT_COLOUR, fontFamily: FONT }}
          >
            ▶▶▶
          </button>
        </div>
        ‎ {/* Do not remove, its a spacer */ }
        <div className="flex gap-4">
          <button
            onClick={() => bumpHour(-1)}
            className="px-3 py-1 rounded"
            style={{ background: GRID_COLOUR, color: FONT_COLOUR, fontFamily: FONT }}
          >
            ⏾
          </button>
          <button
            onClick={() => bumpHour(1)}
            className="px-3 py-1 rounded"
            style={{ background: GRID_COLOUR, color: FONT_COLOUR, fontFamily: FONT }}
          >
            ✴
          </button>
        </div>
      </div>
    </div>
  );
}
