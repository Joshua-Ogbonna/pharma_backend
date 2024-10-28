"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/index.ts
const express_1 = __importDefault(require("express"));
const mongoose_1 = __importDefault(require("mongoose"));
const cors_1 = __importDefault(require("cors"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const qrcode_1 = __importDefault(require("qrcode"));
const crypto_1 = __importDefault(require("crypto"));
const db_1 = require("./db");
const app = (0, express_1.default)();
app.use((0, cors_1.default)({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
}));
app.use(express_1.default.json());
const port = process.env.PORT || 30299;
// MongoDB Models
const UserSchema = new mongoose_1.default.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: {
        type: String,
        enum: ["admin", "pharmacist", "consumer"],
        required: true,
    },
});
const ProductSchema = new mongoose_1.default.Schema({
    name: { type: String, required: true },
    batchNumber: { type: String, required: true },
    manufacturingDate: { type: Date, required: true },
    expirationDate: { type: Date, required: true },
    qrCode: { type: String, required: true },
    uniqueIdentifier: { type: String, required: true, unique: true },
});
const VerificationLogSchema = new mongoose_1.default.Schema({
    productId: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "Product" },
    userId: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "User" },
    timestamp: { type: Date, default: Date.now },
    location: { type: String },
    status: { type: String, enum: ["valid", "invalid", "expired"] },
});
const User = mongoose_1.default.model("NewUser", UserSchema);
const Product = mongoose_1.default.model("Product", ProductSchema);
const VerificationLog = mongoose_1.default.model("VerificationLog", VerificationLogSchema);
// Middleware
const authenticateToken = (req, res, next) => {
    var _a;
    const token = (_a = req.headers["authorization"]) === null || _a === void 0 ? void 0 : _a.split(" ")[1];
    if (!token)
        return res.sendStatus(401);
    jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err)
            return res.sendStatus(403);
        req.user = user;
        next();
    });
};
app.get("/", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    res.json({ message: "Hello world" });
}));
// Routes
app.post("/api/register", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    console.log("running");
    try {
        const { email, password, role } = req.body;
        const hashedPassword = yield bcrypt_1.default.hash(password, 10);
        const user = new User({ email, password: hashedPassword, role });
        yield user.save();
        res.status(201).json({ message: "User created successfully" });
    }
    catch (error) {
        console.log(error);
        res.status(500).json({ error: "Error creating user" });
    }
}));
app.post("/api/login", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { email, password } = req.body;
        console.log(email, password);
        const user = yield User.findOne({ email });
        if (!user) {
            res.status(404).json({ error: "User not found" });
            return;
        }
        const validPassword = yield bcrypt_1.default.compare(password, user.password);
        if (!validPassword) {
            res.status(401).json({ error: "Invalid password" });
            return;
        }
        console.log(user);
        const token = jsonwebtoken_1.default.sign({ id: user._id, role: user.role }, 'process.env.JWT_SECRET!', { expiresIn: "24h" });
        console.log(token);
        res.json({ token });
    }
    catch (error) {
        console.log(error);
        res.status(500).json({ error: "Error logging in" });
    }
}));
app.post("/api/generate-qr", authenticateToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { name, batchNumber, manufacturingDate, expirationDate } = req.body;
        const uniqueIdentifier = crypto_1.default.randomBytes(32).toString("hex");
        const productData = {
            name,
            batchNumber,
            manufacturingDate,
            expirationDate,
            uniqueIdentifier,
        };
        const encryptedData = crypto_1.default.publicEncrypt('process.env.PRIVATE_KEY!', Buffer.from(JSON.stringify(productData)));
        const qrCode = yield qrcode_1.default.toDataURL(encryptedData.toString("base64"));
        const product = new Product(Object.assign(Object.assign({}, productData), { qrCode }));
        yield product.save();
        res.json({ qrCode, productId: product._id });
    }
    catch (error) {
        res.status(500).json({ error: "Error generating QR code" });
    }
}));
app.post("/api/verify-qr", authenticateToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { qrData, location } = req.body;
        const decryptedData = crypto_1.default.privateDecrypt('process.env.PRIVATE_KEY!', Buffer.from(qrData, "base64"));
        const productData = JSON.parse(decryptedData.toString());
        const product = yield Product.findOne({
            uniqueIdentifier: productData.uniqueIdentifier,
        });
        if (!product) {
            res.status(404).json({ error: "Product not found" });
            return;
        }
        const verificationLog = new VerificationLog({
            productId: product._id,
            userId: (_a = req === null || req === void 0 ? void 0 : req.user) === null || _a === void 0 ? void 0 : _a.id,
            location,
            status: new Date() > new Date(product.expirationDate) ? "expired" : "valid",
        });
        yield verificationLog.save();
        res.json({ product, status: verificationLog.status });
    }
    catch (error) {
        res.status(500).json({ error: "Error verifying QR code" });
    }
}));
app.get("/api/verification-stats", authenticateToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const stats = yield VerificationLog.aggregate([
            {
                $group: {
                    _id: "$status",
                    count: { $sum: 1 },
                },
            },
        ]);
        console.log(stats);
        res.json(stats);
    }
    catch (error) {
        res.status(500).json({ error: "Error fetching statistics" });
    }
}));
const startServer = () => __awaiter(void 0, void 0, void 0, function* () {
    yield (0, db_1.connectDB)();
    app.listen(port, () => {
        console.log(`Server is running on PORT http://localhost${port}`);
    });
});
startServer().catch(console.error);
