const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const { v4: uuidv4 } = require('uuid'); // Para generar IDs únicos de juego

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// --- Configuración del Puerto ---
const PORT = process.env.PORT || 3000;

// Sirve archivos estáticos desde la carpeta 'public'
app.use(express.static(path.join(__dirname, 'public')));

// --- Definición de los Laberintos y sus Elementos ---
// 0 = camino, 1 = pared
// 2 = Celda de acertijo/trivia (una "puerta" que requiere resolver un acertijo para pasar)
// 3 = Celda de Punto de Decisión/Bifurcación

// Laberinto Inicial del Mago (Jugador 1) - Es el que se mueve
const mazeMagoInitial = [
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 0, 0, 2, 0, 1, 0, 0, 0, 1], // [1,1] inicio, [1,3] primera puerta
    [1, 1, 1, 1, 0, 1, 0, 1, 2, 1], // [2,8] quinta puerta (según tu nuevo orden)
    [1, 1, 2, 0, 0, 1, 0, 1, 0, 1], // [3,2] segunda puerta (según tu nuevo orden)
    [1, 0, 0, 1, 1, 0, 2, 1, 0, 1], // [4,6] cuarta puerta (según tu nuevo orden)
    [1, 0, 1, 0, 0, 0, 1, 1, 0, 1],
    [1, 0, 0, 2, 1, 1, 2, 0, 0, 1], // [6,3] tercera puerta, [6,6] sexta puerta
    [1, 1, 1, 1, 1, 1, 0, 1, 1, 1],
    [1, 3, 0, 0, 0, 0, 0, 1, 1, 1], // [8,4] Punto de decisión
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
];

// El "laberinto" de la Sacerdotisa (Jugador 2) NO es un mapa navegable para ella.
// Lo representamos como una matriz solo para consistencia, pero su interfaz no permitirá movimiento.
const mazeSacerdotisaVisual = [
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 1, 0, 1, 1, 1, 1, 0, 1],
    [1, 0, 1, 0, 1, 0, 0, 1, 0, 1],
    [1, 0, 1, 0, 1, 0, 1, 1, 0, 1],
    [1, 0, 1, 0, 0, 0, 1, 0, 0, 1],
    [1, 0, 1, 1, 1, 0, 1, 0, 1, 1],
    [1, 0, 0, 0, 1, 0, 1, 0, 0, 1],
    [1, 1, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
];

// Define la posición inicial del Mago en el laberinto inicial
const initialMagoPos = [1, 1]; // [fila, columna]

// La Sacerdotisa no tiene una "posición" de movimiento en el laberinto, pero mantenemos una para consistencia.
const initialSacerdotisaPos = [0, 0]; // Posición simbólica

