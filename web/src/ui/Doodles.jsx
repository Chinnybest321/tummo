// Small hand-drawn accents. Same ink, same boil, used sparingly.
const INK = "#1d1b19";

export function Wordmark() {
  return (
    <span className="wordmark">
      tummo
      <svg viewBox="0 0 80 12" preserveAspectRatio="none" aria-hidden>
        <path d="M2 8 q20 -6 38 -2 t38 -3" fill="none" stroke="#ffc928" strokeWidth="5" strokeLinecap="round" />
      </svg>
    </span>
  );
}

export function FeastDots({ count, total = 10, done }) {
  return (
    <span className="feast-dots" aria-label={`${count} of ${total} feeders today`}>
      {Array.from({ length: total }, (_, i) => (
        <svg key={i} viewBox="0 0 20 20" width="15" height="15" aria-hidden>
          <path
            d={["M10 2.5 C15 2 18 6 17.5 10.5 C17 15 13 18 9 17.5 C4.5 17 2 13 2.5 9 C3 5 6 2.8 10 2.5 Z", "M9.5 2.4 C14.6 2.6 17.8 6.4 17.4 10.8 C17 15.2 12.8 17.8 8.8 17.4 C4.6 16.8 2.2 12.6 2.8 8.6 C3.4 4.8 5.8 2.2 9.5 2.4 Z"][i % 2]}
            fill={i < count || done ? "#ffc928" : "none"}
            stroke={INK}
            strokeWidth="2"
          />
        </svg>
      ))}
    </span>
  );
}

export function Bubble({ text }) {
  if (!text) return null;
  return (
    <div className="bubble" aria-hidden>
      <svg viewBox="0 0 120 64" preserveAspectRatio="none">
        <path d="M10 6 C40 2 84 3 110 7 C116 8 117 14 116 30 C115 42 112 46 100 46 L44 47 L28 60 L30 47 L12 46 C5 45 4 40 4 26 C4 12 4 7 10 6 Z" fill="#fff" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
      </svg>
      <span>{text}</span>
    </div>
  );
}

export function Tomb({ id }) {
  return (
    <svg viewBox="0 0 60 64" width="44" height="47" aria-hidden className="tomb">
      <path d="M12 60 L11 26 C11 12 20 5 30 5 C41 5 49 12 49 26 L48 60 Z" fill="#eef0f3" stroke={INK} strokeWidth="2.6" strokeLinejoin="round" />
      <path d="M4 61 q26 -4 52 0" fill="none" stroke={INK} strokeWidth="2.6" strokeLinecap="round" />
      <text x="30" y="40" textAnchor="middle" fontSize="15" fontWeight="700" fill={INK} fontFamily="inherit">{id}</text>
      <path d="M22 22 h16 M30 15 v14" stroke={INK} strokeWidth="2.2" strokeLinecap="round" opacity=".5" />
    </svg>
  );
}

export function Crumbs({ show }) {
  if (!show) return null;
  return (
    <svg className="crumbs" viewBox="0 0 200 120" aria-hidden>
      {[[40, 70], [70, 40], [130, 36], [160, 66], [100, 22], [58, 96], [146, 98]].map(([x, y], i) => (
        <path key={i} d={`M${x} ${y} l6 -3 l3 6 l-6 3 z`} fill="#ffc928" stroke={INK} strokeWidth="1.6" style={{ animationDelay: `${i * 40}ms` }} />
      ))}
    </svg>
  );
}
