/**
 * KartPhysics - Arcade Kart Combat Physics Engine
 * - Crisp, responsive arcade steering (no sluggish delay)
 * - 19.0 MPH top speed with punchy acceleration
 * - 100% solid wall collisions (purple ramp sides, bridge walls, tunnel columns, outer stadium)
 * - True slope climbing up the purple ramp, driving across the elevated bridge, and gliding down the orange ramp
 * - Catapult sky jumps removed per user request
 */

export class KartPhysics {
  constructor() {
    this.x = 20;
    this.y = 0;
    this.z = 20;
    this.rotY = 0;
    this.pitch = 0;
    this.speed = 0;
    this.vy = 0;

    // Fast, responsive arcade handling
    this.turnRate = 2.45; // crisp, responsive turning
    this.maxForwardSpeed = 19.0; // increased top speed
    this.maxReverseSpeed = -7.0;
    this.acceleration = 16.0; // snappy acceleration
    this.deceleration = 12.0;
    this.brakeForce = 28.0;

    // Drifting state
    this.isDrifting = false;
    this.driftDir = 0;
    this.driftChargeTime = 0;
    this.driftVisualAngle = 0;
    this.driftTier = 0;

    // Boost state
    this.boostTimer = 0;
    this.boostMultiplier = 1.0;

    // Kart collision radius
    this.kartRadius = 1.25;
    this.arenaRadius = 72.0;
    this.maxArenaDist = this.arenaRadius - this.kartRadius; // 70.75

    this.initObstacles();
  }

  initObstacles() {
    // 1. Orange Divider Rails (AABB: minX, maxX, minZ, maxZ)
    this.boxObstacles = [
      { minX: -17.5, maxX: -14.5, minZ: 14.0, maxZ: 42.0 },
      { minX: 14.5, maxX: 17.5, minZ: -42.0, maxZ: -14.0 },
      { minX: -45.0, maxX: -19.0, minZ: -17.5, maxZ: -14.5 },
      { minX: 19.0, maxX: 45.0, minZ: 14.5, maxZ: 17.5 }
    ];

    // 2. Tunnel Support Pillars
    this.tunnelPillars = [
      { x: -7.0, z: -6.0, r: 1.4 },
      { x: -7.0, z: 6.0, r: 1.4 },
      { x: 15.0, z: -6.0, r: 1.4 },
      { x: 15.0, z: 6.0, r: 1.4 }
    ];

    // 3. Orange Archway Pillars
    this.archPillars = [
      { x: 42.0, z: -8.0, r: 1.4 },
      { x: 42.0, z: 8.0, r: 1.4 }
    ];

    // 4. Red Tire Barriers
    this.tireObstacles = [];
    for (let i = 0; i < 14; i++) {
      const angle1 = Math.PI * 0.75 + (i / 14) * 0.9;
      this.tireObstacles.push({ x: Math.cos(angle1) * 58, z: Math.sin(angle1) * 58, r: 1.35 });

      const angle2 = -Math.PI * 0.25 + (i / 14) * 0.9;
      this.tireObstacles.push({ x: Math.cos(angle2) * 58, z: Math.sin(angle2) * 58, r: 1.35 });
    }
  }

  reset(x = 20, z = 20, rotY = 0) {
    this.x = isNaN(x) ? 20 : x;
    this.y = 0;
    this.z = isNaN(z) ? 20 : z;
    this.rotY = isNaN(rotY) ? 0 : rotY;
    this.pitch = 0;
    this.speed = 0;
    this.vy = 0;
    this.isDrifting = false;
    this.driftDir = 0;
    this.driftChargeTime = 0;
    this.driftVisualAngle = 0;
    this.driftTier = 0;
    this.boostTimer = 0;
    this.boostMultiplier = 1.0;
  }

  applyBoost(multiplier = 1.5, duration = 2.0) {
    this.boostTimer = duration;
    this.boostMultiplier = multiplier;
    this.speed = Math.max(this.speed, this.maxForwardSpeed * 1.35);
  }

