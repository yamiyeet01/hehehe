/* Valentine Wordle Experience
   - Email gate (server-side session storage)
   - Wordle-like play
   - Give-up reveal into proposal YES/NO
   - Celebration + acceptance flow + email trigger
*/

const EMAILJS_CONFIG = {
  enabled: true, 
  publicKey: "7IgPP7RHaPYy3D6A9", 
  serviceId: "service_j5ogud7", 
  templateId: "template_ppn5zb7",
};

const appEl = document.getElementById("app");
const fxCanvas = document.getElementById("fxCanvas");
const fx = createFx(fxCanvas);

const WORDLE_TARGET = "WILL";
const MAX_TRIES = 6;

const UI = {
  currentScreen: null,
  email: null,

  // Wordle state
  wordLen: WORDLE_TARGET.length,
  guesses: Array.from({ length: MAX_TRIES }, () => ""),
  evaluations: Array.from({ length: MAX_TRIES }, () => null),
  row: 0,
  col: 0,
  status: "wordle", 
  message: "",

  // Proposal stage
  proposalInput: "",
  noCount: 0,
  proposalQuestion: "Will you be my Valentine?",
};

init();

function init() {
  fitCanvas();
  window.addEventListener("resize", fitCanvas);
  renderEmailGate();
  window.addEventListener("keydown", onPhysicalKeyDown);
}

function fitCanvas() {
  const dpr = window.devicePixelRatio || 1;
  fxCanvas.width = Math.floor(window.innerWidth * dpr);
  fxCanvas.height = Math.floor(window.innerHeight * dpr);
  fx.setDpr(dpr);
}

function setScreen(node) {
  appEl.innerHTML = "";
  node.classList.add("fade-in");
  appEl.appendChild(node);
  UI.currentScreen = node;
}

function renderEmailGate() {
  document.body.classList.remove("soft-red");
  UI.status = "email";
  UI.message = "";

  const outer = document.createElement("section");
  outer.className = "email-screen";

  const wrap = document.createElement("div");
  wrap.className = "screen compact";

  const heading = document.createElement("div");
  heading.className = "email-heading";

  const title = document.createElement("div");
  title.className = "email-title";
  title.textContent = "Wordle for you";

  const subtitle = document.createElement("div");
  subtitle.className = "email-subtitle";
  subtitle.textContent = "Enter your valid email address to begin";

  heading.appendChild(title);
  heading.appendChild(subtitle);
  outer.appendChild(heading);
  outer.appendChild(wrap);

  const gate = document.createElement("form");
  gate.className = "email-gate";
  gate.autocomplete = "off";
  gate.noValidate = true;

  const input = document.createElement("input");
  input.className = "email-input";
  input.type = "email";
  input.inputMode = "email";
  input.name = "email";
  input.placeholder = "Enter your email";
  input.required = true;
  input.autocomplete = "email";
  input.spellcheck = false;

  const btn = document.createElement("button");
  btn.className = "btn";
  btn.type = "submit";
  btn.textContent = "Enter";

  const error = document.createElement("div");
  error.className = "error";
  error.style.display = "none";

  gate.appendChild(input);
  gate.appendChild(btn);
  wrap.appendChild(gate);
  wrap.appendChild(error);

  gate.addEventListener("submit", async (e) => {
    e.preventDefault();
    error.style.display = "none";
    const email = (input.value || "").trim();

    if (!isValidEmail(email)) {
      error.textContent = "Please enter a valid email address.";
      error.style.display = "block";
      return;
    }

    btn.disabled = true;
    btn.textContent = "One moment…";

    try {
      UI.email = email;
      sessionStorage.setItem("valentine_email", email);
      smoothToWordle();
    } 
    catch (err) {
      error.textContent =
        "Couldn’t save your email right now. Please try again.";
      error.style.display = "block";
      btn.disabled = false;
      btn.textContent = "Enter";
    }
  });

  setScreen(outer);
  setTimeout(() => input.focus(), 50);
}

function smoothToWordle() {
  resetWordle();
  renderWordle();
}

