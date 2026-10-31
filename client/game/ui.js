import confetti from 'canvas-confetti';

export class UIManager {
  constructor() {
    // DOM elements
    this.hud = document.getElementById('hud');
    this.pilotName = document.getElementById('hud-pilot-name');
    this.hpBar = document.getElementById('hud-hp-bar');
    this.hpText = document.getElementById('hud-hp-text');
    this.timer = document.getElementById('hud-timer');
    this.roomCode = document.getElementById('hud-room-code');
    this.copyLinkBtn = document.getElementById('hud-copy-link-btn');
    this.kills = document.getElementById('hud-kills');
    this.score = document.getElementById('hud-score');
    this.killfeed = document.getElementById('killfeed-container');

    // Smash Karts Authentic HUD elements
    this.rankText = document.getElementById('hud-rank-text');
    this.levelBadge = document.getElementById('hud-level-badge');
    this.skActionBtn = document.getElementById('sk-action-btn');
    this.skActionArt = document.getElementById('sk-action-art');
    this.skAmmoBadge = document.getElementById('sk-ammo-badge');
    this.skModeBtn = document.getElementById('sk-mode-btn');
    this.skSoundBtn = document.getElementById('sk-sound-toggle-btn');
    this.skSettingsBtn = document.getElementById('sk-settings-btn');
    this.fpsVal = document.getElementById('sk-fps-val');
    this.pingVal = document.getElementById('sk-ping-val');

    this.weaponSlot = document.getElementById('weapon-slot');
    this.weaponSymbol = document.getElementById('weapon-symbol');
    this.weaponName = document.getElementById('weapon-name');
    this.weaponHint = document.getElementById('weapon-hint');
    this.weaponAmmoBadge = document.getElementById('weapon-ammo-badge');
    this.weaponAmmoCount = document.getElementById('weapon-ammo-count');

    this.driftFill = document.getElementById('drift-fill');
    this.speedDisplay = document.getElementById('speed-display');
    this.speedBarFill = document.getElementById('speed-bar-fill');
    this.speedLines = document.getElementById('speed-lines');
    this.hitVignette = document.getElementById('hit-vignette');
    this.centerAlert = document.getElementById('center-alert');
    this.dmgNumbersLayer = document.getElementById('damage-numbers-layer');

    // Action button callback
    this.onActionClick = null;

    // Minimap
    this.minimapCanvas = document.getElementById('minimap-canvas');
    this.minimapCtx = this.minimapCanvas ? this.minimapCanvas.getContext('2d') : null;

    // Podium
    this.podiumOverlay = document.getElementById('podium-overlay');
    this.podiumTitle = document.getElementById('podium-title');
    this.p1Name = document.getElementById('p1-name');
    this.p1Score = document.getElementById('p1-score');
    this.p2Name = document.getElementById('p2-name');
    this.p2Score = document.getElementById('p2-score');
    this.p3Name = document.getElementById('p3-name');
    this.p3Score = document.getElementById('p3-score');
    this.podiumTableBody = document.getElementById('podium-table-body');
    this.restartCountdown = document.getElementById('restart-countdown');

    // Tab Leaderboard
    this.tabOverlay = document.getElementById('tab-leaderboard');
    this.tabBody = document.getElementById('tab-leaderboard-body');

    this.setupListeners();
  }

  setupListeners() {
    if (this.copyLinkBtn) {
      this.copyLinkBtn.addEventListener('click', () => {
        const url = window.location.href;
        navigator.clipboard.writeText(url).then(() => {
          this.showAlert('INVITE LINK COPIED!');
        });
      });
    }

    const roomPillCopyBtn = document.getElementById('hud-room-copy-btn');
    if (roomPillCopyBtn) {
      roomPillCopyBtn.addEventListener('click', () => {
        const url = window.location.href;
        navigator.clipboard.writeText(url).then(() => {
          this.showAlert('INVITE LINK COPIED!');
        });
      });
    }

    if (this.skActionBtn) {
      const triggerAction = (e) => {
        e.preventDefault();
        if (this.onActionClick) this.onActionClick();
      };
      this.skActionBtn.addEventListener('click', triggerAction);
      this.skActionBtn.addEventListener('touchstart', triggerAction, { passive: false });
    }
  }

