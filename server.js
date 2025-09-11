import express from "express";
import AWS from "aws-sdk";

const app = express();
const port = process.env.PORT || 3000;

// ✅ Enable CORS
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  next();
});

// ✅ S3 config
const s3 = new AWS.S3({
  region: process.env.AWS_REGION || "eu-north-1",
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

// ✅ Root endpoint
app.get("/", (req, res) => {
  res.send("✅ Server is running! Use /albums or /images/:albumName");
});

// ✅ List albums
app.get("/albums", async (req, res) => {
  try {
    const params = {
      Bucket: "curvewrotofoliowebsite",
      Prefix: "Weddings/",
      Delimiter: "/",
    };

    const data = await s3.listObjectsV2(params).promise();
    const albums = (data.CommonPrefixes || []).map((prefix) =>
      decodeURIComponent(
        prefix.Prefix.replace("Weddings/", "").replace("/", "")
      )
    );

    res.json(albums);
  } catch (err) {
    console.error("S3 fetch error:", err);
    res.status(500).json({ error: "Failed to fetch albums" });
  }
});

// ✅ Fetch images (thumbnails + full quality)
app.get("/images/:albumName", async (req, res) => {
  try {
    const albumName = decodeURIComponent(req.params.albumName);

    // Full-quality images live under Weddings/
    const fullParams = {
      Bucket: "curvewrotofoliowebsite",
      Prefix: `Weddings/${albumName}/`,
    };

    const data = await s3.listObjectsV2(fullParams).promise();

    if (!data.Contents || data.Contents.length === 0) return res.json([]);

    // Build URLs
    const urls = data.Contents.filter((obj) =>
      obj.Key.match(/\.(jpe?g|png|gif)$/i)
    ).map((obj) => {
      // Full image URL
      const full = `https://${fullParams.Bucket}.s3.${s3.config.region}.amazonaws.com/${encodeURI(
        obj.Key
      )}`;

      // Thumbnail assumes same file name but stored under Thumbnails/
      const thumb = full.replace("Weddings", "Thumbnails");

      return { thumb, full };
    });

    res.json(urls);
  } catch (err) {
    console.error("S3 fetch error:", err);
    res.status(500).json({ error: "Failed to fetch images" });
  }
});

app.listen(port, () => {
  console.log(`✅ Server running at http://localhost:${port}`);
});
