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
        'Formal Languages and Automata Theory': 'FormalLanguagesandAutomataTheory',
        'Graph Theory and Combinatorics': 'GraphTheoryandCombinatorics',
        'Software Applications Design': 'SoftwareApplicationsDesign',
        'C Language': 'CLanguage',
        'C++ Language': 'CPPLanguage',
        'Java Language': 'JavaLanguage',
        'Python Language': 'PythonLanguage',
        'Databases': 'Databases',
        'Computational Logic': 'ComputationalLogic'
    };
    
    return nameMap[categoryName] || categoryName.replace(/\s+/g, '').replace(/[^a-zA-Z0-9]/g, '');
}

async function loadTestData() {
   document.getElementById('dashboardLoading').style.display = 'block';
   try {
     const res = await fetch('questions.json');
     if (!res.ok) {
         const errorMsg = `Failed to fetch questions.json: HTTP ${res.status} ${res.statusText}`;
         console.error(errorMsg);
         document.getElementById('categoryGrid').innerHTML = `<div class="error">${errorMsg}. Ensure questions.json is accessible.</div>`;
         document.getElementById('dashboardScreen').innerHTML = `<div class="error">${errorMsg}. Check console.</div>`;
         throw new Error(`HTTP error! status: ${res.status}`);
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
}

function showDashboard() {
    document.getElementById('dashboardScreen').style.display = 'block';
    document.getElementById('categoryScreen').style.display = 'none';
    document.getElementById('testScreen').style.display = 'none';
    document.getElementById('resultsScreen').style.display = 'none';
    stopTimer(); // Ensure timer is stopped if returning to dashboard
}

function showCategorySelectionScreen() {
    document.getElementById('dashboardScreen').style.display = 'none';
    document.getElementById('categoryScreen').style.display = 'block';
    document.getElementById('testScreen').style.display = 'none';
    document.getElementById('resultsScreen').style.display = 'none';
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
    const optionsContainer = document.getElementById('optionsContainer');
    const questionStatus = document.getElementById('questionStatus');
    const progressFill = document.getElementById('progressFill');

    questionText.textContent = question.question_text;
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

        imgElement.onload = function() {
            imgElement.style.display = 'block';
        };
        imgElement.onerror = function() {
            imgElement.style.display = 'none';
        };
        imgElement.src = imagePath;
        imageContainer.appendChild(imgElement);
    }
    // --- Image Handling End ---

    optionsContainer.innerHTML = '';
    const isMultipleChoice = question.correct_answers.length > 1;

    question.options.forEach(option => {
        const optionDiv = document.createElement('div');
        optionDiv.classList.add('option');

        const inputType = isMultipleChoice ? 'checkbox' : 'radio';
        const input = document.createElement('input');
        input.type = inputType;
        const qIdForInput = question.question_id || currentQuestionIndex;
        input.name = `question_${qIdForInput}`;
        input.id = `option_${qIdForInput}_${option.id}`;
        input.value = option.id;

        const userAnswer = userAnswers[question.question_id];
        if (userAnswer) {
            if (isMultipleChoice && userAnswer.includes(option.id)) {
                input.checked = true;
            } else if (!isMultipleChoice && userAnswer === option.id) {
                input.checked = true;
            }
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
            if (modal) modal.style.display = 'none';
        }
    }

    // Close modal when clicking outside the image
    if (modal) {
        modal.onclick = function(event) {
            if (event.target === modal) { // Check if the click is on the modal background itself
                modal.style.display = 'none';
            }
        }
    }

    // Also close modal with Escape key
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape' && modal && modal.style.display === 'flex') {
            modal.style.display = 'none';
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

// Initialize image zoom when DOM is ready
document.addEventListener('DOMContentLoaded', initializeImageZoom);
// --- Image Zoom Functionality End ---

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
    const question = currentQuestions[currentQuestionIndex]; // Get current question to check if it's multiple choice
    const isMultipleChoice = question && question.correct_answers && question.correct_answers.length > 1;

    if (isMultipleChoice) {
        const selectedValues = [];
        inputs.forEach(input => {
            if (input.checked) {
                selectedValues.push(input.value);
            }
        });
        return selectedValues.length > 0 ? selectedValues : undefined; // Return array or undefined if none selected
    } else {
        for (let i = 0; i < inputs.length; i++) {
            if (inputs[i].checked) {
                return inputs[i].value;
            }
        }
    }
    return undefined; // Return undefined if no option is selected for single choice
}


function selectAnswer(optionId, isMultipleChoice) {
    if (isFeedbackMode) return; 

    const question = currentCategory.questions[currentQuestionIndex];
    const questionId = question.question_id;

    if (isMultipleChoice) {
        if (!userAnswers[questionId]) userAnswers[questionId] = [];
        const index = userAnswers[questionId].indexOf(optionId);
        if (index > -1) userAnswers[questionId].splice(index, 1);
        else userAnswers[questionId].push(optionId);
    } else {
        userAnswers[questionId] = [optionId];
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

    const testEndTime = new Date();
    const timeTaken = Math.floor((testEndTime - testStartTime) / 1000);
    let correctCount = 0;
    const totalQuestions = currentCategory.questions.length;

    currentCategory.questions.forEach(question => {
        const userAnswer = userAnswers[question.question_id] || [];
        const correctAnswer = question.correct_answers;
        const sortedUserAnswer = [...userAnswer].sort();
        const sortedCorrectAnswer = [...correctAnswer].sort();
        if (sortedUserAnswer.length === sortedCorrectAnswer.length &&
            sortedUserAnswer.every((val, index) => val === sortedCorrectAnswer[index])) {
            correctCount++;
        }
    });

    const score = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;

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
    document.getElementById('resultsSummary').innerHTML = summaryHTML;
    prepareReview();
}

function prepareReview() {
    const reviewContainer = document.getElementById('answerReview');
    reviewContainer.innerHTML = '<h3 style="margin-bottom: 20px;">Answer Review</h3>';
    currentCategory.questions.forEach((question, index) => {
        const userAnswer = userAnswers[question.question_id] || [];
        const correctAnswer = question.correct_answers;
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

window.onload = loadTestData;
