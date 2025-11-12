const quotes = [
  'When you have eliminated the impossible, whatever remains, however improbable, must be the truth.',
  'There is nothing more deceptive than an obvious fact.',
  'I never make exceptions. An exception disproves the rule.',
  'What one man can invent another can discover.',
  'Education never ends, Watson. It is a series of lessons, with the greatest for the last.',
];

let words = [];
let wordIndex = 0;
let startTime;
let gameStarted = false;
let timerInterval;

// DOM 요소
const quoteElement = document.getElementById('quote');
const messageElement = document.getElementById('message');
const typedValueElement = document.getElementById('typed-value');
const startButton = document.getElementById('start');
const bestScoreElement = document.getElementById('best-score');
const gameControls = document.getElementById('game-controls');
const timerElement = document.getElementById('timer');

const modal = document.getElementById('result-modal');
const modalMessage = document.getElementById('modal-message');
const closeModal = document.getElementById('close-modal');
const restartGameButton = document.getElementById('restart-game');

// 최고 기록 표시
function updateBestScoreDisplay() {
  const best = localStorage.getItem('bestScore');
  bestScoreElement.innerHTML = best
    ? `<i class="fa-solid fa-trophy"></i> 최고 기록: ${best}초`
    : `<i class="fa-solid fa-trophy"></i> 최고 기록: 아직 없음`;
}

// 문장 출력
function displayQuote(quote) {
  const spanWords = quote.split(' ').map(word => `<span>${word} </span>`);
  quoteElement.innerHTML = spanWords.join('');
  quoteElement.childNodes[0].className = 'highlight';
}

// highlight 업데이트
function updateHighlight(index) {
  quoteElement.childNodes.forEach(node => node.classList.remove('highlight'));
  if (quoteElement.childNodes[index]) {
    quoteElement.childNodes[index].classList.add('highlight');
  }
}

// 타이머 시작
function startTimer() {
  timerElement.innerHTML = `<i class="fa-regular fa-clock"></i> 현재 시간: 0.00초`;
  timerElement.classList.remove('hidden');
  startTime = Date.now();

  timerInterval = setInterval(() => {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    timerElement.innerHTML = `<i class="fa-regular fa-clock"></i> 현재 시간: ${elapsed}초`;
  }, 100);
}

// 타이머 정지
function stopTimer() {
  clearInterval(timerInterval);
}

// 게임 시작
function startGame() {
  gameControls.classList.remove('hidden');
  updateBestScoreDisplay();
  gameStarted = false;

  const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
  words = randomQuote.split(' ');
  wordIndex = 0;

  displayQuote(randomQuote);

  messageElement.innerText = '';
  typedValueElement.value = '';
  typedValueElement.className = '';
  typedValueElement.disabled = false;
  typedValueElement.focus();

  stopTimer(); // 이전 타이머 중지
  timerElement.innerText = '⏱ 현재 시간: 0.00초';
  timerElement.classList.add('hidden'); // 시작 전에는 숨김 처리
}

// 게임 완료 처리
function endGame() {
  stopTimer();
  const elapsedTime = (Date.now() - startTime) / 1000;
  const seconds = elapsedTime.toFixed(2);

  modalMessage.innerHTML = `<i class="fa-solid fa-flag-checkered"></i> 🎉 완료! ${seconds}초 걸렸습니다.`;
  modal.classList.remove('hidden');

  const best = localStorage.getItem('bestScore');
  if (!best || parseFloat(seconds) < parseFloat(best)) {
    localStorage.setItem('bestScore', seconds);
  }

  typedValueElement.value = '';
  typedValueElement.disabled = true;
}

// 입력 이벤트 처리
typedValueElement.addEventListener('input', () => {
  if (!gameStarted) {
    gameStarted = true;
    startTimer();
  }

  const currentWord = words[wordIndex];
  const typedValue = typedValueElement.value;

  if (typedValue === currentWord && wordIndex === words.length - 1) {
    endGame();
  } else if (typedValue.endsWith(' ') && typedValue.trim() === currentWord) {
    wordIndex++;
    typedValueElement.value = '';
    updateHighlight(wordIndex);
    typedValueElement.className = '';
  } else if (currentWord.startsWith(typedValue)) {
    typedValueElement.className = '';
  } else {
    typedValueElement.className = 'error';
  }
});

// 버튼 & 모달 이벤트
startButton.addEventListener('click', startGame);
restartGameButton.addEventListener('click', () => {
  modal.classList.add('hidden');
  startGame();
});
closeModal.addEventListener('click', () => modal.classList.add('hidden'));

// 엔터로 다시 시작
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && modal.classList.contains('hidden') && !gameStarted) {
    startGame();
  }
});

// 로딩 시 최고 점수
window.addEventListener('DOMContentLoaded', updateBestScoreDisplay);
