import express from "express";
import AWS from "aws-sdk";
import sharp from "sharp";

const app = express();
const port = 3000;

// ✅ Enable CORS
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

const s3 = new AWS.S3({
  region: "eu-north-1",
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

// ✅ Root endpoint
app.get("/", (req, res) => {
  res.send("✅ Server is running! Use /albums or /images/:albumName");
});

// ✅ List all albums (folders under Weddings/)
app.get("/albums", async (req, res) => {
  try {
    const params = { Bucket: "curvewrotofoliowebsite", Prefix: "Weddings/", Delimiter: "/" };
    const data = await s3.listObjectsV2(params).promise();

    const albums = (data.CommonPrefixes || []).map(prefix =>
      decodeURIComponent(prefix.Prefix.replace("Weddings/", "").replace("/", ""))
    );

    res.json(albums);
  } catch (err) {
    console.error("S3 fetch error:", err);
    res.status(500).json({ error: "Failed to fetch albums" });
  }
});

// ✅ Fetch images with thumbnails
app.get("/images/:albumName", async (req, res) => {
  try {
    const albumName = decodeURIComponent(req.params.albumName);
    const params = { Bucket: "curvewrotofoliowebsite", Prefix: `Weddings/${albumName}/` };

    const data = await s3.listObjectsV2(params).promise();
    if (!data.Contents || data.Contents.length === 0) return res.json([]);

    const results = await Promise.all(
      data.Contents
        .filter(obj => obj.Key.match(/\.(jpe?g|png)$/i))
        .map(async (obj) => {
          const fullUrl = `https://${params.Bucket}.s3.eu-north-1.amazonaws.com/${encodeURI(obj.Key)}`;

          // Thumbnail key: put in "Thumbnails/" instead of "Weddings/"
          const thumbKey = obj.Key.replace("Weddings/", "Thumbnails/");

          try {
            // Check if thumbnail already exists
            await s3.headObject({ Bucket: params.Bucket, Key: thumbKey }).promise();
          } catch {
            // If not, generate thumbnail
            const original = await s3.getObject({ Bucket: params.Bucket, Key: obj.Key }).promise();
            const buffer = await sharp(original.Body)
              .resize({ width: 400 }) // ✅ resize to 400px width
              .jpeg({ quality: 60 })  // ✅ compress to 60% quality
              .toBuffer();

            await s3.putObject({
              Bucket: params.Bucket,
              Key: thumbKey,
              Body: buffer,
              ContentType: "image/jpeg",
            }).promise();
          }

          const thumbUrl = `https://${params.Bucket}.s3.eu-north-1.amazonaws.com/${encodeURI(thumbKey)}`;
          return { thumb: thumbUrl, full: fullUrl };
        })
    );

    res.json(results);
  } catch (err) {
    console.error("S3 fetch error:", err);
    res.status(500).json({ error: "Failed to fetch images" });
  }
});

app.listen(port, () => {
  console.log(`✅ Server running at http://localhost:${port}`);
});
