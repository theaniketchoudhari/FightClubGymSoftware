import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { fileURLToPath } from "url";
import fs from "fs";
import { generateInvoicePDF } from "./src/utils/pdfGenerator";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load firebase config
const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
let firebaseConfig: any = {};
if (fs.existsSync(configPath)) {
  firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
} else {
  console.error("Firebase config file not found!");
}

// Initialize Firebase Admin
const appInstance = getApps().length === 0 
  ? initializeApp({ projectId: firebaseConfig.projectId }) 
  : getApps()[0];

const dbInstance = getFirestore(appInstance, firebaseConfig.firestoreDatabaseId || '(default)');

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Dynamic invoice generation & download endpoint
  app.get("/api/invoices/:memberId", async (req, res) => {
    try {
      const { memberId } = req.params;
      console.log(`[Server] Generating invoice for member: ${memberId}`);
      const docRef = dbInstance.collection("members").doc(memberId);
      const docSnap = await docRef.get();

      if (!docSnap.exists) {
        return res.status(404).send("Member not found. Please verify the ID.");
      }

      const memberData = { id: docSnap.id, ...docSnap.data() } as any;
      
      // Ensure all dates are present in memberData
      if (!memberData.joinDate) memberData.joinDate = new Date().toISOString();
      if (!memberData.expiryDate) memberData.expiryDate = new Date().toISOString();

      const docPdf = generateInvoicePDF(memberData);
      
      // Get the binary array
      const pdfArrayBuffer = docPdf.output("arraybuffer");
      const pdfBuffer = Buffer.from(pdfArrayBuffer);

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition", 
        `inline; filename="Invoice_${memberData.name.replace(/\s+/g, "_")}.pdf"`
      );
      res.send(pdfBuffer);
    } catch (err: any) {
      console.error("[Invoice Endpoint Error]:", err);
      res.status(500).send("Failed to generate digital invoice: " + err.message);
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        host: '0.0.0.0',
        port: 3000
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(err => {
  console.error("Failed to start server:", err);
});
