import * as THREE from 'three';

export class KartMeshBuilder {
  static createKart(colorHex = '#ff0055', name = 'Pilot', characterType = 'cat') {
    const root = new THREE.Group();

    const primaryColor = new THREE.Color(colorHex);
    const darkMetalColor = new THREE.Color(0x22222a);
    const chromeColor = new THREE.Color(0xeeeeee);
    const tireColor = new THREE.Color(0x18181c);
    const neonCyan = new THREE.Color(0x00e5ff);

    // High quality standard materials
    const bodyMat = new THREE.MeshStandardMaterial({
      color: primaryColor,
      roughness: 0.2,
      metalness: 0.3
    });

    const bodySecondaryMat = new THREE.MeshStandardMaterial({
      color: 0x1a1c24,
      roughness: 0.4,
      metalness: 0.2
    });

    const metalMat = new THREE.MeshStandardMaterial({
      color: darkMetalColor,
      roughness: 0.3,
      metalness: 0.7
    });

    const tireMat = new THREE.MeshStandardMaterial({
      color: tireColor,
      roughness: 0.9,
      metalness: 0.1
    });

    const rimMat = new THREE.MeshStandardMaterial({
      color: chromeColor,
      roughness: 0.2,
      metalness: 0.6
    });

    const glowLightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const tailLightMat = new THREE.MeshBasicMaterial({ color: 0xff0033 });

    // 1. Chunky Go-Kart Main Chassis
    const chassisGeo = new THREE.BoxGeometry(1.6, 0.4, 2.5);
    const chassis = new THREE.Mesh(chassisGeo, bodyMat);
    chassis.position.y = 0.45;
    chassis.castShadow = true;
    chassis.receiveShadow = true;
    root.add(chassis);

    // Front rounded nose cone
    const noseGeo = new THREE.CylinderGeometry(0.5, 0.8, 0.8, 12);
    const nose = new THREE.Mesh(noseGeo, bodyMat);
    nose.rotation.x = Math.PI / 2;
    nose.position.set(0, 0.42, 1.4);
    nose.castShadow = true;
    root.add(nose);

    // Side pods with racing intake
    const podGeo = new THREE.BoxGeometry(0.35, 0.35, 1.7);
    const leftPod = new THREE.Mesh(podGeo, bodySecondaryMat);
    leftPod.position.set(-0.9, 0.45, -0.1);
    leftPod.castShadow = true;

    const rightPod = new THREE.Mesh(podGeo, bodySecondaryMat);
    rightPod.position.set(0.9, 0.45, -0.1);
    rightPod.castShadow = true;
    root.add(leftPod, rightPod);

    // Front Bumper / Skid Plate
    const bumperGeo = new THREE.BoxGeometry(1.9, 0.2, 0.3);
    const bumper = new THREE.Mesh(bumperGeo, metalMat);
    bumper.position.set(0, 0.32, 1.6);
    root.add(bumper);

    // Headlights
    const lightGeo = new THREE.BoxGeometry(0.3, 0.14, 0.1);
    const hlLeft = new THREE.Mesh(lightGeo, glowLightMat);
    hlLeft.position.set(-0.6, 0.48, 1.55);
    const hlRight = new THREE.Mesh(lightGeo, glowLightMat);
    hlRight.position.set(0.6, 0.48, 1.55);
    root.add(hlLeft, hlRight);

    // Taillights
    const tlLeft = new THREE.Mesh(lightGeo, tailLightMat);
    tlLeft.position.set(-0.6, 0.52, -1.26);
    const tlRight = new THREE.Mesh(lightGeo, tailLightMat);
    tlRight.position.set(0.6, 0.52, -1.26);
    root.add(tlLeft, tlRight);

    // Racing Rear Wing / Spoiler
    const wingGeo = new THREE.BoxGeometry(1.8, 0.1, 0.45);
    const wing = new THREE.Mesh(wingGeo, bodyMat);
    wing.position.set(0, 1.15, -1.15);
    wing.rotation.x = 0.15;
    wing.castShadow = true;

    const strutGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.6);
    const strutLeft = new THREE.Mesh(strutGeo, metalMat);
    strutLeft.position.set(-0.55, 0.85, -1.1);
    const strutRight = new THREE.Mesh(strutGeo, metalMat);
    strutRight.position.set(0.55, 0.85, -1.1);
    root.add(wing, strutLeft, strutRight);

