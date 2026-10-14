
"use strict";

// ============================================
// TOM & JERRY: A GRANDE PERSEGUIÇÃO
// ============================================

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const overlay = document.getElementById("overlay");
const startButton = document.getElementById("startButton");
const pauseButton = document.getElementById("pauseButton");

const scoreElement = document.getElementById("score");
const livesElement = document.getElementById("lives");
const levelElement = document.getElementById("level");

const menuTitle = document.getElementById("menuTitle");
const menuDescription = document.getElementById("menuDescription");

const WIDTH = canvas.width;
const HEIGHT = canvas.height;

// ============================================
// IMAGENS DOS PERSONAGENS
// ============================================

function carregarImagem(caminho) {
    const imagem = new Image();
    imagem.src = caminho;
    return imagem;
}

const imagemTom = carregarImagem("imagens/tom.png");
const imagemJerry = carregarImagem("imagens/jerry.png");

// ============================================
// ESTADO DO JOGO
// ============================================

let jogoAtivo = false;
let jogoPausado = false;
let pontuacao = 0;
let vidas = 3;
let nivel = 1;
let queijos = [];
let particulas = [];
let animacaoId = null;
let ultimoTempo = 0;
let audioContext = null;
let proximoSomColisao = 0;

const teclas = {};

const tom = {
    x: 100,
    y: 100,
    velocidade: 92,
    tamanho: 64,
    direcao: 1
};

const jerry = {
    x: 450,
    y: 280,
    velocidade: 190,
    tamanho: 43,
    direcao: 1
};

// ============================================
// EFEITOS SONOROS
// Criados pelo próprio navegador, sem arquivos.
// ============================================

function tocarSom(frequencia = 500, duracao = 0.1, tipo = "sine") {
    try {
        if (!audioContext) {
            const AudioCtx =
                window.AudioContext || window.webkitAudioContext;

            if (!AudioCtx) return;

            audioContext = new AudioCtx();
        }

        if (audioContext.state === "suspended") {
            audioContext.resume();
        }

        const oscilador = audioContext.createOscillator();
        const volume = audioContext.createGain();

        oscilador.type = tipo;
        oscilador.frequency.setValueAtTime(
            frequencia,
            audioContext.currentTime
        );

        volume.gain.setValueAtTime(0.08, audioContext.currentTime);
        volume.gain.exponentialRampToValueAtTime(
            0.001,
            audioContext.currentTime + duracao
        );

        oscilador.connect(volume);
        volume.connect(audioContext.destination);

        oscilador.start();
        oscilador.stop(audioContext.currentTime + duracao);
    } catch (erro) {
        // O jogo continua funcionando mesmo sem áudio.
    }
}

function somQueijo() {
    tocarSom(740, 0.09, "sine");
    setTimeout(() => tocarSom(980, 0.12, "sine"), 70);
}

function somColisao() {
    tocarSom(170, 0.22, "sawtooth");
}

function somNivel() {
    tocarSom(520, 0.12);
    setTimeout(() => tocarSom(660, 0.12), 110);
    setTimeout(() => tocarSom(850, 0.18), 220);
}

// ============================================
// CONTROLES DO TECLADO
// ============================================

document.addEventListener("keydown", event => {
    const tecla = event.key.toLowerCase();

    if (
        ["arrowup", "arrowdown", "arrowleft", "arrowright", " "]
        .includes(tecla)
    ) {
        event.preventDefault();
    }

    teclas[tecla] = true;

    if (tecla === "escape" && jogoAtivo) {
        alternarPausa();
    }
});

document.addEventListener("keyup", event => {
    teclas[event.key.toLowerCase()] = false;
});

window.addEventListener("blur", () => {
    for (const tecla in teclas) {
        teclas[tecla] = false;
    }
});

// ============================================
// CONTROLES PARA CELULAR
// ============================================

