/**
 * Suika 3D — Fruit Merge Game Engine
 * Three.js 3D Rendering + 2.5D Real Physics + Kawaii Expressions + Web Audio Synthesizer
 */

// --- CONFIGURAÇÃO DAS FRUTAS (11 Níveis) ---
const FRUITS = [
    { level: 0,  name: 'Cereja',     emoji: '🍒', radius: 0.28, color: 0xE63946, points: 2    },
    { level: 1,  name: 'Morango',    emoji: '🍓', radius: 0.38, color: 0xFF4D6D, points: 4    },
    { level: 2,  name: 'Uva',        emoji: '🍇', radius: 0.50, color: 0x7209B7, points: 8    },
    { level: 3,  name: 'Tangerina',  emoji: '🍊', radius: 0.64, color: 0xF77F00, points: 16   },
    { level: 4,  name: 'Laranja',    emoji: '🍋', radius: 0.78, color: 0xFCBF49, points: 32   },
    { level: 5,  name: 'Maçã',       emoji: '🍎', radius: 0.94, color: 0xD90429, points: 64   },
    { level: 6,  name: 'Pera',       emoji: '🍐', radius: 1.10, color: 0x80B918, points: 128  },
    { level: 7,  name: 'Pêssego',    emoji: '🍑', radius: 1.28, color: 0xFFB4A2, points: 256  },
    { level: 8,  name: 'Abacaxi',    emoji: '🍍', radius: 1.48, color: 0xE0A96D, points: 512  },
    { level: 9,  name: 'Melão',      emoji: '🍈', radius: 1.70, color: 0x55A630, points: 1024 },
    { level: 10, name: 'Melancia',   emoji: '🍉', radius: 1.95, color: 0x2B9348, points: 2048 }
];

// Limites da Caixa de Acrílico (Container 3D)
const BOX_WIDTH = 6.4;
const BOX_HEIGHT = 8.5;
const WALL_LEFT = -BOX_WIDTH / 2;
const WALL_RIGHT = BOX_WIDTH / 2;
const FLOOR_Y = -4.2;
const DANGER_Y = 2.8;
const DROP_Y = 3.8;

// --- ESTADO DO JOGO ---
let scene, camera, renderer;
let fruits = [];
let particles = [];
let currentFruitLevel = 0;
let nextFruitLevel = 0;
let dropX = 0;
let isAiming = false;
let canDrop = true;
let score = 0;
let bestScore = parseInt(localStorage.getItem('suika3d_best') || '0', 10);
let isGameOver = false;
let dangerTimer = 0;
let aimingLine, dropperMesh;

// --- SINTETIZADOR DE ÁUDIO WEB (Zero dependência) ---
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;

function initAudio() {
    if (!audioCtx) audioCtx = new AudioCtx();
    if (audioCtx.state === 'suspended') audioCtx.resume();
}

function playPopSound(level) {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    // Frequência sobe com o nível da fruta
    const freq = 260 * Math.pow(1.12, level);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq * 1.5, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(freq, audioCtx.currentTime + 0.08);

    gain.gain.setValueAtTime(0.4, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.12);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + 0.12);
}

function triggerHaptic(duration = 20) {
    if (window.AndroidBridge && window.AndroidBridge.vibrate) {
        window.AndroidBridge.vibrate(duration);
    } else if (navigator.vibrate) {
        navigator.vibrate(duration);
    }
}

// --- TEXTURA DA MELANCIA (Procedural Canvas) ---
function createWatermelonTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    
    // Fundo verde claro
    ctx.fillStyle = '#38B000';
    ctx.fillRect(0, 0, 512, 256);

    // Listras escuras irregulares
    ctx.fillStyle = '#004B23';
    for (let x = 0; x < 512; x += 36) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        for (let y = 0; y <= 256; y += 20) {
            const wave = Math.sin(y * 0.08) * 8;
            ctx.lineTo(x + wave, y);
        }
        ctx.lineWidth = 14;
        ctx.stroke();
    }
    const texture = new THREE.CanvasTexture(canvas);
    return texture;
}

