const socket = io(); // Conecta al servidor Socket.IO

// --- Referencias a elementos HTML ---
const connectionInfoDiv = document.getElementById('connection-info');
const gameLinkSpan = document.getElementById('game-link');
const gameAreaDiv = document.getElementById('game-area');
const roleDisplay = document.getElementById('role-display');

// Elementos para el CANVAS del Laberinto
const mazeCanvas = document.getElementById('mazeCanvas');
const ctx = mazeCanvas.getContext('2d');

// Elementos para mostrar los Acertijos
const puzzleTitle = document.getElementById('puzzle-title');
const puzzleDescription = document.getElementById('puzzle-description');

// Sección del Mago (Quien ADIVINA y se Mueve)
const magoSection = document.getElementById('pister-section'); // Su ID en HTML es 'pister-section'
const magoInfo = document.getElementById('pister-info');
const magoInput = document.getElementById('pister-input'); // Este será el input del Mago para responder
const sendMagoAnswerBtn = document.getElementById('send-clue-btn'); // Este será el botón del Mago para responder
const cluesReceivedMago = document.getElementById('clues-received-mago'); // ¡CORREGIDO! Referencia al div de pistas para el Mago

// Sección de la Sacerdotisa (Quien da PISTAS)
const sacerdotisaSection = document.getElementById('guesser-section'); // Su ID en HTML es 'guesser-section'
const cluesReceivedSacerdotisa = document.getElementById('clues-received-sacerdotisa'); // Referencia al div de pistas para la Sacerdotisa (para mostrar "Pistas Enviadas")
const sacerdotisaInfo = document.getElementById('guesser-info');
const sacerdotisaInput = document.getElementById('guesser-input'); // Este será el input de la Sacerdotisa para dar pistas
const sendSacerdotisaClueBtn = document.getElementById('send-answer-btn'); // Este será el botón de la Sacerdotisa para dar pistas

const clueOptionsDiv = document.getElementById('clue-options'); // Donde se mostrarán los botones de pistas para Sacerdotisa
const messageArea = document.getElementById('message-area'); // Para mensajes del juego

// --- Variables de estado del juego en el cliente ---
let playerRole = null; // 'mago' o 'sacerdotisa'
let localGameId = null; // El ID de la partida a la que estamos conectados
let localMaze = null; // La matriz del laberinto de ESTE JUGADOR (mazeMago para mago, mazeSacerdotisa para sacerdotisa)
let localPlayerPos = { row: 0, col: 0 }; // Posición de ESTE JUGADOR (Mago real, Sacerdotisa simbólica)
let otherPlayerPos = { row: 0, col: 0 }; // Posición del OTRO JUGADOR (Sacerdotisa simbólica, Mago real)

const CELL_SIZE = 50; // Tamaño de cada celda del laberinto en píxeles (50x50)

// --- Funciones de Dibujo del Laberinto ---


function createMagicEffect() {
  const container = document.getElementById('magicEffects');
  const colors = ['#ffffff', '#ffd700', '#ff69b4', '#00ffff']; // blanco, dorado, rosa, cian

  for (let i = 0; i < 15; i++) {
    const particle = document.createElement('div');
    particle.className = 'magic-particle';

    // Posición aleatoria
    particle.style.left = `${Math.random() * 100}%`;
    particle.style.top = `${Math.random() * 100}%`;

    // Color aleatorio
    const color = colors[Math.floor(Math.random() * colors.length)];
    particle.style.backgroundColor = color;
    particle.style.boxShadow = `0 0 6px ${color}, 0 0 12px ${color}`;

    container.appendChild(particle);

    // Remover después de 6 segundos
    setTimeout(() => particle.remove(), 6000);
  }

  setTimeout(createMagicEffect, 2000); // Generar nuevas cada 2 segundos
}

window.addEventListener('DOMContentLoaded', () => {
  createMagicEffect();
});