function resetWordle() {
  UI.wordLen = WORDLE_TARGET.length;
  UI.guesses = Array.from({ length: MAX_TRIES }, () => "");
  UI.evaluations = Array.from({ length: MAX_TRIES }, () => null);
  UI.row = 0;
  UI.col = 0;
  UI.status = "wordle";
  UI.message = "";
  UI.proposalInput = "";
  UI.noCount = 0;
  document.body.classList.remove("soft-red");
  fx.stop();
}

function renderWordle(extraBelowBoard = null) {
  const wrap = document.createElement("section");
  wrap.className = "screen";

  const top = document.createElement("div");
  top.className = "topline";
  top.textContent = "A little game, just for you.";
  wrap.appendChild(top);

  const board = renderBoard(UI.guesses, UI.evaluations, UI.wordLen);
  wrap.appendChild(board);

  if (extraBelowBoard) wrap.appendChild(extraBelowBoard);

  const msg = document.createElement("div");
  msg.className = "message";
  msg.textContent = UI.message || "";
  wrap.appendChild(msg);

  const keyboard = renderKeyboard({
    mode: "wordle",
    allowLetters: null,
    letterStatus: computeKeyboardStatus(UI.evaluations, UI.guesses),
  });
  wrap.appendChild(keyboard);

  setScreen(wrap);
}

function renderFailureButtons() {
  const below = document.createElement("div");
  below.className = "below-board";

  const tryAgain = document.createElement("button");
  tryAgain.className = "btn";
  tryAgain.textContent = "Try Again";
  tryAgain.addEventListener("click", () => {
    resetWordle();
    renderWordle();
  });

  const giveUp = document.createElement("button");
  giveUp.className = "btn secondary";
  giveUp.textContent = "Give Up";
  giveUp.addEventListener("click", () => onGiveUp());

  below.appendChild(tryAgain);
  below.appendChild(giveUp);
  return below;
}

function onGiveUp() {
  document.body.classList.add("soft-red");

  const prevStatus = UI.status;
  UI.status = "giveup";

  const current = UI.currentScreen;
  const board = current ? current.querySelector(".board") : null;

  // If we somehow don't have a board (safety), just go straight to the proposal screen.
  if (!board || (prevStatus !== "wordle" && prevStatus !== "failed")) {
    renderProposalScreen();
    return;
  }

  // Drop / fade out each existing tile with a small stagger.
  const tiles = Array.from(board.querySelectorAll(".tile"));
  tiles.forEach((tile, i) => {
    tile.classList.add("tile-leave");
    tile.style.animationDelay = `${i * 40}ms`;
  });

  const totalDuration = tiles.length * 40 + 650; // ms
  setTimeout(() => {
    renderProposalScreen();
  }, totalDuration);
}

function renderProposalScreen() {
  // Reveal full hidden message: “WILL YOU BE MY VALENTINE”
  const phrase = "WILL YOU BE MY VALENTINE";

  const wrap = document.createElement("section");
  wrap.className = "screen proposal-screen";

  const top = document.createElement("div");
  top.className = "prompt";
  top.textContent = "Now, Try this easiest one hehe";
  wrap.appendChild(top);

  const board = document.createElement("div");
  board.className = "board phrase-board";

  // Layout:
  const layout = [
    ["WILL", "YOU"],
    ["BE", "MY"],
    ["VALENTINE"],
  ];

  for (const line of layout) {
    const row = document.createElement("div");
    row.className = "row";
    board.appendChild(row);

    line.forEach((word, wIdx) => {
      for (const ch of word) {
        const t = document.createElement("div");
        t.className = "tile filled";
        t.textContent = ch;
        row.appendChild(t);
      }
      if (wIdx < line.length - 1) {
        const spacer = document.createElement("div");
        spacer.className = "word-gap";
        spacer.style.pointerEvents = "none";
        row.appendChild(spacer);
      }
    });
  }

  wrap.appendChild(board);

  // Gentle hint message below the phrase tiles
  const hint = document.createElement("div");
  hint.className = "message";
  hint.textContent = "Hint: The answer is already there.";
  wrap.appendChild(hint);

  // Fade the Valentine tiles in with a gentle cascade.
  const valTiles = Array.from(board.querySelectorAll(".tile"));
  valTiles.forEach((tile, i) => {
    tile.classList.add("tile-enter");
    tile.style.animationDelay = `${i * 40}ms`;
  });

  const spacer = document.createElement("div");
  spacer.style.height = "10px";
  wrap.appendChild(spacer);

  // Transition board into 3 tiles only (YES/NO stage uses 3)
  const three = document.createElement("div");
  three.className = "board answer-board";
  const r = document.createElement("div");
  r.className = "row";
  three.appendChild(r);
  for (let i = 0; i < 3; i++) {
    const t = document.createElement("div");
    t.className = "tile";
    t.textContent = "";
    r.appendChild(t);
  }
  wrap.appendChild(three);

  const msg = document.createElement("div");
  msg.className = "message";
  msg.textContent = "";
  wrap.appendChild(msg);

  const keyboard = renderKeyboard({
    mode: "proposal",
    allowLetters: null,
    letterStatus: null,
  });
  wrap.appendChild(keyboard);

  UI.status = "proposal";
  UI.message = "";
  UI.proposalInput = "";

  setScreen(wrap);
  updateProposalTiles();
  updateProposalMessage();
}

