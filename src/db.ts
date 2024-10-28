import mongoose from "mongoose";
import { config } from "dotenv";

config();

const DB_PASSWORD = process.env.MONGODB_PASSWORD;
const DB_USERNAME = process.env.MONGODB_USERNAME;
const DB_NAME = process.env.DB_NAME;

if (!DB_PASSWORD) {
  console.log("DB_PASSWORD environment is not set");
  process.exit(1);
}

const MONGODB_URI = `mongodb+srv://${DB_USERNAME}:${DB_PASSWORD}@cluster0.uoa3z.mongodb.net/${DB_NAME}?retryWrites=true&w=majority&appName=Cluster0`;

export const connectDB = async (): Promise<void> => {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log(`Connected to MongoDB Atlas ${MONGODB_URI}`);

    mongoose.connection.on("error", (err) => {
      console.log(`MongoDB connection error: ${err}`);
    });

    mongoose.connection.on("disconnected", () => {
      console.log("MongoDB disconnected");
    });

    process.on("SIGINT", async () => {
      await mongoose.connection.close();
      console.log("MongoDB connection closed through app termination");
      process.exit(0);
    });
  } catch (error) {
    console.error("Failed to connect to MongoDB:", error);
  }
};
