const express = require("express");
const cors = require("cors");
const http = require("http");
const connectDB = require("./dbconnect/db");
const ticketRoutes = require("./routes/ticket.routes");
const chatRoutes = require("./routes/chat.routes");
const agentRoutes = require("./routes/agent.routes");
const authRoutes = require("./routes/auth.routes");
const { initSocket } = require("./socket/socket");
const { seedDefaultAgents } = require("./controllers/agent.controller");

const app = express();
const server = http.createServer(app);

// Connect to Database and seed default agents
connectDB()
  .then(() => seedDefaultAgents())
  .catch((err) => console.error('Database initialization failed:', err));

// Initialize WebSockets
initSocket(server);

// Middlewares
app.use(cors());
app.use(express.json());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/agents", agentRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/agents", agentRoutes);
app.use("/api/tickets", ticketRoutes);
app.use("/api/chats", chatRoutes);

server.listen(3000, () => {
    console.log("server working on port ", 3000);
});