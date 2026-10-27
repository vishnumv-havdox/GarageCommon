import React, { useEffect, useRef } from 'react';
import './HavDoxIntro.css';

// Exact vector geometry data for HavDox logo glyphs & breakthrough morph
const V = {
  gl: [
    "M0.0 0.5L0.0 186.5L30.8 186.5L31.2 186.0L31.2 106.0L32.2 105.2L115.5 105.2L116.2 106.2L116.2 186.0L116.8 186.5L147.0 186.5L147.5 185.8L147.5 1.2L146.5 0.5L117.0 0.5L116.2 1.2L116.2 75.5L115.8 76.0L31.8 76.0L31.2 75.5L31.2 1.2L30.5 0.0L1.5 0.0Z",
    "M187.2 69.5L180.0 79.0L176.2 85.5L173.0 93.0L170.2 102.5L169.2 108.2L168.8 122.8L169.2 129.0L171.0 138.2L175.0 149.5L179.2 157.5L183.2 163.2L186.8 167.5L192.8 173.5L202.2 180.5L208.5 183.8L213.8 185.8L221.0 187.8L226.2 188.8L231.0 189.0L232.5 189.8L242.5 189.8L244.2 189.0L248.2 188.8L256.5 186.8L266.2 182.5L274.8 176.8L280.5 171.2L282.2 168.8L283.0 168.8L283.5 169.5L283.5 186.2L313.8 186.2L313.8 51.5L313.2 51.0L283.5 51.2L283.2 69.5L282.5 70.2L278.5 64.8L273.5 60.0L268.2 56.2L260.2 52.2L253.5 50.0L243.5 48.2L228.8 48.2L215.5 51.0L205.8 55.0L195.8 61.5ZM236.2 76.0L245.2 76.0L254.0 77.8L261.5 81.0L267.5 85.0L272.8 90.0L276.8 95.2L281.0 103.5L283.0 111.2L283.2 122.5L282.0 130.2L279.0 138.5L275.8 144.0L269.5 151.0L261.0 157.0L254.0 160.0L245.2 161.8L237.2 161.8L228.2 160.0L220.8 156.8L214.0 152.0L207.8 145.5L203.8 139.2L200.8 131.8L199.0 122.8L199.0 113.5L200.0 107.2L201.8 101.5L206.8 92.8L212.2 86.8L220.2 81.0L227.5 77.8Z",
    "M326.2 51.0L325.8 51.5L326.0 52.8L379.2 185.8L380.0 186.5L411.2 186.8L412.2 186.2L450.5 90.2L450.8 88.8L457.8 72.0L458.0 70.5L459.8 67.0L460.8 63.5L465.5 52.5L465.5 51.2L434.2 51.0L433.2 51.5L399.0 142.2L397.0 149.0L396.0 149.5L394.8 147.5L386.8 125.5L384.8 121.2L358.5 51.8L357.5 51.0Z",
    "M481.5 0.0L480.5 1.0L480.8 186.2L560.2 186.5L568.5 185.8L580.0 183.5L592.2 179.5L602.0 174.8L612.5 167.8L617.0 164.0L625.8 155.0L630.8 148.5L635.5 140.8L639.8 131.8L642.5 124.2L644.8 115.8L646.8 103.2L646.8 84.2L645.8 76.5L642.8 63.8L636.8 48.8L632.8 41.8L627.8 34.5L623.8 29.8L618.0 24.0L606.8 15.2L594.0 8.2L586.2 5.2L578.5 3.0L567.8 1.0L545.8 0.0L517.0 0.5L504.2 0.0ZM511.8 29.5L558.8 29.2L566.2 30.0L574.0 31.8L583.8 35.8L591.0 40.2L595.0 43.5L601.2 49.8L605.0 54.5L611.0 65.5L615.0 78.5L616.0 85.5L616.0 100.5L615.0 108.0L612.0 119.0L610.0 123.8L606.0 131.0L600.0 138.8L594.5 144.0L589.0 148.0L582.2 151.8L576.8 154.0L565.2 157.0L557.2 157.8L512.2 157.8L511.5 157.0L511.2 30.2Z",
    "M726.2 48.2L720.2 49.0L711.5 51.0L700.8 55.2L695.8 58.0L687.8 63.8L680.0 71.2L677.2 74.5L673.0 80.5L669.0 87.8L666.2 94.5L664.2 101.2L663.0 107.2L662.2 114.5L662.2 123.0L663.0 130.5L666.0 143.0L669.0 150.2L672.2 156.2L679.8 166.2L685.2 171.8L689.0 174.8L698.2 180.8L704.5 183.8L713.0 186.8L722.2 188.8L726.8 189.0L728.2 189.8L740.8 189.8L742.2 189.0L746.8 188.8L752.0 187.8L759.2 185.8L769.2 181.5L777.0 176.8L782.2 172.8L789.2 166.0L791.8 163.0L795.8 157.2L799.8 150.0L803.5 140.2L805.0 133.0L805.8 132.2L805.8 104.8L805.0 104.0L803.8 97.5L801.8 91.8L796.8 81.8L788.5 70.8L779.0 62.0L768.0 55.2L763.0 53.0L754.2 50.2L742.2 48.2ZM725.2 76.8L730.5 76.0L738.2 76.0L743.8 76.8L750.2 78.8L756.8 82.0L763.8 87.5L769.8 94.8L773.0 100.5L775.8 108.8L776.8 115.8L776.8 121.8L776.0 127.5L774.0 134.5L769.8 142.8L766.2 147.2L758.8 154.0L751.8 158.0L742.8 160.8L738.8 161.2L730.2 161.2L726.0 160.8L717.2 158.0L711.8 155.0L706.8 151.2L699.8 143.8L695.8 136.8L693.0 128.0L692.2 122.2L692.8 110.8L695.0 102.5L698.0 96.2L703.8 88.8L710.5 83.0L718.5 78.8Z"
  ],
  sh: [
    {
      F: [[899.5, 125.0], [882.0, 148.5], [889.0, 159.2], [910.8, 186.8], [945.8, 186.5]],
      B: [[896.0, 118.5], [892.3, 148.5], [892.2, 159.2], [892.3, 186.8], [896.0, 186.5]]
    },
    {
      F: [[943.8, 51.0], [907.2, 51.8], [883.0, 84.2], [900.2, 107.8], [901.8, 107.5]],
      B: [[895.8, 51.0], [892.0, 51.8], [892.0, 84.2], [895.7, 118.5], [895.9, 118.5]]
    },
    {
      F: [[808.0, 51.0], [856.5, 117.2], [806.0, 186.5], [841.5, 186.5], [892.0, 116.2], [843.5, 51.0]],
      B: [[888.2, 51.0], [888.0, 117.2], [888.0, 186.5], [891.8, 186.5], [891.9, 116.2], [892.0, 51.0]]
    }
  ]
};

