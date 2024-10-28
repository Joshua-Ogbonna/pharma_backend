declare global {
  namespace Express {
    interface Request {
      user?: { id: string; role: string };
    }
  }
}

// src/index.ts
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import QRCode from "qrcode";
import crypto from "crypto";
import { connectDB } from "./db";

const app = express();
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  })
);
app.use(express.json());

const port = process.env.PORT || 30299;

// MongoDB Models
const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: {
    type: String,
    enum: ["admin", "pharmacist", "consumer"],
    required: true,
  },
});

const ProductSchema = new mongoose.Schema({
  name: { type: String, required: true },
  batchNumber: { type: String, required: true },
  manufacturingDate: { type: Date, required: true },
  expirationDate: { type: Date, required: true },
  qrCode: { type: String, required: true },
  uniqueIdentifier: { type: String, required: true, unique: true },
});

const VerificationLogSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  timestamp: { type: Date, default: Date.now },
  location: { type: String },
  status: { type: String, enum: ["valid", "invalid", "expired"] },
});

const User = mongoose.model("NewUser", UserSchema);
const Product = mongoose.model("Product", ProductSchema);
const VerificationLog = mongoose.model(
  "VerificationLog",
  VerificationLogSchema
);

// Middleware
const authenticateToken = (req: any, res: any, next: any) => {
  const token = req.headers["authorization"]?.split(" ")[1];
  if (!token) return res.sendStatus(401);

  jwt.verify(token, process.env.JWT_SECRET!, (err: any, user: any) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// Routes
app.post("/api/register", async (req, res) => {
  console.log("running");
  try {
    const { email, password, role } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ email, password: hashedPassword, role });
    await user.save();
    res.status(201).json({ message: "User created successfully" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Error creating user" });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log(email, password);
    const user = await User.findOne({ email });

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      res.status(401).json({ error: "Invalid password" });
      return;
    }
    console.log(user);

    const token = jwt.sign(
      { id: user._id, role: user.role },
      'process.env.JWT_SECRET!',
      { expiresIn: "24h" }
    );
    console.log(token)
    res.json({ token });
  } catch (error) {
    console.log(error)
    res.status(500).json({ error: "Error logging in" });
  }
});

app.post("/api/generate-qr", authenticateToken, async (req, res) => {
  try {
    const { name, batchNumber, manufacturingDate, expirationDate } = req.body;
    const uniqueIdentifier = crypto.randomBytes(32).toString("hex");

    const productData = {
      name,
      batchNumber,
      manufacturingDate,
      expirationDate,
      uniqueIdentifier,
    };

    const encryptedData = crypto.publicEncrypt(
      'process.env.PRIVATE_KEY!',
      Buffer.from(JSON.stringify(productData))
    );

    const qrCode = await QRCode.toDataURL(encryptedData.toString("base64"));

    const product = new Product({
      ...productData,
      qrCode,
    });

    await product.save();
    res.json({ qrCode, productId: product._id });
  } catch (error) {
    res.status(500).json({ error: "Error generating QR code" });
  }
});

app.post("/api/verify-qr", authenticateToken, async (req, res) => {
  try {
    const { qrData, location } = req.body;
    const decryptedData = crypto.privateDecrypt(
      'process.env.PRIVATE_KEY!',
      Buffer.from(qrData, "base64")
    );

    const productData = JSON.parse(decryptedData.toString());
    const product = await Product.findOne({
      uniqueIdentifier: productData.uniqueIdentifier,
    });

    if (!product) {
      res.status(404).json({ error: "Product not found" });
      return;
    }

    const verificationLog = new VerificationLog({
      productId: product._id,
      userId: req?.user?.id,
      location,
      status:
        new Date() > new Date(product.expirationDate) ? "expired" : "valid",
    });

    await verificationLog.save();
    res.json({ product, status: verificationLog.status });
  } catch (error) {
    res.status(500).json({ error: "Error verifying QR code" });
  }
});

app.get("/api/verification-stats", authenticateToken, async (req, res) => {
  try {
    const stats = await VerificationLog.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);
    console.log(stats)
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: "Error fetching statistics" });
  }
});

const startServer = async () => {
  await connectDB();

  app.listen(port, () => {
    console.log(`Server is running on PORT http://localhost${port}`);
  });
};

startServer().catch(console.error);
