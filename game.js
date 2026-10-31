/**
 * Suika 3D — Pote Gordinho Kawaii Engine
 * 3D Physics Puzzle with Bulbous Curved Glass Jar, Procedural Kawaii Vinyl Fruits & Web Audio Synthesizer
 */

// --- 1. CONFIGURAÇÃO DAS FRUTAS (13 Níveis: Cereja até Rei Melancia Dourada) ---
const FRUITS = [
    { level: 0,  name: 'Cereja',                emoji: '🍒', radius: 0.32, color: 0xFF1744, points: 2,    stem: true,     model: 'models/cherry.glb',            modelScale: 0.93 },
    { level: 1,  name: 'Morango',               emoji: '🍓', radius: 0.42, color: 0xFF2A6D, points: 4,    seeds: true,    model: 'models/strawberry.glb',        modelScale: 0.97 },
    { level: 2,  name: 'Uva',                   emoji: '🍇', radius: 0.54, color: 0x7B2CBF, points: 8,    grape: true,    model: 'models/grape.glb',             modelScale: 1.14 },
    { level: 3,  name: 'Tangerina',             emoji: '🍊', radius: 0.68, color: 0xFF8500, points: 16,   stem: true,     model: 'models/dekopon.glb',           modelScale: 1.10 },
    { level: 4,  name: 'Laranja',               emoji: '🍋', radius: 0.82, color: 0xFFB703, points: 32,   citrus: true,   model: 'models/persimmon.glb',         modelScale: 1.01 },
    { level: 5,  name: 'Maçã',                  emoji: '🍎', radius: 0.98, color: 0xD90429, points: 64,   apple: true,    model: 'models/apple.glb',             modelScale: 1.08 },
    { level: 6,  name: 'Pera',                  emoji: '🍐', radius: 1.15, color: 0x90BE6D, points: 128,  pear: true,     model: 'models/pear.glb',              modelScale: 1.03 },
    { level: 7,  name: 'Pêssego',               emoji: '🍑', radius: 1.34, color: 0xFFAFCC, points: 256,  peach: true,    model: 'models/peach.glb',             modelScale: 1.10 },
    { level: 8,  name: 'Abacaxi',               emoji: '🍍', radius: 1.55, color: 0xE0A96D, points: 512,  pine: true,     model: 'models/pineapple.glb',         modelScale: 1.04 },
    { level: 9,  name: 'Melão',                 emoji: '🍈', radius: 1.78, color: 0x52B788, points: 1024, melon: true,    model: 'models/melon.glb',             modelScale: 1.05 },
    { level: 10, name: 'Melancia',              emoji: '🍉', radius: 2.05, color: 0x2D6A4F, points: 2048, wm: true,       model: 'models/watermelon.glb',        modelScale: 1.03 },
    { level: 11, name: 'Pitaya',                emoji: '🌸', radius: 2.22, color: 0xFF007F, points: 4096, pitaya: true,   model: 'models/pitaya.glb',            modelScale: 1.06 },
    { level: 12, name: 'Rei Melancia Dourada',  emoji: '👑', radius: 2.38, color: 0xFFD700, points: 8192, goldenWm: true, model: 'models/golden_watermelon.glb', modelScale: 1.04 }
];

const fruitModels = {};
let gltfLoader = null;

function loadFruitModels() {
    if (typeof THREE.GLTFLoader === 'undefined') return;
    gltfLoader = new THREE.GLTFLoader();

    FRUITS.forEach(f => {
        if (!f.model) return;
        gltfLoader.load(f.model, (gltf) => {
            const root = gltf.scene || gltf.scenes[0];
            root.traverse(child => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });

            // Normaliza a escala visual com base no raio horizontal do corpo da fruta
            // (evita usar a altura do talo/coroa que encolhia drasticamente o corpo e gerava vácuo!)
            const bbox = new THREE.Box3().setFromObject(root);
            const size = new THREE.Vector3();
            bbox.getSize(size);
            const horizRadius = Math.max(size.x, size.z) / 2;
            const targetScale = f.modelScale ? f.modelScale : (horizRadius > 0.001 ? (f.radius * 0.99) / horizRadius : 1.0);
            root.scale.set(targetScale, targetScale, targetScale);

            fruitModels[f.level] = root;
            if (currentFruitLevel === f.level && dropperMesh) {
                updateDropperPreview();
            }
        }, undefined, (err) => {
            console.warn(`Fallback procedural para ${f.name}:`, err);
        });
    });
}

// --- 2. GEOMETRIA DO POTE RETANGULAR AMPLIADO (Rectangular Glass Tank) ---
const JAR_FLOOR_Y = -4.3;
const JAR_RIM_Y = 3.1;
const DANGER_Y = 2.4;
const DROP_Y = 3.8;
const JAR_HALF_WIDTH = 2.95; // Largura interna total = 5.9 (cabe Melancia + Laranja lado a lado!)
const JAR_CORNER_R = 0.55;  // Cantos inferiores suavemente arredondados

// Função matemática que define a largura interna permitida em qualquer altura Y
function getJarInnerRadius(y) {
    if (y < JAR_FLOOR_Y + JAR_CORNER_R) {
        const dy = (JAR_FLOOR_Y + JAR_CORNER_R) - y;
        const offset = JAR_CORNER_R - Math.sqrt(Math.max(0, JAR_CORNER_R * JAR_CORNER_R - dy * dy));
        return JAR_HALF_WIDTH - offset;
    }
    return JAR_HALF_WIDTH;
}

// Derivada do perfil para cálculo da normal de colisão na curva
function getJarSlope(y) {
    const dy = 0.05;
    return (getJarInnerRadius(y + dy) - getJarInnerRadius(y - dy)) / (2 * dy);
}

// --- 3. ESTADO GLOBAL ---
let scene, camera, renderer;
let fruits = [];
let particles = [];
let shockwaves = [];
let bgSparkles = [];
let jarMeshGroup;
let aimingLine, aimingBeam, aimingTargetRing, dropperMesh;
let dangerLineMesh = null;
let currentFruitLevel = 0;
let nextFruitLevel = 0;
let dropX = 0;
let isAiming = false;
let canDrop = true;
let score = 0;
let bestScore = parseInt(localStorage.getItem('suika3d_best') || '0', 10);
let isGameOver = false;
let isPaused = false;
let dangerTimer = 0;
let soundEnabled = localStorage.getItem('suika3d_sound') !== 'false';
let hammerMode = false;
let comboCount = 0;
let lastMergeTime = 0;

// Power-ups
let shakeCount = 2;
let hammerCount = 1;
let undoCount = 1;
let lastSpawnedFruit = null;
let shakeTime = 0;

// --- 4. SINTETIZADOR WEB AUDIO HARMONIOSO ---
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;

function initAudio() {
    if (!audioCtx) {
        audioCtx = new AudioCtx();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

// Acorde musical crescente a cada fusão (com suporte a elevação tonal em combos)
function playMergeSound(level, comboMultiplier = 1) {
    if (!soundEnabled || !audioCtx) return;
    const now = audioCtx.currentTime;

    // Frequências da escala maior alegre (Dó maior com oitavas)
    const notes = [
        261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25, 783.99, 880.00, 1046.50
    ];
    const pitchShift = 1 + Math.min(0.6, (comboMultiplier - 1) * 0.12);
    const baseFreq = notes[level % notes.length] * pitchShift;

    // Oscilador 1: Onda Senoidal Quente (Fundamental)
    const osc1 = audioCtx.createOscillator();
    const gain1 = audioCtx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(baseFreq, now);
    osc1.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, now + 0.15);

    gain1.gain.setValueAtTime(0.35, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc1.connect(gain1);
    gain1.connect(audioCtx.destination);
    osc1.start(now);
    osc1.stop(now + 0.35);

    // Oscilador 2: Harmônico Cristalino (Terça maior)
    const osc2 = audioCtx.createOscillator();
    const gain2 = audioCtx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(baseFreq * 1.25, now + 0.03);
    osc2.frequency.exponentialRampToValueAtTime(baseFreq * 2.0, now + 0.2);

    gain2.gain.setValueAtTime(0.2, now + 0.03);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

    osc2.connect(gain2);
    gain2.connect(audioCtx.destination);
    osc2.start(now + 0.03);
    osc2.stop(now + 0.28);
}

// Som especial de sino cintilante para Combos e Conquistas
function playComboChime(count) {
    if (!soundEnabled || !audioCtx) return;
    const now = audioCtx.currentTime;
    const arpeggio = [523.25, 659.25, 783.99, 1046.50, 1318.51];
    const noteCount = Math.min(arpeggio.length, 2 + count);

    for (let i = 0; i < noteCount; i++) {
        const time = now + i * 0.06;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(arpeggio[i], time);

        gain.gain.setValueAtTime(0.18, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.25);

        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(time);
        osc.stop(time + 0.25);
    }
}

function playDropSound() {
    if (!soundEnabled || !audioCtx) return;
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.exponentialRampToValueAtTime(180, now + 0.08);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.08);
}

function playGlassHitSound() {
    if (!soundEnabled || !audioCtx) return;
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800 + Math.random() * 200, now);
    osc.frequency.exponentialRampToValueAtTime(300, now + 0.06);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.06);
}

function triggerHaptic(duration = 20) {
    if (window.AndroidBridge && window.AndroidBridge.vibrate) {
        window.AndroidBridge.vibrate(duration);
    } else if (navigator.vibrate) {
        navigator.vibrate(duration);
    }
}

// --- 5. TEXTURAS PROCEDURAIS & ROSTINHOS KAWAII ---

let FACE_TEXTURES = null;