function drawMaze() {
    if (!localMaze || !localMaze.length || !localMaze[0].length) {
        console.error("Error: localMaze no es válido o está vacío para dibujar.");
        return;
    }

    mazeCanvas.width = localMaze[0].length * CELL_SIZE;
    mazeCanvas.height = localMaze.length * CELL_SIZE;

    ctx.clearRect(0, 0, mazeCanvas.width, mazeCanvas.height);

    for (let row = 0; row < localMaze.length; row++) {
        for (let col = 0; col < localMaze[row].length; col++) {
            const x = col * CELL_SIZE;
            const y = row * CELL_SIZE;

            const cell = localMaze[row][col];

            if (cell === 1) { // Pared
                ctx.fillStyle = '#3e2d5c'; // Púrpura oscuro (pared)
            } else if (cell === 2) { // Puerta o acertijo
                ctx.fillStyle = '#ff2da6'; // Rosa fuerte
            } else if (cell === 3) { // Punto de decisión
                ctx.fillStyle = '#ffcf40'; // Amarillo brillante
            } else { // Camino libre
                ctx.fillStyle = '#2c1f3e'; // Camino (más oscuro que la pared)
            }

            ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);

            // Contenido adicional en las celdas especiales
            if (cell === 2) {
                ctx.fillStyle = '#ffffff'; // Blanco
                ctx.font = `${CELL_SIZE * 0.6}px Cinzel`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('?', x + CELL_SIZE / 2, y + CELL_SIZE / 2);
            }

            if (cell === 3) {
                ctx.fillStyle = '#000000'; // Negro para la X
                ctx.font = `${CELL_SIZE * 0.6}px Cinzel`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('X', x + CELL_SIZE / 2, y + CELL_SIZE / 2);
            }

            // Cuadrícula visual (opcional)
            ctx.strokeStyle = '#1c102a';
            ctx.lineWidth = 1;
            ctx.strokeRect(x, y, CELL_SIZE, CELL_SIZE);
        }
    }

    // Dibujar jugador local
    ctx.fillStyle = '#2575fc'; // Azul eléctrico
    ctx.beginPath();
    ctx.arc(
        localPlayerPos.col * CELL_SIZE + CELL_SIZE / 2,
        localPlayerPos.row * CELL_SIZE + CELL_SIZE / 2,
        CELL_SIZE / 3,
        0,
        Math.PI * 2
    );
    ctx.fill();
    ctx.strokeStyle = '#ffffff'; // Borde blanco
    ctx.lineWidth = 2;
    ctx.stroke();

    // Dibujar al otro jugador si aplica
    if (localGameId && (otherPlayerPos.row !== localPlayerPos.row || otherPlayerPos.col !== localPlayerPos.col)) {
        if (otherPlayerPos.row !== 0 || otherPlayerPos.col !== 0 || playerRole === 'sacerdotisa') {
            ctx.fillStyle = '#4caf50'; // Verde para el otro jugador
            ctx.beginPath();
            ctx.arc(
                otherPlayerPos.col * CELL_SIZE + CELL_SIZE / 2,
                otherPlayerPos.row * CELL_SIZE + CELL_SIZE / 2,
                CELL_SIZE / 3,
                0,
                Math.PI * 2
            );
            ctx.fill();
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 2;
            ctx.stroke();
        }
    }
}


// --- Eventos de Socket.IO (Cliente) ---

