/**
 * 1xbet Style Crash Game - Telegram No-Account Experience
 * SHA-256 Provably Fair System
 * Haptic Feedback with Telegram SDK
 * LocalStorage Balance Persistence
 */

// ==========================================
// SHA-256 Provably Fair Implementation
// ==========================================
class ProvablyFair {
    constructor() {
        this.serverSeed = this.generateSeed();
        this.clientSeed = this.generateSeed();
        this.nonce = 0;
        this.currentHash = null;
        this.nextCrashPoint = null;
    }

    generateSeed() {
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
    }

    async calculateCrashPoint() {
        // Calculate crash point ONCE per round using SHA-256
        const input = `${this.serverSeed}-${this.clientSeed}-${this.nonce}`;
        const encoder = new TextEncoder();
        const data = encoder.encode(input);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        this.currentHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        
        // Get first 13 hex chars (52 bits) as integer
        const hashInt = parseInt(this.currentHash.substring(0, 13), 16);
        const maxInt = Math.pow(2, 52);
        
        // House Edge 3%: 0.97 instead of 1.0
        // Formula: crashPoint = (0.97 * 2^52) / (2^52 - hashInt)
        const crashPoint = Math.max(1.01, (0.97 * maxInt) / (maxInt - hashInt));
        
        this.nonce++;
        this.nextCrashPoint = Math.min(crashPoint, 1000); // Cap at 1000x
        
        // Debug: Log the crash point
        console.log("Next Crash At:", this.nextCrashPoint.toFixed(2) + "x");
        
        return this.nextCrashPoint;
    }

    getCurrentHash() {
        return this.currentHash;
    }

    getNextCrashPoint() {
        return this.nextCrashPoint;
    }

    rotateSeed() {
        this.serverSeed = this.generateSeed();
        this.nonce = 0;
        this.nextCrashPoint = null;
    }
}

// ==========================================
// Haptic Feedback Helper (Telegram + Native)
// ==========================================
class Haptic {
    static isTelegram() {
        return window.Telegram?.WebApp?.HapticFeedback != null;
    }

    static light() {
        if (navigator.vibrate) navigator.vibrate(10);
        if (this.isTelegram()) {
            window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
        }
    }

    static medium() {
        if (navigator.vibrate) navigator.vibrate(20);
        if (this.isTelegram()) {
            window.Telegram.WebApp.HapticFeedback.impactOccurred('medium');
        }
    }

    static heavy() {
        if (navigator.vibrate) navigator.vibrate([30, 10, 30]);
        if (this.isTelegram()) {
            window.Telegram.WebApp.HapticFeedback.impactOccurred('heavy');
        }
    }

    static crash() {
        // Use heavy impact for crash - requested specifically
        if (navigator.vibrate) navigator.vibrate([50, 30, 50, 30, 100]);
        if (this.isTelegram()) {
            window.Telegram.WebApp.HapticFeedback.impactOccurred('heavy');
        }
    }

    static win() {
        if (navigator.vibrate) navigator.vibrate([20, 10, 40]);
        if (this.isTelegram()) {
            window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
        }
    }
}

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

// ==========================================
// Main Game Class
// ==========================================
class CrashGame {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Telegram user manager
        this.telegramUser = new TelegramUser();
        
        // Game state
        this.state = 'waiting'; // waiting, countdown, flying, crashed
        this.multiplier = 1.00;
        this.targetCrashMultiplier = 0;
        this.startTime = 0;
        this.countdownValue = 3;
        this.countdownInterval = null;
        
        // Provably Fair
        this.provablyFair = new ProvablyFair();
        
        // Dual betting system with auto cash-out
        this.bets = {
            1: { amount: 0, active: false, cashedOut: false, autoCashout: 2.00 },
            2: { amount: 0, active: false, cashedOut: false, autoCashout: 2.00 }
        };
        
        // History (last 15)
        this.history = [];
        
        // Animation
        this.plane = { x: 50, y: 0, angle: 0, wobble: 0, propeller: 0 };
        this.clouds = [];
        this.particles = [];
        this.footprint = [];
        this.groundOffset = 0;
        this.mountains = [];
        
