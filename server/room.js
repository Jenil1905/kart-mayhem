import { WEAPON_TYPES, WEAPON_CONFIGS, getRandomWeapon } from './weapons.js';

// Arena geometry constants
export const ARENA_RADIUS = 75; // circular stadium radius
export const ARENA_WALL_RADIUS = 71;

// Preset Item Box locations across the stadium
export const ITEM_BOX_LOCATIONS = [
  { id: 1, x: 0, z: 0 },
  { id: 2, x: 25, z: 25 },
  { id: 3, x: -25, z: 25 },
  { id: 4, x: 25, z: -25 },
  { id: 5, x: -25, z: -25 },
  { id: 6, x: 45, z: 0 },
  { id: 7, x: -45, z: 0 },
  { id: 8, x: 0, z: 45 },
  { id: 9, x: 0, z: -45 },
  { id: 10, x: 35, z: 35 },
  { id: 11, x: -35, z: 35 },
  { id: 12, x: 35, z: -35 },
  { id: 13, x: -35, z: -35 }
];

// Speed Boost Pads
export const BOOST_PADS = [
  { id: 'bp1', x: 0, z: 20, rotY: 0, width: 4, length: 7 },
  { id: 'bp2', x: 0, z: -20, rotY: Math.PI, width: 4, length: 7 },
  { id: 'bp3', x: 20, z: 0, rotY: Math.PI / 2, width: 4, length: 7 },
  { id: 'bp4', x: -20, z: 0, rotY: -Math.PI / 2, width: 4, length: 7 },
  { id: 'bp5', x: 40, z: 25, rotY: -Math.PI / 4, width: 4, length: 7 },
  { id: 'bp6', x: -40, z: -25, rotY: 3 * Math.PI / 4, width: 4, length: 7 }
];

// Jump ramps removed per user request (no sky catapult jumps)
export const JUMP_RAMPS = [];

export class GameRoom {
  constructor(roomId, io, options = {}) {
    this.id = roomId;
    this.io = io;
    this.isPrivate = Boolean(options.isPrivate);
    this.allowBots = options.allowBots !== false;
    this.targetPlayers = options.targetPlayers || 6;
    this.matchDuration = options.matchDuration || 180; // 3 minutes
    this.matchTimeLeft = this.matchDuration;
    this.state = 'playing'; // 'lobby', 'playing', 'podium'

    this.players = new Map(); // socketId -> playerData
    this.bots = new Map();    // botId -> botData
    this.projectiles = new Map(); // projId -> projectileData
    this.nextProjId = 1;

    // Item boxes state
    this.itemBoxes = ITEM_BOX_LOCATIONS.map(loc => ({
      ...loc,
      active: true,
      respawnTimer: 0
    }));

    this.tickRate = 30; // 30Hz server update
    this.dt = 1 / this.tickRate;
    this.gameLoopInterval = null;

    if (this.allowBots) {
      this.initBots();
    }
    this.startGameLoop();
  }

  initBots() {
    const botNames = ['NitroBot', 'ApexDrift', 'CrashMaster', 'ViperAI', 'TurboRacer', 'ShadowKart'];
    const botColors = ['#ff3b30', '#00e5ff', '#39ff14', '#ff007f', '#ffcc00', '#9d00ff'];

    for (let i = 0; i < this.targetPlayers - 1; i++) {
      const botId = `bot_${i + 1}`;
      const angle = (i / (this.targetPlayers - 1)) * Math.PI * 2;
      const radius = 30 + Math.random() * 15;

      this.bots.set(botId, {
        id: botId,
        isBot: true,
        name: botNames[i % botNames.length],
        color: botColors[i % botColors.length],
        x: Math.cos(angle) * radius,
        y: 0,
        z: Math.sin(angle) * radius,
        rotY: angle + Math.PI,
        speed: 0,
        maxSpeed: 13 + Math.random() * 2,
        acceleration: 9,
        turnRate: 2.2,
        hp: 100,
        maxHp: 100,
        shield: 0,
        kills: 0,
        deaths: 0,
        score: 0,
        isAlive: true,
        respawnTimer: 0,
        weapon: null,
        ammo: 0,
        boostActive: 0,
        invulnerableTimer: 2.0, // spawn protection
        targetBoxId: null,
        targetKartId: null,
        decisionTimer: 0
      });
    }
  }