// Gera a textura facial Kawaii com olhinhos expressivos, brilhos e bochechas
function createKawaiiFaceTexture(type = 'happy') {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    // Fundo transparente
    ctx.clearRect(0, 0, 256, 256);

    const cx = 128;
    const cy = 136;
    const eyeSpacing = 42;

    // 1. Bochechas Rosadas Watercolor (Grandes e fofas)
    ctx.fillStyle = 'rgba(255, 93, 143, 0.48)';
    ctx.beginPath();
    ctx.ellipse(cx - eyeSpacing - 12, cy + 20, 20, 13, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.ellipse(cx + eyeSpacing + 12, cy + 20, 20, 13, 0, 0, Math.PI * 2);
    ctx.fill();

    // 2. Olhos de acordo com a emoção
    if (type === 'happy' || type === 'open_smile') {
        // Olho Esquerdo Brilhante
        ctx.fillStyle = '#221824';
        ctx.beginPath();
        ctx.arc(cx - eyeSpacing, cy, 14.5, 0, Math.PI * 2);
        ctx.fill();

        // Brilho triplo estilo anime
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(cx - eyeSpacing - 4.5, cy - 4.5, 6, 0, Math.PI * 2);
        ctx.arc(cx - eyeSpacing + 4.5, cy + 4, 3, 0, Math.PI * 2);
        ctx.arc(cx - eyeSpacing - 5, cy + 4, 1.8, 0, Math.PI * 2);
        ctx.fill();

        // Olho Direito Brilhante
        ctx.fillStyle = '#221824';
        ctx.beginPath();
        ctx.arc(cx + eyeSpacing, cy, 14.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(cx + eyeSpacing - 4.5, cy - 4.5, 6, 0, Math.PI * 2);
        ctx.arc(cx + eyeSpacing + 4.5, cy + 4, 3, 0, Math.PI * 2);
        ctx.arc(cx + eyeSpacing - 5, cy + 4, 1.8, 0, Math.PI * 2);
        ctx.fill();
    } else if (type === 'wink') {
        // Olho esquerdo aberto
        ctx.fillStyle = '#221824';
        ctx.beginPath();
        ctx.arc(cx - eyeSpacing, cy, 14.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(cx - eyeSpacing - 4.5, cy - 4.5, 6, 0, Math.PI * 2);
        ctx.arc(cx - eyeSpacing + 4.5, cy + 4, 3, 0, Math.PI * 2);
        ctx.fill();

        // Olho direito piscando de lado (arco kawaii ^)
        ctx.strokeStyle = '#221824';
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(cx + eyeSpacing, cy + 4, 13, 1.15 * Math.PI, 1.85 * Math.PI, false);
        ctx.stroke();
    } else if (type === 'blink') {
        // Ambos os olhinhos fechados dormindo/piscando (‿  ‿)
        ctx.strokeStyle = '#221824';
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';

        ctx.beginPath();
        ctx.arc(cx - eyeSpacing, cy + 4, 13, 0.15 * Math.PI, 0.85 * Math.PI, false);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(cx + eyeSpacing, cy + 4, 13, 0.15 * Math.PI, 0.85 * Math.PI, false);
        ctx.stroke();
    } else if (type === 'impact') {
        // Olhinhos apertados de impacto (> <)
        ctx.strokeStyle = '#221824';
        ctx.lineWidth = 7;
        ctx.lineCap = 'round';

        ctx.beginPath();
        ctx.moveTo(cx - eyeSpacing - 12, cy - 9);
        ctx.lineTo(cx - eyeSpacing + 2, cy + 1);
        ctx.lineTo(cx - eyeSpacing - 12, cy + 11);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(cx + eyeSpacing + 12, cy - 9);
        ctx.lineTo(cx + eyeSpacing - 2, cy + 1);
        ctx.lineTo(cx + eyeSpacing + 12, cy + 11);
        ctx.stroke();
    } else if (type === 'scared') {
        // Olhos arregalados de medo (⊙ ⊙) na linha de perigo
        ctx.fillStyle = '#221824';
        ctx.beginPath();
        ctx.arc(cx - eyeSpacing, cy, 16, 0, Math.PI * 2);
        ctx.arc(cx + eyeSpacing, cy, 16, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(cx - eyeSpacing, cy - 3, 4.5, 0, Math.PI * 2);
        ctx.arc(cx + eyeSpacing, cy - 3, 4.5, 0, Math.PI * 2);
        ctx.fill();

        // Gotinha de suor na têmpora
        ctx.fillStyle = '#48CAE4';
        ctx.beginPath();
        ctx.arc(cx + eyeSpacing + 22, cy - 14, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(cx + eyeSpacing + 22, cy - 22);
        ctx.lineTo(cx + eyeSpacing + 26, cy - 14);
        ctx.lineTo(cx + eyeSpacing + 18, cy - 14);
        ctx.closePath();
        ctx.fill();
    }

    // 3. Boquinhas fofas
    if (type === 'open_smile') {
        // Boca aberta com linguinha fofa (igual à Melancia e Pêssego do conceito)
        ctx.fillStyle = '#780016';
        ctx.beginPath();
        ctx.arc(cx, cy + 12, 14, 0.05 * Math.PI, 0.95 * Math.PI, false);
        ctx.closePath();
        ctx.fill();

        // Língua rosa saliente
        ctx.fillStyle = '#FF5D8F';
        ctx.beginPath();
        ctx.arc(cx, cy + 20, 9, 1.05 * Math.PI, 1.95 * Math.PI, true);
        ctx.fill();

        ctx.strokeStyle = '#221824';
        ctx.lineWidth = 4.5;
        ctx.stroke();
    } else if (type === 'scared') {
        // Boquinha pequena em 'o' trêmula
        ctx.strokeStyle = '#221824';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.ellipse(cx, cy + 18, 7, 10, 0, 0, Math.PI * 2);
        ctx.stroke();
    } else if (type === 'impact') {
        // Boquinha ondulada fechada
        ctx.strokeStyle = '#221824';
        ctx.lineWidth = 5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(cx - 10, cy + 15);
        ctx.quadraticCurveTo(cx - 4, cy + 11, cx, cy + 15);
        ctx.quadraticCurveTo(cx + 4, cy + 19, cx + 10, cy + 15);
        ctx.stroke();
    } else {
        // Sorriso curvo clássico
        ctx.strokeStyle = '#221824';
        ctx.lineWidth = 5.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(cx, cy + 12, 11, 0.15 * Math.PI, 0.85 * Math.PI, false);
        ctx.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
}

function initFaceTextures() {
    if (!FACE_TEXTURES) {
        FACE_TEXTURES = {
            happy: createKawaiiFaceTexture('happy'),
            open_smile: createKawaiiFaceTexture('open_smile'),
            wink: createKawaiiFaceTexture('wink'),
            blink: createKawaiiFaceTexture('blink'),
            impact: createKawaiiFaceTexture('impact'),
            scared: createKawaiiFaceTexture('scared')
        };
    }
}

// Textura de Estrela Dourada 5 pontas para partículas e fundo mágico
let starTextureCache = null;
function getStarTexture() {
    if (starTextureCache) return starTextureCache;
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 128, 128);

    const cx = 64, cy = 64, outerR = 54, innerR = 25, spikes = 5;
    let rot = (Math.PI / 2) * 3;
    let step = Math.PI / spikes;

    ctx.beginPath();
    ctx.moveTo(cx, cy - outerR);
    for (let i = 0; i < spikes; i++) {
        let x = cx + Math.cos(rot) * outerR;
        let y = cy + Math.sin(rot) * outerR;
        ctx.lineTo(x, y);
        rot += step;

        x = cx + Math.cos(rot) * innerR;
        y = cy + Math.sin(rot) * innerR;
        ctx.lineTo(x, y);
        rot += step;
    }
    ctx.lineTo(cx, cy - outerR);
    ctx.closePath();

    const grad = ctx.createRadialGradient(cx, cy, 4, cx, cy, outerR);
    grad.addColorStop(0, '#FFFFFF');
    grad.addColorStop(0.35, '#FFF3B0');
    grad.addColorStop(0.8, '#FFB703');
    grad.addColorStop(1, '#FB8500');

    ctx.fillStyle = grad;
    ctx.shadowColor = 'rgba(255, 183, 3, 0.75)';
    ctx.shadowBlur = 12;
    ctx.fill();

    starTextureCache = new THREE.CanvasTexture(canvas);
    return starTextureCache;
}

// Textura com listras orgânicas da Melancia
function createWatermelonTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    // Verde vibrante de fundo com leve gradiente
    const bgGrad = ctx.createLinearGradient(0, 0, 0, 256);
    bgGrad.addColorStop(0, '#38B000');
    bgGrad.addColorStop(0.5, '#70E000');
    bgGrad.addColorStop(1, '#38B000');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 512, 256);

    // Listras onduladas escuras orgânicas
    ctx.fillStyle = '#004B23';
    ctx.strokeStyle = '#004B23';
    for (let x = 0; x < 512; x += 42) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        for (let y = 0; y <= 256; y += 12) {
            const wave = Math.sin(y * 0.08) * 11 + Math.cos(y * 0.16) * 4;
            ctx.lineTo(x + wave, y);
        }
        ctx.lineWidth = 18;
        ctx.stroke();
    }

    return new THREE.CanvasTexture(canvas);
}

// Textura com poros de casca cítrica (Laranja e Tangerina)
function createCitrusTexture(baseColor = '#FF8500') {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, 256, 256);

    // Poros e pontinhos sutis táteis
    for (let i = 0; i < 450; i++) {
        const x = Math.random() * 256;
        const y = Math.random() * 256;
        const isLight = Math.random() > 0.5;
        ctx.fillStyle = isLight ? 'rgba(255, 235, 150, 0.28)' : 'rgba(200, 70, 0, 0.25)';
        ctx.beginPath();
        ctx.arc(x, y, 1.2 + Math.random() * 1.5, 0, Math.PI * 2);
        ctx.fill();
    }
    return new THREE.CanvasTexture(canvas);
}

// Textura suave aveludada do Pêssego (gradiente creme para rosa/coral)
function createPeachTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    const grad = ctx.createLinearGradient(0, 256, 0, 0);
    grad.addColorStop(0, '#FFF3B0');   // Amarelinho creme na base
    grad.addColorStop(0.4, '#FFAFCC'); // Rosa suave
    grad.addColorStop(1, '#FF5D8F');   // Coral rosado no topo
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);

    // Bochechas aveludadas difusas
    const radGrad = ctx.createRadialGradient(128, 120, 10, 128, 120, 110);
    radGrad.addColorStop(0, 'rgba(255, 117, 143, 0.35)');
    radGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = radGrad;
    ctx.fillRect(0, 0, 256, 256);

    return new THREE.CanvasTexture(canvas);
}

// Textura pontilhada do Morango
function createStrawberryTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#FF2A6D';
    ctx.fillRect(0, 0, 256, 256);

    // Sementinhas douradas em gota
    ctx.fillStyle = '#FFEA00';
    for (let y = 14; y < 256; y += 22) {
        const offset = (y % 44 === 0) ? 11 : 0;
        for (let x = 11 + offset; x < 256; x += 22) {
            ctx.beginPath();
            ctx.ellipse(x, y, 2.0, 3.8, 0.15, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    return new THREE.CanvasTexture(canvas);
}

// Textura de escamas/losangos do Abacaxi
function createPineappleTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#E0A96D';
    ctx.fillRect(0, 0, 256, 256);

    ctx.strokeStyle = '#B07538';
    ctx.lineWidth = 3;
    const step = 28;
    for (let x = -256; x < 512; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + 256, 256);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(x + 256, 0);
        ctx.lineTo(x, 256);
        ctx.stroke();
    }

    // Pips centrais escuros em cada losango
    ctx.fillStyle = '#7F4F24';
    for (let y = step / 2; y < 256; y += step) {
        for (let x = step / 2; x < 256; x += step) {
            ctx.beginPath();
            ctx.arc(x, y, 2.5, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    return new THREE.CanvasTexture(canvas);
}

// Textura rendilhada do Melão (Cantaloupe / Yubari King)
function createMelonTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#74C69D';
    ctx.fillRect(0, 0, 256, 256);

    // Rede de linhas cantaloupe
    ctx.strokeStyle = 'rgba(255, 250, 220, 0.55)';
    ctx.lineWidth = 2.5;
    for (let i = 0; i < 30; i++) {
        ctx.beginPath();
        let px = Math.random() * 256;
        let py = Math.random() * 256;
        ctx.moveTo(px, py);
        for (let j = 0; j < 6; j++) {
            px += (Math.random() - 0.5) * 45;
            py += (Math.random() - 0.5) * 45;
            ctx.lineTo(px, py);
        }
        ctx.stroke();
    }
    return new THREE.CanvasTexture(canvas);
}

// Textura da Pitaya (Dragon Fruit)
function createPitayaTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    const grad = ctx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, '#FF007F');
    grad.addColorStop(0.5, '#E60067');
    grad.addColorStop(1, '#C70039');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);

    // Manchinhas de escama dragon fruit
    for (let i = 0; i < 40; i++) {
        const x = Math.random() * 256;
        const y = Math.random() * 256;
        ctx.fillStyle = 'rgba(255, 130, 195, 0.4)';
        ctx.beginPath();
        ctx.ellipse(x, y, 7, 14, (Math.random() - 0.5) * 0.9, 0, Math.PI * 2);
        ctx.fill();
    }
    return new THREE.CanvasTexture(canvas);
}

