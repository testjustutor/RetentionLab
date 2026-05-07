let users = []; // Loaded from /api/calendar/multi/users
let currentUser = null;

function updateUserList() {
    const countEl = document.getElementById('userCount');
    const listEl = document.getElementById('usersList');
    countEl.textContent = users.length;

    if (users.length === 0) {
        listEl.innerHTML = '<p style="text-align: center; color: #999;">No connected accounts. Connect your first Google account above.</p>';
        return;
    }

    let html = '';
    users.forEach((user, index) => {
        html += `
            <div class="user-card">
                <div class="user-info">
                    <div class="user-email">${user.email}</div>
                    <div class="user-status">Account: ${user.accountName} ${user.authorized ? '✅ Authorized' : '⚠️ Pending'}</div>
                </div>
                <div>
                    <button class="button" onclick="selectUser(${index})">👁️ View Calendar</button>
                    <button class="button danger" onclick="disconnectUser(${index})">❌ Disconnect</button>
                    <button class="button secondary" onclick="checkUserStatus(${index})">🔍 Status</button>
                </div>
            </div>
        `;
    });
    listEl.innerHTML = html;
}

async function connectNewUser() {
    const email = document.getElementById('newUserEmail').value.trim();
    if (!email) {
        showMessage('connectMessage', 'error', 'Enter email first');
        return;
    }

    if (users.find(u => u.email === email)) {
        showMessage('connectMessage', 'error', 'Account already connected');
        return;
    }

    try {
        showMessage('connectMessage', 'info', 'Generating auth URL...');
        const response = await fetch('/api/calendar/multi/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        });
        const data = await response.json();

        if (data.status === 'success' && data.url) {

            const width = 600, height = 700;
            const left = (window.innerWidth / 2) - (width / 2);
            const top = (window.innerHeight / 2) - (height / 2);

            const popup = window.open(
                            data.url, 
                            'googleAuth', 
                            `width=${width},height=${height},left=${left},top=${top}`
                        );
            if (!popup) {
                showMessage('connectMessage', 'error', 'Popup blocked! Allow popups.');
                return;
            }

            // Add pending user
            const newUser = { 
                email: email, 
                accountName: email.split('@')[0], 
                authorized: false, 
                connectedAt: Date.now() 
            };
            users.push(newUser);
            const userIndex = users.length - 1; // Store current index
            updateUserList();

            // Poll status
            const poll = setInterval(async () => {
                await checkUserStatus(userIndex);
                if (users[userIndex].authorized) {
                    clearInterval(poll);
                    showMessage('connectMessage', 'success', 'Account connected!');
                }
            }, 3000);
            setTimeout(() => clearInterval(poll), 60000);

        } else {
            showMessage('connectMessage', 'error', data.message);
        }
    } catch (err) {
        showMessage('connectMessage', 'error', err.message);
    }
}

async function checkUserStatus(index) {
    try {
        const res = await fetch('/api/calendar/multi/users');
        const data = await res.json();
        const remoteUser = data.data.find(u => u.email === users[index].email);
        if (remoteUser && remoteUser.tokenExpiry) {
            users[index].authorized = true;
            updateUserList();
        }
    } catch (e) { console.error(e); }
}

function selectUser(index) {
    currentUser = users[index];
    document.getElementById('currentUserTitle').textContent = `📅 ${currentUser.email}'s Calendar`;
    document.getElementById('userCalendarView').classList.remove('hidden');
    fetchUserMeetings();
}

function handleQuickJoin(el) {
    const meetingId = el.dataset.id;
    const passcode = el.dataset.pass;
    const meetingUrl = el.dataset.link;
    const platform = el.dataset.platform;
    quickJoinMeeting(meetingId, passcode, meetingUrl, platform);
}

async function quickJoinMeeting(meetingId, passcode, meetingUrl, platform) {
    try {
        const account = currentUser.email;
        console.log('Quick Join Debug:', { meetingId, passcode, platform, account });
        showMessage('quickJoinMessage', 'info', 'Sending credentials to bot...');
        const response = await fetch('/api/bot/start-bot', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                platform: platform, 
                meetingId: meetingId,
                passcode: passcode,
                meetingUrl: meetingUrl
            })
        });
        const data = await response.json();
        if (data.status === 'success') {
            showMessage('quickJoinMessage', 'success',
                `✅ Bot Started!\nMeeting ID: ${meetingId}\nAccount: ${account}`);
            setTimeout(() => fetchUserMeetings(), 2000);
        } else {
            showMessage('quickJoinMessage', 'error', data.message);
        }
    } catch (err) {
        showMessage('quickJoinMessage', 'error', 'Error: ' + err.message);
    }
}

