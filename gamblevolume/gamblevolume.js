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
    showPercentages: true,
    autoClose: false,
    ballColor: "#1db954",
    pegColor: "#ffffff",
    backgroundColor: "#121212",
  };

  const SETTINGS_LIMITS = {
    rows: { min: 4, max: 14 },
    ballSpeed: { min: 1, max: 5 },
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

    .plinko-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      padding: 8px 0;
      user-select: none;
    }

    .plinko-canvas-wrap {
      position: relative;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4);
    }

    .plinko-canvas {
      display: block;
      cursor: pointer;
    }

    .plinko-info {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      padding: 0 4px;
    }

    .plinko-volume-display {
      font-size: 28px;
      font-weight: 800;
      color: var(--spice-text, #fff);
      font-family: var(--font-family, CircularSp, sans-serif);
      min-width: 80px;
      text-align: center;
    }

    .plinko-hint {
      font-size: 12px;
      color: var(--spice-subtext, #b3b3b3);
      text-align: center;
      opacity: 0.7;
    }

    .plinko-drop-btn {
      background: var(--spice-button, #1db954);
      color: #000;
      border: none;
      border-radius: 24px;
      padding: 12px 32px;
      font-size: 16px;
      font-weight: 700;
      cursor: pointer;
      transition: transform 0.1s, opacity 0.2s;
      font-family: var(--font-family, CircularSp, sans-serif);
    }

    .plinko-drop-btn:hover {
      transform: scale(1.05);
      opacity: 0.9;
    }

    .plinko-drop-btn:active {
      transform: scale(0.97);
    }

    .plinko-drop-btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
      transform: none;
    }

    .plinko-btn-row {
      display: flex;
      gap: 8px;
      align-items: center;
    }

    .plinko-skip-btn {
      background: transparent;
      color: var(--spice-subtext, #b3b3b3);
      border: 1px solid var(--spice-shadow, #444);
      border-radius: 24px;
      padding: 12px 20px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: transform 0.1s, color 0.2s;
      font-family: var(--font-family, CircularSp, sans-serif);
    }

    .plinko-skip-btn:hover {
      color: var(--spice-text, #fff);
      transform: scale(1.05);
    }

    .pv-settings {
      display: flex;
      flex-direction: column;
      gap: 16px;
      padding: 8px 0;
      font-family: var(--font-family, CircularSp, sans-serif);
    }
    .pv-settings-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .pv-settings-label {
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--spice-subtext, #b3b3b3);
    }
    .pv-settings-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    .pv-settings-row-label {
      font-size: 14px;
      color: var(--spice-text, #fff);
    }
    .pv-settings-input {
      background: var(--spice-card, #282828);
      border: 1px solid var(--spice-shadow, #444);
      border-radius: 6px;
      color: var(--spice-text, #fff);
      padding: 6px 10px;
      font-size: 14px;
      outline: none;
      width: 70px;
      text-align: center;
    }
    .pv-settings-input:focus {
      border-color: var(--spice-button, #1db954);
    }
    .pv-settings-color {
      width: 40px;
      height: 30px;
      border: 2px solid var(--spice-shadow, #444);
      border-radius: 6px;
      cursor: pointer;
      padding: 0;
      background: none;
    }
    .pv-toggle {
      position: relative;
      width: 40px;
      height: 22px;
      flex-shrink: 0;
    }
    .pv-toggle input {
      opacity: 0;
      width: 0;
      height: 0;
    }
    .pv-toggle-slider {
      position: absolute;
      cursor: pointer;
      top: 0; left: 0; right: 0; bottom: 0;
      background: var(--spice-shadow, #444);
      border-radius: 22px;
      transition: background 0.2s;
    }
    .pv-toggle-slider:before {
      content: "";
      position: absolute;
      height: 16px;
      width: 16px;
      left: 3px;
      bottom: 3px;
      background: white;
      border-radius: 50%;
      transition: transform 0.2s;
    }
    .pv-toggle input:checked + .pv-toggle-slider {
      background: var(--spice-button, #1db954);
    }
    .pv-toggle input:checked + .pv-toggle-slider:before {
      transform: translateX(18px);
    }
    .pv-settings-divider {
      height: 1px;
      background: var(--spice-shadow, #333);
      margin: 4px 0;
    }
    .pv-settings-btn {
      background: var(--spice-button, #1db954);
      color: #000;
      border: none;
      border-radius: 20px;
      padding: 10px 24px;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      transition: transform 0.1s, opacity 0.2s;
      align-self: center;
    }
    .pv-settings-btn:hover {
      transform: scale(1.04);
      opacity: 0.9;
    }
    .pv-settings-btn-secondary {
      background: transparent;
      color: var(--spice-text, #fff);
      border: 1px solid var(--spice-shadow, #444);
    }
    .pv-settings-btn-row {
      display: flex;
      gap: 8px;
      justify-content: center;
      margin-top: 8px;
    }
    .pv-settings-status {
      font-size: 12px;
      text-align: center;
      color: var(--spice-button, #1db954);
      min-height: 18px;
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
  //  PLINKO PHYSICS ENGINE
  // ═══════════════════════════════════════════════════════════════

  function createPlinkoEngine(config) {
    const { width, height, rows, pegRadius, ballRadius, gravity, damping, ballSpeedMultiplier } = config;

    const slots = rows + 1;
    const pegSpacingX = width / (rows + 2);
    const pegSpacingY = (height - 80) / (rows + 1);
    const startY = 30;
    // Preserve clearance between adjacent pegs at the highest row counts.
    const effectiveBallRadius = Math.min(ballRadius, (pegSpacingX - pegRadius * 2) / 2 - 1);

    const pegs = [];
    for (let row = 0; row < rows; row++) {
      const pegsInRow = row + 2;
      const rowWidth = (pegsInRow - 1) * pegSpacingX;
      const startX = (width - rowWidth) / 2;

      for (let col = 0; col < pegsInRow; col++) {
        pegs.push({
          x: startX + col * pegSpacingX,
          y: startY + (row + 1) * pegSpacingY,
          radius: pegRadius,
        });
      }
    }

    const slotWidth = width / slots;
    const slotBoundaries = [];
    for (let i = 0; i <= slots; i++) {
      slotBoundaries.push(i * slotWidth);
    }

    const slotValues = [];
    for (let i = 0; i < slots; i++) {
      slotValues.push(Math.round((i / (slots - 1)) * 100));
    }

    function createBall(dropX) {
      return {
        x: dropX ?? width / 2 + (Math.random() - 0.5) * 20,
        y: 10,
        vx: 0,
        vy: 0,
        radius: effectiveBallRadius,
        active: true,
        landed: false,
        landedSlot: -1,
        bounceCount: 0,
      };
    }

    function stepBall(ball, dt) {
      if (!ball.active) return;

      const scaledDt = dt * ballSpeedMultiplier;

      ball.vy += gravity * scaledDt;

      const friction = 0.999;
      ball.vx *= friction;
      ball.vy *= friction;

      ball.x += ball.vx * scaledDt;
      ball.y += ball.vy * scaledDt;

      for (const peg of pegs) {
        const dx = ball.x - peg.x;
        const dy = ball.y - peg.y;
        const distSq = dx * dx + dy * dy;
        const minDist = ball.radius + peg.radius;

        if (distSq >= minDist * minDist || distSq === 0) continue;

        const dist = Math.sqrt(distSq);
        const nx = dx / dist;
        const ny = dy / dist;

        ball.x = peg.x + nx * (minDist + 0.1);
        ball.y = peg.y + ny * (minDist + 0.1);

        const velDotN = ball.vx * nx + ball.vy * ny;

        if (velDotN >= 0) continue;

        const tx = -ny;
        const ty = nx;
        const velDotT = ball.vx * tx + ball.vy * ty;

        const restitution = 0.3;

        const tangentFriction = 0.95;

        const newVn = -velDotN * restitution;
        const newVt = velDotT * tangentFriction;

        ball.vx = nx * newVn + tx * newVt;
        ball.vy = ny * newVn + ty * newVt;

        const incomingSpeed = Math.abs(velDotN);
        const nudge = Math.max(8, incomingSpeed * 0.15);
        ball.vx += (Math.random() - 0.5) * nudge;

        ball.bounceCount++;
      }

      if (ball.x - ball.radius < 0) {
        ball.x = ball.radius + 0.1;
        ball.vx = Math.abs(ball.vx) * 0.3;
      }
      if (ball.x + ball.radius > width) {
        ball.x = width - ball.radius - 0.1;
        ball.vx = -Math.abs(ball.vx) * 0.3;
      }

      if (ball.y + ball.radius >= height - 20) {
        ball.y = height - 20 - ball.radius;
        ball.vy = 0;
        ball.vx = 0;
        ball.active = false;
        ball.landed = true;
        ball.landedSlot = findNearestSlot(ball.x);
      }
    }

    function findNearestSlot(x) {
      const clampedX = Math.max(0, Math.min(width, x));
      for (let i = 0; i < slots; i++) {
        if (clampedX >= slotBoundaries[i] && clampedX < slotBoundaries[i + 1]) {
          return i;
        }
      }
      return slots - 1;
    }

    function simulate(ball) {
      const simDt = 1 / 60;
      const maxSteps = 10000;
      for (let i = 0; i < maxSteps && ball.active; i++) {
        stepBall(ball, simDt);
      }
      if (!ball.landed) {
        ball.active = false;
        ball.landed = true;
        ball.landedSlot = findNearestSlot(ball.x);
      }
    }

    return {
      pegs,
      slots,
      slotWidth,
      slotBoundaries,
      slotValues,
      createBall,
      stepBall,
      simulate,
      width,
      height,
    };
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
    const CANVAS_HEIGHT = 420;

    if (!engineRef.current) {
      engineRef.current = createPlinkoEngine({
        width: CANVAS_WIDTH,
        height: CANVAS_HEIGHT,
        rows: settings.rows,
        pegRadius: 5,
        ballRadius: 8,
        gravity: 600,
        damping: 0.6,
        ballSpeedMultiplier: settings.ballSpeed,
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
        ctx.moveTo(x, CANVAS_HEIGHT - 40);
        ctx.lineTo(x, CANVAS_HEIGHT);
        ctx.stroke();
      }

      if (settings.showPercentages) {
        ctx.font = "bold 10px sans-serif";
        ctx.textAlign = "center";
        for (let i = 0; i < engine.slots; i++) {
          const x = engine.slotBoundaries[i] + engine.slotWidth / 2;
          const vol = engine.slotValues[i];
          const hue = (vol / 100) * 120;
          ctx.fillStyle = `hsl(${hue}, 80%, 55%)`;
          ctx.fillText(`${vol}%`, x, CANVAS_HEIGHT - 5);
        }
      }

      ctx.save();
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = settings.pegColor;
      ctx.beginPath();
      for (const peg of engine.pegs) {
        ctx.moveTo(peg.x + peg.radius, peg.y);
        ctx.arc(peg.x, peg.y, peg.radius, 0, Math.PI * 2);
      }
      ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.globalAlpha = 0.3;
      ctx.beginPath();
      ctx.moveTo(CANVAS_WIDTH / 2 - 15, 5);
      ctx.lineTo(CANVAS_WIDTH / 2, 18);
      ctx.lineTo(CANVAS_WIDTH / 2 + 15, 5);
      ctx.fillStyle = settings.ballColor;
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

    function highlightSlot(slotIndex) {
      const ctx = getCtx();
      const engine = engineRef.current;
      if (!ctx || !engine) return;

      const x = engine.slotBoundaries[slotIndex];
      const w = engine.slotWidth;
      const vol = engine.slotValues[slotIndex];
      const hue = (vol / 100) * 120;

      ctx.fillStyle = `hsla(${hue}, 80%, 55%, 0.25)`;
      ctx.fillRect(x, CANVAS_HEIGHT - 40, w, 40);
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
      highlightSlot(ball.landedSlot);

      setResultVolume(vol);
      setIsDropping(false);
      Player.setVolume?.(vol / 100);
      updateTriggerVolume(vol / 100);
      Spicetify.showNotification(`🎰 Volume set to ${vol}%!`);

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

      const subSteps = 4;
      for (let i = 0; i < subSteps; i++) {
        engine.stepBall(ball, dt / subSteps);
      }

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
        React.createElement("span", { className: "plinko-hint" }, "Current"),
        React.createElement("span", { className: "plinko-volume-display" }, resultVolume !== null ? `${resultVolume}%` : `${currentVolume}%`),
        React.createElement("span", { className: "plinko-hint" }, resultVolume !== null ? "🎰 New!" : "Volume"),
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
      ),

      React.createElement(
        "div",
        { className: "plinko-btn-row" },
        React.createElement(
          "button",
          {
            className: "plinko-drop-btn",
            onClick: dropBall,
            disabled: isDropping,
          },
          isDropping ? "Dropping..." : "🎲 Drop Ball",
        ),
        isDropping
          ? React.createElement(
              "button",
              {
                className: "plinko-skip-btn",
                onClick: skipDrop,
              },
              "Skip ⏭",
            )
          : null,
      ),

      React.createElement("span", { className: "plinko-hint" }, "Click the board or button to drop a ball"),
    );
  }

  // ═══════════════════════════════════════════════════════════════
  //  SETTINGS COMPONENT
  // ═══════════════════════════════════════════════════════════════

  function Toggle({ checked, onChange }) {
    return React.createElement(
      "label",
      { className: "pv-toggle" },
      React.createElement("input", {
        type: "checkbox",
        checked,
        onChange: (e) => onChange(e.target.checked),
      }),
      React.createElement("span", { className: "pv-toggle-slider" }),
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
      setState((prev) => {
        let clamped = value;
        if (SETTINGS_LIMITS[key]) {
          clamped = clamp(value, SETTINGS_LIMITS[key].min, SETTINGS_LIMITS[key].max);
        }
        return { ...prev, [key]: clamped };
      });
    }

    function handleSave() {
      saveAllSettings(state);
      settings = { ...state };
      applyEnabledState();
      setStatus("Settings saved!");
      cancelClose();
      closeTimerRef.current = setTimeout(() => {
        closeTimerRef.current = null;
        PopupModal.hide();
      }, 800);
    }

    function handleReset() {
      cancelClose();
      const reset = { ...DEFAULT_SETTINGS };
      setState(reset);
      saveAllSettings(reset);
      settings = { ...reset };
      applyEnabledState();
      setStatus("Reset to defaults");
    }

    return React.createElement(
      "div",
      { className: "pv-settings" },

      React.createElement(
        "div",
        { className: "pv-settings-group" },
        React.createElement("span", { className: "pv-settings-label" }, "Extension"),
        React.createElement(
          "div",
          { className: "pv-settings-row" },
          React.createElement("span", { className: "pv-settings-row-label" }, "Enable Plinko Volume (hides normal controls)"),
          React.createElement(Toggle, {
            checked: state.enabled,
            onChange: (v) => update("enabled", v),
          }),
        ),
      ),

      React.createElement("div", { className: "pv-settings-divider" }),

      React.createElement(
        "div",
        { className: "pv-settings-group" },
        React.createElement("span", { className: "pv-settings-label" }, "Game"),
        React.createElement(
          "div",
          { className: "pv-settings-row" },
          React.createElement("span", { className: "pv-settings-row-label" }, `Peg Rows (${SETTINGS_LIMITS.rows.min}–${SETTINGS_LIMITS.rows.max})`),
          React.createElement("input", {
            className: "pv-settings-input",
            type: "number",
            min: SETTINGS_LIMITS.rows.min,
            max: SETTINGS_LIMITS.rows.max,
            value: state.rows,
            onChange: (e) => update("rows", parseInt(e.target.value, 10) || DEFAULT_SETTINGS.rows),
          }),
        ),
        React.createElement(
          "div",
          { className: "pv-settings-row" },
          React.createElement("span", { className: "pv-settings-row-label" }, `Ball Speed (${SETTINGS_LIMITS.ballSpeed.min}–${SETTINGS_LIMITS.ballSpeed.max})`),
          React.createElement("input", {
            className: "pv-settings-input",
            type: "number",
            min: SETTINGS_LIMITS.ballSpeed.min,
            max: SETTINGS_LIMITS.ballSpeed.max,
            value: state.ballSpeed,
            onChange: (e) => update("ballSpeed", parseInt(e.target.value, 10) || DEFAULT_SETTINGS.ballSpeed),
          }),
        ),
        React.createElement(
          "div",
          { className: "pv-settings-row" },
          React.createElement("span", { className: "pv-settings-row-label" }, "Show slot percentages"),
          React.createElement(Toggle, {
            checked: state.showPercentages,
            onChange: (v) => update("showPercentages", v),
          }),
        ),
        React.createElement(
          "div",
          { className: "pv-settings-row" },
          React.createElement("span", { className: "pv-settings-row-label" }, "Auto-close after drop"),
          React.createElement(Toggle, {
            checked: state.autoClose,
            onChange: (v) => update("autoClose", v),
          }),
        ),
      ),

      React.createElement("div", { className: "pv-settings-divider" }),

      React.createElement(
        "div",
        { className: "pv-settings-group" },
        React.createElement("span", { className: "pv-settings-label" }, "Colors"),
        React.createElement(
          "div",
          { className: "pv-settings-row" },
          React.createElement("span", { className: "pv-settings-row-label" }, "Ball"),
          React.createElement("input", {
            className: "pv-settings-color",
            type: "color",
            value: state.ballColor,
            onChange: (e) => update("ballColor", e.target.value),
          }),
        ),
        React.createElement(
          "div",
          { className: "pv-settings-row" },
          React.createElement("span", { className: "pv-settings-row-label" }, "Pegs"),
          React.createElement("input", {
            className: "pv-settings-color",
            type: "color",
            value: state.pegColor,
            onChange: (e) => update("pegColor", e.target.value),
          }),
        ),
        React.createElement(
          "div",
          { className: "pv-settings-row" },
          React.createElement("span", { className: "pv-settings-row-label" }, "Background"),
          React.createElement("input", {
            className: "pv-settings-color",
            type: "color",
            value: state.backgroundColor,
            onChange: (e) => update("backgroundColor", e.target.value),
          }),
        ),
      ),

      React.createElement("span", { className: "pv-settings-status" }, status),

      React.createElement(
        "div",
        { className: "pv-settings-btn-row" },
        React.createElement(
          "button",
          {
            className: "pv-settings-btn pv-settings-btn-secondary",
            onClick: handleReset,
          },
          "Reset",
        ),
        React.createElement(
          "button",
          {
            className: "pv-settings-btn",
            onClick: handleSave,
          },
          "Save",
        ),
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════
  //  MODAL OPENERS
  // ═══════════════════════════════════════════════════════════════

  function openPlinko() {
    injectStyles();
    PopupModal.display({
      title: "🎰 Plinko Volume",
      content: React.createElement(PlinkoGame),
      isLarge: true,
    });
  }

  function openSettings() {
    injectStyles();
    PopupModal.display({
      title: "Plinko Volume — Settings",
      content: React.createElement(SettingsModal),
      isLarge: true,
    });
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
