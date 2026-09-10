// ======================================
// GET LOGGED-IN STUDENT
// ======================================

const loggedInStudent =
    JSON.parse(
        localStorage.getItem(
            'loggedInStudent'
        )
    );


// ======================================
// CHECK LOGIN
// ======================================

if (!loggedInStudent) {

    window.location.href =
        'login.html';

}


// ======================================
// GET HTML ELEMENTS
// ======================================

const studentDisplay =
    document.getElementById(
        'student-display'
    );


const category =
    document.getElementById(
        'category'
    );


const subjectsContainer =
    document.getElementById(
        'subjects-container'
    );


const startQuizButton =
    document.getElementById(
        'start-quiz'
    );


const errorMessage =
    document.getElementById(
        'error-message'
    );


// ======================================
// DISPLAY STUDENT NAME
// ======================================

if (studentDisplay) {
    studentDisplay.textContent = loggedInStudent.name;
}


// ======================================
// SUBJECT LIST
// ======================================

const subjects = {

    science: [

        'Use of English',
        'Mathematics',
        'Biology',
        'Chemistry',
        'Physics',
        'Agricultural Science'

    ],


    commercial: [

        'Use of English',
        'Mathematics',
        'Economics',
        'Government',
        'Accounting',
        'Commerce'

    ],


    art: [

        'Use of English',
        'Literature in English',
        'Government',
        'Economics',
        'CRS',
        'History'

    ]

};


// ======================================
// SHOW SUBJECTS
// ======================================

if (category) {
    category.addEventListener(
        'change',
        function () {

            const selectedCategory =
                category.value;


            subjectsContainer.innerHTML =
                '';


            errorMessage.textContent =
                '';


            if (
                selectedCategory === ''
            ) {

                return;

            }


            subjects[
                selectedCategory
            ].forEach(
                function (subject) {

                    const label =
                        document.createElement(
                            'label'
                        );


                    label.innerHTML = `

                        <input
                            type="checkbox"
                            value="${subject}"
                        >

                        ${subject}

                    `;


                    const checkbox =
                        label.querySelector(
                            'input'
                        );


                    checkbox.addEventListener(
                        'change',
                        function () {

                            const selectedCount =
                                document.querySelectorAll(
                                    '#subjects-container input:checked'
                                ).length;


                            // ==================================
                            // MAXIMUM 4 SUBJECTS
                            // ==================================

                            if (
                                selectedCount > 4
                            ) {

                                checkbox.checked =
                                    false;


                                errorMessage.textContent =
                                    'Only 4 subjects are required. Please remove one subject before selecting another.';


                                return;

                            }


                            errorMessage.textContent =
                                '';

                        }
                    );


                    subjectsContainer.appendChild(
                        label
                    );

                }
            );

        }
    );
}


// ======================================
// START QUIZ
// ======================================

if (startQuizButton) {
    startQuizButton.addEventListener(
        'click',
        function () {

            errorMessage.textContent =
                '';


            const selectedSubjects =
                document.querySelectorAll(
                    '#subjects-container input:checked'
                );


            // ==================================
            // CHECK CATEGORY
            // ==================================

            if (
                category.value === ''
            ) {

                errorMessage.textContent =
                    'Please select your category.';

                return;

            }


            // ==================================
            // CHECK EXACTLY 4 SUBJECTS
            // ==================================

            if (
                selectedSubjects.length !== 4
            ) {

                errorMessage.textContent =
                    'Please select exactly 4 subjects.';

                return;

            }


            // ==================================
            // GET SELECTED SUBJECTS
            // ==================================

            const chosenSubjects = [];


            selectedSubjects.forEach(
                function (subject) {

                    chosenSubjects.push(
                        subject.value
                    );

                }
            );


            // ==================================
            // USE OF ENGLISH COMPULSORY
            // ==================================

            if (
                !chosenSubjects.includes(
                    'Use of English'
                )
            ) {

                errorMessage.textContent =
                    'Use of English is compulsory. Please select it.';

                return;

            }


            // ==================================
            // CREATE STUDENT QUIZ DATA
            // ==================================

            const studentData = {

                id:
                    loggedInStudent.id,

                name:
                    loggedInStudent.name,

                username:
                    loggedInStudent.username,

                category:
                    category.value,

                subjects:
                    chosenSubjects

            };


            // ==================================
            // CREATE & SAVE SOLO QUIZ SESSION DATA
            // ==================================

            const joinedQuiz = {
                quizId: 'solo_' + Date.now(),
                quizTitle: `${category.value.toUpperCase()} Practice Exam`,
                studentName: loggedInStudent.name,
                isSolo: true,       // Explicitly enables Solo Mode
                is_solo: true,      // Database compatibility flag
                mode: 'solo',       // Database compatibility mode flag
                status: 'active',   // Bypasses waiting status
                category: category.value,
                subjects: chosenSubjects
            };


            // ==================================
            // SAVE TO LOCALSTORAGE
            // ==================================

            localStorage.setItem(
                'studentData',
                JSON.stringify(
                    studentData
                )
            );

            localStorage.setItem(
                'joinedQuiz',
                JSON.stringify(
                    joinedQuiz
                )
            );


            // ==================================
            // CLEAR OLD QUIZ DATA
            // ==================================

            localStorage.removeItem(
                'quizAnswers'
            );


            localStorage.removeItem(
                'quizScores'
            );


            localStorage.removeItem(
                'studentResult'
            );


            // ==================================
            // OPEN QUIZ
            // ==================================

            window.location.href =
                'quiz.html';

        }
    );
}