// Textura da Melancia Dourada Real (Rei Suika)
function createGoldenWatermelonTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    // Fundo dourado reluzente com degradê metálico
    const bgGrad = ctx.createLinearGradient(0, 0, 0, 256);
    bgGrad.addColorStop(0, '#FFE57F');
    bgGrad.addColorStop(0.35, '#FFD700');
    bgGrad.addColorStop(0.7, '#FFC107');
    bgGrad.addColorStop(1, '#FFA000');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 512, 256);

    // Listras nobres de âmbar metálico
    ctx.fillStyle = '#B8860B';
    ctx.strokeStyle = '#B8860B';
    for (let x = 0; x < 512; x += 42) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        for (let y = 0; y <= 256; y += 12) {
            const wave = Math.sin(y * 0.08) * 11 + Math.cos(y * 0.16) * 4;
            ctx.lineTo(x + wave, y);
        }
        ctx.lineWidth = 18;
        ctx.stroke();
    }

    return new THREE.CanvasTexture(canvas);
}

// --- 6. FÁBRICA DE FRUTAS 3D (Com Material de Vinil PBR e Detalhes) ---
function createFruitMesh(level) {
    initFaceTextures();
    const data = FRUITS[level];
    const group = new THREE.Group();

    let bodyMesh;

    if (fruitModels[level]) {
        bodyMesh = fruitModels[level].clone(true);
        group.add(bodyMesh);
    } else {
        // Material de Vinil Esmaltado / Bala de Goma (Clearcoat PBR)
        let bodyMat;
    if (data.goldenWm) {
        bodyMat = new THREE.MeshPhysicalMaterial({
            map: createGoldenWatermelonTexture(),
            roughness: 0.16,
            metalness: 0.55,
            clearcoat: 1.0,
            clearcoatRoughness: 0.05
        });
    } else if (data.pitaya) {
        bodyMat = new THREE.MeshPhysicalMaterial({
            map: createPitayaTexture(),
            roughness: 0.22,
            metalness: 0.04,
            clearcoat: 0.90,
            clearcoatRoughness: 0.08
        });
    } else if (data.wm) {
        bodyMat = new THREE.MeshPhysicalMaterial({
            map: createWatermelonTexture(),
            roughness: 0.22,
            metalness: 0.04,
            clearcoat: 0.92,
            clearcoatRoughness: 0.08
        });
    } else if (data.seeds) {
        bodyMat = new THREE.MeshPhysicalMaterial({
            map: createStrawberryTexture(),
            roughness: 0.25,
            metalness: 0.04,
            clearcoat: 0.88,
            clearcoatRoughness: 0.09
        });
    } else if (data.citrus) {
        bodyMat = new THREE.MeshPhysicalMaterial({
            map: createCitrusTexture(level === 3 ? '#FF8500' : '#FFB703'),
            roughness: 0.24,
            metalness: 0.05,
            clearcoat: 0.86,
            clearcoatRoughness: 0.1
        });
    } else if (data.peach) {
        bodyMat = new THREE.MeshPhysicalMaterial({
            map: createPeachTexture(),
            roughness: 0.26,
            metalness: 0.03,
            clearcoat: 0.82,
            clearcoatRoughness: 0.12
        });
    } else if (data.pine) {
        bodyMat = new THREE.MeshPhysicalMaterial({
            map: createPineappleTexture(),
            roughness: 0.28,
            metalness: 0.06,
            clearcoat: 0.75,
            clearcoatRoughness: 0.14
        });
    } else if (data.melon) {
        bodyMat = new THREE.MeshPhysicalMaterial({
            map: createMelonTexture(),
            roughness: 0.24,
            metalness: 0.04,
            clearcoat: 0.85,
            clearcoatRoughness: 0.1
        });
    } else {
        bodyMat = new THREE.MeshPhysicalMaterial({
            color: data.color,
            roughness: 0.19,
            metalness: 0.05,
            clearcoat: 0.88,
            clearcoatRoughness: 0.07
        });
    }

    // Geometria Base da Fruta
    let bodyMesh;
    if (level === 0) {
        // NÍVEL 0: Cerejinhas Gêmeas (Twin Cherries) conectadas por talo duplo
        bodyMesh = new THREE.Group();
        const singleR = data.radius * 0.86;
        const cherryGeo = new THREE.SphereGeometry(singleR, 24, 20);

        const leftCherry = new THREE.Mesh(cherryGeo, bodyMat);
        leftCherry.position.set(-singleR * 0.48, -singleR * 0.08, 0);
        leftCherry.castShadow = true;
        bodyMesh.add(leftCherry);

        const rightCherry = new THREE.Mesh(cherryGeo, bodyMat);
        rightCherry.position.set(singleR * 0.48, 0, 0);
        rightCherry.castShadow = true;
        bodyMesh.add(rightCherry);

        const stemMat = new THREE.MeshStandardMaterial({ color: 0x38B000, roughness: 0.3 });
        const stemGeo = new THREE.CylinderGeometry(data.radius * 0.04, data.radius * 0.035, data.radius * 0.95, 6);

        const leftStem = new THREE.Mesh(stemGeo, stemMat);
        leftStem.position.set(-singleR * 0.30, data.radius * 0.45, 0);
        leftStem.rotation.z = -0.35;
        bodyMesh.add(leftStem);

        const rightStem = new THREE.Mesh(stemGeo, stemMat);
        rightStem.position.set(singleR * 0.30, data.radius * 0.48, 0);
        rightStem.rotation.z = 0.35;
        bodyMesh.add(rightStem);

        const leafGeo = new THREE.SphereGeometry(data.radius * 0.18, 10, 6);
        leafGeo.scale(1.6, 0.35, 0.7);
        const leaf = new THREE.Mesh(leafGeo, stemMat);
        leaf.position.set(data.radius * 0.1, data.radius * 0.9, 0);
        leaf.rotation.z = 0.4;
        bodyMesh.add(leaf);
    } else if (data.grape) {
        // NÍVEL 2: Cacho de Uvas Orgânico Pleno (sem vãos invisíveis)
        bodyMesh = new THREE.Group();
        const goldenAngle = Math.PI * (3 - Math.sqrt(5));
        const grapeCount = 16;
        const beadRadius = data.radius * 0.38;
        const beadGeo = new THREE.SphereGeometry(beadRadius, 16, 12);

        // Núcleo central arredondado que preenche o interior físico
        const centerMesh = new THREE.Mesh(new THREE.SphereGeometry(data.radius * 0.82, 20, 16), bodyMat);
        bodyMesh.add(centerMesh);

        for (let i = 0; i < grapeCount; i++) {
            const bead = new THREE.Mesh(beadGeo, bodyMat);
            bead.castShadow = true;
            const theta = i * goldenAngle;
            const progress = i / grapeCount;
            const yOffset = (1 - progress) * (data.radius * 0.95) - data.radius * 0.48;
            const radiusAtY = data.radius * (0.80 - progress * 0.22);

            const bx = Math.cos(theta) * radiusAtY;
            const bz = Math.sin(theta) * radiusAtY;
            bead.position.set(bx, yOffset, bz * 0.9);
            bodyMesh.add(bead);
        }

        const stemMat = new THREE.MeshStandardMaterial({ color: 0x4A2E18, roughness: 0.5 });
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, data.radius * 0.4, 6), stemMat);
        stem.position.set(0, data.radius * 0.85, 0);
        bodyMesh.add(stem);

        const leafMat = new THREE.MeshStandardMaterial({ color: 0x55A630, roughness: 0.3 });
        const leaf = new THREE.Mesh(new THREE.SphereGeometry(data.radius * 0.2, 8, 6), leafMat);
        leaf.scale.set(1.5, 0.3, 0.7);
        leaf.position.set(data.radius * 0.14, data.radius * 0.95, 0);
        leaf.rotation.z = 0.4;
        bodyMesh.add(leaf);
    } else if (data.pear) {
        // NÍVEL 6: Pera
        bodyMesh = new THREE.Group();
        const lower = new THREE.Mesh(new THREE.SphereGeometry(data.radius * 0.98, 28, 24), bodyMat);
        lower.position.y = -data.radius * 0.12;
        const upper = new THREE.Mesh(new THREE.SphereGeometry(data.radius * 0.78, 24, 20), bodyMat);
        upper.position.y = data.radius * 0.45;
        bodyMesh.add(lower);
        bodyMesh.add(upper);
    } else if (data.peach) {
        // NÍVEL 7: Pêssego
        const geo = new THREE.SphereGeometry(data.radius, 32, 28);
        bodyMesh = new THREE.Mesh(geo, bodyMat);
        bodyMesh.scale.set(1.05, 0.96, 1.0);
    } else if (data.pitaya) {
        // NÍVEL 11: Pitaya (Dragon Fruit com escamas verdes)
        bodyMesh = new THREE.Group();
        const baseMesh = new THREE.Mesh(new THREE.SphereGeometry(data.radius, 32, 28), bodyMat);
        baseMesh.scale.set(1.0, 1.06, 1.0);
        baseMesh.castShadow = true;
        bodyMesh.add(baseMesh);

        // Escamas de dragão verdes salientes
        const bractGeo = new THREE.ConeGeometry(data.radius * 0.16, data.radius * 0.44, 6);
        const bractMat = new THREE.MeshStandardMaterial({ color: 0x70E000, roughness: 0.35 });
        for (let i = 0; i < 9; i++) {
            const b = new THREE.Mesh(bractGeo, bractMat);
            const ang = (i / 9) * Math.PI * 2;
            const yPos = (Math.sin(i * 1.8) * 0.35) * data.radius;
            b.position.set(Math.cos(ang) * data.radius * 0.88, yPos, Math.sin(ang) * data.radius * 0.88);
            b.rotation.x = Math.sin(ang) * 0.65;
            b.rotation.z = -Math.cos(ang) * 0.65;
            bodyMesh.add(b);
        }
    } else {
        // Esfera padrão
        const geo = new THREE.SphereGeometry(data.radius, 32, 28);
        bodyMesh = new THREE.Mesh(geo, bodyMat);
    }

    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    group.add(bodyMesh);

    // NÍVEL 12: Rei Melancia Dourada com Coroa Real
    if (data.goldenWm) {
        const crownGroup = new THREE.Group();
        const crownBaseMat = new THREE.MeshStandardMaterial({ color: 0xFFD700, metalness: 0.85, roughness: 0.2 });
        const crownRing = new THREE.Mesh(new THREE.CylinderGeometry(data.radius * 0.40, data.radius * 0.44, data.radius * 0.16, 16), crownBaseMat);
        crownGroup.add(crownRing);

        const gemColors = [0xFF0055, 0x00E5FF, 0xFFEE00, 0x00FF66, 0xAA00FF];
        for (let i = 0; i < 5; i++) {
            const ang = (i / 5) * Math.PI * 2;
            const peak = new THREE.Mesh(new THREE.ConeGeometry(data.radius * 0.09, data.radius * 0.28, 6), crownBaseMat);
            peak.position.set(Math.cos(ang) * data.radius * 0.40, data.radius * 0.20, Math.sin(ang) * data.radius * 0.40);
            crownGroup.add(peak);

            const gemMat = new THREE.MeshBasicMaterial({ color: gemColors[i] });
            const gem = new THREE.Mesh(new THREE.SphereGeometry(data.radius * 0.05, 8, 8), gemMat);
            gem.position.set(Math.cos(ang) * data.radius * 0.40, data.radius * 0.34, Math.sin(ang) * data.radius * 0.40);
            crownGroup.add(gem);
        }
        crownGroup.position.set(0, data.radius * 0.96, 0);
        group.add(crownGroup);
    } else if (data.wm) {
        // NÍVEL 10: Melancia clássica com rabo de porco verde encaracolado
        const curlyGeo = new THREE.TorusGeometry(data.radius * 0.16, data.radius * 0.038, 8, 24, Math.PI * 1.55);
        const curlyMat = new THREE.MeshStandardMaterial({ color: 0x38B000, roughness: 0.3 });
        const curly = new THREE.Mesh(curlyGeo, curlyMat);
        curly.position.set(0, data.radius * 0.98, 0);
        curly.rotation.x = Math.PI / 2.2;
        curly.rotation.y = -0.3;
        group.add(curly);

        const leafGeo = new THREE.SphereGeometry(data.radius * 0.2, 10, 6);
        leafGeo.scale(1.7, 0.35, 0.75);
        const leaf = new THREE.Mesh(leafGeo, curlyMat);
        leaf.position.set(data.radius * 0.2, data.radius * 1.04, 0);
        leaf.rotation.z = 0.5;
        group.add(leaf);
    } else if (data.stem || data.apple || data.peach || data.citrus) {
        // Cabinho clássico e folhinha
        const stemGroup = new THREE.Group();
        const stemGeo = new THREE.CylinderGeometry(data.radius * 0.05, data.radius * 0.04, data.radius * 0.45, 8);
        const stemMat = new THREE.MeshStandardMaterial({ color: 0x4A2E18, roughness: 0.5 });
        const stem = new THREE.Mesh(stemGeo, stemMat);
        stem.position.set(0, data.radius * 0.95, 0);
        stem.rotation.z = -0.15;
        stemGroup.add(stem);

        const leafGeo = new THREE.SphereGeometry(data.radius * 0.22, 12, 8);
        leafGeo.scale(1.8, 0.4, 0.8);
        const leafMat = new THREE.MeshStandardMaterial({ color: 0x55A630, roughness: 0.3 });
        const leaf = new THREE.Mesh(leafGeo, leafMat);
        leaf.position.set(data.radius * 0.18, data.radius * 1.05, 0);
        leaf.rotation.z = 0.45;
        stemGroup.add(leaf);

        group.add(stemGroup);
    }

    // Coroa de Folhas (Morango, Abacaxi ou Pitaya)
    if (data.seeds || data.pine || data.pitaya) {
        const crownGroup = new THREE.Group();
        const leafCount = data.pine ? 8 : (data.pitaya ? 7 : 6);
        const crownLeafGeo = new THREE.ConeGeometry(data.radius * 0.18, data.radius * 0.55, 6);
        const crownMat = new THREE.MeshStandardMaterial({ color: 0x38B000, roughness: 0.3 });

        for (let i = 0; i < leafCount; i++) {
            const l = new THREE.Mesh(crownLeafGeo, crownMat);
            const ang = (i / leafCount) * Math.PI * 2;
            l.position.set(Math.cos(ang) * data.radius * 0.2, data.radius * 0.92, Math.sin(ang) * data.radius * 0.2);
            l.rotation.x = Math.sin(ang) * 0.4;
            l.rotation.z = -Math.cos(ang) * 0.4;
            crownGroup.add(l);
        }
        group.add(crownGroup);
    }
    }

    // Rostinho Kawaii Aplicado na Frente
    const initialFace = (level === 10 || level === 7 || level === 12) ? 'open_smile' : (level % 3 === 1 ? 'wink' : 'happy');
    const faceTexture = FACE_TEXTURES[initialFace];
    const faceGeo = new THREE.PlaneGeometry(data.radius * 1.55, data.radius * 1.55);
    const faceMat = new THREE.MeshBasicMaterial({
        map: faceTexture,
        transparent: true,
        depthWrite: false
    });
    const faceMesh = new THREE.Mesh(faceGeo, faceMat);
    faceMesh.position.set(0, 0, data.radius * 0.98);
    if (fruitModels[level]) {
        faceMesh.visible = false;
    }
    group.add(faceMesh);

    return { group, bodyMesh, faceMesh, initialFace };
}

