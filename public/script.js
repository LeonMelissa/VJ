const socket = io(); // Conecta al servidor Socket.IO

const connectionInfoDiv = document.getElementById('connection-info');
const gameLinkSpan = document.getElementById('game-link');
const gameAreaDiv = document.getElementById('game-area');
const roleDisplay = document.getElementById('role-display');
const puzzleTitle = document.getElementById('puzzle-title');
const puzzleDescription = document.getElementById('puzzle-description');

const pisterSection = document.getElementById('pister-section');
const pisterInfo = document.getElementById('pister-info');
const pisterInput = document.getElementById('pister-input');
const sendClueBtn = document.getElementById('send-clue-btn');

const guesserSection = document.getElementById('guesser-section');
const cluesReceived = document.getElementById('clues-received');
const guesserInfo = document.getElementById('guesser-info');
const guesserInput = document.getElementById('guesser-input');
const sendAnswerBtn = document.getElementById('send-answer-btn');

const messageArea = document.getElementById('message-area');

let playerRole = null; // 'pister' o 'guesser'
let currentPuzzle = null;

// --- Eventos de Socket.IO (Cliente) ---

// Cuando el juego está listo y los jugadores asignados
socket.on('game_ready', (data) => {
    playerRole = data.role;
    const gameId = data.gameId;

    connectionInfoDiv.style.display = 'none';
    gameAreaDiv.style.display = 'block';

    roleDisplay.textContent = `Eres el: ${playerRole === 'pister' ? 'Pistero' : 'Adivinador'}`;

    // Muestra la sección relevante según el rol
    if (playerRole === 'pister') {
        pisterSection.style.display = 'block';
        guesserSection.style.display = 'none';
    } else {
        guesserSection.style.display = 'block';
        pisterSection.style.display = 'none';
    }
    
    // Si el jugador es el primero en llegar, muestra el enlace
    if (data.isHost) {
        const url = window.location.origin + `?gameId=${gameId}`;
        gameLinkSpan.textContent = url;
        gameLinkSpan.onclick = () => { navigator.clipboard.writeText(url); alert('¡Enlace copiado!'); };
    }
});

// Cargar un nuevo acertijo
socket.on('load_puzzle', (puzzleData) => {
    currentPuzzle = puzzleData;
    messageArea.textContent = ''; // Limpiar mensajes anteriores
    cluesReceived.innerHTML = ''; // Limpiar pistas anteriores

    puzzleTitle.textContent = currentPuzzle.title;
    puzzleDescription.textContent = currentPuzzle.description;

    if (playerRole === 'pister') {
        pisterInfo.textContent = currentPuzzle.pisterInfo;
        pisterInput.value = '';
        pisterInput.focus();
    } else { // guesser
        guesserInfo.textContent = currentPuzzle.guesserInfo;
        guesserInput.value = '';
        guesserInput.focus();
    }
});

// Recibir pista del pistero
socket.on('clue_received', (clue) => {
    if (playerRole === 'guesser') {
        const p = document.createElement('p');
        p.textContent = `Pista: "${clue}"`;
        cluesReceived.appendChild(p);
        guesserInput.focus();
    }
});

// Resultado del intento de adivinanza
socket.on('answer_result', (data) => {
    if (data.correct) {
        messageArea.style.color = '#27ae60'; // Verde
        messageArea.textContent = '¡Correcto! Acertijo resuelto. Pasando al siguiente...';
        // Aquí podrías agregar una pequeña pausa antes de cargar el siguiente acertijo
    } else {
        messageArea.style.color = '#e74c3c'; // Rojo
        messageArea.textContent = `Incorrecto. Intenta de nuevo. Pista: ${data.feedback}`;
    }
});

// --- Manejo de Eventos del DOM ---

sendClueBtn.addEventListener('click', () => {
    const clue = pisterInput.value.trim();
    if (clue) {
        socket.emit('send_clue', clue);
        pisterInput.value = '';
        messageArea.style.color = '#f1c40f'; // Amarillo
        messageArea.textContent = 'Pista enviada. Esperando la respuesta de tu pareja...';
    } else {
        messageArea.style.color = '#e74c3c';
        messageArea.textContent = 'Por favor, escribe una pista.';
    }
});

sendAnswerBtn.addEventListener('click', () => {
    const answer = guesserInput.value.trim();
    if (answer) {
        socket.emit('send_answer', answer);
        guesserInput.value = '';
        messageArea.style.color = '#f1c40f'; // Amarillo
        messageArea.textContent = 'Respuesta enviada. Esperando la verificación...';
    } else {
        messageArea.style.color = '#e74c3c';
        messageArea.textContent = 'Por favor, escribe tu adivinanza.';
    }
});

// Copiar el enlace del juego al portapapeles
window.onload = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const gameIdFromUrl = urlParams.get('gameId');

    if (gameIdFromUrl) {
        socket.emit('join_game', gameIdFromUrl);
        gameLinkSpan.textContent = 'Uniéndote al juego...';
    } else {
        // Si no hay gameId en la URL, se asume que eres el host
        socket.emit('create_game');
        gameLinkSpan.textContent = 'Generando enlace...'; // Se actualizará al recibir game_ready
    }
};