// Se ejecuta cuando el servidor confirma que el juego está listo y asigna el rol
socket.on('game_ready', (data) => {
    playerRole = data.role; // Asigna 'mago' o 'sacerdotisa'
    localGameId = data.gameId;
    localMaze = data.mazeData; // La matriz del laberinto para este jugador
    localPlayerPos = { row: data.playerPos[0], col: data.playerPos[1] };

    connectionInfoDiv.style.display = 'none'; // Oculta la pantalla de conexión
    gameAreaDiv.style.display = 'block'; // Muestra la interfaz del juego

    roleDisplay.textContent = `Eres el: ${playerRole === 'mago' ? 'Mago' : 'Sacerdotisa'}`;

    // Configura la visibilidad de las secciones de input/output según el rol
    if (playerRole === 'mago') {
        magoSection.style.display = 'block'; // El Mago es quien ADIVINA (su sección es 'pister-section' en HTML)
        sacerdotisaSection.style.display = 'none'; // Oculta la sección de la Sacerdotisa
        mazeCanvas.style.display = 'block'; // El Mago ve el laberinto
        magoInput.placeholder = "Escribe tu adivinanza aquí..."; // Placeholder para el Mago
        sendMagoAnswerBtn.textContent = "Enviar Respuesta"; // Botón para el Mago
        cluesReceivedMago.innerHTML = ''; // Limpiar pistas recibidas para el Mago
    } else { // Sacerdotisa
        sacerdotisaSection.style.display = 'block'; // La Sacerdotisa es quien da PISTAS (su sección es 'guesser-section' en HTML)
        magoSection.style.display = 'none'; // Oculta la sección del Mago
        mazeCanvas.style.display = 'block'; // La Sacerdotisa también ve el laberinto del mago para ayudar
        sacerdotisaInput.placeholder = "Escribe tu pista aquí..."; // Placeholder para la Sacerdotisa
        sendSacerdotisaClueBtn.textContent = "Enviar Pista"; // Botón para la Sacerdotisa
    }
    
    // Si el jugador es el primero en llegar (el host), muestra el enlace para compartir
    if (data.isHost) {
        const url = window.location.origin + `?gameId=${localGameId}`;
        gameLinkSpan.textContent = url;
        gameLinkSpan.onclick = () => { navigator.clipboard.writeText(url); alert('¡Enlace copiado!'); };
        connectionInfoDiv.style.display = 'block'; // Re-muestra info de conexión para que se vea el link
    } else {
        connectionInfoDiv.style.display = 'none'; // Oculta si ya no es el host esperando
    }

    drawMaze(); // Dibuja el laberinto inicial y los jugadores
});

// Recibe actualizaciones del estado del juego desde el servidor
socket.on('game_state_update', (data) => {
    // Actualiza la posición y el laberinto según el rol de este cliente
    if (playerRole === 'mago') {
        localPlayerPos = { row: data.magoPos[0], col: data.magoPos[1] };
        otherPlayerPos = { row: data.sacerdotisaPos[0], col: data.sacerdotisaPos[1] };
        localMaze = data.mazeMago; // El Mago siempre ve su propio laberinto actualizado
        messageArea.textContent = ''; // Limpiar mensajes si el mago se movió
    } else { // Sacerdotisa
        localPlayerPos = { row: data.sacerdotisaPos[0], col: data.sacerdotisaPos[1] }; // Su posición simbólica
        otherPlayerPos = { row: data.magoPos[0], col: data.magoPos[1] }; // La posición real del Mago
        localMaze = data.mazeMago; // La sacerdotisa ve el laberinto del mago para ayudar
        messageArea.textContent = ''; // Limpiar mensajes
    }
    
    drawMaze(); // ¡Redibuja el laberinto con las nuevas posiciones y posibles cambios!
});

// Cuando el servidor activa un acertijo (Mago o Sacerdotisa lo reciben)
socket.on('load_puzzle', (puzzleData) => {
    puzzleTitle.textContent = puzzleData.title;
    puzzleDescription.textContent = puzzleData.description;
    messageArea.textContent = ''; // Limpiar mensajes anteriores

    if (playerRole === 'mago') { // El Mago es el que adivina
        magoInfo.textContent = puzzleData.guesserInfo; // Mago ve lo que necesita para adivinar
        magoInput.value = '';
        magoInput.focus();
        messageArea.style.color = '#f1c40f';
        messageArea.textContent = '¡Acertijo activado! Espera las pistas de la Sacerdotisa para responder.';

        // Ocultar opciones de pistas para el Mago
        if (clueOptionsDiv) clueOptionsDiv.innerHTML = '';
        if (clueOptionsDiv) clueOptionsDiv.style.display = 'none';

    } else { // Sacerdotisa es la que da pistas
        sacerdotisaInfo.textContent = puzzleData.pisterInfo.preamble; // Sacerdotisa ve su instrucción
        sacerdotisaInput.value = ''; // Su input es para escribir la pista
        sacerdotisaInput.focus();
        
        messageArea.style.color = '#f1c40f';
        messageArea.textContent = '¡Acertijo activado! Dale pistas al Mago.';
        
        cluesReceivedSacerdotisa.innerHTML = ''; // Limpiar pistas anteriores (Sacerdotisa no recibe en este div, pero lo limpia)

        // Mostrar opciones de pistas como botones a la Sacerdotisa
        if (clueOptionsDiv) {
            clueOptionsDiv.innerHTML = ''; // Limpiar botones anteriores
            clueOptionsDiv.style.display = 'block'; // Mostrar el div de opciones

            puzzleData.pisterInfo.clues.forEach((clueText, index) => {
                const button = document.createElement('button');
                button.textContent = `Pista ${index + 1}`; // Etiqueta del botón
                button.title = clueText; // El texto de la pista en el tooltip
                button.style.margin = '5px';
                button.style.padding = '8px 12px';
                button.style.backgroundColor = '#3498db'; // Color azul para botones de pista
                button.style.color = 'white';
                button.style.border = 'none';
                button.style.borderRadius = '5px';
                button.style.cursor = 'pointer';
                button.style.fontSize = '0.9em';
                button.style.transition = 'background-color 0.3s ease';
                button.onmouseover = () => button.style.backgroundColor = '#2980b9';
                button.onmouseout = () => button.style.backgroundColor = '#3498db';

                button.onclick = () => {
                    // Envía la pista al servidor
                    socket.emit('send_clue', clueText);
                    messageArea.textContent = 'Pista enviada. Esperando la respuesta del Mago...';
                    // Opcional: Deshabilitar el botón de pista una vez enviado
                    // button.disabled = true;
                };
                clueOptionsDiv.appendChild(button);
            });
        }
    }
});

