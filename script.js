// Dark Mode Functionality
function initializeDarkMode() {
    // Check for saved theme preference or default to light mode
    const savedTheme = localStorage.getItem('darkMode') || 'light';
    
    // Apply the theme
    if (savedTheme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        updateToggleIcon('☀️'); // Sun icon for dark mode (to switch to light)
    } else {
        document.documentElement.setAttribute('data-theme', 'light');
        updateToggleIcon('🌙'); // Moon icon for light mode (to switch to dark)
    }
    
    // Update SVG gradient to match theme
    setTimeout(updateSVGGradient, 100); // Small delay to ensure CSS variables are loaded
}

function toggleDarkMode() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    // Apply the new theme
    document.documentElement.setAttribute('data-theme', newTheme);
    
    // Save preference
    localStorage.setItem('darkMode', newTheme);
    
    // Update toggle icon
    updateToggleIcon(newTheme === 'dark' ? '☀️' : '🌙');
    
    // Update SVG gradient to match new theme
    setTimeout(updateSVGGradient, 100);
    
    // Add a subtle animation effect
    const toggle = document.getElementById('darkModeToggle');
    if (toggle) {
        toggle.style.transform = 'scale(0.9)';
        setTimeout(() => {
            toggle.style.transform = 'scale(1)';
        }, 150);
    }
}

function updateToggleIcon(icon) {
    const toggleIcon = document.querySelector('.toggle-icon');
    if (toggleIcon) {
        toggleIcon.textContent = icon;
    }
}

function updateSVGGradient() {
    const gradientStops = document.querySelectorAll('#gradient stop');
    if (gradientStops.length >= 2) {
        const computedStyle = getComputedStyle(document.documentElement);
        const startColor = computedStyle.getPropertyValue('--gradient-start').trim();
        const endColor = computedStyle.getPropertyValue('--gradient-end').trim();
        
        gradientStops[0].setAttribute('stop-color', startColor);
        gradientStops[1].setAttribute('stop-color', endColor);
    }
}

// Statistics Tracking System
const STATS_COOKIE_NAME = 'ls';
const STATS_VERSION = '1.0';

// Statistics data structure
let userStats = {
    version: STATS_VERSION,
    totalTests: 0,
    totalQuestionsAnswered: 0,
    totalCorrectAnswers: 0,
    totalTimeSpent: 0, // in seconds
    testHistory: [],
    categoryPerformance: {},
    weakQuestions: [],
    streakData: {
        current: 0,
        best: 0,
        lastTestDate: null
    },
    achievements: [],
    firstTestDate: null,
    lastTestDate: null
};

// Storage Management Functions (using localStorage with LZ-String compression and cookie fallback)
function saveToStorage(name, value) {
    try {
        // Try localStorage first (works better for local development)
        if (typeof(Storage) !== "undefined" && typeof(LZString) !== "undefined") {
            const compressed = LZString.compress(JSON.stringify(value));
            localStorage.setItem(name, compressed);
            console.log('User statistics saved to localStorage with compression');
            return;
        } else if (typeof(Storage) !== "undefined") {
            // Fallback to uncompressed localStorage if LZString is not available
            localStorage.setItem(name, JSON.stringify(value));
            console.log('User statistics saved to localStorage without compression');
            return;
        }
    } catch (e) {
        console.warn('localStorage not available, falling back to cookies:', e);
    }
    
    // Fallback to cookies (compressed if LZString is available)
    try {
        const expires = new Date();
        expires.setTime(expires.getTime() + (365 * 24 * 60 * 60 * 1000));
        const dataToStore = typeof(LZString) !== "undefined" 
            ? LZString.compress(JSON.stringify(value))
            : JSON.stringify(value);
        document.cookie = `${name}=${encodeURIComponent(dataToStore)};expires=${expires.toUTCString()};path=/`;
        console.log('User statistics saved to cookies with' + (typeof(LZString) !== "undefined" ? '' : 'out') + ' compression');
    } catch (e) {
        console.error('Failed to save to cookies:', e);
    }
}

function loadFromStorage(name) {
    try {
        // Try localStorage first
        if (typeof(Storage) !== "undefined") {
            const item = localStorage.getItem(name);
            if (item) {
                // Try to decompress first, fallback to regular JSON.parse
                try {
                    if (typeof(LZString) !== "undefined") {
                        const decompressed = LZString.decompress(item);
                        if (decompressed) {
                            return JSON.parse(decompressed);
                        }
                    }
                    // Fallback to uncompressed data
                    return JSON.parse(item);
                } catch (e) {
                    console.warn('Failed to decompress/parse localStorage data, trying uncompressed:', e);
                    return JSON.parse(item);
                }
            }
        }
    } catch (e) {
        console.warn('localStorage not available or corrupted, trying cookies:', e);
    }
    
    // Fallback to cookies
    try {
        const nameEQ = name + "=";
        const ca = document.cookie.split(';');
        for (let i = 0; i < ca.length; i++) {
            let c = ca[i];
            while (c.charAt(0) === ' ') {
                c = c.substring(1, c.length);
            }
            if (c.indexOf(nameEQ) === 0) {
                const cookieData = decodeURIComponent(c.substring(nameEQ.length, c.length));
                // Try to decompress first, fallback to regular JSON.parse
                try {
                    if (typeof(LZString) !== "undefined") {
                        const decompressed = LZString.decompress(cookieData);
                        if (decompressed) {
                            return JSON.parse(decompressed);
                        }
                    }
                    // Fallback to uncompressed data
                    return JSON.parse(cookieData);
                } catch (e) {
                    console.warn('Failed to decompress/parse cookie data, trying uncompressed:', e);
                    return JSON.parse(cookieData);
                }
            }
        }
    } catch (e) {
        console.error("Error parsing cookie:", name, e);
    }
    return null;
}

function loadUserStats() {
    console.log('=== Loading User Statistics ===');
    
    // First try to load from new compressed storage
    const savedStats = loadFromStorage(STATS_COOKIE_NAME);
    let currentData = null;
    
    if (savedStats && savedStats.version === STATS_VERSION) {
        currentData = savedStats;
        console.log('Found data in new storage format');
        console.log('Current data:', currentData);
    }
    
    // Always check for legacy data to compare with current data
    console.log('Checking for legacy data to compare...');
    
    // Try multiple possible legacy keys and patterns
    const legacyKeys = [
        'uvt_quiz_stats', 
        'uvt_quiz_stats_old', 
        'quiz_stats', 
        'userStats',
        'quizStats'
    ];
    
    let legacyStats = null;
    let usedLegacyKey = null;
    
    // Check localStorage directly for legacy keys
    for (const key of legacyKeys) {
        legacyStats = loadFromStorage(key);
        if (legacyStats) {
            usedLegacyKey = key;
            console.log(`Found legacy statistics in key '${key}'`);
            console.log('Legacy data structure:', legacyStats);
            break;
        }
    }
    
    // If still no legacy data found, try a more aggressive search
    if (!legacyStats) {
        console.log('No standard legacy keys found, performing comprehensive search...');
        const searchResult = performComprehensiveLegacySearch();
        if (searchResult && searchResult.key) {
            usedLegacyKey = searchResult.key;
            legacyStats = searchResult.data;
            console.log(`Found legacy data in unexpected key '${usedLegacyKey}'`);
        }
    }
    
    // Compare current data vs legacy data and use the more complete one
    let finalData = null;
    let shouldMigrate = false;
    
    if (currentData && legacyStats) {
        // Both exist - compare to see which is more complete
        const currentTests = currentData.totalTests || 0;
        const legacyTests = legacyStats.totalTests || 0;
        
        console.log(`Comparing datasets: current (${currentTests} tests) vs legacy (${legacyTests} tests)`);
        
        if (legacyTests > currentTests) {
            console.log('Legacy data appears more complete, will migrate it');
            finalData = legacyStats;
            shouldMigrate = true;
        } else {
            console.log('Current data is more complete, keeping it');
            finalData = currentData;
        }
    } else if (legacyStats) {
        // Only legacy data exists
        console.log('Only legacy data found, will migrate it');
        finalData = legacyStats;
        shouldMigrate = true;
    } else if (currentData) {
        // Only current data exists
        console.log('Only current data found, using it');
        finalData = currentData;
    } else {
        // No data found anywhere
        console.log('No data found anywhere, starting with fresh data');
        finalData = null;
    }
    
    if (shouldMigrate && legacyStats) {
        // Migrate legacy data structure to new format
        console.log('Starting migration process...');
        const migratedStats = migrateLegacyStats(legacyStats);
        
        if (migratedStats && Object.keys(migratedStats).length > 0) {
            userStats = { ...userStats, ...migratedStats };
            
            // Save migrated data in new format
            saveUserStats();
            
            // Remove old data to save space and prevent confusion
            cleanupLegacyData(usedLegacyKey);
            
            console.log('✅ Legacy data migration completed successfully');
            console.log('Final migrated stats:', userStats);
            
            // Update dashboard immediately after migration
            setTimeout(() => {
                if (typeof updateDashboardStats === 'function') {
                    updateDashboardStats();
                }
            }, 100);
        } else {
            console.warn('Migration produced empty result, using current data or defaults');
            if (currentData) {
                userStats = { ...userStats, ...currentData };
            }
            saveUserStats();
        }
    } else if (finalData) {
        // Use existing data (no migration needed)
        userStats = { ...userStats, ...finalData };
        console.log('✅ User statistics loaded successfully');
        console.log('Final stats:', userStats);
        
        // Clean up any legacy data since we have good current data
        if (usedLegacyKey) {
            cleanupLegacyData(usedLegacyKey);
        } else {
            cleanupLegacyData(); // General cleanup
        }
    } else {
        // No data found anywhere, start fresh
        console.log('No statistics found anywhere, starting with fresh data');
        saveUserStats();
    }
}

