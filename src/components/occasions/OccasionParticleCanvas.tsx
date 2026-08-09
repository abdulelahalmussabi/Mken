"use client";

import React, { useEffect, useRef } from "react";
import { useOccasion } from "@/context/OccasionContext";

interface Particle {
  x: number;
  y: number;
  size: number;
  speedX: number;
  speedY: number;
  color: string;
  alpha: number;
  rot: number;
  rotSpeed: number;
  shape: "circle" | "star" | "confetti" | "crescent" | "flagRibbon";
}

export const OccasionParticleCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { activeOccasion, isMounted } = useOccasion();

  useEffect(() => {
    if (!isMounted || activeOccasion === "none") return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);

    const particles: Particle[] = [];
    const count = 35;

    const getColors = () => {
      switch (activeOccasion) {
        case "ramadan":
          return ["#fbbf24", "#f59e0b", "#fef08a", "#d97706"];
        case "eid_fitr":
          return ["#f97316", "#e0aaff", "#c77dff", "#f4c430", "#38bdf8"];
        case "eid_adha":
          return ["#eab308", "#10b981", "#047857", "#fef08a"];
        case "national_day":
          return ["#10b981", "#34d399", "#ffffff", "#f59e0b"];
        case "founding_day":
          return ["#d97706", "#b45309", "#f59e0b", "#78350f"];
        case "flag_day":
          return ["#34d399", "#10b981", "#ffffff", "#6ee7b7"];
        default:
          return ["#f97316", "#38bdf8", "#ffffff"];
      }
    };

    const getShape = (): Particle["shape"] => {
      if (activeOccasion === "ramadan") return Math.random() > 0.3 ? "star" : "crescent";
      if (activeOccasion === "eid_fitr") return "confetti";
      if (activeOccasion === "national_day" || activeOccasion === "flag_day") {
        return Math.random() > 0.4 ? "flagRibbon" : "circle";
      }
      return "circle";
    };

    const colors = getColors();

    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: Math.random() * 4 + 2,
        speedX: (Math.random() - 0.5) * 0.8,
        speedY: Math.random() * 0.8 + 0.2,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: Math.random() * 0.6 + 0.2,
        rot: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.05,
        shape: getShape(),
      });
    }

    const drawStar = (x: number, y: number, r: number, alpha: number, color: string) => {
      ctx.save();
      ctx.beginPath();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      ctx.translate(x, y);
      for (let i = 0; i < 5; i++) {
        ctx.lineTo(Math.cos(((18 + i * 72) * Math.PI) / 180) * r, -Math.sin(((18 + i * 72) * Math.PI) / 180) * r);
        ctx.lineTo(
          Math.cos(((54 + i * 72) * Math.PI) / 180) * (r / 2),
          -Math.sin(((54 + i * 72) * Math.PI) / 180) * (r / 2)
        );
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    };

    const drawCrescent = (x: number, y: number, r: number, alpha: number, color: string) => {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, r, 0.5 * Math.PI, 1.5 * Math.PI, true);
      ctx.arc(x + r * 0.4, y, r * 0.8, 1.5 * Math.PI, 0.5 * Math.PI, false);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    };

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      particles.forEach((p) => {
        p.x += p.speedX;
        p.y += p.speedY;
        p.rot += p.rotSpeed;

        if (p.y > height) {
          p.y = -10;
          p.x = Math.random() * width;
        }
        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;

        if (p.shape === "star") {
          drawStar(p.x, p.y, p.size * 1.5, p.alpha, p.color);
        } else if (p.shape === "crescent") {
          drawCrescent(p.x, p.y, p.size * 2, p.alpha, p.color);
        } else if (p.shape === "confetti") {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.globalAlpha = p.alpha;
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size, -p.size / 2, p.size * 2, p.size);
          ctx.restore();
        } else if (p.shape === "flagRibbon") {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.globalAlpha = p.alpha;
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size * 1.5, -1, p.size * 3, 2);
          ctx.restore();
        } else {
          ctx.save();
          ctx.globalAlpha = p.alpha;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [activeOccasion, isMounted]);

  if (!isMounted || activeOccasion === "none") return null;

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-10 opacity-70"
    />
  );
};
