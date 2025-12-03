const express = require("express");
const bodyParser = require("body-parser");
const sql = require("mssql"); // or use mysql2 for MySQL
const cors = require("cors");
const app = express();
app.use(cors());
app.use(bodyParser.json());

// SQL config example (SQL Server)
const dbConfig = {
    user: "sa",
    password: "P@ssw0rd",
    server: "192.168.1.10",  // only IP here
    port: 1995,              // specify port separately
    database: "n8n",
    options: {
        encrypt: false,
        trustServerCertificate: true
    }
};


app.post("/save-books", async (req, res) => {
    try {
        const books = req.body; // Expecting an array of { BookName, Title, Chapter }
        const SystemName = "Server";

        if (!Array.isArray(books) || books.length === 0) {
            return res.status(400).json({ success: false, message: "No books provided" });
        }

        let pool = await sql.connect(dbConfig);
        const transaction = new sql.Transaction(pool);

        await transaction.begin();

        const request = new sql.Request(transaction);

        for (const book of books) {
            const { BookName, Title, Chapter } = book;
            if (!BookName || !Chapter) continue;

            const fullText = Array.isArray(Chapter) ? Chapter.join("\n") : Chapter;

            await request
                .input("BookName", sql.NVarChar, BookName)
                .input("Title", sql.NVarChar, Title)
                .input("Chapter", sql.NVarChar, fullText)
                .input("SystemName", sql.NVarChar, SystemName)
                .query(`
                    INSERT INTO BookList (BookName, Title, Chapter, SystemName, CreatedAt)
                    VALUES (@BookName, @Title, @Chapter, @SystemName, GETDATE())
                `);

            // Clear parameters to avoid reuse issues
            request.parameters = {};
        }

        await transaction.commit();

        res.json({ success: true, message: "All books saved successfully" });
    } catch (err) {
        console.error("Error saving book list:", err);
        res.status(500).json({ success: false, message: "Error saving book list" });
    }
});


 


app.get("/get-lines", async (req, res) => {
    try {
        let pool = await sql.connect(dbConfig);
        const result = await pool.request().query(`
      SELECT TOP 1 LineText FullText FROM TextLines ORDER BY Id DESC
    `);

        if (result.recordset.length === 0) {
            return res.json({ fullText: "" });
        }

        res.json({ fullText: result.recordset[0].FullText });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: err.message });
    }
});


// ✅ Get Book Detail by Id
app.get("/get-book/:id", async (req, res) => {
    try {
        const { id } = req.params;

        if (!id || isNaN(id)) {
            return res.status(400).json({ success: false, message: "Invalid or missing ID" });
        }

        let pool = await sql.connect(dbConfig);
        const result = await pool.request()
            .input("Id", sql.Int, id)
            .query(`SELECT Id, BookName, Title, Chapter, SystemName, CreatedAt FROM BookList WHERE Id = @Id`);

        if (result.recordset.length === 0) {
            return res.status(404).json({ success: false, message: "Book not found" });
        }

        res.json({ success: true, data: result.recordset[0] });
    } catch (err) {
        console.error("Error fetching book:", err);
        res.status(500).json({ success: false, message: "Error fetching book details" });
    }
});

// ✅ Get All Saved Books
app.get("/get-books", async (req, res) => {
    try {
        let pool = await sql.connect(dbConfig);
        const result = await pool.request().query(`
            SELECT Id, BookName, Title, Chapter, SystemName, CreatedAt
            FROM BookList
            ORDER BY Id DESC
        `);

        res.json({
            success: true,
            total: result.recordset.length,
            data: result.recordset
        });
    } catch (err) {
        console.error("Error fetching book list:", err);
        res.status(500).json({
            success: false,
            message: "Error fetching book list",
            error: err.message
        });
    }
});


app.listen(3000, () => console.log("Server running on port 3000"));
