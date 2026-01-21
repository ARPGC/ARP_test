import { supabase } from '../supabase-client.js';
import { state, CLOUDINARY_API_URL, CLOUDINARY_UPLOAD_PRESET } from '../state.js';

let html5QrcodeScanner = null;
let currentScannedStudentId = null;
let currentGpsCoords = null;
let uploadedProofUrl = null;
let isUploading = false;

// ==========================================
// 1. INTERNAL UTILITIES (Inlined to prevent crash)
// ==========================================

const showToast = (message, type = 'success') => {
    const existingToast = document.getElementById('v-toast');
    if (existingToast) existingToast.remove();

    const toast = document.createElement('div');
    toast.id = 'v-toast';
    
    const bgClass = type === 'error' ? 'bg-red-600' : type === 'warning' ? 'bg-amber-500' : 'bg-emerald-600';
    
    toast.className = `fixed bottom-10 left-1/2 -translate-x-1/2 z-[150] flex items-center gap-3 px-6 py-3.5 rounded-2xl text-white shadow-2xl animate-slideUp ${bgClass} transition-all duration-300 min-w-[280px] justify-center`;
    toast.innerHTML = `<span class="text-sm font-bold tracking-tight">${message}</span>`;

    document.body.appendChild(toast);
    setTimeout(() => { toast.remove(); }, 3000);
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

    // 1. Weight Input - Direct Binding
    const weightInput = document.getElementById('v-weight');
    if (weightInput) {
        // Use 'oninput' to prevent multiple listeners piling up
        weightInput.oninput = (e) => calculateMetrics(e.target.value);
        // Trigger once in case there's a value
        if (weightInput.value) calculateMetrics(weightInput.value);
    }
    
    // 2. File Input - Direct Binding
    const proofInput = document.getElementById('v-proof-upload');
    if (proofInput) {
        proofInput.onchange = handleProofSelect;
    }

    // 3. Form Submission - Direct Binding
    const form = document.getElementById('plastic-submission-form');
    if (form) {
        form.onsubmit = submitPlasticEntry;
    }
    
    // 4. Manual Metric Reset
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
    
    // Logic: 1 KG = 100 Points | 1 KG = 1.60 CO2
    const points = Math.round(weight * 100);
    const co2 = (weight * 1.60).toFixed(2);

    document.getElementById('v-calc-points').textContent = points;
    document.getElementById('v-calc-co2').textContent = co2;
};

const handleProofSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // 1. Preview
    const img = document.getElementById('v-proof-img');
    const container = document.getElementById('v-proof-preview-container');
    const retakeBtn = document.getElementById('v-retake-btn');
    
    img.src = URL.createObjectURL(file);
    img.classList.remove('hidden');
    container.classList.add('hidden');
    retakeBtn.classList.remove('hidden');

    // 2. Instant Upload
    isUploading = true;
    uploadedProofUrl = null;
    toggleSubmitButton(false, "Uploading Photo...");
    
    // Show overlay loader
    let loader = document.getElementById('v-upload-loader');
    if(!loader) {
        loader = document.createElement('div');
        loader.id = 'v-upload-loader';
        loader.className = 'absolute inset-0 bg-black/50 flex flex-col items-center justify-center text-white z-10 rounded-xl';
        loader.innerHTML = `<span class="animate-spin text-2xl">⏳</span><span class="text-xs font-bold mt-2">Uploading...</span>`;
        img.parentElement.appendChild(loader);
    }
    loader.classList.remove('hidden');

    try {
        const url = await uploadToCloudinary(file);
        uploadedProofUrl = url;
        loader.innerHTML = `<span class="text-2xl">✅</span><span class="text-xs font-bold mt-2 text-green-400">Done</span>`;
        setTimeout(() => loader.classList.add('hidden'), 1000);
    } catch (err) {
        console.error(err);
        showToast("Upload failed", "error");
        loader.innerHTML = `<span class="text-2xl">❌</span><span class="text-xs font-bold mt-2 text-red-400">Failed</span>`;
    } finally {
        isUploading = false;
        toggleSubmitButton(true);
    }
};

const toggleSubmitButton = (enabled, text = null) => {
    const btn = document.getElementById('v-submit-btn');
    if (!btn) return;
    btn.disabled = !enabled;
    if (text) btn.innerHTML = text;
    else btn.innerHTML = `Submit Entry`;
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
    document.getElementById('v-proof-img').classList.add('hidden');
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
        setTimeout(startScanner, 500); // Wait for library
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
    statusEl.innerHTML = `<span class="text-orange-500">Locating...</span>`;
    navigator.geolocation.getCurrentPosition(
        (pos) => {
            currentGpsCoords = `${pos.coords.latitude},${pos.coords.longitude}`;
            statusEl.innerHTML = `<span class="text-green-600">Location Locked</span>`;
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
        showToast("Wait for photo upload...", "warning");
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

    toggleSubmitButton(false, "Saving...");

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