function migrateLegacyStats(legacyStats) {
    console.log('🔄 Starting migration process...');
    console.log('Legacy stats input:', legacyStats);
    
    // Handle case where legacyStats might be null, undefined, or not an object
    if (!legacyStats || typeof legacyStats !== 'object') {
        console.warn('❌ Legacy stats is not a valid object, returning empty stats');
        return {};
    }
    
    // Create base migrated structure with current version
    const migrated = {
        version: STATS_VERSION,
        totalTests: 0,
        totalQuestionsAnswered: 0,
        totalCorrectAnswers: 0,
        totalTimeSpent: 0,
        testHistory: [],
        categoryPerformance: {},
        weakQuestions: [],
        streakData: {
            current: 0,
            best: 0,
            lastTestDate: null
        },
        achievements: [],
        firstTestDate: null,
        lastTestDate: null
    };
    
    // Track what we successfully migrate
    const migrationLog = [];
    
    // Migrate basic numeric fields with validation
    const numericFields = [
        'totalTests', 'totalQuestionsAnswered', 'totalCorrectAnswers', 'totalTimeSpent'
    ];
    
    numericFields.forEach(field => {
        if (typeof legacyStats[field] === 'number' && !isNaN(legacyStats[field])) {
            migrated[field] = Math.max(0, Math.floor(legacyStats[field])); // Ensure positive integers
            migrationLog.push(`✅ ${field}: ${migrated[field]}`);
        }
    });
    
    // Migrate date fields
    const dateFields = ['firstTestDate', 'lastTestDate'];
    dateFields.forEach(field => {
        if (typeof legacyStats[field] === 'string' && legacyStats[field]) {
            // Validate date format
            const date = new Date(legacyStats[field]);
            if (!isNaN(date.getTime())) {
                migrated[field] = legacyStats[field];
                migrationLog.push(`✅ ${field}: ${migrated[field]}`);
            }
        }
    });
    
    // Migrate test history with validation and cleanup
    if (Array.isArray(legacyStats.testHistory)) {
        migrated.testHistory = legacyStats.testHistory
            .filter(test => test && typeof test === 'object' && test.date) // Valid test objects
            .slice(-50) // Keep only last 50 tests
            .map(test => {
                // Ensure required fields exist
                return {
                    id: test.id || Date.now() + Math.random(),
                    date: test.date,
                    categoryName: test.categoryName || 'Unknown',
                    isRandomTest: Boolean(test.isRandomTest),
                    isCustomTest: Boolean(test.isCustomTest),
                    totalQuestions: Math.max(0, parseInt(test.totalQuestions) || 0),
                    correctAnswers: Math.max(0, parseInt(test.correctAnswers) || 0),
                    wrongAnswers: Math.max(0, parseInt(test.wrongAnswers) || 0),
                    unansweredQuestions: Math.max(0, parseInt(test.unansweredQuestions) || 0),
                    timeSpent: Math.max(0, parseInt(test.timeSpent) || 0),
                    percentage: Math.max(0, Math.min(100, parseFloat(test.percentage) || 0)),
                    questions: Array.isArray(test.questions) ? test.questions : [],
                    weakQuestions: Array.isArray(test.weakQuestions) ? test.weakQuestions : []
                };
            });
        migrationLog.push(`✅ testHistory: ${migrated.testHistory.length} records`);
    }
    
    // Migrate category performance
    if (legacyStats.categoryPerformance && typeof legacyStats.categoryPerformance === 'object') {
        const cleanedPerformance = {};
        Object.keys(legacyStats.categoryPerformance).forEach(category => {
            const perf = legacyStats.categoryPerformance[category];
            if (perf && typeof perf === 'object') {
                cleanedPerformance[category] = {
                    totalTests: Math.max(0, parseInt(perf.totalTests) || 0),
                    totalQuestions: Math.max(0, parseInt(perf.totalQuestions) || 0),
                    totalCorrect: Math.max(0, parseInt(perf.correctAnswers || perf.totalCorrect) || 0),
                    correctAnswers: Math.max(0, parseInt(perf.correctAnswers) || 0),
                    averageScore: Math.max(0, Math.min(100, parseFloat(perf.averageScore) || 0)),
                    bestScore: Math.max(0, Math.min(100, parseFloat(perf.bestScore) || 0)),
                    recentScores: Array.isArray(perf.recentScores) ? perf.recentScores.slice(0, 10) : [],
                    weakTopics: Array.isArray(perf.weakTopics) ? perf.weakTopics : [],
                    lastTestDate: perf.lastTestDate || null
                };
            }
        });
        migrated.categoryPerformance = cleanedPerformance;
        migrationLog.push(`✅ categoryPerformance: ${Object.keys(cleanedPerformance).length} categories`);
    }
    
    // Migrate weak questions
    if (Array.isArray(legacyStats.weakQuestions)) {
        migrated.weakQuestions = legacyStats.weakQuestions
            .filter(q => q && typeof q === 'object' && q.question) // Valid question objects
            .slice(0, 100) // Keep only top 100
            .map(q => ({
                question: q.question,
                category: q.category || 'Unknown',
                wrongCount: Math.max(0, parseInt(q.wrongCount) || 0),
                lastWrongDate: q.lastWrongDate || null
            }));
        migrationLog.push(`✅ weakQuestions: ${migrated.weakQuestions.length} records`);
    }
    
    // Migrate achievements
    if (Array.isArray(legacyStats.achievements)) {
        migrated.achievements = legacyStats.achievements
            .filter(a => a && (typeof a === 'string' || (typeof a === 'object' && a.name)))
            .slice(0, 50); // Reasonable limit
        migrationLog.push(`✅ achievements: ${migrated.achievements.length} records`);
    }
    
    // Migrate streak data
    if (legacyStats.streakData && typeof legacyStats.streakData === 'object') {
        migrated.streakData = {
            current: Math.max(0, parseInt(legacyStats.streakData.current) || 0),
            best: Math.max(0, parseInt(legacyStats.streakData.best) || 0),
            lastTestDate: legacyStats.streakData.lastTestDate || null
        };
        migrationLog.push(`✅ streakData: current ${migrated.streakData.current}, best ${migrated.streakData.best}`);
    }
    
    console.log('📋 Migration Summary:');
    migrationLog.forEach(log => console.log('  ' + log));
    console.log('✅ Migration completed successfully');
    console.log('Final migrated data:', migrated);
    
    return migrated;
}

// Helper function to perform comprehensive search for legacy data
function performComprehensiveLegacySearch() {
    console.log('🔍 Performing comprehensive legacy data search...');
    
    if (typeof(Storage) === "undefined") {
        console.log('localStorage not available');
        return null;
    }
    
    // Check all localStorage keys for potential quiz data
    const allKeys = Object.keys(localStorage);
    console.log('All localStorage keys:', allKeys);
    
    for (const key of allKeys) {
        try {
            // Skip keys we know are not relevant
            if (key === 'ls' || key === 'darkMode' || key.startsWith('_')) {
                continue;
            }
            
            const rawData = localStorage.getItem(key);
            if (!rawData) continue;
            
            // Try to parse the data
            let parsedData;
            try {
                // Try decompression first if LZ-String is available
                if (typeof LZString !== 'undefined') {
                    const decompressed = LZString.decompress(rawData);
                    parsedData = JSON.parse(decompressed || rawData);
                } else {
                    parsedData = JSON.parse(rawData);
                }
            } catch (e) {
                // If decompression fails, try direct parsing
                parsedData = JSON.parse(rawData);
            }
            
            // Check if this looks like quiz statistics data
            if (isLikelyQuizData(parsedData)) {
                console.log(`🎯 Found potential quiz data in key '${key}'`);
                return { key: key, data: parsedData };
            }
            
        } catch (e) {
            // Skip invalid JSON or other errors
            continue;
        }
    }
    
    console.log('❌ No potential quiz data found in comprehensive search');
    return null;
}

// Helper function to identify if data looks like quiz statistics
function isLikelyQuizData(data) {
    if (!data || typeof data !== 'object') return false;
    
    // Check for typical quiz data patterns
    const quizDataIndicators = [
        'totalTests',
        'totalQuestionsAnswered', 
        'totalCorrectAnswers',
        'testHistory',
        'categoryPerformance',
        'weakQuestions',
        'streakData'
    ];
    
    let indicatorCount = 0;
    quizDataIndicators.forEach(indicator => {
        if (data.hasOwnProperty(indicator)) {
            indicatorCount++;
        }
    });
    
    // If we find at least 3 indicators, it's likely quiz data
    return indicatorCount >= 3;
}

// Helper function to clean up legacy data
function cleanupLegacyData(specificKey = null) {
    console.log('🧹 Cleaning up legacy data...');
    
    if (typeof(Storage) === "undefined") {
        console.log('localStorage not available');
        return;
    }
    
    const legacyKeys = [
        'uvt_quiz_stats', 
        'uvt_quiz_stats_old', 
        'quiz_stats', 
        'userStats',
        'quizStats'
    ];
    
    // If a specific key was provided, add it to the cleanup list
    if (specificKey && !legacyKeys.includes(specificKey)) {
        legacyKeys.push(specificKey);
    }
    
    let cleanedCount = 0;
    legacyKeys.forEach(key => {
        try {
            if (localStorage.getItem(key)) {
                localStorage.removeItem(key);
                console.log(`🗑️  Removed legacy data from key '${key}'`);
                cleanedCount++;
            }
        } catch (e) {
            console.warn(`Failed to remove legacy key '${key}':`, e);
        }
    });
    
    if (cleanedCount > 0) {
        console.log(`✅ Cleaned up ${cleanedCount} legacy storage entries`);
    } else {
        console.log('No legacy data found to clean up');
    }
}

function saveUserStats() {
    saveToStorage(STATS_COOKIE_NAME, userStats);
    console.log('Current stats being saved:', userStats);
}

// Statistics Tracking Functions
function recordTestResult(testData) {
    const testRecord = {
        id: Date.now(),
        date: new Date().toISOString(),
        categoryName: testData.categoryName,
        isRandomTest: testData.isRandomTest,
        isCustomTest: testData.isCustomTest,
        totalQuestions: testData.totalQuestions,
        correctAnswers: testData.correctAnswers,
        wrongAnswers: testData.wrongAnswers,
        unansweredQuestions: testData.unansweredQuestions,
        timeSpent: testData.timeSpent,
        percentage: testData.percentage,
        questions: testData.questions, // Store question details for analysis
        weakQuestions: testData.weakQuestions
    };

    // Update basic stats
    userStats.totalTests++;
    userStats.totalQuestionsAnswered += testData.totalQuestions;
    userStats.totalCorrectAnswers += testData.correctAnswers;
    userStats.totalTimeSpent += testData.timeSpent;
    
    // Update dates
    const testDate = new Date().toDateString();
    if (!userStats.firstTestDate) {
        userStats.firstTestDate = testDate;
    }
    userStats.lastTestDate = testDate;

    // Update streak
    updateStreak(testData.percentage);

    // Update category performance
    updateCategoryPerformance(testData);

    // Update weak questions
    updateWeakQuestions(testData.weakQuestions);

    // Add to test history (keep last 50 tests)
    userStats.testHistory.unshift(testRecord);
    if (userStats.testHistory.length > 50) {
        userStats.testHistory = userStats.testHistory.slice(0, 50);
    }

    // Check for achievements
    checkAchievements(testData);

    saveUserStats();
}

function updateStreak(percentage) {
    const today = new Date().toDateString();
    const passingGrade = 70;
    
    if (percentage >= passingGrade) {
        if (userStats.streakData.lastTestDate === today) {
            // Same day, don't increment streak
        } else {
            userStats.streakData.current++;
            if (userStats.streakData.current > userStats.streakData.best) {
                userStats.streakData.best = userStats.streakData.current;
            }
        }
    } else {
        userStats.streakData.current = 0;
    }
    
    userStats.streakData.lastTestDate = today;
}

function updateCategoryPerformance(testData) {
    const categoryName = testData.categoryName;
    
    if (!userStats.categoryPerformance[categoryName]) {
        userStats.categoryPerformance[categoryName] = {
            totalTests: 0,
            totalQuestions: 0,
            totalCorrect: 0,
            averageScore: 0,
            bestScore: 0,
            recentScores: [],
            weakTopics: []
        };
    }

    const categoryStats = userStats.categoryPerformance[categoryName];
    
    // Ensure backwards compatibility - add recentScores if it doesn't exist
    if (!categoryStats.recentScores) {
        categoryStats.recentScores = [];
    }
    
    categoryStats.totalTests++;
    categoryStats.totalQuestions += testData.totalQuestions;
    categoryStats.totalCorrect += testData.correctAnswers;
    categoryStats.averageScore = Math.round((categoryStats.totalCorrect / categoryStats.totalQuestions) * 100);
    
    if (testData.percentage > categoryStats.bestScore) {
        categoryStats.bestScore = testData.percentage;
    }

    // Keep recent scores for trend analysis
    categoryStats.recentScores.unshift(testData.percentage);
    if (categoryStats.recentScores.length > 10) {
        categoryStats.recentScores = categoryStats.recentScores.slice(0, 10);
    }
}

