/**
 * game-engine.js
 * Luxury Retro Pixel Art - Canvas Rendering, Plane Movement, and Animations
 * High-end commercial game aesthetics with parallax scrolling
 */

class GameEngine {
    constructor(gameState) {
        this.gameState = gameState;
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Canvas dimensions
        this.width = 0;
        this.height = 0;
        
        // Camera shake offset
        this.shakeX = 0;
        this.shakeY = 0;
        this.shakeIntensity = 0;
        
        // Parallax layers
        this.parallax = {
            stars: [],
            city: [],
            dunes: []
        };
        
        // Plane animation
        this.plane = { 
            x: 50, 
            y: 0, 
            angle: 0, 
            wobble: 0, 
            propellerFrame: 0,
            propellerTimer: 0
        };
        
        // Particles
        this.particles = [];
        this.exhaustParticles = [];
        this.explosionParticles = [];
        
        // Flight trail
        this.footprint = [];
        
        // Animation
        this.frameCount = 0;
        
        // Performance
        this.lastFrameTime = 0;
        this.targetFPS = 60;
        this.frameInterval = 1000 / this.targetFPS;
        this.accumulatedTime = 0;
    }
    
    init() {
        this.setupCanvas();
        this.generateParallaxLayers();
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
    
    // ==========================================
    // Parallax Background Generation
    // ==========================================
    generateParallaxLayers() {
        // Stars layer (far background)
        this.parallax.stars = [];
        for (let i = 0; i < 80; i++) {
            this.parallax.stars.push({
                x: Math.random() * this.width,
                y: Math.random() * (this.height * 0.6),
                size: Math.random() > 0.8 ? 2 : 1,
                brightness: Math.random(),
                twinkleSpeed: 0.02 + Math.random() * 0.03
            });
        }
        
        // City silhouettes (mid-ground)
        this.parallax.city = [];
        let cityX = 0;
        while (cityX < this.width * 2) {
            const buildingWidth = 20 + Math.random() * 40;
            const buildingHeight = 30 + Math.random() * 80;
            this.parallax.city.push({
                x: cityX,
                y: this.height - 100 - buildingHeight,
                width: buildingWidth,
                height: buildingHeight,
                windows: this.generateBuildingWindows(buildingWidth, buildingHeight)
            });
            cityX += buildingWidth + Math.random() * 10;
        }
        
        // Desert dunes (near-ground)
        this.parallax.dunes = [];
        for (let i = 0; i < 5; i++) {
            this.parallax.dunes.push({
                x: i * (this.width / 3),
                points: this.generateDunePoints(),
                speed: 2 + i * 0.5
            });
        }
    }
    
    generateBuildingWindows(w, h) {
        const windows = [];
        const rows = Math.floor(h / 12);
        const cols = Math.floor(w / 8);
        for (let r = 1; r < rows - 1; r++) {
            for (let c = 1; c < cols - 1; c++) {
                if (Math.random() > 0.4) {
                    windows.push({
                        x: c * 8 + 2,
                        y: r * 12 + 2,
                        lit: Math.random() > 0.3
                    });
                }
            }
        }
        return windows;
    }
    
    generateDunePoints() {
        const points = [];
        const segments = 8;
        for (let i = 0; i <= segments; i++) {
            points.push({
                x: (i / segments) * 200,
                y: Math.sin(i * 0.8) * 20 + Math.random() * 10
            });
        }
        return points;
    }
    
    createParticles(x, y, color) {
        // Legacy method for compatibility
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
    
    // ==========================================
    // Camera Shake
    // ==========================================
    triggerShake(intensity) {
        this.shakeIntensity = intensity;
    }
    
    updateShake() {
        if (this.shakeIntensity > 0) {
            this.shakeX = (Math.random() - 0.5) * this.shakeIntensity;
            this.shakeY = (Math.random() - 0.5) * this.shakeIntensity;
            this.shakeIntensity *= 0.9; // Decay
            if (this.shakeIntensity < 0.5) {
                this.shakeIntensity = 0;
                this.shakeX = 0;
                this.shakeY = 0;
            }
        }
    }
    
    // ==========================================
    // Exhaust Trail
    // ==========================================
    emitExhaust() {
        // Emit from back of plane
        const backX = this.plane.x - 20;
        const backY = this.plane.y + 5;
        
        this.exhaustParticles.push({
            x: backX + (Math.random() - 0.5) * 6,
            y: backY + (Math.random() - 0.5) * 4,
            vx: -1 - Math.random() * 2,
            vy: (Math.random() - 0.5) * 0.5,
            life: 1.0,
            size: 2 + Math.random() * 2,
            color: `rgba(${100 + Math.random() * 100}, ${100 + Math.random() * 100}, ${100 + Math.random() * 100},`
        });
    }
    
    updateExhaust() {
        this.exhaustParticles = this.exhaustParticles.filter(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.life -= 0.015;
            p.size *= 0.98;
            return p.life > 0;
        });
    }
    
    // ==========================================
    // Explosion Animation (4-frame pixel explosion)
    // ==========================================
    createExplosion(x, y) {
        const colors = ['#ffff00', '#ff8800', '#ff4400', '#ff0000'];
        
        // Create pixel explosion particles
        for (let i = 0; i < 40; i++) {
            const angle = (Math.PI * 2 * i) / 40;
            const speed = 2 + Math.random() * 4;
            const color = colors[Math.floor(Math.random() * colors.length)];
            
            this.explosionParticles.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 1.0,
                color: color,
                size: 4 + Math.random() * 4,
                rotation: Math.random() * Math.PI * 2,
                rotationSpeed: (Math.random() - 0.5) * 0.2
            });
        }
    }
    
    updateExplosion() {
        this.explosionParticles = this.explosionParticles.filter(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.1; // Gravity
            p.life -= 0.02;
            p.rotation += p.rotationSpeed;
            p.size *= 0.95;
            return p.life > 0;
        });
    }
    
    resetForNewRound() {
        this.plane.x = 60;
        this.plane.y = this.height - 100;
        this.plane.angle = 0;
        this.plane.wobble = 0;
        this.plane.propellerFrame = 0;
        this.plane.propellerTimer = 0;
        this.footprint = [];
        this.exhaustParticles = [];
        this.explosionParticles = [];
        this.shakeX = 0;
        this.shakeY = 0;
        this.shakeIntensity = 0;
    }
    
    update(dt, multiplier, isFlying) {
        this.frameCount++;
        
        // Update camera shake
        this.updateShake();
        
        // Update parallax layers
        this.updateParallax(isFlying, multiplier);
        
        // Update exhaust
        this.updateExhaust();
        
        // Update explosion
        this.updateExplosion();
        
        // Emit exhaust during flight
        if (isFlying && this.frameCount % 3 === 0) {
            this.emitExhaust();
        }
        
        // Update particles
        this.particles = this.particles.filter(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.3;
            p.life -= 0.02;
            return p.life > 0;
        });
        
        // Update plane during flight
        if (isFlying) {
            const progress = Math.min((multiplier - 1) / 10, 1);
            this.plane.x = 60 + progress * (this.width - 120);
            this.plane.y = (this.height - 100) - progress * (this.height * 0.5);
            this.plane.wobble += dt * 0.005;
            this.plane.y += Math.sin(this.plane.wobble) * 2;
            
            // Propeller animation (3 frames)
            this.plane.propellerTimer += dt;
            if (this.plane.propellerTimer > 50) {
                this.plane.propellerFrame = (this.plane.propellerFrame + 1) % 3;
                this.plane.propellerTimer = 0;
            }
            
            // Flight angle
            const targetAngle = -Math.atan2(2, 10) - 0.05;
            this.plane.angle += (targetAngle - this.plane.angle) * 0.1;
            
            // Add flight path point
            if (this.frameCount % 3 === 0) {
                this.footprint.push({
                    x: this.plane.x,
                    y: this.plane.y,
                    multiplier: multiplier
                });
            }
            
            // Trigger shake at 10x
            if (multiplier >= 10 && multiplier < 10.5) {
                this.triggerShake(3);
            }
        }
    }
    
    updateParallax(isFlying, multiplier) {
        const speed = isFlying ? (1 + (multiplier - 1) * 0.3) : 0.5;
        
        // Update stars (twinkle)
        this.parallax.stars.forEach(star => {
            star.brightness += star.twinkleSpeed;
            if (star.brightness > 1 || star.brightness < 0.3) {
                star.twinkleSpeed *= -1;
            }
        });
        
        // Update city (slow movement)
        this.parallax.city.forEach(building => {
            building.x -= speed * 0.3;
            if (building.x + building.width < -50) {
                building.x = this.width + 50 + Math.random() * 100;
            }
        });
        
        // Update dunes (fast movement)
        this.parallax.dunes.forEach((dune, i) => {
            dune.x -= speed * dune.speed;
            if (dune.x < -200) {
                dune.x = this.width + Math.random() * 100;
            }
        });
    }
    
    // ==========================================
    // Drawing Methods
    // ==========================================
    draw(phase, multiplier) {
        // Clear with camera shake offset
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Apply camera shake
        this.ctx.translate(this.shakeX, this.shakeY);
        
        // Draw parallax layers
        this.drawStarfield();
        this.drawCity();
        this.drawDunes();
        
        // Draw flight curve
        if (phase === 'FLYING_PHASE' || phase === 'CRASH_PHASE') {
            this.drawFlightCurve();
        }
        
        // Draw plane or explosion
        if (phase === 'FLYING_PHASE') {
            this.drawExhaust();
            this.drawPlane();
        } else if (phase === 'CRASH_PHASE') {
            this.drawExplosion();
        }
        
        // Reset transform
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
    
    drawStarfield() {
        // Deep dark purple/black sky
        const gradient = this.ctx.createLinearGradient(0, 0, 0, this.height);
        gradient.addColorStop(0, '#0a0014');
        gradient.addColorStop(0.5, '#1a0a2e');
        gradient.addColorStop(1, '#2d1b4e');
        
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.width, this.height);
        
        // Draw twinkling stars
        this.parallax.stars.forEach(star => {
            const alpha = 0.3 + star.brightness * 0.7;
            this.ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
            this.ctx.fillRect(star.x, star.y, star.size, star.size);
        });
    }
    
    drawCity() {
        this.ctx.fillStyle = '#0d0221';
        this.parallax.city.forEach(building => {
            if (building.x > -building.width && building.x < this.width + 50) {
                // Building silhouette
                this.ctx.fillRect(building.x, building.y, building.width, building.height);
                
                // Windows
                building.windows.forEach(win => {
                    if (win.lit) {
                        this.ctx.fillStyle = `rgba(255, 215, 0, ${0.5 + Math.random() * 0.5})`;
                        this.ctx.fillRect(building.x + win.x, building.y + win.y, 4, 6);
                    }
                });
                this.ctx.fillStyle = '#0d0221';
            }
        });
    }
    
    drawDunes() {
        this.parallax.dunes.forEach(dune => {
            if (dune.x > -250 && dune.x < this.width + 50) {
                this.ctx.fillStyle = '#1a0f2e';
                this.ctx.beginPath();
                this.ctx.moveTo(dune.x, this.height);
                
                dune.points.forEach((point, i) => {
                    this.ctx.lineTo(dune.x + point.x, this.height - 40 + point.y);
                });
                
                this.ctx.lineTo(dune.x + 200, this.height);
                this.ctx.closePath();
                this.ctx.fill();
            }
        });
    }
    
    drawFlightCurve() {
        if (this.footprint.length < 2) return;
        
        // Glowing neon flight curve
        this.ctx.strokeStyle = '#ff00ff';
        this.ctx.lineWidth = 3;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        
        // Outer glow
        this.ctx.shadowBlur = 15;
        this.ctx.shadowColor = '#ff00ff';
        
        this.ctx.beginPath();
        this.ctx.moveTo(60, this.height - 100);
        
        this.footprint.forEach((point, i) => {
            if (i === 0) return;
            this.ctx.lineTo(point.x, point.y);
        });
        
        this.ctx.stroke();
        
        // Inner white core
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 1;
        this.ctx.shadowBlur = 5;
        this.ctx.shadowColor = '#ffffff';
        this.ctx.stroke();
        
        this.ctx.shadowBlur = 0;
    }
    
    drawExhaust() {
        this.exhaustParticles.forEach(p => {
            const alpha = p.life;
            this.ctx.fillStyle = p.color + ` ${alpha})`;
            this.ctx.fillRect(p.x, p.y, p.size, p.size);
        });
    }
    
    drawExplosion() {
        this.explosionParticles.forEach(p => {
            this.ctx.save();
            this.ctx.translate(p.x, p.y);
            this.ctx.rotate(p.rotation);
            
            this.ctx.fillStyle = p.color;
            this.ctx.globalAlpha = p.life;
            
            // Draw pixel square
            this.ctx.fillRect(-p.size/2, -p.size/2, p.size, p.size);
            
            this.ctx.restore();
        });
        this.ctx.globalAlpha = 1;
    }
    
    drawPlane() {
        this.ctx.save();
        this.ctx.translate(this.plane.x, this.plane.y);
        this.ctx.rotate(this.plane.angle);
        this.ctx.scale(3, 3);
        
        // Red Biplane Pixel Art
        const bodyColor = '#dc2626';
        const wingColor = '#991b1b';
        const darkColor = '#7c1d1d';
        
        // Main fuselage
        this.ctx.fillStyle = bodyColor;
        const fuselage = [
            [0, 0], [1, 0], [2, 0], [3, 0], [4, 0],
            [0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [5, 1],
            [0, 2], [1, 2], [2, 2], [3, 2], [4, 2], [5, 2], [6, 2],
            [1, 3], [2, 3], [3, 3], [4, 3], [5, 3],
            [2, 4], [3, 4], [4, 4]
        ];
        fuselage.forEach(p => this.ctx.fillRect(p[0], p[1], 1, 1));
        
        // Shadow/depth on fuselage
        this.ctx.fillStyle = darkColor;
        this.ctx.fillRect(0, 2, 1, 1);
        this.ctx.fillRect(1, 3, 1, 1);
        this.ctx.fillRect(2, 4, 1, 1);
        
        // Top wing
        this.ctx.fillStyle = wingColor;
        const topWing = [
            [-2, -2], [-1, -2], [0, -2], [1, -2], [2, -2], [3, -2], [4, -2],
            [-1, -1], [0, -1], [1, -1], [2, -1], [3, -1]
        ];
        topWing.forEach(p => this.ctx.fillRect(p[0], p[1], 1, 1));
        
        // Bottom wing
        const bottomWing = [
            [-1, 3], [0, 3], [1, 3], [2, 3], [3, 3], [4, 3], [5, 3],
            [0, 4], [1, 4], [2, 4], [3, 4], [4, 4]
        ];
        bottomWing.forEach(p => this.ctx.fillRect(p[0], p[1], 1, 1));
        
        // Tail
        const tail = [
            [-3, 1], [-2, 1], [-2, 2], [-3, 2],
            [-4, 0], [-3, 0], [-3, -1], [-4, -1]
        ];
        tail.forEach(p => this.ctx.fillRect(p[0], p[1], 1, 1));
        
        // Cockpit
        this.ctx.fillStyle = '#1f2937';
        this.ctx.fillRect(2, 0, 2, 1);
        
        // Pilot
        this.ctx.fillStyle = '#fbbf24';
        this.ctx.fillRect(2.5, -0.5, 1, 1);
        
        // Animated Propeller (3 frames)
        this.drawPropeller();
        
        this.ctx.restore();
    }
    
    drawPropeller() {
        const frame = this.plane.propellerFrame;
        this.ctx.fillStyle = '#fbbf24';
        
        // Propeller hub
        this.ctx.fillRect(6.5, 1.5, 1, 1);
        
        if (frame === 0) {
            // Vertical blade
            this.ctx.fillRect(7, 0, 1, 4);
        } else if (frame === 1) {
            // X shape
            this.ctx.fillRect(7, 0, 1, 4);
            this.ctx.fillRect(6, 1.5, 3, 1);
        } else {
            // Horizontal blur
            this.ctx.fillRect(6, 1.5, 3, 1);
        }
        
        // Propeller blur disk
        this.ctx.fillStyle = 'rgba(251, 191, 36, 0.3)';
        this.ctx.fillRect(6, 0.5, 2, 3);
    }
    
    // Legacy method for compatibility
    drawPixelBiplane(x, y, angle) {
        this.drawPlane();
    }
    
    drawCloud(x, y, size, opacity) {
        // Legacy method - not used in new design
    }
    
    drawMountains() {
        // Legacy method - not used in new design
    }
    
    drawGround() {
        // Legacy method - not used in new design
    }
    
    drawLineGraph() {
        // Legacy method - replaced by drawFlightCurve
    }
    
    // Main animation loop
    animate(updateCallback) {
        const loop = (timestamp) => {
            requestAnimationFrame(loop);
            
            if (!timestamp) timestamp = performance.now();
            
            const dt = timestamp - this.lastFrameTime;
            if (dt < this.frameInterval) return;
            
            const elapsed = Math.min(dt, this.frameInterval * 2);
            this.accumulatedTime += elapsed;
            
            while (this.accumulatedTime >= this.frameInterval) {
                updateCallback(this.frameInterval);
                this.accumulatedTime -= this.frameInterval;
            }
            
            this.lastFrameTime = timestamp;
        };
        
        requestAnimationFrame(loop);
    }
}

// Export for use in other files
window.GameEngine = GameEngine;
