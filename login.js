import { supabase } from './supabase-client.js';

let loginForm;
let loginButton;
let authMessage;

function showMessage(message, isError = true) {
    if (authMessage) {
        authMessage.textContent = message;
        authMessage.className = isError ? 'text-red-500 text-sm text-center mb-4 h-5 font-bold' : 'text-green-500 text-sm text-center mb-4 h-5 font-bold';
    }
}

function setLoading(button, isLoading) {
    if (!button) return;
    const btnText = button.querySelector('.btn-text');
    const loader = button.querySelector('i');
    
    if (isLoading) {
        button.disabled = true;
        // FIX: Don't hide the text, just change it
        if (btnText) btnText.textContent = "Signing In..."; 
        if (loader) loader.classList.remove('hidden');
    } else {
        button.disabled = false;
        // Restore original text
        if (btnText) btnText.textContent = "Sign In";
        if (loader) loader.classList.add('hidden');
    }
}

async function handleLogin(event) {
    event.preventDefault();
    setLoading(loginButton, true);
    showMessage('', false);

    const studentId = document.getElementById('login-studentid').value;
    const password = document.getElementById('login-password').value;

    const { data, error } = await supabase.functions.invoke('login-with-studentid', {
        body: { studentId, password },
    });

    if (error) {
        console.error("Function error:", error);
        showMessage("An error occurred. Please try again.");
    } else if (data.error) {
        showMessage(data.error);
    } else if (data.session) {
        const { error: sessionError } = await supabase.auth.setSession(data.session);
        if (sessionError) {
            console.error("Session set error:", sessionError);
            showMessage("Login failed. Please try again.");
        } else {
            window.location.href = 'index.html';
        }
    } else {
        showMessage("An unexpected error occurred.");
    }
    
    setLoading(loginButton, false);
}

async function checkUserSession() {
    const { data } = await supabase.auth.getSession();
    if (data.session) {
        window.location.href = 'index.html';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    loginForm = document.getElementById('login-form');
    loginButton = document.getElementById('login-button');
    authMessage = document.getElementById('auth-message');

    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    checkUserSession();
});