  addPlayer(socket, profile = {}) {
    // If we have bots and reached target, retire one bot to make room for human
    if (this.allowBots && this.bots.size > 0 && (this.players.size + this.bots.size) >= this.targetPlayers) {
      const firstBotKey = this.bots.keys().next().value;
      if (firstBotKey) this.bots.delete(firstBotKey);
    }

    const spawn = this.getRandomSpawn();
    const player = {
      id: socket.id,
      isBot: false,
      name: profile.name || `Pilot_${socket.id.slice(0, 4)}`,
      color: profile.color || '#ff0055',
      kartStyle: profile.kartStyle || 'racer',
      x: spawn.x,
      y: 0,
      z: spawn.z,
      rotY: spawn.rotY,
      speed: 0,
      maxSpeed: 16,
      hp: 100,
      maxHp: 100,
      shield: 0,
      kills: 0,
      deaths: 0,
      score: 0,
      isAlive: true,
      respawnTimer: 0,
      weapon: null,
      ammo: 0,
      boostActive: 0,
      invulnerableTimer: 2.5,
      lastInput: { forward: 0, steer: 0, drift: false }
    };

    this.players.set(socket.id, player);

    // Send init packet to this client
    socket.emit('game_init', {
      playerId: socket.id,
      spawn: { x: player.x, z: player.z, rotY: player.rotY },
      arena: {
        radius: ARENA_RADIUS,
        boostPads: BOOST_PADS,
        jumpRamps: JUMP_RAMPS
      },
      itemBoxes: this.itemBoxes.map(b => ({ id: b.id, x: b.x, z: b.z, active: b.active })),
      matchTimeLeft: this.matchTimeLeft,
      state: this.state
    });

    this.broadcastMessage(`${player.name} joined the mayhem!`, 'join');
  }

  removePlayer(socketId) {
    const p = this.players.get(socketId);
    if (p) {
      this.broadcastMessage(`${p.name} left the arena.`, 'leave');
      this.players.delete(socketId);

      // Re-add a bot only if room permits bots
      if (this.allowBots && (this.players.size + this.bots.size) < this.targetPlayers) {
        const botId = `bot_${Date.now()}`;
        const spawn = this.getRandomSpawn();
        this.bots.set(botId, {
          id: botId,
          isBot: true,
          name: `AutoBot_${Math.floor(Math.random() * 900 + 100)}`,
          color: '#39ff14',
          x: spawn.x,
          y: 0,
          z: spawn.z,
          rotY: spawn.rotY,
          speed: 0,
          maxSpeed: 22,
          acceleration: 15,
          turnRate: 2.4,
          hp: 100,
          maxHp: 100,
          shield: 0,
          kills: 0,
          deaths: 0,
          score: 0,
          isAlive: true,
          respawnTimer: 0,
          weapon: null,
          ammo: 0,
          boostActive: 0,
          invulnerableTimer: 2.0,
          targetBoxId: null,
          targetKartId: null,
          decisionTimer: 0
        });
      }
    }
  }

  handlePlayerInput(socketId, input) {
    const player = this.players.get(socketId);
    if (!player || !player.isAlive) return;

    // input: { forward: -1..1, steer: -1..1, drift: boolean, x, y, z, rotY, speed }
    player.lastInput = input;

    // Use client-predicted position with server validation
    if (typeof input.x === 'number' && typeof input.z === 'number') {
      const distFromCenter = Math.hypot(input.x, input.z);
      if (distFromCenter <= ARENA_WALL_RADIUS + 3) {
        player.x = input.x;
        player.y = Math.max(0, input.y || 0);
        player.z = input.z;
        player.rotY = input.rotY || 0;
        player.speed = input.speed || 0;
      }
    }
  }

  handlePlayerFire(socketId) {
    const player = this.players.get(socketId);
    if (!player || !player.isAlive || !player.weapon) return;

    this.fireWeapon(player);
  }

