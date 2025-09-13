// bloom-filter.js
// A lightweight, optimized, robust, fast, and scalable Bloom Filter implementation in core JavaScript.
// Optimized for handling millions of items with low memory footprint and high speed.
// Uses Uint8Array for bit storage and two high-quality hash functions for effective double hashing.
// No external dependencies. Suitable for Node.js server-side (Express, Hono, etc.).
// Assumes items are strings for hashing. For other types, serialize to string before adding/checking.

// Helper function to calculate optimal parameters
function calculateBloomParams(expectedItems, falsePositiveProb) {
    if (expectedItems <= 0 || falsePositiveProb <= 0 || falsePositiveProb >= 1) {
        throw new Error('Invalid parameters: expectedItems > 0 and 0 < falsePositiveProb < 1');
    }
    const m = Math.ceil(-(expectedItems * Math.log(falsePositiveProb)) / (Math.log(2) ** 2)); // Bit array size
    const k = Math.ceil((m / expectedItems) * Math.log(2)); // Number of hash functions
    return { m, k };
}

// Improved hash function 1 (MurmurHash3-inspired, unsigned 32-bit)
function hash1(str) {
    let hash = 0x12345678; // Seed
    for (let i = 0; i < str.length; i++) {
        hash ^= str.charCodeAt(i);
        hash = Math.imul(hash, 0x5bd1e995);
        hash = hash >>> 0; // Ensure unsigned 32-bit
        hash ^= hash >>> 15;
    }
    return hash >>> 0;
}

// Improved hash function 2 (Another Murmur variant, unsigned 32-bit)
function hash2(str) {
    let hash = 0x87654321; // Different seed
    for (let i = 0; i < str.length; i++) {
        hash ^= str.charCodeAt(i);
        hash = Math.imul(hash, 0xcc9e2d51);
        hash = hash >>> 0; // Ensure unsigned 32-bit
        hash ^= hash >>> 13;
    }
    return hash >>> 0;
}

class BloomFilter {
    constructor(expectedItems = 1000000, falsePositiveProb = 0.01) {
        const { m, k } = calculateBloomParams(expectedItems, falsePositiveProb);
        this.size = m; // Bit array size
        this.hashCount = k; // Number of hashes
        this.bitArray = new Uint8Array(Math.ceil(m / 8)); // Byte array for bits
        this.itemCount = 0; // Track items added for debugging
    }

    // Add a single item to the filter
    add(item) {
        if (typeof item !== 'string') {
            throw new Error('Item must be a string');
        }
        const h1 = hash1(item);
        const h2 = hash2(item);
        
        for (let i = 0; i < this.hashCount; i++) {
            // Fix: Ensure proper modulo operation for large numbers
            const combinedHash = (BigInt(h1) + BigInt(i) * BigInt(h2)) % BigInt(this.size);
            const index = Number(combinedHash);
            
            const byteIndex = Math.floor(index / 8);
            const bitOffset = index % 8;
            this.bitArray[byteIndex] |= (1 << bitOffset);
        }
        this.itemCount++;
    }

    // Bulk add multiple items for efficiency
    bulkAdd(items) {
        if (!Array.isArray(items)) {
            throw new Error('bulkAdd expects an array of strings');
        }
        for (const item of items) {
            this.add(item);
        }
    }

    // Check if an item might be in the filter (false positives possible)
    has(item) {
        if (typeof item !== 'string') {
            throw new Error('Item must be a string');
        }
        const h1 = hash1(item);
        const h2 = hash2(item);
        
        for (let i = 0; i < this.hashCount; i++) {
            // Fix: Use same logic as add() method
            const combinedHash = (BigInt(h1) + BigInt(i) * BigInt(h2)) % BigInt(this.size);
            const index = Number(combinedHash);
            
            const byteIndex = Math.floor(index / 8);
            const bitOffset = index % 8;
            
            if ((this.bitArray[byteIndex] & (1 << bitOffset)) === 0) {
                return false; // Definitely not present
            }
        }
        return true; // Probably present
    }

    // Get current load factor (for debugging)
    getLoadFactor() {
        let setBits = 0;
        for (let i = 0; i < this.bitArray.length; i++) {
            let byte = this.bitArray[i];
            while (byte) {
                setBits += byte & 1;
                byte >>= 1;
            }
        }
        return setBits / this.size;
    }

    // Get statistics
    getStats() {
        const loadFactor = this.getLoadFactor();
        const expectedFP = Math.pow(loadFactor, this.hashCount);
        return {
            size: this.size,
            hashCount: this.hashCount,
            itemCount: this.itemCount,
            loadFactor: loadFactor.toFixed(4),
            expectedFPRate: (expectedFP * 100).toFixed(4) + '%',
            memoryUsage: (this.bitArray.length / 1024 / 1024).toFixed(2) + ' MB'
        };
    }

    // Serialize to JSON for storage
    toJSON() {
        return {
            size: this.size,
            hashCount: this.hashCount,
            itemCount: this.itemCount,
            bitArray: Array.from(this.bitArray)
        };
    }

    // Load from JSON
    static fromJSON(data) {
        const bf = Object.create(BloomFilter.prototype);
        bf.size = data.size;
        bf.hashCount = data.hashCount;
        bf.itemCount = data.itemCount || 0;
        bf.bitArray = new Uint8Array(data.bitArray);
        return bf;
    }
}

module.exports = BloomFilter;