function updateWeakQuestions(weakQuestions) {
    weakQuestions.forEach(question => {
        const existingIndex = userStats.weakQuestions.findIndex(w => w.id === question.question_id);
        
        // Determine the correct category name with better fallback logic
        let categoryName = 'Unknown Category';
        
        // First try to get the original category name from the question
        if (question.subtopic_name_origin) {
            categoryName = question.subtopic_name_origin;
        } else if (question.subtopic_name) {
            categoryName = question.subtopic_name;
        } else if (question.parent_topic_name_origin) {
            categoryName = question.parent_topic_name_origin;
        } else if (currentCategory) {
            // For regular category tests, use the current category
            if (currentCategory.subtopic_name && !isRandomTestActive) {
                categoryName = currentCategory.subtopic_name;
            } else if (currentCategory.name && !isRandomTestActive) {
                categoryName = currentCategory.name;
            } else {
                // For random/custom tests, try to find the category from the displayableCategories
                const foundCategory = displayableCategories.find(cat => 
                    cat.questions.some(q => q.question_id === question.question_id)
                );
                if (foundCategory) {
                    categoryName = foundCategory.subtopic_name;
                }
            }
        }
        
        if (existingIndex >= 0) {
            userStats.weakQuestions[existingIndex].incorrectCount++;
            userStats.weakQuestions[existingIndex].lastIncorrectDate = new Date().toISOString();
            // Always update category to ensure it's current
            userStats.weakQuestions[existingIndex].category = categoryName;
        } else {
            userStats.weakQuestions.push({
                id: question.question_id,
                questionText: question.question_text,
                category: categoryName,
                incorrectCount: 1,
                firstIncorrectDate: new Date().toISOString(),
                lastIncorrectDate: new Date().toISOString()
            });
        }
    });

    // Sort by incorrect count and keep top 100 weak questions
    userStats.weakQuestions.sort((a, b) => b.incorrectCount - a.incorrectCount);
    if (userStats.weakQuestions.length > 100) {
        userStats.weakQuestions = userStats.weakQuestions.slice(0, 100);
    }
}

function checkAchievements(testData) {
    const achievements = [];
    
    // First test achievement
    if (userStats.totalTests === 1) {
        achievements.push({
            id: 'first_test',
            name: 'First Steps',
            description: 'Completed your first test',
            date: new Date().toISOString(),
            icon: '🎯'
        });
    }

    // Perfect score achievement
    if (testData.percentage === 100) {
        achievements.push({
            id: 'perfect_score',
            name: 'Perfect Score',
            description: 'Achieved 100% on a test',
            date: new Date().toISOString(),
            icon: '🏆'
        });
    }

    // Streak achievements
    if (userStats.streakData.current === 5) {
        achievements.push({
            id: 'streak_5',
            name: 'Hot Streak',
            description: 'Passed 5 tests in a row',
            date: new Date().toISOString(),
            icon: '🔥'
        });
    }

    // Test count milestones
    const milestones = [10, 25, 50, 100];
    milestones.forEach(milestone => {
        if (userStats.totalTests === milestone) {
            achievements.push({
                id: `tests_${milestone}`,
                name: `${milestone} Tests`,
                description: `Completed ${milestone} tests`,
                date: new Date().toISOString(),
                icon: milestone >= 50 ? '🌟' : '📚'
            });
        }
    });

    // Add new achievements
    achievements.forEach(achievement => {
        if (!userStats.achievements.find(a => a.id === achievement.id)) {
            userStats.achievements.push(achievement);
        }
    });
}

let fullQuestionsData = null;
let displayableCategories = [];
let allQuestionsFlat = []; // For random test generation
let currentCategory = null;
let currentQuestionIndex = 0;
let userAnswers = {};
let testStartTime = null;
let isFeedbackMode = false;
let currentTestInstanceId = null; // Unique identifier for each test instance

// Quiz navigation variables
let currentQuestions = [];
let totalQuestions = 0;
let questionSlider = null;

let isRandomTestActive = false;
let testTimerInterval = null;
let testTimeRemaining = 0; // in seconds
const RANDOM_TEST_DURATION = 90 * 60; // 30 minutes for random test (corrected from 90)
const RANDOM_TEST_QUESTION_COUNT = 30;

// Category name mapping for image files
function getCategoryNameForImage(categoryName) {
    const nameMap = {
        'Algorithms and Data Structures': 'AlgorithmsandDataStructures',
        'Graph Theory and Combinatorics': 'GraphTheoryandCombinatorics',
        'Computational Logic': 'ComputationalLogic',
        'Formal Languages and Automata Theory': 'FormalLanguagesandAutomataTheory',
        'Python Language': 'PythonLanguage',
        'C Language': 'CLanguage',
        'C++ Language': 'CPPLanguage',
        'Java Language': 'JavaLanguage',
        'Databases': 'Databases',
        'Software Applications Design': 'SoftwareApplicationsDesign',
        'Computer Architecture': 'ComputerArchitecture',
        'Operating Systems': 'OperatingSystems',
        'Computer Networks': 'ComputerNetworks'
    };
    
    return nameMap[categoryName] || categoryName.replace(/\s+/g, '').replace(/[^a-zA-Z0-9]/g, '');
}

// Generate unique key for user answers that includes test instance
function generateUniqueAnswerKey(question) {
    // Use original category info if available (for random/custom tests), otherwise use current category
    const categoryKey = question.subtopic_name_origin || currentCategory.subtopic_name;
    return `${currentTestInstanceId}_${categoryKey}_${question.question_id}`;
}

async function loadTestData() {
   document.getElementById('dashboardLoading').style.display = 'block';
   
   // Load user statistics
   loadUserStats();
   
   try {
     const res = await fetch('questions.json');
     if (!res.ok) {
         const errorMsg = `Failed to fetch questions.json: HTTP ${res.status} ${res.statusText}`;
         console.error(errorMsg);
         document.getElementById('categoryGrid').innerHTML = `<div class="error">${errorMsg}. Ensure questions.json is accessible.</div>`;
         document.getElementById('dashboardScreen').innerHTML = `<div class="error">${errorMsg}. Check console.</div>`;
         return;
     }
     fullQuestionsData = await res.json();

     if (!fullQuestionsData || typeof fullQuestionsData.exam !== 'object' || !Array.isArray(fullQuestionsData.exam.topics)) {
        const errorMsg = 'Loaded questions data is not in the expected format (exam.topics is missing or not an array).';
        console.error(errorMsg, fullQuestionsData);
        document.getElementById('categoryGrid').innerHTML = `<div class="error">${errorMsg} Check console.</div>`;
        document.getElementById('dashboardScreen').innerHTML = `<div class="error">${errorMsg}. Check console.</div>`;
        return;
     }

     displayableCategories = [];
     allQuestionsFlat = [];
     fullQuestionsData.exam.topics.forEach(topic => {
         if (topic.subtopics && Array.isArray(topic.subtopics)) {
             topic.subtopics.forEach(subtopic => {
                 if (subtopic && typeof subtopic.subtopic_name === 'string' && Array.isArray(subtopic.questions) && subtopic.questions.length > 0) {
                     displayableCategories.push({
                         ...subtopic,
                         parent_topic_name: topic.topic_name
                     });
                     subtopic.questions.forEach(q => allQuestionsFlat.push({...q, subtopic_name_origin: subtopic.subtopic_name, parent_topic_name_origin: topic.topic_name}));
                 } else {
                     // console.warn('Skipping malformed or empty subtopic:', subtopic, 'under topic:', topic.topic_name);
                 }
             });
         }
     });

     if (displayableCategories.length === 0) {
        document.getElementById('categoryGrid').innerHTML = '<div class="loading">No test subtopics found.</div>';
     } else {
        displayCategories(displayableCategories);
     }
     updateDashboardStats();
     showDashboard(); // Show dashboard after data is loaded

   } catch (err) {
     console.error('Error loading or processing questions.json:', err);
     const commonErrorMsg = `<div class="error">Failed to load test data: ${err.message}. Check console.</div>`;
     document.getElementById('categoryGrid').innerHTML = commonErrorMsg;
     document.getElementById('dashboardScreen').innerHTML = commonErrorMsg; // Also show error on dashboard
   } finally {
       document.getElementById('dashboardLoading').style.display = 'none';
   }
 }

function updateDashboardStats() {
    document.getElementById('totalQuestionsStat').textContent = allQuestionsFlat.length;
    document.getElementById('totalCategoriesStat').textContent = displayableCategories.length;
    document.getElementById('testsCompletedStat').textContent = userStats.totalTests;
    
    const avgScore = userStats.totalQuestionsAnswered > 0 
        ? Math.round((userStats.totalCorrectAnswers / userStats.totalQuestionsAnswered) * 100)
        : 0;
    document.getElementById('averageScoreStat').textContent = `${avgScore}%`;
}

function showDashboard() {
    document.getElementById('dashboardScreen').style.display = 'block';
    document.getElementById('categoryScreen').style.display = 'none';
    document.getElementById('customTestScreen').style.display = 'none';
    document.getElementById('testScreen').style.display = 'none';
    document.getElementById('resultsScreen').style.display = 'none';
    document.getElementById('statisticsScreen').style.display = 'none';
    stopTimer(); // Ensure timer is stopped if returning to dashboard
}

function showCategorySelectionScreen() {
    scrollToTop();
    document.getElementById('dashboardScreen').style.display = 'none';
    document.getElementById('statisticsScreen').style.display = 'none';
    document.getElementById('categoryScreen').style.display = 'block';
    document.getElementById('customTestScreen').style.display = 'none';
    document.getElementById('testScreen').style.display = 'none';
    document.getElementById('resultsScreen').style.display = 'none';
    
    // Display categories if data is loaded
    if (displayableCategories && displayableCategories.length > 0) {
        displayCategories(displayableCategories);
    }
}

function showCustomTestSelection() {
    scrollToTop();
    document.getElementById('dashboardScreen').style.display = 'none';
    document.getElementById('statisticsScreen').style.display = 'none';
    document.getElementById('categoryScreen').style.display = 'none';
    document.getElementById('customTestScreen').style.display = 'block';
    document.getElementById('testScreen').style.display = 'none';
    document.getElementById('resultsScreen').style.display = 'none';
    displayCustomTestCategories();
}