// --- 7. CRIAÇÃO DO POTE RETANGULAR 3D AMPLIADO (Glass Tank com cantos arredondados) ---
function createBulbousJar() {
    jarMeshGroup = new THREE.Group();

    const W_inner = JAR_HALF_WIDTH;
    const T_wall = 0.16;
    const W_outer = W_inner + T_wall;
    const Y_inner_floor = JAR_FLOOR_Y;
    const Y_floor = JAR_FLOOR_Y - T_wall;
    const Y_top = JAR_RIM_Y;
    const R_inner = JAR_CORNER_R;
    const R_outer = R_inner + T_wall;
    const depth = 3.6;

    // 1. Perfil em 'U' Extrudado com Cantos Arredondados e Chanfro Suave
    const shape = new THREE.Shape();
    // Borda externa
    shape.moveTo(-W_outer, Y_top);
    shape.lineTo(-W_outer, Y_floor + R_outer);
    shape.absarc(-W_outer + R_outer, Y_floor + R_outer, R_outer, Math.PI, Math.PI * 1.5, false);
    shape.lineTo(W_outer - R_outer, Y_floor);
    shape.absarc(W_outer - R_outer, Y_floor + R_outer, R_outer, Math.PI * 1.5, Math.PI * 2, false);
    shape.lineTo(W_outer, Y_top);

    // Borda interna
    shape.lineTo(W_inner, Y_top);
    shape.lineTo(W_inner, Y_inner_floor + R_inner);
    shape.absarc(W_inner - R_inner, Y_inner_floor + R_inner, R_inner, 0, -Math.PI * 0.5, true);
    shape.lineTo(-W_inner + R_inner, Y_inner_floor);
    shape.absarc(-W_inner + R_inner, Y_inner_floor + R_inner, R_inner, -Math.PI * 0.5, -Math.PI, true);
    shape.lineTo(-W_inner, Y_top);
    shape.closePath();

    const extrudeSettings = {
        steps: 1,
        depth: depth,
        bevelEnabled: true,
        bevelThickness: 0.05,
        bevelSize: 0.05,
        bevelSegments: 2
    };

    const jarGeo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    jarGeo.translate(0, 0, -depth / 2);

    // Vidro espesso de alto contraste translúcido e cristalino
    const glassMat = new THREE.MeshPhysicalMaterial({
        color: 0xDCF0FF,
        transparent: true,
        opacity: 0.35,
        roughness: 0.04,
        metalness: 0.02,
        clearcoat: 1.0,
        clearcoatRoughness: 0.03,
        transmission: 0.90,
        ior: 1.50,
        depthWrite: false
    });

    const jarMesh = new THREE.Mesh(jarGeo, glassMat);
    jarMesh.renderOrder = 2;
    jarMeshGroup.add(jarMesh);

    // 2. Painel Traseiro de Vidro (Fundo translúcido do aquário)
    const backShape = new THREE.Shape();
    backShape.moveTo(-W_outer, Y_top);
    backShape.lineTo(-W_outer, Y_floor + R_outer);
    backShape.absarc(-W_outer + R_outer, Y_floor + R_outer, R_outer, Math.PI, Math.PI * 1.5, false);
    backShape.lineTo(W_outer - R_outer, Y_floor);
    backShape.absarc(W_outer - R_outer, Y_floor + R_outer, R_outer, Math.PI * 1.5, Math.PI * 2, false);
    backShape.lineTo(W_outer, Y_top);
    backShape.closePath();

    const backGeo = new THREE.ShapeGeometry(backShape);
    const backGlassMat = new THREE.MeshPhysicalMaterial({
        color: 0xC8E6FF,
        transparent: true,
        opacity: 0.22,
        roughness: 0.10,
        metalness: 0.02,
        clearcoat: 0.8,
        depthWrite: false
    });
    const backMesh = new THREE.Mesh(backGeo, backGlassMat);
    backMesh.position.z = -depth / 2;
    jarMeshGroup.add(backMesh);

    // 3. Linhas de Silhueta Frontal Neon (Garante visibilidade máxima e contorno nítido)
    const borderPoints = [];
    borderPoints.push(new THREE.Vector3(-W_inner, Y_top, 0.02));
    borderPoints.push(new THREE.Vector3(-W_inner, Y_inner_floor + R_inner, 0.02));

    const segs = 12;
    // Canto inferior esquerdo: arco suave descendo da parede até o chão
    for (let i = 0; i <= segs; i++) {
        const a = Math.PI + (i / segs) * (Math.PI * 0.5);
        borderPoints.push(new THREE.Vector3(
            -W_inner + R_inner + Math.cos(a) * R_inner,
            Y_inner_floor + R_inner + Math.sin(a) * R_inner,
            0.02
        ));
    }
    // Chão plano horizontal
    borderPoints.push(new THREE.Vector3(W_inner - R_inner, Y_inner_floor, 0.02));
    // Canto inferior direito: arco suave subindo do chão até a parede direita
    for (let i = 0; i <= segs; i++) {
        const a = (Math.PI * 1.5) + (i / segs) * (Math.PI * 0.5);
        borderPoints.push(new THREE.Vector3(
            W_inner - R_inner + Math.cos(a) * R_inner,
            Y_inner_floor + R_inner + Math.sin(a) * R_inner,
            0.02
        ));
    }
    borderPoints.push(new THREE.Vector3(W_inner, Y_top, 0.02));

    const outlineMat = new THREE.LineBasicMaterial({
        color: 0x90D5FF,
        transparent: true,
        opacity: 0.85,
        linewidth: 3
    });
    const outlineLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(borderPoints), outlineMat);
    jarMeshGroup.add(outlineLine);

    // 4. Friso / Anel de acabamento superior nos topos das paredes
    const rimMat = new THREE.MeshPhysicalMaterial({
        color: 0xFFFFFF,
        roughness: 0.08,
        metalness: 0.15,
        clearcoat: 1.0,
        clearcoatRoughness: 0.05
    });

    const rimRadius = 0.05;
    const rimLeftGeo = new THREE.CylinderGeometry(rimRadius, rimRadius, depth, 16);
    const rimLeft = new THREE.Mesh(rimLeftGeo, rimMat);
    rimLeft.rotation.x = Math.PI / 2;
    rimLeft.position.set(-W_inner - T_wall / 2, Y_top + 0.02, 0);
    jarMeshGroup.add(rimLeft);

    const rimRight = rimLeft.clone();
    rimRight.position.x = W_inner + T_wall / 2;
    jarMeshGroup.add(rimRight);

    const rimBackGeo = new THREE.CylinderGeometry(rimRadius, rimRadius, (W_outer * 2), 16);
    const rimBack = new THREE.Mesh(rimBackGeo, rimMat);
    rimBack.rotation.z = Math.PI / 2;
    rimBack.position.set(0, Y_top + 0.02, -depth / 2);
    jarMeshGroup.add(rimBack);

    const rimFront = rimBack.clone();
    rimFront.position.z = depth / 2;
    jarMeshGroup.add(rimFront);

    // 5. Base de Madeira Aconchegante (Suporte retangular robusto e elegante)
    const baseWidth = (W_outer + 0.25) * 2;
    const baseDepth = depth + 0.5;
    const baseHeight = 0.32;
    const tableGeo = new THREE.BoxGeometry(baseWidth, baseHeight, baseDepth);
    const tableMat = new THREE.MeshStandardMaterial({
        color: 0xC89565,
        roughness: 0.45,
        metalness: 0.04
    });
    const tableMesh = new THREE.Mesh(tableGeo, tableMat);
    tableMesh.position.set(0, Y_floor - baseHeight / 2 - 0.01, 0);
    tableMesh.receiveShadow = true;
    jarMeshGroup.add(tableMesh);

    scene.add(jarMeshGroup);
}