  /**
   * Precise 3D terrain elevation calculation
   */
  getSurfaceElevation(x, z, currentY) {
    const rampWidthHalf = 7.0; // Z from -7.0 to +7.0
    const inCentralCorridor = Math.abs(z) <= rampWidthHalf;

    // 1. Purple Upward Ramp: X from -27.0 to -9.0
    if (inCentralCorridor && x >= -27.0 && x <= -9.0) {
      const progress = (x - (-27.0)) / 18.0;
      const slopeHeight = Math.max(0, Math.min(4.0, progress * 4.0));
      return { groundY: slopeHeight, slopePitch: 0.22, onRamp: true };
    }

    // 2. High Elevated Platform / Bridge: X from -9.0 to 17.0
    if (inCentralCorridor && x > -9.0 && x < 17.0) {
      // If kart is on top of bridge
      if (currentY >= 2.2) {
        return { groundY: 4.0, slopePitch: 0.0, onBridge: true };
      }
      // If kart is on ground inside tunnel
      return { groundY: 0.0, slopePitch: 0.0, inTunnel: true };
    }

    // 3. Orange Downward Ramp: X from 17.0 to 35.0
    if (inCentralCorridor && x >= 17.0 && x <= 35.0) {
      const progress = (35.0 - x) / 18.0;
      const slopeHeight = Math.max(0, Math.min(4.0, progress * 4.0));
      return { groundY: slopeHeight, slopePitch: -0.22, onRamp: true };
    }

    // Flat arena floor everywhere else
    return { groundY: 0.0, slopePitch: 0.0 };
  }

