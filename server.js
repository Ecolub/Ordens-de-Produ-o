const express = require("express");
const path = require("path");
const { MongoClient } = require("mongodb");

const app = express();
const PORT = process.env.PORT || 3000;
const SENHA = process.env.SENHA_ACESSO || "";
const MONGODB_URI = process.env.MONGODB_URI || "";

let ordersCollection;

async function connectDB() {
  if (!MONGODB_URI) {
    console.error("ERRO: variável de ambiente MONGODB_URI não configurada. Configure-a no painel do Render.");
    return;
  }
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db("ordemproducao");
  ordersCollection = db.collection("orders");
  console.log("Conectado ao MongoDB Atlas — as ordens agora ficam salvas de verdade.");
}

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

async function listaAtualizada() {
  const docs = await ordersCollection.find({}).sort({ createdAt: 1 }).toArray();
  return docs.map(({ _id, ...rest }) => rest);
}

// Lista todas as ordens
app.get("/api/orders", async (req, res) => {
  try {
    res.json(await listaAtualizada());
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Falha ao ler o banco de dados" });
  }
});

// Adiciona uma nova ordem (o texto já vem parseado do navegador)
app.post("/api/orders", async (req, res) => {
  try {
    const newOrder = {
      id: `ord-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      status: "pendente",
      parsed: req.body.parsed,
      manualData: req.body.manualData,
      createdAt: new Date().toISOString(),
    };
    await ordersCollection.insertOne(newOrder);
    res.json(await listaAtualizada());
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Falha ao salvar a ordem" });
  }
});

// Salva o progresso preenchido (hora, matéria-prima marcada) sem concluir a ordem
app.patch("/api/orders/:id/rascunho", async (req, res) => {
  try {
    const result = await ordersCollection.updateOne(
      { id: req.params.id },
      { $set: { manualData: req.body.manualData } }
    );
    if (result.matchedCount === 0) return res.status(404).json({ error: "Ordem não encontrada" });
    res.json(await listaAtualizada());
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Falha ao salvar o progresso" });
  }
});

// Marca uma ordem como concluída, com os dados preenchidos pelo operador
app.patch("/api/orders/:id", async (req, res) => {
  try {
    const result = await ordersCollection.updateOne(
      { id: req.params.id },
      { $set: { status: "concluida", manualData: req.body.manualData, completedAt: new Date().toISOString() } }
    );
    if (result.matchedCount === 0) return res.status(404).json({ error: "Ordem não encontrada" });
    res.json(await listaAtualizada());
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Falha ao concluir a ordem" });
  }
});

// Reabre uma ordem concluída, voltando ela pra fila da produção
app.post("/api/orders/:id/reabrir", async (req, res) => {
  try {
    const result = await ordersCollection.updateOne(
      { id: req.params.id },
      { $set: { status: "pendente" }, $unset: { completedAt: "" } }
    );
    if (result.matchedCount === 0) return res.status(404).json({ error: "Ordem não encontrada" });
    res.json(await listaAtualizada());
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Falha ao reabrir a ordem" });
  }
});

// Exclui uma ordem definitivamente (some das duas telas)
app.delete("/api/orders/:id", async (req, res) => {
  try {
    await ordersCollection.deleteOne({ id: req.params.id });
    res.json(await listaAtualizada());
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Falha ao excluir a ordem" });
  }
});

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Fila de ordens (versão nuvem, com banco de dados) rodando na porta ${PORT}`);
  });
});
