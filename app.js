const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const firebase = require("firebase-admin");
require("dotenv").config();

// Firebase setup
const serviceAccount = {
  type: "service_account",
  project_id: process.env.PROJECT_ID,
  private_key_id: process.env.PRIVATE_KEY_ID,
  private_key: process.env.PRIVATE_KEY.replace(/\\n/g, "\n"),
  client_email: process.env.CLIENT_EMAIL,
  client_id: process.env.CLIENT_ID,
  auth_uri: process.env.AUTH_URI,
  token_uri: process.env.TOKEN_URI,
  auth_provider_x509_cert_url: process.env.AUTH_PROVIDER_CERT_URL,
  client_x509_cert_url: process.env.CLIENT_CERT_URL,
};
firebase.initializeApp({
  credential: firebase.credential.cert(serviceAccount),
  storageBucket: process.env.STORAGE_BUCKET,
});
const bucket = firebase.storage().bucket();

// Multer setup for file upload
const upload = multer({ dest: "uploads/" });

const app = express();
app.use(cors());

// MongoDB setup
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Define Schemas
const DetailProductSchema = new mongoose.Schema({
  image: String,
});

const ImageSchema = new mongoose.Schema({
  imageUrl: String,
  nama_product: String,
  harga: Number,
  deskripsi: String,
  rate: Number,
  category: String,
  lokasi: String,
  terjual: Number,
  stok: Number,
  type: String,
  createdat: { type: Date, default: Date.now },
  detailproduct: [DetailProductSchema],
});

// Define Model
const ImageModel = mongoose.model("ProductsBaru", ImageSchema);

// Route setup
app.post(
  "/upload",
  upload.fields([{ name: "image" }, { name: "detailproduct", maxCount: 5 }]),
  async (req, res) => {
    if (!req.files || !req.files["image"]) {
      return res.status(400).send("No image files were uploaded.");
    }

    try {
      const imageFileName = req.files["image"][0].originalname;
      const imageUpload = await bucket.upload(req.files["image"][0].path, {
        destination: imageFileName,
        public: true,
      });
      const imageUrl = imageUpload[0].metadata.mediaLink;

      const {
        nama_product,
        harga,
        deskripsi,
        rate,
        category,
        lokasi,
        terjual,
        stok,
        type,
        createdat,
      } = req.body;

      // Handling detail product images
      const detailProductImages = req.files["detailproduct"] || [];
      const detailProductUrls = [];
      for (const file of detailProductImages) {
        const fileName = file.originalname;
        const uploadResult = await bucket.upload(file.path, {
          destination: fileName,
          public: true,
        });
        const url = uploadResult[0].metadata.mediaLink;
        detailProductUrls.push({ image: url });
        fs.unlinkSync(file.path);
      }

      const image = new ImageModel({
        imageUrl,
        nama_product,
        harga,
        deskripsi,
        rate,
        category,
        lokasi,
        terjual,
        stok,
        type,
        createdat,
        detailproduct: detailProductUrls,
      });
      await image.save();

      fs.unlinkSync(req.files["image"][0].path);

      res.send(imageUrl);
    } catch (error) {
      console.error("Error uploading image:", error);
      res.status(500).send("Error uploading image. Please try again.");
    }
  }
);

app.get("/images", async (req, res) => {
  try {
    const images = await ImageModel.find();
    const imageUrls = images.map((image) => image.imageUrl);
    res.json(imageUrls);
  } catch (error) {
    console.error("Error retrieving uploaded images:", error);
    res.status(500).send("Error retrieving uploaded images. Please try again.");
  }
});

app.get("/all", async (req, res) => {
  try {
    const allData = await ImageModel.find();
    res.json(allData);
  } catch (error) {
    console.error("Error retrieving all data:", error);
    res.status(500).send("Error retrieving all data. Please try again.");
  }
});

app.get("/all/:id", async (req, res) => {
  const imageId = req.params.id;

  try {
    const imageData = await ImageModel.findById(imageId);
    if (!imageData) {
      return res.status(404).send("Image not found.");
    }
    res.json(imageData);
  } catch (error) {
    console.error("Error retrieving image:", error);
    res.status(500).send("Error retrieving image. Please try again.");
  }
});

app.delete("/delete/:id", async (req, res) => {
  const imageId = req.params.id;

  try {
    const deletedImage = await ImageModel.findByIdAndDelete(imageId);
    if (!deletedImage) {
      return res.status(404).send("Image not found.");
    }
    res.send("Product deleted successfully.");
  } catch (error) {
    console.error("Error deleting image:", error);
    res.status(500).send("Error deleting image. Please try again.");
  }
});

const PORT = process.env.PORT || 7000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