function displayCategories(subtopicsToDisplay) {
    const grid = document.getElementById('categoryGrid');
    grid.innerHTML = '';

    if (!subtopicsToDisplay || subtopicsToDisplay.length === 0) {
        grid.innerHTML = '<div class="loading">No subtopics with questions available.</div>';
        return;
    }

    subtopicsToDisplay.forEach((subtopic, index) => {
        const card = document.createElement('div');
        card.className = 'category-card';
        card.onclick = () => startTest(index); // Pass index for regular category test

        const questionCount = subtopic.questions.length;
        
        // Get performance stats for this category
        const categoryStats = userStats.categoryPerformance[subtopic.subtopic_name];
        let statsHtml = '';
        
        if (categoryStats && categoryStats.totalTests > 0) {
            // Calculate median score from recent scores with safety check
            const recentScores = categoryStats.recentScores || [];
            const scores = [...recentScores].sort((a, b) => a - b);
            const medianScore = scores.length > 0 ? 
                (scores.length % 2 === 0 ? 
                    Math.round((scores[Math.floor(scores.length / 2) - 1] + scores[Math.floor(scores.length / 2)]) / 2) :
                    scores[Math.floor(scores.length / 2)]) : 
                (categoryStats.averageScore || 0);
            
            const scoreClass = medianScore >= 80 ? 'excellent' : medianScore >= 60 ? 'good' : 'needs-improvement';
            statsHtml = `
                <div class="category-stats-tracker">
                    <div class="stat-row">
                        <span class="stat-pill attempts">${categoryStats.totalTests}</span>
                        <span class="stat-pill score ${scoreClass}">${medianScore}%</span>
                    </div>
                </div>
            `;
        } else {
            statsHtml = `
                <div class="category-stats-tracker">
                    <div class="stat-row no-attempts">
                        <span>Not attempted</span>
                    </div>
                </div>
            `;
        }

        card.innerHTML = `
        <h3>${subtopic.subtopic_name}</h3>
        ${subtopic.parent_topic_name ? `<p style="font-size:0.8em; color:var(--text-muted); margin-top: 5px;"><em>Topic: ${subtopic.parent_topic_name}</em></p>` : ''}
        <p style="margin-top: 10px;">${questionCount} question${questionCount !== 1 ? 's' : ''}</p>
        ${statsHtml}
        `;
        grid.appendChild(card);
    });
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function generateRandomTest() {
    scrollToTop();
    if (allQuestionsFlat.length === 0) {
        alert("No questions available to generate a random test.");
        return;
    }
    const shuffledQuestions = shuffleArray([...allQuestionsFlat]);
    const selectedQuestions = shuffledQuestions.slice(0, Math.min(RANDOM_TEST_QUESTION_COUNT, shuffledQuestions.length));

    if (selectedQuestions.length === 0) {
        alert("Not enough questions to generate a random test.");
        return;
    }
    
    isRandomTestActive = true;
    currentCategory = { // Create a temporary "category" for this random test
        subtopic_name: "Random Test",
        questions: selectedQuestions,
        name: "Randomly Generated Test" // For display
    };
    startTest(null); // Pass null index, as currentCategory is already set
    startTimer(RANDOM_TEST_DURATION);
}

// Custom Test Selection Variables
let selectedCustomCategories = [];

function displayCustomTestCategories() {
    const container = document.getElementById('customTestCategories');
    container.innerHTML = '';

    if (!displayableCategories || displayableCategories.length === 0) {
        container.innerHTML = '<div class="loading">No categories available.</div>';
        return;
    }

    displayableCategories.forEach((category, index) => {
        const card = document.createElement('div');
        card.className = 'custom-category-card';
        card.dataset.categoryIndex = index;

        const questionCount = category.questions.length;
        card.innerHTML = `
            <div class="check-mark">✓</div>
            <h3>${category.subtopic_name}</h3>
            ${category.parent_topic_name ? `<p style="font-size:0.8em; color:var(--text-muted); margin-top: 5px;"><em>Topic: ${category.parent_topic_name}</em></p>` : ''}
            <p style="margin-top: 10px;">${questionCount} question${questionCount !== 1 ? 's' : ''}</p>
        `;

        card.onclick = () => toggleCategorySelection(index, card);
        container.appendChild(card);
    });

    updateCustomTestInfo();
}

function toggleCategorySelection(categoryIndex, cardElement) {
    const index = selectedCustomCategories.indexOf(categoryIndex);
    
    if (index > -1) {
        // Remove from selection
        selectedCustomCategories.splice(index, 1);
        cardElement.classList.remove('selected');
    } else {
        // Add to selection
        selectedCustomCategories.push(categoryIndex);
        cardElement.classList.add('selected');
    }
    
    updateCustomTestInfo();
}

function updateCustomTestInfo() {
    const selectedCount = selectedCustomCategories.length;
    let totalQuestions = 0;
    
    selectedCustomCategories.forEach(categoryIndex => {
        totalQuestions += displayableCategories[categoryIndex].questions.length;
    });
    
    document.getElementById('selectedCount').textContent = selectedCount;
    document.getElementById('selectedQuestionCount').textContent = totalQuestions;
    
    const generateBtn = document.getElementById('generateCustomTestBtn');
    if (selectedCount > 0 && totalQuestions >= 30) {
        generateBtn.disabled = false;
        generateBtn.textContent = `Generate Custom Test (30 questions)`;
    } else if (selectedCount > 0 && totalQuestions < 30) {
        generateBtn.disabled = true;
        generateBtn.textContent = `Need at least 30 questions (${totalQuestions} available)`;
    } else {
        generateBtn.disabled = true;
        generateBtn.textContent = `Generate Custom Test (30 questions)`;
    }
}

function generateCustomTest() {
    if (selectedCustomCategories.length === 0) {
        alert("Please select at least one category.");
        return;
    }
    
    // Collect all questions from selected categories
    let allSelectedQuestions = [];
    selectedCustomCategories.forEach(categoryIndex => {
        const category = displayableCategories[categoryIndex];
        category.questions.forEach(question => {
            allSelectedQuestions.push({
                ...question,
                subtopic_name_origin: category.subtopic_name,
                parent_topic_name_origin: category.parent_topic_name
            });
        });
    });
    
    if (allSelectedQuestions.length < 30) {
        alert(`Not enough questions available. Selected categories have ${allSelectedQuestions.length} questions, but 30 are needed.`);
        return;
    }
    
    // Shuffle and select 30 questions
    const shuffledQuestions = shuffleArray([...allSelectedQuestions]);
    const selectedQuestions = shuffledQuestions.slice(0, 30);
    
    // Create custom test category
    isRandomTestActive = true;
    const selectedCategoryNames = selectedCustomCategories.map(index => 
        displayableCategories[index].subtopic_name
    ).join(', ');
    
    currentCategory = {
        subtopic_name: "Custom Test",
        questions: selectedQuestions,
        name: `Custom Test (${selectedCategoryNames})`
    };
    
    // Reset selections for next time
    selectedCustomCategories = [];
    
    // Hide custom test window before starting the test
    document.getElementById('customTestScreen').style.display = 'none';
    
    startTest(null);
    startTimer(RANDOM_TEST_DURATION);
}

function startTimer(durationInSeconds) {
    stopTimer(); // Clear any existing timer
    testTimeRemaining = durationInSeconds;
    document.getElementById('timerDisplay').style.display = 'block';
    updateTimerDisplay();

    testTimerInterval = setInterval(() => {
        testTimeRemaining--;
        updateTimerDisplay();
        if (testTimeRemaining <= 0) {
            stopTimer();
            alert("Time's up! The test will be submitted automatically.");
            finishTest();
        }
    }, 1000);
}

function stopTimer() {
    clearInterval(testTimerInterval);
    testTimerInterval = null;
    document.getElementById('timerDisplay').style.display = 'none';
}

function updateTimerDisplay() {
    const minutes = Math.floor(testTimeRemaining / 60);
    const seconds = testTimeRemaining % 60;
    document.getElementById('timerDisplay').textContent = 
        `Time: ${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
}

function startTest(subtopicIndexOrNull) {
    if (subtopicIndexOrNull !== null) { // Regular category test
        currentCategory = displayableCategories[subtopicIndexOrNull];
        isRandomTestActive = false;
         document.getElementById('timerDisplay').style.display = 'none';
    }
    // If subtopicIndexOrNull is null, currentCategory is assumed to be set by generateRandomTest()
    
    if (!currentCategory || !currentCategory.questions || currentCategory.questions.length === 0) {
        alert("This category/test has no questions or is invalid. Please select another.");
        return;
    }
    
    // Generate unique test instance ID
    currentTestInstanceId = `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Set up quiz navigation variables
    currentQuestions = currentCategory.questions;
    totalQuestions = currentQuestions.length;
    currentQuestionIndex = 0;
    userAnswers = {}; // Reset answers for this test instance
    testStartTime = new Date();
    isFeedbackMode = false;

    // Initialize slider
    questionSlider = document.getElementById('questionSlider');
    if (questionSlider) {
        questionSlider.max = totalQuestions - 1;
        questionSlider.value = 0;
        
        // Set up slider event listener
        questionSlider.addEventListener('input', function() {
            const newIndex = parseInt(this.value, 10);
            if (newIndex !== currentQuestionIndex && newIndex >= 0 && newIndex < totalQuestions) {
                // Save current answer before switching questions
                saveCurrentAnswer();
                isFeedbackMode = false; // Reset feedback mode when switching questions
                currentQuestionIndex = newIndex;
                displayQuestion();
                updateNextButtonState();
            }
        });
    }

    // Initialize navigation button event listeners
    const nextButton = document.getElementById('nextButton');
    const prevButton = document.getElementById('prevButton');
    
    if (nextButton) {
        // Remove any existing event listeners and add new one
        nextButton.replaceWith(nextButton.cloneNode(true));
        const newNextButton = document.getElementById('nextButton');
        newNextButton.addEventListener('click', function() {
            if (currentQuestionIndex === totalQuestions - 1) {
                handleFinishClick();
            } else {
                handleNextClick();
            }
        });
    }

    document.getElementById('dashboardScreen').style.display = 'none';
    document.getElementById('categoryScreen').style.display = 'none';
    document.getElementById('testScreen').style.display = 'block';
    document.getElementById('resultsScreen').style.display = 'none';

    // Set up quit button event listener
    const quitButton = document.getElementById('quitTestButton');
    if (quitButton) {
        quitButton.replaceWith(quitButton.cloneNode(true)); // Remove existing listeners
        const newQuitButton = document.getElementById('quitTestButton');
        newQuitButton.addEventListener('click', handleQuitTest);
    }

    let categoryDisplayName = currentCategory.subtopic_name || currentCategory.name;
    document.getElementById('categoryName').textContent = `Test: ${categoryDisplayName}`;
    displayQuestion();
}

function updateNextButtonState() {
    const nextButton = document.getElementById('nextButton');
    if (isFeedbackMode) {
        nextButton.disabled = false;
        return;
    }
    if (!currentCategory || !currentCategory.questions[currentQuestionIndex]) {
        nextButton.disabled = true;
        return;
    }
    const question = currentCategory.questions[currentQuestionIndex];
    const uniqueQuestionKey = generateUniqueAnswerKey(question);
    const userSelection = userAnswers[uniqueQuestionKey] || [];
    nextButton.disabled = userSelection.length === 0;
}

function displayQuestion() {
    if (currentQuestionIndex < 0 || currentQuestionIndex >= totalQuestions) {
        console.error("Invalid question index:", currentQuestionIndex);
        return;
    }
    const question = currentQuestions[currentQuestionIndex];
    if (!question) {
        console.error("Question data not found for index:", currentQuestionIndex);
        return;
    }

    // Update slider value
    if (questionSlider) {
        questionSlider.value = currentQuestionIndex;
    }

    const questionText = document.getElementById('questionText');
    const questionCode = document.getElementById('questionCode');
    const questionCodeContainer = document.getElementById('questionCodeContainer');
    const optionsContainer = document.getElementById('optionsContainer');
    const questionStatus = document.getElementById('questionStatus');
    const progressFill = document.getElementById('progressFill');

    questionText.textContent = question.question_text;
    if ('question_code' in question) {
        questionCode.textContent = question.question_code || '';
        questionCodeContainer.style.display = 'block';

        const existingLangClass = Array.from(questionCode.classList).find(c => c.startsWith('language-'));
        if (existingLangClass) { questionCode.classList.remove(existingLangClass); } // Remove already existing language class
        if (question.question_syntax) { questionCode.classList.add(`language-${question.question_syntax}`); } 
    } else {
        questionCodeContainer.style.display = 'none';
        questionCode.textContent = '';
        const existingLangClass = Array.from(questionCode.classList).find(c => c.startsWith('language-'));
        if (existingLangClass) { questionCode.classList.remove(existingLangClass); } // Remove already existing language class
    }
    questionStatus.textContent = `${currentQuestionIndex + 1} / ${totalQuestions}`;

    // Update progress bar
    const progressPercentage = ((currentQuestionIndex + 1) / totalQuestions) * 100;
    progressFill.style.width = `${progressPercentage}%`;

    // --- Image Handling Start ---
    const imageContainer = document.getElementById('questionImageContainer');
    imageContainer.innerHTML = ''; // Clear previous image

    // Use the original category of the question for image loading, not the test name
    let categoryNameForImage = getCategoryNameForImage(
        question.subtopic_name_origin || 
        currentCategory.subtopic_name || 
        currentCategory.name || 
        "DefaultCategory"
    );
    
    // Ensure question_id is available, otherwise use a placeholder or skip
    const questionIdForImage = question.question_id ? String(question.question_id) : null;

    if (questionIdForImage) {
        const imageName = `${categoryNameForImage}_${questionIdForImage}.png`;
        const imagePath = `photos/${imageName}`;
        const imgElement = document.createElement('img');
        imgElement.alt = `Image for ${categoryNameForImage} Question ${questionIdForImage}`;
        imgElement.style.maxWidth = '100%';
        imgElement.style.maxHeight = '300px';
        imgElement.style.display = 'none';
        imgElement.style.cursor = 'zoom-in';
        imgElement.style.transition = 'transform 0.2s ease-in-out';

        imgElement.onload = function() {
            imgElement.style.display = 'block';
        };
        imgElement.onerror = function() {
            imgElement.style.display = 'none';
        };
        imgElement.src = imagePath;
        
        // Add click event to open modal for question image
        imgElement.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('Question image clicked, opening modal for:', imagePath);
            openImageModal(imagePath);
        });

        // Add hover effect for question image
        imgElement.addEventListener('mouseenter', function() {
            this.style.transform = 'scale(1.05)';
        });
        imgElement.addEventListener('mouseleave', function() {
            this.style.transform = 'scale(1)';
        });
        
        imageContainer.appendChild(imgElement);
    }
    // --- Image Handling End ---

    optionsContainer.innerHTML = '';
    const isMultipleChoice = question.correct_answers.length > 1;

    question.options.forEach(option => {
        const optionDiv = document.createElement('div');
        optionDiv.classList.add('option');

        // Always use checkbox to hide whether it's single or multiple choice
        const input = document.createElement('input');
        input.type = 'checkbox';
        const qIdForInput = question.question_id || currentQuestionIndex;
        input.name = `question_${qIdForInput}`;
        input.id = `option_${qIdForInput}_${option.id}`;
        input.value = option.id;

        // Create unique key combining test instance, category and question ID
        const uniqueQuestionKey = generateUniqueAnswerKey(question);
        const userAnswer = userAnswers[uniqueQuestionKey];
        // ALWAYS set the checkbox state explicitly to prevent state pollution
        input.checked = false; // Reset first
        if (userAnswer && Array.isArray(userAnswer)) {
            if (userAnswer.includes(option.id)) {
                input.checked = true;
            }
        } else if (userAnswer === option.id) {
            input.checked = true;
        }

        // Single event handler to avoid double-triggering
        const handleOptionSelect = (e) => {
            // Don't trigger if clicking on an image (they have their own handlers)
            if (e.target.tagName === 'IMG') {
                return;
            }
            
            // Don't trigger if in feedback mode
            if (isFeedbackMode) {
                return;
            }
            
            // Prevent event bubbling to avoid double triggers
            e.preventDefault();
            e.stopPropagation();
            
            // Call selectAnswer with a small delay to ensure proper state management
            setTimeout(() => {
                selectAnswer(option.id, isMultipleChoice);
            }, 0);
        };

        if (isFeedbackMode) {
            input.disabled = true;
            optionDiv.classList.add('disabled-option');
        }

        if (option.is_code) {
            const label = document.createElement('label');
            const preElement = document.createElement('pre');
            const codeElement = document.createElement('code');

            label.htmlFor = input.id;

            codeElement.textContent = option.text;
            codeElement.classList.add('language-' + option.syntax);

            preElement.appendChild(codeElement);
            label.appendChild(preElement);
            optionDiv.appendChild(input);
            optionDiv.appendChild(label);

            hljs.highlightElement(codeElement);
        }
        else {
            const label = document.createElement('label');
            label.htmlFor = input.id;
            label.textContent = option.text || `Option ${option.id}`;
            label.classList.add('option-text');

            optionDiv.appendChild(input);
            optionDiv.appendChild(label);
        }

        // Add single click handler to the entire option div
        if (!isFeedbackMode) {
            // Remove any existing handlers first
            optionDiv.removeEventListener('click', handleOptionSelect);
            optionDiv.addEventListener('click', handleOptionSelect, { passive: false });
            
            // Also add click handler to label for better accessibility
            const label = optionDiv.querySelector('label');
            if (label) {
                label.removeEventListener('click', handleOptionSelect);
                label.addEventListener('click', handleOptionSelect, { passive: false });
            }
        }   

        // --- Add image for the option ---
        if (option.id && questionIdForImage) {
            const optionImageName = `${categoryNameForImage}_${questionIdForImage}_${option.id}.png`;
            const optionImagePath = `photos/${optionImageName}`;

            const optionImgElement = document.createElement('img');
            optionImgElement.alt = `Image for option ${option.id}`;
            optionImgElement.style.maxWidth = '120px';
            optionImgElement.style.maxHeight = '120px';
            optionImgElement.style.display = 'none';   
            optionImgElement.style.cursor = 'zoom-in';
            optionImgElement.style.border = '1px solid var(--border-color)';
            optionImgElement.style.borderRadius = '5px';

            optionImgElement.onload = function() {
                optionImgElement.style.display = 'block'; 
            };
            optionImgElement.onerror = function() {
                optionImgElement.style.display = 'none';
            };
            optionImgElement.src = optionImagePath;
            
            // Add click event to open modal
            optionImgElement.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                console.log('Image clicked, opening modal for:', optionImagePath);
                openImageModal(optionImagePath);
            });

            // Add hover effect
            optionImgElement.addEventListener('mouseenter', function() {
                this.style.transform = 'scale(1.1)';
            });
            optionImgElement.addEventListener('mouseleave', function() {
                this.style.transform = 'scale(1)';
            });

            optionDiv.appendChild(optionImgElement); 
        }
        // --- End option image ---

        // Apply feedback styling if in feedback mode
        if (isFeedbackMode && question.correct_answers) {
            const isCorrect = question.correct_answers.includes(option.id);
            const isSelected = input.checked;

            if (isCorrect) {
                optionDiv.classList.add('reveal-correct');
                if (isSelected) {
                    optionDiv.classList.add('correct-selection');
                }
            } else if (isSelected) {
                optionDiv.classList.add('incorrect-selection');
            }
        }
        
        optionsContainer.appendChild(optionDiv);
    });
    
    updateNavigationButtons();
    if ('question_code' in question) { 
        if (questionCode.hasAttribute('data-highlighted')) questionCode.removeAttribute('data-highlighted');
        hljs.highlightElement(questionCode);
    }
}

