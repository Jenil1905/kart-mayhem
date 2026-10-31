import * as THREE from 'three';
import { io } from 'socket.io-client';
import { ArenaScene } from './game/scene.js';
import { KartMeshBuilder } from './game/kart.js';
import { KartPhysics } from './game/physics.js';
import { ParticleManager } from './game/particles.js';
import { WeaponVisuals } from './game/weapons.js';
import { UIManager } from './game/ui.js';
import { sounds } from './game/audio.js';

class KartMayhemClient {
  constructor() {
    this.socket = null;
    this.myId = null;
    this.roomId = null;
    this.inGame = false;

    // Player customization profile
    this.profile = {
      name: 'SpeedRacer',
      color: '#ff0055',
      character: 'cat'
    };

    // Game systems
    this.canvas = document.getElementById('three-canvas');
    this.sceneManager = new ArenaScene(this.canvas);
    this.physics = new KartPhysics();
    this.particles = new ParticleManager(this.sceneManager.scene);
    this.weaponVisuals = new WeaponVisuals(this.sceneManager.scene);
    this.ui = new UIManager();

    // Karts state
    this.kartMeshes = new Map(); // id -> kartObjects
    this.remoteKarts = new Map(); // id -> remote target data for interpolation
    this.localKartData = {
      id: null,
      hp: 100,
      maxHp: 100,
      kills: 0,
      deaths: 0,
      score: 0,
      weapon: null,
      ammo: 0,
      isAlive: true
    };

    // Camera settings
    this.camTargetDist = 8.5;
    this.camTargetHeight = 3.6;
    this.camFollowSpeed = 10.0;
    this.camCloseMode = false;
    this.cameraShake = 0;

    // Arena elements from server
    this.arenaBoostPads = [];
    this.arenaJumpRamps = [];
    this.itemBoxes = [];

    // Inputs
    this.keys = {
      forward: 0,
      steer: 0,
      drift: false,
      fire: false,
      tab: false
    };

    this.lastInputSendTime = 0;

    // Net stats
    this.fps = 60;
    this.frameCount = 0;
    this.lastFpsUpdate = performance.now();
    this.ping = 28;
    this.lastPingSent = 0;

    this.initSocket();
    this.initMenuUI();
    this.initInputListeners();

    // Start render loop
    this.lastTime = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }

  initSocket() {
    this.socket = io({
      transports: ['websocket', 'polling']
    });

    this.socket.on('connect', () => {
      console.log('[Socket Connected] ID:', this.socket.id);
      this.myId = this.socket.id;
    });

    setInterval(() => {
      if (this.socket && this.socket.connected) {
        this.lastPingSent = performance.now();
        this.socket.emit('ping_check');
      }
    }, 2500);

    this.socket.on('pong_check', () => {
      this.ping = Math.max(8, Math.round(performance.now() - this.lastPingSent));
    });

    this.socket.on('game_init', (data) => {
      this.myId = data.playerId;
      this.arenaBoostPads = data.arena.boostPads || [];
      this.arenaJumpRamps = data.arena.jumpRamps || [];
      this.itemBoxes = data.itemBoxes || [];

      if (data.spawn && typeof data.spawn.x === 'number') {
        this.physics.reset(data.spawn.x, data.spawn.z, data.spawn.rotY);
      } else {
        this.physics.reset(20, 20, 0);
      }

      this.sceneManager.buildItemBoxes(this.itemBoxes);
      this.ui.updateRoomCode(this.roomId);
      this.ui.updateTimer(data.matchTimeLeft);
      this.ui.showAlert('BATTLE ARENA READY - GO!', 2000);
      sounds.playBoostWhoosh();

      // Ensure local kart mesh exists
      this.ensureLocalKartMesh();
      this.snapCameraToKart(this.physics.x, this.physics.y, this.physics.z, this.physics.rotY);
    });

    this.socket.on('game_tick', (tick) => {
      this.handleServerTick(tick);
    });

    this.socket.on('item_box_collected', (data) => {
      const box = this.itemBoxes.find(b => b.id === data.boxId || b.id === Number(data.boxId));
      if (box) {
        box.active = false;
        this.sceneManager.setItemBoxState(data.boxId, false);
        this.particles.spawnItemBoxPoof(new THREE.Vector3(box.x, 1.4, box.z));
      }

      if (data.collectorId === this.myId) {
        this.localKartData.weapon = data.weaponType;
        this.localKartData.ammo = data.ammo;
        // Trigger fast roulette settling on final weapon
        this.ui.triggerWeaponRoulette(data.weaponType, data.ammo);
        this.ui.showAlert(`ARMED: ${data.weaponType}!`, 1000);
        this.updateKartWeaponVisual(this.myId, data.weaponType);
      } else {
        this.updateKartWeaponVisual(data.collectorId, data.weaponType);
      }
    });

    this.socket.on('item_box_respawned', (data) => {
      const box = this.itemBoxes.find(b => b.id === data.id);
      if (box) {
        box.active = true;
        this.sceneManager.setItemBoxState(data.id, true);
        this.particles.spawnItemBoxPoof(new THREE.Vector3(box.x, 1.4, box.z));
      }
    });

    this.socket.on('kart_boost_activated', (data) => {
      if (data.kartId === this.myId) {
        this.physics.applyBoost(1.9, data.duration);
        sounds.playBoostWhoosh();
      }
    });

    this.socket.on('projectile_spawned', (p) => {
      if (p.type === 'ROCKET') sounds.playRocketLaunch();
      else if (p.type === 'GATLING') sounds.playGatlingShot();
      else if (p.type === 'BOMB') sounds.playBoostWhoosh();
    });

    this.socket.on('projectile_exploded', (data) => {
      const pos = new THREE.Vector3(data.x, data.y || 0.5, data.z);
      this.particles.spawnExplosion(pos, data.radius);
      sounds.playExplosion();

      // Camera shake if nearby
      const dist = Math.hypot(this.physics.x - data.x, this.physics.z - data.z);
      if (dist < 40) {
        this.cameraShake = Math.max(this.cameraShake, (1 - dist / 40) * 1.5);
      }
    });

    this.socket.on('kart_damaged', (data) => {
      if (data.kartId === this.myId) {
        this.localKartData.hp = data.hp;
        this.ui.flashHit();
        sounds.playHitDamage();
        this.cameraShake = 0.8;

        const screenPos = this.toScreenPosition(new THREE.Vector3(this.physics.x, 1.5, this.physics.z));
        this.ui.spawnDamageNumber(screenPos.x, screenPos.y, data.damage);
      } else {
        const remote = this.remoteKarts.get(data.kartId);
        if (remote) {
          const screenPos = this.toScreenPosition(new THREE.Vector3(remote.x, 1.5, remote.z));
          this.ui.spawnDamageNumber(screenPos.x, screenPos.y, data.damage);
        }
      }
    });

    this.socket.on('kart_destroyed', (data) => {
      const pos = new THREE.Vector3(data.x, 1.0, data.z);
      this.particles.spawnExplosion(pos, 6.0);
      sounds.playExplosion();

      this.ui.addKillfeedEntry(data.attackerName, data.victimName, data.weaponType);

      if (data.victimId === this.myId) {
        this.localKartData.isAlive = false;
        this.ui.showAlert('SMASHED! RESPAWNING...', 2500);
      } else if (data.attackerId === this.myId) {
        this.ui.showAlert(`+100 SMASHED ${data.victimName.toUpperCase()}!`, 1500);
        sounds.playItemBoxChime();
      }
    });

    this.socket.on('kart_respawned', (data) => {
      if (data.kartId === this.myId) {
        this.physics.reset(data.x, data.z, data.rotY);
        this.localKartData.isAlive = true;
        this.localKartData.hp = data.hp;
        this.localKartData.weapon = null;
        this.localKartData.ammo = 0;
        this.ui.updateWeapon(null, 0);
        this.ui.showAlert('RESPAWNED! SHIELD ACTIVE', 1200);
        this.snapCameraToKart(data.x, 0, data.z, data.rotY);
      }
    });

    this.socket.on('match_ended', (data) => {
      this.ui.showPodium(data.podium, data.leaderboard);
      sounds.playVictoryFanfare();
    });

    this.socket.on('match_restarted', (data) => {
      this.ui.updateTimer(data.matchTimeLeft);
      this.ui.showAlert('ROUND RESTARTED - FIGHT!', 1500);
    });

    this.socket.on('chat_broadcast', (msg) => {
      if (msg.type === 'join' || msg.type === 'leave') {
        this.ui.showAlert(msg.text, 1400);
      }
    });
  }