async function fetchUserMeetings() {
    if (!currentUser) return;
    try {
        showLoading('loadingIndicator', 'Loading meetings for ' + currentUser.email);
        const hours = document.getElementById('hoursAhead').value;
        const platform = document.getElementById('platformFilter').value;
        let url = '/api/calendar/multi/events';
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: currentUser.email,
                hoursAhead: hours,
                platform: platform || ''
            })
        });
        const data = await res.json();
        hideLoading('loadingIndicator');
        if (data.status === 'success') {
            displayMeetings(data.events || data.data?.meetings || []);
        } else {
            document.getElementById('meetingsList').innerHTML = `<div class="status ${data.status}">${data.message}</div>`;
        }
    } catch (err) {
        hideLoading('loadingIndicator');
        document.getElementById('meetingsList').innerHTML = `<div class="status error">Error: ${err.message}</div>`;
    }
}

function displayMeetings(meetings) {
    let html = '';
    const listEl = document.getElementById('meetingsList');
    if (!meetings || meetings.length === 0) {
        listEl.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">No upcoming meetings found for this period.</p>';
        return;
    }
    meetings.sort((a, b) => new Date(a.start) - new Date(b.start));
    meetings.forEach(meeting => {
        const dateObj = new Date(meeting.start);
        const startTime = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const startDate = dateObj.toLocaleDateString([], { month: 'short', day: 'numeric' });
        const platform = (meeting.platform || 'unknown').toLowerCase();
        const platformClass = `platform-${platform}`;
        const meetingId = meeting.meetingId || "";
        const passcode = meeting.passcode || "";
        const meetingLink = meeting.link || "";
        const meetingInfo = meetingId 
            ? `ID: ${meetingId}${passcode ? ` (pwd: ${passcode})` : ''}` 
            : 'Join via link';
        html += `
            <div class="meeting-card">
                <div class="meeting-title">${meeting.title || 'Untitled Meeting'}</div>
                <div class="meeting-details">
                    <span>📅 <strong>${startDate}</strong> at ${startTime}</span>
                    <span class="meeting-platform ${platformClass}" style="margin-top:0; font-size: 0.75em;">${platform.toUpperCase()}</span>
                </div>
                <div class="meeting-details">
                    <span style="font-family: monospace; background: #eee; padding: 2px 5px; border-radius: 3px;">🔑 ${meetingInfo}</span>
                </div>
                <div style="margin-top: 12px; display: flex; gap: 10px; align-items: center;">
                    ${meetingLink ? `
                        <a href="${meetingLink}" target="_blank" class="button secondary" style="text-decoration: none; padding: 5px 12px; font-size: 0.85em;">
                            🔗 Open Link
                        </a>` : ''}
                    ${(platform === 'zoom' || platform === 'google-meet' || platform === 'teams') ? `
                        <button class="button success"
                            data-id="${meetingId}"
                            data-pass="${passcode}"
                            data-link="${meetingLink}"
                            data-platform="${platform}"
                            onclick="handleQuickJoin(this)">
                            ⚡ Join Bot
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    });
    listEl.innerHTML = html;
}

function disconnectUser(index) {
    if (!confirm(`Disconnect ${users[index].email}?`)) return;
    const email = users[index].email;
    fetch('/api/calendar/multi/users/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
    }).then(() => {
        users = users.filter(u => u.email !== email);
        if (currentUser?.email === email) {
            currentUser = null;
            document.getElementById('userCalendarView').classList.add('hidden');
        }
        updateUserList();
    });
}

function showMessage(id, type, msg) {
    const el = document.getElementById(id);
    el.className = `status ${type}`;
    el.textContent = msg;
}

function showMessageForUser(index, type, msg) {
    showMessage('connectMessage', type, `${users[index].email}: ${msg}`);
}

function showLoading(id, text) {
    const el = document.getElementById(id);
    el.classList.remove('hidden');
    document.getElementById('loadingText').textContent = text;
}

function hideLoading(id) {
    document.getElementById(id).classList.add('hidden');
}

window.addEventListener('load', async () => {
    try {
        const res = await fetch('/api/calendar/multi/users');
        const data = await res.json();
        if (data.status === 'success') {
            users = data.data.map(u => ({
                email: u.email,
                authorized: u.tokenExpiry !== null,
                accountName: u.email.split('@')[0]
            }));
        }
        updateUserList();
    } catch (err) {
        console.error('Failed to load users:', err);
    }
});