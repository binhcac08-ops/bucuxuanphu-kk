const WebSocket = require("ws");
const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
const PORT = process.env.PORT || 5000;

// === Config WS & Token ===
const WS_URL = "wss://websocket.azhkthg1.net/websocket";
const WS_TOKEN =
  "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJhbW91bnQiOjAsInVzZXJuYW1lIjoiU0NfYXBpc3Vud2luMTIzIn0.hgrRbSV6vnBwJMg9ZFtbx3rRu9mX_hZMZ_m5gMNhkw0";

// === Biến lưu trạng thái ===
let currentData = {
  id: "binhtool90",
  Phien: null,
  ket_qua: "",
  tong: null,
  xuc_xac_1: null,
  xuc_xac_2: null,
  xuc_xac_3: null,
  pattern: "",
  du_doan: "?",
};

let id_phien_chua_co_kq = null;
let patternHistory = []; // Lưu dãy T/X gần nhất
let history = []; // Lưu lịch sử kết quả

// === Danh sách tin nhắn gửi lên server WebSocket ===
const messagesToSend = [
  [
    1,
    "MiniGame",
    "SC_dsucac",
    "binhsex",
    {
      info: JSON.stringify({
        ipAddress: "",
        userId: "",
        username: "",
        timestamp: Date.now(),
        refreshToken: "",
      }),
      signature: "",
    },
  ],
  [6, "MiniGame", "taixiuPlugin", { cmd: 1005 }],
  [6, "MiniGame", "lobbyPlugin", { cmd: 10001 }],
];

// === WebSocket ===
let ws = null;
let pingInterval = null;
let reconnectTimeout = null;
let isManuallyClosed = false;

// Hàm dự đoán tiếp theo
function duDoanTiepTheo(pattern) {
  if (pattern.length < 6) return "?";

  const last3 = pattern.slice(-3).join("");
  const last4 = pattern.slice(-4).join("");

  const count = pattern.join("").split(last3).length - 1;
  if (count >= 2) return last3[0];

  const count4 = pattern.join("").split(last4).length - 1;
  if (count4 >= 2) return last4[0];

  return "?";
}

function connectWebSocket() {
  ws = new WebSocket(`${WS_URL}?token=${WS_TOKEN}`, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      Origin: "https://play.sun.win",
    },
  });

  ws.on("open", () => {
    console.log("[✅] WebSocket kết nối");
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
          const result = total > 10 ? "T" : "X"; // Tài / Xỉu

          // Lưu pattern
          patternHistory.push(result);
          if (patternHistory.length > 20) patternHistory.shift();

          const du_doan = duDoanTiepTheo(patternHistory);

          currentData = {
            id: "binhtool90",
            Phien: id_phien_chua_co_kq,
            ket_qua: result === "T" ? "Tài" : "Xỉu",
            tong: total,
            xuc_xac_1: d1,
            xuc_xac_2: d2,
            xuc_xac_3: d3,
            pattern: patternHistory.join(""),
            du_doan: du_doan === "T" ? "Tài" : du_doan === "X" ? "Xỉu" : "?",
          };

          // Thêm vào lịch sử (bỏ du_doan, pattern)
          history.unshift({
            Phien: id_phien_chua_co_kq,
            ket_qua: currentData.ket_qua,
            tong: total,
            xuc_xac_1: d1,
            xuc_xac_2: d2,
            xuc_xac_3: d3,
          });
          if (history.length > 30) history.pop(); // Giữ tối đa 30 phiên

          console.log(
            `Phiên ${id_phien_chua_co_kq}: ${d1}-${d2}-${d3} = ${total} (${currentData.ket_qua}) → Dự đoán: ${currentData.du_doan}`
          );
          id_phien_chua_co_kq = null;
        }
      }
    } catch (e) {
      console.error("[Lỗi]:", e.message);
    }
  });

  ws.on("close", () => {
    console.log("[🔌] WebSocket ngắt. Đang kết nối lại...");
    clearInterval(pingInterval);
    if (!isManuallyClosed) {
      reconnectTimeout = setTimeout(connectWebSocket, 2500);
    }
  });

  ws.on("error", (err) => {
    console.error("[❌] WebSocket lỗi:", err.message);
  });
}

// === API ===
app.get("/taixiu", (req, res) => {
  res.json(currentData); // có dự đoán
});

app.get("/lichsu", (req, res) => {
  res.json(history); // chỉ kết quả
});

app.get("/", (req, res) => {
  res.send(
    `<h2>🎯 Kết quả Sunwin Tài Xỉu</h2>
     <p><a href="/taixiu">Xem kết quả hiện tại</a></p>
     <p><a href="/lichsu">Xem lịch sử</a></p>`
  );
});

// === Khởi động server ===
app.listen(PORT, () => {
  console.log(`[🌐] Server chạy tại http://localhost:${PORT}`);
  connectWebSocket();
});
