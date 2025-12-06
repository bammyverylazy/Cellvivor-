import { EventBus } from '../EventBus';
import { Scene } from 'phaser';
import io from 'socket.io-client';
import { saveGameProgress } from '../utils/saveProgress.js';
const socket = io(import.meta.env.VITE_BACKEND_URL);
const backendURL = 'https://cellvivor-backend.onrender.com';

function generateRoomCode() {
    return Math.random().toString(36).substr(2, 5).toUpperCase();
}

export class Mode extends Scene {
    constructor() {
        super('Mode');
    }

    preload() {
        this.load.image('magnifying', '/assets/magnifying.png');
        this.load.image('storymode', '/assets/storymode.png');
        this.load.image('multimode', '/assets/multimode.png');
        this.load.image('NewgameButton', '/assets/NewgameButton.png');
        this.load.image('ContinueButton', '/assets/ContinueButton.png');
        this.load.image('5.png', '/assets/5.png');
        this.load.image('6.png', '/assets/6.png');
        this.load.image('7.png', '/assets/7.png');
        this.load.image('8.png', '/assets/8.png');
        this.load.image('9.png', '/assets/9.png');
        this.load.image('star', '/assets/star.png');
    }

    create() {
            const user = JSON.parse(localStorage.getItem('currentUser')) || JSON.parse(localStorage.getItem('user'));
            const playerName = user?.name || "Anonymous";

        this.cameras.main.setBackgroundColor('#fa821a');
        const headerY = this.cameras.main.height * 0.22;
        const headerText = this.add.text(this.cameras.main.width / 2, headerY, 'MODE', {
            fontSize: '68px',
            color: '#fff',
            fontStyle: 'bold',
            align: 'center'
        }).setOrigin(0.5).setDepth(100);

        const starOffsetX = 126;
        this.add.image(headerText.x - starOffsetX, headerY, 'star').setOrigin(0.5).setScale(0.13).setDepth(101);
        this.add.image(headerText.x + starOffsetX, headerY, 'star').setOrigin(0.5).setScale(0.13).setDepth(101);

        const buttonY = this.cameras.main.height * 0.55;
        
        // --- Story Mode Popup ---
        const storyboardBtn = this.add.image(this.cameras.main.width * 0.265, buttonY, 'storymode')
        .setOrigin(0.5).setScale(0.145).setInteractive({ useHandCursor: true }).setDepth(50);


    storyboardBtn.on('pointerdown', () => {
    if (this.popupContainer) return;
    
    this.popupContainer = this.add.rectangle(512, 360, 1024, 800, 0x000000, 0.5).setOrigin(0.5).setDepth(299);
    const popupBox = this.add.rectangle(512, 320, 500, 250, 0xffffff, 1).setOrigin(0.5).setDepth(300);
    const popupText = this.add.text(512, 270, 'Continue the story or start again?', {
      fontSize: '28px', color: '#222', wordWrap: { width: 440 }, align: 'center'
    }).setOrigin(0.5).setDepth(301);

    const newGameBtn = this.add.image(400, 390, 'NewgameButton')
      .setOrigin(0.5).setScale(0.1).setDepth(335).setInteractive({ useHandCursor: true });

    const continueBtn = this.add.image(624, 390, 'ContinueButton')
      .setOrigin(0.5).setScale(0.1).setDepth(335).setInteractive({ useHandCursor: true });

    const closeBtn = this.add.text(750, 208, '✕', {
      fontSize: '32px', color: '#888', fontStyle: 'bold',
      backgroundColor: '#fff', padding: { left: 8, right: 8, top: 2, bottom: 2 },
      borderRadius: 16, align: 'center'
    }).setOrigin(0.5).setDepth(302).setInteractive({ useHandCursor: true });

        newGameBtn.on('pointerdown', async () => {
            if (!user?._id) return;
            try {
                await saveGameProgress(user._id, 'Chapter1');
            } catch (err) {
                console.warn('Failed to save progress before starting new game:', err);
            }
            this.scene.start('Chapter1');
        });
continueBtn.on('pointerdown', async () => {
  try {
    const storedUser = localStorage.getItem('currentUser') || localStorage.getItem('user');
    if (!storedUser) throw new Error('No user data in localStorage');

    const user = JSON.parse(storedUser);
    const userId = user?._id;
    if (!userId) throw new Error('User ID missing');

    const sceneMap = {
      Chapter1: 'Chapter1',
      Chapter2: 'Chapter2',
      Chapter3: 'Chapter3',
      Chapter4: 'Chapter4',
      Chapter1game: 'Chapter1game',
      Chapter2game: 'Chapter2game',
      Chapter3game: 'Chapter3game',
      Chapter4game: 'Chapter4game'
    };

    const response = await fetch(`${backendURL}/progress/load/${userId}`);
    if (!response.ok) throw new Error(`Failed to load progress: ${response.statusText}`);

    const data = await response.json();
    const lastScene = data.lastScene || 'Chapter1';

    const sceneToStart = sceneMap[lastScene] || 'Chapter1';
    console.log('Continuing to:', sceneToStart);
    this.scene.start(sceneToStart);

  } catch (err) {
    console.error('Error loading progress:', err);
    this.scene.start('Chapter1'); // Fallback
  }
});


    closeBtn.on('pointerdown', () => {
      [popupBox, popupText, newGameBtn, continueBtn, closeBtn, this.popupContainer].forEach(e => e?.destroy());
      this.popupContainer = null;
    });
  });

        // --- Multiplayer Popup ---
        const gameModeBtn = this.add.image(this.cameras.main.width * 0.715, buttonY, 'multimode')
            .setOrigin(0.5).setScale(0.145).setInteractive({ useHandCursor: true }).setDepth(50);

        gameModeBtn.on('pointerdown', () => {
            if (this.popupContainer) return;

            this.popupContainer = this.add.rectangle(512, 360, 1024, 800, 0x000000, 0.7).setOrigin(0.5).setDepth(299);
            const popupBox = this.add.rectangle(512, 380, 600, 540, 0xffffff, 1).setOrigin(0.5).setDepth(300);
            const title = this.add.text(512, 208, "Multiplayer Mode", {
                fontSize: '45px', color: '#fa821a', fontStyle: 'bold', align: 'center'
            }).setOrigin(0.5).setDepth(301);
            let infoMsg = this.add.text(512, 260, "", {
                fontSize: '22px', color: '#333', align: 'center', wordWrap: { width: 540 }
            }).setOrigin(0.5).setDepth(303);

            const btnY = 300;
            const btnSpacing = 58;
            const btnStyle = {
                fontSize: '28px', color: '#fff', backgroundColor: '#fa821a',
                padding: { left: 32, right: 32, top: 12, bottom: 12 }, borderRadius: 12
            };

            const createRoomBtn = this.add.text(512, btnY, "   Create Room   ", btnStyle).setOrigin(0.5).setDepth(302).setInteractive();
            const joinRoomBtn = this.add.text(512, btnY + btnSpacing, "    Join Room    ", btnStyle).setOrigin(0.5).setDepth(302).setInteractive();
           
            let roleMsg, guesserBtn, hinterBtn, startBtn;

            const showRoleSelection = () => {
                this.myRole = null;
                this.roles = { guesser: [], hinter: [] };

                if (!roleMsg) {
                    roleMsg = this.add.text(512, btnY + btnSpacing * 3 - 10, "Choose your role:", {
                        fontSize: '24px', color: '#fa821a', align: 'center'
                    }).setOrigin(0.5).setDepth(304);

                    guesserBtn = this.add.text(422, btnY + btnSpacing * 4 - 25, "Guesser", btnStyle).setOrigin(0.5).setDepth(305).setInteractive();
                    hinterBtn = this.add.text(602, btnY + btnSpacing * 4 - 25, "Hinter", btnStyle).setOrigin(0.5).setDepth(305).setInteractive();

                    guesserBtn.on('pointerdown', () => {
                        if (this.myRole) return;
                        this.myRole = 'guesser';
                        socket.emit('setRole', 'guesser');
                        infoMsg.setText(`${playerName} — Role: Guesser — Room: ${this.currentRoom}`);
                    });

                    hinterBtn.on('pointerdown', () => {
                        if (this.myRole) return;
                        this.myRole = 'hinter';
                        socket.emit('setRole', 'hinter');
                        infoMsg.setText(`${playerName} — Role: Hinter — Room: ${this.currentRoom}`);
                    });

                    startBtn = this.add.text(512, btnY + btnSpacing * 5 - 2, "Start Game", {
                        fontSize: '28px', color: '#fff', backgroundColor: '#2ecc40',
                        padding: { left: 32, right: 32, top: 12, bottom: 12 }, borderRadius: 12
                    }).setOrigin(0.5).setDepth(306).setAlpha(0.5).setInteractive();
                    startBtn.disableInteractive();

                    startBtn.on('pointerdown', () => {
                        if (this.roles.guesser.length && this.roles.hinter.length && this.isHost) {
                            socket.emit('start-game', {
                                roomCode: this.currentRoom,
                                role: this.myRole
                            });
                        } else {
                            infoMsg.setText("Both roles must be filled and only host can start.");
                        }
                    });
                } else {
                    roleMsg.setVisible(true);
                    guesserBtn.setVisible(true);
                    hinterBtn.setVisible(true);
                    startBtn.setVisible(true);
                }
                updateStartBtn();
            };

            const updateStartBtn = () => {
                if (this.roles.guesser.length && this.roles.hinter.length && this.isHost) {
                    startBtn.setAlpha(1);
                    startBtn.setInteractive({ useHandCursor: true });
                } else {
                    startBtn.setAlpha(0.5);
                    startBtn.disableInteractive();
                }
            };

            createRoomBtn.on('pointerdown', () => {
                this.isHost = true;
                const roomCode = generateRoomCode();
                this.currentRoom = roomCode;
                socket.emit('createRoom', roomCode);
                infoMsg.setText(`${playerName} — Role: None — Room: ${roomCode} (Host)`);
                showRoleSelection();
            });

            joinRoomBtn.on('pointerdown', () => {
                this.isHost = false;
                const roomCode = window.prompt("Enter room code to join:");
                if (!roomCode) return;
                this.currentRoom = roomCode;
                socket.emit('joinRoom', roomCode);
                infoMsg.setText(`${playerName} — Role: None — Room: ${roomCode}`);
                showRoleSelection();
            });;

            socket.on('roleUpdate', ({ guesser, hinter }) => {
                this.roles = { guesser, hinter };
                updateStartBtn();
            });

            socket.on('player-left', ({ name, role, userId }) => {
                if (this.roles[role]) {
                    this.roles[role] = this.roles[role].filter(id => id !== userId);
                }
                const msg = this.add.text(512, 500, `⚠ Player ${name} left as ${role}`, {
                    fontSize: '20px', color: '#ff4d4d', align: 'center'
                }).setOrigin(0.5).setDepth(310);
                this.time.delayedCall(3000, () => msg.destroy());
                updateStartBtn();
            });

            socket.on('game-started', ({ startTime }) => {
                this.popupContainer?.destroy();
                this.scene.start('Game', {
                    roomCode: this.currentRoom,
                    role: this.myRole,
                    startTime
                });
            });
        });

        const arrow = this.add.text(60, 90, '<', {
            fontSize: '48px', color: '#ffffffff', align: 'Left'
        }).setOrigin(0.5).setDepth(200).setInteractive();

        arrow.on('pointerdown', () => {
            this.scene.stop();    
            this.children.removeAll(); 
            this.scene.start('MainMenu');
        });
    }
}
