// Statistics Tracking System
const STATS_COOKIE_NAME = 'uvt_quiz_stats';
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

// Storage Management Functions (using localStorage with cookie fallback)
function saveToStorage(name, value) {
    try {
        // Try localStorage first (works better for local development)
        if (typeof(Storage) !== "undefined") {
            localStorage.setItem(name, JSON.stringify(value));
            console.log('User statistics saved to localStorage');
            return;
        }
    } catch (e) {
        console.warn('localStorage not available, falling back to cookies:', e);
    }
    
    // Fallback to cookies
    try {
        const expires = new Date();
        expires.setTime(expires.getTime() + (365 * 24 * 60 * 60 * 1000));
        document.cookie = `${name}=${encodeURIComponent(JSON.stringify(value))};expires=${expires.toUTCString()};path=/`;
        console.log('User statistics saved to cookies');
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
                return JSON.parse(item);
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
                return JSON.parse(decodeURIComponent(c.substring(nameEQ.length, c.length)));
            }
        }
    } catch (e) {
        console.error("Error parsing cookie:", name, e);
    }
    return null;
}

function loadUserStats() {
    const savedStats = loadFromStorage(STATS_COOKIE_NAME);
    if (savedStats && savedStats.version === STATS_VERSION) {
        userStats = { ...userStats, ...savedStats };
        console.log('User statistics loaded successfully');
        console.log('Current stats:', userStats);
    } else {
        console.log('No valid statistics found, starting fresh');
        saveUserStats();
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
    console.log('Test result recorded:', testRecord);
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
        
        if (existingIndex >= 0) {
            userStats.weakQuestions[existingIndex].incorrectCount++;
            userStats.weakQuestions[existingIndex].lastIncorrectDate = new Date().toISOString();
        } else {
            userStats.weakQuestions.push({
                id: question.question_id,
                questionText: question.question_text,
                category: question.subtopic_name || question.parent_topic_name_origin,
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
        card.innerHTML = `
        <h3>${subtopic.subtopic_name}</h3>
        ${subtopic.parent_topic_name ? `<p style="font-size:0.8em; color:#555; margin-top: 5px;"><em>Topic: ${subtopic.parent_topic_name}</em></p>` : ''}
        <p style="margin-top: 10px;">${questionCount} question${questionCount !== 1 ? 's' : ''}</p>
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
            ${category.parent_topic_name ? `<p style="font-size:0.8em; color:#555; margin-top: 5px;"><em>Topic: ${category.parent_topic_name}</em></p>` : ''}
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
    
    // Set up quiz navigation variables
    currentQuestions = currentCategory.questions;
    totalQuestions = currentQuestions.length;
    currentQuestionIndex = 0;
    userAnswers = {};
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
    const userSelection = userAnswers[question.question_id] || [];
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
        if (question.question_syntax) questionCode.classList.add(`language-${question.question_syntax}`);
    }
    else { 
        questionCodeContainer.style.display = 'none';
        questionCode.textContent = '';
    }

    questionStatus.textContent = `${currentQuestionIndex + 1} / ${totalQuestions}`;

    // Update progress bar
    const progressPercentage = ((currentQuestionIndex + 1) / totalQuestions) * 100;
    progressFill.style.width = `${progressPercentage}%`;

    // --- Image Handling Start ---
    const imageContainer = document.getElementById('questionImageContainer');
    imageContainer.innerHTML = ''; // Clear previous image

    let categoryNameForImage = getCategoryNameForImage(currentCategory.subtopic_name || currentCategory.name || "DefaultCategory");
    
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

        const userAnswer = userAnswers[question.question_id];
        if (userAnswer && Array.isArray(userAnswer)) {
            if (userAnswer.includes(option.id)) {
                input.checked = true;
            }
        } else if (userAnswer === option.id) {
            input.checked = true;
        }

        input.onchange = () => selectAnswer(option.id, isMultipleChoice);

        if (isFeedbackMode) {
            input.disabled = true;
            optionDiv.classList.add('disabled-option');
        }

        const label = document.createElement('label');
        label.htmlFor = input.id;
        label.textContent = option.text || `Option ${option.id}`;
        label.classList.add('option-text');

        // Add click handler to the entire option div for better click detection
        optionDiv.addEventListener('click', function(e) {
            // Don't trigger if clicking on an image (they have their own handlers)
            if (e.target.tagName === 'IMG') {
                return;
            }
            
            // Don't trigger if in feedback mode
            if (isFeedbackMode) {
                return;
            }
            
            // Toggle the checkbox and trigger selection
            input.checked = !input.checked;
            selectAnswer(option.id, isMultipleChoice);
        });

        optionDiv.appendChild(input);
        optionDiv.appendChild(label);

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
            optionImgElement.style.border = '1px solid #ddd';
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
document.addEventListener('DOMContentLoaded', loadTestData);
// --- Image Zoom Functionality End ---

// Utility function to scroll to top
function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function saveCurrentAnswer() {
    if (!currentQuestions || currentQuestionIndex < 0 || currentQuestionIndex >= currentQuestions.length) {
        return;
    }
    
    const question = currentQuestions[currentQuestionIndex];
    if (!question) return;
    
    const questionName = `question_${question.question_id || currentQuestionIndex}`;
    const selectedOption = getSelectedOptionValue(questionName);
    
    if (selectedOption !== undefined) {
        userAnswers[question.question_id] = selectedOption;
    }
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
    const questionId = question.question_id;

    // Always allow multiple selections to hide question type
    // Initialize answer array if it doesn't exist
    if (!userAnswers[questionId]) userAnswers[questionId] = [];
    
    // Toggle selection for all questions (behave like checkboxes)
    const index = userAnswers[questionId].indexOf(optionId);
    if (index > -1) {
        userAnswers[questionId].splice(index, 1);
    } else {
        userAnswers[questionId].push(optionId);
    }

    document.querySelectorAll(`#optionsContainer .option`).forEach(optDiv => {
        const input = optDiv.querySelector('input');
        if (input.checked) optDiv.classList.add('selected');
        else optDiv.classList.remove('selected');
    });
    updateNextButtonState(); // Update button state after selection
}

function showAnswerFeedback() {
    const question = currentCategory.questions[currentQuestionIndex];
    const userSelection = userAnswers[question.question_id] || [];
    const correctAnswers = question.correct_answers;

    document.querySelectorAll('#optionsContainer .option').forEach(optDiv => {
        const input = optDiv.querySelector('input');
        input.disabled = true;
        optDiv.classList.add('disabled-option');

        const optionId = input.value;
        const isCorrect = correctAnswers.includes(optionId);
        const isSelected = userSelection.includes(optionId);

        if (isCorrect) { 
            optDiv.classList.add('reveal-correct');
        }
        if (isSelected) { 
            if (isCorrect) {
                optDiv.classList.add('correct-selection');
            } else {
                optDiv.classList.add('incorrect-selection');
            }
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

function handleQuitTest() {
    if (confirm("Are you sure you want to quit this test? Your progress will be lost.")) {
        stopTimer();
        isRandomTestActive = false;
        resetTest();
    }
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
        const userAnswer = userAnswers[question.question_id] || [];
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
        summaryHTML += `<p style="color: #28a745;">🔥 Current Streak: <strong>${userStats.streakData.current}</strong> passed tests</p>`;
    } else {
        summaryHTML += `<p style="color: #dc3545;">Streak reset. Keep practicing!</p>`;
    }
    
    document.getElementById('resultsSummary').innerHTML = summaryHTML;
    prepareReview();
}

function prepareReview() {
    const reviewContainer = document.getElementById('answerReview');
    reviewContainer.innerHTML = '<h3 style="margin-bottom: 20px;">Answer Review</h3>';
    
    console.log('=== PREPARE REVIEW DEBUG ===');
    console.log('Category:', currentCategory.subtopic_name);
    console.log('Total questions in category:', currentCategory.questions.length);
    console.log('userAnswers object keys:', Object.keys(userAnswers));
    console.log('userAnswers object:', userAnswers);
    
    let displayedQuestions = 0;
    let questionsWithAnswers = 0;
    let questionsWithoutAnswers = 0;
    
    currentCategory.questions.forEach((question, index) => {
        const userAnswer = userAnswers[question.question_id] || [];
        const correctAnswer = question.correct_answers;
        
        console.log(`Question ${index + 1} (ID: ${question.question_id}):`, {
            questionText: question.question_text.substring(0, 50) + '...',
            userAnswer: userAnswer,
            correctAnswer: correctAnswer,
            userAnswerLength: userAnswer.length,
            hasUserAnswer: userAnswer.length > 0
        });
        
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
            originInfo = `<p style="font-size:0.8em; color:#777;"><em>Origin: ${question.parent_topic_name_origin} > ${question.subtopic_name_origin}</em></p>`;
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
    
    console.log('=== REVIEW SUMMARY ===');
    console.log('Questions displayed:', displayedQuestions);
    console.log('Questions with answers:', questionsWithAnswers);
    console.log('Questions without answers:', questionsWithoutAnswers);
    console.log('=== END DEBUG ===');
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
    
    const weakAreasHtml = userStats.weakQuestions
        .slice(0, 15) // Show top 15 weak questions
        .map((weakQuestion, index) => `
            <div class="weak-question-item">
                <div class="weak-question-info">
                    <h4>Question ${index + 1}</h4>
                    <p>${weakQuestion.questionText.substring(0, 100)}${weakQuestion.questionText.length > 100 ? '...' : ''}</p>
                    <small>Category: ${weakQuestion.category}</small>
                </div>
                <div class="weak-question-stats">
                    <span class="incorrect-count">❌ ${weakQuestion.incorrectCount}</span>
                    <small>Last missed: ${new Date(weakQuestion.lastIncorrectDate).toLocaleDateString()}</small>
                </div>
            </div>
        `).join('');
    
    container.innerHTML = weakAreasHtml;
}

function calculateTrend(recentScores) {
    if (recentScores.length < 2) return 0;
    
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
