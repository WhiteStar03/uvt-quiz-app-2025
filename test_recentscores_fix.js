// Test for recentScores undefined fix
// Copy and paste this into browser console

console.log("🧪 TESTING RECENTSCORE UNDEFINED FIX");
console.log("=====================================");

// Step 1: Clear existing data
console.log("1️⃣ Clearing existing data...");
localStorage.clear();

// Step 2: Create mock category performance data WITHOUT recentScores
console.log("2️⃣ Creating category performance data without recentScores...");

const mockStatsWithoutRecentScores = {
    version: "2.0",
    totalTests: 5,
    totalQuestionsAnswered: 150,
    totalCorrectAnswers: 120,
    totalTimeSpent: 3600,
    testHistory: [],
    categoryPerformance: {
        'Algorithms and Data Structures': {
            totalTests: 3,
            totalQuestions: 90,
            totalCorrect: 72,
            averageScore: 80,
            bestScore: 85
            // Note: recentScores is intentionally missing
        },
        'Graph Theory': {
            totalTests: 2,
            totalQuestions: 60,
            totalCorrect: 54,
            averageScore: 90,
            bestScore: 95
            // Note: recentScores is intentionally missing
        }
    },
    weakQuestions: [],
    streakData: {
        current: 2,
        best: 3,
        lastTestDate: null
    },
    achievements: [],
    firstTestDate: null,
    lastTestDate: null
};

// Save to localStorage using new format
const compressed = LZString.compressToUTF16(JSON.stringify(mockStatsWithoutRecentScores));
localStorage.setItem('ls', compressed);

console.log("3️⃣ Mock data saved. Category performance without recentScores:");
console.log(mockStatsWithoutRecentScores.categoryPerformance);

// Step 3: Load user stats (this should trigger our defensive programming)
console.log("4️⃣ Loading user stats (this will test our fix)...");
try {
    loadUserStats();
    console.log("✅ loadUserStats() completed without errors");
} catch (error) {
    console.error("❌ Error in loadUserStats():", error);
}

// Step 4: Test the category performance display
console.log("5️⃣ Testing category performance display...");
try {
    // This function should handle missing recentScores gracefully
    updateCategoryPerformanceDisplay();
    console.log("✅ updateCategoryPerformanceDisplay() completed without errors");
} catch (error) {
    console.error("❌ Error in updateCategoryPerformanceDisplay():", error);
}

// Step 5: Test the calculateTrend function directly
console.log("6️⃣ Testing calculateTrend function directly...");
try {
    const testUndefined = calculateTrend(undefined);
    const testNull = calculateTrend(null);
    const testEmptyArray = calculateTrend([]);
    const testSingleItem = calculateTrend([80]);
    const testValidArray = calculateTrend([75, 80, 85]);
    
    console.log("✅ calculateTrend tests:");
    console.log("  undefined:", testUndefined);
    console.log("  null:", testNull);
    console.log("  empty array:", testEmptyArray);
    console.log("  single item:", testSingleItem);
    console.log("  valid array:", testValidArray);
} catch (error) {
    console.error("❌ Error in calculateTrend():", error);
}

// Step 6: Check if recentScores was added to existing categories
console.log("7️⃣ Checking if recentScores was added to existing categories...");
console.log("Current userStats.categoryPerformance:");
Object.entries(userStats.categoryPerformance).forEach(([category, stats]) => {
    console.log(`  ${category}:`, {
        hasRecentScores: 'recentScores' in stats,
        recentScoresValue: stats.recentScores,
        recentScoresType: typeof stats.recentScores
    });
});

console.log("\n🎉 RECENTSCORES FIX TEST COMPLETED");
console.log("If you see no errors above, the fix is working correctly!");