  fireWeapon(kart) {
    const weaponType = kart.weapon;
    const config = WEAPON_CONFIGS[weaponType];
    if (!config) return;

    if (weaponType === WEAPON_TYPES.BOOST) {
      kart.boostActive = config.duration;
      kart.ammo--;
      this.io.to(this.id).emit('kart_boost_activated', { kartId: kart.id, duration: config.duration });
      if (kart.ammo <= 0) kart.weapon = null;
      return;
    }

    if (weaponType === WEAPON_TYPES.MINE) {
      // Deploy all 3 mines together in a spread cluster behind kart
      const forwardX = Math.sin(kart.rotY);
      const forwardZ = Math.cos(kart.rotY);
      const rightX = Math.cos(kart.rotY);
      const rightZ = -Math.sin(kart.rotY);

      const cluster = [
        { back: 2.8, side: 0 },
        { back: 2.6, side: -2.0 },
        { back: 2.6, side: 2.0 }
      ];

      for (const offset of cluster) {
        const projId = `mine_${this.nextProjId++}`;
        const mx = kart.x - forwardX * offset.back + rightX * offset.side;
        const mz = kart.z - forwardZ * offset.back + rightZ * offset.side;

        this.projectiles.set(projId, {
          id: projId,
          type: WEAPON_TYPES.MINE,
          ownerId: kart.id,
          ownerName: kart.name,
          x: mx,
          y: 0.2,
          z: mz,
          vx: 0,
          vy: 0,
          vz: 0,
          lifetime: config.lifetime,
          armTimer: config.armDelay,
          damage: config.damage,
          radius: config.radius,
          explosionRadius: config.explosionRadius
        });

        this.io.to(this.id).emit('projectile_spawned', {
          id: projId,
          type: WEAPON_TYPES.MINE,
          ownerId: kart.id,
          x: mx,
          y: 0.2,
          z: mz
        });
      }

      kart.ammo = 0;
      kart.weapon = null;
      return;
    }

    // Forward direction
    const forwardX = Math.sin(kart.rotY);
    const forwardZ = Math.cos(kart.rotY);

    if (weaponType === WEAPON_TYPES.ROCKET) {
      const projId = `rocket_${this.nextProjId++}`;
      this.projectiles.set(projId, {
        id: projId,
        type: WEAPON_TYPES.ROCKET,
        ownerId: kart.id,
        ownerName: kart.name,
        x: kart.x + forwardX * 2.2,
        y: 0.8,
        z: kart.z + forwardZ * 2.2,
        vx: forwardX * config.speed,
        vy: 0,
        vz: forwardZ * config.speed,
        rotY: kart.rotY,
        lifetime: config.lifetime,
        damage: config.damage,
        radius: config.radius,
        explosionRadius: config.explosionRadius,
        targetId: this.findHomingTarget(kart)
      });

      this.io.to(this.id).emit('projectile_spawned', {
        id: projId,
        type: WEAPON_TYPES.ROCKET,
        ownerId: kart.id,
        x: kart.x + forwardX * 2.2,
        y: 0.8,
        z: kart.z + forwardZ * 2.2,
        rotY: kart.rotY
      });

      kart.ammo--;
      if (kart.ammo <= 0) kart.weapon = null;
    } else if (weaponType === WEAPON_TYPES.BOMB) {
      const projId = `bomb_${this.nextProjId++}`;
      this.projectiles.set(projId, {
        id: projId,
        type: WEAPON_TYPES.BOMB,
        ownerId: kart.id,
        ownerName: kart.name,
        x: kart.x + forwardX * 2.0,
        y: 1.2,
        z: kart.z + forwardZ * 2.0,
        vx: forwardX * config.speed,
        vy: 8.5, // upward lob
        vz: forwardZ * config.speed,
        lifetime: config.lifetime,
        damage: config.damage,
        radius: config.radius,
        explosionRadius: config.explosionRadius,
        bounces: config.bounces
      });

      this.io.to(this.id).emit('projectile_spawned', {
        id: projId,
        type: WEAPON_TYPES.BOMB,
        ownerId: kart.id,
        x: kart.x + forwardX * 2.0,
        y: 1.2,
        z: kart.z + forwardZ * 2.0
      });

      kart.ammo--;
      if (kart.ammo <= 0) kart.weapon = null;
    } else if (weaponType === WEAPON_TYPES.GATLING) {
      const projId = `gatling_${this.nextProjId++}`;
      const spread = (Math.random() - 0.5) * config.spread;
      const angle = kart.rotY + spread;
      const fx = Math.sin(angle);
      const fz = Math.cos(angle);

      this.projectiles.set(projId, {
        id: projId,
        type: WEAPON_TYPES.GATLING,
        ownerId: kart.id,
        ownerName: kart.name,
        x: kart.x + fx * 2.0,
        y: 0.7,
        z: kart.z + fz * 2.0,
        vx: fx * config.speed,
        vy: 0,
        vz: fz * config.speed,
        lifetime: config.lifetime,
        damage: config.damage,
        radius: config.radius,
        explosionRadius: config.explosionRadius
      });

      this.io.to(this.id).emit('projectile_spawned', {
        id: projId,
        type: WEAPON_TYPES.GATLING,
        ownerId: kart.id,
        x: kart.x + fx * 2.0,
        y: 0.7,
        z: kart.z + fz * 2.0
      });

      kart.ammo--;
      if (kart.ammo <= 0) kart.weapon = null;
    }
  }

