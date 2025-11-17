console.log("Login script loaded.");

async function handleLogin(evt) {
    evt.preventDefault();

    const studentId = document.getElementById("studentId").value.trim();
    const password = document.getElementById("password").value.trim();
    const errorBox = document.getElementById("loginError");

    errorBox.classList.add("hidden");

    if (studentId.length !== 7) {
        errorBox.textContent = "Student ID must be 7 digits.";
        errorBox.classList.remove("hidden");
        return;
    }

    // Authenticate via Supabase Auth
    const { data, error } = await supabase.auth.signInWithPassword({
        email: `${studentId}@ecobirla.student`, // virtual email login
        password: password
    });

    if (error) {
        errorBox.textContent = "Invalid Student ID or Password.";
        errorBox.classList.remove("hidden");
        return;
    }

    console.log("Logged in:", data.user);

    // Redirect after successful login
    window.location.href = "index.html";
}
