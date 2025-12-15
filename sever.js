// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const PORT = 3000;
const adminName = "backy"; // Tên admin

// Cấu hình CORS
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// ================== TRẠNG THÁI CHUNG ==================
let participants = []; // { index, username }
let activeUsers = {};  // { username: socketId }

// ===== THỐNG KÊ (CHỈ CHẠY KHI ADMIN ONLINE) =====
let stats = {}; 
let adminOnline = false;

// --- HÀM HIỂN THỊ USER ONLINE ---
function displayActiveUsers() {
    const userList = Object.keys(activeUsers).map(u => `  - ${u}`);
    console.log('\n--- DANH SÁCH ONLINE ---');
    if (userList.length === 0) console.log('  (Không có ai)');
    else {
        console.log(`Tổng số: ${userList.length}`);
        console.log(userList.join('\n'));
    }
    console.log('------------------------\n');
}

// ================== SOCKET LOGIC ==================
io.on('connection', (socket) => {
    console.log(`[CONNECT] ${socket.id}`);
    socket.emit('initial_state', { participants });

    // -------- LOGIN --------
    socket.on('client_login', (data) => {
        const { username, role } = data;

        if (username !== adminName && activeUsers[username]) {
            socket.emit('login_status', {
                success: false,
                message: '❌ Tài khoản đang online ở thiết bị khác'
            });
            return;
        }

        activeUsers[username] = socket.id;
        socket.data.username = username;
        console.log(`[LOGIN] ${username} | ${socket.id}`);
        displayActiveUsers();

        if (username === adminName) {
            adminOnline = true;
            stats = {};
            console.log('[STATS] Admin login → reset thống kê');
        }

        socket.emit('login_status', { success: true });
    });

    // -------- USER JOIN (từ client người chơi) --------
    socket.on('user_join', (data) => {
        if (!participants.some(p => p.username === data.username)) {
            participants.push(data);
            io.emit('client_update_join', data);
            io.emit('participant_update', participants);
            console.log(`[JOIN] ${data.username}`);

            if (adminOnline) {
                if (!stats[data.username]) stats[data.username] = { join: 0, win: 0 };
                stats[data.username].join++;
            }
        }
    });

    // -------- USER CANCEL (từ client người chơi) --------
    socket.on('user_cancel', (data) => {
        participants = participants.filter(p => p.username !== data.username);
        io.emit('client_update_cancel', data);
        io.emit('participant_update', participants);

        if (adminOnline && stats[data.username]) {
            stats[data.username].join = Math.max(0, stats[data.username].join - 1);
        }
    });

    // ======== ADMIN CHỌN THỦ CÔNG ========
    socket.on('admin_manual_join', (data) => { // data = {index, username}
        if (socket.data.username !== adminName) return;

        if (!participants.some(p => p.username === data.username)) {
            participants.push(data);
            io.emit('client_update_join', data);
            io.emit('participant_update', participants);

            if (adminOnline) {
                if (!stats[data.username]) stats[data.username] = { join: 0, win: 0 };
                stats[data.username].join++;
                console.log(`[ADMIN MANUAL JOIN] ${data.username} → join +1 = ${stats[data.username].join}`);
            }
        }
    });

    socket.on('admin_manual_cancel', (data) => { // data = {index, username}
        if (socket.data.username !== adminName) return;

        participants = participants.filter(p => p.username !== data.username);
        io.emit('client_update_cancel', data);
        io.emit('participant_update', participants);

        if (adminOnline && stats[data.username]) {
            stats[data.username].join = Math.max(0, stats[data.username].join - 1);
            console.log(`[ADMIN MANUAL CANCEL] ${data.username} → join -1 = ${stats[data.username].join}`);
        }
    });

    // -------- STOP WHEEL --------
    socket.on('admin_stop_wheel', (winnerName) => {
        participants = [];
        io.emit('client_stop_wheel', winnerName);
        io.emit('participant_update', participants);
        console.log(`[RESULT] Winner: ${winnerName}`);

        if (adminOnline && stats[winnerName]) {
            stats[winnerName].win++;
        }
    });

    socket.on('admin_start_wheel', () => console.log('[WHEEL] Start'));

    socket.on('admin_reset_participants', () => {
        participants = [];
        io.emit('participant_update', participants);
    });

    // ===== ADMIN XEM STATS =====
    socket.on('admin_request_stats', () => {
        if (socket.data.username === adminName) {
            socket.emit('stats_data', stats);
        }
    });

    // -------- DISCONNECT --------
    socket.on('disconnect', () => {
        const username = socket.data.username;
        if (username && activeUsers[username] === socket.id) {
            delete activeUsers[username];
            console.log(`[LOGOUT] ${username}`);
            displayActiveUsers();

            participants = participants.filter(p => p.username !== username);
            io.emit('participant_update', participants);

            if (username === adminName) {
                adminOnline = false;
                stats = {};
                console.log('[STATS] Admin logout → clear thống kê');
            }
        }
    });
});

// ================== START SERVER ==================
server.listen(PORT, () => {
    console.log(`✅ Server running at http://localhost:${PORT}`);
    displayActiveUsers();
});