function updateProposalTiles() {
  const tiles = UI.currentScreen.querySelectorAll(
    ".board.answer-board .row .tile"
  );
  const text = UI.proposalInput.toUpperCase().slice(0, 3);
  for (let i = 0; i < 3; i++) {
    const ch = text[i] || "";
    tiles[i].textContent = ch;
    tiles[i].classList.toggle("filled", Boolean(ch));
    tiles[i].classList.remove("green", "yellow", "grey");
  }
}

function updateProposalMessage() {
  const msg = UI.currentScreen.querySelector(".message");
  msg.textContent = UI.message || "";
}

function onProposalEnter() {
  const ans = UI.proposalInput.toUpperCase();
  if (ans === "YES") {
    onAccepted();
    return;
  }
  if (ans === "NO") {
    UI.noCount += 1;
    if (UI.noCount === 1) UI.message = "Please?";
    else if (UI.noCount === 2) UI.message = "Pretty girl, please??!";
    else UI.message = "I’ll cry. I know this is too basic for you :'<";
    UI.proposalInput = "";
    updateProposalTiles();
    updateProposalMessage();
    return;
  }

  // Exact match only: anything else is gently ignored
  UI.message = "Hint: The answer is already there :>";
  UI.proposalInput = "";
  updateProposalTiles();
  updateProposalMessage();
}

function onAccepted() {
  UI.status = "accepted";
  UI.message = "";

  fx.startCelebration();

  const wrap = document.createElement("section");
  wrap.className = "screen";

  const big = document.createElement("div");
  big.className = "big";
  big.textContent = "Thank you for accepting me!";
  wrap.appendChild(big);

  const preparing = document.createElement("div");
  preparing.className = "message";
  preparing.style.fontSize = "15px";
  preparing.style.marginTop = "10px";
  preparing.textContent = "Preparing Something Special…";
  wrap.appendChild(preparing);

  const loader = document.createElement("div");
  loader.className = "loader";
  wrap.appendChild(loader);

  setScreen(wrap);

  setTimeout(async () => {
    loader.remove();
    preparing.textContent = "It was my pleasure having you as my Valentine date.";

    const noteWrap = document.createElement("div");
    noteWrap.style.textAlign = "center";
    noteWrap.style.marginTop = "14px";

    const note = document.createElement("div");
    note.className = "highlight";
    note.textContent = "Check your email for something special";
    noteWrap.appendChild(note);
    wrap.appendChild(noteWrap);

    // Trigger email after the message appears
    setTimeout(async () => {
      try {
        await sendInviteEmailStatic();
      } 
      catch (e) {
        const subtle = document.createElement("div");
        subtle.className = "message";
        subtle.style.marginTop = "10px";
        if (String(e && e.message).includes("emailjs_not_configured")) {
          subtle.textContent =
            "Email sending isn’t configured yet for this site. (You can still set up EmailJS to deliver the invitation automatically.)";
        } 
        else {
          subtle.textContent =
            "If you don’t see it yet, please check Spam/Promotions (or try again later).";
        }
        wrap.appendChild(subtle);
      }
    }, 450);
  }, 2200);
}