  findHomingTarget(kart) {
    let closestTarget = null;
    let closestDist = 55;
    const forwardX = Math.sin(kart.rotY);
    const forwardZ = Math.cos(kart.rotY);

    const allKarts = [...this.players.values(), ...this.bots.values()];
    for (const other of allKarts) {
      if (other.id === kart.id || !other.isAlive || other.invulnerableTimer > 0) continue;
      const dx = other.x - kart.x;
      const dz = other.z - kart.z;
      const dist = Math.hypot(dx, dz);
      if (dist < closestDist && dist > 1.0) {
        // Dot product check for forward cone
        const nx = dx / dist;
        const nz = dz / dist;
        const dot = nx * forwardX + nz * forwardZ;
        if (dot > 0.5) {
          closestDist = dist;
          closestTarget = other.id;
        }
      }
    }
    return closestTarget;
  }

  getRandomSpawn() {
    const angle = Math.random() * Math.PI * 2;
    const r = 20 + Math.random() * 35;
    return {
      x: Math.cos(angle) * r,
      z: Math.sin(angle) * r,
      rotY: Math.random() * Math.PI * 2
    };
  }

  startGameLoop() {
    this.gameLoopInterval = setInterval(() => {
      this.update(this.dt);
    }, 1000 / this.tickRate);
  }

  stopGameLoop() {
    if (this.gameLoopInterval) {
      clearInterval(this.gameLoopInterval);
      this.gameLoopInterval = null;
    }
  }

  update(dt) {
    if (this.state === 'playing') {
      this.matchTimeLeft -= dt;
      if (this.matchTimeLeft <= 0) {
        this.matchTimeLeft = 0;
        this.endMatch();
      }
    }

    // Update item boxes respawn
    for (const box of this.itemBoxes) {
      if (!box.active) {
        box.respawnTimer -= dt;
        if (box.respawnTimer <= 0) {
          box.active = true;
          this.io.to(this.id).emit('item_box_respawned', { id: box.id });
        }
      }
    }

    // Update Players (timers, boosts)
    for (const player of this.players.values()) {
      if (player.invulnerableTimer > 0) player.invulnerableTimer -= dt;
      if (player.boostActive > 0) player.boostActive -= dt;

      if (!player.isAlive) {
        player.respawnTimer -= dt;
        if (player.respawnTimer <= 0) {
          this.respawnKart(player);
        }
      } else {
        this.checkItemBoxCollection(player);
        this.checkStarRam(player);
      }
    }

    // Update Bots AI
    this.updateBots(dt);

    // Resolve Kart-to-Kart bumper collisions for all karts
    this.resolveKartCollisions();

    // Update Projectiles
    this.updateProjectiles(dt);

    // Broadcast state at tick rate
    this.broadcastState();
  }

