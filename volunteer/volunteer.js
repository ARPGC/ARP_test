import { supabase } from '../supabase-client.js';
import { state, CLOUDINARY_API_URL, CLOUDINARY_UPLOAD_PRESET } from '../state.js';

let html5QrcodeScanner = null;
let currentScannedStudentId = null;
let currentGpsCoords = null;
let uploadedProofUrl = null;
let isUploading = false;

// ==========================================
// 1. UI HELPERS (Inlined for reliability)
// ==========================================

const showToast = (message, type = 'success') => {
    const existingToast = document.getElementById('v-toast');
    if (existingToast) existingToast.remove();

    const toast = document.createElement('div');
    toast.id = 'v-toast';
    
    // UI: Proper colors and bottom-center positioning
    const bgClass = type === 'error' ? 'bg-red-600' : type === 'warning' ? 'bg-amber-500' : 'bg-emerald-600';
    
    toast.className = `fixed bottom-24 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-3 px-6 py-4 rounded-full text-white shadow-2xl animate-slideUp ${bgClass} transition-all duration-300 min-w-[300px] justify-center backdrop-blur-md`;
    
    // Icon selection
    let icon = type === 'success' ? '✓' : type === 'error' ? '✕' : '!';
    
    toast.innerHTML = `
        <span class="text-lg font-bold">${icon}</span>
        <span class="text-sm font-bold tracking-wide">${message}</span>
    `;

    document.body.appendChild(toast);

    // Auto-remove after 3 seconds
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translate(-50%, 20px)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
};

const uploadToCloudinary = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    
    const res = await fetch(CLOUDINARY_API_URL, { method: 'POST', body: formData });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    return data.secure_url;
};

// ==========================================
// 2. INITIALIZATION
// ==========================================

export const initVolunteerPanel = () => {
    if (!document.getElementById('volunteer-panel')) return;
    
    console.log("Initializing Volunteer Panel...");

    // 1. Weight Input - Instant Calc
    const weightInput = document.getElementById('v-weight');
    if (weightInput) {
        weightInput.oninput = (e) => calculateMetrics(e.target.value);
        if (weightInput.value) calculateMetrics(weightInput.value);
    }
    
    // 2. File Input
    const proofInput = document.getElementById('v-proof-upload');
    if (proofInput) {
        proofInput.onchange = handleProofSelect;
    }

    // 3. Form Submission
    const form = document.getElementById('plastic-submission-form');
    if (form) {
        form.onsubmit = submitPlasticEntry;
    }
    
    // Reset Labels
    document.getElementById('v-calc-points').textContent = '0';
    document.getElementById('v-calc-co2').textContent = '0.00';
};

// ==========================================
// 3. CORE LOGIC
// ==========================================

const calculateMetrics = (value) => {
    const weight = parseFloat(value);

    if (isNaN(weight) || weight <= 0) {
        document.getElementById('v-calc-points').textContent = '0';
        document.getElementById('v-calc-co2').textContent = '0.00';
        return;
    }
    
    // Rule: 1 KG = 100 Points | 1 KG = 1.60 CO2
    const points = Math.round(weight * 100);
    const co2 = (weight * 1.60).toFixed(2);

    document.getElementById('v-calc-points').textContent = points;
    document.getElementById('v-calc-co2').textContent = co2;
};

const handleProofSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // --- UI: Show Preview ---
    const img = document.getElementById('v-proof-img');
    const container = document.getElementById('v-proof-preview-container');
    const retakeBtn = document.getElementById('v-retake-btn');
    
    img.src = URL.createObjectURL(file);
    img.classList.remove('hidden');
    container.classList.add('hidden');
    retakeBtn.classList.remove('hidden'); // Hide retake during upload

    // --- UI: Create Overlay Loader ---
    // Remove existing loader if any
    const existingLoader = document.getElementById('v-img-loader');
    if(existingLoader) existingLoader.remove();

    // Create new loader overlay
    const loader = document.createElement('div');
    loader.id = 'v-img-loader';
    loader.className = 'absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white z-10 rounded-xl backdrop-blur-sm transition-all duration-300';
    loader.innerHTML = `
        <svg class="animate-spin h-8 w-8 text-white mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span class="text-xs font-bold uppercase tracking-wider">Uploading...</span>
    `;
    img.parentNode.appendChild(loader);

    // --- LOGIC: Start Upload ---
    isUploading = true;
    uploadedProofUrl = null;
    toggleSubmitButton(false, "Uploading Photo...");
    
    try {
        const url = await uploadToCloudinary(file);
        uploadedProofUrl = url;
        
        // Success UI
        loader.innerHTML = `
            <div class="bg-green-500 rounded-full p-2 mb-2">
                <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg>
            </div>
            <span class="text-xs font-bold text-green-400 uppercase tracking-wider">Uploaded</span>
        `;
        
        // Fade out loader after 1.5s
        setTimeout(() => {
            loader.style.opacity = '0';
            setTimeout(() => loader.remove(), 300);
            retakeBtn.classList.remove('hidden'); // Show retake button now
        }, 1500);

    } catch (err) {
        console.error(err);
        showToast("Photo upload failed. Check internet.", "error");
        
        // Error UI
        loader.innerHTML = `
            <div class="bg-red-500 rounded-full p-2 mb-2">
                <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M6 18L18 6M6 6l12 12"></path></svg>
            </div>
            <span class="text-xs font-bold text-red-400">Failed</span>
        `;
        retakeBtn.classList.remove('hidden');
    } finally {
        isUploading = false;
        toggleSubmitButton(true);
    }
};