// Recibir pista de la Sacerdotisa (solo el Mago la recibe)
socket.on('clue_received', (clue) => {
    if (playerRole === 'mago') {
        const p = document.createElement('p');
        p.textContent = `Pista de la Sacerdotisa: "${clue}"`;
        cluesReceivedMago.appendChild(p); // ¡CORREGIDO! Usa el ID específico para el Mago
        magoInput.focus(); // El mago mantiene el foco para escribir su respuesta
    }
});

// Resultado del intento de adivinanza (ambos lo reciben)
socket.on('answer_result', (data) => {
    if (data.correct) {
        // Mostrar el feedback normal (opcional, si quieres que se vea también el feedback normal del puzzle)
        messageArea.style.color = '#27ae60'; // Verde
        messageArea.textContent = data.feedback; // Esto mostrará el "La puerta se ilumina..."
        
        // Mostrar el hechizo de amor en un modal especial si se envió
        if (data.loveSpellText) {
            showSpellModal(data.loveSpellText);
        }
        // Limpiar elementos de acertijo después de resolverlo
        puzzleTitle.textContent = '';
        puzzleDescription.textContent = '';
        magoInfo.textContent = '';
        sacerdotisaInfo.textContent = '';
        cluesReceivedMago.innerHTML = '';
        cluesReceivedSacerdotisa.innerHTML = '';
        if (clueOptionsDiv) clueOptionsDiv.innerHTML = '';
        if (clueOptionsDiv) clueOptionsDiv.style.display = 'none';

    } else {
        messageArea.style.color = '#e74c3c'; // Rojo
        messageArea.textContent = data.feedback; // El feedback de error
    }
});


// Manejar cambio de laberinto (por punto de decisión)
socket.on('maze_changed', (data) => {
    messageArea.style.color = '#f1c40f';
    messageArea.textContent = data.message;
    
    // Actualiza el laberinto local con el nuevo laberinto
    if (playerRole === 'mago') {
        localMaze = data.mazeMago;
        localPlayerPos = { row: data.magoPos[0], col: data.magoPos[1] };
    } else { // Sacerdotisa
        localMaze = data.mazeMago; // Sacerdotisa sigue viendo el laberinto del mago
        localPlayerPos = { row: data.sacerdotisaPos[0], col: data.sacerdotisaPos[1] }; // Su posición simbólica
    }
    
    drawMaze(); // Redibujar el nuevo laberinto

    // Limpiar info de acertijos antiguos si estaban activos
    puzzleTitle.textContent = '';
    puzzleDescription.textContent = '';
    magoInfo.textContent = '';
    sacerdotisaInfo.textContent = '';
    cluesReceivedMago.innerHTML = ''; // ¡CORREGIDO! Limpiar pistas para el Mago
    cluesReceivedSacerdotisa.innerHTML = ''; // Limpiar pistas para la Sacerdotisa
    if (clueOptionsDiv) clueOptionsDiv.innerHTML = '';
    if (clueOptionsDiv) clueOptionsDiv.style.display = 'none';

    // Opcional: Si el Mago llegó a un punto de decisión, limpiar los botones de elección
    const decisionOptionsDiv = document.getElementById('decision-options'); // Si lo creamos en HTML
    if (decisionOptionsDiv) decisionOptionsDiv.innerHTML = '';
    if (decisionOptionsDiv) decisionOptionsDiv.style.display = 'none';
});