        // Performance (60fps)
        this.lastFrameTime = 0;
        this.targetFPS = 60;
        this.frameInterval = 1000 / this.targetFPS;
        this.accumulatedTime = 0;
        this.lastMultiplierDisplay = '1.00';
        
        this.init();
    }
    
    init() {
        this.setupCanvas();
        this.setupEventListeners();
        this.disableContextMenus();
        this.generateClouds();
        this.generateMountains();
        this.animate();
        this.updateUI();
        
        // Initialize Telegram WebApp
        if (window.Telegram?.WebApp) {
            window.Telegram.WebApp.ready();
            window.Telegram.WebApp.expand();
            document.body.classList.add('telegram-webapp');
            
            // Set header color
            window.Telegram.WebApp.setHeaderColor('#0a0a0a');
            window.Telegram.WebApp.setBackgroundColor('#0a0a0a');
        }
        
        // Start first countdown - players can bet during this time
        this.startCountdown();
    }
    
    setupCanvas() {
        const container = this.canvas.parentElement;
        const resize = () => {
            const dpr = Math.min(window.devicePixelRatio, 2);
            this.canvas.width = container.clientWidth * dpr;
            this.canvas.height = container.clientHeight * dpr;
            this.canvas.style.width = container.clientWidth + 'px';
            this.canvas.style.height = container.clientHeight + 'px';
            this.ctx.scale(dpr, dpr);
            this.width = container.clientWidth;
            this.height = container.clientHeight;
        };
        
        resize();
        window.addEventListener('resize', resize);
    }
    
    setupEventListeners() {
        // Quick stake buttons [1, 5, 10, 50]
        document.querySelectorAll('.stake-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                Haptic.light();
                const panel = parseInt(e.target.dataset.panel);
                const amount = parseInt(e.target.dataset.amount);
                const input = document.getElementById(`bet-amount-${panel}`);
                if (input && this.state === 'waiting') {
                    input.value = amount;
                }
            });
        });
        
        // Main action buttons (Place Bet / Cash Out)
        [1, 2].forEach(panel => {
            const btn = document.getElementById(`bet-btn-${panel}`);
            if (btn) {
                btn.addEventListener('click', () => {
                    Haptic.medium();
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
                Haptic.light();
                this.showHashModal();
            });
        }
        
        // Close hash modal
        const closeHash = document.getElementById('close-hash');
        if (closeHash) {
            closeHash.addEventListener('click', () => {
                Haptic.light();
                document.getElementById('hash-modal').classList.add('hidden');
            });
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
    
    getAvailableBalance() {
        return this.telegramUser.getBalance();
    }
    
    handleBetAction(panel) {
        // STATE_BETTING or STATE_COUNTDOWN: Place a bet
        if (this.state === 'countdown' || this.state === 'waiting') {
            this.placeBet(panel);
        }
        // STATE_FLYING: Cash out
        else if (this.state === 'flying') {
            this.cashOut(panel);
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
            Haptic.crash();
            return;
        }
        
        // Deduct from balance
        this.telegramUser.subtractFromBalance(amount);
        
        this.bets[panel].amount = amount;
        this.bets[panel].active = true;
        this.bets[panel].cashedOut = false;
        this.bets[panel].autoCashout = parseFloat(autoInput?.value) || 2.00;
        
        this.updateUI();
        this.showToast(`Bet ${panel}: ${amount} 🪙 placed!`, 'success');
    }
    
    startCountdown() {
        this.state = 'countdown';
        this.countdownValue = 3;
        
        const timerEl = document.getElementById('waiting-timer');
        const timerValueEl = document.getElementById('timer-value');
        
        if (timerEl) timerEl.classList.remove('hidden');
        
        this.countdownInterval = setInterval(() => {
            this.countdownValue--;
            
            if (timerValueEl) {
                timerValueEl.textContent = this.countdownValue;
                // Pulse animation on update
                timerValueEl.style.animation = 'none';
                timerValueEl.offsetHeight; // Trigger reflow
                timerValueEl.style.animation = 'timerPulse 1s ease-in-out infinite';
            }
            
            // Haptic tick for countdown
            Haptic.light();
            
            if (this.countdownValue <= 0) {
                clearInterval(this.countdownInterval);
                if (timerEl) timerEl.classList.add('hidden');
                this.startFlight();
            }
        }, 1000);
    }
    
    async startFlight() {
        // Calculate crash point ONCE at the start of the round
        this.targetCrashMultiplier = await this.provablyFair.calculateCrashPoint();
        
        this.state = 'flying';
        this.startTime = performance.now();
        this.multiplier = 1.00;
        this.footprint = [];
        
        this.plane.x = 60;
        this.plane.y = this.height - 100;
        this.plane.angle = 0;
        this.plane.propeller = 0;
        
        document.getElementById('multiplier-value').classList.add('flying');
        document.getElementById('crash-overlay').classList.add('hidden');
        document.getElementById('multiplier-status').textContent = 'FLYING';
        
        // Debug: Also log when flight starts
        console.log("Flight started! Target crash at:", this.targetCrashMultiplier.toFixed(2) + "x");
        
        this.updateUI();
    }
    
    cashOut(panel) {
        if (this.state !== 'flying' || !this.bets[panel].active || this.bets[panel].cashedOut) {
            return;
        }
        
        const winAmount = this.bets[panel].amount * this.multiplier;
        this.telegramUser.addToBalance(winAmount);
        this.bets[panel].cashedOut = true;
        
        // Trigger haptic feedback on successful cash out (as requested)
        Haptic.win();
        this.createParticles(this.plane.x, this.plane.y, '#00cc66');
        
        const profit = (winAmount - this.bets[panel].amount).toFixed(2);
        this.showToast(`Cashed out @ ${this.multiplier.toFixed(2)}x! +${profit} 🪙`, 'success');
        
        this.updateUI();
    }
    
    crash() {
        this.state = 'crashed';
        
        // Trigger heavy haptic on crash
        Haptic.crash();
        
        // Handle lost bets - show visual feedback
        [1, 2].forEach(panel => {
            if (this.bets[panel].active && !this.bets[panel].cashedOut) {
                this.bets[panel].active = false;
                this.bets[panel].lost = true; // Mark as lost for UI
                
                // Flash red on the button
                const btn = document.getElementById(`bet-btn-${panel}`);
                if (btn) {
                    btn.classList.add('lost');
                    setTimeout(() => btn.classList.remove('lost'), 1000);
                }
            }
        });
        
        this.addToHistory(this.multiplier);
        
        const crashOverlay = document.getElementById('crash-overlay');
        const crashMultiplier = document.getElementById('crash-multiplier');
        
        if (crashOverlay) crashOverlay.classList.remove('hidden');
        if (crashMultiplier) crashMultiplier.textContent = `@ ${this.multiplier.toFixed(2)}x`;
        
        this.createParticles(this.plane.x, this.plane.y, '#ff3333');
        document.getElementById('multiplier-status').textContent = 'CRASHED';
        
        setTimeout(() => {
            this.resetGame();
        }, 3000);
    }
    
    resetGame() {
        this.state = 'waiting';
        this.multiplier = 1.00;
        this.provablyFair.rotateSeed();
        
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
                btn.classList.remove('cashout', 'lost', 'waiting');
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
        document.getElementById('multiplier-status').textContent = 'WAITING';
        
        this.footprint = [];
        this.updateUI();
        
        // Start countdown for next round
        this.startCountdown();
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
    
    createParticles(x, y, color) {
        for (let i = 0; i < 15; i++) {
            this.particles.push({
                x: x,
                y: y,
                vx: (Math.random() - 0.5) * 8,
                vy: (Math.random() - 0.5) * 8,
                life: 1.0,
                color: color,
                size: 3 + Math.random() * 3
            });
        }
    }
    
    generateClouds() {
        this.clouds = [];
        for (let i = 0; i < 5; i++) {
            this.clouds.push({
                x: Math.random() * this.width,
                y: 20 + Math.random() * (this.height * 0.4),
                speed: 0.3 + Math.random() * 0.4,
                size: 20 + Math.random() * 25,
                opacity: 0.3 + Math.random() * 0.3
            });
        }
    }
    
    generateMountains() {
        this.mountains = [];
        for (let i = 0; i < 4; i++) {
            this.mountains.push({
                x: i * (this.width / 3),
                height: 25 + Math.random() * 40,
                width: 80 + Math.random() * 80
            });
        }
    }
    
    update(dt) {
        // Update clouds
        this.clouds.forEach(cloud => {
            cloud.x -= cloud.speed * (1 + (this.multiplier - 1) * 0.2);
            if (cloud.x + cloud.size < 0) {
                cloud.x = this.width + cloud.size;
                cloud.y = 20 + Math.random() * (this.height * 0.4);
            }
        });
        
        // Update mountains
        if (this.state === 'flying') {
            this.groundOffset += 2 * (1 + (this.multiplier - 1) * 0.5);
            if (this.groundOffset > 100) this.groundOffset = 0;
        }
        
        // Update particles
        this.particles = this.particles.filter(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.3;
            p.life -= 0.02;
            return p.life > 0;
        });
        
        if (this.state === 'flying') {
            // Professional multiplier growth formula
            // currentMultiplier += 0.01 * (currentMultiplier ** 0.1)
            const growthRate = 0.01 * Math.pow(this.multiplier, 0.1);
            this.multiplier += growthRate * (dt / 16); // Normalize to ~60fps
            
            // Ensure we don't overshoot the crash point
            const crashPoint = this.provablyFair.getNextCrashPoint();
            
            // Check crash - plane keeps flying until multiplier >= crashPoint
            if (crashPoint && this.multiplier >= crashPoint) {
                this.multiplier = crashPoint;
                this.crash();
                return;
            }
            
            // Auto cash-out check
            [1, 2].forEach(panel => {
                if (this.bets[panel].active && 
                    !this.bets[panel].cashedOut && 
                    this.multiplier >= this.bets[panel].autoCashout) {
                    this.cashOut(panel);
                }
            });
            
            // Update plane position - synced with multiplier
            const progress = Math.min((this.multiplier - 1) / 10, 1);
            this.plane.x = 60 + progress * (this.width - 120);
            this.plane.y = (this.height - 100) - progress * (this.height * 0.5);
            this.plane.wobble += dt * 0.005;
            this.plane.y += Math.sin(this.plane.wobble) * 2;
            this.plane.propeller += 0.5;
            
            const targetAngle = -Math.atan2(2, 10) - 0.05;
            this.plane.angle += (targetAngle - this.plane.angle) * 0.1;
            
            // Add footprint point for line graph every few frames
            if (this.frameCount % 3 === 0) {
                this.footprint.push({
                    x: this.plane.x,
                    y: this.plane.y,
                    multiplier: this.multiplier
                });
            }
            
            this.updateUI();
        }
        
        this.frameCount = (this.frameCount || 0) + 1;
    }
    
    drawPixelBiplane(x, y, angle) {
        this.ctx.save();
        this.ctx.translate(x, y);
        this.ctx.rotate(angle);
        this.ctx.scale(3, 3);
        
        const bodyColor = '#dc2626';
        const wingColor = '#991b1b';
        const propColor = '#fbbf24';
        
        this.ctx.fillStyle = bodyColor;
        const fuselage = [
            [0, 0], [1, 0], [2, 0], [3, 0], [4, 0],
            [0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [5, 1],
            [0, 2], [1, 2], [2, 2], [3, 2], [4, 2], [5, 2], [6, 2],
            [1, 3], [2, 3], [3, 3], [4, 3], [5, 3],
            [2, 4], [3, 4], [4, 4]
        ];
        fuselage.forEach(p => this.ctx.fillRect(p[0], p[1], 1, 1));
        
        this.ctx.fillStyle = wingColor;
        const topWing = [
            [-2, -2], [-1, -2], [0, -2], [1, -2], [2, -2], [3, -2], [4, -2],
            [-1, -1], [0, -1], [1, -1], [2, -1], [3, -1]
        ];
        topWing.forEach(p => this.ctx.fillRect(p[0], p[1], 1, 1));
        
        const bottomWing = [
            [-1, 3], [0, 3], [1, 3], [2, 3], [3, 3], [4, 3], [5, 3],
            [0, 4], [1, 4], [2, 4], [3, 4], [4, 4]
        ];
        bottomWing.forEach(p => this.ctx.fillRect(p[0], p[1], 1, 1));
        
        const tail = [
            [-3, 1], [-2, 1], [-2, 2], [-3, 2],
            [-4, 0], [-3, 0], [-3, -1], [-4, -1]
        ];
        tail.forEach(p => this.ctx.fillRect(p[0], p[1], 1, 1));
        
        this.ctx.fillStyle = '#1f2937';
        this.ctx.fillRect(2, 0, 2, 1);
        
        this.ctx.fillStyle = propColor;
        const propOffset = Math.sin(this.plane.propeller) * 2;
        this.ctx.fillRect(7, 1 + propOffset, 1, 1);
        this.ctx.fillRect(7, 2 - propOffset, 1, 1);
        
        this.ctx.restore();
    }
    
    drawCloud(x, y, size, opacity) {
        this.ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
        const cloudPixels = [
            [0, 0], [1, 0], [2, 0], [3, 0],
            [-1, 1], [0, 1], [1, 1], [2, 1], [3, 1], [4, 1],
            [-1, 2], [0, 2], [1, 2], [2, 2], [3, 2], [4, 2],
            [0, 3], [1, 3], [2, 3], [3, 3]
        ];
        
        this.ctx.save();
        this.ctx.translate(x, y);
        this.ctx.scale(size / 20, size / 20);
        cloudPixels.forEach(p => {
            this.ctx.fillRect(p[0] * 2, p[1] * 2, 2, 2);
        });
        this.ctx.restore();
    }
    
    drawMountains() {
        this.ctx.fillStyle = '#c2410c';
        this.mountains.forEach(mountain => {
            const x = mountain.x - this.groundOffset;
            const drawX = x < -100 ? x + this.width + 200 : x;
            
            for (let i = 0; i < mountain.width; i += 4) {
                const height = mountain.height * (1 - Math.abs(i - mountain.width/2) / (mountain.width/2));
                const pixelHeight = Math.floor(height / 4) * 4;
                this.ctx.fillRect(drawX + i, this.height - 40 - pixelHeight, 4, pixelHeight);
            }
        });
    }
    
    drawGround() {
        const groundGradient = this.ctx.createLinearGradient(0, this.height - 60, 0, this.height);
        groundGradient.addColorStop(0, '#d97706');
        groundGradient.addColorStop(1, '#92400e');
        
        this.ctx.fillStyle = groundGradient;
        this.ctx.fillRect(0, this.height - 60, this.width, 60);
        
        this.ctx.fillStyle = '#b45309';
        for (let x = -this.groundOffset; x < this.width; x += 20) {
            const drawX = x < 0 ? x + this.width : x;
            this.ctx.fillRect(drawX, this.height - 50, 4, 4);
            this.ctx.fillRect(drawX + 8, this.height - 35, 4, 4);
        }
    }
    
    drawLineGraph() {
        if (this.footprint.length < 2) return;
        
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 3;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.ctx.shadowBlur = 10;
        this.ctx.shadowColor = 'rgba(255, 255, 255, 0.5)';
        
        this.ctx.beginPath();
        this.ctx.moveTo(60, this.height - 100);
        
        this.footprint.forEach((point, i) => {
            if (i === 0) return;
            this.ctx.lineTo(point.x, point.y);
        });
        
        this.ctx.stroke();
        this.ctx.shadowBlur = 0;
    }
    
    draw() {
        this.ctx.clearRect(0, 0, this.width, this.height);
        
        const skyGradient = this.ctx.createLinearGradient(0, 0, 0, this.height);
        skyGradient.addColorStop(0, '#87CEEB');
        skyGradient.addColorStop(0.5, '#E0F6FF');
        skyGradient.addColorStop(0.7, '#F4E4C1');
        skyGradient.addColorStop(1, '#D4A574');
        
        this.ctx.fillStyle = skyGradient;
        this.ctx.fillRect(0, 0, this.width, this.height);
        
        this.clouds.forEach(cloud => {
            this.drawCloud(cloud.x, cloud.y, cloud.size, cloud.opacity);
        });
        
        this.drawMountains();
        this.drawGround();
        this.drawLineGraph();
        
        if (this.state === 'flying' || this.state === 'crashed') {
            this.drawPixelBiplane(this.plane.x, this.plane.y, this.plane.angle);
        }
        
        this.particles.forEach(p => {
            this.ctx.globalAlpha = p.life;
            this.ctx.fillStyle = p.color;
            this.ctx.fillRect(p.x - p.size/2, p.y - p.size/2, p.size, p.size);
        });
        this.ctx.globalAlpha = 1;
    }
    
    updateUI() {
        // Update multiplier display (only if changed)
        const multiplierEl = document.getElementById('multiplier-value');
        if (multiplierEl) {
            const currentDisplay = this.multiplier.toFixed(2);
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
            
            // STATE: Flying and active bet not cashed out -> SHOW CASH OUT
            if (this.state === 'flying' && this.bets[panel].active && !this.bets[panel].cashedOut) {
                btn.classList.remove('place', 'waiting', 'lost');
                btn.classList.add('cashout');
                btn.disabled = false;
                
                const potential = (this.bets[panel].amount * this.multiplier).toFixed(2);
                btn.querySelector('.btn-main-text').textContent = `CASH OUT ${this.multiplier.toFixed(2)}x`;
                const potentialEl = btn.querySelector('.btn-potential');
                potentialEl.textContent = `${potential} 🪙`;
                potentialEl.classList.remove('hidden');
                
                if (input) input.disabled = true;
            }
            // STATE: Bet was cashed out
            else if (this.bets[panel].cashedOut) {
                btn.classList.remove('place', 'cashout', 'waiting');
                btn.classList.add('cashed');
                btn.disabled = true;
                btn.querySelector('.btn-main-text').textContent = 'CASHED';
                if (input) input.disabled = true;
            }
            // STATE: Bet was lost (crashed before cash out)
            else if (this.bets[panel].lost) {
                btn.classList.remove('place', 'cashout', 'waiting');
                btn.classList.add('lost');
                btn.disabled = true;
                btn.querySelector('.btn-main-text').textContent = 'LOST';
                if (input) input.disabled = true;
            }
            // STATE: Bet placed but round hasn't started yet -> SHOW WAITING
            else if (this.bets[panel].active && (this.state === 'countdown' || this.state === 'waiting')) {
                btn.classList.remove('place', 'cashout', 'lost');
                btn.classList.add('waiting');
                btn.disabled = true;
                btn.querySelector('.btn-main-text').textContent = 'WAITING';
                btn.querySelector('.btn-potential').classList.add('hidden');
                if (input) input.disabled = true;
            }
            // STATE: Ready to place bet
            else {
                btn.classList.remove('cashout', 'waiting', 'lost', 'cashed');
                btn.classList.add('place');
                btn.disabled = false;
                btn.querySelector('.btn-main-text').textContent = 'PLACE BET';
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
    
    animate(timestamp) {
        requestAnimationFrame((t) => this.animate(t));
        
        if (!timestamp) timestamp = performance.now();
        
        const dt = timestamp - this.lastFrameTime;
        if (dt < this.frameInterval) return;
        
        const elapsed = Math.min(dt, this.frameInterval * 2);
        this.accumulatedTime += elapsed;
        
        while (this.accumulatedTime >= this.frameInterval) {
            this.update(this.frameInterval);
            this.accumulatedTime -= this.frameInterval;
        }
        
        this.draw();
        this.lastFrameTime = timestamp;
    }
}

// Initialize game
document.addEventListener('DOMContentLoaded', () => {
    window.game = new CrashGame();
});

