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

// ============ QUESTION POOL (21 CLI multiple-choice questions) ============
const QUESTION_POOL = [
  { id: 1, question: 'Abby speaks French as L1. She is planning to learn an L2. Out of Italian, Japanese, and Turkish, which language does CLI predict to be "easiest" to learn as an L2?', options: ['Italian', 'Japanese', 'Turkish'], answer: 'italian' },
  { id: 2, question: 'True or false: Transfer is one type of cross-linguistic influence.', options: ['True', 'False'], answer: 'true' },
  { id: 3, question: 'True or false: In general, CLI and language transfer is bidirectional, while interlanguage is unidirectional.', options: ['True', 'False'], answer: 'false' },
  { id: 4, question: 'When Korean word order helps a learner understand Japanese sentence structure, this indicates:', options: ['Positive transfer', 'Negative transfer', 'Fossilization'], answer: 'positive transfer' },
  { id: 5, question: "Paul's L1 is German. While learning an L2 at school, he unconsciously creates a kind of language that no one but him understands because he produces utterances that are ungrammatical in both languages. What is this \"new\" language called?", options: ['Pidgin', 'Lingua Franca', 'Interlanguage'], answer: 'interlanguage' },
  { id: 6, question: 'True or false: Two similar languages may only lead to positive CLI and transfer.', options: ['True', 'False'], answer: 'false' },
  { id: 7, question: 'True or false: CLI refers to how your knowledge of one language can affect another language you know.', options: ['True', 'False'], answer: 'true' },
  { id: 8, question: 'Rudy is L1 in English and he is currently learning Indonesian. When he encountered the Indonesian word "pensiun" he immediately recognized it as related to the English word "pension" and deduced that both words have a similar meaning, which turned out to be true. Is this positive or negative CLI at work?', options: ['Positive', 'Negative'], answer: 'positive' },
  { id: 9, question: 'Even though "librería" in Spanish sounds very similar to "library" in English, the two words have very different meanings. This is an example of false cognates and can be categorized into ____ CLI.', options: ['Positive', 'Negative'], answer: 'negative' },
  { id: 10, question: 'Which of the following is NOT a subtype of CLI mentioned in the presentation?', options: ['Syntactic', 'Neutral', 'Lexical'], answer: 'neutral' },
  { id: 11, question: 'Lexical CLI helps learning new lexical items as ___ as possible.', options: ['Slow', 'Empty', 'Fast'], answer: 'fast' },
  { id: 12, question: 'Mandarin Chinese L1 speakers learning English as their L2 frequently substitute /ð/ (th) with similarly-sounding /z/ when speaking English since the former phoneme is not present in Mandarin Chinese. What subtype of CLI occurred in this scenario?', options: ['Phonological', 'Syntactic', 'Lexical'], answer: 'phonological' },
  { id: 13, question: "True or false: A person's grammatical usages in L2 cannot be influenced by the grammatical system of their L1.", options: ['True', 'False'], answer: 'false' },
  { id: 14, question: 'True or false: Fossilization is a potential effect of negative CLI.', options: ['True', 'False'], answer: 'true' },
  { id: 15, question: 'A French speaker says "I have hunger" instead of "I am hungry" in English. This is an example of:', options: ['Positive CLI', 'Negative CLI'], answer: 'negative cli' },
  { id: 16, question: 'Cross-linguistic influence only occurs when learning a second language for the first time.', options: ['True', 'False'], answer: 'false' },
  { id: 17, question: 'A Spanish L1 speaker learning English pronounces the word "very" as "bery" because /v/ doesn\'t exist in Spanish. This is an example of ___ CLI.', options: ['Syntactic', 'Lexical', 'Phonological'], answer: 'phonological' },
  { id: 18, question: 'A Persian speaker learning English says "the car of my friend" instead of "my friend\'s car." This is an example of:', options: ['Lexical CLI', 'Syntactic CLI', 'Phonological CLI'], answer: 'syntactic cli' },
  { id: 19, question: 'Negative CLI can lead to a learner developing a permanent error pattern known as fossilization.', options: ['True', 'False'], answer: 'true' },
  { id: 20, question: 'A Chinese L1 speaker learning English uses Subject-Verb-Object word order correctly. This is an example of:', options: ['Negative transfer', 'Positive transfer', 'Interlanguage'], answer: 'positive transfer' },
  { id: 21, question: "Maria's L1 is English. She is learning Mandarin and produces sentences that are grammatically incorrect in both English and Mandarin. Her developing language system is called:", options: ['Pidgin', 'Interlanguage', 'Lingua Franca'], answer: 'interlanguage' }
];

// ============ GAME STATE ============
let players = {};           // { socketId: { username, position, questionIndex } }
let gameState = 'lobby';    // 'lobby' | 'playing' | 'ended'
let timerInterval = null;
let timeRemaining = 180;    // 3:30 = 210 seconds
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
    timeRemaining = 180;
    // Reset all players
    for (const id of Object.keys(players)) {
      players[id].position = 0;
      players[id].questionIndex = 0;
    }
    io.emit('game_started', {
      firstQuestion: shuffledQuestions.length > 0
        ? { id: shuffledQuestions[0].id, question: shuffledQuestions[0].question, options: shuffledQuestions[0].options }
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
    const userAnswer = (data?.answer || '').trim().toLowerCase();
    const correct = userAnswer === q.answer;
    if (correct) {
      player.position = Math.min(30, player.position + 1);
      socket.emit('answer_result', {
        correct: true,
        newPosition: player.position
      });
      if (player.position >= 30) {
        endGame();
        return;
      }
    } else {
      player.position = Math.max(0, player.position - 1);
      socket.emit('answer_result', {
        correct: false,
        correctAnswer: q.options[q.options.map(o => o.toLowerCase()).indexOf(q.answer)],
        newPosition: player.position
      });
    }
    player.questionIndex = (player.questionIndex + 1) % shuffledQuestions.length;
    io.emit('positions_update', getPositionsArray());
    const nextIdx = player.questionIndex;
    const nextQ = shuffledQuestions[nextIdx];
    socket.emit('next_question', nextQ ? { id: nextQ.id, question: nextQ.question, options: nextQ.options } : null);
  });

  socket.on('request_play_again', () => {
    if (gameState !== 'ended') return;
    gameState = 'lobby';
    timeRemaining = 180;
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
    gameState = 'lobby';
    timeRemaining = 180;
    for (const id of Object.keys(players)) {
      players[id].position = 0;
      players[id].questionIndex = 0;
    }
    io.emit('game_reset');
    io.emit('lobby_update', getLobbyArray());
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
        timeRemaining = 180;
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
