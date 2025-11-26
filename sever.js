// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const PORT = 3000;
const adminName = "backy"; // Tên admin

// Cấu hình CORS để cho phép kết nối từ trình duyệt (Client)
const io = new Server(server, {
    cors: {
        origin: "*", 
        methods: ["GET", "POST"]
    }
});

// Trạng thái chung của ứng dụng
let participants = []; // { index: 0, username: 'Tên' }
let activeUsers = {}; // { username: socketId }

// --- HÀM: HIỂN THỊ DANH SÁCH NGƯỜI DÙNG ĐANG ONLINE ---
function displayActiveUsers() {
    const userList = Object.keys(activeUsers).map(username => {
        return `  - ${username}`;
    });

    console.log('\n--- DANH SÁCH ONLINE HIỆN TẠI ---');
    if (userList.length === 0) {
        console.log('  (Không có người dùng nào đang online)');
    } else {
        console.log(`Tổng số: ${userList.length}`);
        console.log(userList.join('\n'));
    }
    console.log('----------------------------------\n');
}

// --- SOCKET.IO LOGIC ---
io.on('connection', (socket) => {
    console.log(`[CONNECT] A client connected: ${socket.id}`);
    
    socket.emit('initial_state', { participants });

    // Lắng nghe sự kiện ĐĂNG NHẬP từ Client (ĐÃ FIX LOGIC CHẶN)
    socket.on('client_login', (data) => {
        const { username, index, role } = data; 
        
        // 1. KIỂM TRA CHẶN ĐĂNG NHẬP TRÙNG LẶP (Chỉ áp dụng cho User)
        if (username !== adminName && activeUsers[username]) {
            // Tài khoản ĐÃ online. KHÔNG CHO ĐĂNG NHẬP
            console.log(`[BLOCKED] User ${username} (Socket: ${socket.id}) bị chặn do đã online.`);
            
            // Gửi thông báo thất bại về CHÍNH Client vừa cố gắng đăng nhập
            socket.emit('login_status', { 
                success: false, 
                message: '❌ Tài khoản này đang được sử dụng trên thiết bị khác. Không thể đăng nhập.'
            });
            return; // Dừng xử lý
        }
        
        // 2. ĐĂNG NHẬP THÀNH CÔNG (hoặc Admin)
        activeUsers[username] = socket.id;
        socket.data.username = username; // Lưu username vào dữ liệu socket
        console.log(`[LOGIN] User: ${username} | Socket: ${socket.id}`);

        displayActiveUsers(); // Cập nhật Terminal

        // Gửi thông báo thành công về CHÍNH Client vừa đăng nhập
        socket.emit('login_status', { 
            success: true, 
            message: 'Đăng nhập thành công!'
        });
    });


    // Lắng nghe sự kiện tham gia/hủy/admin_stop_wheel (Giữ nguyên)
    socket.on('user_join', (data) => {
        if (!participants.some(p => p.username === data.username)) {
            participants.push(data);
            io.emit('client_update_join', data);
            console.log(`[JOIN] ${data.username} joined. Total: ${participants.length}`);
        }
    });

    socket.on('user_cancel', (data) => {
        participants = participants.filter(p => p.username !== data.username);
        io.emit('client_update_cancel', data);
        console.log(`[CANCEL] ${data.username} canceled. Total: ${participants.length}`);
    });

    socket.on('admin_stop_wheel', (winnerName) => {
        participants = []; 
        io.emit('client_stop_wheel', winnerName);
        console.log(`[RESULT] Winner is: ${winnerName}`);
    });
    
    socket.on('admin_start_wheel', () => {
        console.log(`[WHEEL] Admin started the wheel.`);
    });

    // Xử lý khi Client ngắt kết nối
    socket.on('disconnect', () => {
        const disconnectedUsername = socket.data.username;

        if (disconnectedUsername && activeUsers[disconnectedUsername] === socket.id) {
            delete activeUsers[disconnectedUsername];
            console.log(`[LOGOUT] User disconnected: ${disconnectedUsername}`);
            
            displayActiveUsers(); // Cập nhật Terminal

            participants = participants.filter(p => p.username !== disconnectedUsername);
            io.emit('client_update_cancel', { username: disconnectedUsername, index: -1 }); 
        }
    });
});

// Khởi động Server
server.listen(PORT, () => {
    console.log(`✅ Server is running on http://localhost:${PORT}`);
    displayActiveUsers(); 
});