function updateNavigationButtons() {
    const prevButton = document.getElementById('prevButton');
    const nextButton = document.getElementById('nextButton');

    // Update previous button
    if (prevButton) {
        prevButton.disabled = currentQuestionIndex === 0 || isFeedbackMode;
    }

    // Update next button text and state
    if (nextButton) {
        if (currentQuestionIndex === totalQuestions - 1) {
            nextButton.textContent = isFeedbackMode ? 'View Results' : 'Finish Test';
        } else {
            nextButton.textContent = isFeedbackMode ? 'Continue' : 'Next';
        }
    }

    // Update next button state
    updateNextButtonState();
}

// --- Image Zoom Functionality Start ---
let modal, zoomedImage, closeBtn;

function initializeImageZoom() {
    modal = document.getElementById('imageZoomModal');
    zoomedImage = document.getElementById('zoomedImage');
    closeBtn = document.getElementById('closeZoomBtn');

    if (closeBtn) {
        closeBtn.onclick = function() {
            closeImageModal();
        }
    }

    // Close modal when clicking outside the image
    if (modal) {
        modal.onclick = function(event) {
            if (event.target === modal) { // Check if the click is on the modal background itself
                closeImageModal();
            }
        }
    }

    // Also close modal with Escape key
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape' && modal && modal.style.display === 'flex') {
            closeImageModal();
        }
    });
}

function openImageModal(src) {
    if (!modal || !zoomedImage) {
        console.warn('Modal elements not found, reinitializing...');
        initializeImageZoom();
    }
    
    if (modal && zoomedImage) {
        modal.style.display = 'flex'; // Use flex to center content
        zoomedImage.src = src;
        zoomedImage.alt = 'Zoomed image';
    }
}

function closeImageModal() {
    if (modal) {
        modal.style.display = 'none';
    }
}

// Initialize image zoom when DOM is ready
document.addEventListener('DOMContentLoaded', initializeImageZoom);

// Initialize the application when DOM is ready
// DOM Content Loaded Event Listener
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 UVT Quiz App Loading...');
    
    // Initialize dark mode first
    initializeDarkMode();
    
    // Load and migrate user statistics
    loadUserStats();
    
    // Perform aggressive migration check (runs after initial load)
    setTimeout(performAggressiveMigrationCheck, 1000);
    
    // Add dark mode toggle event listener
    const darkModeToggle = document.getElementById('darkModeToggle');
    if (darkModeToggle) {
        darkModeToggle.addEventListener('click', toggleDarkMode);
    }
    
    loadTestData();
    
    // Initialize modal event listeners
    const modal = document.getElementById('exit-confirmation-modal');
    if (modal) {
        // Close modal when clicking outside
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
    }
    
    console.log('✅ App initialization complete');
});

// Add keyboard shortcut for dark mode toggle
document.addEventListener('keydown', function(e) {
    // Ctrl+Shift+D to toggle dark mode
    if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        toggleDarkMode();
    }
});

// Aggressive migration check - runs after page load to ensure no legacy data is missed
function performAggressiveMigrationCheck() {
    console.log('🔍 Performing aggressive migration check...');
    
    // Check if we have current data
    const currentStats = loadFromStorage(STATS_COOKIE_NAME);
    const hasValidCurrentData = currentStats && currentStats.version === STATS_VERSION;
    
    // Always check for legacy data, even if we have current data
    const legacySearch = performComprehensiveLegacySearch();
    
    if (legacySearch && legacySearch.data) {
        console.log('🎯 Found legacy data in aggressive check!');
        
        if (hasValidCurrentData) {
            console.log('⚠️  Current data exists, but found legacy data too');
            console.log('Checking if legacy data has more recent or additional information...');
            
            // Compare data to see if legacy has newer information
            const legacyData = legacySearch.data;
            const shouldMigrate = shouldMigrateLegacyData(currentStats, legacyData);
            
            if (shouldMigrate) {
                console.log('🔄 Legacy data appears to have newer information, migrating...');
                performLegacyMigration(legacySearch.key, legacyData);
            } else {
                console.log('✅ Current data is newer, just cleaning up legacy data');
                cleanupLegacyData(legacySearch.key);
            }
        } else {
            console.log('📦 No current data, migrating legacy data');
            performLegacyMigration(legacySearch.key, legacySearch.data);
        }
    } else {
        console.log('✅ No legacy data found in aggressive check');
        
        // Still try to clean up any known legacy keys
        cleanupLegacyData();
    }
}

