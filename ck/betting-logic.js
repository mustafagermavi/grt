/**
 * betting-logic.js
 * Bets, Balance, Cash-out, and Button States
 * Handles all betting logic and UI button state management
 * Implements 1xbet Aviator mechanics
 */

class BettingLogic {
    constructor(gameState, telegramUser, provablyFair, gameEngine) {
        this.gameState = gameState;
        this.telegramUser = telegramUser;
        this.provablyFair = provablyFair;
        this.gameEngine = gameEngine;
        
        // Dual betting system
        this.bets = {
            1: { amount: 0, active: false, cashedOut: false, lost: false, autoCashout: 2.00 },
            2: { amount: 0, active: false, cashedOut: false, lost: false, autoCashout: 2.00 }
        };
        
        // Game round history
        this.history = [];
        
        // Betting phase countdown (5-8 seconds)
        this.bettingDuration = 6000; // 6 seconds default
        this.countdownInterval = null;
        
        // Last multiplier display for UI optimization
        this.lastMultiplierDisplay = '1.00';
    }
    
    init() {
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        // Quick stake buttons [1, 5, 10, 50]
        document.querySelectorAll('.stake-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.triggerHaptic('light');
                const panel = parseInt(e.target.dataset.panel);
                const amount = parseInt(e.target.dataset.amount);
                const input = document.getElementById(`bet-amount-${panel}`);
                
                // Can only adjust bet amount during BETTING_PHASE or if placing queued bet
                if (input && (this.gameState.phase === 'BETTING_PHASE' || 
                    (this.gameState.phase === 'FLYING_PHASE' && !this.bets[panel].active))) {
                    input.value = amount;
                }
            });
        });
        
        // Main action buttons (Place Bet / Cash Out)
        [1, 2].forEach(panel => {
            const btn = document.getElementById(`bet-btn-${panel}`);
            if (btn) {
                btn.addEventListener('click', () => {
                    this.triggerHaptic('medium');
                    this.handleBetAction(panel);
                });
            }
            
            // Auto cash-out input
            const autoInput = document.getElementById(`auto-cashout-${panel}`);
            if (autoInput) {
                autoInput.addEventListener('change', (e) => {
                    this.bets[panel].autoCashout = parseFloat(e.target.value) || 2.00;
                });
            }
        });
        
        // Provably Fair Shield
        const shield = document.getElementById('provably-shield');
        if (shield) {
            shield.addEventListener('click', () => {
                this.triggerHaptic('light');
                this.showHashModal();
            });
        }
        
        // Close hash modal
        const closeHash = document.getElementById('close-hash');
        if (closeHash) {
            closeHash.addEventListener('click', () => {
                this.triggerHaptic('light');
                document.getElementById('hash-modal').classList.add('hidden');
            });
        }
    }
    
    triggerHaptic(type) {
        const isTelegram = window.Telegram?.WebApp?.HapticFeedback != null;
        
        switch(type) {
            case 'light':
                if (navigator.vibrate) navigator.vibrate(10);
                if (isTelegram) window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
                break;
            case 'medium':
                if (navigator.vibrate) navigator.vibrate(20);
                if (isTelegram) window.Telegram.WebApp.HapticFeedback.impactOccurred('medium');
                break;
            case 'heavy':
                if (navigator.vibrate) navigator.vibrate([30, 10, 30]);
                if (isTelegram) window.Telegram.WebApp.HapticFeedback.impactOccurred('heavy');
                break;
            case 'win':
                if (navigator.vibrate) navigator.vibrate([20, 10, 40]);
                if (isTelegram) window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
                break;
            case 'crash':
                if (navigator.vibrate) navigator.vibrate([50, 30, 50, 30, 100]);
                if (isTelegram) window.Telegram.WebApp.HapticFeedback.impactOccurred('heavy');
                break;
        }
    }
    
    getAvailableBalance() {
        return this.telegramUser.getBalance();
    }
    
    handleBetAction(panel) {
        // BETTING_PHASE: Place a bet for current round
        if (this.gameState.phase === 'BETTING_PHASE') {
            this.placeBet(panel);
        }
        // FLYING_PHASE: Cash out if active, otherwise queue for next round
        else if (this.gameState.phase === 'FLYING_PHASE') {
            if (this.bets[panel].active && !this.bets[panel].cashedOut) {
                this.cashOut(panel);
            } else {
                // Queue bet for next round (1xbet Aviator feature)
                this.queueBet(panel);
            }
        }
        // CRASH_PHASE: Queue bet for next round
        else if (this.gameState.phase === 'CRASH_PHASE') {
            this.queueBet(panel);
        }
    }
    
    placeBet(panel) {
        const input = document.getElementById(`bet-amount-${panel}`);
        const autoInput = document.getElementById(`auto-cashout-${panel}`);
        if (!input) return;
        
        const amount = parseFloat(input.value);
        const availableBalance = this.getAvailableBalance();
        
        if (amount < 1 || amount > availableBalance) {
            this.showToast('Invalid bet amount!', 'error');
            this.triggerHaptic('crash');
            return;
        }
        
        // Deduct from balance
        this.telegramUser.subtractFromBalance(amount);
        
        this.bets[panel].amount = amount;
        this.bets[panel].active = true;
        this.bets[panel].cashedOut = false;
        this.bets[panel].lost = false;
        this.bets[panel].autoCashout = parseFloat(autoInput?.value) || 2.00;
        
        this.updateUI();
        this.showToast(`Bet ${panel}: ${amount} 🪙 placed!`, 'success');
    }
    
    queueBet(panel) {
        const input = document.getElementById(`bet-amount-${panel}`);
        const autoInput = document.getElementById(`auto-cashout-${panel}`);
        if (!input) return;
        
        const amount = parseFloat(input.value);
        const availableBalance = this.getAvailableBalance();
        
        if (amount < 1 || amount > availableBalance) {
            this.showToast('Invalid bet amount!', 'error');
            return;
        }
        
        // Store bet for next round
        this.gameState.queuedBets[panel] = {
            amount: amount,
            autoCashout: parseFloat(autoInput?.value) || 2.00
        };
        
        this.updateUI();
        this.showToast(`Bet ${panel}: ${amount} 🪙 queued for next round!`, 'success');
    }
    
    processQueuedBets() {
        [1, 2].forEach(panel => {
            if (this.gameState.queuedBets[panel]) {
                const queued = this.gameState.queuedBets[panel];
                
                // Check if user still has enough balance
                if (queued.amount <= this.telegramUser.getBalance()) {
                    this.telegramUser.subtractFromBalance(queued.amount);
                    
                    this.bets[panel].amount = queued.amount;
                    this.bets[panel].active = true;
                    this.bets[panel].cashedOut = false;
                    this.bets[panel].lost = false;
                    this.bets[panel].autoCashout = queued.autoCashout;
                    
                    this.showToast(`Queued Bet ${panel}: ${queued.amount} 🪙 placed!`, 'success');
                } else {
                    this.showToast(`Insufficient balance for queued bet ${panel}`, 'error');
                }
                
                // Clear the queued bet
                this.gameState.queuedBets[panel] = null;
            }
        });
        
        this.updateUI();
    }
    
    // Start betting phase (5-8 seconds countdown, crash point calculated here)
    async startBettingPhase() {
        // Reset for new round
        this.gameState.phase = 'BETTING_PHASE';
        this.gameState.multiplier = 1.00;
        this.gameState.flightStartTime = 0;
        
        // Process any queued bets from previous round
        this.processQueuedBets();
        
        // PRE-CALCULATE crash point at start of betting phase
        // This ensures fairness - crash point is locked before flight begins
        this.gameState.targetCrashMultiplier = await this.provablyFair.calculateCrashPoint();
        
        console.log("BETTING_PHASE started. Crash point locked at:", this.gameState.targetCrashMultiplier.toFixed(2) + "x");
        
        // Random betting duration between 5-8 seconds
        this.bettingDuration = 5000 + Math.random() * 3000;
        
        // Update UI to show betting phase
        this.updateUI();
        
        // Show countdown
        const timerEl = document.getElementById('waiting-timer');
        const timerValueEl = document.getElementById('timer-value');
        const multiplierStatus = document.getElementById('multiplier-status');
        
        if (timerEl) timerEl.classList.remove('hidden');
        if (multiplierStatus) multiplierStatus.textContent = 'PLACE YOUR BETS';
        
        let remaining = Math.ceil(this.bettingDuration / 1000);
        
        this.countdownInterval = setInterval(() => {
            remaining--;
            
            if (timerValueEl) {
                timerValueEl.textContent = remaining;
            }
            
            // Haptic tick for last 3 seconds
            if (remaining <= 3) {
                this.triggerHaptic('light');
            }
            
            if (remaining <= 0) {
                clearInterval(this.countdownInterval);
                if (timerEl) timerEl.classList.add('hidden');
                this.startFlyingPhase();
            }
        }, 1000);
    }
    
    startFlyingPhase() {
        // Transition to flying phase
        this.gameState.phase = 'FLYING_PHASE';
        this.gameState.flightStartTime = performance.now();
        
        // Reset game engine for flight
        this.gameEngine.resetForNewRound();
        
        // Update UI
        document.getElementById('multiplier-value').classList.add('flying');
        document.getElementById('crash-overlay').classList.add('hidden');
        document.getElementById('multiplier-status').textContent = 'FLYING';
        
        console.log("FLYING_PHASE started! Target crash at:", this.gameState.targetCrashMultiplier.toFixed(2) + "x");
        
        this.updateUI();
    }
    
    cashOut(panel) {
        if (this.gameState.phase !== 'FLYING_PHASE' || !this.bets[panel].active || this.bets[panel].cashedOut) {
            return;
        }
        
        const winAmount = this.bets[panel].amount * this.gameState.multiplier;
        this.telegramUser.addToBalance(winAmount);
        this.bets[panel].cashedOut = true;
        
        // Trigger haptic feedback on successful cash out
        this.triggerHaptic('win');
        this.gameEngine.createParticles(this.gameEngine.plane.x, this.gameEngine.plane.y, '#00cc66');
        
        const profit = (winAmount - this.bets[panel].amount).toFixed(2);
        this.showToast(`Cashed out @ ${this.gameState.multiplier.toFixed(2)}x! +${profit} 🪙`, 'success');
        
        this.updateUI();
    }
    
    crash() {
        this.gameState.phase = 'CRASH_PHASE';
        
        // Trigger heavy haptic on crash
        this.triggerHaptic('crash');
        
        // Handle lost bets - show visual feedback
        [1, 2].forEach(panel => {
            if (this.bets[panel].active && !this.bets[panel].cashedOut) {
                this.bets[panel].active = false;
                this.bets[panel].lost = true;
                
                // Flash red on the button
                const btn = document.getElementById(`bet-btn-${panel}`);
                if (btn) {
                    btn.classList.add('lost');
                }
            }
        });
        
        this.addToHistory(this.gameState.multiplier);
        
        const crashOverlay = document.getElementById('crash-overlay');
        const crashMultiplier = document.getElementById('crash-multiplier');
        
        if (crashOverlay) crashOverlay.classList.remove('hidden');
        if (crashMultiplier) crashMultiplier.textContent = `@ ${this.gameState.multiplier.toFixed(2)}x`;
        
        this.gameEngine.createParticles(this.gameEngine.plane.x, this.gameEngine.plane.y, '#ff3333');
        document.getElementById('multiplier-status').textContent = 'CRASHED';
        
        setTimeout(() => {
            this.resetGame();
        }, 3000);
    }
    
    resetGame() {
        // Clear lost/cashed states
        [1, 2].forEach(panel => {
            this.bets[panel] = {
                amount: 0,
                active: false,
                cashedOut: false,
                lost: false,
                autoCashout: this.bets[panel].autoCashout
            };
            
            const btn = document.getElementById(`bet-btn-${panel}`);
            if (btn) {
                btn.classList.remove('cashout', 'lost', 'waiting', 'cashed', 'queued');
                btn.classList.add('place');
                btn.disabled = false;
                btn.querySelector('.btn-main-text').textContent = 'PLACE BET';
                btn.querySelector('.btn-potential').classList.add('hidden');
            }
            
            const input = document.getElementById(`bet-amount-${panel}`);
            if (input) input.disabled = false;
        });
        
        document.getElementById('crash-overlay').classList.add('hidden');
        document.getElementById('multiplier-value').classList.remove('flying');
        
        // Rotate seed for next round
        this.provablyFair.rotateSeed();
        
        // Start next betting phase
        this.startBettingPhase();
    }
    
    addToHistory(multiplier) {
        this.history.unshift(multiplier);
        if (this.history.length > 15) this.history.pop();
        
        this.updateHistoryBar();
    }
    
    updateHistoryBar() {
        const historyList = document.getElementById('history-list');
        if (!historyList) return;
        
        historyList.innerHTML = this.history.map((m, index) => {
            let colorClass = 'low';  // Red < 2x
            if (m >= 10) colorClass = 'high';  // Gold > 10x
            else if (m >= 2) colorClass = 'mid';  // Blue 2x-10x
            
            const isNew = index === 0 ? 'new' : '';
            return `<div class="history-badge ${colorClass} ${isNew}">${m.toFixed(2)}x</div>`;
        }).join('');
        
        setTimeout(() => {
            historyList.scrollLeft = 0;
        }, 50);
    }
    
    checkAutoCashouts() {
        [1, 2].forEach(panel => {
            if (this.bets[panel].active && 
                !this.bets[panel].cashedOut && 
                this.gameState.multiplier >= this.bets[panel].autoCashout) {
                this.cashOut(panel);
            }
        });
    }
    
    updateUI() {
        // Update multiplier display (only if changed)
        const multiplierEl = document.getElementById('multiplier-value');
        if (multiplierEl) {
            const currentDisplay = this.gameState.multiplier.toFixed(2);
            if (currentDisplay !== this.lastMultiplierDisplay) {
                multiplierEl.innerHTML = currentDisplay + '<span class="multiplier-x">x</span>';
                this.lastMultiplierDisplay = currentDisplay;
            }
        }
        
        // Update buttons for both panels
        [1, 2].forEach(panel => {
            const btn = document.getElementById(`bet-btn-${panel}`);
            const input = document.getElementById(`bet-amount-${panel}`);
            
            if (!btn) return;
            
            // Clear all state classes first
            btn.classList.remove('place', 'cashout', 'waiting', 'lost', 'cashed', 'queued');
            
            // STATE: Flying and active bet not cashed out -> GREEN CASH OUT
            if (this.gameState.phase === 'FLYING_PHASE' && this.bets[panel].active && !this.bets[panel].cashedOut) {
                btn.classList.add('cashout');
                btn.disabled = false;
                
                const potential = (this.bets[panel].amount * this.gameState.multiplier).toFixed(2);
                btn.querySelector('.btn-main-text').textContent = `CASH OUT ${this.gameState.multiplier.toFixed(2)}x`;
                const potentialEl = btn.querySelector('.btn-potential');
                potentialEl.textContent = `${potential} 🪙`;
                potentialEl.classList.remove('hidden');
                
                if (input) input.disabled = true;
            }
            // STATE: Bet was cashed out -> GREEN CASHED
            else if (this.bets[panel].cashedOut) {
                btn.classList.add('cashed');
                btn.disabled = true;
                btn.querySelector('.btn-main-text').textContent = 'CASHED';
                btn.querySelector('.btn-potential').classList.add('hidden');
                if (input) input.disabled = true;
            }
            // STATE: Bet was lost (crashed before cash out) -> RED LOST
            else if (this.bets[panel].lost) {
                btn.classList.add('lost');
                btn.disabled = true;
                btn.querySelector('.btn-main-text').textContent = 'LOST';
                btn.querySelector('.btn-potential').classList.add('hidden');
                if (input) input.disabled = true;
            }
            // STATE: Queued for next round -> ORANGE QUEUED
            else if (this.gameState.queuedBets[panel]) {
                btn.classList.add('queued');
                btn.disabled = false;
                btn.querySelector('.btn-main-text').textContent = 'QUEUED';
                btn.querySelector('.btn-potential').classList.add('hidden');
                if (input) input.disabled = false;
            }
            // STATE: Bet placed during betting phase -> ORANGE WAITING
            else if (this.bets[panel].active && this.gameState.phase === 'BETTING_PHASE') {
                btn.classList.add('waiting');
                btn.disabled = true;
                btn.querySelector('.btn-main-text').textContent = 'WAITING';
                btn.querySelector('.btn-potential').classList.add('hidden');
                if (input) input.disabled = true;
            }
            // STATE: Ready to place bet during betting phase -> BLUE PLACE BET
            else if (this.gameState.phase === 'BETTING_PHASE') {
                btn.classList.add('place');
                btn.disabled = false;
                btn.querySelector('.btn-main-text').textContent = 'PLACE BET';
                btn.querySelector('.btn-potential').classList.add('hidden');
                if (input) input.disabled = false;
            }
            // STATE: Flying or crashed, no active bet -> QUEUE for next
            else {
                btn.classList.add('queued');
                btn.disabled = false;
                btn.querySelector('.btn-main-text').textContent = 'PLACE BET (NEXT)';
                btn.querySelector('.btn-potential').classList.add('hidden');
                if (input) input.disabled = false;
            }
        });
        
        // Update balance display from TelegramUser
        this.telegramUser.updateUI();
    }
    
    showHashModal() {
        let modal = document.getElementById('hash-modal');
        if (modal) {
            document.getElementById('server-seed').textContent = this.provablyFair.serverSeed;
            document.getElementById('current-hash').textContent = this.provablyFair.getCurrentHash() || 'Waiting...';
            document.getElementById('nonce-value').textContent = this.provablyFair.nonce;
            modal.classList.remove('hidden');
        }
    }
    
    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        container.appendChild(toast);
        
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(-50%) translateY(-10px)';
            setTimeout(() => toast.remove(), 300);
        }, 2500);
    }
}

// Export for use in other files
window.BettingLogic = BettingLogic;