const direcoesCelular = {
    up: "arrowup",
    down: "arrowdown",
    left: "arrowleft",
    right: "arrowright"
};

document.querySelectorAll("[data-direction]").forEach(botao => {
    const direcao = direcoesCelular[botao.dataset.direction];

    function pressionar(event) {
        event.preventDefault();
        teclas[direcao] = true;
    }

    function soltar(event) {
        event.preventDefault();
        teclas[direcao] = false;
    }

    botao.addEventListener("pointerdown", pressionar);
    botao.addEventListener("pointerup", soltar);
    botao.addEventListener("pointercancel", soltar);
    botao.addEventListener("lostpointercapture", soltar);
});

// ============================================
// INICIAR E REINICIAR
// ============================================

function iniciarJogo() {
    if (animacaoId !== null) {
        cancelAnimationFrame(animacaoId);
        animacaoId = null;
    }

    pontuacao = 0;
    vidas = 3;
    nivel = 1;
    particulas = [];
    jogoAtivo = true;
    jogoPausado = false;
    ultimoTempo = 0;
    proximoSomColisao = 0;

    Object.keys(teclas).forEach(tecla => {
        teclas[tecla] = false;
    });

    tom.x = 85;
    tom.y = 85;
    tom.velocidade = 92;
    tom.direcao = 1;

    jerry.x = WIDTH * 0.53;
    jerry.y = HEIGHT * 0.58;
    jerry.velocidade = 190;
    jerry.direcao = 1;

    gerarQueijos();
    atualizarPlacar();

    overlay.style.display = "none";
    pauseButton.textContent = "⏸ Pausar";

    if (audioContext && audioContext.state === "suspended") {
        audioContext.resume();
    }

    desenharCenario();
    desenharQueijos();
    desenharPersonagem(tom, imagemTom);
    desenharPersonagem(jerry, imagemJerry);

    animacaoId = requestAnimationFrame(loop);
}

startButton.addEventListener("click", iniciarJogo);

// ============================================
// PAUSAR E CONTINUAR
// ============================================

function alternarPausa() {
    if (!jogoAtivo) return;

    jogoPausado = !jogoPausado;

    pauseButton.textContent = jogoPausado
        ? "▶ Continuar"
        : "⏸ Pausar";

    if (!jogoPausado) {
        ultimoTempo = 0;
    }
}

pauseButton.addEventListener("click", alternarPausa);

// ============================================
// GERAR QUEIJOS
// ============================================

function gerarQueijos() {
    queijos = [];

    const quantidade = Math.min(5 + nivel * 2, 20);

    for (let i = 0; i < quantidade; i++) {
        let queijo;
        let tentativas = 0;

        do {
            queijo = {
                x: 35 + Math.random() * (WIDTH - 70),
                y: 35 + Math.random() * (HEIGHT - 70),
                tamanho: 12,
                coletado: false
            };

            tentativas++;
        } while (
            Math.hypot(queijo.x - tom.x, queijo.y - tom.y) < 90 &&
            tentativas < 30
        );

        queijos.push(queijo);
    }
}

// ============================================
// DESENHAR O CENÁRIO
// ============================================

