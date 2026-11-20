(() => {
  'use strict';

  const STAGE_W = 1280;
  const STAGE_H = 720;
  const GROUND_Y = 648;
  const GRAVITY = 2150;

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');

  // HUD elements
  const p1HpFill = document.getElementById('p1HpFill');
  const p1HpTrail = document.getElementById('p1HpTrail');
  const p1HpText = document.getElementById('p1HpText');
  const p1SpFill = document.getElementById('p1SpFill');
  const p1RoundsEl = document.getElementById('p1Rounds');

  const p2HpFill = document.getElementById('p2HpFill');
  const p2HpTrail = document.getElementById('p2HpTrail');
  const p2HpText = document.getElementById('p2HpText');
  const p2SpFill = document.getElementById('p2SpFill');
  const p2RoundsEl = document.getElementById('p2Rounds');

  const roundTag = document.getElementById('roundTag');
  const timerBox = document.getElementById('timerBox');

  const menuOverlay = document.getElementById('menuOverlay');
  const pauseOverlay = document.getElementById('pauseOverlay');
  const resultOverlay = document.getElementById('resultOverlay');
  const bannerOverlay = document.getElementById('bannerOverlay');
  const bannerText = document.getElementById('bannerText');
  const bannerSub = document.getElementById('bannerSub');

  const resultBadge = document.getElementById('resultBadge');
  const resultTitle = document.getElementById('resultTitle');
  const resultStats = document.getElementById('resultStats');
  const touchSpecialBtn = document.getElementById('touchSpecial');

  const btnStartGame = document.getElementById('btnStartGame');
  const btnPause = document.getElementById('btnPause');
  const btnResume = document.getElementById('btnResume');
  const btnBackMenu = document.getElementById('btnBackMenu');
  const btnRestart = document.getElementById('btnRestart');
  const btnPlayAgain = document.getElementById('btnPlayAgain');
  const btnResultMenu = document.getElementById('btnResultMenu');
  const btnSound = document.getElementById('btnSound');

  // --- Web Audio Synthesizer (zero external audio files) ---
  class SoundFX {
    constructor() {
      this.ctx = null;
      this.enabled = true;
    }

    unlock() {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) this.ctx = new AudioCtx();
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
    }

    tone(freq, endFreq, dur, type = 'triangle', vol = 0.16) {
      if (!this.enabled || !this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + dur);
      gain.gain.setValueAtTime(vol, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + dur);
    }

    punch() {
      this.tone(240, 75, 0.11, 'square', 0.14);
    }

    heavyHit() {
      this.tone(180, 45, 0.22, 'sawtooth', 0.2);
      this.tone(520, 140, 0.14, 'triangle', 0.12);
    }

    block() {
      this.tone(680, 920, 0.09, 'sine', 0.12);
    }

    jump() {
      this.tone(220, 480, 0.12, 'sine', 0.1);
    }

    heroSpecial() {
      this.tone(360, 880, 0.32, 'sawtooth', 0.14);
      this.tone(540, 1200, 0.28, 'triangle', 0.12);
    }

    sirenWail() {
      if (!this.enabled || !this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(340, now);
      osc.frequency.linearRampToValueAtTime(610, now + 0.18);
      osc.frequency.linearRampToValueAtTime(290, now + 0.42);
      gain.gain.setValueAtTime(0.11, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.44);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.45);
    }

    ko() {
      this.tone(190, 40, 0.55, 'sawtooth', 0.22);
    }

    victory() {
      const notes = [523, 659, 784, 1046];
      notes.forEach((n, idx) => {
        setTimeout(() => this.tone(n, n * 1.02, 0.18, 'triangle', 0.14), idx * 110);
      });
    }
  }

  const sfx = new SoundFX();

  // --- Image Asset Loader ---
  const manifest = document.getElementById('assetManifest');
  const sprites = {
    heroIdle: new Image(),
    heroAttack: new Image(),
    sirenIdle: new Image(),
    sirenAttack: new Image(),
    arenaBg: new Image(),
  };

  sprites.heroIdle.src = manifest.dataset.heroIdle;
  sprites.heroAttack.src = manifest.dataset.heroAttack;
  sprites.sirenIdle.src = manifest.dataset.sirenIdle;
  sprites.sirenAttack.src = manifest.dataset.sirenAttack;
  sprites.arenaBg.src = manifest.dataset.arenaBg;

  // --- Difficulty Config ---
  const DIFFICULTY = {
    easy: { aiReaction: 0.72, aiAggro: 0.42, aiBlockChance: 0.14, enemyDamageMult: 0.75, enemySpeed: 245 },
    normal: { aiReaction: 0.46, aiAggro: 0.62, aiBlockChance: 0.28, enemyDamageMult: 1.0, enemySpeed: 295 },
    hard: { aiReaction: 0.28, aiAggro: 0.80, aiBlockChance: 0.44, enemyDamageMult: 1.22, enemySpeed: 345 },
  };

  let currentDiff = 'normal';

  // --- Input State ---
  const input = {
    left: false,
    right: false,
    jump: false,
    block: false,
    punch: false,
    heavy: false,
    special: false,
  };

  // --- Game State ---
  const state = {
    phase: 'menu', // menu | intro | fight | roundOver | matchOver | paused
    round: 1,
    p1Wins: 0,
    p2Wins: 0,
    timer: 60,
    hitstop: 0,
    shakeTime: 0,
    shakePower: 0,
    maxCombo: 0,
    totalHits: 0,
    particles: [],
    projectiles: [],
    popups: [],
    rafId: null,
    lastTs: 0,
  };

  function createFighter(isPlayer) {
    return {
      isPlayer,
      name: isPlayer ? 'Herói' : 'Siren Head',
      x: isPlayer ? 310 : 970,
      y: GROUND_Y,
      vx: 0,
      vy: 0,
      facing: isPlayer ? 1 : -1,
      w: isPlayer ? 115 : 135,
      h: isPlayer ? 255 : 325,
      hp: 100,
      maxHp: 100,
      special: isPlayer ? 25 : 0,
      grounded: true,
      blocking: false,
      action: 'idle', // idle | walk | jump | punch | heavy | special | hurt | ko
      actionTimer: 0,
      cooldown: 0,
      hitApplied: false,
      flashTimer: 0,
      comboCount: 0,
      comboTimer: 0,
      aiTimer: 0.6,
      aiDesiredDir: 0,
    };
  }

  let p1 = createFighter(true);
  let p2 = createFighter(false);

  // --- Effects Helpers ---
  function addParticles(x, y, color, count = 14, speed = 280) {
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = (0.3 + Math.random() * 0.7) * speed;
      state.particles.push({
        x,
        y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 60,
        size: 3 + Math.random() * 5,
        color,
        life: 0.35 + Math.random() * 0.3,
        maxLife: 0.65,
      });
    }
  }

  function addPopup(x, y, text, color = '#fef08a', scale = 1) {
    state.popups.push({
      x,
      y,
      text,
      color,
      scale,
      life: 0.75,
      maxLife: 0.75,
    });
  }

  function triggerShake(power = 8, time = 0.18) {
    state.shakePower = Math.max(state.shakePower, power);
    state.shakeTime = Math.max(state.shakeTime, time);
  }

  function showBanner(title, sub, durationMs = 1200, onDone = null) {
    bannerText.textContent = title;
    bannerSub.textContent = sub || '';
    bannerOverlay.classList.remove('hidden');
    if (durationMs > 0) {
      setTimeout(() => {
        bannerOverlay.classList.add('hidden');
        if (onDone) onDone();
      }, durationMs);
    }
  }

  // --- HUD Sync ---
  function updateHUD() {
    const p1Pct = Math.max(0, Math.min(100, (p1.hp / p1.maxHp) * 100));
    const p2Pct = Math.max(0, Math.min(100, (p2.hp / p2.maxHp) * 100));

    p1HpFill.style.width = `${p1Pct}%`;
    p1HpTrail.style.width = `${p1Pct}%`;
    p1HpText.textContent = `${Math.ceil(p1.hp)} / ${p1.maxHp}`;

    p2HpFill.style.width = `${p2Pct}%`;
    p2HpTrail.style.width = `${p2Pct}%`;
    p2HpText.textContent = `${Math.ceil(p2.hp)} / ${p2.maxHp}`;

    p1SpFill.style.width = `${Math.min(100, p1.special)}%`;
    p2SpFill.style.width = `${Math.min(100, p2.special)}%`;

    const spReady = p1.special >= 100;
    p1SpFill.classList.toggle('ready', spReady);
    touchSpecialBtn.classList.toggle('ready', spReady);

    roundTag.textContent = `ROUND ${state.round}`;
    timerBox.textContent = String(Math.max(0, Math.ceil(state.timer))).padStart(2, '0');

    [...p1RoundsEl.children].forEach((dot, i) => dot.classList.toggle('won', i < state.p1Wins));
    [...p2RoundsEl.children].forEach((dot, i) => dot.classList.toggle('won', i < state.p2Wins));
  }

  // --- Combat Actions ---
  function startAttack(fighter, kind) {
    if (fighter.cooldown > 0 || fighter.action === 'hurt' || fighter.action === 'ko') return;
    if (kind === 'special' && fighter.special < 100) return;

    fighter.action = kind;
    fighter.hitApplied = false;
    fighter.blocking = false;

    if (kind === 'punch') {
      fighter.actionTimer = 0.24;
      fighter.cooldown = 0.30;
      fighter.vx = fighter.facing * 130;
      sfx.punch();
    } else if (kind === 'heavy') {
      fighter.actionTimer = 0.40;
      fighter.cooldown = 0.56;
      fighter.vx = fighter.facing * 260;
      sfx.punch();
    } else if (kind === 'special') {
      fighter.special = 0;
      fighter.actionTimer = 0.46;
      fighter.cooldown = 0.65;
      fighter.vx = fighter.facing * -90;

      if (fighter.isPlayer) {
        sfx.heroSpecial();
        state.projectiles.push({
          owner: 'p1',
          x: fighter.x + fighter.facing * 75,
          y: fighter.y - 145,
          vx: fighter.facing * 760,
          radius: 36,
          damage: 22,
          color: '#38bdf8',
          core: '#fef08a',
          life: 1.8,
        });
        addPopup(fighter.x, fighter.y - 250, 'ONDA ESTELAR!', '#38bdf8', 1.15);
      } else {
        sfx.sirenWail();
        state.projectiles.push({
          owner: 'p2',
          x: fighter.x + fighter.facing * 85,
          y: fighter.y - 235,
          vx: fighter.facing * 590,
          radius: 42,
          damage: Math.round(17 * DIFFICULTY[currentDiff].enemyDamageMult),
          color: '#ef4444',
          core: '#fca5a5',
          life: 2.1,
          isSonic: true,
        });
        addPopup(fighter.x, fighter.y - 310, 'GRITO SÔNICO!', '#f87171', 1.1);
      }
    }
  }

  function applyDamage(attacker, defender, baseDamage, knockback, isHeavy) {
    if (defender.action === 'ko' || state.phase !== 'fight') return;

    const blocked = defender.blocking && defender.grounded && defender.action !== 'hurt';
    const finalDmg = blocked ? Math.max(2, Math.round(baseDamage * 0.25)) : baseDamage;

    defender.hp = Math.max(0, defender.hp - finalDmg);
    attacker.special = Math.min(100, attacker.special + (blocked ? 8 : isHeavy ? 22 : 14));
    defender.special = Math.min(100, defender.special + (blocked ? 10 : 12));

    const hitX = (attacker.x + defender.x) * 0.5;
    const hitY = defender.y - defender.h * 0.58;

    if (blocked) {
      sfx.block();
      defender.vx = attacker.facing * knockback * 0.35;
      addParticles(hitX, hitY, '#2dd4bf', 10, 210);
      addPopup(defender.x, defender.y - defender.h - 10, `BLOQUEADO -${finalDmg}`, '#2dd4bf', 0.95);
    } else {
      if (isHeavy) {
        sfx.heavyHit();
        state.hitstop = 0.075;
        triggerShake(11, 0.22);
      } else {
        sfx.punch();
        state.hitstop = 0.035;
        triggerShake(5, 0.11);
      }

      defender.action = 'hurt';
      defender.actionTimer = isHeavy ? 0.34 : 0.2;
      defender.flashTimer = 0.18;
      defender.vx = attacker.facing * knockback;
      if (isHeavy && defender.grounded) {
        defender.vy = -340;
        defender.grounded = false;
      }

      attacker.comboCount += 1;
      attacker.comboTimer = 1.6;
      if (attacker.isPlayer) {
        state.totalHits += 1;
        state.maxCombo = Math.max(state.maxCombo, attacker.comboCount);
      }

      const burstColor = attacker.isPlayer ? '#38bdf8' : '#ef4444';
      addParticles(hitX, hitY, burstColor, isHeavy ? 22 : 12, isHeavy ? 360 : 230);
      addPopup(defender.x, defender.y - defender.h - 12, `-${finalDmg}`, isHeavy ? '#facc15' : '#ffffff', isHeavy ? 1.25 : 1);

      if (attacker.comboCount >= 2) {
        addPopup(attacker.x, attacker.y - attacker.h - 28, `COMBO x${attacker.comboCount}!`, '#facc15', 1.1);
      }
    }

    if (defender.hp <= 0) {
      defender.action = 'ko';
      defender.vx = attacker.facing * 320;
      defender.vy = -420;
      defender.grounded = false;
      finishRound(attacker.isPlayer ? 'p1' : 'p2', 'NOCAUTE!');
    }

    updateHUD();
  }

  // --- Match & Round Flow ---
  function startNewMatch() {
    sfx.unlock();
    state.round = 1;
    state.p1Wins = 0;
    state.p2Wins = 0;
    state.maxCombo = 0;
    state.totalHits = 0;
    menuOverlay.classList.add('hidden');
    pauseOverlay.classList.add('hidden');
    resultOverlay.classList.add('hidden');
    startRound();
  }

  function startRound() {
    p1 = createFighter(true);
    p2 = createFighter(false);
    state.timer = 60;
    state.particles = [];
    state.projectiles = [];
    state.popups = [];
    state.hitstop = 0;
    state.shakeTime = 0;
    state.phase = 'intro';
    updateHUD();

    showBanner(`ROUND ${state.round}`, 'PREPARE-SE!', 950, () => {
      if (state.phase !== 'intro') return;
      state.phase = 'fight';
      showBanner('LUTE!', '', 600);
    });
  }

  function finishRound(winner, reason) {
    if (state.phase === 'roundOver' || state.phase === 'matchOver') return;
    state.phase = 'roundOver';
    sfx.ko();
    triggerShake(14, 0.35);

    if (winner === 'p1') state.p1Wins += 1;
    else if (winner === 'p2') state.p2Wins += 1;
    updateHUD();

    const sub = winner === 'p1' ? 'HERÓI VENCEU O ROUND!' : winner === 'p2' ? 'SIREN HEAD VENCEU O ROUND!' : 'EMPATE!';
    showBanner(reason, sub, 1650, () => {
      if (state.p1Wins >= 2 || state.p2Wins >= 2) {
        state.phase = 'matchOver';
        const playerWon = state.p1Wins >= 2;
        if (playerWon) sfx.victory();
        resultBadge.textContent = playerWon ? '🏆 VITÓRIA!' : '⚠️ DERROTA';
        resultTitle.textContent = playerWon
          ? 'Você derrotou o Siren Head!'
          : 'O Siren Head escapou pela floresta!';
        resultStats.textContent = `Placar: ${state.p1Wins} x ${state.p2Wins} · Combo máximo: ${state.maxCombo} · Golpes acertados: ${state.totalHits}`;
        resultOverlay.classList.remove('hidden');
      } else {
        state.round += 1;
        startRound();
      }
    });
  }

  // --- AI Controller for Siren Head ---
  function updateAI(dt) {
    const cfg = DIFFICULTY[currentDiff];
    p2.aiTimer -= dt;

    const dist = Math.abs(p1.x - p2.x);
    const dirToPlayer = p1.x < p2.x ? -1 : 1;

    if (p2.aiTimer <= 0) {
      p2.aiTimer = cfg.aiReaction * (0.75 + Math.random() * 0.5);
      p2.blocking = false;

      // React to incoming player attack or projectile
      const incomingProj = state.projectiles.some((pr) => pr.owner === 'p1' && Math.abs(pr.x - p2.x) < 260);
      if ((incomingProj || (dist < 200 && (p1.action === 'punch' || p1.action === 'heavy'))) && Math.random() < cfg.aiBlockChance) {
        if (incomingProj && p2.grounded && Math.random() < 0.5) {
          p2.vy = -790;
          p2.grounded = false;
        } else {
          p2.blocking = true;
          p2.aiDesiredDir = 0;
          return;
        }
      }

      // Use Sonic Scream special if charged and at medium/far distance
      if (p2.special >= 100 && dist > 230 && Math.random() < 0.72) {
        startAttack(p2, 'special');
        p2.aiDesiredDir = 0;
        return;
      }

      if (dist < 185) {
        if (Math.random() < cfg.aiAggro) {
          startAttack(p2, Math.random() < 0.45 ? 'heavy' : 'punch');
          p2.aiDesiredDir = 0;
        } else {
          p2.aiDesiredDir = -dirToPlayer;
        }
      } else if (dist > 260) {
        p2.aiDesiredDir = dirToPlayer;
      } else {
        p2.aiDesiredDir = Math.random() < 0.65 ? dirToPlayer : 0;
      }
    }

    if (p2.action === 'idle' || p2.action === 'walk' || p2.action === 'jump') {
      if (!p2.blocking) {
        p2.vx = p2.aiDesiredDir * cfg.enemySpeed;
        if (p2.grounded) p2.action = p2.aiDesiredDir !== 0 ? 'walk' : 'idle';
      } else {
        p2.vx = 0;
      }
    }
  }

  // --- Physics & Update Loop ---
  function updateFighter(f, opp, dt) {
    if (f.cooldown > 0) f.cooldown = Math.max(0, f.cooldown - dt);
    if (f.flashTimer > 0) f.flashTimer = Math.max(0, f.flashTimer - dt);
    if (f.comboTimer > 0) {
      f.comboTimer -= dt;
      if (f.comboTimer <= 0) f.comboCount = 0;
    }

    // Auto-face opponent when not attacking or KO
    if (f.action === 'idle' || f.action === 'walk' || f.action === 'jump') {
      f.facing = opp.x >= f.x ? 1 : -1;
    }

    // Active attack hitbox check
    if (f.action === 'punch' || f.action === 'heavy' || f.action === 'special' || f.action === 'hurt') {
      f.actionTimer -= dt;

      if ((f.action === 'punch' || f.action === 'heavy') && !f.hitApplied && f.actionTimer < (f.action === 'heavy' ? 0.25 : 0.14)) {
        const reach = f.isPlayer ? (f.action === 'heavy' ? 185 : 145) : (f.action === 'heavy' ? 215 : 175);
        const dx = (opp.x - f.x) * f.facing;
        const dy = Math.abs(opp.y - f.y);
        if (dx > -20 && dx < reach && dy < 130) {
          f.hitApplied = true;
          const mult = f.isPlayer ? 1 : DIFFICULTY[currentDiff].enemyDamageMult;
          const dmg = Math.round((f.action === 'heavy' ? 16 : 9) * mult);
          const kb = f.action === 'heavy' ? 420 : 210;
          applyDamage(f, opp, dmg, kb, f.action === 'heavy');
        }
      }

      // Apply friction during attack/hurt
      f.vx *= Math.pow(0.08, dt);

      if (f.actionTimer <= 0 && f.action !== 'ko') {
        f.action = f.grounded ? 'idle' : 'jump';
      }
    }

    // Gravity & Movement
    f.x += f.vx * dt;
    f.y += f.vy * dt;

    if (!f.grounded) {
      f.vy += GRAVITY * dt;
      if (f.y >= GROUND_Y) {
        f.y = GROUND_Y;
        f.vy = 0;
        f.grounded = true;
        addParticles(f.x, GROUND_Y, '#94a3b8', 6, 110);
        if (f.action === 'jump') f.action = 'idle';
      }
    }

    // Arena boundaries
    f.x = Math.max(95, Math.min(STAGE_W - 95, f.x));
  }

  function update(dt) {
    if (state.phase === 'menu' || state.phase === 'paused' || state.phase === 'matchOver') return;

    if (state.shakeTime > 0) {
      state.shakeTime = Math.max(0, state.shakeTime - dt);
      if (state.shakeTime <= 0) state.shakePower = 0;
    }

    if (state.hitstop > 0) {
      state.hitstop -= dt;
      return;
    }

    if (state.phase === 'fight') {
      state.timer -= dt;
      if (state.timer <= 0) {
        state.timer = 0;
        const winner = p1.hp > p2.hp ? 'p1' : p2.hp > p1.hp ? 'p2' : 'draw';
        finishRound(winner, 'TEMPO ESGOTADO!');
      }

      // Player 1 Input
      if (p1.action === 'idle' || p1.action === 'walk' || p1.action === 'jump') {
        p1.blocking = input.block && p1.grounded;
        if (!p1.blocking) {
          const moveDir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
          p1.vx = moveDir * 370;
          if (p1.grounded) p1.action = moveDir !== 0 ? 'walk' : 'idle';
        } else {
          p1.vx = 0;
          p1.action = 'idle';
        }

        if (input.jump && p1.grounded && !p1.blocking) {
          p1.vy = -835;
          p1.grounded = false;
          p1.action = 'jump';
          sfx.jump();
          addParticles(p1.x, GROUND_Y, '#cbd5e1', 7, 130);
        }

        if (input.special && p1.special >= 100) {
          startAttack(p1, 'special');
          input.special = false;
        } else if (input.heavy) {
          startAttack(p1, 'heavy');
          input.heavy = false;
        } else if (input.punch) {
          startAttack(p1, 'punch');
          input.punch = false;
        }
      }

      updateAI(dt);
    }

    updateFighter(p1, p2, dt);
    updateFighter(p2, p1, dt);

    // Prevent fighters overlapping completely
    if (p1.action !== 'ko' && p2.action !== 'ko') {
      const minGap = 92;
      const dist = p2.x - p1.x;
      if (Math.abs(dist) < minGap && Math.abs(p1.y - p2.y) < 120) {
        const push = (minGap - Math.abs(dist)) * 0.5;
        const sign = dist >= 0 ? 1 : -1;
        p1.x = Math.max(95, p1.x - sign * push);
        p2.x = Math.min(STAGE_W - 95, p2.x + sign * push);
      }
    }

    // Update Projectiles
    for (let i = state.projectiles.length - 1; i >= 0; i--) {
      const pr = state.projectiles[i];
      pr.x += pr.vx * dt;
      pr.life -= dt;
      addParticles(pr.x, pr.y, pr.color, 1, 70);

      const target = pr.owner === 'p1' ? p2 : p1;
      const attacker = pr.owner === 'p1' ? p1 : p2;
      const hitCenterY = target.y - target.h * 0.55;

      if (
        Math.abs(pr.x - target.x) < pr.radius + 52 &&
        Math.abs(pr.y - hitCenterY) < pr.radius + target.h * 0.42
      ) {
        applyDamage(attacker, target, pr.damage, 380, true);
        state.projectiles.splice(i, 1);
        continue;
      }

      if (pr.life <= 0 || pr.x < -80 || pr.x > STAGE_W + 80) {
        state.projectiles.splice(i, 1);
      }
    }

    // Update Particles
    for (let i = state.particles.length - 1; i >= 0; i--) {
      const pt = state.particles[i];
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vy += 650 * dt;
      pt.life -= dt;
      if (pt.life <= 0) state.particles.splice(i, 1);
    }

    // Update Floating Popups
    for (let i = state.popups.length - 1; i >= 0; i--) {
      const pop = state.popups[i];
      pop.y -= 55 * dt;
      pop.life -= dt;
      if (pop.life <= 0) state.popups.splice(i, 1);
    }

    updateHUD();
  }

  // --- Rendering ---
  function drawFighter(f, nowSec) {
    const isAttacking = f.action === 'punch' || f.action === 'heavy' || f.action === 'special';
    const img = f.isPlayer
      ? (isAttacking ? sprites.heroAttack : sprites.heroIdle)
      : (isAttacking ? sprites.sirenAttack : sprites.sirenIdle);

    // Ground shadow
    const airRatio = Math.max(0.35, 1 - (GROUND_Y - f.y) / 380);
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.48)';
    ctx.beginPath();
    ctx.ellipse(f.x, GROUND_Y + 6, (f.isPlayer ? 62 : 78) * airRatio, 15 * airRatio, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    if (!img.complete || img.naturalWidth === 0) return;

    const targetH = f.isPlayer ? (isAttacking ? 266 : 258) : (isAttacking ? 342 : 334);
    const ratio = img.naturalWidth / img.naturalHeight;
    const drawW = targetH * ratio;
    const drawH = targetH;

    // Procedural animation polish: breathing, walk bob, hurt tilt, KO fall
    const breathe = f.action === 'idle' ? Math.sin(nowSec * 5.2 + (f.isPlayer ? 0 : 2)) * 4 : 0;
    const walkBob = f.action === 'walk' ? Math.abs(Math.sin(nowSec * 13)) * -10 : 0;
    const walkTilt = f.action === 'walk' ? Math.sin(nowSec * 13) * 0.045 : 0;

    ctx.save();
    ctx.translate(f.x, f.y + walkBob);

    if (f.action === 'ko') {
      ctx.rotate(-f.facing * 1.25);
      ctx.translate(0, -35);
    } else if (f.action === 'hurt') {
      ctx.rotate(-f.facing * 0.14);
    } else {
      ctx.rotate(walkTilt);
    }

    // Both hero and siren sprites natively face right (+1), so flip when facing left (-1)
    ctx.scale(f.facing, 1);

    if (f.flashTimer > 0) {
      ctx.filter = 'brightness(2.2) contrast(1.1)';
    }

    // Draw anchored at feet
    ctx.drawImage(img, -drawW * 0.5, -drawH + breathe, drawW, drawH - breathe);
    ctx.filter = 'none';
    ctx.restore();

    // Shield visual when blocking
    if (f.blocking) {
      ctx.save();
      ctx.strokeStyle = f.isPlayer ? 'rgba(56, 189, 248, 0.85)' : 'rgba(248, 113, 113, 0.85)';
      ctx.fillStyle = f.isPlayer ? 'rgba(56, 189, 248, 0.16)' : 'rgba(248, 113, 113, 0.16)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(f.x + f.facing * 26, f.y - f.h * 0.52, f.isPlayer ? 84 : 106, -Math.PI * 0.45, Math.PI * 0.45, f.facing < 0);
      ctx.stroke();
      ctx.fill();
      ctx.restore();
    }
  }

  function render(nowMs) {
    const nowSec = nowMs * 0.001;
    ctx.save();

    // Screen Shake
    if (state.shakeTime > 0 && state.shakePower > 0) {
      const sx = (Math.random() - 0.5) * state.shakePower * 2;
      const sy = (Math.random() - 0.5) * state.shakePower * 2;
      ctx.translate(sx, sy);
    }

    // Arena Background
    if (sprites.arenaBg.complete && sprites.arenaBg.naturalWidth > 0) {
      ctx.drawImage(sprites.arenaBg, 0, 0, STAGE_W, STAGE_H);
    } else {
      const grad = ctx.createLinearGradient(0, 0, 0, STAGE_H);
      grad.addColorStop(0, '#0f172a');
      grad.addColorStop(1, '#1e293b');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, STAGE_W, STAGE_H);
    }

    // Subtle atmospheric mist at bottom
    const mist = ctx.createLinearGradient(0, GROUND_Y - 90, 0, STAGE_H);
    mist.addColorStop(0, 'rgba(15, 23, 42, 0)');
    mist.addColorStop(1, 'rgba(10, 15, 32, 0.45)');
    ctx.fillStyle = mist;
    ctx.fillRect(0, GROUND_Y - 90, STAGE_W, STAGE_H - (GROUND_Y - 90));

    // Draw Fighters
    drawFighter(p2, nowSec);
    drawFighter(p1, nowSec);

    // Draw Projectiles
    for (const pr of state.projectiles) {
      ctx.save();
      if (pr.isSonic) {
        // Siren Head sonic wave rings
        for (let r = 0; r < 3; r++) {
          ctx.strokeStyle = r === 0 ? '#fecaca' : '#ef4444';
          ctx.lineWidth = 6 - r * 1.4;
          ctx.globalAlpha = 0.9 - r * 0.25;
          ctx.beginPath();
          ctx.arc(pr.x - Math.sign(pr.vx) * r * 14, pr.y, pr.radius - r * 6, -Math.PI * 0.45, Math.PI * 0.45, pr.vx < 0);
          ctx.stroke();
        }
      } else {
        // Hero energy wave
        const grd = ctx.createRadialGradient(pr.x, pr.y, 4, pr.x, pr.y, pr.radius * 1.35);
        grd.addColorStop(0, '#ffffff');
        grd.addColorStop(0.4, pr.core);
        grd.addColorStop(0.8, pr.color);
        grd.addColorStop(1, 'rgba(56, 189, 248, 0)');
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(pr.x, pr.y, pr.radius * 1.35, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Draw Particles
    for (const pt of state.particles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Draw Floating Damage / Combo Popups
    for (const pop of state.popups) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, pop.life / pop.maxLife);
      ctx.font = `900 ${Math.round(28 * pop.scale)}px Inter, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.lineWidth = 5;
      ctx.strokeStyle = 'rgba(2, 6, 23, 0.92)';
      ctx.strokeText(pop.text, pop.x, pop.y);
      ctx.fillStyle = pop.color;
      ctx.fillText(pop.text, pop.x, pop.y);
      ctx.restore();
    }

    ctx.restore();
  }

  function loop(ts) {
    if (!state.lastTs) state.lastTs = ts;
    const dt = Math.min(0.05, (ts - state.lastTs) / 1000);
    state.lastTs = ts;

    update(dt);
    render(ts);
    state.rafId = requestAnimationFrame(loop);
  }

  // --- Controls Binding ---
  function setAction(action, isDown) {
    if (action in input) input[action] = isDown;
  }

  window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', ' '].includes(k)) {
      e.preventDefault();
    }
    if (k === 'p' || k === 'escape') {
      togglePause();
      return;
    }
    if (k === 'a' || k === 'arrowleft') setAction('left', true);
    if (k === 'd' || k === 'arrowright') setAction('right', true);
    if (k === 'w' || k === 'arrowup') setAction('jump', true);
    if (k === 's' || k === 'arrowdown' || k === 'shift') setAction('block', true);
    if (k === 'j' || k === 'z') setAction('punch', true);
    if (k === 'k' || k === 'x') setAction('heavy', true);
    if (k === 'l' || k === 'c') setAction('special', true);
  });

  window.addEventListener('keyup', (e) => {
    const k = e.key.toLowerCase();
    if (k === 'a' || k === 'arrowleft') setAction('left', false);
    if (k === 'd' || k === 'arrowright') setAction('right', false);
    if (k === 'w' || k === 'arrowup') setAction('jump', false);
    if (k === 's' || k === 'arrowdown' || k === 'shift') setAction('block', false);
    if (k === 'j' || k === 'z') setAction('punch', false);
    if (k === 'k' || k === 'x') setAction('heavy', false);
    if (k === 'l' || k === 'c') setAction('special', false);
  });

  // Touch & Mouse on-screen buttons
  document.querySelectorAll('.ctrl-btn').forEach((btn) => {
    const action = btn.dataset.action;
    const press = (e) => {
      e.preventDefault();
      sfx.unlock();
      btn.classList.add('pressed');
      setAction(action, true);
    };
    const release = (e) => {
      e.preventDefault();
      btn.classList.remove('pressed');
      setAction(action, false);
    };
    btn.addEventListener('pointerdown', press);
    btn.addEventListener('pointerup', release);
    btn.addEventListener('pointerleave', release);
    btn.addEventListener('pointercancel', release);
  });

  // Difficulty buttons
  document.querySelectorAll('.diff-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.diff-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      currentDiff = btn.dataset.diff;
    });
  });

  function togglePause() {
    if (state.phase === 'fight') {
      state.phase = 'paused';
      pauseOverlay.classList.remove('hidden');
    } else if (state.phase === 'paused') {
      state.phase = 'fight';
      pauseOverlay.classList.add('hidden');
    }
  }

  function backToMenu() {
    state.phase = 'menu';
    pauseOverlay.classList.add('hidden');
    resultOverlay.classList.add('hidden');
    bannerOverlay.classList.add('hidden');
    menuOverlay.classList.remove('hidden');
  }

  btnStartGame.addEventListener('click', startNewMatch);
  btnPlayAgain.addEventListener('click', startNewMatch);
  btnRestart.addEventListener('click', () => {
    if (state.phase !== 'menu') startNewMatch();
  });
  btnPause.addEventListener('click', togglePause);
  btnResume.addEventListener('click', togglePause);
  btnBackMenu.addEventListener('click', backToMenu);
  btnResultMenu.addEventListener('click', backToMenu);

  btnSound.addEventListener('click', () => {
    sfx.unlock();
    sfx.enabled = !sfx.enabled;
    btnSound.textContent = sfx.enabled ? '🔊 Som' : '🔇 Mudo';
  });

  window.addEventListener('load', () => {
    updateHUD();
    if (state.rafId) cancelAnimationFrame(state.rafId);
    state.rafId = requestAnimationFrame(loop);
  });
})();
