// ==================================
// ADMIN DASHBOARD
// ==================================

// CHECK ADMIN ACCESS
const adminAuthenticated = sessionStorage.getItem("adminAuthenticated");

if (adminAuthenticated !== "true") {
    window.location.href = "admin-login.html";
}

const subjectButtons = document.querySelectorAll(".subject-button");


// ==================================
// SUBJECT BUTTONS
// ==================================

subjectButtons.forEach((button) => {

    button.addEventListener("click", () => {

        const subject = button.dataset.subject;

        // Save the selected subject
        sessionStorage.setItem("adminSelectedSubject", subject);

        // Open the question upload page
        window.location.href = "add-question.html";

    });

});