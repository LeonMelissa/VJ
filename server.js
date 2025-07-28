const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const { v4: uuidv4 } = require('uuid'); // Para generar IDs únicos de juego

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3000;

// Sirve archivos estáticos desde la carpeta 'public'
app.use(express.static(path.join(__dirname, 'public')));

// --- Datos de los Acertijos ---
const puzzles = [
    {
        id: '1',
        title: 'El Canto del Grifo Durmiente',
        description: 'Para pasar al Valle Escondido, deben imitar el canto de las bestias sagradas. El Guardián del Viento les dará una secuencia de sonidos y la Sacerdotisa de la Tierra tiene la clave para traducir.',
        pisterInfo: 'Secuencia de sonidos: "Miau - Grrr - Pío - Quiquiriquí"',
        guesserInfo: 'Clave de traducción: "Miau=Gato", "Grrr=Perro", "Pío=Pájaro", "Quiquiriquí=Gallo". Debes nombrar al animal que corresponde a la secuencia completa.',
        correctAnswer: 'Gato Perro Pájaro Gallo',
        feedbackCorrect: '¡El grifo ronronea! La puerta se abre.',
        feedbackIncorrect: 'El grifo gruñe. Revisa la traducción.'
    },
    // Puedes añadir más acertijos aquí:
    // {
    //     id: '2',
    //     title: 'El Mapa Fragmentado',
    //     description: 'El mapa del tesoro está roto. Cada uno tiene una parte. Descríbanse lo que ven para ubicar el siguiente punto.',
    //     pisterInfo: 'Tu fragmento muestra: Una cascada doble y al norte, un árbol con hojas doradas.',
    //     guesserInfo: 'Tu fragmento muestra: Un puente de piedra y al oeste, una cueva con una runa brillante. El punto de encuentro es donde se cruzan las rutas que salen de ambos puntos.',
    //     correctAnswer: 'Puente con la cascada / La cueva y el arbol dorado', // La respuesta podría ser más compleja, requiriendo más parsing
    //     feedbackCorrect: 'El mapa se ilumina. ¡Sigan adelante!',
    //     feedbackIncorrect: 'Los fragmentos no encajan. Revisa tus descripciones.'
    // },
];

let currentPuzzleIndex = 0; // Para llevar la cuenta del acertijo actual

// --- Gestión de Juegos Activos ---
const activeGames = {}; // { gameId: { player1: socketId, player2: socketId, pister: socketId, guesser: socketId, currentPuzzle: puzzleObject } }

io.on('connection', (socket) => {
    console.log('Nuevo usuario conectado:', socket.id);

    // Un cliente intenta crear un juego
    socket.on('create_game', () => {
        const gameId = uuidv4();
        activeGames[gameId] = {
            player1: socket.id, // Host (será el pistero)
            player2: null,
            pister: socket.id,
            guesser: null,
            currentPuzzle: puzzles[currentPuzzleIndex],
            currentClues: []
        };
        socket.join(gameId); // El socket se une a una "sala" específica
        socket.gameId = gameId; // Guarda el gameId en el socket para referencia
        console.log(`Juego creado con ID: ${gameId} por ${socket.id}`);
        socket.emit('game_ready', { role: 'pister', gameId: gameId, isHost: true });
        socket.emit('load_puzzle', activeGames[gameId].currentPuzzle);
    });

    // Un cliente intenta unirse a un juego existente
    socket.on('join_game', (gameId) => {
        const game = activeGames[gameId];
        if (game && !game.player2) {
            game.player2 = socket.id; // Segundo jugador (será el adivinador)
            game.guesser = socket.id;
            socket.join(gameId);
            socket.gameId = gameId;
            console.log(`Usuario ${socket.id} se unió al juego ${gameId}`);

            // Informar a ambos jugadores que el juego está listo
            io.to(game.player1).emit('game_ready', { role: 'pister', gameId: gameId, isHost: true }); // Refrescar host
            io.to(game.player2).emit('game_ready', { role: 'guesser', gameId: gameId, isHost: false });

            // Cargar el acertijo inicial para ambos
            io.to(gameId).emit('load_puzzle', game.currentPuzzle);
        } else {
            socket.emit('message', 'Juego no encontrado o ya lleno.');
            console.log(`Intento de unión fallido para ${socket.id} al juego ${gameId}`);
        }
    });

    // Recibir pista del pistero
    socket.on('send_clue', (clue) => {
        const gameId = socket.gameId;
        const game = activeGames[gameId];
        if (game && socket.id === game.pister) {
            console.log(`Pista de ${socket.id} en ${gameId}: ${clue}`);
            game.currentClues.push(clue); // Guardar pistas (opcional, para referencia)
            io.to(game.guesser).emit('clue_received', clue); // Enviar pista al adivinador
        }
    });

    // Recibir respuesta del adivinador
    socket.on('send_answer', (answer) => {
        const gameId = socket.gameId;
        const game = activeGames[gameId];
        if (game && socket.id === game.guesser) {
            console.log(`Respuesta de ${socket.id} en ${gameId}: ${answer}`);
            
            // Lógica de verificación: hazla flexible para tus acertijos
            const isCorrect = answer.toLowerCase().trim() === game.currentPuzzle.correctAnswer.toLowerCase().trim();

            if (isCorrect) {
                io.to(gameId).emit('answer_result', { correct: true, feedback: game.currentPuzzle.feedbackCorrect });
                console.log(`Acertijo ${game.currentPuzzle.id} resuelto en ${gameId}`);
                
                // Pasar al siguiente acertijo
                currentPuzzleIndex++;
                if (currentPuzzleIndex < puzzles.length) {
                    game.currentPuzzle = puzzles[currentPuzzleIndex];
                    game.currentClues = []; // Limpiar pistas para el nuevo acertijo
                    setTimeout(() => { // Pequeña pausa para que vean el mensaje de "correcto"
                        io.to(gameId).emit('load_puzzle', game.currentPuzzle);
                    }, 2000); // Cargar el siguiente acertijo después de 2 segundos
                } else {
                    io.to(gameId).emit('game_over', '¡Felicidades! Han encontrado el tesoro.');
                    console.log(`Juego terminado en ${gameId}`);
                    delete activeGames[gameId]; // Limpiar el juego
                }

            } else {
                io.to(gameId).emit('answer_result', { correct: false, feedback: game.currentPuzzle.feedbackIncorrect });
            }
        }
    });

    // Manejo de desconexiones
    socket.on('disconnect', () => {
        console.log('Usuario desconectado:', socket.id);
        // Lógica para manejar la desconexión de un jugador
        // Por ejemplo, si uno se desconecta, el juego termina para ambos.
        for (const gameId in activeGames) {
            const game = activeGames[gameId];
            if (game.player1 === socket.id || game.player2 === socket.id) {
                console.log(`Juego ${gameId} terminado por desconexión de ${socket.id}`);
                // Notificar al otro jugador si está conectado
                if (game.player1 && game.player1 !== socket.id) {
                    io.to(game.player1).emit('game_over', 'Tu pareja se ha desconectado. El juego ha terminado.');
                } else if (game.player2 && game.player2 !== socket.id) {
                    io.to(game.player2).emit('game_over', 'Tu pareja se ha desconectado. El juego ha terminado.');
                }
                delete activeGames[gameId]; // Eliminar el juego
                break;
            }
        }
    });
});

server.listen(PORT, () => {
    console.log(`Servidor escuchando en http://localhost:${PORT}`);
});