// Helper function to determine if legacy data should be migrated
function shouldMigrateLegacyData(currentData, legacyData) {
    if (!currentData || !legacyData) return !!legacyData;
    
    // Compare test counts
    const currentTests = currentData.totalTests || 0;
    const legacyTests = legacyData.totalTests || 0;
    
    // Compare last test dates
    const currentLastTest = currentData.lastTestDate ? new Date(currentData.lastTestDate) : new Date(0);
    const legacyLastTest = legacyData.lastTestDate ? new Date(legacyData.lastTestDate) : new Date(0);
    
    // Migrate if legacy has more tests or newer last test date
    return legacyTests > currentTests || legacyLastTest > currentLastTest;
}

// Helper function to perform the actual migration
function performLegacyMigration(legacyKey, legacyData) {
    console.log(`🔄 Migrating from '${legacyKey}'...`);
    
    try {
        const migrated = migrateLegacyStats(legacyData);
        
        if (migrated && Object.keys(migrated).length > 0) {
            // Merge with existing userStats (legacy data takes precedence)
            userStats = { ...userStats, ...migrated };
            
            // Save to new format
            saveUserStats();
            
            // Clean up legacy data
            cleanupLegacyData(legacyKey);
            
            // Update UI
            if (typeof updateDashboardStats === 'function') {
                updateDashboardStats();
            }
            
            console.log('✅ Aggressive migration completed successfully');
            return true;
        }
    } catch (e) {
        console.error('❌ Aggressive migration failed:', e);
    }
    
    return false;
}

// Console help message for debugging
console.log('%c=== UVT Quiz App Debug Help ===', 'color: #667eea; font-weight: bold; font-size: 16px;');
console.log('%c🔧 Statistics Migration & Debug Commands:', 'color: #4a5568; font-weight: bold;');
console.log('%c1. debugStorageAndMigration() - Comprehensive storage analysis', 'color: #22c55e;');
console.log('%c2. manualMigration() - Force migration from legacy data', 'color: #3b82f6;');
console.log('%c3. performComprehensiveLegacySearch() - Search all keys for quiz data', 'color: #8b5cf6;');
console.log('%c4. cleanupLegacyData() - Remove old storage entries', 'color: #f59e0b;');
console.log('%c5. resetAllStats() - Reset all statistics (⚠️  DANGER: Loses all progress)', 'color: #ef4444;');
console.log('%c6. localStorage.clear() - Clear all localStorage (⚠️  DANGER: Loses everything)', 'color: #dc2626;');
console.log('%c', ''); // Empty line
console.log('%c💡 Tip: Run debugStorageAndMigration() first to see current storage state', 'color: #6b7280; font-style: italic;');

// Utility function to scroll to top
function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function saveCurrentAnswer() {
    // This function is now mainly for compatibility
    // The answers are already being saved directly in selectAnswer()
    // We don't need to override the stored state since it's more reliable
    return;
}

function getSelectedOptionValue(questionName) {
    const inputs = document.getElementsByName(questionName);
    
    // Always collect ALL selected values regardless of question type
    // This allows multiple selections even for single-choice questions
    const selectedValues = [];
    inputs.forEach(input => {
        if (input.checked) {
            selectedValues.push(input.value);
        }
    });
    
    return selectedValues.length > 0 ? selectedValues : undefined;
}


function selectAnswer(optionId, isMultipleChoice) {
    if (isFeedbackMode) return; 

    const question = currentCategory.questions[currentQuestionIndex];
    // Create unique key combining test instance, category and question ID
    const uniqueQuestionKey = generateUniqueAnswerKey(question);

    // Always allow multiple selections to hide question type
    // Initialize answer array if it doesn't exist
    if (!userAnswers[uniqueQuestionKey]) userAnswers[uniqueQuestionKey] = [];
    
    // Toggle selection for all questions (behave like checkboxes)
    const index = userAnswers[uniqueQuestionKey].indexOf(optionId);
    if (index > -1) {
        userAnswers[uniqueQuestionKey].splice(index, 1);
    } else {
        userAnswers[uniqueQuestionKey].push(optionId);
    }

    // Force update the visual state of all options to match the stored answers
    // Use requestAnimationFrame to ensure DOM is ready
    requestAnimationFrame(() => {
        document.querySelectorAll(`#optionsContainer .option`).forEach(optDiv => {
            const input = optDiv.querySelector('input');
            if (!input) return;
            
            const inputOptionId = input.value;
            
            // Set checkbox state based on stored answers
            const isSelected = userAnswers[uniqueQuestionKey].includes(inputOptionId);
            
            // Force the visual state to match our data
            if (input.checked !== isSelected) {
                input.checked = isSelected;
            }
            
            // Update visual styling
            if (isSelected) {
                optDiv.classList.add('selected');
            } else {
                optDiv.classList.remove('selected');
            }
        });
        
        // Update button state after visual update
        updateNextButtonState();
    });
}

function showAnswerFeedback() {
    const question = currentCategory.questions[currentQuestionIndex];
    const uniqueQuestionKey = generateUniqueAnswerKey(question);
    const userSelection = userAnswers[uniqueQuestionKey] || [];
    const correctAnswers = question.correct_answers;

    // Check if user got any correct answers (for partial credit feedback)
    const userCorrectSelections = userSelection.filter(id => correctAnswers.includes(id));
    const hasPartialCredit = userCorrectSelections.length > 0;

    document.querySelectorAll('#optionsContainer .option').forEach(optDiv => {
        const input = optDiv.querySelector('input');
        input.disabled = true;
        optDiv.classList.add('disabled-option');

        const optionId = input.value;
        const isCorrect = correctAnswers.includes(optionId);
        const isSelected = userSelection.includes(optionId);

        // Show all correct answers as green if user got at least one correct
        if (isCorrect) { 
            optDiv.classList.add('reveal-correct');
            // Show green background for ALL correct answers when user has partial credit
            if (hasPartialCredit) {
                optDiv.classList.add('correct-selection');
            }
        }
        
        // Show incorrect selections in red
        if (isSelected && !isCorrect) { 
            optDiv.classList.add('incorrect-selection');
        }
    });
    isFeedbackMode = true;
    updateNavigationButtons();
}

function handleNextClick() {
    // Close any open image zoom modal
    closeImageModal();
    
    const nextButton = document.getElementById('nextButton');
    if (isFeedbackMode) { 
        isFeedbackMode = false;
        currentQuestionIndex++;
        if (currentQuestionIndex < totalQuestions) {
            displayQuestion();
            updateNextButtonState();
        } else {
            finishTest();
        }
    } else { 
        // Save current answer before showing feedback
        saveCurrentAnswer();
        showAnswerFeedback();
        isFeedbackMode = true;
        
        if (currentQuestionIndex === totalQuestions - 1) {
            nextButton.textContent = 'View Results';
        } else {
            nextButton.textContent = 'Continue';
        }
    }
}

function handleFinishClick() {
    const nextButton = document.getElementById('nextButton');
    if (isFeedbackMode) { 
        finishTest();
    } else { 
        // Save current answer before showing feedback
        saveCurrentAnswer();
        showAnswerFeedback();
        isFeedbackMode = true; 
        nextButton.textContent = 'View Results';
    }
}

function previousQuestion() {
    // Close any open image zoom modal
    closeImageModal();
    
    if (currentQuestionIndex > 0) {
        // Save current answer before going to previous question
        if (!isFeedbackMode) {
            saveCurrentAnswer();
        }
        isFeedbackMode = false; 
        currentQuestionIndex--;
        displayQuestion();
        updateNextButtonState();
    }
}

// Exit test functionality
function handleQuitTest() {
    console.log('handleQuitTest called'); // Debug log
    const modal = document.getElementById('exit-confirmation-modal');
    if (!modal) {
        console.error('Exit modal not found! Using fallback.');
        // Fallback - ask for confirmation and exit
        if (window.confirm("Are you sure you want to quit this test? Your progress will be lost.")) {
            exitTest();
        }
        return;
    }
    
    modal.style.display = 'flex';
    
    // Use addEventListener for more reliable event handling
    const confirmBtn = document.getElementById('confirm-exit-btn');
    const cancelBtn = document.getElementById('cancel-exit-btn');
    
    if (confirmBtn) {
        // Remove existing listeners first
        confirmBtn.replaceWith(confirmBtn.cloneNode(true));
        const newConfirmBtn = document.getElementById('confirm-exit-btn');
        newConfirmBtn.addEventListener('click', () => {
            console.log('Exit confirmed'); // Debug log
            exitTest();
            modal.style.display = 'none';
        });
    }

    if (cancelBtn) {
        // Remove existing listeners first
        cancelBtn.replaceWith(cancelBtn.cloneNode(true));
        const newCancelBtn = document.getElementById('cancel-exit-btn');
        newCancelBtn.addEventListener('click', () => {
            console.log('Exit cancelled'); // Debug log
            modal.style.display = 'none';
        });
    }
    
    // Also allow clicking outside to close
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });
}

// Make function available globally
window.handleQuitTest = handleQuitTest;

function exitTest() {
    if (testTimerInterval) {
        clearInterval(testTimerInterval);
        testTimerInterval = null;
    }
    stopTimer(); // This will handle all timer cleanup
    showDashboard();
}

