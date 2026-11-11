import { useEffect, useRef, useState } from "react";

/*
  tummo, drawn like an ink doodle.
  One uneven outline, a fill printed slightly off the line, hatch strokes for
  shade and blush, and a boiling line (the outline is re-noised ~9 times a
  second) so it feels redrawn by hand frame to frame.
*/

const INK = "#1d1b19";

const BODY =
  "M71 238 C57 190 80 121 149 106 C221 92 267 148 263 213 C260 251 227 268 163 269 C104 270 77 262 71 238 Z";
const BODY_FILL =
  "M78 242 C66 194 88 126 154 112 C224 99 268 154 264 216 C260 252 229 271 166 272 C108 273 82 265 78 242 Z";
const EGG =
  "M160 92 C206 92 238 160 236 210 C234 252 204 270 160 270 C116 270 86 252 84 210 C82 160 114 92 160 92 Z";
const EGG_FILL =
  "M166 98 C211 99 241 165 239 213 C237 254 208 274 165 274 C122 274 93 256 91 214 C89 164 120 98 166 98 Z";

function useBoil(ref, on) {
  useEffect(() => {
    if (!on || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    let i = 0;
    const id = setInterval(() => {
      i = (i + 1) % 6;
      ref.current?.setAttribute("seed", String(i * 7 + 1));
    }, 110);
    return () => clearInterval(id);
  }, [on, ref]);
}

function Eyes({ mood, pupils }) {
  if (mood === "dead")
    return (
      <g stroke={INK} strokeWidth="5" strokeLinecap="round">
        <path d="M124 166 l18 18 M142 166 l-18 18" />
        <path d="M180 163 l18 18 M198 163 l-18 18" />
      </g>
    );
  if (mood === "happy" || mood === "munch")
    return (
      <g fill="none" stroke={INK} strokeWidth="5.5" strokeLinecap="round">
        <path d="M122 178 q11 -14 22 0" />
        <path d="M178 175 q11 -14 22 0" />
      </g>
    );
  if (mood === "starving")
    return (
      <g>
        <g ref={pupils} className="pupils">
          <ellipse cx="134" cy="182" rx="7" ry="6" fill={INK} />
          <ellipse cx="190" cy="179" rx="7" ry="6" fill={INK} />
        </g>
        <g fill="none" stroke={INK} strokeWidth="5" strokeLinecap="round">
          <path d="M121 167 q12 -2 25 -9" />
          <path d="M178 157 q13 7 25 9" />
        </g>
      </g>
    );
  // ok, hungry
  const up = mood === "hungry" ? -4 : 0;
  return (
    <g>
      <g ref={pupils} className="pupils">
        <ellipse cx="134" cy={176 + up} rx="8.5" ry="10" fill={INK} />
        <ellipse cx="190" cy={173 + up} rx="8.5" ry="10" fill={INK} />
        <circle cx="137" cy={172 + up} r="2.6" fill="#fff" />
        <circle cx="193" cy={169 + up} r="2.6" fill="#fff" />
      </g>
      {mood === "hungry" && (
        <g fill="none" stroke={INK} strokeWidth="4.5" strokeLinecap="round">
          <path d="M122 154 q10 -8 22 -2" />
          <path d="M180 150 q12 -5 22 4" />
        </g>
      )}
    </g>
  );
}

function Mouth({ mood }) {
  const s = { fill: "none", stroke: INK, strokeWidth: 5, strokeLinecap: "round", strokeLinejoin: "round" };
  switch (mood) {
    case "munch":
      return (
        <g>
          <path d="M146 196 q16 -4 32 0 q2 26 -16 28 q-18 -2 -16 -28 z" fill="#7a2b22" stroke={INK} strokeWidth="5" strokeLinejoin="round" />
          <path d="M153 214 q9 -7 18 0" fill="#ff8a7a" stroke="none" />
        </g>
      );
    case "happy":
      return (
        <g>
          <path d="M148 196 q14 18 28 -1 q-14 4 -28 1 z" fill="#7a2b22" stroke={INK} strokeWidth="5" strokeLinejoin="round" />
        </g>
      );
    case "hungry":
      return (
        <g>
          <ellipse cx="162" cy="204" rx="9" ry="11" fill="#7a2b22" stroke={INK} strokeWidth="5" />
          <path d="M171 210 q4 10 1 16" {...s} strokeWidth="3.5" stroke="#5aa9e6" />
        </g>
      );
    case "starving":
      return <path d="M146 208 q6 -6 12 0 t12 0 t12 0" {...s} />;
    case "dead":
      return <path d="M150 206 q12 -6 24 0" {...s} />;
    default:
      return <path d="M150 199 q12 10 24 0" {...s} />;
  }
}


const calm = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// squash and stretch: crouch, stretch up, apex, stretch down, squash on impact, settle
const HOP = [
  { transform: "translate(0px,0px) scale(1,1)", easing: "ease-out" },
  { transform: "translate(0px,6px) scale(1.16,0.84)", offset: 0.16, easing: "cubic-bezier(.2,.7,.3,1)" },
  { transform: "translate(0px,-62px) scale(0.88,1.14)", offset: 0.36, easing: "ease-out" },
  { transform: "translate(0px,-82px) scale(1.02,0.98)", offset: 0.5, easing: "ease-in" },
  { transform: "translate(0px,-14px) scale(0.92,1.1)", offset: 0.68, easing: "ease-in" },
  { transform: "translate(0px,5px) scale(1.22,0.8)", offset: 0.76, easing: "ease-out" },
  { transform: "translate(0px,-5px) scale(0.96,1.05)", offset: 0.88, easing: "ease-in-out" },
  { transform: "translate(0px,0px) scale(1,1)" },
];
const SHADOW = [
  { transform: "scale(1,1)", opacity: 1 },
  { transform: "scale(1.1,1)", opacity: 1, offset: 0.16 },
  { transform: "scale(0.55,1)", opacity: 0.5, offset: 0.5 },
  { transform: "scale(1.15,1)", opacity: 1, offset: 0.76 },
  { transform: "scale(1,1)", opacity: 1 },
];
// the sprout lags behind the body, then settles (follow-through)
const LAG = [
  { rotate: "0deg" },
  { rotate: "-10deg", offset: 0.2 },
  { rotate: "16deg", offset: 0.45 },
  { rotate: "-22deg", offset: 0.78 },
  { rotate: "10deg", offset: 0.88 },
  { rotate: "0deg" },
];
const SQUISH = [
  { transform: "translate(0px,0px) scale(1,1)" },
  { transform: "translate(0px,4px) scale(1.14,0.86)", offset: 0.25 },
  { transform: "translate(0px,-3px) scale(0.94,1.07)", offset: 0.6 },
  { transform: "translate(0px,0px) scale(1,1)" },
];
const ROCK = [{ transform: "rotate(0deg)" }, { transform: "rotate(-9deg)" }, { transform: "rotate(7deg)" }, { transform: "rotate(-3deg)" }, { transform: "rotate(0deg)" }];
const DROP_IN = [
  { transform: "translate(0px,-150px) scale(0.86,1.16)", opacity: 0, easing: "ease-in" },
  { transform: "translate(0px,-20px) scale(0.9,1.12)", opacity: 1, offset: 0.55, easing: "ease-in" },
  { transform: "translate(0px,6px) scale(1.24,0.78)", offset: 0.7, easing: "ease-out" },
  { transform: "translate(0px,-10px) scale(0.95,1.06)", offset: 0.85, easing: "ease-in-out" },
  { transform: "translate(0px,0px) scale(1,1)", opacity: 1 },
];

/** mood: egg | happy | ok | hungry | starving | dead | munch. jump: bump to make it hop (fed). */
export default function Pet({ mood: given = "ok", level = 0, size = 320, jump = 0, enter = false, coin = true }) {
  const seed = useRef(null);
  const svg = useRef(null);
  const hop = useRef(null);
  const ground = useRef(null);
  const sprout = useRef(null);
  const pupils = useRef(null);
  const pokes = useRef([]);
  const [flash, setFlash] = useState(false);
  const [hearts, setHearts] = useState([]);
  useBoil(seed, true);

  const fixed = given === "egg" || given === "dead";
  const mood = flash && !fixed && given !== "munch" ? "happy" : given;

  const play = (el, frames, ms, delay = 0) => el?.animate(frames, { duration: ms, delay, easing: "linear" });
  // reactions the player causes always play; only ambient loops respect reduced motion
  const leap = (delay = 0) => {
    play(hop.current, HOP, 820, delay);
    play(ground.current, SHADOW, 820, delay);
    play(sprout.current, LAG, 1000, delay);
  };

  // fed: a coin drops into the mouth, then it jumps for joy
  const [bite, setBite] = useState(0);
  useEffect(() => {
    if (!jump) return;
    if (coin) setBite(jump);
    leap(coin ? 290 : 0);
  }, [jump]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (enter && !calm()) {
      play(hop.current, DROP_IN, 700);
      play(sprout.current, LAG, 900, 300);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // eyes follow the pointer; when nobody moves, it glances around on its own
  useEffect(() => {
    if (calm()) return;
    let idle;
    const look = (x, y) => {
      if (pupils.current) pupils.current.style.transform = `translate(${x}px, ${y}px)`;
    };
    const wander = () => {
      idle = setTimeout(() => {
        const r = Math.random();
        look(r < 0.33 ? -6 : r < 0.66 ? 6 : 0, Math.random() < 0.5 ? -3 : 2);
        wander();
      }, 1800 + Math.random() * 2600);
    };
    const move = (e) => {
      const box = svg.current?.getBoundingClientRect();
      if (!box) return;
      const cx = box.left + box.width * 0.5;
      const cy = box.top + box.height * 0.55;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const len = Math.hypot(dx, dy) || 1;
      const k = Math.min(1, len / 260);
      look((dx / len) * 7 * k, (dy / len) * 5 * k);
      clearTimeout(idle);
      idle = setTimeout(() => {
        look(0, 0);
        wander();
      }, 2500);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerdown", move);
    wander();
    return () => {
      clearTimeout(idle);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerdown", move);
    };
  }, []);

  // poke it: it squishes and giggles. Poke it fast enough and it jumps.
  const poke = (e) => {
    e.stopPropagation();
    if (fixed) return play(hop.current, ROCK, 600);
    const now = Date.now();
    pokes.current = [...pokes.current.filter((t) => now - t < 1600), now];
    if (pokes.current.length >= 4) {
      pokes.current = [];
      leap();
    } else play(hop.current, SQUISH, 420);
    setFlash(true);
    clearTimeout(poke.t);
    poke.t = setTimeout(() => setFlash(false), 900);
    const id = now + Math.random();
    setHearts((h) => [...h.slice(-4), { id, x: 120 + Math.random() * 90 }]);
    setTimeout(() => setHearts((h) => h.filter((x) => x.id !== id)), 1100);
  };
  const egg = mood === "egg";
  const dead = mood === "dead";
  const grow = egg ? 0.8 : 0.74 + Math.min(level, 10) * 0.028;
  const fill = dead ? "#dfe5ec" : egg ? "#fff4d6" : "#ffd84d";
  const anim = egg ? "pet-wobble" : dead ? "pet-float" : mood === "starving" ? "pet-shiver" : mood === "munch" ? "pet-munch" : "pet-breathe";

  return (
    <svg ref={svg} viewBox="0 0 320 320" width={size} height={size} className="pet" role="img" aria-label={`Tummo is ${given}`} style={{ overflow: "visible" }}>
      <defs>
        <filter id="boil" x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence ref={seed} type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="1" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="3.2" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>

      {/* ground scribble */}
      {!dead && (
        <path
          ref={ground}
          style={{ transformOrigin: "160px 285px" }}
          d="M92 281 q70 -12 140 -2 M104 289 q60 -7 118 0"
          fill="none"
          stroke={INK}
          strokeOpacity=".22"
          strokeWidth="4"
          strokeLinecap="round"
          filter="url(#boil)"
        />
      )}

      <g ref={hop} className="body" style={{ transformOrigin: "160px 278px" }} onPointerDown={poke}>
      <g className={anim} style={{ transformOrigin: "160px 270px", transform: `scale(${grow})` }}>
        <g filter="url(#boil)" opacity={dead ? 0.82 : 1}>
          {egg ? (
            <>
              <path d={EGG_FILL} fill={fill} />
              <g fill="#f2c94c" opacity=".7">
                <ellipse cx="130" cy="160" rx="10" ry="7" />
                <ellipse cx="190" cy="210" rx="13" ry="9" />
                <ellipse cx="140" cy="236" rx="7" ry="5" />
              </g>
              <path d={EGG} fill="none" stroke={INK} strokeWidth="5.5" strokeLinejoin="round" />
              <path d="M112 150 l18 12 l12 -14 l16 14 l14 -12 l18 14" fill="none" stroke={INK} strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
              <g stroke={INK} strokeWidth="3" strokeLinecap="round" opacity=".45">
                <path d="M200 246 l-8 10 M212 238 l-10 14 M222 226 l-8 12" />
              </g>
            </>
          ) : (
            <>
              {dead && <ellipse cx="166" cy="78" rx="38" ry="9" fill="none" stroke="#e8b923" strokeWidth="5" />}
              <path d={BODY_FILL} fill={fill} />
              {/* belly highlight */}
              {!dead && <path d="M100 196 q-2 -40 34 -66" fill="none" stroke="#fff6c9" strokeWidth="9" strokeLinecap="round" opacity=".9" />}
              <path d={BODY} fill="none" stroke={INK} strokeWidth="6" strokeLinejoin="round" />
              {/* tuft: grows into a sprout */}
              <path d="M150 106 q-8 -20 6 -30" fill="none" stroke={INK} strokeWidth="5" strokeLinecap="round" />
              {level >= 3 && !dead && <path ref={sprout} className="sway" d="M156 76 q16 -12 30 -2 q-14 12 -30 2 z" fill="#7cc576" stroke={INK} strokeWidth="4.5" strokeLinejoin="round" />}
              {/* arms */}
              {mood === "happy" || mood === "munch" ? (
                <g fill="none" stroke={INK} strokeWidth="5.5" strokeLinecap="round">
                  <path className="wave-l" d="M76 196 q-22 -10 -24 -32" />
                  <path className="wave-r" d="M258 192 q22 -10 24 -32" />
                </g>
              ) : (
                <g fill="none" stroke={INK} strokeWidth="5.5" strokeLinecap="round">
                  <path d="M70 204 q-16 8 -12 26" />
                  <path d="M262 200 q16 8 12 26" />
                </g>
              )}
              {/* feet */}
              {!dead && (
                <g fill={fill} stroke={INK} strokeWidth="5">
                  <path d="M104 268 q12 14 34 6" />
                  <path d="M188 272 q20 8 32 -6" />
                </g>
              )}
              {/* shade hatching */}
              <g stroke={INK} strokeWidth="3" strokeLinecap="round" opacity=".38">
                <path d="M226 242 l-12 14 M238 232 l-14 18 M248 220 l-12 16" />
              </g>
              {/* blush, drawn as strokes */}
              {!dead && (
                <g stroke="#ff7a6b" strokeWidth="4" strokeLinecap="round" opacity=".85">
                  <path d="M104 196 l7 -9 M113 199 l7 -9 M122 201 l6 -8" />
                  <path d="M206 194 l7 -9 M215 197 l7 -9 M224 199 l6 -8" />
                </g>
              )}
              <g className={["ok","hungry","starving"].includes(mood) ? "blink" : undefined}>
                <Eyes mood={mood} pupils={pupils} />
              </g>
              <Mouth mood={mood} />
              {mood === "starving" && (
                <g fill="#9fd3ff" stroke={INK} strokeWidth="3.5" strokeLinejoin="round">
                  <path className="drop" d="M244 130 q8 12 0 18 q-8 -6 0 -18 z" />
                  <path className="drop" style={{ animationDelay: "0.9s" }} d="M82 140 q6 9 0 14 q-6 -5 0 -14 z" />
                </g>
              )}
              {mood === "hungry" && (
                <g className="rumble" fill="none" stroke={INK} strokeWidth="4" strokeLinecap="round" opacity=".6">
                  <path d="M272 222 q8 4 8 12 M280 208 q10 4 12 14 M266 238 q6 4 6 10" />
                </g>
              )}
            </>
          )}
        </g>
      </g>
      </g>

      {/* fed: the coin drops in */}
      {bite > 0 && (
        <g key={bite} className="bite" aria-hidden="true">
          <ellipse cx="165" cy="43" rx="17" ry="16" fill="#ffc928" />
          <ellipse cx="162" cy="40" rx="17" ry="16" fill="none" stroke={INK} strokeWidth="4.5" />
          <path d="M156 35 h12 M162 35 v12" fill="none" stroke={INK} strokeWidth="3.5" strokeLinecap="round" />
        </g>
      )}

      {/* poke hearts */}
      {hearts.map((h) => (
        <g key={h.id} className="poke-heart" style={{ transformOrigin: `${h.x}px 100px` }} aria-hidden="true">
          <path transform={`translate(${h.x + 3} 102)`} d="M0 13 C-18 1 -13 -12 -4 -10 C0 -9 1 -6 0 -3 C1 -7 5 -11 10 -9 C18 -5 14 6 0 13 Z" fill="#e5483b" />
          <path transform={`translate(${h.x} 100)`} d="M0 13 C-18 1 -13 -12 -4 -10 C0 -9 1 -6 0 -3 C1 -7 5 -11 10 -9 C18 -5 14 6 0 13 Z" fill="none" stroke={INK} strokeWidth="3.5" strokeLinejoin="round" />
        </g>
      ))}
    </svg>
  );
}
