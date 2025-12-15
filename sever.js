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
// stats = { username: { join: number, win: number } }
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

        // ===== ADMIN LOGIN → RESET STATS =====
        if (username === adminName) {
            adminOnline = true;
            stats = {};
            console.log('[STATS] Admin login → reset thống kê');
        }

        socket.emit('login_status', {
            success: true,
            message: 'Đăng nhập thành công!'
        });
    });

    // -------- USER JOIN --------
    socket.on('user_join', (data) => {
        if (!participants.some(p => p.username === data.username)) {
            participants.push(data);
            io.emit('client_update_join', data);
            io.emit('participant_update', participants);
            console.log(`[JOIN] ${data.username}`);

            // ===== GHI THỐNG KÊ =====
            if (adminOnline) {
                if (!stats[data.username]) {
                    stats[data.username] = { join: 0, win: 0 };
                }
                stats[data.username].join++;
            }
        }
    });

    // -------- USER CANCEL --------
    socket.on('user_cancel', (data) => {
        participants = participants.filter(p => p.username !== data.username);
        io.emit('client_update_cancel', data);
        io.emit('participant_update', participants);
    });

    // -------- STOP WHEEL --------
    socket.on('admin_stop_wheel', (winnerName) => {
        participants = [];
        io.emit('client_stop_wheel', winnerName);
        io.emit('participant_update', participants);
        console.log(`[RESULT] Winner: ${winnerName}`);

        // ===== GHI LẦN TRÚNG =====
        if (adminOnline && stats[winnerName]) {
            stats[winnerName].win++;
        }
    });

    socket.on('admin_start_wheel', () => {
        console.log('[WHEEL] Start');
    });

    socket.on('admin_reset_participants', () => {
        participants = [];
        io.emit('participant_update', participants);
    });

   // ===== ADMIN XEM STATS =====
socket.on('admin_request_stats', () => {
    console.log('[STATS REQUEST] Admin yêu cầu xem thống kê từ socket:', socket.id);
    console.log('[ADMIN CHECK] Username hiện tại của socket:', socket.data.username);
    console.log('[ADMIN NAME] So sánh với adminName:', adminName);
    console.log('[CURRENT STATS] Dữ liệu hiện tại:', JSON.stringify(stats));
    if (socket.data.username === adminName) {
        socket.emit('stats_data', stats);
        console.log('[STATS SENT] Đã gửi dữ liệu thống kê về client thành công');
    } else {
        console.log('[STATS DENIED] Không phải admin - Không gửi dữ liệu');
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

            // ===== ADMIN LOGOUT → CLEAR STATS =====
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
