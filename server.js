const WebSocket = require("ws");
const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
const PORT = process.env.PORT || 5000;

// Biến lưu dữ liệu
let currentRound = null; // phiên mới nhất
let history = [];        // danh sách lịch sử kết quả

let ws;
let pingInterval;

// === Hàm kết nối WebSocket ===
function connectWebSocket() {
  ws = new WebSocket(
    // 👉 Đây là WS + token mình gắn sẵn
    "wss://websocket.azhkthg1.net/websocket?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJhbW91bnQiOjAsInVzZXJuYW1lIjoiU0NfYXBpc3Vud2luMTIzIn0.hgrRbSV6vnBwJMg9ZFtbx3rRu9mX_hZMZ_m5gMNhkw0",
    {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36",
        Origin: "https://play.sun.win",
      },
    }
  );

  ws.on("open", () => {
    console.log("[✅] WebSocket kết nối thành công");

    // join game / lobby
    ws.send(JSON.stringify([6, "MiniGame", "taixiuPlugin", { cmd: 1005 }]));
    ws.send(JSON.stringify([6, "MiniGame", "lobbyPlugin", { cmd: 10001 }]));

    // Ping giữ kết nối
    pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      }
    }, 15000);
  });

  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message);

      if (Array.isArray(data) && typeof data[1] === "object") {
        const cmd = data[1].cmd;

        // Phiên mới
        if (cmd === 1008 && data[1].sid) {
          currentRound = data[1].sid;
          console.log(`🆕 Phiên mới: ${currentRound}`);
        }

        // Kết quả phiên
        if (cmd === 1003 && data[1].gBB) {
          const { d1, d2, d3 } = data[1];
          const tong = d1 + d2 + d3;
          const ket_qua = tong > 10 ? "Tài" : "Xỉu";

          const record = {
            Phien: currentRound,
            ket_qua,
            tong,
            xuc_xac_1: d1,
            xuc_xac_2: d2,
            xuc_xac_3: d3,
          };

          history.unshift(record);
          if (history.length > 50) history.pop();

          console.log("🎲 Kết quả:", record);
        }
      }
    } catch (err) {
      console.error("❌ Lỗi parse:", err.message);
    }
  });

  ws.on("close", () => {
    console.log("[🔌] WebSocket đóng, kết nối lại sau 3s...");
    clearInterval(pingInterval);
    setTimeout(connectWebSocket, 3000);
  });

  ws.on("error", (err) => {
    console.error("[❌] Lỗi WebSocket:", err.message);
  });
}

// === API ===
app.get("/", (req, res) => {
  res.send("✅ API Sunwin History đang chạy!");
});

app.get("/phienmoinhat", (req, res) => {
  res.json({ currentRound });
});

app.get("/lichsu", (req, res) => {
  res.json(history);
});

// === Start server ===
app.listen(PORT, () => {
  console.log(`[🌐] Server chạy tại http://localhost:${PORT}`);
  connectWebSocket();
});