const toggleSubmitButton = (enabled, text = null) => {
    const btn = document.getElementById('v-submit-btn');
    if (!btn) return;
    btn.disabled = !enabled;
    
    if (text) {
        // Retain icon structure
        btn.innerHTML = `<svg class="animate-spin h-5 w-5 mr-2 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> ${text}`;
    } else {
        btn.innerHTML = `Submit Entry`;
    }
};

// ==========================================
// 4. SCANNER & GPS
// ==========================================

window.openPlasticCollection = () => {
    document.getElementById('volunteer-menu').classList.add('hidden');
    document.getElementById('volunteer-work-area').classList.remove('hidden');
    clearForm();
    startScanner();
};

window.resetVolunteerForm = () => {
    stopScanner();
    document.getElementById('volunteer-work-area').classList.add('hidden');
    document.getElementById('volunteer-menu').classList.remove('hidden');
    document.getElementById('scanner-container').classList.add('hidden');
    document.getElementById('collection-form').classList.add('hidden');
    clearForm();
};

const clearForm = () => {
    const form = document.getElementById('plastic-submission-form');
    if (form) form.reset();
    
    // UI Resets
    const img = document.getElementById('v-proof-img');
    img.classList.add('hidden');
    img.src = '';
    
    // Clear loaders
    const loader = document.getElementById('v-img-loader');
    if(loader) loader.remove();

    document.getElementById('v-proof-preview-container').classList.remove('hidden');
    document.getElementById('v-retake-btn').classList.add('hidden');
    document.getElementById('v-calc-points').textContent = '0';
    document.getElementById('v-calc-co2').textContent = '0.00';
    
    currentScannedStudentId = null;
    currentGpsCoords = null;
    uploadedProofUrl = null;
    isUploading = false;
    toggleSubmitButton(true);
};

const startScanner = () => {
    document.getElementById('scanner-container').classList.remove('hidden');
    document.getElementById('collection-form').classList.add('hidden');

    if (html5QrcodeScanner) return;

    if (typeof Html5Qrcode === 'undefined') {
        setTimeout(startScanner, 500); 
        return;
    }

    try {
        html5QrcodeScanner = new Html5Qrcode("qr-reader");
        html5QrcodeScanner.start(
            { facingMode: "environment" }, 
            { fps: 10, qrbox: { width: 250, height: 250 } },
            onScanSuccess,
            () => {}
        );
    } catch (e) { console.error(e); }
};

const onScanSuccess = async (decodedText) => {
    stopScanner();
    const studentId = decodedText.trim();
    
    showToast("Fetching Student Details...", "info");

    const { data, error } = await supabase
        .from('users')
        .select('id, full_name, profile_img_url, student_id')
        .eq('student_id', studentId)
        .single();

    if (error || !data) {
        showToast("Student not found!", "error");
        setTimeout(startScanner, 2000);
        return;
    }

    currentScannedStudentId = data.id;
    document.getElementById('v-student-name').textContent = data.full_name;
    document.getElementById('v-student-id').textContent = `ID: ${data.student_id}`;
    document.getElementById('v-student-img').src = data.profile_img_url || "https://placehold.co/100x100?text=User";

    document.getElementById('scanner-container').classList.add('hidden');
    document.getElementById('collection-form').classList.remove('hidden');
    
    getGPSLocation();
};

window.closeScanner = () => {
    stopScanner();
    window.resetVolunteerForm();
};

const stopScanner = () => {
    if (html5QrcodeScanner) {
        html5QrcodeScanner.stop().then(() => {
            html5QrcodeScanner.clear();
            html5QrcodeScanner = null;
        });
    }
};

const getGPSLocation = () => {
    const statusEl = document.getElementById('v-gps-status');
    if (!navigator.geolocation) {
        statusEl.innerHTML = `<span class="text-red-500">GPS Not Supported</span>`;
        return;
    }
    statusEl.innerHTML = `<span class="text-orange-500 font-medium">Acquiring GPS...</span>`;
    
    navigator.geolocation.getCurrentPosition(
        (pos) => {
            currentGpsCoords = `${pos.coords.latitude},${pos.coords.longitude}`;
            statusEl.innerHTML = `<span class="text-green-600 font-bold">✓ Location Locked</span>`;
        },
        () => { statusEl.innerHTML = `<span class="text-red-500">GPS Failed</span>`; }
    );
};

// ==========================================
// 5. SUBMIT
// ==========================================

const submitPlasticEntry = async (e) => {
    e.preventDefault();

    if (isUploading) {
        showToast("Wait for photo upload to finish...", "warning");
        return;
    }
    if (!uploadedProofUrl) {
        showToast("Photo proof required!", "warning");
        return;
    }
    if (!currentScannedStudentId) {
        showToast("Student ID missing", "error");
        return;
    }

    const weight = parseFloat(document.getElementById('v-weight').value);
    const program = document.getElementById('v-program').value;
    const location = document.getElementById('v-location').value;

    toggleSubmitButton(false, "Saving Entry...");

    const { error } = await supabase.from('plastic_submissions').insert({
        user_id: currentScannedStudentId,
        weight_kg: weight,
        plastic_type: 'PET',
        status: 'pending',
        verified_by: state.currentUser.id,
        verified_at: new Date().toISOString(),
        location: location,
        volunteer_coords: currentGpsCoords || 'Unknown',
        submission_url: uploadedProofUrl,
        program: program
    });

    if (error) {
        console.error(error);
        showToast("Submission Failed", "error");
    } else {
        showToast("Submission Success! 🌿", "success");
        window.resetVolunteerForm();
    }
    
    toggleSubmitButton(true);
};
