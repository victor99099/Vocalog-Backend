const express = require("express");
const router = express.Router();
const { sql, poolPromise } = require("../db");

// Create Recording
router.post("/", async (req, res) => {
    const { user_id, topic, file_link, transcript, output } = req.body;
    try {
        const pool = await poolPromise;
        await pool.request()
            .input("user_id", sql.Int, user_id)
            .input("topic", sql.NVarChar, topic)
            .input("file_link", sql.NVarChar, file_link)
            .input("transcript", sql.NVarChar, transcript)
            .input("output", sql.NVarChar, output)
            .query("INSERT INTO recordings (user_id, topic, file_link, transcript, output) VALUES (@user_id, @topic, @file_link, @transcript, @output)");
        res.status(201).json({ message: "Recording created successfully!" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get Recordings
router.get("/", async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query("SELECT * FROM recordings");
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update Recording
router.put("/:id", async (req, res) => {
    const { id } = req.params;
    const { topic, file_link, transcript, output } = req.body;
    try {
        const pool = await poolPromise;
        await pool.request()
            .input("id", sql.Int, id)
            .input("topic", sql.NVarChar, topic)
            .input("file_link", sql.NVarChar, file_link)
            .input("transcript", sql.NVarChar, transcript)
            .input("output", sql.NVarChar, output)
            .query("UPDATE recordings SET topic=@topic, file_link=@file_link, transcript=@transcript, output=@output WHERE id=@id");
        res.json({ message: "Recording updated successfully!" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete Recording
router.delete("/:id", async (req, res) => {
    const { id } = req.params;
    try {
        const pool = await poolPromise;
        await pool.request().input("id", sql.Int, id).query("DELETE FROM recordings WHERE id=@id");
        res.json({ message: "Recording deleted successfully!" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

//Get all recordings of a specific user
router.get("/user/:user_id", async (req, res) => {
    const { user_id } = req.params;
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input("user_id", sql.Int, user_id)
            .query("SELECT * FROM recordings WHERE user_id=@user_id");

        res.json(result.recordset); // Return list of recordings
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