// Manejar punto de decisión
socket.on('decision_point_reached', (data) => {
  if (playerRole === 'mago') {
    const modal = document.getElementById('decision-modal');
    const buttonsContainer = document.getElementById('decision-buttons');

    buttonsContainer.innerHTML = ''; // Limpiar opciones anteriores

    data.options.forEach(option => {
      const button = document.createElement('button');
      button.textContent = option.name;
      button.onclick = () => {
        socket.emit('choose_path', option.id);
        modal.style.display = 'none'; // Ocultar el modal tras la elección
      };
      buttonsContainer.appendChild(button);
    });

    modal.style.display = 'flex';
  }
});



// Fin del juego (cuando un jugador se desconecta, por ahora)
socket.on('game_over', (message) => {
    messageArea.style.color = '#f1c40f';
    messageArea.textContent = message;
    gameAreaDiv.style.display = 'none'; // Oculta la interfaz del juego
    connectionInfoDiv.style.display = 'block'; // Muestra la pantalla de conexión de nuevo
});

// --- Manejo de Entradas del Teclado para Movimiento (Solo Mago) ---
document.addEventListener('keydown', (event) => {
    // Solo el Mago puede mover el jugador y solo si no hay un acertijo activo o una decisión pendiente
    if (playerRole !== 'mago' || !localGameId) {
        return;
    }

    let direction = null;
    switch (event.key) {
        case 'ArrowUp':
            direction = 'up';
            break;
        case 'ArrowDown':
            direction = 'down';
            break;
        case 'ArrowLeft':
            direction = 'left';
            break;
        case 'ArrowRight':
            direction = 'right';
            break;
    }

    if (direction) {
        socket.emit('move_player', direction); // Envía la dirección al servidor
        event.preventDefault(); // Previene que la página se desplace con las flechas
    }
});

// --- Manejo de Clicks de Botones de Pista/Respuesta ---
// Botón para que la SACERDOTISA ENVÍE PISTAS
sendSacerdotisaClueBtn.addEventListener('click', () => {
    const clue = sacerdotisaInput.value.trim();
    if (clue) {
        socket.emit('send_clue', clue);
        sacerdotisaInput.value = '';
        messageArea.style.color = '#f1c40f';
        messageArea.textContent = 'Pista enviada. Esperando la respuesta del Mago...';
    } else {
        messageArea.style.color = '#e74c3c';
        messageArea.textContent = 'Por favor, escribe una pista.';
    }
});

// Botón para que el MAGO ENVÍE SU RESPUESTA
sendMagoAnswerBtn.addEventListener('click', () => {
    const answer = magoInput.value.trim();
    if (answer) {
        socket.emit('send_answer', answer);
        magoInput.value = '';
        messageArea.style.color = '#f1c40f';
        messageArea.textContent = 'Respuesta enviada. Esperando la verificación...';
    } else {
        messageArea.style.color = '#e74c3c';
        messageArea.textContent = 'Por favor, escribe tu adivinanza.';
    }
});


// --- Lógica de Conexión Inicial ---
window.onload = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const gameIdFromUrl = urlParams.get('gameId');

    if (gameIdFromUrl) {
        socket.emit('join_game', gameIdFromUrl);
        gameLinkSpan.textContent = `Uniéndote al juego... ID: ${gameIdFromUrl}`;
        connectionInfoDiv.style.display = 'block'; // Asegura que connection-info sea visible mientras se une
    } else {
        socket.emit('create_game');
        // connectionInfoDiv.style.display se manejará en game_ready
    }
};

function showSpellModal(textoHechizo) {
  const modal = document.getElementById("spell-modal");
  const message = document.getElementById("spell-message");
  message.textContent = textoHechizo;
  modal.style.display = "flex";
}

function closeSpellModal() {
  document.getElementById("spell-modal").style.display = "none";
}