function finishTest() {
    stopTimer(); 
    isRandomTestActive = false;
    
    // Ensure the current answer is saved before finishing
    if (!isFeedbackMode) {
        saveCurrentAnswer();
    }

    const testEndTime = new Date();
    const timeTaken = Math.floor((testEndTime - testStartTime) / 1000);
    let correctCount = 0;
    let wrongCount = 0;
    let unansweredCount = 0;
    const totalQuestions = currentCategory.questions.length;
    const weakQuestions = [];
    const questionDetails = [];

    currentCategory.questions.forEach(question => {
        const uniqueQuestionKey = generateUniqueAnswerKey(question);
        const userAnswer = userAnswers[uniqueQuestionKey] || [];
        const correctAnswer = question.correct_answers;
        const sortedUserAnswer = [...userAnswer].sort();
        const sortedCorrectAnswer = [...correctAnswer].sort();
        const isCorrect = sortedUserAnswer.length === sortedCorrectAnswer.length &&
            sortedUserAnswer.every((val, index) => val === sortedCorrectAnswer[index]);
        
        if (userAnswer.length === 0) {
            unansweredCount++;
        } else if (isCorrect) {
            correctCount++;
        } else {
            wrongCount++;
            weakQuestions.push(question);
        }

        questionDetails.push({
            id: question.question_id,
            question_text: question.question_text,
            userAnswer: userAnswer,
            correctAnswer: correctAnswer,
            isCorrect: isCorrect,
            wasAnswered: userAnswer.length > 0
        });
    });

    const score = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;

    // Record test statistics
    const testData = {
        categoryName: currentCategory.subtopic_name || currentCategory.name || 'Unknown',
        isRandomTest: isRandomTestActive,
        isCustomTest: selectedCustomCategories && selectedCustomCategories.length > 0,
        totalQuestions: totalQuestions,
        correctAnswers: correctCount,
        wrongAnswers: wrongCount,
        unansweredQuestions: unansweredCount,
        timeSpent: timeTaken,
        percentage: score,
        questions: questionDetails,
        weakQuestions: weakQuestions
    };
    
    recordTestResult(testData);

    document.getElementById('testScreen').style.display = 'none';
    document.getElementById('resultsScreen').style.display = 'block';

    const circumference = 2 * Math.PI * 85;
    const scoreCircleEl = document.getElementById('scoreCircle');
    scoreCircleEl.style.strokeDasharray = circumference;
    scoreCircleEl.style.strokeDashoffset = circumference;
    setTimeout(() => {
        scoreCircleEl.style.strokeDashoffset = circumference - (score / 100) * circumference;
        document.getElementById('scoreText').textContent = `${score}%`;
    }, 100);

    const minutes = Math.floor(timeTaken / 60);
    const seconds = timeTaken % 60;
    let summaryHTML = `
        <p>You answered <strong>${correctCount}</strong> out of <strong>${totalQuestions}</strong> questions correctly.</p>
        <p>Time taken: <strong>${minutes}m ${seconds}s</strong></p>
        <p>Test Type: <strong>${currentCategory.subtopic_name || currentCategory.name}</strong></p>`;
    if (currentCategory.parent_topic_name) { 
        summaryHTML += `<p>Parent Topic: <strong>${currentCategory.parent_topic_name}</strong></p>`;
    }
    
    // Add streak information
    if (score >= 70) {
        summaryHTML += `<p style="color: var(--text-accent);">🔥 Current Streak: <strong>${userStats.streakData.current}</strong> passed tests</p>`;
    } else {
        summaryHTML += `<p style="color: var(--action-secondary);">Streak reset. Keep practicing!</p>`;
    }
    
    document.getElementById('resultsSummary').innerHTML = summaryHTML;
    prepareReview();
}

function prepareReview() {
    const reviewContainer = document.getElementById('answerReview');
    reviewContainer.innerHTML = '<h3 style="margin-bottom: 20px;">Answer Review</h3>';
    

    
    let displayedQuestions = 0;
    let questionsWithAnswers = 0;
    let questionsWithoutAnswers = 0;
    
    currentCategory.questions.forEach((question, index) => {
        const uniqueQuestionKey = generateUniqueAnswerKey(question);
        const userAnswer = userAnswers[uniqueQuestionKey] || [];
        const correctAnswer = question.correct_answers;
        

        
        if (userAnswer.length > 0) {
            questionsWithAnswers++;
        } else {
            questionsWithoutAnswers++;
        }
        
        const sortedUserAnswer = [...userAnswer].sort();
        const sortedCorrectAnswer = [...correctAnswer].sort();
        const isCorrect = sortedUserAnswer.length === sortedCorrectAnswer.length &&
            sortedUserAnswer.every((val, index) => val === sortedCorrectAnswer[index]);

        const reviewDiv = document.createElement('div');
        reviewDiv.className = `review-question ${isCorrect ? 'correct' : 'incorrect'}`;

        const optionsHtml = question.options.map(opt => {
            const isCorrectOpt = correctAnswer.includes(opt.id);
            const isUserSelectedOpt = userAnswer.includes(opt.id);
            let optFeedbackClass = '';
            let optFeedbackTextParts = [];
            
            if(isUserSelectedOpt){
                if(isCorrectOpt){
                    optFeedbackTextParts.push('<span class="correct-answer">(Your Choice)</span>');
                } else {
                    optFeedbackTextParts.push('<span class="incorrect-answer">(Your Choice - Incorrect)</span>');
                }
            }
            if(isCorrectOpt && !isUserSelectedOpt){
                optFeedbackClass += ' correct-answer'; 
            }
            if(isUserSelectedOpt && !isCorrectOpt){
                 optFeedbackClass += ' incorrect-answer'; 
            }

            return `<div class="${optFeedbackClass}">${opt.id}. ${opt.text} ${optFeedbackTextParts.join(' ')}</div>`;
        }).join('');
        
        let originInfo = '';
        if (question.subtopic_name_origin) { 
            originInfo = `<p style="font-size:0.8em; color:var(--text-muted);"><em>Origin: ${question.parent_topic_name_origin} > ${question.subtopic_name_origin}</em></p>`;
        }

        reviewDiv.innerHTML = `
            <h4>Question ${index + 1}: <span style="white-space: pre-wrap;">${question.question_text}</span></h4>
            ${originInfo}
            <p><strong>Your answer(s):</strong> ${userAnswer.length > 0 ? userAnswer.join(', ') : 'Not answered'}</p>
            <p><strong>Correct answer(s):</strong> ${correctAnswer.join(', ')}</p>
            <div style="margin-top: 10px;">${optionsHtml}</div>
            <p style="margin-top: 5px;"><strong>Explanation:</strong> ${question.explanation || 'No explanation provided.'}</p>
        `;
        reviewContainer.appendChild(reviewDiv);
        displayedQuestions++;
    });
    

}

function showReview() {
    const review = document.getElementById('answerReview');
    const currentDisplay = window.getComputedStyle(review).display;
    review.style.display = currentDisplay === 'none' ? 'block' : 'none';
}

function resetTest() {
    stopTimer(); 
    isRandomTestActive = false;

    document.getElementById('resultsScreen').style.display = 'none';
    document.getElementById('answerReview').style.display = 'none';
    
    currentQuestionIndex = 0;
    userAnswers = {};
    currentCategory = null;
    isFeedbackMode = false;
    
    showDashboard(); 
}

// Statistics UI Functions
function showStatistics() {
    scrollToTop();
    updateStatisticsDisplay();
    document.getElementById('dashboardScreen').style.display = 'none';
    document.getElementById('categoryScreen').style.display = 'none';
    document.getElementById('customTestScreen').style.display = 'none';
    document.getElementById('testScreen').style.display = 'none';
    document.getElementById('resultsScreen').style.display = 'none';
    document.getElementById('statisticsScreen').style.display = 'block';
}

function updateStatisticsDisplay() {
    // Update overview stats
    document.getElementById('totalTestsStat').textContent = userStats.totalTests;
    document.getElementById('totalQuestionsAnsweredStat').textContent = userStats.totalQuestionsAnswered;
    
    const overallAccuracy = userStats.totalQuestionsAnswered > 0 
        ? Math.round((userStats.totalCorrectAnswers / userStats.totalQuestionsAnswered) * 100)
        : 0;
    document.getElementById('overallAccuracyStat').textContent = `${overallAccuracy}%`;
    
    const totalHours = Math.round(userStats.totalTimeSpent / 3600 * 10) / 10;
    document.getElementById('totalTimeSpentStat').textContent = `${totalHours}h`;
    
    // Update streak info
    document.getElementById('currentStreakStat').textContent = userStats.streakData.current;
    document.getElementById('bestStreakStat').textContent = userStats.streakData.best;
    
    // Update achievements
    updateAchievementsDisplay();
    
    // Update test history
    updateTestHistoryDisplay();
    
    // Update category performance
    updateCategoryPerformanceDisplay();
    
    // Update weak areas
    updateWeakAreasDisplay();
}

function updateAchievementsDisplay() {
    const container = document.getElementById('achievementsContainer');
    
    if (userStats.achievements.length === 0) {
        container.innerHTML = '<p>No achievements yet. Keep practicing!</p>';
        return;
    }
    
    const achievementsHtml = userStats.achievements
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 6) // Show last 6 achievements
        .map(achievement => `
            <div class="achievement-item">
                <span class="achievement-icon">${achievement.icon}</span>
                <div class="achievement-info">
                    <strong>${achievement.name}</strong>
                    <p>${achievement.description}</p>
                    <small>${new Date(achievement.date).toLocaleDateString()}</small>
                </div>
            </div>
        `).join('');
    
    container.innerHTML = achievementsHtml;
}

