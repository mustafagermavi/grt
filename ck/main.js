/**
 * main.js
 * Main initialization and game coordinator
 * Connects all modules: GameEngine, BettingLogic, ProvablyFair, TelegramUser
 */

// Global Game State Object for cross-module communication
const GameState = {
    phase: 'BETTING_PHASE', // BETTING_PHASE, FLYING_PHASE, CRASH_PHASE
    multiplier: 1.00,
    targetCrashMultiplier: 0,
    flightStartTime: 0,
    bettingEndTime: 0,
    
    // Queued bets for next round (1xbet Aviator style)
    queuedBets: {
        1: null, // { amount, autoCashout }
        2: null
    },
    
    // Update multiplier using 1xbet Aviator formula
    updateMultiplier() {
        if (this.phase === 'FLYING_PHASE') {
            const elapsed = (performance.now() - this.flightStartTime) / 1000; // Convert to seconds
            // 1xbet Aviator formula: visualMultiplier = 1 * Math.pow(Math.E, 0.06 * timeInSeconds)
            this.multiplier = 1 * Math.pow(Math.E, 0.06 * elapsed);
        }
    },
    
    // Reset for new round
    resetForNewRound() {
        this.phase = 'BETTING_PHASE';
        this.multiplier = 1.00;
        this.flightStartTime = 0;
        // Move queued bets to active
        this.processQueuedBets();
    },
    
    // Process queued bets at start of round
    processQueuedBets() {
        [1, 2].forEach(panel => {
            if (this.queuedBets[panel]) {
                // The betting logic will pick these up
                this.queuedBets[panel] = null;
            }
        });
    }
};

// Make GameState globally accessible
window.GameState = GameState;

// ==========================================
// Telegram User Manager
// ==========================================
class TelegramUser {
    constructor() {
        this.user = null;
        this.userId = null;
        this.firstName = 'Player';
        this.balance = 1000;
        this.init();
    }

    init() {
        // Try to get Telegram user data
        if (window.Telegram?.WebApp?.initDataUnsafe?.user) {
            const tgUser = window.Telegram.WebApp.initDataUnsafe.user;
            this.user = tgUser;
            this.userId = tgUser.id;
            this.firstName = tgUser.first_name || 'Player';
        }

        // Load balance from localStorage
        const storageKey = this.getBalanceKey();
        const savedBalance = localStorage.getItem(storageKey);
        if (savedBalance !== null) {
            this.balance = parseFloat(savedBalance) || 1000;
        }

        this.updateUI();
    }

    getBalanceKey() {
        return `crash_balance_${this.userId || 'guest'}`;
    }

    getBalance() {
        return this.balance;
    }

    setBalance(amount) {
        this.balance = Math.max(0, amount);
        localStorage.setItem(this.getBalanceKey(), this.balance.toString());
        this.updateUI();
        return this.balance;
    }

    addToBalance(amount) {
        return this.setBalance(this.balance + amount);
    }

    subtractFromBalance(amount) {
        return this.setBalance(this.balance - amount);
    }

    updateUI() {
        // Update user name
        const nameEl = document.getElementById('user-name');
        if (nameEl) {
            nameEl.textContent = this.firstName;
        }

        // Update avatar with first letter
        const avatarEl = document.getElementById('user-avatar');
        if (avatarEl) {
            avatarEl.textContent = this.firstName.charAt(0).toUpperCase();
        }

        // Update balance display
        const balanceEl = document.getElementById('user-balance');
        if (balanceEl) {
            balanceEl.textContent = Math.floor(this.balance);
        }
    }
}

// Export TelegramUser
window.TelegramUser = TelegramUser;

// ==========================================
// Main Game Controller
// ==========================================
class CrashGame {
    constructor() {
        // Initialize core systems
        this.telegramUser = new TelegramUser();
        this.provablyFair = new ProvablyFair();
        this.gameEngine = new GameEngine(GameState);
        this.bettingLogic = new BettingLogic(GameState, this.telegramUser, this.provablyFair, this.gameEngine);
    }
    
    init() {
        // Initialize all modules
        this.gameEngine.init();
        this.bettingLogic.init();
        this.setupTelegramWebApp();
        this.disableContextMenus();
        
        // Start the game loop
        this.startGameLoop();
        
        // Start first betting phase (calculates crash point immediately)
        this.bettingLogic.startBettingPhase();
    }
    
    setupTelegramWebApp() {
        if (window.Telegram?.WebApp) {
            window.Telegram.WebApp.ready();
            window.Telegram.WebApp.expand();
            document.body.classList.add('telegram-webapp');
            
            // Set header color
            window.Telegram.WebApp.setHeaderColor('#0a0a0a');
            window.Telegram.WebApp.setBackgroundColor('#0a0a0a');
        }
    }
    
    disableContextMenus() {
        // Disable context menu (right-click / long-press)
        document.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            return false;
        });
        
        // Disable text selection on mobile
        document.addEventListener('selectstart', (e) => {
            e.preventDefault();
            return false;
        });
        
        // Disable drag on all elements
        document.addEventListener('dragstart', (e) => {
            e.preventDefault();
            return false;
        });
        
        // Prevent zoom on double-tap
        let lastTouchEnd = 0;
        document.addEventListener('touchend', (e) => {
            const now = Date.now();
            if (now - lastTouchEnd <= 300) {
                e.preventDefault();
            }
            lastTouchEnd = now;
        }, { passive: false });
    }
    
    startGameLoop() {
        // Main game update function called every frame
        const gameUpdate = (dt) => {
            // Update multiplier if flying
            if (GameState.phase === 'FLYING_PHASE') {
                GameState.updateMultiplier();
                
                // Check for crash
                const crashPoint = GameState.targetCrashMultiplier;
                if (crashPoint > 0 && GameState.multiplier >= crashPoint) {
                    GameState.multiplier = crashPoint;
                    this.bettingLogic.crash();
                    return;
                }
                
                // Check auto cashouts
                this.bettingLogic.checkAutoCashouts();
                
                // Update UI during flight
                this.bettingLogic.updateUI();
            }
            
            // Update game engine (visuals)
            const isFlying = GameState.phase === 'FLYING_PHASE';
            this.gameEngine.update(dt, GameState.multiplier, isFlying);
        };
        
        // Start the animation loop
        this.gameEngine.animate(gameUpdate);
        
        // Render loop
        const render = () => {
            this.gameEngine.draw(GameState.phase, GameState.multiplier);
            requestAnimationFrame(render);
        };
        requestAnimationFrame(render);
    }
}

// ==========================================
// Initialize Game on Page Load
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    window.game = new CrashGame();
    window.game.init();
});
