import { useEffect, useState } from "react";
import Scene from "./Scenes.jsx";

const SLIDES = [
  { scene: "hello", mood: "happy", level: 3, field: "#d6eedb", title: "This is Tummo.", body: "One pet, shared by everyone on NEAR." },
  { scene: "feed", mood: "hungry", level: 3, field: "#f9e3c2", title: "Feed it or it starves.", body: "Buy $TUMMO and feed it. Every bite is burned and buys it time." },
  { scene: "drip", mood: "munch", level: 3, field: "#dbe7fa", title: "It pays you back.", body: "While it lives, 3% of its treasury a day goes to the people who fed it." },
  { scene: "rescue", mood: "starving", level: 3, field: "#fbd2ca", title: "Save it or lose it.", body: "Last 6 hours count double. 10 feeders in a day throw a feast. If it starves, a new egg hatches." },
];

// remembered per account: a player sees the slides once, the first time they sign in
const key = (account) => `tummo.seen-intro:${account}`;

export function isNewPlayer(account) {
  try {
    return !localStorage.getItem(key(account));
  } catch {
    return true;
  }
}

export default function Onboarding({ account, onDone }) {
  const [i, setI] = useState(0);
  const s = SLIDES[i];
  const last = i === SLIDES.length - 1;

  const done = () => {
    try {
      if (account) localStorage.setItem(key(account), "1");
    } catch {
      /* private mode: show again next time */
    }
    onDone();
  };

  useEffect(() => {
    const k = (e) => {
      if (e.key === "ArrowRight") last ? done() : setI(i + 1);
      if (e.key === "ArrowLeft" && i > 0) setI(i - 1);
      if (e.key === "Escape") done();
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  });

  return (
    <div className="intro" style={{ background: s.field }} role="dialog" aria-modal="true" aria-label="Welcome to Tummo">
      <button className="intro-skip" onClick={done}>Skip</button>
      <div className="intro-body" key={i}>
        <Scene name={s.scene} mood={s.mood} level={s.level} />
        <h1>{s.title}</h1>
        <p>{s.body}</p>
      </div>
      <div className="intro-foot">
        <div className="intro-dots" aria-label={`Slide ${i + 1} of ${SLIDES.length}`}>
          {SLIDES.map((_, j) => (
            <button key={j} className={j === i ? "on" : ""} onClick={() => setI(j)} aria-label={`Go to slide ${j + 1}`} />
          ))}
        </div>
        <div className="intro-btns">
          {i > 0 && <button className="ghost" onClick={() => setI(i - 1)}>Back</button>}
          <button className="solid lg" onClick={() => (last ? done() : setI(i + 1))}>{last ? "Continue" : "Next"}</button>
        </div>
      </div>
    </div>
  );
}