  update(dt, input, boostPads = [], otherKarts = []) {
    if (isNaN(this.x) || isNaN(this.z)) {
      this.reset(20, 20, 0);
    }

    // 1. Boost Countdown
    if (this.boostTimer > 0) {
      this.boostTimer -= dt;
      if (this.boostTimer <= 0) {
        this.boostMultiplier = 1.0;
      }
    }

    const currentMaxSpeed = this.boostTimer > 0
      ? this.maxForwardSpeed * this.boostMultiplier
      : this.maxForwardSpeed;

    // 2. Acceleration / Braking
    if (input.forward > 0) {
      this.speed = Math.min(currentMaxSpeed, this.speed + this.acceleration * dt);
    } else if (input.forward < 0) {
      if (this.speed > 0) {
        this.speed = Math.max(0, this.speed - this.brakeForce * dt);
      } else {
        this.speed = Math.max(this.maxReverseSpeed, this.speed - this.acceleration * 0.8 * dt);
      }
    } else {
      // Natural rolling deceleration
      if (this.speed > 0) {
        this.speed = Math.max(0, this.speed - this.deceleration * dt);
      } else if (this.speed < 0) {
        this.speed = Math.min(0, this.speed + this.deceleration * dt);
      }
    }

    // 3. Fast, Agile Arcade Steering
    // Allows easy sharp turning even at lower speeds
    const rollFactor = Math.min(1.0, 0.45 + Math.abs(this.speed) / 2.2);
    const wantsDrift = input.drift && input.steer !== 0 && this.speed > 5.0;

    if (wantsDrift) {
      if (!this.isDrifting) {
        this.isDrifting = true;
        this.driftDir = Math.sign(input.steer);
        this.driftChargeTime = 0;
      }

      this.driftChargeTime += dt;
      if (this.driftChargeTime > 1.8) this.driftTier = 3;
      else if (this.driftChargeTime > 0.9) this.driftTier = 2;
      else if (this.driftChargeTime > 0.4) this.driftTier = 1;
      else this.driftTier = 0;

      // Visual drift slip angle
      const targetVisual = this.driftDir * 0.44;
      this.driftVisualAngle += (targetVisual - this.driftVisualAngle) * 9.0 * dt;

      // Sharp drift turning
      const driftTurnBonus = 1.35;
      this.rotY -= this.driftDir * this.turnRate * driftTurnBonus * dt;
    } else {
      // Ending drift triggers turbo release
      if (this.isDrifting) {
        if (this.driftTier >= 1) {
          const boostDur = this.driftTier === 3 ? 2.2 : (this.driftTier === 2 ? 1.6 : 1.1);
          const boostMult = this.driftTier === 3 ? 1.48 : (this.driftTier === 2 ? 1.32 : 1.2);
          this.applyBoost(boostMult, boostDur);
        }
        this.isDrifting = false;
        this.driftChargeTime = 0;
        this.driftTier = 0;
      }

      this.driftVisualAngle += (0 - this.driftVisualAngle) * 11.0 * dt;

      // Direct, responsive steering
      if (input.steer !== 0 && Math.abs(this.speed) > 0.1) {
        const dir = Math.sign(this.speed);
        this.rotY -= input.steer * this.turnRate * dt * rollFactor * dir;
      }
    }

    // 4. Movement Calculation
    const forwardX = Math.sin(this.rotY);
    const forwardZ = Math.cos(this.rotY);

    this.x += forwardX * this.speed * dt;
    this.z += forwardZ * this.speed * dt;

    // 5. 3D Elevation, Ramps & Gravity
    const elevation = this.getSurfaceElevation(this.x, this.z, this.y);
    const groundY = elevation.groundY;

    if (this.y > groundY + 0.05 || this.vy !== 0) {
      this.y += this.vy * dt;
      this.vy -= 26.0 * dt; // gravity

      if (this.y <= groundY) {
        this.y = groundY;
        this.vy = 0;
      }
      this.pitch += (0 - this.pitch) * 6.0 * dt;
    } else {
      this.y = groundY;
      this.vy = 0;
      this.pitch += (elevation.slopePitch - this.pitch) * 9.0 * dt;
    }

    // 6. SOLID RAMP & BRIDGE WALL COLLISION
    const rampWidthHalf = 7.0;
    const solidLimit = rampWidthHalf + this.kartRadius; // 8.25

    // A. Purple Ramp side walls (X from -27.0 to -9.0)
    if (this.x >= -27.0 && this.x <= -9.0) {
      const progress = (this.x - (-27.0)) / 18.0;
      const rampHeightAtX = progress * 4.0;

      // If kart is on ground below ramp surface, side walls are 100% solid!
      if (this.y < rampHeightAtX - 0.3) {
        if (Math.abs(this.z) < solidLimit) {
          const pushDir = Math.sign(this.z) || 1;
          this.z = pushDir * solidLimit;
          this.speed *= 0.6;
        }
      }
    }

    // B. Purple Ramp Back Wall at X = -9.0 (Solid vertical face facing tunnel)
    if (this.y < 3.2 && Math.abs(this.z) < solidLimit) {
      if (this.x > -9.0 - this.kartRadius && this.x < -6.5) {
        this.x = -6.5;
        this.speed *= 0.5;
      }
    }

    // C. Elevated Bridge deck (X from -9.0 to 17.0)
    if (this.x > -9.0 && this.x < 17.0) {
      if (this.y >= 2.5) {
        // Kart is on top of bridge deck: guardrails keep it from falling off easily
        if (Math.abs(this.z) > 5.5) {
          const pushDir = Math.sign(this.z) || 1;
          this.z = pushDir * 5.5;
        }
      } else {
        // Kart is on ground level under the bridge:
        // Space between the bridge pillars is open road!
        // Prevent clipping into underside ceiling if kart bounces:
        if (this.y > 2.2 && Math.abs(this.z) < rampWidthHalf) {
          this.y = 2.2;
          this.vy = -Math.abs(this.vy) * 0.5;
        }
      }
    }

    // D. Orange Ramp Back Wall at X = 17.0 (Solid vertical face facing tunnel)
    if (this.y < 3.2 && Math.abs(this.z) < solidLimit) {
      if (this.x < 17.0 + this.kartRadius && this.x > 14.5) {
        this.x = 14.5;
        this.speed *= 0.5;
      }
    }

    // E. Orange Down Ramp side walls (X from 17.0 to 35.0)
    if (this.x >= 17.0 && this.x <= 35.0) {
      const progress = (35.0 - this.x) / 18.0;
      const rampHeightAtX = progress * 4.0;
      if (this.y < rampHeightAtX - 0.3) {
        if (Math.abs(this.z) < solidLimit) {
          const pushDir = Math.sign(this.z) || 1;
          this.z = pushDir * solidLimit;
          this.speed *= 0.6;
        }
      }
    }

    // 7. Check Floor Boost Pads
    for (const pad of boostPads) {
      const dist = Math.hypot(this.x - pad.x, this.z - pad.z);
      if (dist < 3.2 && this.boostTimer < 0.8) {
        this.applyBoost(1.45, 1.8);
        break;
      }
    }

    // 8. Static Obstacles Collision Resolution
    this.resolveObstacleCollisions();

    // 9. Kart-to-Kart Bumper Collisions (Never go inside another kart!)
    this.resolveKartCollisions(otherKarts);

    // 9. Outer Stadium Wall Collision & Elastic Bounce
    const distFromCenter = Math.hypot(this.x, this.z);
    if (distFromCenter > this.maxArenaDist) {
      const safeDist = Math.max(0.001, distFromCenter);
      const nx = this.x / safeDist;
      const nz = this.z / safeDist;

      this.x = nx * this.maxArenaDist;
      this.z = nz * this.maxArenaDist;

      const vx = forwardX * this.speed;
      const vz = forwardZ * this.speed;
      const vNormal = vx * nx + vz * nz;
      const vTangent = -vx * nz + vz * nx;

      if (vNormal > 0) {
        const reboundedVn = -vNormal * 0.35;
        const dampedVt = vTangent * 0.85;
        this.speed = Math.sign(this.speed) * Math.hypot(reboundedVn, dampedVt);
      }
    }

    return {
      x: this.x,
      y: this.y,
      z: this.z,
      rotY: this.rotY,
      pitch: this.pitch,
      speed: this.speed,
      driftVisualAngle: this.driftVisualAngle,
      driftTier: this.driftTier,
      isBoosting: this.boostTimer > 0,
      boostProgress: Math.max(0, this.boostTimer / 2.0)
    };
  }

