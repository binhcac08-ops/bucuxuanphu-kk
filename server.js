const WebSocket = require("ws");
const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
const PORT = process.env.PORT || 5000;

// === Biến lưu lịch sử ===
let history = []; // danh sách kết quả các phiên

// === Danh sách tin nhắn gửi lên server WebSocket ===
const messagesToSend = [
  [6, "MiniGame", "taixiuPlugin", { cmd: 1005 }],
  [6, "MiniGame", "lobbyPlugin", { cmd: 10001 }]
];

// === WebSocket ===
let ws = null;
let pingInterval = null;
let reconnectTimeout = null;
let reconnectDelay = 2500; // Thời gian chờ ban đầu là 2.5 giây
const MAX_RECONNECT_DELAY = 60000; // Thời gian chờ tối đa là 60 giây
let id_phien_chua_co_kq = null;

function connectWebSocket() {
  console.log(`[🔄] Đang thử kết nối lại sau ${reconnectDelay / 1000} giây...`);
  clearTimeout(reconnectTimeout);

  // LƯU Ý QUAN TRỌNG:
  // Lỗi 403 xảy ra do token đã hết hạn. Bạn cần thay thế token mới
  // để mã này hoạt động trở lại.
  const websocketUrl = "wss://websocket.azhkthg1.net/websocket?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJhbW91bnQiOjAsInVzZXJuYW1lIjoiU0NfYXBpc3Vud2luMTIzIn0.hgrRbSV6vnBwJMg9ZFtbx3rRu9mX_hZMZ_m5gMNhkw0";

  ws = new WebSocket(websocketUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      "Origin": "https://play.sun.win"
    }
  });

  ws.on("open", () => {
    console.log("[✅] WebSocket kết nối thành công!");
    reconnectDelay = 2500; // Reset thời gian chờ khi kết nối lại thành công
    messagesToSend.forEach((msg, i) => {
      setTimeout(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(msg));
        }
      }, i * 600);
    });

    pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      }
    }, 15000);
  });

  ws.on("pong", () => {
    console.log("[📶] Ping OK");
  });

  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message);
      if (Array.isArray(data) && typeof data[1] === "object") {
        const cmd = data[1].cmd;

        if (cmd === 1008 && data[1].sid) {
          id_phien_chua_co_kq = data[1].sid;
        }

        if (cmd === 1003 && data[1].gBB) {
          const { d1, d2, d3 } = data[1];
          const total = d1 + d2 + d3;
          const result = total > 10 ? "Tài" : "Xỉu";

          // Thêm vào lịch sử
          history.unshift({
            Phien: id_phien_chua_co_kq,
            ket_qua: result,
            tong: total,
            xuc_xac_1: d1,
            xuc_xac_2: d2,
            xuc_xac_3: d3
          });

          if (history.length > 50) history.pop(); // giữ tối đa 50 phiên

          console.log(`Phiên ${id_phien_chua_co_kq}: ${d1}-${d2}-${d3} = ${total} (${result})`);
          id_phien_chua_co_kq = null;
        }
      }
    } catch (e) {
      console.error("[Lỗi]:", e.message);
    }
  });

  ws.on("close", () => {
    console.log("[🔌] WebSocket ngắt kết nối. Đang lên lịch kết nối lại...");
    clearInterval(pingInterval);
    reconnectTimeout = setTimeout(connectWebSocket, reconnectDelay);
    reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY);
  });

  ws.on("error", (err) => {
    console.error("[❌] WebSocket lỗi:", err.message);
  });
}

// === API ===
app.get("/lichsu", (req, res) => {
  if (history.length === 0) {
    return res.json({
      lich_su: [],
      message: "Chưa có dữ liệu lịch sử"
    });
  }
  res.json({ lich_su: history });
});

app.get("/", (req, res) => {
  res.send("<h2>🎯 API Lịch sử Sunwin Tài Xỉu</h2><p><a href='/lichsu'>Xem lịch sử JSON</a></p>");
});

// === Khởi động server ===
app.listen(PORT, () => {
  console.log(`[🌐] Server chạy tại http://localhost:${PORT}`);
  connectWebSocket();
});
        
