/**
 * Speed Skate Quiz - Multiplayer Game Server
 * Node.js + Express + Socket.io
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors({ origin: '*' }));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3001;

// ============ QUESTION POOL (20 Korea True/False) ============
const QUESTION_POOL = [
  { id: 1, question: 'South Korea is the most densely populated country in the world.', answer: false, explanation: 'It is one of the densest but not the most.' },
  { id: 2, question: 'Hangul, the Korean alphabet, was invented in the 15th century.', answer: true, explanation: '' },
  { id: 3, question: 'Seoul is the capital city of South Korea.', answer: true, explanation: '' },
  { id: 4, question: 'Korea was divided into North and South in 1945.', answer: true, explanation: '' },
  { id: 5, question: 'Kimchi is a traditional Korean dish made of fermented vegetables.', answer: true, explanation: '' },
  { id: 6, question: 'The Korean War officially ended with a peace treaty in 1953.', answer: false, explanation: 'It ended with an armistice, not a peace treaty.' },
  { id: 7, question: 'South Korea hosted the Summer Olympics in 1988.', answer: true, explanation: '' },
  { id: 8, question: 'The South Korean currency is called the Won.', answer: true, explanation: '' },
  { id: 9, question: 'South Korea is larger in land area than North Korea.', answer: false, explanation: 'North Korea is slightly larger.' },
  { id: 10, question: 'Taekwondo is a martial art that originated in Korea.', answer: true, explanation: '' },
  { id: 11, question: 'South Korea has the fastest average internet speed in the world.', answer: true, explanation: '' },
  { id: 12, question: 'The Han River runs through the city of Busan.', answer: false, explanation: 'The Han River runs through Seoul.' },
  { id: 13, question: 'South Korea is a peninsula bordered by China to the west.', answer: false, explanation: 'It borders the Yellow Sea to the west; China is across that sea.' },
  { id: 14, question: 'BTS is a South Korean pop group.', answer: true, explanation: '' },
  { id: 15, question: 'South Korea became a democracy in the 1940s.', answer: false, explanation: 'South Korea transitioned to full democracy in the late 1980s.' },
  { id: 16, question: 'Jeju Island is the largest island in South Korea.', answer: true, explanation: '' },
  { id: 17, question: 'The Korean writing system, Hangul, has 24 basic letters.', answer: true, explanation: '' },
  { id: 18, question: 'The 2018 Winter Olympics were held in PyeongChang, South Korea.', answer: true, explanation: '' },
  { id: 19, question: 'South Korea and North Korea still share a joint economic zone called Kaesong.', answer: false, explanation: 'The Kaesong Industrial Complex has been suspended since 2016.' },
  { id: 20, question: 'Bibimbap is a Korean dish that translates to "mixed rice."', answer: true, explanation: '' }
];

// ============ GAME STATE ============
let players = {};           // { socketId: { username, position, questionIndex } }
let gameState = 'lobby';    // 'lobby' | 'playing' | 'ended'
let timerInterval = null;
let timeRemaining = 210;    // 3:30 = 210 seconds
let shuffledQuestions = []; // shuffled copy of QUESTION_POOL

// Fisher-Yates shuffle
function shuffleArray(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Get lobby array for broadcast
function getLobbyArray() {
  return Object.entries(players).map(([socketId, p]) => ({
    socketId,
    username: p.username,
    position: p.position
  }));
}

// Get positions array for broadcast
function getPositionsArray() {
  return Object.entries(players).map(([socketId, p]) => ({
    socketId,
    username: p.username,
    position: p.position
  }));
}

// End game and emit results
function endGame() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  gameState = 'ended';
  const sorted = Object.entries(players)
    .map(([socketId, p]) => ({ socketId, username: p.username, position: p.position }))
    .sort((a, b) => b.position - a.position);
  const podium = sorted.slice(0, 3).map((p, i) => ({
    rank: i + 1,
    username: p.username,
    position: p.position
  }));
  io.emit('game_ended', {
    podium,
    allPlayers: sorted
  });
}

// ============ SOCKET.IO ============
io.on('connection', (socket) => {
  console.log('New connection:', socket.id);

  // If game already in progress, tell new joiner (don't return - they can't join lobby anyway)
  if (gameState === 'playing') {
    socket.emit('game_already_started');
  }

  socket.on('join_lobby', (data) => {
    if (gameState !== 'lobby') {
      socket.emit('join_error', { message: 'A game is in progress. Please wait for it to end.' });
      return;
    }
    const username = (data?.username || '').trim();
    if (!username) {
      socket.emit('join_error', { message: 'Username cannot be empty.' });
      return;
    }
    const existingUsernames = Object.values(players).map(p => p.username.toLowerCase());
    if (existingUsernames.includes(username.toLowerCase())) {
      socket.emit('join_error', { message: 'That username is already taken.' });
      return;
    }
    players[socket.id] = {
      username,
      position: 0,
      questionIndex: 0
    };
    socket.emit('joined_successfully', { socketId: socket.id });
    io.emit('lobby_update', getLobbyArray());
  });

  socket.on('request_start_game', () => {
    if (gameState !== 'lobby') return;
    gameState = 'playing';
    shuffledQuestions = shuffleArray(QUESTION_POOL);
    timeRemaining = 210;
    // Reset all players
    for (const id of Object.keys(players)) {
      players[id].position = 0;
      players[id].questionIndex = 0;
    }
    io.emit('game_started', {
      firstQuestion: shuffledQuestions.length > 0
        ? { id: shuffledQuestions[0].id, question: shuffledQuestions[0].question }
        : null
    });
    io.emit('positions_update', getPositionsArray());
    // Start countdown
    timerInterval = setInterval(() => {
      timeRemaining--;
      io.emit('timer_update', { timeRemaining });
      if (timeRemaining <= 0) {
        endGame();
      }
    }, 1000);
  });

  socket.on('submit_answer', (data) => {
    if (gameState !== 'playing') return;
    const player = players[socket.id];
    if (!player) return;
    const idx = player.questionIndex;
    const q = shuffledQuestions[idx];
    if (!q) return;
    const userAnswer = data?.answer;
    const correct = userAnswer === q.answer;
    if (correct) {
      player.position = Math.min(30, player.position + 1);
      socket.emit('answer_result', {
        correct: true,
        newPosition: player.position
      });
    } else {
      player.position = Math.max(0, player.position - 1);
      socket.emit('answer_result', {
        correct: false,
        correctAnswer: q.answer,
        explanation: q.explanation,
        newPosition: player.position
      });
    }
    player.questionIndex = (player.questionIndex + 1) % 20;
    io.emit('positions_update', getPositionsArray());
    const nextIdx = player.questionIndex;
    const nextQ = shuffledQuestions[nextIdx];
    socket.emit('next_question', nextQ ? { id: nextQ.id, question: nextQ.question } : null);
  });

  socket.on('request_play_again', () => {
    if (gameState !== 'ended') return;
    gameState = 'lobby';
    timeRemaining = 210;
    for (const id of Object.keys(players)) {
      players[id].position = 0;
      players[id].questionIndex = 0;
    }
    io.emit('game_reset');
    io.emit('lobby_update', getLobbyArray());
  });

  socket.on('request_reset', () => {
    if (gameState === 'playing') {
      if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
      }
    }
    if (gameState !== 'lobby') {
      gameState = 'lobby';
      timeRemaining = 210;
      for (const id of Object.keys(players)) {
        players[id].position = 0;
        players[id].questionIndex = 0;
      }
      io.emit('game_reset');
      io.emit('lobby_update', getLobbyArray());
    }
  });

  socket.on('disconnect', () => {
    delete players[socket.id];
    if (gameState === 'lobby') {
      io.emit('lobby_update', getLobbyArray());
    } else if (gameState === 'playing') {
      io.emit('positions_update', getPositionsArray());
      if (Object.keys(players).length === 0) {
        if (timerInterval) {
          clearInterval(timerInterval);
          timerInterval = null;
        }
        gameState = 'lobby';
        timeRemaining = 210;
      }
    } else if (gameState === 'ended') {
      io.emit('lobby_update', getLobbyArray());
    }
    console.log('Disconnected:', socket.id);
  });
});

// ============ START SERVER ============
server.listen(PORT, () => {
  console.log(`Speed Skate Quiz server running on port ${PORT}`);
});