// --- FÁBRICA DE FRUTAS 3D KAWAII ---
function createFruit3D(level) {
    const data = FRUITS[level];
    const group = new THREE.Group();

    // 1. Corpo da Fruta
    let bodyMat;
    if (level === 10) {
        // Melancia com listras
        bodyMat = new THREE.MeshStandardMaterial({
            map: createWatermelonTexture(),
            roughness: 0.35,
            metalness: 0.05
        });
    } else {
        bodyMat = new THREE.MeshStandardMaterial({
            color: data.color,
            roughness: 0.28,
            metalness: 0.08
        });
    }

    const sphereGeo = new THREE.SphereGeometry(data.radius, 32, 24);
    const bodyMesh = new THREE.Mesh(sphereGeo, bodyMat);
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    group.add(bodyMesh);

    // 2. Olhos Kawaii
    const eyeRadius = data.radius * 0.11;
    const eyeGeo = new THREE.SphereGeometry(eyeRadius, 16, 12);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x111111 });

    const pupilGeo = new THREE.SphereGeometry(eyeRadius * 0.35, 8, 8);
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0xFFFFFF });

    // Olho Esquerdo
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-data.radius * 0.35, data.radius * 0.12, data.radius * 0.88);
    const leftPupil = new THREE.Mesh(pupilGeo, pupilMat);
    leftPupil.position.set(-data.radius * 0.32, data.radius * 0.15, data.radius * 0.94);
    group.add(leftEye);
    group.add(leftPupil);

    // Olho Direito
    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(data.radius * 0.35, data.radius * 0.12, data.radius * 0.88);
    const rightPupil = new THREE.Mesh(pupilGeo, pupilMat);
    rightPupil.position.set(data.radius * 0.38, data.radius * 0.15, data.radius * 0.94);
    group.add(rightEye);
    group.add(rightPupil);

    // Bochechas Rosadas
    const blushGeo = new THREE.CircleGeometry(data.radius * 0.12, 12);
    const blushMat = new THREE.MeshBasicMaterial({ color: 0xFF758F, transparent: true, opacity: 0.6 });
    const leftBlush = new THREE.Mesh(blushGeo, blushMat);
    leftBlush.position.set(-data.radius * 0.42, -data.radius * 0.05, data.radius * 0.90);
    const rightBlush = new THREE.Mesh(blushGeo, blushMat);
    rightBlush.position.set(data.radius * 0.42, -data.radius * 0.05, data.radius * 0.90);
    group.add(leftBlush);
    group.add(rightBlush);

    // Cabinho e Folha (para Maçã, Cereja, Tangerina)
    if (level === 0 || level === 3 || level === 5) {
        const stemGeo = new THREE.CylinderGeometry(data.radius * 0.04, data.radius * 0.04, data.radius * 0.35, 8);
        const stemMat = new THREE.MeshStandardMaterial({ color: 0x5C4033 });
        const stem = new THREE.Mesh(stemGeo, stemMat);
        stem.position.set(0, data.radius * 1.05, 0);
        group.add(stem);

        const leafGeo = new THREE.SphereGeometry(data.radius * 0.15, 8, 8);
        leafGeo.scale(1.8, 0.4, 0.8);
        const leafMat = new THREE.MeshStandardMaterial({ color: 0x38B000 });
        const leaf = new THREE.Mesh(leafGeo, leafMat);
        leaf.position.set(data.radius * 0.12, data.radius * 1.15, 0);
        leaf.rotation.z = 0.4;
        group.add(leaf);
    }

    return { group, bodyMesh };
}