function desenharCenario() {
    // Piso da cozinha.
    ctx.fillStyle = "#dfc99c";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Azulejos do chão.
    const ladoAzulejo = 45;

    for (let y = 0; y < HEIGHT; y += ladoAzulejo) {
        for (let x = 0; x < WIDTH; x += ladoAzulejo) {
            if (
                (Math.floor(x / ladoAzulejo) +
                Math.floor(y / ladoAzulejo)) % 2 === 0
            ) {
                ctx.fillStyle = "#ead9b5";
                ctx.fillRect(x, y, ladoAzulejo, ladoAzulejo);
            }
        }
    }

    // Linhas entre os azulejos.
    ctx.strokeStyle = "#c8b48d";
    ctx.lineWidth = 1;

    for (let x = 0; x < WIDTH; x += ladoAzulejo) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, HEIGHT);
        ctx.stroke();
    }

    for (let y = 0; y < HEIGHT; y += ladoAzulejo) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(WIDTH, y);
        ctx.stroke();
    }

    // Balcão superior.
    ctx.fillStyle = "#77503a";
    ctx.fillRect(15, 15, WIDTH - 30, 47);

    ctx.fillStyle = "#bd9065";
    ctx.fillRect(15, 15, WIDTH - 30, 12);

    // Armários do balcão.
    for (let x = 35; x < WIDTH - 50; x += 110) {
        ctx.fillStyle = "#a97850";
        ctx.fillRect(x, 32, 85, 25);

        ctx.strokeStyle = "#69452f";
        ctx.strokeRect(x, 32, 85, 25);

        ctx.fillStyle = "#e9d3a2";
        ctx.fillRect(x + 39, 40, 7, 3);
    }

    // Tapete decorativo.
    ctx.fillStyle = "#a54b3d";
    ctx.fillRect(245, 160, 280, 150);

    ctx.strokeStyle = "#f0d4a0";
    ctx.lineWidth = 4;
    ctx.strokeRect(253, 168, 264, 134);

    // Padrão do tapete.
    ctx.strokeStyle = "#e5b875";
    ctx.lineWidth = 2;

    for (let x = 275; x < 500; x += 25) {
        ctx.beginPath();
        ctx.moveTo(x, 175);
        ctx.lineTo(x, 295);
        ctx.stroke();
    }

    // Mesa no canto inferior esquerdo.
    ctx.fillStyle = "#6c472f";
    ctx.fillRect(22, HEIGHT - 115, 130, 80);

    ctx.fillStyle = "#b17c4f";
    ctx.fillRect(16, HEIGHT - 125, 142, 16);

    ctx.fillStyle = "#d0a16a";
    ctx.fillRect(28, HEIGHT - 108, 118, 62);

    // Porta de saída no canto inferior direito.
    ctx.fillStyle = "#785039";
    ctx.fillRect(WIDTH - 78, HEIGHT - 94, 58, 82);

    ctx.fillStyle = "#4f8052";
    ctx.fillRect(WIDTH - 70, HEIGHT - 86, 42, 74);

    ctx.fillStyle = "#f7d36d";
    ctx.beginPath();
    ctx.arc(WIDTH - 37, HEIGHT - 48, 3, 0, Math.PI * 2);
    ctx.fill();

    // Paredes.
    ctx.fillStyle = "#6d4934";
    ctx.fillRect(0, 0, WIDTH, 12);
    ctx.fillRect(0, HEIGHT - 12, WIDTH, 12);
    ctx.fillRect(0, 0, 12, HEIGHT);
    ctx.fillRect(WIDTH - 12, 0, 12, HEIGHT);

    // Indicação da saída.
    ctx.fillStyle = "#fff9e8";
    ctx.font = "bold 11px Arial";
    ctx.textAlign = "center";
    ctx.fillText("SAÍDA", WIDTH - 49, HEIGHT - 101);
    ctx.textAlign = "left";
}

// ============================================
// DESENHAR OS QUEIJOS
// ============================================

