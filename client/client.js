/**
 * Speed Skate Quiz - Client
 * Replace SERVER_URL with your Render.com URL when deploying to Netlify
 */
const SERVER_URL = 'https://jfl388.onrender.com';
const socket = io(SERVER_URL);

// Connection status
const connectionStatus = document.getElementById('connection-status');
socket.on('connect', () => {
  connectionStatus.textContent = 'Connected!';
  connectionStatus.className = 'connection-status connected';
  joinBtn.disabled = false;
});
socket.on('connect_error', () => {
  connectionStatus.textContent = 'Cannot connect to server. Is it running on port 3001?';
  connectionStatus.className = 'connection-status error';
  joinBtn.disabled = true;
});

// ============ State ============
let mySocketId = null;
let myUsername = '';
let currentQuestion = null;
let gameActive = false;
let pendingNextQuestion = null;  // Store next question while showing feedback
let players = [];                // { socketId, username, position }

// ============ DOM Elements ============
const screenJoin = document.getElementById('screen-join');
const screenGame = document.getElementById('screen-game');
const screenPodium = document.getElementById('screen-podium');
const usernameInput = document.getElementById('username-input');
const joinBtn = document.getElementById('join-btn');
const joinError = document.getElementById('join-error');
const startBtn = document.getElementById('start-btn');
const resetBtn = document.getElementById('reset-btn');
const timerEl = document.getElementById('timer');
const trackPlayers = document.getElementById('track-players');
const questionText = document.getElementById('question-text');
const btnTrue = document.getElementById('btn-true');
const btnFalse = document.getElementById('btn-false');
const feedbackArea = document.getElementById('feedback-area');
const feedbackIcon = document.getElementById('feedback-icon');
const feedbackText = document.getElementById('feedback-text');
const playAgainBtn = document.getElementById('play-again-btn');
const gameInProgressModal = document.getElementById('game-in-progress-modal');
const confettiEl = document.getElementById('confetti');

// Mobile warning - show on small screens
function checkMobile() {
  const warning = document.getElementById('mobile-warning');
  if (window.innerWidth < 768) {
    warning.classList.remove('hidden');
  } else {
    warning.classList.add('hidden');
  }
}
checkMobile();
window.addEventListener('resize', checkMobile);