// --- CRIAÇÃO DO CENÁRIO 3D ---
function initScene() {
    const canvas = document.getElementById('webgl-canvas');
    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 0.8, 14.5);
    camera.lookAt(0, -0.4, 0);

    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Iluminação de Estúdio Suave
    const ambientLight = new THREE.AmbientLight(0xFFFFFF, 0.7);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xFFFFFF, 0.9);
    dirLight.position.set(4, 10, 8);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    scene.add(dirLight);

    const rimLight = new THREE.DirectionalLight(0xFF9EBB, 0.4);
    rimLight.position.set(-6, -4, -4);
    scene.add(rimLight);

    // Container de Vidro / Acrílico 3D
    createGlassContainer();

    // Linha de Perigo (Deadline)
    createDangerLine();

    // Mira e Nuvem / Soltador
    createDropper();

    // Ajusta tamanho na tela
    window.addEventListener('resize', onWindowResize);
    setupTouchControls();

    // Prepara primeiras frutas
    currentFruitLevel = getRandomStartFruit();
    nextFruitLevel = getRandomStartFruit();
    updateNextFruitUI();

    document.getElementById('best-val').textContent = bestScore;
}

function createGlassContainer() {
    const glassMat = new THREE.MeshPhysicalMaterial({
        color: 0xFFFFFF,
        transparent: true,
        opacity: 0.18,
        roughness: 0.1,
        metalness: 0.1,
        clearcoat: 1.0,
        transmission: 0.6
    });

    const edgeMat = new THREE.MeshStandardMaterial({
        color: 0xFFFFFF,
        roughness: 0.2
    });

    // Fundo sutil da caixa
    const backGeo = new THREE.PlaneGeometry(BOX_WIDTH, BOX_HEIGHT);
    const backMesh = new THREE.Mesh(backGeo, glassMat);
    backMesh.position.set(0, 0, -0.8);
    scene.add(backMesh);

    // Bordas de contorno cilíndricas elegantes
    const radius = 0.06;
    const leftEdgeGeo = new THREE.CylinderGeometry(radius, radius, BOX_HEIGHT, 16);
    const leftEdge = new THREE.Mesh(leftEdgeGeo, edgeMat);
    leftEdge.position.set(WALL_LEFT, 0, 0);
    scene.add(leftEdge);

    const rightEdge = new THREE.Mesh(leftEdgeGeo, edgeMat);
    rightEdge.position.set(WALL_RIGHT, 0, 0);
    scene.add(rightEdge);

    const floorEdgeGeo = new THREE.CylinderGeometry(radius, radius, BOX_WIDTH, 16);
    const floorEdge = new THREE.Mesh(floorEdgeGeo, edgeMat);
    floorEdge.rotation.z = Math.PI / 2;
    floorEdge.position.set(0, FLOOR_Y, 0);
    scene.add(floorEdge);
}

function createDangerLine() {
    const points = [
        new THREE.Vector3(WALL_LEFT, DANGER_Y, 0),
        new THREE.Vector3(WALL_RIGHT, DANGER_Y, 0)
    ];
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineDashedMaterial({
        color: 0xFF477E,
        dashSize: 0.25,
        gapSize: 0.15,
        linewidth: 2
    });
    const line = new THREE.Line(geo, mat);
    line.computeLineDistances();
    scene.add(line);
}

function createDropper() {
    // Linha guia vertical pontilhada
    const points = [
        new THREE.Vector3(0, DROP_Y, 0),
        new THREE.Vector3(0, FLOOR_Y, 0)
    ];
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineDashedMaterial({
        color: 0xFFFFFF,
        dashSize: 0.15,
        gapSize: 0.1,
        transparent: true,
        opacity: 0.4
    });
    aimingLine = new THREE.Line(geo, mat);
    aimingLine.computeLineDistances();
    scene.add(aimingLine);

    // Nuvem / Guia Superior
    dropperMesh = new THREE.Group();
    scene.add(dropperMesh);
    updateDropperPreview();
}

function updateDropperPreview() {
    // Remove fruta anterior da mira
    while (dropperMesh.children.length > 0) {
        dropperMesh.remove(dropperMesh.children[0]);
    }
    if (isGameOver) return;

    const { group } = createFruit3D(currentFruitLevel);
    dropperMesh.add(group);
    dropperMesh.position.set(dropX, DROP_Y, 0);
    aimingLine.position.x = dropX;
}