  showHUD() {
    if (this.hud) this.hud.classList.remove('hidden');
  }

  hideHUD() {
    if (this.hud) this.hud.classList.add('hidden');
  }

  updateRank(rank, total) {
    if (!this.rankText) return;
    const suffixes = ['th', 'st', 'nd', 'rd'];
    const v = rank % 100;
    const suffix = (suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0]);
    this.rankText.innerHTML = `${rank}<sup>${suffix}</sup> / ${total}`;
  }

  updateNetStats(fps, ping) {
    if (this.fpsVal) this.fpsVal.textContent = Math.round(fps);
    if (this.pingVal) this.pingVal.textContent = Math.round(ping);
  }

  updatePlayerStatus(name, hp, maxHp, kills, score) {
    if (this.pilotName) this.pilotName.textContent = name;
    if (this.hpBar) {
      const pct = Math.max(0, Math.min(100, (hp / maxHp) * 100));
      this.hpBar.style.width = `${pct}%`;
      if (pct < 30) this.hpBar.style.background = '#ff0033';
      else if (pct < 60) this.hpBar.style.background = '#ffaa00';
      else this.hpBar.style.background = 'linear-gradient(180deg, #ffffff 0%, #e0f2fe 100%)';
    }
    if (this.hpText) this.hpText.textContent = `${Math.ceil(hp)}`;
    if (this.kills) this.kills.textContent = kills;
    if (this.score) this.score.textContent = score;
  }

  updateTimer(secondsLeft) {
    if (!this.timer) return;
    this.timer.textContent = `${Math.max(0, Math.ceil(secondsLeft))}`;
    if (secondsLeft <= 30 && secondsLeft > 0) {
      this.timer.style.color = '#ff3366';
    } else {
      this.timer.style.color = '#ffffff';
    }
  }

  updateRoomCode(code) {
    if (this.roomCode) this.roomCode.textContent = code || '----';
    const pill = document.getElementById('hud-room-pill');
    if (pill) {
      if (code) pill.classList.remove('hidden');
      else pill.classList.add('hidden');
    }
  }

  updateWeapon(weaponType, ammo) {
    if (this.rouletteInterval) {
      clearInterval(this.rouletteInterval);
      this.rouletteInterval = null;
    }

    if (!weaponType) {
      if (this.skActionArt) {
        this.skActionArt.innerHTML = `
          <div class="sk-empty-slot-art">
            <span class="sk-empty-qmark">?</span>
            <span class="sk-empty-sub">HIT BOX</span>
          </div>`;
      }
      if (this.skAmmoBadge) this.skAmmoBadge.classList.add('hidden');
      if (this.weaponSlot) {
        this.weaponSlot.classList.remove('armed');
        if (this.weaponSymbol) this.weaponSymbol.textContent = '?';
        if (this.weaponName) this.weaponName.textContent = 'NO WEAPON';
        if (this.weaponHint) this.weaponHint.textContent = 'DRIVE INTO [?] BOX';
        if (this.weaponAmmoBadge) this.weaponAmmoBadge.classList.add('hidden');
      }
      return;
    }

    const map = {
      ROCKET: { sym: '🚀', name: 'HOMING MISSILE', hint: 'PRESS [SPACE / E / CLICK]' },
      BOMB: { sym: '💣', name: 'BOUNCING BOMB', hint: 'PRESS [SPACE / E / CLICK]' },
      GATLING: { sym: '⚡', name: 'LASER GATLING', hint: 'PRESS [SPACE / E / CLICK]' },
      BOOST: { sym: '🔥', name: 'NITRO JET BOOST', hint: 'BLAST FORWARD & RAM!' },
      MINE: { sym: '💥', name: '3x SPIKED MINES', hint: 'DROP ALL 3 BEHIND YOU' }
    };

    const info = map[weaponType] || { sym: '✨', name: weaponType, hint: 'PRESS [SPACE / E / CLICK]' };

    if (this.skActionArt) {
      this.skActionArt.innerHTML = `<span style="font-size: 46px; filter: drop-shadow(0 2px 8px rgba(0,0,0,0.5));">${info.sym}</span>`;
    }
    if (this.skAmmoBadge) {
      this.skAmmoBadge.textContent = ammo;
      this.skAmmoBadge.classList.remove('hidden');
    }

    if (this.weaponSlot) {
      this.weaponSlot.classList.add('armed');
      if (this.weaponAmmoBadge) this.weaponAmmoBadge.classList.remove('hidden');
      if (this.weaponAmmoCount) this.weaponAmmoCount.textContent = ammo;
      if (this.weaponSymbol) this.weaponSymbol.textContent = info.sym;
      if (this.weaponName) this.weaponName.textContent = info.name;
      if (this.weaponHint) this.weaponHint.textContent = info.hint;
    }
  }

  triggerWeaponRoulette(finalWeapon, ammo) {
    if (this.rouletteInterval) clearInterval(this.rouletteInterval);

    const symbols = ['🚀', '💣', '⚡', '🔥', '💥'];
    let step = 0;
    this.rouletteInterval = setInterval(() => {
      const sym = symbols[step % symbols.length];
      if (this.skActionArt) this.skActionArt.innerHTML = `<span style="font-size: 44px;">${sym}</span>`;
      if (this.weaponSymbol) this.weaponSymbol.textContent = sym;
      if (this.weaponName) this.weaponName.textContent = 'ROLLING...';
      step++;
      if (step >= 6) {
        clearInterval(this.rouletteInterval);
        this.rouletteInterval = null;
        if (finalWeapon) {
          this.updateWeapon(finalWeapon, ammo);
        }
      }
    }, 45);
  }

  updateDriftGauge(chargeTime, tier) {
    if (!this.driftFill) return;
    const pct = Math.min(100, (chargeTime / 2.2) * 100);
    this.driftFill.style.width = `${pct}%`;

    if (tier === 3) {
      this.driftFill.style.background = 'linear-gradient(90deg, #ff6600, #ffea00)';
    } else if (tier === 2) {
      this.driftFill.style.background = 'linear-gradient(90deg, #00e5ff, #9d00ff)';
    } else {
      this.driftFill.style.background = '#00e5ff';
    }
  }

  updateSpeedometer(speed, isBoosting) {
    const mph = Math.abs(Math.round(speed * 2.4));
    if (this.speedDisplay) this.speedDisplay.textContent = mph;
    if (this.speedBarFill) {
      const pct = Math.min(100, (mph / 75) * 100);
      this.speedBarFill.style.width = `${pct}%`;
    }
    if (this.speedLines) {
      if (isBoosting) this.speedLines.classList.add('active');
      else this.speedLines.classList.remove('active');
    }
  }

  flashHit() {
    if (!this.hitVignette) return;
    this.hitVignette.classList.add('hit');
    setTimeout(() => {
      this.hitVignette.classList.remove('hit');
    }, 150);
  }

  showAlert(text, duration = 1800) {
    if (!this.centerAlert) return;
    this.centerAlert.textContent = text;
    this.centerAlert.classList.add('show');
    setTimeout(() => {
      this.centerAlert.classList.remove('show');
    }, duration);
  }

  addKillfeedEntry(attackerName, victimName, weaponType) {
    if (!this.killfeed) return;
    const item = document.createElement('div');
    item.className = 'killfeed-item';

    const weaponIcons = {
      ROCKET: '🚀',
      BOMB: '💣',
      GATLING: '⚡',
      BOOST: '⭐',
      MINE: '💥',
      Crash: '💥'
    };
    const icon = weaponIcons[weaponType] || '💥';

    item.innerHTML = `<strong>${attackerName}</strong> ${icon} <span>${victimName}</span>`;
    this.killfeed.appendChild(item);

    setTimeout(() => {
      item.remove();
    }, 4500);
  }

  spawnDamageNumber(screenX, screenY, amount) {
    if (!this.dmgNumbersLayer) return;
    const el = document.createElement('div');
    el.className = 'floating-dmg';
    el.textContent = `-${amount}`;
    el.style.left = `${screenX}px`;
    el.style.top = `${screenY}px`;
    this.dmgNumbersLayer.appendChild(el);

    setTimeout(() => el.remove(), 900);
  }

  renderMinimap(localKart, allKarts, itemBoxes, arenaRadius = 75) {
    if (!this.minimapCtx) return;
    const ctx = this.minimapCtx;
    const size = 160;
    const center = size / 2;
    const scale = (center - 10) / arenaRadius;

    ctx.clearRect(0, 0, size, size);

    // Arena boundary circle
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(center, center, center - 10, 0, Math.PI * 2);
    ctx.stroke();

    // Central Dais
    ctx.fillStyle = 'rgba(255, 0, 85, 0.2)';
    ctx.beginPath();
    ctx.arc(center, center, 10 * scale, 0, Math.PI * 2);
    ctx.fill();

    // Active Item Boxes
    ctx.fillStyle = '#ffea00';
    itemBoxes.forEach(b => {
      if (!b.active) return;
      const bx = center + b.x * scale;
      const bz = center + b.z * scale;
      ctx.fillRect(bx - 2, bz - 2, 4, 4);
    });

    // Enemy karts & bots
    allKarts.forEach(k => {
      if (!k.isAlive || k.id === localKart.id) return;
      const kx = center + k.x * scale;
      const kz = center + k.z * scale;

      ctx.fillStyle = k.isBot ? '#00e5ff' : '#ff0055';
      ctx.beginPath();
      ctx.arc(kx, kz, 3.5, 0, Math.PI * 2);
      ctx.fill();
    });

    // Local player kart (Gold chevron pointing in rotY direction)
    const lx = center + localKart.x * scale;
    const lz = center + localKart.z * scale;

    ctx.save();
    ctx.translate(lx, lz);
    ctx.rotate(localKart.rotY);

    ctx.fillStyle = '#ffea00';
    ctx.beginPath();
    ctx.moveTo(0, 7);
    ctx.lineTo(-4, -5);
    ctx.lineTo(0, -3);
    ctx.lineTo(4, -5);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  showPodium(podiumData, leaderboardData) {
    if (!this.podiumOverlay) return;
    this.podiumOverlay.classList.remove('hidden');

    const [p1, p2, p3] = podiumData;
    if (p1) {
      if (this.p1Name) this.p1Name.textContent = p1.name;
      if (this.p1Score) this.p1Score.textContent = `${p1.score} pts`;
    }
    if (p2) {
      if (this.p2Name) this.p2Name.textContent = p2.name;
      if (this.p2Score) this.p2Score.textContent = `${p2.score} pts`;
    }
    if (p3) {
      if (this.p3Name) this.p3Name.textContent = p3.name;
      if (this.p3Score) this.p3Score.textContent = `${p3.score} pts`;
    }

    if (this.podiumTableBody) {
      this.podiumTableBody.innerHTML = leaderboardData.map((p, idx) => `
        <tr>
          <td>#${idx + 1}</td>
          <td><strong>${p.name}</strong></td>
          <td>${p.kills}</td>
          <td>${p.deaths}</td>
          <td><strong>${p.score}</strong></td>
        </tr>
      `).join('');
    }

    // Launch celebratory confetti!
    try {
      confetti({
        particleCount: 120,
        spread: 90,
        origin: { y: 0.6 }
      });
    } catch (e) {}

    // Countdown timer for next round
    let count = 12;
    if (this.restartCountdown) this.restartCountdown.textContent = count;
    const interval = setInterval(() => {
      count--;
      if (this.restartCountdown) this.restartCountdown.textContent = count;
      if (count <= 0) {
        clearInterval(interval);
        this.podiumOverlay.classList.add('hidden');
      }
    }, 1000);
  }

  updateTabLeaderboard(allKarts, show) {
    if (!this.tabOverlay) return;
    if (!show) {
      this.tabOverlay.classList.add('hidden');
      return;
    }

    this.tabOverlay.classList.remove('hidden');
    const sorted = [...allKarts].sort((a, b) => b.score - a.score);
    if (this.tabBody) {
      this.tabBody.innerHTML = sorted.map(k => `
        <tr>
          <td><span style="color:${k.color}">●</span> <strong>${k.name}</strong> ${k.isBot ? '(AI)' : ''}</td>
          <td>${k.kills}</td>
          <td>${k.deaths}</td>
          <td>${k.score}</td>
        </tr>
      `).join('');
    }
  }
}
