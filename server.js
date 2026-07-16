const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const SENHA = process.env.SENHA_ACESSO || "";
const DB_FILE = path.join(__dirname, "orders.json");

// Proteção simples por senha (só ativa se SENHA_ACESSO estiver configurada)
if (SENHA) {
  app.use((req, res, next) => {
    const auth = req.headers.authorization;
    if (auth) {
      const [, encoded] = auth.split(" ");
      const [, pass] = Buffer.from(encoded, "base64").toString().split(":");
      if (pass === SENHA) return next();
    }
    res.set("WWW-Authenticate", 'Basic realm="Fila de Ordens"');
    res.status(401).send("Senha necessária");
  });
}

app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "public")));

function readOrders() {
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
  } catch {
    return [];
  }
}

function writeOrders(orders) {
  fs.writeFileSync(DB_FILE, JSON.stringify(orders, null, 2), "utf8");
}

// Lista todas as ordens
app.get("/api/orders", (req, res) => {
  res.json(readOrders());
});

// Adiciona uma nova ordem (o texto já vem parseado do navegador)
app.post("/api/orders", (req, res) => {
  const orders = readOrders();
  const newOrder = {
    id: `ord-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    status: "pendente",
    parsed: req.body.parsed,
    manualData: req.body.manualData,
    createdAt: new Date().toISOString(),
  };
  orders.unshift(newOrder);
  writeOrders(orders);
  res.json(orders);
});

// Marca uma ordem como concluída, com os dados preenchidos pelo operador
app.patch("/api/orders/:id", (req, res) => {
  const orders = readOrders();
  const idx = orders.findIndex((o) => o.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Ordem não encontrada" });
  orders[idx].status = "concluida";
  orders[idx].manualData = req.body.manualData;
  orders[idx].completedAt = new Date().toISOString();
  writeOrders(orders);
  res.json(orders);
});

// Reabre uma ordem concluída, voltando ela pra fila da produção
app.post("/api/orders/:id/reabrir", (req, res) => {
  const orders = readOrders();
  const idx = orders.findIndex((o) => o.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Ordem não encontrada" });
  orders[idx].status = "pendente";
  delete orders[idx].completedAt;
  writeOrders(orders);
  res.json(orders);
});

// Exclui uma ordem definitivamente (some das duas telas)
app.delete("/api/orders/:id", (req, res) => {
  const orders = readOrders();
  const next = orders.filter((o) => o.id !== req.params.id);
  writeOrders(next);
  res.json(next);
});

app.listen(PORT, () => {
  console.log(`Fila de ordens rodando em http://localhost:${PORT}`);
  console.log(`Acesse de outros aparelhos usando o IP desta máquina, ex: http://192.168.x.x:${PORT}`);
});
