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

// Estado do Jogo
const baseSpeed = 2;  
let speed = baseSpeed;          
let roadOffset = 0;
let score = 0;
let distanceDriven = 0; 
let nextChallengeAt = 500; 

let isChallengeVisible = false;
let isWaitingForSelection = false; 
let isAnswered = false;
let currentQuestionIndex = 0;
let isGameFinished = false; 

// --- Sistema de Ajuda (Professor Lápis) ---
let isHelpVisible = false;
const pencilBtn = { x: 720, y: 480, width: 60, height: 90 }; 

// CORREÇÃO: As quebras de linha (\n) foram adicionadas de volta
const hints = [
    "DICA: Que número multiplicado por\nele mesmo resulta nesse valor?",
    "DICA: Multiplique o número pela\nporcentagem e divida por 100.",
    "DICA: Multiplique os valores cruzados\npara achar a resposta."
];

let particles = [];
const restartBtn = { x: 300, y: 335, width: 200, height: 45 };

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
    if (isGameFinished) return; 
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

canvas.addEventListener('click', (e) => {
    const pos = getMousePos(canvas, e);
    if (isGameFinished) {
        if (pos.x >= restartBtn.x && pos.x <= restartBtn.x + restartBtn.width && pos.y >= restartBtn.y && pos.y <= restartBtn.y + restartBtn.height) {
            resetGame();
        }
    } else {
        if (pos.x >= pencilBtn.x && pos.x <= pencilBtn.x + pencilBtn.width && pos.y >= pencilBtn.y && pos.y <= pencilBtn.y + pencilBtn.height) {
            isHelpVisible = !isHelpVisible;
        } else {
            isHelpVisible = false;
        }
    }
});

canvas.addEventListener('mousemove', (e) => {
    const pos = getMousePos(canvas, e);
    let cursor = 'default';

    if (isGameFinished) {
        if (pos.x >= restartBtn.x && pos.x <= restartBtn.x + restartBtn.width && pos.y >= restartBtn.y && pos.y <= restartBtn.y + restartBtn.height) {
            cursor = 'pointer';
        }
    } else {
        if (pos.x >= pencilBtn.x && pos.x <= pencilBtn.x + pencilBtn.width && pos.y >= pencilBtn.y && pos.y <= pencilBtn.y + pencilBtn.height) {
            cursor = 'help';
            isHelpVisible = true;
        } else {
            isHelpVisible = false;
        }
    }
    canvas.style.cursor = cursor;
});

function resetGame() {
    speed = baseSpeed; score = 0; distanceDriven = 0; nextChallengeAt = 500;
    isChallengeVisible = false; isWaitingForSelection = false; isAnswered = false; isHelpVisible = false;
    currentQuestionIndex = 0; isGameFinished = false; particles = []; numix.x = 400;
    potholes = [ { x: 380, y: 300, size: 40 }, { x: 450, y: 450, size: 60 }, { x: 320, y: 550, size: 50 } ];
    challenge = { distanceY: 200, ...questionBank[0] };
    canvas.style.cursor = 'default';
}

function confirmSelection() {
    isWaitingForSelection = false; isAnswered = true;
    if (numix.x < 330) challenge.chosenIndex = 0;
    else if (numix.x < 470) challenge.chosenIndex = 1;
    else challenge.chosenIndex = 2;

    let selectedOption = challenge.options[challenge.chosenIndex];
    if (selectedOption.isCorrect) {
        score++; currentQuestionIndex++; 
    }

    setTimeout(() => {
        isAnswered = false; isChallengeVisible = false; 
        if (currentQuestionIndex >= questionBank.length) startVictorySequence(); 
        else nextChallengeAt = distanceDriven + 500; 
    }, 2500);
}

