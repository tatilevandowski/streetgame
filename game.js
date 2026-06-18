const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Configurações do Mundo
const COLORS = {
    sky: '#AEE2E5',
    ground: '#A8D5BA',
    road: '#D1D5D8',
    roadLines: '#FFFFFF',
    numixBodyTop: '#99ccf2',
    numixBodyMain: '#7CB9E8',
    numixBodyDark: '#5c99c4',
    numixWindow: '#5A9BD4',
    numixGlassReflect: 'rgba(255, 255, 255, 0.3)',
    numixLights: '#FF8A8A',
    numixLightsGlow: '#ffb3b3',
    numixTire: '#333333',
    numixRim: '#C0C0C0',
    treeTrunk: '#D4A373',
    treeLeaves: '#78C679',
    signBg: '#8ABF9E',
    boxBg: '#BCA88E',
    highlight: '#FFFACD',
    victoryBg: 'rgba(255, 255, 255, 0.8)',
    pothole: '#555555'
};

// --- Acessibilidade (GDD seção 9 / WDD / TDD): som, contraste, fonte e tempo ---
const defaultSettings = { sound: true, music: false, highContrast: false, largeFont: false, extraTime: false };
function loadSettings() {
    try { return Object.assign({}, defaultSettings, JSON.parse(localStorage.getItem('streetNumbersSettings') || '{}')); }
    catch (e) { return { ...defaultSettings }; }
}
function saveSettings() {
    try { localStorage.setItem('streetNumbersSettings', JSON.stringify(settings)); } catch (e) {}
}
let settings = loadSettings();

// Fatores derivados das configurações
function fontScale() { return settings.largeFont ? 1.25 : 1; }
function timeFactor() { return settings.extraTime ? 0.55 : 1; } // menor = desafio se aproxima mais devagar = mais tempo
function feedbackDelay() { return settings.extraTime ? 3800 : 2500; }

// --- Perfis e progresso (TDD: perfil local Aluno/Professor + acompanhamento) ---
// Contas de aluno e professor, com usuário + senha. Chave normalizada evita duplicar por maiúsculas.
let appView = 'splash'; // 'splash' | 'auth' | 'student' | 'teacher'
let splashFrame = 0;
let currentStudentKey = null;  // chave do aluno logado (para o banco)
let currentStudentName = null; // nome de exibição do aluno logado
let session = null; // sessão de jogo atual do aluno (referência dentro do registro)

function hashPass(p) { return btoa(unescape(encodeURIComponent(p))); }
function normalizeKey(name) { return (name || '').trim().toLowerCase(); }
function nowISO() { return new Date().toISOString(); }
function bairroKey(idx) { if (idx < 6) return 'raiz'; if (idx < 12) return 'porcentagem'; return 'regra'; }

function getStudents() {
    try { return JSON.parse(localStorage.getItem('streetNumbersStudents') || '{}'); } catch (e) { return {}; }
}
function saveStudents() {
    try { localStorage.setItem('streetNumbersStudents', JSON.stringify(studentsDB)); } catch (e) {}
}
function getTeachers() {
    try { return JSON.parse(localStorage.getItem('streetNumbersTeachers') || '{}'); } catch (e) { return {}; }
}
function saveTeachers() {
    try { localStorage.setItem('streetNumbersTeachers', JSON.stringify(teachersDB)); } catch (e) {}
}

// Migração: re-chaveia alunos por chave normalizada, mesclando duplicados (ex.: "helena" + "Helena")
function migrateStudents(raw) {
    const out = {};
    Object.keys(raw || {}).forEach(oldKey => {
        const r = raw[oldKey] || {};
        const display = r.user || r.name || oldKey;
        const key = normalizeKey(display);
        if (!out[key]) {
            out[key] = {
                user: display, key: key, pass: r.pass, createdAt: r.createdAt || nowISO(),
                lastPlayed: r.lastPlayed || null, sessions: [], bestScore: 0, timesCompleted: 0
            };
        }
        const acc = out[key];
        if (!acc.pass && r.pass) acc.pass = r.pass; // preserva senha se existir em algum dos duplicados
        acc.sessions = acc.sessions.concat(r.sessions || []);
        acc.bestScore = Math.max(acc.bestScore || 0, r.bestScore || 0);
        acc.timesCompleted = (acc.timesCompleted || 0) + (r.timesCompleted || 0);
        if (r.lastPlayed && (!acc.lastPlayed || r.lastPlayed > acc.lastPlayed)) acc.lastPlayed = r.lastPlayed;
    });
    return out;
}

let studentsDB = migrateStudents(getStudents());
saveStudents();

// Migração da conta de professor antiga (única) para o novo formato (várias contas)
let teachersDB = getTeachers();
(function migrateTeacher() {
    try {
        const old = JSON.parse(localStorage.getItem('streetNumbersTeacher') || 'null');
        if (old && old.user && Object.keys(teachersDB).length === 0) {
            teachersDB[normalizeKey(old.user)] = { user: old.user, key: normalizeKey(old.user), pass: old.pass, createdAt: nowISO() };
            saveTeachers();
        }
        localStorage.removeItem('streetNumbersTeacher');
    } catch (e) {}
})();

function startStudentSession() {
    const rec = studentsDB[currentStudentKey];
    if (!rec) return;
    session = {
        date: nowISO(), correct: 0, total: 0, completed: false,
        perBairro: { raiz: { c: 0, t: 0 }, porcentagem: { c: 0, t: 0 }, regra: { c: 0, t: 0 } }
    };
    rec.sessions = rec.sessions || [];
    rec.sessions.push(session);
    rec.lastPlayed = session.date;
    saveStudents();
}

// Registra cada resposta no progresso do aluno
function recordAnswer(bairroIdx, isCorrect) {
    if (!session) return;
    const k = bairroKey(bairroIdx);
    session.total++;
    session.perBairro[k].t++;
    if (isCorrect) { session.correct++; session.perBairro[k].c++; }
    const rec = studentsDB[currentStudentKey];
    if (rec) rec.lastPlayed = nowISO();
    saveStudents();
}

// --- Áudio gentil via WebAudio (WDD seção 9: sons discretos, opção de desligar) ---
let audioCtx = null;
let masterGain = null;
let musicTimer = null;
const musicNotes = [261.63, 329.63, 392.00, 440.00, 392.00, 329.63]; // pentatônica calma
let musicIdx = 0;

function ensureAudio() {
    if (!audioCtx) {
        try {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            masterGain = audioCtx.createGain();
            masterGain.gain.value = 1;
            masterGain.connect(audioCtx.destination);
        } catch (e) { audioCtx = null; }
    }
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
}

function playTone(freq, dur, vol, when) {
    if (!audioCtx || !masterGain) return;
    const t = audioCtx.currentTime + (when || 0);
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g); g.connect(masterGain);
    osc.start(t); osc.stop(t + dur + 0.05);
}

function playCorrect() {
    if (!settings.sound) return;
    ensureAudio();
    playTone(523.25, 0.18, 0.12, 0);     // clique suave (Dó)
    playTone(783.99, 0.34, 0.12, 0.12);  // brilho gentil (Sol)
}
function playWrong() {
    if (!settings.sound) return;
    ensureAudio();
    playTone(311.13, 0.30, 0.09, 0); // lembrete delicado, grave e baixo (sem ser irritante)
}
function startMusic() {
    ensureAudio();
    if (!audioCtx || musicTimer) return;
    const step = () => {
        if (!settings.music) return;
        playTone(musicNotes[musicIdx % musicNotes.length], 1.8, 0.04, 0); // quase invisível
        musicIdx++;
    };
    step();
    musicTimer = setInterval(step, 2000);
}
function stopMusic() {
    if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
}

