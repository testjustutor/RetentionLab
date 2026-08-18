/**
 * root/public/js/super_admin/people/profile.js
 * Profile Management - Super Admin
 */

// ─── Load Profile Data ────────────────────────────────────────────────────────

async function loadProfile() {
    try {
        const response = await fetch('/api/super_admin/people/profile/me', { credentials: 'include' });
        if (!response.ok) throw new Error('Failed to fetch profile');
        const result = await response.json();
        const user = result.user || result.data || result;

        const name = user.first_name || user.name || 'User';
        const email = user.email || '';
        const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

        // Update profile card
        document.getElementById('bigAvatar').textContent = initials;
        document.getElementById('cardName').textContent = name;
        document.getElementById('cardEmail').textContent = email;

        // Update form fields
        document.getElementById('inputName').value = name;
        document.getElementById('inputEmail').value = email;
    } catch (err) {
        console.error('Error loading profile:', err);
    }
}

// ─── Load Recent Activity ─────────────────────────────────────────────────────

async function loadRecentActivity() {
    const tbody = document.getElementById('activityLogBody');
    
    try {
        const response = await fetch('/api/super_admin/monitoring/audit?limit=20', { credentials: 'include' });
        if (!response.ok) throw new Error('Failed to fetch activity');
        
        const result = await response.json();
        const logs = result.logs || [];

        if (!logs || logs.length === 0) {
            tbody.innerHTML = `<tr><td colspan="3" class="py-3 px-2 text-center text-indigo-800 text-[10px]">No recent activity found</td></tr>`;
            return;
        }

        // Take only the most recent 15 entries
        const recent = logs.slice(0, 15);

        let html = '';
        recent.forEach(log => {
            const timestamp = log.timestamp || '';
            const description = log.description || '';
            const module = log.module || 'SYSTEM';
            const level = log.level || 'INFO';
            
            // Format timestamp to relative time
            const timeAgo = formatTimeAgo(timestamp);
            
            // Determine event type icon/color based on level
            let eventColor = 'text-indigo-600';
            let eventIcon = '●';
            if (level === 'ERROR' || level === 'FATAL') {
                eventColor = 'text-rose-700';
                eventIcon = '✕';
            } else if (level === 'WARN') {
                eventColor = 'text-amber-700';
                eventIcon = '⚠';
            } else if (level === 'DEBUG') {
                eventColor = 'text-indigo-800';
                eventIcon = '○';
            }

            // Truncate long descriptions
            const shortDesc = description.length > 80 ? description.substring(0, 80) + '...' : description;

            html += `
                <tr class="hover:bg-indigo-100 transition-colors">
                    <td class="py-1.5 px-2">
                        <div class="flex items-center gap-1.5">
                            <span class="${eventColor} text-[8px]">${eventIcon}</span>
                            <span class="font-mono text-[10px] ${eventColor}">${module}</span>
                            <span class="text-indigo-800 text-[9px]">${shortDesc}</span>
                        </div>
                    </td>
                    <td class="py-1.5 px-2 text-slate-300 text-[10px] font-mono">${log.user || 'system'}</td>
                    <td class="py-1.5 px-2 text-indigo-800 text-[10px] whitespace-nowrap">${timeAgo}</td>
                </tr>
            `;
        });

        tbody.innerHTML = html;
    } catch (err) {
        console.error('Error loading activity:', err);
        tbody.innerHTML = `<tr><td colspan="3" class="py-3 px-2 text-center text-indigo-800 text-[10px]">Failed to load activity</td></tr>`;
    }
}

// ─── Format Timestamp to Relative Time ────────────────────────────────────────

function formatTimeAgo(timestamp) {
    if (!timestamp) return 'N/A';
    
    const now = new Date();
    const date = new Date(timestamp);
    
    if (isNaN(date.getTime())) return timestamp;
    
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);
    
    if (diffSec < 10) return 'Just now';
    if (diffSec < 60) return diffSec + 's ago';
    if (diffMin < 60) return diffMin + 'm ago';
    if (diffHour < 24) return diffHour + 'h ago';
    if (diffDay < 7) return diffDay + 'd ago';
    
    // Return formatted date for older entries
    return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// ─── Save Profile ─────────────────────────────────────────────────────────────

document.getElementById('profileForm').addEventListener('submit', async (event) => {
    event.preventDefault();

    const name = document.getElementById('inputName').value.trim();
    const email = document.getElementById('inputEmail').value.trim();

    if (!name || !email) {
        alert('Name and email are required.');
        return;
    }

    try {
        // Get current user ID
        const meResponse = await fetch('/api/auth/me', { credentials: 'include' });
        const meResult = await meResponse.json();
        const user = meResult.user || meResult.data || meResult;
        const userId = user.id;

        const response = await fetch(`/api/super_admin/people/profile/${userId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                first_name: name,
                email: email
            })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Failed to update profile');
        }

        alert('Profile updated successfully!');
        await loadProfile();
    } catch (err) {
        alert('Error: ' + err.message);
    }
});

// ─── Change Password ──────────────────────────────────────────────────────────

document.getElementById('passwordForm').addEventListener('submit', async (event) => {
    event.preventDefault();

    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (!currentPassword || !newPassword || !confirmPassword) {
        alert('All password fields are required.');
        return;
    }

    if (newPassword.length < 6) {
        alert('New password must be at least 6 characters.');
        return;
    }

    if (newPassword !== confirmPassword) {
        alert('New passwords do not match.');
        return;
    }

    try {
        const response = await fetch('/api/super_admin/people/profile/change-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                current_password: currentPassword,
                new_password: newPassword
            })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Failed to change password');
        }

        alert('Password changed successfully!');
        document.getElementById('passwordForm').reset();
    } catch (err) {
        alert('Error: ' + err.message);
    }
});

// ─── Init ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    loadProfile();
    loadRecentActivity();
});