import { supabase } from '../supabase-client.js';

/* =====================================================
   MOBILE TOAST (LOCAL)
===================================================== */
function showToast(message, type = 'success') {
    const old = document.querySelector('.toast');
    if (old) old.remove();

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;

    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

/* =====================================================
   THEME SYNC LOGIC
===================================================== */
function applyTheme() {
    const savedTheme = localStorage.getItem('eco-theme');
    const isDark = savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches);
    
    if (isDark) {
        document.documentElement.setAttribute('data-theme', 'dark');
    } else {
        document.documentElement.removeAttribute('data-theme');
    }
}

/* =====================================================
   URL PARAMS & STATE
===================================================== */
const params = new URLSearchParams(window.location.search);
const screeningId = params.get('id');

const state = {
    selectedSeat: null,
    userPoints: 0,
    userGender: null,
    movieTitle: '',
    config: {
        platinum: 200,
        gold: 160,
        silver: 120,
        bronze: 80
    }
};

/* =====================================================
   INIT
===================================================== */
async function init() {
    // 1. Apply Theme Immediately
    applyTheme();

    if (!screeningId) {
        showToast('Invalid show', 'error');
        window.location.href = 'index.html';
        return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        showToast('Please login to continue', 'error');
        window.location.href = '../login.html';
        return;
    }

    // 1. Fetch user profile (PUBLIC ID + points + gender)
    const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('current_points, gender')
        .eq('auth_user_id', user.id)
        .maybeSingle();

    if (profileError || !profile) {
        showToast('User profile not found', 'error');
        return;
    }

    state.userPoints = profile.current_points || 0;
    state.userGender = profile.gender || null;
    document.getElementById('userBal').textContent = state.userPoints;

    // 2. Fetch screening + movie
    const { data: screening, error: screenError } = await supabase
        .from('screenings')
        .select(`*, movies(title)`)
        .eq('id', screeningId)
        .maybeSingle();

    if (screenError || !screening) {
        showToast('Screening not found', 'error');
        window.location.href = 'index.html';
        return;
    }

    state.movieTitle = screening.movies.title;
    document.getElementById('movieTitle').textContent = state.movieTitle;

    const d = new Date(screening.show_time);
    document.getElementById('movieTime').textContent =
        `${d.toLocaleDateString()} • ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

    state.config = {
        platinum: screening.price_platinum,
        gold: screening.price_gold,
        silver: screening.price_silver,
        bronze: screening.price_bronze
    };

    // 3. Fetch taken seats using RPC to bypass RLS (View All Taken Seats)
    let takenSeats = new Set();
    
    // Attempt to fetch via RPC first (Secure way to see all bookings)
    const { data: rpcBookings, error: rpcError } = await supabase
        .rpc('get_taken_seats', { p_screening_id: screeningId });

    if (!rpcError && rpcBookings) {
        takenSeats = new Set(rpcBookings.map(b => b.seat_number));
    } else {
        // Fallback: If RPC fails or doesn't exist, try standard select (Subject to RLS)
        console.warn("RPC fetch failed, falling back to RLS-restricted select.", rpcError);
        const { data: tableBookings } = await supabase
            .from('bookings')
            .select('seat_number')
            .eq('screening_id', screeningId);
            
        if (tableBookings) {
            tableBookings.forEach(b => takenSeats.add(b.seat_number));
        }
    }

    renderSeats(takenSeats);
    applyGenderRestrictions();
}

/* =====================================================
   GENDER RESTRICTIONS
===================================================== */
function applyGenderRestrictions() {
    const gender = (state.userGender || '').toLowerCase();
    const leftWing = document.getElementById('leftWing');
    const rightWing = document.getElementById('rightWing');

    leftWing.style.opacity = '1';
    leftWing.style.pointerEvents = 'auto';
    rightWing.style.opacity = '1';
    rightWing.style.pointerEvents = 'auto';

    if (gender === 'male') {
        rightWing.style.opacity = '0.3';
        rightWing.style.pointerEvents = 'none';
        rightWing.innerHTML = '<div class="wing-label">LADIES (LOCKED)</div>';
    } else if (gender === 'female') {
        leftWing.style.opacity = '0.3';
        leftWing.style.pointerEvents = 'none';
        leftWing.innerHTML = '<div class="wing-label">GENTS (LOCKED)</div>';
    }
}

/* =====================================================
   SEAT RENDERING
===================================================== */
function renderSeats(takenSeats) {
    const leftWing = document.getElementById('leftWing');
    const rightWing = document.getElementById('rightWing');

    if (!leftWing.innerHTML.includes('LOCKED')) {
        leftWing.innerHTML = '<div class="wing-label">GENTS SECTION</div>';
    }
    if (!rightWing.innerHTML.includes('LOCKED')) {
        rightWing.innerHTML = '<div class="wing-label">LADIES SECTION</div>';
    }

    const rows = 12;
    const colsPerWing = 5;
    const rowLabels = 'ABCDEFGHIJKL'.split('');

    for (let r = 0; r < rows; r++) {
        let tier = 'bronze';
        let price = state.config.bronze;

        if (r < 2) { tier = 'platinum'; price = state.config.platinum; }
        else if (r < 6) { tier = 'gold'; price = state.config.gold; }
        else if (r < 10) { tier = 'silver'; price = state.config.silver; }

        const rowLetter = rowLabels[r];

        if (!leftWing.innerText.includes('LOCKED')) {
            for (let c = 1; c <= colsPerWing; c++) {
                createSeat(leftWing, rowLetter, c, tier, price, takenSeats);
            }
        }

        if (!rightWing.innerText.includes('LOCKED')) {
            for (let c = colsPerWing + 1; c <= colsPerWing * 2; c++) {
                createSeat(rightWing, rowLetter, c, tier, price, takenSeats);
            }
        }
    }
}

function createSeat(container, row, col, tier, price, takenSeats) {
    const seatId = `${row}${col}`;
    const el = document.createElement('div');
    el.className = 'seat';
    el.dataset.tier = tier;
    el.textContent = seatId;

    if (takenSeats.has(seatId)) {
        el.classList.add('taken');
    } else {
        el.onclick = () => selectSeat(el, seatId, price);
    }

    container.appendChild(el);
}

/* =====================================================
   SEAT SELECTION
===================================================== */
function selectSeat(el, id, price) {
    if (state.selectedSeat) {
        state.selectedSeat.el.classList.remove('selected');
        if (state.selectedSeat.id === id) {
            state.selectedSeat = null;
            updateCheckout();
            return;
        }
    }

    el.classList.add('selected');
    state.selectedSeat = { el, id, price };
    updateCheckout();
}

function updateCheckout() {
    const btn = document.getElementById('btnBook');
    const lbl = document.getElementById('totalPrice');

    if (!state.selectedSeat) {
        lbl.textContent = '0 Pts';
        btn.textContent = 'Select Seat';
        btn.disabled = true;
        btn.style.background = '';
        return;
    }

    lbl.textContent = `${state.selectedSeat.price} Pts`;
    btn.textContent = `Book ${state.selectedSeat.id}`;

    if (state.userPoints < state.selectedSeat.price) {
        btn.textContent = 'Insufficient Points';
        btn.disabled = true;
        btn.style.background = '#ef4444';
    } else {
        btn.disabled = false;
        btn.style.background = 'var(--accent)';
    }
}

/* =====================================================
   CONFIRM BOOKING
===================================================== */
window.confirmBooking = async () => {
    if (!state.selectedSeat) return;

    const btn = document.getElementById('btnBook');
    btn.disabled = true;
    btn.textContent = 'Booking...';

    const { data, error } = await supabase.rpc('book_ticket_v2', {
        p_screening_id: screeningId,
        p_seat_number: state.selectedSeat.id,
        p_price: state.selectedSeat.price,
        p_movie_title: state.movieTitle
    });

    if (error || !data?.success) {
        showToast(error?.message || data?.error || 'Booking failed', 'error');
        btn.disabled = false;
        btn.textContent = 'Try Again';
        return;
    }

    // New icon type 'movie_booking' is now supported in utils.js
    // Database trigger handles the logging, but utils maps it to the new icon.
    showToast('Ticket booked successfully', 'success');
    setTimeout(() => {
        window.location.href = 'index.html';
    }, 800);
};

/* =====================================================
   ZOOM PRESET + START
===================================================== */
const stage = document.getElementById('stage');
if (stage) stage.style.transform = 'scale(0.9)';

init();