// Estado do Jogo
const baseSpeed = 2;
let speed = baseSpeed;
let roadOffset = 0;
let score = 0;
let distanceDriven = 0;
let nextChallengeAt = 500;

let gameState = 'intro'; // 'intro' | 'playing' | 'victory'
let isChallengeVisible = false;
let isWaitingForSelection = false;
let isAnswered = false;
let currentQuestionIndex = 0;

// Frases de incentivo do Numix (GDD seção 4 / WDD)
const praisePhrases = ["Ótimo trabalho!", "Muito bem!", "Você conseguiu!", "Continue assim!"];
let praiseText = null;
let praiseTimer = 0;

// --- Sistema de Ajuda (Professor Sigma) ---
let isHelpVisible = false;
const pencilBtn = { x: 720, y: 480, width: 60, height: 90 };

const hints = [
    "DICA: Que número multiplicado por\nele mesmo resulta nesse valor?",
    "DICA: Multiplique o número pela\nporcentagem e divida por 100.",
    "DICA: Multiplique os valores cruzados\npara achar a resposta."
];

let particles = [];
const restartBtn = { x: 300, y: 335, width: 200, height: 45 };
const startBtn = { x: 300, y: 470, width: 200, height: 50 };

// Buracos
let potholes = [
    { x: 380, y: 300, size: 40 },
    { x: 450, y: 450, size: 60 },
    { x: 320, y: 550, size: 50 }
];

// Nuvens
const clouds = [
    { x: 150, y: 100, size: 45 },
    { x: 400, y: 70, size: 35 },
    { x: 650, y: 110, size: 55 },
    { x: 800, y: 80, size: 40 }
];

// Banco de Perguntas (6 por Bairro, Embaralhado automaticamente)
const questionBank = [
    // BAIRRO 1: Raiz Quadrada
    { title: "BAIRRO RAIZ QUADRADA", question: "√9 =", options: [{ value: 3, isCorrect: true }, { value: 2, isCorrect: false }, { value: 4, isCorrect: false }] },
    { title: "BAIRRO RAIZ QUADRADA", question: "√16 =", options: [{ value: 4, isCorrect: true }, { value: 8, isCorrect: false }, { value: 6, isCorrect: false }] },
    { title: "BAIRRO RAIZ QUADRADA", question: "√25 =", options: [{ value: 5, isCorrect: true }, { value: 3, isCorrect: false }, { value: 7, isCorrect: false }] },
    { title: "BAIRRO RAIZ QUADRADA", question: "√36 =", options: [{ value: 6, isCorrect: true }, { value: 4, isCorrect: false }, { value: 8, isCorrect: false }] },
    { title: "BAIRRO RAIZ QUADRADA", question: "√49 =", options: [{ value: 7, isCorrect: true }, { value: 5, isCorrect: false }, { value: 9, isCorrect: false }] },
    { title: "BAIRRO RAIZ QUADRADA", question: "√64 =", options: [{ value: 8, isCorrect: true }, { value: 6, isCorrect: false }, { value: 10, isCorrect: false }] },

    // BAIRRO 2: Porcentagem
    { title: "BAIRRO PORCENTAGENS", question: "50% de 20 =", options: [{ value: 10, isCorrect: true }, { value: 5, isCorrect: false }, { value: 15, isCorrect: false }] },
    { title: "BAIRRO PORCENTAGENS", question: "10% de 50 =", options: [{ value: 5, isCorrect: true }, { value: 10, isCorrect: false }, { value: 50, isCorrect: false }] },
    { title: "BAIRRO PORCENTAGENS", question: "25% de 40 =", options: [{ value: 10, isCorrect: true }, { value: 20, isCorrect: false }, { value: 25, isCorrect: false }] },
    { title: "BAIRRO PORCENTAGENS", question: "100% de 7 =", options: [{ value: 7, isCorrect: true }, { value: 1, isCorrect: false }, { value: 10, isCorrect: false }] },
    { title: "BAIRRO PORCENTAGENS", question: "20% de 50 =", options: [{ value: 10, isCorrect: true }, { value: 20, isCorrect: false }, { value: 5, isCorrect: false }] },
    { title: "BAIRRO PORCENTAGENS", question: "50% de 80 =", options: [{ value: 40, isCorrect: true }, { value: 20, isCorrect: false }, { value: 80, isCorrect: false }] },

    // BAIRRO 3: Regra de Três
    { title: "BAIRRO REGRA DE TRÊS", question: "Se 1=3, 2=?", options: [{ value: 6, isCorrect: true }, { value: 5, isCorrect: false }, { value: 7, isCorrect: false }] },
    { title: "BAIRRO REGRA DE TRÊS", question: "Se 2=4, 3=?", options: [{ value: 6, isCorrect: true }, { value: 5, isCorrect: false }, { value: 4, isCorrect: false }] },
    { title: "BAIRRO REGRA DE TRÊS", question: "Se 3=9, 4=?", options: [{ value: 12, isCorrect: true }, { value: 10, isCorrect: false }, { value: 11, isCorrect: false }] },
    { title: "BAIRRO REGRA DE TRÊS", question: "Se 4=8, 5=?", options: [{ value: 10, isCorrect: true }, { value: 9, isCorrect: false }, { value: 11, isCorrect: false }] },
    { title: "BAIRRO REGRA DE TRÊS", question: "Se 5=15, 2=?", options: [{ value: 6, isCorrect: true }, { value: 10, isCorrect: false }, { value: 5, isCorrect: false }] },
    { title: "BAIRRO REGRA DE TRÊS", question: "Se 2=10, 3=?", options: [{ value: 15, isCorrect: true }, { value: 20, isCorrect: false }, { value: 12, isCorrect: false }] }
];

let challenge = { distanceY: 200, ...questionBank[0] };

// Carrinho Numix
const numix = { x: 400, y: 480, width: 120, height: 70 };
const keys = { ArrowLeft: false, ArrowRight: false };

window.addEventListener('keydown', (e) => {
    if (appView === 'splash') { showAuth(); return; }
    if (appView !== 'student') return; // ignora teclas fora do jogo (login/painel)
    if (gameState === 'intro' && (e.key === ' ' || e.key === 'Enter')) { startGame(); return; }
    if (gameState !== 'playing') return;
    if (keys.hasOwnProperty(e.key)) keys[e.key] = true;
    if (e.key === ' ' && isWaitingForSelection) confirmSelection();
});
window.addEventListener('keyup', (e) => {
    if (keys.hasOwnProperty(e.key)) keys[e.key] = false;
});

function getMousePos(canvas, evt) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return { x: (evt.clientX - rect.left) * scaleX, y: (evt.clientY - rect.top) * scaleY };
}

function inRect(pos, r) {
    return pos.x >= r.x && pos.x <= r.x + r.width && pos.y >= r.y && pos.y <= r.y + r.height;
}

canvas.addEventListener('click', (e) => {
    if (appView === 'splash') { ensureAudio(); showAuth(); return; }
    const pos = getMousePos(canvas, e);
    if (gameState === 'intro') {
        if (inRect(pos, startBtn)) startGame();
        return;
    }
    if (gameState === 'victory') {
        if (inRect(pos, restartBtn)) resetGame();
        return;
    }
    // playing
    if (inRect(pos, pencilBtn)) {
        isHelpVisible = !isHelpVisible;
    } else {
        isHelpVisible = false;
    }
});

