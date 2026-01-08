import { supabase } from '../supabase-client.js';

const els = {
    points: document.getElementById('headerPoints'),
    movieContainer: document.getElementById('movieContainer'),
    ticketContainer: document.getElementById('ticketContainer')
};

async function init() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        window.location.href = '../login.html';
        return;
    }

    // 1. Fetch Points
    const { data: profile } = await supabase.from('users').select('current_points').eq('id', user.id).single();
    if(profile) els.points.textContent = profile.current_points;

    // 2. Fetch Movies
    loadMovies();
    loadTickets(user.id);
}

async function loadMovies() {
    // Join movies with screenings to get earliest showtime
    const { data: screenings, error } = await supabase
        .from('screenings')
        .select(`
            id, show_time, venue, price_bronze,
            movies ( title, genre, language, poster_url )
        `)
        .gte('show_time', new Date().toISOString())
        .order('show_time', { ascending: true });

    if(error) {
        els.movieContainer.innerHTML = '<p>Error loading movies</p>';
        return;
    }

    if(screenings.length === 0) {
        els.movieContainer.innerHTML = '<p style="grid-column:1/-1; text-align:center;">No upcoming shows.</p>';
        return;
    }

    els.movieContainer.innerHTML = screenings.map(s => `
        <div class="movie-card" onclick="window.location.href='booking.html?id=${s.id}'">
            <img src="${s.movies.poster_url || 'https://placehold.co/200x300'}" class="poster">
            <div class="movie-info">
                <div class="movie-title">${s.movies.title}</div>
                <div class="movie-meta">${new Date(s.show_time).toLocaleDateString()} • ${new Date(s.show_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                <div class="movie-meta">${s.venue}</div>
                <button class="btn-book">Book from ${s.price_bronze} Pts</button>
            </div>
        </div>
    `).join('');
}

async function loadTickets(userId) {
    const { data: bookings } = await supabase
        .from('bookings')
        .select(`
            id, seat_number, status,
            screenings ( show_time, venue, movies ( title, poster_url ) )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    if(!bookings || bookings.length === 0) {
        els.ticketContainer.innerHTML = '<p style="text-align:center; color:#94a3b8;">No bookings found.</p>';
        return;
    }

    els.ticketContainer.innerHTML = bookings.map(b => `
        <div class="ticket-card" onclick="window.location.href='ticket.html?id=${b.id}'">
            <div style="display:flex; gap:12px; padding:12px;">
                <img src="${b.screenings.movies.poster_url}" style="width:60px; height:60px; border-radius:8px; object-fit:cover;">
                <div>
                    <div style="font-weight:700;">${b.screenings.movies.title}</div>
                    <div style="font-size:12px; color:var(--text-secondary); margin-top:4px;">
                        Seat ${b.seat_number} • ${new Date(b.screenings.show_time).toLocaleDateString()}
                    </div>
                    <div style="margin-top:6px;">
                        <span style="background:#ecfdf5; color:#15803d; font-size:10px; padding:4px 8px; border-radius:4px; font-weight:700;">${b.status.toUpperCase()}</span>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

init();