// ============ Helpers ============
function showScreen(screen) {
  [screenJoin, screenGame, screenPodium].forEach(s => s.classList.add('hidden'));
  screen.classList.remove('hidden');
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function showQuestion(q) {
  if (!q) {
    questionText.textContent = 'No more questions.';
    return;
  }
  currentQuestion = q;
  questionText.textContent = q.question;
  feedbackArea.classList.add('hidden');
  btnTrue.disabled = false;
  btnFalse.disabled = false;
}

function renderTrack() {
  trackPlayers.innerHTML = '';
  // Group players by position for stacking
  const byPosition = {};
  players.forEach(p => {
    if (!byPosition[p.position]) byPosition[p.position] = [];
    byPosition[p.position].push(p);
  });
  Object.entries(byPosition).forEach(([pos, pls]) => {
    const positionNum = parseInt(pos, 10);
    const leftPct = (positionNum / 30) * 100;
    pls.forEach((p, idx) => {
      const wrapper = document.createElement('div');
      wrapper.className = 'skater-wrapper' + (p.socketId === mySocketId ? ' is-me' : '');
      wrapper.style.left = `calc(${leftPct}% - 20px)`;
      wrapper.style.bottom = `${20 + idx * 12}px`;
      const label = document.createElement('div');
      label.className = 'skater-label';
      label.textContent = p.username;
      const icon = document.createElement('img');
      icon.className = 'skater-icon';
      icon.src = 'skater.png';
      icon.alt = 'Skater';
      wrapper.appendChild(label);
      wrapper.appendChild(icon);
      trackPlayers.appendChild(wrapper);
    });
  });
}

function showFeedback(correct, correctAnswer, explanation) {
  feedbackArea.classList.remove('hidden');
  feedbackArea.classList.remove('correct', 'incorrect');
  feedbackArea.classList.add(correct ? 'correct' : 'incorrect');
  feedbackIcon.textContent = correct ? '✓' : '✗';
  if (correct) {
    feedbackText.textContent = 'Correct! Moving forward!';
  } else {
    feedbackText.textContent = `Wrong! The correct answer is ${correctAnswer ? 'True' : 'False'}. ${explanation || ''}`.trim();
  }
  btnTrue.disabled = true;
  btnFalse.disabled = true;
}

function updatePreGameUI() {
  startBtn.classList.remove('hidden');
  timerEl.classList.add('hidden');
  questionText.textContent = 'Ready! Click START GAME when everyone has joined.';
  feedbackArea.classList.add('hidden');
  btnTrue.disabled = true;
  btnFalse.disabled = true;
}

function createConfetti() {
  const colors = ['#00d4ff', '#7fffd4', '#0081C8', '#FCB131', '#EE334E'];
  for (let i = 0; i < 30; i++) {
    const p = document.createElement('div');
    p.className = 'confetti-particle';
    p.style.left = Math.random() * 100 + '%';
    p.style.background = colors[Math.floor(Math.random() * colors.length)];
    p.style.animationDelay = Math.random() * 1.5 + 's';
    p.style.animationDuration = (2 + Math.random() * 2) + 's';
    confettiEl.appendChild(p);
    setTimeout(() => p.remove(), 4000);
  }
}

// ============ Socket Events ============
socket.on('joined_successfully', (data) => {
  mySocketId = data.socketId;
  myUsername = usernameInput.value.trim();
  showScreen(screenGame);
  joinError.classList.add('hidden');
  updatePreGameUI();
});

socket.on('join_error', (data) => {
  joinError.textContent = data.message || 'Error joining.';
  joinError.classList.remove('hidden');
});

socket.on('lobby_update', (list) => {
  players = list;
  renderTrack();
});

socket.on('game_started', (data) => {
  gameActive = true;
  startBtn.classList.add('hidden');
  timerEl.classList.remove('hidden');
  questionText.textContent = 'Waiting for question...';
  if (data.firstQuestion) {
    showQuestion(data.firstQuestion);
  }
  renderTrack();
});

socket.on('timer_update', (data) => {
  timerEl.textContent = formatTime(data.timeRemaining);
  if (data.timeRemaining <= 30) {
    timerEl.classList.add('urgent');
  } else {
    timerEl.classList.remove('urgent');
  }
});

socket.on('answer_result', (data) => {
  showFeedback(data.correct, data.correctAnswer, data.explanation || '');
  // Update our position in local state for immediate render
  const me = players.find(p => p.socketId === mySocketId);
  if (me) me.position = data.newPosition;
  renderTrack();
  const delay = data.correct ? 1500 : 2500;
  setTimeout(() => {
    showQuestion(pendingNextQuestion);
    pendingNextQuestion = null;
  }, delay);
});

socket.on('next_question', (q) => {
  pendingNextQuestion = q;
});

socket.on('positions_update', (list) => {
  players = list;
  renderTrack();
});

socket.on('game_ended', (data) => {
  gameActive = false;
  showScreen(screenPodium);
  const podium = data.podium || [];
  const nameIds = ['podium-1st-name', 'podium-2nd-name', 'podium-3rd-name'];
  const stepIds = ['podium-1st-steps', 'podium-2nd-steps', 'podium-3rd-steps'];
  [0, 1, 2].forEach(i => {
    const el = document.getElementById(nameIds[i]);
    const stepsEl = document.getElementById(stepIds[i]);
    if (el && stepsEl) {
      if (podium[i]) {
        el.textContent = podium[i].username;
        stepsEl.textContent = podium[i].position + ' steps';
      } else {
        el.textContent = '—';
        stepsEl.textContent = '0 steps';
      }
    }
  });
  createConfetti();
});

socket.on('game_reset', () => {
  confettiEl.innerHTML = '';
  gameActive = false;
  if (mySocketId) {
    showScreen(screenGame);
    updatePreGameUI();
  } else {
    showScreen(screenJoin);
  }
});

socket.on('game_already_started', () => {
  gameInProgressModal.classList.remove('hidden');
});

document.getElementById('modal-ok-btn')?.addEventListener('click', () => {
  gameInProgressModal.classList.add('hidden');
});

// ============ UI Handlers ============
joinBtn.addEventListener('click', () => {
  const username = usernameInput.value.trim();
  if (!username) return;
  socket.emit('join_lobby', { username });
});

usernameInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') joinBtn.click();
});

startBtn.addEventListener('click', () => {
  socket.emit('request_start_game');
});

resetBtn.addEventListener('click', () => {
  socket.emit('request_reset');
});

btnTrue.addEventListener('click', () => {
  if (!gameActive || btnTrue.disabled) return;
  socket.emit('submit_answer', { answer: true });
});

btnFalse.addEventListener('click', () => {
  if (!gameActive || btnFalse.disabled) return;
  socket.emit('submit_answer', { answer: false });
});

playAgainBtn.addEventListener('click', () => {
  socket.emit('request_play_again');
});
