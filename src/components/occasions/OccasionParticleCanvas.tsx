"use client";

import React, { useEffect, useRef } from "react";
import { useOccasion, type OccasionId } from "@/context/OccasionContext";

const OCCASION_EMOJIS: Record<Exclude<OccasionId, "none">, string[]> = {
  national_day: ["💚", "🤍", "🟩", "⬜", "🟢", "⚪", "✨"],
  founding_day: ["🦅", "🐎", "🚩", "📍", "🌴", "⚖️", "🕯️", "✨"],
  flag_day: ["⭐", "📍", "💚", "🤍", "🏳️", "🟩", "⬜", "📜", "✨"],
  ramadan: ["🌙", "⭐", "📻", "🕌", "🤍", "✨"],
  eid_fitr: ["🍬", "⭐", "🎉", "🎊", "💖", "🍭", "🎀", "🎁", "🎈", "✨"],
  eid_adha: ["🕋", "🐑", "🤍", "🐐", "🐪", "⚪", "⬜", "✨"],
  back_to_school: ["🎒", "✏️", "📖", "📝", "🖊️", "💼", "⏰", "🖌️", "🖍️", "✨"],
  white_friday: ["🛒", "🏷️", "💳", "〽️", "❕", "❗", "✨"],
};

interface Flake {
  el: HTMLSpanElement;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  size: number;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export const OccasionParticleCanvas: React.FC = () => {
  const { activeOccasion, isMounted } = useOccasion();
  const layerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isMounted || activeOccasion === "none") return;
    const layer = layerRef.current;
    if (!layer) return;

    const pool = OCCASION_EMOJIS[activeOccasion];
    const width = window.innerWidth;
    const height = window.innerHeight;
    const count = Math.min(44, Math.max(28, Math.floor(width / 38)));
    const flakes: Flake[] = [];

    for (let i = 0; i < count; i++) {
      const el = document.createElement("span");
      const size = 18 + Math.random() * 22;
      el.textContent = pick(pool);
      el.style.cssText = [
        "position:absolute",
        "left:0",
        "top:0",
        `font-size:${size}px`,
        "line-height:1",
        `opacity:${0.45 + Math.random() * 0.5}`,
        "will-change:transform",
        "user-select:none",
      ].join(";");
      layer.appendChild(el);

      const angle = Math.random() * Math.PI * 2;
      const speed = 0.18 + Math.random() * 0.55;
      flakes.push({
        el,
        x: Math.random() * width,
        y: Math.random() * height,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        rot: Math.random() * 360,
        vr: (Math.random() - 0.5) * 0.18,
        size,
      });
    }

    let frame = 0;
    const tick = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      for (const f of flakes) {
        f.x += f.vx;
        f.y += f.vy;
        f.rot += f.vr;
        if (f.x < -40) f.x = w + 40;
        if (f.x > w + 40) f.x = -40;
        if (f.y < -40) f.y = h + 40;
        if (f.y > h + 40) f.y = -40;
        f.el.style.transform = `translate(${f.x}px, ${f.y}px) rotate(${f.rot}deg)`;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      layer.replaceChildren();
    };
  }, [activeOccasion, isMounted]);

  if (!isMounted || activeOccasion === "none") return null;

  return (
    <div
      ref={layerRef}
      className="pointer-events-none fixed inset-0 z-[35] overflow-hidden"
      aria-hidden="true"
    />
  );
};