  updateBots(dt) {
    const allKarts = [...this.players.values(), ...this.bots.values()];

    for (const bot of this.bots.values()) {
      if (bot.invulnerableTimer > 0) bot.invulnerableTimer -= dt;
      if (bot.boostActive > 0) bot.boostActive -= dt;

      if (!bot.isAlive) {
        bot.respawnTimer -= dt;
        if (bot.respawnTimer <= 0) {
          this.respawnKart(bot);
        }
        continue;
      }

      this.checkItemBoxCollection(bot);
      this.checkStarRam(bot);

      // AI Decision Making
      bot.decisionTimer -= dt;
      if (bot.decisionTimer <= 0) {
        bot.decisionTimer = 0.5 + Math.random() * 0.5;

        // Choose target: if has weapon, target nearest player/bot; if unarmed, target active item box
        if (bot.weapon) {
          let nearestEnemy = null;
          let minDist = 70;
          for (const k of allKarts) {
            if (k.id === bot.id || !k.isAlive || k.invulnerableTimer > 0) continue;
            const dist = Math.hypot(k.x - bot.x, k.z - bot.z);
            if (dist < minDist) {
              minDist = dist;
              nearestEnemy = k;
            }
          }
          bot.targetKartId = nearestEnemy ? nearestEnemy.id : null;
        } else {
          let nearestBox = null;
          let minDist = 999;
          for (const b of this.itemBoxes) {
            if (!b.active) continue;
            const dist = Math.hypot(b.x - bot.x, b.z - bot.z);
            if (dist < minDist) {
              minDist = dist;
              nearestBox = b;
            }
          }
          bot.targetBoxId = nearestBox ? nearestBox.id : null;
        }
      }

      // Execute AI navigation
      let targetX = 0;
      let targetZ = 0;

      if (bot.weapon && bot.targetKartId) {
        const target = allKarts.find(k => k.id === bot.targetKartId);
        if (target && target.isAlive) {
          targetX = target.x;
          targetZ = target.z;

          // If in firing range, shoot!
          const dist = Math.hypot(targetX - bot.x, targetZ - bot.z);
          const fwdX = Math.sin(bot.rotY);
          const fwdZ = Math.cos(bot.rotY);
          const toTargetX = (targetX - bot.x) / dist;
          const toTargetZ = (targetZ - bot.z) / dist;
          const dot = fwdX * toTargetX + fwdZ * toTargetZ;

          if (dist < 40 && dot > 0.7 && Math.random() < 0.25) {
            this.fireWeapon(bot);
          }
        }
      } else if (bot.targetBoxId) {
        const box = this.itemBoxes.find(b => b.id === bot.targetBoxId);
        if (box && box.active) {
          targetX = box.x;
          targetZ = box.z;
        }
      }

      // Avoid walls
      const distFromCenter = Math.hypot(bot.x, bot.z);
      if (distFromCenter > ARENA_WALL_RADIUS - 12) {
        // Steer back towards center
        targetX = 0;
        targetZ = 0;
      }

      // Calculate desired angle
      const dx = targetX - bot.x;
      const dz = targetZ - bot.z;
      const desiredAngle = Math.atan2(dx, dz);

      // Smoothly steer
      let angleDiff = desiredAngle - bot.rotY;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

      const steer = Math.sign(angleDiff);
      bot.rotY += steer * Math.min(bot.turnRate * dt, Math.abs(angleDiff));

      // Accelerate
      const targetSpeed = bot.boostActive > 0 ? bot.maxSpeed * 1.8 : bot.maxSpeed;
      bot.speed = Math.min(targetSpeed, bot.speed + bot.acceleration * dt);

      // Move bot
      bot.x += Math.sin(bot.rotY) * bot.speed * dt;
      bot.z += Math.cos(bot.rotY) * bot.speed * dt;

      // Obstacle collisions: Divider Rails
      const dividerRails = [
        { minX: -17.5, maxX: -14.5, minZ: 14.0, maxZ: 42.0 },
        { minX: 14.5, maxX: 17.5, minZ: -42.0, maxZ: -14.0 },
        { minX: -45.0, maxX: -19.0, minZ: -17.5, maxZ: -14.5 },
        { minX: 19.0, maxX: 45.0, minZ: 14.5, maxZ: 17.5 }
      ];
      const botRadius = 1.25;
      for (const box of dividerRails) {
        const cx = Math.max(box.minX, Math.min(bot.x, box.maxX));
        const cz = Math.max(box.minZ, Math.min(bot.z, box.maxZ));
        const dx = bot.x - cx;
        const dz = bot.z - cz;
        const distSq = dx * dx + dz * dz;
        if (distSq < botRadius * botRadius) {
          const dist = Math.sqrt(distSq) || 0.001;
          bot.x += (dx / dist) * (botRadius - dist);
          bot.z += (dz / dist) * (botRadius - dist);
          bot.speed *= 0.5;
          bot.rotY += (Math.random() - 0.5) * Math.PI * 0.8;
        }
      }

      // Obstacle collisions: Bridge Support Pillars
      const pillars = [
        { x: -7.0, z: -6.0, r: 1.4 },
        { x: -7.0, z: 6.0, r: 1.4 },
        { x: 15.0, z: -6.0, r: 1.4 },
        { x: 15.0, z: 6.0, r: 1.4 }
      ];
      for (const p of pillars) {
        const dx = bot.x - p.x;
        const dz = bot.z - p.z;
        const minDist = p.r + botRadius;
        const dist = Math.hypot(dx, dz);
        if (dist < minDist) {
          const safe = Math.max(0.001, dist);
          bot.x = p.x + (dx / safe) * minDist;
          bot.z = p.z + (dz / safe) * minDist;
          bot.speed *= 0.5;
          bot.rotY += Math.PI * 0.5;
        }
      }

      // Ramp Solid Walls (Ground Level y < 3.0)
      // Purple Ramp Side Walls (x from -27 to -9)
      if (bot.x >= -27.0 && bot.x <= -9.0 && Math.abs(bot.z) < 8.25) {
        bot.z = (Math.sign(bot.z) || 1) * 8.25;
        bot.speed *= 0.6;
        bot.rotY += Math.PI * 0.4;
      }
      // Purple Ramp Back Wall at x = -9.0
      if (bot.x > -9.0 && bot.x < -6.5 && Math.abs(bot.z) < 7.5) {
        bot.x = -6.5;
        bot.speed *= 0.5;
        bot.rotY += Math.PI * 0.5;
      }
      // Orange Ramp Side Walls (x from 17 to 35)
      if (bot.x >= 17.0 && bot.x <= 35.0 && Math.abs(bot.z) < 8.25) {
        bot.z = (Math.sign(bot.z) || 1) * 8.25;
        bot.speed *= 0.6;
        bot.rotY += Math.PI * 0.4;
      }
      // Orange Ramp Back Wall at x = 17.0
      if (bot.x < 17.0 && bot.x > 14.5 && Math.abs(bot.z) < 7.5) {
        bot.x = 14.5;
        bot.speed *= 0.5;
        bot.rotY += Math.PI * 0.5;
      }

      // Arena boundary collision
      const newDist = Math.hypot(bot.x, bot.z);
      if (newDist > ARENA_WALL_RADIUS - 2) {
        const scale = (ARENA_WALL_RADIUS - 2) / newDist;
        bot.x *= scale;
        bot.z *= scale;
        bot.speed *= 0.5;
        bot.rotY += Math.PI * 0.6; // bounce turn
      }
    }
  }