// Inicializa partículas de poeira mágica e estrelinhas cintilantes no ar de fundo
function initBackgroundSparkles() {
    const geo = new THREE.PlaneGeometry(0.24, 0.24);
    const starTex = getStarTexture();
    const mat = new THREE.MeshBasicMaterial({
        map: starTex,
        transparent: true,
        opacity: 0.45,
        depthWrite: false
    });

    for (let i = 0; i < 30; i++) {
        const mesh = new THREE.Mesh(geo, mat.clone());
        mesh.position.set(
            (Math.random() - 0.5) * 13,
            JAR_FLOOR_Y + Math.random() * 8.5,
            -2.5 - Math.random() * 3.5
        );
        mesh.material.opacity = 0.15 + Math.random() * 0.35;
        const s = 0.5 + Math.random() * 0.8;
        mesh.scale.set(s, s, s);
        scene.add(mesh);

        bgSparkles.push({
            mesh,
            baseX: mesh.position.x,
            speedY: 0.18 + Math.random() * 0.3,
            wobbleSpeed: 0.8 + Math.random() * 1.8,
            wobbleDist: 0.15 + Math.random() * 0.25,
            rotSpeed: (Math.random() - 0.5) * 1.5
        });
    }
}

function updateBackgroundSparkles(dt) {
    const time = performance.now() * 0.001;
    for (let s of bgSparkles) {
        s.mesh.position.y += s.speedY * dt;
        s.mesh.position.x = s.baseX + Math.sin(time * s.wobbleSpeed) * s.wobbleDist;
        s.mesh.rotation.z += s.rotSpeed * dt;

        // Ao sair pelo topo, reinicia suavemente embaixo
        if (s.mesh.position.y > DROP_Y + 2.0) {
            s.mesh.position.y = JAR_FLOOR_Y - 0.4;
            s.baseX = (Math.random() - 0.5) * 13;
        }
    }
}

// --- 8. ENQUADRAMENTO RESPONSIVO DA CÂMERA & CENA 3D ---
function updateCameraResponsive() {
    if (!camera || !renderer) return;
    const width = window.innerWidth;
    const height = window.innerHeight;
    const aspect = width / height;

    camera.aspect = aspect;

    // Área do jogo que deve caber 100% visível na tela sem nenhum corte:
    // - Largura: pote retangular (largura 5.9) + base de madeira (6.8) + margem confortável
    // - Altura: base de madeira (Y = -4.75) até fruta suspensa no topo (Y = +4.5), total ~9.3 + margem
    const TARGET_WIDTH = 7.6;   // Margem limpa nas laterais em qualquer celular
    const TARGET_HEIGHT = 10.6; // Margem limpa entre o topo do pote e o HUD superior

    const baseFov = 44;
    const tanHalfFov = Math.tan((baseFov * 0.5) * Math.PI / 180);

    // Distância necessária para acomodar largura e altura
    const reqHeight = Math.max(TARGET_HEIGHT, TARGET_WIDTH / aspect);
    const targetZ = reqHeight / (2 * tanHalfFov);

    camera.position.z = targetZ;

    // Ponto focal perfeitamente balanceado entre o HUD do topo e a barra inferior
    const targetCenterY = -0.58;
    camera.position.y = targetCenterY + (targetZ * 0.038);
    camera.position.x = 0;
    camera.lookAt(0, targetCenterY, 0);

    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
}

function initScene() {
    const canvas = document.getElementById('game-canvas');
    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(44, window.innerWidth / window.innerHeight, 0.1, 100);
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    updateCameraResponsive();

    // 1. Luz Ambiente Suave e Clara
    const ambientLight = new THREE.AmbientLight(0xFFFFFF, 0.78);
    scene.add(ambientLight);

    // 2. Luz Principal Quente
    const keyLight = new THREE.DirectionalLight(0xFFFAF0, 1.15);
    keyLight.position.set(5, 12, 9);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    scene.add(keyLight);

    // 3. Luz de Preenchimento Pastel Doce
    const fillLight = new THREE.DirectionalLight(0xE0AAFF, 0.55);
    fillLight.position.set(-6, 4, 6);
    scene.add(fillLight);

    // 4. Luz de Contorno Vindo de Trás (Realça o vidro e o formato bojudo)
    const rimLight = new THREE.DirectionalLight(0xFF758F, 0.70);
    rimLight.position.set(0, -2, -8);
    scene.add(rimLight);

    // Criação do Pote Gordinho
    createBulbousJar();

    // Partículas mágicas do ambiente
    initBackgroundSparkles();

    // Linha de Perigo (Deadline pontilhada reativa)
    createDangerLine();

    // Carrega modelos 3D GLB exportados do Blender
    loadFruitModels();

    // Mira e Fruta Suspensa no Topo (Com feixe de luz suave e alvo no fundo)
    createDropper();

    // Eventos de Toque e Janela
    window.addEventListener('resize', onWindowResize);
    setupControls();

    // Inicia frutas
    currentFruitLevel = getRandomFruit();
    nextFruitLevel = getRandomFruit();
    updateNextFruitUI();

    document.getElementById('best-val').textContent = `BEST: ${bestScore}`;
    updatePowerupUI();
}

function createDangerLine() {
    const r = getJarInnerRadius(DANGER_Y);
    const points = [
        new THREE.Vector3(-r * 0.98, DANGER_Y, 0),
        new THREE.Vector3(r * 0.98, DANGER_Y, 0)
    ];
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineDashedMaterial({
        color: 0xFF5D8F,
        dashSize: 0.25,
        gapSize: 0.15,
        linewidth: 2,
        transparent: true,
        opacity: 0.65
    });
    dangerLineMesh = new THREE.Line(geo, mat);
    dangerLineMesh.computeLineDistances();
    scene.add(dangerLineMesh);
}

function createDropper() {
    // 1. Linha pontilhada clássica fina
    const points = [
        new THREE.Vector3(0, DROP_Y, 0),
        new THREE.Vector3(0, JAR_FLOOR_Y, 0)
    ];
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineDashedMaterial({
        color: 0xFFFFFF,
        dashSize: 0.16,
        gapSize: 0.12,
        transparent: true,
        opacity: 0.45
    });
    aimingLine = new THREE.Line(geo, mat);
    aimingLine.computeLineDistances();
    aimingLine.visible = false;
    scene.add(aimingLine);

    // 2. Feixe de luz translúcido suave (Light Beam) descendo da fruta
    const beamGeo = new THREE.PlaneGeometry(0.32, DROP_Y - JAR_FLOOR_Y);
    const beamMat = new THREE.MeshBasicMaterial({
        color: 0xFFFFFF,
        transparent: true,
        opacity: 0.15,
        side: THREE.DoubleSide,
        depthWrite: false
    });
    aimingBeam = new THREE.Mesh(beamGeo, beamMat);
    aimingBeam.position.set(0, (DROP_Y + JAR_FLOOR_Y) / 2, -0.05);
    aimingBeam.visible = false;
    scene.add(aimingBeam);

    // 3. Disco indicador de aterrissagem no fundo/topo da pilha
    const ringGeo = new THREE.RingGeometry(0.08, 0.38, 24);
    const ringMat = new THREE.MeshBasicMaterial({
        color: 0xFFFFFF,
        transparent: true,
        opacity: 0.35,
        side: THREE.DoubleSide,
        depthWrite: false
    });
    aimingTargetRing = new THREE.Mesh(ringGeo, ringMat);
    aimingTargetRing.rotation.x = Math.PI / 2;
    aimingTargetRing.position.set(0, JAR_FLOOR_Y + 0.05, 0);
    aimingTargetRing.visible = false;
    scene.add(aimingTargetRing);

    dropperMesh = new THREE.Group();
    scene.add(dropperMesh);
    updateDropperPreview();
}

function updateDropperPreview() {
    while (dropperMesh.children.length > 0) {
        dropperMesh.remove(dropperMesh.children[0]);
    }
    if (isGameOver || isPaused) return;

    const { group } = createFruitMesh(currentFruitLevel);
    dropperMesh.add(group);
    dropperMesh.position.set(dropX, DROP_Y, 0);

    // Atualiza a posição X do feixe e da linha de mira
    if (aimingLine) aimingLine.position.x = dropX;
    if (aimingBeam) aimingBeam.position.x = dropX;

    updateAimTargetRing();
}

function updateAimTargetRing() {
    if (!aimingTargetRing) return;
    aimingTargetRing.visible = isAiming;
    if (!isAiming) return;

    let landingY = JAR_FLOOR_Y;
    const curR = FRUITS[currentFruitLevel].radius;
    for (let f of fruits) {
        if (f.merged) continue;
        if (Math.abs(f.x - dropX) < (f.radius + curR) * 0.9) {
            const topY = f.y + f.radius;
            if (topY > landingY) {
                landingY = topY;
            }
        }
    }

    aimingTargetRing.position.set(dropX, landingY + 0.05, 0);
    const ringScale = curR / 0.35;
    aimingTargetRing.scale.set(ringScale, ringScale, 1);
}

function getRandomFruit() {
    // Apenas frutas das primeiras 5 categorias para início justo
    return Math.floor(Math.random() * 5);
}

function updateNextFruitUI() {
    document.getElementById('next-icon').textContent = FRUITS[nextFruitLevel].emoji;
}

