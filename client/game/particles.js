import * as THREE from 'three';

export class ParticleManager {
  constructor(scene) {
    this.scene = scene;
    this.particles = [];
    this.maxParticles = 45;
    this.sharedSphereGeo = new THREE.SphereGeometry(1, 4, 4);
    this.sharedBoxGeo = new THREE.BoxGeometry(0.14, 0.14, 0.14);
  }

  // Exhaust smoke
  spawnExhaust(pos, dir, isBoost = false) {
    while (this.particles.length >= this.maxParticles) {
      const old = this.particles.shift();
      this.scene.remove(old.mesh);
      if (old.mat) old.mat.dispose();
    }

    const count = isBoost ? 2 : 1;
    for (let i = 0; i < count; i++) {
      const size = isBoost ? 0.35 : 0.18;
      const color = isBoost ? 0x00e5ff : 0x888888;
      const mat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: isBoost ? 0.8 : 0.45
      });
      const mesh = new THREE.Mesh(this.sharedSphereGeo, mat);
      mesh.scale.set(size, size, size);

      mesh.position.set(
        pos.x + (Math.random() - 0.5) * 0.25,
        pos.y + (Math.random() - 0.5) * 0.1,
        pos.z + (Math.random() - 0.5) * 0.25
      );

      this.scene.add(mesh);
      this.particles.push({
        mesh,
        mat,
        vx: -dir.x * (isBoost ? 6 : 2) + (Math.random() - 0.5) * 0.5,
        vy: 0.8 + Math.random() * 0.5,
        vz: -dir.z * (isBoost ? 6 : 2) + (Math.random() - 0.5) * 0.5,
        growth: 1.05,
        maxLife: isBoost ? 0.35 : 0.45,
        life: isBoost ? 0.35 : 0.45
      });
    }
  }

  // Drift sparks
  spawnDriftSparks(pos, tier = 1) {
    while (this.particles.length >= this.maxParticles) {
      const old = this.particles.shift();
      this.scene.remove(old.mesh);
      if (old.mat) old.mat.dispose();
    }

    let color = 0x00e5ff; // tier 1 blue
    if (tier === 2) color = 0x9d00ff; // tier 2 purple
    if (tier === 3) color = 0xff6600; // tier 3 flame orange

    for (let i = 0; i < 2; i++) {
      const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 });
      const mesh = new THREE.Mesh(this.sharedBoxGeo, mat);

      mesh.position.copy(pos);
      this.scene.add(mesh);

      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 3;

      this.particles.push({
        mesh,
        mat,
        vx: Math.cos(angle) * speed,
        vy: 1.5 + Math.random() * 3,
        vz: Math.sin(angle) * speed,
        gravity: -15,
        maxLife: 0.35,
        life: 0.35
      });
    }
  }

  // Explosion
  spawnExplosion(pos, radius = 4.0) {
    // Expanding flash sphere
    const sphereGeo = new THREE.SphereGeometry(1, 12, 12);
    const sphereMat = new THREE.MeshBasicMaterial({
      color: 0xffaa00,
      transparent: true,
      opacity: 0.85
    });
    const sphereMesh = new THREE.Mesh(sphereGeo, sphereMat);
    sphereMesh.position.copy(pos);
    this.scene.add(sphereMesh);

    this.particles.push({
      mesh: sphereMesh,
      mat: sphereMat,
      vx: 0,
      vy: 0,
      vz: 0,
      scaleSpeed: radius * 3.5,
      maxLife: 0.4,
      life: 0.4
    });

    // Shrapnel / Fire particles
    for (let i = 0; i < 28; i++) {
      const size = 0.2 + Math.random() * 0.3;
      const geo = new THREE.BoxGeometry(size, size, size);
      const isFire = Math.random() < 0.6;
      const mat = new THREE.MeshBasicMaterial({
        color: isFire ? (Math.random() < 0.5 ? 0xff3300 : 0xffcc00) : 0x333333,
        transparent: true,
        opacity: 0.95
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(pos);
      this.scene.add(mesh);

      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      const speed = 6 + Math.random() * 14;

      this.particles.push({
        mesh,
        mat,
        vx: Math.sin(phi) * Math.cos(theta) * speed,
        vy: Math.abs(Math.cos(phi)) * speed * 0.8 + 2,
        vz: Math.sin(phi) * Math.sin(theta) * speed,
        gravity: -20,
        maxLife: 0.6 + Math.random() * 0.4,
        life: 0.6 + Math.random() * 0.4
      });
    }
  }

  // Item box pickup poof
  spawnItemBoxPoof(pos) {
    for (let i = 0; i < 18; i++) {
      const geo = new THREE.SphereGeometry(0.18, 4, 4);
      const mat = new THREE.MeshBasicMaterial({
        color: Math.random() < 0.5 ? 0xffea00 : 0x00e5ff,
        transparent: true,
        opacity: 0.9
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(pos);
      this.scene.add(mesh);

      const angle = Math.random() * Math.PI * 2;
      const spd = 3 + Math.random() * 5;
      this.particles.push({
        mesh,
        mat,
        vx: Math.cos(angle) * spd,
        vy: 2 + Math.random() * 4,
        vz: Math.sin(angle) * spd,
        gravity: -10,
        maxLife: 0.5,
        life: 0.5
      });
    }
  }

  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;

      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        p.mat.dispose();
        this.particles.splice(i, 1);
        continue;
      }

      // Physics
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;

      if (p.gravity) {
        p.vy += p.gravity * dt;
      }

      if (p.scaleSpeed) {
        const s = (1 - (p.life / p.maxLife)) * p.scaleSpeed;
        p.mesh.scale.set(s, s, s);
      } else if (p.growth) {
        p.mesh.scale.multiplyScalar(p.growth);
      }

      // Fade out
      p.mat.opacity = (p.life / p.maxLife);
    }
  }

  cleanup() {
    for (const p of this.particles) {
      this.scene.remove(p.mesh);
      p.mesh.geometry.dispose();
      p.mat.dispose();
    }
    this.particles = [];
  }
}