    // 4 Rear Chrome Exhaust Pipes (matching screenshot)
    const exhaustGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.45, 10);
    const exhaustMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.9, roughness: 0.1 });
    const ex1 = new THREE.Mesh(exhaustGeo, exhaustMat);
    ex1.rotation.x = Math.PI / 2;
    ex1.position.set(-0.48, 0.45, -1.35);

    const ex2 = new THREE.Mesh(exhaustGeo, exhaustMat);
    ex2.rotation.x = Math.PI / 2;
    ex2.position.set(-0.2, 0.45, -1.35);

    const ex3 = new THREE.Mesh(exhaustGeo, exhaustMat);
    ex3.rotation.x = Math.PI / 2;
    ex3.position.set(0.2, 0.45, -1.35);

    const ex4 = new THREE.Mesh(exhaustGeo, exhaustMat);
    ex4.rotation.x = Math.PI / 2;
    ex4.position.set(0.48, 0.45, -1.35);

    root.add(ex1, ex2, ex3, ex4);

    // 2. Smash Karts Style Driver Characters
    const driverGroup = new THREE.Group();
    driverGroup.position.set(0, 0.65, -0.1);

    // Driver Torso
    const torsoGeo = new THREE.BoxGeometry(0.6, 0.45, 0.4);
    const torso = new THREE.Mesh(torsoGeo, bodySecondaryMat);
    torso.position.y = 0.2;
    driverGroup.add(torso);

    // Steering wheel
    const wheelGeo = new THREE.TorusGeometry(0.18, 0.04, 6, 12);
    const steerWheel = new THREE.Mesh(wheelGeo, metalMat);
    steerWheel.position.set(0, 0.52, 0.35);
    steerWheel.rotation.x = -Math.PI / 3;
    driverGroup.add(steerWheel);

    // Character Head Builder
    KartMeshBuilder.buildCharacterHead(driverGroup, characterType, primaryColor);

    root.add(driverGroup);

    // 3. Oversized Cartoon Go-Kart Wheels
    const wheelRadius = 0.38;
    const wheelWidth = 0.32;
    const tireGeo = new THREE.CylinderGeometry(wheelRadius, wheelRadius, wheelWidth, 16);
    const rimGeo = new THREE.CylinderGeometry(wheelRadius * 0.58, wheelRadius * 0.58, wheelWidth + 0.02, 10);

    function buildWheelMesh() {
      const g = new THREE.Group();
      const tire = new THREE.Mesh(tireGeo, tireMat);
      tire.rotation.z = Math.PI / 2;
      tire.castShadow = true;
      const rim = new THREE.Mesh(rimGeo, rimMat);
      rim.rotation.z = Math.PI / 2;
      g.add(tire, rim);
      return g;
    }

    // Front Wheels with Pivots for realistic steering
    const flWheel = buildWheelMesh();
    const frWheel = buildWheelMesh();
    const rlWheel = buildWheelMesh();
    const rrWheel = buildWheelMesh();

    const flPivot = new THREE.Group();
    flPivot.position.set(-1.05, wheelRadius, 0.9);
    flPivot.add(flWheel);

    const frPivot = new THREE.Group();
    frPivot.position.set(1.05, wheelRadius, 0.9);
    frPivot.add(frWheel);

    rlWheel.position.set(-1.08, wheelRadius + 0.05, -0.9);
    rlWheel.scale.set(1.2, 1.2, 1.2);

    rrWheel.position.set(1.08, wheelRadius + 0.05, -0.9);
    rrWheel.scale.set(1.2, 1.2, 1.2);

    root.add(flPivot, frPivot, rlWheel, rrWheel);

    // 4. Invulnerability Shield Hologram Sphere
    const shieldGeo = new THREE.SphereGeometry(2.3, 16, 16);
    const shieldMat = new THREE.MeshBasicMaterial({
      color: neonCyan,
      transparent: true,
      opacity: 0,
      wireframe: true
    });
    const shieldMesh = new THREE.Mesh(shieldGeo, shieldMat);
    shieldMesh.position.y = 0.9;
    root.add(shieldMesh);

    // 5. Star Boost Fire Aura
    const starAuraGeo = new THREE.SphereGeometry(2.5, 16, 16);
    const starAuraMat = new THREE.MeshBasicMaterial({
      color: 0xffea00,
      transparent: true,
      opacity: 0,
      wireframe: true
    });
    const starAuraMesh = new THREE.Mesh(starAuraGeo, starAuraMat);
    starAuraMesh.position.y = 0.9;
    root.add(starAuraMesh);

    // 6. 3D Floating Nameplate with HP Bar
    const nameSprite = KartMeshBuilder.createNameTagSprite(name, colorHex);
    nameSprite.position.set(0, 2.6, 0);
    root.add(nameSprite);

    // 7. 3D Weapon Mount Group (shows active rocket launchers, mines, lasers, boost jets on kart)
    const weaponMountGroup = new THREE.Group();
    root.add(weaponMountGroup);

    return {
      root,
      chassis,
      flPivot,
      frPivot,
      flWheel,
      frWheel,
      rlWheel,
      rrWheel,
      shieldMesh,
      starAuraMesh,
      nameSprite,
      driverGroup,
      weaponMountGroup
    };
  }

  static setMountedWeapon(meshObj, weaponType) {
    if (!meshObj || !meshObj.weaponMountGroup) return;
    const g = meshObj.weaponMountGroup;

    // Clear existing mounted meshes
    while (g.children.length > 0) {
      g.remove(g.children[0]);
    }

    if (!weaponType) return;

    if (weaponType === 'ROCKET') {
      // Dual side rocket launcher pods (matching Smash Karts)
      const podMat = new THREE.MeshStandardMaterial({ color: 0x0288d1, roughness: 0.3, metalness: 0.4 });
      const missileMat = new THREE.MeshStandardMaterial({ color: 0xff1744, roughness: 0.2 });
      const tipMat = new THREE.MeshStandardMaterial({ color: 0xffea00, roughness: 0.2 });

      [-0.88, 0.88].forEach(xSide => {
        const pod = new THREE.Group();
        pod.position.set(xSide, 0.88, 0.0);

        // Cylindrical Pod
        const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 1.1, 10), podMat);
        tube.rotation.x = Math.PI / 2;
        pod.add(tube);

        // Rocket nose protruding
        const rocket = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.4, 8), missileMat);
        rocket.rotation.x = Math.PI / 2;
        rocket.position.z = 0.65;
        const tip = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), tipMat);
        tip.position.z = 0.85;
        pod.add(rocket, tip);

        g.add(pod);
      });
    } else if (weaponType === 'MINE') {
      // 3 Spiked Mines mounted on rear spoiler rack
      const rackMat = new THREE.MeshStandardMaterial({ color: 0x1f2430, metalness: 0.8 });
      const mineMat = new THREE.MeshStandardMaterial({ color: 0x222638, roughness: 0.3 });
      const beaconMat = new THREE.MeshBasicMaterial({ color: 0x00e676 });

      const rack = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 0.2), rackMat);
      rack.position.set(0, 1.15, -1.05);
      g.add(rack);

      [-0.5, 0, 0.5].forEach(x => {
        const m = new THREE.Group();
        m.position.set(x, 1.25, -1.05);
        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.14, 8), mineMat);
        const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), beaconMat);
        beacon.position.y = 0.12;
        m.add(body, beacon);
        g.add(m);
      });
    } else if (weaponType === 'GATLING') {
      // Dual high-tech laser cannons on front bumper
      const gunMat = new THREE.MeshStandardMaterial({ color: 0x212121, metalness: 0.8 });
      const muzzleMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff });

      [-0.5, 0.5].forEach(x => {
        const gun = new THREE.Group();
        gun.position.set(x, 0.46, 1.6);
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.7, 8), gunMat);
        barrel.rotation.x = Math.PI / 2;
        const muzzle = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.03, 6, 12), muzzleMat);
        muzzle.position.z = 0.38;
        gun.add(barrel, muzzle);
        g.add(gun);
      });
    } else if (weaponType === 'BOMB') {
      // Large spiked black bomb in rear catapult holder
      const bombMat = new THREE.MeshStandardMaterial({ color: 0x1a1a24, metalness: 0.8, roughness: 0.3 });
      const fuseMat = new THREE.MeshBasicMaterial({ color: 0xffea00 });

      const bomb = new THREE.Group();
      bomb.position.set(0, 1.25, -0.95);
      const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 10), bombMat);
      const fuse = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.2, 6), fuseMat);
      fuse.position.y = 0.38;
      bomb.add(sphere, fuse);
      g.add(bomb);
    } else if (weaponType === 'BOOST') {
      // Dual Nitro booster exhaust thrusters with glowing neon jet flames
      const nozzleMat = new THREE.MeshStandardMaterial({ color: 0x37474f, metalness: 0.9, roughness: 0.2 });
      const flameMat = new THREE.MeshBasicMaterial({ color: 0xff6d00 });

      [-0.5, 0.5].forEach(x => {
        const jet = new THREE.Group();
        jet.position.set(x, 0.45, -1.3);
        const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 0.45, 10), nozzleMat);
        nozzle.rotation.x = Math.PI / 2;
        const flame = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.6, 8), flameMat);
        flame.rotation.x = -Math.PI / 2;
        flame.position.z = -0.45;
        jet.add(nozzle, flame);
        g.add(jet);
      });
    }
  }

  static buildCharacterHead(driverGroup, characterType, primaryColor) {
    const headGroup = new THREE.Group();
    headGroup.position.y = 0.65;

    // Materials
    const eyeWhiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const eyePupilMat = new THREE.MeshBasicMaterial({ color: 0x111111 });

    function addEyes(group, forwardZ = 0.28, eyeY = 0.05, eyeSpread = 0.15, radius = 0.09) {
      const eyeGeo = new THREE.SphereGeometry(radius, 8, 8);
      const pupilGeo = new THREE.SphereGeometry(radius * 0.55, 6, 6);

      // Left Eye
      const leftEye = new THREE.Mesh(eyeGeo, eyeWhiteMat);
      leftEye.position.set(-eyeSpread, eyeY, forwardZ);
      const leftPupil = new THREE.Mesh(pupilGeo, eyePupilMat);
      leftPupil.position.set(-eyeSpread, eyeY, forwardZ + radius * 0.6);

      // Right Eye
      const rightEye = new THREE.Mesh(eyeGeo, eyeWhiteMat);
      rightEye.position.set(eyeSpread, eyeY, forwardZ);
      const rightPupil = new THREE.Mesh(pupilGeo, eyePupilMat);
      rightPupil.position.set(eyeSpread, eyeY, forwardZ + radius * 0.6);

      group.add(leftEye, leftPupil, rightEye, rightPupil);
    }

    if (characterType === 'alien') {
      // Smash Karts Alien from screenshot (spiky hair, backwards blue cap, pink/cyan headphones)
      const headMat = new THREE.MeshStandardMaterial({ color: 0x44dd22, roughness: 0.5 });
      const headGeo = new THREE.SphereGeometry(0.35, 12, 12);
      const head = new THREE.Mesh(headGeo, headMat);
      head.castShadow = true;
      headGroup.add(head);

      // Spiky green hair
      for (let i = 0; i < 7; i++) {
        const spikeGeo = new THREE.ConeGeometry(0.08, 0.22, 4);
        const spike = new THREE.Mesh(spikeGeo, headMat);
        const a = (i / 7) * Math.PI * 2;
        spike.position.set(Math.cos(a) * 0.24, 0.32, Math.sin(a) * 0.24);
        spike.rotation.x = Math.sin(a) * 0.4;
        spike.rotation.z = -Math.cos(a) * 0.4;
        headGroup.add(spike);
      }

      // Backwards Blue/Cyan Cap
      const capMat = new THREE.MeshStandardMaterial({ color: 0x0099ff, roughness: 0.4 });
      const capGeo = new THREE.SphereGeometry(0.36, 12, 12, 0, Math.PI * 2, 0, Math.PI / 2.2);
      const cap = new THREE.Mesh(capGeo, capMat);
      cap.position.y = 0.05;
      const visorGeo = new THREE.BoxGeometry(0.25, 0.04, 0.22);
      const visor = new THREE.Mesh(visorGeo, capMat);
      visor.position.set(0, 0.2, -0.32);
      visor.rotation.x = 0.2;
      headGroup.add(cap, visor);

      // Side headphones (pink & cyan)
      const phoneGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.12, 10);
      const phoneL = new THREE.Mesh(phoneGeo, new THREE.MeshStandardMaterial({ color: 0xff0066 }));
      phoneL.rotation.z = Math.PI / 2;
      phoneL.position.set(-0.35, 0.05, 0);
      const phoneR = new THREE.Mesh(phoneGeo, new THREE.MeshStandardMaterial({ color: 0x00e5ff }));
      phoneR.rotation.z = Math.PI / 2;
      phoneR.position.set(0.35, 0.05, 0);
      headGroup.add(phoneL, phoneR);

      addEyes(headGroup, 0.28, 0.02, 0.14, 0.09);
    } else if (characterType === 'cat') {
      // Cute Cat Head
      const headMat = new THREE.MeshStandardMaterial({ color: 0xf5a623, roughness: 0.6 });
      const headGeo = new THREE.SphereGeometry(0.34, 12, 12);
      const head = new THREE.Mesh(headGeo, headMat);
      head.castShadow = true;
      headGroup.add(head);

      // Cat Ears
      const earGeo = new THREE.ConeGeometry(0.12, 0.22, 4);
      const earMat = new THREE.MeshStandardMaterial({ color: 0xd98218 });
      const earL = new THREE.Mesh(earGeo, earMat);
      earL.position.set(-0.2, 0.35, 0);
      earL.rotation.z = 0.3;
      const earR = new THREE.Mesh(earGeo, earMat);
      earR.position.set(0.2, 0.35, 0);
      earR.rotation.z = -0.3;
      headGroup.add(earL, earR);

      // Pink nose
      const noseGeo = new THREE.SphereGeometry(0.04, 6, 6);
      const noseMat = new THREE.MeshBasicMaterial({ color: 0xff6699 });
      const nose = new THREE.Mesh(noseGeo, noseMat);
      nose.position.set(0, -0.04, 0.34);
      headGroup.add(nose);

      addEyes(headGroup, 0.28, 0.05, 0.14, 0.09);
    } else if (characterType === 'frog') {
      // Big-eyed Green Frog
      const frogMat = new THREE.MeshStandardMaterial({ color: 0x39ff14, roughness: 0.5 });
      const headGeo = new THREE.SphereGeometry(0.33, 12, 12);
      const head = new THREE.Mesh(headGeo, frogMat);
      head.scale.set(1.15, 0.9, 1.0);
      head.castShadow = true;
      headGroup.add(head);

      // Bulbous top eyes
      const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), eyeWhiteMat);
      eyeL.position.set(-0.2, 0.28, 0.1);
      const pupilL = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), eyePupilMat);
      pupilL.position.set(-0.2, 0.28, 0.21);

      const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), eyeWhiteMat);
      eyeR.position.set(0.2, 0.28, 0.1);
      const pupilR = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), eyePupilMat);
      pupilR.position.set(0.2, 0.28, 0.21);

      headGroup.add(eyeL, pupilL, eyeR, pupilR);
    } else if (characterType === 'ninja') {
      // Ninja with black mask and red headband
      const ninjaMat = new THREE.MeshStandardMaterial({ color: 0x1a1a24, roughness: 0.8 });
      const headGeo = new THREE.SphereGeometry(0.32, 12, 12);
      const head = new THREE.Mesh(headGeo, ninjaMat);
      head.castShadow = true;
      headGroup.add(head);

      // Red headband
      const bandGeo = new THREE.CylinderGeometry(0.33, 0.33, 0.1, 12);
      const bandMat = new THREE.MeshBasicMaterial({ color: 0xff0033 });
      const band = new THREE.Mesh(bandGeo, bandMat);
      band.position.y = 0.12;
      headGroup.add(band);

      addEyes(headGroup, 0.28, 0.04, 0.12, 0.08);
    } else {
      // Default: Racer Helmet with Glossy Visor
      const helmetMat = new THREE.MeshStandardMaterial({ color: primaryColor, roughness: 0.2, metalness: 0.3 });
      const headGeo = new THREE.SphereGeometry(0.34, 12, 12);
      const head = new THREE.Mesh(headGeo, helmetMat);
      head.castShadow = true;
      headGroup.add(head);

      const visorGeo = new THREE.SphereGeometry(0.24, 10, 10, 0, Math.PI * 2, 0, Math.PI / 2);
      const visorMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.9, roughness: 0.1 });
      const visor = new THREE.Mesh(visorGeo, visorMat);
      visor.rotation.x = Math.PI / 2;
      visor.position.set(0, 0.05, 0.2);
      headGroup.add(visor);
    }

    driverGroup.add(headGroup);
  }

  static createNameTagSprite(name, colorHex) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 72;
    const ctx = canvas.getContext('2d');

    // Draw background pill
    ctx.fillStyle = 'rgba(10, 14, 28, 0.8)';
    ctx.fillRect(8, 8, 240, 56);

    ctx.strokeStyle = colorHex || '#00e5ff';
    ctx.lineWidth = 4;
    ctx.strokeRect(8, 8, 240, 56);

    ctx.font = 'bold 26px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(name, 128, 36);

    const texture = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(3.4, 0.95, 1);
    return sprite;
  }
}
