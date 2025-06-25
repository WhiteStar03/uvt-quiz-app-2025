// Enhanced Stats Migration Test - Copy and paste this into browser console

console.log("🧪 ENHANCED STATS MIGRATION TEST");
console.log("==================================");

// Step 1: Clear existing data
console.log("1️⃣ Clearing existing data...");
localStorage.clear();

// Step 2: Create properly formatted legacy data
console.log("2️⃣ Creating mock legacy data...");

const mockLegacyData = {
    totalTests: 8,
    totalQuestionsAnswered: 240,
    totalCorrectAnswers: 180,
    totalTimeSpent: 3600,
    firstTestDate: '2024-01-15',
    lastTestDate: new Date().toISOString().split('T')[0],
    testHistory: [
        {
            id: 1,
            date: new Date().toISOString(),
            categoryName: 'Algorithms and Data Structures',
            totalQuestions: 30,
            correctAnswers: 24,
            wrongAnswers: 6,
            unansweredQuestions: 0,
            percentage: 80,
            timeSpent: 1800,
            isRandomTest: false,
            isCustomTest: false
        },
        {
            id: 2,
            date: new Date().toISOString(),
            categoryName: 'Graph Theory and Combinatorics',
            totalQuestions: 30,
            correctAnswers: 27,
            wrongAnswers: 3,
            unansweredQuestions: 0,
            percentage: 90,
            timeSpent: 1500,
            isRandomTest: false,
            isCustomTest: false
        }
    ],
    categoryPerformance: {
        'Algorithms and Data Structures': {
            totalTests: 3,
            totalQuestions: 90,
            correctAnswers: 72,
            averageScore: 80,
            bestScore: 85,
            recentScores: [80, 85, 75],
            lastTestDate: new Date().toISOString().split('T')[0]
        },
        'Graph Theory and Combinatorics': {
            totalTests: 2,
            totalQuestions: 60,
            correctAnswers: 54,
            averageScore: 90,
            bestScore: 95,
            recentScores: [90, 95],
            lastTestDate: new Date().toISOString().split('T')[0]
        }
    },
    streakData: {
        current: 3,
        best: 5,
        lastTestDate: new Date().toISOString().split('T')[0]
    },
    achievements: [
        { 
            id: 'first_test', 
            name: 'First Steps', 
            description: 'Completed your first test',
            icon: '🎯',
            date: new Date().toISOString()
        },
        { 
            id: 'streak_5', 
            name: 'Hot Streak', 
            description: 'Passed 5 tests in a row',
            icon: '🔥',
            date: new Date().toISOString()
        }
    ],
    weakQuestions: [
        {
            id: 123,
            questionText: 'What is the time complexity of binary search?',
            category: 'Algorithms and Data Structures',
            incorrectCount: 3,
            lastIncorrectDate: new Date().toISOString()
        }
    ]
};

// Store the legacy data
localStorage.setItem('uvt_quiz_stats', JSON.stringify(mockLegacyData));

console.log("✅ Legacy data created successfully!");
console.log("📊 Legacy data:", mockLegacyData);

// Step 3: Verify the data was stored
const storedData = localStorage.getItem('uvt_quiz_stats');
if (storedData) {
    console.log("✅ Legacy data verified in storage");
    console.log("📏 Data size:", storedData.length, "characters");
} else {
    console.error("❌ Failed to store legacy data!");
}

// Step 4: Trigger migration by reloading
console.log("3️⃣ Reloading page to trigger automatic migration...");
console.log("Watch the console for migration messages!");

setTimeout(() => {
    location.reload();
}, 1000);