  resolveKartCollisions() {
    const allKarts = [...this.players.values(), ...this.bots.values()];
    const minCollisionDist = 2.4; // 2 * kartRadius

    for (let i = 0; i < allKarts.length; i++) {
      const k1 = allKarts[i];
      if (!k1.isAlive) continue;

      for (let j = i + 1; j < allKarts.length; j++) {
        const k2 = allKarts[j];
        if (!k2.isAlive) continue;

        const dx = k1.x - k2.x;
        const dz = k1.z - k2.z;
        const dy = Math.abs((k1.y || 0) - (k2.y || 0));
        if (dy > 1.6) continue; // High airborne bypass

        const dist = Math.hypot(dx, dz);
        if (dist < minCollisionDist && dist > 0.0001) {
          const overlap = (minCollisionDist - dist) * 0.5;
          const nx = dx / dist;
          const nz = dz / dist;

          // Push both karts apart symmetrically
          k1.x += nx * overlap;
          k1.z += nz * overlap;
          k2.x -= nx * overlap;
          k2.z -= nz * overlap;

          // Elastic bumper speed dampening
          k1.speed *= 0.7;
          k2.speed *= 0.7;
        }
      }
    }
  }

  updateProjectiles(dt) {
    const allKarts = [...this.players.values(), ...this.bots.values()];

    for (const [id, proj] of this.projectiles.entries()) {
      proj.lifetime -= dt;
      if (proj.lifetime <= 0) {
        this.detonateProjectile(proj, null);
        this.projectiles.delete(id);
        continue;
      }

      if (proj.type === WEAPON_TYPES.MINE) {
        if (proj.armTimer > 0) proj.armTimer -= dt;
        else {
          // Check proximity to any kart with 3D height immunity
          for (const kart of allKarts) {
            // OWNER IS 100% IMMUNE: CANNOT TRIGGER THEIR OWN MINE
            if (kart.id === proj.ownerId || !kart.isAlive || kart.invulnerableTimer > 0) continue;
            const dy = (kart.y || 0) - proj.y;
            if (dy > 1.2) continue; // Kart is jumping/flying in the air
            const dist = Math.hypot(kart.x - proj.x, dy, kart.z - proj.z);
            if (dist < proj.radius + 1.2) {
              this.detonateProjectile(proj, kart);
              this.projectiles.delete(id);
              break;
            }
          }
        }
        continue;
      }

      if (proj.type === WEAPON_TYPES.ROCKET) {
        // Homing steering
        if (proj.targetId) {
          const target = allKarts.find(k => k.id === proj.targetId);
          if (target && target.isAlive) {
            const dx = target.x - proj.x;
            const dz = target.z - proj.z;
            const desiredRot = Math.atan2(dx, dz);
            let diff = desiredRot - proj.rotY;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;

            const turnRate = WEAPON_CONFIGS[WEAPON_TYPES.ROCKET].homingTurnRate;
            proj.rotY += Math.sign(diff) * Math.min(turnRate * dt, Math.abs(diff));

            const speed = WEAPON_CONFIGS[WEAPON_TYPES.ROCKET].speed;
            proj.vx = Math.sin(proj.rotY) * speed;
            proj.vz = Math.cos(proj.rotY) * speed;
          }
        }

        proj.x += proj.vx * dt;
        proj.z += proj.vz * dt;
      } else if (proj.type === WEAPON_TYPES.BOMB) {
        proj.x += proj.vx * dt;
        proj.z += proj.vz * dt;
        proj.y += proj.vy * dt;
        proj.vy -= 22 * dt; // gravity

        // Bounce on ground
        if (proj.y <= 0.4) {
          proj.y = 0.4;
          proj.vy = -proj.vy * 0.65;
          proj.bounces = (proj.bounces || 0) - 1;
          if (proj.bounces <= 0) {
            this.detonateProjectile(proj, null);
            this.projectiles.delete(id);
            continue;
          }
        }
      } else if (proj.type === WEAPON_TYPES.GATLING) {
        proj.x += proj.vx * dt;
        proj.z += proj.vz * dt;
      }

      // Check wall hit
      const distFromCenter = Math.hypot(proj.x, proj.z);
      if (distFromCenter >= ARENA_WALL_RADIUS) {
        this.detonateProjectile(proj, null);
        this.projectiles.delete(id);
        continue;
      }

      // Check kart direct collision in 3D
      for (const kart of allKarts) {
        if (kart.id === proj.ownerId || !kart.isAlive || kart.invulnerableTimer > 0) continue;
        const dy = (kart.y || 0) - (proj.y || 0.5);
        const dist = Math.hypot(kart.x - proj.x, dy, kart.z - proj.z);
        if (dist < proj.radius + 1.2) {
          this.detonateProjectile(proj, kart);
          this.projectiles.delete(id);
          break;
        }
      }
    }
  }