canvas.addEventListener('mousemove', (e) => {
    if (appView === 'splash') { canvas.style.cursor = 'pointer'; return; }
    const pos = getMousePos(canvas, e);
    let cursor = 'default';

    if (gameState === 'intro') {
        if (inRect(pos, startBtn)) cursor = 'pointer';
    } else if (gameState === 'victory') {
        if (inRect(pos, restartBtn)) cursor = 'pointer';
    } else {
        if (inRect(pos, pencilBtn)) {
            cursor = 'help';
            isHelpVisible = true;
        } else {
            isHelpVisible = false;
        }
    }
    canvas.style.cursor = cursor;
});

function startGame() {
    ensureAudio();
    if (settings.music) startMusic();
    startStudentSession();
    gameState = 'playing';
    canvas.style.cursor = 'default';
}

function resetGame() {
    speed = baseSpeed; score = 0; distanceDriven = 0; nextChallengeAt = 500;
    isChallengeVisible = false; isWaitingForSelection = false; isAnswered = false; isHelpVisible = false;
    currentQuestionIndex = 0; particles = []; numix.x = 400;
    praiseText = null; praiseTimer = 0;
    potholes = [ { x: 380, y: 300, size: 40 }, { x: 450, y: 450, size: 60 }, { x: 320, y: 550, size: 50 } ];
    challenge = { distanceY: 200, ...questionBank[0] };
    startStudentSession();
    gameState = 'playing';
    canvas.style.cursor = 'default';
}

function showPraise() {
    praiseText = praisePhrases[Math.floor(Math.random() * praisePhrases.length)];
    praiseTimer = 120; // ~2s a 60fps
}

function confirmSelection() {
    isWaitingForSelection = false; isAnswered = true;
    if (numix.x < 330) challenge.chosenIndex = 0;
    else if (numix.x < 470) challenge.chosenIndex = 1;
    else challenge.chosenIndex = 2;

    let selectedOption = challenge.options[challenge.chosenIndex];
    let answeredBairro = currentQuestionIndex; // bairro da questão atual (antes de avançar)
    if (selectedOption.isCorrect) {
        recordAnswer(answeredBairro, true);
        score++; currentQuestionIndex++;
        playCorrect();
        showPraise();
    } else {
        recordAnswer(answeredBairro, false);
        playWrong(); // lembrete gentil; sem penalidade (GDD seção 8)
    }

    setTimeout(() => {
        isAnswered = false; isChallengeVisible = false;
        if (currentQuestionIndex >= questionBank.length) startVictorySequence();
        else nextChallengeAt = distanceDriven + 500;
    }, feedbackDelay());
}

function startVictorySequence() {
    gameState = 'victory'; speed = 0; isHelpVisible = false;
    // Registra conquista no perfil do aluno (TDD: progresso e conquistas)
    const rec = studentsDB[currentStudentKey];
    if (rec) {
        if (session) session.completed = true;
        rec.timesCompleted = (rec.timesCompleted || 0) + 1;
        rec.bestScore = Math.max(score, rec.bestScore || 0);
        rec.lastPlayed = nowISO();
        saveStudents();
    }
    const victoryColors = ['#FFD700', '#FF8A8A', '#78C679', '#7CB9E8', '#FFB6C1'];
    for (let i = 0; i < 50; i++) {
        particles.push({
            x: Math.random() * canvas.width, y: Math.random() * -canvas.height,
            size: Math.random() * 8 + 4, speedY: Math.random() * 2 + 1, speedX: (Math.random() - 0.5) * 1,
            color: victoryColors[Math.floor(Math.random() * victoryColors.length)],
            rotation: Math.random() * Math.PI * 2, spinSpeed: (Math.random() - 0.5) * 0.1, isStar: Math.random() > 0.5
        });
    }
}

function updatePhysics() {
    if (gameState !== 'playing') return;
    speed = (isAnswered || isWaitingForSelection) ? 0 : baseSpeed;
    let turnSpeed = 7;
    if (keys.ArrowLeft) numix.x -= turnSpeed;
    if (keys.ArrowRight) numix.x += turnSpeed;
    if (numix.x < 220) numix.x = 220;
    if (numix.x > 580) numix.x = 580;
    distanceDriven += speed;
    if (praiseTimer > 0) praiseTimer--;
    if (distanceDriven > nextChallengeAt && !isChallengeVisible && currentQuestionIndex < questionBank.length) spawnChallenge();
}

function spawnChallenge() {
    isChallengeVisible = true;
    challenge.distanceY = 220;
    let q = questionBank[currentQuestionIndex];
    challenge.title = q.title;
    challenge.question = q.question;

    // Clona o array de opções e embaralha aleatoriamente
    challenge.options = [...q.options];
    for (let i = challenge.options.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [challenge.options[i], challenge.options[j]] = [challenge.options[j], challenge.options[i]];
    }
}

function blendColors(c1, c2, ratio) {
    if (ratio < 0) ratio = 0; if (ratio > 1) ratio = 1;
    const hex = (c) => parseInt(c.slice(1), 16);
    const r1 = hex(c1) >> 16, g1 = (hex(c1) >> 8) & 0xff, b1 = hex(c1) & 0xff;
    const r2 = hex(c2) >> 16, g2 = (hex(c2) >> 8) & 0xff, b2 = hex(c2) & 0xff;
    const r = Math.round(r1 + (r2 - r1) * ratio), g = Math.round(g1 + (g2 - g1) * ratio), b = Math.round(b1 + (b2 - b1) * ratio);
    return `#${(r << 16 | g << 8 | b).toString(16).padStart(6, '0')}`;
}

