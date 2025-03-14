import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Główny skrypt gry Kółko i Krzyżyk 3D 10x10
document.addEventListener('DOMContentLoaded', () => {
    // Add loading screen element
    const loadingScreen = document.createElement('div');
    loadingScreen.id = 'loading';
    loadingScreen.style.display = 'none';
    document.body.appendChild(loadingScreen);

    // Konfiguracja gry
    const BOARD_SIZE = 10;
    const CELL_SIZE = 1;
    const CELL_GAP = 0.2;
    const BOARD_WIDTH = BOARD_SIZE * (CELL_SIZE + CELL_GAP) - CELL_GAP;
    const PLAYERS = {
        NONE: null,
        KRZYŻYK: 'krzyżyk',
        KÓŁKO: 'kółko'
    };

    // Zmienne globalne
    let scene, camera, renderer, controls;
    let board = createEmptyBoard();
    let currentPlayer = PLAYERS.KRZYŻYK;
    let gameActive = true;
    let animationsEnabled = true;
    let raycaster = new THREE.Raycaster();
    let mouse = new THREE.Vector2();
    let cellMeshes = [];
    let playerMarkers = [];
    let aiUnavailable = false; // Flaga wskazująca, czy AI jest niedostępne
    let computerMoveInProgress = false; // Flaga blokująca interakcję podczas ruchu komputera

    // Funkcja do ukrywania ekranu ładowania
    function hideLoadingScreen() {
        const loadingElement = document.getElementById('loading');
        if (loadingElement) {
            loadingElement.classList.add('hidden');
            console.log('Ukryto ekran ładowania');
        } else {
            console.error('Nie znaleziono elementu loading!');
        }
    }

    // Inicjalizacja gry
    try {
        init();
        animate();
    } catch (error) {
        console.error('Błąd podczas inicjalizacji gry:', error);
        hideLoadingScreen(); // Ukryj ekran ładowania nawet w przypadku błędu
        document.getElementById('ai-message').textContent = "Wystąpił błąd podczas ładowania gry. Odśwież stronę, aby spróbować ponownie.";
    }

    // Funkcja inicjalizująca scenę 3D
    function init() {
        // Ustawienie sceny
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x1a1a2a);

        // Kamera
        camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
        camera.position.set(0, 15, 20);
        camera.lookAt(0, 0, 0);

        // Renderer
        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        document.getElementById('canvas-container').appendChild(renderer.domElement);

        // Kontroler kamery
        controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.rotateSpeed = 0.5;

        // Światła
        setupLights();

        // Tworzenie planszy
        createBoard();

        // Obsługa zdarzeń
        setupEventListeners();

        // Ukrycie ekranu ładowania
        hideLoadingScreen();

        // Aktualizacja UI
        updateUI();
    }

    // Funkcja tworząca pustą planszę
    function createEmptyBoard() {
        const board = [];
        for (let i = 0; i < BOARD_SIZE; i++) {
            board[i] = [];
            for (let j = 0; j < BOARD_SIZE; j++) {
                board[i][j] = PLAYERS.NONE;
            }
        }
        return board;
    }

    // Konfiguracja świateł
    function setupLights() {
        // Światło ambientowe
        const ambientLight = new THREE.AmbientLight(0x404060, 0.8);
        scene.add(ambientLight);

        // Główne światło kierunkowe
        const mainLight = new THREE.DirectionalLight(0xffffff, 1.2);
        mainLight.position.set(10, 20, 10);
        mainLight.castShadow = true;
        mainLight.shadow.mapSize.width = 2048;
        mainLight.shadow.mapSize.height = 2048;
        mainLight.shadow.camera.near = 0.5;
        mainLight.shadow.camera.far = 50;
        mainLight.shadow.bias = -0.0001;
        scene.add(mainLight);

        // Światło punktowe
        const pointLight1 = new THREE.PointLight(0x00ffff, 0.6, 30);
        pointLight1.position.set(0, 15, 0);
        scene.add(pointLight1);

        // Dodatkowe światło punktowe dla lepszego oświetlenia
        const pointLight2 = new THREE.PointLight(0xffffff, 0.4, 20);
        pointLight2.position.set(-10, 10, -10);
        scene.add(pointLight2);
    }

    // Tworzenie planszy
    function createBoard() {
        // Podłoże planszy
        const boardGeometry = new THREE.BoxGeometry(BOARD_WIDTH, 0.5, BOARD_WIDTH);
        const boardMaterial = new THREE.MeshPhongMaterial({ 
            color: 0x333333,
            shininess: 30
        });
        const boardMesh = new THREE.Mesh(boardGeometry, boardMaterial);
        boardMesh.receiveShadow = true;
        boardMesh.position.y = -0.25;
        scene.add(boardMesh);

        // Tworzenie komórek planszy
        for (let i = 0; i < BOARD_SIZE; i++) {
            for (let j = 0; j < BOARD_SIZE; j++) {
                const x = (i - BOARD_SIZE / 2) * (CELL_SIZE + CELL_GAP) + CELL_SIZE / 2;
                const z = (j - BOARD_SIZE / 2) * (CELL_SIZE + CELL_GAP) + CELL_SIZE / 2;
                
                // Tworzenie komórki
                const cell = createCell(i, j, x, 0, z);
                scene.add(cell);
                cellMeshes.push(cell);
            }
        }
    }

    // Tworzenie pojedynczej komórki planszy
    function createCell(row, col, x, y, z) {
        const geometry = new THREE.BoxGeometry(CELL_SIZE, 0.1, CELL_SIZE);
        const material = new THREE.MeshPhongMaterial({ 
            color: 0x555566,
            transparent: true,
            opacity: 0.8,
            shininess: 50
        });
        
        const cell = new THREE.Mesh(geometry, material);
        cell.position.set(x, y, z);
        cell.userData = { row, col, type: 'cell' };
        cell.receiveShadow = true;
        
        return cell;
    }

    // Obsługa zdarzeń
    function setupEventListeners() {
        // Obsługa kliknięć na planszy
        window.addEventListener('click', onCellClick);
        window.addEventListener('resize', onWindowResize);
        
        // Obsługa przycisków UI
        document.getElementById('reset-button').addEventListener('click', resetGame);
    }

    // Obsługa kliknięcia na komórkę
    function onCellClick(event) {
        // Blokuj kliknięcia, gdy gra nie jest aktywna, trwa ruch komputera lub jest kolej gracza KÓŁKO
        if (!gameActive || computerMoveInProgress || currentPlayer === PLAYERS.KÓŁKO) return;
        
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(cellMeshes);
        
        if (intersects.length > 0) {
            const cell = intersects[0].object;
            const { row, col } = cell.userData;
            
            if (board[row][col] === PLAYERS.NONE) {
                makeMove(row, col);
            }
        }
    }

    // Obsługa zmiany rozmiaru okna
    function onWindowResize() {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }

    // Wykonanie ruchu
    function makeMove(row, col) {
        // Aktualizacja stanu planszy
        board[row][col] = currentPlayer;
        
        // Dodanie modelu gracza
        const cell = getCellMesh(row, col);
        if (cell) {
            const position = cell.position.clone();
            
            if (currentPlayer === PLAYERS.KRZYŻYK) {
                createXModel(position);
            } else {
                createOModel(position);
            }
        }
        
        // Sprawdzenie stanu gry
        const gameState = checkGameState();
        
        if (gameState === 'win') {
            gameActive = false;
            highlightWinningCells();
            document.getElementById('current-player').textContent = currentPlayer;
            
            // Pobierz komentarz AI jeśli jest dostępne
            if (!aiUnavailable) {
                if (currentPlayer === PLAYERS.KRZYŻYK) {
                    const messages = [
                        `Kurwa! Przegrałem z takim noobem! Gracz KRZYŻYK (ten debil) właśnie wygrał. ${getBoardStateForAI()}`,
                        `Ja pierdolę, jak mogłem przegrać z kimś tak beznadziejnym! ${getBoardStateForAI()}`,
                        `Chuj ci w dupę KRZYŻYK, miałeś szczęście! Następnym razem cię rozjebię! ${getBoardStateForAI()}`
                    ];
                    getAICommentary(messages[Math.floor(Math.random() * messages.length)]);
                } else {
                    const messages = [
                        `HAHA! Wygrałem! Ssij pałę KRZYŻYK! ${getBoardStateForAI()}`,
                        `Co jest kurwa?! Nie umiesz grać KRZYŻYK? Wracaj do piaskownicy! ${getBoardStateForAI()}`,
                        `EZ! Get rekt nobie! Nawet moja babcia gra lepiej! ${getBoardStateForAI()}`
                    ];
                    getAICommentary(messages[Math.floor(Math.random() * messages.length)]);
                }
            } else {
                const messages = [
                    `${currentPlayer} wygrywa! Co za zajebista gra!`,
                    `${currentPlayer} rozpierdolił przeciwnika!`,
                    `${currentPlayer} pokazał kto tu rządzi!`
                ];
                document.getElementById('ai-message').textContent = messages[Math.floor(Math.random() * messages.length)];
            }
        } else if (gameState === 'draw') {
            gameActive = false;
            document.getElementById('current-player').textContent = "Remis";
            
            // Pobierz komentarz AI jeśli jest dostępne
            if (!aiUnavailable) {
                const messages = [
                    `Kurwa, remis! Obaj jesteście do dupy! ${getBoardStateForAI()}`,
                    `No ja pierdolę, co za chujowa gra! Nikt nie wygrał! ${getBoardStateForAI()}`,
                    `Gratulacje, obaj ssiesz równie mocno! ${getBoardStateForAI()}`
                ];
                getAICommentary(messages[Math.floor(Math.random() * messages.length)]);
            } else {
                document.getElementById('ai-message').textContent = "Remis! Obaj jesteście równie beznadziejni!";
            }
        } else {
            // Zmiana gracza
            togglePlayer();
            
            // Pobierz komentarz AI jeśli jest dostępne
            if (!aiUnavailable) {
                // Jeśli jest kolej komputera (KÓŁKO), AI wykona ruch
                if (currentPlayer === PLAYERS.KÓŁKO) {
                    document.getElementById('ai-message').textContent = "Czekaj kurwa, myślę...";
                    
                    // Przygotuj prompt dla AI
                    let aiPrompt = "";
                    if (currentPlayer === PLAYERS.KÓŁKO) {
                        // Kolej AI (KÓŁKO)
                        const messages = [
                            `Ten debil KRZYŻYK wykonał ruch na [${row},${col}]. Teraz pokażę mu jak się gra! ${getBoardStateForAI()}`,
                            `Co za chujowy ruch na [${row},${col}]! Zaraz go zajebię! ${getBoardStateForAI()}`,
                            `HAHA! Co za noob! Postawił na [${row},${col}]! Teraz go wyrucha! ${getBoardStateForAI()}`
                        ];
                        aiPrompt = messages[Math.floor(Math.random() * messages.length)];
                    }
                    
                    getAICommentary(aiPrompt);
                }
            } else {
                // Ruch komputera gdy AI jest niedostępne i jest kolej KÓŁKO
                if (currentPlayer === PLAYERS.KÓŁKO) {
                    simpleComputerMove();
                }
            }
            
            // Aktualizacja UI
            updateUI();
        }
        
        // Aktualizacja UI
        updateUI();
    }

    // Pobranie obiektu komórki na podstawie współrzędnych
    function getCellMesh(row, col) {
        return cellMeshes.find(cell => 
            cell.userData.row === row && cell.userData.col === col
        );
    }

    // Tworzenie modelu KRZYŻYK
    function createXModel(position) {
        const group = new THREE.Group();
        group.position.copy(position);
        group.position.y = 0.3;
        
        // Tworzenie dwóch przecinających się belek
        const geometry = new THREE.BoxGeometry(CELL_SIZE * 0.8, 0.2, 0.2);
        const material = new THREE.MeshPhongMaterial({ color: 0xff0000 });
        
        const bar1 = new THREE.Mesh(geometry, material);
        bar1.castShadow = true;
        bar1.rotation.y = Math.PI / 4;
        group.add(bar1);
        
        const bar2 = new THREE.Mesh(geometry, material);
        bar2.castShadow = true;
        bar2.rotation.y = -Math.PI / 4;
        group.add(bar2);
        
        // Animacja wejścia
        if (animationsEnabled) {
            group.scale.set(0, 0, 0);
            gsap.to(group.scale, {
                x: 1, y: 1, z: 1,
                duration: 0.5,
                ease: "elastic.out(1, 0.3)"
            });
            
            gsap.from(group.position, {
                y: 5,
                duration: 0.5,
                ease: "bounce.out"
            });
        }
        
        group.userData = { 
            type: 'marker', 
            player: PLAYERS.KRZYŻYK,
            position: { row: position.userData?.row, col: position.userData?.col }
        };
        
        scene.add(group);
        playerMarkers.push(group);
        
        return group;
    }

    // Tworzenie modelu KÓŁKO
    function createOModel(position) {
        const geometry = new THREE.TorusGeometry(CELL_SIZE * 0.3, 0.1, 16, 32);
        const material = new THREE.MeshPhongMaterial({ color: 0x0000ff });
        
        const torus = new THREE.Mesh(geometry, material);
        torus.position.copy(position);
        torus.position.y = 0.3;
        torus.rotation.x = Math.PI / 2;
        torus.castShadow = true;
        
        // Animacja wejścia
        if (animationsEnabled) {
            torus.scale.set(0, 0, 0);
            gsap.to(torus.scale, {
                x: 1, y: 1, z: 1,
                duration: 0.5,
                ease: "elastic.out(1, 0.3)"
            });
            
            gsap.from(torus.position, {
                y: 5,
                duration: 0.5,
                ease: "bounce.out"
            });
        }
        
        torus.userData = { 
            type: 'marker', 
            player: PLAYERS.KÓŁKO,
            position: { row: position.userData?.row, col: position.userData?.col }
        };
        
        scene.add(torus);
        playerMarkers.push(torus);
        
        return torus;
    }

    // Sprawdzenie stanu gry
    function checkGameState() {
        const winner = checkWinner();
        if (winner) {
            return 'win';
        } else if (checkDraw()) {
            return 'draw';
        }
        return 'continue';
    }

    // Sprawdzenie wygranej
    function checkWinner() {
        const WIN_LENGTH = 5; // Liczba znaków w rzędzie potrzebna do wygranej
        
        // Sprawdzenie poziomo
        for (let row = 0; row < BOARD_SIZE; row++) {
            for (let col = 0; col <= BOARD_SIZE - WIN_LENGTH; col++) {
                if (board[row][col] !== PLAYERS.NONE) {
                    let win = true;
                    for (let i = 1; i < WIN_LENGTH; i++) {
                        if (board[row][col + i] !== board[row][col]) {
                            win = false;
                            break;
                        }
                    }
                    if (win) return true;
                }
            }
        }
        
        // Sprawdzenie pionowo
        for (let col = 0; col < BOARD_SIZE; col++) {
            for (let row = 0; row <= BOARD_SIZE - WIN_LENGTH; row++) {
                if (board[row][col] !== PLAYERS.NONE) {
                    let win = true;
                    for (let i = 1; i < WIN_LENGTH; i++) {
                        if (board[row + i][col] !== board[row][col]) {
                            win = false;
                            break;
                        }
                    }
                    if (win) return true;
                }
            }
        }
        
        // Sprawdzenie ukośnie (/)
        for (let row = 0; row <= BOARD_SIZE - WIN_LENGTH; row++) {
            for (let col = 0; col <= BOARD_SIZE - WIN_LENGTH; col++) {
                if (board[row][col] !== PLAYERS.NONE) {
                    let win = true;
                    for (let i = 1; i < WIN_LENGTH; i++) {
                        if (board[row + i][col + i] !== board[row][col]) {
                            win = false;
                            break;
                        }
                    }
                    if (win) return true;
                }
            }
        }
        
        // Sprawdzenie ukośnie (\)
        for (let row = 0; row <= BOARD_SIZE - WIN_LENGTH; row++) {
            for (let col = WIN_LENGTH - 1; col < BOARD_SIZE; col++) {
                if (board[row][col] !== PLAYERS.NONE) {
                    let win = true;
                    for (let i = 1; i < WIN_LENGTH; i++) {
                        if (board[row + i][col - i] !== board[row][col]) {
                            win = false;
                            break;
                        }
                    }
                    if (win) return true;
                }
            }
        }
        
        return false;
    }

    // Podświetlenie wygrywających komórek
    function highlightWinningCells() {
        // Efekt zwycięstwa - uproszczona wersja
        if (animationsEnabled) {
            // Efekt błysku
            const flash = document.createElement('div');
            flash.style.position = 'fixed';
            flash.style.top = 0;
            flash.style.left = 0;
            flash.style.width = '100%';
            flash.style.height = '100%';
            flash.style.backgroundColor = currentPlayer === PLAYERS.KRZYŻYK ? 'rgba(255,0,0,0.3)' : 'rgba(0,0,255,0.3)';
            flash.style.pointerEvents = 'none';
            flash.style.zIndex = 1000;
            flash.style.opacity = 0;
            document.body.appendChild(flash);
            
            gsap.to(flash, {
                opacity: 1,
                duration: 0.2,
                repeat: 3,
                yoyo: true,
                onComplete: () => {
                    document.body.removeChild(flash);
                }
            });
        }
    }

    // Sprawdzenie remisu
    function checkDraw() {
        for (let row = 0; row < BOARD_SIZE; row++) {
            for (let col = 0; col < BOARD_SIZE; col++) {
                if (board[row][col] === PLAYERS.NONE) {
                    return false;
                }
            }
        }
        return true;
    }

    // Zmiana gracza
    function togglePlayer() {
        currentPlayer = currentPlayer === PLAYERS.KRZYŻYK ? PLAYERS.KÓŁKO : PLAYERS.KRZYŻYK;
    }

    // Aktualizacja UI
    function updateUI() {
        document.getElementById('current-player').textContent = currentPlayer;
    }

    // Resetowanie gry
    function resetGame() {
        // Usunięcie wszystkich markerów graczy
        playerMarkers.forEach(marker => {
            scene.remove(marker);
        });
        playerMarkers = [];
        
        // Resetowanie stanu gry
        board = createEmptyBoard();
        currentPlayer = PLAYERS.KRZYŻYK;
        gameActive = true;
        computerMoveInProgress = false;
        
        // Aktualizacja UI
        updateUI();
        document.getElementById('ai-message').textContent = "Nowa gra rozpoczęta!";
        
        // Sprawdź dostępność AI i pobierz komentarz
        try {
            if (!aiUnavailable) {
                getAICommentary("Nowa gra się rozpoczyna. Plansza jest pusta. Gracz KRZYŻYK wykonuje pierwszy ruch.");
            }
        } catch (error) {
            console.error("Błąd podczas pobierania komentarza AI:", error);
        }
    }

    // Przełączanie animacji
    function toggleAnimations() {
        animationsEnabled = !animationsEnabled;
        const button = document.getElementById('toggle-animations-button');
        button.textContent = animationsEnabled ? 'Wstrzymaj Animacje' : 'Włącz Animacje';
    }

    // Przełączanie kamery
    function toggleCamera() {
        const positions = [
            { x: 0, y: 15, z: 20 },
            { x: 20, y: 5, z: 0 },
            { x: 0, y: 20, z: 0 }
        ];
        
        const currentPosition = positions.shift();
        positions.push(currentPosition);
        
        gsap.to(camera.position, {
            x: positions[0].x,
            y: positions[0].y,
            z: positions[0].z,
            duration: 1.5,
            ease: "power2.inOut",
            onUpdate: function() {
                camera.lookAt(0, 0, 0);
            }
        });
    }

    // Konwersja stanu planszy do formatu dla AI
    function getBoardStateForAI() {
        let state = "Stan planszy (KRZYŻYK - przeciwnik, KÓŁKO - Ty (kółko), . - puste pole):\n";
        
        // Dodanie nagłówka kolumn
        state += "  ";
        for (let col = 0; col < BOARD_SIZE; col++) {
            state += col + " ";
        }
        state += "\n";
        
        for (let row = 0; row < BOARD_SIZE; row++) {
            // Dodanie numeru wiersza
            state += row + " ";
            
            for (let col = 0; col < BOARD_SIZE; col++) {
                state += board[row][col] || "." + " ";
            }
            state += "\n";
        }
        
        // Dodanie informacji o dostępnych ruchach
        state += "\nDostępne ruchy (wiersz,kolumna):\n";
        let availableMoves = [];
        
        for (let row = 0; row < BOARD_SIZE; row++) {
            for (let col = 0; col < BOARD_SIZE; col++) {
                if (board[row][col] === PLAYERS.NONE) {
                    availableMoves.push(`${row},${col}`);
                }
            }
        }
        
        state += availableMoves.join(" | ");
        
        // Dodanie instrukcji dla AI
        state += "\n\nPodaj swój ruch w formacie RUCH:[wiersz],[kolumna], np. RUCH:1,2";
        state += "\nPamiętaj, że mówisz jako kółko (KÓŁKO) i obrażasz swojego przeciwnika (KRZYŻYK). Twój komentarz ma być zabawny, wulgarny i obraźliwy wobec gracza KRZYŻYK.";
        
        return state;
    }

    // Pobranie komentarza od AI
    function getAICommentary(prompt) {
        fetch('/get-ai-commentary', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ prompt }),
        })
        .then(response => {
            // Sprawdź, czy odpowiedź jest poprawna
            if (!response.ok) {
                throw new Error(`Błąd serwera: ${response.status} ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.commentary && !data.commentary.startsWith("Błąd:")) {
                document.getElementById('ai-message').textContent = data.commentary;
                aiUnavailable = false;
                
                // Sprawdź, czy AI podało ruch
                if (data.ai_move && currentPlayer === PLAYERS.KÓŁKO && gameActive) {
                    console.log("AI podało ruch:", data.ai_move);
                    
                    // Dodaj małe opóźnienie, aby użytkownik mógł przeczytać komentarz
                    setTimeout(() => {
                        // Sprawdź, czy ruch jest prawidłowy
                        const { row, col } = data.ai_move;
                        if (row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE && board[row][col] === PLAYERS.NONE) {
                            makeMove(row, col);
                        } else {
                            console.error("AI podało nieprawidłowy ruch:", data.ai_move);
                            // Jeśli ruch jest nieprawidłowy, użyj prostego algorytmu
                            simpleComputerMove();
                        }
                    }, 1500);
                }
            } else {
                // Obsługa błędu z serwera lub AI
                console.error('Błąd AI:', data.error || data.commentary);
                document.getElementById('ai-message').textContent = "Szef poszedł spać, ale ja mogę z tobą zagrać!";
                aiUnavailable = true;
                
                // Jeśli jest kolej komputera, wykonaj ruch
                if (currentPlayer === PLAYERS.KÓŁKO && gameActive) {
                    simpleComputerMove();
                }
            }
        })
        .catch(error => {
            console.error('Błąd podczas komunikacji z serwerem:', error);
            document.getElementById('ai-message').textContent = "Szef poszedł spać, ale ja mogę z tobą zagrać!";
            aiUnavailable = true;
            
            // Jeśli jest kolej komputera, wykonaj ruch
            if (currentPlayer === PLAYERS.KÓŁKO && gameActive) {
                simpleComputerMove();
            }
        });
    }
    
    // Prosty algorytm gry dla komputera
    function simpleComputerMove() {
        if (!gameActive || currentPlayer !== PLAYERS.KÓŁKO) return;
        
        computerMoveInProgress = true;
        
        // Opóźnienie ruchu komputera dla lepszego efektu
        setTimeout(() => {
            try {
                // Sprawdź, czy możliwe jest wygranie w jednym ruchu
                const winningMove = findWinningMove(PLAYERS.KÓŁKO);
                if (winningMove) {
                    makeMove(winningMove.row, winningMove.col);
                    return;
                }
                
                // Sprawdź, czy trzeba zablokować wygraną przeciwnika
                const blockingMove = findWinningMove(PLAYERS.KRZYŻYK);
                if (blockingMove) {
                    makeMove(blockingMove.row, blockingMove.col);
                    return;
                }
                
                // Jeśli środek jest wolny, wybierz go
                if (board[Math.floor(BOARD_SIZE/2)][Math.floor(BOARD_SIZE/2)] === PLAYERS.NONE) {
                    makeMove(Math.floor(BOARD_SIZE/2), Math.floor(BOARD_SIZE/2));
                    return;
                }
                
                // W przeciwnym razie wybierz losowe wolne pole
                const availableMoves = [];
                for (let i = 0; i < BOARD_SIZE; i++) {
                    for (let j = 0; j < BOARD_SIZE; j++) {
                        if (board[i][j] === PLAYERS.NONE) {
                            availableMoves.push({row: i, col: j});
                        }
                    }
                }
                
                if (availableMoves.length > 0) {
                    const randomMove = availableMoves[Math.floor(Math.random() * availableMoves.length)];
                    makeMove(randomMove.row, randomMove.col);
                }
            } catch (error) {
                console.error("Błąd podczas wykonywania ruchu komputera:", error);
            } finally {
                // Zawsze resetuj flagę, niezależnie od wyniku
                computerMoveInProgress = false;
            }
        }, 1000);
    }
    
    // Funkcja znajdująca ruch wygrywający dla danego gracza
    function findWinningMove(player) {
        // Sprawdzanie wierszy i kolumn
        for (let i = 0; i < BOARD_SIZE; i++) {
            for (let j = 0; j < BOARD_SIZE; j++) {
                if (board[i][j] === PLAYERS.NONE) {
                    // Tymczasowo ustaw pole
                    board[i][j] = player;
                    // Sprawdź, czy to ruch wygrywający
                    const isWinning = checkWinner() === player;
                    // Cofnij zmianę
                    board[i][j] = PLAYERS.NONE;
                    
                    if (isWinning) {
                        return {row: i, col: j};
                    }
                }
            }
        }
        
        return null;
    }

    // Funkcja animacji
    function animate() {
        requestAnimationFrame(animate);
        
        // Aktualizacja kontrolek kamery
        if (controls) {
            controls.update();
        }
        
        // Renderowanie sceny
        renderer.render(scene, camera);
    }
});
