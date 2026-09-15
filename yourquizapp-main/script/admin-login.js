// ======================================
// ADMIN LOGIN
// ======================================

const adminLoginForm =
    document.getElementById("adminLoginForm");

const adminKeyInput =
    document.getElementById("adminKey");

const toggleAdminKey =
    document.getElementById("toggleAdminKey");

const adminMessage =
    document.getElementById("adminMessage");


// ======================================
// SHOW / HIDE PASSWORD
// ======================================

toggleAdminKey.addEventListener("click", () => {

    const isPassword =
        adminKeyInput.type === "password";

    adminKeyInput.type =
        isPassword ? "text" : "password";

    toggleAdminKey.innerHTML = isPassword
        ? '<i data-lucide="eye-off"></i>'
        : '<i data-lucide="eye"></i>';

    lucide.createIcons();

});


// ======================================
// ADMIN LOGIN
// ======================================

adminLoginForm.addEventListener("submit", async (event) => {

    event.preventDefault();

    const adminKey =
        adminKeyInput.value.trim();


    if (!adminKey) {

        adminMessage.textContent =
            "Please enter your admin pass key.";

        adminMessage.style.color =
            "#dc2626";

        return;

    }


    adminMessage.textContent =
        "Checking access...";

    adminMessage.style.color =
        "#2563eb";


    try {

        const response = await fetch("/api/admin-login", {

            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                adminKey: adminKey
            })

        });


        // Read the response as text first.
        // This prevents the JSON error when the response is empty.

        const responseText =
            await response.text();


        let result = {};

        if (responseText) {
            result = JSON.parse(responseText);
        }


        if (!response.ok || !result.success) {

            throw new Error(
                result.message ||
                "The admin API is not available on Live Server. Open the Vercel website to test the passkey."
            );

        }


        sessionStorage.setItem(
            "adminAuthenticated",
            "true"
        );


        adminMessage.textContent =
            "Access granted. Opening dashboard...";

        adminMessage.style.color =
            "#16a34a";


        setTimeout(() => {

            window.location.href =
                "admin.html";

        }, 700);


    } catch (error) {

        console.error(
            "Admin login error:",
            error
        );


        adminMessage.textContent =
            error.message ||
            "Unable to verify admin access.";

        adminMessage.style.color =
            "#dc2626";

    }

});