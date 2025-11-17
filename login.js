import { supabase } from "./supabase-client.js";

console.log("Login script loaded.");

document.getElementById("loginForm").addEventListener("submit", handleLogin);

async function handleLogin(evt) {
    evt.preventDefault();

    const studentId = document.getElementById("studentId").value.trim();
    const password = document.getElementById("password").value.trim();
    const errorBox = document.getElementById("loginError");
    const loginBtn = document.getElementById("loginBtn");

    errorBox.classList.add("hidden");

    if (studentId.length !== 7) {
        return showError("Student ID must be 7 digits.");
    }

    loginBtn.disabled = true;
    loginBtn.innerText = "Logging in...";

    // Student ID → Virtual Email Login
    const email = `${studentId}@ecobirla.student`;

    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
    });

    if (error) {
        showError("Invalid Student ID or Password.");
        loginBtn.disabled = false;
        loginBtn.innerText = "Login";
        return;
    }

    console.log("Logged in user:", data.user);

    // Redirect to main app
    window.location.href = "index.html";
}

function showError(message) {
    const errorBox = document.getElementById("loginError");
    errorBox.textContent = message;
    errorBox.classList.remove("hidden");
}