function getRandomStartFruit() {
    // Apenas frutas pequenas iniciais (Cereja, Morango, Uva, Tangerina, Laranja)
    return Math.floor(Math.random() * 5);
}

function updateNextFruitUI() {
    document.getElementById('next-fruit-emoji').textContent = FRUITS[nextFruitLevel].emoji;
}

// --- CONTROLES DE TOQUE & ARRASTO ---
function setupTouchControls() {
    const canvas = document.getElementById('webgl-canvas');

    function updateDropX(clientX) {
        const normX = (clientX / window.innerWidth) * 2 - 1;
        // Mapeia largura da tela para coordenadas X do mundo 3D
        const maxRange = (BOX_WIDTH / 2) - FRUITS[currentFruitLevel].radius - 0.1;
        dropX = Math.max(-maxRange, Math.min(maxRange, normX * (BOX_WIDTH / 2)));
        if (dropperMesh) dropperMesh.position.x = dropX;
        if (aimingLine) aimingLine.position.x = dropX;
    }

    // Touch
    canvas.addEventListener('touchstart', (e) => {
        initAudio();
        if (isGameOver || !canDrop) return;
        isAiming = true;
        updateDropX(e.touches[0].clientX);
    }, { passive: false });

    canvas.addEventListener('touchmove', (e) => {
        if (!isAiming || !canDrop) return;
        updateDropX(e.touches[0].clientX);
    }, { passive: false });

    canvas.addEventListener('touchend', () => {
        if (!isAiming || !canDrop) return;
        isAiming = false;
        dropFruit();
    });

    // Mouse (para testes)
    canvas.addEventListener('mousedown', (e) => {
        initAudio();
        if (isGameOver || !canDrop) return;
        isAiming = true;
        updateDropX(e.clientX);
    });

    window.addEventListener('mousemove', (e) => {
        if (!isAiming || !canDrop) return;
        updateDropX(e.clientX);
    });

    window.addEventListener('mouseup', () => {
        if (!isAiming || !canDrop) return;
        isAiming = false;
        dropFruit();
    });
}

function dropFruit() {
    canDrop = false;
    triggerHaptic(15);

    // Instancia a nova fruta física no topo
    spawnFruit(dropX, DROP_Y, currentFruitLevel, 0, -1.0);

    // Prepara a próxima fruta com delay agradável
    setTimeout(() => {
        currentFruitLevel = nextFruitLevel;
        nextFruitLevel = getRandomStartFruit();
        updateNextFruitUI();
        updateDropperPreview();
        canDrop = true;
    }, 450);
}

// --- SISTEMA FÍSICO 2.5D ---
function spawnFruit(x, y, level, vx = 0, vy = 0) {
    const data = FRUITS[level];
    const { group, bodyMesh } = createFruit3D(level);
    group.position.set(x, y, 0);
    scene.add(group);

    const fruit = {
        id: Math.random().toString(36).substr(2, 9),
        level,
        radius: data.radius,
        mass: data.radius * data.radius * 2.0,
        x,
        y,
        vx,
        vy,
        rotationZ: 0,
        vRotZ: (Math.random() - 0.5) * 1.5,
        group,
        bodyMesh,
        merged: false
    };

    fruits.push(fruit);
    return fruit;
}