function renderBoard(guesses, evaluations, wordLen) {
  const board = document.createElement("div");
  board.className = "board";

  for (let r = 0; r < guesses.length; r++) {
    const rowEl = document.createElement("div");
    rowEl.className = "row";

    const g = guesses[r] || "";
    const evalRow = evaluations[r];

    for (let c = 0; c < wordLen; c++) {
      const t = document.createElement("div");
      t.className = "tile";
      const ch = (g[c] || "").toUpperCase();
      t.textContent = ch;
      if (ch) t.classList.add("filled");
      if (evalRow && evalRow[c]) t.classList.add(evalRow[c]);
      rowEl.appendChild(t);
    }
    board.appendChild(rowEl);
  }
  return board;
}

function renderKeyboard({ mode, allowLetters, letterStatus }) {
  const kb = document.createElement("div");
  kb.className = "keyboard";
  const rows = [
    ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
    ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
    ["ENTER", "Z", "X", "C", "V", "B", "N", "M", "BACKSPACE"],
  ];

  const highlightOnly = mode === "proposal";
  const highlights = new Set(["Y", "E", "S"]);

  for (const row of rows) {
    const r = document.createElement("div");
    r.className = "kb-row";
    for (const label of row) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "key";
      btn.textContent = label === "BACKSPACE" ? "⌫" : label;
      if (label === "ENTER" || label === "BACKSPACE") btn.classList.add("wide");

      if (mode === "wordle" && letterStatus && /^[A-Z]$/.test(label)) {
        const st = letterStatus[label];
        if (st) btn.classList.add(st);
      }

      if (allowLetters) {
        const enabled = allowLetters.has(label);
        if (!enabled) btn.classList.add("disabled");
      }

      if (highlightOnly && /^[A-Z]$/.test(label)) {
        if (highlights.has(label)) {
          // Soft yellow hint highlight for the keys Y, E, S (no neon/glow)
          btn.style.background = "rgba(255, 235, 59, 0.22)";
          btn.style.borderColor = "rgba(255, 235, 59, 0.45)";
          btn.style.color = "rgba(255,255,255,.92)";
          btn.style.boxShadow = "none";
        }
      }

      btn.addEventListener("click", () => onVirtualKey(label));
      r.appendChild(btn);
    }
    kb.appendChild(r);
  }
  return kb;
}

function onVirtualKey(label) {
  if (UI.status === "wordle" || UI.status === "failed") {
    if (label === "ENTER") return onEnterGuess();
    if (label === "BACKSPACE") return onBackspace();
    if (/^[A-Z]$/.test(label)) return onTypeLetter(label);
    return;
  }

  if (UI.status === "proposal") {
    if (label === "ENTER") return onProposalEnter();
    if (label === "BACKSPACE") {
      UI.proposalInput = UI.proposalInput.slice(0, -1);
      updateProposalTiles();
      return;
    }
    if (/^[A-Z]$/.test(label)) {
      if (UI.proposalInput.length >= 3) return;
      UI.proposalInput += label;
      updateProposalTiles();
      return;
    }
  }
}

function onPhysicalKeyDown(e) {
  // Keep input feeling native but still driven by the on-screen logic
  if (UI.status === "email") return;
  if (e.key === "Enter") {
    e.preventDefault();
    return onVirtualKey("ENTER");
  }
  if (e.key === "Backspace") {
    e.preventDefault();
    return onVirtualKey("BACKSPACE");
  }
  const k = (e.key || "").toUpperCase();
  if (/^[A-Z]$/.test(k)) {
    e.preventDefault();
    return onVirtualKey(k);
  }
}

function onTypeLetter(letter) {
  if (UI.row >= MAX_TRIES) return;
  if (UI.col >= UI.wordLen) return;
  const g = UI.guesses[UI.row].split("");
  g[UI.col] = letter;
  UI.guesses[UI.row] = g.join("");
  UI.col += 1;
  renderWordle(UI.status === "failed" ? renderFailureButtons() : null);
}

function onBackspace() {
  if (UI.row >= MAX_TRIES) return;
  if (UI.col <= 0) return;
  UI.col -= 1;
  const g = UI.guesses[UI.row].split("");
  g[UI.col] = "";
  UI.guesses[UI.row] = g.join("");
  renderWordle(UI.status === "failed" ? renderFailureButtons() : null);
}

