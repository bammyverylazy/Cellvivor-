// Multiplayer-enabled Game.js
import { EventBus } from '../EventBus';
import { Scene } from 'phaser';
import io from 'socket.io-client';
const socket = io(import.meta.env.VITE_BACKEND_URL);
const backendURL = import.meta.env.VITE_BACKEND_URL;

export class Game extends Scene {
  constructor() {
    super('Game');
  }

  init(data) {
    this.roomCode = data.roomCode || 'simple-local';
    this.myRole = data.role || 'guesser';
    this.startTime = data.startTime || Date.now();
    this.score = 0;
    this.playedKeywords = [];
  }

  preload() {
    this.load.image('hint', '/assets/hint.png');
  }

  create() {
    this.cameras.main.setBackgroundColor('#FFD700');

    this.scoreText = this.add.text(512, 160, 'Score: 0', {
      fontSize: '32px',
      color: '#ffffff'
    }).setOrigin(0.5).setDepth(200);

    this.updateScoreText = () => {
      if (this.scoreText) {
        this.scoreText.setText('Score: ' + this.score);
      }
    };

    if (this.roomCode !== 'simple-local') {
      fetch(`${backendURL}api/gameplay-score?roomCode=${this.roomCode}`)
        .then(res => res.json())
        .then(data => {
          this.score = data.score || 0;
          this.updateScoreText();
        });
    }

    const graphics = this.add.graphics();
    graphics.fillStyle(0xFF8317);
    graphics.lineStyle(19, 0xFFFFFF);
    const cardWidth = 867;
    const cardHeight = 520;
    const cardX = this.cameras.main.centerX - cardWidth / 2;
    const cardY = this.cameras.main.centerY - cardHeight / 2;
    graphics.fillRoundedRect(cardX, cardY, cardWidth, cardHeight, 40);
    graphics.strokeRoundedRect(cardX, cardY, cardWidth, cardHeight, 40);
    graphics.setDepth(0);

    const arrow = this.add.text(60, 77, '<', {
      fontSize: '48px',
      color: '#ffffffff'
    }).setOrigin(0.5).setDepth(200).setInteractive({ useHandCursor: true });

    arrow.on('pointerdown', () => {
      const confirmQuit = window.confirm('Do you want to quit the game?');
      if (confirmQuit) {
        socket.emit('player-quit', { roomCode: this.roomCode });
        this.scene.start('Mode');
      }
    });

    let currentKeyword = '';
    let currentHint = '';
    let hintUsed = false;
    let result = '';

    const keywordText = this.add.text(512, 300, 'Waiting...', {
      fontSize: '48px',
      color: '#FFFFFF',
      fontStyle: 'bold',
      align: 'center'
    }).setOrigin(0.5).setDepth(1);

    const fetchNewKeyword = () => {
      fetch(`${backendURL}/api/random-keyword`)
        .then(res => res.json())
        .then(data => {
          if (!data || !data.keyword) {
            console.warn('No keyword returned');
            return;
          }
          currentKeyword = data.keyword;
          currentHint = data.hint || '';
          if (this.roomCode !== 'simple-local') {
            socket.emit('keyword', { roomCode: this.roomCode, keyword: currentKeyword, hint: currentHint });
          }
          showKeyword(currentKeyword);
        });
    };

    if (this.myRole === 'guesser') {
      fetchNewKeyword();
    }

    socket.on('keyword', ({ keyword, hint }) => {
      currentKeyword = keyword;
      currentHint = hint;
      showKeyword(currentKeyword);
    });

    const showKeyword = (word) => {
      keywordText.setText(word);
      result = '';
      hintUsed = false;
    };

    const showHintPopup = (hint) => {
      alert('💡 Hint: ' + hint);
    };

    socket.on('show-hint', ({ hint }) => {
      if (!hintUsed) {
        hintUsed = true;
        showHintPopup(hint);
      }
    });

    const hintIcon = this.add.image(900, 200, 'hint')
      .setOrigin(0.5)
      .setScale(0.13)
      .setDepth(151)
      .setInteractive({ useHandCursor: true });

    hintIcon.on('pointerdown', () => {
      if (this.myRole !== 'guesser') return;
      if (!hintUsed && currentHint) {
        hintUsed = true;
        socket.emit('hint-used', { roomCode: this.roomCode, hint: currentHint });
        showHintPopup(currentHint);
      }
    });

    if (this.myRole !== 'guesser') {
      hintIcon.setVisible(false);
    }

    const timerText = this.add.text(512, 200, '', {
      fontSize: '40px',
      color: '#ffffff'
    }).setOrigin(0.5).setDepth(150);

    this.time.addEvent({
      delay: 1000,
      callback: () => {
        const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
        const remaining = Math.max(0, 300 - elapsed);
        timerText.setText(this.formatTime(remaining));
        if (remaining <= 0) {
          this.scene.start('GameOver', {
            score: this.score,
            results: this.playedKeywords
          });
        }
      },
      callbackScope: this,
      loop: true
    });

    const handleResult = async (value) => {
      result = value;
      this.playedKeywords.push({ word: currentKeyword, result });

      if (this.roomCode === 'simple-local') {
        if (result === 'TT') this.score += 2;
        else if (result === 'FT') this.score += 1;
        this.updateScoreText();
      } else {
        if (result === 'TT') this.score += 2;
        else if (result === 'FT') this.score += 1;
        this.updateScoreText();

        socket.emit('score-update', {
          roomCode: this.roomCode,
          result,
          keyword: currentKeyword
        });

        try {
          await fetch('/api/gameplay-mistake', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ roomCode: this.roomCode, keyword: currentKeyword, result })
          });
        } catch (err) {
          console.error('Error saving to DB:', err);
        }
      }

      fetchNewKeyword();
    };

    socket.on('score-update', ({ score }) => {
      this.score = score;
      this.updateScoreText();
    });

    const skipButton = this.add.text(412, 400, 'Skip', {
      fontSize: '32px',
      color: '#fff',
      backgroundColor: '#6067FE',
      padding: { left: 20, right: 20, top: 10, bottom: 10 }
    }).setOrigin(0.5).setDepth(102).setInteractive({ useHandCursor: true });

    const correctButton = this.add.text(612, 400, 'Correct', {
      fontSize: '32px',
      color: '#fff',
      backgroundColor: '#6067FE',
      padding: { left: 20, right: 20, top: 10, bottom: 10 }
    }).setOrigin(0.5).setDepth(102).setInteractive({ useHandCursor: true });

    skipButton.on('pointerdown', () => {
      if (this.myRole !== 'guesser') return;
      handleResult(hintUsed ? 'FF' : 'FF');
    });

    correctButton.on('pointerdown', () => {
      if (this.myRole !== 'guesser') return;
      handleResult(hintUsed ? 'FT' : 'TT');
    });

    if (this.myRole !== 'guesser') {
      skipButton.setVisible(false);
      correctButton.setVisible(false);
    }

    EventBus.emit('current-scene-ready', this);
  }

  formatTime(secs) {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }
}