// --- DESENHO DO AMBIENTE ---
function drawEnvironment() {
    let bairroPhase = Math.floor(currentQuestionIndex / 6);
    if (bairroPhase > 2) bairroPhase = 2;

    let baseSkyColor = bairroPhase === 0 ? '#8899A6' : COLORS.sky;
    let baseGroundColor = bairroPhase === 0 ? '#9E9E9E' : (bairroPhase === 1 ? '#A8C5B0' : COLORS.ground);
    let baseRoadColor = bairroPhase === 0 ? '#696969' : (bairroPhase === 1 ? '#9E9E9E' : COLORS.road);

    let repairLevel = bairroPhase === 0 ? 0 : (bairroPhase === 1 ? 0.5 : 1);

    let currentSky = baseSkyColor;
    if (isAnswered) {
        let selectedOption = challenge.options[challenge.chosenIndex];
        currentSky = selectedOption.isCorrect ? '#C8E6C9' : '#FFCCBC';
    }

    ctx.fillStyle = currentSky;
    ctx.fillRect(0, 0, canvas.width, 250);

    ctx.fillStyle = baseGroundColor;
    ctx.fillRect(0, 250, canvas.width, canvas.height - 250);

    ctx.fillStyle = baseRoadColor;
    ctx.beginPath(); ctx.moveTo(350, 250); ctx.lineTo(450, 250); ctx.lineTo(800, 600); ctx.lineTo(0, 600); ctx.fill();

    if (bairroPhase < 2) {
        ctx.fillStyle = COLORS.pothole;
        potholes.forEach(hole => {
            hole.y += speed * 1.2;
            if (hole.y > 600) {
                hole.y = 250;
                hole.x = 350 + Math.random() * 100;
            }
            let scale = Math.max((hole.y - 250) / 350, 0.1);
            ctx.beginPath();
            ctx.ellipse(hole.x, hole.y, hole.size * scale, (hole.size/2) * scale, 0, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    ctx.fillStyle = COLORS.roadLines;
    if (gameState === 'playing') roadOffset += speed * 2;
    if (roadOffset > 80) roadOffset = 0;

    for (let i = -1; i < 6; i++) {
        let y = 250 + (i * 80) + roadOffset;
        if (y > 250 && y < 600) {
            let width = (y - 250) * 0.05; let height = (y - 250) * 0.2;
            ctx.fillRect(398 - width/2, y, width, height);
        }
    }

    clouds.forEach(c => drawCloud(c.x, c.y, c.size));

    drawTree(120, 320, 0.7, repairLevel); drawTree(680, 330, 0.7, repairLevel);
    drawTree(80, 420, 1.0, repairLevel); drawTree(750, 440, 1.1, repairLevel);
    drawTree(30, 580, 1.5, repairLevel); drawTree(780, 560, 1.6, repairLevel);

    if (bairroPhase < 2 && gameState !== 'victory') {
        drawScatteredNumbers(repairLevel);
    }
}

function drawScatteredNumbers(repairLevel) {
    const scattered = [
        {x: 60, y: 280, val: "3", rot: 0.5}, {x: 140, y: 310, val: "+", rot: -0.2},
        {x: 50, y: 380, val: "8", rot: 0.1}, {x: 180, y: 440, val: "÷", rot: 0.8},
        {x: 80, y: 500, val: "1", rot: -0.5}, {x: 40, y: 560, val: "X", rot: 0.2},
        {x: 160, y: 580, val: "4", rot: -0.1}, {x: 720, y: 270, val: "7", rot: -0.3},
        {x: 600, y: 310, val: "-", rot: 0.4}, {x: 750, y: 360, val: "9", rot: -0.6},
        {x: 680, y: 410, val: "2", rot: 0.2}, {x: 780, y: 470, val: "5", rot: -0.9},
        {x: 640, y: 530, val: "=", rot: 0.1}, {x: 750, y: 580, val: "6", rot: 0.7}
    ];

    ctx.fillStyle = '#E8A87C';
    scattered.forEach((item, index) => {
        if (repairLevel === 0.5 && index % 2 !== 0) return;

        ctx.save();
        ctx.translate(item.x, item.y);
        ctx.rotate(item.rot);
        ctx.font = 'bold 35px Varela Round';
        ctx.fillText(item.val, 0, 0);
        ctx.restore();
    });
}

function drawCloud(x, y, size) {
    ctx.save();
    let grd = ctx.createRadialGradient(x, y - size*0.2, size * 0.1, x, y, size * 1.5);
    grd.addColorStop(0, "rgba(255, 255, 255, 1)");
    grd.addColorStop(0.7, "rgba(240, 248, 255, 0.95)");
    grd.addColorStop(1, "rgba(220, 230, 240, 0.2)");

    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(x - size * 0.5, y, size * 0.4, 0, Math.PI * 2);
    ctx.arc(x + size * 0.7, y, size * 0.5, 0, Math.PI * 2);
    ctx.arc(x + size * 0.1, y - size * 0.3, size * 0.6, 0, Math.PI * 2);
    ctx.arc(x, y + size * 0.1, size * 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

function drawTree(x, y, scale, repairLevel) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((1 - repairLevel) * 0.4);

    ctx.fillStyle = blendColors('#8B7355', COLORS.treeTrunk, repairLevel);
    ctx.beginPath();
    ctx.moveTo(-6 * scale, 0);
    ctx.lineTo(6 * scale, 0);
    ctx.lineTo(3 * scale, -25 * scale);
    ctx.lineTo(-3 * scale, -25 * scale);
    ctx.fill();

    ctx.fillStyle = blendColors('#A0C0A0', COLORS.treeLeaves, repairLevel);
    ctx.beginPath();
    ctx.arc(0, -40 * scale, 16 * scale, 0, Math.PI * 2);
    ctx.arc(-12 * scale, -25 * scale, 14 * scale, 0, Math.PI * 2);
    ctx.arc(12 * scale, -25 * scale, 14 * scale, 0, Math.PI * 2);
    ctx.arc(0, -20 * scale, 15 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

// Desenha a forma do Numix na origem atual do contexto (reusada na tela de abertura)
function drawNumixShape() {
    ctx.save();
    let shadowGrd = ctx.createRadialGradient(0, 35, 10, 0, 35, 60);
    shadowGrd.addColorStop(0, 'rgba(0,0,0,0.3)');
    shadowGrd.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = shadowGrd;
    ctx.beginPath(); ctx.ellipse(0, 35, 60, 15, 0, 0, Math.PI*2); ctx.fill();
    ctx.restore();

    ctx.fillStyle = COLORS.numixTire;
    ctx.beginPath(); ctx.ellipse(-40, 20, 12, 22, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = COLORS.numixRim;
    ctx.beginPath(); ctx.ellipse(-40, 20, 6, 12, 0, 0, Math.PI*2); ctx.fill();

    ctx.fillStyle = COLORS.numixTire;
    ctx.beginPath(); ctx.ellipse(40, 20, 12, 22, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = COLORS.numixRim;
    ctx.beginPath(); ctx.ellipse(40, 20, 6, 12, 0, 0, Math.PI*2); ctx.fill();

    let bodyGrd = ctx.createLinearGradient(0, -30, 0, 30);
    bodyGrd.addColorStop(0, COLORS.numixBodyTop);
    bodyGrd.addColorStop(0.5, COLORS.numixBodyMain);
    bodyGrd.addColorStop(1, COLORS.numixBodyDark);

    ctx.fillStyle = bodyGrd;
    ctx.beginPath(); ctx.roundRect(-55, -28, 110, 56, 30); ctx.fill();

    ctx.save();
    let glassGrd = ctx.createLinearGradient(0, -45, 0, -20);
    glassGrd.addColorStop(0, '#4a8dc4');
    glassGrd.addColorStop(1, COLORS.numixWindow);
    ctx.fillStyle = glassGrd;
    ctx.beginPath(); ctx.roundRect(-40, -42, 80, 34, 17); ctx.fill();
    ctx.clip();

    ctx.fillStyle = COLORS.numixGlassReflect;
    ctx.beginPath(); ctx.moveTo(-60, -20); ctx.lineTo(0, -60); ctx.lineTo(40, -60); ctx.lineTo(-20, -20); ctx.fill();
    ctx.restore();

    let isStopped = (speed === 0);
    if (isStopped) { ctx.shadowColor = COLORS.numixLightsGlow; ctx.shadowBlur = 15; }
    ctx.fillStyle = COLORS.numixLights;
    ctx.beginPath(); ctx.roundRect(-48, -5, 18, 12, 6); ctx.fill();
    ctx.beginPath(); ctx.roundRect(30, -5, 18, 12, 6); ctx.fill();

    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffcccc';
    ctx.beginPath(); ctx.arc(-39, 1, 2, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(39, 1, 2, 0, Math.PI*2); ctx.fill();

    ctx.fillStyle = '#1A1A1A'; ctx.font = 'bold 13px Varela Round'; ctx.textAlign = 'center'; ctx.fillText("NUMIX", 0, 18);
}

function drawNumix() {
    const cx = numix.x;
    const cy = numix.y;
    const h = numix.height;

    ctx.save();
    ctx.translate(cx, cy);

    let tilt = 0;
    if (keys.ArrowLeft && gameState === 'playing') tilt = -0.08;
    if (keys.ArrowRight && gameState === 'playing') tilt = 0.08;
    ctx.rotate(tilt);

    let bairroPhase = Math.floor(currentQuestionIndex / 6);
    let isBumpy = false;
    if (bairroPhase < 2) {
        potholes.forEach(hole => {
            if (hole.y > cy && hole.y < cy + h && Math.abs(hole.x - cx) < 50) {
                isBumpy = true;
            }
        });
    }
    if (isBumpy && speed > 0) ctx.translate(0, (Math.random() - 0.5) * 4);

    drawNumixShape();
    ctx.restore();

    // Balão de incentivo do Numix (frases curtas)
    if (praiseTimer > 0 && praiseText) {
        let alpha = Math.min(1, praiseTimer / 30);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.font = `bold ${20 * fontScale()}px Varela Round`;
        ctx.textAlign = 'center';
        let tw = ctx.measureText(praiseText).width + 28;
        let bx = cx, by = cy - 70;
        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        ctx.beginPath(); ctx.roundRect(bx - tw/2, by - 24, tw, 36, 10); ctx.fill();
        ctx.beginPath(); ctx.moveTo(bx - 8, by + 11); ctx.lineTo(bx, by + 24); ctx.lineTo(bx + 8, by + 11); ctx.fill();
        ctx.fillStyle = '#007B3A';
        ctx.textBaseline = 'middle';
        ctx.fillText(praiseText, bx, by - 5);
        ctx.restore();
    }
}

function drawChallenge() {
    if (!isChallengeVisible) return;

    const hc = settings.highContrast;
    const signX = 220; const signY = 15; const signW = 360; const signH = 65;

    ctx.fillStyle = '#999999'; ctx.beginPath(); ctx.roundRect(signX - 4, signY - 4, signW + 8, signH + 8, 12); ctx.fill();
    ctx.fillStyle = '#007B3A'; ctx.beginPath(); ctx.roundRect(signX, signY, signW, signH, 8); ctx.fill();

    ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(signX + 5, signY + 5, signW - 10, signH - 10, 5); ctx.stroke();

    const drawScrew = (sx, sy) => {
        ctx.fillStyle = '#CCCCCC'; ctx.beginPath(); ctx.arc(sx, sy, 3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#444444'; ctx.beginPath(); ctx.arc(sx, sy, 1.5, 0, Math.PI * 2); ctx.fill();
    };
    drawScrew(signX + 15, signY + 15); drawScrew(signX + signW - 15, signY + 15);
    drawScrew(signX + 15, signY + signH - 15); drawScrew(signX + signW - 15, signY + signH - 15);

    ctx.fillStyle = '#FFFFFF'; ctx.font = `bold ${22 * fontScale()}px Arial, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(challenge.title, 400, signY + (signH / 2));

    ctx.fillStyle = hc ? '#063d20' : COLORS.signBg; ctx.beginPath(); ctx.roundRect(330, 105, 140, 50, 10); ctx.fill();
    ctx.fillStyle = '#FFF'; ctx.font = `bold ${24 * fontScale()}px Varela Round`; ctx.textBaseline = 'alphabetic';
    ctx.fillText(challenge.question, 400, 138);

    if (!isAnswered && !isWaitingForSelection && gameState === 'playing') {
        challenge.distanceY += speed * 0.8 * timeFactor();
        if (challenge.distanceY >= 360) isWaitingForSelection = true;
    }

    const optionXs = [260, 400, 540];
    let currentIndex = 1;
    if (numix.x < 330) currentIndex = 0; else if (numix.x < 470) currentIndex = 1; else currentIndex = 2;

    challenge.options.forEach((opt, index) => {
        let scale = Math.max((challenge.distanceY - 200) / 250, 0.1);
        let boxWidth = 90 * scale, boxHeight = 70 * scale, xPos = optionXs[index];
        ctx.save(); ctx.translate(xPos, challenge.distanceY);

        if (isWaitingForSelection && currentIndex === index) {
            ctx.fillStyle = COLORS.highlight; ctx.beginPath(); ctx.roundRect(-boxWidth/2 - 4, -boxHeight/2 - 4, boxWidth + 8, boxHeight + 8, 8); ctx.fill();
        }

        ctx.fillStyle = hc ? '#FFFFFF' : COLORS.boxBg; ctx.beginPath(); ctx.roundRect(-boxWidth/2, -boxHeight/2, boxWidth, boxHeight, 5); ctx.fill();
        if (hc) { ctx.strokeStyle = '#222'; ctx.lineWidth = 3; ctx.stroke(); }
        ctx.fillStyle = hc ? '#111' : '#FFF'; ctx.font = `bold ${35 * scale * fontScale()}px Varela Round`; ctx.textBaseline = 'middle'; ctx.textAlign = 'center'; ctx.fillText(opt.value, 0, 0);

        if (isAnswered && challenge.chosenIndex === index) {
            ctx.font = `bold ${45 * scale}px Varela Round`; ctx.fillStyle = opt.isCorrect ? '#2e8b3d' : '#d64545'; ctx.fillText(opt.isCorrect ? "✓" : "✗", boxWidth/2, -boxHeight/2);
        }
        ctx.restore();
    });
}

function drawUI() {
    const hc = settings.highContrast;
    let label = (currentStudentName ? currentStudentName + " • " : "") + `Progresso: ${score} / ${questionBank.length}`;
    ctx.fillStyle = hc ? '#000' : '#333'; ctx.font = `bold ${16 * fontScale()}px Varela Round`; ctx.textAlign = 'left'; ctx.fillText(label, 110, 28);
    ctx.textAlign = 'center'; ctx.fillStyle = hc ? '#000' : '#555';
    if (isWaitingForSelection && gameState === 'playing') {
        ctx.font = `bold ${20 * fontScale()}px Varela Round`; ctx.fillText("Escolha com ← → e aperte ESPAÇO / OK", 400, 560);
    } else if (distanceDriven < 150 && !isChallengeVisible && gameState === 'playing') {
        ctx.font = `bold ${18 * fontScale()}px Varela Round`; ctx.fillText("Use as setas ← e → para guiar o Numix", 400, 560);
    }
}

// Desenha o Professor Sigma (lápis) na origem atual — reusado na ajuda e na intro
function drawSigmaShape() {
    ctx.fillStyle = '#FFB6C1';
    ctx.beginPath(); ctx.roundRect(-12, -40, 24, 15, {tl: 5, tr: 5, bl: 0, br: 0}); ctx.fill();

    ctx.fillStyle = '#C0C0C0';
    ctx.fillRect(-12, -25, 24, 8);

    ctx.fillStyle = '#FFD700';
    ctx.fillRect(-12, -17, 24, 45);

    ctx.strokeStyle = '#DAA520'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-4, -17); ctx.lineTo(-4, 28); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(4, -17); ctx.lineTo(4, 28); ctx.stroke();

    ctx.fillStyle = '#DEB887';
    ctx.beginPath(); ctx.moveTo(-12, 28); ctx.lineTo(12, 28); ctx.lineTo(0, 45); ctx.fill();

    ctx.fillStyle = '#333';
    ctx.beginPath(); ctx.moveTo(-4, 39); ctx.lineTo(4, 39); ctx.lineTo(0, 45); ctx.fill();

    ctx.strokeStyle = '#333'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(-6, 3, 6, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(6, 3, 6, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-1, 3); ctx.lineTo(1, 3); ctx.stroke();

    ctx.fillStyle = '#333';
    ctx.beginPath(); ctx.arc(-6, 3, 2.5, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(6, 3, 2.5, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#FFF';
    ctx.beginPath(); ctx.arc(-6.5, 2.5, 1, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(5.5, 2.5, 1, 0, Math.PI*2); ctx.fill();

    ctx.fillStyle = '#F5F5F5';
    ctx.beginPath(); ctx.ellipse(-5, 13, 7, 3, Math.PI/8, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(5, 13, 7, 3, -Math.PI/8, 0, Math.PI*2); ctx.fill();
}

// --- DESENHO DO PROFESSOR SIGMA (ajuda) ---
function drawHelpSystem() {
    if (gameState !== 'playing') return;

    ctx.save();
    ctx.translate(pencilBtn.x + pencilBtn.width/2, pencilBtn.y + pencilBtn.height/2);
    ctx.rotate(-Math.PI / 16);

    if (isHelpVisible) ctx.scale(1.1, 1.1);

    drawSigmaShape();

    ctx.restore();

    // Nome do mentor (GDD/WDD: Professor Sigma)
    ctx.fillStyle = '#333'; ctx.font = 'bold 11px Varela Round'; ctx.textAlign = 'center';
    ctx.fillText("Prof. Sigma", pencilBtn.x + pencilBtn.width/2, pencilBtn.y + pencilBtn.height + 6);

    // --- CAIXA DE DIÁLOGO ---
    if (isHelpVisible) {
        let bairroPhase = Math.floor(currentQuestionIndex / 6);
        if (bairroPhase > 2) bairroPhase = 2;
        let hintText = hints[bairroPhase];

        const boxW = 280;
        const boxH = 65;
        const boxX = 425;
        const boxY = 450;

        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';

        ctx.beginPath();
        ctx.moveTo(boxX + boxW - 10, boxY + 20);
        ctx.lineTo(boxX + boxW + 15, boxY + 35);
        ctx.lineTo(boxX + boxW - 10, boxY + 45);
        ctx.fill();

        ctx.beginPath();
        ctx.roundRect(boxX, boxY, boxW, boxH, 10);
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#FFD700';
        ctx.stroke();

        ctx.fillStyle = '#333';
        ctx.font = 'bold 14px Varela Round';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';

        let lines = hintText.split('\n');
        ctx.fillText(lines[0], boxX + 15, boxY + 22);
        if (lines[1]) {
            ctx.fillText(lines[1], boxX + 15, boxY + 44);
        }
    }
}

// --- TELA INICIAL (Cutscene: Professor Sigma explica a missão) ---
function drawIntro() {
    // overlay suave
    ctx.fillStyle = 'rgba(255, 255, 255, 0.82)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // painel
    ctx.fillStyle = COLORS.signBg;
    ctx.beginPath(); ctx.roundRect(120, 70, 560, 380, 20); ctx.fill();
    ctx.lineWidth = 5; ctx.strokeStyle = '#FFFFFF'; ctx.stroke();

    ctx.textAlign = 'center';
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `bold ${30 * fontScale()}px Varela Round`;
    ctx.fillText("Street Numbers", 400, 118);
    ctx.font = `${16 * fontScale()}px Varela Round`;
    ctx.fillText("Bem-vindo a Numerópolis!", 400, 148);

    // Imagem do Professor Sigma (à esquerda da mensagem)
    ctx.save();
    ctx.translate(200, 300);
    ctx.scale(2.4, 2.4);
    ctx.rotate(-Math.PI / 16);
    drawSigmaShape();
    ctx.restore();
    ctx.fillStyle = '#06351c'; ctx.font = `bold ${14 * fontScale()}px Varela Round`; ctx.textAlign = 'center';
    ctx.fillText("Prof. Sigma", 200, 420);

    // Fala do Professor Sigma (ao lado da imagem)
    ctx.fillStyle = '#06351c';
    ctx.font = `bold ${15 * fontScale()}px Varela Round`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    const speech = [
        "Olá! Eu sou o Professor Sigma.",
        "Uma tempestade numérica",
        "bagunçou nossa cidade.",
        "Com o carrinho Numix, resolva",
        "os desafios e traga de volta",
        "a harmonia dos números.",
        "",
        "Sem pressa, sem limite de tempo.",
        "Use ← → e ESPAÇO para responder."
    ];
    let ly = 195;
    speech.forEach(line => { ctx.fillText(line, 300, ly); ly += 25; });
    ctx.textAlign = 'center';

    // Botão Começar
    ctx.fillStyle = COLORS.highlight;
    ctx.beginPath(); ctx.roundRect(startBtn.x, startBtn.y, startBtn.width, startBtn.height, 12); ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = '#007B3A'; ctx.stroke();
    ctx.fillStyle = '#06351c'; ctx.font = `bold ${22 * fontScale()}px Varela Round`;
    ctx.textBaseline = 'middle';
    ctx.fillText("Começar", 400, startBtn.y + startBtn.height/2);
    ctx.textBaseline = 'alphabetic';
}

function drawVictoryScreen() {
    if (gameState !== 'victory') return;
    ctx.fillStyle = COLORS.victoryBg; ctx.fillRect(0, 0, canvas.width, canvas.height);

    particles.forEach(p => {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rotation); ctx.fillStyle = p.color;
        if (p.isStar) {
            ctx.beginPath();
            for (let i = 0; i < 5; i++) { ctx.lineTo(Math.cos((18 + i * 72) / 180 * Math.PI) * p.size, -Math.sin((18 + i * 72) / 180 * Math.PI) * p.size); ctx.lineTo(Math.cos((54 + i * 72) / 180 * Math.PI) * (p.size/2), -Math.sin((54 + i * 72) / 180 * Math.PI) * (p.size/2)); }
            ctx.closePath(); ctx.fill();
        } else { ctx.beginPath(); ctx.arc(0, 0, p.size / 1.5, 0, Math.PI * 2); ctx.fill(); }
        ctx.restore();
        p.y += p.speedY; p.x += p.speedX; p.rotation += p.spinSpeed;
        if (p.y > canvas.height + 20) { p.y = -20; p.x = Math.random() * canvas.width; }
    });

    ctx.fillStyle = COLORS.signBg; ctx.beginPath(); ctx.roundRect(150, 170, 500, 240, 20); ctx.fill();
    ctx.lineWidth = 5; ctx.strokeStyle = '#FFFFFF'; ctx.stroke();
    ctx.fillStyle = '#FFFFFF'; ctx.textAlign = 'center';

    ctx.font = `bold ${36 * fontScale()}px Varela Round`; ctx.fillText("Parabéns!", 400, 225);
    ctx.font = `${22 * fontScale()}px Varela Round`; ctx.fillText("Você trouxe a harmonia de volta!", 400, 270);
    ctx.font = `${16 * fontScale()}px Varela Round`; ctx.fillStyle = '#E0FFFF'; ctx.fillText("Numerópolis está organizada graças a você.", 400, 300);
    let sc = session ? session.correct : score;
    let st = session ? session.total : score;
    let ap = st ? Math.round(sc / st * 100) : 100;
    ctx.fillText(`Acertos: ${sc} • Erros: ${st - sc} • Aproveitamento: ${ap}%`, 400, 325);

    ctx.fillStyle = COLORS.highlight; ctx.beginPath(); ctx.roundRect(restartBtn.x, restartBtn.y, restartBtn.width, restartBtn.height, 10); ctx.fill();
    ctx.fillStyle = '#333'; ctx.font = `bold ${20 * fontScale()}px Varela Round`; ctx.fillText("Recomeçar", 400, restartBtn.y + 30);
}

// --- TELA DE ABERTURA (splash, antes do login) ---
function drawSplash() {
    splashFrame++;

    // Fundo azul pastel bem clarinho
    let g = ctx.createLinearGradient(0, 0, 0, 600);
    g.addColorStop(0, '#EAF4FF'); g.addColorStop(0.55, '#DCEEFF'); g.addColorStop(1, '#CFE7FB');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 800, 600);

    // Números espalhados (suaves)
    const nums = [
        { x: 90, y: 120, v: '7', s: 54, r: -0.2 }, { x: 700, y: 110, v: '3', s: 60, r: 0.25 },
        { x: 150, y: 470, v: '9', s: 50, r: 0.15 }, { x: 660, y: 500, v: '5', s: 64, r: -0.18 },
        { x: 400, y: 70, v: '1', s: 40, r: 0.1 }, { x: 55, y: 300, v: '4', s: 44, r: 0.3 },
        { x: 745, y: 320, v: '8', s: 46, r: -0.25 }, { x: 300, y: 545, v: '2', s: 38, r: 0.2 },
        { x: 520, y: 150, v: '6', s: 42, r: -0.15 }, { x: 230, y: 200, v: '%', s: 40, r: 0.1 },
        { x: 560, y: 525, v: '√', s: 46, r: -0.1 }, { x: 470, y: 470, v: '=', s: 38, r: 0.15 }
    ];
    ctx.fillStyle = 'rgba(90, 155, 212, 0.28)';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    nums.forEach(n => {
        ctx.save(); ctx.translate(n.x, n.y); ctx.rotate(n.r);
        ctx.font = `bold ${n.s}px Varela Round`; ctx.fillText(n.v, 0, 0);
        ctx.restore();
    });

    // Logo "Street Numbers" em azul
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.font = 'bold 66px Varela Round';
    ctx.fillStyle = '#0a2a52'; ctx.fillText('Street', 403, 203);
    ctx.fillStyle = '#1E90FF'; ctx.fillText('Street', 400, 200);
    ctx.fillStyle = '#0a2a52'; ctx.fillText('Numbers', 403, 273);
    ctx.fillStyle = '#3FA9F5'; ctx.fillText('Numbers', 400, 270);
    ctx.font = '22px Varela Round'; ctx.fillStyle = '#3a6ea5';
    ctx.fillText('Numerópolis', 400, 308);

    // Numix
    ctx.save(); ctx.translate(400, 425); ctx.scale(1.5, 1.5); drawNumixShape(); ctx.restore();

    // Chamada (pisca suavemente)
    let alpha = 0.55 + 0.45 * Math.sin(splashFrame * 0.05);
    ctx.font = 'bold 20px Varela Round';
    ctx.fillStyle = `rgba(46, 90, 138, ${alpha.toFixed(3)})`;
    ctx.fillText('Toque ou pressione qualquer tecla para começar', 400, 565);
}

function loop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (appView === 'splash') { drawSplash(); requestAnimationFrame(loop); return; }
    updatePhysics();
    drawEnvironment();
    if (gameState === 'intro') {
        drawIntro();
    } else {
        drawChallenge();
        drawNumix();
        drawUI();
        drawHelpSystem();
        drawVictoryScreen();
    }
    requestAnimationFrame(loop);
}

// ===== Ligações com a interface HTML (acessibilidade e toque) =====
function setupUI() {
    const $ = (id) => document.getElementById(id);
    const panel = $('settingsPanel');

    // Refletir estado salvo nos checkboxes
    $('optSound').checked = settings.sound;
    $('optMusic').checked = settings.music;
    $('optContrast').checked = settings.highContrast;
    $('optLargeFont').checked = settings.largeFont;
    $('optExtraTime').checked = settings.extraTime;

    $('settingsBtn').addEventListener('click', () => { ensureAudio(); panel.classList.toggle('hidden'); });
    $('settingsClose').addEventListener('click', () => panel.classList.add('hidden'));

    $('optSound').addEventListener('change', (e) => { settings.sound = e.target.checked; saveSettings(); });
    $('optMusic').addEventListener('change', (e) => {
        settings.music = e.target.checked; saveSettings();
        if (settings.music) startMusic(); else stopMusic();
    });
    $('optContrast').addEventListener('change', (e) => { settings.highContrast = e.target.checked; saveSettings(); });
    $('optLargeFont').addEventListener('change', (e) => { settings.largeFont = e.target.checked; saveSettings(); });
    $('optExtraTime').addEventListener('change', (e) => { settings.extraTime = e.target.checked; saveSettings(); });

    // Controles de toque (mobile)
    const press = (key) => () => { if (gameState === 'playing') keys[key] = true; };
    const release = (key) => () => { keys[key] = false; };
    const bindHold = (el, key) => {
        el.addEventListener('touchstart', (e) => { e.preventDefault(); press(key)(); }, { passive: false });
        el.addEventListener('touchend',   (e) => { e.preventDefault(); release(key)(); }, { passive: false });
        el.addEventListener('mousedown', press(key));
        el.addEventListener('mouseup', release(key));
        el.addEventListener('mouseleave', release(key));
    };
    bindHold($('btnLeft'), 'ArrowLeft');
    bindHold($('btnRight'), 'ArrowRight');

    const confirmAction = (e) => {
        if (e) e.preventDefault();
        ensureAudio();
        if (gameState === 'intro') { startGame(); return; }
        if (gameState === 'victory') { resetGame(); return; }
        if (isWaitingForSelection) confirmSelection();
    };
    $('btnConfirm').addEventListener('touchstart', confirmAction, { passive: false });
    $('btnConfirm').addEventListener('click', confirmAction);

    $('exitBtn').addEventListener('click', () => {
        if (confirm("Sair e voltar para a tela de login?")) logout();
    });
}

// ===== Autenticação / troca de telas (Aluno x Professor) =====
function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function fmtDate(iso) {
    if (!iso) return '—';
    try { const d = new Date(iso); return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); }
    catch (e) { return '—'; }
}

function showSplash() {
    appView = 'splash';
    document.body.classList.remove('in-game');
    document.getElementById('authScreen').classList.add('hidden');
    document.getElementById('teacherDashboard').classList.add('hidden');
    document.getElementById('settingsPanel').classList.add('hidden');
}

function showAuth() {
    appView = 'auth';
    document.body.classList.remove('in-game');
    document.getElementById('authScreen').classList.remove('hidden');
    document.getElementById('teacherDashboard').classList.add('hidden');
    document.getElementById('settingsPanel').classList.add('hidden');
    // volta para a escolha de perfil
    document.getElementById('roleChoice').classList.remove('hidden');
    document.getElementById('studentForm').classList.add('hidden');
    document.getElementById('teacherForm').classList.add('hidden');
}

function showStudentGame() {
    appView = 'student';
    document.body.classList.add('in-game');
    document.getElementById('authScreen').classList.add('hidden');
    document.getElementById('teacherDashboard').classList.add('hidden');
}

function showTeacher() {
    appView = 'teacher';
    document.body.classList.remove('in-game');
    stopMusic();
    document.getElementById('authScreen').classList.add('hidden');
    document.getElementById('teacherDashboard').classList.remove('hidden');
    renderDashboard();
}

function enterStudentGame(rec) {
    currentStudentKey = rec.key;
    currentStudentName = rec.user;
    // reinicia o estado do jogo para este aluno
    score = 0; distanceDriven = 0; nextChallengeAt = 500;
    isChallengeVisible = false; isWaitingForSelection = false; isAnswered = false; isHelpVisible = false;
    currentQuestionIndex = 0; particles = []; numix.x = 400; praiseText = null; praiseTimer = 0; session = null;
    potholes = [ { x: 380, y: 300, size: 40 }, { x: 450, y: 450, size: 60 }, { x: 320, y: 550, size: 50 } ];
    challenge = { distanceY: 200, ...questionBank[0] };
    gameState = 'intro';
    showStudentGame();
}

// Cadastro de aluno (usuário + senha). Impede duplicado por chave normalizada.
function registerStudent(name, pass, hintEl) {
    name = (name || '').trim();
    const key = normalizeKey(name);
    if (!key) { hintEl.textContent = 'Digite um nome de usuário.'; return; }
    if (!pass || pass.length < 3) { hintEl.textContent = 'A senha precisa ter ao menos 3 caracteres.'; return; }
    studentsDB = migrateStudents(getStudents());
    if (studentsDB[key]) { hintEl.textContent = 'Já existe um aluno com esse nome. Use Entrar.'; return; }
    studentsDB[key] = { user: name, key: key, pass: hashPass(pass), createdAt: nowISO(), lastPlayed: nowISO(), sessions: [], bestScore: 0, timesCompleted: 0 };
    saveStudents();
    enterStudentGame(studentsDB[key]);
}

// Login de aluno existente.
function loginStudent(name, pass, hintEl) {
    const key = normalizeKey(name);
    studentsDB = migrateStudents(getStudents());
    const rec = studentsDB[key];
    if (!rec) { hintEl.textContent = 'Aluno não encontrado. Use "Cadastrar novo aluno".'; return; }
    if (!rec.pass) { // conta antiga sem senha: define agora (primeiro acesso)
        if (!pass || pass.length < 3) { hintEl.textContent = 'Primeiro acesso: crie uma senha (mín. 3 caracteres).'; return; }
        rec.pass = hashPass(pass); saveStudents();
        enterStudentGame(rec); return;
    }
    if (rec.pass !== hashPass(pass)) { hintEl.textContent = 'Senha incorreta. Tente novamente.'; return; }
    enterStudentGame(rec);
}

// Cadastro de professor.
function registerTeacher(name, pass, hintEl) {
    name = (name || '').trim();
    const key = normalizeKey(name);
    if (!key) { hintEl.textContent = 'Digite um nome de usuário.'; return; }
    if (!pass || pass.length < 3) { hintEl.textContent = 'A senha precisa ter ao menos 3 caracteres.'; return; }
    teachersDB = getTeachers();
    if (teachersDB[key]) { hintEl.textContent = 'Já existe um professor com esse nome. Use Entrar.'; return; }
    teachersDB[key] = { user: name, key: key, pass: hashPass(pass), createdAt: nowISO() };
    saveTeachers();
    showTeacher();
}

// Login de professor existente.
function loginTeacher(name, pass, hintEl) {
    const key = normalizeKey(name);
    teachersDB = getTeachers();
    const rec = teachersDB[key];
    if (!rec) { hintEl.textContent = 'Professor não encontrado. Use "Cadastrar novo professor".'; return; }
    if (rec.pass !== hashPass(pass)) { hintEl.textContent = 'Senha incorreta. Tente novamente.'; return; }
    showTeacher();
}

function logout() {
    stopMusic();
    currentStudentKey = null;
    currentStudentName = null;
    session = null;
    gameState = 'intro';
    showAuth();
}

// Painel do professor: agrega o progresso de cada aluno
function aggregate(rec) {
    let c = 0, t = 0, completed = 0;
    const per = { raiz: { c: 0, t: 0 }, porcentagem: { c: 0, t: 0 }, regra: { c: 0, t: 0 } };
    (rec.sessions || []).forEach(s => {
        c += s.correct || 0; t += s.total || 0; if (s.completed) completed++;
        ['raiz', 'porcentagem', 'regra'].forEach(k => {
            if (s.perBairro && s.perBairro[k]) { per[k].c += s.perBairro[k].c; per[k].t += s.perBairro[k].t; }
        });
    });
    return { correct: c, errors: t - c, accuracy: t ? Math.round(c / t * 100) : 0, totalAnswered: t, completed, per };
}

function renderDashboard() {
    studentsDB = migrateStudents(getStudents());
    const wrap = document.getElementById('studentList');
    const keys = Object.keys(studentsDB).sort((a, b) =>
        (studentsDB[a].user || a).localeCompare(studentsDB[b].user || b, 'pt-BR'));
    if (!keys.length) {
        wrap.innerHTML = '<p class="muted">Nenhum aluno cadastrado ainda. Peça para um aluno se cadastrar e jogar.</p>';
        return;
    }
    const bairroLabels = { raiz: 'Raiz Quadrada', porcentagem: 'Porcentagens', regra: 'Regra de Três' };
    let html = '';
    keys.forEach(n => {
        const r = studentsDB[n];
        const a = aggregate(r);
        let bars = '';
        ['raiz', 'porcentagem', 'regra'].forEach(k => {
            const pct = a.per[k].t ? Math.round(a.per[k].c / a.per[k].t * 100) : 0;
            bars += `<div class="barline">
                <span class="lbl">${bairroLabels[k]}</span>
                <span class="track"><span class="fill" style="width:${pct}%"></span></span>
                <span class="pct">${a.per[k].t ? pct + '%' : '—'}</span>
            </div>`;
        });
        const conclLabel = a.completed === 1 ? 'conclusão' : 'conclusões';
        html += `<div class="student">
            <div class="srow">
                <strong>${escapeHtml(r.user || n)}</strong>
                <span>${a.completed} ${conclLabel} • ${a.accuracy}% de acerto geral</span>
            </div>
            <div class="bars">${bars}</div>
            <div class="meta">
                <span>Acertos: ${a.correct} • Erros: ${a.errors} • ${a.totalAnswered} respostas • Último acesso: ${fmtDate(r.lastPlayed)}</span>
                <button data-student="${escapeHtml(n)}">Remover</button>
            </div>
        </div>`;
    });
    wrap.innerHTML = html;
    wrap.querySelectorAll('button[data-student]').forEach(btn => {
        btn.addEventListener('click', () => {
            const key = btn.getAttribute('data-student');
            const disp = (studentsDB[key] && studentsDB[key].user) || key;
            if (confirm(`Remover os dados de "${disp}"? Esta ação não pode ser desfeita.`)) {
                delete studentsDB[key];
                saveStudents();
                renderDashboard();
            }
        });
    });
}

function setupAuth() {
    const $ = (id) => document.getElementById(id);

    $('roleStudent').addEventListener('click', () => {
        $('roleChoice').classList.add('hidden');
        $('studentForm').classList.remove('hidden');
        $('studentHint').textContent = '';
        $('studentUser').value = ''; $('studentPass').value = '';
        $('studentUser').focus();
    });

    $('roleTeacher').addEventListener('click', () => {
        $('roleChoice').classList.add('hidden');
        $('teacherForm').classList.remove('hidden');
        $('teacherHint').textContent = '';
        $('teacherUser').value = ''; $('teacherPass').value = '';
        $('teacherUser').focus();
    });

    document.querySelectorAll('#authScreen .back').forEach(b => {
        b.addEventListener('click', () => {
            $('studentForm').classList.add('hidden');
            $('teacherForm').classList.add('hidden');
            $('roleChoice').classList.remove('hidden');
        });
    });

    // Aluno: Entrar (submit) / Cadastrar
    $('studentForm').addEventListener('submit', (e) => {
        e.preventDefault();
        ensureAudio();
        loginStudent($('studentUser').value, $('studentPass').value, $('studentHint'));
    });
    $('studentRegister').addEventListener('click', () => {
        ensureAudio();
        registerStudent($('studentUser').value, $('studentPass').value, $('studentHint'));
    });

    // Professor: Entrar (submit) / Cadastrar
    $('teacherForm').addEventListener('submit', (e) => {
        e.preventDefault();
        loginTeacher($('teacherUser').value, $('teacherPass').value, $('teacherHint'));
    });
    $('teacherRegister').addEventListener('click', () => {
        registerTeacher($('teacherUser').value, $('teacherPass').value, $('teacherHint'));
    });

    $('teacherLogout').addEventListener('click', logout);
}

setupUI();
setupAuth();
showSplash();
loop();