function onEnterGuess() {
  if (UI.row >= MAX_TRIES) return;
  const guess = (UI.guesses[UI.row] || "").toUpperCase();
  if (guess.length !== UI.wordLen) {
    UI.message = "Not enough letters.";
    renderWordle(UI.status === "failed" ? renderFailureButtons() : null);
    return;
  }
  UI.message = "";

  const evalRow = evaluateGuess(guess, WORDLE_TARGET);
  UI.evaluations[UI.row] = evalRow;

  const won = evalRow.every((x) => x === "green");
  if (won) {
    // Winning still proceeds to the same reveal/proposal flow (romantic intent)
    setTimeout(() => onGiveUp(), 420);
    return;
  }

  UI.row += 1;
  UI.col = 0;

  if (UI.row >= MAX_TRIES) {
    UI.status = "failed";
    UI.message = "";
    renderWordle(renderFailureButtons());
    return;
  }

  renderWordle();
}

function evaluateGuess(guess, target) {
  // Wordle-style evaluation with duplicate handling
  const res = Array.from({ length: guess.length }, () => "grey");
  const t = target.split("");
  const used = Array.from({ length: guess.length }, () => false);

  // greens
  for (let i = 0; i < guess.length; i++) {
    if (guess[i] === t[i]) {
      res[i] = "green";
      used[i] = true;
      t[i] = "_";
    }
  }
  // yellows
  for (let i = 0; i < guess.length; i++) {
    if (res[i] === "green") continue;
    const idx = t.indexOf(guess[i]);
    if (idx !== -1) {
      res[i] = "yellow";
      t[idx] = "_";
    }
  }
  return res;
}

function computeKeyboardStatus(evaluations, guesses) {
  const status = {};
  const rank = { grey: 1, yellow: 2, green: 3 };

  for (let r = 0; r < evaluations.length; r++) {
    const e = evaluations[r];
    if (!e) continue;
    const g = (guesses[r] || "").toUpperCase();
    for (let i = 0; i < e.length; i++) {
      const ch = g[i];
      const st = e[i];
      if (!/^[A-Z]$/.test(ch)) continue;
      const prev = status[ch];
      if (!prev || rank[st] > rank[prev]) status[ch] = st;
    }
  }
  return status;
}