export interface HavDoxIntroProps {
  onAnimationComplete?: () => void;
  showContent?: boolean;
  interactive?: boolean;
}

export const HavDoxIntro: React.FC<HavDoxIntroProps> = ({
  onAnimationComplete,
  showContent = true,
  interactive = true,
}) => {
  const stgRef = useRef<HTMLDivElement>(null);
  const wmRef = useRef<HTMLDivElement>(null);
  const hsRef = useRef<HTMLDivElement>(null);
  const tgRef = useRef<HTMLParagraphElement>(null);
  const hbgRef = useRef<HTMLDivElement>(null);
  const fxSvgRef = useRef<SVGSVGElement>(null);
  const barrierLineRef = useRef<SVGLineElement>(null);
  const shockwaveRef = useRef<SVGCircleElement>(null);
  const sheenRectRef = useRef<SVGRectElement>(null);
  const replayTriggerRef = useRef<(() => void) | null>(null);
  const onCompleteRef = useRef(onAnimationComplete);

  useEffect(() => {
    onCompleteRef.current = onAnimationComplete;
  }, [onAnimationComplete]);

  useEffect(() => {
    const stg = stgRef.current;
    const wm = wmRef.current;
    const hs = hsRef.current;
    const tg = tgRef.current;
    const hbg = hbgRef.current;
    const fxSvg = fxSvgRef.current;
    const barrierLine = barrierLineRef.current;
    const shockwave = shockwaveRef.current;
    const sheenRect = sheenRectRef.current;
    if (!stg || !wm || !tg) return;

    // Mathematics & Easing Helpers
    const cl = (v: number) => Math.max(0, Math.min(1, v));
    const sg = (t: number, a: number, b: number) => cl((t - a) / (b - a));
    const eo = (p: number) => 1 - Math.pow(1 - p, 3);
    const ei = (p: number) => p * p * p;
    const eio = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);

    const pl = (p: number[][]) =>
      'polygon(' + p.map((q) => q[0] + 'px ' + q[1] + 'px').join(',') + ')';
    const clip = (e: HTMLElement, c: string) => {
      e.style.clipPath = c;
      (e.style as unknown as { webkitClipPath: string }).webkitClipPath = c;
    };

    // Stage initialization
    stg.innerHTML = '';
    const mk = () => {
      const d = document.createElement('i');
      d.className = 'sh';
      stg.appendChild(d);
      return d;
    };

    const GL = V.gl.map((p) => {
      const d = mk();
      clip(d, 'path(evenodd,"' + p + '")');
      return d;
    });

    const XS = V.sh.map(() => mk());
    const CH = [mk(), mk(), mk()];
    CH.forEach((d) => clip(d, pl(V.sh[2].F)));

    const fit = () => {
      if (wm && stg) {
        const clientWidth = wm.clientWidth || wm.getBoundingClientRect()?.width || 800;
        const scale = clientWidth / 946;
        stg.style.transform = 'scale(' + scale + ')';
        if (fxSvg) fxSvg.style.transform = 'scale(' + scale + ')';
      }
    };
    fit();
    requestAnimationFrame(fit);
    window.addEventListener('resize', fit);

    const CYY = 118.5;
    let lastE = -9;

    function ox(t: number) {
      if (t < 0.5) return 422;
      if (t < 1.7) return 422 + 218 * eo(sg(t, 0.5, 1.7));
      if (t < 2.4) return 640 + 162 * ei(sg(t, 1.7, 2.4));
      const d = t - 2.4;
      return 802 + 694 * d + 500 * d * d;
    }

    // Pacing multiplier: ~3.3s total cinematic duration
    const SPEED = 2.3;

    function R(te: number) {
      const vis = sg(te, 0.2, 0.7);
      const x = ox(te);
      const v = (x - ox(te - 0.016)) / 0.016;
      const sp = cl((v - 300) / 500);
      const gone = x > 1500 || te > 3.3 ? 0 : 1;

      CH.forEach((d, i) => {
        const k = [0, 0.03, 0.06][i];
        d.style.transform = 'translateX(' + (x - 806 - v * k) + 'px)';
        d.style.opacity = ([1, 0.3 * sp, 0.16 * sp][i] * vis * gone).toString();
      });

      // 1. Barrier Tension & Elastic Bowing (te: 1.0 -> 2.8)
      const bump = Math.sin(Math.PI * sg(te, 2.4, 2.95));
      if (barrierLine) {
        const bVis = sg(te, 0.9, 1.6) * (1 - sg(te, 2.75, 3.05));
        barrierLine.style.opacity = (bVis * (0.6 + bump * 0.4)).toFixed(2);
        const bx = 892 + bump * 14;
        barrierLine.setAttribute('x1', bx.toFixed(1));
        barrierLine.setAttribute('x2', bx.toFixed(1));
      }

      // 2. The Breakthrough: Barrier snaps open into the expansive "X"
      const e = eio(sg(te, 2.8, 3.95));
      const bd = (1 - e) * 5 * bump;
      const key = e + '|' + bd;

      if (key !== lastE.toString()) {
        lastE = e;
        XS.forEach((d, i) => {
          const s = V.sh[i];
          clip(
            d,
            pl(
              s.F.map((f, j) => {
                const b = s.B[j];
                const dy = (b[1] - CYY) / 68;
                return [b[0] + (f[0] - b[0]) * e + bd * (1 - dy * dy), b[1] + (f[1] - b[1]) * e];
              })
            )
          );
        });
      }

      XS.forEach((d) => (d.style.opacity = vis.toString()));

      // 3. Breakthrough Shockwave Pulse (te: 2.7 -> 4.2)
      if (shockwave) {
        const sProgress = sg(te, 2.7, 4.2);
        if (sProgress > 0 && sProgress < 1) {
          const r = sProgress * 230;
          const sOpacity = Math.pow(1 - sProgress, 2) * 0.85;
          shockwave.setAttribute('r', r.toFixed(1));
          shockwave.setAttribute('stroke-width', (3 * (1 - sProgress * 0.65)).toFixed(1));
          shockwave.style.opacity = sOpacity.toFixed(2);
        } else {
          shockwave.style.opacity = '0';
        }
      }

      // 4. Physical Impact Recoil on Barrier Shatter (te: 2.8 -> 3.4)
      if (stg) {
        if (te >= 2.8 && te <= 3.4) {
          const rP = (te - 2.8) / 0.6;
          const shake = Math.sin(rP * Math.PI * 4) * 3 * (1 - rP);
          stg.style.marginLeft = shake.toFixed(1) + 'px';
        } else {
          stg.style.marginLeft = '0px';
        }
      }

      // 5. The Exploration: Glyphs reveal in the wake of the X
      GL.forEach((d, i) => {
        const p = eo(sg(te, 4.3 + i * 0.18, 5 + i * 0.18));
        d.style.opacity = p.toString();
        d.style.transform = 'translateX(' + -14 * (1 - p) + 'px)';
        d.style.filter = p < 1 ? 'blur(' + 6 * (1 - p) + 'px)' : 'none';
      });

      // 6. Exploratory Light Sheen Sweep across the wordmark (te: 4.2 -> 5.8)
      if (sheenRect) {
        const sheenP = sg(te, 4.2, 5.8);
        if (sheenP > 0 && sheenP < 1) {
          const sx = sheenP * 1050 - 100;
          sheenRect.setAttribute('x', sx.toFixed(1));
          sheenRect.style.opacity = (Math.sin(sheenP * Math.PI) * 0.75).toFixed(2);
        } else {
          sheenRect.style.opacity = '0';
        }
      }

      // 7. Watermark scale & translation to golden-ratio anchor
      const c = eio(sg(te, 4.3, 5.6));
      if (wm) {
        const isMobile = window.innerWidth < 768;
        const maxScale = isMobile ? 1.25 : 1.6;
        const minScale = 1.0;
        const currentScale = maxScale - (maxScale - minScale) * c;
        const transX = isMobile ? -26 * (1 - c) : -42.6 * (1 - c);
        wm.style.transform = `scale(${currentScale}) translateX(${transX}%)`;
      }

      // 8. Tagline & Hero Reveal
      const g = sg(te, 6.4, 7.2);
      if (tg) {
        tg.style.opacity = g.toString();
        tg.style.transform = 'translateY(' + 8 * (1 - g) + 'px)';
      }
    }

    let animId: number;
    let isRunning = false;

    const resolveImmediately = () => {
      isRunning = false;
      cancelAnimationFrame(animId);
      R(99);
      if (barrierLine) barrierLine.style.opacity = '0';
      if (shockwave) shockwave.style.opacity = '0';
      if (sheenRect) sheenRect.style.opacity = '0';
      if (stg) stg.style.marginLeft = '0px';
      if (hs) hs.classList.add('on');
      if (hbg) hbg.classList.add('on');
      onCompleteRef.current?.();
    };

    const startAnimation = () => {
      cancelAnimationFrame(animId);
      isRunning = true;
      if (hs) hs.classList.remove('on');
      if (hbg) hbg.classList.remove('on');
      const startT = performance.now();

      const loop = () => {
        const elapsedSec = (performance.now() - startT) / 1000;
        const te = elapsedSec * SPEED;
        R(te);

        if (te > 7.6) {
          if (hs) hs.classList.add('on');
          if (hbg) hbg.classList.add('on');
        }

        if (te < 8.2) {
          animId = requestAnimationFrame(loop);
        } else {
          isRunning = false;
          resolveImmediately();
        }
      };

      animId = requestAnimationFrame(loop);
    };

    replayTriggerRef.current = () => {
      if (isRunning) {
        resolveImmediately();
      } else {
        startAnimation();
      }
    };

    // Always start the animation loop smoothly on mount
    startAnimation();

    return () => {
      window.removeEventListener('resize', fit);
      cancelAnimationFrame(animId);
    };
  }, []);

  return (
    <section
      id="hero"
      aria-label="HavDox intro"
      onClick={() => {
        if (interactive) {
          replayTriggerRef.current?.();
        }
      }}
      style={{ cursor: interactive ? 'pointer' : 'default' }}
      title={interactive ? "Click to replay logo breakthrough" : undefined}
    >
      <div className="wm" id="wm" ref={wmRef} role="img" aria-label="HavDox">
        <div className="stg" id="stg" ref={stgRef}></div>

        {/* Breakthrough & Exploration FX Overlay */}
        <svg
          ref={fxSvgRef}
          viewBox="0 0 946 190"
          className="havdox-fx-svg"
        >
          <defs>
            <filter id="barrierGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <linearGradient id="sheenGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#4d8dff" stopOpacity="0" />
              <stop offset="35%" stopColor="#4d8dff" stopOpacity="0.4" />
              <stop offset="50%" stopColor="#ffffff" stopOpacity="0.9" />
              <stop offset="65%" stopColor="#4d8dff" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#4d8dff" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Vertical Barrier Threshold Filament */}
          <line
            ref={barrierLineRef}
            x1="892"
            y1="30"
            x2="892"
            y2="170"
            stroke="#3b82f6"
            strokeWidth="2.5"
            strokeLinecap="round"
            opacity="0"
            filter="url(#barrierGlow)"
          />

          {/* Breakthrough Shockwave Pulse Ring */}
          <circle
            ref={shockwaveRef}
            cx="892"
            cy="118.5"
            r="0"
            fill="none"
            stroke="#12284a"
            strokeWidth="2.5"
            opacity="0"
          />

          {/* Exploratory Sheen Beam */}
          <rect
            ref={sheenRectRef}
            x="0"
            y="20"
            width="150"
            height="150"
            fill="url(#sheenGrad)"
            opacity="0"
          />
        </svg>
      </div>

      <p className="tag" id="tg" ref={tgRef}>
        Imagine. Build. Go Beyond.
      </p>

      {showContent && (
        <div className="hs" id="hs" ref={hsRef}>
          <h1 className="h1">Technology for what’s next.</h1>
          <p>
            We bring intelligence, software, infrastructure, automation and creativity together to
            turn ambitious ideas into reality.
          </p>
          <div className="hs-actions">
            <button className="b" onClick={(e) => e.stopPropagation()}>
              Start a project →
            </button>
            <a className="b o" href="#explore" onClick={(e) => e.stopPropagation()}>
              Explore what we build →
            </a>
          </div>
        </div>
      )}

      <div className="hbg" id="hbg" ref={hbgRef}></div>
    </section>
  );
};

export default HavDoxIntro;