// --- 9. CONTROLES (Touch Mobile & Mouse) ---
function setupControls() {
    const canvas = document.getElementById('game-canvas');
    const raycaster = new THREE.Raycaster();
    const planeZ = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const hitPoint = new THREE.Vector3();

    function updateAim(clientX, clientY) {
        if (hammerMode) return;
        const mouse = new THREE.Vector2(
            (clientX / window.innerWidth) * 2 - 1,
            -(clientY / window.innerHeight) * 2 + 1
        );
        raycaster.setFromCamera(mouse, camera);
        if (raycaster.ray.intersectPlane(planeZ, hitPoint)) {
            const neckRadius = Math.max(0.2, getJarInnerRadius(DROP_Y) - FRUITS[currentFruitLevel].radius - 0.08);
            dropX = Math.max(-neckRadius, Math.min(neckRadius, hitPoint.x));
        } else {
            const normX = (clientX / window.innerWidth) * 2 - 1;
            const neckRadius = Math.max(0.2, getJarInnerRadius(DROP_Y) - FRUITS[currentFruitLevel].radius - 0.08);
            dropX = Math.max(-neckRadius, Math.min(neckRadius, normX * 2.2));
        }

        if (dropperMesh) dropperMesh.position.x = dropX;
        if (aimingLine) {
            aimingLine.position.x = dropX;
            aimingLine.visible = true;
        }
        if (aimingBeam) {
            aimingBeam.position.x = dropX;
            aimingBeam.visible = true;
        }
        updateAimTargetRing();
    }

    // Touch
    canvas.addEventListener('touchstart', (e) => {
        initAudio();
        if (isGameOver || isPaused) return;
        if (hammerMode) {
            handleHammerClick(e.touches[0].clientX, e.touches[0].clientY);
            return;
        }
        if (!canDrop) return;
        isAiming = true;
        updateAim(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: false });

    canvas.addEventListener('touchmove', (e) => {
        if (!isAiming || !canDrop || hammerMode) return;
        updateAim(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: false });

    canvas.addEventListener('touchend', () => {
        if (!isAiming || !canDrop || hammerMode) return;
        isAiming = false;
        dropFruit();
    });

    // Mouse
    canvas.addEventListener('mousedown', (e) => {
        initAudio();
        if (isGameOver || isPaused) return;
        if (hammerMode) {
            handleHammerClick(e.clientX, e.clientY);
            return;
        }
        if (!canDrop) return;
        isAiming = true;
        updateAim(e.clientX, e.clientY);
    });

    window.addEventListener('mousemove', (e) => {
        if (!isAiming || !canDrop || hammerMode) return;
        updateAim(e.clientX, e.clientY);
    });

    window.addEventListener('mouseup', () => {
        if (!isAiming || !canDrop || hammerMode) return;
        isAiming = false;
        dropFruit();
    });
}

function dropFruit() {
    canDrop = false;
    isAiming = false;
    if (aimingLine) aimingLine.visible = false;
    if (aimingBeam) aimingBeam.visible = false;
    if (aimingTargetRing) aimingTargetRing.visible = false;
    playDropSound();
    triggerHaptic(18);

    lastSpawnedFruit = spawnFruit(dropX, DROP_Y, currentFruitLevel, 0, -5.2, 1.2);
    updatePowerupUI();

    setTimeout(() => {
        currentFruitLevel = nextFruitLevel;
        nextFruitLevel = getRandomFruit();
        updateNextFruitUI();
        updateDropperPreview();
        canDrop = true;
    }, 360);
}

// --- 10. SIMULAÇÃO FÍSICA NO POTE GORDINHO ---
function spawnFruit(x, y, level, vx = 0, vy = 0, dropGrace = 0) {
    const data = FRUITS[level];
    const { group, bodyMesh, faceMesh, initialFace } = createFruitMesh(level);
    group.position.set(x, y, 0);
    scene.add(group);

    const fruit = {
        id: Math.random().toString(36).substr(2, 9),
        level,
        radius: data.radius,
        mass: data.radius * data.radius * 2.5,
        x,
        y,
        vx,
        vy,
        rotationZ: 0,
        vRotZ: 0,
        dropGrace: dropGrace > 0 ? dropGrace : (y >= DANGER_Y ? 1.4 : 0),
        group,
        bodyMesh,
        faceMesh,
        baseFace: initialFace || 'happy',
        currentFace: initialFace || 'happy',
        blinkTimer: 2.0 + Math.random() * 4.5,
        blinkDuration: 0,
        impactTimer: 0,
        merged: false
    };

    fruits.push(fruit);
    return fruit;
}

function updatePhysics(dt) {
    // Limita delta time para evitar saltos quânticos em travamentos de frame
    const clampedDt = Math.min(dt, 0.033);
    const subSteps = 6;
    const sdt = clampedDt / subSteps;
    const gravity = -36.0;
    const floorFriction = Math.pow(0.965, sdt * 60);
    const airDamping = Math.pow(0.996, sdt * 60);

    for (let step = 0; step < subSteps; step++) {
        // 1. Integrar movimento, gravidade, amortecimento e limites do pote
        for (let i = 0; i < fruits.length; i++) {
            const f = fruits[i];
            if (f.merged) continue;

            f.vy += gravity * sdt;
            f.x += f.vx * sdt;
            f.y += f.vy * sdt;
            f.rotationZ += f.vRotZ * sdt;
            f.vRotZ *= Math.pow(0.70, sdt * 60);
            if (Math.abs(f.vRotZ) < 0.04) f.vRotZ = 0;

            f.vx *= airDamping;
            f.vy *= airDamping;

            if (f.dropGrace > 0) {
                f.dropGrace = Math.max(0, f.dropGrace - sdt);
            }

            // Colisão com o Fundo Plano do Pote (ajuste 0.95 para assentar rente ao vidro)
            const floorContactY = JAR_FLOOR_Y + f.radius * 0.95;
            if (f.y < floorContactY) {
                f.y = floorContactY;
                f.dropGrace = 0; // Tocou no chão, graça encerra
                if (f.vy < 0) {
                    if (Math.abs(f.vy) < 0.8) {
                        f.vy = 0; // Repouso inelástico - para de quicar e assenta
                    } else {
                        f.vy = -f.vy * 0.14; // Quique amortecido
                    }
                }
                f.vx *= floorFriction;
                f.vRotZ *= 0.65;
                if (Math.abs(f.vx) < 0.18 && Math.abs(f.vy) < 0.18) {
                    f.vRotZ = 0;
                }
            }

            // Colisão com a Parede Curva do Pote Gordinho
            const maxR = getJarInnerRadius(f.y) - f.radius * 0.97;
            if (Math.abs(f.x) > maxR) {
                const side = Math.sign(f.x);
                f.x = side * maxR;

                if (f.vx * side > 0) {
                    f.vx = -f.vx * 0.14; // Quique amortecido horizontal
                    f.vy *= 0.95;        // Atrito de deslizamento na parede
                    f.vRotZ *= 0.75;
                    if (Math.abs(f.vx) > 0.8 && step === 0) {
                        playGlassHitSound();
                        f.impactTimer = 0.25;
                        f.currentFace = 'impact';
                    }
                }
            }

            // Teto / Limite de Segurança Superior (impede frutas de voarem para fora da tela)
            const ceilingY = DROP_Y + 0.35;
            if (f.y + f.radius > ceilingY) {
                f.y = ceilingY - f.radius;
                if (f.vy > 0) f.vy = 0;
            }
        }

        // 2. Colisão Círculo-Círculo, Efeito Cunha/Empurrão & Fusão
        for (let i = 0; i < fruits.length; i++) {
            for (let j = i + 1; j < fruits.length; j++) {
                const a = fruits[i];
                const b = fruits[j];
                if (a.merged || b.merged) continue;

                const dx = b.x - a.x;
                const dy = b.y - a.y;
                const distSq = dx * dx + dy * dy;
                // Tolerância snug (0.96): contato físico direto entre cascas das frutas sem lacuna de ar nem clipping exagerado
                const minDist = (a.radius + b.radius) * 0.96;

                if (distSq < minDist * minDist && distSq > 1e-7) {
                    // Tocou em outra fruta: fim da graça de queda livre
                    a.dropGrace = 0;
                    b.dropGrace = 0;

                    // Fusão de frutas do mesmo nível
                    if (a.level === b.level && a.level < FRUITS.length - 1) {
                        mergeFruits(a, b);
                        continue;
                    }

                    const dist = Math.sqrt(distSq);
                    const nx = dx / dist;
                    const ny = dy / dist;
                    const overlap = minDist - dist;

                    const totalMass = a.mass + b.mass;

                    // Separação posicional completa (100% de overlap resolvido)
                    const moveA = overlap * (b.mass / totalMass);
                    const moveB = overlap * (a.mass / totalMass);

                    a.x -= nx * moveA;
                    a.y -= ny * moveA;
                    b.x += nx * moveB;
                    b.y += ny * moveB;

                    // --- DINÂMICA DE CUNHA & EMPURRÃO DE FRUTAS ---
                    // Quando uma fruta de cima se apoia na fruta de baixo, a curvatura
                    // gera um empurrão lateral forte: a fruta de baixo é empurrada pro lado,
                    // e a fruta de cima escorrega ativamente para o vale/vão mais baixo!
                    const topFruit = a.y >= b.y ? a : b;
                    const botFruit = a.y >= b.y ? b : a;
                    const diffX = botFruit.x - topFruit.x;
                    const absDiffX = Math.abs(diffX);
                    // Desempata alinhamentos perfeitamente verticais para evitar pontes estáticas suspensas
                    const pushSign = absDiffX < 0.02 ? ((topFruit.id.charCodeAt(0) % 2 === 0) ? 1 : -1) : Math.sign(diffX);
                    const slope = Math.min(1.0, absDiffX / (dist + 0.001));

                    // Força de cunha proporcional à gravidade e ao peso da fruta de cima
                    const wedgeAccel = Math.abs(gravity) * (0.85 + slope * 1.4);
                    const pushImpulse = wedgeAccel * sdt;

                    // Empurra a fruta de baixo para o lado (abrindo espaço)
                    botFruit.vx += pushSign * pushImpulse * (topFruit.mass / totalMass);
                    // Acelera a fruta de cima pelo declive em direção ao vale
                    topFruit.vx -= pushSign * pushImpulse * (botFruit.mass / totalMass);

                    // Velocidade relativa ao longo da normal
                    const rvx = a.vx - b.vx;
                    const rvy = a.vy - b.vy;
                    const velAlongNormal = rvx * nx + rvy * ny;

                    if (velAlongNormal > 0) {
                        // Restituição orgânica responsiva (toque elástico macio)
                        const restitution = 0.20;
                        const impulse = ((1 + restitution) * velAlongNormal) / totalMass;

                        a.vx -= impulse * b.mass * nx;
                        a.vy -= impulse * b.mass * ny;
                        // Impulso extra no impacto lateral para afastar frutas atingidas
                        b.vx += impulse * a.mass * nx * 1.30;
                        b.vy += impulse * a.mass * ny;

                        // Atrito tangencial suave
                        const tx = -ny;
                        const ty = nx;
                        const velAlongTangent = rvx * tx + rvy * ty;
                        const frictionImpulse = velAlongTangent * 0.08;

                        a.vx -= frictionImpulse * (b.mass / totalMass) * tx;
                        a.vy -= frictionImpulse * (b.mass / totalMass) * ty;
                        b.vx += frictionImpulse * (a.mass / totalMass) * tx;
                        b.vy += frictionImpulse * (a.mass / totalMass) * ty;

                        // Amortecimento rotacional no contato
                        a.vRotZ *= 0.85;
                        b.vRotZ *= 0.85;
                        if (Math.abs(a.vx) < 0.20 && Math.abs(a.vy) < 0.20) a.vRotZ = 0;
                        if (Math.abs(b.vx) < 0.20 && Math.abs(b.vy) < 0.20) b.vRotZ = 0;

                        // Expressão de impacto em batidas fortes
                        if (velAlongNormal > 2.8 && step === 0) {
                            a.impactTimer = 0.24;
                            b.impactTimer = 0.24;
                            a.currentFace = 'impact';
                            b.currentFace = 'impact';
                        }
                    }
                }
            }
        }
    }

    // 3. Atualização das Posições Visuais, Rotação e Rostinhos Dinâmicos
    for (let f of fruits) {
        if (f.merged) continue;
        f.group.position.set(f.x, f.y, 0);
        f.group.rotation.z = f.rotationZ;

        // Estabilização do decal facial: mantém o rostinho voltado ereto para o jogador!
        if (f.faceMesh) {
            f.faceMesh.rotation.z = -f.rotationZ;
        }

        // Lógica de Expressões em Tempo Real
        if (f.impactTimer > 0) {
            f.impactTimer -= dt;
            f.currentFace = 'impact';
            if (f.impactTimer <= 0) f.currentFace = f.baseFace;
        } else if (f.y + f.radius > DANGER_Y - 0.42 && Math.abs(f.vy) < 1.0) {
            // Fruta no topo em pânico!
            f.currentFace = 'scared';
        } else {
            // Respiração e piscadela fofa aleatória
            f.blinkTimer -= dt;
            if (f.blinkTimer <= 0) {
                f.currentFace = 'blink';
                f.blinkDuration = 0.14;
                f.blinkTimer = 2.5 + Math.random() * 5.0;
            }
            if (f.blinkDuration > 0) {
                f.blinkDuration -= dt;
                if (f.blinkDuration <= 0) f.currentFace = f.baseFace;
            }
        }

        // Atualiza a textura se a emoção mudou
        if (FACE_TEXTURES && f.faceMesh && f.faceMesh.material) {
            const targetTex = FACE_TEXTURES[f.currentFace] || FACE_TEXTURES.happy;
            if (f.faceMesh.material.map !== targetTex) {
                f.faceMesh.material.map = targetTex;
                f.faceMesh.material.needsUpdate = true;
            }
        }
    }

    // 4. Verificação de Linha de Perigo (Game Over)
    checkDangerDeadline(dt);
}

// --- 11. FUSÃO DE FRUTAS COM COMBOS & JUICE ÉPICO ---
function mergeFruits(a, b) {
    a.merged = true;
    b.merged = true;

    const midX = (a.x + b.x) / 2;
    const midY = (a.y + b.y) / 2;
    const nextLevel = a.level + 1;

    scene.remove(a.group);
    scene.remove(b.group);

    // Sistema de Combo Rápido (em cascata)
    const nowSec = performance.now() * 0.001;
    if (nowSec - lastMergeTime < 1.85) {
        comboCount++;
    } else {
        comboCount = 1;
    }
    lastMergeTime = nowSec;

    playMergeSound(nextLevel, comboCount);
    triggerHaptic(comboCount > 1 ? 50 : 35);

    if (comboCount > 1) {
        playComboChime(comboCount);
        showComboPopup(comboCount, midX, midY);
    }

    const basePts = FRUITS[nextLevel].points;
    const bonusPts = basePts * comboCount;
    addScore(bonusPts, midX, midY);

    // Efeitos visuais: Shockwave, Estrelas douradas e Splash de suco
    spawnMergeJuice(midX, midY, FRUITS[nextLevel].color, nextLevel);

    // Instancia a nova fruta maior
    const newFruit = spawnFruit(midX, midY, nextLevel, 0, 0.2, 0.2);

    // Efeito elástico elástico suculento "Squash & Stretch"
    newFruit.group.scale.set(1.35, 0.78, 1.25);
    setTimeout(() => {
        if (newFruit.group) newFruit.group.scale.set(0.92, 1.15, 0.95);
        setTimeout(() => {
            if (newFruit.group) newFruit.group.scale.set(1.0, 1.0, 1.0);
        }, 120);
    }, 130);

    fruits = fruits.filter(f => !f.merged);
}

// Explosão de Efeitos na Fusão: Onda de Choque, Estrelas Giratórias e Splash
function spawnMergeJuice(x, y, colorHex, level) {
    // 1. Shockwave expansiva translúcida
    const ringGeo = new THREE.RingGeometry(0.12, 0.28, 36);
    const ringMat = new THREE.MeshBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
        depthWrite: false
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.position.set(x, y, 0.08);
    scene.add(ringMesh);

    shockwaves.push({
        mesh: ringMesh,
        scale: 0.2,
        maxScale: Math.max(1.8, FRUITS[level].radius * 2.8),
        life: 0.38,
        maxLife: 0.38
    });

    // 2. Chuva de Estrelinhas Douradas e Cintilantes (como no Mockup)
    const starCount = 8;
    const starGeo = new THREE.PlaneGeometry(0.36, 0.36);
    const starMat = new THREE.MeshBasicMaterial({
        map: getStarTexture(),
        transparent: true,
        depthWrite: false
    });

    for (let i = 0; i < starCount; i++) {
        const starMesh = new THREE.Mesh(starGeo, starMat);
        starMesh.position.set(x, y, 0.12);
        scene.add(starMesh);

        const ang = (i / starCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
        const speed = 2.6 + Math.random() * 3.8;
        particles.push({
            mesh: starMesh,
            vx: Math.cos(ang) * speed,
            vy: Math.sin(ang) * speed + 2.2,
            vRot: (Math.random() - 0.5) * 8.0,
            life: 0.65,
            maxLife: 0.65,
            isStar: true
        });
    }

    // 3. Gotículas de suco brilhante
    spawnJuiceSplash(x, y, colorHex);

    // 4. Flash dinâmico de luz pontual
    const flashLight = new THREE.PointLight(colorHex, 2.8, 6.0);
    flashLight.position.set(x, y, 1.4);
    scene.add(flashLight);
    setTimeout(() => scene.remove(flashLight), 140);
}

// Gotículas de suco redondo
function spawnJuiceSplash(x, y, colorHex) {
    const count = 18;
    const particleGeo = new THREE.SphereGeometry(0.09, 8, 8);
    const particleMat = new THREE.MeshBasicMaterial({ color: colorHex });

    for (let i = 0; i < count; i++) {
        const mesh = new THREE.Mesh(particleGeo, particleMat);
        mesh.position.set(x, y, (Math.random() - 0.5) * 0.5);
        scene.add(mesh);

        const angle = Math.random() * Math.PI * 2;
        const speed = 2.8 + Math.random() * 4.0;
        particles.push({
            mesh,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 0.45,
            maxLife: 0.45,
            isStar: false
        });
    }
}

function updateShockwaves(dt) {
    for (let i = shockwaves.length - 1; i >= 0; i--) {
        const sw = shockwaves[i];
        sw.life -= dt;
        const progress = 1 - (sw.life / sw.maxLife);
        const currentScale = 0.2 + progress * sw.maxScale;
        sw.mesh.scale.set(currentScale, currentScale, 1);
        sw.mesh.material.opacity = Math.max(0, 0.85 * (1 - progress));

        if (sw.life <= 0) {
            scene.remove(sw.mesh);
            shockwaves.splice(i, 1);
        }
    }
}

function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life -= dt;

        if (p.isStar) {
            p.vy -= 8.5 * dt; // gravidade mais leve para estrelinhas
            p.mesh.position.x += p.vx * dt;
            p.mesh.position.y += p.vy * dt;
            p.mesh.rotation.z += p.vRot * dt;
            p.vx *= 0.96;
            const scale = Math.max(0.01, p.life / p.maxLife);
            p.mesh.scale.set(scale, scale, scale);
            p.mesh.material.opacity = p.life / p.maxLife;
        } else {
            p.vy -= 12.0 * dt;
            p.mesh.position.x += p.vx * dt;
            p.mesh.position.y += p.vy * dt;
            const scale = Math.max(0.01, p.life / p.maxLife);
            p.mesh.scale.set(scale, scale, scale);
        }

        if (p.life <= 0) {
            scene.remove(p.mesh);
            particles.splice(i, 1);
        }
    }
}

// --- 13. PONTUAÇÃO, COMBOS & POPUPS FLUTUANTES ---
function addScore(pts, worldX, worldY) {
    score += pts;
    document.getElementById('score-val').textContent = score;

    if (score > bestScore) {
        bestScore = score;
        document.getElementById('best-val').textContent = `BEST: ${bestScore}`;
        localStorage.setItem('suika3d_best', bestScore.toString());
    }

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
    setTimeout(() => popup.remove(), 800);
}

function showComboPopup(count, worldX, worldY) {
    const vector = new THREE.Vector3(worldX, worldY, 0).project(camera);
    const screenX = (vector.x * 0.5 + 0.5) * window.innerWidth;
    const screenY = (-(vector.y * 0.5) + 0.5) * window.innerHeight;

    const popup = document.createElement('div');
    popup.className = 'popup-combo';
    const labels = ["", "", "COMBO x2! ✨", "COMBO x3! 🔥", "INCRÍVEL! 🍉", "KAWAII! 💖", "FANTÁSTICO! 🌟"];
    popup.textContent = labels[Math.min(count, labels.length - 1)] || `COMBO x${count}! 💥`;
    popup.style.left = `${screenX}px`;
    popup.style.top = `${screenY - 24}px`;

    const container = document.getElementById('popups-layer');
    container.appendChild(popup);
    setTimeout(() => popup.remove(), 1100);
}

// --- 14. POWER-UPS & GANCHOS DE MONETIZAÇÃO ---

function showToast(msg) {
    let toast = document.getElementById('game-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'game-toast';
        toast.style.position = 'absolute';
        toast.style.bottom = '105px';
        toast.style.left = '50%';
        toast.style.transform = 'translateX(-50%)';
        toast.style.background = 'rgba(61, 43, 61, 0.92)';
        toast.style.color = '#FFFFFF';
        toast.style.padding = '8px 20px';
        toast.style.borderRadius = '20px';
        toast.style.fontSize = '14px';
        toast.style.fontWeight = '800';
        toast.style.boxShadow = '0 8px 24px rgba(0,0,0,0.25)';
        toast.style.pointerEvents = 'none';
        toast.style.zIndex = '60';
        toast.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
        document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(-50%) translateY(0)';
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(-50%) translateY(10px)';
    }, 1600);
}

