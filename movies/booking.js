import { supabase } from '../supabase-client.js';

const params = new URLSearchParams(window.location.search);
const screeningId = params.get('id');

const state = {
    selectedSeat: null, 
    userPoints: 0,
    userGender: null, 
    movieTitle: '', // Store title for history log
    config: {
        platinum: 200, gold: 160, silver: 120, bronze: 80
    }
};

async function init() {
    if(!screeningId) { alert("Invalid Show"); window.location.href='index.html'; return; }

    const { data: { user } } = await supabase.auth.getUser();
    if(!user) { window.location.href='../login.html'; return; }

    // 1. Fetch User Points & Gender (Using Auth Link)
    const { data: profile } = await supabase
        .from('users')
        .select('current_points, gender') 
        .eq('auth_user_id', user.id) 
        .maybeSingle();

    if (profile) {
        state.userPoints = profile.current_points || 0;
        state.userGender = profile.gender;
    }
    
    document.getElementById('userBal').textContent = state.userPoints;

    // 2. Fetch Screening Info
    const { data: screening, error: screenError } = await supabase
        .from('screenings')
        .select(`*, movies(title)`)
        .eq('id', screeningId)
        .maybeSingle();
    
    if (screenError || !screening) {
        alert("Screening not found.");
        window.location.href = 'index.html';
        return;
    }
    
    state.movieTitle = screening.movies.title;
    document.getElementById('movieTitle').textContent = state.movieTitle;
    
    const d = new Date(screening.show_time);
    document.getElementById('movieTime').textContent = `${d.toLocaleDateString()} • ${d.toLocaleTimeString([],{hour:'2-digit', minute:'2-digit'})}`;

    state.config = {
        platinum: screening.price_platinum,
        gold: screening.price_gold,
        silver: screening.price_silver,
        bronze: screening.price_bronze
    };

    // 3. Fetch Taken Seats
    const { data: bookings } = await supabase
        .from('bookings')
        .select('seat_number')
        .eq('screening_id', screeningId);
    
    const takenSeats = new Set(bookings ? bookings.map(b => b.seat_number) : []);

    renderSeats(takenSeats);
    applyGenderRestrictions();
}

function applyGenderRestrictions() {
    const gender = state.userGender ? state.userGender.toLowerCase() : '';
    const leftWing = document.getElementById('leftWing');  
    const rightWing = document.getElementById('rightWing'); 

    leftWing.style.opacity = '1'; leftWing.style.pointerEvents = 'auto';
    rightWing.style.opacity = '1'; rightWing.style.pointerEvents = 'auto';

    if (gender === 'male') {
        rightWing.style.opacity = '0.3';
        rightWing.style.pointerEvents = 'none';
        rightWing.innerHTML = '<div class="wing-label">LADIES (LOCKED)</div>';
    } 
    else if (gender === 'female') {
        leftWing.style.opacity = '0.3';
        leftWing.style.pointerEvents = 'none';
        leftWing.innerHTML = '<div class="wing-label">GENTS (LOCKED)</div>';
    }
}

function renderSeats(takenSeats) {
    const leftWing = document.getElementById('leftWing');
    const rightWing = document.getElementById('rightWing');
    
    // Clear seats but keep header if not replaced by gender logic
    if(!leftWing.innerHTML.includes('LOCKED')) leftWing.innerHTML = '<div class="wing-label">GENTS SECTION</div>';
    if(!rightWing.innerHTML.includes('LOCKED')) rightWing.innerHTML = '<div class="wing-label">LADIES SECTION</div>';

    const rows = 12;
    const colsPerWing = 5;
    const rowLabels = "ABCDEFGHIJKL".split('');

    for(let r=0; r<rows; r++) {
        let tier = 'bronze';
        let price = state.config.bronze;

        if (r < 2) { tier = 'platinum'; price = state.config.platinum; }
        else if (r < 6) { tier = 'gold'; price = state.config.gold; }
        else if (r < 10) { tier = 'silver'; price = state.config.silver; }

        const rowLetter = rowLabels[r];

        // Only append if wing is not locked/cleared
        if(!leftWing.innerText.includes('LOCKED')) {
            for(let c=1; c<=colsPerWing; c++) createSeat(leftWing, rowLetter, c, tier, price, takenSeats);
        }
        if(!rightWing.innerText.includes('LOCKED')) {
            for(let c=colsPerWing+1; c<=colsPerWing*2; c++) createSeat(rightWing, rowLetter, c, tier, price, takenSeats);
        }
    }
}

function createSeat(container, row, col, tier, price, takenSeats) {
    const seatId = `${row}${col}`;
    const el = document.createElement('div');
    el.className = 'seat';
    el.dataset.tier = tier;
    el.textContent = seatId;
    
    if(takenSeats.has(seatId)) {
        el.classList.add('taken');
    } else {
        el.onclick = () => selectSeat(el, seatId, price);
    }
    container.appendChild(el);
}

function selectSeat(el, id, price) {
    if(state.selectedSeat) {
        state.selectedSeat.el.classList.remove('selected');
        if(state.selectedSeat.id === id) {
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
    
    if(!state.selectedSeat) {
        lbl.textContent = '0 Pts';
        btn.textContent = 'Select Seat';
        btn.disabled = true;
        btn.style.background = '';
    } else {
        lbl.textContent = `${state.selectedSeat.price} Pts`;
        btn.textContent = `Book ${state.selectedSeat.id}`;
        
        if(state.userPoints < state.selectedSeat.price) {
            btn.textContent = 'Insufficient Points';
            btn.disabled = true;
            btn.style.background = '#ef4444';
        } else {
            btn.disabled = false;
            btn.style.background = 'var(--accent)';
        }
    }
}

window.confirmBooking = async () => {
    if(!state.selectedSeat) return;
    const btn = document.getElementById('btnBook');
    btn.disabled = true;
    btn.textContent = 'Booking...';

    // 🔴 CALLING NEW v2 FUNCTION
    const { data, error } = await supabase.rpc('book_ticket_v2', {
        p_screening_id: screeningId,
        p_seat_number: state.selectedSeat.id,
        p_price: state.selectedSeat.price,
        p_movie_title: state.movieTitle
    });

    if(error || (data && !data.success)) {
        alert(error?.message || data?.error || "Booking Failed");
        btn.disabled = false;
        btn.textContent = 'Try Again';
        return;
    }

    // Success!
    window.location.href = 'index.html'; 
};

// Zoom Logic
const st = document.getElementById('stage');
if(st) st.style.transform = `scale(0.9)`;

init();
