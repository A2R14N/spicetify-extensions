// NAME: Plinko Volume Gamble
// AUTHOR: A2R14N
// DESCRIPTION: Replaces volume controls with a Plinko gambling game

(function PlinkoVolume() {
  if (
    !Spicetify?.Player ||
    !Spicetify?.Platform ||
    !Spicetify?.React ||
    !Spicetify?.ReactDOM ||
    !Spicetify?.PopupModal ||
    !Spicetify?.LocalStorage ||
    !Spicetify?.Menu ||
    !Spicetify?.showNotification
  ) {
    setTimeout(PlinkoVolume, 300);
    return;
  }

  const { React, ReactDOM, PopupModal, LocalStorage, Menu, Player } = Spicetify;
  const { useState, useEffect, useRef } = React;

  // ═══════════════════════════════════════════════════════════════
  //  SETTINGS
  // ═══════════════════════════════════════════════════════════════

  const STORAGE_PREFIX = "plinkoVolume:";

  const DEFAULT_SETTINGS = {
    enabled: false,
    rows: 8,
    ballSpeed: 2,
    luck: 0,
    showPercentages: true,
    autoClose: false,
    ballColor: "#1db954",
    pegColor: "#ffffff",
    backgroundColor: "#000000",
  };

  const SETTINGS_LIMITS = {
    rows: { min: 4, max: 14 },
    ballSpeed: { min: 1, max: 5 },
    luck: { min: 0, max: 100 },
  };

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function loadSettings() {
    const s = { ...DEFAULT_SETTINGS };
    for (const key of Object.keys(DEFAULT_SETTINGS)) {
      const stored = LocalStorage.get(STORAGE_PREFIX + key);
      if (stored !== null && stored !== undefined) {
        if (typeof DEFAULT_SETTINGS[key] === "boolean") {
          s[key] = stored === "true";
        } else if (typeof DEFAULT_SETTINGS[key] === "number") {
          const parsed = parseInt(stored, 10);
          if (Number.isNaN(parsed)) {
            s[key] = DEFAULT_SETTINGS[key];
          } else if (SETTINGS_LIMITS[key]) {
            s[key] = clamp(parsed, SETTINGS_LIMITS[key].min, SETTINGS_LIMITS[key].max);
          } else {
            s[key] = parsed;
          }
        } else {
          s[key] = stored;
        }
      }
    }
    if (s.backgroundColor === "#121212") s.backgroundColor = DEFAULT_SETTINGS.backgroundColor;
    return s;
  }

  function saveAllSettings(s) {
    for (const [key, value] of Object.entries(s)) {
      LocalStorage.set(STORAGE_PREFIX + key, String(value));
    }
  }

  let settings = loadSettings();

  // ═══════════════════════════════════════════════════════════════
  //  CSS INJECTION
  // ═══════════════════════════════════════════════════════════════

  const STYLES = `
    .plinko-volume-active .volume-bar,
    .plinko-volume-active [data-testid="volume-bar"],
    .plinko-volume-active .main-nowPlayingBar-volumeBar,
    .plinko-volume-active button[data-testid="volume-button"] {
      display: none !important;
    }

    .plinko-trigger-btn {
      background: none;
      border: none;
      color: var(--spice-subtext, #b3b3b3);
      cursor: pointer;
      padding: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      border-radius: 8px;
      transition: color 0.2s, transform 0.15s;
    }

    .plinko-trigger-btn:hover {
      color: var(--spice-text, #fff);
      transform: scale(1.1);
    }

    .plinko-trigger-btn:active {
      transform: scale(0.95);
    }

    .plinko-trigger-percent {
      min-width: 4ch;
      text-align: right;
      font-size: 12px;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
    }

    .spicetify-popup-container:has(.plinko-container) {
      --plinko-surface: var(--background-base, var(--spice-main, #121212));
      --plinko-raised: var(--background-elevated-base, #242424);
      --plinko-hover: var(--background-elevated-highlight, #2a2a2a);
      --plinko-text: var(--text-base, var(--spice-text, #fff));
      --plinko-subtext: var(--text-subdued, var(--spice-subtext, #b3b3b3));
      --plinko-outline: var(--essential-subdued, #7c7c7c);
      --plinko-divider: var(--decorative-subdued, #333);
      --plinko-accent: var(--essential-bright-accent, var(--spice-button-active, #1ed760));
      width: min(440px, calc(100vw - 32px));
      max-width: none;
      background: var(--plinko-surface);
      color: var(--plinko-text);
      border: 1px solid transparent;
      border-radius: 16px;
      padding: 0;
      overflow: auto;
      max-height: calc(100vh - 32px);
      font-family: var(--font-family, CircularSp, sans-serif);
    }
    .spicetify-popup-container:has(.plinko-container) .spicetify-popup-header {
      padding: 24px 24px 20px;
      margin: 0;
      align-items: center;
      border: 0;
      background: var(--plinko-surface);
    }
    .spicetify-popup-container:has(.plinko-container) .spicetify-popup-title {
      font-size: 20px;
      font-weight: 600;
      line-height: 1.2;
      letter-spacing: -.4px;
      color: var(--plinko-text);
    }
    .spicetify-popup-container:has(.plinko-container) .spicetify-popup-closeBtn {
      color: var(--plinko-subtext);
      background: var(--plinko-raised);
      width: 40px;
      height: 40px;
      padding: 11px;
      margin: 0;
      border-radius: 8px;
    }
    .spicetify-popup-container:has(.plinko-container) .spicetify-popup-closeBtn:hover { background: var(--plinko-hover); }
    .spicetify-popup-container:has(.plinko-container) .spicetify-popup-content,
    .spicetify-popup-container:has(.plinko-container) main { padding: 0; margin: 0; background: var(--plinko-surface); }
    .plinko-container { display: block; padding: 0 24px 24px; color: var(--plinko-text); user-select: none; }
    .plinko-container * { box-sizing: border-box; }
    .plinko-info { display: flex; align-items: center; justify-content: space-between; width: 100%; padding: 0 0 20px; gap: 12px; border-bottom: 1px solid var(--plinko-divider); }
    .plinko-info-label { color: var(--plinko-subtext); font-size: 13px; }
    .plinko-volume-display { font-size: 32px; font-weight: 500; line-height: 1; letter-spacing: -1px; text-align: right; min-width: 0; color: var(--plinko-text); font-variant-numeric: tabular-nums; }
    .plinko-volume-unit { font-size: 20px; color: var(--plinko-subtext); margin-left: 3px; }
    .plinko-canvas-wrap { --plinko-slot-gap: 3px; position: relative; overflow: hidden; margin-top: 20px; border: 1px solid #252525; border-radius: 10px; background: #000; padding: 0 4px 8px; }
    .plinko-canvas { display: block; width: 100%; height: auto; cursor: pointer; }
    /* Half-gap insets align the grid's gap centers with the canvas dividers. */
    .plinko-slots { display: grid; gap: var(--plinko-slot-gap); padding: 0 calc(var(--plinko-slot-gap) / 2); }
    .plinko-slot { display: flex; align-items: center; justify-content: center; min-width: 0; padding: 10px 0; border-radius: 4px; background: #151515; color: var(--plinko-slot-color); font-size: 11px; font-weight: 500; line-height: 1; text-align: center; white-space: nowrap; font-variant-numeric: tabular-nums; }
    .plinko-slot.is-winner { background: var(--plinko-slot-highlight); font-weight: 700; }
    .plinko-status { color: var(--plinko-subtext); font-size: 12px; line-height: 18px; min-height: 18px; text-align: center; margin: 18px 0 22px; }
    .plinko-status.is-result { color: var(--plinko-accent); }
    .plinko-footer { display: flex; align-items: center; justify-content: space-between; gap: 8px; border-top: 1px solid var(--plinko-divider); padding-top: 16px; }
    .plinko-btn-row { display: flex; align-items: center; gap: 6px; }
    .plinko-container button { min-height: 44px; padding: 0 16px; border: 1px solid transparent; border-radius: 8px; font: 600 13px var(--font-family, CircularSp, sans-serif); white-space: nowrap; cursor: pointer; transition: none; }
    .plinko-container button:hover:not(:disabled), .plinko-container button:active:not(:disabled) { transform: none; opacity: 1; }
    .plinko-drop-btn { background: var(--plinko-accent); color: #000; }
    .plinko-drop-btn:hover:not(:disabled) { filter: brightness(1.08); }
    .plinko-drop-btn:disabled { opacity: .5; cursor: default; }
    .plinko-container .plinko-skip-btn, .plinko-container .plinko-settings-btn { color: var(--plinko-text); background: var(--plinko-raised); border-color: var(--plinko-outline); }
    .plinko-skip-btn:hover:not(:disabled), .plinko-settings-btn:hover { background: var(--plinko-hover); }
    .plinko-skip-btn:disabled { opacity: .45; cursor: default; }
    .plinko-container .plinko-settings-btn { display: flex; align-items: center; gap: 7px; padding: 0 10px; }
    .plinko-settings-btn svg { width: 16px; height: 16px; }
    .plinko-container button:focus-visible { outline: 2px solid var(--plinko-accent); outline-offset: 3px; }
    @media (max-width: 380px) {
      .plinko-container { padding: 0 14px 18px; }
      .spicetify-popup-container:has(.plinko-container) .spicetify-popup-header { padding: 18px 14px 20px; }
      .plinko-container button { padding: 0 10px; }
      .plinko-container .plinko-settings-btn { gap: 5px; padding: 0 7px; }
      .plinko-btn-row { gap: 4px; }
      .plinko-slots.is-dense { padding-bottom: 16px; }
      .plinko-slots.is-dense .plinko-slot:nth-child(even) { transform: translateY(16px); }
    }

    .pv-settings-dialog {
      --pv-settings-surface: var(--background-base, var(--spice-main, #121212));
      --pv-settings-raised: var(--background-elevated-base, #242424);
      --pv-settings-hover: var(--background-elevated-highlight, #2a2a2a);
      --pv-settings-text: var(--text-base, var(--spice-text, #fff));
      --pv-settings-subtext: var(--text-subdued, var(--spice-subtext, #b3b3b3));
      --pv-settings-outline: var(--essential-subdued, #7c7c7c);
      --pv-settings-divider: var(--decorative-subdued, #333);
      --pv-settings-accent: var(--essential-bright-accent, var(--spice-button-active, #1ed760));
      color-scheme: dark;
      color: var(--pv-settings-text);
      background: var(--pv-settings-surface);
      border: 1px solid transparent;
      border-radius: 14px;
      padding: 0;
      width: min(540px, calc(100vw - 40px));
      max-height: calc(100vh - 40px);
      box-shadow: 0 20px 90px #0009;
      font: 14px/1.5 sans-serif;
      overflow: auto;
    }
    .pv-settings-dialog::backdrop { background: #000a; }
    .pv-settings-dialog * { box-sizing: border-box; }
    .pv-settings { padding: 26px; }
    .pv-settings-heading { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 20px; }
    .pv-settings-heading h2 { font-size: 22px; font-weight: 700; margin: 0; }
    .pv-settings-dialog .pv-settings-heading button { display: grid; place-items: center; width: 40px; height: 40px; padding: 0; flex-shrink: 0; border-color: transparent; }
    .pv-settings-dialog button, .pv-settings-dialog input { font: inherit; }
    .pv-settings-dialog button { cursor: pointer; border-radius: 7px; border: 1px solid var(--pv-settings-outline); background: var(--pv-settings-raised); color: inherit; padding: 8px 13px; }
    .pv-settings-dialog button:hover { background: var(--pv-settings-hover); }
    .pv-settings-dialog button:disabled { opacity: .45; cursor: default; }
    .pv-settings-dialog :focus-visible { outline: 2px solid var(--pv-settings-accent); outline-offset: 3px; }
    .pv-settings-field { display: flex; flex-direction: column; gap: 7px; margin-bottom: 18px; min-width: 0; }
    .pv-settings-field > label, .pv-settings-toggle { font-weight: 600; }
    .pv-settings-input { background: var(--pv-settings-raised); border: 1px solid var(--pv-settings-outline); border-radius: 7px; color: inherit; padding: 10px; width: 100%; }
    .pv-settings-description, .pv-settings-status { color: var(--pv-settings-subtext); font-size: 12px; font-weight: 400; margin: 0; }
    .pv-settings-numbers { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
    .pv-settings-stepper { display: flex; gap: 8px; align-items: center; }
    .pv-settings-stepper input { appearance: textfield; text-align: center; min-width: 0; height: 44px; padding: 0 10px; }
    .pv-settings-stepper input::-webkit-inner-spin-button,
    .pv-settings-stepper input::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
    .pv-settings-stepper button { display: grid; place-items: center; flex: 0 0 40px; height: 44px; font-size: 18px; line-height: 1; padding: 0; }
    .pv-settings-range-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; font-weight: 600; }
    .pv-settings-range-heading output { font-variant-numeric: tabular-nums; }
    .pv-settings-dialog .pv-settings-range { width: 100%; height: 20px; margin: 0; padding: 0; border: 0; accent-color: var(--pv-settings-accent); cursor: pointer; }
    .pv-settings-toggles { display: grid; gap: 14px; margin: 4px 0 22px; }
    .pv-settings-toggle { display: flex; align-items: flex-start; gap: 11px; cursor: pointer; }
    .pv-settings-toggle input { accent-color: var(--pv-settings-accent); width: 17px; height: 17px; margin: 3px 0 0; flex-shrink: 0; }
    .pv-settings-toggle span { display: flex; flex-direction: column; gap: 2px; }
    .pv-settings-enabled { margin-bottom: 22px; }
    .pv-settings-colors { border: 0; margin: 0 0 18px; padding: 0; min-width: 0; }
    .pv-settings-colors legend { font-weight: 600; margin-bottom: 9px; padding: 0; }
    .pv-settings-color-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
    .pv-settings-color-field { display: flex; flex-direction: column; gap: 7px; font-size: 12px; color: var(--pv-settings-subtext); cursor: pointer; }
    .pv-settings-color { width: 100%; height: 34px; border: 1px solid var(--pv-settings-outline); border-radius: 7px; padding: 3px; background: var(--pv-settings-raised); cursor: pointer; }
    .pv-settings-color::-webkit-color-swatch-wrapper { padding: 0; }
    .pv-settings-color::-webkit-color-swatch { border: 0; border-radius: 4px; }
    .pv-settings-status { min-height: 18px; margin-bottom: 8px; }
    .pv-settings-btn-row { display: flex; justify-content: space-between; gap: 10px; border-top: 1px solid var(--pv-settings-divider); padding-top: 18px; }
    .pv-settings-dialog .pv-settings-btn { background: var(--pv-settings-accent); border-color: transparent; color: #000; font-weight: 700; }
    .pv-settings-dialog .pv-settings-btn:hover { filter: brightness(1.1); }
    .pv-settings-dialog .pv-settings-btn-secondary { background: var(--pv-settings-raised); border-color: var(--pv-settings-outline); color: inherit; font-weight: 400; }
    .pv-settings-dialog .pv-settings-btn-secondary:hover { background: var(--pv-settings-hover); filter: none; }
    @media (max-width: 420px) {
      .pv-settings { padding: 18px; }
      .pv-settings-numbers { grid-template-columns: 1fr; gap: 0; }
    }
  `;

  function injectStyles() {
    if (!document.getElementById("plinko-volume-style")) {
      const style = document.createElement("style");
      style.id = "plinko-volume-style";
      style.textContent = STYLES;
      document.head.appendChild(style);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  //  PLINKO PATH ENGINE
  // ═══════════════════════════════════════════════════════════════

  function createPlinkoEngine(config) {
    const { width, height, rows, pegRadius, ballRadius, ballSpeedMultiplier, luck = 0 } = config;
    const slots = rows + 1;
    const slotWidth = width / slots;
    const luckRatio = clamp(Number.isFinite(luck) ? luck : 0, 0, 100) / 100;
    const cumulativeOdds = [];
    let baseOdds = 2 ** -rows, cumulative = 0;
    for (let slot = 0; slot < slots; slot++) {
      cumulative += (1 - luckRatio) * baseOdds + luckRatio / slots;
      cumulativeOdds.push(cumulative);
      baseOdds *= (rows - slot) / (slot + 1);
    }
    cumulativeOdds[rows] = 1;
    const pegSpacingY = (height - 112) / (rows - 1);
    const firstPegY = 48;
    const effectiveBallRadius = Math.min(ballRadius, (slotWidth - pegRadius * 2) / 2 - 1);
    const clearance = pegRadius + effectiveBallRadius;
    const landingY = height - 16 - effectiveBallRadius;
    const bounceHeight = Math.min(12, pegSpacingY * 0.4);
    const pegs = [];
    const slotBoundaries = [];
    const slotValues = [];

    // One apex peg, followed by a triangular grid aligned with every landing slot.
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col <= row; col++) {
        pegs.push({ x: width / 2 + (col - row / 2) * slotWidth, y: firstPegY + row * pegSpacingY, radius: pegRadius });
      }
    }
    for (let i = 0; i <= slots; i++) slotBoundaries.push(i * slotWidth);
    for (let i = 0; i < slots; i++) slotValues.push(Math.round(i / rows * 100));

    function segment(fromX, fromY, toX, toY, duration, bounce) {
      const c1x = fromX + (toX - fromX) * 0.65;
      const c1y = bounce ? fromY - bounceHeight : fromY + (toY - fromY) * 0.15;
      const c2x = toX;
      const c2y = toY - (toY - fromY) * 0.4;
      // Precompute the cubic coefficients once; each frame only evaluates one curve.
      return {
        duration,
        ax: -fromX + 3 * c1x - 3 * c2x + toX, bx: 3 * fromX - 6 * c1x + 3 * c2x, cx: 3 * (c1x - fromX), dx: fromX,
        ay: -fromY + 3 * c1y - 3 * c2y + toY, by: 3 * fromY - 6 * c1y + 3 * c2y, cy: 3 * (c1y - fromY), dy: fromY,
      };
    }

    function createBall() {
      // Luck blends the binomial distribution with equal chances for all slots.
      let targetRights = 0;
      if (luckRatio > 0) {
        const draw = Math.random();
        while (targetRights < rows && draw >= cumulativeOdds[targetRights]) targetRights++;
      }
      const segments = [];
      let rights = 0, x = width / 2, y = firstPegY - clearance;
      segments.push(segment(x, 16, x, y, 0.35 / ballSpeedMultiplier, false));
      for (let row = 0; row < rows; row++) {
        // At zero luck each row is independent; otherwise randomize a path to the chosen slot.
        const goRight = luckRatio === 0 ? Math.random() >= 0.5 : Math.random() < (targetRights - rights) / (rows - row);
        if (goRight) rights++;
        const nextX = width / 2 + (rights - (row + 1) / 2) * slotWidth;
        const nextY = row === rows - 1 ? landingY : firstPegY + (row + 1) * pegSpacingY - clearance;
        segments.push(segment(x, y, nextX, nextY, (row === rows - 1 ? 0.42 : 0.36) / ballSpeedMultiplier, true));
        x = nextX; y = nextY;
      }
      return {
        x: width / 2, y: 16, radius: effectiveBallRadius, active: true, landed: false,
        landedSlot: -1, targetSlot: rights, bounceCount: 0, segments, segmentIndex: 0, elapsed: 0,
      };
    }

    function simulate(ball) {
      if (!ball.active) return;
      ball.x = (ball.targetSlot + 0.5) * slotWidth;
      ball.y = landingY;
      ball.bounceCount = rows;
      ball.active = false;
      ball.landed = true;
      ball.landedSlot = ball.targetSlot;
    }

    function stepBall(ball, dt) {
      if (!ball.active) return;
      ball.elapsed += Math.max(0, dt);
      let curve = ball.segments[ball.segmentIndex];
      while (ball.elapsed >= curve.duration) {
        ball.elapsed -= curve.duration;
        ball.segmentIndex++;
        if (ball.segmentIndex === ball.segments.length) {
          simulate(ball);
          return;
        }
        curve = ball.segments[ball.segmentIndex];
      }
      ball.bounceCount = ball.segmentIndex;
      const t = ball.elapsed / curve.duration;
      ball.x = ((curve.ax * t + curve.bx) * t + curve.cx) * t + curve.dx;
      ball.y = ((curve.ay * t + curve.by) * t + curve.cy) * t + curve.dy;
    }

    return { pegs, slots, slotWidth, slotBoundaries, slotValues, createBall, stepBall, simulate, width, height };
  }

  // ═══════════════════════════════════════════════════════════════
  //  PLINKO GAME COMPONENT
  // ═══════════════════════════════════════════════════════════════

  function PlinkoGame() {
    const canvasRef = useRef(null);
    const ctxRef = useRef(null);
    const boardCanvasRef = useRef(null);
    const ballCanvasRef = useRef(null);
    const engineRef = useRef(null);
    const ballRef = useRef(null);
    const animFrameRef = useRef(null);
    const lastTimeRef = useRef(0);
    const autoCloseTimerRef = useRef(null);

    const [isDropping, setIsDropping] = useState(false);
    const [resultVolume, setResultVolume] = useState(null);

    const currentVolume = Math.round((Player.getVolume?.() ?? 0.5) * 100);

    const CANVAS_WIDTH = 380;
    const CANVAS_HEIGHT = 306;

    if (!engineRef.current) {
      engineRef.current = createPlinkoEngine({
        width: CANVAS_WIDTH,
        height: CANVAS_HEIGHT,
        rows: settings.rows,
        pegRadius: 3,
        ballRadius: 6,
        ballSpeedMultiplier: settings.ballSpeed,
        luck: settings.luck,
      });
    }

    function getCtx() {
      if (!ctxRef.current) {
        ctxRef.current = canvasRef.current?.getContext("2d");
      }
      return ctxRef.current;
    }

    function drawStatic() {
      const ctx = getCtx();
      const engine = engineRef.current;
      if (!ctx || !engine) return;

      if (!boardCanvasRef.current) {
        const board = document.createElement("canvas");
        board.width = CANVAS_WIDTH;
        board.height = CANVAS_HEIGHT;
        const boardCtx = board.getContext("2d");
        if (!boardCtx) return;
        paintBoard(boardCtx, engine);
        boardCanvasRef.current = board;
      }

      // The opaque cached board also erases the ball's previous position.
      ctx.drawImage(boardCanvasRef.current, 0, 0);
    }

    function paintBoard(ctx, engine) {
      ctx.fillStyle = settings.backgroundColor;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      for (let i = 0; i <= engine.slots; i++) {
        const x = engine.slotBoundaries[i];
        ctx.strokeStyle = "rgba(255,255,255,0.1)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, CANVAS_HEIGHT - 18);
        ctx.lineTo(x, CANVAS_HEIGHT);
        ctx.stroke();
      }

      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = settings.pegColor;
      ctx.beginPath();
      for (const peg of engine.pegs) {
        ctx.moveTo(peg.x + peg.radius, peg.y);
        ctx.arc(peg.x, peg.y, peg.radius, 0, Math.PI * 2);
      }
      ctx.fill();
      ctx.restore();

    }

    function drawBall(ball) {
      const ctx = getCtx();
      if (!ctx) return;

      if (!ballCanvasRef.current) {
        const sprite = document.createElement("canvas");
        sprite.width = sprite.height = ball.radius * 4;
        const spriteCtx = sprite.getContext("2d");
        if (!spriteCtx) return;
        paintBall(spriteCtx, ball.radius);
        ballCanvasRef.current = sprite;
      }
      ctx.drawImage(ballCanvasRef.current, ball.x - ball.radius * 2, ball.y - ball.radius * 2);
    }

    function paintBall(ctx, radius) {
      const center = radius * 2;
      const gradient = ctx.createRadialGradient(center, center, 0, center, center, radius * 2);
      gradient.addColorStop(0, settings.ballColor);
      gradient.addColorStop(0.5, settings.ballColor + "88");
      gradient.addColorStop(1, "transparent");

      ctx.beginPath();
      ctx.arc(center, center, radius * 2, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(center, center, radius, 0, Math.PI * 2);
      ctx.fillStyle = settings.ballColor;
      ctx.fill();

      ctx.save();
      ctx.beginPath();
      ctx.arc(center - 2, center - 2, radius * 0.4, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.fill();
      ctx.restore();
    }

    function cancelAutoClose() {
      if (autoCloseTimerRef.current !== null) {
        clearTimeout(autoCloseTimerRef.current);
        autoCloseTimerRef.current = null;
      }
    }

    function applyResult(ball) {
      const engine = engineRef.current;
      const vol = engine.slotValues[ball.landedSlot];

      drawStatic();
      drawBall(ball);

      setResultVolume(vol);
      setIsDropping(false);
      Player.setVolume?.(vol / 100);
      updateTriggerVolume(vol / 100);
      Spicetify.showNotification(`Volume set to ${vol}%`);

      cancelAutoClose();
      if (settings.autoClose) {
        autoCloseTimerRef.current = setTimeout(() => {
          autoCloseTimerRef.current = null;
          PopupModal.hide();
        }, 1500);
      }
    }

    function gameLoop(timestamp) {
      const ball = ballRef.current;
      const engine = engineRef.current;

      if (!ball || !engine) return;

      if (lastTimeRef.current === 0) {
        lastTimeRef.current = timestamp;
      }

      const dt = Math.min((timestamp - lastTimeRef.current) / 1000, 0.05);
      lastTimeRef.current = timestamp;

      engine.stepBall(ball, dt);

      if (ball.landed) {
        applyResult(ball);
        return;
      }

      drawStatic();
      drawBall(ball);
      animFrameRef.current = requestAnimationFrame(gameLoop);
    }

    function dropBall() {
      if (isDropping || ballRef.current?.active) return;

      const engine = engineRef.current;
      if (!engine) return;

      cancelAutoClose();
      setIsDropping(true);
      setResultVolume(null);
      lastTimeRef.current = 0;

      ballRef.current = engine.createBall();
      animFrameRef.current = requestAnimationFrame(gameLoop);
    }

    function skipDrop() {
      const ball = ballRef.current;
      const engine = engineRef.current;
      if (!ball || !engine || !ball.active) return;

      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }

      engine.simulate(ball);
      applyResult(ball);
    }

    useEffect(() => {
      drawStatic();
      drawBall({ x: CANVAS_WIDTH / 2, y: 16, radius: 6 });
      return () => {
        cancelAutoClose();
        if (animFrameRef.current) {
          cancelAnimationFrame(animFrameRef.current);
        }
        boardCanvasRef.current = null;
        ballCanvasRef.current = null;
        ctxRef.current = null;
      };
    }, []);

    return React.createElement(
      "div",
      { className: "plinko-container" },

      React.createElement(
        "div",
        { className: "plinko-info" },
        React.createElement("span", { className: "plinko-info-label" }, "Current volume"),
        React.createElement("span", { className: "plinko-volume-display" }, resultVolume !== null ? resultVolume : currentVolume,
          React.createElement("span", { className: "plinko-volume-unit" }, "%")),
      ),

      React.createElement(
        "div",
        { className: "plinko-canvas-wrap" },
        React.createElement("canvas", {
          ref: canvasRef,
          className: "plinko-canvas",
          width: CANVAS_WIDTH,
          height: CANVAS_HEIGHT,
          onClick: dropBall,
          tabIndex: 0,
          role: "img",
          "aria-label": resultVolume !== null ? `Plinko board. Volume set to ${resultVolume}%.` : `Plinko board. Current volume ${currentVolume}%. Click or press Enter to drop a ball.`,
          onKeyDown: (e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              dropBall();
            }
          },
        }),
        settings.showPercentages ? React.createElement("div", { className: "plinko-slots" + (engineRef.current.slots > 11 ? " is-dense" : ""), style: { gridTemplateColumns: `repeat(${engineRef.current.slots}, minmax(0, 1fr))` }, "aria-label": "Possible volume results" },
          ...engineRef.current.slotValues.map((vol) => React.createElement("span", {
            key: vol, className: "plinko-slot" + (resultVolume === vol ? " is-winner" : ""),
            "aria-label": `${vol}% volume`,
            style: { "--plinko-slot-color": `hsl(${vol / 100 * 120}, 80%, 55%)`, "--plinko-slot-highlight": `hsla(${vol / 100 * 120}, 80%, 55%, .25)` },
          }, vol)),
        ) : null,
      ),

      React.createElement("p", { className: "plinko-status" + (resultVolume !== null ? " is-result" : ""), "aria-live": "polite" },
        isDropping ? "Dropping…" : resultVolume !== null ? `Volume set to ${resultVolume}%` : "Drop a ball to choose your volume"),
      React.createElement(
        "div",
        { className: "plinko-footer" },
        React.createElement("button", { className: "plinko-settings-btn", type: "button", onClick: openSettings },
          React.createElement("svg", { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.5, "aria-hidden": true },
            React.createElement("path", { d: "M3 7h5m4 0h9M3 17h9m4 0h5" }),
            React.createElement("circle", { cx: 10, cy: 7, r: 2 }), React.createElement("circle", { cx: 14, cy: 17, r: 2 })),
          "Settings"),
        React.createElement("div", { className: "plinko-btn-row" },
        React.createElement("button", { className: "plinko-skip-btn", type: "button", onClick: skipDrop, disabled: !isDropping }, "Skip"),
        React.createElement(
          "button",
          {
            className: "plinko-drop-btn",
            onClick: dropBall,
            disabled: isDropping,
            type: "button",
          },
          "Drop ball",
        ),
        ),
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════
  //  SETTINGS COMPONENT
  // ═══════════════════════════════════════════════════════════════

  function SettingsToggle({ name, label, description, checked, onChange }) {
    return React.createElement("label", { className: "pv-settings-toggle" },
      React.createElement("input", { type: "checkbox", name, checked, autoFocus: name === "enabled", onChange: (event) => onChange(event.target.checked) }),
      React.createElement("span", null, label,
        React.createElement("small", { className: "pv-settings-description" }, description)),
    );
  }

  function NumberSetting({ name, label, description, value, onChange }) {
    const { min, max } = SETTINGS_LIMITS[name];
    const number = Number.parseInt(value, 10);
    const normalized = Number.isFinite(number) ? clamp(number, min, max) : DEFAULT_SETTINGS[name];
    return React.createElement("div", { className: "pv-settings-field" },
      React.createElement("label", { htmlFor: "pv-" + name }, label),
      React.createElement("div", { className: "pv-settings-stepper" },
        React.createElement("button", { type: "button", "aria-label": "Decrease " + label.toLowerCase(), disabled: normalized <= min, onClick: () => onChange(normalized - 1) }, "−"),
        React.createElement("input", {
          id: "pv-" + name, name, className: "pv-settings-input", type: "number", min, max, step: 1, required: true, value,
          "aria-describedby": "pv-" + name + "-hint",
          onChange: (event) => onChange(event.target.value), onBlur: () => onChange(normalized),
        }),
        React.createElement("button", { type: "button", "aria-label": "Increase " + label.toLowerCase(), disabled: normalized >= max, onClick: () => onChange(normalized + 1) }, "+"),
      ),
      React.createElement("p", { id: "pv-" + name + "-hint", className: "pv-settings-description" }, description),
    );
  }

  function ColorSetting({ name, label, value, onChange }) {
    return React.createElement("label", { className: "pv-settings-color-field" }, label,
      React.createElement("input", { name, className: "pv-settings-color", type: "color", value, onChange: (event) => onChange(event.target.value) }),
    );
  }

  function LuckSetting({ value, onChange }) {
    return React.createElement("div", { className: "pv-settings-field" },
      React.createElement("div", { className: "pv-settings-range-heading" },
        React.createElement("label", { htmlFor: "pv-luck" }, "Luck"),
        React.createElement("output", { htmlFor: "pv-luck" }, value + "%")),
      React.createElement("input", {
        id: "pv-luck", name: "luck", className: "pv-settings-range", type: "range", min: 0, max: 100, step: 1, value,
        "aria-describedby": "pv-luck-hint", "aria-valuetext": value + "% luck",
        onChange: (event) => onChange(Number(event.target.value)),
      }),
      React.createElement("p", { id: "pv-luck-hint", className: "pv-settings-description" },
        "Give outer slots more chances. 0% keeps current odds; 100% gives every slot an equal chance."),
    );
  }

  function SettingsModal() {
    const [state, setState] = useState({ ...settings });
    const [status, setStatus] = useState("");
    const closeTimerRef = useRef(null);

    function cancelClose() {
      if (closeTimerRef.current !== null) {
        clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
    }
    useEffect(() => cancelClose, []);

    function update(key, value) {
      setState((previous) => ({ ...previous, [key]: value }));
    }

    function handleSave(event) {
      event?.preventDefault();
      const saved = { ...state };
      for (const key of ["rows", "ballSpeed", "luck"]) {
        const parsed = Number.parseInt(saved[key], 10);
        saved[key] = Number.isFinite(parsed) ? clamp(parsed, SETTINGS_LIMITS[key].min, SETTINGS_LIMITS[key].max) : DEFAULT_SETTINGS[key];
      }
      saveAllSettings(saved);
      settings = saved;
      applyEnabledState();
      setStatus("Settings saved.");
      cancelClose();
      closeTimerRef.current = setTimeout(() => {
        closeTimerRef.current = null;
        closeSettings();
      }, 800);
    }

    function handleReset() {
      cancelClose();
      const reset = { ...DEFAULT_SETTINGS };
      setState(reset);
      saveAllSettings(reset);
      settings = reset;
      applyEnabledState();
      setStatus("Defaults restored.");
    }

    return React.createElement("form", { className: "pv-settings", onSubmit: handleSave },
      React.createElement("div", { className: "pv-settings-heading" },
        React.createElement("h2", { id: "pv-settings-title" }, "Plinko Volume Settings"),
        React.createElement("button", { type: "button", "aria-label": "Close settings", onClick: closeSettings }, "✕"),
      ),
      React.createElement("div", { className: "pv-settings-enabled" },
        React.createElement(SettingsToggle, { name: "enabled", label: "Enable Plinko Volume", description: "Replace the volume slider with the Plinko button.", checked: state.enabled, onChange: (value) => update("enabled", value) }),
      ),
      React.createElement("div", { className: "pv-settings-numbers" },
        React.createElement(NumberSetting, { name: "rows", label: "Peg rows", description: "Choose 4–14 rows for the board.", value: state.rows, onChange: (value) => update("rows", value) }),
        React.createElement(NumberSetting, { name: "ballSpeed", label: "Ball speed", description: "Choose a speed from 1 to 5.", value: state.ballSpeed, onChange: (value) => update("ballSpeed", value) }),
      ),
      React.createElement(LuckSetting, { value: state.luck, onChange: (value) => update("luck", value) }),
      React.createElement("div", { className: "pv-settings-toggles" },
        React.createElement(SettingsToggle, { name: "showPercentages", label: "Show slot percentages", description: "Display the volume below each landing slot.", checked: state.showPercentages, onChange: (value) => update("showPercentages", value) }),
        React.createElement(SettingsToggle, { name: "autoClose", label: "Close after a drop", description: "Close the game shortly after the ball lands.", checked: state.autoClose, onChange: (value) => update("autoClose", value) }),
      ),
      React.createElement("fieldset", { className: "pv-settings-colors" },
        React.createElement("legend", null, "Colors"),
        React.createElement("div", { className: "pv-settings-color-grid" },
          React.createElement(ColorSetting, { name: "ballColor", label: "Ball", value: state.ballColor, onChange: (value) => update("ballColor", value) }),
          React.createElement(ColorSetting, { name: "pegColor", label: "Pegs", value: state.pegColor, onChange: (value) => update("pegColor", value) }),
          React.createElement(ColorSetting, { name: "backgroundColor", label: "Background", value: state.backgroundColor, onChange: (value) => update("backgroundColor", value) }),
        ),
      ),
      React.createElement("p", { className: "pv-settings-status", role: "status" }, status),
      React.createElement("div", { className: "pv-settings-btn-row" },
        React.createElement("button", { type: "button", className: "pv-settings-btn pv-settings-btn-secondary", onClick: handleReset }, "Reset defaults"),
        React.createElement("button", { type: "submit", className: "pv-settings-btn" }, "Save settings"),
      ),
    );
  }

  let settingsDialog = null;
  let settingsRoot = null;
  let settingsFocus = null;
  let settingsPreviousOverflow = "";

  function closeSettings() {
    if (!settingsDialog) return;
    const dialog = settingsDialog;
    settingsDialog = null;
    settingsRoot.unmount();
    settingsRoot = null;
    if (dialog.open) dialog.close();
    dialog.remove();
    document.body.style.overflow = settingsPreviousOverflow;
    const focus = settingsFocus?.isConnected ? settingsFocus : document.getElementById("plinko-trigger");
    focus?.focus();
    settingsFocus = null;
  }

  // ═══════════════════════════════════════════════════════════════
  //  MODAL OPENERS
  // ═══════════════════════════════════════════════════════════════

  function openPlinko() {
    injectStyles();
    PopupModal.display({
      title: "Plinko Volume",
      content: React.createElement(PlinkoGame),
      isLarge: true,
    });
  }

  function openSettings() {
    injectStyles();
    if (settingsDialog) {
      settingsDialog.querySelector("input")?.focus();
      return;
    }
    settingsFocus = document.activeElement;
    if (document.querySelector(".plinko-container")) PopupModal.hide();
    const dialog = document.createElement("dialog");
    dialog.id = "plinko-volume-settings";
    dialog.className = "pv-settings-dialog";
    dialog.setAttribute("aria-labelledby", "pv-settings-title");
    const host = document.createElement("div");
    dialog.appendChild(host);
    document.body.appendChild(dialog);
    settingsDialog = dialog;
    settingsPreviousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      closeSettings();
    });
    dialog.addEventListener("close", () => {
      if (settingsDialog === dialog) closeSettings();
    });
    dialog.addEventListener("click", (event) => {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeSettings();
    });
    settingsRoot = ReactDOM.createRoot(host);
    settingsRoot.render(React.createElement(SettingsModal));
    dialog.showModal();
  }

  // ═══════════════════════════════════════════════════════════════
  //  VOLUME BAR REPLACEMENT
  // ═══════════════════════════════════════════════════════════════

  let observerRef = null;
  let triggerButton = null;
  let triggerPercent = null;
  let volumeUnsubscribe = null;
  let volumePollTimer = null;
  let triggerRetryTimer = null;
  let triggerRetryCount = 0;
  const MAX_TRIGGER_RETRIES = 20;

  function updateTriggerVolume(volume = Player.getVolume?.()) {
    if (!triggerPercent?.isConnected) return;
    const percentage = Number.isFinite(volume) ? Math.round(clamp(volume, 0, 1) * 100) : null;
    const text = percentage === null ? "--%" : `${percentage}%`;
    if (triggerPercent.textContent === text) return;
    triggerPercent.textContent = text;
    triggerButton.title = `Plinko Volume · ${text}`;
    triggerButton.setAttribute("aria-label", `Plinko Volume, current volume ${text}. Click to gamble your volume.`);
  }

  function handleVolumeChange(event) {
    updateTriggerVolume(event?.data?.volume);
  }

  function startVolumeUpdates() {
    if (volumeUnsubscribe || volumePollTimer !== null) return;
    const events = Spicetify.Platform.PlaybackAPI?.getEvents?.();
    if (events?.addListener && events?.removeListener) {
      events.addListener("volume", handleVolumeChange);
      volumeUnsubscribe = () => events.removeListener("volume", handleVolumeChange);
    } else {
      // Compatibility fallback; only change the DOM when the integer changes.
      volumePollTimer = setInterval(() => updateTriggerVolume(), 1000);
    }
  }

  function stopVolumeUpdates() {
    volumeUnsubscribe?.();
    volumeUnsubscribe = null;
    if (volumePollTimer !== null) {
      clearInterval(volumePollTimer);
      volumePollTimer = null;
    }
  }

  function cancelTriggerRetry() {
    if (triggerRetryTimer !== null) {
      clearTimeout(triggerRetryTimer);
      triggerRetryTimer = null;
    }
  }

  function applyEnabledState() {
    settings = loadSettings();
    cancelTriggerRetry();

    if (settings.enabled) {
      triggerRetryCount = 0;
      injectTriggerButton();
      startObserver();
      startVolumeUpdates();
    } else {
      document.body.classList.remove("plinko-volume-active");
      stopVolumeUpdates();
      removeTriggerButton();
      stopObserver();
    }
  }

  function startObserver() {
    if (observerRef) return;

    observerRef = new MutationObserver(() => {
      if (settings.enabled && !triggerButton?.isConnected) {
        document.body.classList.remove("plinko-volume-active");
        if (triggerRetryTimer === null) {
          triggerRetryCount = 0;
          injectTriggerButton();
        }
      }
    });

    // Spotify can replace the entire player bar; observe its stable ancestor.
    observerRef.observe(document.body, { childList: true, subtree: true });
  }

  function stopObserver() {
    cancelTriggerRetry();
    if (observerRef) {
      observerRef.disconnect();
      observerRef = null;
    }
  }

  function injectTriggerButton() {
    if (!settings.enabled) return;
    triggerButton = document.getElementById("plinko-trigger");
    if (triggerButton) {
      cancelTriggerRetry();
      document.body.classList.add("plinko-volume-active");
      return;
    }

    const volumeBar = document.querySelector('[data-testid="volume-bar"], .volume-bar, .main-nowPlayingBar-volumeBar');

    const parent = volumeBar?.parentElement || document.querySelector(".main-nowPlayingBar-right, .player-controls__right");

    if (!parent) {
      document.body.classList.remove("plinko-volume-active");
      triggerRetryCount++;
      if (triggerRetryCount < MAX_TRIGGER_RETRIES && triggerRetryTimer === null) {
        triggerRetryTimer = setTimeout(() => {
          triggerRetryTimer = null;
          injectTriggerButton();
        }, 500);
      }
      return;
    }

    cancelTriggerRetry();
    const btn = document.createElement("button");
    btn.id = "plinko-trigger";
    btn.className = "plinko-trigger-btn";
    btn.setAttribute("aria-label", "Plinko Volume; Click to gamble your volume");
    btn.title = "Plinko Volume; Click to gamble!";

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "20");
    svg.setAttribute("height", "20");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "currentColor");
    svg.setAttribute("aria-hidden", "true");

    const circles = [
      { cx: 12, cy: 4, r: 2.5, opacity: 1 },
      { cx: 7, cy: 9, r: 1.8, opacity: 0.6 },
      { cx: 17, cy: 9, r: 1.8, opacity: 0.6 },
      { cx: 4, cy: 14, r: 1.8, opacity: 0.6 },
      { cx: 12, cy: 14, r: 1.8, opacity: 0.6 },
      { cx: 20, cy: 14, r: 1.8, opacity: 0.6 },
    ];

    for (const c of circles) {
      const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      circle.setAttribute("cx", String(c.cx));
      circle.setAttribute("cy", String(c.cy));
      circle.setAttribute("r", String(c.r));
      if (c.opacity !== 1) circle.setAttribute("opacity", String(c.opacity));
      svg.appendChild(circle);
    }

    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("x", "1");
    rect.setAttribute("y", "20");
    rect.setAttribute("width", "22");
    rect.setAttribute("height", "2");
    rect.setAttribute("rx", "1");
    rect.setAttribute("opacity", "0.3");
    svg.appendChild(rect);

    btn.appendChild(svg);
    const percent = document.createElement("span");
    percent.className = "plinko-trigger-percent";
    percent.setAttribute("aria-hidden", "true");
    btn.appendChild(percent);
    btn.addEventListener("click", openPlinko);

    if (volumeBar) {
      volumeBar.parentElement.insertBefore(btn, volumeBar);
    } else {
      parent.appendChild(btn);
    }
    triggerButton = btn;
    triggerPercent = percent;
    updateTriggerVolume();
    document.body.classList.add("plinko-volume-active");
  }

  function removeTriggerButton() {
    const btn = document.getElementById("plinko-trigger");
    if (btn) btn.remove();
    triggerButton = null;
    triggerPercent = null;
  }

  // ═══════════════════════════════════════════════════════════════
  //  PROFILE MENU
  // ═══════════════════════════════════════════════════════════════

  new Menu.Item("Plinko Volume Settings", false, openSettings).register();

  // ═══════════════════════════════════════════════════════════════
  //  INIT
  // ═══════════════════════════════════════════════════════════════

  console.log("[PlinkoVolume] Loaded");
  injectStyles();
  applyEnabledState();
})();
