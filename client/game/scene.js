import * as THREE from 'three';

export class ArenaScene {
  constructor(canvas) {
    this.canvas = canvas;
    this.scene = new THREE.Scene();

    // Smash Karts bright sky blue
    this.scene.background = new THREE.Color(0xaae2fc);
    this.scene.fog = new THREE.Fog(0xaae2fc, 110, 260);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 400);
    this.camera.position.set(0, 10, -20);

    this.itemBoxMeshes = new Map();
    this.boostPadMeshes = [];
    this.rampMeshes = [];

    this.setupLighting();
    this.buildSmashKartsMap();

    window.addEventListener('resize', () => this.onWindowResize());
  }

  setupLighting() {
    // Bright cartoon daylight
    const ambient = new THREE.AmbientLight(0xffffff, 1.3);
    this.scene.add(ambient);

    // Warm sun
    const sunLight = new THREE.DirectionalLight(0xfff7e6, 1.8);
    sunLight.position.set(45, 80, 50);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 250;
    const d = 95;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    sunLight.shadow.bias = -0.0003;
    this.scene.add(sunLight);

    // Sky & ground hemisphere bounce
    const hemiLight = new THREE.HemisphereLight(0xb2e8fc, 0x66cc33, 0.7);
    this.scene.add(hemiLight);
  }

  buildSmashKartsMap() {
    const arenaRadius = 78;

    // 1. Base Ground (Checkerboard Grass, Orange Dirt, Grey Asphalt Track)
    const groundCanvas = document.createElement('canvas');
    groundCanvas.width = 2048;
    groundCanvas.height = 2048;
    const gctx = groundCanvas.getContext('2d');

    // Vibrant Green Checkerboard Grass
    const tileSize = 64;
    for (let x = 0; x < 2048; x += tileSize) {
      for (let y = 0; y < 2048; y += tileSize) {
        gctx.fillStyle = ((x / tileSize + y / tileSize) % 2 === 0) ? '#4edb26' : '#41c91f';
        gctx.fillRect(x, y, tileSize, tileSize);
      }
    }

    // Peach / Orange Dirt border zone around perimeter
    gctx.strokeStyle = '#f69548';
    gctx.lineWidth = 140;
    gctx.beginPath();
    gctx.arc(1024, 1024, 880, 0, Math.PI * 2);
    gctx.stroke();

    // Smooth Grey Asphalt Main Track
    gctx.strokeStyle = '#cccccc';
    gctx.lineWidth = 360;
    gctx.beginPath();
    gctx.arc(1024, 1024, 620, 0, Math.PI * 2);
    gctx.stroke();

    // Central cross track connecting across
    gctx.fillStyle = '#cccccc';
    gctx.fillRect(844, 250, 360, 1548);
    gctx.fillRect(250, 844, 1548, 360);

    // Solid White Track Border Lines
    gctx.strokeStyle = '#ffffff';
    gctx.lineWidth = 14;

    // Outer circle line
    gctx.beginPath();
    gctx.arc(1024, 1024, 790, 0, Math.PI * 2);
    gctx.stroke();

    // Inner circle line
    gctx.beginPath();
    gctx.arc(1024, 1024, 450, 0, Math.PI * 2);
    gctx.stroke();

    // White Crosswalk / Starting line stripes
    gctx.fillStyle = '#ffffff';
    for (let i = 0; i < 10; i++) {
      gctx.fillRect(920 + i * 24, 1340, 14, 120);
      gctx.fillRect(920 + i * 24, 580, 14, 120);
    }

    // Yellow starting grid brackets
    gctx.strokeStyle = '#ffcc00';
    gctx.lineWidth = 8;
    for (let i = 0; i < 4; i++) {
      const yPos = 1100 + i * 80;
      gctx.strokeRect(950, yPos, 60, 35);
      gctx.strokeRect(1030, yPos, 60, 35);
    }

    const groundTex = new THREE.CanvasTexture(groundCanvas);
    groundTex.wrapS = THREE.ClampToEdgeWrapping;
    groundTex.wrapT = THREE.ClampToEdgeWrapping;

    const groundGeo = new THREE.PlaneGeometry(arenaRadius * 2, arenaRadius * 2);
    const groundMat = new THREE.MeshStandardMaterial({
      map: groundTex,
      roughness: 0.8,
      metalness: 0.05
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // 2. Purple Outer Perimeter Walls with Rounded Pilasters
    const wallGeo = new THREE.CylinderGeometry(arenaRadius, arenaRadius, 5.5, 64, 1, true);
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x8a1ea5,
      roughness: 0.4,
      metalness: 0.1,
      side: THREE.BackSide
    });
    const wall = new THREE.Mesh(wallGeo, wallMat);
    wall.position.y = 2.75;
    this.scene.add(wall);

    // Top rim of purple wall
    const wallRimGeo = new THREE.TorusGeometry(arenaRadius, 0.45, 8, 64);
    const wallRimMat = new THREE.MeshStandardMaterial({ color: 0xad29ce, roughness: 0.3 });
    const wallRim = new THREE.Mesh(wallRimGeo, wallRimMat);
    wallRim.rotation.x = Math.PI / 2;
    wallRim.position.y = 5.5;
    this.scene.add(wallRim);

    // Rounded Pilasters/Towers around the perimeter
    for (let i = 0; i < 16; i++) {
      const angle = (i / 16) * Math.PI * 2;
      const px = Math.cos(angle) * (arenaRadius - 0.2);
      const pz = Math.sin(angle) * (arenaRadius - 0.2);

      const colGeo = new THREE.CylinderGeometry(1.4, 1.4, 6.2, 12);
      const colMat = new THREE.MeshStandardMaterial({ color: 0x9c27b0, roughness: 0.3 });
      const col = new THREE.Mesh(colGeo, colMat);
      col.position.set(px, 3.1, pz);
      this.scene.add(col);
    }

    // 3. Red Stacked Cylindrical Tire Barriers (just like in screenshot)
    this.createRedTireBarriers();

    // 4. Orange Barrier Rails (just like in screenshot)
    this.createOrangeBarrierRails();

    // 5. Large Purple Ramp, Bridge & Tunnel (Centerpiece of Smash Karts Speedway)
    this.createElevatedBridgeAndRamp();

    // 6. Low-Poly Purple Trees
    this.createPurpleTrees();

    // 7. Speed Boost Pads
    this.createBoostPads();
  }

  createRedTireBarriers() {
    const tireMat = new THREE.MeshStandardMaterial({ color: 0xdd2222, roughness: 0.4 });
    const tireCapMat = new THREE.MeshStandardMaterial({ color: 0x991111, roughness: 0.6 });
    const tireGeo = new THREE.CylinderGeometry(0.7, 0.7, 1.2, 12);
    const capGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.05, 12);

    function createSingleDrum(x, z) {
      const g = new THREE.Group();
      const body = new THREE.Mesh(tireGeo, tireMat);
      body.position.y = 0.6;
      body.castShadow = true;
      const cap = new THREE.Mesh(capGeo, tireCapMat);
      cap.position.y = 1.22;
      g.add(body, cap);
      g.position.set(x, 0, z);
      return g;
    }

    // Outer corner curved barrier row 1 (West corner)
    for (let i = 0; i < 14; i++) {
      const angle = Math.PI * 0.75 + (i / 14) * 0.9;
      const x = Math.cos(angle) * 58;
      const z = Math.sin(angle) * 58;
      this.scene.add(createSingleDrum(x, z));
    }

    // Outer corner barrier row 2 (South corner)
    for (let i = 0; i < 14; i++) {
      const angle = -Math.PI * 0.25 + (i / 14) * 0.9;
      const x = Math.cos(angle) * 58;
      const z = Math.sin(angle) * 58;
      this.scene.add(createSingleDrum(x, z));
    }
  }

  createOrangeBarrierRails() {
    const railMat = new THREE.MeshStandardMaterial({
      color: 0xf57f17,
      roughness: 0.3,
      metalness: 0.1
    });

    // Straight orange divider rails
    const railConfigs = [
      { x: -16, z: 28, rotY: 0, length: 24 },
      { x: 16, z: -28, rotY: 0, length: 24 },
      { x: -32, z: -16, rotY: Math.PI / 2, length: 22 },
      { x: 32, z: 16, rotY: Math.PI / 2, length: 22 }
    ];

    railConfigs.forEach(rc => {
      const geo = new THREE.BoxGeometry(1.4, 1.2, rc.length);
      const mesh = new THREE.Mesh(geo, railMat);
      mesh.position.set(rc.x, 0.6, rc.z);
      mesh.rotation.y = rc.rotY;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
    });
  }

  createElevatedBridgeAndRamp() {
    // 1. Purple Ramp leading up
    const rampWidth = 14;
    const rampLength = 18;
    const rampHeight = 3.6;

    const rampShape = new THREE.Shape();
    rampShape.moveTo(-rampLength / 2, 0);
    rampShape.lineTo(rampLength / 2, rampHeight);
    rampShape.lineTo(rampLength / 2, 0);
    rampShape.lineTo(-rampLength / 2, 0);

    const rampExtrude = { steps: 1, depth: rampWidth, bevelEnabled: false };
    const rampGeo = new THREE.ExtrudeGeometry(rampShape, rampExtrude);
    const rampMat = new THREE.MeshStandardMaterial({ color: 0xba24d6, roughness: 0.4 });

    const ramp1 = new THREE.Mesh(rampGeo, rampMat);
    ramp1.position.set(-18, 0, -rampWidth / 2);
    ramp1.castShadow = true;
    ramp1.receiveShadow = true;
    this.scene.add(ramp1);

    // 2. High Elevated Pink/Magenta Platform with tunnel underneath
    const platGeo = new THREE.BoxGeometry(26, 0.8, 14);
    const platMat = new THREE.MeshStandardMaterial({ color: 0xe84eb8, roughness: 0.35 });
    const platform = new THREE.Mesh(platGeo, platMat);
    platform.position.set(4, 3.6, 0);
    platform.castShadow = true;
    platform.receiveShadow = true;
    this.scene.add(platform);

    // Tunnel Support Columns
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x9c27b0, roughness: 0.5 });
    const p1 = new THREE.Mesh(new THREE.BoxGeometry(2.0, 3.6, 2.0), pillarMat);
    p1.position.set(-7, 1.8, -6);
    const p2 = new THREE.Mesh(new THREE.BoxGeometry(2.0, 3.6, 2.0), pillarMat);
    p2.position.set(-7, 1.8, 6);
    const p3 = new THREE.Mesh(new THREE.BoxGeometry(2.0, 3.6, 2.0), pillarMat);
    p3.position.set(15, 1.8, -6);
    const p4 = new THREE.Mesh(new THREE.BoxGeometry(2.0, 3.6, 2.0), pillarMat);
    p4.position.set(15, 1.8, 6);
    this.scene.add(p1, p2, p3, p4);

    // 3. Orange Lattice Ramp Bridge Section (from screenshot)
    const bridgeShape = new THREE.Shape();
    bridgeShape.moveTo(-rampLength / 2, rampHeight);
    bridgeShape.lineTo(rampLength / 2, 0);
    bridgeShape.lineTo(rampLength / 2, 0);
    bridgeShape.lineTo(-rampLength / 2, 0);

    const bridgeGeo = new THREE.ExtrudeGeometry(bridgeShape, rampExtrude);
    const bridgeMat = new THREE.MeshStandardMaterial({ color: 0xf57c00, roughness: 0.3 });
    const ramp2 = new THREE.Mesh(bridgeGeo, bridgeMat);
    // Connects seamlessly from x = 17 to x = 35
    ramp2.position.set(26, 0, -rampWidth / 2);
    ramp2.castShadow = true;
    ramp2.receiveShadow = true;
    this.scene.add(ramp2);

    // 4. Orange Guardrails along the elevated bridge deck (just like in screenshot)
    const railMat = new THREE.MeshStandardMaterial({ color: 0xf57f17, roughness: 0.3 });
    const railNorth = new THREE.Mesh(new THREE.BoxGeometry(26, 0.9, 0.8), railMat);
    railNorth.position.set(4, 4.4, -6.6);
    const railSouth = new THREE.Mesh(new THREE.BoxGeometry(26, 0.9, 0.8), railMat);
    railSouth.position.set(4, 4.4, 6.6);
    this.scene.add(railNorth, railSouth);

    // 5. Orange Arch Gateway (from screenshot)
    const archMat = new THREE.MeshStandardMaterial({ color: 0xf57c00, roughness: 0.3 });
    const postLeft = new THREE.Mesh(new THREE.BoxGeometry(1.4, 5.0, 1.4), archMat);
    postLeft.position.set(42, 2.5, -8);
    const postRight = new THREE.Mesh(new THREE.BoxGeometry(1.4, 5.0, 1.4), archMat);
    postRight.position.set(42, 2.5, 8);
    const beam = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, 17.4), archMat);
    beam.position.set(42, 5.0, 0);
    this.scene.add(postLeft, postRight, beam);
  }

  createPurpleTrees() {
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0xd98d48, roughness: 0.8 });
    const leavesMat = new THREE.MeshStandardMaterial({ color: 0xb524b5, roughness: 0.6 });

    const treePositions = [
      { x: -50, z: -40 },
      { x: -55, z: 35 },
      { x: 45, z: -45 },
      { x: 50, z: 40 },
      { x: -35, z: 52 },
      { x: 30, z: -55 }
    ];

    treePositions.forEach(tp => {
      const group = new THREE.Group();
      // Trunk
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 3.5, 8), trunkMat);
      trunk.position.y = 1.75;
      trunk.castShadow = true;
      group.add(trunk);

      // Low poly purple crown
      const crown = new THREE.Mesh(new THREE.SphereGeometry(2.4, 7, 6), leavesMat);
      crown.scale.set(1.2, 1.4, 1.2);
      crown.position.y = 4.2;
      crown.castShadow = true;
      group.add(crown);

      group.position.set(tp.x, 0, tp.z);
      this.scene.add(group);
    });
  }

  createBoostPads() {
    const padConfigs = [
      { x: 0, z: 24, rotY: 0 },
      { x: 0, z: -24, rotY: Math.PI },
      { x: 28, z: 0, rotY: Math.PI / 2 },
      { x: -28, z: 0, rotY: -Math.PI / 2 }
    ];

    const padCanvas = document.createElement('canvas');
    padCanvas.width = 128;
    padCanvas.height = 256;
    const pctx = padCanvas.getContext('2d');

    pctx.fillStyle = '#ff8f00';
    pctx.fillRect(0, 0, 128, 256);

    pctx.fillStyle = '#ffffff';
    for (let y = 30; y < 240; y += 65) {
      pctx.beginPath();
      pctx.moveTo(64, y);
      pctx.lineTo(110, y + 40);
      pctx.lineTo(90, y + 40);
      pctx.lineTo(64, y + 16);
      pctx.lineTo(38, y + 40);
      pctx.lineTo(18, y + 40);
      pctx.closePath();
      pctx.fill();
    }

    const padTex = new THREE.CanvasTexture(padCanvas);
    const padGeo = new THREE.PlaneGeometry(4, 7);
    const padMat = new THREE.MeshBasicMaterial({
      map: padTex,
      transparent: true,
      side: THREE.DoubleSide
    });

    padConfigs.forEach(cfg => {
      const mesh = new THREE.Mesh(padGeo, padMat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.rotation.z = cfg.rotY;
      mesh.position.set(cfg.x, 0.04, cfg.z);
      this.scene.add(mesh);
      this.boostPadMeshes.push(mesh);
    });
  }

  // Exact Smash Karts Red/Orange Mystery Box with top '+' and side '?'
  buildItemBoxes(boxesData) {
    for (const mesh of this.itemBoxMeshes.values()) {
      this.scene.remove(mesh);
    }
    this.itemBoxMeshes.clear();

    // Box textures
    const boxSideCanvas = document.createElement('canvas');
    boxSideCanvas.width = 128;
    boxSideCanvas.height = 128;
    const sctx = boxSideCanvas.getContext('2d');

    // Coral / red box body
    sctx.fillStyle = '#ea4e3d';
    sctx.fillRect(0, 0, 128, 128);

    // Border
    sctx.strokeStyle = '#c63627';
    sctx.lineWidth = 10;
    sctx.strokeRect(5, 5, 118, 118);

    // Yellow Diamond
    sctx.fillStyle = '#ffdd00';
    sctx.beginPath();
    sctx.moveTo(64, 18);
    sctx.lineTo(110, 64);
    sctx.lineTo(64, 110);
    sctx.lineTo(18, 64);
    sctx.closePath();
    sctx.fill();

    // Blue '?' question mark
    sctx.fillStyle = '#0066cc';
    sctx.font = 'bold 58px sans-serif';
    sctx.textAlign = 'center';
    sctx.textBaseline = 'middle';
    sctx.fillText('?', 64, 66);

    const sideTex = new THREE.CanvasTexture(boxSideCanvas);

    // Top face canvas with gold '+'
    const topCanvas = document.createElement('canvas');
    topCanvas.width = 128;
    topCanvas.height = 128;
    const tctx = topCanvas.getContext('2d');
    tctx.fillStyle = '#ea4e3d';
    tctx.fillRect(0, 0, 128, 128);
    tctx.fillStyle = '#ffdd00';
    tctx.fillRect(48, 20, 32, 88);
    tctx.fillRect(20, 48, 88, 32);

    const topTex = new THREE.CanvasTexture(topCanvas);

    const materials = [
      new THREE.MeshStandardMaterial({ map: sideTex, roughness: 0.3 }),
      new THREE.MeshStandardMaterial({ map: sideTex, roughness: 0.3 }),
      new THREE.MeshStandardMaterial({ map: topTex, roughness: 0.3 }),
      new THREE.MeshStandardMaterial({ map: topTex, roughness: 0.3 }),
      new THREE.MeshStandardMaterial({ map: sideTex, roughness: 0.3 }),
      new THREE.MeshStandardMaterial({ map: sideTex, roughness: 0.3 })
    ];

    const boxGeo = new THREE.BoxGeometry(1.5, 1.5, 1.5);

    boxesData.forEach(box => {
      const mesh = new THREE.Mesh(boxGeo, materials);
      mesh.position.set(box.x, 1.1, box.z);
      mesh.castShadow = true;
      mesh.visible = box.active;
      this.scene.add(mesh);
      this.itemBoxMeshes.set(box.id, mesh);
    });
  }

  updateItemBoxes(time) {
    for (const mesh of this.itemBoxMeshes.values()) {
      if (mesh.visible) {
        mesh.rotation.y = time * 2.0;
        mesh.position.y = 1.1 + Math.sin(time * 3 + mesh.position.x) * 0.15;
      }
    }
  }

  setItemBoxState(id, active) {
    const mesh = this.itemBoxMeshes.get(id);
    if (mesh) {
      mesh.visible = active;
    }
  }

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