  resolveObstacleCollisions() {
    const kr = this.kartRadius;

    // A. Box Obstacles (Orange Divider Rails)
    for (const box of this.boxObstacles) {
      const cx = Math.max(box.minX, Math.min(this.x, box.maxX));
      const cz = Math.max(box.minZ, Math.min(this.z, box.maxZ));
      const dx = this.x - cx;
      const dz = this.z - cz;
      const distSq = dx * dx + dz * dz;

      if (distSq < kr * kr) {
        const dist = Math.sqrt(distSq);
        if (dist > 0.0001) {
          const overlap = kr - dist;
          this.x += (dx / dist) * overlap;
          this.z += (dz / dist) * overlap;
        } else {
          const dLeft = Math.abs(this.x - box.minX);
          const dRight = Math.abs(this.x - box.maxX);
          const dBottom = Math.abs(this.z - box.minZ);
          const dTop = Math.abs(this.z - box.maxZ);
          const minD = Math.min(dLeft, dRight, dBottom, dTop);

          if (minD === dLeft) this.x = box.minX - kr;
          else if (minD === dRight) this.x = box.maxX + kr;
          else if (minD === dBottom) this.z = box.minZ - kr;
          else this.z = box.maxZ + kr;
        }
        this.speed *= 0.55;
      }
    }

    // B. Tunnel Support Pillars (Only on ground level)
    if (this.y < 3.0) {
      for (const p of this.tunnelPillars) {
        const dx = this.x - p.x;
        const dz = this.z - p.z;
        const minDist = p.r + kr;
        const dist = Math.hypot(dx, dz);
        if (dist < minDist) {
          const safe = Math.max(0.001, dist);
          this.x = p.x + (dx / safe) * minDist;
          this.z = p.z + (dz / safe) * minDist;
          this.speed *= -0.3;
        }
      }
    }

    // C. Orange Arch Pillars
    for (const p of this.archPillars) {
      const dx = this.x - p.x;
      const dz = this.z - p.z;
      const minDist = p.r + kr;
      const dist = Math.hypot(dx, dz);
      if (dist < minDist) {
        const safe = Math.max(0.001, dist);
        this.x = p.x + (dx / safe) * minDist;
        this.z = p.z + (dz / safe) * minDist;
        this.speed *= -0.3;
      }
    }

    // D. Red Tire Barriers
    for (const tire of this.tireObstacles) {
      const dx = this.x - tire.x;
      const dz = this.z - tire.z;
      const minDist = tire.r + kr;
      const dist = Math.hypot(dx, dz);
      if (dist < minDist) {
        const safe = Math.max(0.001, dist);
        this.x = tire.x + (dx / safe) * minDist;
        this.z = tire.z + (dz / safe) * minDist;
        this.speed *= -0.35;
      }
    }
  }

  resolveKartCollisions(otherKarts = []) {
    const minCollisionDist = 2.4; // 2 * kartRadius
    for (const other of otherKarts) {
      if (!other || !other.isAlive) continue;
      const dx = this.x - (other.targetX ?? other.x ?? 0);
      const dz = this.z - (other.targetZ ?? other.z ?? 0);
      const otherY = other.targetY ?? other.y ?? 0;
      const dy = Math.abs(this.y - otherY);
      if (dy > 1.6) continue;

      const dist = Math.hypot(dx, dz);
      if (dist < minCollisionDist && dist > 0.0001) {
        const overlap = minCollisionDist - dist;
        const nx = dx / dist;
        const nz = dz / dist;

        // Push local kart outside bumper perimeter
        this.x += nx * overlap;
        this.z += nz * overlap;

        // Bumper impulse dampening
        const forwardX = Math.sin(this.rotY);
        const forwardZ = Math.cos(this.rotY);
        const dot = forwardX * nx + forwardZ * nz;
        if (dot < 0) {
          this.speed *= 0.65;
        }
      }
    }
  }
}