function isValidEmail(email) {
  // Simple, strict-ish check: local@domain.tld with no spaces
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

async function sendInviteEmailStatic() {
  const email = UI.email || sessionStorage.getItem("valentine_email") || "";
  if (!isValidEmail(email)) throw new Error("email_missing");

  if (!EMAILJS_CONFIG.enabled) {
    // Static hosting without configuration: we cannot send automatically.
    throw new Error("emailjs_not_configured");
  }
  if (!window.emailjs) throw new Error("emailjs_not_loaded");

  const html = buildInviteHtmlEmail();
  const text = buildInviteTextEmail();

  // EmailJS: ensure your template is set to HTML format and prints `message_html`
  // inside the email body. Many setups can also use a plain text fallback.
  window.emailjs.init({ publicKey: EMAILJS_CONFIG.publicKey });
  const params = {
    to_email: email,
    subject: "A Valentine Invitation Just for You ❤️",
    message_html: html,
    message_text: text,
  };

  const res = await window.emailjs.send(
    EMAILJS_CONFIG.serviceId,
    EMAILJS_CONFIG.templateId,
    params
  );
  if (!res || (res.status && res.status >= 400)) throw new Error("send_failed");
}

function buildInviteTextEmail() {
  return (
    "JEVI and CHANIE’s Invitation Card\n" +
    "A Valentine’s Date Plan Made With Love\n\n" +
    "DATE: February 15, 2026 (Sunday)\n" +
    "Call Time: 9:00 AM\n" +
    "Theme: Korean-inspired outfit, maroon color palette\n\n" +
    "Things to Bring\n" +
    "(Pack before 9:00 AM)\n\n" +
    "Paper plates with spoon & cups\n" +
    "Starbucks Gift Card\n" +
    "Sipa\n" +
    "Uno cards\n" +
    "Picnic blanket\n" +
    "Camera or phone with stand or tripod\n" +
    "Painting materials\n" +
    "Big bag (to carry food and supplies)\n\n" +
    "UP Town Mall Plan\n\n" +
    "Photo booth (Life 4 Cuts or other booths)\n" +
    "Eat lunch (Preferred: Fine Dining Restaurant)\n" +
    "Arcades (just try playing)\n\n" +
    "Foods to Buy:\n\n" +
    "Pizza (at least small)\n" +
    "Potato Corner fries\n" +
    "Fruits\n" +
    "Sandwiches\n" +
    "Chips\n" +
    "Water\n" +
    "Canned soft drinks or juice (or Yakult or Delight)\n" +
    "1.5L Coke (optional)\n" +
    "Starbucks drink\n" +
    "UP Campus Activities\n\n" +
    "Walk around UP\n" +
    "Take scenic photos and videos\n" +
    "Visit the famous UP statue and take pictures or videos\n" +
    "Set up picnic area (picnic date)\n" +
    "Painting date\n" +
    "Play Uno cards\n" +
    "Play Sipa\n\n" +
    "Bonus Plan (Evening)\n\n" +
    "(If kaya pa ng budget)\n\n" +
    "Dinner date inside UP Town Mall\n" +
    "Take photos or videos\n\n" +
    "If hindi na kaya ng budget, then let’s eat low-budget meals before umuwi.\n\n" +
    "“Thank you for being my Valentine.\n" +
    "I can’t wait to spend this day with you.”"
  );
}

function buildInviteHtmlEmail() {
  // Email-safe HTML card (tables + inline styles); no external images needed.
  const bg = "#fff6f8";
  const card = "#ffffff";
  const maroon = "#7a1f33";
  const rose = "#c94d6a";
  const blush = "#ffe1ea";
  const text = "#1f1a1c";
  const muted = "#5b4a4f";

  return `<!doctype html>
<html>
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>JEVI and CHANIE’s Invitation Card</title>
  </head>
  <body style="margin:0;padding:0;background:${bg};">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${bg};padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;width:100%;background:${card};border-radius:18px;overflow:hidden;box-shadow:0 14px 40px rgba(122,31,51,0.14);border:1px solid rgba(122,31,51,0.10);">
            <tr>
              <td style="padding:20px 18px;background:linear-gradient(135deg, ${blush}, #ffffff);">
                <div style="font-family:Arial, Helvetica, sans-serif;color:${maroon};text-align:center;font-weight:700;font-size:22px;line-height:1.25;">JEVI and CHANIE’s Invitation Card</div>
                <div style="font-family:Arial, Helvetica, sans-serif;color:${muted};text-align:center;font-size:14px;line-height:1.35;margin-top:6px;">A Valentine’s Date Plan Made With Love</div>
                <div style="text-align:center;margin-top:12px;">
                  <span style="display:inline-block;background:rgba(201,77,106,0.10);border:1px solid rgba(201,77,106,0.20);color:${rose};padding:8px 12px;border-radius:999px;font-family:Arial, Helvetica, sans-serif;font-size:12px;letter-spacing:0.4px;">
                    ♥ ✦ ♥
                  </span>
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 18px 8px 18px;">
                <div style="font-family:Arial, Helvetica, sans-serif;color:${maroon};font-weight:700;font-size:16px;margin:0 0 8px 0;">Event Details</div>
                <div style="font-family:Arial, Helvetica, sans-serif;color:${text};font-size:14px;line-height:1.55;">
                  <div><b>DATE:</b> February 15, 2026 (Sunday)</div>
                  <div><b>Call Time:</b> 9:00 AM</div>
                  <div><b>Theme:</b> Korean-inspired outfit, maroon color palette</div>
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:10px 18px 8px 18px;">
                <div style="font-family:Arial, Helvetica, sans-serif;color:${maroon};font-weight:700;font-size:16px;margin:0 0 6px 0;">Things to Bring</div>
                <div style="font-family:Arial, Helvetica, sans-serif;color:${muted};font-size:12px;margin:0 0 10px 0;">(Pack before 9:00 AM)</div>
                <ul style="margin:0;padding-left:18px;font-family:Arial, Helvetica, sans-serif;color:${text};font-size:14px;line-height:1.55;">
                  <li>Paper plates with spoon &amp; cups</li>
                  <li>Starbucks Gift Card</li>
                  <li>Sipa</li>
                  <li>Uno cards</li>
                  <li>Picnic blanket</li>
                  <li>Camera or phone with stand or tripod</li>
                  <li>Painting materials</li>
                  <li>Big bag (to carry food and supplies)</li>
                </ul>
              </td>
            </tr>
            <tr>
              <td style="padding:12px 18px 8px 18px;">
                <div style="font-family:Arial, Helvetica, sans-serif;color:${maroon};font-weight:700;font-size:16px;margin:0 0 8px 0;">UP Town Mall Plan</div>
                <ul style="margin:0;padding-left:18px;font-family:Arial, Helvetica, sans-serif;color:${text};font-size:14px;line-height:1.55;">
                  <li>Photo booth (Life 4 Cuts or other booths)</li>
                  <li>Eat lunch (Preferred: Fine Dining Restaurant)</li>
                  <li>Arcades (just try playing)</li>
                </ul>
                <div style="height:10px;"></div>
                <div style="font-family:Arial, Helvetica, sans-serif;color:${rose};font-weight:700;font-size:14px;margin:0 0 6px 0;">Foods to Buy:</div>
                <ul style="margin:0;padding-left:18px;font-family:Arial, Helvetica, sans-serif;color:${text};font-size:14px;line-height:1.55;">
                  <li>Pizza (at least small)</li>
                  <li>Potato Corner fries</li>
                  <li>Fruits</li>
                  <li>Sandwiches</li>
                  <li>Chips</li>
                  <li>Water</li>
                  <li>Canned soft drinks or juice (or Yakult or Delight)</li>
                  <li>1.5L Coke (optional)</li>
                  <li>Starbucks drink</li>
                </ul>
              </td>
            </tr>
            <tr>
              <td style="padding:12px 18px 8px 18px;">
                <div style="font-family:Arial, Helvetica, sans-serif;color:${maroon};font-weight:700;font-size:16px;margin:0 0 8px 0;">UP Campus Activities</div>
                <ul style="margin:0;padding-left:18px;font-family:Arial, Helvetica, sans-serif;color:${text};font-size:14px;line-height:1.55;">
                  <li>Walk around UP</li>
                  <li>Take scenic photos and videos</li>
                  <li>Visit the famous UP statue and take pictures or videos</li>
                  <li>Set up picnic area (picnic date)</li>
                  <li>Painting date</li>
                  <li>Play Uno cards</li>
                  <li>Play Sipa</li>
                </ul>
              </td>
            </tr>
            <tr>
              <td style="padding:12px 18px 8px 18px;">
                <div style="font-family:Arial, Helvetica, sans-serif;color:${maroon};font-weight:700;font-size:16px;margin:0 0 6px 0;">Bonus Plan (Evening)</div>
                <div style="font-family:Arial, Helvetica, sans-serif;color:${muted};font-size:12px;margin:0 0 10px 0;">(If kaya pa ng budget)</div>
                <ul style="margin:0;padding-left:18px;font-family:Arial, Helvetica, sans-serif;color:${text};font-size:14px;line-height:1.55;">
                  <li>Dinner date inside UP Town Mall</li>
                  <li>Take photos or videos</li>
                </ul>
                <div style="height:10px;"></div>
                <div style="font-family:Arial, Helvetica, sans-serif;color:${muted};font-size:12px;line-height:1.5;border-left:3px solid rgba(201,77,106,0.35);padding-left:10px;">
                  If hindi na kaya ng budget, then let’s eat low-budget meals before umuwi.
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:18px;background:${blush};text-align:center;">
                <div style="font-family:Arial, Helvetica, sans-serif;color:${maroon};font-weight:700;font-size:16px;line-height:1.5;">
                  “Thank you for being my Valentine.<br/>
                  I can’t wait to spend this day with you.”
                </div>
              </td>
            </tr>
          </table>
          <div style="font-family:Arial, Helvetica, sans-serif;color:${muted};font-size:12px;line-height:1.4;margin-top:12px;text-align:center;max-width:600px;">
            Tip: This invitation is designed to stay readable even if images are disabled.
          </div>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function createFx(canvas) {
  const ctx = canvas.getContext("2d");
  let dpr = 1;
  let running = false;
  let particles = [];
  let raf = 0;
  let last = 0;

  function setDpr(v) {
    dpr = v;
  }

  function startCelebration() {
    stop();
    running = true;
    particles = spawnParticles(160);
    last = performance.now();
    raf = requestAnimationFrame(tick);
  }

  function spawnParticles(n) {
    const arr = [];
    const w = canvas.width;
    const h = canvas.height;
    const centerX = w * 0.5;
    const centerY = h * 0.35;
    const palette = [
      "rgba(255,179,199,.95)", // blush
      "rgba(178,74,106,.92)",  // maroon
      "rgba(255,255,255,.85)", // soft white
      "rgba(255,107,138,.88)", // rose
    ];
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 0.8 + Math.random() * 2.6;
      arr.push({
        x: centerX + (Math.random() - 0.5) * 40,
        y: centerY + (Math.random() - 0.5) * 20,
        vx: Math.cos(a) * sp * dpr,
        vy: (Math.sin(a) * sp - 2.4) * dpr,
        g: (0.055 + Math.random() * 0.07) * dpr,
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 0.22,
        life: 180 + Math.random() * 90,
        color: palette[(Math.random() * palette.length) | 0],
        kind: pickKind(),
        size: (6 + Math.random() * 10) * dpr,
      });
    }
    return arr;
  }

  function pickKind() {
    const r = Math.random();
    if (r < 0.35) return "heart";
    if (r < 0.70) return "star";
    return "sparkle";
  }

  function tick(now) {
    const dt = Math.min(34, now - last);
    last = now;
    draw(dt);
    if (!running) return;
    raf = requestAnimationFrame(tick);
  }

  function draw() {
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const next = [];
    for (const p of particles) {
      p.vy += p.g;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      p.life -= 1;

      const alpha = Math.max(0, Math.min(1, p.life / 220));
      if (p.life <= 0) continue;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.strokeStyle = "rgba(255,255,255,.28)";
      ctx.lineWidth = 1.2 * dpr;

      if (p.kind === "heart") drawHeart(p.size);
      else if (p.kind === "star") drawStar(p.size);
      else drawSparkle(p.size);

      ctx.restore();
      next.push(p);
    }
    particles = next;

    // keep it going softly
    if (particles.length < 50) {
      particles.push(...spawnParticles(60));
    }
  }

  function drawHeart(s) {
    const x = 0, y = 0;
    ctx.beginPath();
    ctx.moveTo(x, y + s * 0.25);
    ctx.bezierCurveTo(x, y, x - s * 0.5, y, x - s * 0.5, y + s * 0.25);
    ctx.bezierCurveTo(x - s * 0.5, y + s * 0.55, x - s * 0.1, y + s * 0.78, x, y + s);
    ctx.bezierCurveTo(x + s * 0.1, y + s * 0.78, x + s * 0.5, y + s * 0.55, x + s * 0.5, y + s * 0.25);
    ctx.bezierCurveTo(x + s * 0.5, y, x, y, x, y + s * 0.25);
    ctx.closePath();
    ctx.fill();
  }

  function drawStar(s) {
    const spikes = 5;
    const outer = s * 0.55;
    const inner = s * 0.25;
    let rot = Math.PI / 2 * 3;
    let x = 0, y = 0;
    const step = Math.PI / spikes;
    ctx.beginPath();
    ctx.moveTo(0, -outer);
    for (let i = 0; i < spikes; i++) {
      x = Math.cos(rot) * outer;
      y = Math.sin(rot) * outer;
      ctx.lineTo(x, y);
      rot += step;
      x = Math.cos(rot) * inner;
      y = Math.sin(rot) * inner;
      ctx.lineTo(x, y);
      rot += step;
    }
    ctx.lineTo(0, -outer);
    ctx.closePath();
    ctx.fill();
  }

  function drawSparkle(s) {
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.55);
    ctx.lineTo(s * 0.12, -s * 0.12);
    ctx.lineTo(s * 0.55, 0);
    ctx.lineTo(s * 0.12, s * 0.12);
    ctx.lineTo(0, s * 0.55);
    ctx.lineTo(-s * 0.12, s * 0.12);
    ctx.lineTo(-s * 0.55, 0);
    ctx.lineTo(-s * 0.12, -s * 0.12);
    ctx.closePath();
    ctx.fill();
  }

  function stop() {
    running = false;
    particles = [];
    if (raf) cancelAnimationFrame(raf);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  return { setDpr, startCelebration, stop };
}