function updatePhysics(dt) {
    const gravity = -16.0;
    const restitution = 0.25; // Quique suave e suculento
    const friction = 0.96;

    // 1. Integração de Movimento & Gravidade
    for (let f of fruits) {
        if (f.merged) continue;
        f.vy += gravity * dt;
        f.x += f.vx * dt;
        f.y += f.vy * dt;
        f.rotationZ += f.vRotZ * dt;
        f.vRotZ *= 0.98;

        // Colisão com o Chão
        if (f.y - f.radius < FLOOR_Y) {
            f.y = FLOOR_Y + f.radius;
            f.vy = -f.vy * restitution;
            f.vx *= friction;
            if (Math.abs(f.vy) < 0.2) f.vy = 0;
        }

        // Colisão com Parede Esquerda
        if (f.x - f.radius < WALL_LEFT) {
            f.x = WALL_LEFT + f.radius;
            f.vx = -f.vx * restitution;
        }

        // Colisão com Parede Direita
        if (f.x + f.radius > WALL_RIGHT) {
            f.x = WALL_RIGHT - f.radius;
            f.vx = -f.vx * restitution;
        }
    }

    // 2. Colisão Círculo-Círculo & Fusão de Pares
    for (let i = 0; i < fruits.length; i++) {
        for (let j = i + 1; j < fruits.length; j++) {
            const a = fruits[i];
            const b = fruits[j];
            if (a.merged || b.merged) continue;

            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const minDist = a.radius + b.radius;

            if (dist < minDist && dist > 0.0001) {
                // Caso os dois sejam do mesmo nível: FUSÃO!
                if (a.level === b.level && a.level < 10) {
                    mergeFruits(a, b);
                    continue;
                }

                // Colisão elástica normal
                const nx = dx / dist;
                const ny = dy / dist;
                const overlap = minDist - dist;

                // Separação proporcional às massas
                const totalMass = a.mass + b.mass;
                a.x -= nx * overlap * (b.mass / totalMass);
                a.y -= ny * overlap * (b.mass / totalMass);
                b.x += nx * overlap * (a.mass / totalMass);
                b.y += ny * overlap * (a.mass / totalMass);

                // Impulso de velocidade
                const kx = a.vx - b.vx;
                const ky = a.vy - b.vy;
                const p = 2 * (nx * kx + ny * ky) / totalMass;

                a.vx -= p * b.mass * nx * (1 + restitution);
                a.vy -= p * b.mass * ny * (1 + restitution);
                b.vx += p * a.mass * nx * (1 + restitution);
                b.vy += p * a.mass * ny * (1 + restitution);
            }
        }
    }

    // 3. Atualiza Transformações 3D no Three.js
    for (let f of fruits) {
        if (f.merged) continue;
        f.group.position.set(f.x, f.y, 0);
        f.group.rotation.z = f.rotationZ;
    }

    // 4. Verificação de Linha de Perigo (Game Over)
    checkDangerDeadline(dt);
}

// --- FUSÃO DE FRUTAS ---
function mergeFruits(a, b) {
    a.merged = true;
    b.merged = true;

    const midX = (a.x + b.x) / 2;
    const midY = (a.y + b.y) / 2;
    const nextLevel = a.level + 1;

    // Remove do Three.js
    scene.remove(a.group);
    scene.remove(b.group);

    // Efeitos Sonoros & Vibração
    playPopSound(nextLevel);
    triggerHaptic(30);

    // Adiciona Pontos
    const pointsGained = FRUITS[nextLevel].points;
    addScore(pointsGained, midX, midY);

    // Partículas de Suco
    spawnJuiceSplash(midX, midY, FRUITS[a.level].color);

    // Cria a fruta combinada
    const newFruit = spawnFruit(midX, midY, nextLevel, 0, 0.5);

    // Animação de pop (Squash & Stretch)
    newFruit.group.scale.set(1.35, 1.35, 1.35);
    setTimeout(() => {
        if (newFruit.group) newFruit.group.scale.set(1.0, 1.0, 1.0);
    }, 120);

    // Limpa do array
    fruits = fruits.filter(f => !f.merged);
}

