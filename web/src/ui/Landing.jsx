import { useRef, useState } from "react";
import Pet from "./Pet.jsx";
import { Wordmark, Bubble } from "./Doodles.jsx";

const COINS = [0, 1, 2];
const FIELD = { hungry: "#f9e3c2", ok: "#dbe7fa", happy: "#d6eedb" };
const SAYS = { hungry: "hungry", ok: "more?", happy: "so full", munch: "nom nom" };

function CoinArt() {
  return (
    <svg viewBox="0 0 48 48" width="48" height="48" aria-hidden="true">
      <ellipse cx="26" cy="26" rx="19" ry="18" fill="#ffc928" />
      <ellipse cx="23" cy="23" rx="19" ry="18" fill="none" stroke="#1d1b19" strokeWidth="3.5" />
      <path d="M16 17 h14 M23 17 v15" fill="none" stroke="#1d1b19" strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  );
}

// drag it onto Tummo, or just tap it and it flies in
function Coin({ hidden, mouth, onEat }) {
  const el = useRef(null);

  const down = (e) => {
    if (hidden) return;
    const c = el.current;
    c.setPointerCapture(e.pointerId);
    const sx = e.clientX;
    const sy = e.clientY;
    let dx = 0;
    let dy = 0;
    let moved = false;
    c.classList.add("held");

    const move = (ev) => {
      dx = ev.clientX - sx;
      dy = ev.clientY - sy;
      if (Math.hypot(dx, dy) > 6) moved = true;
      c.style.transform = `translate(${dx}px, ${dy}px) rotate(${dx / 5}deg) scale(1.15)`;
    };
    const up = (ev) => {
      c.removeEventListener("pointermove", move);
      c.removeEventListener("pointerup", up);
      c.removeEventListener("pointercancel", up);
      c.classList.remove("held");
      const target = mouth();
      const over = target && Math.hypot(ev.clientX - target.x, ev.clientY - target.y) < target.r;
      if (!moved || over) fly(dx, dy);
      else back(dx, dy);
    };
    c.addEventListener("pointermove", move);
    c.addEventListener("pointerup", up);
    c.addEventListener("pointercancel", up);
  };

  const fly = (dx, dy) => {
    const c = el.current;
    const t = mouth();
    const r = c.getBoundingClientRect();
    const tx = dx + t.x - (r.left + r.width / 2);
    const ty = dy + t.y - (r.top + r.height / 2);
    c.style.transform = "";
    const a = c.animate(
      [
        { transform: `translate(${dx}px, ${dy}px) scale(1.15)` },
        { transform: `translate(${(dx + tx) / 2}px, ${Math.min(dy, ty) - 70}px) rotate(200deg) scale(1)`, offset: 0.55 },
        { transform: `translate(${tx}px, ${ty}px) rotate(360deg) scale(0.3)`, opacity: 0.4 },
      ],
      { duration: 420, easing: "cubic-bezier(.4,0,.6,1)", fill: "forwards" },
    );
    a.onfinish = () => {
      onEat();
      a.cancel();
    };
  };

  const back = (dx, dy) => {
    const c = el.current;
    c.style.transform = "";
    c.animate(
      [{ transform: `translate(${dx}px, ${dy}px) scale(1.15)` }, { transform: "translate(0,0) scale(0.92)", offset: 0.7 }, { transform: "translate(0,0) scale(1)" }],
      { duration: 380, easing: "cubic-bezier(.3,1.4,.5,1)" },
    );
  };

  return (
    <button ref={el} className={`coin ${hidden ? "gone" : ""}`} onPointerDown={down} aria-label="Feed Tummo a coin" tabIndex={hidden ? -1 : 0}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), fly(0, 0))}>
      <CoinArt />
    </button>
  );
}

export default function Landing({ onStart }) {
  const wrap = useRef(null);
  const timer = useRef();
  const [fed, setFed] = useState(0);
  const [jump, setJump] = useState(0);
  const [munch, setMunch] = useState(false);
  const [gone, setGone] = useState([]);

  const base = fed >= 3 ? "happy" : fed > 0 ? "ok" : "hungry";
  const mood = munch ? "munch" : base;

  const mouth = () => {
    const svg = wrap.current?.querySelector("svg.pet");
    if (!svg) return null;
    const b = svg.getBoundingClientRect();
    return { x: b.left + b.width * 0.51, y: b.top + b.height * 0.64, r: b.width * 0.45 };
  };

  const eat = (i) => {
    setGone((g) => [...g, i]);
    setFed((n) => n + 1);
    setJump((n) => n + 1);
    setMunch(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMunch(false), 900);
    setTimeout(() => setGone((g) => g.filter((x) => x !== i)), 1500);
  };

  return (
    <div className="landing" style={{ background: FIELD[base] }}>
      <header className="landing-top">
        <Wordmark />
      </header>

      <main className="landing-main">
        <div className="landing-pet" ref={wrap}>
          <Bubble text={SAYS[mood]} />
          <Pet mood={mood} level={3} size={360} jump={jump} coin={false} enter />
        </div>
        <div className="coins">
          {COINS.map((i) => (
            <Coin key={i} hidden={gone.includes(i)} mouth={mouth} onEat={() => eat(i)} />
          ))}
        </div>
        <p className="hint">{fed ? `Fed ${fed}` : "Drag a coin to feed it"}</p>
      </main>

      <footer className="landing-foot">
        <h1>Keep Tummo alive.</h1>
        <p>One pet. Everyone on NEAR feeds it.</p>
        <button className="solid lg wide" onClick={onStart}>Get started</button>
      </footer>
    </div>
  );
}
