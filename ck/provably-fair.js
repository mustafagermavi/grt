/**
 * provably-fair.js
 * SHA-256 Provably Fair Crash Point Generation
 * This module handles all cryptographic functions for determining crash points
 */

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

// Export for use in other files
window.ProvablyFair = ProvablyFair;