function startVictorySequence() {
    isGameFinished = true; speed = 0; isHelpVisible = false;
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
    if (isGameFinished) return; 
    speed = (isAnswered || isWaitingForSelection) ? 0 : baseSpeed; 
    let turnSpeed = 7; 
    if (keys.ArrowLeft) numix.x -= turnSpeed;
    if (keys.ArrowRight) numix.x += turnSpeed;
    if (numix.x < 220) numix.x = 220;
    if (numix.x > 580) numix.x = 580;
    distanceDriven += speed;
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
    if (!isGameFinished) roadOffset += speed * 2;
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

    if (bairroPhase < 2 && !isGameFinished) {
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

function drawNumix() {
    const cx = numix.x;
    const cy = numix.y;
    const h = numix.height;

    ctx.save(); 
    ctx.translate(cx, cy);
    
    let tilt = 0;
    if (keys.ArrowLeft && !isGameFinished) tilt = -0.08; 
    if (keys.ArrowRight && !isGameFinished) tilt = 0.08;
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
    ctx.restore();
}

function drawChallenge() {
    if (!isChallengeVisible) return;

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

    ctx.fillStyle = '#FFFFFF'; ctx.font = 'bold 22px Arial, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; 
    ctx.fillText(challenge.title, 400, signY + (signH / 2));

    ctx.fillStyle = COLORS.signBg; ctx.beginPath(); ctx.roundRect(330, 105, 140, 50, 10); ctx.fill();
    ctx.fillStyle = '#FFF'; ctx.font = 'bold 24px Varela Round'; ctx.textBaseline = 'alphabetic'; 
    ctx.fillText(challenge.question, 400, 138);

    if (!isAnswered && !isWaitingForSelection && !isGameFinished) {
        challenge.distanceY += speed * 0.8;
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

        ctx.fillStyle = COLORS.boxBg; ctx.beginPath(); ctx.roundRect(-boxWidth/2, -boxHeight/2, boxWidth, boxHeight, 5); ctx.fill();
        ctx.fillStyle = '#FFF'; ctx.font = `bold ${35 * scale}px Varela Round`; ctx.textBaseline = 'middle'; ctx.textAlign = 'center'; ctx.fillText(opt.value, 0, 0);
        
        if (isAnswered && challenge.chosenIndex === index) {
            ctx.font = `bold ${45 * scale}px Varela Round`; ctx.fillStyle = opt.isCorrect ? '#78C679' : '#FF8A8A'; ctx.fillText(opt.isCorrect ? "✓" : "✗", boxWidth/2, -boxHeight/2);
        }
        ctx.restore();
    });
}

function drawUI() {
    ctx.fillStyle = '#333'; ctx.font = 'bold 18px Varela Round'; ctx.textAlign = 'left'; ctx.fillText(`Progresso: ${score} / ${questionBank.length}`, 20, 30);
    ctx.textAlign = 'center'; ctx.fillStyle = '#555';
    if (isWaitingForSelection && !isGameFinished) {
        ctx.font = 'bold 20px Varela Round'; ctx.fillText("Escolha com ← → e aperte ESPAÇO", 400, 560);
    } else if (distanceDriven < 150 && !isChallengeVisible && !isGameFinished) {
        ctx.font = 'bold 18px Varela Round'; ctx.fillText("Use as setas ← e → para guiar o Numix", 400, 560);
    }
}

// --- DESENHO DO PROFESSOR LÁPIS ---
function drawHelpSystem() {
    if (isGameFinished) return;

    ctx.save();
    ctx.translate(pencilBtn.x + pencilBtn.width/2, pencilBtn.y + pencilBtn.height/2);
    ctx.rotate(-Math.PI / 16); 
    
    if (isHelpVisible) ctx.scale(1.1, 1.1); 

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

    ctx.restore();

    // --- CORREÇÃO DA CAIXA DE DIÁLOGO ---
    if (isHelpVisible) {
        let bairroPhase = Math.floor(currentQuestionIndex / 6);
        if (bairroPhase > 2) bairroPhase = 2;
        let hintText = hints[bairroPhase];

        const boxW = 280;
        const boxH = 65;
        const boxX = 425; 
        const boxY = 450; 
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        
        // Desenha a "pontinha" (tail) do balão apontando para o lápis
        ctx.beginPath();
        ctx.moveTo(boxX + boxW - 10, boxY + 20);
        ctx.lineTo(boxX + boxW + 15, boxY + 35); // Ponta que encosta no lápis
        ctx.lineTo(boxX + boxW - 10, boxY + 45);
        ctx.fill();

        // Desenha o corpo do balão
        ctx.beginPath(); 
        ctx.roundRect(boxX, boxY, boxW, boxH, 10); 
        ctx.fill();
        ctx.lineWidth = 2; 
        ctx.strokeStyle = '#FFD700'; 
        ctx.stroke();

        // Insere o texto centralizado
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

function drawVictoryScreen() {
    if (!isGameFinished) return;
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

    ctx.fillStyle = COLORS.signBg; ctx.beginPath(); ctx.roundRect(150, 180, 500, 220, 20); ctx.fill();
    ctx.lineWidth = 5; ctx.strokeStyle = '#FFFFFF'; ctx.stroke();
    ctx.fillStyle = '#FFFFFF'; ctx.textAlign = 'center';
    
    ctx.font = 'bold 36px Varela Round'; ctx.fillText("Parabéns!", 400, 235);
    ctx.font = '22px Varela Round'; ctx.fillText("Você trouxe a harmonia de volta!", 400, 280);
    ctx.font = '16px Varela Round'; ctx.fillStyle = '#E0FFFF'; ctx.fillText("Numerópolis está organizada graças a você.", 400, 310);

    ctx.fillStyle = COLORS.highlight; ctx.beginPath(); ctx.roundRect(restartBtn.x, restartBtn.y, restartBtn.width, restartBtn.height, 10); ctx.fill();
    ctx.fillStyle = '#333'; ctx.font = 'bold 20px Varela Round'; ctx.fillText("Recomeçar", 400, restartBtn.y + 30); 
}

function loop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    updatePhysics(); 
    drawEnvironment(); 
    drawChallenge(); 
    drawNumix(); 
    drawUI(); 
    drawHelpSystem(); 
    drawVictoryScreen();
    requestAnimationFrame(loop);
}
loop();