// ======================================
// ADD QUESTION
// ======================================

import { supabase } from "./supabase.js";


// ======================================
// CHECK ADMIN ACCESS
// ======================================

const adminAuthenticated = sessionStorage.getItem("adminAuthenticated");

if (adminAuthenticated !== "true") {
    window.location.href = "admin-login.html";
}


// ======================================
// QUIZ ID
// ======================================

const quizId = 2;


// ======================================
// GET FORM ELEMENTS
// ======================================

const questionForm = document.getElementById("questionForm");
const questionInput = document.getElementById("question");
const optionAInput = document.getElementById("optionA");
const optionBInput = document.getElementById("optionB");
const optionCInput = document.getElementById("optionC");
const optionDInput = document.getElementById("optionD");
const correctAnswerInput = document.getElementById("correctAnswer");
const explanationInput = document.getElementById("explanation");
const questionMessage = document.getElementById("questionMessage");
const uploadButton = document.getElementById("uploadQuestion");


// ======================================
// FORM SUBMISSION
// ======================================

questionForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    // ======================================
    // GET VALUES
    // ======================================

    const question = questionInput.value.trim();
    const optionA = optionAInput.value.trim();
    const optionB = optionBInput.value.trim();
    const optionC = optionCInput.value.trim();
    const optionD = optionDInput.value.trim();
    const correctAnswer = correctAnswerInput.value;
    const explanation = explanationInput.value.trim();


    // ======================================
    // CHECK REQUIRED FIELDS
    // ======================================

    if (
        !question ||
        !optionA ||
        !optionB ||
        !optionC ||
        !optionD ||
        !correctAnswer
    ) {
        questionMessage.textContent = "Please fill in all required fields.";
        questionMessage.style.color = "#dc2626";
        return;
    }


    // ======================================
    // PREPARE QUESTION DATA
    // ======================================

    const questionData = {
        quiz_id: quizId,
        question_text: question,
        option_a: optionA,
        option_b: optionB,
        option_c: optionC,
        option_d: optionD,
        "correct-answer": correctAnswer, // Uses fixed variable name matching DOM element
        explanation: explanation
    };


    // ======================================
    // DISABLE BUTTON
    // ======================================

    uploadButton.disabled = true;
    uploadButton.style.opacity = "0.7";
    uploadButton.innerHTML = "Uploading...";
    questionMessage.textContent = "";


    try {
        // ======================================
        // SAVE TO SUPABASE
        // ======================================

        const { error } = await supabase
            .from("questions")
            .insert([questionData]);

        if (error) {
            throw error;
        }

        // ======================================
        // SUCCESS MESSAGE
        // ======================================

        questionMessage.textContent = "Question uploaded successfully.";
        questionMessage.style.color = "#16a34a";

        // Clear the form after successful upload
        questionForm.reset();

    } catch (error) {
        console.error("Question upload error:", error);

        questionMessage.textContent =
            error.message || "Unable to upload question. Please try again.";
        questionMessage.style.color = "#dc2626";

    } finally {
        // ======================================
        // ENABLE BUTTON AGAIN
        // ======================================

        uploadButton.disabled = false;
        uploadButton.style.opacity = "1";
        uploadButton.innerHTML = `
            <i data-lucide="upload"></i>
            Upload Question
        `;

        if (typeof lucide !== "undefined" && lucide.createIcons) {
            lucide.createIcons();
        }
    }
});