function desenharQueijos() {
    for (const queijo of queijos) {
        if (queijo.coletado) continue;

        ctx.save();
        ctx.translate(queijo.x, queijo.y);
        ctx.rotate(-0.15);

        // Sombra.
        ctx.fillStyle = "#00000025";
        ctx.beginPath();
        ctx.ellipse(1, 3, 13, 9, 0, 0, Math.PI * 2);
        ctx.fill();

        // Queijo.
        ctx.fillStyle = "#ffd447";
        ctx.beginPath();
        ctx.ellipse(0, 0, 13, 9, 0, 0, Math.PI * 2);
        ctx.fill();

        // Casca.
        ctx.strokeStyle = "#dc9c1d";
        ctx.lineWidth = 2;
        ctx.stroke();

        // Furinhos.
        ctx.fillStyle = "#d99b20";

        for (const ponto of [
            [-5, -2, 2],
            [3, -4, 2],
            [5, 3, 1.7],
            [-2, 4, 1.5]
        ]) {
            ctx.beginPath();
            ctx.arc(ponto[0], ponto[1], ponto[2], 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }
}

// ============================================
// DESENHAR PERSONAGENS
// ============================================

function desenharPersonagem(personagem, imagem) {
    const tamanho = personagem.tamanho;

    ctx.save();
    ctx.translate(personagem.x, personagem.y);

    // Sombra no chão.
    ctx.fillStyle = "#00000022";
    ctx.beginPath();
    ctx.ellipse(0, tamanho * 0.37, tamanho * 0.34, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    if (imagem.complete && imagem.naturalWidth > 0) {
        // Espelha a imagem para acompanhar a direção.
        if (personagem.direcao === -1) {
            ctx.scale(-1, 1);
        }

        ctx.drawImage(
            imagem,
            -tamanho / 2,
            -tamanho / 2,
            tamanho,
            tamanho
        );
    } else {
        // Desenho provisório caso a imagem não esteja disponível.
        desenharPersonagemProvisorio(personagem, tamanho);
    }

    ctx.restore();
}

function desenharPersonagemProvisorio(personagem, tamanho) {
    if (personagem === tom) {
        // Corpo e cabeça simplificados do Tom.
        ctx.fillStyle = "#718096";
        ctx.beginPath();
        ctx.ellipse(0, 7, tamanho * 0.35, tamanho * 0.39, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.arc(0, -9, tamanho * 0.3, 0, Math.PI * 2);
        ctx.fill();

        // Orelhas.
        ctx.beginPath();
        ctx.moveTo(-15, -19);
        ctx.lineTo(-13, -34);
        ctx.lineTo(-3, -21);
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(4, -21);
        ctx.lineTo(15, -34);
        ctx.lineTo(16, -16);
        ctx.fill();

        // Olhos.
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.ellipse(-6, -11, 4, 6, 0, 0, Math.PI * 2);
        ctx.ellipse(6, -11, 4, 6, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#202632";
        ctx.beginPath();
        ctx.arc(-5, -10, 2, 0, Math.PI * 2);
        ctx.arc(5, -10, 2, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#efb9b4";
        ctx.beginPath();
        ctx.arc(0, -4, 4, 0, Math.PI * 2);
        ctx.fill();
    } else {
        // Corpo e cabeça simplificados do Jerry.
        ctx.fillStyle = "#a8794f";
        ctx.beginPath();
        ctx.ellipse(0, 5, tamanho * 0.3, tamanho * 0.35, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.arc(0, -7, tamanho * 0.28, 0, Math.PI * 2);
        ctx.fill();

        // Orelhas.
        ctx.fillStyle = "#a8794f";
        ctx.beginPath();
        ctx.arc(-10, -19, 7, 0, Math.PI * 2);
        ctx.arc(10, -19, 7, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#e9a5a1";
        ctx.beginPath();
        ctx.arc(-10, -19, 4, 0, Math.PI * 2);
        ctx.arc(10, -19, 4, 0, Math.PI * 2);
        ctx.fill();

        // Olhos e nariz.
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(-4, -9, 3, 0, Math.PI * 2);
        ctx.arc(4, -9, 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#222222";
        ctx.beginPath();
        ctx.arc(-4, -9, 1.5, 0, Math.PI * 2);
        ctx.arc(4, -9, 1.5, 0, Math.PI * 2);
        ctx.arc(0, -3, 2, 0, Math.PI * 2);
        ctx.fill();
    }
}

// ============================================
// MOVIMENTAÇÃO DO JERRY
// ============================================

function moverJerry(delta) {
    let dx = 0;
    let dy = 0;

    if (teclas["arrowup"] || teclas["w"]) dy--;
    if (teclas["arrowdown"] || teclas["s"]) dy++;
    if (teclas["arrowleft"] || teclas["a"]) dx--;
    if (teclas["arrowright"] || teclas["d"]) dx++;

    // Velocidade igual nas diagonais.
    if (dx !== 0 && dy !== 0) {
        dx *= Math.SQRT1_2;
        dy *= Math.SQRT1_2;
    }

    jerry.x += dx * jerry.velocidade * delta;
    jerry.y += dy * jerry.velocidade * delta;

    if (dx < 0) jerry.direcao = -1;
    if (dx > 0) jerry.direcao = 1;

    limitarPosicao(jerry);
}

// ============================================
// MOVIMENTAÇÃO DO TOM
// ============================================

function moverTom(delta) {
    const dx = jerry.x - tom.x;
    const dy = jerry.y - tom.y;
    const distancia = Math.hypot(dx, dy);

    if (distancia > 1) {
        tom.x += (dx / distancia) * tom.velocidade * delta;
        tom.y += (dy / distancia) * tom.velocidade * delta;

        if (dx < 0) tom.direcao = -1;
        if (dx > 0) tom.direcao = 1;
    }

    limitarPosicao(tom);
}

// ============================================
// LIMITES DO CENÁRIO
// ============================================

function limitarPosicao(personagem) {
    const margem = personagem.tamanho * 0.4 + 12;

    personagem.x = Math.max(
        margem,
        Math.min(WIDTH - margem, personagem.x)
    );

    personagem.y = Math.max(
        margem,
        Math.min(HEIGHT - margem, personagem.y)
    );
}

// ============================================
// PARTÍCULAS DA COLETA
// ============================================

function criarParticulas(x, y) {
    for (let i = 0; i < 9; i++) {
        particulas.push({
            x,
            y,
            vx: (Math.random() - 0.5) * 120,
            vy: (Math.random() - 0.5) * 120,
            vida: 0.35
        });
    }
}

function atualizarParticulas(delta) {
    for (const particula of particulas) {
        particula.x += particula.vx * delta;
        particula.y += particula.vy * delta;
        particula.vida -= delta;
    }

    particulas = particulas.filter(p => p.vida > 0);
}

function desenharParticulas() {
    for (const particula of particulas) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, particula.vida / 0.35);
        ctx.fillStyle = "#ffd447";

        ctx.beginPath();
        ctx.arc(particula.x, particula.y, 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}

// ============================================
// COLETAR QUEIJOS E AVANÇAR DE NÍVEL
// ============================================

function verificarQueijos() {
    for (const queijo of queijos) {
        if (queijo.coletado) continue;

        const distancia = Math.hypot(
            jerry.x - queijo.x,
            jerry.y - queijo.y
        );

        if (distancia < jerry.tamanho * 0.38 + queijo.tamanho) {
            queijo.coletado = true;
            pontuacao += 10;

            criarParticulas(queijo.x, queijo.y);
            somQueijo();
            atualizarPlacar();
        }
    }

    if (queijos.length > 0 && queijos.every(q => q.coletado)) {
        nivel++;

        // O Tom fica progressivamente mais rápido.
        tom.velocidade = Math.min(92 + (nivel - 1) * 13, 180);

        // Jerry também ganha um pequeno aumento de velocidade.
        jerry.velocidade = Math.min(190 + (nivel - 1) * 5, 225);

        gerarQueijos();
        atualizarPlacar();
        somNivel();
    }
}

// ============================================
// COLISÃO ENTRE TOM E JERRY
// ============================================

function verificarColisaoPersonagens() {
    const distancia = Math.hypot(
        tom.x - jerry.x,
        tom.y - jerry.y
    );

    const limite = (tom.tamanho + jerry.tamanho) * 0.34;

    if (distancia < limite) {
        vidas--;
        atualizarPlacar();
        somColisao();

        // Reposiciona os dois para dar chance de fuga.
        tom.x = 55;
        tom.y = 75;

        jerry.x = WIDTH - 100;
        jerry.y = HEIGHT - 115;

        criarParticulas(jerry.x, jerry.y);

        if (vidas <= 0) {
            terminarJogo();
        }
    }
}

// ============================================
// ATUALIZAR PLACAR
// ============================================

function atualizarPlacar() {
    scoreElement.textContent = pontuacao;
    livesElement.textContent = vidas;
    levelElement.textContent = nivel;
}

// ============================================
// FIM DO JOGO
// ============================================

function terminarJogo() {
    jogoAtivo = false;
    jogoPausado = false;

    if (animacaoId !== null) {
        cancelAnimationFrame(animacaoId);
        animacaoId = null;
    }

    overlay.style.display = "flex";
    menuTitle.textContent = "Fim de jogo!";

    menuDescription.textContent =
        "Tom conseguiu alcançar Jerry! Você fez " +
        pontuacao +
        " pontos e chegou ao nível " +
        nivel +
        ". Tente novamente!";

    startButton.textContent = "↻ JOGAR NOVAMENTE";
    pauseButton.textContent = "⏸ Pausar";

    document.querySelector(".instrucoes").style.display = "none";
    document.querySelector(".eyebrow").textContent = "FIM DA PARTIDA";

    desenharCenario();
    desenharQueijos();
    desenharPersonagem(tom, imagemTom);
    desenharPersonagem(jerry, imagemJerry);
}

// ============================================
// DESENHAR PAUSA
// ============================================

function desenharPausa() {
    ctx.fillStyle = "rgba(20, 24, 33, 0.78)";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.font = "bold 36px Arial";
    ctx.fillText("JOGO PAUSADO", WIDTH / 2, HEIGHT / 2 - 10);

    ctx.font = "17px Arial";
    ctx.fillText(
        "Pressione ESC ou clique em Continuar",
        WIDTH / 2,
        HEIGHT / 2 + 30
    );

    ctx.textAlign = "left";
}

// ============================================
// LOOP PRINCIPAL
// ============================================

function loop(tempoAtual) {
    if (!jogoAtivo) {
        animacaoId = null;
        return;
    }

    if (jogoPausado) {
        desenharCenario();
        desenharQueijos();
        desenharParticulas();
        desenharPersonagem(tom, imagemTom);
        desenharPersonagem(jerry, imagemJerry);
        desenharPausa();

        
const imagemTom = new Image();
imagemTom.src = "imagens/tom.png";

const imagemJerry = new Image();
imagemJerry.src = "imagens/jerry.png";

desenharPersonagem(tom, imagemTom);
desenharPersonagem(jerry, imagemJerry);

        ultimoTempo = 0;
        animacaoId = requestAnimationFrame(loop);
        return;
    }

    // Evita saltos grandes ao voltar para a janela.
    const delta = ultimoTempo === 0
        ? 0
        : Math.min((tempoAtual - ultimoTempo) / 1000, 0.035);

    ultimoTempo = tempoAtual;

    moverJerry(delta);
    moverTom(delta);

    verificarQueijos();
    verificarColisaoPersonagens();
    atualizarParticulas(delta);

    desenharCenario();
    desenharQueijos();
    desenharParticulas();
    desenharPersonagem(tom, imagemTom);
    desenharPersonagem(jerry, imagemJerry);

    if (jogoAtivo) {
        animacaoId = requestAnimationFrame(loop);
    } else {
        animacaoId = null;
    }
}

// ============================================
// ESTADO INICIAL
// ============================================

desenharCenario();
gerarQueijos();
desenharQueijos();
desenharPersonagem(tom, imagemTom);
desenharPersonagem(jerry, imagemJerry);
atualizarPlacar();

