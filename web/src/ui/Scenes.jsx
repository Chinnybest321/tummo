import { useEffect, useRef, useState } from "react";
import Pet from "./Pet.jsx";

/*
  One drawn scene per intro slide. The pet sits in the middle and the props
  are inked around it in the same hand: offset fills, round caps, boiling line.
  Overlay coords: 420 x 340. The pet's own 320 box sits at x 50..370.
*/

const INK = "#1d1b19";
const SUN = "#ffc928";
const RED = "#e5483b";
const PAPER = "#fffdf7";
// animated wrapper: CSS class + stagger, so a prop's own transform stays intact
const A = ({ c, d = 0, o, children }) => (
  <g className={`a ${c}`} style={{ animationDelay: `${d}s`, ...(o ? { transformOrigin: o } : null) }}>
    {children}
  </g>
);

const line = { fill: "none", stroke: INK, strokeWidth: 4.5, strokeLinecap: "round", strokeLinejoin: "round" };

function useBoil(ref) {
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    let i = 0;
    const id = setInterval(() => {
      i = (i + 1) % 6;
      ref.current?.setAttribute("seed", String(i * 5 + 3));
    }, 110);
    return () => clearInterval(id);
  }, [ref]);
}

function Coin({ x, y, r = 17, tilt = 0 }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${tilt})`}>
      <ellipse cx="3" cy="3" rx={r} ry={r * 0.96} fill={SUN} />
      <ellipse cx="0" cy="0" rx={r} ry={r * 0.96} {...line} />
      <path d={`M${-r * 0.35} ${-r * 0.32} h${r * 0.7} M0 ${-r * 0.32} v${r * 0.72}`} {...line} strokeWidth="3.5" />
    </g>
  );
}

function Spark({ x, y, s = 1 }) {
  return (
    <path
      transform={`translate(${x} ${y}) scale(${s})`}
      d="M0 -13 q2 11 13 13 q-11 2 -13 13 q-2 -11 -13 -13 q11 -2 13 -13 z"
      fill={SUN}
      stroke={INK}
      strokeWidth="3.5"
      strokeLinejoin="round"
    />
  );
}

function Heart({ x, y, s = 1 }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M2 14 C-16 2 -12 -12 -2 -10 C2 -9 3 -6 2 -3 C3 -7 7 -11 12 -9 C20 -5 16 6 2 14 Z" fill={RED} transform="translate(3 2)" />
      <path d="M0 13 C-18 1 -13 -12 -4 -10 C0 -9 1 -6 0 -3 C1 -7 5 -11 10 -9 C18 -5 14 6 0 13 Z" {...line} strokeWidth="3.5" />
    </g>
  );
}

// a tiny feeder: round head, scribble body, arms up
function Friend({ x, y, cheer, hue = PAPER, d = 0 }) {
  return (
    <g transform={`translate(${x} ${y})`}>
     <A c={cheer ? "hop" : "bob"} d={d}>
      <path d="M-16 34 C-15 14 15 14 16 34" fill={hue} stroke={INK} strokeWidth="4" strokeLinecap="round" />
      <circle cx="2" cy="2" r="12" fill={hue} />
      <circle cx="0" cy="0" r="12" {...line} strokeWidth="4" />
      <path d="M-4 -1 v2 M4 -1 v2" {...line} strokeWidth="3.5" />
      {cheer ? (
        <path d="M-14 22 l-10 -16 M14 22 l10 -16" {...line} strokeWidth="4" />
      ) : (
        <path d="M-14 24 l-8 8 M14 24 l8 8" {...line} strokeWidth="4" />
      )}
     </A>
    </g>
  );
}

function SceneHello() {
  return (
    <g>
      <A c="twinkle" d={0}><Spark x={62} y={86} s={1.1} /></A>
      <A c="twinkle" d={0.7}><Spark x={356} y={64} s={0.8} /></A>
      <A c="twinkle" d={1.3}><Spark x={380} y={168} s={0.6} /></A>
      <A c="rise" d={0}><Heart x={98} y={150} s={0.9} /></A>
      <A c="rise" d={1.4}><Heart x={338} y={118} s={1.1} /></A>
      <A c="rise" d={2.2}><Heart x={70} y={200} s={0.6} /></A>
      {/* a crowd of owners along the bottom */}
      <Friend x={40} y={286} cheer hue="#ffe7a8" />
      <Friend x={380} y={286} cheer hue="#ffd1c9" d={0.35} />
      <path d="M8 330 q60 -6 130 -2 t140 0 t134 -2" {...line} strokeWidth="3.5" />
    </g>
  );
}

function SceneFeed() {
  return (
    <g>
      {/* a spoon coming in from the right, carrying a coin */}
      <A c="spoon">
      <path d="M356 214 C372 204 396 196 424 190" stroke={INK} strokeWidth="11" strokeLinecap="round" fill="none" />
      <path d="M356 214 C372 204 396 196 424 190" stroke="#c9c2b6" strokeWidth="4" strokeLinecap="round" fill="none" />
      <ellipse cx="335" cy="221" rx="30" ry="14" fill="#c9c2b6" />
      <ellipse cx="332" cy="218" rx="30" ry="14" {...line} />
      <A c="spooncoin"><Coin x={330} y={202} r={17} tilt={-8} /></A>
      </A>
      {/* motion ticks toward the mouth */}
      <A c="ticks"><path d="M292 192 l-12 -4 M290 210 h-14 M292 226 l-12 5" {...line} strokeWidth="3.5" /></A>
      {/* drool and a hungry growl */}
      <A c="drift"><path d="M58 118 q10 -8 18 0 q8 8 18 0" {...line} strokeWidth="3.5" /></A>
      <A c="drift" d={0.8}><path d="M48 140 q10 -8 18 0 q8 8 18 0" {...line} strokeWidth="3.5" /></A>
      {/* burned: a coin on fire */}
      <g transform="translate(70 270)">
       <A c="flicker" o="50% 100%">
        <path d="M2 18 C-16 6 -10 -14 0 -28 C2 -16 10 -14 12 -24 C22 -10 20 8 2 18 Z" fill={RED} transform="translate(3 3)" />
        <path d="M2 18 C-16 6 -10 -14 0 -28 C2 -16 10 -14 12 -24 C22 -10 20 8 2 18 Z" {...line} strokeWidth="3.5" />
        <path d="M2 10 C-4 4 -2 -4 2 -10 C6 -2 8 4 2 10 Z" fill={SUN} />
       </A>
      </g>
      <Coin x={72} y={304} r={13} />
      <path d="M8 330 q70 -4 140 -1 t150 0 t120 -2" {...line} strokeWidth="3.5" />
    </g>
  );
}

function SceneDrip() {
  // each coin leaves Tummo's side and lands on a feeder
  const fall = [
    { x: 96, y: 150, dx: -52, dy: 96, d: 0 },
    { x: 118, y: 176, dx: 0, dy: 82, d: 0.9 },
    { x: 322, y: 172, dx: -10, dy: 86, d: 0.45 },
    { x: 344, y: 148, dx: 34, dy: 100, d: 1.35 },
  ];
  return (
    <g>
      {fall.map((f, i) => (
        <g key={i} className="a fall" style={{ "--dx": `${f.dx}px`, "--dy": `${f.dy}px`, animationDelay: `${f.d}s` }}>
          <Coin x={f.x} y={f.y} r={13} tilt={i % 2 ? 14 : -14} />
        </g>
      ))}
      <Friend x={44} y={284} cheer hue="#ffe7a8" d={0.6} />
      <Friend x={110} y={292} hue="#d8ecff" d={1.5} />
      <Friend x={312} y={292} cheer hue="#ffd1c9" d={1.05} />
      <Friend x={378} y={284} hue="#dff3d9" d={1.95} />
      <path d="M8 330 q70 -4 140 -1 t150 0 t120 -2" {...line} strokeWidth="3.5" />
    </g>
  );
}

function SceneRescue() {
  return (
    <g>
      {/* a clock running out */}
      <g transform="translate(352 74)">
       <A c="ring">
        <circle cx="3" cy="3" r="26" fill={PAPER} />
        <circle r="26" {...line} />
        <A c="spin">
          <circle r="18" fill="none" />
          <path d="M0 -15 V0 L10 8" {...line} strokeWidth="4" />
        </A>
        <path d="M-12 -34 l6 6 M12 -34 l-6 6" {...line} strokeWidth="3.5" />
       </A>
      </g>
      {/* the graveyard on the left */}
      <g transform="translate(58 250)">
        <path d="M-26 48 V-6 C-26 -40 26 -40 26 -6 V48" fill="#e3e4e7" transform="translate(4 3)" />
        <path d="M-26 48 V-6 C-26 -40 26 -40 26 -6 V48" {...line} />
        <path d="M-10 -8 h20 M0 -18 v26" {...line} strokeWidth="3.5" />
      </g>
      {/* a new egg waiting on the right */}
      <g transform="translate(372 270)">
       <A c="rock" o="50% 100%">
        <path d="M0 -40 C20 -40 30 -10 30 8 C30 28 16 36 0 36 C-16 36 -30 28 -30 8 C-30 -10 -20 -40 0 -40 Z" fill="#ece6fb" transform="translate(3 3)" />
        <path d="M0 -40 C20 -40 30 -10 30 8 C30 28 16 36 0 36 C-16 36 -30 28 -30 8 C-30 -10 -20 -40 0 -40 Z" {...line} />
        <path d="M-28 0 l10 -7 l8 8 l9 -9 l9 8 l8 -6 l10 5" {...line} strokeWidth="3.5" />
       </A>
      </g>
      {/* x2 tag for the rescue window */}
      <g transform="translate(66 92) rotate(-8)">
       <A c="pulse">
        <rect x="-30" y="-20" width="62" height="40" rx="10" fill={SUN} transform="translate(3 3)" />
        <rect x="-30" y="-20" width="62" height="40" rx="10" {...line} />
        <text x="1" y="9" textAnchor="middle" fontSize="25" fontWeight="800" fill={INK} fontFamily="Bricolage Grotesque, sans-serif">2×</text>
       </A>
      </g>
      <path d="M8 330 q70 -4 140 -1 t150 0 t120 -2" {...line} strokeWidth="3.5" />
    </g>
  );
}

const SCENES = { hello: SceneHello, feed: SceneFeed, drip: SceneDrip, rescue: SceneRescue };

// tap any prop and it boings
const BOING = [{ scale: "1" }, { scale: "1.35" }, { scale: "0.85" }, { scale: "1.08" }, { scale: "1" }];

export default function Scene({ name, mood, level }) {
  const seed = useRef(null);
  const box = useRef(null);
  const [jump, setJump] = useState(0);
  useBoil(seed);
  const Props = SCENES[name];

  // feed slide: Tummo jumps each time the spoon lands (spoon loop is 2.6s, lands at ~1.2s)
  useEffect(() => {
    if (name !== "feed") return;
    let t;
    const tick = (wait) => (t = setTimeout(() => { setJump((n) => n + 1); tick(2600); }, wait));
    tick(1250);
    return () => clearTimeout(t);
  }, [name]);

  // depth: props drift against the pointer, the pet with it
  useEffect(() => {
    const move = (e) => {
      const el = box.current;
      if (!el) return;
      el.style.setProperty("--px", ((e.clientX / innerWidth) * 2 - 1).toFixed(3));
      el.style.setProperty("--py", ((e.clientY / innerHeight) * 2 - 1).toFixed(3));
    };
    window.addEventListener("pointermove", move);
    return () => window.removeEventListener("pointermove", move);
  }, []);

  const boing = (e) => {
    const g = e.target.closest?.(".a");
    if (g && !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches)
      g.animate(BOING, { duration: 520, easing: "ease-out" });
  };

  return (
    <div className="scene" ref={box}>
      <div className="scene-pet">
        <Pet mood={mood} level={level} size={320} enter jump={jump} coin={false} />
      </div>
      <svg className="scene-props" viewBox="0 0 420 340" aria-hidden="true" onPointerDown={boing}>
        <defs>
          <filter id="boil-scene" x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence ref={seed} type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="3" />
            <feDisplacementMap in="SourceGraphic" scale="3.2" />
          </filter>
        </defs>
        <g filter="url(#boil-scene)">
          <Props />
        </g>
      </svg>
    </div>
  );
}
