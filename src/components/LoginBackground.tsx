import { useEffect, useRef } from "react";

/**
 * LoginBackground.tsx — Ambient orchestration-constellation background
 * ===================================================================
 * A self-contained, modern background for the login and MFA screens. Renders an
 * abstract "orchestration constellation" — a central orchestrator node coordinating
 * sub-agent nodes via gently pulsing connections — which is the literal shape of what
 * Sutra is, softened into a calm ambient field. Light theme.
 *
 * Design intent:
 *   - Meaningful: the motif IS multi-agent orchestration (one hub, many agents).
 *   - Calm: slow, low-contrast motion that never competes with the login form.
 *   - Zero assets: pure CSS + inline SVG + one lightweight canvas — no image files.
 *   - Drop-in: renders as a fixed full-screen layer BEHIND your auth UI.
 *
 * USAGE — wrap or precede your login/MFA screen:
 *
 *   <div style={{ position: "relative", minHeight: "100vh" }}>
 *     <LoginBackground />
 *     <YourLoginCard />          // your existing login / MFA form, unchanged
 *   </div>
 *
 * The background sits at z-index 0; put your form at a higher z-index (e.g. wrap it in
 * a div with style={{ position: "relative", zIndex: 1 }}). Your auth logic is untouched.
 */

interface Node {
  x: number;
  y: number;
  r: number;
  hub: boolean;
  phase: number;
  driftX: number;
  driftY: number;
}

export default function LoginBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // brand accent (teal/green) with light-theme-friendly tints
    const ACCENT = "20, 184, 138";       // rgb — matches the app's --accent family
    const INK = "26, 43, 74";            // deep navy for hub, readable on light

    let width = 0, height = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);
    let nodes: Node[] = [];
    let raf = 0;
    let t = 0;

    function build() {
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Build a constellation weighted toward the right/lower area so the left side
      // stays clean for a centered or left-aligned login card.
      nodes = [];
      const hubX = width * 0.72;
      const hubY = height * 0.42;
      nodes.push({ x: hubX, y: hubY, r: 7, hub: true, phase: 0, driftX: 0, driftY: 0 });

      const agentCount = Math.max(7, Math.min(14, Math.round(width / 130)));
      for (let i = 0; i < agentCount; i++) {
        const ang = (Math.PI * 2 * i) / agentCount + Math.random() * 0.4;
        const dist = 120 + Math.random() * Math.min(width, height) * 0.32;
        nodes.push({
          x: hubX + Math.cos(ang) * dist,
          y: hubY + Math.sin(ang) * dist,
          r: 2.5 + Math.random() * 2.5,
          hub: false,
          phase: Math.random() * Math.PI * 2,
          driftX: (Math.random() - 0.5) * 0.15,
          driftY: (Math.random() - 0.5) * 0.15,
        });
      }
    }

    function draw() {
      ctx.clearRect(0, 0, width, height);
      const hub = nodes[0];

      // connections hub → each agent, with a slow travelling pulse
      for (let i = 1; i < nodes.length; i++) {
        const n = nodes[i];
        const dx = n.x - hub.x, dy = n.y - hub.y;

        ctx.beginPath();
        ctx.moveTo(hub.x, hub.y);
        ctx.lineTo(n.x, n.y);
        ctx.strokeStyle = `rgba(${ACCENT}, 0.10)`;
        ctx.lineWidth = 1;
        ctx.stroke();

        // travelling pulse dot along the connection
        if (!prefersReduced) {
          const p = (Math.sin(t * 0.6 + n.phase) + 1) / 2; // 0..1 eased
          const px = hub.x + dx * p;
          const py = hub.y + dy * p;
          ctx.beginPath();
          ctx.arc(px, py, 1.8, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${ACCENT}, ${0.28 * (1 - Math.abs(p - 0.5) * 1.2)})`;
          ctx.fill();
        }
      }

      // agent nodes
      for (let i = 1; i < nodes.length; i++) {
        const n = nodes[i];
        const breathe = prefersReduced ? 0 : Math.sin(t + n.phase) * 0.8;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r + breathe, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${ACCENT}, 0.55)`;
        ctx.fill();
        // soft halo
        ctx.beginPath();
        ctx.arc(n.x, n.y, (n.r + breathe) * 2.6, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${ACCENT}, 0.06)`;
        ctx.fill();
      }

      // hub node (the orchestrator) — deep navy core with an accent ring
      const hubBreathe = prefersReduced ? 0 : Math.sin(t * 0.8) * 1.2;
      ctx.beginPath();
      ctx.arc(hub.x, hub.y, (hub.r + hubBreathe) * 3.2, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${ACCENT}, 0.08)`;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(hub.x, hub.y, hub.r + hubBreathe + 4, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${ACCENT}, 0.45)`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(hub.x, hub.y, hub.r + hubBreathe, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${INK}, 0.85)`;
      ctx.fill();
    }

    function tick() {
      t += 0.012;
      // gentle drift of agent nodes for ambient life
      if (!prefersReduced) {
        for (let i = 1; i < nodes.length; i++) {
          const n = nodes[i];
          n.x += n.driftX;
          n.y += n.driftY;
          // keep them loosely tethered around the hub
          const hub = nodes[0];
          const dx = n.x - hub.x, dy = n.y - hub.y;
          const d = Math.hypot(dx, dy);
          if (d > Math.min(width, height) * 0.5 || d < 90) {
            n.driftX *= -1; n.driftY *= -1;
          }
        }
      }
      draw();
      raf = requestAnimationFrame(tick);
    }

    build();
    if (prefersReduced) {
      draw(); // single static frame
    } else {
      raf = requestAnimationFrame(tick);
    }

    const onResize = () => { build(); draw(); };
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        overflow: "hidden",
        // soft light gradient wash — calm, professional, not flat white
        background:
          "radial-gradient(1200px 800px at 78% 38%, #eef6f3 0%, #f4f7f9 45%, #eef1f5 100%)",
      }}
    >
      {/* faint large soft blobs for depth (CSS, no images) */}
      <div
        style={{
          position: "absolute",
          top: "-10%",
          right: "-8%",
          width: "48vw",
          height: "48vw",
          borderRadius: "50%",
          background:
            "radial-gradient(circle at center, rgba(20,184,138,0.10) 0%, rgba(20,184,138,0) 70%)",
          filter: "blur(8px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "-14%",
          left: "-10%",
          width: "42vw",
          height: "42vw",
          borderRadius: "50%",
          background:
            "radial-gradient(circle at center, rgba(26,43,74,0.06) 0%, rgba(26,43,74,0) 70%)",
          filter: "blur(8px)",
        }}
      />
      {/* the orchestration constellation */}
      <canvas
        ref={canvasRef}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      />
      {/* subtle vignette to keep the form area calm */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(900px 600px at 30% 50%, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0) 60%)",
        }}
      />
    </div>
  );
}