  detonateProjectile(proj, directHitKart) {
    const allKarts = [...this.players.values(), ...this.bots.values()];
    const explosionRadius = proj.explosionRadius || 3.0;

    this.io.to(this.id).emit('projectile_exploded', {
      id: proj.id,
      type: proj.type,
      x: proj.x,
      y: proj.y || 0.5,
      z: proj.z,
      radius: explosionRadius
    });

    for (const kart of allKarts) {
      if (!kart.isAlive || kart.invulnerableTimer > 0) continue;
      // Owner is 100% immune to damage from ANY of their own weapons (mines, rockets, bombs, etc.)!
      if (kart.id === proj.ownerId) continue;

      const dy = (kart.y || 0) - (proj.y || 0.5);
      // Airborne protection: ground explosion does not hit karts flying high in the air
      if (dy > explosionRadius * 0.75) continue;
      const dist = Math.hypot(kart.x - proj.x, dy, kart.z - proj.z);
      if (dist <= explosionRadius) {
        const falloff = 1 - (dist / explosionRadius);
        const damage = Math.round(proj.damage * Math.max(0.4, falloff));
        this.damageKart(kart, damage, proj.ownerId, proj.ownerName, proj.type);
      }
    }
  }

  checkStarRam(attacker) {
    if (!attacker.isAlive || attacker.boostActive <= 0) return;
    const allKarts = [...this.players.values(), ...this.bots.values()];

    for (const victim of allKarts) {
      if (victim.id === attacker.id || !victim.isAlive || victim.invulnerableTimer > 0) continue;
      const dy = (victim.y || 0) - (attacker.y || 0);
      if (Math.abs(dy) > 1.4) continue; // Airborne protection
      const dist = Math.hypot(victim.x - attacker.x, dy, victim.z - attacker.z);
      if (dist < 2.5) {
        this.damageKart(victim, 80, attacker.id, attacker.name, WEAPON_TYPES.BOOST);
      }
    }
  }

  damageKart(kart, damage, attackerId, attackerName, weaponType) {
    if (!kart.isAlive || kart.invulnerableTimer > 0) return;

    kart.hp -= damage;
    this.io.to(this.id).emit('kart_damaged', {
      kartId: kart.id,
      damage,
      hp: kart.hp,
      attackerId,
      weaponType
    });

    if (kart.hp <= 0) {
      kart.hp = 0;
      kart.isAlive = false;
      kart.deaths++;
      kart.respawnTimer = 3.0;

      // Reward attacker
      const attacker = this.players.get(attackerId) || this.bots.get(attackerId);
      if (attacker && attacker.id !== kart.id) {
        attacker.kills++;
        attacker.score += 100;
      }

      this.io.to(this.id).emit('kart_destroyed', {
        victimId: kart.id,
        victimName: kart.name,
        attackerId,
        attackerName: attackerName || 'Hazard',
        weaponType: weaponType || 'Crash',
        x: kart.x,
        y: kart.y,
        z: kart.z
      });

      this.broadcastMessage(`${attackerName || 'Unknown'} smashed ${kart.name}!`, 'kill');
    }
  }

  respawnKart(kart) {
    const spawn = this.getRandomSpawn();
    kart.x = spawn.x;
    kart.y = 0;
    kart.z = spawn.z;
    kart.rotY = spawn.rotY;
    kart.speed = 0;
    kart.hp = kart.maxHp;
    kart.isAlive = true;
    kart.invulnerableTimer = 2.5;
    kart.weapon = null;
    kart.ammo = 0;
    kart.boostActive = 0;

    this.io.to(this.id).emit('kart_respawned', {
      kartId: kart.id,
      x: kart.x,
      y: kart.y,
      z: kart.z,
      rotY: kart.rotY,
      hp: kart.hp
    });
  }

