import * as THREE from 'three';

export class WeaponVisuals {
  constructor(scene) {
    this.scene = scene;
    this.projectiles = new Map(); // id -> { mesh, type, ... }
  }

  createProjectileMesh(type) {
    const group = new THREE.Group();

    if (type === 'ROCKET') {
      // Missile Body
      const bodyGeo = new THREE.CylinderGeometry(0.22, 0.22, 1.4, 8);
      const bodyMat = new THREE.MeshStandardMaterial({ color: 0xff0033, roughness: 0.3, metalness: 0.4 });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.rotation.x = Math.PI / 2;
      group.add(body);

      // Nose Cone
      const coneGeo = new THREE.ConeGeometry(0.24, 0.5, 8);
      const coneMat = new THREE.MeshStandardMaterial({ color: 0xffea00, roughness: 0.2 });
      const cone = new THREE.Mesh(coneGeo, coneMat);
      cone.rotation.x = Math.PI / 2;
      cone.position.z = 0.95;
      group.add(cone);

      // Tail Fins
      const finGeo = new THREE.BoxGeometry(0.8, 0.04, 0.4);
      const finMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
      const fin1 = new THREE.Mesh(finGeo, finMat);
      fin1.position.z = -0.5;
      const fin2 = new THREE.Mesh(finGeo, finMat);
      fin2.position.z = -0.5;
      fin2.rotation.z = Math.PI / 2;
      group.add(fin1, fin2);

      // Rocket Exhaust Flare
      const flareGeo = new THREE.ConeGeometry(0.18, 0.4, 6);
      const flareMat = new THREE.MeshBasicMaterial({ color: 0xff6600 });
      const flare = new THREE.Mesh(flareGeo, flareMat);
      flare.rotation.x = -Math.PI / 2;
      flare.position.z = -0.85;
      group.add(flare);
    } else if (type === 'BOMB') {
      // Spiked Bomb Sphere
      const bombGeo = new THREE.SphereGeometry(0.55, 10, 10);
      const bombMat = new THREE.MeshStandardMaterial({ color: 0x1a1a24, roughness: 0.4, metalness: 0.8 });
      const bomb = new THREE.Mesh(bombGeo, bombMat);
      group.add(bomb);

      // Studs / Spikes
      const spikeGeo = new THREE.ConeGeometry(0.12, 0.25, 4);
      const spikeMat = new THREE.MeshStandardMaterial({ color: 0xff0055 });
      for (let i = 0; i < 6; i++) {
        const spike = new THREE.Mesh(spikeGeo, spikeMat);
        const theta = (i / 6) * Math.PI * 2;
        spike.position.set(Math.cos(theta) * 0.55, Math.sin(theta) * 0.55, 0);
        spike.rotation.z = theta - Math.PI / 2;
        group.add(spike);
      }

      // Fuse
      const fuseGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.3);
      const fuseMat = new THREE.MeshBasicMaterial({ color: 0xffea00 });
      const fuse = new THREE.Mesh(fuseGeo, fuseMat);
      fuse.position.y = 0.65;
      group.add(fuse);
    } else if (type === 'GATLING') {
      // High-speed Laser Bolt
      const laserGeo = new THREE.CylinderGeometry(0.08, 0.08, 1.2, 6);
      const laserMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff });
      const laser = new THREE.Mesh(laserGeo, laserMat);
      laser.rotation.x = Math.PI / 2;
      group.add(laser);
    } else if (type === 'MINE') {
      // Ground Spiked Mine
      const baseGeo = new THREE.CylinderGeometry(0.85, 0.95, 0.25, 12);
      const baseMat = new THREE.MeshStandardMaterial({
        color: 0x1f2430,
        metalness: 0.85,
        roughness: 0.35
      });
      const base = new THREE.Mesh(baseGeo, baseMat);
      group.add(base);

      // Color coding: GREEN for local player's mines, RED for opponents, friends, & bots
      const mineColor = isMineOwner ? 0x00e676 : 0xff1744;
      const spikeColor = isMineOwner ? 0x00c853 : 0xd50000;

      // Outer accent glowing ring
      const ringGeo = new THREE.TorusGeometry(0.85, 0.06, 8, 24);
      const ringMat = new THREE.MeshBasicMaterial({ color: mineColor });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.12;
      group.add(ring);

      // Warning Beacon (Green or Red)
      const beaconGeo = new THREE.SphereGeometry(0.24, 10, 10);
      const beaconMat = new THREE.MeshStandardMaterial({
        color: mineColor,
        emissive: mineColor,
        emissiveIntensity: 0.95,
        roughness: 0.2
      });
      const beacon = new THREE.Mesh(beaconGeo, beaconMat);
      beacon.position.y = 0.26;
      group.add(beacon);

      // 4 Spikes
      const spikeGeo = new THREE.ConeGeometry(0.12, 0.25, 5);
      const spikeMat = new THREE.MeshStandardMaterial({ color: spikeColor });
      for (let i = 0; i < 4; i++) {
        const spike = new THREE.Mesh(spikeGeo, spikeMat);
        const theta = (i / 4) * Math.PI * 2;
        spike.position.set(Math.cos(theta) * 0.75, 0.12, Math.sin(theta) * 0.75);
        group.add(spike);
      }

      // Point Light for authentic radiant glow
      const glowLight = new THREE.PointLight(mineColor, 1.4, 5.0);
      glowLight.position.y = 0.45;
      group.add(glowLight);
    }

    return group;
  }

  syncProjectiles(serverProjectiles, myId = null) {
    const activeIds = new Set(serverProjectiles.map(p => p.id));

    // Remove defunct projectiles
    for (const [id, data] of this.projectiles.entries()) {
      if (!activeIds.has(id)) {
        this.scene.remove(data.mesh);
        this.projectiles.delete(id);
      }
    }

    // Add or update
    for (const p of serverProjectiles) {
      let data = this.projectiles.get(p.id);
      const isMineOwner = (p.type === 'MINE' && Boolean(myId && p.ownerId === myId));

      if (!data) {
        const mesh = this.createProjectileMesh(p.type, isMineOwner);
        mesh.position.set(p.x, p.y || 0.5, p.z);
        mesh.rotation.y = p.rotY || 0;
        this.scene.add(mesh);

        data = {
          mesh,
          type: p.type,
          ownerId: p.ownerId,
          isMineOwner,
          targetX: p.x,
          targetY: p.y || 0.5,
          targetZ: p.z,
          targetRotY: p.rotY || 0
        };
        this.projectiles.set(p.id, data);
      } else {
        // If ownership resolved later, refresh mesh
        if (p.type === 'MINE' && data.isMineOwner !== isMineOwner) {
          this.scene.remove(data.mesh);
          const newMesh = this.createProjectileMesh(p.type, isMineOwner);
          newMesh.position.copy(data.mesh.position);
          this.scene.add(newMesh);
          data.mesh = newMesh;
          data.isMineOwner = isMineOwner;
        }

        data.targetX = p.x;
        data.targetY = p.y || 0.5;
        data.targetZ = p.z;
        data.targetRotY = p.rotY || 0;
      }
    }
  }

  update(dt) {
    // Interpolate positions smoothly
    for (const data of this.projectiles.values()) {
      data.mesh.position.x += (data.targetX - data.mesh.position.x) * 15 * dt;
      data.mesh.position.y += (data.targetY - data.mesh.position.y) * 15 * dt;
      data.mesh.position.z += (data.targetZ - data.mesh.position.z) * 15 * dt;
      data.mesh.rotation.y = data.targetRotY;

      if (data.type === 'BOMB') {
        data.mesh.rotation.x += 10 * dt;
        data.mesh.rotation.z += 8 * dt;
      } else if (data.type === 'MINE') {
        data.mesh.rotation.y += 2 * dt;
      }
    }
  }

  cleanup() {
    for (const data of this.projectiles.values()) {
      this.scene.remove(data.mesh);
    }
    this.projectiles.clear();
  }
}