  ensureLocalKartMesh() {
    if (!this.myId) return;
    let myMesh = this.kartMeshes.get(this.myId);
    if (!myMesh) {
      myMesh = KartMeshBuilder.createKart(this.profile.color, this.profile.name, this.profile.character);
      myMesh.root.position.set(this.physics.x, this.physics.y, this.physics.z);
      myMesh.root.rotation.y = this.physics.rotY;
      this.sceneManager.scene.add(myMesh.root);
      this.kartMeshes.set(this.myId, myMesh);
    }
  }

  snapCameraToKart(x, y, z, rotY) {
    const cam = this.sceneManager.camera;
    const dist = this.camCloseMode ? 6.5 : this.camTargetDist;
    const height = this.camCloseMode ? 2.8 : this.camTargetHeight;
    cam.position.set(
      x - Math.sin(rotY) * dist,
      y + height,
      z - Math.cos(rotY) * dist
    );
    cam.lookAt(x + Math.sin(rotY) * 4, y + 1.2, z + Math.cos(rotY) * 4);
  }

  initMenuUI() {
    const nameInput = document.getElementById('player-name-input');
    const randomNameBtn = document.getElementById('random-name-btn');
    const quickPlayBtn = document.getElementById('quick-play-btn');
    const createRoomBtn = document.getElementById('create-room-btn');
    const joinModalBtn = document.getElementById('join-room-modal-btn');
    const joinModal = document.getElementById('join-modal');
    const joinCodeInput = document.getElementById('join-code-input');
    const confirmJoinBtn = document.getElementById('confirm-join-btn');
    const cancelJoinBtn = document.getElementById('cancel-join-btn');
    const guideModal = document.getElementById('guide-modal');
    const howToPlayBtn = document.getElementById('how-to-play-btn');
    const closeGuideBtn = document.getElementById('close-guide-btn');
    const soundToggleBtn = document.getElementById('sound-toggle-btn');
    const podiumLobbyBtn = document.getElementById('podium-lobby-btn');
    const palette = document.getElementById('color-palette');
    const charSelector = document.getElementById('character-selector');

    // Random Pilot Names
    const coolNames = ['NitroCat', 'ApexFrog', 'NinjaKart', 'DriftKing', 'NeonRider', 'CyberPanda', 'TurboViper', 'SmashMaster'];
    if (randomNameBtn && nameInput) {
      randomNameBtn.addEventListener('click', () => {
        const rand = coolNames[Math.floor(Math.random() * coolNames.length)];
        nameInput.value = rand;
        this.profile.name = rand;
      });
    }

    if (nameInput) {
      nameInput.addEventListener('input', (e) => {
        this.profile.name = e.target.value.trim() || 'SpeedRacer';
      });
    }

    // Color Swatches
    if (palette) {
      palette.addEventListener('click', (e) => {
        const swatch = e.target.closest('.color-swatch');
        if (!swatch) return;
        palette.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
        swatch.classList.add('active');
        this.profile.color = swatch.getAttribute('data-color');
      });
    }

    // Character Selector
    if (charSelector) {
      charSelector.addEventListener('click', (e) => {
        const btn = e.target.closest('.char-choice');
        if (!btn) return;
        charSelector.querySelectorAll('.char-choice').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.profile.character = btn.getAttribute('data-char');
      });
    }

    // Sound toggle
    if (soundToggleBtn) {
      soundToggleBtn.addEventListener('click', () => {
        const enabled = sounds.toggleMute();
        soundToggleBtn.textContent = enabled ? '🔊 Sound: ON' : '🔇 Sound: OFF';
      });
    }

    // Weapons guide
    if (howToPlayBtn && guideModal) {
      howToPlayBtn.addEventListener('click', () => guideModal.classList.remove('hidden'));
    }
    if (closeGuideBtn && guideModal) {
      closeGuideBtn.addEventListener('click', () => guideModal.classList.add('hidden'));
    }

    // Join room modal
    if (joinModalBtn && joinModal) {
      joinModalBtn.addEventListener('click', () => joinModal.classList.remove('hidden'));
    }
    if (cancelJoinBtn && joinModal) {
      cancelJoinBtn.addEventListener('click', () => joinModal.classList.add('hidden'));
    }

    // Check URL parameters for direct room join: ?room=XYZ
    const urlParams = new URLSearchParams(window.location.search);
    const roomFromUrl = urlParams.get('room');
    if (roomFromUrl) {
      if (joinCodeInput) joinCodeInput.value = roomFromUrl.toUpperCase();
      if (joinModal) joinModal.classList.remove('hidden');
    }

    // Room Created Modal Elements
    const roomCreatedModal = document.getElementById('room-created-modal');
    const createdRoomCodeBadge = document.getElementById('created-room-code-badge');
    const createdRoomLinkInput = document.getElementById('created-room-link-input');
    const copyCreatedRoomLinkBtn = document.getElementById('copy-created-room-link-btn');
    const createdRoomToast = document.getElementById('created-room-toast');
    const startCreatedRoomBtn = document.getElementById('start-created-room-btn');

    if (copyCreatedRoomLinkBtn && createdRoomLinkInput) {
      copyCreatedRoomLinkBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(createdRoomLinkInput.value).then(() => {
          if (createdRoomToast) {
            createdRoomToast.classList.remove('hidden');
            setTimeout(() => createdRoomToast.classList.add('hidden'), 2500);
          }
        });
      });
    }

    if (startCreatedRoomBtn) {
      startCreatedRoomBtn.addEventListener('click', () => {
        if (roomCreatedModal) roomCreatedModal.classList.add('hidden');
        this.startMatchUI();
      });
    }

    // Quick Play
    if (quickPlayBtn) {
      quickPlayBtn.addEventListener('click', () => {
        sounds.ensureContext();
        quickPlayBtn.disabled = true;
        this.socket.emit('quick_play', { profile: this.profile }, (res) => {
          quickPlayBtn.disabled = false;
          if (res && res.success) {
            this.roomId = res.roomId;
            this.startMatchUI();
          }
        });
      });
    }

    // Create Room - Prominently displays Room Code and Copyable Invite Link
    if (createRoomBtn) {
      createRoomBtn.addEventListener('click', () => {
        sounds.ensureContext();
        createRoomBtn.disabled = true;
        this.socket.emit('create_room', { profile: this.profile }, (res) => {
          createRoomBtn.disabled = false;
          if (res && res.success) {
            this.roomId = res.roomId;
            const inviteUrl = `${window.location.origin}${window.location.pathname}?room=${this.roomId}`;
            window.history.replaceState({}, '', `?room=${this.roomId}`);
            this.ui.updateRoomCode(this.roomId);

            if (createdRoomCodeBadge) createdRoomCodeBadge.textContent = this.roomId;
            if (createdRoomLinkInput) createdRoomLinkInput.value = inviteUrl;
            if (roomCreatedModal) roomCreatedModal.classList.remove('hidden');
          } else {
            alert('Failed to create room. Please try again.');
          }
        });
      });
    }

    // Confirm Join Room
    if (confirmJoinBtn && joinCodeInput) {
      confirmJoinBtn.addEventListener('click', () => {
        const code = joinCodeInput.value.trim().toUpperCase();
        if (!code) return;
        sounds.ensureContext();
        confirmJoinBtn.disabled = true;
        this.socket.emit('join_room', { roomId: code, profile: this.profile }, (res) => {
          confirmJoinBtn.disabled = false;
          if (res && res.success) {
            this.roomId = res.roomId;
            if (joinModal) joinModal.classList.add('hidden');
            window.history.replaceState({}, '', `?room=${this.roomId}`);
            this.ui.updateRoomCode(this.roomId);
            this.startMatchUI();
          } else {
            alert(res?.error || 'Room not found or could not join.');
          }
        });
      });
    }

    // Return to lobby from podium
    if (podiumLobbyBtn) {
      podiumLobbyBtn.addEventListener('click', () => {
        window.location.href = window.location.origin;
      });
    }
  }

  startMatchUI() {
    this.inGame = true;
    const menuOverlay = document.getElementById('menu-overlay');
    if (menuOverlay) menuOverlay.classList.add('hidden');
    this.ui.showHUD();

    this.ensureLocalKartMesh();
    this.snapCameraToKart(this.physics.x, this.physics.y, this.physics.z, this.physics.rotY);
  }

  initInputListeners() {
    window.addEventListener('keydown', (e) => {
      sounds.ensureContext();

      if (e.code === 'KeyW' || e.code === 'ArrowUp') this.keys.forward = 1;
      if (e.code === 'KeyS' || e.code === 'ArrowDown') this.keys.forward = -1;
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') this.keys.steer = -1; // Left
      if (e.code === 'KeyD' || e.code === 'ArrowRight') this.keys.steer = 1;  // Right

      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        this.keys.drift = true;
      }

      if (e.code === 'Space' || e.code === 'KeyE') {
        if (this.localKartData.weapon) {
          this.fireWeapon();
        } else {
          this.keys.drift = true;
        }
      }

      if (e.code === 'Tab') {
        e.preventDefault();
        this.keys.tab = true;
        this.ui.updateTabLeaderboard(this.getAllKartsList(), true);
      }

      if (e.code === 'KeyC') {
        this.camCloseMode = !this.camCloseMode;
      }

      if (e.code === 'KeyM') {
        const enabled = sounds.toggleMute();
        this.ui.showAlert(enabled ? 'SOUND: ON' : 'SOUND: MUTED', 1000);
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'KeyW' || e.code === 'ArrowUp') {
        if (this.keys.forward === 1) this.keys.forward = 0;
      }
      if (e.code === 'KeyS' || e.code === 'ArrowDown') {
        if (this.keys.forward === -1) this.keys.forward = 0;
      }
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') {
        if (this.keys.steer === -1) this.keys.steer = 0;
      }
      if (e.code === 'KeyD' || e.code === 'ArrowRight') {
        if (this.keys.steer === 1) this.keys.steer = 0;
      }

      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        this.keys.drift = false;
      }

      if (e.code === 'Space') {
        this.keys.drift = false;
      }

      if (e.code === 'Tab') {
        this.keys.tab = false;
        this.ui.updateTabLeaderboard(this.getAllKartsList(), false);
      }
    });

    window.addEventListener('mousedown', (e) => {
      if (!this.inGame) return;
      if (e.button === 0 && this.localKartData.weapon) {
        this.fireWeapon();
      }
    });

    // Wire circular action button and utility buttons from Smash Karts HUD
    this.ui.onActionClick = () => {
      sounds.ensureContext();
      if (this.localKartData.weapon) {
        this.fireWeapon();
      } else {
        this.keys.drift = true;
        setTimeout(() => { this.keys.drift = false; }, 350);
      }
    };

    if (this.ui.skModeBtn) {
      this.ui.skModeBtn.addEventListener('click', () => {
        this.camCloseMode = !this.camCloseMode;
        this.ui.skModeBtn.textContent = this.camCloseMode ? '2x' : '1x';
      });
    }

    if (this.ui.skSoundBtn) {
      this.ui.skSoundBtn.addEventListener('click', () => {
        const enabled = sounds.toggleMute();
        this.ui.showAlert(enabled ? 'SOUND: ON' : 'SOUND: MUTED', 1000);
      });
    }

    if (this.ui.skSettingsBtn) {
      this.ui.skSettingsBtn.addEventListener('click', () => {
        const menu = document.getElementById('menu-overlay');
        if (menu) menu.classList.toggle('hidden');
      });
    }
  }

  fireWeapon() {
    if (!this.localKartData.weapon) return;
    const type = this.localKartData.weapon;
    this.socket.emit('fire_weapon');

    // Instant local audio & recoil feedback (zero lag)
    if (type === 'ROCKET') sounds.playRocketLaunch();
    else if (type === 'GATLING') sounds.playGatlingShot();
    else if (type === 'BOMB') sounds.playBoostWhoosh();
    else if (type === 'MINE') sounds.playBoostWhoosh();
    else if (type === 'BOOST') {
      sounds.playBoostWhoosh();
      this.physics.applyBoost(1.65, 3.8);
      this.ui.showAlert('🔥 NITRO JET BOOST!', 1200);
    }

    this.cameraShake = Math.max(this.cameraShake, 0.4);

    if (this.localKartData.ammo > 0) {
      this.localKartData.ammo--;
      if (this.localKartData.ammo <= 0) {
        this.localKartData.weapon = null;
      }
      this.ui.updateWeapon(this.localKartData.weapon, this.localKartData.ammo);
      this.updateKartWeaponVisual(this.myId, this.localKartData.weapon);
    }
  }

  handleServerTick(tick) {
    this.ui.updateTimer(tick.matchTimeLeft);

    const allServerKarts = [...tick.players, ...tick.bots];

    // Calculate real-time placement rank
    const sorted = [...allServerKarts].sort((a, b) => b.score - a.score || b.kills - a.kills);
    const rankIndex = sorted.findIndex(k => k.id === this.myId);
    const myRank = rankIndex >= 0 ? rankIndex + 1 : 1;
    this.ui.updateRank(myRank, allServerKarts.length);

    // Find local player
    const myServerData = allServerKarts.find(k => k.id === this.myId);
    if (myServerData) {
      this.localKartData.hp = myServerData.hp;
      this.localKartData.kills = myServerData.kills;
      this.localKartData.deaths = myServerData.deaths;
      this.localKartData.score = myServerData.score;
      this.localKartData.isAlive = myServerData.isAlive;

      // Authoritative weapon sync from server
      if (myServerData.weapon !== this.localKartData.weapon || myServerData.ammo !== this.localKartData.ammo) {
        this.localKartData.weapon = myServerData.weapon;
        this.localKartData.ammo = myServerData.ammo;
        this.ui.updateWeapon(myServerData.weapon, myServerData.ammo);
        this.updateKartWeaponVisual(this.myId, myServerData.weapon);
      }

      this.ui.updatePlayerStatus(
        myServerData.name,
        myServerData.hp,
        myServerData.maxHp,
        myServerData.kills,
        myServerData.score
      );
    }

    // Sync karts
    const activeIds = new Set(allServerKarts.map(k => k.id));

    // Remove defunct karts
    for (const [id, meshObj] of this.kartMeshes.entries()) {
      if (!activeIds.has(id)) {
        this.sceneManager.scene.remove(meshObj.root);
        this.kartMeshes.delete(id);
        this.remoteKarts.delete(id);
      }
    }

    // Add or update
    for (const k of allServerKarts) {
      let meshObj = this.kartMeshes.get(k.id);
      if (!meshObj) {
        const charType = k.id === this.myId
          ? this.profile.character
          : (k.isBot ? ['cat', 'frog', 'ninja'][Math.floor(Math.random() * 3)] : 'racer');

        meshObj = KartMeshBuilder.createKart(k.color, k.name, charType);
        this.sceneManager.scene.add(meshObj.root);
        this.kartMeshes.set(k.id, meshObj);
      }

      meshObj.shieldMesh.visible = k.invulnerable;
      meshObj.starAuraMesh.visible = k.boostActive;
      meshObj.root.visible = k.isAlive;
      this.updateKartWeaponVisual(k.id, k.weapon);

      if (k.id !== this.myId) {
        this.remoteKarts.set(k.id, {
          targetX: k.x,
          targetY: k.y,
          targetZ: k.z,
          targetRotY: k.rotY,
          speed: k.speed,
          color: k.color,
          name: k.name,
          isBot: k.isBot,
          isAlive: k.isAlive,
          kills: k.kills,
          deaths: k.deaths,
          score: k.score
        });
      }
    }

    // Sync projectiles with local player ID for green (own) vs red (opponents/bots) coloring
    this.weaponVisuals.syncProjectiles(tick.projectiles || [], this.myId);

    // Update Tab Leaderboard if held
    if (this.keys.tab) {
      this.ui.updateTabLeaderboard(allServerKarts, true);
    }

    // Minimap radar
    const localPos = { x: this.physics.x, z: this.physics.z, rotY: this.physics.rotY, id: this.myId };
    this.ui.renderMinimap(localPos, allServerKarts, this.itemBoxes);
  }

  getAllKartsList() {
    const list = [];
    if (this.myId) {
      list.push({
        id: this.myId,
        name: this.profile.name,
        color: this.profile.color,
        isBot: false,
        kills: this.localKartData.kills,
        deaths: this.localKartData.deaths,
        score: this.localKartData.score
      });
    }
    for (const [id, r] of this.remoteKarts.entries()) {
      list.push({ id, ...r });
    }
    return list;
  }

  updateKartWeaponVisual(kartId, weaponType) {
    const meshObj = this.kartMeshes.get(kartId);
    if (meshObj) {
      KartMeshBuilder.setMountedWeapon(meshObj, weaponType);
    }
  }

  loop(timestamp) {
    requestAnimationFrame((t) => this.loop(t));

    const dt = Math.min(0.05, (timestamp - this.lastTime) / 1000);
    this.lastTime = timestamp;

    if (this.inGame && this.localKartData.isAlive) {
      // 1. Update Client-Side Kart Physics (60fps prediction with Bumper Collisions)
      const allOtherKarts = Array.from(this.remoteKarts.values());
      const physicsState = this.physics.update(dt, this.keys, this.arenaBoostPads, allOtherKarts);

      // Instant local item box collision prediction with server assist
      if (!this.localKartData.weapon) {
        for (const box of this.itemBoxes) {
          if (!box.active) continue;
          const dist = Math.hypot(physicsState.x - box.x, physicsState.z - box.z);
          if (dist < 3.2) {
            box.active = false;
            this.sceneManager.setItemBoxState(box.id, false);
            this.particles.spawnItemBoxPoof(new THREE.Vector3(box.x, 1.4, box.z));
            sounds.playItemBoxChime();
            this.socket.emit('hit_item_box', { boxId: box.id });
            this.ui.triggerWeaponRoulette(null, 1);
            break;
          }
        }
      }

      // Send input to server at 30Hz
      if (timestamp - this.lastInputSendTime > 33) {
        this.lastInputSendTime = timestamp;
        this.socket.emit('player_input', {
          forward: this.keys.forward,
          steer: this.keys.steer,
          drift: this.keys.drift,
          x: physicsState.x,
          y: physicsState.y,
          z: physicsState.z,
          rotY: physicsState.rotY,
          speed: physicsState.speed
        });
      }

      // Update Local Kart Mesh
      const myMesh = this.kartMeshes.get(this.myId);
      if (myMesh) {
        myMesh.root.position.set(physicsState.x, physicsState.y, physicsState.z);
        myMesh.root.rotation.y = physicsState.rotY + physicsState.driftVisualAngle;
        myMesh.root.rotation.x = physicsState.pitch || 0; // Realistic slope tilt!

        // Front wheels turn with smoothed steering angle
        const steerAngle = -this.physics.steerAngle;
        myMesh.flPivot.rotation.y = steerAngle;
        myMesh.frPivot.rotation.y = steerAngle;

        // Wheel spin based on speed
        const spinSpeed = physicsState.speed * 4 * dt;
        myMesh.flWheel.rotation.x += spinSpeed;
        myMesh.frWheel.rotation.x += spinSpeed;
        myMesh.rlWheel.rotation.x += spinSpeed;
        myMesh.rrWheel.rotation.x += spinSpeed;

        // Spawn exhaust particles
        const forwardDir = new THREE.Vector3(Math.sin(physicsState.rotY), 0, Math.cos(physicsState.rotY));
        if (Math.abs(physicsState.speed) > 1 || physicsState.isBoosting) {
          const exPos = new THREE.Vector3(
            physicsState.x - forwardDir.x * 1.3,
            physicsState.y + 0.4,
            physicsState.z - forwardDir.z * 1.3
          );
          this.particles.spawnExhaust(exPos, forwardDir, physicsState.isBoosting);
        }

        // Spawn drift sparks
        if (this.physics.isDrifting && physicsState.driftTier > 0) {
          const sparkPos = new THREE.Vector3(
            physicsState.x - forwardDir.x * 1.1,
            physicsState.y + 0.3,
            physicsState.z - forwardDir.z * 1.1
          );
          this.particles.spawnDriftSparks(sparkPos, physicsState.driftTier);
        }
      }

      // Update Engine Audio
      sounds.updateEngine(
        Math.abs(physicsState.speed) / this.physics.maxForwardSpeed,
        this.physics.isDrifting
      );

      // Update HUD Gauges
      this.ui.updateDriftGauge(this.physics.driftChargeTime, physicsState.driftTier);
      this.ui.updateSpeedometer(physicsState.speed, physicsState.isBoosting);

      // Follow Camera
      this.updateCamera(dt, physicsState);
    }

    // 2. Interpolate Remote Karts Smoothly
    for (const [id, remote] of this.remoteKarts.entries()) {
      const meshObj = this.kartMeshes.get(id);
      if (meshObj && remote.targetX !== undefined) {
        meshObj.root.position.x += (remote.targetX - meshObj.root.position.x) * 12 * dt;
        meshObj.root.position.y += (remote.targetY - meshObj.root.position.y) * 12 * dt;
        meshObj.root.position.z += (remote.targetZ - meshObj.root.position.z) * 12 * dt;

        let diff = remote.targetRotY - meshObj.root.rotation.y;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        meshObj.root.rotation.y += diff * 12 * dt;

        const spin = remote.speed * 4 * dt;
        meshObj.flWheel.rotation.x += spin;
        meshObj.frWheel.rotation.x += spin;
        meshObj.rlWheel.rotation.x += spin;
        meshObj.rrWheel.rotation.x += spin;
      }
    }

    // 3. Update Systems
    this.sceneManager.updateItemBoxes(timestamp * 0.001);
    this.weaponVisuals.update(dt);
    this.particles.update(dt);

    // 4. Update Net Stats
    this.frameCount++;
    if (timestamp - this.lastFpsUpdate >= 1000) {
      this.fps = Math.round((this.frameCount * 1000) / Math.max(1, timestamp - this.lastFpsUpdate));
      this.frameCount = 0;
      this.lastFpsUpdate = timestamp;
      this.ui.updateNetStats(this.fps, this.ping);
    }

    // 5. Render
    this.sceneManager.render();
  }

  updateCamera(dt, physicsState) {
    const cam = this.sceneManager.camera;
    const dist = this.camCloseMode ? 6.5 : this.camTargetDist;
    const height = this.camCloseMode ? 2.8 : this.camTargetHeight;

    const idealX = physicsState.x - Math.sin(physicsState.rotY) * dist;
    const idealZ = physicsState.z - Math.cos(physicsState.rotY) * dist;
    const idealY = physicsState.y + height;

    if (isNaN(cam.position.x)) {
      cam.position.set(idealX, idealY, idealZ);
    } else {
      cam.position.x += (idealX - cam.position.x) * this.camFollowSpeed * dt;
      cam.position.y += (idealY - cam.position.y) * this.camFollowSpeed * dt;
      cam.position.z += (idealZ - cam.position.z) * this.camFollowSpeed * dt;
    }

    if (this.cameraShake > 0) {
      cam.position.x += (Math.random() - 0.5) * this.cameraShake;
      cam.position.y += (Math.random() - 0.5) * this.cameraShake;
      cam.position.z += (Math.random() - 0.5) * this.cameraShake;
      this.cameraShake = Math.max(0, this.cameraShake - 3 * dt);
    }

    const lookX = physicsState.x + Math.sin(physicsState.rotY) * 4;
    const lookY = physicsState.y + 1.2;
    const lookZ = physicsState.z + Math.cos(physicsState.rotY) * 4;
    cam.lookAt(lookX, lookY, lookZ);

    const targetFov = physicsState.isBoosting ? 76 : 65;
    cam.fov += (targetFov - cam.fov) * 5 * dt;
    cam.updateProjectionMatrix();
  }

  toScreenPosition(worldPos) {
    const cam = this.sceneManager.camera;
    const vector = worldPos.clone().project(cam);
    const hw = window.innerWidth / 2;
    const hh = window.innerHeight / 2;
    return {
      x: (vector.x * hw) + hw,
      y: -(vector.y * hh) + hh
    };
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new KartMayhemClient();
});