// --- PARTICULAS DE SUCO 3D ---
function spawnJuiceSplash(x, y, colorHex) {
    const count = 14;
    const particleGeo = new THREE.SphereGeometry(0.08, 8, 8);
    const particleMat = new THREE.MeshBasicMaterial({ color: colorHex });

    for (let i = 0; i < count; i++) {
        const mesh = new THREE.Mesh(particleGeo, particleMat);
        mesh.position.set(x, y, (Math.random() - 0.5) * 0.4);
        scene.add(mesh);

        const angle = Math.random() * Math.PI * 2;
        const speed = 2.5 + Math.random() * 3.5;
        particles.push({
            mesh,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 0.4,
            maxLife: 0.4
        });
    }
}

function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life -= dt;
        p.vy -= 12.0 * dt; // gravidade na partícula
        p.mesh.position.x += p.vx * dt;
        p.mesh.position.y += p.vy * dt;
        const scale = Math.max(0.01, p.life / p.maxLife);
        p.mesh.scale.set(scale, scale, scale);

        if (p.life <= 0) {
            scene.remove(p.mesh);
            particles.splice(i, 1);
        }
    }
}

// --- PONTUAÇÃO & POPUPS ---
function addScore(pts, worldX, worldY) {
    score += pts;
    document.getElementById('score-val').textContent = score;

    if (score > bestScore) {
        bestScore = score;
        document.getElementById('best-val').textContent = bestScore;
        localStorage.setItem('suika3d_best', bestScore.toString());
    }

    // Popup flutuante na tela
    showScorePopup(pts, worldX, worldY);
}

function showScorePopup(pts, worldX, worldY) {
    const vector = new THREE.Vector3(worldX, worldY, 0).project(camera);
    const screenX = (vector.x * 0.5 + 0.5) * window.innerWidth;
    const screenY = (-(vector.y * 0.5) + 0.5) * window.innerHeight;

    const popup = document.createElement('div');
    popup.className = 'popup-score';
    popup.textContent = `+${pts}`;
    popup.style.left = `${screenX}px`;
    popup.style.top = `${screenY}px`;

    const container = document.getElementById('popups-layer');
    container.appendChild(popup);
    setTimeout(() => popup.remove(), 750);
}

// --- VERIFICAÇÃO DE GAME OVER ---
function checkDangerDeadline(dt) {
    if (isGameOver) return;

    let hasFruitAboveLine = false;
    for (let f of fruits) {
        // Ignora frutas recém-soltadas que ainda estão caindo
        if (f.y + f.radius > DANGER_Y && Math.abs(f.vy) < 0.6) {
            hasFruitAboveLine = true;
            break;
        }
    }

    if (hasFruitAboveLine) {
        dangerTimer += dt;
        if (dangerTimer > 2.8) {
            triggerGameOver();
        }
    } else {
        dangerTimer = Math.max(0, dangerTimer - dt * 2);
    }
}

function triggerGameOver() {
    isGameOver = true;
    triggerHaptic(100);
    document.getElementById('final-score').textContent = score;
    document.getElementById('final-best').textContent = `Recorde: ${bestScore}`;
    document.getElementById('gameover-modal').style.display = 'flex';
}

function restartGame() {
    // Remove todas as frutas
    for (let f of fruits) scene.remove(f.group);
    fruits = [];

    // Remove partículas
    for (let p of particles) scene.remove(p.mesh);
    particles = [];

    score = 0;
    dangerTimer = 0;
    isGameOver = false;
    canDrop = true;

    document.getElementById('score-val').textContent = '0';
    document.getElementById('gameover-modal').style.display = 'none';

    currentFruitLevel = getRandomStartFruit();
    nextFruitLevel = getRandomStartFruit();
    updateNextFruitUI();
    updateDropperPreview();
}

// --- LOOP PRINCIPAL DO JOGO ---
let lastTime = performance.now();

function animate(now) {
    requestAnimationFrame(animate);
    const dt = Math.min((now - lastTime) / 1000, 0.033);
    lastTime = now;

    if (!isGameOver) {
        updatePhysics(dt);
    }
    updateParticles(dt);

    renderer.render(scene, camera);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Inicia ao carregar
window.addEventListener('DOMContentLoaded', () => {
    initScene();
    animate(performance.now());
});