function updateTestHistoryDisplay() {
    const container = document.getElementById('testHistoryContainer');
    
    if (userStats.testHistory.length === 0) {
        container.innerHTML = '<p>No test history available.</p>';
        return;
    }
    
    const historyHtml = userStats.testHistory
        .slice(0, 10) // Show last 10 tests
        .map(test => {
            const date = new Date(test.date).toLocaleDateString();
            const time = new Date(test.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const minutes = Math.floor(test.timeSpent / 60);
            const seconds = test.timeSpent % 60;
            const scoreClass = test.percentage >= 70 ? 'score-pass' : 'score-fail';
            
            return `
                <div class="test-history-item">
                    <div class="test-info">
                        <h4>${test.categoryName}</h4>
                        <p>${date} at ${time}</p>
                        <div class="test-stats">
                            <span>⏱️ ${minutes}m ${seconds}s</span>
                            <span>✓ ${test.correctAnswers}/${test.totalQuestions}</span>
                            ${test.isRandomTest ? '<span class="test-type">Random</span>' : ''}
                            ${test.isCustomTest ? '<span class="test-type">Custom</span>' : ''}
                        </div>
                    </div>
                    <div class="test-score ${scoreClass}">
                        ${test.percentage}%
                    </div>
                </div>
            `;
        }).join('');
    
    container.innerHTML = historyHtml;
}

function updateCategoryPerformanceDisplay() {
    const container = document.getElementById('categoryPerformanceContainer');
    
    if (Object.keys(userStats.categoryPerformance).length === 0) {
        container.innerHTML = '<p>No category data available.</p>';
        return;
    }
    
    const performanceHtml = Object.entries(userStats.categoryPerformance)
        .sort(([,a], [,b]) => b.totalTests - a.totalTests)
        .map(([categoryName, stats]) => {
            // Ensure recentScores exists for backwards compatibility
            if (!stats.recentScores) {
                stats.recentScores = [];
            }
            const trend = calculateTrend(stats.recentScores);
            const trendIcon = trend > 0 ? '📈' : trend < 0 ? '📉' : '➡️';
            const bestScoreClass = stats.bestScore >= 90 ? 'excellent' : stats.bestScore >= 70 ? 'good' : 'needs-work';
            
            return `
                <div class="category-performance-item">
                    <div class="category-info">
                        <h4>${categoryName}</h4>
                        <div class="category-stats">
                            <span>Tests: ${stats.totalTests}</span>
                            <span>Questions: ${stats.totalQuestions}</span>
                        </div>
                    </div>
                    <div class="category-scores">
                        <div class="score-item">
                            <span class="score-label">Average</span>
                            <span class="score-value">${stats.averageScore}%</span>
                        </div>
                        <div class="score-item">
                            <span class="score-label">Best</span>
                            <span class="score-value ${bestScoreClass}">${stats.bestScore}%</span>
                        </div>
                        <div class="trend-indicator">
                            ${trendIcon}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    
    container.innerHTML = performanceHtml;
}

function updateWeakAreasDisplay() {
    const container = document.getElementById('weakAreasContainer');
    
    if (userStats.weakQuestions.length === 0) {
        container.innerHTML = '<p>No weak areas identified yet. Great job!</p>';
        return;
    }
    
    // Clean up and refresh category information for existing weak questions
    userStats.weakQuestions.forEach(weakQuestion => {
        if (!weakQuestion.category || weakQuestion.category === 'Unknown Category') {
            // Try to find the correct category for this question
            const foundCategory = displayableCategories.find(cat => 
                cat.questions.some(q => q.question_id === weakQuestion.id)
            );
            if (foundCategory) {
                weakQuestion.category = foundCategory.subtopic_name;
            }
        }
    });
    
    const weakAreasHtml = userStats.weakQuestions
        .slice(0, 15) // Show top 15 weak questions
        .map((weakQuestion, index) => {
            // Clean up question text and show more
            const questionText = weakQuestion.questionText
                .replace(/\s+/g, ' ')
                .trim();
            const displayText = questionText.length > 150 
                ? questionText.substring(0, 150) + '...' 
                : questionText;
                
            return `
                <div class="weak-question-item">
                    <div class="weak-question-info">
                        <h4>Question ${weakQuestion.id || (index + 1)}</h4>
                        <p title="${questionText}">${displayText}</p>
                        <small>Category: ${weakQuestion.category || 'Unknown'}</small>
                    </div>
                    <div class="weak-question-stats">
                        <span class="incorrect-count">❌ ${weakQuestion.incorrectCount}</span>
                        <small>Last missed: ${new Date(weakQuestion.lastIncorrectDate).toLocaleDateString()}</small>
                    </div>
                </div>
            `;
        }).join('');
    
    container.innerHTML = weakAreasHtml;
    
    // Save the updated stats after cleaning up categories
    saveUserStats();
}

function calculateTrend(recentScores) {
    // Safety check for undefined or null recentScores
    if (!recentScores || !Array.isArray(recentScores) || recentScores.length < 2) return 0;
    
    const recent = recentScores.slice(0, Math.min(3, recentScores.length));
    const older = recentScores.slice(Math.min(3, recentScores.length), Math.min(6, recentScores.length));
    
    if (older.length === 0) return 0;
    
    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
    
    return recentAvg - olderAvg;
}

function showStatsTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    
    // Update tab content
    document.querySelectorAll('.stats-tab-content').forEach(content => content.classList.remove('active'));
    document.getElementById(tabName + 'Tab').classList.add('active');
}



function clearAllStatistics() {
    if (confirm('Are you sure you want to clear ALL statistics? This action cannot be undone.')) {
        // Reset userStats to initial state
        userStats = {
            version: STATS_VERSION,
            totalTests: 0,
            totalQuestionsAnswered: 0,
            totalCorrectAnswers: 0,
            totalTimeSpent: 0,
            testHistory: [],
            categoryPerformance: {},
            weakQuestions: [],
            streakData: {
                current: 0,
                best: 0,
                lastTestDate: null
            },
            achievements: [],
            firstTestDate: null,
            lastTestDate: null
        };
        
        saveUserStats();
        updateStatisticsDisplay();
        updateDashboardStats();
        alert('All statistics have been cleared.');
    }
}

// Debug function to check localStorage and manually trigger migration
function debugStorageAndMigration() {
    console.log('=== 📊 COMPREHENSIVE STORAGE DEBUG ===');
    
    // Check what's in localStorage
    const allKeys = Object.keys(localStorage);
    console.log('📁 All localStorage keys:', allKeys);
    
    // Check for legacy data with multiple possible keys
    const legacyKeys = ['uvt_quiz_stats', 'uvt_quiz_stats_old', 'quiz_stats', 'userStats', 'quizStats'];
    let foundLegacy = [];
    
    legacyKeys.forEach(key => {
        const legacyData = localStorage.getItem(key);
        if (legacyData) {
            console.log(`📦 Legacy data found in '${key}' (${legacyData.length} chars)`);
            foundLegacy.push(key);
            try {
                // Try multiple parsing methods
                let parsed = null;
                
                // Method 1: Try LZ-String decompression first
                if (typeof LZString !== 'undefined') {
                    try {
                        const decompressed = LZString.decompress(legacyData);
                        if (decompressed) {
                            parsed = JSON.parse(decompressed);
                            console.log(`  ✅ Parsed via LZ-String decompression`);
                        }
                    } catch (e) {
                        // Continue to next method
                    }
                }
                
                // Method 2: Direct JSON parsing
                if (!parsed) {
                    parsed = JSON.parse(legacyData);
                    console.log(`  ✅ Parsed via direct JSON`);
                }
                
                console.log(`  📋 Data structure:`, {
                    type: typeof parsed,
                    keys: parsed && typeof parsed === 'object' ? Object.keys(parsed) : 'N/A',
                    totalTests: parsed?.totalTests,
                    testHistoryLength: Array.isArray(parsed?.testHistory) ? parsed.testHistory.length : 0,
                    hasCategories: !!(parsed?.categoryPerformance)
                });
                
                // Check if it's recognizable quiz data
                if (isLikelyQuizData(parsed)) {
                    console.log(`  🎯 Confirmed as quiz data`);
                } else {
                    console.log(`  ❓ Not recognized as quiz data`);
                }
                
            } catch (e) {
                console.log(`  ❌ Failed to parse legacy data from '${key}':`, e.message);
            }
        }
    });
    
    if (foundLegacy.length === 0) {
        console.log('❌ No legacy data found in standard keys');
        
        // Check all keys for potential quiz data
        console.log('🔍 Checking all localStorage keys for potential quiz data...');
        allKeys.forEach(key => {
            if (!['ls', 'darkMode'].includes(key) && !key.startsWith('_')) {
                try {
                    const data = localStorage.getItem(key);
                    const parsed = JSON.parse(data);
                    if (isLikelyQuizData(parsed)) {
                        console.log(`🎯 Potential quiz data found in unexpected key '${key}'`);
                    }
                } catch (e) {
                    // Skip invalid data
                }
            }
        });
    }
    
    // Check for current data
    const currentData = localStorage.getItem('ls');
    if (currentData) {
        console.log(`📊 Current 'ls' data found (${currentData.length} chars)`);
        try {
            // Try to decompress if using LZ-String
            let parsed = null;
            if (typeof LZString !== 'undefined') {
                try {
                    const decompressed = LZString.decompress(currentData);
                    if (decompressed) {
                        parsed = JSON.parse(decompressed);
                        console.log('  ✅ Parsed current data via LZ-String decompression');
                    }
                } catch (e) {
                    // Continue to fallback
                }
            }
            
            if (!parsed) {
                parsed = JSON.parse(currentData);
                console.log('  ✅ Parsed current data via direct JSON');
            }
            
            console.log('  📋 Current data structure:', {
                version: parsed?.version,
                totalTests: parsed?.totalTests,
                testHistoryLength: Array.isArray(parsed?.testHistory) ? parsed.testHistory.length : 0,
                categories: parsed?.categoryPerformance ? Object.keys(parsed.categoryPerformance).length : 0
            });
            
        } catch (e) {
            console.log('  ❌ Failed to parse current data:', e.message);
        }
    } else {
        console.log('❌ No current "ls" data found');
    }
    
    // Check userStats object
    console.log('💾 Current userStats object:', {
        version: userStats?.version,
        totalTests: userStats?.totalTests,
        testHistoryLength: Array.isArray(userStats?.testHistory) ? userStats.testHistory.length : 0,
        categories: userStats?.categoryPerformance ? Object.keys(userStats.categoryPerformance).length : 0
    });
    
    return {
        allKeys: allKeys,
        foundLegacyKeys: foundLegacy,
        hasCurrentData: !!currentData,
        userStatsValid: !!(userStats && typeof userStats === 'object')
    };
}

// Enhanced manual migration function
function manualMigration() {
    console.log('🔧 MANUAL MIGRATION PROCESS STARTED');
    
    // First, let's see what we have
    const debugInfo = debugStorageAndMigration();
    
    if (debugInfo.foundLegacyKeys.length === 0) {
        console.log('❌ No legacy data found to migrate');
        return false;
    }
    
    console.log(`🎯 Found ${debugInfo.foundLegacyKeys.length} legacy keys to migrate`);
    
    let migrationSuccess = false;
    
    // Try to migrate from each found legacy key
    for (const key of debugInfo.foundLegacyKeys) {
        console.log(`🔄 Attempting migration from '${key}'...`);
        
        try {
            const legacyData = localStorage.getItem(key);
            let parsed = null;
            
            // Try multiple parsing methods
            if (typeof LZString !== 'undefined') {
                try {
                    const decompressed = LZString.decompress(legacyData);
                    if (decompressed) {
                        parsed = JSON.parse(decompressed);
                    }
                } catch (e) {
                    // Continue to direct parsing
                }
            }
            
            if (!parsed) {
                parsed = JSON.parse(legacyData);
            }
            
            console.log(`✅ Successfully parsed data from '${key}'`);
            console.log('Data to migrate:', parsed);
            
            // Perform migration
            const migrated = migrateLegacyStats(parsed);
            
            if (migrated && Object.keys(migrated).length > 0) {
                // Merge with existing userStats
                userStats = { ...userStats, ...migrated };
                
                // Save to new format
                saveUserStats();
                
                // Remove the legacy data
                localStorage.removeItem(key);
                console.log(`🗑️  Removed legacy data from '${key}'`);
                
                migrationSuccess = true;
                console.log('✅ Manual migration completed successfully!');
                
                // Update UI
                if (typeof updateDashboardStats === 'function') {
                    updateDashboardStats();
                    console.log('🔄 Dashboard updated');
                }
                
                break; // Stop after first successful migration
                
            } else {
                console.warn(`❌ Migration from '${key}' produced empty result`);
            }
            
        } catch (e) {
            console.error(`❌ Failed to migrate from '${key}':`, e);
            continue;
        }
    }
    
    if (migrationSuccess) {
        console.log('🎉 MIGRATION COMPLETED SUCCESSFULLY');
        console.log('Final userStats:', userStats);
    } else {
        console.log('❌ MIGRATION FAILED - No valid data could be migrated');
    }
    
    return migrationSuccess;
}

// Function to completely reset statistics (emergency use)
function resetAllStats() {
    console.log('🚨 RESETTING ALL STATISTICS');
    
    // Clear localStorage
    const allKeys = Object.keys(localStorage);
    const quizKeys = allKeys.filter(key => 
        key.includes('quiz') || 
        key.includes('stats') || 
        key === 'ls' ||
        key === 'userStats'
    );
    
    quizKeys.forEach(key => {
        localStorage.removeItem(key);
        console.log(`🗑️  Removed '${key}'`);
    });
    
    // Reset userStats object
    userStats = {
        version: STATS_VERSION,
        totalTests: 0,
        totalQuestionsAnswered: 0,
        totalCorrectAnswers: 0,
        totalTimeSpent: 0,
        testHistory: [],
        categoryPerformance: {},
        weakQuestions: [],
        streakData: {
            current: 0,
            best: 0,
            lastTestDate: null
        },
        achievements: [],
        firstTestDate: null,
        lastTestDate: null
    };
    
    // Save fresh stats
    saveUserStats();
    
    // Update UI
    if (typeof updateDashboardStats === 'function') {
        updateDashboardStats();
    }
    
    console.log('✅ All statistics have been reset');
    return true;
}

// Make debug functions available globally for console access
window.debugStorageAndMigration = debugStorageAndMigration;
window.manualMigration = manualMigration;
window.resetAllStats = resetAllStats;
window.performComprehensiveLegacySearch = performComprehensiveLegacySearch;
window.cleanupLegacyData = cleanupLegacyData;
