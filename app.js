const BloomFilter = require('./bloom-filter');
const crypto = require('crypto');

// Function to generate random strings
function generateRandomString(length = 10) {
    return crypto.randomBytes(length).toString('hex');
}

// Test parameters
const numItems = 1000000; // 1 million items to add
const numTestItems = 1000000; // 1 million items to test (half should be false positives)
const falsePositiveProb = 0.01; // 1% target FP rate

console.log(`Initializing Bloom Filter for ${numItems} items with ${falsePositiveProb * 100}% FP rate...`);
const bf = new BloomFilter(numItems, falsePositiveProb);
console.log(`Filter size: ${bf.size} bits (~${(bf.size / 8 / 1024 / 1024).toFixed(2)} MB)`);
console.log(`Hash functions: ${bf.hashCount}`);

// Generate items to add
console.log('Generating test data...');
const itemsToAdd = [];
for (let i = 0; i < numItems; i++) {
    itemsToAdd.push(generateRandomString());
}

// Measure add time (using bulkAdd for optimization)
console.log('Adding items to filter...');
let start = process.hrtime.bigint();
bf.bulkAdd(itemsToAdd);
let end = process.hrtime.bigint();
const addTime = Number(end - start) / 1e9; // seconds
console.log(`Added ${numItems} items in ${addTime.toFixed(3)} seconds (${(numItems / addTime).toFixed(0)} items/sec)`);

// Show filter statistics
console.log('\nFilter statistics:', bf.getStats());

// Test a few items that were definitely added
console.log('\nTesting items that were added:');
for (let i = 0; i < 5; i++) {
    const item = itemsToAdd[i];
    const hasItem = bf.has(item);
    console.log(`Item ${i}: "${item}" -> ${hasItem}`);
}

// Generate test items: half existing, half new
console.log('\nGenerating test items for false positive rate calculation...');
const testItems = [];
const expectedPositives = new Set();

// Add half existing items
for (let i = 0; i < numTestItems / 2; i++) {
    const item = itemsToAdd[i]; // Existing
    testItems.push(item);
    expectedPositives.add(item);
}

// Add half new items (should not be in filter)
for (let i = 0; i < numTestItems / 2; i++) {
    const newItem = generateRandomString();
    // Make sure we don't accidentally generate an item that was added
    while (expectedPositives.has(newItem)) {
        newItem = generateRandomString();
    }
    testItems.push(newItem);
}

// Shuffle test items for more realistic testing
for (let i = testItems.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [testItems[i], testItems[j]] = [testItems[j], testItems[i]];
}

// Measure has time and count false positives
console.log('Testing items and measuring false positive rate...');
let falsePositives = 0;
let truePositives = 0;
let falseNegatives = 0;
let trueNegatives = 0;

start = process.hrtime.bigint();
for (const item of testItems) {
    const result = bf.has(item);
    const shouldBePresent = expectedPositives.has(item);
    
    if (result && shouldBePresent) {
        truePositives++;
    } else if (result && !shouldBePresent) {
        falsePositives++;
    } else if (!result && shouldBePresent) {
        falseNegatives++;
    } else {
        trueNegatives++;
    }
}
end = process.hrtime.bigint();

const hasTime = Number(end - start) / 1e9; // seconds
const observedFPRate = (falsePositives / (numTestItems / 2)) * 100;

console.log(`\nResults:`);
console.log(`Checked ${numTestItems} items in ${hasTime.toFixed(3)} seconds (${(numTestItems / hasTime).toFixed(0)} checks/sec)`);
console.log(`True Positives: ${truePositives}`);
console.log(`False Positives: ${falsePositives}`);
console.log(`True Negatives: ${trueNegatives}`);
console.log(`False Negatives: ${falseNegatives} (should be 0 for a working Bloom filter)`);
console.log(`Observed false positive rate: ${observedFPRate.toFixed(2)}% (target: ${falsePositiveProb * 100}%)`);

// Serialize and deserialize test
console.log('\nTesting serialization and deserialization...');
const jsonData = bf.toJSON();
const loadedBf = BloomFilter.fromJSON(jsonData);

// Test a few items in both original and deserialized filters
console.log('Comparing original vs deserialized filter:');
for (let i = 0; i < 5; i++) {
    const item = itemsToAdd[i];
    const originalHas = bf.has(item);
    const deserializedHas = loadedBf.has(item);
    console.log(`Item ${i}: Original=${originalHas}, Deserialized=${deserializedHas}, Match=${originalHas === deserializedHas}`);
}

console.log('\nDeserialized filter statistics:', loadedBf.getStats());
console.log('Serialization test completed successfully!');