// --- Nuevos Laberintos para la Bifurcación ---
const followUpMazes = {
    'pathA': {
        name: 'El Sendero de las Brumas',
        maze: [
            [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
            [1, 0, 0, 0, 0, 1, 0, 0, 0, 3], // Inicio aquí [1,1]
            [1, 1, 1, 1, 0, 1, 0, 1, 1, 1],
            [1, 1, 0, 2, 0, 1, 0, 0, 2, 1],
            [1, 1, 0, 1, 1, 1, 1, 1, 0, 1],
            [1, 1, 2, 1, 0, 0, 2, 1, 0, 1],
            [1, 1, 0, 1, 0, 1, 0, 1, 0, 1],
            [1, 1, 0, 1, 0, 1, 0, 1, 0, 1],
            [1, 1, 0, 2, 0, 1, 0, 0, 2, 1], // Algún punto final o tesoro aquí
            [1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
        ],
        initialPos: [1, 1], // Posición de inicio en este nuevo laberinto
        finalTriggerPos: [8, 8] // Ejemplo: Punto final de este camino
    },
    'pathB': {
        name: 'El Camino del Eco Profundo',
        maze: [
            [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
            [1, 0, 0, 1, 0, 0, 0, 0, 0, 1], // Inicio aquí [1,1]
            [1, 0, 1, 1, 1, 1, 1, 1, 0, 1],
            [1, 0, 1, 0, 0, 0, 0, 1, 0, 1],
            [1, 0, 1, 0, 1, 1, 0, 1, 0, 1],
            [1, 0, 1, 0, 1, 0, 0, 1, 0, 1],
            [1, 0, 1, 0, 1, 1, 0, 1, 0, 1],
            [1, 0, 1, 0, 0, 0, 0, 1, 0, 1],
            [1, 0, 0, 0, 1, 1, 0, 0, 0, 1], // Algún punto final o tesoro aquí
            [1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
        ],
        initialPos: [6, 1],
        finalTriggerPos: [8, 8] // Ejemplo: Punto final de este camino
    },

    'pathC': {
        name: 'La Cripta del Tiempo Olvidado',
        maze: [
            [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
            [1, 1, 0, 0, 0, 0, 2, 0, 0, 1], // Inicio aquí [1,1]
            [1, 1, 2, 1, 1, 1, 1, 1, 0, 1],
            [1, 1, 0, 0, 0, 2, 1, 1, 2, 1],
            [1, 1, 1, 1, 1, 0, 1, 0, 0, 1],
            [1, 1, 1, 0, 0, 0, 1, 0, 1, 1],
            [1, 1, 1, 2, 1, 1, 1, 2, 1, 1],
            [1, 0, 0, 0, 1, 1, 1, 0, 1, 1],
            [1, 0, 1, 1, 3, 0, 2, 0, 1, 1], // Algún punto final o tesoro aquí
            [1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
        ],
        initialPos: [8, 1],
        finalTriggerPos: [8, 8] // Ejemplo: Punto final de este camino
    },

     'pathD': {
        name: 'La Cripta del Tiempo Olvidado',
        maze: [
            [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
            [1, 0, 0, 1, 0, 0, 0, 0, 0, 1], // Inicio aquí [1,1]
            [1, 0, 1, 1, 1, 1, 1, 1, 0, 1],
            [1, 0, 1, 0, 0, 0, 0, 1, 0, 1],
            [1, 0, 1, 0, 1, 1, 0, 1, 0, 1],
            [1, 0, 1, 0, 1, 0, 0, 1, 0, 1],
            [1, 0, 1, 0, 1, 1, 0, 1, 0, 1],
            [1, 0, 1, 0, 0, 0, 0, 1, 0, 1],
            [1, 0, 0, 0, 1, 1, 0, 0, 0, 1], // Algún punto final o tesoro aquí
            [1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
        ],
        initialPos: [1, 1],
        finalTriggerPos: [8, 8] // Ejemplo: Punto final de este camino
    }


};

// --- Array de Hechizos Mágicos (Para mostrar al Mago) ---
const loveSpells = [
    "¡Por los poderes del amor eterno! Te protejo con mi escudo de besos y abrazos. Eres mi luz en la oscuridad, mi mago amado. Te amo más que todas las estrellas del firmamento.",
    "Hechizo de protección activado: Mi amor por ti es un muro inquebrantable. Que este conjuro te recuerde que siempre estaré a tu lado, cuidando de ti en cada paso del camino. Te amo infinitamente.",
    "¡Abracadabra de amor! Que cada latido de mi corazón sea un escudo contra todo mal. Eres mi compañero de alma, mi mago valiente. Mi amor te protegerá siempre.",
    "Conjuro de amor eterno: Donde tú vas, iré yo. Lo que tú enfrentes, lo enfrentaré contigo. Mi amor es tu armadura invencible. Juntos somos imbatibles, mi amado mago.",
    "Por el brillo de nuestro primer encuentro, que la luz de nuestro amor te ilumine y te proteja en cada paso, hoy y siempre.",
    "¡Poderes del corazón activados! Que este hechizo te envuelva en el calor de mi amor incondicional. Eres mi razón de ser, mi mago adorado. Te protegeré por siempre.",
    "Con la magia que descubrimos juntos en mundos fantásticos, invoco un escudo de maravilla y valentía que te guarde de todo mal, en este y en cada reino que exploremos.",
];

// --- Datos de los Acertijos ---
// Los acertijos están agrupados por el ID del laberinto al que pertenecen
const allPuzzles = {
    'initial_maze': [ // Los puzzles del primer laberinto (mazeMagoInitial)
        {
            id: 'puzzle_primer_encuentro',
            type: 'maze_door',
            targetPlayerRole: 'mago',
            triggerPos: [1, 3], // --> Coincide con la 1era puerta en mazeMagoInitial
            title: 'El Relicario de la Memoria',
            description: 'Una antigua puerta, adornada con imágenes borrosas, bloquea tu camino. El Mago debe invocar el recuerdo correcto con la guía sutil de la Sacerdotisa.',
            pisterInfo: { // Información para la Sacerdotisa (quien da la pista)
                preamble: 'Sacerdotisa: Tu visión mística se enfoca en la puerta, revelando los números de un recuerdo preciado. Debes guiar al Mago diciéndole estos números, pero sin revelar el contexto directamente. Podrías decirle "El primer número es..." o "El mes tiene X días..."',
                clues: [
                    'Formato DD/MM/AAAA',
                    'inicio =2018',
                    'congeló = FOTO'
                ]
            },
            guesserInfo: 'Mago: En la puerta ves 3 símbolos flotantes: "❤️📸🕒". Debajo hay una inscripción: "El día que la luz congeló nuestro inicio" ',
            correctAnswer: '1',// '20/10/2018',
            feedbackCorrect: 'ES CORRECTO!: La puerta se ilumina con la luz de un recuerdo. ¡Se abre ante ti!',
            feedbackIncorrect: 'INCORRECTO! :La puerta murmura un suspiro triste.',
            actionOnSolve: {
                type: 'open_door',
                doorPos: [1, 3] // La celda en el laberinto del Mago que se convierte de 2 a 0
            }
        },
        {
            id: 'puzzle_camara_augurio',
            type: 'maze_door',
            targetPlayerRole: 'mago',
            triggerPos: [3, 2], // --> Coincide con la 2da puerta en mazeMagoInitial
            title: 'La Cámara del Augurio Olvidado',
            description: 'Mago: Un velo de niebla mágica te impide avanzar. Las inscripciones en la puerta parecen narrar una visión, pero solo la Sacerdotisa puede descifrar el nombre de la profecía que se te revela.',
            pisterInfo: { // Información para la Sacerdotisa (quien tiene la clave)
                preamble: 'Sacerdotisa: Tu orbe de adivinación revela fragmentos de una visión compartida, un relato de criaturas extraordinarias y magia oculta, la primera que juntos presenciaron en tu santuario. Describe la saga a la que pertenecen, o el subtítulo de esa visión inicial, con cuidado.',
                clues: [
                    'Es un cuento de magia, pero no el principal.',
                    'Trata sobre seres que no todos pueden ver.',
                    'Su nombre invoca criaturas legendarias y dónde encontrarlas.',
                    'Es parte de un mundo muy conocido de magos y brujas.',
                    'La historia comenzó con un "descubridor" de esos seres.'
                ]
            },
            guesserInfo: 'Mago: Te enfrentas a la Puerta del Augurio. La Sacerdotisa te dará pistas sobre el nombre de la saga mágica de la primera visión que compartimos. Escúchala y escribe el título principal de esa visión.',
            correctAnswer: '2', //'Animales Fantasticos',
            feedbackCorrect: 'Las nieblas se disipan. ¡La Cámara del Augurio está abierta!',
            feedbackIncorrect: 'El velo se hace más denso. La visión no es clara. Intenta otra vez.',
            actionOnSolve: {
                type: 'open_door',
                doorPos: [3, 2]
            }
        },
        {
            id: 'puzzle_jardin_ecos',
            type: 'maze_door',
            targetPlayerRole: 'mago',
            triggerPos: [6, 3], // --> Coincide con la 3era puerta en mazeMagoInitial
            title: 'El Jardín de los Ecos Primigenios',
            description: 'Mago: Un aura de familiaridad te envuelve, como un susurro del pasado. La puerta ante ti brillaba con una luz suave, pero solo se abrirá al recordar los nombres con los que, en los albores de esta aventura, se conocían los guardianes de este jardín secreto.',
            pisterInfo: {
                preamble: 'Sacerdotisa: La puerta del Jardín de los Ecos te pide recordar los nombres de las dos primeras semillas que plantaron en este vínculo. Nombres que, aunque simples, definieron el inicio de su florecer. Guía al Mago para que los pronuncie.',
                clues: [
                    'Uno de nosotros era una planta que almacena agua, resistente y hermosa.',
                    'El otro era una planta con espinas, fuerte y protectora.',
                    'Nuestros primeros apodos eran como tipos de plantas del desierto.',
                    'Piensa en la dulzura y la resistencia.',
                    'Eran dos nombres, uno para cada uno de nosotros.'
                ]
            },
            guesserInfo: 'Mago: La puerta te exige los nombres originales con los que nos conocimos en este viaje. La Sacerdotisa te susurrará las claves. Debes escribir ambos apodos, separados por una "y".',
            correctAnswer: '3',//'Suculenta y Cactus',
            feedbackCorrect: 'Una fragancia dulce llena el aire. ¡El Jardín de los Ecos se abre!',
            feedbackIncorrect: 'Las raíces de la memoria no se entrelazan. El jardín permanece cerrado. Intenta otra vez.',
            magicSpell: 'Por la fuerza de Cactus y la dulzura de Suculenta, que este lazo invisible fortalezca tu espíritu y aleje cualquier espina del camino, hoy y siempre.',
            actionOnSolve: {
                type: 'open_door',
                doorPos: [6, 3]
            }
        },
        {
            id: 'puzzle_cerezo_ancestral',
            type: 'maze_door',
            targetPlayerRole: 'mago',
            triggerPos: [4, 6], // --> Coincide con la 4ta puerta en mazeMagoInitial
            title: 'El Santuario del Cerezo Susurrante',
            description: 'Mago: Un delicado torii de madera bloquea el pasaje, tallado a mano con esmero, adorna su base, exhalando una fragancia familiar. Para pasar, debes recordar su esencia más profunda. La Sacerdotisa te guiará a través de sus verdades.',
            pisterInfo: { // Información para la Sacerdotisa (quien tiene la clave de la esencia del regalo)
                preamble: 'Sacerdotisa: Tu espíritu se conecta con el bonsái, revelando la esencia de lo que representó. Guía al Mago hacia la palabra que describe el cuidado, la dedicación y el florecimiento de lo que juntos crearon. Piensa en la pequeña joya que le entregaste con tus propias manos.',
                clues: [
                    'Es un árbol, pero en miniatura.',
                    'Sus flores son rosadas, como las nubes en primavera.',
                    'Fue un regalo, hecho con gran esmero y dedicación.',
                    'Representa paciencia, crecimiento y belleza en pequeña escala.',
                    'Está asociado con un país de Oriente y su floración efímera.'
                ]
            },
            guesserInfo: 'Mago: El bonsái te exige una palabra clave que encapsule el significado de nuestra conexión y el esmero puesto en algo valioso y en crecimiento. La Sacerdotisa te dará pistas sobre este pequeño gigante. ¿Qué palabra te susurra el cerezo?',
            correctAnswer: '4', //'Bonsai',
            feedbackCorrect: 'Las ramas del bonsái se apartan suavemente. ¡El Santuario se abre!',
            feedbackIncorrect: 'Las flores se marchitan por un instante. Esa no es la palabra que busca el santuario. Intenta otra vez.',
            magicSpell: 'Con la paciencia del artesano y la vida eterna del cerezo, que este don forjado a mano te envuelva en serenidad y desvíe las sombras, mientras nuestro amor florece sin fin.',
            actionOnSolve: {
                type: 'open_door',
                doorPos: [4, 6]
            },
        },
        {
            id: 'puzzle_galeria_almas',
            type: 'maze_door',
            targetPlayerRole: 'mago',
            triggerPos: [2, 8], // --> Coincide con la 5ta puerta en mazeMagoInitial
            title: 'La Galería de las Almas Conectadas',
            description: 'Mago: Una majestuosa galería se alza frente a ti, adornada con imágenes que evocan encuentros improbables y lazos inquebrantables. Para que el camino se revele, debes recordar los nombres de las dos almas dibujadas que, a pesar de sus mundos opuestos, forjaron un lazo inigualable. La Sacerdotisa posee la visión para guiarte.',
            pisterInfo: { // Información para la Sacerdotisa (quien tiene la visión de ese primer arte)
                preamble: 'Sacerdotisa: Tu mente viaja a una de las primeras ofrendas artísticas de este viaje, un retrato de dos seres muy diferentes de una lejana historia animada. Describe al Mago a estos dos seres que, contra todo pronóstico, encontraron algo especial entre ellos. Concéntrate en sus roles y naturaleza.',
                clues: [
                    'Uno era un rey, poderoso y recién nacido, con una mente brillante.',
                    'La otra era una simple chica, una humana, pero con un espíritu inquebrantable y gran sabiduría en un juego.',
                    'Pertenecían a una historia donde existen cazadores y criaturas fantásticas.',
                    'A pesar de ser de especies diferentes, desarrollaron una conexión profunda y única.',
                    'Sus nombres, juntos, revelan la clave de la puerta.'
                ]
            },
            guesserInfo: 'Mago: La Galería te exige los nombres de los dos seres que sellaron una unión inesperada en ese primer arte. Escucha las descripciones de la Sacerdotisa y nombra a ambos. Escribe sus nombres tal como los recuerdas, separados por una "y".',
            correctAnswer: '5', //'Meruem y Komugi',
            feedbackCorrect: 'Las figuras en la galería cobran vida por un instante. ¡El camino se abre!',
            feedbackIncorrect: 'Los lienzos permanecen en silencio. Esa no es la conexión que la Galería busca. Intenta otra vez.',
            magicSpell: 'Por la conexión de almas que trasciende lo visible, que el arte de nuestro vínculo te sirva de armadura y te guíe hacia la luz, siempre juntos, siempre protegidos.',
            actionOnSolve: {
                type: 'open_door',
                doorPos: [2, 8]
            }
        },
        {
            id: 'puzzle_emblema_guardian',
            type: 'maze_door',
            targetPlayerRole: 'mago',
            triggerPos: [6, 6],
            title: 'El Emblema del Guardián Primordial',
            description: 'Mago: Un antiguo pilar, adornado con un emblema de vid y hojas, bloquea tu paso. Su superficie vibra con la energía de un primer juramento, de una amistad incipiente. Para avanzar, debes invocar el nombre del guardián sereno que inspiró el primer símbolo de tu viaje.',
            pisterInfo: {
                preamble: 'Sacerdotisa: Tu orbe místico te muestra el brillo de una pequeña insignia, un obsequio que marcó el inicio de muchas aventuras. Revela al Mago el nombre del ser que representa ese emblema, el primer "compañero" de nuestro vínculo en un mundo de coleccionistas y batallas. No seas demasiado obvia.',
                clues: [
                    'Es una criatura inicial, número 001 en su códice.',
                    'Su tipo elemental es el de la naturaleza en crecimiento.',
                    'Tiene un bulbo en la espalda que absorbe la luz.',
                    'Puede usar "Látigo Cepa".',
                    'Es un ser que brota de una semilla.'
                ]
            },
            guesserInfo: 'Mago: El pilar te pide el nombre del guardián que inspira el emblema. Escucha las pistas de la Sacerdotisa para invocarlo. ¿Cuál es el nombre de esta criatura mítica?',
            correctAnswer: '6' ,//'Bulbasaur',
            feedbackCorrect: 'El emblema resplandece. ¡El Guardián asiente y la puerta se disuelve!',
            feedbackIncorrect: 'Las vides del pilar se tensan. Ese no es el nombre que honra al Guardián. Intenta otra vez.',
            magicSpell: 'Por la lealtad del guardián de la hierba, que el primer emblema de nuestra aventura te defienda con fuerza elemental y te asegure mi protección incondicional, siempre a tu lado.',
            actionOnSolve: {
                type: 'open_door',
                doorPos: [6, 6]
            }
        }
    ],
    'pathA': [
       {
            id: 'puzzle_primer_encuentro',
            type: 'maze_door',
            targetPlayerRole: 'mago',
            triggerPos: [3, 3], // --> Coincide con la 1era puerta en mazeMagoInitial
            title: 'El Relicario de la Memoria',
            description: 'Una antigua puerta, adornada con imágenes borrosas, bloquea tu camino. El Mago debe invocar el recuerdo correcto con la guía sutil de la Sacerdotisa.',
            pisterInfo: { // Información para la Sacerdotisa (quien da la pista)
                preamble: 'Sacerdotisa: Tu visión mística se enfoca en la puerta, revelando los números de un recuerdo preciado. Debes guiar al Mago diciéndole estos números, pero sin revelar el contexto directamente. Podrías decirle "El primer número es..." o "El mes tiene X días..."',
                clues: [
                    'Formato DD/MM/AAAA',
                    'inicio =2018',
                    'congeló = FOTO'
                ]
            },
            guesserInfo: 'Mago: En la puerta ves 3 símbolos flotantes: "❤️📸🕒". Debajo hay una inscripción: "El día que la luz congeló nuestro inicio" ',
            correctAnswer: '1',// '20/10/2018',
            feedbackCorrect: 'ES CORRECTO!: La puerta se ilumina con la luz de un recuerdo. ¡Se abre ante ti!',
            feedbackIncorrect: 'INCORRECTO! :La puerta murmura un suspiro triste.',
            actionOnSolve: {
                type: 'open_door',
                doorPos: [3, 3] // La celda en el laberinto del Mago que se convierte de 2 a 0
            }
        },
        {
            id: 'puzzle_camara_augurio',
            type: 'maze_door',
            targetPlayerRole: 'mago',
            triggerPos: [5, 2], // --> Coincide con la 2da puerta en mazeMagoInitial
            title: 'La Cámara del Augurio Olvidado',
            description: 'Mago: Un velo de niebla mágica te impide avanzar. Las inscripciones en la puerta parecen narrar una visión, pero solo la Sacerdotisa puede descifrar el nombre de la profecía que se te revela.',
            pisterInfo: { // Información para la Sacerdotisa (quien tiene la clave)
                preamble: 'Sacerdotisa: Tu orbe de adivinación revela fragmentos de una visión compartida, un relato de criaturas extraordinarias y magia oculta, la primera que juntos presenciaron en tu santuario. Describe la saga a la que pertenecen, o el subtítulo de esa visión inicial, con cuidado.',
                clues: [
                    'Es un cuento de magia, pero no el principal.',
                    'Trata sobre seres que no todos pueden ver.',
                    'Su nombre invoca criaturas legendarias y dónde encontrarlas.',
                    'Es parte de un mundo muy conocido de magos y brujas.',
                    'La historia comenzó con un "descubridor" de esos seres.'
                ]
            },
            guesserInfo: 'Mago: Te enfrentas a la Puerta del Augurio. La Sacerdotisa te dará pistas sobre el nombre de la saga mágica de la primera visión que compartimos. Escúchala y escribe el título principal de esa visión.',
            correctAnswer: '2', //'Animales Fantasticos',
            feedbackCorrect: 'Las nieblas se disipan. ¡La Cámara del Augurio está abierta!',
            feedbackIncorrect: 'El velo se hace más denso. La visión no es clara. Intenta otra vez.',
            actionOnSolve: {
                type: 'open_door',
                doorPos: [5, 2]
            }
        },
        {
            id: 'puzzle_jardin_ecos',
            type: 'maze_door',
            targetPlayerRole: 'mago',
            triggerPos: [8, 3], // --> Coincide con la 3era puerta en mazeMagoInitial
            title: 'El Jardín de los Ecos Primigenios',
            description: 'Mago: Un aura de familiaridad te envuelve, como un susurro del pasado. La puerta ante ti brillaba con una luz suave, pero solo se abrirá al recordar los nombres con los que, en los albores de esta aventura, se conocían los guardianes de este jardín secreto.',
            pisterInfo: {
                preamble: 'Sacerdotisa: La puerta del Jardín de los Ecos te pide recordar los nombres de las dos primeras semillas que plantaron en este vínculo. Nombres que, aunque simples, definieron el inicio de su florecer. Guía al Mago para que los pronuncie.',
                clues: [
                    'Uno de nosotros era una planta que almacena agua, resistente y hermosa.',
                    'El otro era una planta con espinas, fuerte y protectora.',
                    'Nuestros primeros apodos eran como tipos de plantas del desierto.',
                    'Piensa en la dulzura y la resistencia.',
                    'Eran dos nombres, uno para cada uno de nosotros.'
                ]
            },
            guesserInfo: 'Mago: La puerta te exige los nombres originales con los que nos conocimos en este viaje. La Sacerdotisa te susurrará las claves. Debes escribir ambos apodos, separados por una "y".',
            correctAnswer: '3',//'Suculenta y Cactus',
            feedbackCorrect: 'Una fragancia dulce llena el aire. ¡El Jardín de los Ecos se abre!',
            feedbackIncorrect: 'Las raíces de la memoria no se entrelazan. El jardín permanece cerrado. Intenta otra vez.',
            magicSpell: 'Por la fuerza de Cactus y la dulzura de Suculenta, que este lazo invisible fortalezca tu espíritu y aleje cualquier espina del camino, hoy y siempre.',
            actionOnSolve: {
                type: 'open_door',
                doorPos: [8, 3]
            }
        },
        {
            id: 'puzzle_cerezo_ancestral',
            type: 'maze_door',
            targetPlayerRole: 'mago',
            triggerPos: [5, 6], // --> Coincide con la 4ta puerta en mazeMagoInitial
            title: 'El Santuario del Cerezo Susurrante',
            description: 'Mago: Un delicado torii de madera bloquea el pasaje, tallado a mano con esmero, adorna su base, exhalando una fragancia familiar. Para pasar, debes recordar su esencia más profunda. La Sacerdotisa te guiará a través de sus verdades.',
            pisterInfo: { // Información para la Sacerdotisa (quien tiene la clave de la esencia del regalo)
                preamble: 'Sacerdotisa: Tu espíritu se conecta con el bonsái, revelando la esencia de lo que representó. Guía al Mago hacia la palabra que describe el cuidado, la dedicación y el florecimiento de lo que juntos crearon. Piensa en la pequeña joya que le entregaste con tus propias manos.',
                clues: [
                    'Es un árbol, pero en miniatura.',
                    'Sus flores son rosadas, como las nubes en primavera.',
                    'Fue un regalo, hecho con gran esmero y dedicación.',
                    'Representa paciencia, crecimiento y belleza en pequeña escala.',
                    'Está asociado con un país de Oriente y su floración efímera.'
                ]
            },
            guesserInfo: 'Mago: El bonsái te exige una palabra clave que encapsule el significado de nuestra conexión y el esmero puesto en algo valioso y en crecimiento. La Sacerdotisa te dará pistas sobre este pequeño gigante. ¿Qué palabra te susurra el cerezo?',
            correctAnswer: '4', //'Bonsai',
            feedbackCorrect: 'Las ramas del bonsái se apartan suavemente. ¡El Santuario se abre!',
            feedbackIncorrect: 'Las flores se marchitan por un instante. Esa no es la palabra que busca el santuario. Intenta otra vez.',
            magicSpell: 'Con la paciencia del artesano y la vida eterna del cerezo, que este don forjado a mano te envuelva en serenidad y desvíe las sombras, mientras nuestro amor florece sin fin.',
            actionOnSolve: {
                type: 'open_door',
                doorPos: [5, 6]
            },
        },
        {
            id: 'puzzle_galeria_almas',
            type: 'maze_door',
            targetPlayerRole: 'mago',
            triggerPos: [8, 8], // --> Coincide con la 5ta puerta en mazeMagoInitial
            title: 'La Galería de las Almas Conectadas',
            description: 'Mago: Una majestuosa galería se alza frente a ti, adornada con imágenes que evocan encuentros improbables y lazos inquebrantables. Para que el camino se revele, debes recordar los nombres de las dos almas dibujadas que, a pesar de sus mundos opuestos, forjaron un lazo inigualable. La Sacerdotisa posee la visión para guiarte.',
            pisterInfo: { // Información para la Sacerdotisa (quien tiene la visión de ese primer arte)
                preamble: 'Sacerdotisa: Tu mente viaja a una de las primeras ofrendas artísticas de este viaje, un retrato de dos seres muy diferentes de una lejana historia animada. Describe al Mago a estos dos seres que, contra todo pronóstico, encontraron algo especial entre ellos. Concéntrate en sus roles y naturaleza.',
                clues: [
                    'Uno era un rey, poderoso y recién nacido, con una mente brillante.',
                    'La otra era una simple chica, una humana, pero con un espíritu inquebrantable y gran sabiduría en un juego.',
                    'Pertenecían a una historia donde existen cazadores y criaturas fantásticas.',
                    'A pesar de ser de especies diferentes, desarrollaron una conexión profunda y única.',
                    'Sus nombres, juntos, revelan la clave de la puerta.'
                ]
            },
            guesserInfo: 'Mago: La Galería te exige los nombres de los dos seres que sellaron una unión inesperada en ese primer arte. Escucha las descripciones de la Sacerdotisa y nombra a ambos. Escribe sus nombres tal como los recuerdas, separados por una "y".',
            correctAnswer: '5', //'Meruem y Komugi',
            feedbackCorrect: 'Las figuras en la galería cobran vida por un instante. ¡El camino se abre!',
            feedbackIncorrect: 'Los lienzos permanecen en silencio. Esa no es la conexión que la Galería busca. Intenta otra vez.',
            magicSpell: 'Por la conexión de almas que trasciende lo visible, que el arte de nuestro vínculo te sirva de armadura y te guíe hacia la luz, siempre juntos, siempre protegidos.',
            actionOnSolve: {
                type: 'open_door',
                doorPos: [8, 8]
            }
        },
        {
            id: 'puzzle_emblema_guardian',
            type: 'maze_door',
            targetPlayerRole: 'mago',
            triggerPos: [3, 8],
            title: 'El Emblema del Guardián Primordial',
            description: 'Mago: Un antiguo pilar, adornado con un emblema de vid y hojas, bloquea tu paso. Su superficie vibra con la energía de un primer juramento, de una amistad incipiente. Para avanzar, debes invocar el nombre del guardián sereno que inspiró el primer símbolo de tu viaje.',
            pisterInfo: {
                preamble: 'Sacerdotisa: Tu orbe místico te muestra el brillo de una pequeña insignia, un obsequio que marcó el inicio de muchas aventuras. Revela al Mago el nombre del ser que representa ese emblema, el primer "compañero" de nuestro vínculo en un mundo de coleccionistas y batallas. No seas demasiado obvia.',
                clues: [
                    'Es una criatura inicial, número 001 en su códice.',
                    'Su tipo elemental es el de la naturaleza en crecimiento.',
                    'Tiene un bulbo en la espalda que absorbe la luz.',
                    'Puede usar "Látigo Cepa".',
                    'Es un ser que brota de una semilla.'
                ]
            },
            guesserInfo: 'Mago: El pilar te pide el nombre del guardián que inspira el emblema. Escucha las pistas de la Sacerdotisa para invocarlo. ¿Cuál es el nombre de esta criatura mítica?',
            correctAnswer: '6' ,//'Bulbasaur',
            feedbackCorrect: 'El emblema resplandece. ¡El Guardián asiente y la puerta se disuelve!',
            feedbackIncorrect: 'Las vides del pilar se tensan. Ese no es el nombre que honra al Guardián. Intenta otra vez.',
            magicSpell: 'Por la lealtad del guardián de la hierba, que el primer emblema de nuestra aventura te defienda con fuerza elemental y te asegure mi protección incondicional, siempre a tu lado.',
            actionOnSolve: {
                type: 'open_door',
                doorPos: [3, 8]
            }
        }
    ],
    'pathB': [
        {
            id: 'pathB_puzzle1',
            type: 'maze_door',
            targetPlayerRole: 'mago',
            triggerPos: [1, 6],
            title: 'El Suspiro de la Esfinge',
            description: 'La Esfinge te susurra un enigma. La Sacerdotisa tiene la solución.',
            pisterInfo: {
                preamble: 'Sacerdotisa: La Esfinge susurra una secuencia numérica. Describe esta secuencia al Mago para que la complete.',
                clues: ['Es una serie de números', 'Empieza con 1, 1', 'Cada número es la suma de los dos anteriores']
            },
            guesserInfo: 'Mago: La Esfinge te da un patrón. Escucha a la Sacerdotisa y encuentra el siguiente número. La secuencia es "1, 1, 2, 3, 5, 8, ?"',
            correctAnswer: '13',
            feedbackCorrect: 'La Esfinge sonríe y se disuelve en el aire.',
            feedbackIncorrect: 'La Esfinge te mira fijamente. No es la respuesta correcta.',
            magicSpell: 'Que la sabiduría de nuestro lazo te guíe a través de cada enigma, y mi protección sea el eco que te resguarde en la profundidad, por siempre.',
            actionOnSolve: { type: 'open_door', doorPos: [1, 6] }
        }
    ]
};

// --- Gestión de Juegos Activos ---
const activeGames = {};

io.on('connection', (socket) => {
    console.log('Nuevo usuario conectado:', socket.id);

    // Un cliente intenta crear un juego (Mago)
    socket.on('create_game', () => {
        const gameId = uuidv4();
        activeGames[gameId] = {
            player1: socket.id, // Socket ID del Mago (Host)
            player2: null,      // Socket ID de la Sacerdotisa
            mago: socket.id,    // Rol del Mago
            sacerdotisa: null,  // Rol de la Sacerdotisa
            currentMazeId: 'initial_maze', // El ID del laberinto actual
            maze: {
                mago: JSON.parse(JSON.stringify(mazeMagoInitial)), // Laberinto del Mago
                sacerdotisa: JSON.parse(JSON.stringify(mazeSacerdotisaVisual)) // "Laberinto" de la Sacerdotisa (fondo)
            },
            playerPositions: {
                mago: [...initialMagoPos],
                sacerdotisa: [...initialSacerdotisaPos] // Posición simbólica
            },
            runesActivated: {
                mago: [],
                sacerdotisa: []
            },
            activePuzzle: null, // Guarda el objeto del acertijo actualmente en progreso para este juego
            awaitingDecision: false // Bandera para controlar si el mago está en un punto de decisión
        };

        // Colocar las puertas de acertijo (tipo 2) en el laberinto del Mago inicial
        (allPuzzles.initial_maze || []).forEach(puzzle => {
            if (puzzle.type === 'maze_door' && puzzle.targetPlayerRole === 'mago') {
                const [r, c] = puzzle.triggerPos;
                activeGames[gameId].maze.mago[r][c] = 2;
            }
        });

        socket.join(gameId);
        socket.gameId = gameId; // Guarda el gameId en el socket para referencia

        console.log(`Juego creado con ID: ${gameId} por ${socket.id}`);

        // Emitir 'game_ready' al Mago (host) con su información inicial
        socket.emit('game_ready', {
            role: 'mago',
            gameId: gameId,
            isHost: true,
            mazeData: activeGames[gameId].maze.mago, // Envía el laberinto del Mago
            playerPos: activeGames[gameId].playerPositions.mago
        });
    });

    // Un cliente intenta unirse a un juego existente (Sacerdotisa)
    socket.on('join_game', (gameId) => {
        const game = activeGames[gameId];
        if (game && !game.player2) {
            game.player2 = socket.id;
            game.sacerdotisa = socket.id; // Asigna el rol de Sacerdotisa
            socket.join(gameId);
            socket.gameId = gameId;

            console.log(`Usuario ${socket.id} se unió al juego ${gameId}`);

            // Informar a ambos jugadores que el juego está listo
            // Al Mago (host)
            io.to(game.player1).emit('game_ready', {
                role: 'mago',
                gameId: gameId,
                isHost: true,
                mazeData: game.maze.mago,
                playerPos: game.playerPositions.mago
            });
            // A la Sacerdotisa (el que se une)
            io.to(game.player2).emit('game_ready', {
                role: 'sacerdotisa', // Rol de sacerdotisa
                gameId: gameId,
                isHost: false,
                mazeData: game.maze.mago, // Sacerdotisa también ve el laberinto del Mago para ayudar
                playerPos: game.playerPositions.sacerdotisa // Posición simbólica
            });
        } else {
            socket.emit('message', 'Juego no encontrado o ya lleno.');
            console.log(`Intento de unión fallido para ${socket.id} al juego ${gameId}`);
        }
    });

    // --- Manejo del Movimiento del Jugador (Solo Mago) ---
    socket.on('move_player', (direction) => {
        const gameId = socket.gameId;
        const game = activeGames[gameId];
        if (!game) return;

        // Solo el Mago puede mover el jugador en el laberinto
        if (socket.id !== game.mago) {
            console.log(`Movimiento denegado: Solo el Mago (${game.mago}) puede moverse.`);
            io.to(socket.id).emit('message', 'Solo el Mago puede moverse por el laberinto.');
            return;
        }

        // Si el Mago está esperando una decisión, no puede moverse
        if (game.awaitingDecision) {
            io.to(game.mago).emit('message', 'Debes elegir un camino antes de avanzar.');
            return;
        }

        let currentPlayerPos = game.playerPositions.mago;
        let currentMaze = game.maze.mago;

        let newPos = [...currentPlayerPos]; // Copia la posición actual

        // Calcula la nueva posición
        switch (direction) {
            case 'up':    newPos[0]--; break;
            case 'down':  newPos[0]++; break;
            case 'left':  newPos[1]--; break; // Corregido: left afecta la columna
            case 'right': newPos[1]++; break;
        }

        // Validación del movimiento
        const mazeRows = currentMaze.length;
        const mazeCols = currentMaze[0].length;

        if (newPos[0] < 0 || newPos[0] >= mazeRows || newPos[1] < 0 || newPos[1] >= mazeCols) {
            console.log(`Movimiento inválido: fuera de límites para Mago en ${gameId}`);
            io.to(game.mago).emit('message', 'No puedes moverte fuera del laberinto.');
            return;
        }

        const targetCellType = currentMaze[newPos[0]][newPos[1]];

        console.log(`Intentando mover desde [${currentPlayerPos[0]},${currentPlayerPos[1]}] a [${newPos[0]},${newPos[1]}]`);
        console.log(`Tipo de celda destino [${newPos[0]},${newPos[1]}] es: ${targetCellType}`);

        // Si la celda destino es una pared (1), no se mueve
        if (targetCellType === 1) {
            console.log(`Movimiento inválido: es una pared para Mago en ${gameId}`);
            io.to(game.mago).emit('message', '¡Esa es una pared impenetrable!');
            return;
        }

        // Si la celda destino es una puerta de acertijo (2)
        if (targetCellType === 2) {
            console.log(`Mago intentó moverse a una celda de puzzle (2) en [${newPos[0]},${newPos[1]}]`);

            // Si ya hay un acertijo activo, el Mago no puede pasar
            if (game.activePuzzle) {
                console.log(`Ya hay un acertijo activo (${game.activePuzzle.id}), no se activa uno nuevo.`);
                io.to(game.mago).emit('message', 'Esta puerta requiere que la Sacerdotisa y tú resuelvan el acertijo.');
                return; // Mago se detiene, puzzle activo sigue
            }

            // Buscar el acertijo asociado a esta posición
            const puzzleToTrigger = (allPuzzles[game.currentMazeId] || []).find(p =>
                p.type === 'maze_door' && p.targetPlayerRole === 'mago' &&
                p.triggerPos && p.triggerPos[0] === newPos[0] && p.triggerPos[1] === newPos[1]
            );

            if (puzzleToTrigger) {
                game.activePuzzle = puzzleToTrigger; // Establecer el acertijo activo
                console.log('¡Puzzle encontrado y listo para activar! ID:', puzzleToTrigger.id);

                // Envía la información del acertijo al Mago y Sacerdotisa
                io.to(game.mago).emit('load_puzzle', {
                    title: puzzleToTrigger.title,
                    description: puzzleToTrigger.description,
                    guesserInfo: puzzleToTrigger.guesserInfo,
                });
                io.to(game.sacerdotisa).emit('load_puzzle', {
                    title: puzzleToTrigger.title,
                    description: puzzleToTrigger.description,
                    pisterInfo: puzzleToTrigger.pisterInfo,
                });
                // El Mago no se mueve a la celda 2, se queda en la celda anterior.
                return; // ¡IMPORTANTE: Detiene el movimiento si se activa un acertijo!
            } else {
                // Si la celda es '2' pero no se encontró un acertijo asociado
                console.log('Advertencia: Mago intentó moverse a celda 2 en', newPos, 'pero NO se encontró ningún acertijo asociado.');
                io.to(game.mago).emit('message', 'Esta puerta está sellada por un misterio desconocido. No hay acertijo para activarla.');
                return; // También detiene el movimiento si no hay acertijo
            }
        }

        // Si la celda destino es un Punto de Decisión (3)
        if (targetCellType === 3) {
            game.playerPositions.mago = newPos; // El mago sí se mueve a la celda de decisión
            console.log(`Mago en ${gameId} llegó a punto de decisión: ${newPos}`);
            
            game.awaitingDecision = true; // Bandera de estado para esperar decisión

            // Notifica a ambos jugadores que hay una decisión que tomar
            io.to(gameId).emit('decision_point_reached', {
                message: 'Has llegado a una encrucijada mística. ¿Qué camino eliges?',
                options: [
                    { id: 'pathA', name: followUpMazes.pathA.name }, // Usar nombres de followUpMazes
                    { id: 'pathB', name: followUpMazes.pathB.name },
                    { id: 'pathC', name: followUpMazes.pathC.name },
                    { id: 'pathD', name: followUpMazes.pathD.name },

                ]
            });

            // Envía la actualización de la posición (para mostrar que llegó al punto 3)
            io.to(gameId).emit('game_state_update', {
                magoPos: game.playerPositions.mago,
                sacerdotisaPos: game.playerPositions.sacerdotisa,
                mazeMago: game.maze.mago,
                mazeSacerdotisa: game.maze.sacerdotisa
            });
            return; // No procesar más movimiento hasta la decisión
        }

        // Si el movimiento es válido y no es una celda especial bloqueada, actualiza la posición
        game.playerPositions.mago = newPos;
        console.log(`Mago en ${gameId} se movió a: ${newPos}`);

        // Envía la actualización de la posición y el estado del laberinto a AMBOS jugadores
        io.to(gameId).emit('game_state_update', {
            magoPos: game.playerPositions.mago,
            sacerdotisaPos: game.playerPositions.sacerdotisa,
            mazeMago: game.maze.mago,
            mazeSacerdotisa: game.maze.sacerdotisa
        });
    });

    // --- Manejo de Pistas (Solo Sacerdotisa) ---
    socket.on('send_clue', (clue) => {
        const gameId = socket.gameId;
        const game = activeGames[gameId];
        // Solo la SACERDOTISA envía pistas y solo si hay un acertijo activo
        if (game && socket.id === game.sacerdotisa && game.activePuzzle) {
            console.log(`Pista de la Sacerdotisa (${socket.id}) en ${gameId}: "${clue}"`);
            io.to(game.mago).emit('clue_received', clue); // Enviar pista AL MAGO
            io.to(game.sacerdotisa).emit('message', 'Pista enviada al Mago. Esperando su respuesta...');
        } else if (game && socket.id === game.sacerdotisa && !game.activePuzzle) {
             io.to(game.sacerdotisa).emit('message', 'No hay un acertijo activo para enviar pistas.');
        } else if (game && socket.id === game.mago) { // Si el mago intenta enviar pista
            io.to(game.mago).emit('message', 'Solo la Sacerdotisa puede enviar pistas.');
        }
    });

    socket.on('send_answer', (answer) => {
        const gameId = socket.gameId;
        const game = activeGames[gameId];
        // Solo el MAGO puede enviar respuestas y solo si hay un acertijo activo
        if (game && socket.id === game.mago && game.activePuzzle) {
            console.log(`Respuesta del Mago (${socket.id}) en ${gameId}: "${answer}"`);
            
            const currentPuzzle = game.activePuzzle;
            const isCorrect = answer.toLowerCase().trim() === currentPuzzle.correctAnswer.toLowerCase().trim();

            if (isCorrect) {
                // Seleccionar un hechizo de amor aleatorio
                const randomSpell = loveSpells[Math.floor(Math.random() * loveSpells.length)];
                const successMessageWithSpell = `¡Correcto! Mago, has resuelto el acertijo: "${currentPuzzle.title}". Como recompensa, recibe este hechizo de protección: "${randomSpell}"`;
                
                io.to(gameId).emit('answer_result', { 
                    correct: true, 
                    feedback: currentPuzzle.feedbackCorrect, 
                    loveSpellText: successMessageWithSpell // Enviar el mensaje completo del hechizo para el modal
                });
                
                console.log(`Acertijo ${currentPuzzle.id} (${currentPuzzle.title}) resuelto en ${gameId}`);
                
                // Ejecutar la acción definida al resolver el acertijo
                if (currentPuzzle.actionOnSolve && currentPuzzle.actionOnSolve.type === 'open_door') {
                    console.log('Acertijo correcto. Verificando acción de apertura de puerta...');
                    console.log('ActionOnSolve es tipo open_door.');
                    const [doorRow, doorCol] = currentPuzzle.actionOnSolve.doorPos;
                    console.log(`Intentando abrir puerta en [${doorRow},${doorCol}]. Valor actual: ${game.maze.mago[doorRow][doorCol]}`);
                    
                    if (game.maze.mago[doorRow] && game.maze.mago[doorRow][doorCol] === 2) {
                        game.maze.mago[doorRow][doorCol] = 0; // Cambia la puerta (2) a camino (0)
                        console.log(`Puerta en [${doorRow},${doorCol}] ABIERTA para el Mago.`);
                        io.to(game.mago).emit('message', '¡Has resuelto el acertijo! La puerta se ha abierto. Ahora puedes avanzar.');
                    } else {
                         console.log(`Advertencia: La celda [${doorRow},${doorCol}] no era 2 o no existe, no se pudo abrir la puerta.`);
                    }
                }
                
                game.activePuzzle = null; // Resetea el acertijo activo después de resolverlo
                
                // Fuerza una actualización visual del laberinto para ambos jugadores
                io.to(gameId).emit('game_state_update', {
                    magoPos: game.playerPositions.mago,
                    sacerdotisaPos: game.playerPositions.sacerdotisa,
                    mazeMago: game.maze.mago,
                    mazeSacerdotisa: game.maze.sacerdotisa
                });

            } else {
                io.to(gameId).emit('answer_result', { correct: false, feedback: currentPuzzle.feedbackIncorrect });
                io.to(game.mago).emit('message', 'Respuesta incorrecta. Intenta de nuevo.');
            }
        } else if (game && socket.id === game.mago && !game.activePuzzle) {
             io.to(game.mago).emit('message', 'No hay un acertijo activo para responder.');
        } else if (game && socket.id === game.sacerdotisa) {
            io.to(game.sacerdotisa).emit('message', 'Solo el Mago puede enviar respuestas.');
        }
    });

    socket.on('choose_path', (optionId) => {
    const gameId = socket.gameId;
    const game = activeGames[gameId];

    if (!game) {
        console.log(`Error: Juego no encontrado con ID ${gameId}`);
        return;
    }

    if (!followUpMazes[optionId]) {
        console.log(`Error: Opción de camino inválida: ${optionId}`);
        return;
    }

    const selectedPath = followUpMazes[optionId];

    // Actualiza el laberinto y posición del Mago
    game.currentMazeId = optionId; // Cambia el ID del laberinto actual
    game.maze.mago = JSON.parse(JSON.stringify(selectedPath.maze)); // Nuevo laberinto
    game.playerPositions.mago = [...selectedPath.initialPos]; // Nueva posición del mago
    game.awaitingDecision = false; // Ya no está esperando decisión

    // Coloca las nuevas puertas (tipo 2) en el nuevo laberinto
    (allPuzzles[optionId] || []).forEach(puzzle => {
        if (puzzle.type === 'maze_door' && puzzle.targetPlayerRole === 'mago') {
            const [r, c] = puzzle.triggerPos;
            game.maze.mago[r][c] = 2;
        }
    });

    console.log(`El jugador eligió el camino: ${selectedPath.name} en ${gameId}`);

    io.to(gameId).emit('maze_changed', {
        message: `Has elegido el camino: ${selectedPath.name}`,
        mazeMago: game.maze.mago,
        magoPos: game.playerPositions.mago,
        sacerdotisaPos: game.playerPositions.sacerdotisa
    });
});



    // --- Manejo de Desconexiones ---
    socket.on('disconnect', () => {
        console.log('Usuario desconectado:', socket.id);
        for (const gameId in activeGames) {
            const game = activeGames[gameId];
            if (game.player1 === socket.id || game.player2 === socket.id) { // Si era el Mago o la Sacerdotisa
                console.log(`Juego ${gameId} terminado por desconexión de ${socket.id}`);
                // Notificar al otro jugador si está conectado
                if (game.player1 && game.player1 !== socket.id) { // Si el Mago se desconecta
                    io.to(game.player1).emit('game_over', 'Tu pareja (la Sacerdotisa) se ha desconectado. El juego ha terminado.');
                } else if (game.player2 && game.player2 !== socket.id) { // Si la Sacerdotisa se desconecta
                    io.to(game.player2).emit('game_over', 'Tu pareja (el Mago) se ha desconectado. El juego ha terminado.');
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