function updatePowerupUI() {
    const badgeShake = document.getElementById('badge-shake');
    const badgeHammer = document.getElementById('badge-hammer');
    const badgeUndo = document.getElementById('badge-undo');
    const btnShake = document.getElementById('btn-shake');
    const btnHammer = document.getElementById('btn-hammer');
    const btnUndo = document.getElementById('btn-undo');
    const banner = document.getElementById('hammer-banner');

    if (badgeShake) badgeShake.textContent = shakeCount;
    if (badgeHammer) badgeHammer.textContent = hammerCount;
    if (badgeUndo) badgeUndo.textContent = undoCount;

    if (btnShake) {
        btnShake.style.opacity = shakeCount > 0 ? '1' : '0.45';
    }
    if (btnHammer) {
        btnHammer.style.opacity = hammerCount > 0 ? '1' : '0.45';
        if (hammerMode) {
            btnHammer.classList.add('active');
        } else {
            btnHammer.classList.remove('active');
        }
    }
    if (btnUndo) {
        const canUndo = undoCount > 0 && lastSpawnedFruit && !lastSpawnedFruit.merged;
        btnUndo.style.opacity = canUndo ? '1' : '0.45';
    }
    if (banner) {
        banner.style.display = hammerMode ? 'block' : 'none';
    }
}

// Power-up 1: Sacudir o Pote (Shake Jar)
function useShakePowerup() {
    if (shakeCount <= 0) {
        showToast("Sem sacudidas restantes! 🫨");
        return;
    }
    if (isGameOver || isPaused || shakeTime > 0) return;

    shakeCount = Math.max(0, shakeCount - 1);
    shakeTime = 1.0;
    triggerHaptic(50);
    updatePowerupUI();

    // Impulso físico controlado (sem arremessar frutas para fora do pote)
    for (let f of fruits) {
        if (f.merged) continue;
        const headroom = Math.max(0, DANGER_Y - f.y);
        const safeUp = Math.min(2.0, headroom * 0.55);
        f.vy = Math.max(f.vy, safeUp) + (Math.random() - 0.5) * 1.5;
        f.vx += (Math.random() - 0.5) * 4.2;
        f.vRotZ += (Math.random() - 0.5) * 4.0;
    }
    showToast("Pote sacudido! 🫨");
}

// Power-up 2: Modo Martelo (Destruir Fruta)
function toggleHammerMode() {
    if (hammerMode) {
        disableHammerMode();
    } else {
        if (hammerCount <= 0) {
            showToast("Sem martelos restantes! 🔨");
            return;
        }
        if (isGameOver || isPaused) return;
        enableHammerMode();
    }
}

function enableHammerMode() {
    hammerMode = true;
    updatePowerupUI();
}

function disableHammerMode() {
    hammerMode = false;
    updatePowerupUI();
}