  handlePlayerHitBox(socketId, boxId) {
    const player = this.players.get(socketId);
    if (!player || !player.isAlive || player.weapon) return;

    const box = this.itemBoxes.find(b => b.id === Number(boxId) || b.id === boxId);
    if (!box || !box.active) return;

    const dist = Math.hypot(player.x - box.x, player.z - box.z);
    if (dist <= 6.0) { // allowance for network transmission
      this.grantItemBoxToKart(box, player);
    }
  }

  grantItemBoxToKart(box, kart) {
    box.active = false;
    box.respawnTimer = 7.0; // 7 sec respawn

    const weaponType = getRandomWeapon();
    const config = WEAPON_CONFIGS[weaponType];
    kart.weapon = weaponType;
    kart.ammo = config.ammo;

    this.io.to(this.id).emit('item_box_collected', {
      boxId: box.id,
      collectorId: kart.id,
      weaponType,
      ammo: kart.ammo
    });
  }

  checkItemBoxCollection(kart) {
    if (kart.weapon) return; // already armed

    for (const box of this.itemBoxes) {
      if (!box.active) continue;
      const dist = Math.hypot(kart.x - box.x, kart.z - box.z);
      if (dist < 3.4) {
        this.grantItemBoxToKart(box, kart);
        break;
      }
    }
  }

  broadcastState() {
    const playersList = Array.from(this.players.values()).map(p => ({
      id: p.id,
      isBot: false,
      name: p.name,
      color: p.color,
      kartStyle: p.kartStyle,
      x: p.x,
      y: p.y,
      z: p.z,
      rotY: p.rotY,
      speed: p.speed,
      hp: p.hp,
      maxHp: p.maxHp,
      kills: p.kills,
      deaths: p.deaths,
      score: p.score,
      isAlive: p.isAlive,
      weapon: p.weapon,
      ammo: p.ammo,
      boostActive: p.boostActive > 0,
      invulnerable: p.invulnerableTimer > 0
    }));

    const botsList = Array.from(this.bots.values()).map(b => ({
      id: b.id,
      isBot: true,
      name: b.name,
      color: b.color,
      x: b.x,
      y: b.y,
      z: b.z,
      rotY: b.rotY,
      speed: b.speed,
      hp: b.hp,
      maxHp: b.maxHp,
      kills: b.kills,
      deaths: b.deaths,
      score: b.score,
      isAlive: b.isAlive,
      weapon: b.weapon,
      ammo: b.ammo,
      boostActive: b.boostActive > 0,
      invulnerable: b.invulnerableTimer > 0
    }));

    const projectilesList = Array.from(this.projectiles.values()).map(pr => ({
      id: pr.id,
      type: pr.type,
      ownerId: pr.ownerId,
      x: pr.x,
      y: pr.y,
      z: pr.z,
      rotY: pr.rotY || 0
    }));

    this.io.to(this.id).emit('game_tick', {
      t: Date.now(),
      matchTimeLeft: Math.ceil(this.matchTimeLeft),
      players: playersList,
      bots: botsList,
      projectiles: projectilesList
    });
  }

  broadcastMessage(text, type = 'info') {
    this.io.to(this.id).emit('chat_broadcast', { text, type, time: Date.now() });
  }

  endMatch() {
    this.state = 'podium';
    const allKarts = [...this.players.values(), ...this.bots.values()];
    const sorted = allKarts.sort((a, b) => b.score - a.score);

    this.io.to(this.id).emit('match_ended', {
      podium: sorted.slice(0, 3).map(k => ({ id: k.id, name: k.name, kills: k.kills, score: k.score, color: k.color })),
      leaderboard: sorted.map(k => ({ id: k.id, name: k.name, kills: k.kills, deaths: k.deaths, score: k.score }))
    });

    // Auto restart after 12 seconds
    setTimeout(() => {
      this.restartMatch();
    }, 12000);
  }

  restartMatch() {
    this.matchTimeLeft = this.matchDuration;
    this.state = 'playing';

    const allKarts = [...this.players.values(), ...this.bots.values()];
    for (const k of allKarts) {
      k.hp = k.maxHp;
      k.score = 0;
      k.kills = 0;
      k.deaths = 0;
      k.weapon = null;
      k.ammo = 0;
      k.boostActive = 0;
      this.respawnKart(k);
    }

    this.projectiles.clear();
    this.itemBoxes.forEach(b => {
      b.active = true;
      b.respawnTimer = 0;
    });

    this.io.to(this.id).emit('match_restarted', {
      matchTimeLeft: this.matchDuration
    });
  }

  cleanup() {
    this.stopGameLoop();
    this.players.clear();
    this.bots.clear();
    this.projectiles.clear();
  }
}
