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
exports.connectDB = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = require("dotenv");
(0, dotenv_1.config)();
const DB_PASSWORD = process.env.MONGODB_PASSWORD;
const DB_USERNAME = process.env.MONGODB_USERNAME;
const DB_NAME = process.env.DB_NAME;
if (!DB_PASSWORD) {
    console.log("DB_PASSWORD environment is not set");
    process.exit(1);
}
const MONGODB_URI = `mongodb+srv://${DB_USERNAME}:${DB_PASSWORD}@cluster0.uoa3z.mongodb.net/${DB_NAME}?retryWrites=true&w=majority&appName=Cluster0`;
const connectDB = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield mongoose_1.default.connect(MONGODB_URI);
        console.log(`Connected to MongoDB Atlas ${MONGODB_URI}`);
        mongoose_1.default.connection.on("error", (err) => {
            console.log(`MongoDB connection error: ${err}`);
        });
        mongoose_1.default.connection.on("disconnected", () => {
            console.log("MongoDB disconnected");
        });
        process.on("SIGINT", () => __awaiter(void 0, void 0, void 0, function* () {
            yield mongoose_1.default.connection.close();
            console.log("MongoDB connection closed through app termination");
            process.exit(0);
        }));
    }
    catch (error) {
        console.error("Failed to connect to MongoDB:", error);
    }
});
exports.connectDB = connectDB;