function handleHammerClick(clientX, clientY) {
    if (!hammerMode || hammerCount <= 0 || isGameOver || isPaused) {
        disableHammerMode();
        return;
    }

    const mouse = new THREE.Vector2(
        (clientX / window.innerWidth) * 2 - 1,
        -(clientY / window.innerHeight) * 2 + 1
    );

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);

    // Procura fruta clicada
    let targetFruit = null;
    let closestDist = Infinity;

    for (let f of fruits) {
        if (f.merged) continue;
        const fruitPos = new THREE.Vector3(f.x, f.y, 0);
        const dist = raycaster.ray.distanceToPoint(fruitPos);
        if (dist < f.radius && dist < closestDist) {
            closestDist = dist;
            targetFruit = f;
        }
    }

    if (targetFruit) {
        // Explode a fruta escolhida!
        targetFruit.merged = true;
        scene.remove(targetFruit.group);
        spawnJuiceSplash(targetFruit.x, targetFruit.y, FRUITS[targetFruit.level].color);
        playMergeSound(targetFruit.level);
        triggerHaptic(60);
        fruits = fruits.filter(f => !f.merged);

        // Decrementa de forma segura e desativa modo martelo
        hammerCount = Math.max(0, hammerCount - 1);
        disableHammerMode();
        showToast("Fruta destruída! 🔨");
    }
}

// Power-up 3: Desfazer Última Jogada (Undo)
function useUndoPowerup() {
    if (undoCount <= 0) {
        showToast("Sem desfazer restante! ↩️");
        return;
    }
    if (isGameOver || isPaused) return;

    if (!lastSpawnedFruit || lastSpawnedFruit.merged) {
        showToast("Nada recente para desfazer!");
        return;
    }

    undoCount = Math.max(0, undoCount - 1);

    // Remove do mundo 3D
    lastSpawnedFruit.merged = true;
    scene.remove(lastSpawnedFruit.group);
    fruits = fruits.filter(f => !f.merged);

    // Restaura fruta de volta ao soltador
    currentFruitLevel = lastSpawnedFruit.level;
    lastSpawnedFruit = null;
    canDrop = true;

    updateDropperPreview();
    updatePowerupUI();

    triggerHaptic(30);
    playDropSound();
    showToast("Jogada desfeita! ↩️");
}

// --- 15. VERIFICAÇÃO DE GAME OVER & REVIVER ---
function checkDangerDeadline(dt) {
    if (isGameOver || isPaused) return;

    let hasFruitInDanger = false;
    for (let f of fruits) {
        if (f.merged) continue;
        const fruitTop = f.y + f.radius;
        // Se a fruta já assentou / encerrou tempo de drop e o topo ultrapassa a linha de perigo
        // (desconsidera apenas quedas rápidas vy < -1.5)
        if (f.dropGrace <= 0 && fruitTop > DANGER_Y && f.vy > -1.5) {
            hasFruitInDanger = true;
            break;
        }
    }

    const dangerBadge = document.getElementById('danger-badge');
    const dangerCountdown = document.getElementById('danger-countdown');

    // Reatividade visual da linha de perigo: pulsa neon carmesim em situação de perigo
    if (dangerLineMesh && dangerLineMesh.material) {
        if (hasFruitInDanger) {
            const pulse = 0.5 + Math.sin(performance.now() * 0.015) * 0.5;
            dangerLineMesh.material.color.setHex(0xFF0055);
            dangerLineMesh.material.opacity = 0.85 + pulse * 0.15;
        } else {
            dangerLineMesh.material.color.setHex(0xFF5D8F);
            dangerLineMesh.material.opacity = 0.55;
        }
    }

    if (hasFruitInDanger) {
        dangerTimer += dt;
        const timeLeft = Math.max(0, 2.5 - dangerTimer).toFixed(1);

        if (dangerBadge && dangerCountdown) {
            dangerBadge.style.display = 'block';
            dangerCountdown.textContent = `${timeLeft}s`;
        }

        // Feedback tátil pulsante suave
        if (Math.floor(dangerTimer * 10) % 6 === 0) {
            triggerHaptic(20);
        }

        if (dangerTimer >= 2.5) {
            if (dangerBadge) dangerBadge.style.display = 'none';
            triggerGameOver();
        }
    } else {
        if (dangerTimer > 0) {
            dangerTimer = Math.max(0, dangerTimer - dt * 1.5);
            if (dangerTimer === 0 && dangerBadge) {
                dangerBadge.style.display = 'none';
            }
        } else if (dangerBadge) {
            dangerBadge.style.display = 'none';
        }
    }
}

function triggerGameOver() {
    isGameOver = true;
    const dangerBadge = document.getElementById('danger-badge');
    if (dangerBadge) dangerBadge.style.display = 'none';

    triggerHaptic(120);
    document.getElementById('final-score').textContent = score;
    document.getElementById('final-best').textContent = `Recorde: ${bestScore}`;
    document.getElementById('gameover-modal').style.display = 'flex';

    // Ocasionalmente exibe anúncio intersticial respeitando o cooldown de 3min
    showUnityInterstitialAd();
}

// --- SISTEMA DE ANÚNCIOS UNITY ADS & REGRAS DAS PLATAFORMAS (LGPD & Marco Legal) ---
let lastInterstitialTime = Date.now();
const INTERSTITIAL_COOLDOWN_MS = 180000; // 3 minutos de intervalo (Diretrizes Google Play / Marco Legal dos Games)
let adTimerInterval = null;
let currentAdSuccessCallback = null;

function watchAdToRevive() {
    showUnityRewardedAd(
        () => {
            // Recompensa confirmada: reviver o jogo
            reviveGame();
        },
        () => {
            console.log('[Unity Ads] Anúncio recompensado não completado.');
        }
    );
}

function showUnityRewardedAd(onRewardSuccess, onRewardFail) {
    if (window.AndroidBridge && typeof window.AndroidBridge.showRewardedAd === 'function') {
        window.onAdRewardSuccess = () => {
            if (typeof onRewardSuccess === 'function') onRewardSuccess();
        };
        window.onAdRewardFail = () => {
            if (typeof onRewardFail === 'function') onRewardFail();
        };
        window.AndroidBridge.showRewardedAd();
    } else {
        // Fallback para Web / Plataforma Gratuita (Simulador de Anúncio Unity Ads)
        showWebAdSimulator('Vídeo Recompensado Unity Ads', onRewardSuccess);
    }
}

function showUnityInterstitialAd() {
    const now = Date.now();
    if (now - lastInterstitialTime < INTERSTITIAL_COOLDOWN_MS) {
        return; // Respeita cooldown para não frustrar o jogador
    }
    lastInterstitialTime = now;
    if (window.AndroidBridge && typeof window.AndroidBridge.showInterstitialAd === 'function') {
        window.AndroidBridge.showInterstitialAd();
    }
}

function showWebAdSimulator(title, onSuccess) {
    currentAdSuccessCallback = onSuccess;
    const modal = document.getElementById('unity-ad-modal');
    const countdownEl = document.getElementById('unity-ad-countdown');
    const closeBtn = document.getElementById('unity-ad-close-btn');

    if (!modal || !countdownEl) {
        if (typeof onSuccess === 'function') onSuccess();
        return;
    }

    modal.style.display = 'flex';
    if (closeBtn) closeBtn.style.display = 'none';

    let timeLeft = 5;
    countdownEl.textContent = `${timeLeft}s`;

    if (adTimerInterval) clearInterval(adTimerInterval);
    adTimerInterval = setInterval(() => {
        timeLeft--;
        if (timeLeft > 0) {
            countdownEl.textContent = `${timeLeft}s`;
        } else {
            clearInterval(adTimerInterval);
            countdownEl.textContent = '✅ Concluído!';
            if (closeBtn) {
                closeBtn.style.display = 'block';
                closeBtn.textContent = '✨ Receber Recompensa';
            }
        }
    }, 1000);
}

function closeWebAdModal() {
    const modal = document.getElementById('unity-ad-modal');
    if (modal) modal.style.display = 'none';
    if (adTimerInterval) clearInterval(adTimerInterval);
    if (typeof currentAdSuccessCallback === 'function') {
        const cb = currentAdSuccessCallback;
        currentAdSuccessCallback = null;
        cb();
    }
}

function reviveGame() {
    // Revive removendo as 3 frutas mais altas (concedido após Unity Ads Rewarded)
    document.getElementById('gameover-modal').style.display = 'none';
    const dangerBadge = document.getElementById('danger-badge');
    if (dangerBadge) dangerBadge.style.display = 'none';

    fruits.sort((a, b) => b.y - a.y);
    const toRemove = fruits.slice(0, 3);

    for (let f of toRemove) {
        f.merged = true;
        scene.remove(f.group);
        spawnJuiceSplash(f.x, f.y, FRUITS[f.level].color);
    }
    fruits = fruits.filter(f => !f.merged);

    dangerTimer = 0;
    isGameOver = false;
    canDrop = true;
    triggerHaptic(50);
}

function restartGame() {
    showUnityInterstitialAd();
    for (let f of fruits) scene.remove(f.group);
    fruits = [];
    for (let p of particles) scene.remove(p.mesh);
    particles = [];
    for (let sw of shockwaves) scene.remove(sw.mesh);
    shockwaves = [];

    score = 0;
    comboCount = 0;
    lastMergeTime = 0;
    dangerTimer = 0;
    isGameOver = false;
    isPaused = false;
    canDrop = true;
    hammerMode = false;

    shakeCount = 2;
    hammerCount = 1;
    undoCount = 1;
    lastSpawnedFruit = null;
    updatePowerupUI();

    const dangerBadge = document.getElementById('danger-badge');
    if (dangerBadge) dangerBadge.style.display = 'none';

    document.getElementById('score-val').textContent = '0';
    document.getElementById('gameover-modal').style.display = 'none';
    document.getElementById('pause-modal').style.display = 'none';

    currentFruitLevel = getRandomFruit();
    nextFruitLevel = getRandomFruit();
    updateNextFruitUI();
    updateDropperPreview();
}

function togglePause() {
    if (isGameOver) return;
    isPaused = !isPaused;
    document.getElementById('pause-modal').style.display = isPaused ? 'flex' : 'none';
    if (!isPaused) {
        lastTime = performance.now();
    }
}

function toggleSound() {
    soundEnabled = !soundEnabled;
    localStorage.setItem('suika3d_sound', soundEnabled.toString());
    const btn = document.getElementById('btn-sound');
    btn.textContent = soundEnabled ? '🔊 Som: Ligado' : '🔇 Som: Desligado';
    if (soundEnabled) initAudio();
}

// Abre/fecha a Roda Modal de Evolução das Frutas
function toggleEvolutionModal() {
    const modal = document.getElementById('evolution-modal');
    if (!modal) return;
    const isShowing = modal.style.display === 'flex';
    modal.style.display = isShowing ? 'none' : 'flex';
}

// --- 16. LOOP PRINCIPAL ---
let lastTime = performance.now();

function animate(now) {
    requestAnimationFrame(animate);
    if (isPaused) return;

    const dt = Math.min((now - lastTime) / 1000, 0.033);
    lastTime = now;

    // Efeito de Sacudir o Pote
    if (shakeTime > 0) {
        shakeTime -= dt;
        const shakeOffset = Math.sin(shakeTime * 35) * 0.18 * (shakeTime / 1.0);
        if (jarMeshGroup) jarMeshGroup.position.x = shakeOffset;
    } else if (jarMeshGroup) {
        jarMeshGroup.position.x = 0;
    }

    // Respiração suave da fruta suspensa no soltador (Idle Bobbing)
    if (dropperMesh && canDrop && !isGameOver) {
        dropperMesh.position.y = DROP_Y + Math.sin(now * 0.0035) * 0.06;
    }

    if (!isGameOver) {
        updatePhysics(dt);
    }
    updateShockwaves(dt);
    updateParticles(dt);
    updateBackgroundSparkles(dt);

    renderer.render(scene, camera);
}

function onWindowResize() {
    updateCameraResponsive();
}

window.addEventListener('DOMContentLoaded', () => {
    initScene();
    animate(performance.now());
});
