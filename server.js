require("dotenv").config();
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const nodemailer = require("nodemailer");
const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3000;
const ADMIN_PASS = process.env.ADMIN_PASS || "admin123";

// Conexión a MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log("MongoDB conectado"))
  .catch(err => console.error("Error MongoDB:", err));

// Esquema de pedidos
const PedidoSchema = new mongoose.Schema({
  producto: String,
  monto: Number,
  metodo: String, // "transferencia" | "tarjeta"
  archivo: String, // nombre de archivo en uploads/
  correoCliente: String,
  nombreCliente: String,
  fecha: { type: Date, default: Date.now },
  estado: { type: String, default: "pendiente" }, // pendiente, pagado, confirmado, rechazado
  notas: String
});
const Pedido = mongoose.model("Pedido", PedidoSchema);

// Crear carpeta uploads si no existe
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

// Configuración de multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// Configuración de Nodemailer
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Servir archivos estáticos (frontend)
app.use("/", express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(uploadDir));

// Middleware sencillo para rutas admin (verifica header x-admin-pass o query)
function checkAdmin(req, res, next) {
  const pass = req.headers["x-admin-pass"] || req.query.admin_pass;
  if (pass === ADMIN_PASS) return next();
  return res.status(401).json({ ok: false, msg: "No autorizado" });
}

/*
 RUTAS:
 - POST /enviar-comprobante  -> recibe comprobante (transferencia), guarda en DB y manda correo
 - POST /crear-pedido-tarjeta -> crea pedido (tarjeta) (simulado)
 - GET  /api/pedidos         -> listar pedidos (admin)
 - GET  /api/pedidos/:id     -> ver un pedido (admin)
 - PUT  /api/pedidos/:id     -> actualizar estado / notas (admin)
*/

// Endpoint: recibir comprobante de transferencia
app.post("/enviar-comprobante", upload.single("comprobante"), async (req, res) => {
  try {
    const archivo = req.file;
    const { producto, monto, correoCliente, nombreCliente } = req.body;

    if (!archivo) return res.status(400).json({ ok: false, msg: "Falta comprobante" });

    // Guardar pedido en BD
    const pedido = new Pedido({
      producto,
      monto: Number(monto) || 0,
      metodo: "transferencia",
      archivo: archivo.filename,
      correoCliente: correoCliente || "",
      nombreCliente: nombreCliente || "",
      estado: "pendiente"
    });
    await pedido.save();

    // Enviar correo al vendedor con adjunto
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: process.env.DEST_EMAIL || process.env.EMAIL_USER,
      subject: "Nuevo comprobante de transferencia",
      html: `
        <h3>Nuevo comprobante recibido</h3>
        <p><strong>Producto:</strong> ${producto}</p>
        <p><strong>Monto:</strong> $${monto}</p>
        <p><strong>Cliente:</strong> ${nombreCliente || "N/A"} (${correoCliente || "N/A"})</p>
        <p><strong>Pedido ID:</strong> ${pedido._id}</p>
      `,
      attachments: [
        {
          filename: archivo.originalname,
          path: archivo.path
        }
      ]
    };

    await transporter.sendMail(mailOptions);

    res.json({ ok: true, pedidoId: pedido._id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, msg: "Error servidor" });
  }
});

// Endpoint: crear pedido por tarjeta (simulado; aquí podrías integrar Stripe/PayPal)
app.post("/api/pago-transferencia", upload.single("comprobante"), async (req, res) => {
    try {
        console.log("📥 Recibiendo comprobante...");

        if (!req.file) {
            console.log("❌ No se recibió archivo");
            return res.status(400).json({ error: "No se subió ningún archivo" });
        }

        console.log("📄 Archivo recibido:", req.file.filename);

        const { correoCliente, producto, monto } = req.body;

        console.log("📨 Enviando correo a:", correoCliente);

        // Envía el correo con adjunto
        await transporter.sendMail({
            from: EMAIL_USER,
            to: DEST_EMAIL,
            subject: "Nuevo pago por transferencia",
            text: `Se ha recibido un comprobante.`,
            attachments: [
                {
                    filename: req.file.originalname,
                    path: req.file.path
                }
            ]
        });

        console.log("📧 Correo enviado con éxito");

        // Guarda el pedido en MongoDB
        const nuevoPago = new Pago({
            producto,
            monto,
            metodo: "transferencia",
            archivo: req.file.filename,
            correoCliente,
            estado: "pendiente",
            fecha: new Date()
        });

        await nuevoPago.save();

        console.log("💾 Pedido guardado en MongoDB");

        res.json({ ok: true });

    } catch (err) {
        console.log("❌ Error procesando la transferencia:", err);
        res.status(500).json({ error: "Error procesando el pago" });
    }
});


// Admin: listar pedidos
app.get("/api/pedidos", checkAdmin, async (req, res) => {
  const pedidos = await Pedido.find().sort({ fecha: -1 }).lean();
  res.json({ ok: true, pedidos });
});

// Admin: ver pedido por id
app.get("/api/pedidos/:id", checkAdmin, async (req, res) => {
  const p = await Pedido.findById(req.params.id).lean();
  if (!p) return res.status(404).json({ ok: false, msg: "No encontrado" });
  res.json({ ok: true, pedido: p });
});

// Admin: actualizar estado y/o notas
app.put("/api/pedidos/:id", checkAdmin, async (req, res) => {
  const { estado, notas } = req.body;
  const p = await Pedido.findByIdAndUpdate(req.params.id, { estado, notas }, { new: true }).lean();
  if (!p) return res.status(404).json({ ok: false, msg: "No encontrado" });
  res.json({ ok: true, pedido: p });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
